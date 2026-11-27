'use client'

import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Apple,
  ArrowUpRight,
  Check,
  ChevronRight,
  Coins,
  Footprints,
  Gamepad2,
  Gift,
  Leaf,
  LogOut,
  Map,
  Bird,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Star,
  Trophy,
  UserRound,
  Medal,
  Undo2,
  RotateCcw,
} from 'lucide-react'
import { abandonGameAction, moveGameAction, startGameAction, undoGameAction, updatePlayerSettingsAction } from '@/app/actions/game'
import { Button } from '@/components/ui/button'
import { AchievementsView } from '@/components/game/achievements-view'
import { GameBoard } from '@/components/game/game-board'
import { GameControls } from '@/components/game/game-controls'
import { LevelSelect } from '@/components/game/level-select'
import { RewardsView, type RewardHistoryItem } from '@/components/game/rewards-view'
import { SettingsView } from '@/components/game/settings-view'
import { LeaderboardView, type LeaderboardEntry } from '@/components/game/leaderboard-view'
import { authClient } from '@/lib/auth-client'
import { playGameSound, startAmbientMusic } from '@/lib/game/audio'
import { calculateStars, createInitialState, findHintDirection, moveGame, type Direction, type GameState, type MoveEvent } from '@/lib/game/engine'
import { DEFAULT_ECONOMY_CONFIG, type EconomyConfig } from '@/lib/game/economy-config'
import { LEVELS, type GameLevel } from '@/lib/game/levels'

type PlayerProfile = {
  currentLevel: number
  totalScore: number
  totalStars: number
  coins: number
  applesCollected: number
  rewardedAdsWatched: number
  settings: { soundEnabled: boolean; musicEnabled: boolean; leaderboardOptIn: boolean }
}

type SavedGame = {
  sessionId: string
  levelId: number
  state: GameState
  history: GameState[]
}

type CompletionSummary = {
  stars: number
  rewardCoins: number
  firstCompletion: boolean
  score: number
}

type View = 'adventure' | 'levels' | 'rewards' | 'achievements' | 'leaderboard' | 'settings'

type GameAppProps = {
  gameName: string
  user: { id: string; name: string; email: string } | null
  initialProfile: PlayerProfile | null
  initialCompletedLevels: Record<number, number>
  initialLevelStats: Record<number, { score: number; bestMoves: number | null }>
  initialRewardHistory: RewardHistoryItem[]
  initialActiveGame: SavedGame | null
  economyConfig: EconomyConfig
  adsAvailable: boolean
  leaderboard: LeaderboardEntry[]
}

const navItems: Array<{ key: View; label: string; Icon: typeof Gamepad2 }> = [
  { key: 'adventure', label: 'Adventure', Icon: Gamepad2 },
  { key: 'levels', label: 'Levels', Icon: Map },
  { key: 'rewards', label: 'Rewards', Icon: Gift },
  { key: 'achievements', label: 'Achievements', Icon: Trophy },
  { key: 'leaderboard', label: 'Leaderboard', Icon: Medal },
  { key: 'settings', label: 'Settings', Icon: SlidersHorizontal },
]

function levelHeading(level: GameLevel) {
  return `Level ${String(level.id).padStart(2, '0')}`
}

function playMoveFeedback(event: MoveEvent, previous: GameState, next: GameState, enabled: boolean) {
  if (event === 'failed') {
    playGameSound('failure', enabled)
    return
  }
  if (event === 'completed') {
    playGameSound('portal', enabled)
    playGameSound('complete', enabled)
    return
  }
  if (event === 'apple') {
    const apple = previous.remainingApples.find(({ x, y }) => x === next.worm[0].x && y === next.worm[0].y)
    playGameSound(apple?.type === 'golden' ? 'golden' : 'apple', enabled)
    return
  }
  if (event === 'moved' || event === 'incomplete-portal') playGameSound('move', enabled)
}

