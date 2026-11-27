import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import type { GameState, PlayerSettings } from '@/lib/game/types'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const gameProfiles = pgTable('game_profiles', {
  userId: text('userId').primaryKey(),
  currentLevel: integer('currentLevel').notNull().default(1),
  totalScore: bigint('totalScore', { mode: 'number' }).notNull().default(0),
  totalStars: integer('totalStars').notNull().default(0),
  coins: integer('coins').notNull().default(0),
  applesCollected: integer('applesCollected').notNull().default(0),
  rewardedAdsWatched: integer('rewardedAdsWatched').notNull().default(0),
  noUndoClears: integer('noUndoClears').notNull().default(0),
  birdsRescued: integer('birdsRescued').notNull().default(0),
  settings: jsonb('settings').$type<PlayerSettings>().notNull().default({
    soundEnabled: true,
    musicEnabled: true,
    leaderboardOptIn: false,
    safeHint: false,
    hapticsEnabled: true,
  }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const levelProgress = pgTable('level_progress', {
  userId: text('userId').notNull(),
  levelId: integer('levelId').notNull(),
  stars: integer('stars').notNull().default(0),
  score: integer('score').notNull().default(0),
  bestMoves: integer('bestMoves'),
  bestRouteType: text('bestRouteType').default('STANDARD'),
  noUndoClear: boolean('noUndoClear').notNull().default(false),
  completedAt: timestamp('completedAt'),
}, (table) => [primaryKey({ columns: [table.userId, table.levelId] })])

export const gameSessions = pgTable('game_sessions', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  levelId: integer('levelId').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  moveCount: integer('moveCount').notNull().default(0),
  score: integer('score').notNull().default(0),
  applesCollected: integer('applesCollected').notNull().default(0),
  usedUndo: boolean('usedUndo').notNull().default(false),
  starsEarned: integer('starsEarned'),
  state: jsonb('state').$type<{ current: GameState; history: GameState[] }>().notNull(),
  checkpointState: jsonb('checkpointState').$type<GameState>().notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  completedAt: timestamp('completedAt'),
})

export const walletTransactions = pgTable('wallet_transactions', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  type: text('type').notNull(),
  amount: integer('amount').notNull(),
  balanceBefore: integer('balanceBefore').notNull(),
  balanceAfter: integer('balanceAfter').notNull(),
  source: text('source').notNull(),
  referenceId: text('referenceId'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const rewardTransactions = pgTable('reward_transactions', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  sessionId: text('sessionId'),
  levelId: integer('levelId'),
  rewardType: text('rewardType').notNull(),
  amount: integer('amount').notNull(),
  multiplier: integer('multiplier').notNull().default(1),
  source: text('source').notNull(),
  adProvider: text('adProvider'),
  adEventId: text('adEventId').unique(),
  status: text('status').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const adOpportunities = pgTable('ad_opportunities', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  sessionId: text('sessionId'),
  levelId: integer('levelId'),
  placement: text('placement').notNull(),
  status: text('status').notNull().default('REQUESTED'),
  expiresAt: timestamp('expiresAt').notNull(),
  adProvider: text('adProvider'),
  adEventId: text('adEventId').unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const economyConfigs = pgTable('economy_configs', {
  configKey: text('configKey').primaryKey(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})
