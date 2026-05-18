const categoryLabels = {
  books: 'Books & Textbooks',
  electronics: 'Electronics & Computers',
  clothing: 'Clothing & Fashion',
  furniture: 'Furniture & Dorm Essentials',
  'daily-needs': 'Daily Needs',
  sports: 'Sports & Gym',
  gaming: 'Entertainment & Hobbies',
  other: 'Other',
};

const conditionContext = {
  new: '100% new, never used, original box/tags',
  'like-new': 'like new, only used 1-2 times, no scratches or damage',
  good: 'used but works well, may have minor signs of wear',
  fair: 'heavily used, may have scratches but works normally',
};

const toneInstructions = {
  friendly: 'friendly, natural, and trustworthy',
  concise: 'clear, compact, and direct',
  detailed: 'specific and informative while still easy to scan',
  urgent: 'sales-focused with gentle urgency, without sounding pushy',
};

const languageInstructions = {
  english: 'English',
  vietnamese: 'Vietnamese',
};

function buildPrompt({
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
  hasImage,
}) {
  const safeTone = toneInstructions[tone] || toneInstructions.friendly;
  const safeLanguage = languageInstructions[language] || languageInstructions.english;
  const minWords = Math.max(60, targetWords - 15);
  const maxWords = Math.min(140, targetWords + 15);

  return `You are an expert product description writer for Campus Marketplace, a student-to-student buying and selling platform.

Product information:
- Product name: ${title}
- Category: ${categoryLabels[category] || category || 'Other'}
- Condition: ${conditionContext[condition] || condition || 'Unknown'}
${priceNote}
${locationNote}
${hasImage ? '- Product image: Use visible details from the image only if they are clear. Do not invent unseen features.' : ''}

Mandatory requirements:
1. Write in ${safeLanguage}, using a ${safeTone} tone like a real student seller, not stiff or template-like.
2. Length: ${minWords}-${maxWords} words, close to ${targetWords} words.
3. Must mention the actual condition specifically (do not just say "good condition").
4. State a reasonable reason for selling (for example: graduated, upgraded, no longer needed).
5. Highlight 1-2 key features that make buyers want to buy quickly.
6. End with a short call to action.
7. Do not use emojis.
8. Do not write a title or labels. Write only the plain description text.

Example of a good description style:
"I'm selling my Calculus 1 & 2 textbook set from freshman year. The books are in great condition with only minor highlighting on important parts. I bought them for 280k but I'm letting them go for 120k since I've finished the course. Both books are included, no torn pages, and the print is crystal clear. If you're studying engineering or economics, this is a must-have. Can meet up at the university library for exchange!"

Now write the description for the product above:`;
}

module.exports = { categoryLabels, conditionContext, buildPrompt };
