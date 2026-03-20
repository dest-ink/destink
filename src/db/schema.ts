import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  numeric,
  boolean,
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
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
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

export const researchers = pgTable('researchers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  topics: jsonb('topics').$type<string[]>().default([]).notNull(),
  keywords: jsonb('keywords').$type<string[]>().default([]).notNull(),
  sourceConfig: jsonb('source_config').$type<ResearchSourceConfig>().notNull(),
  maxDraftsPerRun: integer('max_drafts_per_run').default(3).notNull(),
  shortFormPercent: integer('short_form_percent').default(70).notNull(),
  autoDraft: boolean('auto_draft').default(false).notNull(),
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export const researcherChannels = pgTable('researcher_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  researcherId: uuid('researcher_id')
    .references(() => researchers.id, { onDelete: 'cascade' })
    .notNull(),
  channelId: uuid('channel_id')
    .references(() => channels.id, { onDelete: 'cascade' })
    .notNull(),
});

export const draftPreferences = pgTable('draft_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id')
    .references(() => channels.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),

  // Length preferences
  noteLengthMin: integer('note_length_min').default(150),       // min words for notes
  noteLengthMax: integer('note_length_max').default(300),       // max words for notes
  articleLengthMin: integer('article_length_min').default(800),  // min words for articles
  articleLengthMax: integer('article_length_max').default(2000), // max words for articles

  // Vocabulary & language
  vocabularyLevel: text('vocabulary_level').default('accessible'),  // simple, accessible, technical, academic
  jargonHandling: text('jargon_handling').default('explain'),       // avoid, explain, assume-knowledge
  preferredPhrases: jsonb('preferred_phrases').$type<string[]>().default([]),   // phrases to use often
  avoidedPhrases: jsonb('avoided_phrases').$type<string[]>().default([]),       // phrases to never use

  // Punctuation & formatting
  useEmDashes: boolean('use_em_dashes').default(true),
  useOxfordComma: boolean('use_oxford_comma').default(true),
  useSemicolons: boolean('use_semicolons').default(false),
  useExclamationMarks: boolean('use_exclamation_marks').default(false),
  useEllipsis: boolean('use_ellipsis').default(false),
  useParenheticals: boolean('use_parentheticals').default(true),

  // Capitalization & emphasis
  headlineCase: text('headline_case').default('sentence'),    // sentence, title, lowercase, uppercase
  emphasisStyle: text('emphasis_style').default('bold'),       // bold, italic, caps, none
  useAllCaps: boolean('use_all_caps').default(false),          // for emphasis in social posts

  // Structure preferences
  paragraphLength: text('paragraph_length').default('short'),  // short (2-3 sentences), medium (4-5), long (6+)
  useSubheadings: boolean('use_subheadings').default(true),
  useBulletLists: boolean('use_bullet_lists').default(true),
  useNumberedLists: boolean('use_numbered_lists').default(false),
  useBlockquotes: boolean('use_blockquotes').default(false),

  // Tone modifiers
  humorLevel: text('humor_level').default('none'),            // none, subtle, moderate, heavy
  formalityLevel: text('formality_level').default('conversational'), // formal, professional, conversational, casual
  opinionStrength: text('opinion_strength').default('balanced'),     // neutral, balanced, strong, provocative
  ctaStyle: text('cta_style').default('question'),            // question, directive, soft, none

  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export const automationSchedules = pgTable('automation_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  researcherId: uuid('researcher_id')
    .references(() => researchers.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name'),                              // optional user label
  cronExpression: text('cron_expression').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  nextRunAt: timestamptz('next_run_at'),            // nullable, computed
  autoDraft: boolean('auto_draft'),                 // null = inherit from researcher
  maxDraftsPerRun: integer('max_drafts_per_run'),   // null = inherit from researcher
  createdAt: timestamptz('created_at').defaultNow().notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

export const researchRuns = pgTable('research_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'cascade' }).notNull(),
  researcherId: uuid('researcher_id').references(() => researchers.id, { onDelete: 'set null' }),
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

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
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
  contentTypeMix?: { note: number; article: number };
  maxDraftsPerRun?: number;
  scheduleHours?: number;
  shortFormPercent?: number;
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

export interface ResearchSourceConfig {
  subreddits: string[];
  substackFeeds: string[];
  searchQueryTemplates: string[];
  excludedDomains: string[];
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
