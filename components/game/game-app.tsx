'use client'

import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Apple,
  ArrowUpRight,
  Bird,
  Bug,
  Check,
  ChevronRight,
  Coins,
  Eye,
  EyeOff,
  Footprints,
  Gamepad2,
  Gift,
  KeyRound,
  Leaf,
  LockKeyhole,
  LockOpen,
  LogOut,
  Map,
  Medal,
  RotateCcw,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Star,
  SlidersHorizontal,
  Target,
  Trophy,
  Undo2,
  UserRound,
} from 'lucide-react'
import {
  abandonGameAction,
  moveGameAction,
  startGameAction,
  undoGameAction,
  updatePlayerSettingsAction,
} from '@/app/actions/game'
import { AchievementsView } from '@/components/game/achievements-view'
import { BirdCompanion, type BirdMood } from '@/components/game/bird-companion'
import { GameBoard } from '@/components/game/game-board'
import { GameControls } from '@/components/game/game-controls'
import { LeaderboardView, type LeaderboardEntry } from '@/components/game/leaderboard-view'
import { LevelSelect } from '@/components/game/level-select'
import { RewardsView, type RewardHistoryItem } from '@/components/game/rewards-view'
import { SettingsView } from '@/components/game/settings-view'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import {
  playAppleComboSound,
  playGameSound,
  startAmbientMusic,
  triggerHaptic,
} from '@/lib/game/audio'
import { DEFAULT_ECONOMY_CONFIG, type EconomyConfig } from '@/lib/game/economy-config'
import {
  calculateStars,
  countGoldenCollected,
  countNormalCollected,
  createInitialState,
  findHintDirection,
  getStarThresholds,
  isPortalReady,
  moveGame,
  type Direction,
  type FailureCause,
  type GameState,
  type MoveEvent,
  type PlayerSettings,
} from '@/lib/game/engine'
import { LEVELS, type GameLevel } from '@/lib/game/levels'

