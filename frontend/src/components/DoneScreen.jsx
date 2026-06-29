import { useState } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
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
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)

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
      className="relative z-10 min-h-screen px-4 py-16 max-w-6xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sticky Sidebar */}
        <div className="w-full lg:w-72 lg:sticky lg:top-8 flex flex-col gap-5 flex-shrink-0">
          <div>
            <h2 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
              Thessori Review
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Your literature review is complete and ready.
            </p>
          </div>

          {/* Quick Navigation */}
          <div className="glass p-4 rounded-xl flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--muted)' }}>
              Sections
            </span>
            <a
              href="#literature-review"
              className="px-2 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[rgba(99,102,241,0.08)] hover:text-[var(--indigo)]"
              style={{ color: 'var(--ink)' }}
            >
              Overview
            </a>
            <a
              href="#paper-summaries"
              className="px-2 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[rgba(99,102,241,0.08)] hover:text-[var(--indigo)]"
              style={{ color: 'var(--ink)' }}
            >
              Paper Summaries
            </a>
            <a
              href="#research-gaps--future-directions"
              className="px-2 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[rgba(99,102,241,0.08)] hover:text-[var(--indigo)]"
              style={{ color: 'var(--ink)' }}
            >
              Research Gaps & Future Directions
            </a>
          </div>

          {/* Deep Dive Action */}
          <motion.button
            onClick={handleDeepDive}
            disabled={isDiving || !!exporting}
            className="w-full glass p-4 rounded-xl flex items-center justify-between text-left transition-all disabled:opacity-50 group"
            whileHover={!isDiving && !exporting ? { y: -1, boxShadow: '0 8px 20px rgba(99,102,241,0.12)' } : {}}
            whileTap={!isDiving && !exporting ? { scale: 0.98 } : {}}
          >
            <div>
              <span className="font-bold text-xs block mb-0.5" style={{ color: 'var(--indigo)' }}>
                {isDiving ? 'Extracting Gaps...' : 'Deep Dive'}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                {isDiving ? 'Generating queries...' : 'Explore unexplored areas'}
              </span>
            </div>
            <span className="ml-3 flex-shrink-0" style={{ color: 'var(--indigo)' }}>
              {isDiving ? (
                <motion.svg
                  width="16"
                  height="16"
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
                  width="16"
                  height="16"
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

          {/* Export Options */}
          <div className="glass p-4 rounded-xl flex flex-col gap-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2" style={{ color: 'var(--muted)' }}>
              Export Document
            </span>
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_OPTIONS.map(({ format, label, icon }) => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  disabled={!!exporting}
                  className="p-2.5 rounded-lg flex flex-col items-center justify-center text-center transition-all hover:bg-[rgba(99,102,241,0.08)] disabled:opacity-50 border border-[rgba(255,255,255,0.03)] bg-[rgba(255,255,255,0.01)]"
                >
                  <span className="text-base font-bold mb-1" style={{ color: 'var(--indigo)' }}>
                    {exporting === format ? '…' : icon}
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Export Error */}
          {exportError && (
            <motion.p
              className="text-[11px] px-3 py-2 rounded-lg"
              style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {exportError}
            </motion.p>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 w-full min-w-0">
          <motion.div
            className="glass p-8 rounded-2xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ lineHeight: 1.8 }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
              components={{
                table: ({ children }) => (
                  <div className="overflow-x-auto my-6 border border-[rgba(99,102,241,0.15)] rounded-xl">
                    <table className="w-full text-sm text-left border-collapse">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="p-4 font-bold uppercase tracking-wider bg-[rgba(99,102,241,0.08)] border-b border-[rgba(99,102,241,0.15)] text-xs" style={{ color: 'var(--indigo)' }}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="p-4 border-b border-[rgba(99,102,241,0.1)] text-xs" style={{ color: 'var(--ink)' }}>
                    {children}
                  </td>
                ),
                tr: ({ children }) => (
                  <tr className="hover:bg-[rgba(99,102,241,0.02)] transition-colors">
                    {children}
                  </tr>
                ),
                h1: ({ children }) => (
                  <h1
                    id="literature-review"
                    style={{
                      fontFamily: 'Space Grotesk',
                      fontSize: '1.75rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                      color: 'var(--ink)',
                      scrollMarginTop: '2rem',
                    }}
                  >
                    {children}
                  </h1>
                ),
                h2: ({ children }) => {
                  // Generate an ID based on heading text to match the sidebar links
                  const id = children
                    ?.toString()
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-');
                  return (
                    <h2
                      id={id}
                      style={{
                        fontFamily: 'Space Grotesk',
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        marginTop: '2rem',
                        marginBottom: '0.5rem',
                        color: 'var(--ink)',
                        scrollMarginTop: '2rem',
                      }}
                    >
                      {children}
                    </h2>
                  );
                },
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
        </div>
      </div>

      <AssistantWidget
        sessionId={sessionId}
        onStartSearch={onDeepDive}
        isOpen={isAssistantOpen}
        setIsOpen={setIsAssistantOpen}
      />
    </motion.div>
  );
}
