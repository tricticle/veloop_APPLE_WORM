export type EconomyConfig = {
  levelCompletionCoins: number
  doubleCoinsMultiplier: number
  doubleScoreMultiplier: number
  extraMoves: number
  hintEnabled: boolean
  reviveEnabled: boolean
  dailyRewardedAdCap: number
  sessionRewardedAdCap: number
  maxRevivesPerLevel: number
  maxDoubleScorePerLevel: number
  maxDoubleCoinsPerLevel: number
  minimumSecondsBetweenRewardedAds: number
  adProvider: 'UNCONFIGURED' | 'CONNECTED'
}

export function readEconomyConfig(value: unknown): EconomyConfig {
  if (!value || typeof value !== 'object') return DEFAULT_ECONOMY_CONFIG
  const config = value as Partial<EconomyConfig>
  const validLimit = (candidate: unknown, fallback: number) =>
    Number.isInteger(candidate) && Number(candidate) >= 0 ? Number(candidate) : fallback

  return {
    ...DEFAULT_ECONOMY_CONFIG,
    levelCompletionCoins: validLimit(config.levelCompletionCoins, DEFAULT_ECONOMY_CONFIG.levelCompletionCoins),
    doubleCoinsMultiplier: validLimit(config.doubleCoinsMultiplier, DEFAULT_ECONOMY_CONFIG.doubleCoinsMultiplier),
    doubleScoreMultiplier: validLimit(config.doubleScoreMultiplier, DEFAULT_ECONOMY_CONFIG.doubleScoreMultiplier),
    extraMoves: validLimit(config.extraMoves, DEFAULT_ECONOMY_CONFIG.extraMoves),
    hintEnabled: config.hintEnabled !== false,
    reviveEnabled: config.reviveEnabled !== false,
    dailyRewardedAdCap: validLimit(config.dailyRewardedAdCap, DEFAULT_ECONOMY_CONFIG.dailyRewardedAdCap),
    sessionRewardedAdCap: validLimit(config.sessionRewardedAdCap, DEFAULT_ECONOMY_CONFIG.sessionRewardedAdCap),
    maxRevivesPerLevel: validLimit(config.maxRevivesPerLevel, DEFAULT_ECONOMY_CONFIG.maxRevivesPerLevel),
    maxDoubleScorePerLevel: validLimit(config.maxDoubleScorePerLevel, DEFAULT_ECONOMY_CONFIG.maxDoubleScorePerLevel),
    maxDoubleCoinsPerLevel: validLimit(config.maxDoubleCoinsPerLevel, DEFAULT_ECONOMY_CONFIG.maxDoubleCoinsPerLevel),
    minimumSecondsBetweenRewardedAds: validLimit(config.minimumSecondsBetweenRewardedAds, DEFAULT_ECONOMY_CONFIG.minimumSecondsBetweenRewardedAds),
    adProvider: config.adProvider === 'CONNECTED' ? 'CONNECTED' : 'UNCONFIGURED',
  }
}

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  levelCompletionCoins: 25,
  doubleCoinsMultiplier: 2,
  doubleScoreMultiplier: 2,
  extraMoves: 5,
  hintEnabled: true,
  reviveEnabled: true,
  dailyRewardedAdCap: 10,
  sessionRewardedAdCap: 5,
  maxRevivesPerLevel: 1,
  maxDoubleScorePerLevel: 1,
  maxDoubleCoinsPerLevel: 1,
  minimumSecondsBetweenRewardedAds: 30,
  adProvider: 'UNCONFIGURED',
}
