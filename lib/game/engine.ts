import { getForestBugPosition, type Coordinate, type GameLevel } from './levels'

export type Direction = 'up' | 'right' | 'down' | 'left'
export type GameStatus = 'ready' | 'playing' | 'failed' | 'completed'
export type FailureCause = 'edge' | 'moves' | 'thorn' | 'pit' | 'tail' | 'bird' | 'beetle'
export type MoveEvent = 'moved' | 'apple' | 'blocked' | 'failed' | 'incomplete-portal' | 'completed'

export type GameState = {
  worm: Coordinate[]
  remainingApples: GameLevel['apples']
  collectedApples: number
  moves: number
  score: number
  status: GameStatus
  failureCause: FailureCause | null
  feedback: string
}

export type MoveResult = { state: GameState; event: MoveEvent }

export const DIRECTION_DELTAS: Record<Direction, Coordinate> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

export const DIRECTIONS = Object.keys(DIRECTION_DELTAS) as Direction[]

const samePosition = (first: Coordinate, second: Coordinate) => first.x === second.x && first.y === second.y

export function isGateUnlocked(level: GameLevel, collectedApples: number): boolean {
  return collectedApples >= level.requiredApples
}

export function isPortalReady(level: GameLevel, state: GameState): boolean {
  return state.collectedApples >= level.requiredApples && state.worm.length >= level.targetLength
}

export function getObstaclePositionAtTurn(obstacle: GameLevel['obstacles'][number], turn: number): Coordinate {
  if (obstacle.type === 'moving' && obstacle.path?.length) {
    return obstacle.path[turn % obstacle.path.length]
  }
  return obstacle
}

export function getDirectionBetween(from: Coordinate, to: Coordinate): Direction | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 1 && dy === 0) return 'right'
  if (dx === -1 && dy === 0) return 'left'
  if (dx === 0 && dy === 1) return 'down'
  if (dx === 0 && dy === -1) return 'up'
  return null
}

function failGame(state: GameState, failureCause: FailureCause, feedback: string): MoveResult {
  return { state: { ...state, status: 'failed', failureCause, feedback }, event: 'failed' }
}

export function createInitialState(level: GameLevel): GameState {
  return {
    worm: level.wormStart.map((point) => ({ ...point })),
    remainingApples: level.apples.map((apple) => ({ ...apple })),
    collectedApples: 0,
    moves: 0,
    score: 0,
    status: 'ready',
    failureCause: null,
    feedback: '',
  }
}

