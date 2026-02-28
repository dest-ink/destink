import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  numeric,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// ─── Enums ───────────────────────────────────────────────────────────────────

export const platformEnum = pgEnum('platform', ['linkedin', 'substack']);
export const voiceMethodEnum = pgEnum('voice_method', ['archive', 'samples', 'wizard']);
export const contentTypeEnum = pgEnum('content_type', ['note', 'article']);
export const draftStatusEnum = pgEnum('draft_status', [
  'pending_review',
  'approved',
  'rejected',
  'published',
]);
export const queueStatusEnum = pgEnum('queue_status', [
  'queued',
  'publishing',
  'published',
  'failed',
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  platform: platformEnum('platform').notNull(),
  platformId: text('platform_id'),
  personaPrompt: text('persona_prompt'),
  researchConfig: jsonb('research_config').$type<ResearchConfig>(),
  scheduleConfig: jsonb('schedule_config').$type<ScheduleConfig>(),
  credentials: text('credentials'),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export const voiceProfiles = pgTable('voice_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id')
    .references(() => channels.id, { onDelete: 'cascade' })
    .notNull(),
  method: voiceMethodEnum('method').notNull(),
  rawInput: text('raw_input'),
  extractedProfile: jsonb('extracted_profile').$type<VoiceProfile>(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export const drafts = pgTable('drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id')
    .references(() => channels.id, { onDelete: 'cascade' })
    .notNull(),
  researchRunId: uuid('research_run_id'),
  contentType: contentTypeEnum('content_type').notNull(),
  title: text('title'),
  headlineOptions: jsonb('headline_options').$type<string[]>(),
  hook: text('hook'),
  body: text('body'),
  cta: text('cta'),
  voiceConfidence: integer('voice_confidence'),
  researchSources: jsonb('research_sources').$type<ResearchSource[]>(),
  aiModel: text('ai_model'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  status: draftStatusEnum('status').default('pending_review').notNull(),
  rejectionReason: text('rejection_reason'),
  regenerationNote: text('regeneration_note'),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export const publishQueue = pgTable('publish_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  draftId: uuid('draft_id').references(() => drafts.id).notNull(),
  channelId: uuid('channel_id').references(() => channels.id).notNull(),
  scheduledFor: timestamptz('scheduled_for').notNull(),
  publishedAt: timestamptz('published_at'),
  platformResponse: jsonb('platform_response'),
  status: queueStatusEnum('status').default('queued').notNull(),
  retryCount: integer('retry_count').default(0).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
});

export const researchRuns = pgTable('research_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'cascade' }).notNull(),
  sourcesSearched: jsonb('sources_searched').$type<ResearchSource[]>(),
  topicsFound: jsonb('topics_found').$type<TopicRecommendation[]>(),
  draftsGenerated: jsonb('drafts_generated').$type<string[]>(),
  aiModel: text('ai_model'),
  tokensUsed: integer('tokens_used'),
  runAt: timestamptz('run_at').defaultNow().notNull(),
});

export const aiAuditLog = pgTable('ai_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  operation: text('operation').notNull(),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
  channelId: uuid('channel_id'),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
});

// ─── JSON column types ────────────────────────────────────────────────────────

export interface ResearchConfig {
  topics: string[];
  keywords: string[];
  subreddits: string[];
  substackFeeds: string[];
  searchQueryTemplates: string[];
  excludedDomains: string[];
  contentTypeMix: { note: number; article: number };
  maxDraftsPerRun: number;
  scheduleHours: number;
  // Optional brainstorm context (passed by engine.ts at runtime, not stored in DB)
  channelId?: string;
  voiceProfile?: VoiceProfile | null;
  recentTitles?: string[];
}

export interface ScheduleConfig {
  timezone: string;
  minGapHours: number;
  jitterMinutes: number;
  timeWindows: {
    dayOfWeek: number[];
    startHour: number;
    endHour: number;
  }[];
}

export interface VoiceProfile {
  toneDescriptors: string[];
  sentencePatterns: string;
  recurringThemes: string[];
  opinionStances: string[];
  topicsToAvoid: string[];
  vocabularyNotes: string;
  idealReader: string;
}

export interface ResearchSource {
  url: string;
  title: string;
  summary: string;
  source: 'exa' | 'reddit' | 'substack' | 'brainstorm';
}

export interface TopicRecommendation {
  title: string;
  angle: string;
  whyTimely: string;
  relevanceScore: number;
  contentType: 'note' | 'article';
  sources: ResearchSource[];
}
