import { randomUUID } from 'node:crypto'
import { and, count, desc, eq, gte } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { adOpportunities, economyConfigs, gameSessions } from '@/lib/db/schema'
import { DEFAULT_ECONOMY_CONFIG, readEconomyConfig } from '@/lib/game/economy-config'
import { REWARD_PLACEMENTS } from '@/lib/game/reward-types'
import { adProviderAdapter } from '@/services/ads/ad-provider-adapter'

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { placement?: unknown; sessionId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.placement !== 'string' || !REWARD_PLACEMENTS.includes(body.placement as (typeof REWARD_PLACEMENTS)[number])) {
    return NextResponse.json({ error: 'Invalid reward placement' }, { status: 400 })
  }

  const userId = session.user.id
  const placement = body.placement as (typeof REWARD_PLACEMENTS)[number]
  let sessionId: string | null = null
  let levelId: number | null = null

  if (body.sessionId !== undefined) {
    if (typeof body.sessionId !== 'string' || body.sessionId.length > 64) {
      return NextResponse.json({ error: 'Invalid game session' }, { status: 400 })
    }
    const [gameSession] = await db.select({ id: gameSessions.id, levelId: gameSessions.levelId })
      .from(gameSessions)
      .where(and(eq(gameSessions.id, body.sessionId), eq(gameSessions.userId, userId)))
      .limit(1)
    if (!gameSession) return NextResponse.json({ error: 'Game session not found' }, { status: 404 })
    sessionId = gameSession.id
    levelId = gameSession.levelId
  }

  const [configRow] = await db.select({ config: economyConfigs.config })
    .from(economyConfigs)
    .where(eq(economyConfigs.configKey, 'default'))
    .limit(1)
  const config = readEconomyConfig(configRow?.config ?? DEFAULT_ECONOMY_CONFIG)
  const now = new Date()
  const [latest] = await db.select({ createdAt: adOpportunities.createdAt })
    .from(adOpportunities)
    .where(eq(adOpportunities.userId, userId))
    .orderBy(desc(adOpportunities.createdAt))
    .limit(1)

  if (latest && now.getTime() - latest.createdAt.getTime() < config.minimumSecondsBetweenRewardedAds * 1000) {
    return NextResponse.json({ status: 'COOLDOWN' }, { status: 429 })
  }

  const [dailyCount] = await db.select({ value: count() })
    .from(adOpportunities)
    .where(and(eq(adOpportunities.userId, userId), gte(adOpportunities.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000))))
  if (Number(dailyCount.value) >= config.dailyRewardedAdCap) {
    return NextResponse.json({ status: 'LIMIT_REACHED' }, { status: 429 })
  }

  if (sessionId) {
    const [sessionCount] = await db.select({ value: count() })
      .from(adOpportunities)
      .where(and(eq(adOpportunities.userId, userId), eq(adOpportunities.sessionId, sessionId)))
    if (Number(sessionCount.value) >= config.sessionRewardedAdCap) {
      return NextResponse.json({ status: 'LIMIT_REACHED' }, { status: 429 })
    }
  }

  const opportunityId = randomUUID()
  await db.insert(adOpportunities).values({
    id: opportunityId,
    userId,
    sessionId,
    levelId,
    placement,
    status: 'REQUESTED',
    expiresAt: new Date(now.getTime() + 90_000),
  })

  const providerResult = await adProviderAdapter.startRewardedAd({ opportunityId, placement, sessionId, userId })
  if (providerResult.status === 'AD_UNAVAILABLE') {
    await db.update(adOpportunities)
      .set({ status: 'REJECTED', adProvider: 'UNCONFIGURED' })
      .where(and(eq(adOpportunities.id, opportunityId), eq(adOpportunities.userId, userId)))
    return NextResponse.json({ status: 'AD_UNAVAILABLE', opportunityId }, { status: 503 })
  }

  await db.update(adOpportunities)
    .set({ status: 'AD_STARTED', adProvider: providerResult.provider })
    .where(and(eq(adOpportunities.id, opportunityId), eq(adOpportunities.userId, userId)))

  return NextResponse.json({ status: 'AD_STARTED', opportunityId, providerSessionId: providerResult.providerSessionId })
}
