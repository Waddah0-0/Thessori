import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'

// The agent appends a ```json { agent_action: "search", ... } ``` block to trigger a search.
const JSON_BLOCK = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/

// While streaming, hide an in-progress code fence so the user never sees raw JSON mid-reply.
function visibleDuringStream(text) {
  const i = text.indexOf('```')
  return i >= 0 ? text.slice(0, i).trimEnd() : text
}

export default function AssistantWidget({ sessionId, onStartSearch }) {
  const [isOpen, setIsOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: "Hi! I'm Thessori. Ask me anything about this report, or tell me to run new queries for you!" }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isChatting, setIsChatting] = useState(false)
  const [pendingQueries, setPendingQueries] = useState(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [chatHistory, isOpen])

  async function handleChat(e) {
    e.preventDefault()
    if (!chatInput.trim() || isChatting) return

    const userMsg = chatInput.trim()
    // Snapshot prior turns for conversation memory (excludes this new message).
    const priorHistory = chatHistory.slice(-8)
    setChatInput('')
    setChatHistory((prev) => [...prev, { role: 'user', content: userMsg }])
    setIsChatting(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: userMsg, history: priorHistory }),
      })

      if (!res.ok || !res.body) {
        let msg = `Server error: ${res.status} ${res.statusText}`
        try {
          const data = await res.json()
          msg = data.detail || data.error || msg
        } catch {
          /* non-JSON error body */
        }
        throw new Error(msg)
      }

      // Stream tokens into a single assistant bubble (added on the first visible token).
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      let started = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        const shown = visibleDuringStream(full)
        if (!shown) continue
        if (!started) {
          started = true
          setChatHistory((prev) => [...prev, { role: 'assistant', content: shown }])
        } else {
          setChatHistory((prev) => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: shown }
            return next
          })
        }
      }

      // Stream finished — parse any agent action block out of the full text.
      let replyContent = full
      const match = full.match(JSON_BLOCK)
      if (match) {
        try {
          const parsed = JSON.parse(match[1])
          replyContent = full.replace(match[0], '').trim()
          if (parsed.agent_action === 'search' && parsed.queries && parsed.queries.length > 0) {
            setPendingQueries(parsed.queries)
            replyContent +=
              "\n\n**Heads up:** Proceeding starts a new research loop — download your current report first so you don't lose it."
          }
        } catch (err) {
          console.error('Failed to parse agent JSON action', err)
        }
      }
      if (!replyContent.trim()) {
        replyContent = "Okay, I'm setting up a new search for you now!"
      }

      // Finalize the bubble (or add it if nothing was visibly streamed, e.g. JSON-only).
      setChatHistory((prev) => {
        const next = [...prev]
        if (started) {
          next[next.length - 1] = { role: 'assistant', content: replyContent }
        } else {
          next.push({ role: 'assistant', content: replyContent })
        }
        return next
      })
    } catch (err) {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setIsChatting(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-8 right-8 w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg z-50 transition-colors"
            style={{
              background: 'linear-gradient(135deg, var(--indigo) 0%, var(--glow) 100%)',
              boxShadow: '0 4px 14px 0 rgba(99,102,241,0.3)'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-8 right-8 z-50 glass flex flex-col shadow-2xl rounded-2xl overflow-hidden"
            style={{
              width: '400px',
              height: '600px',
              minWidth: '300px',
              minHeight: '400px',
              maxWidth: '90vw',
              maxHeight: '85vh',
              resize: 'both',
              border: '1px solid rgba(99,102,241,0.25)'
            }}
          >
            {/* Header */}
            <div
              className="p-4 flex items-center justify-between border-b"
              style={{ borderColor: 'rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.06)' }}
            >
              <h3 className="font-bold text-lg flex items-center gap-2" style={{ fontFamily: 'Space Grotesk', color: 'var(--ink)' }}>
                <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--indigo)' }}></span>
                Ask Thessori
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-100 transition-colors p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm ${
                      msg.role === 'user'
                        ? 'text-white rounded-br-none'
                        : 'rounded-bl-none border'
                    }`}
                    style={{
                      background: msg.role === 'user' ? 'linear-gradient(135deg, var(--indigo) 0%, var(--glow) 100%)' : 'rgba(99,102,241,0.06)',
                      borderColor: 'rgba(99,102,241,0.15)',
                      color: msg.role === 'user' ? '#fff' : 'var(--ink)',
                      boxShadow: msg.role === 'user' ? '0 2px 10px rgba(99,102,241,0.25)' : 'none',
                      lineHeight: 1.6
                    }}
                  >
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isChatting && chatHistory[chatHistory.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div
                    className="px-4 py-3 rounded-2xl border rounded-bl-none text-sm"
                    style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.15)', color: 'var(--muted)' }}
                  >
                    <span className="animate-pulse">Thessori is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Pending Action Area */}
            {pendingQueries && (
              <div className="p-4 border-t" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)' }}>
                <p className="text-sm mb-3" style={{ color: 'var(--ink)' }}>
                  <strong>Proposed Queries:</strong>
                </p>
                <ul className="list-disc pl-5 mb-4 text-sm" style={{ color: 'var(--ink)' }}>
                  {pendingQueries.map((q, idx) => <li key={idx}>{q}</li>)}
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onStartSearch(pendingQueries)
                      setPendingQueries(null)
                    }}
                    className="flex-1 py-2 rounded-xl text-white font-bold text-sm transition-all"
                    style={{ background: 'var(--indigo)' }}
                  >
                    Proceed
                  </button>
                  <button
                    onClick={() => setPendingQueries(null)}
                    className="flex-1 py-2 rounded-xl font-bold text-sm transition-all"
                    style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--ink)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Input Area */}
            <form onSubmit={handleChat} className="p-4 border-t" style={{ borderColor: 'rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.04)' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question or request a search..."
                  className="flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-colors"
                  style={{
                    color: 'var(--ink)',
                    borderColor: 'rgba(129,140,248,0.3)',
                    background: 'rgba(255,255,255,0.08)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--indigo)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.3)'}
                  disabled={isChatting}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatting}
                  className="px-5 py-2.5 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--indigo) 0%, var(--glow) 100%)',
                    boxShadow: '0 4px 14px 0 rgba(99,102,241,0.3)'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Custom Resize Handle Indicator */}
            <div className="absolute bottom-0 right-0 w-6 h-6 pointer-events-none flex items-end justify-end p-1 opacity-50">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 21h6v-6M21 21l-7-7" />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
