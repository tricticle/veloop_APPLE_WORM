'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db, ensureExtendedSchema } from '@/lib/db'
import {
  economyConfigs,
  gameProfiles,
  gameSessions,
  levelProgress,
  rewardTransactions,
  walletTransactions,
} from '@/lib/db/schema'
import { readEconomyConfig } from '@/lib/game/economy-config'
import {
  calculateStars,
  createInitialState,
  DIRECTIONS,
  moveGame,
  type Direction,
  type GameState,
  type PlayerSettings,
} from '@/lib/game/engine'
import { getLevel } from '@/lib/game/levels'

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

function classifyRouteType(stars: number): string {
  if (stars >= 3) return 'OPTIMAL_3_STAR'
  if (stars === 2) return 'SCENIC_2_STAR'
  return 'FALLBACK_1_STAR'
}

export async function startGameAction(levelId: number, previousSessionId?: string) {
  const userId = await requireUserId()
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > 50) throw new Error('Invalid level')
  await ensureExtendedSchema()
  const level = getLevel(levelId)

  await db.insert(gameProfiles).values({ userId }).onConflictDoNothing()
  const [profile] = await db.select().from(gameProfiles).where(eq(gameProfiles.userId, userId)).limit(1)
  if (!profile || levelId > Math.min(50, profile.currentLevel)) throw new Error('Level is locked')

  if (previousSessionId) {
    await db
      .update(gameSessions)
      .set({ status: 'RESTARTED', updatedAt: new Date() })
      .where(
        and(
          eq(gameSessions.id, previousSessionId),
          eq(gameSessions.userId, userId),
          eq(gameSessions.status, 'ACTIVE'),
        ),
      )
  }

  const id = randomUUID()
  const initialState = createInitialState(level)
  await db.insert(gameSessions).values({
    id,
    userId,
    levelId,
    status: 'ACTIVE',
    usedUndo: false,
    state: { current: initialState, history: [] },
    checkpointState: initialState,
  })

  return { sessionId: id, state: initialState, history: [] as GameState[] }
}

