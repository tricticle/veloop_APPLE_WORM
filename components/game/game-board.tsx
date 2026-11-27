import {
  Apple,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bird,
  Bug,
  CircleDashed,
  KeyRound,
  LockKeyhole,
  LockOpen,
  Snowflake,
  Sparkles,
  Triangle,
} from 'lucide-react'
import type { CSSProperties, ReactNode, TouchEventHandler } from 'react'
import {
  coordKey,
  getDirectionBetween,
  getForestBugPosition,
  getObstaclePositionAtTurn,
  isGateUnlocked,
  isPortalReady,
  isTimedSpikeActive,
  type Direction,
  type GameState,
} from '@/lib/game/engine'
import type { Coordinate, GameLevel } from '@/lib/game/types'

type GameBoardProps = {
  level: GameLevel
  state: GameState
  hintDirection?: Direction | null
  showPathReveal?: boolean
  justUndid?: boolean
  justReset?: boolean
  onMove?: (direction: Direction) => void
  onTouchStart?: TouchEventHandler<HTMLDivElement>
  onTouchEnd?: TouchEventHandler<HTMLDivElement>
  resultOverlay?: ReactNode
}

const hintArrows: Record<Direction, typeof ArrowUp> = {
  up: ArrowUp,
  right: ArrowRight,
  down: ArrowDown,
  left: ArrowLeft,
}

function splitContiguousPaths(points: Coordinate[]): string[] {
  if (!points.length) return []
  const chunks: Coordinate[][] = [[points[0]]]
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const curr = points[i]
    const manhattan = Math.abs(prev.x - curr.x) + Math.abs(prev.y - curr.y)
    if (manhattan > 1) {
      chunks.push([curr])
    } else {
      chunks[chunks.length - 1].push(curr)
    }
  }
  return chunks
    .filter((chunk) => chunk.length > 1)
    .map((chunk) => chunk.map(({ x, y }) => `${x + 0.5},${y + 0.5}`).join(' '))
}

