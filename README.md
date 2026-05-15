# Smart Campus Marketplace

A student-to-student second-hand marketplace built for university campuses.  
Buy and sell textbooks, electronics, clothing, furniture, and more — all within your campus community.

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

Make sure you have the following installed before starting:

- [Node.js](https://nodejs.org/) **v18 or higher**
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A **MongoDB** database — [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier) or a local MongoDB instance
- A **Google Cloud** project with OAuth 2.0 credentials
- A **Cloudinary** account (free tier)
- A **Groq** API key (free at [console.groq.com](https://console.groq.com))

---

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd campus
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the environment file

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

If there is no `.env.example`, create `.env` manually:

```bash
touch .env
```

Then fill it in (see the section below).

### 4. Configure environment variables

Open `.env` and fill in all required values:

```env
# ── Server ──────────────────────────────────────────────
PORT=5000
NODE_ENV=development

# ── MongoDB ─────────────────────────────────────────────
# Atlas example: mongodb+srv://<user>:<password>@cluster.mongodb.net/campus
MONGODB_URI=mongodb://localhost:27017/campus

# ── JWT ─────────────────────────────────────────────────
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRE=7d

# ── Google OAuth ─────────────────────────────────────────
# Get from: https://console.cloud.google.com → APIs & Services → Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# URLs used for OAuth callback and post-login redirect
SERVER_URL=http://localhost:5000
CLIENT_URL=http://localhost:5000

# ── Cloudinary ───────────────────────────────────────────
# Get from: https://cloudinary.com → Dashboard
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ── AI (Groq — default) ──────────────────────────────────
# Get free API key from: https://console.groq.com
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile

# ── AI (Gemini — optional fallback) ──────────────────────
# GEMINI_API_KEY=your_gemini_api_key
# GEMINI_MODEL=gemini-2.0-flash

# Set to 'groq' or 'gemini'
AI_PROVIDER=groq
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add these **Authorized redirect URIs**:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
7. Copy the **Client ID** and **Client Secret** into your `.env`

---

## Running the Project

### Development mode (auto-restart on file changes)

```bash
npm run dev
```

The server starts at: **http://localhost:5000**

Nodemon watches `controllers/`, `routes/`, `middleware/`, `models/`, `config/`, and `app.js`.  
It does **not** watch `public/` or `views/` so CSS/template changes don't cause a restart.

### Production mode

```bash
npm start
```

---

## CSS Build (Tailwind)

The compiled CSS file (`public/css/tailwind.css`) should already be present in the repo.  
If it is missing or you want to rebuild:

**One-time build:**
```bash
npm run build:css
```

**Watch mode (rebuilds on change during development):**
```bash
npm run watch:css
```

Run this in a second terminal alongside `npm run dev` if you are editing Tailwind classes.

---

## Project Structure

```
campus/
├── app.js                  # Entry point — Express setup, route mounting, Socket.IO init
├── config/
│   ├── database.js         # MongoDB connection
│   ├── passport.js         # Google OAuth strategy
│   └── appConstants.js     # All enums: order status, categories, roles, etc.
├── controllers/
│   ├── admin/              # Admin dashboard logic
│   ├── ai/                 # AI description generator
│   ├── auth/               # Login, logout, profile update
│   ├── chat/               # Conversations and messages
│   ├── checkout/           # Checkout page render
│   ├── orders/             # Order CRUD + dispute system
│   ├── product/            # Product CRUD + favorites
│   └── rating/             # Rating submission and stats
├── middleware/
│   ├── auth.js             # JWT verification (API routes)
│   ├── pageAuth.js         # Redirect guard (page routes)
│   ├── adminAuth.js        # Admin role check
│   ├── locals.js           # Inject user into all EJS templates
│   └── upload.js           # Multer + Cloudinary config
├── models/                 # Mongoose schemas
│   ├── User.js
│   ├── Product.js
│   ├── Order.js
│   ├── Conversation.js
│   ├── Message.js
│   ├── Favorite.js
│   ├── Notification.js
│   ├── Rating.js
│   ├── Report.js
│   └── SystemSettings.js
├── routes/                 # Express routers
├── utils/
│   ├── socketServer.js     # Socket.IO singleton
│   ├── notifService.js     # Persist + push notifications
│   └── viewCounter.js      # Product view tracking
├── views/                  # EJS templates
│   └── partials/           # Navbar, sidebar, shared components
├── public/
│   ├── css/                # Compiled stylesheets
│   └── js/                 # Client-side ES modules
├── tailwind.config.js
├── nodemon.json
└── package.json
```

---

## API Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/auth/google` | Start Google OAuth flow | — |
| GET | `/api/auth/me` | Get current user | JWT |
| POST | `/api/auth/logout` | Clear session | JWT |
| GET | `/api/products` | List products (with filters) | — |
| POST | `/api/products` | Create product | JWT |
| PATCH | `/api/products/:id` | Update product | JWT |
| DELETE | `/api/products/:id` | Delete product | JWT |
| POST | `/api/upload/image` | Upload product image | JWT |
| POST | `/api/upload/avatar` | Upload avatar | JWT |
| POST | `/api/ai/describe` | Generate AI description | JWT |
| POST | `/api/chat/init` | Start conversation | JWT |
| GET | `/api/chat` | Get inbox | JWT |
| POST | `/api/chat/:id/messages` | Send message | JWT |
| POST | `/api/orders` | Place order | JWT |
| GET | `/api/orders` | Get my orders | JWT |
| PATCH | `/api/orders/:id/status` | Update order status | JWT |
| POST | `/api/orders/:id/dispute` | Open dispute | JWT |
| GET | `/api/notifications` | Get notifications | JWT |
| POST | `/api/ratings` | Submit rating | JWT |
| POST | `/api/report` | Submit report | JWT |
| GET | `/admin` | Admin dashboard | Admin |

---

## Pages

| URL | Description |
|-----|-------------|
| `/` | Home — product feed + search |
| `/login` | Google login page |
| `/sell` | Post a new product |
| `/products/:id` | Product detail |
| `/checkout/:productId` | Checkout page |
| `/orders` | My orders (buyer) |
| `/orders/tracking/:id` | Order tracking + map |
| `/orders-seller` | Orders received (seller) |
| `/messages` | Chat inbox |
| `/my-products` | My listings (seller) |
| `/dashboard` | Seller dashboard |
| `/revenue` | Revenue analytics (seller) |
| `/profile` | Profile settings |
| `/favorites` | Saved products |
| `/notifications` | Notification center |
| `/admin` | Admin panel |

---

## Creating an Admin Account

Admin accounts are set manually in the database. After logging in at least once via Google:

**Using MongoDB Atlas UI or Compass:**
1. Open the `users` collection
2. Find your user document by email
3. Change `"role": "user"` to `"role": "admin"`
4. Save

**Using MongoDB shell or mongosh:**
```js
db.users.updateOne(
  { email: "your@email.com" },
  { $set: { role: "admin" } }
)
```

Log out and log back in — you will now see the Admin panel at `/admin`.

---

## Common Issues

**MongoDB connection fails on startup**
- Check that `MONGODB_URI` in `.env` is correct
- If using Atlas, make sure your IP address is whitelisted in **Network Access**
- The server retries automatically every 2 seconds

**Google login redirects to an error page**
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Make sure `http://localhost:5000/api/auth/google/callback` is in your Google OAuth **Authorized redirect URIs**
- `SERVER_URL` in `.env` must exactly match `http://localhost:5000` (no trailing slash)

**Images fail to upload**
- Verify all three Cloudinary variables are set correctly (`CLOUD_NAME`, `API_KEY`, `API_SECRET`)
- Check the Cloudinary dashboard for any upload errors or quota limits

**AI description button does nothing**
- Make sure `GROQ_API_KEY` is set and valid
- Test the key at [console.groq.com](https://console.groq.com)
- Check the server console for any AI error messages

**CSS looks unstyled**
- Run `npm run build:css` to regenerate `public/css/tailwind.css`

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Server port |
| `NODE_ENV` | No | — | Set to `production` to enable secure cookies |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string |
| `JWT_SECRET` | **Yes** | — | Secret key for signing JWTs |
| `JWT_EXPIRE` | No | `7d` | Token expiry duration |
| `GOOGLE_CLIENT_ID` | **Yes** | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | **Yes** | — | Google OAuth client secret |
| `SERVER_URL` | **Yes** | — | Base URL of the server (for OAuth callback) |
| `CLIENT_URL` | **Yes** | — | Base URL for post-login redirect |
| `CLOUDINARY_CLOUD_NAME` | **Yes** | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | **Yes** | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | **Yes** | — | Cloudinary API secret |
| `GROQ_API_KEY` | **Yes*** | — | Groq API key (*required if `AI_PROVIDER=groq`) |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Groq model name |
| `GEMINI_API_KEY` | No | — | Gemini API key (if using Gemini provider) |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model name |
| `AI_PROVIDER` | No | `groq` | AI provider: `groq` or `gemini` |
