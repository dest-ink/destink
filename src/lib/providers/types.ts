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
}

// ─── PublisherProvider ───────────────────────────────────────────────────────

/**
 * Contract that every publishing provider must satisfy.
 * Providers are plain objects (not classes) that implement this interface.
 *
 * The `platform` field must match the value stored in `channels.platform`
 * so the registry can look up the correct provider at publish time.
 */
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

  // --- Required methods ---
  publish(draft: DraftRow, channel: ChannelRow): Promise<unknown>;
  formatDraft(draft: DraftRow, channel: ChannelRow): string;

  // --- Optional methods ---
  getMetrics?(postId: string): Promise<Record<string, unknown> | null>;
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
