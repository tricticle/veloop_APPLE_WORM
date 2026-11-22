import { Check, LockKeyhole, Star } from 'lucide-react'
import type { GameLevel } from '@/lib/game/levels'

type LevelSelectProps = {
  levels: GameLevel[]
  unlockedThrough: number
  completedLevels: Record<number, number>
  levelStats: Record<number, { score: number; bestMoves: number | null }>
  onSelect: (levelId: number) => void
}

export function LevelSelect({ levels, unlockedThrough, completedLevels, levelStats, onSelect }: LevelSelectProps) {
  return (
    <section className="view-panel" aria-labelledby="levels-title">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Choose your next trail</p>
          <h2 id="levels-title">The grove has 50 little puzzles.</h2>
          <p className="view-description">Finish a level to open the next one. Replay any path you have already unlocked.</p>
        </div>
        <div className="levels-progress-pill">{Math.min(unlockedThrough, 50)} <span>of 50 open</span></div>
      </div>
      {['The Apple Grove', 'Fernwood Forest', 'Mosslight Meadow', 'Bramble Ridge', 'The Golden Canopy'].map((world, worldIndex) => (
        <div className="world-group" key={world}>
          <div className="world-heading">
            <span className="world-number">0{worldIndex + 1}</span>
            <h3>{world}</h3>
            <span className="world-range">Levels {worldIndex * 10 + 1}–{worldIndex * 10 + 10}</span>
          </div>
          <div className="level-grid">
            {levels.slice(worldIndex * 10, worldIndex * 10 + 10).map((level) => {
              const isLocked = level.id > unlockedThrough
              const stars = completedLevels[level.id] ?? 0
              const stats = levelStats[level.id]
              const bestLabel = stats ? `, best score ${stats.score}, best moves ${stats.bestMoves ?? 'not recorded'}` : ''
              return (
                <button
                  key={level.id}
                  type="button"
                  className={`level-tile ${isLocked ? 'level-locked' : ''} ${stars ? 'level-complete' : ''}`}
                  onClick={() => onSelect(level.id)}
                  disabled={isLocked}
                  aria-label={isLocked ? `Level ${level.id}, locked` : `Play level ${level.id}${stars ? `, ${stars} stars` : ''}${bestLabel}`}
                  title={isLocked ? 'Complete the previous level to unlock this trail.' : bestLabel.slice(2) || `Play ${level.name}`}
                >
                  <span className="level-tile-number">{String(level.id).padStart(2, '0')}</span>
                  {isLocked ? <LockKeyhole aria-hidden="true" /> : stars ? <Check aria-hidden="true" /> : <span className="level-dot" aria-hidden="true" />}
                  {stars > 0 && <span className="level-stars" aria-label={`${stars} stars`}><Star /><span>{stars}</span></span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}
