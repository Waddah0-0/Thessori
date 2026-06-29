import { useState } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import AssistantWidget from './AssistantWidget'
const EXPORT_OPTIONS = [
  { format: 'markdown', label: 'Markdown', icon: '⌗', hint: '.md file' },
  { format: 'latex', label: 'LaTeX', icon: 'Σ', hint: '.tex · open in Overleaf' },
  { format: 'pdf', label: 'PDF', icon: '⬇', hint: 'compiled via pdflatex' },
  { format: 'gdoc', label: 'Google Doc', icon: '↗', hint: 'opens in your Drive' },
]

export default function DoneScreen({ sessionId, markdown, deepDive, onDeepDive }) {
  const [exporting, setExporting] = useState(null)
  const [exportError, setExportError] = useState(null)
  const [isDiving, setIsDiving] = useState(false)

  async function handleDeepDive() {
    setIsDiving(true)
    const queries = await deepDive()
    setIsDiving(false)
    if (queries && queries.length > 0) {
      onDeepDive(queries)
    }
  }

  async function handleExport(format) {
    setExporting(format)
    setExportError(null)
    try {
      const res = await fetch(`/api/export/${sessionId}?format=${format}`)

      // Graceful handling: PDF can return 501 when no LaTeX engine is present.
      // Show the server's message instead of downloading the error JSON as a file.
      if (!res.ok) {
        let msg = `Export failed (${res.status})`
        try {
          const data = await res.json()
          if (data.error) msg = data.error
        } catch {
          /* non-JSON error body */
        }
        setExportError(msg)
        return
      }

      if (format === 'gdoc') {
        const data = await res.json()
        window.open(data.url, '_blank')
      } else {
        // Trigger browser download
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `literature_review.${
          format === 'markdown' ? 'md' : format === 'latex' ? 'tex' : 'pdf'
        }`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      setExportError(e.message || 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  return (
    <motion.div
      className="relative z-10 min-h-screen px-4 py-16 max-w-4xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center justify-between mb-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h2 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
            Literature review ready
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Read your review below, then export in the format you need.
          </p>
        </div>

        {/* Pulse done badge */}
        <motion.div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--indigo)' }}
          animate={{ boxShadow: ['0 0 0 0 rgba(99,102,241,0.3)', '0 0 0 16px rgba(99,102,241,0)'] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          ✓
        </motion.div>
      </motion.div>

      {/* Export buttons */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {EXPORT_OPTIONS.map(({ format, label, icon, hint }) => (
          <motion.button
            key={format}
            onClick={() => handleExport(format)}
            disabled={!!exporting}
            className="glass p-4 text-left rounded-xl disabled:opacity-50 group"
            whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(99,102,241,0.15)' }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="text-xl mb-2 block" style={{ color: 'var(--indigo)' }}>
              {exporting === format ? '…' : icon}
            </span>
            <span className="font-semibold text-sm block" style={{ color: 'var(--ink)' }}>
              {label}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {hint}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* Export error (e.g. PDF needs a LaTeX engine) */}
      {exportError && (
        <motion.p
          className="text-xs mb-10 px-3 py-2 rounded-lg"
          style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {exportError}
        </motion.p>
      )}
      {!exportError && <div className="mb-8" />}

      {/* Deep Dive Action */}
      <motion.div
        className="mb-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <motion.button
          onClick={handleDeepDive}
          disabled={isDiving || !!exporting}
          className="w-full glass relative overflow-hidden group p-5 rounded-2xl flex items-center justify-between text-left transition-all disabled:opacity-50"
          whileHover={!isDiving && !exporting ? { y: -2, boxShadow: '0 8px 24px rgba(99,102,241,0.15)' } : {}}
          whileTap={!isDiving && !exporting ? { scale: 0.98 } : {}}
        >
          <div>
            <span className="font-bold text-lg block mb-1" style={{ color: 'var(--indigo)' }}>
              {isDiving ? 'Extracting gaps...' : 'Deep Dive into Research Gaps'}
            </span>
            <span className="text-sm" style={{ color: 'var(--muted)' }}>
              {isDiving ? 'Generating targeted queries...' : 'Automatically extract unexplored areas from this report and start a new search loop.'}
            </span>
          </div>
          <span className="ml-4 flex-shrink-0" style={{ color: 'var(--indigo)' }}>
            {isDiving ? (
              <motion.svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </motion.svg>
            ) : (
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            )}
          </span>
        </motion.button>
      </motion.div>

      {/* Markdown preview with KaTeX math rendering */}
      <motion.div
        className="glass p-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ lineHeight: 1.8 }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            h1: ({ children }) => (
              <h1
                style={{
                  fontFamily: 'Space Grotesk',
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  marginBottom: '0.5rem',
                  color: 'var(--ink)',
                }}
              >
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2
                style={{
                  fontFamily: 'Space Grotesk',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  marginTop: '2rem',
                  marginBottom: '0.5rem',
                  color: 'var(--ink)',
                }}
              >
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3
                style={{
                  fontFamily: 'Space Grotesk',
                  fontSize: '1rem',
                  fontWeight: 600,
                  marginTop: '1.5rem',
                  color: 'var(--indigo)',
                }}
              >
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p style={{ marginBottom: '1rem', color: 'var(--ink)', fontSize: '0.95rem' }}>
                {children}
              </p>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--indigo)', textDecoration: 'underline' }}
              >
                {children}
              </a>
            ),
            hr: () => (
              <hr
                style={{
                  border: 'none',
                  borderTop: '1px solid rgba(99,102,241,0.15)',
                  margin: '1.5rem 0',
                }}
              />
            ),
            strong: ({ children }) => (
              <strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{children}</strong>
            ),
            ol: ({ children }) => (
              <ol
                style={{
                  margin: '0.5rem 0 1rem',
                  paddingLeft: '1.5rem',
                  listStyleType: 'decimal',
                  color: 'var(--ink)',
                }}
              >
                {children}
              </ol>
            ),
            ul: ({ children }) => (
              <ul
                style={{
                  margin: '0.5rem 0 1rem',
                  paddingLeft: '1.5rem',
                  listStyleType: 'disc',
                  color: 'var(--ink)',
                }}
              >
                {children}
              </ul>
            ),
            li: ({ children }) => (
              <li style={{ marginBottom: '0.4rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
                {children}
              </li>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </motion.div>

      <AssistantWidget sessionId={sessionId} onStartSearch={onDeepDive} />
    </motion.div>
  )
}
