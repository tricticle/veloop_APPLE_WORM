export type Coordinate = { x: number; y: number }
export type Difficulty = 'BEGINNER' | 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'
export type AppleType = 'normal' | 'golden'
export type ObjectiveType = 'CLASSIC' | 'COLLECTION' | 'LENGTH' | 'LIMITED_MOVES'
export type ObstacleType = 'wall' | 'spike' | 'pit' | 'gate' | 'moving'

export type GameApple = Coordinate & { type: AppleType }
export type GameObstacle = Coordinate & { type: ObstacleType; path?: Coordinate[] }

export type GameLevel = {
  id: number
  name: string
  world: string
  difficulty: Difficulty
  grid: { rows: number; columns: number }
  wormStart: Coordinate[]
  apples: GameApple[]
  portal: Coordinate
  obstacles: GameObstacle[]
  objective: ObjectiveType
  requiredApples: number
  targetLength: number
  moveLimit: number
  parMoves: number
  solutionPath: Coordinate[]
}

type LevelTemplate = {
  name: string
  wormStart: Coordinate[]
  path: Coordinate[]
  appleIndices: number[]
}

const templates: LevelTemplate[] = [
  {
    name: 'First Bite',
    wormStart: [{ x: 1, y: 5 }, { x: 1, y: 6 }],
    path: [
      { x: 1, y: 5 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 },
      { x: 4, y: 4 }, { x: 4, y: 3 }, { x: 4, y: 2 }, { x: 5, y: 2 },
      { x: 5, y: 1 },
    ],
    appleIndices: [3, 7],
  },
  {
    name: 'Fern Crossing',
    wormStart: [{ x: 1, y: 1 }, { x: 0, y: 1 }],
    path: [
      { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 },
      { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 2 }, { x: 4, y: 1 },
      { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 2 },
    ],
    appleIndices: [3, 6, 9],
  },
  {
    name: 'Mossy Bend',
    wormStart: [{ x: 5, y: 5 }, { x: 6, y: 5 }],
    path: [
      { x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 },
      { x: 2, y: 4 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
      { x: 5, y: 3 }, { x: 5, y: 2 }, { x: 5, y: 1 },
    ],
    appleIndices: [3, 6, 8],
  },
  {
    name: 'Thicket Trail',
    wormStart: [{ x: 5, y: 1 }, { x: 6, y: 1 }],
    path: [
      { x: 5, y: 1 }, { x: 4, y: 1 }, { x: 3, y: 1 }, { x: 2, y: 1 },
      { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 },
      { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 5 }, { x: 4, y: 5 },
      { x: 5, y: 5 },
    ],
    appleIndices: [3, 7, 10],
  },
  {
    name: 'Canopy Loop',
    wormStart: [{ x: 1, y: 1 }, { x: 1, y: 0 }],
    path: [
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
      { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 4, y: 3 },
      { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 },
      { x: 3, y: 5 }, { x: 4, y: 5 },
    ],
    appleIndices: [4, 8, 11],
  },
]

const difficultyFor = (id: number): Difficulty => {
  if (id <= 10) return 'BEGINNER'
  if (id <= 20) return 'EASY'
  if (id <= 30) return 'MEDIUM'
  if (id <= 40) return 'HARD'
  return 'EXPERT'
}

const worldFor = (id: number) => {
  if (id <= 10) return 'The Apple Grove'
  if (id <= 20) return 'Fernwood Forest'
  if (id <= 30) return 'Mosslight Meadow'
  if (id <= 40) return 'Bramble Ridge'
  return 'The Golden Canopy'
}

function buildLevel(id: number): GameLevel {
  const template = templates[(id - 1) % templates.length]
  const difficulty = difficultyFor(id)
  const appleCount = id === 1 ? 2 : id <= 30 ? 2 : 3
  const objective: ObjectiveType =
    id % 4 === 0 ? 'COLLECTION' : id % 5 === 0 ? 'LENGTH' : id % 7 === 0 ? 'LIMITED_MOVES' : 'CLASSIC'
  const path = template.path.map((point) => ({ ...point }))
  const selectedIndices = template.appleIndices.slice(0, appleCount)
  const apples = selectedIndices.map((pathIndex, index) => ({
    ...path[pathIndex],
    type: id % 9 === 0 && index === selectedIndices.length - 1 ? 'golden' as const : 'normal' as const,
  }))
  const pathKeySet = new Set(path.map(({ x, y }) => `${x},${y}`))
  const startKeySet = new Set(template.wormStart.map(({ x, y }) => `${x},${y}`))
  const candidates: Coordinate[] = []

  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const key = `${x},${y}`
      if (!pathKeySet.has(key) && !startKeySet.has(key)) candidates.push({ x, y })
    }
  }

  const obstacleCount = Math.min(2 + Math.floor((id - 1) / 5), 12)
  const offset = (id * 7) % candidates.length
  const usedCells = new Set(startKeySet)
  const obstacles: GameObstacle[] = []
  const orderedCandidates = Array.from(
    { length: candidates.length },
    (_, index) => candidates[(offset + index) % candidates.length],
  )
  const obstacleTypes: ObstacleType[] = ['wall', 'spike', 'pit', 'gate', 'moving']

  for (const point of orderedCandidates) {
    if (obstacles.length >= obstacleCount) break
    const key = `${point.x},${point.y}`
    if (usedCells.has(key)) continue

    const type = obstacleTypes[(id + obstacles.length) % obstacleTypes.length]
    usedCells.add(key)
    if (type !== 'moving') {
      obstacles.push({ ...point, type })
      continue
    }

    const nextCell = [
      { x: point.x + 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y - 1 },
    ].find((candidate) => {
      const candidateKey = `${candidate.x},${candidate.y}`
      return candidate.x >= 0 && candidate.x < 7 && candidate.y >= 0 && candidate.y < 7 &&
        !pathKeySet.has(candidateKey) && !usedCells.has(candidateKey)
    })

    if (nextCell) {
      usedCells.add(`${nextCell.x},${nextCell.y}`)
      obstacles.push({ ...point, type, path: [{ ...point }, nextCell] })
    } else {
      obstacles.push({ ...point, type: 'wall' })
    }
  }

  const parMoves = path.length - 1
  const moveBonus = difficulty === 'BEGINNER' ? 12 : difficulty === 'EASY' ? 9 : difficulty === 'MEDIUM' ? 7 : difficulty === 'HARD' ? 5 : 4
  const requiredApples = objective === 'COLLECTION' ? Math.max(1, apples.length - 1) : apples.length

  return {
    id,
    name: template.name,
    world: worldFor(id),
    difficulty,
    grid: { rows: 7, columns: 7 },
    wormStart: template.wormStart.map((point) => ({ ...point })),
    apples,
    portal: { ...path[path.length - 1] },
    obstacles,
    objective,
    requiredApples,
    targetLength: template.wormStart.length + requiredApples,
    moveLimit: Math.max(parMoves + moveBonus, Math.ceil(parMoves * 1.4)),
    parMoves,
    solutionPath: path,
  }
}

