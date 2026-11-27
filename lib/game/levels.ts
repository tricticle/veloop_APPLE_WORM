import {
  calculateStars,
  countGoldenCollected,
  getForestBugPosition,
  simulateMoves,
} from './engine'
import {
  buildLevelFromSpec,
  HANDCRAFTED_LEVELS,
  type HandcraftedLevelSpec,
} from './levels-handcrafted'
import type { Difficulty, GameLevel } from './types'

export { getForestBugPosition }
export type {
  AppleType,
  Coordinate,
  Difficulty,
  Direction,
  GameApple,
  GameLevel,
  GameObstacle,
  ObjectiveType,
  ObstacleType,
  StarThresholds,
} from './types'

const difficultyFor = (id: number): Difficulty => {
  if (id <= 10) return 'BEGINNER'
  if (id <= 20) return 'EASY'
  if (id <= 30) return 'MEDIUM'
  if (id <= 40) return 'HARD'
  return 'EXPERT'
}

const worldFor = (id: number): string => {
  if (id <= 10) return 'The Apple Grove'
  if (id <= 20) return 'Fernwood Forest'
  if (id <= 30) return 'Mosslight Meadow'
  if (id <= 40) return 'Bramble Ridge'
  return 'The Golden Canopy'
}

const PROCEDURAL_NAMES = [
  'Dewdrop Crossing',
  'Clover Bend',
  'Lantern Reed',
  'Sunbeam Hollow',
  'Willow Drift',
  'Pebble Skip',
  'Moss Arch',
  'Honeycomb Glade',
  'Songbird Perch',
  'Meadow Crown',
  'Thornback Pass',
  'Amber Lock',
  'Briar Leap',
  'Ember Warp',
  'Bramble Ford',
  'Frostbite Ridge',
  'Shatter Spur',
  'Falcon Watch',
  'Stoneheart Key',
  'Ridge Summit',
  'Canopy Spire',
  'Gilded Bough',
  'Starlight Reed',
  'Emerald Gate',
  'Skybridge Plank',
  'Suncrest Warp',
  'Gale Perch',
  'Twin Crown',
  'Moonlit Vault',
  'Heart of the Grove',
]

/**
 * Builds 30 distinct, non-templated dual-path levels for Levels 21–50 across
 * 12 varied 7x7 and 8x8 mechanic archetypes, each with verified 3★ optimal and
 * 1★ fallback solutions.
 */
