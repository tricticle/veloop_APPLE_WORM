import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { GameApp } from '@/components/game/game-app'
import type { RewardHistoryItem } from '@/components/game/rewards-view'
import type { LeaderboardEntry } from '@/components/game/leaderboard-view'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { economyConfigs, gameProfiles, gameSessions, levelProgress, rewardTransactions, walletTransactions, user as authUser } from '@/lib/db/schema'
import { DEFAULT_ECONOMY_CONFIG, readEconomyConfig } from '@/lib/game/economy-config'
import type { GameState } from '@/lib/game/engine'
import { GAME_NAME } from '@/src/config/gameConfig'
import { adProviderAdapter } from '@/services/ads/ad-provider-adapter'

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  let initialProfile = null
  let initialCompletedLevels: Record<number, number> = {}
  let initialLevelStats: Record<number, { score: number; bestMoves: number | null }> = {}
  let initialRewardHistory: RewardHistoryItem[] = []
  let initialActiveGame: {
    sessionId: string
    levelId: number
    state: GameState
    history: GameState[]
  } | null = null

  if (session?.user) {
    const userId = session.user.id
    await db.insert(gameProfiles).values({ userId }).onConflictDoNothing()
    const [profile] = await db.select().from(gameProfiles).where(eq(gameProfiles.userId, userId)).limit(1)
    if (profile) {
      initialProfile = {
        currentLevel: profile.currentLevel,
        totalScore: Number(profile.totalScore),
        totalStars: profile.totalStars,
        coins: profile.coins,
        applesCollected: profile.applesCollected,
        rewardedAdsWatched: profile.rewardedAdsWatched,
        settings: {
          soundEnabled: profile.settings.soundEnabled !== false,
          musicEnabled: profile.settings.musicEnabled !== false,
          leaderboardOptIn: profile.settings.leaderboardOptIn === true,
        },
      }
    }

    const progress = await db.select({
      levelId: levelProgress.levelId,
      stars: levelProgress.stars,
      score: levelProgress.score,
      bestMoves: levelProgress.bestMoves,
    })
      .from(levelProgress)
      .where(and(eq(levelProgress.userId, userId), isNotNull(levelProgress.completedAt)))
    initialCompletedLevels = Object.fromEntries(progress.map((entry) => [entry.levelId, entry.stars]))
    initialLevelStats = Object.fromEntries(progress.map((entry) => [entry.levelId, { score: entry.score, bestMoves: entry.bestMoves }]))

    const [walletRows, rewardRows] = await Promise.all([
      db.select({ id: walletTransactions.id, type: walletTransactions.type, amount: walletTransactions.amount, source: walletTransactions.source, referenceId: walletTransactions.referenceId, createdAt: walletTransactions.createdAt })
        .from(walletTransactions)
        .where(eq(walletTransactions.userId, userId))
        .orderBy(desc(walletTransactions.createdAt))
        .limit(20),
      db.select({ id: rewardTransactions.id, type: rewardTransactions.rewardType, amount: rewardTransactions.amount, source: rewardTransactions.source, status: rewardTransactions.status, sessionId: rewardTransactions.sessionId, createdAt: rewardTransactions.createdAt })
        .from(rewardTransactions)
        .where(eq(rewardTransactions.userId, userId))
        .orderBy(desc(rewardTransactions.createdAt))
        .limit(20),
    ])
    const rewardedSessionIds = new Set(rewardRows.flatMap((entry) => entry.sessionId ? [entry.sessionId] : []))
    initialRewardHistory = [
      ...rewardRows.map((entry) => ({ id: entry.id, type: entry.type, amount: entry.amount, source: entry.source, status: entry.status, createdAt: entry.createdAt })),
      ...walletRows.filter((entry) => !entry.referenceId || !rewardedSessionIds.has(entry.referenceId)).map((entry) => ({ id: entry.id, type: entry.type, amount: entry.amount, source: entry.source, createdAt: entry.createdAt })),
    ]
      .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime())
      .slice(0, 12)
      .map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() }))

    const [activeSession] = await db.select().from(gameSessions)
      .where(and(
        eq(gameSessions.userId, userId),
        inArray(gameSessions.status, ['ACTIVE', 'FAILED']),
      ))
      .orderBy(desc(gameSessions.updatedAt))
      .limit(1)

    if (activeSession) {
      initialActiveGame = {
        sessionId: activeSession.id,
        levelId: activeSession.levelId,
        state: activeSession.state.current,
        history: activeSession.state.history,
      }
    }
  }

  const [economyRow] = await db.select().from(economyConfigs)
    .where(eq(economyConfigs.configKey, 'default'))
    .limit(1)
  const economyConfig = readEconomyConfig(economyRow?.config ?? DEFAULT_ECONOMY_CONFIG)
  const adsAvailable = economyConfig.adProvider === 'CONNECTED' && adProviderAdapter.configured
  const publicScores = await db.select({
    userId: gameProfiles.userId,
    name: authUser.name,
    totalScore: gameProfiles.totalScore,
    totalStars: gameProfiles.totalStars,
    currentLevel: gameProfiles.currentLevel,
  })
    .from(gameProfiles)
    .innerJoin(authUser, eq(gameProfiles.userId, authUser.id))
    .where(sql`${gameProfiles.settings}->>'leaderboardOptIn' = 'true'`)
    .orderBy(desc(gameProfiles.totalScore), desc(gameProfiles.totalStars))
    .limit(50)
  const leaderboard: LeaderboardEntry[] = publicScores.map((entry) => ({
    name: entry.name.split(/\s+/)[0] || 'Player',
    totalScore: Number(entry.totalScore),
    totalStars: entry.totalStars,
    currentLevel: entry.currentLevel,
    isCurrentUser: entry.userId === session?.user.id,
  }))

  return (
    <GameApp
      gameName={GAME_NAME}
      user={session?.user ? { id: session.user.id, name: session.user.name, email: session.user.email } : null}
      initialProfile={initialProfile}
      initialCompletedLevels={initialCompletedLevels}
      initialLevelStats={initialLevelStats}
      initialRewardHistory={initialRewardHistory}
      initialActiveGame={initialActiveGame}
      economyConfig={economyConfig}
      adsAvailable={adsAvailable}
      leaderboard={leaderboard}
    />
  )
}
