/**
 * Progress event types emitted during a research run for SSE streaming.
 */

export type ResearchProgressEvent =
  | { type: 'adapter-start'; adapterId: string; adapterName: string }
  | { type: 'adapter-result'; adapterId: string; adapterName: string; sourceCount: number }
  | { type: 'adapter-error'; adapterId: string; adapterName: string; error: string }
  | { type: 'topic-ranking'; topicCount: number }
  | { type: 'run-complete'; runId: string; topicCount: number; sourceCount: number }
  | { type: 'run-error'; error: string };

export type OnProgress = (event: ResearchProgressEvent) => void;