function buildAdvancedLevel(id: number): GameLevel {
  const index = id - 21 // 0..29
  const name = PROCEDURAL_NAMES[index] ?? `Wild Trail ${id}`
  const world = worldFor(id)
  const difficulty = difficultyFor(id)
  const archetype = index % 12

  const specs: Array<() => HandcraftedLevelSpec> = [
    // 0: 7x7 Frost Slide + Optional Golden Apple + Timed Spike
    () => ({
      id,
      name,
      world,
      difficulty,
      rows: [
        '#######',
        '#..G.P#',
        '#.#%#.#',
        '#AIIIA#',
        '#.#.#.#',
        '#BH...#',
        '#######',
      ],
      wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
      optimalSolution: ['right', 'right', 'right', 'up', 'up', 'left', 'up', 'up', 'right', 'right', 'right', 'right'],
      fallbackSolution: ['right', 'up', 'down', 'right', 'right', 'up', 'up', 'left', 'down', 'down', 'right', 'right', 'right', 'right', 'up', 'up', 'left', 'down', 'down', 'right', 'right', 'right', 'right', 'up', 'up', 'up', 'up'],
    }),
    // 1: 8x8 Key + Gate Shortcut + Golden Apple
    () => ({
      id,
      name,
      world,
      difficulty,
      rows: [
        '########',
        '#k..K.P#',
        '#.#.#..#',
        '#A..G.A#',
        '#.#.#..#',
        '#......#',
        '#BH....#',
        '########',
      ],
      wormStart: [{ x: 2, y: 6 }, { x: 1, y: 6 }],
      optimalSolution: ['up', 'left', 'up', 'up', 'right', 'right', 'right', 'right', 'right', 'up', 'up'],
      fallbackSolution: ['up', 'right', 'up', 'up', 'left', 'left', 'up', 'up', 'right', 'right', 'right', 'right', 'right', 'down', 'down', 'down', 'down', 'left', 'left', 'left', 'up', 'up', 'up', 'up', 'right', 'right', 'right'],
    }),
    // 2: 7x7 Key + Gate Shortcut + Golden Apple
    () => ({
      id,
      name,
      world,
      difficulty,
      rows: [
        '#######',
        '#k.K.P#',
        '#.#.#.#',
        '#A.G.A#',
        '#.#.#.#',
        '#BH...#',
        '#######',
      ],
      wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
      optimalSolution: ['left', 'up', 'up', 'right', 'right', 'right', 'right', 'up', 'up'],
      fallbackSolution: ['right', 'left', 'left', 'up', 'up', 'up', 'up', 'right', 'right', 'right', 'right', 'down', 'down', 'down', 'down', 'left', 'left', 'left', 'left', 'up', 'up', 'up', 'up', 'right', 'right', 'right', 'right'],
    }),
    // 3: 8x8 Fragile Bridge + Bird Rescue + Moving Swoop Bird
    () => ({
      id,
      name,
      world,
      difficulty,
      objective: 'BIRD_RESCUE',
      rows: [
        '########',
        '#R.G..P#',
        '#.F##F.#',
        '#A....A#',
        '#.#.#..#',
        '#......#',
        '#BH....#',
        '########',
      ],
      wormStart: [{ x: 2, y: 6 }, { x: 1, y: 6 }],
      extraObstacles: [
        { x: 4, y: 3, type: 'moving', path: [{ x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 4 }] },
      ],
      optimalSolution: ['up', 'left', 'up', 'up', 'up', 'up', 'right', 'right', 'right', 'right', 'right', 'down', 'down', 'left', 'up', 'up', 'right'],
      fallbackSolution: ['up', 'right', 'up', 'up', 'right', 'right', 'up', 'down', 'left', 'left', 'down', 'up', 'left', 'up', 'up', 'left', 'down', 'down', 'right', 'right', 'right', 'right', 'down', 'down', 'down', 'right', 'up', 'up', 'up', 'up', 'up'],
    }),
    // 4: 7x7 Fragile Bridge + Bird Rescue + Golden Apple
    () => ({
      id,
      name,
      world,
      difficulty,
      objective: 'BIRD_RESCUE',
      rows: [
        '#######',
        '#R...P#',
        '#.F#F.#',
        '#A.G.A#',
        '#.#.#.#',
        '#BH...#',
        '#######',
      ],
      wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
      optimalSolution: ['left', 'up', 'up', 'up', 'up', 'right', 'down', 'down', 'right', 'right', 'right', 'up', 'up'],
      fallbackSolution: ['right', 'up', 'down', 'right', 'right', 'up', 'up', 'up', 'up', 'left', 'down', 'right', 'up', 'left', 'left', 'left', 'left', 'down', 'down', 'down', 'down', 'right', 'right', 'right', 'right', 'up', 'up', 'up', 'up'],
    }),
    // 5: 8x8 Paired Teleports + Key + Golden Apple
    () => ({
      id,
      name,
      world,
      difficulty,
      rows: [
        '########',
        '#1.G.K.#',
        '#.##.#.#',
        '#A..k.P#',
        '#.##.#.#',
        '#..2..A#',
        '#BH....#',
        '########',
      ],
      wormStart: [{ x: 2, y: 6 }, { x: 1, y: 6 }],
      optimalSolution: ['up', 'right', 'right', 'right', 'right', 'down', 'down', 'left', 'left', 'left', 'up', 'up', 'right', 'right', 'right', 'up', 'up'],
      fallbackSolution: ['up', 'right', 'right', 'left', 'right', 'right', 'right', 'down', 'left', 'up', 'left', 'left', 'down', 'down', 'right', 'right', 'right', 'up', 'up', 'right', 'right', 'down', 'down'],
    }),
    // 6: 7x7 Paired Teleports + Mossy Gate + Golden Apple
    () => ({
      id,
      name,
      world,
      difficulty,
      rows: [
        '#######',
        '#1.G.2#',
        '#.#.#.#',
        '#A.=.A#',
        '#.#.#.#',
        '#BH..P#',
        '#######',
      ],
      wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
      optimalSolution: ['left', 'up', 'up', 'up', 'up', 'left', 'left', 'left', 'left', 'down', 'down', 'down', 'down'],
      fallbackSolution: ['right', 'up', 'down', 'right', 'right', 'up', 'up', 'up', 'up', 'down', 'down', 'right', 'right', 'right', 'right', 'down', 'down'],
    }),
    // 7: 8x8 Dual Keys + Ice Lane + Fragile Shortcut
    () => ({
      id,
      name,
      world,
      difficulty,
      rows: [
        '########',
        '#k.K.Q.#',
        '#.#.#..#',
        '#AIIIA.#',
        '#.#.#..#',
        '#q.F..P#',
        '#BH....#',
        '########',
      ],
      wormStart: [{ x: 2, y: 6 }, { x: 1, y: 6 }],
      optimalSolution: ['up', 'left', 'up', 'up', 'right', 'right', 'down', 'down'],
      fallbackSolution: ['up', 'down', 'right', 'right', 'up', 'right', 'up', 'up', 'left', 'up', 'up', 'right', 'right', 'down', 'down', 'down', 'right', 'down', 'left', 'up', 'up', 'up', 'up', 'left', 'left', 'down', 'down', 'right', 'right', 'down', 'down'],
    }),
    // 8: 7x7 Key + Fragile + Ice
    () => ({
      id,
      name,
      world,
      difficulty,
      rows: [
        '#######',
        '#k.K.P#',
        '#.F#..#',
        '#A.I.A#',
        '#.#.#.#',
        '#BH...#',
        '#######',
      ],
      wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
      optimalSolution: ['left', 'up', 'up', 'right', 'right', 'right', 'up', 'up'],
      fallbackSolution: ['right', 'up', 'up', 'right', 'up', 'down', 'left', 'left', 'up', 'up', 'right', 'right', 'right', 'down', 'down', 'left', 'left', 'down', 'down', 'right', 'right', 'right', 'right', 'up', 'up', 'up', 'up'],
    }),
    // 9: 8x8 Double Bird Rescue + Golden Apple + Timed Spikes + Hollows
    () => ({
      id,
      name,
      world,
      difficulty,
      objective: 'BIRD_RESCUE',
      rows: [
        '########',
        '#R....R#',
        '#.#%##.#',
        '#A.G..A#',
        '#.o##o.#',
        '#......#',
        '#BH...P#',
        '########',
      ],
      wormStart: [{ x: 2, y: 6 }, { x: 1, y: 6 }],
      optimalSolution: ['up', 'right', 'right', 'right', 'right', 'up', 'up', 'up', 'up', 'left', 'left', 'left', 'left', 'left', 'down', 'down', 'right', 'right', 'right', 'right', 'right', 'down', 'down', 'down'],
      fallbackSolution: ['up', 'right', 'right', 'right', 'right', 'up', 'down', 'up', 'up', 'up', 'up', 'left', 'left', 'left', 'left', 'left', 'down', 'down', 'down', 'down', 'right', 'right', 'right', 'right', 'right', 'down'],
    }),
    // 10: 7x7 Double Bird Rescue + Timed Spikes + Golden Apple
    () => ({
      id,
      name,
      world,
      difficulty,
      objective: 'BIRD_RESCUE',
      rows: [
        '#######',
        '#R...R#',
        '#.#%#.#',
        '#A.G.A#',
        '#.#.#.#',
        '#BH..P#',
        '#######',
      ],
      wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
      optimalSolution: ['right', 'up', 'up', 'left', 'left', 'up', 'up', 'right', 'right', 'right', 'right', 'down', 'down', 'down', 'down'],
      fallbackSolution: ['right', 'up', 'down', 'right', 'right', 'up', 'up', 'up', 'up', 'left', 'left', 'left', 'left', 'down', 'down', 'down', 'down', 'right', 'right', 'right', 'right'],
    }),
    // 11: 8x8 Frost + Warp + Golden Apple + Timed Spike
    () => ({
      id,
      name,
      world,
      difficulty,
      rows: [
        '########',
        '#1.G..P#',
        '#.##.#.#',
        '#AIIIA.#',
        '#.#%#..#',
        '#..2..A#',
        '#BH....#',
        '########',
      ],
      wormStart: [{ x: 2, y: 6 }, { x: 1, y: 6 }],
      optimalSolution: ['up', 'right', 'down', 'down', 'right', 'right', 'down', 'down', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right'],
      fallbackSolution: ['up', 'down', 'up', 'left', 'up', 'up', 'up', 'up', 'right', 'right', 'right', 'up', 'up', 'up', 'up', 'left', 'left', 'down', 'down', 'right', 'right', 'up', 'up'],
    }),
  ]

  return buildLevelFromSpec(specs[archetype]())
}

export const LEVELS: GameLevel[] = [
  ...HANDCRAFTED_LEVELS,
  ...Array.from({ length: 30 }, (_, index) => buildAdvancedLevel(index + 21)),
]

export function getLevel(levelId: number): GameLevel {
  const level = LEVELS[levelId - 1]
  if (!level) throw new Error(`Level ${levelId} not found`)
  return level
}

export type LevelValidationResult = {
  valid: boolean
  reason?: string
}

/**
 * Strictly validates BOTH optimalSolution (3★) and fallbackSolution (1★)
 * by simulating every move through the pure game engine.
 */
export function validateLevelDualPaths(level: GameLevel): LevelValidationResult {
  if (!level.optimalSolution.length || !level.fallbackSolution.length) {
    return { valid: false, reason: 'missing optimalSolution or fallbackSolution' }
  }

  const optimalResult = simulateMoves(level, level.optimalSolution)
  if (optimalResult.state.status !== 'completed') {
    return {
      valid: false,
      reason: `optimalSolution failed to complete (${optimalResult.state.failureCause ?? optimalResult.event}: ${optimalResult.state.feedback})`,
    }
  }
  const optimalStars = calculateStars(level, optimalResult.state)
  if (optimalStars !== 3) {
    return {
      valid: false,
      reason: `optimalSolution earned ${optimalStars}★ instead of 3★ (moves=${optimalResult.state.moves}, maxMoves=${level.starThresholds.threeStars.maxMoves})`,
    }
  }

  const fallbackResult = simulateMoves(level, level.fallbackSolution)
  if (fallbackResult.state.status !== 'completed') {
    return {
      valid: false,
      reason: `fallbackSolution failed to complete (${fallbackResult.state.failureCause ?? fallbackResult.event}: ${fallbackResult.state.feedback})`,
    }
  }
  const fallbackStars = calculateStars(level, fallbackResult.state)
  if (fallbackStars !== 1) {
    return {
      valid: false,
      reason: `fallbackSolution earned ${fallbackStars}★ instead of 1★ (moves=${fallbackResult.state.moves}, twoStarMax=${level.starThresholds.twoStars.maxMoves})`,
    }
  }

  const optimalGolden = countGoldenCollected(level, optimalResult.state)
  const fallbackGolden = countGoldenCollected(level, fallbackResult.state)
  const strictlyBetter =
    optimalResult.state.moves < fallbackResult.state.moves ||
    optimalGolden > fallbackGolden

  if (!strictlyBetter) {
    return {
      valid: false,
      reason: `optimalSolution is not strictly better than fallbackSolution (optMoves=${optimalResult.state.moves}, fbMoves=${fallbackResult.state.moves}, optGolden=${optimalGolden}, fbGolden=${fallbackGolden})`,
    }
  }

  return { valid: true }
}

export function isLevelSolvable(level: GameLevel): boolean {
  return validateLevelDualPaths(level).valid
}

export const INVALID_LEVEL_ERRORS = LEVELS.map((level) => ({
  id: level.id,
  name: level.name,
  ...validateLevelDualPaths(level),
})).filter((entry) => !entry.valid)

export const INVALID_LEVEL_IDS = INVALID_LEVEL_ERRORS.map((entry) => entry.id)

if (INVALID_LEVEL_ERRORS.length) {
  const details = INVALID_LEVEL_ERRORS.map(
    (entry) => `Level ${entry.id} (${entry.name}): ${entry.reason}`,
  ).join('; ')
  throw new Error(`Invalid level data detected — ${details}`)
}
