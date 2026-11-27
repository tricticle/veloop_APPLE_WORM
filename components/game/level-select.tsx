import { Check, LockKeyhole, Sparkles, Star } from 'lucide-react'
import type { GameLevel } from '@/lib/game/levels'

type LevelSelectProps = {
  levels: GameLevel[]
  unlockedThrough: number
  completedLevels: Record<number, number>
  levelStats: Record<number, { score: number; bestMoves: number | null; noUndoClear?: boolean }>
  onSelect: (levelId: number) => void
}

export function LevelSelect({
  levels,
  unlockedThrough,
  completedLevels,
  levelStats,
  onSelect,
}: LevelSelectProps) {
  const earnedStars = Object.values(completedLevels).reduce((sum, stars) => sum + stars, 0)

  return (
    <section className="view-panel" aria-labelledby="levels-title">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Choose your next trail</p>
          <h2 id="levels-title">50 trails across five wild worlds.</h2>
          <p className="view-description">
            Every trail has a clever 3★ shortcut and a safer 1★ route. Replay any cleared level to
            hunt down missing stars.
          </p>
        </div>
        <div className="levels-summary-metrics">
          <div className="levels-progress-pill">
            {Math.min(unlockedThrough, 50)} <span>of 50 open</span>
          </div>
          <div className="levels-progress-pill levels-stars-summary">
            <Star aria-hidden="true" />
            {earnedStars} <span>of 150 stars</span>
          </div>
        </div>
      </div>

      {[
        'The Apple Grove',
        'Fernwood Forest',
        'Mosslight Meadow',
        'Bramble Ridge',
        'The Golden Canopy',
      ].map((world, worldIndex) => {
        const worldLevels = levels.slice(worldIndex * 10, worldIndex * 10 + 10)
        const worldStars = worldLevels.reduce(
          (sum, lvl) => sum + (completedLevels[lvl.id] ?? 0),
          0,
        )

        return (
          <div className={`world-group world-group-${worldIndex + 1}`} key={world}>
            <div className="world-heading">
              <span className="world-number">0{worldIndex + 1}</span>
              <h3>{world}</h3>
              <span className="world-stars-tally" aria-label={`${worldStars} of 30 stars earned`}>
                <Star aria-hidden="true" /> {worldStars}/30
              </span>
              <span className="world-range">
                Levels {worldIndex * 10 + 1}–{worldIndex * 10 + 10}
              </span>
            </div>
            <div className="level-grid">
              {worldLevels.map((level) => {
                const isLocked = level.id > unlockedThrough
                const stars = completedLevels[level.id] ?? 0
                const isNextLevel = level.id === unlockedThrough && stars === 0
                const threeStarAvailable = stars > 0 && stars < 3
                const stats = levelStats[level.id]
                const bestLabel = stats
                  ? `, best score ${stats.score}, best moves ${stats.bestMoves ?? 'not recorded'}`
                  : ''
                return (
                  <button
                    key={level.id}
                    type="button"
                    className={`level-tile ${isLocked ? 'level-locked' : ''} ${stars ? 'level-complete' : ''} ${stars === 3 ? 'level-mastered' : ''} ${isNextLevel ? 'level-next' : ''}`}
                    onClick={() => onSelect(level.id)}
                    disabled={isLocked}
                    aria-current={isNextLevel ? 'step' : undefined}
                    aria-label={
                      isLocked
                        ? `Level ${level.id}, locked`
                        : `Play level ${level.id}, ${level.name}${isNextLevel ? ', next trail' : ''}${stars ? `, ${stars} of 3 stars` : ''}${threeStarAvailable ? ', 3 stars still available' : ''}${bestLabel}`
                    }
                    title={
                      isLocked
                        ? 'Complete the previous level to unlock this trail.'
                        : `${level.name}${threeStarAvailable ? ' · 3★ shortcut still available!' : ''}${bestLabel}`
                    }
                  >
                    <span className="level-tile-number">
                      {String(level.id).padStart(2, '0')}
                    </span>
                    {isNextLevel && <span className="level-next-badge">NEXT</span>}
                    {threeStarAvailable && (
                      <span className="level-three-star-nudge" title="3★ still available">
                        <Sparkles aria-hidden="true" /> 3★ open
                      </span>
                    )}
                    {isLocked ? (
                      <LockKeyhole aria-hidden="true" />
                    ) : stars ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <span className="level-dot" aria-hidden="true" />
                    )}
                    {stars > 0 && (
                      <span className="level-stars" aria-label={`${stars} out of 3 stars`}>
                        {Array.from({ length: 3 }, (_, idx) => (
                          <Star
                            key={idx}
                            className={idx < stars ? 'level-star-filled' : 'level-star-empty'}
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}
