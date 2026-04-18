const categoryLabels = {
  books:        'Books & Textbooks',
  electronics:  'Electronics & Computers',
  clothing:     'Clothing & Fashion',
  furniture:    'Furniture & Dorm Essentials',
  'daily-needs':'Daily Needs',
  sports:       'Sports & Gym',
  gaming:       'Entertainment & Hobbies',
  other:        'Other',
};

const conditionContext = {
  new:        '100% new, never used, original box/tags',
  'like-new': 'like new, only used 1-2 times, no scratches or damage',
  good:       'used but works well, may have minor signs of wear',
  fair:       'heavily used, may have scratches but works normally',
};

function buildPrompt({ title, category, condition, priceNote, locationNote, categoryLabels, conditionContext }) {
  return `You are an expert product description writer for Campus Marketplace, a student-to-student buying and selling platform.

Product information:
- Product name: ${title}
- Category: ${categoryLabels[category] || category || 'Other'}
- Condition: ${conditionContext[condition] || condition || 'Unknown'}
${priceNote}
${locationNote}

Mandatory requirements:
1. Write in English, using a natural tone like a real student seller — NOT stiff or template-like.
2. Length: 3-5 sentences (80-120 words) — informative but concise.
3. Must mention the actual condition specifically (don't just say "good condition").
4. State a reasonable reason for selling (e.g., graduated, upgraded, no longer needed...).
5. Highlight 1-2 key features that make buyers want to buy immediately.
6. End with a short call to action (e.g., "DM me for the best price!" or "Grab it before it's gone!").
7. DO NOT use emojis.
8. DO NOT write a title or labels — write only the plain description text.

Example of a GOOD description (follow this style):
"I'm selling my Calculus 1 & 2 textbook set from freshman year. The books are in great condition with only minor highlighting on important parts. I bought them for 280k but I'm letting them go for 120k since I've finished the course. Both books are included, no torn pages, and the print is crystal clear. If you're studying engineering or economics, this is a must-have. Can meet up at the university library for exchange!"

Now write the description for the product above:`;
}

module.exports = { categoryLabels, conditionContext, buildPrompt };
