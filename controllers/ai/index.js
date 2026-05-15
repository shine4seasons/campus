const { categoryLabels, conditionContext, buildPrompt } = require('./constants');
const OpenAI = require('openai');

// AI provider: 'groq' (default — fast & generous free tier) or 'gemini'
const AI_PROVIDER = (process.env.AI_PROVIDER || 'groq').toLowerCase();

// Groq model (OpenAI-compatible)
//   llama-3.3-70b-versatile     ⭐ recommended — best quality, free
//   llama-3.1-8b-instant        — fastest, smaller
//   llama-3.2-90b-vision-preview — supports images
//   gemma2-9b-it                — Google Gemma
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

// ── Provider: Groq (OpenAI-compatible) ───────────────────────
async function generateWithGroq({ prompt, imageUrl }) {
  if (!groq) throw new Error('GROQ_API_KEY is not configured in .env');

  const userContent = imageUrl
    ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageUrl } }]
    : prompt;

  // Vision models need a different model name
  const model = imageUrl && !GROQ_MODEL.includes('vision')
    ? 'llama-3.2-90b-vision-preview'
    : GROQ_MODEL;

  const completion = await groq.chat.completions.create({
    model,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: 250,
    temperature: 0.9,
    top_p: 0.95,
  });
  return completion.choices?.[0]?.message?.content?.trim();
}

// ── Provider: Gemini ─────────────────────────────────────────
async function fetchImageAsInlineData(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    if (!mimeType.startsWith('image/') || buf.length > 4 * 1024 * 1024) return null;
    return { inlineData: { mimeType, data: buf.toString('base64') } };
  } catch { return null; }
}

async function generateWithGemini({ prompt, imageUrl }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured in .env');

  const parts = [{ text: prompt }];
  if (imageUrl) {
    const imgPart = await fetchImageAsInlineData(imageUrl);
    if (imgPart) parts.push(imgPart);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: 250, temperature: 0.9, topP: 0.95 },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Gemini API error (${response.status})`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

// ── Main controller ──────────────────────────────────────────
const describeProduct = async (req, res) => {
  try {
    const { title, category, condition, price, location, imageUrl } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const priceNote = price ? `Asking price: ${new Intl.NumberFormat('en-US').format(price)} VND` : '';
    const locationNote = location ? `Exchange location: ${location}` : '';
    const prompt = buildPrompt({ title, category, condition, priceNote, locationNote, categoryLabels, conditionContext });

    const description = AI_PROVIDER === 'gemini'
      ? await generateWithGemini({ prompt, imageUrl })
      : await generateWithGroq({ prompt, imageUrl });

    if (!description) return res.status(500).json({ success: false, message: 'AI did not return any result' });
    res.json({ success: true, description });
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'AI service error' });
  }
};

module.exports = { describeProduct };
