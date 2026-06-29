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

export default function SearchHero({ initialQueries = [''], onSearch, onType, loading, resumable, onResume, onDismissResume }) {
  const [queries, setQueries] = useState(initialQueries)
  const [maxPapers, setMaxPapers] = useState(20)
  const [topK, setTopK] = useState(10)
  const [useAiExpansion, setUseAiExpansion] = useState(true)

  const searchingMessages = useMemo(
    () =>
      useAiExpansion
        ? ['Expanding queries…', 'Searching arXiv…', 'Searching Scholar…', 'Merging results…', 'Ranking papers…']
        : ['Searching arXiv…', 'Searching Scholar…', 'Merging results…', 'Ranking papers…'],
    [useAiExpansion]
  )

  function updateQuery(index, value) {
    const next = [...queries]
    next[index] = value
    setQueries(next)
    onType?.(next.join(' ').trim().split(/\s+/).filter(Boolean).length)
  }

  function addQuery() {
    if (queries.length < 5) setQueries([...queries, ''])
  }

  function removeQuery(index) {
    const next = queries.filter((_, i) => i !== index)
    setQueries(next.length ? next : [''])
  }

  function handleSearch() {
    const valid = queries.map((q) => q.trim()).filter(Boolean)
    if (valid.length) onSearch(valid, maxPapers, topK, useAiExpansion)
  }

  return (
    <motion.div
      className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Resume chip — offered (not forced) when a saved session exists */}
      <AnimatePresence>
        {resumable && (
          <motion.div
            className="fixed top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 glass"
            style={{ padding: '6px 6px 6px 14px', borderRadius: 9999 }}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <button
              onClick={onResume}
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: 'var(--ink)' }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--indigo)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3v5h5" />
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
              </svg>
              Resume your last {resumable.status === 'complete' ? 'report' : 'review'}
              <span style={{ color: 'var(--indigo)' }}>→</span>
            </button>
            <motion.button
              onClick={onDismissResume}
              className="flex items-center justify-center w-6 h-6 rounded-full text-xs"
              style={{ color: 'var(--muted)' }}
              title="Dismiss"
              whileHover={{ color: 'var(--ink)', background: 'rgba(255,255,255,0.06)' }}
            >
              ✕
            </motion.button>
          </motion.div>
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

      {/* Glass card */}
      <motion.div
        className="glass glow-ring w-full max-w-2xl p-6 shadow-xl"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <p
          className="text-xs font-medium mb-3 uppercase tracking-wider"
          style={{ color: 'var(--muted)' }}
        >
          Research queries
        </p>

        <AnimatePresence>
          {queries.map((q, i) => (
            <motion.div
              key={i}
              className="flex items-start gap-2 mb-2"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {/* Query number badge */}
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mt-2"
                style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--indigo)' }}
              >
                {i + 1}
              </span>

              <textarea
                className="flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed rounded-lg px-3 py-2"
                style={{
                  color: 'var(--ink)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  minHeight: '56px',
                  fontFamily: 'Inter',
                }}
                placeholder={
                  i === 0
                    ? 'e.g. transformer attention mechanisms for time series'
                    : 'e.g. efficiency optimization in large language models'
                }
                value={q}
                rows={2}
                onChange={(e) => updateQuery(i, e.target.value)}
              />

              {/* Remove button — only show if more than one query */}
              {queries.length > 1 && (
                <motion.button
                  onClick={() => removeQuery(i)}
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-2"
                  style={{ color: 'var(--muted)', background: 'rgba(100,116,139,0.08)' }}
                  whileHover={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                  title="Remove this query"
                >
                  ✕
                </motion.button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Settings Sliders */}
        <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}>
          <div className="flex items-center justify-between mb-4">
            <label className="text-xs font-medium flex items-center gap-2 cursor-pointer" style={{ color: 'var(--muted)' }}>
              <input 
                type="checkbox" 
                checked={useAiExpansion} 
                onChange={(e) => setUseAiExpansion(e.target.checked)}
                className="w-3.5 h-3.5 rounded-sm"
                style={{ accentColor: 'var(--indigo)' }}
              />
              AI Query Expansion (Enhance search terms)
              <span 
                className="flex items-center justify-center rounded-full w-3.5 h-3.5 text-[9px] font-bold cursor-help" 
                style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--indigo)' }}
                title="Automatically rewrites broad queries into highly specific academic search terms using the LLM to find much better, highly relevant papers."
              >
                ?
              </span>
            </label>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Fetch Limit (per source)</label>
                <span className="text-xs font-semibold" style={{ color: 'var(--indigo)' }}>{maxPapers}</span>
              </div>
              <input 
                type="range" min="5" max="50" step="1" 
                value={maxPapers} onChange={(e) => setMaxPapers(parseInt(e.target.value))}
                className="w-full"
                style={{ accentColor: 'var(--indigo)' }}
              />
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Review Shortlist</label>
                <span className="text-xs font-semibold" style={{ color: 'var(--indigo)' }}>{topK}</span>
              </div>
              <input 
                type="range" min="3" max="25" step="1" 
                value={topK} onChange={(e) => setTopK(parseInt(e.target.value))}
                className="w-full"
                style={{ accentColor: 'var(--indigo)' }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-3">
            {/* Add query button */}
            {queries.length < 5 && (
              <motion.button
                onClick={addQuery}
                className="text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{
                  color: 'var(--indigo)',
                  border: '1px dashed rgba(99,102,241,0.4)',
                  background: 'rgba(99,102,241,0.04)',
                }}
                whileHover={{ background: 'rgba(99,102,241,0.1)' }}
                whileTap={{ scale: 0.96 }}
              >
                + Add query
              </motion.button>
            )}
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {queries.filter((q) => q.trim()).length} of {queries.length} filled
            </span>
          </div>

          <motion.button
            onClick={handleSearch}
            disabled={!queries.some((q) => q.trim()) || loading}
            className="px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-40 flex items-center justify-center"
            style={{ background: 'var(--indigo)', minWidth: 150 }}
            whileHover={loading ? {} : { scale: 1.03 }}
            whileTap={loading ? {} : { scale: 0.97 }}
          >
            {loading ? <RotatingText messages={searchingMessages} /> : 'Run Agent →'}
          </motion.button>
        </div>
      </motion.div>

      {/* Step badges */}
      <motion.div
        className="flex gap-4 mt-10 flex-wrap justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        {['Discover', 'Rank', 'You Review', 'Summarize', 'Gap Analysis', 'Export'].map((s, i) => (
          <span
            key={s}
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: 'rgba(99,102,241,0.08)',
              color: 'var(--indigo)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            {i + 1}. {s}
          </span>
        ))}
      </motion.div>
    </motion.div>
  )
}
