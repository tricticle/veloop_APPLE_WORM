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
  alternatePath: Coordinate[]
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
  const mazeCellKeys = new Set([...pathKeySet, ...startKeySet])
  const mazeBranches: Coordinate[][] = []
  const branchCount = Math.min(3 + Math.floor((id - 1) / 10), 6)
  const sideDirections: Coordinate[] = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]
  let alternatePath: Coordinate[] | null = null

  for (let attempt = 0; attempt < path.length - 1 && !alternatePath; attempt += 1) {
    const edgeIndex = 1 + ((id * 3 + attempt) % (path.length - 2))
    const first = path[edgeIndex]
    const second = path[edgeIndex + 1]
    const offsets = first.y === second.y
      ? [{ x: 0, y: 1 }, { x: 0, y: -1 }]
      : [{ x: 1, y: 0 }, { x: -1, y: 0 }]

    for (const offset of offsets) {
      const firstDetour = { x: first.x + offset.x, y: first.y + offset.y }
      const secondDetour = { x: second.x + offset.x, y: second.y + offset.y }
      const withinBoard = (point: Coordinate) => point.x >= 0 && point.x < 7 && point.y >= 0 && point.y < 7
      const neighborsOf = (point: Coordinate) => [
        { x: point.x + 1, y: point.y },
        { x: point.x - 1, y: point.y },
        { x: point.x, y: point.y + 1 },
        { x: point.x, y: point.y - 1 },
      ]
      const firstConnections = neighborsOf(firstDetour).filter((point) => mazeCellKeys.has(`${point.x},${point.y}`))
      const secondConnections = neighborsOf(secondDetour).filter((point) => mazeCellKeys.has(`${point.x},${point.y}`))
      const connectsOnlyToEndpoint = (connections: Coordinate[], endpoint: Coordinate) =>
        connections.length === 1 && connections[0].x === endpoint.x && connections[0].y === endpoint.y

      if (!withinBoard(firstDetour) || !withinBoard(secondDetour) ||
        mazeCellKeys.has(`${firstDetour.x},${firstDetour.y}`) || mazeCellKeys.has(`${secondDetour.x},${secondDetour.y}`) ||
        !connectsOnlyToEndpoint(firstConnections, first) || !connectsOnlyToEndpoint(secondConnections, second)) continue

      mazeCellKeys.add(`${firstDetour.x},${firstDetour.y}`)
      mazeCellKeys.add(`${secondDetour.x},${secondDetour.y}`)
      alternatePath = [
        ...path.slice(0, edgeIndex + 1),
        firstDetour,
        secondDetour,
        ...path.slice(edgeIndex + 1),
      ]
      break
    }
  }

  if (!alternatePath) throw new Error(`No alternate route found for level ${id}`)

  for (let attempt = 0; attempt < path.length * 4 && mazeBranches.length < branchCount; attempt += 1) {
    const pathIndex = 1 + ((id * 3 + attempt) % (path.length - 2))
    const root = path[pathIndex]
    const directionOffset = (id + attempt) % sideDirections.length

    for (let directionIndex = 0; directionIndex < sideDirections.length; directionIndex += 1) {
      const branch: Coordinate[] = []
      let previous = root
      let travelDirection = sideDirections[(directionOffset + directionIndex) % sideDirections.length]

      for (let distance = 1; distance <= 3; distance += 1) {
        const travelIndex = sideDirections.indexOf(travelDirection)
        const directions = [
          travelDirection,
          sideDirections[(travelIndex + 1) % sideDirections.length],
          sideDirections[(travelIndex + 3) % sideDirections.length],
          sideDirections[(travelIndex + 2) % sideDirections.length],
        ]
        let candidate: Coordinate | null = null
        let nextDirection: Coordinate | null = null

        for (const direction of directions) {
          const next = { x: previous.x + direction.x, y: previous.y + direction.y }
          const candidateKey = `${next.x},${next.y}`
          const touchingMaze = [
            { x: next.x + 1, y: next.y },
            { x: next.x - 1, y: next.y },
            { x: next.x, y: next.y + 1 },
            { x: next.x, y: next.y - 1 },
          ].filter((point) => mazeCellKeys.has(`${point.x},${point.y}`))
          const outsideBoard = next.x < 0 || next.x >= 7 || next.y < 0 || next.y >= 7
          const touchesAnotherPassage = touchingMaze.some((point) => point.x !== previous.x || point.y !== previous.y)

          if (outsideBoard || mazeCellKeys.has(candidateKey) || touchesAnotherPassage) continue
          candidate = next
          nextDirection = direction
          break
        }

        if (!candidate || !nextDirection) break
        branch.push(candidate)
        mazeCellKeys.add(`${candidate.x},${candidate.y}`)
        previous = candidate
        travelDirection = nextDirection
      }

      if (branch.length) {
        mazeBranches.push(branch)
        break
      }
    }
  }

  const obstacles: GameObstacle[] = []
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      if (!mazeCellKeys.has(`${x},${y}`)) obstacles.push({ x, y, type: 'wall' })
    }
  }

  const hazardTypes: ObstacleType[] = ['spike', 'pit', 'gate', 'moving']
  mazeBranches.forEach((branch, branchIndex) => {
    if ((id + branchIndex) % 3 !== 0) return
    const hazardType = hazardTypes[(id + branchIndex) % hazardTypes.length]
    const endpoint = branch[branch.length - 1]

    if (hazardType === 'moving' && branch.length > 1) {
      const movingPath = branch.slice(-2)
      obstacles.push({ ...movingPath[0], type: 'moving', path: movingPath })
      return
    }

    obstacles.push({ ...endpoint, type: hazardType === 'moving' ? 'spike' : hazardType })
  })

  const parMoves = path.length - 1
  const moveBonus = difficulty === 'BEGINNER' ? 9 : difficulty === 'EASY' ? 7 : difficulty === 'MEDIUM' ? 5 : difficulty === 'HARD' ? 3 : 2
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
    moveLimit: Math.max(parMoves + moveBonus, Math.ceil(parMoves * 1.4), parMoves + 4),
    parMoves,
    solutionPath: path,
    alternatePath,
  }
}

