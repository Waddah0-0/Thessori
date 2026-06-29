import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import DarkVeil from './components/DarkVeil'
import SearchHero from './components/SearchHero'
import PaperReview from './components/PaperReview'
import DoneScreen from './components/DoneScreen'
import { useResearch } from './hooks/useResearch'

export default function App() {
  const { stage, sessionId, papers, markdown, error, startSearch, approvePapers, deepDive, activeQueries, progressMsg, progressStage, resumable, resumeSession, dismissResume, searchInfo } = useResearch()
  const [energy, setEnergy] = useState(0)

  return (
    <>
      {/* Animated dark veil background (reacts subtly to typing energy) */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <DarkVeil
          hueShift={25}
          noiseIntensity={0.03}
          scanlineIntensity={0}
          speed={0.6}
          warpAmount={Math.min(0.05 + energy * 0.012, 0.25)}
        />
      </div>

      <AnimatePresence mode="wait">
        {(stage === 'idle' || stage === 'searching') && (
          <SearchHero
            key="hero"
            initialQueries={activeQueries}
            onSearch={(queries, maxPapers, topK, useAiExpansion) => {
              setEnergy(0)
              startSearch(queries, maxPapers, topK, useAiExpansion)
            }}
            onType={(wordCount) => setEnergy(wordCount)}
            loading={stage === 'searching'}
            resumable={resumable}
            onResume={resumeSession}
            onDismissResume={dismissResume}
          />
        )}

        {(stage === 'review' || stage === 'generating') && (
          <PaperReview
            key="review"
            papers={papers}
            onApprove={approvePapers}
            loading={stage === 'generating'}
            progressMsg={progressMsg}
            progressStage={progressStage}
            searchInfo={searchInfo}
          />
        )}

        {stage === 'done' && (
          <DoneScreen 
            key="done" 
            sessionId={sessionId} 
            markdown={markdown}
            deepDive={deepDive}
            onDeepDive={(queries) => {
              setEnergy(0)
              // Deep-dive / assistant-proposed queries are already specific —
              // skip AI expansion so they're searched verbatim, not rewritten.
              startSearch(queries, 20, 10, false)
            }}
          />
        )}
      </AnimatePresence>

      {error && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}
        >
          {error}
        </div>
      )}
    </>
  )
}