export const LEVELS = Array.from({ length: 50 }, (_, index) => buildLevel(index + 1))

export function getLevel(levelId: number): GameLevel {
  const level = LEVELS[levelId - 1]
  if (!level) throw new Error('Level not found')
  return level
}

export function isLevelSolvable(level: GameLevel): boolean {
  const { solutionPath, obstacles, apples, portal, wormStart, moveLimit } = level
  const obstacleKeys = new Set(obstacles.flatMap((obstacle) =>
    (obstacle.path ?? [obstacle]).map(({ x, y }) => `${x},${y}`),
  ))
  const pathKeys = new Set(solutionPath.map(({ x, y }) => `${x},${y}`))
  const appleKeys = new Set(apples.map(({ x, y }) => `${x},${y}`))
  const isAdjacent = (first: Coordinate, second: Coordinate) =>
    Math.abs(first.x - second.x) + Math.abs(first.y - second.y) === 1

  if (solutionPath.length < 2 || moveLimit < solutionPath.length - 1) return false
  if (solutionPath[0].x !== wormStart[0].x || solutionPath[0].y !== wormStart[0].y) return false
  if (solutionPath.some((point, index) => index > 0 && !isAdjacent(solutionPath[index - 1], point))) return false
  if (solutionPath.some(({ x, y }) => obstacleKeys.has(`${x},${y}`))) return false
  if (Array.from(appleKeys).some((key) => !pathKeys.has(key))) return false
  const finalPoint = solutionPath[solutionPath.length - 1]
  return finalPoint.x === portal.x && finalPoint.y === portal.y
}

export const INVALID_LEVEL_IDS = LEVELS
  .filter((level) => !isLevelSolvable(level))
  .map((level) => level.id)

if (INVALID_LEVEL_IDS.length) {
  throw new Error(`Unsolvable level data: ${INVALID_LEVEL_IDS.join(', ')}`)
}
