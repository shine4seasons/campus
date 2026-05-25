# Smart Campus Marketplace

A student-to-student second-hand marketplace for university campuses.
Buy and sell textbooks, electronics, clothing, furniture, and more within your campus community.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ |
| Framework | Express.js |
| Template Engine | EJS |
| Database | MongoDB (Atlas or local) |
| Auth | Google OAuth 2.0 + JWT |
| Real-time | Socket.IO |
| Image Storage | Cloudinary |
| AI | Groq API (LLaMA 3.3 70B) |
| Maps | MapLibre GL + OpenStreetMap |
| CSS | Tailwind CSS v3 |

---

## Prerequisites

- Node.js v18+
- npm
- MongoDB Atlas or a local MongoDB replica set. Order and wallet flows use MongoDB transactions.
- Google OAuth client
- Cloudinary account
- Groq API key

---

## Setup

```bash
git clone https://github.com/shine4seasons/campus
cd campus
npm install
cp .env.example .env
```

Fill `.env` with your values.

---

## Run

```bash
npm run dev
```

Production:

```bash
npm start
```

---

## Quality and Hardening Checks

```bash
npm run lint
npm run test
npm run test:gates
npm run test:security:rate:endpoints
node scripts/test-architecture-repositories.js
npm run test:hardening
npm run test:security:lite
npm run security-check
```

## CSS Build

```bash
npm run build:css
```

The source entry is `public/css/tailwind-input.css`; generated CSS and page-level CSS stay out of source-package noise unless explicitly required.

## Final Submission Checklist

Use the required archive name format: `Group_<GroupNumber>_<ProjectName>_CLC03.zip`.

Include:

- Final report
- Presentation slides
- Complete source code
- `README.md`
- `.env.example`

Exclude:

- `.env`
- `node_modules`
- `.git`
- `.venv`
- cache, log, temporary, and generated files

---

## Index Migration

```bash
npm run migrate:indexes
```

---

## API Notes

- Product update fields: `PATCH /api/products/:id`
- Product status mutation: `PATCH /api/products/:id/status`
- Payment status check: `GET /api/payments/:paymentId/check`

---

## Hardening Docs

- `HARDENING_EXECUTION_PLAN.md`
- `HARDENING_BACKLOG.md`
- `docs/ownership-audit-matrix.md`
- `docs/validation-coverage-matrix.md`
- `docs/hardening-kpi.md`
- `docs/index-catalog.md`
- `docs/openapi.yaml`
