export type Direction = 'up' | 'right' | 'down' | 'left'

export type Coordinate = { x: number; y: number }

export type Difficulty = 'BEGINNER' | 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'

export type AppleType = 'normal' | 'golden'

export type ObjectiveType =
  | 'CLASSIC'
  | 'COLLECTION'
  | 'LENGTH'
  | 'LIMITED_MOVES'
  | 'BIRD_RESCUE'

export type ObstacleType =
  | 'wall'
  | 'spike'
  | 'pit'
  | 'gate'
  | 'moving'
  | 'key'
  | 'teleport'
  | 'ice'
  | 'fragile'
  | 'trappedBird'

export type KeyColor = 'amber' | 'emerald' | 'cobalt'

export type GameApple = Coordinate & {
  type: AppleType
}

export type GameObstacle = Coordinate & {
  type: ObstacleType
  /** Patrol coordinates for 'moving' bird hazards (deterministic by move turn). */
  path?: Coordinate[]
  /** Matching key identifier for 'key' and keyed 'gate' tiles. */
  keyId?: string
  /** Key color badge for visual matching. */
  color?: KeyColor
  /** Paired portal identifier and destination coordinate for 'teleport' tiles. */
  pairId?: string
  target?: Coordinate
  /** Optional oscillation period & active offset for timed 'spike' hazards. */
  period?: number
  activeOffset?: number
  /** Unique identifier for 'trappedBird' tiles. */
  birdId?: string
}

export type StarThresholds = {
  threeStars: {
    maxMoves: number
    minGoldenApples: number
  }
  twoStars: {
    maxMoves: number
  }
}

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
  /** Number of normal apples required to open the exit portal. */
  requiredApples: number
  /** Number of trapped birds that must be rescued before the portal opens. */
  requiredBirds: number
  targetLength: number
  moveLimit: number
  /** Kept aligned with optimalMoves for UI/API compatibility. */
  parMoves: number
  /** 3-star optimal solution moves. */
  optimalSolution: Direction[]
  /** 1-star safe-but-worse solution moves. */
  fallbackSolution: Direction[]
  optimalMoves: number
  fallbackMoves: number
  starThresholds: StarThresholds
  /** Precomputed head coordinate trace of optimalSolution. */
  solutionPath: Coordinate[]
  /** Precomputed head coordinate trace of fallbackSolution. */
  alternatePath: Coordinate[]
  /** Optional concise tutorial tip shown when introducing a mechanic. */
  tutorialHint?: string
  /** Short challenge prompt displayed in the HUD. */
  challengeText: string
}

export type GameStatus = 'ready' | 'playing' | 'failed' | 'completed'

export type FailureCause =
  | 'edge'
  | 'moves'
  | 'thorn'
  | 'pit'
  | 'tail'
  | 'bird'
  | 'beetle'

export type MoveEvent =
  | 'moved'
  | 'apple'
  | 'key'
  | 'teleport'
  | 'ice'
  | 'rescue'
  | 'blocked'
  | 'failed'
  | 'incomplete-portal'
  | 'completed'

export type GameState = {
  worm: Coordinate[]
  remainingApples: GameApple[]
  collectedApples: number
  collectedGoldenApples?: number
  moves: number
  score: number
  status: GameStatus
  failureCause: FailureCause | null
  feedback: string
  collectedKeys?: string[]
  crackedTiles?: string[]
  collapsedTiles?: string[]
  rescuedBirds?: string[]
  combo?: number
  lastComboPoints?: number
  usedUndo?: boolean
  routeTaken?: Coordinate[]
  lastEventDetail?: string
}

export type PlayerSettings = {
  soundEnabled: boolean
  musicEnabled: boolean
  leaderboardOptIn: boolean
  safeHint?: boolean
  hapticsEnabled?: boolean
}
