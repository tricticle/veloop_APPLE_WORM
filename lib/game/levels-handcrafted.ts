import { computeCoordinatePath } from './engine'
import type {
  Coordinate,
  Difficulty,
  Direction,
  GameApple,
  GameLevel,
  GameObstacle,
  ObjectiveType,
} from './types'

export type HandcraftedLevelSpec = {
  id: number
  name: string
  world: string
  difficulty: Difficulty
  rows: string[]
  wormStart?: Coordinate[]
  extraObstacles?: GameObstacle[]
  optimalSolution: Direction[]
  fallbackSolution: Direction[]
  objective?: ObjectiveType
  tutorialHint?: string
  moveLimit?: number
}

export function buildLevelFromSpec(spec: HandcraftedLevelSpec): GameLevel {
  const rowCount = spec.rows.length
  const colCount = spec.rows[0]?.length ?? 7

  let head: Coordinate | null = null
  const bodies: Coordinate[] = []
  let portal: Coordinate | null = null
  const apples: GameApple[] = []
  const obstacles: GameObstacle[] = [...(spec.extraObstacles ?? [])]
  const teleportPads: Record<string, Coordinate[]> = {}
  let birdCounter = 0

  for (let y = 0; y < rowCount; y += 1) {
    const row = spec.rows[y]
    for (let x = 0; x < colCount; x += 1) {
      const ch = row[x]
      const pos = { x, y }
      switch (ch) {
        case 'H':
          head = pos
          break
        case 'B':
          bodies.push(pos)
          break
        case 'P':
          portal = pos
          break
        case 'A':
          apples.push({ ...pos, type: 'normal' })
          break
        case 'G':
          apples.push({ ...pos, type: 'golden' })
          break
        case '#':
          obstacles.push({ ...pos, type: 'wall' })
          break
        case '^':
          obstacles.push({ ...pos, type: 'spike' })
          break
        case '%':
          obstacles.push({ ...pos, type: 'spike', period: 2, activeOffset: 1 })
          break
        case 'o':
          obstacles.push({ ...pos, type: 'pit' })
          break
        case '=':
          obstacles.push({ ...pos, type: 'gate' })
          break
        case 'k':
          obstacles.push({ ...pos, type: 'key', keyId: 'amber-key', color: 'amber' })
          break
        case 'K':
          obstacles.push({ ...pos, type: 'gate', keyId: 'amber-key', color: 'amber' })
          break
        case 'q':
          obstacles.push({ ...pos, type: 'key', keyId: 'emerald-key', color: 'emerald' })
          break
        case 'Q':
          obstacles.push({ ...pos, type: 'gate', keyId: 'emerald-key', color: 'emerald' })
          break
        case 'I':
          obstacles.push({ ...pos, type: 'ice' })
          break
        case 'F':
          obstacles.push({ ...pos, type: 'fragile' })
          break
        case 'R':
          birdCounter += 1
          obstacles.push({ ...pos, type: 'trappedBird', birdId: `bird-${spec.id}-${birdCounter}` })
          break
        case '1':
        case '2': {
          teleportPads['warp-1'] ??= []
          teleportPads['warp-1'].push(pos)
          break
        }
        case '3':
        case '4': {
          teleportPads['warp-2'] ??= []
          teleportPads['warp-2'].push(pos)
          break
        }
        default:
          break
      }
    }
  }

  for (const [pairId, pads] of Object.entries(teleportPads)) {
    if (pads.length === 2) {
      obstacles.push({ ...pads[0], type: 'teleport', pairId, target: { ...pads[1] } })
      obstacles.push({ ...pads[1], type: 'teleport', pairId, target: { ...pads[0] } })
    } else if (pads.length === 1) {
      throw new Error(`Level ${spec.id} teleport pad "${pairId}" must appear in a pair of 2.`)
    }
  }

  const wormStart =
    spec.wormStart ??
    (head && bodies.length
      ? [head, ...bodies]
      : (() => {
          throw new Error(`Level ${spec.id} missing wormStart`)
        })())

  if (!portal) {
    throw new Error(`Level ${spec.id} missing portal 'P'`)
  }

  const normalAppleCount = apples.filter((apple) => apple.type === 'normal').length
  const goldenAppleCount = apples.filter((apple) => apple.type === 'golden').length
  const requiredBirds = obstacles.filter((obs) => obs.type === 'trappedBird').length
  const optimalMoves = spec.optimalSolution.length
  const fallbackMoves = spec.fallbackSolution.length
  const moveLimit = spec.moveLimit ?? Math.max(fallbackMoves + 6, optimalMoves + 10)
  const objective: ObjectiveType =
    spec.objective ?? (requiredBirds > 0 ? 'BIRD_RESCUE' : 'CLASSIC')

  const baseLevel: GameLevel = {
    id: spec.id,
    name: spec.name,
    world: spec.world,
    difficulty: spec.difficulty,
    grid: { rows: rowCount, columns: colCount },
    wormStart,
    apples,
    portal,
    obstacles,
    objective,
    requiredApples: normalAppleCount,
    requiredBirds,
    targetLength: wormStart.length + normalAppleCount,
    moveLimit,
    parMoves: optimalMoves,
    optimalSolution: spec.optimalSolution,
    fallbackSolution: spec.fallbackSolution,
    optimalMoves,
    fallbackMoves,
    starThresholds: {
      threeStars: {
        maxMoves: optimalMoves,
        minGoldenApples: goldenAppleCount,
      },
      twoStars: {
        maxMoves: Math.max(0, fallbackMoves - 1),
      },
    },
    solutionPath: [],
    alternatePath: [],
    tutorialHint: spec.tutorialHint,
    challengeText:
      goldenAppleCount > 0
        ? `Collect ${goldenAppleCount === 1 ? 'the golden apple' : `all ${goldenAppleCount} golden apples`} in ≤ ${optimalMoves} moves for 3★`
        : requiredBirds > 0
          ? `Free ${requiredBirds === 1 ? 'the trapped bird' : `${requiredBirds} birds`} in ≤ ${optimalMoves} moves for 3★`
          : `Reach the portal in ≤ ${optimalMoves} moves for 3★`,
  }

  const optPath = computeCoordinatePath(baseLevel, spec.optimalSolution)
  const altPath = computeCoordinatePath(baseLevel, spec.fallbackSolution)
  baseLevel.solutionPath = optPath
  baseLevel.alternatePath = altPath
  return baseLevel
}

