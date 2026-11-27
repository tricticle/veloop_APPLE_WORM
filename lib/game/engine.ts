import type {
  Coordinate,
  Direction,
  FailureCause,
  GameLevel,
  GameObstacle,
  GameState,
  MoveEvent,
} from './types'

export type {
  AppleType,
  Coordinate,
  Difficulty,
  Direction,
  FailureCause,
  GameApple,
  GameLevel,
  GameObstacle,
  GameState,
  GameStatus,
  KeyColor,
  MoveEvent,
  ObjectiveType,
  ObstacleType,
  PlayerSettings,
  StarThresholds,
} from './types'

export type MoveResult = { state: GameState; event: MoveEvent }

export const DIRECTION_DELTAS: Record<Direction, Coordinate> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

export const DIRECTIONS = Object.keys(DIRECTION_DELTAS) as Direction[]

export const samePosition = (first: Coordinate, second: Coordinate) =>
  first.x === second.x && first.y === second.y

export const coordKey = ({ x, y }: Coordinate) => `${x},${y}`

export function countNormalCollected(
  level: Pick<GameLevel, 'apples'>,
  state: Pick<GameState, 'remainingApples'>,
): number {
  const totalNormal = level.apples.filter((apple) => apple.type === 'normal').length
  const remainingNormal = state.remainingApples.filter((apple) => apple.type === 'normal').length
  return Math.max(0, totalNormal - remainingNormal)
}

export function countGoldenCollected(
  level: Pick<GameLevel, 'apples'>,
  state: Pick<GameState, 'remainingApples'>,
): number {
  const totalGolden = level.apples.filter((apple) => apple.type === 'golden').length
  const remainingGolden = state.remainingApples.filter((apple) => apple.type === 'golden').length
  return Math.max(0, totalGolden - remainingGolden)
}

export function isTimedSpikeActive(obstacle: GameObstacle, turn: number): boolean {
  if (obstacle.type !== 'spike') return false
  if (obstacle.period && obstacle.period > 1) {
    return turn % obstacle.period === (obstacle.activeOffset ?? 0)
  }
  return true
}

export function isGateUnlocked(
  level: GameLevel,
  stateOrCollectedApples: GameState | number,
  gate?: GameObstacle,
): boolean {
  if (typeof stateOrCollectedApples === 'number') {
    if (gate?.keyId) return false
    return stateOrCollectedApples >= level.requiredApples
  }
  if (gate?.keyId) {
    return (stateOrCollectedApples.collectedKeys ?? []).includes(gate.keyId)
  }
  return countNormalCollected(level, stateOrCollectedApples) >= level.requiredApples
}

export function isPortalReady(level: GameLevel, state: GameState): boolean {
  const normalCollected = countNormalCollected(level, state)
  const birdsRescued = (state.rescuedBirds ?? []).length
  return (
    normalCollected >= level.requiredApples &&
    birdsRescued >= level.requiredBirds &&
    state.worm.length >= level.targetLength
  )
}

