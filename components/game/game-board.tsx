import { Apple, Bird, Bug, CircleDashed, LockKeyhole, Sparkles, Triangle } from 'lucide-react'
import type { ReactNode, TouchEventHandler } from 'react'
import type { GameState } from '@/lib/game/engine'
import { getForestBugPosition, type GameLevel } from '@/lib/game/levels'

type GameBoardProps = {
  level: GameLevel
  state: GameState
  onTouchStart?: TouchEventHandler<HTMLDivElement>
  onTouchEnd?: TouchEventHandler<HTMLDivElement>
  resultOverlay?: ReactNode
}

export function GameBoard({ level, state, onTouchStart, onTouchEnd, resultOverlay }: GameBoardProps) {
  const wormPositions = new Map(state.worm.map((segment, index) => [`${segment.x},${segment.y}`, index]))
  const applePositions = new Map(level.apples.map((apple) => [`${apple.x},${apple.y}`, apple]))
  const obstaclePositions = new Map<string, GameLevel['obstacles'][number]>(level.obstacles.map((obstacle) => {
    const position = obstacle.type === 'moving' && obstacle.path?.length
      ? obstacle.path[state.moves % obstacle.path.length]
      : obstacle
    return [`${position.x},${position.y}`, obstacle] as const
  }))
  const remainingApplePositions = new Set(state.remainingApples.map((apple) => `${apple.x},${apple.y}`))
  const bestRoutePositions = new Set(level.solutionPath.map(({ x, y }) => `${x},${y}`))
  const alternateRoutePositions = new Set(level.alternatePath.map(({ x, y }) => `${x},${y}`))
  const beetlePosition = getForestBugPosition(level)
  const wormPath = state.worm.map(({ x, y }) => `${x + 0.5},${y + 0.5}`).join(' ')
  const wormBodySegments = state.worm.slice(1).map((segment, index) => {
    const wormIndex = index + 1
    const headSide = state.worm[wormIndex - 1]
    const tailSide = state.worm[wormIndex + 1] ?? segment
    const horizontal = Math.abs(tailSide.x - headSide.x) >= Math.abs(tailSide.y - headSide.y)
    const x = segment.x + 0.5
    const y = segment.y + 0.5
    const stripe = horizontal
      ? `M ${x} ${y - 0.2} L ${x} ${y + 0.2}`
      : `M ${x - 0.2} ${y} L ${x + 0.2} ${y}`
    return {
      key: `${segment.x},${segment.y},${wormIndex}`,
      x,
      y,
      stripe,
      isTail: wormIndex === state.worm.length - 1,
      pulseDelay: `${-wormIndex * 0.08}s`,
    }
  })
  const head = state.worm[0]
  const neck = state.worm[1]
  const headDirection = !neck || head.x > neck.x ? 'right' : head.x < neck.x ? 'left' : head.y > neck.y ? 'down' : 'up'

  return (
    <div className="board-frame">
      <div
        className={`game-board ${state.status === 'failed' ? `game-board-failed game-board-failed-${state.failureCause ?? 'unknown'}` : ''}`}
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

          return (
            <div
              key={key}
              role="gridcell"
              aria-rowindex={y + 1}
              aria-colindex={x + 1}
              aria-label={[
                `Row ${y + 1}, column ${x + 1}`,
                !obstacle ? 'walkable trail' : '',
                isBestRoute ? 'route A to the exit' : isAlternateRoute ? 'route B to the exit' : '',
                isHead ? 'worm head' : isWorm ? 'worm body' : '',
                hasApple ? `${apple?.type ?? 'normal'} apple` : '',
                isPortal ? 'exit portal' : '',
                obstacle?.type === 'moving' ? 'flying bird hazard' : obstacle?.type === 'wall' ? 'wooden maze wall' : obstacle?.type ? `${obstacle.type} obstacle` : '',
                hasBeetle ? 'beetle hazard, avoid touching' : '',
              ].filter(Boolean).join(', ')}
              className={`game-tile ${(x + y) % 2 === 0 ? 'tile-even' : 'tile-odd'} ${obstacle ? `tile-obstacle tile-${obstacle.type}` : 'tile-walkable'} ${isBestRoute ? 'tile-best-route' : ''} ${isAlternateRoute ? 'tile-alternate-route' : ''} ${isWorm ? isHead ? 'tile-worm-head' : 'tile-worm-body' : ''} ${isPortal ? 'tile-portal' : ''} ${hasApple ? 'tile-apple' : ''}`}
            >
              {isHead && (
                <span className={`worm-face worm-face-${headDirection} ${state.status === 'failed' ? 'worm-face-failed' : ''}`} aria-hidden="true">
                  <span className="worm-eye worm-eye-left" />
                  <span className="worm-eye worm-eye-right" />
                  <span className="worm-cheek" />
                  <span className="worm-smile" />
                </span>
              )}
              {hasApple && apple && (
                <span className={`apple-token ${apple.type === 'golden' ? 'apple-golden' : ''}`} aria-hidden="true">
                  <Apple />
                  {apple.type === 'golden' && <Sparkles className="apple-sparkle" />}
                </span>
              )}
              {isPortal && (
                <span className="portal-token" aria-hidden="true">
                  <CircleDashed />
                  <span className="portal-core" />
                </span>
              )}
              {obstacle?.type === 'wall' && <span className="maze-wall-grain" aria-hidden="true" />}
              {obstacle?.type === 'spike' && <Triangle className="obstacle-icon obstacle-spike-icon" aria-hidden="true" />}
              {obstacle?.type === 'pit' && <span className="pit-token" aria-hidden="true" />}
              {obstacle?.type === 'gate' && <LockKeyhole className="obstacle-icon obstacle-gate-icon" aria-hidden="true" />}
              {obstacle?.type === 'moving' && <Bird className="obstacle-icon obstacle-moving-icon" aria-hidden="true" />}
              {hasBeetle && <Bug className="wildlife-beetle" aria-hidden="true" />}
            </div>
          )
        })}
        {state.worm.length > 1 && (
          <svg
            className={`worm-path-overlay ${state.status === 'failed' && state.failureCause === 'tail' ? 'worm-path-tail-bitten' : ''}`}
            aria-hidden="true"
            viewBox={`0 0 ${level.grid.columns} ${level.grid.rows}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`worm-gradient-${level.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#82e55f" />
                <stop offset="48%" stopColor="#42b941" />
                <stop offset="100%" stopColor="#168238" />
              </linearGradient>
            </defs>
            <polyline className="worm-path-shadow" points={wormPath} />
            <polyline className="worm-path-body" points={wormPath} style={{ stroke: `url(#worm-gradient-${level.id})` }} />
            <polyline className="worm-path-shine" points={wormPath} />
            {wormBodySegments.map(({ key, x, y, stripe, isTail, pulseDelay }) => (
              <g
                key={key}
                className={`worm-body-segment ${isTail ? 'worm-tail-segment' : ''}`}
                style={{ animationDelay: pulseDelay }}
              >
                <path className="worm-segment-stripe" d={stripe} />
              </g>
            ))}
          </svg>
        )}
      </div>
      {resultOverlay}
    </div>
  )
}
