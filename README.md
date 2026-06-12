# Smart Campus Marketplace

## Short Description

Smart Campus Marketplace is a student-to-student second-hand marketplace for university campuses. Students can browse, buy, sell, chat, track orders, manage payments, and use campus-focused marketplace features in one web application.

## Member List

| Member |
|---|
| Nguyen Quoc An - 2301140001 |
| Nguyen Tri Dung - 2301140016 |
| Hoang Phuoc Long - 2301140057 |

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ |
| Backend | Express.js |
| Frontend | EJS views, static JavaScript, CSS |
| Database | MongoDB with Mongoose |
| Authentication | Google OAuth 2.0, JWT |
| Real-time | Socket.IO |
| Image Storage | Cloudinary |
| AI Assistant | Groq-compatible OpenAI SDK |
| Maps | MapLibre GL, Leaflet, OpenStreetMap |
| Styling | Tailwind CSS and custom CSS |

## Main Features

- Product listing, search, detail, favorites, and seller product management.
- Buyer checkout, payment status checking, order tracking, and buyer/seller order pages.
- Google OAuth login with JWT-based session cookies.
- Real-time chat and notification support with Socket.IO.
- Admin dashboard, reports, revenue views, and system settings.
- Wallet and seller payout management.
- Cloudinary image upload support.
- AI assistant support for marketplace interactions.
- Campus map and routing UI support.

## Overall Project Structure

```text
Group01_SmartCampusMarketplace_source_code/
|-- app.js
|-- package.json
|-- package-lock.json
|-- .env.example
|-- README.md
|-- config/          Application configuration and environment validation
|-- controllers/     Request handlers grouped by feature
|-- middleware/      Auth, validation, upload, security, and page middleware
|-- models/          Mongoose schemas
|-- public/          Static frontend assets, CSS, JS, images, vendor files
|-- repositories/    Database access layer
|-- routes/          Express route definitions
|-- services/        Business logic and integrations
|-- utils/           Shared utilities
|-- validation/      Request validation schemas
|-- views/           EJS frontend pages and partials
```

## Required Tools

- Node.js v18 or newer
- npm
- MongoDB Atlas cluster or local MongoDB server
- Google OAuth client credentials
- Cloudinary account
- Groq API key
- SePay account details if payment QR/payment status features are used

## Environment Variable Setup

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and fill in the required values. The most important variables are:

```text
PORT=5000
MONGODB_URI=mongodb://localhost:27017/campus
JWT_SECRET=replace_with_strong_secret
SERVER_URL=http://localhost:5000
CLIENT_URL=http://localhost:5000
GOOGLE_CLIENT_ID=replace_with_google_client_id
GOOGLE_CLIENT_SECRET=replace_with_google_client_secret
CLOUDINARY_CLOUD_NAME=replace_with_cloud_name
CLOUDINARY_API_KEY=replace_with_api_key
CLOUDINARY_API_SECRET=replace_with_api_secret
GROQ_API_KEY=replace_with_groq_api_key
```

Do not commit or submit the real `.env` file. Only `.env.example` should be included in the submitted source code.

## Installation

From the source code folder:

```bash
npm install
```

## How To Run The Backend

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The backend starts on `http://localhost:5000` by default, unless `PORT` is changed in `.env`.

## How To Run The Frontend

The frontend is rendered by Express using EJS templates and static files from `public/`. There is no separate frontend server.

Start the backend, then open:

```text
http://localhost:5000
```

If CSS needs to be regenerated from the Tailwind source file, run:

```bash
npm run build:css
```

## Database Setup, Migration, And Seed

Set `MONGODB_URI` in `.env` to either a MongoDB Atlas connection string or a local MongoDB database.

For local MongoDB:

```text
MONGODB_URI=mongodb://localhost:27017/campus
```

The application uses Mongoose models in `models/`. Collections and indexes are created by MongoDB/Mongoose when the application connects and data is created.

This submitted package does not include seed data. To create data from a clean database:

1. Start MongoDB.
2. Start the application with `npm run dev` or `npm start`.
3. Log in and create users/products/orders through the web interface.

## Run From A Clean Machine

1. Install Node.js v18 or newer.
2. Install or prepare MongoDB Atlas/local MongoDB.
3. Extract the submitted zip file.
4. Open a terminal in `Group01_SmartCampusMarketplace_source_code`.
5. Run `npm install`.
6. Copy `.env.example` to `.env`.
7. Fill in MongoDB, JWT, Google OAuth, Cloudinary, Groq, and payment configuration in `.env`.
8. Run `npm run dev` for development or `npm start` for production.
9. Open `http://localhost:5000`.

## Demo Account

Login is handled through Google OAuth, so there is no fixed demo password account in the submitted source code. Use a valid Google account that is allowed by the configured OAuth client.

In development mode, the project also exposes a development login route in the authentication routes for local testing. Do not use development mode in production.

## Known Issues

- The system depends on external services for Google OAuth, Cloudinary, Groq, and SePay; related features will not work until valid credentials are configured.
- MongoDB transactions require MongoDB Atlas or a local replica set. Some order and wallet flows may not work correctly on a standalone MongoDB server.
- No seed dataset is included in this submission package.

## Final Submission Notes

The source code package should include `README.md`, `.env.example`, and all files required to run the system.

Do not include:

- `.env`
- `node_modules/`
- `.git/`
- `.venv/`
- log/cache/temp files
- unnecessary large build files
