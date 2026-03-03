/**
 * Progress event types emitted during a research run for SSE streaming.
 */

export type ResearchProgressEvent =
  | { type: 'adapter-start'; adapterId: string; adapterName: string }
  | { type: 'adapter-result'; adapterId: string; adapterName: string; sourceCount: number }
  | { type: 'adapter-error'; adapterId: string; adapterName: string; error: string }
  | { type: 'topic-ranking'; topicCount: number }
  | { type: 'run-complete'; runId: string; topicCount: number; sourceCount: number }
  | { type: 'run-error'; error: string }
  | { type: 'draft-start'; index: number; total: number; title: string }
  | { type: 'draft-complete'; index: number; total: number; title: string; draftId: string }
  | { type: 'draft-error'; index: number; total: number; title: string; error: string }
  | { type: 'draft-skipped'; title: string; reason: string }
  | { type: 'drafts-done'; generated: number; failed: number; draftIds: string[] };

export type OnProgress = (event: ResearchProgressEvent) => void;
