import type { RewardPlacement } from '@/lib/game/reward-types'

export type RewardedAdRequest = {
  opportunityId: string
  placement: RewardPlacement
  sessionId: string | null
  userId: string
}

export type AdStartResult =
  | { status: 'AD_STARTED'; provider: string; providerSessionId: string }
  | { status: 'AD_UNAVAILABLE' }

export type RewardVerification =
  | { verified: true; provider: string; eventId: string; placement: RewardPlacement }
  | { verified: false; reason: 'INVALID' | 'INCOMPLETE' | 'UNAVAILABLE' }

export interface AdProviderAdapter {
  readonly configured: boolean
  startRewardedAd(request: RewardedAdRequest): Promise<AdStartResult>
  verifyReward(payload: unknown): Promise<RewardVerification>
}

export const adProviderAdapter: AdProviderAdapter = {
  configured: false,
  async startRewardedAd() {
    return { status: 'AD_UNAVAILABLE' }
  },
  async verifyReward() {
    return { verified: false, reason: 'UNAVAILABLE' }
  },
}
