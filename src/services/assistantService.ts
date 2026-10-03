/**
 * RockSentinel AI — frontend client for POST /api/assistant.
 *
 * The Groq API key lives ONLY on the server (see assistant-middleware.ts).
 * This module streams NDJSON deltas back from the backend endpoint.
 */

export interface AssistantContext {
  timestamp: string;
  [k: string]: unknown;
}

/** Stream an answer from POST /api/assistant. Resolves with the full reply text. */
export async function streamAssistant(
  question: string,
  context: unknown,
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context, stream: true }),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = '';
    try {
      const err = await res.json() as { error?: string };
      detail = err.error ?? '';
    } catch { /* non-json error body */ }
    throw new Error(detail || `Assistant endpoint returned ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const chunk = JSON.parse(line) as { delta?: string };
        if (chunk.delta) {
          full += chunk.delta;
          onDelta(chunk.delta);
        }
      } catch { /* ignore malformed line */ }
    }
  }
  return full;
}

/** Non-streaming variant (used by tests / fallback tooling). */
export async function askAssistant(question: string, context: unknown): Promise<string> {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context, stream: false }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json() as { error?: string };
      detail = err.error ?? '';
    } catch { /* ignore */ }
    throw new Error(detail || `Assistant endpoint returned ${res.status}`);
  }
  const data = await res.json() as { reply?: string };
  return data.reply ?? '';
}
