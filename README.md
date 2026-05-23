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
- MongoDB (Atlas or local)
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
npm run test:hardening
npm run test:security:lite
npm run security-check
```

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
