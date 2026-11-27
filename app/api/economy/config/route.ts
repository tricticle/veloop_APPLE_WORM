import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { economyConfigs } from '@/lib/db/schema'
import { DEFAULT_ECONOMY_CONFIG, readEconomyConfig } from '@/lib/game/economy-config'
import { adProviderAdapter } from '@/services/ads/ad-provider-adapter'

export async function GET() {
  let row: { config: Record<string, unknown> } | undefined
  try {
    ;[row] = await db.select({ config: economyConfigs.config })
      .from(economyConfigs)
      .where(eq(economyConfigs.configKey, 'default'))
      .limit(1)
  } catch {
    row = undefined
  }
  const config = readEconomyConfig(row?.config ?? DEFAULT_ECONOMY_CONFIG)

  return NextResponse.json({
    ...config,
    rewardedAdsAvailable: config.adProvider === 'CONNECTED' && adProviderAdapter.configured,
  }, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}
