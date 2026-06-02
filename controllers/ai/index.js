const { categoryLabels, conditionContext, buildPrompt } = require('./constants');
const OpenAI = require('openai');
const { badRequest, serviceUnavailable } = require('../../utils/errors');
const logger = require('../../utils/logger');

// AI provider: 'groq' (default, OpenAI-compatible) or 'gemini'.
const AI_PROVIDER = (process.env.AI_PROVIDER || 'groq').toLowerCase();

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const AI_TIMEOUT_MS = Number.parseInt(process.env.AI_TIMEOUT_MS || '', 10) || 15000;
const AI_IMAGE_FETCH_TIMEOUT_MS = Number.parseInt(process.env.AI_IMAGE_FETCH_TIMEOUT_MS || '', 10) || 5000;

const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

const AI_CACHE_TTL_MS = 60000;
const AI_CACHE_MAX = 100;
const aiCache = new Map();
const aiInFlight = new Map();

function getDescribeCacheKey(input) {
  return JSON.stringify(input);
}

function getCachedDescription(key) {
  const hit = aiCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > AI_CACHE_TTL_MS) {
    aiCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedDescription(key, value) {
  aiCache.set(key, { at: Date.now(), value });
  if (aiCache.size > AI_CACHE_MAX) {
    const firstKey = aiCache.keys().next().value;
    if (firstKey) aiCache.delete(firstKey);
  }
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function normalizeDescription(text) {
  const cleaned = String(text || '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/^\s*(description|product description|generated description)\s*:\s*/i, '')
    .replace(/^\s*[-*\u2022]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '');

  if (!cleaned) return '';

  const words = cleaned.split(/\s+/);
  if (words.length < 20) return '';

  return cleaned;
}

function normalizeTitle(text) {
  const cleaned = String(text || '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ''))
    .replace(/^\s*(title|product title)\s*:\s*/i, '')
    .replace(/^\s*[-*\u2022]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '');

  if (!cleaned) return '';

  const words = cleaned.split(/\s+/);
  const short = words.slice(0, 10).join(' ');
  return short.length > 80 ? short.slice(0, 80).trim() : short;
}

async function generateWithGroq({ prompt, imageUrl, maxTokens }) {
  if (!groq) throw serviceUnavailable('AI provider is not configured');

  const userContent = imageUrl
    ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageUrl } }]
    : prompt;

  const model = imageUrl ? GROQ_VISION_MODEL : GROQ_MODEL;

  const completion = await withTimeout(
    groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: maxTokens,
      temperature: 0.9,
      top_p: 0.95,
    }),
    AI_TIMEOUT_MS,
    'Groq request'
  );
  return completion.choices?.[0]?.message?.content?.trim();
}