export function moveGame(level: GameLevel, state: GameState, direction: Direction): MoveResult {
  if (state.status === 'failed' || state.status === 'completed') return { state, event: 'blocked' }
  if (state.moves >= level.moveLimit) {
    return failGame(state, 'moves', 'No moves left. Undo a step or restart the level.')
  }

  const delta = DIRECTION_DELTAS[direction]
  const head = state.worm[0]
  const nextHead = { x: head.x + delta.x, y: head.y + delta.y }
  const outsideBoard =
    nextHead.x < 0 || nextHead.x >= level.grid.columns || nextHead.y < 0 || nextHead.y >= level.grid.rows

  if (outsideBoard) {
    return failGame(state, 'edge', 'The snake slipped off the edge of the board.')
  }

  const nextTurn = state.moves + 1
  const obstacle = level.obstacles.find((item) => samePosition(getObstaclePositionAtTurn(item, nextTurn), nextHead))
  const gateLocked = obstacle?.type === 'gate' && !isGateUnlocked(level, state.collectedApples)

  if (obstacle?.type === 'wall' || obstacle?.type === 'moving' || gateLocked) {
    const remaining = Math.max(1, level.requiredApples - state.collectedApples)
    const feedback = obstacle.type === 'gate'
      ? `The mossy gate needs ${remaining} more ${remaining === 1 ? 'apple' : 'apples'} to unlock.`
      : obstacle.type === 'moving'
        ? 'A forest bird swooped across that tile.'
        : 'A carved wooden wall blocks that tile.'
    return { state: { ...state, feedback }, event: 'blocked' }
  }

  if (obstacle?.type === 'spike' || obstacle?.type === 'pit') {
    return obstacle.type === 'pit'
      ? failGame(state, 'pit', 'The snake fell into a burrow hollow.')
      : failGame(state, 'thorn', 'A bramble patch ended this run.')
  }

  const beetle = getForestBugPosition(level)
  if (beetle && samePosition(beetle, nextHead)) {
    return failGame(state, 'beetle', 'A hungry jungle beetle nipped the snake.')
  }

  const apple = state.remainingApples.find((item) => samePosition(item, nextHead))
  const growing = Boolean(apple)
  const occupiedBody = growing ? state.worm : state.worm.slice(0, -1)

  if (occupiedBody.some((segment) => samePosition(segment, nextHead))) {
    return failGame(state, 'tail', 'You crossed your own tail.')
  }

  const worm = [nextHead, ...state.worm.slice(0, growing ? state.worm.length : -1)]
  const movingBlockHit = level.obstacles.some((item) => {
    if (item.type !== 'moving' || !item.path?.length) return false
    const position = getObstaclePositionAtTurn(item, nextTurn)
    return worm.some((segment) => samePosition(segment, position))
  })
  if (movingBlockHit) {
    return failGame(state, 'bird', 'A forest bird swooped across your trail.')
  }

  const remainingApples = apple
    ? state.remainingApples.filter((item) => !samePosition(item, apple))
    : state.remainingApples
  const collectedApples = state.collectedApples + (apple ? 1 : 0)
  const moves = state.moves + 1
  const score = state.score + (apple?.type === 'golden' ? 50 : apple ? 10 : 0)
  const reachedPortal = samePosition(nextHead, level.portal)
  const objectiveComplete = collectedApples >= level.requiredApples && worm.length >= level.targetLength

  if (reachedPortal && objectiveComplete) {
    return {
      state: { worm, remainingApples, collectedApples, moves, score: score + 100, status: 'completed', failureCause: null, feedback: 'Portal reached. Level complete!' },
      event: 'completed',
    }
  }

  const gateJustUnlocked = !isGateUnlocked(level, state.collectedApples) && isGateUnlocked(level, collectedApples)
  const feedback = reachedPortal
    ? `Collect ${Math.max(0, level.requiredApples - collectedApples)} more ${level.requiredApples - collectedApples === 1 ? 'apple' : 'apples'} to open the portal.`
    : apple
      ? gateJustUnlocked
        ? `${apple.type === 'golden' ? 'Golden apple! +50 pts.' : 'Apple eaten!'} Portal & gates are now open!`
        : apple.type === 'golden'
          ? 'Golden apple collected. +50 points!'
          : 'Apple collected. The snake grew longer.'
      : ''

  return {
    state: { worm, remainingApples, collectedApples, moves, score, status: 'playing', failureCause: null, feedback },
    event: apple ? 'apple' : reachedPortal ? 'incomplete-portal' : 'moved',
  }
}

export function getStarThresholds(level: GameLevel) {
  return {
    threeStars: level.parMoves,
    twoStars: Math.min(level.alternatePath.length - 1, level.moveLimit),
  }
}

export function calculateStars(level: GameLevel, moves: number): number {
  const thresholds = getStarThresholds(level)
  if (moves <= thresholds.threeStars) return 3
  if (moves <= thresholds.twoStars) return 2
  return 1
}

export function findHintDirection(level: GameLevel, state: GameState): Direction | null {
  const targets = state.collectedApples < level.requiredApples
    ? state.remainingApples.map(({ x, y }) => ({ x, y }))
    : [{ ...level.portal }]
  if (!targets.length) return null

  const blocked = new Set(level.obstacles
    .filter((obstacle) => obstacle.type !== 'gate' || !isGateUnlocked(level, state.collectedApples))
    .flatMap((obstacle) => (obstacle.path ?? [obstacle]).map(({ x, y }) => `${x},${y}`)))
  const beetle = getForestBugPosition(level)
  if (beetle) blocked.add(`${beetle.x},${beetle.y}`)
  const occupied = new Set(state.worm.slice(0, -1).map(({ x, y }) => `${x},${y}`))
  const start = state.worm[0]
  const queue: Array<{ point: Coordinate; firstDirection: Direction | null }> = [{ point: start, firstDirection: null }]
  const visited = new Set([`${start.x},${start.y}`])

  while (queue.length) {
    const current = queue.shift()!
    if (targets.some((target) => samePosition(target, current.point)) && current.firstDirection) return current.firstDirection

    for (const direction of DIRECTIONS) {
      const delta = DIRECTION_DELTAS[direction]
      const next = { x: current.point.x + delta.x, y: current.point.y + delta.y }
      const key = `${next.x},${next.y}`
      if (next.x < 0 || next.x >= level.grid.columns || next.y < 0 || next.y >= level.grid.rows) continue
      if (visited.has(key) || blocked.has(key) || occupied.has(key)) continue
      visited.add(key)
      queue.push({ point: next, firstDirection: current.firstDirection ?? direction })
    }
  }

  return null
}
