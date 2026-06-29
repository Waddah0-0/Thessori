import { motion, AnimatePresence } from 'framer-motion'

export default function PaperCard({ paper, index, checked, onToggle }) {
  return (
    <motion.div
      className="glass p-5 cursor-pointer select-none"
      style={{
        border: checked ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(99,102,241,0.1)',
        marginBottom: '12px',
      }}
      onClick={() => onToggle(index)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -2 }}
    >
      <div className="flex items-start gap-4">
        {/* Custom checkbox */}
        <motion.div
          className="flex-shrink-0 w-5 h-5 rounded-md mt-0.5 flex items-center justify-center"
          style={{
            background: checked ? 'var(--indigo)' : 'transparent',
            border: '2px solid',
            borderColor: checked ? 'var(--indigo)' : 'var(--muted)',
          }}
          animate={{ scale: checked ? [1, 1.2, 1] : 1 }}
          transition={{ duration: 0.2 }}
        >
          <AnimatePresence>
            {checked && (
              <motion.svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <path
                  d="M1.5 5L4 7.5L8.5 2.5"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-1 leading-snug" style={{ color: 'var(--ink)' }}>
            {paper.title}
          </h3>
          <p className="text-xs mb-2" style={{ color: 'var(--indigo)' }}>
            {paper.authors?.slice(0, 3).join(', ')}
            {paper.authors?.length > 3 && ' et al.'}
            {' · '}
            {paper.year}
            {' · '}
            <span className="uppercase">{paper.source}</span>
          </p>
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--muted)' }}>
            {paper.abstract?.slice(0, 220)}…
          </p>
        </div>
      </div>
    </motion.div>
  )
}