type PlayerProfile = {
  currentLevel: number
  totalScore: number
  totalStars: number
  coins: number
  applesCollected: number
  rewardedAdsWatched: number
  noUndoClears?: number
  birdsRescued?: number
  settings: PlayerSettings
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
  initialLevelStats: Record<number, { score: number; bestMoves: number | null; noUndoClear?: boolean }>
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

const failureStories: Record<FailureCause, { title: string; description: string }> = {
  edge: {
    title: 'Off the trail!',
    description: 'The worm slipped beyond the path. Undo a move and find another way through.',
  },
  moves: {
    title: 'Out of moves!',
    description: 'This run ran out of steps. Undo a move or give the maze another try.',
  },
  thorn: {
    title: 'A thorny surprise!',
    description: 'A bramble stopped the worm in its tracks. Undo a move and find a safer path.',
  },
  pit: {
    title: 'Down the burrow!',
    description: 'The path gave way beneath the worm. Undo a move and choose another turn.',
  },
  tail: {
    title: 'Tail chomp!',
    description: 'The worm doubled back and bit its own tail. Undo a move and try a wider loop.',
  },
  bird: {
    title: 'A swooping hawk!',
    description: 'A forest hawk crossed the trail. Undo a move and wait for a clear opening.',
  },
  beetle: {
    title: 'Eaten by the beetle!',
    description: 'A hungry jungle beetle made a meal of the worm. Undo a move or steer around it.',
  },
}

function playMoveFeedback(
  event: MoveEvent,
  previous: GameState,
  next: GameState,
  soundEnabled: boolean,
  hapticsEnabled: boolean,
) {
  if (event === 'failed') {
    playGameSound('failure', soundEnabled)
    triggerHaptic([30, 30, 50], hapticsEnabled)
    return
  }
  if (event === 'completed') {
    playGameSound('portal', soundEnabled)
    playGameSound('complete', soundEnabled)
    triggerHaptic([18, 40, 22, 40, 36], hapticsEnabled)
    return
  }
  if (event === 'apple') {
    const apple = previous.remainingApples.find(
      ({ x, y }) => x === next.worm[0].x && y === next.worm[0].y,
    )
    playAppleComboSound(next.combo ?? 1, apple?.type === 'golden', soundEnabled)
    triggerHaptic([12, 24, 14], hapticsEnabled)
    return
  }
  if (event === 'rescue') {
    playGameSound('rescue', soundEnabled)
    triggerHaptic([14, 24, 18], hapticsEnabled)
    return
  }
  if (event === 'key') {
    playGameSound('key', soundEnabled)
    triggerHaptic(14, hapticsEnabled)
    return
  }
  if (event === 'teleport') {
    playGameSound('teleport', soundEnabled)
    triggerHaptic([10, 20, 14], hapticsEnabled)
    return
  }
  if (event === 'ice') {
    playGameSound('ice', soundEnabled)
    triggerHaptic(10, hapticsEnabled)
    return
  }
  if (event === 'moved' || event === 'incomplete-portal') {
    playGameSound('move', soundEnabled)
    triggerHaptic(6, hapticsEnabled)
  }
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
  const [game, setGame] = useState<GameState>(
    initialActiveGame?.state ?? createInitialState(LEVELS[0]),
  )
  const [history, setHistory] = useState<GameState[]>(initialActiveGame?.history ?? [])
  const [serverSessionId, setServerSessionId] = useState<string | null>(
    initialActiveGame?.sessionId ?? null,
  )
  const [profile, setProfile] = useState<PlayerProfile | null>(initialProfile)
  const [completedLevels, setCompletedLevels] = useState(initialCompletedLevels)
  const [levelStats, setLevelStats] = useState(initialLevelStats)
  const [rewardHistory, setRewardHistory] = useState(initialRewardHistory)
  const [guestUnlockedThrough, setGuestUnlockedThrough] = useState(1)
  const [guestApplesCollected, setGuestApplesCollected] = useState(0)
  const [guestNoUndoClears, setGuestNoUndoClears] = useState(0)
  const [guestBirdsRescued, setGuestBirdsRescued] = useState(0)
  const [completion, setCompletion] = useState<CompletionSummary | null>(null)
  const [revealedStars, setRevealedStars] = useState(0)
  const [showPathReveal, setShowPathReveal] = useState(false)
  const [lastMoveEvent, setLastMoveEvent] = useState<MoveEvent | null>(null)
  const [justUndid, setJustUndid] = useState(false)
  const [justReset, setJustReset] = useState(false)
  const [hintDirection, setHintDirection] = useState<Direction | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [signOutPending, setSignOutPending] = useState(false)
  const [audioPreferences, setAudioPreferences] = useState<PlayerSettings>(
    initialProfile?.settings ?? {
      soundEnabled: true,
      musicEnabled: true,
      leaderboardOptIn: false,
      safeHint: false,
      hapticsEnabled: true,
    },
  )

  const busyRef = useRef(false)
  const stopMusicRef = useRef<(() => void) | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const level = LEVELS[activeLevelId - 1]
  const unlockedThrough = Math.max(guestUnlockedThrough, profile?.currentLevel ?? 1)
  const isFinished = game.status === 'completed'
  const isFailed = game.status === 'failed'
  const movementDisabled = isBusy || isFinished || isFailed

  const normalDone = countNormalCollected(level, game)
  const goldenDone = countGoldenCollected(level, game)
  const totalGolden = level.apples.filter((a) => a.type === 'golden').length
  const birdsDone = game.rescuedBirds?.length ?? 0
  const remainingApples = Math.max(0, level.requiredApples - normalDone)
  const remainingBirds = Math.max(0, level.requiredBirds - birdsDone)
  const portalOpen = isPortalReady(level, game)
  const starThresholds = getStarThresholds(level)
  const failureStory = isFailed && game.failureCause ? failureStories[game.failureCause] : null

  useEffect(() => {
    return () => {
      stopMusicRef.current?.()
      stopMusicRef.current = null
    }
  }, [])

  // Animated 1 -> 2 -> 3 star reveal with sound cues on level clear
  useEffect(() => {
    if (!isFinished || !completion) {
      setRevealedStars(0)
      return
    }
    setRevealedStars(0)
    const timers: number[] = []
    for (let s = 1; s <= completion.stars; s += 1) {
      const t = window.setTimeout(() => {
        setRevealedStars(s)
        const cue = s === 1 ? 'star1' : s === 2 ? 'star2' : 'star3'
        playGameSound(cue, audioPreferences.soundEnabled)
      }, s * 220)
      timers.push(t)
    }
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [isFinished, completion, audioPreferences.soundEnabled])

  const handleMove = useCallback(
    async (direction: Direction) => {
      if (isBusy || busyRef.current || game.status === 'failed' || game.status === 'completed') {
        return
      }
      busyRef.current = true
      setIsBusy(true)
      setHintDirection(null)
      setNotice('')
      if (audioPreferences.musicEnabled && !stopMusicRef.current) {
        stopMusicRef.current = startAmbientMusic()
      }

      const hapticsOn = audioPreferences.hapticsEnabled !== false

      try {
        if (user) {
          let sessionId = serverSessionId
          if (!sessionId) {
            const started = await startGameAction(activeLevelId)
            sessionId = started.sessionId
            setServerSessionId(sessionId)
          }
          const result = await moveGameAction(sessionId, direction)
          setLastMoveEvent(result.event)
          playMoveFeedback(result.event, game, result.state, audioPreferences.soundEnabled, hapticsOn)
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
            setShowPathReveal(false)
            setProfile(summary.profile)
            setCompletedLevels((current) => ({
              ...current,
              [activeLevelId]: Math.max(current[activeLevelId] ?? 0, summary.stars),
            }))
            setLevelStats((current) => ({
              ...current,
              [activeLevelId]: {
                score: Math.max(current[activeLevelId]?.score ?? 0, summary.score),
                bestMoves:
                  current[activeLevelId]?.bestMoves == null
                    ? result.state.moves
                    : Math.min(current[activeLevelId].bestMoves, result.state.moves),
                noUndoClear: Boolean(
                  current[activeLevelId]?.noUndoClear || summary.noUndo,
                ),
              },
            }))
            if (summary.rewardCoins > 0) {
              setRewardHistory((current) =>
                [
                  {
                    id: `confirmed-${activeLevelId}-${result.state.moves}`,
                    type: 'LEVEL_REWARD',
                    amount: summary.rewardCoins,
                    source: 'LEVEL_COMPLETION',
                    status: 'GRANTED',
                    createdAt: new Date().toISOString(),
                  },
                  ...current,
                ].slice(0, 12),
              )
              playGameSound('coin', audioPreferences.soundEnabled)
            }
          }
        } else {
          const result = moveGame(level, game, direction)
          setLastMoveEvent(result.event)
          playMoveFeedback(result.event, game, result.state, audioPreferences.soundEnabled, hapticsOn)
          if (
            [
              'moved',
              'apple',
              'key',
              'teleport',
              'ice',
              'rescue',
              'incomplete-portal',
              'completed',
            ].includes(result.event)
          ) {
            setHistory((current) => [...current, game].slice(-60))
          }
          if (result.event === 'apple') {
            setGuestApplesCollected((c) => c + 1)
          }
          if (result.event === 'rescue') {
            setGuestBirdsRescued((c) => c + 1)
          }
          setGame(result.state)

          if (result.event === 'completed') {
            const stars = calculateStars(level, result.state)
            const noUndo = !result.state.usedUndo
            setCompletion({
              stars,
              rewardCoins: 0,
              firstCompletion: false,
              score: result.state.score,
            })
            setShowPathReveal(false)
            if (noUndo && !levelStats[activeLevelId]?.noUndoClear) {
              setGuestNoUndoClears((c) => c + 1)
            }
            setCompletedLevels((current) => ({
              ...current,
              [activeLevelId]: Math.max(current[activeLevelId] ?? 0, stars),
            }))
            setLevelStats((current) => ({
              ...current,
              [activeLevelId]: {
                score: Math.max(current[activeLevelId]?.score ?? 0, result.state.score),
                bestMoves:
                  current[activeLevelId]?.bestMoves == null
                    ? result.state.moves
                    : Math.min(current[activeLevelId].bestMoves, result.state.moves),
                noUndoClear: Boolean(current[activeLevelId]?.noUndoClear || noUndo),
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
    },
    [activeLevelId, audioPreferences, game, isBusy, level, levelStats, serverSessionId, user],
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
      }
      if (event.isComposing || event.keyCode === 229) return
      const directions: Record<string, Direction> = {
        ArrowUp: 'up',
        w: 'up',
        W: 'up',
        ArrowRight: 'right',
        d: 'right',
        D: 'right',
        ArrowDown: 'down',
        s: 'down',
        S: 'down',
        ArrowLeft: 'left',
        a: 'left',
        A: 'left',
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
    setShowPathReveal(false)
    setLastMoveEvent(null)
    setHintDirection(null)
    setNotice('')
    setActiveView('adventure')
  }

  async function handleUndo() {
    if (isBusy || busyRef.current) return
    setHintDirection(null)
    setJustUndid(true)
    window.setTimeout(() => setJustUndid(false), 260)
    playGameSound('undo', audioPreferences.soundEnabled)
    triggerHaptic(10, audioPreferences.hapticsEnabled !== false)

    if (user && serverSessionId) {
      busyRef.current = true
      setIsBusy(true)
      try {
        const result = await undoGameAction(serverSessionId)
        setGame(result.state)
        setHistory(result.history)
        setLastMoveEvent('moved')
      } catch {
        setNotice('That step could not be undone. Try restarting the level.')
      } finally {
        busyRef.current = false
        setIsBusy(false)
      }
      return
    }

    if (isFailed && !history.length) {
      setGame((current) => ({
        ...current,
        status: 'playing',
        failureCause: null,
        usedUndo: true,
        feedback: 'Last move undone.',
      }))
      return
    }

    const previous = history.at(-1)
    if (previous) {
      setGame({ ...previous, usedUndo: true, feedback: 'Step undone.' })
      setHistory((current) => current.slice(0, -1))
    }
  }

  function restartLevel() {
    if (serverSessionId && user) void abandonGameAction(serverSessionId).catch(() => undefined)
    setJustReset(true)
    window.setTimeout(() => setJustReset(false), 260)
    playGameSound('toggle', audioPreferences.soundEnabled)
    setGame(createInitialState(level))
    setHistory([])
    setServerSessionId(null)
    setCompletion(null)
    setShowPathReveal(false)
    setLastMoveEvent(null)
    setHintDirection(null)
    setNotice('')
  }

  function showHint() {
    const mode = audioPreferences.safeHint ? 'safe' : 'optimal'
    const direction = findHintDirection(level, game, mode)
    playGameSound('hint', audioPreferences.soundEnabled)
    setHintDirection(direction)
    setNotice(
      direction
        ? `${mode === 'safe' ? 'Safe 1★ hint' : '3★ shortcut hint'}: try heading ${direction}.`
        : 'No clear path from here. Undo a move or restart this trail.',
    )
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
    void handleMove(
      Math.abs(deltaX) > Math.abs(deltaY)
        ? deltaX > 0
          ? 'right'
          : 'left'
        : deltaY > 0
          ? 'down'
          : 'up',
    )
  }

  function changeAudioPreferences(next: PlayerSettings) {
    setAudioPreferences(next)
    if (next.musicEnabled && !stopMusicRef.current) stopMusicRef.current = startAmbientMusic()
    if (!next.musicEnabled) {
      stopMusicRef.current?.()
      stopMusicRef.current = null
    }
    playGameSound('toggle', next.soundEnabled)
    if (user) {
      void updatePlayerSettingsAction(next).catch(() => {
        setNotice('Your preferences changed for this visit but could not be saved to your account.')
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

  // Bird companion mood & reactive toast message
  let birdMood: BirdMood = 'idle'
  let birdMessage = level.tutorialHint ?? level.challengeText
  if (isFailed) {
    birdMood = 'worry'
    birdMessage = 'Hmm, try another way… undo a step or take a breather!'
  } else if (isFinished && completion) {
    birdMood = 'cheer'
    birdMessage =
      completion.stars === 3
        ? '3★ Trail Master! You found the sharpest shortcut!'
        : `You found a ${completion.stars}★ route — can you find the 3★ one?`
  } else if (lastMoveEvent === 'blocked') {
    birdMood = 'worry'
    birdMessage = game.feedback || 'That tile is sealed right now — check for a key or apples!'
  } else if (lastMoveEvent === 'rescue') {
    birdMood = 'cheer'
    birdMessage = 'Chirp! Another woodland friend is free!'
  } else if (lastMoveEvent === 'apple') {
    birdMood = 'happy'
    birdMessage =
      (game.combo ?? 0) > 1
        ? `Nice move! ${game.combo}x apple streak!`
        : 'Tasty! Keep an eye out for the shortest bend.'
  } else if (lastMoveEvent === 'teleport') {
    birdMood = 'happy'
    birdMessage = 'Whoosh! Right through the paired rune stone!'
  } else if (lastMoveEvent === 'key') {
    birdMood = 'happy'
    birdMessage = 'Key collected! The matching gate just swung open.'
  } else if (level.moveLimit - game.moves <= 3 && game.status === 'playing') {
    birdMood = 'worry'
    birdMessage = `Only ${level.moveLimit - game.moves} moves left — make every turn count!`
  }

  const threeStarLevels = Object.values(completedLevels).filter((s) => s === 3).length
  const perfectChapters = [0, 1, 2, 3, 4].filter((worldIdx) =>
    LEVELS.slice(worldIdx * 10, worldIdx * 10 + 10).every(
      (lvl) => (completedLevels[lvl.id] ?? 0) === 3,
    ),
  ).length

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
          <span className="brand-mark">
            <Apple aria-hidden="true" />
            <Leaf className="brand-leaf" aria-hidden="true" />
          </span>
          <span className="brand-copy">
            <strong>{gameName}</strong>
            <span>Follow the apple trail</span>
          </span>
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
            <div className="coin-balance" aria-label={`${profile.coins} acorns`}>
              <Coins aria-hidden="true" />
              <strong>{profile.coins.toLocaleString()}</strong>
              <span>acorns</span>
            </div>
          ) : (
            <Link className="top-signin-link" href="/sign-in">
              Sign in
            </Link>
          )}
          {user ? (
            <>
              <span className="avatar-chip" aria-label={`Signed in as ${user.name}`}>
                {user.name.trim().slice(0, 1).toUpperCase()}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="signout-button"
                aria-label="Sign out"
                disabled={signOutPending}
                onClick={handleSignOut}
              >
                <LogOut aria-hidden="true" />
              </Button>
            </>
          ) : (
            <Link
              href="/sign-up"
              className="create-account-link"
              aria-label="Create an account to save progress"
            >
              <UserRound aria-hidden="true" />
              <span>Save progress</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </header>

      <main className="page-content">
        <section className="page-intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">Jungle puzzle adventure</p>
            <h1 id="page-title">{displayViewHeading[activeView]}</h1>
            <p className="page-subtitle">
              Guide the worm through carved timber trails, unlock gates, glide across frost, rescue
              songbirds, and discover the 3★ shortcut to the moonlit portal.
            </p>
          </div>
          <div className="journey-progress">
            <span className="journey-icon">
              <Leaf aria-hidden="true" />
            </span>
            <div>
              <span>Your journey</span>
              <strong>
                Level {String(Math.min(unlockedThrough, 50)).padStart(2, '0')}{' '}
                <small>of 50</small>
              </strong>
            </div>
            <div
              className="journey-progress-track"
              aria-label={`${Math.min(unlockedThrough, 50)} of 50 levels unlocked`}
            >
              <span
                style={{
                  width: `${Math.max(2, Math.min(100, (unlockedThrough / 50) * 100))}%`,
                }}
              />
            </div>
          </div>
        </section>

        {activeView === 'adventure' && (
          <div className="adventure-layout">
            <section className="play-column" aria-labelledby="level-heading">
              <div className="level-heading-row">
                <div className="level-number-block">
                  <span>{String(level.id).padStart(2, '0')}</span>
                </div>
                <div className="level-title-copy">
                  <p className="level-world">
                    {level.world} <span aria-hidden="true">·</span>{' '}
                    {level.difficulty.charAt(0) + level.difficulty.slice(1).toLowerCase()}
                  </p>
                  <h2 id="level-heading">{level.name}</h2>
                  <p className="level-challenge-line">
                    <Target aria-hidden="true" /> {level.challengeText}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="change-level-button"
                  onClick={() => setActiveView('levels')}
                >
                  All levels <ChevronRight data-icon="inline-end" aria-hidden="true" />
                </Button>
              </div>

              <article className="game-card" aria-label={`${levelHeading(level)} gameplay`}>
                <div className="game-card-header">
                  <div className="objective-display">
                    <span className="objective-label">Objective</span>
                    <div className="objective-metrics">
                      <strong>
                        <Apple aria-hidden="true" /> {normalDone}{' '}
                        <span>/ {level.requiredApples} apples</span>
                      </strong>
                      {totalGolden > 0 && (
                        <span className="objective-bonus-metric">
                          <Sparkles aria-hidden="true" /> {goldenDone}/{totalGolden} golden
                        </span>
                      )}
                      {level.requiredBirds > 0 && (
                        <span className="objective-bonus-metric">
                          <Bird aria-hidden="true" /> {birdsDone}/{level.requiredBirds} birds
                        </span>
                      )}
                      <span
                        className={`portal-status-text ${portalOpen ? 'portal-status-open' : 'portal-status-sealed'}`}
                      >
                        {portalOpen ? (
                          <LockOpen aria-hidden="true" />
                        ) : (
                          <LockKeyhole aria-hidden="true" />
                        )}
                        {portalOpen
                          ? 'Portal open'
                          : `${remainingApples + remainingBirds} left to unlock`}
                      </span>
                    </div>
                  </div>
                  <div className="quick-stats">
                    <div className="quick-stat">
                      <Footprints aria-hidden="true" />
                      <span>Moves</span>
                      <strong>
                        {game.moves}
                        <small>/{level.moveLimit}</small>
                      </strong>
                    </div>
                    <div className="quick-stat">
                      <Target aria-hidden="true" />
                      <span>3★ Par</span>
                      <strong>≤{starThresholds.threeStars}</strong>
                    </div>
                    <div className="quick-stat">
                      <Star aria-hidden="true" />
                      <span>Score</span>
                      <strong>{game.score}</strong>
                    </div>
                  </div>
                </div>

                {level.tutorialHint && game.moves < 4 && !isFinished && !isFailed && (
                  <p className="level-tutorial-banner" role="note">
                    <Sparkles aria-hidden="true" /> {level.tutorialHint}
                  </p>
                )}

                {notice && (
                  <p className="game-notice" role="status">
                    {notice}
                  </p>
                )}
                {game.feedback && !isFinished && !isFailed && (
                  <p className="game-feedback" role="status">
                    {game.feedback}
                  </p>
                )}

                <GameBoard
                  level={level}
                  state={game}
                  hintDirection={hintDirection}
                  showPathReveal={isFinished && showPathReveal}
                  justUndid={justUndid}
                  justReset={justReset}
                  onMove={handleMove}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  resultOverlay={
                    (isFailed || (isFinished && completion)) && (
                      <section
                        className={`board-result-overlay ${isFailed ? 'board-result-failed' : 'board-result-complete'} ${showPathReveal && isFinished ? 'board-result-compact' : ''}`}
                        role="region"
                        aria-live="polite"
                        aria-labelledby="board-result-title"
                      >
                        {!showPathReveal && (
                          <span className="board-result-emblem">
                            <Sparkles aria-hidden="true" />
                          </span>
                        )}
                        {isFinished && completion && (
                          <div
                            className="result-stars"
                            aria-label={`${completion.stars} out of 3 stars`}
                          >
                            {Array.from({ length: 3 }, (_, index) => (
                              <Star
                                key={index}
                                className={
                                  index < revealedStars
                                    ? 'star-earned star-pop-reveal'
                                    : ''
                                }
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                        )}
                        <h3 id="board-result-title">
                          {isFailed
                            ? failureStory?.title ?? 'Trail interrupted!'
                            : completion?.stars === 3
                              ? '3★ Shortcut mastered!'
                              : 'Maze cleared!'}
                        </h3>
                        {!showPathReveal && (
                          <p>
                            {isFailed
                              ? failureStory?.description ??
                                game.feedback ??
                                'Undo a step or give this maze another try.'
                              : completion && completion.stars < 3
                                ? `You found ${completion.stars}★ route — can you find the 3★ one?`
                                : level.id < unlockedThrough
                                  ? 'Brilliant trail-finding. Ready for the next puzzle?'
                                  : 'You reached the end of the trail!'}
                          </p>
                        )}
                        {isFinished && completion && (
                          <span className="board-result-moves">
                            {game.moves} {game.moves === 1 ? 'move' : 'moves'} ·{' '}
                            {completion.stars === 3
                              ? '3★ optimal route'
                              : completion.stars === 2
                                ? '2★ scenic route'
                                : '1★ safe route'}
                          </span>
                        )}
                        {isFinished && completion && !showPathReveal && (
                          <span className="board-result-reward">
                            {completion.rewardCoins > 0
                              ? `+${completion.rewardCoins} acorns earned`
                              : `${game.score.toLocaleString()} trail points`}
                          </span>
                        )}
                        {!user && isFinished && !showPathReveal && (
                          <Link href="/sign-up" className="board-result-save-link">
                            Save this run <ArrowUpRight aria-hidden="true" />
                          </Link>
                        )}
                        <div className="board-result-actions">
                          {isFailed ? (
                            <>
                              {history.length > 0 && (
                                <Button size="sm" variant="outline" onClick={handleUndo}>
                                  <Undo2 data-icon="inline-start" aria-hidden="true" /> Undo step
                                </Button>
                              )}
                              <Button size="sm" onClick={restartLevel}>
                                <RotateCcw data-icon="inline-start" aria-hidden="true" /> Try again
                              </Button>
                            </>
                          ) : (
                            <>
                              {level.id < unlockedThrough ? (
                                <Button size="sm" onClick={() => selectLevel(level.id + 1)}>
                                  Next maze <ChevronRight data-icon="inline-end" aria-hidden="true" />
                                </Button>
                              ) : (
                                <Button size="sm" onClick={() => setActiveView('levels')}>
                                  Choose a maze <ChevronRight data-icon="inline-end" aria-hidden="true" />
                                </Button>
                              )}
                              <Button size="sm" variant="outline" onClick={restartLevel}>
                                <RotateCcw data-icon="inline-start" aria-hidden="true" />{' '}
                                {completion && completion.stars < 3 ? 'Retry for 3★' : 'Replay'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowPathReveal((v) => !v)}
                              >
                                {showPathReveal ? (
                                  <>
                                    <EyeOff data-icon="inline-start" aria-hidden="true" /> Hide path
                                  </>
                                ) : (
                                  <>
                                    <Eye data-icon="inline-start" aria-hidden="true" /> Compare 3★ path
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </section>
                    )
                  }
                />

                <div className="board-progress-row">
                  <div
                    className="apple-progress-track"
                    aria-label={`${normalDone} of ${level.requiredApples} required apples collected`}
                  >
                    {Array.from({ length: level.requiredApples }, (_, index) => (
                      <span
                        key={index}
                        className={index < normalDone ? 'apple-progress-filled' : ''}
                      >
                        <Apple aria-hidden="true" />
                      </span>
                    ))}
                  </div>
                  <span>
                    {portalOpen
                      ? 'Portal open — head to the exit!'
                      : remainingApples > 0
                        ? `${remainingApples} ${remainingApples === 1 ? 'apple' : 'apples'} to go`
                        : `${remainingBirds} ${remainingBirds === 1 ? 'bird' : 'birds'} to rescue`}
                  </span>
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
              <BirdCompanion mood={birdMood} message={birdMessage} />

              <section className="sidebar-card trail-card">
                <div className="sidebar-card-heading">
                  <span className="sidebar-icon sidebar-icon-green">
                    <Map aria-hidden="true" />
                  </span>
                  <span className="card-kicker">Your trail</span>
                </div>
                <h3>Two routes, one grove.</h3>
                <p>
                  Every trail has a clever 3★ shortcut and a safer 1★ route. Collect required
                  apples{level.requiredBirds > 0 ? ', free trapped birds,' : ''} and reach the
                  portal.
                </p>
                <ol className="trail-steps">
                  <li
                    className={
                      normalDone >= level.requiredApples ? 'trail-step-done' : 'trail-step-active'
                    }
                  >
                    <span className="step-marker">
                      {normalDone >= level.requiredApples ? <Check aria-hidden="true" /> : '1'}
                    </span>
                    <span>
                      <strong>Collect red apples</strong>
                      <small>
                        {normalDone}/{level.requiredApples} collected
                      </small>
                    </span>
                  </li>
                  {level.requiredBirds > 0 && (
                    <li
                      className={
                        birdsDone >= level.requiredBirds
                          ? 'trail-step-done'
                          : normalDone >= level.requiredApples
                            ? 'trail-step-active'
                            : ''
                      }
                    >
                      <span className="step-marker">
                        {birdsDone >= level.requiredBirds ? <Check aria-hidden="true" /> : '2'}
                      </span>
                      <span>
                        <strong>Rescue caged birds</strong>
                        <small>
                          {birdsDone}/{level.requiredBirds} freed
                        </small>
                      </span>
                    </li>
                  )}
                  <li className={portalOpen ? 'trail-step-active' : ''}>
                    <span className="step-marker">{level.requiredBirds > 0 ? '3' : '2'}</span>
                    <span>
                      <strong>Reach the portal</strong>
                      <small>{totalGolden > 0 ? 'Grab golden apples for 3★' : 'Beat par moves for 3★'}</small>
                    </span>
                  </li>
                </ol>
                <div className="trail-divider" />
                <div className="tile-legend" aria-label="Board markers and hazards">
                  <span>
                    <i className="legend-walkable legend-route-a" aria-hidden="true">
                      A
                    </i>{' '}
                    3★ trail
                  </span>
                  <span>
                    <i className="legend-alternate legend-route-b" aria-hidden="true">
                      B
                    </i>{' '}
                    Safe trail
                  </span>
                  <span>
                    <i className="legend-wall">
                      <span />
                    </i>{' '}
                    Timber wall
                  </span>
                  <span>
                    <i className="legend-apple">
                      <Apple aria-hidden="true" />
                    </i>{' '}
                    Apple
                  </span>
                  <span>
                    <i className="legend-golden">
                      <Sparkles aria-hidden="true" />
                    </i>{' '}
                    Golden
                  </span>
                  <span>
                    <i className="legend-portal">
                      <Sparkles aria-hidden="true" />
                    </i>{' '}
                    Portal
                  </span>
                  <span>
                    <i className="legend-key">
                      <KeyRound aria-hidden="true" />
                    </i>{' '}
                    Key / Gate
                  </span>
                  <span>
                    <i className="legend-ice">
                      <Snowflake aria-hidden="true" />
                    </i>{' '}
                    Frost slide
                  </span>
                  <span>
                    <i className="legend-fragile">
                      <span />
                    </i>{' '}
                    Fragile plank
                  </span>
                  <span>
                    <i className="legend-bird-rescue">
                      <Bird aria-hidden="true" />
                    </i>{' '}
                    Caged bird
                  </span>
                  <span>
                    <i className="legend-spike">
                      <span />
                    </i>{' '}
                    Thorns
                  </span>
                  <span>
                    <i className="legend-beetle">
                      <Bug aria-hidden="true" />
                    </i>{' '}
                    Beetle
                  </span>
                </div>
                <section className="star-rating-guide" aria-label="Star ratings based on moves">
                  <p className="star-rating-heading">
                    <Star aria-hidden="true" /> Earn stars by route
                  </p>
                  <div className="star-rating-row">
                    <span>
                      <Star aria-hidden="true" /> 3 stars
                    </span>
                    <strong>
                      ≤ {starThresholds.threeStars} moves
                      {starThresholds.minGoldenApples > 0
                        ? ` + ${starThresholds.minGoldenApples} golden`
                        : ''}
                    </strong>
                  </div>
                  <div className="star-rating-row">
                    <span>
                      <Star aria-hidden="true" /> 2 stars
                    </span>
                    <strong>
                      ≤ {starThresholds.twoStars} moves
                      {starThresholds.minGoldenApples > 0 ? ' or golden clear' : ''}
                    </strong>
                  </div>
                  <div className="star-rating-row">
                    <span>
                      <Star aria-hidden="true" /> 1 star
                    </span>
                    <strong>{starThresholds.twoStars + 1}+ moves</strong>
                  </div>
                </section>
              </section>

              <section className="sidebar-card economy-card">
                <div className="sidebar-card-heading">
                  <span className="sidebar-icon sidebar-icon-gold">
                    <Coins aria-hidden="true" />
                  </span>
                  <span className="card-kicker">Grove wallet</span>
                </div>
                {profile ? (
                  <>
                    <div className="wallet-total">
                      <strong>{profile.coins.toLocaleString()}</strong>
                      <span>acorns</span>
                    </div>
                    <p>Earn {economyConfig.levelCompletionCoins} acorns the first time you finish a level.</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="sidebar-link-button"
                      onClick={() => setActiveView('rewards')}
                    >
                      See reward rules <ChevronRight data-icon="inline-end" aria-hidden="true" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="wallet-total wallet-guest">
                      <strong>Keep your progress</strong>
                    </div>
                    <p>Sign in to save your scores, stars, and acorns across visits.</p>
                    <Link href="/sign-up" className="sidebar-inline-link">
                      Create a free account <ArrowUpRight aria-hidden="true" />
                    </Link>
                  </>
                )}
              </section>

              <p className="session-note">
                <ShieldCheck aria-hidden="true" />{' '}
                {user
                  ? 'Your moves and rewards are saved securely.'
                  : 'Guest progress is temporary and stays in memory only.'}
              </p>
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
        {activeView === 'rewards' && (
          <RewardsView
            config={economyConfig ?? DEFAULT_ECONOMY_CONFIG}
            coins={profile?.coins ?? null}
            signedIn={Boolean(user)}
            adsAvailable={adsAvailable}
            history={rewardHistory}
          />
        )}
        {activeView === 'achievements' && (
          <AchievementsView
            applesCollected={profile?.applesCollected ?? guestApplesCollected}
            completedLevels={Object.keys(completedLevels).length}
            totalStars={
              profile?.totalStars ??
              Object.values(completedLevels).reduce((sum, stars) => sum + stars, 0)
            }
            coins={profile?.coins ?? 0}
            threeStarLevels={threeStarLevels}
            perfectChapters={perfectChapters}
            noUndoClears={Math.max(profile?.noUndoClears ?? 0, guestNoUndoClears)}
            birdsRescued={Math.max(profile?.birdsRescued ?? 0, guestBirdsRescued)}
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
          <span>
            <Apple aria-hidden="true" /> {gameName}
          </span>
          <span>Made for curious little adventurers.</span>
          <Link href="/sign-in">
            Account help <ArrowUpRight aria-hidden="true" />
          </Link>
        </footer>
      </main>
    </div>
  )
}
