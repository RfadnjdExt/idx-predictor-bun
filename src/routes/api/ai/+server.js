import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const AI_URL   = 'https://ai.hidepulsa.com/v1/chat/completions';
const AI_MODEL = 'kr/claude-sonnet-4.5-thinking-agentic';

export async function POST({ request }) {
  const apiKey = env.AI_API_KEY;
  if (!apiKey) {
    throw error(500, 'AI_API_KEY belum diset di environment server');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Body tidak valid');
  }

  const prompt = body?.prompt;
  if (!prompt || typeof prompt !== 'string') {
    throw error(400, 'Field "prompt" wajib diisi');
  }

  const upstream = await fetch(AI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    throw error(upstream.status, `Upstream error: ${text.slice(0, 300)}`);
  }

  const data = await upstream.json();
  return json(data);
}
