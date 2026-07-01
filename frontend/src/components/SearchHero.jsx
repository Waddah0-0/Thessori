import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Cycles through status phrases with a vertical flip while the agent searches.
function RotatingText({ messages, interval = 1700 }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    setI(0)
    const id = setInterval(() => setI((p) => (p + 1) % messages.length), interval)
    return () => clearInterval(id)
  }, [messages, interval])

  return (
    <span
      className="relative inline-flex items-center justify-center overflow-hidden"
      style={{ height: '1.25em' }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={messages[i]}
          className="whitespace-nowrap"
          initial={{ y: '110%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-110%', opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          {messages[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function formatRelativeTime(isoString) {
  if (!isoString) return 'Unknown date'
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now - date
    if (diffMs < 0) return 'Just now'
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return 'Unknown date'
  }
}

const buttonVariants = {
  initial: {
    scale: 1,
    boxShadow: '0 0 0px rgba(99, 102, 241, 0)',
  },
  hover: {
    scale: 1.02,
    boxShadow: '0 0 20px rgba(99, 102, 241, 0.45)',
  }
}

const arrowVariants = {
  initial: { x: 0 },
  hover: { x: 4 }
}

export default function SearchHero({ initialQueries = [''], onSearch, onType, loading, resumable, onResume, onDismissResume, history = [], onLoadSession, onDeleteSession }) {
  const [queries, setQueries] = useState(initialQueries)
  const [maxPapers, setMaxPapers] = useState(20)
  const [topK, setTopK] = useState(10)
  const [useAiExpansion, setUseAiExpansion] = useState(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedModel, setSelectedModel] = useState('qwen-plus')

  useEffect(() => {
    if (initialQueries) {
      setQueries(initialQueries)
    }
  }, [initialQueries])

  const searchingMessages = useMemo(
    () =>
      useAiExpansion
        ? ['Expanding queries…', 'Searching arXiv…', 'Searching Scholar…', 'Merging results…', 'Ranking papers…']
        : ['Searching arXiv…', 'Searching Scholar…', 'Merging results…', 'Ranking papers…'],
    [useAiExpansion]
  )

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const trimmed = inputValue.trim()
      if (trimmed) {
        if (queries.length === 1 && queries[0] === '') {
          setQueries([trimmed])
        } else {
          setQueries([...queries, trimmed])
        }
        setInputValue('')
      }
    }
  }

  function removeQuery(index) {
    const next = queries.filter((_, i) => i !== index)
    setQueries(next.length ? next : [''])
  }

  function handleSearch() {
    let allQueries = [...queries]
    const trimmedInput = inputValue.trim()
    if (trimmedInput) {
      if (allQueries.length === 1 && allQueries[0] === '') {
        allQueries = [trimmedInput]
      } else {
        allQueries.push(trimmedInput)
      }
    }
    const valid = allQueries.map((q) => q.trim()).filter(Boolean)
    if (valid.length) {
      onSearch(valid, maxPapers, topK, useAiExpansion, selectedModel)
      setInputValue('')
    }
  }

  return (
    <motion.div
      className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Floating History Toggle Button */}
      {history && history.length > 0 && (
        <button
          onClick={() => setIsHistoryOpen(true)}
          className="fixed top-6 right-6 z-30 glass px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all hover:bg-[rgba(99,102,241,0.08)]"
          style={{
            borderColor: 'rgba(99,102,241,0.3)',
            color: 'var(--ink)',
            background: 'var(--glass)',
            cursor: 'pointer'
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--indigo)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>History</span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{ background: 'rgba(99,102,241,0.18)', color: 'var(--indigo)' }}
          >
            {history.length}
          </span>
        </button>
      )}

      {/* Sliding Side Drawer */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[4px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
            />

            {/* Sidebar drawer panel */}
            <motion.div
              className="fixed inset-y-0 right-0 z-50 w-full max-w-[400px] shadow-2xl flex flex-col p-6"
              style={{
                background: 'rgba(12, 10, 30, 0.9)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                borderLeft: '1px solid rgba(129, 140, 248, 0.25)',
                boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.6)'
              }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[rgba(99,102,241,0.15)]">
                <div>
                  <h3 className="text-base font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--ink)' }}>
                    Research History
                  </h3>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                    Access your literature reviews & drafts
                  </p>
                </div>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
                  style={{
                    color: 'var(--muted)',
                    background: 'rgba(255,255,255,0.02)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  title="Close sidebar"
                >
                  ✕
                </button>
              </div>

              {/* Drawer List */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin">
                {history.map((item) => {
                  const isDone = item.status === 'complete' || item.has_report
                  const firstQuery = item.queries[0] || 'Untitled Research'
                  const extraQueriesCount = item.queries.length - 1

                  return (
                    <div
                      key={item.session_id}
                      className="p-3.5 rounded-2xl border transition-all hover:bg-[rgba(99,102,241,0.04)] flex flex-col gap-3"
                      style={{
                        background: 'rgba(255, 255, 255, 0.01)',
                        borderColor: 'rgba(99, 102, 241, 0.08)',
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                            style={{
                              background: isDone ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                              color: isDone ? '#4ade80' : '#fbbf24',
                              border: isDone ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(245,158,11,0.2)',
                            }}
                          >
                            {isDone ? 'Completed' : 'Draft'}
                          </span>
                          {extraQueriesCount > 0 && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                              style={{
                                background: 'rgba(99,102,241,0.08)',
                                color: 'var(--indigo)',
                                border: '1px solid rgba(99,102,241,0.15)',
                              }}
                            >
                              +{extraQueriesCount} queries
                            </span>
                          )}
                        </div>
                        <h4
                          className="text-xs font-semibold leading-relaxed line-clamp-3 animate-none"
                          style={{ color: 'var(--ink)' }}
                          title={item.queries.join(', ')}
                        >
                          {firstQuery}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between mt-1 pt-2 border-t border-[rgba(99,102,241,0.05)]">
                        <div className="flex flex-col text-[10px]" style={{ color: 'var(--muted)' }}>
                          <span>{formatRelativeTime(item.timestamp)}</span>
                          <span>{item.papers_count} papers fetched</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setIsHistoryOpen(false)
                              onLoadSession(item.session_id)
                            }}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap cursor-pointer"
                            style={{
                              background: isDone ? 'rgba(99,102,241,0.1)' : 'var(--indigo)',
                              color: isDone ? 'var(--indigo)' : '#ffffff',
                              border: isDone ? '1px solid rgba(99,102,241,0.2)' : 'none',
                            }}
                          >
                            {isDone ? 'View Report' : 'Resume'}
                          </button>
                          <button
                            onClick={() => onDeleteSession(item.session_id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all hover:bg-[rgba(239,68,68,0.15)] hover:text-[#ef4444] cursor-pointer"
                            style={{
                              color: 'var(--muted)',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.05)',
                            }}
                            title="Delete from history"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Eyebrow */}
      <motion.p
        className="text-sm font-medium tracking-widest uppercase mb-4"
        style={{ color: 'var(--indigo)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Powered by Qwen · LangGraph · arXiv
      </motion.p>

      {/* Headline */}
      <motion.h1
        className="text-5xl md:text-7xl font-bold text-center mb-3 leading-tight"
        style={{ fontFamily: 'Space Grotesk' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        Research, <span className="gradient-text">automated.</span>
      </motion.h1>

      <motion.p
        className="text-lg text-center mb-10 max-w-xl"
        style={{ color: 'var(--muted)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Ask one or more research queries. The agent searches all of them in parallel, merges the
        results, and delivers a unified literature review.
      </motion.p>

      {/* Gemini-Style Input Container */}
      <motion.div
        className="glass gemini-input-focus w-full max-w-2xl p-4 shadow-xl flex flex-col relative rounded-[24px] border transition-all"
        style={{
          background: 'rgba(20, 18, 42, 0.45)',
          borderColor: 'rgba(129, 140, 248, 0.2)',
        }}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {/* Tags Area */}
        {queries.some(q => q.trim()) && (
          <div className="flex flex-wrap gap-1.5 mb-2.5 max-h-[100px] overflow-y-auto pr-1">
            {queries.map((q, idx) => {
              if (!q.trim()) return null;
              return (
                <motion.span
                  key={idx}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(167, 139, 250, 0.1) 100%)',
                    borderColor: 'rgba(129, 140, 248, 0.25)',
                    color: 'var(--ink)'
                  }}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <span>{q}</span>
                  <button
                    onClick={() => removeQuery(idx)}
                    className="text-[9px] hover:text-red-400 font-bold focus:outline-none ml-0.5"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                  >
                    ✕
                  </button>
                </motion.span>
              )
            })}
          </div>
        )}

        {/* Main Textarea Input */}
        <div className="flex items-start gap-3">
          <textarea
            className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed"
            style={{
              color: 'var(--ink)',
              border: 'none',
              minHeight: '44px',
              fontFamily: 'Inter',
            }}
            placeholder={queries.some(q => q.trim()) ? 'Add another research query...' : 'Ask a research query... (press Enter to add multiple)'}
            value={inputValue}
            rows={Math.min(5, inputValue.split('\n').length || 1)}
            onChange={(e) => {
              setInputValue(e.target.value)
              onType?.(e.target.value.trim().split(/\s+/).filter(Boolean).length + queries.join(' ').trim().split(/\s+/).filter(Boolean).length)
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Footer Tools inside Input Bar */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[rgba(99,102,241,0.08)]">
          <div className="flex items-center gap-2">
            {/* Settings Popover toggle */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-xl flex items-center justify-center transition-all hover:bg-[rgba(255,255,255,0.06)]"
                style={{
                  background: showSettings ? 'rgba(99, 102, 241, 0.12)' : 'none',
                  border: 'none',
                  color: showSettings ? 'var(--indigo)' : 'var(--muted)',
                  cursor: 'pointer'
                }}
                title="Adjust limits & AI expansion"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
              </button>

              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    className="absolute bottom-10 left-0 z-20 glass p-5 shadow-2xl flex flex-col gap-4 w-[280px]"
                    style={{
                      background: 'rgba(15, 12, 35, 0.95)',
                      borderColor: 'rgba(129, 140, 248, 0.3)',
                      backdropFilter: 'blur(20px)',
                      borderRadius: '16px'
                    }}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  >
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
                      Search Settings
                    </h4>
                    
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-medium flex items-center gap-2 cursor-pointer" style={{ color: 'var(--ink)' }}>
                        <input 
                          type="checkbox" 
                          checked={useAiExpansion} 
                          onChange={(e) => setUseAiExpansion(e.target.checked)}
                          className="w-3.5 h-3.5 rounded-sm"
                          style={{ accentColor: 'var(--indigo)' }}
                        />
                        AI Query Expansion
                      </label>

                      <div className="pt-2 border-t border-[rgba(255,255,255,0.06)]">
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Fetch Limit</span>
                          <span className="text-[11px] font-bold" style={{ color: 'var(--indigo)' }}>{maxPapers}</span>
                        </div>
                        <input 
                          type="range" min="5" max="50" step="1" 
                          value={maxPapers} onChange={(e) => setMaxPapers(parseInt(e.target.value))}
                          className="w-full animate-none"
                          style={{ accentColor: 'var(--indigo)' }}
                        />
                      </div>

                      <div className="pt-2 border-t border-[rgba(255,255,255,0.06)]">
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Review Shortlist</span>
                          <span className="text-[11px] font-bold" style={{ color: 'var(--indigo)' }}>{topK}</span>
                        </div>
                        <input 
                          type="range" min="3" max="25" step="1" 
                          value={topK} onChange={(e) => setTopK(parseInt(e.target.value))}
                          className="w-full animate-none"
                          style={{ accentColor: 'var(--indigo)' }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {queries.some(q => q.trim()) && (
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                {queries.filter(q => q.trim()).length} queries ready
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Model Selector Dropdown */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="glass px-2.5 py-1 text-[11px] font-semibold outline-none cursor-pointer hover:bg-[rgba(255,255,255,0.03)] transition-colors"
              style={{
                borderColor: 'rgba(99,102,241,0.18)',
                background: 'rgba(20, 18, 42, 0.4)',
                color: 'var(--ink)',
                borderRadius: '10px'
              }}
            >
              <option value="qwen-plus" style={{ background: '#0e0b1d' }}>Qwen Plus</option>
              <option value="qwen-max" style={{ background: '#0e0b1d' }}>Qwen Max</option>
            </select>

            {/* Submit Button */}
            <motion.button
              onClick={handleSearch}
              disabled={(!queries.some((q) => q.trim()) && !inputValue.trim()) || loading}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-40"
              style={{
                background: (queries.some((q) => q.trim()) || inputValue.trim()) && !loading ? 'var(--indigo)' : 'rgba(255,255,255,0.05)',
                color: (queries.some((q) => q.trim()) || inputValue.trim()) && !loading ? '#ffffff' : 'var(--muted)',
                border: 'none',
                cursor: (queries.some((q) => q.trim()) || inputValue.trim()) && !loading ? 'pointer' : 'default'
              }}
            whileHover={(queries.some((q) => q.trim()) || inputValue.trim()) && !loading ? { scale: 1.08, boxShadow: '0 0 10px rgba(99,102,241,0.45)' } : {}}
            whileTap={(queries.some((q) => q.trim()) || inputValue.trim()) && !loading ? { scale: 0.94 } : {}}
          >
            {loading ? (
              <motion.svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </motion.svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </motion.button>
          </div>
        </div>
      </motion.div>



      {/* Connected Workflow Stepper */}
      <motion.div
        className="w-full max-w-xl mt-12 px-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <div className="flex items-center justify-between relative">
          {/* Faint Connecting Line */}
          <div
            className="absolute top-4 left-0 right-0 h-[1px] -z-10"
            style={{
              background: 'linear-gradient(90deg, rgba(99,102,241,0.04), rgba(99,102,241,0.24) 50%, rgba(99,102,241,0.04))'
            }}
          />

          {['Discover', 'Rank', 'Review', 'Summarize', 'Gaps', 'Export'].map((s, i) => (
            <motion.div
              key={s}
              className="flex flex-col items-center gap-2 group cursor-default"
              whileHover={{ y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              {/* Step Circle Badge */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all"
                style={{
                  borderColor: 'rgba(99,102,241,0.2)',
                  background: 'rgba(20,20,35,0.85)',
                  color: 'var(--indigo)',
                }}
              >
                {i + 1}
              </div>

              {/* Step Label */}
              <span
                className="text-[10px] font-semibold tracking-wide"
                style={{ color: 'var(--muted)' }}
              >
                {s}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
