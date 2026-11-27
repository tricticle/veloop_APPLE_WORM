import { Apple, Bird, Bug, CircleDashed, LockKeyhole, Sparkles, Triangle } from 'lucide-react'
import type { CSSProperties, ReactNode, TouchEventHandler } from 'react'
import type { GameState } from '@/lib/game/engine'
import { getForestBugPosition, type GameLevel } from '@/lib/game/levels'

type WormDirection = 'right' | 'left' | 'up' | 'down'

function createWormPath(worm: GameState['worm']) {
  const points = worm.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }))
  if (!points.length) return ''

  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const next = points[index + 1]
    const incomingX = previous.x - current.x
    const incomingY = previous.y - current.y
    const outgoingX = next.x - current.x
    const outgoingY = next.y - current.y
    const incomingLength = Math.hypot(incomingX, incomingY)
    const outgoingLength = Math.hypot(outgoingX, outgoingY)
    const turn = incomingX * outgoingY - incomingY * outgoingX

    if (turn === 0) {
      path += ` L ${current.x} ${current.y}`
      continue
    }

    const radius = Math.min(0.3, incomingLength / 2, outgoingLength / 2)
    const startX = current.x + (incomingX / incomingLength) * radius
    const startY = current.y + (incomingY / incomingLength) * radius
    const endX = current.x + (outgoingX / outgoingLength) * radius
    const endY = current.y + (outgoingY / outgoingLength) * radius

    path += ` L ${startX} ${startY} Q ${current.x} ${current.y} ${endX} ${endY}`
  }

  const tail = points[points.length - 1]
  const previous = points[points.length - 2] ?? tail
  const tailX = tail.x + (previous.x - tail.x) * 0.12
  const tailY = tail.y + (previous.y - tail.y) * 0.12

  return `${path} L ${tailX} ${tailY}`
}

function createWormGazeStyle(
  head: GameState['worm'][number],
  target: { x: number; y: number },
  direction: WormDirection,
): CSSProperties {
  const deltaX = target.x - head.x
  const deltaY = target.y - head.y
  const localX = direction === 'right' ? deltaX : direction === 'left' ? -deltaX : direction === 'down' ? deltaY : -deltaY
  const localY = direction === 'right' ? deltaY : direction === 'left' ? -deltaY : direction === 'down' ? -deltaX : deltaX
  const extent = Math.max(1, Math.abs(localX), Math.abs(localY))

  return {
    '--worm-gaze-x': `${(localX / extent) * 18}%`,
    '--worm-gaze-y': `${(localY / extent) * 18}%`,
  } as CSSProperties
}

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
  const wormPath = createWormPath(state.worm)
  const head = state.worm[0]
  const neck = state.worm[1]
  const headDirection: WormDirection = !neck || head.x > neck.x ? 'right' : head.x < neck.x ? 'left' : head.y > neck.y ? 'down' : 'up'
  const gazeTarget = state.remainingApples.reduce((target, apple, index) => {
    if (index === 0) return apple
    const appleDistance = Math.abs(apple.x - head.x) + Math.abs(apple.y - head.y)
    const targetDistance = Math.abs(target.x - head.x) + Math.abs(target.y - head.y)
    return appleDistance < targetDistance ? apple : target
  }, level.portal)
  const wormFaceStyle = createWormGazeStyle(head, gazeTarget, headDirection)

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
                <span className={`worm-face worm-face-${headDirection} ${state.status === 'failed' ? 'worm-face-failed' : ''}`} style={wormFaceStyle} aria-hidden="true">
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
            <path className="worm-path-shadow" d={wormPath} />
            <path className="worm-path-body" d={wormPath} />
            <path className="worm-path-shine" d={wormPath} />
          </svg>
        )}
      </div>
      {resultOverlay}
    </div>
  )
}
