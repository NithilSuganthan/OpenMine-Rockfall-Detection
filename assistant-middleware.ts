import type { Connect, Plugin } from 'vite';
import { loadEnv } from 'vite';

/**
 * RockSentinel AI — backend endpoint POST /api/assistant.
 *
 * Runs inside the Vite dev server (server-side only):
 *   1. Reads GROQ_API_KEY from the environment (.env / process.env).
 *      The key NEVER leaves the server — it is never inlined into the bundle
 *      and never sent to the browser.
 *   2. Receives { question, context, stream } from the frontend.
 *   3. Builds the RockSentinel AI system prompt + structured live context.
 *   4. Calls the Groq API and returns the response (NDJSON stream or JSON).
 */

const SYSTEM_PROMPT = `You are RockSentinel AI.
You are an AI Operations Copilot for an open-pit mine.
You are NOT a general chatbot.

Rules:
- Never fabricate values.
- Never invent sensors.
- Never invent alerts.
- Never invent predictions.
- Only answer using the supplied context.
- If data does not exist say 'I cannot verify this using the current system data.'
- Always explain WHY.
- Always cite evidence.
- Always reference sensor IDs.
- Always reference gateway IDs.
- Always reference timestamps.
- Always provide engineering recommendations.
- Always remain concise and technical.

Answer format — ALWAYS structure every operational answer as:
Summary
Evidence
AI Reasoning
Recommendation
Confidence

Include these when applicable and only when data supports them:
- Trend Chart (describe the series numerically — the frontend renders charts)
- Sensor Table
- Alert Timeline
- Gateway Status
- Deployment Quality

The live context is provided as structured JSON. Use ONLY the values in it.`;

interface AssistantBody {
  question?: string;
  context?: unknown;
  stream?: boolean;
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: Connect.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function rockSentinelAssistant(): Plugin {
  return {
    name: 'rocksentinel-assistant',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      const apiKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY || '';

      server.middlewares.use('/api/assistant', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body: AssistantBody;
        try {
          body = JSON.parse(await readBody(req)) as AssistantBody;
        } catch {
          return sendJson(res, 400, { error: 'Invalid JSON body. Expected { question, context, stream }.' });
        }
        const question = (body.question ?? '').toString().trim();
        if (!question) return sendJson(res, 400, { error: 'Missing question.' });

        if (!apiKey) {
          return sendJson(res, 503, {
            error: 'GROQ_API_KEY not configured on the server. Add it to .env and restart the dev server.',
          });
        }

        const messages = [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Live system context (structured JSON, fetched at ${new Date().toISOString()}):\n${JSON.stringify(body.context ?? {})}\n\nOperator question: ${question}`,
          },
        ];

        let upstream: Response;
        try {
          upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              temperature: 0.2,
              max_tokens: 1800,
              stream: Boolean(body.stream),
              messages,
            }),
          });
        } catch {
          return sendJson(res, 502, { error: 'Unable to reach the Groq API. Check the server network connection.' });
        }

        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => '');
          return sendJson(res, upstream.status, { error: `Groq API error ${upstream.status}: ${detail.slice(0, 500)}` });
        }

        if (!body.stream) {
          const data = await upstream.json() as { choices?: { message?: { content?: string } }[] };
          return sendJson(res, 200, { reply: data.choices?.[0]?.message?.content ?? '' });
        }

        // Stream: re-encode Groq SSE into newline-delimited JSON { delta } lines
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/x-ndjson');
        const reader = upstream.body?.getReader();
        if (!reader) return res.end();

        const decoder = new TextDecoder();
        let buffer = '';
        let open = true;
        while (open) {
          const { done, value } = await reader.read();
          if (done) open = false;
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const chunk = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
              const delta = chunk.choices?.[0]?.delta?.content ?? '';
              if (delta) res.write(`${JSON.stringify({ delta })}\n`);
            } catch {
              /* partial SSE frame — ignore */
            }
          }
        }
        res.end();
      });
    },
  };
}
