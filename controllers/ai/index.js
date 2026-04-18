const fetch = global.fetch;
const { categoryLabels, conditionContext, buildPrompt } = require('./constants');

const describeProduct = async (req, res) => {
  try {
    const { title, category, condition, price, location, imageUrl } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ success: false, message: 'GEMINI_API_KEY is not configured in .env' });

    const priceNote = price ? `Asking price: ${new Intl.NumberFormat('en-US').format(price)} VND` : '';
    const locationNote = location ? `Exchange location: ${location}` : '';

    const parts = [{ text: buildPrompt({ title, category, condition, priceNote, locationNote, categoryLabels, conditionContext }) }];

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-1b-it:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: 250, temperature: 0.9, topP: 0.95 },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(500).json({ success: false, message: data.error?.message || 'Gemini API error' });
    }

    const description = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!description) return res.status(500).json({ success: false, message: 'AI did not return any result' });

    res.json({ success: true, description });
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'AI service error' });
  }
};

module.exports = { describeProduct };
