import { Globe2, Medal, Star, Trophy } from 'lucide-react'

export type LeaderboardEntry = {
  name: string
  totalScore: number
  totalStars: number
  currentLevel: number
  isCurrentUser: boolean
}

type LeaderboardViewProps = {
  entries: LeaderboardEntry[]
}

export function LeaderboardView({ entries }: LeaderboardViewProps) {
  return (
    <section className="view-panel leaderboard-view" aria-labelledby="leaderboard-title">
      <div className="view-heading">
        <div>
          <p className="eyebrow"><Globe2 aria-hidden="true" /> Shared by choice</p>
          <h2 id="leaderboard-title">The grove&apos;s most thoughtful trails.</h2>
          <p className="view-description">Only players who opt in to the public leaderboard appear here. Email addresses and account IDs are never shown.</p>
        </div>
      </div>
      {entries.length ? (
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Level</th><th scope="col">Stars</th><th scope="col">Best score</th></tr></thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={`${entry.name}-${index}`} className={entry.isCurrentUser ? 'leaderboard-current-player' : ''}>
                  <td><span className={`leaderboard-rank ${index < 3 ? 'leaderboard-rank-top' : ''}`}>{index === 0 ? <Trophy aria-label="Top score" /> : index < 3 ? <Medal aria-label={`Rank ${index + 1}`} /> : index + 1}</span></td>
                  <td><strong>{entry.name}</strong>{entry.isCurrentUser && <span className="leaderboard-you">You</span>}</td>
                  <td>{String(Math.min(entry.currentLevel, 50)).padStart(2, '0')}</td>
                  <td><span className="leaderboard-stars"><Star aria-hidden="true" /> {entry.totalStars.toLocaleString()}</span></td>
                  <td className="leaderboard-score">{entry.totalScore.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="leaderboard-empty">
          <span><Globe2 aria-hidden="true" /></span>
          <strong>No shared scores yet.</strong>
          <p>Players can opt in from Settings. Your own scores stay private until you choose to share.</p>
        </div>
      )}
      <p className="leaderboard-footnote"><Star aria-hidden="true" /> Ranked by verified best score, then stars. Replaying a level never duplicates its first-clear coin reward.</p>
    </section>
  )
}