export async function moveGameAction(sessionId: string, direction: Direction) {
  const userId = await requireUserId()
  if (typeof sessionId !== 'string' || sessionId.length > 64) throw new Error('Invalid session')
  if (!DIRECTIONS.includes(direction)) throw new Error('Invalid direction')
  await ensureExtendedSchema()

  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(gameSessions)
      .where(and(eq(gameSessions.id, sessionId), eq(gameSessions.userId, userId)))
      .for('update')
      .limit(1)
    if (!session) throw new Error('Game session not found')

    const stored = session.state
    if (session.status !== 'ACTIVE') {
      return { state: stored.current, history: stored.history, event: 'blocked' as const }
    }

    const level = getLevel(session.levelId)
    const currentWithUndo: GameState = {
      ...stored.current,
      usedUndo: Boolean(session.usedUndo || stored.current.usedUndo),
    }
    const result = moveGame(level, currentWithUndo, direction)
    const acceptedMove = [
      'moved',
      'apple',
      'key',
      'teleport',
      'ice',
      'rescue',
      'incomplete-portal',
      'completed',
    ].includes(result.event)
    const history = acceptedMove ? [...stored.history, currentWithUndo].slice(-60) : stored.history
    const isFailed = result.state.status === 'failed'
    const isComplete = result.event === 'completed'
    const serverStars = isComplete ? calculateStars(level, result.state) : null

    await tx
      .update(gameSessions)
      .set({
        state: { current: result.state, history },
        checkpointState: isFailed ? session.checkpointState : result.state,
        moveCount: result.state.moves,
        score: result.state.score,
        applesCollected: result.state.collectedApples,
        starsEarned: serverStars,
        status: isFailed ? 'FAILED' : isComplete ? 'COMPLETED' : 'ACTIVE',
        updatedAt: new Date(),
        completedAt: isComplete ? new Date() : null,
      })
      .where(and(eq(gameSessions.id, sessionId), eq(gameSessions.userId, userId)))

    if (!isComplete) return { state: result.state, history, event: result.event }

    const [profile] = await tx
      .select()
      .from(gameProfiles)
      .where(eq(gameProfiles.userId, userId))
      .for('update')
      .limit(1)
    if (!profile) throw new Error('Player profile not found')

    const [previousProgress] = await tx
      .select()
      .from(levelProgress)
      .where(and(eq(levelProgress.userId, userId), eq(levelProgress.levelId, session.levelId)))
      .limit(1)
    const [configRow] = await tx
      .select()
      .from(economyConfigs)
      .where(eq(economyConfigs.configKey, 'default'))
      .limit(1)
    const economy = readEconomyConfig(configRow?.config)
    const firstCompletion = !previousProgress?.completedAt
    const rewardCoins = firstCompletion ? economy.levelCompletionCoins : 0
    const stars = serverStars ?? calculateStars(level, result.state)
    const nextCoins = profile.coins + rewardCoins
    const nextLevel = Math.min(50, Math.max(profile.currentLevel, session.levelId + 1))
    const bestScore = Math.max(previousProgress?.score ?? 0, result.state.score)
    const bestStars = Math.max(previousProgress?.stars ?? 0, stars)
    const bestMoves =
      previousProgress?.bestMoves == null
        ? result.state.moves
        : Math.min(previousProgress.bestMoves, result.state.moves)
    const scoreIncrease = Math.max(0, bestScore - (previousProgress?.score ?? 0))
    const starIncrease = Math.max(0, bestStars - (previousProgress?.stars ?? 0))
    const clearedWithoutUndo = !session.usedUndo && !result.state.usedUndo
    const newlyNoUndo = clearedWithoutUndo && !previousProgress?.noUndoClear
    const rescuedInRun = result.state.rescuedBirds?.length ?? 0
    const addedBirds = firstCompletion ? rescuedInRun : 0
    const nextNoUndoClears = profile.noUndoClears + (newlyNoUndo ? 1 : 0)
    const nextBirdsRescued = profile.birdsRescued + addedBirds
    const nextBestRouteType = classifyRouteType(bestStars)

    await tx
      .update(gameProfiles)
      .set({
        currentLevel: nextLevel,
        totalScore: profile.totalScore + scoreIncrease,
        totalStars: profile.totalStars + starIncrease,
        coins: nextCoins,
        applesCollected:
          profile.applesCollected + (firstCompletion ? result.state.collectedApples : 0),
        noUndoClears: nextNoUndoClears,
        birdsRescued: nextBirdsRescued,
        updatedAt: new Date(),
      })
      .where(eq(gameProfiles.userId, userId))

    if (previousProgress) {
      await tx
        .update(levelProgress)
        .set({
          stars: bestStars,
          score: bestScore,
          bestMoves,
          bestRouteType: nextBestRouteType,
          noUndoClear: Boolean(previousProgress.noUndoClear || clearedWithoutUndo),
          completedAt: previousProgress.completedAt ?? new Date(),
        })
        .where(and(eq(levelProgress.userId, userId), eq(levelProgress.levelId, session.levelId)))
    } else {
      await tx.insert(levelProgress).values({
        userId,
        levelId: session.levelId,
        stars,
        score: result.state.score,
        bestMoves: result.state.moves,
        bestRouteType: classifyRouteType(stars),
        noUndoClear: clearedWithoutUndo,
        completedAt: new Date(),
      })
    }

    if (rewardCoins > 0) {
      await tx.insert(walletTransactions).values({
        id: randomUUID(),
        userId,
        type: 'LEVEL_REWARD',
        amount: rewardCoins,
        balanceBefore: profile.coins,
        balanceAfter: nextCoins,
        source: 'LEVEL_COMPLETION',
        referenceId: session.id,
      })
      await tx.insert(rewardTransactions).values({
        id: randomUUID(),
        userId,
        sessionId,
        levelId: session.levelId,
        rewardType: 'LEVEL_REWARD',
        amount: rewardCoins,
        multiplier: 1,
        source: 'LEVEL_COMPLETION',
        status: 'GRANTED',
      })
    }

    return {
      state: result.state,
      history,
      event: result.event,
      completion: {
        stars,
        rewardCoins,
        balance: nextCoins,
        score: result.state.score,
        firstCompletion,
        currentLevel: nextLevel,
        noUndo: clearedWithoutUndo,
        profile: {
          coins: nextCoins,
          totalScore: profile.totalScore + scoreIncrease,
          totalStars: profile.totalStars + starIncrease,
          applesCollected:
            profile.applesCollected + (firstCompletion ? result.state.collectedApples : 0),
          rewardedAdsWatched: profile.rewardedAdsWatched,
          noUndoClears: nextNoUndoClears,
          birdsRescued: nextBirdsRescued,
          settings: profile.settings,
          currentLevel: nextLevel,
        },
      },
    }
  })
}

