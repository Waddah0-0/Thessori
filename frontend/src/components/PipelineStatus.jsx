import { motion } from 'framer-motion'

// Minimal line icons (Feather/Lucide style) — stroke inherits the node color.
function Svg({ children }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

const ICONS = {
  search: (
    <Svg>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  ),
  eye: (
    <Svg>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  doc: (
    <Svg>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </Svg>
  ),
  target: (
    <Svg>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Svg>
  ),
  report: (
    <Svg>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <polyline points="9 15 11 17 15 13" />
    </Svg>
  ),
  check: (
    <Svg>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  ),
}

const STEPS = [
  { key: 'papers_fetched', label: 'Fetch', icon: ICONS.search },
  { key: 'awaiting_approval', label: 'Review', icon: ICONS.eye },
  { key: 'papers_summarized', label: 'Summarize', icon: ICONS.doc },
  { key: 'gaps_analyzed', label: 'Gaps', icon: ICONS.target },
  { key: 'complete', label: 'Report', icon: ICONS.report },
]

const GRADIENT = 'linear-gradient(90deg, #818cf8, #c7d2fe)'
const TRACK = 'rgba(255,255,255,0.12)'

function Connector({ filled, animating }) {
  return (
    <div
      className="relative flex-1 h-[3px] mx-1.5 rounded-full overflow-hidden"
      style={{ background: TRACK }}
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: GRADIENT }}
        initial={false}
        animate={{ width: filled ? '100%' : '0%' }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      />
      {animating && filled && (
        <motion.div
          className="absolute inset-y-0 w-1/3 rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)' }}
          animate={{ x: ['-120%', '320%'] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  )
}

export default function PipelineStatus({ currentStatus, progressMsg }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStatus)
  const pct = currentIdx < 0 ? 0 : Math.round((currentIdx / (STEPS.length - 1)) * 100)

  return (
    <div className="w-full max-w-2xl mx-auto my-8">
      <div className="flex items-center px-2 sm:px-5 pb-9">
        {STEPS.map((step, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          const reached = i <= currentIdx
          return (
            <div
              key={step.key}
              className="flex items-center"
              style={{ flex: i === 0 ? '0 0 auto' : '1 1 0%' }}
            >
              {i > 0 && <Connector filled={reached} animating={active} />}

              <div className="relative flex flex-col items-center" style={{ flex: '0 0 auto' }}>
                {/* Rotating spinner ring on the active checkpoint */}
                {active && (
                  <motion.span
                    className="absolute rounded-full"
                    style={{
                      inset: '-4px',
                      background:
                        'conic-gradient(from 0deg, #6366f1, #a5b4fc, rgba(99,102,241,0), #6366f1)',
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                )}

                <motion.div
                  className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-sm sm:text-base font-bold z-10"
                  style={{
                    background: reached ? GRADIENT : 'rgba(255,255,255,0.05)',
                    color: reached ? '#fff' : 'var(--muted)',
                    border: `2px solid ${reached ? 'transparent' : TRACK}`,
                    boxShadow: reached ? '0 4px 18px rgba(129,140,248,0.45)' : 'none',
                  }}
                  initial={false}
                  animate={{ scale: active ? 1.12 : 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                >
                  {done ? ICONS.check : step.icon}
                </motion.div>

                <span
                  className="absolute top-full mt-2 text-[10px] sm:text-[11px] font-semibold whitespace-nowrap"
                  style={{ color: reached ? 'var(--indigo)' : 'var(--muted)' }}
                >
                  {step.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Live detail line (e.g. "Downloading PDF 2 of 5…") */}
      {progressMsg && (
        <motion.div
          key={progressMsg}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 text-center px-4 py-3 rounded-xl text-sm font-medium"
          style={{
            background: 'rgba(99,102,241,0.08)',
            color: 'var(--indigo)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <motion.span
            className="w-2 h-2 rounded-full"
            style={{ background: 'var(--indigo)' }}
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span>{progressMsg}</span>
          <span className="text-xs font-semibold opacity-60">{pct}%</span>
        </motion.div>
      )}
    </div>
  )
}
