import type { drafts, channels } from '@/db/schema';
import type { ResearchConfig, ResearchSource } from '@/db/schema';

// ─── Drizzle inferred row types ──────────────────────────────────────────────

type DraftRow = typeof drafts.$inferSelect;
type ChannelRow = typeof channels.$inferSelect;

// ─── API version ─────────────────────────────────────────────────────────────

/**
 * Bump this when the PublisherProvider or ResearchAdapter interface changes in
 * a backward-incompatible way. Provider authors pin to the version they target
 * and the registry validator will reject mismatches.
 */
export const PROVIDER_API_VERSION = 1;

// ─── Shared config schema ────────────────────────────────────────────────────

/**
 * Describes a single configuration field for a provider.
 * Used by the UI to render a dynamic configuration form.
 */
export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'secret' | 'url' | 'number';
  required: boolean;
  helpText?: string;
  helpDetail?: {
    title: string;
    steps: string[];
  };
}

// ─── PublisherProvider ───────────────────────────────────────────────────────

/**
 * Contract that every publishing provider must satisfy.
 * Providers are plain objects (not classes) that implement this interface.
 *
 * The `platform` field must match the value stored in `channels.platform`
 * so the registry can look up the correct provider at publish time.
 */
/**
 * Optional OAuth configuration. When present, the UI shows a "Connect" button
 * that initiates the OAuth flow instead of (or alongside) manual credential entry.
 * The provider is responsible for defining the auth/callback URLs and required env vars.
 */
export interface OAuthConfig {
  /** URL path to initiate the OAuth flow (e.g. "/api/linkedin/auth"). channelId will be appended as a query param. */
  authPath: string;
  /** URL path that checks if OAuth env vars are configured. Must return { available: boolean }. */
  statusPath: string;
  /** Button label (e.g. "Connect with LinkedIn") */
  buttonLabel: string;
  /** Help text shown below the button (e.g. "You'll be redirected to LinkedIn to authorize access.") */
  helpText: string;
  /** Short warning shown when OAuth is not configured. */
  notConfiguredMessage: string;
  /** Step-by-step setup guide shown when OAuth is not configured — helps the admin set it up. */
  setupGuide?: {
    title: string;
    steps: string[];
  };
}

export interface PublisherProvider {
  // --- Metadata ---
  name: string;
  platform: string;
  displayName: string;
  description: string;
  icon?: string;
  /** Must equal PROVIDER_API_VERSION for the provider to be accepted by the registry validator. */
  apiVersion: number;
  configSchema: ConfigField[];
  /** Optional OAuth configuration. When set, the UI offers OAuth as the primary credential method. */
  oauth?: OAuthConfig;

  // --- Required methods ---
  publish(draft: DraftRow, channel: ChannelRow): Promise<unknown>;
  formatDraft(draft: DraftRow, channel: ChannelRow): string;

  // --- Optional methods ---
  getMetrics?(postId: string): Promise<Record<string, unknown> | null>;

  /**
   * Returns platform-specific formatting instructions for the AI draft generator.
   * Called when no user-configured writing style is set, so the generator knows
   * how to format content for this platform (e.g. plain text vs markdown).
   */
  formattingInstructions?(contentType: 'note' | 'article'): string | null;
}

// ─── ResearchAdapter ─────────────────────────────────────────────────────────

/**
 * Contract that every research adapter must satisfy.
 * Providers are plain objects (not classes) that implement this interface.
 *
 * The `id` field is the registry key used to look up this adapter.
 */
export interface ResearchAdapter {
  // --- Metadata ---
  id: string;
  name: string;
  displayName: string;
  description: string;
  /** Must equal PROVIDER_API_VERSION for the adapter to be accepted by the registry validator. */
  apiVersion: number;

  // --- Required methods ---
  search(config: ResearchConfig): Promise<ResearchSource[]>;
}
