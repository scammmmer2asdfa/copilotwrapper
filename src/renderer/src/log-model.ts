/** Renderer-side model for turning raw `session/update` notifications into a display log. */

export interface ContentBlockLike {
  type?: string;
  text?: string;
  [key: string]: unknown;
}

export type LogEntry =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'agent'; id: string; text: string }
  | { kind: 'thought'; id: string; text: string }
  | { kind: 'plan'; id: string; entries: { content: string; status: string }[] }
  | { kind: 'tool'; id: string; toolCallId: string; title: string; status: string };

function textOf(content: ContentBlockLike | undefined): string {
  if (!content) return '';
  if (typeof content.text === 'string') return content.text;
  return '';
}

/**
 * Folds one `session/update` notification into the existing log, merging
 * consecutive chunks of the same kind (agent_message_chunk /
 * agent_thought_chunk) into a single growing entry rather than one entry per
 * chunk.
 */
export function applySessionUpdate(log: LogEntry[], update: { sessionUpdate: string; [k: string]: unknown }): LogEntry[] {
  const kind = update.sessionUpdate;

  if (kind === 'agent_message_chunk' || kind === 'agent_thought_chunk') {
    const entryKind = kind === 'agent_message_chunk' ? 'agent' : 'thought';
    const text = textOf(update['content'] as ContentBlockLike);
    const last = log[log.length - 1];
    if (last && last.kind === entryKind) {
      const merged = { ...last, text: last.text + text };
      return [...log.slice(0, -1), merged];
    }
    return [...log, { kind: entryKind, id: crypto.randomUUID(), text }];
  }

  if (kind === 'plan') {
    const entries = (update['entries'] as { content: string; status: string }[]) ?? [];
    return [...log, { kind: 'plan', id: crypto.randomUUID(), entries }];
  }

  if (kind === 'tool_call' || kind === 'tool_call_update') {
    const toolCallId = update['toolCallId'] as string;
    const title = (update['title'] as string) ?? toolCallId;
    const status = (update['status'] as string) ?? 'pending';
    const existingIdx = log.findIndex((e) => e.kind === 'tool' && e.toolCallId === toolCallId);
    const entry: LogEntry = { kind: 'tool', id: toolCallId, toolCallId, title, status };
    if (existingIdx >= 0) {
      const copy = log.slice();
      copy[existingIdx] = entry;
      return copy;
    }
    return [...log, entry];
  }

  return log;
}
