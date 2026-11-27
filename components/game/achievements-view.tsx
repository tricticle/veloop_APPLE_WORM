import { Apple, Bird, Crown, Footprints, Gem, Leaf, ShieldCheck, Sparkles, Star, Trophy } from 'lucide-react'

type AchievementsViewProps = {
  applesCollected: number
  completedLevels: number
  totalStars: number
  coins: number
  threeStarLevels: number
  perfectChapters: number
  noUndoClears: number
  birdsRescued: number
  signedIn: boolean
}

const milestones = [
  { title: 'First Fruit', detail: 'Collect your first apple.', Icon: Apple, target: 1, metric: 'apples' as const },
  { title: 'Orchard Guest', detail: 'Collect 50 apples across your runs.', Icon: Apple, target: 50, metric: 'apples' as const },
  { title: 'Trailblazer', detail: 'Finish your first puzzle.', Icon: Footprints, target: 1, metric: 'levels' as const },
  { title: 'First 3★', detail: 'Master the 3-star optimal route on any trail.', Icon: Sparkles, target: 1, metric: 'threeStarLevels' as const },
  { title: 'No-Undo Clear', detail: 'Finish a trail without using Undo.', Icon: ShieldCheck, target: 1, metric: 'noUndoClears' as const },
  { title: 'Bird Saver', detail: 'Rescue 5 trapped bird friends across the grove.', Icon: Bird, target: 5, metric: 'birdsRescued' as const },
  { title: 'Perfect Chapter', detail: 'Earn all 30 stars in any 10-level world.', Icon: Crown, target: 1, metric: 'perfectChapters' as const },
  { title: 'Worm Beginner', detail: 'Finish 5 different levels.', Icon: Leaf, target: 5, metric: 'levels' as const },
  { title: 'Portal Finder', detail: 'Finish 10 different levels.', Icon: Trophy, target: 10, metric: 'levels' as const },
  { title: 'Master Solver', detail: 'Finish 25 different levels.', Icon: Gem, target: 25, metric: 'levels' as const },
  { title: 'Worm Legend', detail: 'Finish every level in the grove.', Icon: Trophy, target: 50, metric: 'levels' as const },
  { title: 'Bright Path', detail: 'Collect 10 stars across the grove.', Icon: Star, target: 10, metric: 'stars' as const },
  { title: 'Star Collector', detail: 'Earn 100 stars.', Icon: Star, target: 100, metric: 'stars' as const },
  { title: 'Acorn Saver', detail: 'Grow your wallet to 500 acorns.', Icon: Gem, target: 500, metric: 'coins' as const },
]

export function AchievementsView({
  applesCollected,
  completedLevels,
  totalStars,
  coins,
  threeStarLevels,
  perfectChapters,
  noUndoClears,
  birdsRescued,
  signedIn,
}: AchievementsViewProps) {
  const values = {
    apples: applesCollected,
    levels: completedLevels,
    stars: totalStars,
    coins,
    threeStarLevels,
    perfectChapters,
    noUndoClears,
    birdsRescued,
  }

  return (
    <section className="view-panel" aria-labelledby="achievements-title">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Little milestones</p>
          <h2 id="achievements-title">Every good trail leaves a mark.</h2>
          <p className="view-description">
            Achievements update from completed game progress
            {signedIn ? ' saved to your account.' : '. Sign in to keep them after this visit.'}
          </p>
        </div>
      </div>
      <div className="achievement-grid">
        {milestones.map(({ title, detail, Icon, target, metric }) => {
          const value = values[metric]
          const unlocked = value >= target
          const percent = Math.min(100, Math.round((value / target) * 100))
          return (
            <article key={title} className={`achievement-card ${unlocked ? 'achievement-unlocked' : ''}`}>
              <div className="achievement-icon">
                <Icon aria-hidden="true" />
              </div>
              <div className="achievement-copy">
                <div className="achievement-title-row">
                  <h3>{title}</h3>
                  <span>{unlocked ? 'Earned' : `${value}/${target}`}</span>
                </div>
                <p>{detail}</p>
                <div className="achievement-progress" aria-label={`${percent}% complete`}>
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