export const LEVELS = Array.from({ length: 50 }, (_, index) => buildLevel(index + 1))

export function getLevel(levelId: number): GameLevel {
  const level = LEVELS[levelId - 1]
  if (!level) throw new Error('Level not found')
  return level
}

export function isLevelSolvable(level: GameLevel): boolean {
  const { solutionPath, alternatePath, obstacles, apples, portal, wormStart, moveLimit } = level
  const obstacleKeys = new Set(obstacles.flatMap((obstacle) =>
    (obstacle.path ?? [obstacle]).map(({ x, y }) => `${x},${y}`),
  ))
  const appleKeys = new Set(apples.map(({ x, y }) => `${x},${y}`))
  const isAdjacent = (first: Coordinate, second: Coordinate) =>
    Math.abs(first.x - second.x) + Math.abs(first.y - second.y) === 1
  const routeIsValid = (route: Coordinate[]) => {
    const routeKeys = new Set(route.map(({ x, y }) => `${x},${y}`))
    const finalPoint = route[route.length - 1]
    return route.length >= 2 && route.length - 1 <= moveLimit &&
      route[0].x === wormStart[0].x && route[0].y === wormStart[0].y &&
      (route[1].x !== wormStart[1].x || route[1].y !== wormStart[1].y) &&
      route.every((point, index) => !obstacleKeys.has(`${point.x},${point.y}`) &&
        (index === 0 || isAdjacent(route[index - 1], point))) &&
      routeKeys.size === route.length &&
      Array.from(appleKeys).every((key) => routeKeys.has(key)) &&
      finalPoint.x === portal.x && finalPoint.y === portal.y
  }

  return routeIsValid(solutionPath) && routeIsValid(alternatePath) &&
    alternatePath.length === solutionPath.length + 2
}

export const INVALID_LEVEL_IDS = LEVELS
  .filter((level) => !isLevelSolvable(level))
  .map((level) => level.id)

if (INVALID_LEVEL_IDS.length) {
  throw new Error(`Unsolvable level data: ${INVALID_LEVEL_IDS.join(', ')}`)
}
