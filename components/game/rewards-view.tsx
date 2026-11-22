import { Apple, CircleHelp, Coins, Gift, History, ShieldCheck, Sparkles } from 'lucide-react'
import type { EconomyConfig } from '@/lib/game/economy-config'

export type RewardHistoryItem = {
  id: string
  type: string
  amount: number
  source: string
  status?: string
  createdAt: string
}

type RewardsViewProps = {
  config: EconomyConfig
  coins: number | null
  signedIn: boolean
  adsAvailable: boolean
  history: RewardHistoryItem[]
}

export function RewardsView({ config, coins, signedIn, adsAvailable, history }: RewardsViewProps) {
  const adsConnected = adsAvailable

  return (
    <section className="view-panel rewards-view" aria-labelledby="rewards-title">
      <div className="view-heading">
        <div>
          <p className="eyebrow">A little thank-you</p>
          <h2 id="rewards-title">Good runs grow good things.</h2>
          <p className="view-description">Your wallet and reward rules are managed on the server. No ad reward is issued unless a provider confirms it.</p>
        </div>
      </div>
      <div className="reward-overview-grid">
        <article className="reward-balance-card">
          <div className="reward-card-icon"><Coins aria-hidden="true" /></div>
          <p className="reward-label">Your acorn wallet</p>
          <p className="reward-balance">{signedIn && coins !== null ? coins.toLocaleString() : '—'} <span>acorns</span></p>
          <p className="reward-card-note">{signedIn ? `Earn ${config.levelCompletionCoins} acorns the first time you finish each level.` : 'Sign in to save your balance and earn level rewards.'}</p>
        </article>
        <article className="reward-earn-card">
          <div className="reward-card-icon reward-card-icon-coral"><Apple aria-hidden="true" /></div>
          <p className="reward-label">Level completion</p>
          <p className="reward-balance">+{config.levelCompletionCoins} <span>acorns</span></p>
          <p className="reward-card-note">One server-verified reward per level. Replay scores can improve, but do not duplicate the first-clear reward.</p>
        </article>
      </div>
      <article className="ad-provider-card">
        <div className="ad-provider-copy">
          <div className="ad-provider-icon"><Gift aria-hidden="true" /></div>
          <div>
            <div className="provider-title-row"><h3>Opt-in video rewards</h3><span className={`provider-status ${adsConnected ? 'provider-status-live' : ''}`}>{adsConnected ? 'Connected' : 'Not connected'}</span></div>
            <p>{adsConnected ? 'Verified reward opportunities are ready.' : 'Rewarded ads are intentionally unavailable until an ad provider is configured. Hints and level rewards work without ads.'}</p>
          </div>
        </div>
        <button className="disabled-provider-button" type="button" disabled aria-describedby="ad-provider-note">
          <Sparkles aria-hidden="true" /> {adsConnected ? 'Provider ready' : 'Provider required'}
        </button>
      </article>
      <section className="reward-history" aria-labelledby="reward-history-title">
        <div className="reward-history-heading"><div><History aria-hidden="true" /><h3 id="reward-history-title">Recent wallet activity</h3></div><span>{signedIn ? 'Latest 12 entries' : 'Account history'}</span></div>
        {history.length ? (
          <ul className="reward-history-list">
            {history.map((entry) => (
              <li key={entry.id}>
                <span className="history-entry-icon"><Coins aria-hidden="true" /></span>
                <span className="history-entry-copy"><strong>{entry.type.replaceAll('_', ' ').toLowerCase()}</strong><small>{entry.status ?? entry.source.replaceAll('_', ' ').toLowerCase()} · {entry.createdAt.slice(0, 10)}</small></span>
                <span className="history-entry-amount">{entry.amount >= 0 ? '+' : ''}{entry.amount.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="reward-history-empty">{signedIn ? 'No wallet activity yet. Finish a level to earn your first acorns.' : 'Sign in to view your personal reward history.'}</p>
        )}
      </section>
      <p className="economy-note" id="ad-provider-note"><ShieldCheck aria-hidden="true" /> <span>Ad events are designed to be verified server-side with unique event IDs, per-user limits, and an immutable reward ledger.</span></p>
      <div className="reward-footnote"><CircleHelp aria-hidden="true" /><p>Coins are a game-only balance with no cash value. Account progress is scoped to your own player ID.</p></div>
    </section>
  )
}