const HANDCRAFTED_SPECS: HandcraftedLevelSpec[] = [
  // 1: Intro dual route (shortcut vs upper scenic loop)
  {
    id: 1,
    name: 'First Bite',
    world: 'The Apple Grove',
    difficulty: 'BEGINNER',
    rows: [
      '#######',
      '#....P#',
      '#.##A.#',
      '#.....#',
      '#..A..#',
      '#H....#',
      '#B#####',
    ],
    tutorialHint: 'Take the tight inner bend for 3★, or loop along the top lane.',
    optimalSolution: ['up', 'right', 'right', 'up', 'right', 'up', 'up', 'right'],
    fallbackSolution: ['up', 'up', 'up', 'up', 'right', 'right', 'right', 'down', 'down', 'down', 'left', 'up', 'left', 'left', 'up', 'up', 'right', 'right', 'right', 'right'],
  },
  // 2: Bramble weave vs outer ring
  {
    id: 2,
    name: 'Fern Fork',
    world: 'The Apple Grove',
    difficulty: 'BEGINNER',
    rows: [
      '#######',
      '#BH...#',
      '#..A#.#',
      '#..^..#',
      '#....A#',
      '#....P#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 1 }, { x: 1, y: 1 }],
    optimalSolution: ['right', 'down', 'left', 'down', 'down', 'right', 'right', 'right', 'down'],
    fallbackSolution: ['right', 'right', 'right', 'down', 'down', 'down', 'left', 'up', 'right', 'up', 'up', 'left', 'left', 'down', 'left', 'down', 'down', 'right', 'right', 'down', 'right'],
  },
  // 3: First Golden Apple (optional to clear, required for 3★)
  {
    id: 3,
    name: 'Golden Detour',
    world: 'The Apple Grove',
    difficulty: 'BEGINNER',
    rows: [
      '#######',
      '#..G..#',
      '#.#.#.#',
      '#H.A.P#',
      '#B#.#.#',
      '#...A.#',
      '#######',
    ],
    tutorialHint: 'Golden apples are optional to clear the level, but required for 3★!',
    optimalSolution: ['up', 'up', 'right', 'right', 'down', 'down', 'down', 'down', 'right', 'right', 'up', 'up'],
    fallbackSolution: ['up', 'down', 'right', 'right', 'right', 'right', 'down', 'down', 'left', 'left', 'left', 'left', 'up', 'up', 'right', 'right', 'right', 'right'],
  },
  // 4: Apple-locked mossy gate shortcut vs wide detour
  {
    id: 4,
    name: 'Mossy Gate',
    world: 'The Apple Grove',
    difficulty: 'BEGINNER',
    rows: [
      '#######',
      '#..=P.#',
      '#A.#..#',
      '#..A..#',
      '#..#..#',
      '#BH...#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    tutorialHint: 'Eat all red apples to unlock the mossy gate shortcut!',
    optimalSolution: ['up', 'up', 'up', 'left', 'down', 'right', 'right', 'right', 'up', 'up'],
    fallbackSolution: ['up', 'up', 'up', 'up', 'down', 'left', 'down', 'right', 'right', 'right', 'up', 'right', 'down', 'left', 'left', 'left', 'up', 'up', 'right', 'right'],
  },
  // 5: First Moving Bird hazard
  {
    id: 5,
    name: 'Swoop Watch',
    world: 'The Apple Grove',
    difficulty: 'BEGINNER',
    rows: [
      '#######',
      '#....P#',
      '#.....#',
      '#..A..#',
      '#.#.#.#',
      '#BH.A.#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    extraObstacles: [
      { x: 3, y: 2, type: 'moving', path: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 2 }] },
    ],
    tutorialHint: 'Forest birds swoop on a steady beat—count turns to slip past!',
    optimalSolution: ['left', 'up', 'up', 'right', 'right', 'down', 'down', 'right', 'right', 'up', 'up', 'up', 'up'],
    fallbackSolution: ['right', 'up', 'up', 'right', 'right', 'down', 'down', 'left', 'left', 'left', 'left', 'up', 'up', 'up', 'up', 'right', 'right', 'right', 'down', 'right', 'up'],
  },
  // 6: Key + Keyed Gate shortcut
  {
    id: 6,
    name: 'Brass Key',
    world: 'The Apple Grove',
    difficulty: 'BEGINNER',
    rows: [
      '#######',
      '#k.#.P#',
      '#..K..#',
      '#A.#.A#',
      '#.....#',
      '#BH...#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    tutorialHint: 'Grab the amber key to unlock the matching brass gate!',
    optimalSolution: ['up', 'up', 'left', 'down', 'right', 'right', 'right', 'up', 'right', 'up', 'up'],
    fallbackSolution: ['up', 'up', 'down', 'right', 'right', 'up', 'right', 'down', 'left', 'left', 'left', 'up', 'left', 'up', 'up', 'right', 'down', 'right', 'right', 'up', 'right'],
  },
  // 7: Pit & Bramble weave with Golden Apple
  {
    id: 7,
    name: 'Twin Hollows',
    world: 'The Apple Grove',
    difficulty: 'BEGINNER',
    rows: [
      '#######',
      '#G...P#',
      '#.o.o.#',
      '#A...A#',
      '#.^.^.#',
      '#BH...#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    optimalSolution: ['right', 'up', 'up', 'up', 'up', 'left', 'left', 'down', 'down', 'right', 'right', 'right', 'right', 'up', 'up'],
    fallbackSolution: ['right', 'up', 'up', 'right', 'right', 'down', 'down', 'left', 'left', 'left', 'left', 'up', 'up', 'right', 'right', 'up', 'up', 'right', 'right'],
  },
  // 8: First Fragile Plank bridge
  {
    id: 8,
    name: 'Fragile Plank',
    world: 'The Apple Grove',
    difficulty: 'BEGINNER',
    rows: [
      '#######',
      '#....P#',
      '#.###.#',
      '#.FAF.#',
      '#.###.#',
      '#BH.A.#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    tutorialHint: 'Fragile planks collapse once your tail leaves them—no turning back!',
    optimalSolution: ['right', 'right', 'right', 'up', 'up', 'left', 'left', 'left', 'left', 'up', 'up', 'right', 'right', 'right', 'right'],
    fallbackSolution: ['right', 'left', 'right', 'right', 'right', 'up', 'up', 'up', 'up', 'left', 'left', 'left', 'left', 'down', 'down', 'right', 'right', 'right', 'right', 'up', 'up'],
  },
  // 9: Keyhole + Golden Apple choice
  {
    id: 9,
    name: 'Gilded Keyhole',
    world: 'The Apple Grove',
    difficulty: 'BEGINNER',
    rows: [
      '#######',
      '#G.K.P#',
      '#..#..#',
      '#k.A.A#',
      '#..#..#',
      '#BH...#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    optimalSolution: ['up', 'up', 'up', 'up', 'left', 'down', 'right', 'down', 'right', 'right', 'right', 'up', 'up'],
    fallbackSolution: ['up', 'up', 'up', 'down', 'right', 'right', 'right', 'down', 'down', 'left', 'left', 'left', 'up', 'up', 'right', 'right', 'up', 'up', 'right'],
  },
  // 10: World 1 Finale — moving bird + apple gate + golden apple
  {
    id: 10,
    name: 'Grove Finale',
    world: 'The Apple Grove',
    difficulty: 'BEGINNER',
    rows: [
      '#######',
      '#G.=.P#',
      '#.....#',
      '#A...A#',
      '#.#.#.#',
      '#BH...#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    extraObstacles: [
      { x: 3, y: 2, type: 'moving', path: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 2 }] },
    ],
    optimalSolution: ['right', 'up', 'up', 'left', 'up', 'up', 'left', 'down', 'down', 'right', 'right', 'right', 'right', 'up', 'up'],
    fallbackSolution: ['left', 'up', 'up', 'right', 'right', 'right', 'right', 'down', 'down', 'left', 'left', 'up', 'up', 'right', 'up', 'up', 'right'],
  },
  // 11: First Ice Slide
  {
    id: 11,
    name: 'Frost Step',
    world: 'Fernwood Forest',
    difficulty: 'EASY',
    rows: [
      '#######',
      '#....P#',
      '#.###.#',
      '#HIII.#',
      '#B#.#.#',
      '#A..A.#',
      '#######',
    ],
    tutorialHint: 'Frost tiles slide you straight ahead until dry ground or a wall!',
    optimalSolution: ['down', 'down', 'right', 'right', 'right', 'right', 'up', 'up', 'up', 'up'],
    fallbackSolution: ['up', 'down', 'down', 'down', 'right', 'right', 'up', 'up', 'right', 'down', 'down', 'left', 'left', 'up', 'up', 'left', 'up', 'up', 'right', 'right', 'right', 'right'],
  },
  // 12: First Paired Teleport Portals
  {
    id: 12,
    name: 'Paired Stones',
    world: 'Fernwood Forest',
    difficulty: 'EASY',
    rows: [
      '#######',
      '#1...2#',
      '#.#.#.#',
      '#A...A#',
      '#.#.#.#',
      '#BH..P#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    tutorialHint: 'Stepping on a glowing rune stone warps you to its twin pad!',
    optimalSolution: ['left', 'up', 'up', 'up', 'up', 'down', 'down', 'down', 'down'],
    fallbackSolution: ['right', 'up', 'up', 'up', 'down', 'right', 'right', 'up', 'up', 'down', 'down', 'down', 'down', 'right', 'right', 'right', 'right'],
  },
  // 13: Timed Bramble Spikes
  {
    id: 13,
    name: 'Thorn Pulse',
    world: 'Fernwood Forest',
    difficulty: 'EASY',
    rows: [
      '#######',
      '#....P#',
      '#.#%#.#',
      '#A...A#',
      '#.#^#.#',
      '#BH...#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    tutorialHint: 'Pulsing brambles retract every other move—step across when dim!',
    optimalSolution: ['left', 'up', 'up', 'right', 'right', 'right', 'right', 'up', 'up'],
    fallbackSolution: ['right', 'right', 'right', 'up', 'down', 'up', 'up', 'left', 'left', 'left', 'left', 'down', 'down', 'right', 'right', 'right', 'right', 'up', 'up', 'up', 'up'],
  },
  // 14: First Bird Rescue
  {
    id: 14,
    name: 'Caged Songbird',
    world: 'Fernwood Forest',
    difficulty: 'EASY',
    objective: 'BIRD_RESCUE',
    rows: [
      '#######',
      '#R...P#',
      '#.F##.#',
      '#A...A#',
      '#.#.#.#',
      '#BH...#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    tutorialHint: 'Free the caged bird friend before the moonlit portal will open!',
    optimalSolution: ['left', 'up', 'up', 'up', 'up', 'right', 'down', 'down', 'right', 'right', 'right', 'up', 'up'],
    fallbackSolution: ['left', 'up', 'up', 'up', 'up', 'right', 'right', 'right', 'right', 'down', 'down', 'down', 'down', 'left', 'left', 'left', 'left', 'up', 'up', 'right', 'right', 'right', 'right', 'up', 'up'],
  },
  // 15: Frost + Paired Teleport + Golden Apple
  {
    id: 15,
    name: 'Glacier Warp',
    world: 'Fernwood Forest',
    difficulty: 'EASY',
    rows: [
      '#######',
      '#1.G.2#',
      '#.###.#',
      '#AIIIA#',
      '#.#.#.#',
      '#BH..P#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    optimalSolution: ['left', 'up', 'up', 'up', 'up', 'left', 'left', 'left', 'left', 'down', 'down', 'down', 'down'],
    fallbackSolution: ['right', 'up', 'up', 'right', 'down', 'down', 'left', 'left', 'up', 'up', 'left', 'down', 'down', 'right', 'right', 'right', 'right'],
  },
  // 16: Twin Keys & Twin Gates
  {
    id: 16,
    name: 'Double Lock',
    world: 'Fernwood Forest',
    difficulty: 'EASY',
    rows: [
      '#######',
      '#k.#.P#',
      '#A.K.Q#',
      '#..#..#',
      '#q.A..#',
      '#BH...#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    optimalSolution: ['up', 'up', 'up', 'left', 'down', 'right', 'down', 'right', 'right', 'up', 'up', 'up', 'right'],
    fallbackSolution: ['up', 'up', 'up', 'up', 'down', 'up', 'left', 'down', 'down', 'down', 'right', 'right', 'right', 'up', 'up', 'right', 'down', 'left', 'up', 'up', 'right'],
  },
  // 17: Shatter Bridge with Golden Apple on Fragile Plank
  {
    id: 17,
    name: 'Shatter Bridge',
    world: 'Fernwood Forest',
    difficulty: 'EASY',
    rows: [
      '#######',
      '#..G.P#',
      '#.F#F.#',
      '#A...A#',
      '#.o#o.#',
      '#BH...#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    optimalSolution: ['right', 'right', 'right', 'up', 'up', 'left', 'left', 'left', 'left', 'up', 'up', 'right', 'right', 'right', 'right'],
    fallbackSolution: ['right', 'right', 'right', 'up', 'up', 'up', 'up', 'left', 'down', 'right', 'down', 'down', 'down', 'left', 'left', 'left', 'left', 'up', 'up', 'right', 'right', 'right', 'right', 'up', 'up'],
  },
  // 18: Twin Bird Rescue past moving bird
  {
    id: 18,
    name: 'Twin Rescue',
    world: 'Fernwood Forest',
    difficulty: 'EASY',
    objective: 'BIRD_RESCUE',
    rows: [
      '#######',
      '#R...R#',
      '#.#.#.#',
      '#A...A#',
      '#.#.#.#',
      '#BH..P#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    extraObstacles: [
      { x: 3, y: 2, type: 'moving', path: [{ x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 3 }] },
    ],
    optimalSolution: ['left', 'up', 'up', 'up', 'up', 'right', 'right', 'right', 'right', 'down', 'down', 'down', 'down'],
    fallbackSolution: ['right', 'right', 'right', 'up', 'down', 'up', 'up', 'up', 'up', 'left', 'left', 'left', 'left', 'down', 'down', 'down', 'down', 'right', 'right', 'right', 'right'],
  },
  // 19: Mirror Brook — ice + timed spike + warp
  {
    id: 19,
    name: 'Mirror Brook',
    world: 'Fernwood Forest',
    difficulty: 'EASY',
    rows: [
      '#######',
      '#1.%.2#',
      '#.#.#.#',
      '#AIIIA#',
      '#.#.#.#',
      '#BH..P#',
      '#######',
    ],
    wormStart: [{ x: 2, y: 5 }, { x: 1, y: 5 }],
    optimalSolution: ['left', 'up', 'up', 'right', 'down', 'down'],
    fallbackSolution: ['right', 'up', 'up', 'up', 'right', 'right', 'right', 'left', 'down', 'down', 'left', 'down', 'down', 'right', 'right', 'right', 'right'],
  },
  // 20: Chapter 2 Finale on 8x8 grid combining key, fragile, golden, bird rescue
  {
    id: 20,
    name: 'Fernwood Crown',
    world: 'Fernwood Forest',
    difficulty: 'EASY',
    objective: 'BIRD_RESCUE',
    rows: [
      '########',
      '#R.G..P#',
      '#.F###.#',
      '#k.K.A.#',
      '#..#.#.#',
      '#A.....#',
      '#BH....#',
      '########',
    ],
    wormStart: [{ x: 2, y: 6 }, { x: 1, y: 6 }],
    optimalSolution: ['up', 'right', 'right', 'up', 'up', 'right', 'right', 'down', 'down', 'left', 'left', 'left', 'left', 'left', 'up', 'up', 'up', 'up', 'right', 'right', 'right', 'right', 'right'],
    fallbackSolution: ['up', 'up', 'down', 'right', 'right', 'up', 'up', 'right', 'right', 'down', 'down', 'left', 'left', 'left', 'left', 'left', 'up', 'right', 'up', 'up', 'up', 'left', 'down', 'right', 'down', 'down', 'down', 'right', 'right', 'up', 'up', 'right', 'right', 'up', 'up'],
  },
]

export const HANDCRAFTED_LEVELS: GameLevel[] = HANDCRAFTED_SPECS.map(buildLevelFromSpec)
