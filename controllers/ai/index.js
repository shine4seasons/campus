const { categoryLabels, conditionContext, buildPrompt } = require('./constants');
const OpenAI = require('openai');

// AI provider: 'groq' (default, OpenAI-compatible) or 'gemini'.
const AI_PROVIDER = (process.env.AI_PROVIDER || 'groq').toLowerCase();

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

async function generateWithGroq({ prompt, imageUrl, maxTokens }) {
  if (!groq) throw new Error('GROQ_API_KEY is not configured in .env');

  const userContent = imageUrl
    ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageUrl } }]
    : prompt;

  const model = imageUrl ? GROQ_VISION_MODEL : GROQ_MODEL;

  const completion = await groq.chat.completions.create({
    model,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: maxTokens,
    temperature: 0.9,
    top_p: 0.95,
  });
  return completion.choices?.[0]?.message?.content?.trim();
}

async function fetchImageAsInlineData(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    if (!mimeType.startsWith('image/') || buf.length > 4 * 1024 * 1024) return null;
    return { inlineData: { mimeType, data: buf.toString('base64') } };
  } catch {
    return null;
  }
}

async function generateWithGemini({ prompt, imageUrl, maxTokens }) {
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
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.9, topP: 0.95 },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Gemini API error (${response.status})`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

const describeProduct = async (req, res) => {
  try {
    const { title, category, condition, price, location, imageUrl, tone, language } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const requestedWords = Number(req.body.targetWords);
    const targetWords = Math.min(140, Math.max(60, Number.isFinite(requestedWords) ? requestedWords : 100));
    const maxTokens = Math.min(420, Math.max(180, Math.ceil(targetWords * 2.4)));
    const priceNote = price ? `Asking price: ${new Intl.NumberFormat('en-US').format(price)} VND` : '';
    const locationNote = location ? `Exchange location: ${location}` : '';
    const promptInput = {
      title,
      category,
      condition,
      priceNote,
      locationNote,
      categoryLabels,
      conditionContext,
      tone,
      language,
      targetWords,
    };
    const prompt = buildPrompt({ ...promptInput, hasImage: Boolean(imageUrl) });

    let description;
    try {
      description = AI_PROVIDER === 'gemini'
        ? await generateWithGemini({ prompt, imageUrl, maxTokens })
        : await generateWithGroq({ prompt, imageUrl, maxTokens });
    } catch (err) {
      if (!imageUrl || AI_PROVIDER !== 'groq') throw err;
      console.warn('Groq vision failed, retrying text-only:', err.message);
      const textOnlyPrompt = buildPrompt({ ...promptInput, hasImage: false });
      description = await generateWithGroq({ prompt: textOnlyPrompt, imageUrl: '', maxTokens });
    }

    if (!description) return res.status(500).json({ success: false, message: 'AI did not return any result' });
    res.json({ success: true, description });
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'AI service error' });
  }
};

module.exports = { describeProduct };
