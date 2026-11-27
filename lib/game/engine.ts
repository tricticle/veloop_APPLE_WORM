import type { Coordinate, GameLevel } from './levels'

export type Direction = 'up' | 'right' | 'down' | 'left'
export type GameStatus = 'ready' | 'playing' | 'failed' | 'completed'
export type MoveEvent = 'moved' | 'apple' | 'blocked' | 'failed' | 'incomplete-portal' | 'completed'

export type GameState = {
  worm: Coordinate[]
  remainingApples: GameLevel['apples']
  collectedApples: number
  moves: number
  score: number
  status: GameStatus
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

export function createInitialState(level: GameLevel): GameState {
  return {
    worm: level.wormStart.map((point) => ({ ...point })),
    remainingApples: level.apples.map((apple) => ({ ...apple })),
    collectedApples: 0,
    moves: 0,
    score: 0,
    status: 'ready',
    feedback: '',
  }
}

export function moveGame(level: GameLevel, state: GameState, direction: Direction): MoveResult {
  if (state.status === 'failed' || state.status === 'completed') return { state, event: 'blocked' }
  if (state.moves >= level.moveLimit) {
    return {
      state: { ...state, status: 'failed', feedback: 'No moves left. Undo a step or restart the level.' },
      event: 'failed',
    }
  }

  const delta = DIRECTION_DELTAS[direction]
  const head = state.worm[0]
  const nextHead = { x: head.x + delta.x, y: head.y + delta.y }
  const outsideBoard =
    nextHead.x < 0 || nextHead.x >= level.grid.columns || nextHead.y < 0 || nextHead.y >= level.grid.rows

  if (outsideBoard) {
    return {
      state: { ...state, status: 'failed', feedback: 'The trail slipped off the edge.' },
      event: 'failed',
    }
  }

  const nextTurn = state.moves + 1
  const obstacle = level.obstacles.find((item) => {
    const position = item.type === 'moving' && item.path?.length
      ? item.path[nextTurn % item.path.length]
      : item
    return samePosition(position, nextHead)
  })
  if (obstacle?.type === 'wall' || obstacle?.type === 'moving' || obstacle?.type === 'gate' && state.collectedApples < level.requiredApples - 1) {
    const feedback = obstacle.type === 'gate'
      ? 'The gate needs one more apple.'
      : obstacle.type === 'moving'
        ? 'A forest bird swooped across that tile.'
        : 'A stone wall blocks that tile.'
    return { state: { ...state, feedback }, event: 'blocked' }
  }

  if (obstacle?.type === 'spike' || obstacle?.type === 'pit') {
    return {
      state: { ...state, status: 'failed', feedback: obstacle.type === 'pit' ? 'The trail fell into a hollow.' : 'A thorn patch ended this run.' },
      event: 'failed',
    }
  }

  const apple = state.remainingApples.find((item) => samePosition(item, nextHead))
  const growing = Boolean(apple)
  const occupiedBody = growing ? state.worm : state.worm.slice(0, -1)

  if (occupiedBody.some((segment) => samePosition(segment, nextHead))) {
    return {
      state: { ...state, status: 'failed', feedback: 'You crossed your own trail.' },
      event: 'failed',
    }
  }

  const worm = [nextHead, ...state.worm.slice(0, growing ? state.worm.length : -1)]
  const movingBlockHit = level.obstacles.some((item) => {
    if (item.type !== 'moving' || !item.path?.length) return false
    const position = item.path[nextTurn % item.path.length]
    return worm.some((segment) => samePosition(segment, position))
  })
  if (movingBlockHit) {
      return { state: { ...state, status: 'failed', feedback: 'A forest bird swooped across your trail.' }, event: 'failed' }

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
      state: { worm, remainingApples, collectedApples, moves, score: score + 100, status: 'completed', feedback: 'Portal reached. Level complete!' },
      event: 'completed',
    }
  }

  const feedback = reachedPortal
    ? `Collect ${Math.max(0, level.requiredApples - collectedApples)} more ${level.requiredApples - collectedApples === 1 ? 'apple' : 'apples'} before entering.`
    : apple
      ? apple.type === 'golden' ? 'Golden apple collected. +50 points.' : 'Apple collected. Your trail grew.'
      : ''

  return {
    state: { worm, remainingApples, collectedApples, moves, score, status: 'playing', feedback },
    event: apple ? 'apple' : reachedPortal ? 'incomplete-portal' : 'moved',
  }
}

export function calculateStars(level: GameLevel, moves: number): number {
  if (moves <= level.parMoves) return 3
  if (moves <= level.parMoves + 4) return 2
  return 1
}

export function findHintDirection(level: GameLevel, state: GameState): Direction | null {
  const targets = state.collectedApples < level.requiredApples
    ? state.remainingApples.map(({ x, y }) => ({ x, y }))
    : [{ ...level.portal }]
  if (!targets.length) return null

  const blocked = new Set(level.obstacles
    .filter((obstacle) => obstacle.type !== 'gate' || state.collectedApples < level.requiredApples - 1)
    .flatMap((obstacle) => (obstacle.path ?? [obstacle]).map(({ x, y }) => `${x},${y}`)))
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