async function fetchImageAsInlineData(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_IMAGE_FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
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
  if (!process.env.GEMINI_API_KEY) throw serviceUnavailable('AI provider is not configured');

  const parts = [{ text: prompt }];
  if (imageUrl) {
    const imgPart = await fetchImageAsInlineData(imageUrl);
    if (imgPart) parts.push(imgPart);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.9, topP: 0.95 },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `Gemini API error (${response.status})`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

const describeProduct = async (req, res, next) => {
  try {
    const {
      mode,
      title,
      category,
      condition,
      brand,
      model,
      color,
      size,
      accessories,
      defects,
      reasonForSelling,
      extraNotes,
      price,
      location,
      imageUrl,
      tone,
      language,
      titleLanguage
    } = req.body;
    const generationMode = mode === 'title' ? 'title' : 'description';
    const suppliedTitle = String(title || '').trim();
    if (generationMode !== 'title' && !suppliedTitle) throw badRequest('Title is required');
    const normalizedImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    if (normalizedImageUrl) {
      try {
        new URL(normalizedImageUrl);
      } catch {
        throw badRequest('Invalid image URL');
      }
    }

    const requestedWords = Number(req.body.targetWords);
    const targetWords = Math.min(140, Math.max(60, Number.isFinite(requestedWords) ? requestedWords : 100));
    const maxTokens = generationMode === 'title'
      ? 80
      : Math.min(420, Math.max(180, Math.ceil(targetWords * 2.4)));
    const priceNote = price ? `Asking price: ${new Intl.NumberFormat('en-US').format(price)} VND` : '';
    const locationNote = location ? `Exchange location: ${location}` : '';
    const promptInput = {
      mode: generationMode,
      title: suppliedTitle || 'Unknown item',
      category,
      condition,
      brand,
      model,
      color,
      size,
      accessories,
      defects,
      reasonForSelling,
      extraNotes,
      priceNote,
      locationNote,
      categoryLabels,
      conditionContext,
      tone,
      language,
      titleLanguage: generationMode === 'title' ? (String(titleLanguage || '').trim() || String(language || '').trim() || 'english') : '',
      targetWords,
    };
    const cacheKey = getDescribeCacheKey({
      ...promptInput,
      imageUrl: normalizedImageUrl,
      provider: AI_PROVIDER
    });
    const cached = getCachedDescription(cacheKey);
    if (cached) {
      const cachedValue = typeof cached === 'string' ? { description: cached } : cached;
      const cachedUsedImage = typeof cachedValue === 'object' && cachedValue ? !!cachedValue.usedImage : false;
      return res.json({
        success: true,
        description: cachedValue.description || '',
        titleSuggestion: cachedValue.titleSuggestion || '',
        usedImage: cachedUsedImage,
        cached: true
      });
    }
    if (aiInFlight.has(cacheKey)) {
      const pendingResult = await aiInFlight.get(cacheKey);
      const pendingValue = typeof pendingResult === 'string' ? { description: pendingResult } : pendingResult;
      const pendingUsedImage = typeof pendingValue === 'object' && pendingValue ? !!pendingValue.usedImage : false;
      return res.json({
        success: true,
        description: pendingValue.description || '',
        titleSuggestion: pendingValue.titleSuggestion || '',
        usedImage: pendingUsedImage,
        cached: true
      });
    }

    const prompt = buildPrompt({ ...promptInput, hasImage: Boolean(normalizedImageUrl) });

    const compute = (async () => {
      let description;
      let titleSuggestion = '';
      let usedImage = Boolean(normalizedImageUrl);
      try {
        description = AI_PROVIDER === 'gemini'
          ? await generateWithGemini({ prompt, imageUrl: normalizedImageUrl, maxTokens })
          : await generateWithGroq({ prompt, imageUrl: normalizedImageUrl, maxTokens });
      } catch (err) {
        if (!normalizedImageUrl || AI_PROVIDER !== 'groq') throw err;
        logger.warn('ai.groq_vision_retry_text_only', { err: err.message });
        const textOnlyPrompt = buildPrompt({ ...promptInput, hasImage: false });
        description = await generateWithGroq({ prompt: textOnlyPrompt, imageUrl: '', maxTokens });
        usedImage = false;
      }
      if (generationMode === 'title') {
        titleSuggestion = normalizeTitle(description);
        description = '';
      }
      return { description, titleSuggestion, usedImage };
    })();
    aiInFlight.set(cacheKey, compute);

    let result;
    try {
      result = await compute;
    } finally {
      aiInFlight.delete(cacheKey);
    }

    const normalizedDescription = generationMode === 'title'
      ? ''
      : normalizeDescription(result?.description);
    const normalizedTitle = generationMode === 'title'
      ? normalizeTitle(result?.titleSuggestion || result?.description)
      : '';
    if (generationMode === 'title') {
      if (!normalizedTitle) throw serviceUnavailable('AI service did not return any result');
    } else if (!normalizedDescription) {
      throw serviceUnavailable('AI service did not return any result');
    }
    const responsePayload = {
      description: normalizedDescription,
      titleSuggestion: normalizedTitle,
      usedImage: !!result?.usedImage
    };
    setCachedDescription(cacheKey, responsePayload);
    res.json({ success: true, ...responsePayload });
  } catch (err) {
    logger.error('ai.describe_failed', { err: err.message, stack: err.stack });
    return next(err);
  }
};

module.exports = { describeProduct };

