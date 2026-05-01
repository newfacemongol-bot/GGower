# Facebook Chatbot + Comment Bot

Бие даасан Facebook чатбот систем.

**Stack:** Next.js 14 (App Router), Prisma, PostgreSQL 16, Docker.

## Deploy

```
git clone <repo>
cd <repo>
cp .env.example .env
# edit .env - set ADMIN_PASSWORD, SESSION_SECRET, FACEBOOK_VERIFY_TOKEN, FACEBOOK_APP_SECRET
docker compose up -d --build
```

Update:

```
git pull
docker compose up -d --build
```

## Services

- **web** — Next.js app on port 3000 (admin, operator, webhook)
- **db** — PostgreSQL 16
- **queue** — Node worker polling queued comments every 5 seconds

Prisma migrations and seed run automatically on `web` startup.

## URLs

- `/` — landing
- `/admin/login` — admin (ADMIN_PASSWORD)
- `/operator/login` — operator live chat (OPERATOR_PASSWORD, fallback ADMIN_PASSWORD)
- `/api/webhook` — Facebook webhook (GET verify, POST events)

## Facebook webhook setup

1. Developer dashboard → Webhook → subscribe page to `messages`, `messaging_postbacks`, `feed`.
2. Callback URL: `https://your-domain/api/webhook`
3. Verify token: value of `FACEBOOK_VERIFY_TOKEN`
4. App secret: set `FACEBOOK_APP_SECRET` for HMAC signature verification.

## Add a page

Admin → Facebook Пэйж → Пэйж нэмэх.

- Page ID, name, Page Access Token
- Select which ERP config this page uses
- Toggle auto-reply / reactions / hourly limit

## Add an ERP

Admin → ERP → ERP нэмэх.

- Name, API URL, API Key
- Click **Холболт шалгах** to verify

Expected ERP API shape:

- `GET /api/products?search=&pageSize=` — product search
- `GET /api/products/:id` — product detail
- `POST /api/orders` — create order
- `GET /api/orders?search=<phone>` — lookup orders

All calls include `X-API-Key` header.

## Environment

```
DATABASE_URL=postgresql://chatbot:chatbot_password@db:5432/chatbot_db
FACEBOOK_VERIFY_TOKEN=...
FACEBOOK_APP_SECRET=...
ADMIN_PASSWORD=...
OPERATOR_PASSWORD=...
SESSION_SECRET=...
TZ=Asia/Ulaanbaatar
```

## Local dev

```
npm install
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev           # web
npm run queue:worker  # queue in another terminal
```