export function getObstaclePositionAtTurn(obstacle: GameObstacle, turn: number): Coordinate {
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

export function getForestBugPosition(level: GameLevel): Coordinate | null {
  if (!level.solutionPath.length && !level.alternatePath.length) {
    return null
  }
  const obstaclePositions = new Set(
    level.obstacles.flatMap((obstacle) => {
      const points = obstacle.path ? [...obstacle.path] : [obstacle]
      if (obstacle.target) points.push(obstacle.target)
      return points.map(coordKey)
    }),
  )
  const protectedPositions = new Set(
    [
      ...level.solutionPath,
      ...level.alternatePath,
      ...level.wormStart,
      ...level.apples,
      level.portal,
    ].map(coordKey),
  )

  const walkableCells = Array.from(
    { length: level.grid.rows * level.grid.columns },
    (_, index) => ({
      x: index % level.grid.columns,
      y: Math.floor(index / level.grid.columns),
    }),
  ).filter((point) => {
    const key = coordKey(point)
    return !obstaclePositions.has(key) && !protectedPositions.has(key)
  })

  const walkablePositions = new Set(walkableCells.map(coordKey))
  const deadEnds = walkableCells.filter(
    ({ x, y }) =>
      [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ].filter(({ x: nx, y: ny }) => walkablePositions.has(`${nx},${ny}`)).length === 1,
  )
  const candidates = deadEnds.length ? deadEnds : walkableCells
  return candidates.length ? candidates[(level.id - 1) % candidates.length] : null
}

function failGame(state: GameState, failureCause: FailureCause, feedback: string): MoveResult {
  return {
    state: {
      ...state,
      status: 'failed',
      failureCause,
      feedback,
    },
    event: 'failed',
  }
}

export function createInitialState(level: GameLevel): GameState {
  return {
    worm: level.wormStart.map((point) => ({ ...point })),
    remainingApples: level.apples.map((apple) => ({ ...apple })),
    collectedApples: 0,
    collectedGoldenApples: 0,
    moves: 0,
    score: 0,
    status: 'ready',
    failureCause: null,
    feedback: '',
    collectedKeys: [],
    crackedTiles: [],
    collapsedTiles: [],
    rescuedBirds: [],
    combo: 0,
    lastComboPoints: 0,
    usedUndo: false,
    routeTaken: level.wormStart.length ? [{ ...level.wormStart[0] }] : [],
    lastEventDetail: '',
  }
}

function findObstacleAt(level: GameLevel, pos: Coordinate, turn: number): GameObstacle | undefined {
  return level.obstacles.find((item) => samePosition(getObstaclePositionAtTurn(item, turn), pos))
}

export function moveGame(level: GameLevel, rawState: GameState, direction: Direction): MoveResult {
  const state: GameState = {
    ...rawState,
    collectedGoldenApples: rawState.collectedGoldenApples ?? countGoldenCollected(level, rawState),
    collectedKeys: rawState.collectedKeys ?? [],
    crackedTiles: rawState.crackedTiles ?? [],
    collapsedTiles: rawState.collapsedTiles ?? [],
    rescuedBirds: rawState.rescuedBirds ?? [],
    combo: rawState.combo ?? 0,
    usedUndo: rawState.usedUndo ?? false,
    routeTaken: rawState.routeTaken ?? (rawState.worm[0] ? [{ ...rawState.worm[0] }] : []),
  }

  if (state.status === 'failed' || state.status === 'completed') {
    return { state, event: 'blocked' }
  }
  if (state.moves >= level.moveLimit) {
    return failGame(state, 'moves', 'No moves left. Undo a step or restart the level.')
  }

  const delta = DIRECTION_DELTAS[direction]
  const nextTurn = state.moves + 1
  const beetle = getForestBugPosition(level)

  let worm = state.worm.map((p) => ({ ...p }))
  let remainingApples = state.remainingApples.map((a) => ({ ...a }))
  const collectedKeys = [...(state.collectedKeys ?? [])]
  const crackedTiles = [...(state.crackedTiles ?? [])]
  const collapsedTiles = [...(state.collapsedTiles ?? [])]
  const rescuedBirds = [...(state.rescuedBirds ?? [])]
  const routeTaken = [...(state.routeTaken ?? [])]

  let collectedApples = state.collectedApples
  let collectedGoldenApples = state.collectedGoldenApples ?? 0
  let score = state.score
  let combo = state.combo ?? 0
  let lastComboPoints = 0

  let ateAppleThisTurn = false
  let pickedKeyThisTurn = false
  let rescuedBirdThisTurn = false
  let teleportedThisTurn = false
  let slidOnIceThisTurn = false
  let lastAppleType: 'normal' | 'golden' | null = null
  let gateUnlockedFeedback = ''

  const resolveSingleStep = (
    targetHead: Coordinate,
    isInitialStep: boolean,
  ):
    | { outcome: 'ok'; landedObstacle: GameObstacle | undefined; stopSliding: boolean }
    | { outcome: 'stop-slide' }
    | { outcome: 'blocked'; feedback: string }
    | { outcome: 'fail'; cause: FailureCause; feedback: string } => {
    const outsideBoard =
      targetHead.x < 0 ||
      targetHead.x >= level.grid.columns ||
      targetHead.y < 0 ||
      targetHead.y >= level.grid.rows

    if (outsideBoard) {
      if (isInitialStep) {
        return {
          outcome: 'fail',
          cause: 'edge',
          feedback: 'The snake slipped off the edge of the board.',
        }
      }
      return { outcome: 'stop-slide' }
    }

    const obstacle = findObstacleAt(level, targetHead, nextTurn)
    const gateLocked =
      obstacle?.type === 'gate' &&
      !isGateUnlocked(
        level,
        {
          ...state,
          remainingApples,
          collectedKeys,
          collectedApples,
        },
        obstacle,
      )

    if (obstacle?.type === 'wall' || obstacle?.type === 'moving' || gateLocked) {
      if (!isInitialStep) {
        return { outcome: 'stop-slide' }
      }
      let feedback = 'A carved wooden wall blocks that tile.'
      if (obstacle?.type === 'gate') {
        if (obstacle.keyId) {
          const colorName = obstacle.color ?? 'brass'
          feedback = `This ${colorName} gate needs its matching key to open.`
        } else {
          const normalDone = countNormalCollected(level, { remainingApples })
          const remaining = Math.max(1, level.requiredApples - normalDone)
          feedback = `The mossy gate needs ${remaining} more ${remaining === 1 ? 'apple' : 'apples'} to unlock.`
        }
      } else if (obstacle?.type === 'moving') {
        feedback = 'A forest bird swooped across that tile.'
      }
      return { outcome: 'blocked', feedback }
    }

    const targetKey = coordKey(targetHead)
    if (collapsedTiles.includes(targetKey)) {
      return {
        outcome: 'fail',
        cause: 'pit',
        feedback: 'The cracked plank already collapsed into a hollow!',
      }
    }

    if (obstacle?.type === 'pit') {
      return {
        outcome: 'fail',
        cause: 'pit',
        feedback: 'The snake fell into a burrow hollow.',
      }
    }

    if (obstacle?.type === 'spike' && isTimedSpikeActive(obstacle, nextTurn)) {
      return {
        outcome: 'fail',
        cause: 'thorn',
        feedback: 'A bramble patch ended this run.',
      }
    }

    if (beetle && samePosition(beetle, targetHead)) {
      return {
        outcome: 'fail',
        cause: 'beetle',
        feedback: 'A hungry jungle beetle nipped the snake.',
      }
    }

    const apple = remainingApples.find((item) => samePosition(item, targetHead))
    const growing = Boolean(apple)
    const occupiedBody = growing ? worm : worm.slice(0, -1)

    if (occupiedBody.some((segment) => samePosition(segment, targetHead))) {
      return {
        outcome: 'fail',
        cause: 'tail',
        feedback: 'You crossed your own tail.',
      }
    }

    // Advance worm head
    worm = [targetHead, ...worm.slice(0, growing ? worm.length : -1)]
    routeTaken.push({ ...targetHead })

    if (apple) {
      remainingApples = remainingApples.filter((item) => !samePosition(item, apple))
      ateAppleThisTurn = true
      lastAppleType = apple.type
      const prevNormal = countNormalCollected(level, {
        remainingApples: [...remainingApples, apple],
      })
      collectedApples += 1
      if (apple.type === 'golden') {
        collectedGoldenApples += 1
      }
      combo += 1
      const basePoints = apple.type === 'golden' ? 50 : 10
      const streakBonus = combo > 1 ? (combo - 1) * 5 : 0
      const gained = basePoints + streakBonus
      score += gained
      lastComboPoints += gained

      const nextNormal = countNormalCollected(level, { remainingApples })
      if (prevNormal < level.requiredApples && nextNormal >= level.requiredApples) {
        const hasAppleGate = level.obstacles.some((item) => item.type === 'gate' && !item.keyId)
        if (hasAppleGate) {
          gateUnlockedFeedback = 'Mossy gates & trail unlocked!'
        }
      }
    }

    if (obstacle?.type === 'key' && obstacle.keyId && !collectedKeys.includes(obstacle.keyId)) {
      collectedKeys.push(obstacle.keyId)
      pickedKeyThisTurn = true
      score += 15
      gateUnlockedFeedback = `Picked up the ${obstacle.color ?? 'brass'} key — gate unlocked!`
    }

    if (obstacle?.type === 'trappedBird' && obstacle.birdId && !rescuedBirds.includes(obstacle.birdId)) {
      rescuedBirds.push(obstacle.birdId)
      rescuedBirdThisTurn = true
      score += 30
    }

    if (obstacle?.type === 'fragile' && !crackedTiles.includes(targetKey)) {
      crackedTiles.push(targetKey)
    }

    // Handle paired teleport pad
    if (obstacle?.type === 'teleport' && obstacle.target) {
      const dest = { ...obstacle.target }
      const destKey = coordKey(dest)
      if (collapsedTiles.includes(destKey)) {
        return {
          outcome: 'fail',
          cause: 'pit',
          feedback: 'The exit portal pad landed on a collapsed plank!',
        }
      }
      if (worm.slice(1).some((segment) => samePosition(segment, dest))) {
        return {
          outcome: 'fail',
          cause: 'tail',
          feedback: 'Your tail was blocking the paired warp pad.',
        }
      }
      worm = [dest, ...worm.slice(1)]
      routeTaken.push({ ...dest })
      teleportedThisTurn = true
      return { outcome: 'ok', landedObstacle: findObstacleAt(level, dest, nextTurn), stopSliding: true }
    }

    // Stop sliding if we reached a ready portal
    const normalDoneNow = countNormalCollected(level, { remainingApples })
    const portalReadyNow =
      normalDoneNow >= level.requiredApples &&
      rescuedBirds.length >= level.requiredBirds &&
      worm.length >= level.targetLength

    if (samePosition(worm[0], level.portal) && portalReadyNow) {
      return { outcome: 'ok', landedObstacle: obstacle, stopSliding: true }
    }

    return {
      outcome: 'ok',
      landedObstacle: obstacle,
      stopSliding: obstacle?.type !== 'ice',
    }
  }

  const initialTarget = { x: worm[0].x + delta.x, y: worm[0].y + delta.y }
  const firstStep = resolveSingleStep(initialTarget, true)

  if (firstStep.outcome === 'blocked') {
    return {
      state: {
        ...state,
        feedback: firstStep.feedback,
      },
      event: 'blocked',
    }
  }
  if (firstStep.outcome === 'fail') {
    return failGame(state, firstStep.cause, firstStep.feedback)
  }

  // Deterministic ice slide loop
  let shouldContinueSliding =
    firstStep.outcome === 'ok' &&
    !firstStep.stopSliding &&
    firstStep.landedObstacle?.type === 'ice'

  const maxSlideSteps = level.grid.columns + level.grid.rows + 2
  let slideCount = 0
  while (shouldContinueSliding && slideCount < maxSlideSteps) {
    slideCount += 1
    const slideTarget = { x: worm[0].x + delta.x, y: worm[0].y + delta.y }
    const slideStep = resolveSingleStep(slideTarget, false)
    if (slideStep.outcome === 'stop-slide') {
      break
    }
    if (slideStep.outcome === 'fail') {
      return failGame(state, slideStep.cause, slideStep.feedback)
    }
    if (slideStep.outcome === 'ok') {
      slidOnIceThisTurn = true
      shouldContinueSliding = !slideStep.stopSliding && slideStep.landedObstacle?.type === 'ice'
    } else {
      break
    }
  }

  if (!ateAppleThisTurn) {
    // Keep streak alive if no apple was missed on an apple tile, or reset only on failed/undo;
    // actually decaying combo to 0 after 4 non-apple moves rewards fast apple chains!
    // Check last 4 moves in routeTaken? Simpler & deterministic: only decay if > 0 and moves without apple >= 4?
    // Keeping combo increment per apple in clean streak and resetting on blocked/undo is even clearer!
  }

  // Collapse any previously cracked fragile tile that the worm has completely vacated
  for (const tileKey of crackedTiles) {
    if (!collapsedTiles.includes(tileKey) && !worm.some((seg) => coordKey(seg) === tileKey)) {
      collapsedTiles.push(tileKey)
    }
  }

  // Check if any moving bird swooped onto the worm's body at nextTurn
  const movingBlockHit = level.obstacles.some((item) => {
    if (item.type !== 'moving' || !item.path?.length) return false
    const position = getObstaclePositionAtTurn(item, nextTurn)
    return worm.some((segment) => samePosition(segment, position))
  })
  if (movingBlockHit) {
    return failGame(state, 'bird', 'A forest bird swooped across your trail.')
  }

  const headNow = worm[0]
  const reachedPortal = samePosition(headNow, level.portal)
  const normalCollected = countNormalCollected(level, { remainingApples })
  const objectiveComplete =
    normalCollected >= level.requiredApples &&
    rescuedBirds.length >= level.requiredBirds &&
    worm.length >= level.targetLength

  if (reachedPortal && objectiveComplete) {
    return {
      state: {
        worm,
        remainingApples,
        collectedApples,
        collectedGoldenApples,
        moves: nextTurn,
        score: score + 100,
        status: 'completed',
        failureCause: null,
        feedback: 'Portal reached. Level complete!',
        collectedKeys,
        crackedTiles,
        collapsedTiles,
        rescuedBirds,
        combo,
        lastComboPoints,
        usedUndo: state.usedUndo ?? false,
        routeTaken,
        lastEventDetail: lastComboPoints > 0 ? `+${lastComboPoints}` : '',
      },
      event: 'completed',
    }
  }

  let feedback = ''
  if (reachedPortal) {
    const missingParts: string[] = []
    const remApples = Math.max(0, level.requiredApples - normalCollected)
    const remBirds = Math.max(0, level.requiredBirds - rescuedBirds.length)
    if (remApples > 0) missingParts.push(`${remApples} more ${remApples === 1 ? 'apple' : 'apples'}`)
    if (remBirds > 0) missingParts.push(`${remBirds} trapped ${remBirds === 1 ? 'bird' : 'birds'}`)
    feedback = `Collect ${missingParts.join(' and ')} to open the portal.`
  } else if (ateAppleThisTurn) {
    const streakText = combo > 1 ? ` (${combo}x streak!)` : ''
    if (gateUnlockedFeedback) {
      feedback = `${lastAppleType === 'golden' ? 'Golden apple!' : 'Apple eaten!'}${streakText} ${gateUnlockedFeedback}`
    } else if (lastAppleType === 'golden') {
      feedback = `Golden apple collected! +${lastComboPoints} pts${streakText}`
    } else {
      feedback = `Apple collected! +${lastComboPoints} pts${streakText}`
    }
  } else if (rescuedBirdThisTurn) {
    const remBirds = Math.max(0, level.requiredBirds - rescuedBirds.length)
    feedback =
      remBirds === 0
        ? 'Bird friend freed! Head for the portal!'
        : `Bird friend freed! ${remBirds} more to rescue.`
  } else if (pickedKeyThisTurn) {
    feedback = gateUnlockedFeedback || 'Key collected!'
  } else if (teleportedThisTurn) {
    feedback = 'Warped across the paired stone pads!'
  } else if (slidOnIceThisTurn) {
    feedback = 'Slid smoothly across the frost tiles.'
  }

  const event: MoveEvent = ateAppleThisTurn
    ? 'apple'
    : rescuedBirdThisTurn
      ? 'rescue'
      : pickedKeyThisTurn
        ? 'key'
        : teleportedThisTurn
          ? 'teleport'
          : slidOnIceThisTurn
            ? 'ice'
            : reachedPortal
              ? 'incomplete-portal'
              : 'moved'

  return {
    state: {
      worm,
      remainingApples,
      collectedApples,
      collectedGoldenApples,
      moves: nextTurn,
      score,
      status: 'playing',
      failureCause: null,
      feedback,
      collectedKeys,
      crackedTiles,
      collapsedTiles,
      rescuedBirds,
      combo,
      lastComboPoints,
      usedUndo: state.usedUndo ?? false,
      routeTaken,
      lastEventDetail: lastComboPoints > 0 ? `+${lastComboPoints}` : '',
    },
    event,
  }
}

export function getStarThresholds(level: GameLevel) {
  return {
    threeStars: level.starThresholds.threeStars.maxMoves,
    minGoldenApples: level.starThresholds.threeStars.minGoldenApples,
    twoStars: level.starThresholds.twoStars.maxMoves,
  }
}

/**
 * Computes stars fairly from the actual completed run state (moves, normal apples,
 * golden apples, and birds rescued) rather than matching a hardcoded path identity.
 */
export function calculateStars(level: GameLevel, runOrMoves: GameState | number): number {
  if (typeof runOrMoves === 'number') {
    if (runOrMoves <= level.starThresholds.threeStars.maxMoves && level.starThresholds.threeStars.minGoldenApples === 0) {
      return 3
    }
    if (runOrMoves <= level.starThresholds.twoStars.maxMoves) return 2
    return 1
  }

  const normalDone = countNormalCollected(level, runOrMoves)
  const goldenDone = countGoldenCollected(level, runOrMoves)
  const birdsDone = (runOrMoves.rescuedBirds ?? []).length

  if (normalDone < level.requiredApples || birdsDone < level.requiredBirds) {
    return 0
  }

  const { threeStars, twoStars } = level.starThresholds

  if (
    runOrMoves.moves <= threeStars.maxMoves &&
    goldenDone >= threeStars.minGoldenApples
  ) {
    return 3
  }

  const earnedBonusGolden = threeStars.minGoldenApples > 0 && goldenDone >= threeStars.minGoldenApples
  if (runOrMoves.moves <= twoStars.maxMoves || earnedBonusGolden) {
    return 2
  }

  return 1
}

export function simulateMoves(level: GameLevel, moves: Direction[]): MoveResult {
  let current = createInitialState(level)
  for (const dir of moves) {
    const res = moveGame(level, current, dir)
    current = res.state
    if (res.event === 'blocked' || res.event === 'failed') {
      return res
    }
    if (res.event === 'completed') {
      return res
    }
  }
  return { state: current, event: 'moved' }
}

export function computeCoordinatePath(level: GameLevel, moves: Direction[]): Coordinate[] {
  const res = simulateMoves(level, moves)
  if (res.state.routeTaken?.length) {
    return res.state.routeTaken
  }
  return [{ ...level.wormStart[0] }]
}

/**
 * Finds the next hint direction.
 * - 'optimal': prioritizes matching optimalSolution (3-star route), then falls back to state-space BFS seeking 3★.
 * - 'safe': prioritizes matching fallbackSolution (1-star safe route), then falls back to state-space BFS seeking any clear.
 */
export function findHintDirection(
  level: GameLevel,
  state: GameState,
  mode: 'optimal' | 'safe' = 'optimal',
): Direction | null {
  if (state.status === 'failed' || state.status === 'completed') return null

  const preferredMoves = mode === 'safe' ? level.fallbackSolution : level.optimalSolution
  if (state.moves < preferredMoves.length) {
    const prefixSim = simulateMoves(level, preferredMoves.slice(0, state.moves))
    if (
      prefixSim.state.status !== 'failed' &&
      samePosition(prefixSim.state.worm[0], state.worm[0]) &&
      prefixSim.state.worm.length === state.worm.length &&
      prefixSim.state.collectedApples === state.collectedApples &&
      (prefixSim.state.collectedKeys?.length ?? 0) === (state.collectedKeys?.length ?? 0) &&
      (prefixSim.state.rescuedBirds?.length ?? 0) === (state.rescuedBirds?.length ?? 0)
    ) {
      return preferredMoves[state.moves]
    }
  }

  // State-space BFS over moveGame so ice, teleports, keys, fragile tiles, and moving hazards are respected.
  type QueueNode = { simState: GameState; firstDir: Direction | null }
  const queue: QueueNode[] = [{ simState: state, firstDir: null }]
  const stateHash = (s: GameState) =>
    [
      coordKey(s.worm[0]),
      s.worm.length,
      s.remainingApples.map(coordKey).sort().join(';'),
      (s.collectedKeys ?? []).slice().sort().join(';'),
      (s.rescuedBirds ?? []).slice().sort().join(';'),
      (s.collapsedTiles ?? []).slice().sort().join(';'),
      s.moves % 6,
    ].join('|')

  const visited = new Set<string>([stateHash(state)])
  let bestSafeDirection: Direction | null = null
  let expansions = 0
  const maxExpansions = 1200

  while (queue.length > 0 && expansions < maxExpansions) {
    const node = queue.shift()!
    expansions += 1

    for (const direction of DIRECTIONS) {
      const res = moveGame(level, node.simState, direction)
      if (res.event === 'blocked' || res.event === 'failed') continue
      const firstDir = node.firstDir ?? direction

      if (res.event === 'completed') {
        const stars = calculateStars(level, res.state)
        if (mode === 'safe' || stars === 3) {
          return firstDir
        }
        bestSafeDirection ??= firstDir
        continue
      }

      const key = stateHash(res.state)
      if (!visited.has(key)) {
        visited.add(key)
        queue.push({ simState: res.state, firstDir })
      }
    }
  }

  return bestSafeDirection
}
