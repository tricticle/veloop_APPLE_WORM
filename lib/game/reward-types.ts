export const REWARD_PLACEMENTS = [
  'REVIVE',
  'DOUBLE_SCORE',
  'DOUBLE_COINS',
  'EXTRA_MOVES',
  'HINT',
  'BOOSTER',
  'DAILY_REWARD',
] as const

export type RewardPlacement = (typeof REWARD_PLACEMENTS)[number]

export type RewardState =
  | 'REQUESTED'
  | 'AD_STARTED'
  | 'AD_COMPLETED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'GRANTED'
  | 'REJECTED'
  | 'EXPIRED'
