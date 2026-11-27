import {
  Apple,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bird,
  Bug,
  CircleDashed,
  LockKeyhole,
  LockOpen,
  Sparkles,
  Triangle,
} from 'lucide-react'
import type { ReactNode, TouchEventHandler } from 'react'
import {
  getDirectionBetween,
  getObstaclePositionAtTurn,
  isGateUnlocked,
  isPortalReady,
  type Direction,
  type GameState,
} from '@/lib/game/engine'
import { getForestBugPosition, type GameLevel } from '@/lib/game/levels'

type GameBoardProps = {
  level: GameLevel
  state: GameState
  hintDirection?: Direction | null
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

export function GameBoard({
  level,
  state,
  hintDirection = null,
  onMove,
  onTouchStart,
  onTouchEnd,
  resultOverlay,
}: GameBoardProps) {
  const wormPositions = new Map(state.worm.map((segment, index) => [`${segment.x},${segment.y}`, index]))
  const applePositions = new Map(level.apples.map((apple) => [`${apple.x},${apple.y}`, apple]))
  const wallPositions = new Set(
    level.obstacles.filter((obstacle) => obstacle.type === 'wall').map(({ x, y }) => `${x},${y}`),
  )

  const obstaclePositions = new Map<string, GameLevel['obstacles'][number]>()
  const nextBirdPositions = new Set<string>()

  for (const obstacle of level.obstacles) {
    const currentPos = getObstaclePositionAtTurn(obstacle, state.moves)
    obstaclePositions.set(`${currentPos.x},${currentPos.y}`, obstacle)
    if (obstacle.type === 'moving' && obstacle.path && obstacle.path.length > 1) {
      const nextPos = getObstaclePositionAtTurn(obstacle, state.moves + 1)
      if (nextPos.x !== currentPos.x || nextPos.y !== currentPos.y) {
        nextBirdPositions.add(`${nextPos.x},${nextPos.y}`)
      }
    }
  }

  const remainingApplePositions = new Set(state.remainingApples.map((apple) => `${apple.x},${apple.y}`))
  const bestRoutePositions = new Set(level.solutionPath.map(({ x, y }) => `${x},${y}`))
  const alternateRoutePositions = new Set(level.alternatePath.map(({ x, y }) => `${x},${y}`))
  const beetlePosition = getForestBugPosition(level)

  const portalReady = isPortalReady(level, state)
  const gateUnlocked = isGateUnlocked(level, state.collectedApples)
  const remainingRequiredApples = Math.max(0, level.requiredApples - state.collectedApples)

  const head = state.worm[0]
  const neck = state.worm[1]
  const headDirection: Direction = !neck
    ? 'right'
    : head.x > neck.x
      ? 'right'
      : head.x < neck.x
        ? 'left'
        : head.y > neck.y
          ? 'down'
          : 'up'

  const isFailed = state.status === 'failed'
  const isCompleted = state.status === 'completed'
  const isNearApple =
    !isFailed &&
    !isCompleted &&
    state.remainingApples.some(
      (apple) => Math.abs(apple.x - head.x) + Math.abs(apple.y - head.y) === 1,
    )

  const wormPath = state.worm.map(({ x, y }) => `${x + 0.5},${y + 0.5}`).join(' ')
  const bodyGradientId = `worm-body-grad-${level.id}`
  const headGradientId = `worm-head-grad-${level.id}`
  const tailGradientId = `worm-tail-grad-${level.id}`

  // Intermediate body rings with local tangent orientation & gradual taper toward tail
  const bodySegments = state.worm.slice(1, -1).map((segment, index) => {
    const wormIndex = index + 1
    const prev = state.worm[wormIndex - 1]
    const next = state.worm[wormIndex + 1]
    const dx = prev.x - next.x
    const dy = prev.y - next.y
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI
    const progress = state.worm.length > 2 ? wormIndex / (state.worm.length - 1) : 0.5
    const radius = 0.285 - progress * 0.055
    return {
      key: `${segment.x},${segment.y},${wormIndex}`,
      cx: segment.x + 0.5,
      cy: segment.y + 0.5,
      angle,
      radius,
      pulseDelay: `${-wormIndex * 0.09}s`,
    }
  })

  // Tapered tail cap
  const tail = state.worm.length > 1 ? state.worm[state.worm.length - 1] : null
  const beforeTail = state.worm.length > 1 ? state.worm[state.worm.length - 2] : null
  const tailAngle =
    tail && beforeTail ? (Math.atan2(tail.y - beforeTail.y, tail.x - beforeTail.x) * 180) / Math.PI : 0

  const hx = head.x + 0.5
  const hy = head.y + 0.5

  const isWallAt = (cx: number, cy: number) =>
    cx < 0 || cx >= level.grid.columns || cy < 0 || cy >= level.grid.rows || wallPositions.has(`${cx},${cy}`)

  return (
    <div className="board-frame">
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

          // Compute organic wall corner rounding where wall borders walkable corridor
          let wallCornerStyle: React.CSSProperties | undefined
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
                isBestRoute ? 'main trail' : isAlternateRoute ? 'detour trail' : '',
                isHead ? 'snake head' : isWorm ? 'snake body' : '',
                hasApple ? `${apple?.type ?? 'normal'} apple` : '',
                isPortal ? (portalReady ? 'open exit portal' : 'sealed exit portal') : '',
                obstacle?.type === 'moving'
                  ? 'flying bird hazard'
                  : obstacle?.type === 'wall'
                    ? 'wooden maze wall'
                    : obstacle?.type === 'gate'
                      ? gateUnlocked
                        ? 'open mossy gate'
                        : 'locked mossy gate'
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
                isBestRoute ? 'tile-best-route' : '',
                isAlternateRoute ? 'tile-alternate-route' : '',
                isWorm ? (isHead ? 'tile-worm-head' : 'tile-worm-body') : '',
                isPortal ? (portalReady ? 'tile-portal tile-portal-ready' : 'tile-portal tile-portal-sealed') : '',
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
                <span className={`apple-token ${apple.type === 'golden' ? 'apple-golden' : ''}`} aria-hidden="true">
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
                  {!portalReady && remainingRequiredApples > 0 && (
                    <span className="portal-lock-count">{remainingRequiredApples}</span>
                  )}
                </span>
              )}
              {obstacle?.type === 'wall' && <span className="maze-wall-grain" aria-hidden="true" />}
              {obstacle?.type === 'spike' && (
                <span className="spike-cluster" aria-hidden="true">
                  <Triangle className="obstacle-icon obstacle-spike-icon" />
                </span>
              )}
              {obstacle?.type === 'pit' && <span className="pit-token" aria-hidden="true" />}
              {obstacle?.type === 'gate' &&
                (gateUnlocked ? (
                  <span className="gate-open-token" aria-hidden="true">
                    <LockOpen className="obstacle-icon obstacle-gate-open-icon" />
                  </span>
                ) : (
                  <span className="gate-locked-token" aria-hidden="true">
                    <LockKeyhole className="obstacle-icon obstacle-gate-icon" />
                  </span>
                ))}
              {obstacle?.type === 'moving' && (
                <span className="bird-token" aria-hidden="true">
                  <Bird className="obstacle-icon obstacle-moving-icon" />
                </span>
              )}
              {isBirdNextTarget && !obstacle && (
                <span className="bird-next-marker" aria-hidden="true" title="Bird swoops here next move" />
              )}
              {hasBeetle && (
                <span className="beetle-token" aria-hidden="true">
                  <Bug className="wildlife-beetle" />
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

        {/* Unified Pixel-Aligned SVG Snake / Worm Layer */}
        <svg
          className={`worm-path-overlay ${isFailed && state.failureCause === 'tail' ? 'worm-path-tail-bitten' : ''}`}
          aria-hidden="true"
          viewBox={`0 0 ${level.grid.columns} ${level.grid.rows}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={bodyGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#89ed60" />
              <stop offset="50%" stopColor="#3eb843" />
              <stop offset="100%" stopColor="#1b7e39" />
            </linearGradient>
            <linearGradient id={headGradientId} x1="20%" y1="10%" x2="80%" y2="90%">
              <stop offset="0%" stopColor="#aaf36c" />
              <stop offset="52%" stopColor="#4ec449" />
              <stop offset="100%" stopColor="#21833a" />
            </linearGradient>
            <linearGradient id={tailGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#37aa40" />
              <stop offset="100%" stopColor="#177032" />
            </linearGradient>
          </defs>

          {/* Tapered tail tip */}
          {tail && (
            <g transform={`translate(${tail.x + 0.5}, ${tail.y + 0.5}) rotate(${tailAngle})`}>
              <path
                d="M -0.08 -0.24 Q 0.34 -0.16 0.38 0 Q 0.34 0.16 -0.08 0.24 Z"
                fill={`url(#${tailGradientId})`}
                stroke="#0e4520"
                strokeWidth="0.055"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* Continuous body path */}
          {state.worm.length > 1 && (
            <>
              <polyline className="worm-path-shadow" points={wormPath} />
              <polyline
                className="worm-path-body"
                points={wormPath}
                stroke={`url(#${bodyGradientId})`}
              />
              <polyline className="worm-path-shine" points={wormPath} />
            </>
          )}

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
              <circle cx={-radius * 0.15} cy={-radius * 0.42} r="0.042" fill="rgba(247, 255, 224, 0.88)" />
            </g>
          ))}

          {/* Expressive, never-upside-down SVG Head */}
          <g className="worm-svg-head">
            {headDirection === 'up' || headDirection === 'down' ? (
              <g transform={`translate(${hx}, ${hy}) ${headDirection === 'down' ? 'scale(1, -1)' : ''}`}>
                {/* Subtle animated tongue tip */}
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
                {/* Head shell */}
                <ellipse
                  cx="0"
                  cy="0"
                  rx="0.34"
                  ry="0.37"
                  fill={`url(#${headGradientId})`}
                  stroke="#124a23"
                  strokeWidth="0.055"
                />
                <ellipse cx="-0.09" cy="-0.14" rx="0.11" ry="0.055" fill="rgba(240, 255, 206, 0.55)" />
                {/* Eyes side by side (never upside down) */}
                {isFailed ? (
                  <>
                    <path d="M -0.19 -0.14 L -0.09 -0.04 M -0.09 -0.14 L -0.19 -0.04" stroke="#133d20" strokeWidth="0.042" strokeLinecap="round" />
                    <path d="M 0.09 -0.14 L 0.19 -0.04 M 0.19 -0.14 L 0.09 -0.04" stroke="#133d20" strokeWidth="0.042" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <circle cx="-0.14" cy="-0.1" r={isNearApple ? 0.105 : 0.092} fill="#fffdf3" stroke="#144925" strokeWidth="0.03" />
                    <circle cx="0.14" cy="-0.1" r={isNearApple ? 0.105 : 0.092} fill="#fffdf3" stroke="#144925" strokeWidth="0.03" />
                    <circle cx="-0.14" cy="-0.12" r="0.048" fill="#143a21" />
                    <circle cx="0.14" cy="-0.12" r="0.048" fill="#143a21" />
                    <circle cx="-0.155" cy="-0.14" r="0.018" fill="#ffffff" />
                    <circle cx="0.125" cy="-0.14" r="0.018" fill="#ffffff" />
                  </>
                )}
                {/* Rosy cheeks */}
                <circle cx="-0.22" cy="0.06" r="0.05" fill="rgba(255, 130, 102, 0.58)" />
                <circle cx="0.22" cy="0.06" r="0.05" fill="rgba(255, 130, 102, 0.58)" />
                {/* Mouth */}
                {isFailed ? (
                  <path d="M -0.09 0.14 Q 0 0.07 0.09 0.14" fill="none" stroke="#133d20" strokeWidth="0.04" strokeLinecap="round" />
                ) : isNearApple ? (
                  <ellipse cx="0" cy="0.1" rx="0.075" ry="0.06" fill="#9c2c24" stroke="#133d20" strokeWidth="0.028" />
                ) : (
                  <path d="M -0.09 0.09 Q 0 0.16 0.09 0.09" fill="none" stroke="#133d20" strokeWidth="0.038" strokeLinecap="round" />
                )}
              </g>
            ) : (
              <g transform={`translate(${hx}, ${hy}) ${headDirection === 'left' ? 'scale(-1, 1)' : ''}`}>
                {/* Tongue flicking forward */}
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
                {/* Head shell */}
                <ellipse
                  cx="0.02"
                  cy="0"
                  rx="0.37"
                  ry="0.34"
                  fill={`url(#${headGradientId})`}
                  stroke="#124a23"
                  strokeWidth="0.055"
                />
                <ellipse cx="-0.06" cy="-0.17" rx="0.13" ry="0.052" fill="rgba(240, 255, 206, 0.58)" />
                {/* Eyes always stay on top whether facing left or right */}
                {isFailed ? (
                  <>
                    <path d="M -0.09 -0.15 L 0.01 -0.05 M 0.01 -0.15 L -0.09 -0.05" stroke="#133d20" strokeWidth="0.042" strokeLinecap="round" />
                    <path d="M 0.13 -0.15 L 0.23 -0.05 M 0.23 -0.15 L 0.13 -0.05" stroke="#133d20" strokeWidth="0.042" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <circle cx="-0.03" cy="-0.1" r={isNearApple ? 0.105 : 0.092} fill="#fffdf3" stroke="#144925" strokeWidth="0.03" />
                    <circle cx="0.17" cy="-0.09" r={isNearApple ? 0.102 : 0.088} fill="#fffdf3" stroke="#144925" strokeWidth="0.03" />
                    <circle cx="-0.005" cy="-0.1" r="0.048" fill="#143a21" />
                    <circle cx="0.195" cy="-0.09" r="0.046" fill="#143a21" />
                    <circle cx="-0.02" cy="-0.125" r="0.018" fill="#ffffff" />
                    <circle cx="0.18" cy="-0.115" r="0.018" fill="#ffffff" />
                  </>
                )}
                {/* Rosy cheek */}
                <circle cx="-0.11" cy="0.09" r="0.055" fill="rgba(255, 130, 102, 0.58)" />
                {/* Mouth */}
                {isFailed ? (
                  <path d="M 0.05 0.15 Q 0.14 0.08 0.23 0.15" fill="none" stroke="#133d20" strokeWidth="0.04" strokeLinecap="round" />
                ) : isNearApple ? (
                  <ellipse cx="0.16" cy="0.11" rx="0.075" ry="0.06" fill="#9c2c24" stroke="#133d20" strokeWidth="0.028" />
                ) : (
                  <path d="M 0.05 0.1 Q 0.15 0.17 0.24 0.09" fill="none" stroke="#133d20" strokeWidth="0.038" strokeLinecap="round" />
                )}
              </g>
            )}
          </g>
        </svg>
      </div>
      {resultOverlay}
    </div>
  )
}
