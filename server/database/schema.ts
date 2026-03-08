import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  decimal,
  text,
  timestamp,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const screeningResults = pgTable('screening_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  instrument: varchar('instrument', { length: 50 }).notNull(), // 'PC-PTSD-5' | 'DES-Brief'
  score: integer('score').notNull(),
  result: varchar('result', { length: 20 }).notNull(), // 'admitted' | 'excluded'
  encryptedResponses: text('encrypted_responses'), // AES-encrypted JSON
  completedAt: timestamp('completed_at').defaultNow(),
})

export const userStatus = pgTable('user_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  screeningComplete: boolean('screening_complete').default(false),
  preparationComplete: boolean('preparation_complete').default(false),
  activeModule: varchar('active_module', { length: 20 }), // 'tnt' | 'rtm' | 'tetris' | 'emdr' | null
  lastTriageResult: varchar('last_triage_result', { length: 20 }),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const protocolSessions = pgTable('protocol_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  module: varchar('module', { length: 20 }).notNull(), // 'tnt' | 'rtm' | 'tetris' | 'emdr' | 'preparation'
  startedAt: timestamp('started_at').defaultNow(),
  endedAt: timestamp('ended_at'),
  completed: boolean('completed').default(false),
  aborted: boolean('aborted').default(false),
  abortReason: varchar('abort_reason', { length: 50 }), // 'suds_no_change' | 'user_panic' | 'gaze_lost'
})

export const sudsRatings = pgTable(
  'suds_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => protocolSessions.id),
    rating: integer('rating').notNull(),
    phase: varchar('phase', { length: 20 }).notNull(), // 'pre' | 'post' | 'mid_loop_1' etc.
    recordedAt: timestamp('recorded_at').defaultNow(),
  },
  (table) => [
    check('rating_range', sql`${table.rating} >= 0 AND ${table.rating} <= 10`),
  ],
)

export const tntSessionData = pgTable('tnt_session_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => protocolSessions.id),
  totalTrials: integer('total_trials'),
  thinkTrials: integer('think_trials'),
  noThinkTrials: integer('no_think_trials'),
  gazeCompliancePct: decimal('gaze_compliance_pct'),
  avgReactionTimeMs: integer('avg_reaction_time_ms'),
})

export const anonymousCompletions = pgTable('anonymous_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  module: varchar('module', { length: 20 }).notNull(),
  completedAt: timestamp('completed_at').defaultNow(),
})

export const groundingEvents = pgTable('grounding_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  sessionId: uuid('session_id').references(() => protocolSessions.id),
  triggeredAt: timestamp('triggered_at').defaultNow(),
  durationSecs: integer('duration_secs'),
  context: varchar('context', { length: 50 }), // which page/module was active
})
