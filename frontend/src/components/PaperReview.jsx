import { useState } from 'react'
import { motion } from 'framer-motion'
import PaperCard from './PaperCard'
import PipelineStatus from './PipelineStatus'

export default function PaperReview({ papers, onApprove, loading, progressMsg, progressStage, currentIndex, currentAction, searchInfo }) {
  const [checked, setChecked] = useState(() => new Set(papers.map((_, i) => i)))

  const expanded = searchInfo?.queries || []
  const original = searchInfo?.original || []
  const wasExpanded =
    expanded.length > 0 && JSON.stringify(expanded) !== JSON.stringify(original)

  const toggle = (i) => {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const approvedPapers = papers.filter((_, i) => checked.has(i))

  if (loading) {
    return (
      <motion.div
        className="relative z-10 min-h-screen px-4 py-16 max-w-2xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <PipelineStatus
          currentStatus={progressStage || 'papers_summarized'}
          progressMsg={progressMsg}
        />

        <motion.div
          className="glass p-8 rounded-2xl mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk' }}>
            Analyzing selected papers
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Thessori is downloading the full PDFs, extracting the text, and summarizing the methodology, findings, and limitations.
          </p>

          <div className="space-y-3">
            {approvedPapers.map((paper, idx) => {
              const isDone = idx < currentIndex
              const isActive = idx === currentIndex
              const isQueued = idx > currentIndex

              let statusText = 'Queued'
              let statusColor = 'var(--muted)'
              if (isDone) {
                statusText = 'Summarized'
                statusColor = 'var(--indigo)'
              } else if (isActive) {
                if (currentAction === 'downloading') statusText = 'Downloading PDF...'
                else if (currentAction === 'extracting') statusText = 'Extracting text...'
                else if (currentAction === 'summarizing') statusText = 'Summarizing...'
                else statusText = 'Processing...'
                statusColor = 'var(--indigo)'
              }

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-xl transition-colors"
                  style={{
                    background: isActive ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}`
                  }}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <h4 className="font-semibold text-sm truncate" style={{ color: isQueued ? 'var(--muted)' : 'var(--ink)' }}>
                      {paper.title}
                    </h4>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
                      {paper.authors?.slice(0, 2).join(', ')}{paper.authors?.length > 2 ? ' et al.' : ''} • {paper.year}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isActive && (
                      <motion.span
                        className="w-2 h-2 rounded-full"
                        style={{ background: 'var(--indigo)' }}
                        animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    )}
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        background: isDone
                          ? 'rgba(99,102,241,0.1)'
                          : isActive
                          ? 'rgba(99,102,241,0.05)'
                          : 'rgba(255,255,255,0.05)',
                        color: statusColor,
                        border: `1px solid ${isDone ? 'rgba(99,102,241,0.2)' : 'transparent'}`
                      }}
                    >
                      {statusText}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="relative z-10 min-h-screen px-4 py-16 max-w-3xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <PipelineStatus
        currentStatus={loading ? (progressStage || 'papers_summarized') : 'awaiting_approval'}
        progressMsg={loading ? progressMsg : ''}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk' }}>
          Review papers
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          The agent ranked these as most relevant. Deselect any you want to exclude before
          generating the full review.
        </p>

        {/* Transparency: show the AI-expanded terms actually used to search */}
        {wasExpanded && (
          <div
            className="mb-8 p-4 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(129,140,248,0.18)' }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
              AI expanded your input into these search terms:
            </p>
            <div className="flex flex-wrap gap-2">
              {expanded.map((q, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-xs"
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    color: 'var(--indigo)',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}
                >
                  {q}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          {papers.map((paper, i) => (
            <PaperCard key={i} paper={paper} index={i} checked={checked.has(i)} onToggle={toggle} />
          ))}
        </div>

        <motion.div
          className="flex items-center justify-between mt-8 p-4 glass"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            {checked.size} of {papers.length} papers selected
          </span>
          <motion.button
            onClick={() => onApprove([...checked])}
            disabled={checked.size === 0 || loading}
            className="px-6 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
            style={{ background: 'var(--indigo)' }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {loading ? 'Generating…' : 'Generate review →'}
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