export function GameBoard({
  level,
  state,
  hintDirection = null,
  showPathReveal = false,
  justUndid = false,
  justReset = false,
  onMove,
  onTouchStart,
  onTouchEnd,
  resultOverlay,
}: GameBoardProps) {
  const wormPositions = new Map(state.worm.map((segment, index) => [coordKey(segment), index]))
  const applePositions = new Map(level.apples.map((apple) => [coordKey(apple), apple]))
  const wallPositions = new Set(
    level.obstacles.filter((obstacle) => obstacle.type === 'wall').map(coordKey),
  )
  const crackedSet = new Set(state.crackedTiles ?? [])
  const collapsedSet = new Set(state.collapsedTiles ?? [])
  const collectedKeySet = new Set(state.collectedKeys ?? [])
  const rescuedBirdSet = new Set(state.rescuedBirds ?? [])

  const obstaclePositions = new Map<string, GameLevel['obstacles'][number]>()
  const nextBirdPositions = new Set<string>()

  for (const obstacle of level.obstacles) {
    const currentPos = getObstaclePositionAtTurn(obstacle, state.moves)
    obstaclePositions.set(coordKey(currentPos), obstacle)
    if (obstacle.type === 'moving' && obstacle.path && obstacle.path.length > 1) {
      const nextPos = getObstaclePositionAtTurn(obstacle, state.moves + 1)
      if (nextPos.x !== currentPos.x || nextPos.y !== currentPos.y) {
        nextBirdPositions.add(coordKey(nextPos))
      }
    }
  }

  const remainingApplePositions = new Set(state.remainingApples.map(coordKey))
  const bestRoutePositions = new Set(level.solutionPath.map(coordKey))
  const alternateRoutePositions = new Set(level.alternatePath.map(coordKey))
  const beetlePosition = getForestBugPosition(level)

  const portalReady = isPortalReady(level, state)
  const remainingNormalApples = state.remainingApples.filter((a) => a.type === 'normal').length
  const remainingBirds = Math.max(0, level.requiredBirds - rescuedBirdSet.size)
  const remainingToUnlock = remainingNormalApples + remainingBirds

  const head = state.worm[0]
  const neck = state.worm[1]
  const rawHeadDir = neck ? getDirectionBetween(neck, head) : 'right'
  const headDirection: Direction = rawHeadDir ?? 'right'

  const isFailed = state.status === 'failed'
  const isCompleted = state.status === 'completed'
  const isNearApple =
    !isFailed &&
    !isCompleted &&
    state.remainingApples.some(
      (apple) => Math.abs(apple.x - head.x) + Math.abs(apple.y - head.y) === 1,
    )

  const isNearDanger =
    !isFailed &&
    !isCompleted &&
    !isNearApple &&
    ([
      { x: head.x + 1, y: head.y },
      { x: head.x - 1, y: head.y },
      { x: head.x, y: head.y + 1 },
      { x: head.x, y: head.y - 1 },
    ].some((adj) => {
      const key = coordKey(adj)
      if (collapsedSet.has(key)) return true
      if (beetlePosition && beetlePosition.x === adj.x && beetlePosition.y === adj.y) return true
      const obs = obstaclePositions.get(key)
      if (!obs) return false
      if (obs.type === 'pit' || obs.type === 'moving') return true
      if (obs.type === 'spike' && isTimedSpikeActive(obs, state.moves + 1)) return true
      return false
    }) ||
      nextBirdPositions.has(coordKey(head)))

  const wormContiguousPolylines = splitContiguousPaths(state.worm)
  const bodyGradientId = `worm-body-grad-${level.id}`
  const headGradientId = `worm-head-grad-${level.id}`
  const tailGradientId = `worm-tail-grad-${level.id}`

  const bodySegments = state.worm.slice(1, -1).map((segment, index) => {
    const wormIndex = index + 1
    const prev = state.worm[wormIndex - 1]
    const next = state.worm[wormIndex + 1]
    const isBreak =
      Math.abs(prev.x - segment.x) + Math.abs(prev.y - segment.y) > 1 ||
      Math.abs(next.x - segment.x) + Math.abs(next.y - segment.y) > 1
    const dx = isBreak ? 1 : prev.x - next.x
    const dy = isBreak ? 0 : prev.y - next.y
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const progress = state.worm.length > 2 ? wormIndex / (state.worm.length - 1) : 0.5
    const radius = 0.285 - progress * 0.06
    return {
      key: `${segment.x},${segment.y},${wormIndex}`,
      cx: segment.x + 0.5,
      cy: segment.y + 0.5,
      angle,
      radius,
      pulseDelay: `${-wormIndex * 0.09}s`,
    }
  })

  const tail = state.worm.length > 1 ? state.worm[state.worm.length - 1] : null
  const beforeTail = state.worm.length > 1 ? state.worm[state.worm.length - 2] : null
  const tailJump =
    tail && beforeTail
      ? Math.abs(tail.x - beforeTail.x) + Math.abs(tail.y - beforeTail.y) > 1
      : false
  const tailAngle =
    tail && beforeTail && !tailJump
      ? (Math.atan2(tail.y - beforeTail.y, tail.x - beforeTail.x) * 180) / Math.PI
      : 0

  const hx = head.x + 0.5
  const hy = head.y + 0.5
  const ateRecently = Boolean(state.lastComboPoints && state.lastComboPoints > 0)

  const isWallAt = (cx: number, cy: number) =>
    cx < 0 ||
    cx >= level.grid.columns ||
    cy < 0 ||
    cy >= level.grid.rows ||
    wallPositions.has(`${cx},${cy}`)

  const optimalRevealPolylines = showPathReveal ? splitContiguousPaths(level.solutionPath) : []
  const playerRevealPolylines =
    showPathReveal && state.routeTaken?.length ? splitContiguousPaths(state.routeTaken) : []

  return (
    <div
      className={`board-frame ${justUndid ? 'board-rewind' : ''} ${justReset ? 'board-reset-pulse' : ''}`}
    >
      {/* Subtle ambient falling leaves / fireflies */}
      <div className="grove-ambient-particles" aria-hidden="true">
        <span className="grove-leaf-mote mote-1" />
        <span className="grove-leaf-mote mote-2" />
        <span className="grove-leaf-mote mote-3" />
        <span className="grove-firefly mote-4" />
        <span className="grove-firefly mote-5" />
      </div>

      {/* Confetti / leaf celebration burst on completion */}
      {isCompleted && (
        <div className="board-confetti-burst" aria-hidden="true">
          {Array.from({ length: 12 }, (_, idx) => (
            <span key={idx} className={`confetti-piece confetti-${idx % 4}`} />
          ))}
        </div>
      )}

      <div
        className={`game-board ${isFailed ? `game-board-failed game-board-failed-${state.failureCause ?? 'unknown'}` : ''} ${isCompleted ? 'game-board-completed' : ''}`}
        role="grid"
        aria-label={`Level ${String(level.id).padStart(2, '0')} game board, ${level.grid.columns} columns by ${level.grid.rows} rows`}
        style={{ gridTemplateColumns: `repeat(${level.grid.columns}, minmax(0, 1fr))` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {Array.from({ length: level.grid.rows * level.grid.columns }, (_, index) => {
          const x = index % level.grid.columns
          const y = Math.floor(index / level.grid.columns)
          const key = `${x},${y}`
          const wormIndex = wormPositions.get(key)
          const apple = applePositions.get(key)
          const obstacle = obstaclePositions.get(key)
          const isHead = wormIndex === 0
          const isWorm = wormIndex !== undefined
          const isPortal = level.portal.x === x && level.portal.y === y
          const isBestRoute = bestRoutePositions.has(key)
          const isAlternateRoute = alternateRoutePositions.has(key) && !isBestRoute
          const hasApple = remainingApplePositions.has(key)
          const hasBeetle = Boolean(beetlePosition && beetlePosition.x === x && beetlePosition.y === y)
          const isBirdNextTarget = nextBirdPositions.has(key)
          const adjacentDir = getDirectionBetween(head, { x, y })
          const canClickMove = Boolean(
            adjacentDir &&
              onMove &&
              !isFailed &&
              !isCompleted &&
              obstacle?.type !== 'wall',
          )
          const isHintTile = Boolean(hintDirection && adjacentDir === hintDirection)
          const HintIcon = isHintTile && hintDirection ? hintArrows[hintDirection] : null
          const PreviewIcon = adjacentDir ? hintArrows[adjacentDir] : null

          const gateUnlocked =
            obstacle?.type === 'gate' ? isGateUnlocked(level, state, obstacle) : false
          const keyCollected =
            obstacle?.type === 'key' && obstacle.keyId
              ? collectedKeySet.has(obstacle.keyId)
              : false
          const birdRescued =
            obstacle?.type === 'trappedBird' && obstacle.birdId
              ? rescuedBirdSet.has(obstacle.birdId)
              : false
          const isFragileCracked = obstacle?.type === 'fragile' && crackedSet.has(key)
          const isFragileCollapsed = obstacle?.type === 'fragile' && collapsedSet.has(key)
          const timedSpikeNextActive =
            obstacle?.type === 'spike' ? isTimedSpikeActive(obstacle, state.moves + 1) : false
          const isTimedSpike = obstacle?.type === 'spike' && Boolean(obstacle.period && obstacle.period > 1)

          let wallCornerStyle: CSSProperties | undefined
          if (obstacle?.type === 'wall') {
            const top = isWallAt(x, y - 1)
            const right = isWallAt(x + 1, y)
            const bottom = isWallAt(x, y + 1)
            const left = isWallAt(x - 1, y)
            const r = '9px'
            wallCornerStyle = {
              borderTopLeftRadius: !top && !left ? r : '2px',
              borderTopRightRadius: !top && !right ? r : '2px',
              borderBottomRightRadius: !bottom && !right ? r : '2px',
              borderBottomLeftRadius: !bottom && !left ? r : '2px',
            }
          }

          return (
            <div
              key={key}
              role="gridcell"
              aria-rowindex={y + 1}
              aria-colindex={x + 1}
              style={wallCornerStyle}
              onClick={() => {
                if (canClickMove && adjacentDir) onMove?.(adjacentDir)
              }}
              aria-label={[
                `Row ${y + 1}, column ${x + 1}`,
                !obstacle ? 'walkable trail' : '',
                isBestRoute ? 'optimal trail' : isAlternateRoute ? 'detour trail' : '',
                isHead ? 'snake head' : isWorm ? 'snake body' : '',
                hasApple ? `${apple?.type ?? 'normal'} apple` : '',
                isPortal ? (portalReady ? 'open exit portal' : 'sealed exit portal') : '',
                obstacle?.type === 'moving'
                  ? 'swooping hawk hazard'
                  : obstacle?.type === 'wall'
                    ? 'wooden maze wall'
                    : obstacle?.type === 'gate'
                      ? gateUnlocked
                        ? 'open gate'
                        : 'locked gate'
                      : obstacle?.type === 'key' && !keyCollected
                        ? `${obstacle.color ?? 'amber'} key`
                        : obstacle?.type === 'teleport'
                          ? 'paired warp stone'
                          : obstacle?.type === 'ice'
                            ? 'frost slide tile'
                            : obstacle?.type === 'fragile'
                              ? isFragileCollapsed
                                ? 'collapsed plank hollow'
                                : isFragileCracked
                                  ? 'cracked fragile plank'
                                  : 'fragile plank bridge'
                              : obstacle?.type === 'trappedBird'
                                ? birdRescued
                                  ? 'freed bird nest'
                                  : 'caged bird friend, step here to rescue'
                                : obstacle?.type === 'spike'
                                  ? isTimedSpike
                                    ? timedSpikeNextActive
                                      ? 'active pulsing bramble'
                                      : 'retracted pulsing bramble'
                                    : 'bramble spike'
                                  : obstacle?.type
                                    ? `${obstacle.type} obstacle`
                                    : '',
                hasBeetle ? 'beetle hazard, avoid touching' : '',
              ]
                .filter(Boolean)
                .join(', ')}
              className={[
                'game-tile',
                (x + y) % 2 === 0 ? 'tile-even' : 'tile-odd',
                obstacle ? `tile-obstacle tile-${obstacle.type}` : 'tile-walkable',
                obstacle?.type === 'gate' && gateUnlocked ? 'tile-gate-open' : '',
                obstacle?.type === 'gate' && obstacle.color ? `tile-gate-${obstacle.color}` : '',
                obstacle?.type === 'key' && keyCollected ? 'tile-key-collected' : '',
                obstacle?.type === 'spike' && isTimedSpike && !timedSpikeNextActive
                  ? 'tile-spike-dormant'
                  : '',
                isFragileCracked ? 'tile-fragile-cracked' : '',
                isFragileCollapsed ? 'tile-fragile-collapsed' : '',
                obstacle?.type === 'trappedBird' && birdRescued ? 'tile-bird-freed' : '',
                isBestRoute ? 'tile-best-route' : '',
                isAlternateRoute ? 'tile-alternate-route' : '',
                isWorm ? (isHead ? 'tile-worm-head' : 'tile-worm-body') : '',
                isPortal
                  ? portalReady
                    ? 'tile-portal tile-portal-ready'
                    : 'tile-portal tile-portal-sealed'
                  : '',
                hasApple ? 'tile-apple' : '',
                hasBeetle ? 'tile-beetle' : '',
                isBirdNextTarget ? 'tile-bird-target' : '',
                canClickMove ? 'tile-clickable-step' : '',
                isHintTile ? 'tile-hint-target' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {hasApple && apple && (
                <span
                  className={`apple-token ${apple.type === 'golden' ? 'apple-golden' : ''}`}
                  aria-hidden="true"
                >
                  <Apple />
                  {apple.type === 'golden' && <Sparkles className="apple-sparkle" />}
                </span>
              )}

              {isPortal && (
                <span
                  className={`portal-token ${portalReady ? 'portal-ready' : 'portal-sealed'}`}
                  aria-hidden="true"
                >
                  <CircleDashed />
                  <span className="portal-core" />
                  {!portalReady && remainingToUnlock > 0 && (
                    <span className="portal-lock-count">{remainingToUnlock}</span>
                  )}
                </span>
              )}

              {obstacle?.type === 'wall' && <span className="maze-wall-grain" aria-hidden="true" />}

              {obstacle?.type === 'ice' && (
                <span className="ice-tile-surface" aria-hidden="true">
                  <Snowflake className="ice-flake-icon" />
                </span>
              )}

              {obstacle?.type === 'fragile' && (
                <span
                  className={`fragile-plank ${isFragileCollapsed ? 'fragile-collapsed' : isFragileCracked ? 'fragile-cracked' : ''}`}
                  aria-hidden="true"
                />
              )}

              {obstacle?.type === 'teleport' && (
                <span
                  className={`teleport-pad ${obstacle.pairId === 'warp-2' ? 'teleport-pad-b' : 'teleport-pad-a'}`}
                  aria-hidden="true"
                >
                  <CircleDashed className="teleport-ring" />
                  <span className="teleport-label">
                    {obstacle.pairId === 'warp-2' ? 'B' : 'A'}
                  </span>
                </span>
              )}

              {obstacle?.type === 'key' && !keyCollected && (
                <span className={`key-token key-${obstacle.color ?? 'amber'}`} aria-hidden="true">
                  <KeyRound />
                </span>
              )}

              {obstacle?.type === 'trappedBird' && (
                <span
                  className={`caged-bird-token ${birdRescued ? 'caged-bird-freed' : ''}`}
                  aria-hidden="true"
                >
                  <Bird className="caged-bird-icon" />
                  {!birdRescued && <span className="bird-cage-bars" />}
                </span>
              )}

              {obstacle?.type === 'spike' && (
                <span
                  className={`spike-cluster ${isTimedSpike && !timedSpikeNextActive ? 'spike-retracted' : ''}`}
                  aria-hidden="true"
                >
                  <Triangle className="obstacle-icon obstacle-spike-icon" />
                  {isTimedSpike && <span className="spike-pulse-dot" />}
                </span>
              )}

              {obstacle?.type === 'pit' && <span className="pit-token" aria-hidden="true" />}

              {obstacle?.type === 'gate' &&
                (gateUnlocked ? (
                  <span className="gate-open-token" aria-hidden="true">
                    <LockOpen className="obstacle-icon obstacle-gate-open-icon" />
                  </span>
                ) : (
                  <span
                    className={`gate-locked-token ${obstacle.color ? `gate-locked-${obstacle.color}` : ''}`}
                    aria-hidden="true"
                  >
                    <LockKeyhole className="obstacle-icon obstacle-gate-icon" />
                  </span>
                ))}

              {obstacle?.type === 'moving' && (
                <span className="bird-token" aria-hidden="true">
                  <Bird className="obstacle-icon obstacle-moving-icon" />
                </span>
              )}

              {isBirdNextTarget && !obstacle && (
                <span
                  className="bird-next-marker"
                  aria-hidden="true"
                  title="Bird swoops here next move"
                />
              )}

              {hasBeetle && (
                <span className="beetle-token" aria-hidden="true">
                  <Bug className="wildlife-beetle" />
                </span>
              )}

              {canClickMove && !isHintTile && PreviewIcon && (
                <span className="board-step-preview" aria-hidden="true">
                  <PreviewIcon />
                </span>
              )}

              {HintIcon && (
                <span className="board-hint-marker" aria-hidden="true">
                  <HintIcon />
                </span>
              )}
            </div>
          )
        })}

        {/* Unified Pixel-Aligned SVG Snake / Worm + Post-Clear Ghost Path Layer */}
        <svg
          className={`worm-path-overlay ${isFailed && state.failureCause === 'tail' ? 'worm-path-tail-bitten' : ''}`}
          aria-hidden="true"
          viewBox={`0 0 ${level.grid.columns} ${level.grid.rows}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={bodyGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#94f164" />
              <stop offset="50%" stopColor="#3eb843" />
              <stop offset="100%" stopColor="#1b7e39" />
            </linearGradient>
            <linearGradient id={headGradientId} x1="20%" y1="10%" x2="80%" y2="90%">
              <stop offset="0%" stopColor="#b8f773" />
              <stop offset="52%" stopColor="#4ec449" />
              <stop offset="100%" stopColor="#21833a" />
            </linearGradient>
            <linearGradient id={tailGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2fa03c" />
              <stop offset="65%" stopColor="#65cb4f" />
              <stop offset="100%" stopColor="#cbf578" />
            </linearGradient>
          </defs>

          {/* Post-clear Ghost Path Reveal Overlay */}
          {showPathReveal && (
            <g className="ghost-path-reveal">
              {playerRevealPolylines.map((pts, idx) => (
                <polyline key={`player-${idx}`} className="ghost-player-trail" points={pts} />
              ))}
              {optimalRevealPolylines.map((pts, idx) => (
                <polyline key={`opt-${idx}`} className="ghost-optimal-trail" points={pts} />
              ))}
            </g>
          )}

          {/* Tapered rounded tail with trailing wiggle + chartreuse tip highlight */}
          {tail && (
            <g transform={`translate(${tail.x + 0.5}, ${tail.y + 0.5}) rotate(${tailAngle})`}>
              <g className="worm-tail-wiggle">
                <path
                  d="M -0.1 -0.24 C 0.1 -0.22 0.29 -0.11 0.35 0 C 0.29 0.11 0.1 0.22 -0.1 0.24 Z"
                  fill={`url(#${tailGradientId})`}
                  stroke="#0e4520"
                  strokeWidth="0.05"
                  strokeLinejoin="round"
                />
                <circle cx="0.24" cy="0" r="0.055" fill="#e6ffa8" opacity="0.88" />
              </g>
            </g>
          )}

          {/* Continuous body path(s), cleanly split across teleport jumps */}
          {wormContiguousPolylines.map((points, idx) => (
            <g key={`worm-seg-${idx}`}>
              <polyline className="worm-path-shadow" points={points} />
              <polyline
                className="worm-path-body"
                points={points}
                stroke={`url(#${bodyGradientId})`}
              />
              <polyline className="worm-path-shine" points={points} />
            </g>
          ))}

          {/* Articulated dorsal segments */}
          {bodySegments.map(({ key, cx, cy, angle, radius, pulseDelay }) => (
            <g
              key={key}
              className="worm-body-segment"
              style={{ animationDelay: pulseDelay }}
              transform={`translate(${cx}, ${cy}) rotate(${angle})`}
            >
              <circle
                cx="0"
                cy="0"
                r={radius}
                fill={`url(#${bodyGradientId})`}
                stroke="#134c24"
                strokeWidth="0.045"
              />
              <path
                d={`M ${-radius * 0.15} ${-radius * 0.65} Q ${radius * 0.35} 0 ${-radius * 0.15} ${radius * 0.65}`}
                fill="none"
                stroke="rgba(218, 255, 174, 0.78)"
                strokeWidth="0.055"
                strokeLinecap="round"
              />
              <circle
                cx={-radius * 0.15}
                cy={-radius * 0.42}
                r="0.042"
                fill="rgba(247, 255, 224, 0.88)"
              />
            </g>
          ))}

          {/* Expressive, never-upside-down SVG Head with squash/stretch & growth pop */}
          <g
            key={`head-${state.moves}-${state.worm.length}`}
            className={`worm-svg-head ${ateRecently ? 'worm-head-ate-pop' : 'worm-head-move-squash'}`}
            style={{ transformOrigin: `${hx}px ${hy}px` }}
          >
            {headDirection === 'up' || headDirection === 'down' ? (
              <g transform={`translate(${hx}, ${hy}) ${headDirection === 'down' ? 'scale(1, -1)' : ''}`}>
                {!isFailed && (
                  <path
                    className="worm-tongue"
                    d="M 0 -0.37 L 0 -0.49 M 0 -0.49 L -0.05 -0.54 M 0 -0.49 L 0.05 -0.54"
                    fill="none"
                    stroke="#eb5f52"
                    strokeWidth="0.036"
                    strokeLinecap="round"
                  />
                )}
                <ellipse
                  cx="0"
                  cy="0"
                  rx="0.34"
                  ry="0.37"
                  fill={`url(#${headGradientId})`}
                  stroke="#124a23"
                  strokeWidth="0.055"
                />
                <ellipse
                  cx="-0.09"
                  cy="-0.14"
                  rx="0.11"
                  ry="0.055"
                  fill="rgba(240, 255, 206, 0.55)"
                />
                {isFailed ? (
                  <>
                    <path
                      d="M -0.19 -0.14 L -0.09 -0.04 M -0.09 -0.14 L -0.19 -0.04"
                      stroke="#133d20"
                      strokeWidth="0.042"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 0.09 -0.14 L 0.19 -0.04 M 0.19 -0.14 L 0.09 -0.04"
                      stroke="#133d20"
                      strokeWidth="0.042"
                      strokeLinecap="round"
                    />
                  </>
                ) : isCompleted ? (
                  <>
                    <path
                      d="M -0.2 -0.08 Q -0.14 -0.17 -0.07 -0.08"
                      fill="none"
                      stroke="#133d20"
                      strokeWidth="0.042"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 0.07 -0.08 Q 0.14 -0.17 0.2 -0.08"
                      fill="none"
                      stroke="#133d20"
                      strokeWidth="0.042"
                      strokeLinecap="round"
                    />
                  </>
                ) : (
                  <g className="worm-eye-blink">
                    <circle
                      cx="-0.14"
                      cy="-0.1"
                      r={isNearApple || isNearDanger ? 0.106 : 0.092}
                      fill="#fffdf3"
                      stroke="#144925"
                      strokeWidth="0.03"
                    />
                    <circle
                      cx="0.14"
                      cy="-0.1"
                      r={isNearApple || isNearDanger ? 0.106 : 0.092}
                      fill="#fffdf3"
                      stroke="#144925"
                      strokeWidth="0.03"
                    />
                    <circle
                      cx="-0.14"
                      cy="-0.12"
                      r={isNearDanger ? 0.035 : 0.048}
                      fill="#143a21"
                    />
                    <circle
                      cx="0.14"
                      cy="-0.12"
                      r={isNearDanger ? 0.035 : 0.048}
                      fill="#143a21"
                    />
                    <circle cx="-0.155" cy="-0.14" r="0.018" fill="#ffffff" />
                    <circle cx="0.125" cy="-0.14" r="0.018" fill="#ffffff" />
                  </g>
                )}
                <circle cx="-0.22" cy="0.06" r="0.05" fill="rgba(255, 130, 102, 0.58)" />
                <circle cx="0.22" cy="0.06" r="0.05" fill="rgba(255, 130, 102, 0.58)" />
                {isFailed || isNearDanger ? (
                  <path
                    d="M -0.09 0.14 Q 0 0.07 0.09 0.14"
                    fill="none"
                    stroke="#133d20"
                    strokeWidth="0.04"
                    strokeLinecap="round"
                  />
                ) : isNearApple ? (
                  <ellipse
                    cx="0"
                    cy="0.1"
                    rx="0.075"
                    ry="0.06"
                    fill="#9c2c24"
                    stroke="#133d20"
                    strokeWidth="0.028"
                  />
                ) : (
                  <path
                    d="M -0.09 0.09 Q 0 0.16 0.09 0.09"
                    fill="none"
                    stroke="#133d20"
                    strokeWidth="0.038"
                    strokeLinecap="round"
                  />
                )}
              </g>
            ) : (
              <g transform={`translate(${hx}, ${hy}) ${headDirection === 'left' ? 'scale(-1, 1)' : ''}`}>
                {!isFailed && (
                  <path
                    className="worm-tongue"
                    d="M 0.36 0.03 L 0.48 0.03 M 0.48 0.03 L 0.53 -0.02 M 0.48 0.03 L 0.53 0.08"
                    fill="none"
                    stroke="#eb5f52"
                    strokeWidth="0.036"
                    strokeLinecap="round"
                  />
                )}
                <ellipse
                  cx="0.02"
                  cy="0"
                  rx="0.37"
                  ry="0.34"
                  fill={`url(#${headGradientId})`}
                  stroke="#124a23"
                  strokeWidth="0.055"
                />
                <ellipse
                  cx="-0.06"
                  cy="-0.17"
                  rx="0.13"
                  ry="0.052"
                  fill="rgba(240, 255, 206, 0.58)"
                />
                {isFailed ? (
                  <>
                    <path
                      d="M -0.09 -0.15 L 0.01 -0.05 M 0.01 -0.15 L -0.09 -0.05"
                      stroke="#133d20"
                      strokeWidth="0.042"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 0.13 -0.15 L 0.23 -0.05 M 0.23 -0.15 L 0.13 -0.05"
                      stroke="#133d20"
                      strokeWidth="0.042"
                      strokeLinecap="round"
                    />
                  </>
                ) : isCompleted ? (
                  <>
                    <path
                      d="M -0.08 -0.08 Q -0.01 -0.16 0.05 -0.08"
                      fill="none"
                      stroke="#133d20"
                      strokeWidth="0.042"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 0.11 -0.08 Q 0.17 -0.16 0.24 -0.08"
                      fill="none"
                      stroke="#133d20"
                      strokeWidth="0.042"
                      strokeLinecap="round"
                    />
                  </>
                ) : (
                  <g className="worm-eye-blink">
                    <circle
                      cx="-0.03"
                      cy="-0.1"
                      r={isNearApple || isNearDanger ? 0.106 : 0.092}
                      fill="#fffdf3"
                      stroke="#144925"
                      strokeWidth="0.03"
                    />
                    <circle
                      cx="0.17"
                      cy="-0.09"
                      r={isNearApple || isNearDanger ? 0.103 : 0.088}
                      fill="#fffdf3"
                      stroke="#144925"
                      strokeWidth="0.03"
                    />
                    <circle
                      cx="-0.005"
                      cy="-0.1"
                      r={isNearDanger ? 0.035 : 0.048}
                      fill="#143a21"
                    />
                    <circle
                      cx="0.195"
                      cy="-0.09"
                      r={isNearDanger ? 0.035 : 0.046}
                      fill="#143a21"
                    />
                    <circle cx="-0.02" cy="-0.125" r="0.018" fill="#ffffff" />
                    <circle cx="0.18" cy="-0.115" r="0.018" fill="#ffffff" />
                  </g>
                )}
                <circle cx="-0.11" cy="0.09" r="0.055" fill="rgba(255, 130, 102, 0.58)" />
                {isFailed || isNearDanger ? (
                  <path
                    d="M 0.05 0.15 Q 0.14 0.08 0.23 0.15"
                    fill="none"
                    stroke="#133d20"
                    strokeWidth="0.04"
                    strokeLinecap="round"
                  />
                ) : isNearApple ? (
                  <ellipse
                    cx="0.16"
                    cy="0.11"
                    rx="0.075"
                    ry="0.06"
                    fill="#9c2c24"
                    stroke="#133d20"
                    strokeWidth="0.028"
                  />
                ) : (
                  <path
                    d="M 0.05 0.1 Q 0.15 0.17 0.24 0.09"
                    fill="none"
                    stroke="#133d20"
                    strokeWidth="0.038"
                    strokeLinecap="round"
                  />
                )}
              </g>
            )}
          </g>
        </svg>

        {/* Floating Apple Combo / Streak Score Popup */}
        {state.lastComboPoints && state.lastComboPoints > 0 && (
          <div
            key={`popup-${state.moves}`}
            className="board-score-popup"
            style={{
              left: `${((head.x + 0.5) / level.grid.columns) * 100}%`,
              top: `${((head.y + 0.15) / level.grid.rows) * 100}%`,
            }}
            aria-hidden="true"
          >
            +{state.lastComboPoints}
            {state.combo && state.combo > 1 ? ` · ${state.combo}x` : ''}
          </div>
        )}
      </div>
      {resultOverlay}
    </div>
  )
}
