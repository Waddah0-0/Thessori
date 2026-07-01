import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'thessori_session_id'

// A failed fetch (server down / no network) throws a TypeError, not an HTTP
// error — translate it into something the user can act on.
function netError(e) {
  if (e instanceof TypeError || /fetch/i.test(e?.message || '')) {
    return 'Could not reach the server. Make sure the backend is running on :8000.'
  }
  return e.message
}

export function useResearch() {
  const [stage, setStage] = useState('idle') // idle | searching | review | generating | done
  const [sessionId, setSessionId] = useState(null)
  const [papers, setPapers] = useState([])
  const [markdown, setMarkdown] = useState('')
  const [error, setError] = useState(null)
  const [activeQueries, setActiveQueries] = useState([''])
  const [progressMsg, setProgressMsg] = useState('')
  const [progressStage, setProgressStage] = useState('papers_summarized')
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [currentAction, setCurrentAction] = useState('')
  const [resumable, setResumable] = useState(null) // { sessionId, status, papers, markdown } | null
  const [searchInfo, setSearchInfo] = useState(null) // { queries, original } — what was actually searched
  const [history, setHistory] = useState([])

  async function loadHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/history`)
      if (res.ok) {
        const data = await res.json()
        setHistory(data)
      }
    } catch (e) {
      console.error('Failed to load history', e)
    }
  }

  // Survive a refresh WITHOUT hijacking the user: validate the saved session and,
  // if it's still there, offer it as a resumable chip on the landing page rather
  // than jumping straight into it.
  useEffect(() => {
    loadHistory()
    const savedId = localStorage.getItem(SESSION_KEY)
    if (!savedId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/session/${savedId}`)
        if (!res.ok) {
          localStorage.removeItem(SESSION_KEY)
          return
        }
        const data = await res.json()
        if (cancelled) return
        if ((data.status === 'complete' && data.markdown) || data.papers?.length) {
          setResumable({
            sessionId: savedId,
            status: data.status,
            papers: data.papers || [],
            markdown: data.markdown || '',
          })
        } else {
          localStorage.removeItem(SESSION_KEY)
        }
      } catch {
        /* offline or server down — stay on the landing page */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function resumeSession() {
    if (!resumable) return
    setSessionId(resumable.sessionId)
    if (resumable.status === 'complete' && resumable.markdown) {
      setMarkdown(resumable.markdown)
      setStage('done')
    } else {
      setPapers(resumable.papers)
      setStage('review')
    }
    setResumable(null)
  }

  function dismissResume() {
    setResumable(null)
  }

  async function loadSession(id) {
    setError(null)
    setStage('searching')
    try {
      const res = await fetch(`${API_BASE}/api/session/${id}`)
      if (!res.ok) throw new Error('Session not found')
      const data = await res.json()
      setSessionId(id)
      localStorage.setItem(SESSION_KEY, id)
      
      const q = data.original_queries || data.queries || []
      setActiveQueries(q.length ? q : [''])
      setSearchInfo({ queries: data.queries || [], original: data.original_queries || [] })

      if (data.status === 'complete' && data.markdown) {
        setMarkdown(data.markdown)
        setStage('done')
      } else {
        setPapers(data.papers || [])
        setStage('review')
      }
    } catch (e) {
      setError(netError(e))
      setStage('idle')
    }
  }

  async function deleteSession(id) {
    try {
      const res = await fetch(`${API_BASE}/api/session/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Could not delete session')
      setHistory((prev) => prev.filter((item) => item.session_id !== id))
      if (sessionId === id) {
        setSessionId(null)
        setPapers([])
        setMarkdown('')
        setStage('idle')
        localStorage.removeItem(SESSION_KEY)
      }
    } catch (e) {
      setError(netError(e))
    }
  }

  function goHome() {
    setSessionId(null)
    setPapers([])
    setMarkdown('')
    setStage('idle')
    localStorage.removeItem(SESSION_KEY)
    loadHistory()
  }

  async function startSearch(queries, maxPapers = 20, topKPapers = 10, useAiExpansion = true) {
    setActiveQueries(queries)
    setStage('searching')
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries, max_papers: maxPapers, top_k_papers: topKPapers, use_ai_expansion: useAiExpansion }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSessionId(data.session_id)
      localStorage.setItem(SESSION_KEY, data.session_id)
      setPapers(data.papers)
      setSearchInfo({ queries: data.queries || [], original: data.original_queries || [] })
      setStage('review')
      loadHistory()
    } catch (e) {
      setError(netError(e))
      setStage('idle')
    }
  }

  async function approvePapers(indices) {
    setStage('generating')
    setError(null)
    setProgressMsg('Initializing…')
    setProgressStage('papers_summarized')
    setCurrentIndex(-1)
    setCurrentAction('')

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/progress/${sessionId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.detail) setProgressMsg(data.detail)
          if (data.stage) setProgressStage(data.stage)
          if (typeof data.current_index === 'number') setCurrentIndex(data.current_index)
          if (data.action) setCurrentAction(data.action)
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 500)

    try {
      const res = await fetch(`${API_BASE}/api/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, approved_indices: indices }),
      })
      clearInterval(intervalId)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMarkdown(data.markdown)
      setStage('done')
      loadHistory()
    } catch (e) {
      clearInterval(intervalId)
      setError(netError(e))
      setStage('review')
    }
  }

  async function deepDive() {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/deepdive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Deep dive failed')
      if (data.error) throw new Error(data.error)
      return data.queries
    } catch (e) {
      setError(e.message)
      return null
    }
  }

  return { stage, sessionId, papers, markdown, error, startSearch, approvePapers, deepDive, activeQueries, progressMsg, progressStage, currentIndex, currentAction, resumable, resumeSession, dismissResume, searchInfo, history, loadSession, deleteSession, goHome }
}
