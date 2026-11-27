import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  calculateStars,
  coordKey,
  countGoldenCollected,
  createInitialState,
  findHintDirection,
  moveGame,
  simulateMoves,
} from '../lib/game/engine'
import {
  INVALID_LEVEL_ERRORS,
  LEVELS,
  validateLevelDualPaths,
} from '../lib/game/levels'
import type { GameLevel } from '../lib/game/types'

function makeTestLevel(overrides: Partial<GameLevel>): GameLevel {
  return {
    id: 999,
    name: 'Mechanic Unit Test',
    world: 'Test Grove',
    difficulty: 'BEGINNER',
    grid: { rows: 5, columns: 5 },
    wormStart: [
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    apples: [{ x: 2, y: 2, type: 'normal' }],
    portal: { x: 4, y: 2 },
    obstacles: [],
    objective: 'CLASSIC',
    requiredApples: 1,
    requiredBirds: 0,
    targetLength: 2,
    moveLimit: 20,
    parMoves: 4,
    optimalMoves: 4,
    fallbackMoves: 8,
    optimalSolution: ['right', 'right', 'right'],
    fallbackSolution: ['up', 'right', 'down', 'right', 'right'],
    starThresholds: {
      threeStars: { maxMoves: 4, minGoldenApples: 0 },
      twoStars: { maxMoves: 6 },
    },
    solutionPath: [],
    alternatePath: [],
    challengeText: 'Reach the exit',
    ...overrides,
  }
}

describe('Dual-Path 50-Level Catalog Validation', () => {
  it('includes 50 valid levels with zero module-load validation errors', () => {
    assert.equal(LEVELS.length, 50)
    assert.equal(INVALID_LEVEL_ERRORS.length, 0)
  })

  it('verifies every level has a 3-star optimalSolution strictly better than 1-star fallbackSolution', () => {
    for (const level of LEVELS) {
      const check = validateLevelDualPaths(level)
      assert.equal(check.valid, true, `Level ${level.id} (${level.name}) invalid: ${check.reason}`)

      const opt = simulateMoves(level, level.optimalSolution)
      const fb = simulateMoves(level, level.fallbackSolution)
      assert.equal(opt.state.status, 'completed')
      assert.equal(fb.state.status, 'completed')
      assert.equal(calculateStars(level, opt.state), 3)
      assert.equal(calculateStars(level, fb.state), 1)

      const optGolden = countGoldenCollected(level, opt.state)
      const fbGolden = countGoldenCollected(level, fb.state)
      assert.ok(
        opt.state.moves < fb.state.moves || optGolden > fbGolden,
        `Level ${level.id} optimal is not strictly better than fallback`,
      )
    }
  })

  it('ensures Levels 1-20 are individually authored distinct layouts (no shared templates)', () => {
    const fingerprints = new Set<string>()
    for (const level of LEVELS.slice(0, 20)) {
      const fp = JSON.stringify({
        grid: level.grid,
        wormStart: level.wormStart,
        portal: level.portal,
        apples: level.apples,
        obstacles: level.obstacles,
      })
      assert.equal(fingerprints.has(fp), false, `Level ${level.id} shares an identical layout`)
      fingerprints.add(fp)
    }
  })
})

describe('Run-Based Star Scoring', () => {
  it('awards 3★, 2★ (faster detour or golden detour), 1★ fallback, and 0★ incomplete fairly', () => {
    const level = makeTestLevel({
      apples: [
        { x: 2, y: 2, type: 'normal' },
        { x: 2, y: 1, type: 'golden' },
      ],
      starThresholds: {
        threeStars: { maxMoves: 5, minGoldenApples: 1 },
        twoStars: { maxMoves: 6 },
      },
    })

    const incomplete = createInitialState(level)
    assert.equal(calculateStars(level, incomplete), 0)

    // 3★: <= 5 moves AND golden apple collected
    const threeStarState = {
      ...incomplete,
      moves: 5,
      remainingApples: [],
      status: 'completed' as const,
    }
    assert.equal(calculateStars(level, threeStarState), 3)

    // 2★ via faster route without golden apple (moves <= 6)
    const twoStarFast = {
      ...incomplete,
      moves: 4,
      remainingApples: [{ x: 2, y: 1, type: 'golden' as const }],
      status: 'completed' as const,
    }
    assert.equal(calculateStars(level, twoStarFast), 2)

    // 2★ via slower route WITH golden apple (moves > 6, golden >= 1)
    const twoStarGolden = {
      ...incomplete,
      moves: 8,
      remainingApples: [],
      status: 'completed' as const,
    }
    assert.equal(calculateStars(level, twoStarGolden), 2)

    // 1★ fallback: slower and skipped golden apple
    const oneStarFallback = {
      ...incomplete,
      moves: 9,
      remainingApples: [{ x: 2, y: 1, type: 'golden' as const }],
      status: 'completed' as const,
    }
    assert.equal(calculateStars(level, oneStarFallback), 1)
  })
})

describe('Deterministic New Mechanics', () => {
  it('unlocks color/ID-matched gates only after collecting the matching key', () => {
    const level = makeTestLevel({
      apples: [],
      requiredApples: 0,
      targetLength: 2,
      obstacles: [
        { x: 2, y: 2, type: 'gate', keyId: 'amber-key', color: 'amber' },
        { x: 1, y: 1, type: 'key', keyId: 'amber-key', color: 'amber' },
        { x: 3, y: 1, type: 'gate', keyId: 'emerald-key', color: 'emerald' },
      ],
    })

    let state = createInitialState(level)
    // Blocked by locked amber gate
    const blocked = moveGame(level, state, 'right')
    assert.equal(blocked.event, 'blocked')

    // Collect amber key at (1,1)
    const keyRes = moveGame(level, state, 'up')
    assert.equal(keyRes.event, 'key')
    assert.deepEqual(keyRes.state.collectedKeys, ['amber-key'])
    state = keyRes.state

    // Emerald gate at (3,1) remains locked
    state = moveGame(level, state, 'right').state // (2,1)
    const emeraldBlocked = moveGame(level, state, 'right')
    assert.equal(emeraldBlocked.event, 'blocked')

    // Amber gate at (2,2) is now open!
    const passedGate = moveGame(level, state, 'down')
    assert.equal(passedGate.event, 'moved')
  })

  it('slides deterministically across frost/ice tiles and collects apples in path', () => {
    const level = makeTestLevel({
      grid: { rows: 3, columns: 6 },
      wormStart: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      apples: [{ x: 3, y: 1, type: 'normal' }],
      portal: { x: 5, y: 1 },
      obstacles: [
        { x: 2, y: 1, type: 'ice' },
        { x: 3, y: 1, type: 'ice' },
        { x: 4, y: 1, type: 'wall' },
      ],
    })

    const res = moveGame(level, createInitialState(level), 'right')
    assert.equal(res.state.status, 'playing')
    // Slides across (2,1) and (3,1), collects apple at (3,1), stops cleanly before wall at (4,1)
    assert.deepEqual(res.state.worm[0], { x: 3, y: 1 })
    assert.equal(res.state.collectedApples, 1)
    assert.equal(res.state.moves, 1)
  })

  it('cracks fragile planks on crossing and collapses them into fatal hollows once vacated', () => {
    const level = makeTestLevel({
      grid: { rows: 3, columns: 5 },
      wormStart: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      apples: [],
      requiredApples: 0,
      portal: { x: 4, y: 1 },
      obstacles: [{ x: 2, y: 1, type: 'fragile' }],
    })

    let state = createInitialState(level)
    // Step onto fragile plank at (2,1) -> cracked, still safe
    state = moveGame(level, state, 'right').state
    assert.equal(state.status, 'playing')
    assert.ok(state.crackedTiles?.includes(coordKey({ x: 2, y: 1 })))
    assert.equal(state.collapsedTiles?.includes(coordKey({ x: 2, y: 1 })), false)

    // Step off to (3,1); tail is now at (2,1), so plank should NOT collapse yet
    state = moveGame(level, state, 'right').state
    assert.equal(state.collapsedTiles?.includes(coordKey({ x: 2, y: 1 })), false)

    // Move up to (3,0); tail leaves (2,1) -> plank collapses!
    state = moveGame(level, state, 'up').state
    assert.ok(state.collapsedTiles?.includes(coordKey({ x: 2, y: 1 })))

    // Step left to (2,0), then down onto collapsed hollow (2,1) -> pit failure
    state = moveGame(level, state, 'left').state
    const failRes = moveGame(level, state, 'down')
    assert.equal(failRes.event, 'failed')
    assert.equal(failRes.state.failureCause, 'pit')
  })

  it('warps seamlessly across paired teleport pads and checks tail occupancy', () => {
    const level = makeTestLevel({
      grid: { rows: 4, columns: 5 },
      wormStart: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      apples: [],
      requiredApples: 0,
      portal: { x: 4, y: 3 },
      obstacles: [
        { x: 2, y: 1, type: 'teleport', pairId: 'warp-1', target: { x: 3, y: 3 } },
        { x: 3, y: 3, type: 'teleport', pairId: 'warp-1', target: { x: 2, y: 1 } },
      ],
    })

    const warpRes = moveGame(level, createInitialState(level), 'right')
    assert.equal(warpRes.event, 'teleport')
    assert.deepEqual(warpRes.state.worm[0], { x: 3, y: 3 })
    assert.deepEqual(warpRes.state.worm[1], { x: 1, y: 1 })

    const clearRes = moveGame(level, warpRes.state, 'right')
    assert.equal(clearRes.event, 'completed')
  })

  it('enforces timed pulsing spikes and moving bird patrols deterministically', () => {
    const level = makeTestLevel({
      grid: { rows: 4, columns: 5 },
      wormStart: [
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ],
      apples: [],
      requiredApples: 0,
      portal: { x: 4, y: 2 },
      obstacles: [
        // Active on odd turns (turn 1, 3, ...), dormant on even turns (turn 2, 4, ...)
        { x: 2, y: 2, type: 'spike', period: 2, activeOffset: 1 },
        {
          x: 3,
          y: 1,
          type: 'moving',
          path: [
            { x: 3, y: 1 },
            { x: 3, y: 2 },
          ],
        },
      ],
    })

    // Turn 1 direct onto timed spike -> fails
    const failSpike = moveGame(level, createInitialState(level), 'right')
    assert.equal(failSpike.event, 'failed')
    assert.equal(failSpike.state.failureCause, 'thorn')

    // Step down then up? Wait: move 1 down (1,3), move 2 right (2,3), move 3 up onto (2,2) would be odd.
    // Instead move down (turn 1: 1,3), up (turn 2: 1,2), wait... turn 3 on (2,2) is still odd!
    // Move up (turn 1: 1,1), right? No, let's do: up (turn 1: 1,1), down (turn 2: 1,2) -> no, right from (1,2) is turn 3!
    // One move of parity change: e.g. up (1,1) [t=1], right (2,1) [t=2], down (2,2) [t=3 is odd].
    // Wait: grid parity! (1,2) -> (2,2) changes parity, so from (1,2) reaching (2,2) always takes odd moves unless sliding/looping!
    // Let's test dormant spike on even turn by placing wormStart at (2,1) for turn 2 test:
    const evenLevel = makeTestLevel({
      grid: { rows: 4, columns: 5 },
      wormStart: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      apples: [],
      requiredApples: 0,
      portal: { x: 4, y: 2 },
      obstacles: [{ x: 2, y: 2, type: 'spike', period: 2, activeOffset: 1 }],
    })
    // Turn 1: right -> (2,1), Turn 2 (even): down -> (2,2) dormant spike -> safe!
    const s1 = moveGame(evenLevel, createInitialState(evenLevel), 'right').state
    const s2 = moveGame(evenLevel, s1, 'down')
    assert.equal(s2.event, 'moved')
    assert.deepEqual(s2.state.worm[0], { x: 2, y: 2 })

    // Moving bird swoop test: path is [(3,1), (3,2)].
    // Turn 1: up -> (1,1) (bird at (3,2))
    // Turn 2: right -> (2,1) (bird at (3,1))
    const s1b = moveGame(level, createInitialState(level), 'up').state
    const s2b = moveGame(level, s1b, 'right').state
    // Turn 3: bird moves to (3,2), so stepping right onto (3,1) is clear
    const s3Clear = moveGame(level, s2b, 'right')
    assert.equal(s3Clear.event, 'moved')
    // Turn 4: bird swoops back onto (3,1) while worm tail occupies (3,1) -> bird hazard!
    const s4Swoop = moveGame(level, s3Clear.state, 'down')
    assert.equal(s4Swoop.event, 'failed')
    assert.equal(s4Swoop.state.failureCause, 'bird')

    // Also verify stepping directly onto the bird's position on its active turn is blocked:
    const directBlockLevel = makeTestLevel({
      grid: { rows: 3, columns: 5 },
      wormStart: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
      apples: [],
      requiredApples: 0,
      portal: { x: 4, y: 2 },
      obstacles: [
        {
          x: 3,
          y: 1,
          type: 'moving',
          path: [
            { x: 3, y: 1 },
            { x: 3, y: 2 },
          ],
        },
      ],
    })
    // Turn 1: bird moves to path[1] = (3,2); stepping right into (3,2) is blocked
    const directBlock = moveGame(directBlockLevel, createInitialState(directBlockLevel), 'right')
    assert.equal(directBlock.event, 'blocked')
  })

  it('requires rescuing trapped birds before unlocking the exit portal', () => {
    const level = makeTestLevel({
      grid: { rows: 3, columns: 5 },
      wormStart: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      apples: [],
      requiredApples: 0,
      requiredBirds: 1,
      objective: 'BIRD_RESCUE',
      portal: { x: 4, y: 1 },
      obstacles: [{ x: 2, y: 0, type: 'trappedBird', birdId: 'bird-1' }],
    })

    let state = createInitialState(level)
    // Walking straight to portal before rescuing bird returns incomplete-portal
    state = moveGame(level, state, 'right').state // (2,1)
    state = moveGame(level, state, 'right').state // (3,1)
    const sealed = moveGame(level, state, 'right') // (4,1)
    assert.equal(sealed.event, 'incomplete-portal')
    assert.equal(sealed.state.status, 'playing')

    // Go rescue trapped bird at (2,0) then return to portal
    state = createInitialState(level)
    state = moveGame(level, state, 'up').state // (1,0)
    const rescueRes = moveGame(level, state, 'right') // (2,0)
    assert.equal(rescueRes.event, 'rescue')
    assert.deepEqual(rescueRes.state.rescuedBirds, ['bird-1'])

    state = moveGame(level, rescueRes.state, 'right').state // (3,0)
    state = moveGame(level, state, 'right').state // (4,0)
    const winRes = moveGame(level, state, 'down') // (4,1)
    assert.equal(winRes.event, 'completed')
  })

  it('tracks combo streak scoring and optimal vs safe hint modes', () => {
    const level1 = LEVELS[0]
    const init = createInitialState(level1)
    assert.equal(findHintDirection(level1, init, 'optimal'), level1.optimalSolution[0])
    assert.equal(findHintDirection(level1, init, 'safe'), level1.fallbackSolution[0])

    // Combo score check across consecutive apples
    const comboLevel = makeTestLevel({
      apples: [
        { x: 2, y: 2, type: 'normal' },
        { x: 3, y: 2, type: 'golden' },
      ],
      requiredApples: 1,
    })
    const afterFirst = moveGame(comboLevel, createInitialState(comboLevel), 'right')
    assert.equal(afterFirst.state.combo, 1)
    assert.equal(afterFirst.state.lastComboPoints, 10)

    const afterSecond = moveGame(comboLevel, afterFirst.state, 'right')
    assert.equal(afterSecond.state.combo, 2)
    assert.equal(afterSecond.state.lastComboPoints, 55) // 50 golden + 5 streak
    assert.equal(afterSecond.state.score, 65)
  })
})