export async function undoGameAction(sessionId: string) {
  const userId = await requireUserId()
  if (typeof sessionId !== 'string' || sessionId.length > 64) throw new Error('Invalid session')
  await ensureExtendedSchema()

  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(gameSessions)
      .where(and(eq(gameSessions.id, sessionId), eq(gameSessions.userId, userId)))
      .for('update')
      .limit(1)
    if (!session || !['ACTIVE', 'FAILED'].includes(session.status)) {
      throw new Error('Game session cannot be undone')
    }

    const stored = session.state
    const previous = stored.history.at(-1)
    if (session.status === 'FAILED' && !previous) {
      const state: GameState = {
        ...stored.current,
        status: 'playing',
        failureCause: null,
        usedUndo: true,
        feedback: 'Last move undone.',
      }
      await tx
        .update(gameSessions)
        .set({
          state: { current: state, history: stored.history },
          usedUndo: true,
          status: 'ACTIVE',
          updatedAt: new Date(),
        })
        .where(and(eq(gameSessions.id, sessionId), eq(gameSessions.userId, userId)))
      return { state, history: stored.history }
    }
    if (!previous) return { state: stored.current, history: stored.history }
    const history = stored.history.slice(0, -1)
    const restored: GameState = {
      ...previous,
      usedUndo: true,
      feedback: 'Step undone.',
    }
    await tx
      .update(gameSessions)
      .set({
        state: { current: restored, history },
        checkpointState: restored,
        moveCount: restored.moves,
        score: restored.score,
        applesCollected: restored.collectedApples,
        usedUndo: true,
        status: 'ACTIVE',
        updatedAt: new Date(),
      })
      .where(and(eq(gameSessions.id, sessionId), eq(gameSessions.userId, userId)))
    return { state: restored, history }
  })
}

export async function updatePlayerSettingsAction(settings: PlayerSettings) {
  const userId = await requireUserId()
  if (
    typeof settings?.soundEnabled !== 'boolean' ||
    typeof settings?.musicEnabled !== 'boolean' ||
    typeof settings?.leaderboardOptIn !== 'boolean'
  ) {
    throw new Error('Invalid settings')
  }
  await ensureExtendedSchema()
  const sanitized: PlayerSettings = {
    soundEnabled: settings.soundEnabled,
    musicEnabled: settings.musicEnabled,
    leaderboardOptIn: settings.leaderboardOptIn,
    safeHint: Boolean(settings.safeHint),
    hapticsEnabled: settings.hapticsEnabled !== false,
  }
  await db.insert(gameProfiles).values({ userId }).onConflictDoNothing()
  await db
    .update(gameProfiles)
    .set({ settings: sanitized, updatedAt: new Date() })
    .where(eq(gameProfiles.userId, userId))
  return sanitized
}

export async function abandonGameAction(sessionId: string) {
  const userId = await requireUserId()
  if (typeof sessionId !== 'string' || sessionId.length > 64) return
  await db
    .update(gameSessions)
    .set({ status: 'ABANDONED', updatedAt: new Date() })
    .where(
      and(
        eq(gameSessions.id, sessionId),
        eq(gameSessions.userId, userId),
        eq(gameSessions.status, 'ACTIVE'),
      ),
    )
}
