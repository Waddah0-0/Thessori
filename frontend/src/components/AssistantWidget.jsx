import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'

// The agent appends a ```json { agent_action: "search", ... } ``` block to trigger a search.
const JSON_BLOCK = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/

// While streaming, hide an in-progress code fence so the user never sees raw JSON mid-reply.
function visibleDuringStream(text) {
  const i = text.indexOf('```')
  return i >= 0 ? text.slice(0, i).trimEnd() : text
}

const SUGGESTIONS = [
  "Summarize key limitations",
  "Compare methodologies",
  "What are the future directions?",
  "List dataset requirements"
]

export default function AssistantWidget({ sessionId, onStartSearch, isOpen, setIsOpen }) {
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

  async function handleSend(text) {
    if (!text.trim() || isChatting) return

    setChatHistory((prev) => [...prev, { role: 'user', content: text }])
    setIsChatting(true)

    try {
      const priorHistory = chatHistory.slice(-8)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: text, history: priorHistory }),
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

      let replyContent = full
      const match = full.match(JSON_BLOCK)
      if (match) {
        try {
          const parsed = JSON.parse(match[1])
          replyContent = full.replace(match[0], '').trim()
          if (parsed.agent_action === 'search' && parsed.queries && parsed.queries.length > 0) {
            setPendingQueries(parsed.queries)
            replyContent +=
              "\n\nI have prepared the recommended follow-up search queries. You can review and execute them below."
          }
        } catch (err) {
          console.error('Failed to parse agent JSON action', err)
        }
      }
      if (!replyContent.trim()) {
        replyContent = "Okay, I'm setting up a new search for you now!"
      }

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

  function handleSubmit(e) {
    e.preventDefault()
    if (!chatInput.trim() || isChatting) return
    const text = chatInput.trim()
    setChatInput('')
    handleSend(text)
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
            className="fixed top-0 right-0 bottom-0 z-50 glass flex flex-col shadow-2xl border-l overflow-hidden"
            style={{
              width: '420px',
              maxWidth: '100vw',
              borderColor: 'rgba(99,102,241,0.2)'
            }}
          >
            {/* Header */}
            <div
              className="p-5 flex items-center justify-between border-b"
              style={{ borderColor: 'rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.04)' }}
            >
              <h3 className="font-bold text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk', color: 'var(--ink)' }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--indigo)' }}></span>
                Ask Thessori
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-100 transition-colors p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 assistant-chat-scroll">
              <style>{`
                .assistant-chat-scroll::-webkit-scrollbar {
                  width: 5px;
                }
                .assistant-chat-scroll::-webkit-scrollbar-track {
                  background: transparent;
                }
                .assistant-chat-scroll::-webkit-scrollbar-thumb {
                  background: rgba(99, 102, 241, 0.2);
                  border-radius: 99px;
                }
                .assistant-chat-scroll::-webkit-scrollbar-thumb:hover {
                  background: rgba(99, 102, 241, 0.35);
                }
              `}</style>
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl max-w-[88%] text-xs ${
                      msg.role === 'user'
                        ? 'text-white rounded-br-none'
                        : 'rounded-bl-none border'
                    }`}
                    style={{
                      background: msg.role === 'user' ? 'linear-gradient(135deg, var(--indigo) 0%, var(--glow) 100%)' : 'rgba(99,102,241,0.06)',
                      borderColor: 'rgba(99,102,241,0.12)',
                      color: msg.role === 'user' ? '#fff' : 'var(--ink)',
                      boxShadow: msg.role === 'user' ? '0 2px 10px rgba(99,102,241,0.2)' : 'none',
                      lineHeight: 1.6
                    }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2 border border-[rgba(99,102,241,0.15)] rounded-lg w-full">
                            <table className="w-full text-[11px] text-left border-collapse">
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="p-2 font-bold uppercase tracking-wider bg-[rgba(99,102,241,0.08)] border-b border-[rgba(99,102,241,0.15)] text-[10px]" style={{ color: 'var(--indigo)' }}>
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="p-2 border-b border-[rgba(99,102,241,0.1)] text-[11px]" style={{ color: 'var(--ink)' }}>
                            {children}
                          </td>
                        ),
                        tr: ({ children }) => (
                          <tr className="hover:bg-[rgba(99,102,241,0.02)] transition-colors">
                            {children}
                          </tr>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}

              {/* Action Suggestion Pills (Show only at the beginning) */}
              {chatHistory.length === 1 && !isChatting && (
                <div className="pt-2 flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                    Suggested Actions
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {SUGGESTIONS.map((text, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(text)}
                        className="text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors hover:bg-[rgba(99,102,241,0.06)] hover:text-[var(--indigo)]"
                        style={{
                          borderColor: 'rgba(99,102,241,0.15)',
                          background: 'rgba(255,255,255,0.01)',
                          color: 'var(--ink)'
                        }}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isChatting && chatHistory[chatHistory.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div
                    className="px-4 py-2.5 rounded-2xl border rounded-bl-none w-16 flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.12)' }}
                  >
                    <div className="flex gap-1 items-center justify-center">
                      <motion.span className="w-1.5 h-1.5 rounded-full bg-[var(--indigo)]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} />
                      <motion.span className="w-1.5 h-1.5 rounded-full bg-[var(--indigo)]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} />
                      <motion.span className="w-1.5 h-1.5 rounded-full bg-[var(--indigo)]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Pending Action Area */}
            {pendingQueries && (
              <div className="p-5 border-t" style={{ borderColor: 'rgba(99, 102, 241, 0.2)', background: 'rgba(99, 102, 241, 0.03)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--indigo)' }}>
                  Proposed Search Queries
                </p>
                <div className="flex flex-col gap-1.5 mb-4">
                  {pendingQueries.map((q, idx) => (
                    <div
                      key={idx}
                      className="text-xs px-3 py-2 rounded-lg border bg-[rgba(255,255,255,0.01)]"
                      style={{ borderColor: 'rgba(99, 102, 241, 0.12)', color: 'var(--ink)' }}
                    >
                      {q}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onStartSearch(pendingQueries)
                      setPendingQueries(null)
                    }}
                    className="flex-1 py-2 rounded-xl text-white font-bold text-xs transition-all"
                    style={{ background: 'var(--indigo)' }}
                  >
                    Proceed with Search
                  </button>
                  <button
                    onClick={() => setPendingQueries(null)}
                    className="flex-1 py-2 rounded-xl font-bold text-xs transition-all border"
                    style={{ background: 'transparent', borderColor: 'rgba(99, 102, 241, 0.2)', color: 'var(--ink)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 border-t" style={{ borderColor: 'rgba(99,102,241,0.12)', background: 'rgba(99,102,241,0.02)' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question or request a search..."
                  className="flex-1 px-4 py-2.5 rounded-xl border text-xs focus:outline-none transition-colors"
                  style={{
                    color: 'var(--ink)',
                    borderColor: 'rgba(129,140,248,0.3)',
                    background: 'rgba(255,255,255,0.06)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--indigo)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.3)'}
                  disabled={isChatting}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatting}
                  className="px-4 py-2.5 rounded-xl text-white font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, var(--indigo) 0%, var(--glow) 100%)',
                    boxShadow: '0 4px 14px 0 rgba(99,102,241,0.2)'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
