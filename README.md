# Fast Food Telegram Ordering Bot

Node.js + Telegraf + MongoDB/Mongoose + Express.

## 1. Install

```bash
npm install
cp .env.example .env
```

Set `BOT_TOKEN` and `MONGODB_URI`.

## 2. Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

## 3. Health check

```text
GET http://localhost:3000/health
```

## 4. Admin API

The included admin API is protected with a simple API key header:

```text
x-admin-key: YOUR_ADMIN_KEY
```

For a real production deployment, replace this with proper JWT/RBAC authentication.

Set:

```env
ADMIN_API_KEY=change-me
```

## 5. Bot flow

/start -> menu -> product -> cart -> checkout -> phone -> address -> payment -> confirmation -> order -> admin notification -> status updates.

## 6. Render

Create a Web Service.

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

Set all environment variables in Render.

For the initial version the bot uses long polling, so no public webhook URL is required. Keep exactly one bot instance running.

## 7. Important

- Never commit `.env`.
- Prices are always recalculated from MongoDB.
- Order items keep a price/name snapshot.
- Product deletion is soft deletion via `isActive`.
- Payment providers are represented by a payment adapter; real provider credentials/API calls must be added for the selected provider.
# lava_kushkupir
