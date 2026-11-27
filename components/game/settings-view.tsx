import { Compass, Headphones, Music2, Smartphone, Volume2 } from 'lucide-react'
import type { PlayerSettings } from '@/lib/game/types'

type SettingsViewProps = {
  gameName: string
  settings: PlayerSettings
  signedIn: boolean
  onChange: (settings: PlayerSettings) => void
}

export function SettingsView({ gameName, settings, signedIn, onChange }: SettingsViewProps) {
  return (
    <section className="view-panel settings-view" aria-labelledby="settings-title">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Make the grove yours</p>
          <h2 id="settings-title">A few thoughtful preferences.</h2>
          <p className="view-description">
            Your preferences are{' '}
            {signedIn
              ? 'saved to your account.'
              : 'kept for this visit only. Sign in to sync them across devices.'}
          </p>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-section-title">
          <Headphones aria-hidden="true" />
          <div>
            <strong>Sound, feel &amp; hints</strong>
            <span>Original synthesized audio, hint routing, and mobile haptics.</span>
          </div>
        </div>

        <label className="setting-row">
          <span className="setting-icon">
            <Volume2 aria-hidden="true" />
          </span>
          <span className="setting-copy">
            <strong>Sound effects</strong>
            <small>Movement, apple streaks, keys, warps, rescues, and star chimes.</small>
          </span>
          <span className="switch-control">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(event) => onChange({ ...settings, soundEnabled: event.target.checked })}
            />
            <span aria-hidden="true" />
          </span>
        </label>

        <label className="setting-row">
          <span className="setting-icon">
            <Music2 aria-hidden="true" />
          </span>
          <span className="setting-copy">
            <strong>Background music</strong>
            <small>A gentle procedural loop starts with your first move.</small>
          </span>
          <span className="switch-control">
            <input
              type="checkbox"
              checked={settings.musicEnabled}
              onChange={(event) => onChange({ ...settings, musicEnabled: event.target.checked })}
            />
            <span aria-hidden="true" />
          </span>
        </label>

        <label className="setting-row">
          <span className="setting-icon">
            <Compass aria-hidden="true" />
          </span>
          <span className="setting-copy">
            <strong>Safe hint mode</strong>
            <small>
              Off by default (hints target the 3★ shortcut). Turn on to follow the safer 1★ detour.
            </small>
          </span>
          <span className="switch-control">
            <input
              type="checkbox"
              checked={Boolean(settings.safeHint)}
              onChange={(event) => onChange({ ...settings, safeHint: event.target.checked })}
            />
            <span aria-hidden="true" />
          </span>
        </label>

        <label className="setting-row">
          <span className="setting-icon">
            <Smartphone aria-hidden="true" />
          </span>
          <span className="setting-copy">
            <strong>Haptic feedback</strong>
            <small>Subtle vibration cues on moves, apples, and level clears on mobile devices.</small>
          </span>
          <span className="switch-control">
            <input
              type="checkbox"
              checked={settings.hapticsEnabled !== false}
              onChange={(event) => onChange({ ...settings, hapticsEnabled: event.target.checked })}
            />
            <span aria-hidden="true" />
          </span>
        </label>

        <label className="setting-row">
          <span className="setting-icon">
            <Headphones aria-hidden="true" />
          </span>
          <span className="setting-copy">
            <strong>Public leaderboard</strong>
            <small>Show your name and best totals to other players. Off by default.</small>
          </span>
          <span className="switch-control">
            <input
              type="checkbox"
              checked={settings.leaderboardOptIn}
              onChange={(event) => onChange({ ...settings, leaderboardOptIn: event.target.checked })}
            />
            <span aria-hidden="true" />
          </span>
        </label>
      </div>

      <div className="settings-card settings-about">
        <span className="settings-about-icon">
          <Headphones aria-hidden="true" />
        </span>
        <div>
          <strong>{gameName}</strong>
          <p>
            Keyboard: arrow keys or WASD. Mobile: swipe the board, tap adjacent tiles, or use the
            direction pad. Reduced-motion preferences are respected automatically.
          </p>
        </div>
      </div>
    </section>
  )
}