export function GameApp({
  gameName,
  user,
  initialProfile,
  initialCompletedLevels,
  initialLevelStats,
  initialRewardHistory,
  initialActiveGame,
  economyConfig,
  adsAvailable,
  leaderboard,
}: GameAppProps) {
  const router = useRouter()
  const [activeView, setActiveView] = useState<View>('adventure')
  const [activeLevelId, setActiveLevelId] = useState(initialActiveGame?.levelId ?? 1)
  const [game, setGame] = useState<GameState>(initialActiveGame?.state ?? createInitialState(LEVELS[0]))
  const [history, setHistory] = useState<GameState[]>(initialActiveGame?.history ?? [])
  const [serverSessionId, setServerSessionId] = useState<string | null>(initialActiveGame?.sessionId ?? null)
  const [profile, setProfile] = useState<PlayerProfile | null>(initialProfile)
  const [completedLevels, setCompletedLevels] = useState(initialCompletedLevels)
  const [levelStats, setLevelStats] = useState(initialLevelStats)
  const [rewardHistory, setRewardHistory] = useState(initialRewardHistory)
  const [guestUnlockedThrough, setGuestUnlockedThrough] = useState(1)
  const [completion, setCompletion] = useState<CompletionSummary | null>(null)
  const [hintDirection, setHintDirection] = useState<Direction | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [signOutPending, setSignOutPending] = useState(false)
  const [audioPreferences, setAudioPreferences] = useState(initialProfile?.settings ?? { soundEnabled: true, musicEnabled: true, leaderboardOptIn: false })
  const busyRef = useRef(false)
  const stopMusicRef = useRef<(() => void) | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const level = LEVELS[activeLevelId - 1]
  const unlockedThrough = Math.max(guestUnlockedThrough, profile?.currentLevel ?? 1)
  const isFinished = game.status === 'completed'
  const isFailed = game.status === 'failed'
  const movementDisabled = isBusy || isFinished || isFailed
  const remainingObjective = Math.max(0, level.requiredApples - game.collectedApples)

  useEffect(() => () => {
    stopMusicRef.current?.()
    stopMusicRef.current = null
  }, [])

  const handleMove = useCallback(async (direction: Direction) => {
    if (isBusy || busyRef.current || game.status === 'failed' || game.status === 'completed') return
    busyRef.current = true
    setIsBusy(true)
    setHintDirection(null)
    setNotice('')
    if (audioPreferences.musicEnabled && !stopMusicRef.current) {
      stopMusicRef.current = startAmbientMusic()
    }

    try {
      if (user) {
        let sessionId = serverSessionId
        if (!sessionId) {
          const started = await startGameAction(activeLevelId)
          sessionId = started.sessionId
          setServerSessionId(sessionId)
        }
        const result = await moveGameAction(sessionId, direction)
        playMoveFeedback(result.event, game, result.state, audioPreferences.soundEnabled)
        setGame(result.state)
        setHistory(result.history)

        if ('completion' in result && result.completion) {
          const summary = result.completion
          setCompletion({
            stars: summary.stars,
            rewardCoins: summary.rewardCoins,
            firstCompletion: summary.firstCompletion,
            score: summary.score,
          })
          setProfile(summary.profile)
          setCompletedLevels((current) => ({ ...current, [activeLevelId]: Math.max(current[activeLevelId] ?? 0, summary.stars) }))
          setLevelStats((current) => ({
            ...current,
            [activeLevelId]: {
              score: Math.max(current[activeLevelId]?.score ?? 0, summary.score),
              bestMoves: current[activeLevelId]?.bestMoves == null ? result.state.moves : Math.min(current[activeLevelId].bestMoves, result.state.moves),
            },
          }))
          if (summary.rewardCoins > 0) {
            setRewardHistory((current) => [{
              id: `confirmed-${activeLevelId}-${result.state.moves}`,
              type: 'LEVEL_REWARD',
              amount: summary.rewardCoins,
              source: 'LEVEL_COMPLETION',
              status: 'GRANTED',
              createdAt: new Date().toISOString(),
            }, ...current].slice(0, 12))
            playGameSound('coin', audioPreferences.soundEnabled)
          }
        }
      } else {
        const result = moveGame(level, game, direction)
        playMoveFeedback(result.event, game, result.state, audioPreferences.soundEnabled)
        if (['moved', 'apple', 'incomplete-portal', 'completed'].includes(result.event)) {
          setHistory((current) => [...current, game].slice(-50))
        }
        setGame(result.state)

        if (result.event === 'completed') {
          const stars = calculateStars(level, result.state.moves)
          setCompletion({ stars, rewardCoins: 0, firstCompletion: false, score: result.state.score })
          setCompletedLevels((current) => ({ ...current, [activeLevelId]: Math.max(current[activeLevelId] ?? 0, stars) }))
          setLevelStats((current) => ({
            ...current,
            [activeLevelId]: {
              score: Math.max(current[activeLevelId]?.score ?? 0, result.state.score),
              bestMoves: current[activeLevelId]?.bestMoves == null ? result.state.moves : Math.min(current[activeLevelId].bestMoves, result.state.moves),
            },
          }))
          setGuestUnlockedThrough((current) => Math.max(current, Math.min(50, activeLevelId + 1)))
        }
      }
    } catch {
      setNotice('Your move could not be saved. Check your connection and try again.')
    } finally {
      busyRef.current = false
      setIsBusy(false)
    }
  }, [activeLevelId, audioPreferences, game, isBusy, level, serverSessionId, user])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (event.isComposing || event.keyCode === 229) return
      const directions: Record<string, Direction> = {
        ArrowUp: 'up', w: 'up', W: 'up',
        ArrowRight: 'right', d: 'right', D: 'right',
        ArrowDown: 'down', s: 'down', S: 'down',
        ArrowLeft: 'left', a: 'left', A: 'left',
      }
      const direction = directions[event.key]
      if (!direction) return
      event.preventDefault()
      void handleMove(direction)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMove])

  function selectLevel(levelId: number) {
    if (levelId > unlockedThrough) return
    if (serverSessionId && user) void abandonGameAction(serverSessionId).catch(() => undefined)
    setActiveLevelId(levelId)
    setGame(createInitialState(LEVELS[levelId - 1]))
    setHistory([])
    setServerSessionId(null)
    setCompletion(null)
    setHintDirection(null)
    setNotice('')
    setActiveView('adventure')
  }

  async function handleUndo() {
    if (isBusy || busyRef.current) return
    setHintDirection(null)
    if (user && serverSessionId) {
      busyRef.current = true
      setIsBusy(true)
      try {
        const result = await undoGameAction(serverSessionId)
        setGame(result.state)
        setHistory(result.history)
      } catch {
        setNotice('That step could not be undone. Try restarting the level.')
      } finally {
        busyRef.current = false
        setIsBusy(false)
      }
      return
    }

    playGameSound('move', audioPreferences.soundEnabled)
    if (isFailed && !history.length) {
      setGame((current) => ({ ...current, status: 'playing', feedback: 'Last move undone.' }))
      return
    }

    const previous = history.at(-1)
    if (previous) {
      setGame(previous)
      setHistory((current) => current.slice(0, -1))
    }
  }

  function restartLevel() {
    if (serverSessionId && user) void abandonGameAction(serverSessionId).catch(() => undefined)
    setGame(createInitialState(level))
    setHistory([])
    setServerSessionId(null)
    setCompletion(null)
    setHintDirection(null)
    setNotice('')
  }

  function showHint() {
    const direction = findHintDirection(level, game)
    playGameSound('hint', audioPreferences.soundEnabled)
    setHintDirection(direction)
    setNotice(direction ? `Try heading ${direction}.` : 'No clear path from here. Undo a move or restart this trail.')
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    const start = touchStart.current
    const touch = event.changedTouches[0]
    touchStart.current = null
    if (!start || !touch) return
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return
    void handleMove(Math.abs(deltaX) > Math.abs(deltaY) ? deltaX > 0 ? 'right' : 'left' : deltaY > 0 ? 'down' : 'up')
  }

  function changeAudioPreferences(next: { soundEnabled: boolean; musicEnabled: boolean; leaderboardOptIn: boolean }) {
    setAudioPreferences(next)
    if (next.musicEnabled && !stopMusicRef.current) stopMusicRef.current = startAmbientMusic()
    if (!next.musicEnabled) {
      stopMusicRef.current?.()
      stopMusicRef.current = null
    }
    playGameSound('toggle', next.soundEnabled)
    if (user) {
      void updatePlayerSettingsAction(next).catch(() => {
        setNotice('Your audio changed for this visit but could not be saved to your account.')
      })
    }
  }

  async function handleSignOut() {
    setSignOutPending(true)
    try {
      await authClient.signOut()
      router.refresh()
    } finally {
      setSignOutPending(false)
    }
  }

  const firstName = user?.name.trim().split(/\s+/)[0]
  const displayViewHeading: Record<View, string> = {
    adventure: firstName ? `Welcome back, ${firstName}.` : 'The forest is calling.',
    levels: 'Choose your next trail.',
    rewards: 'Good runs grow good things.',
    achievements: 'Every good trail leaves a mark.',
    leaderboard: 'The grove’s most thoughtful trails.',
    settings: 'A few thoughtful preferences.',
  }

  return (
    <div className="game-shell">
      <header className="topbar">
        <Link href="/" className="brand-lockup" aria-label={`${gameName} home`}>
          <span className="brand-mark"><Apple aria-hidden="true" /><Leaf className="brand-leaf" aria-hidden="true" /></span>
          <span className="brand-copy"><strong>{gameName}</strong><span>Follow the apple trail</span></span>
        </Link>
        <nav className="top-navigation" aria-label="Main navigation">
          {navItems.map(({ key, label, Icon }) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              className={`nav-button ${activeView === key ? 'nav-button-active' : ''}`}
              aria-label={label}
              aria-current={activeView === key ? 'page' : undefined}
              onClick={() => setActiveView(key)}
            >
              <Icon data-icon="inline-start" aria-hidden="true" /> <span>{label}</span>
            </Button>
          ))}
        </nav>
        <div className="account-actions">
          {profile ? (
            <div className="coin-balance" aria-label={`${profile.coins} acorns`}><Coins aria-hidden="true" /><strong>{profile.coins.toLocaleString()}</strong><span>acorns</span></div>
          ) : (
            <Link className="top-signin-link" href="/sign-in">Sign in</Link>
          )}
          {user ? (
            <>
              <span className="avatar-chip" aria-label={`Signed in as ${user.name}`}>{user.name.trim().slice(0, 1).toUpperCase()}</span>
              <Button variant="ghost" size="icon" className="signout-button" aria-label="Sign out" disabled={signOutPending} onClick={handleSignOut}><LogOut aria-hidden="true" /></Button>
            </>
          ) : (
            <Link href="/sign-up" className="create-account-link" aria-label="Create an account to save progress"><UserRound aria-hidden="true" /><span>Save progress</span><ArrowUpRight aria-hidden="true" /></Link>
          )}
        </div>
      </header>

      <main className="page-content">
        <section className="page-intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow"><span className="eyebrow-dot" /> A jungle trail adventure</p>
            <h1 id="page-title">{displayViewHeading[activeView]}</h1>
              <p className="page-subtitle">Guide your jungle friend along the wooden trail, gather apples, and dodge the birds guarding the moonlit portal.</p>

          </div>
          <div className="journey-progress">
            <span className="journey-icon"><Leaf aria-hidden="true" /></span>
            <div><span>Your journey</span><strong>Level {String(Math.min(unlockedThrough, 50)).padStart(2, '0')} <small>of 50</small></strong></div>
            <div className="journey-progress-track" aria-label={`${Math.min(unlockedThrough, 50)} of 50 levels unlocked`}><span style={{ width: `${Math.max(2, Math.min(100, (unlockedThrough / 50) * 100))}%` }} /></div>
          </div>
        </section>

        {activeView === 'adventure' && (
          <div className="adventure-layout">
            <section className="play-column" aria-labelledby="level-heading">
              <div className="level-heading-row">
                <div className="level-number-block"><span>{String(level.id).padStart(2, '0')}</span></div>
                <div className="level-title-copy">
                  <p className="level-world">{level.world}</p>
                  <h2 id="level-heading">{level.name}</h2>
                </div>
                <span className={`difficulty-badge difficulty-${level.difficulty.toLowerCase()}`}>{level.difficulty}</span>
                <Button variant="outline" size="sm" className="change-level-button" onClick={() => setActiveView('levels')}>Change level <ChevronRight data-icon="inline-end" aria-hidden="true" /></Button>
              </div>

              <article className="game-card" aria-label={`${levelHeading(level)} gameplay`}>
                <div className="game-card-header">
                  <div className="objective-display">
                    <span className="objective-label">Current objective</span>
                    <strong><Apple aria-hidden="true" /> {game.collectedApples} <span>/ {level.requiredApples} apples</span></strong>
                  </div>
                  <div className="quick-stats">
                    <div className="quick-stat"><Footprints aria-hidden="true" /><span>Moves</span><strong>{game.moves}<small>/{level.moveLimit}</small></strong></div>
                    <div className="quick-stat"><Star aria-hidden="true" /><span>Score</span><strong>{game.score}</strong></div>
                  </div>
                </div>

                {notice && <p className="game-notice" role="status">{notice}</p>}
                {game.feedback && !isFinished && !isFailed && <p className="game-feedback" role="status">{game.feedback}</p>}

                <GameBoard
                  level={level}
                  state={game}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  resultOverlay={(isFailed || isFinished && completion) && (
                    <section
                      className={`board-result-overlay ${isFailed ? 'board-result-failed' : 'board-result-complete'}`}
                      role="region"
                      aria-live="polite"
                      aria-labelledby="board-result-title"
                    >
                      <span className="board-result-emblem"><Sparkles aria-hidden="true" /></span>
                      {isFinished && completion && (
                        <div className="result-stars" aria-label={`${completion.stars} out of 3 stars`}>
                          {Array.from({ length: 3 }, (_, index) => <Star key={index} className={index < completion.stars ? 'star-earned' : ''} aria-hidden="true" />)}
                        </div>
                      )}
                      <h3 id="board-result-title">{isFailed ? 'A thorny turn!' : 'Maze mastered!'}</h3>
                      <p>{isFailed
                        ? 'Every great explorer hits a wall. Undo a step or give this maze another try.'
                        : level.id < unlockedThrough
                          ? 'Brilliant trail-finding. Want to explore the next maze or take this one again?'
                          : 'You reached the end of the trail. Replay this maze or choose another level.'}</p>
                      {isFinished && completion && (
                        <span className="board-result-reward">
                          {completion.rewardCoins > 0 ? `+${completion.rewardCoins} acorns earned` : `${game.score.toLocaleString()} trail points`}
                        </span>
                      )}
                      {!user && isFinished && <Link href="/sign-up" className="board-result-save-link">Save this run <ArrowUpRight aria-hidden="true" /></Link>}
                      <div className="board-result-actions">
                        {isFailed ? (
                          <>
                            {history.length > 0 && <Button size="sm" variant="outline" onClick={handleUndo}><Undo2 data-icon="inline-start" aria-hidden="true" /> Undo step</Button>}
                            <Button size="sm" onClick={restartLevel}><RotateCcw data-icon="inline-start" aria-hidden="true" /> Try again</Button>
                          </>
                        ) : (
                          <>
                            {level.id < unlockedThrough
                              ? <Button size="sm" onClick={() => selectLevel(level.id + 1)}>Next maze <ChevronRight data-icon="inline-end" aria-hidden="true" /></Button>
                              : <Button size="sm" onClick={() => setActiveView('levels')}>Choose a maze <ChevronRight data-icon="inline-end" aria-hidden="true" /></Button>}
                            <Button size="sm" variant="outline" onClick={restartLevel}><RotateCcw data-icon="inline-start" aria-hidden="true" /> Replay</Button>
                          </>
                        )}
                      </div>
                    </section>
                  )}
                />

                <div className="board-progress-row">
                  <div className="apple-progress-track" aria-label={`${game.collectedApples} of ${level.requiredApples} required apples collected`}>
                    {Array.from({ length: level.requiredApples }, (_, index) => (
                      <span key={index} className={index < game.collectedApples ? 'apple-progress-filled' : ''}><Apple aria-hidden="true" /></span>
                    ))}
                  </div>
                  <span>{remainingObjective === 0 ? 'Find the portal' : `${remainingObjective} ${remainingObjective === 1 ? 'apple' : 'apples'} to go`}</span>
                </div>

                <div className="game-controls-wrap">
                  <GameControls
                    disabled={movementDisabled}
                    busy={isBusy}
                    canUndo={history.length > 0 || isFailed}
                    hintDirection={hintDirection}
                    onMove={handleMove}
                    onUndo={handleUndo}
                    onHint={showHint}
                    onRestart={restartLevel}
                  />
                </div>

              </article>
            </section>

            <aside className="sidebar-column" aria-label="Adventure details">
              <section className="sidebar-card trail-card">
                <div className="sidebar-card-heading"><span className="sidebar-icon sidebar-icon-green"><Map aria-hidden="true" /></span><span className="card-kicker">Your trail</span></div>
                <h3>One step at a time.</h3>
                <p>Collect enough apples to grow, then guide the worm to the glowing portal.</p>
                <ol className="trail-steps">
                  <li className={game.collectedApples >= level.requiredApples ? 'trail-step-done' : 'trail-step-active'}>
                    <span className="step-marker">{game.collectedApples >= level.requiredApples ? <Check aria-hidden="true" /> : '1'}</span>
                    <span><strong>Collect apples</strong><small>{game.collectedApples}/{level.requiredApples} collected</small></span>
                  </li>
                  <li className={game.collectedApples >= level.requiredApples ? 'trail-step-active' : ''}>
                    <span className="step-marker">2</span>
                    <span><strong>Reach the portal</strong><small>Follow the moonlit trail</small></span>
                  </li>
                </ol>
                <div className="trail-divider" />
                <div className="tile-legend" aria-label="Game board legend">
                  <span><i className="legend-wall"><span /></i> Maze wall</span>
                  <span><i className="legend-apple"><Apple aria-hidden="true" /></i> Apple</span>
                  <span><i className="legend-portal"><Sparkles aria-hidden="true" /></i> Portal</span>
                  <span><i className="legend-spike"><span /></i> Hazard</span>
                  <span><i className="legend-moving"><Bird aria-hidden="true" /></i> Flying bird</span>
                </div>
              </section>

              <section className="sidebar-card economy-card">
                <div className="sidebar-card-heading"><span className="sidebar-icon sidebar-icon-gold"><Coins aria-hidden="true" /></span><span className="card-kicker">Grove wallet</span></div>
                {profile ? (
                  <>
                    <div className="wallet-total"><strong>{profile.coins.toLocaleString()}</strong><span>acorns</span></div>
                    <p>Earn {economyConfig.levelCompletionCoins} acorns the first time you finish a level.</p>
                    <Button variant="ghost" size="sm" className="sidebar-link-button" onClick={() => setActiveView('rewards')}>See reward rules <ChevronRight data-icon="inline-end" aria-hidden="true" /></Button>
                  </>
                ) : (
                  <>
                    <div className="wallet-total wallet-guest"><strong>Keep your progress</strong></div>
                    <p>Sign in to save your scores, stars, and acorns across visits.</p>
                    <Link href="/sign-up" className="sidebar-inline-link">Create a free account <ArrowUpRight aria-hidden="true" /></Link>
                  </>
                )}
              </section>

              <section className="sidebar-tip">
                <span className="tip-icon"><Sparkles aria-hidden="true" /></span>
                <div><strong>A small hint</strong><p>Plan one bend ahead so the worm never crosses its own tail.</p></div>
              </section>
              <p className="session-note"><ShieldCheck aria-hidden="true" /> {user ? 'Your moves and rewards are saved securely.' : 'Guest progress is temporary and stays in memory only.'}</p>
            </aside>
          </div>
        )}

        {activeView === 'levels' && (
          <LevelSelect
            levels={LEVELS}
            unlockedThrough={unlockedThrough}
            completedLevels={completedLevels}
            levelStats={levelStats}
            onSelect={selectLevel}
          />
        )}
        {activeView === 'rewards' && <RewardsView config={economyConfig ?? DEFAULT_ECONOMY_CONFIG} coins={profile?.coins ?? null} signedIn={Boolean(user)} adsAvailable={adsAvailable} history={rewardHistory} />}
        {activeView === 'achievements' && (
          <AchievementsView
            applesCollected={profile?.applesCollected ?? 0}
            completedLevels={Object.keys(completedLevels).length}
            totalStars={profile?.totalStars ?? Object.values(completedLevels).reduce((sum, stars) => sum + stars, 0)}
            coins={profile?.coins ?? 0}
            signedIn={Boolean(user)}
          />
        )}
        {activeView === 'leaderboard' && <LeaderboardView entries={leaderboard} />}
        {activeView === 'settings' && (
          <SettingsView
            gameName={gameName}
            settings={audioPreferences}
            signedIn={Boolean(user)}
            onChange={changeAudioPreferences}
          />
        )}

        <footer className="page-footer">
          <span><Apple aria-hidden="true" /> {gameName}</span>
          <span>Made for curious little adventurers.</span>
          <Link href="/sign-in">Account help <ArrowUpRight aria-hidden="true" /></Link>
        </footer>
      </main>
    </div>
  )
}
