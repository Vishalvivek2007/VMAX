# VMAX Render Deployment Guide

VMAX deploys to Render as one Node Web Service.

The backend is `backend/server.js`. It also serves the frontend from `frontend/`, so you do not deploy frontend and backend separately.

## What Render Runs

Render uses these commands:

```bash
npm install
npm start
```

`npm start` runs:

```bash
node backend/server.js
```

That one server provides:

```text
Frontend: https://YOUR-APP.onrender.com
Backend:  https://YOUR-APP.onrender.com/api/...
Socket.io: https://YOUR-APP.onrender.com/socket.io/...
Health:   https://YOUR-APP.onrender.com/health
Warmup:   https://YOUR-APP.onrender.com/api/warmup
```

## Cold Start Reality

Render free web services spin down after inactivity. That cannot be fully removed on the free plan.

This project is tuned to make it smoother:

- `/health` is lightweight for Render health checks.
- `/api/warmup` gives the frontend a cheap endpoint to wake the backend.
- API requests retry temporary `502`, `503`, and `504` wakeup errors.
- Socket.io reconnects automatically.
- Static frontend files are cached for quicker repeat loads.

## 1. Clean Secrets Before Pushing

Your `.env` file contains real secrets and should not be pushed.

Run this once locally:

```bash
git rm --cached .env
git add .gitignore .env.example render.yaml DEPLOYMENT.md package.json backend/server.js frontend/src/scripts.js
git commit -m "Prepare VMAX for Render deployment"
git push
```

If `.env` was ever pushed to GitHub, rotate the MongoDB password and JWT secret.

## 2. Prepare MongoDB Atlas

1. Open MongoDB Atlas.
2. Go to Database Access.
3. Create a database user.
4. Go to Network Access.
5. For Render free/easy setup, add:

```text
0.0.0.0/0
```

6. Go to Database, then Connect, then Drivers.
7. Copy your connection string.

It should look like:

```text
mongodb+srv://USER:PASSWORD@cluster-name.mongodb.net/vmax
```

Make sure it has a database name like `/vmax` before any query params.

## 3. Deploy With Render Blueprint

1. Go to Render.
2. Click New.
3. Click Blueprint.
4. Connect GitHub if needed.
5. Select the `Vishalvivek2007/VMAX` repo.
6. Render reads `render.yaml`.
7. When Render asks for environment variables, fill:

```text
MONGO_URI=your-mongodb-atlas-uri
JWT_SECRET=your-long-random-secret
API_READ_ACCESS=your-tmdb-read-access-token
API_KEY=your-tmdb-api-key
```

8. Click Apply.
9. Wait for the first deploy to finish.

## 4. Manual Render Setup If Blueprint Is Annoying

Use this if you choose New Web Service instead of Blueprint.

1. Go to Render.
2. Click New.
3. Click Web Service.
4. Connect the GitHub repo.
5. Settings:

```text
Name: vmax
Runtime: Node
Branch: main
Root Directory: leave blank
Build Command: npm install
Start Command: npm start
Instance Type: Free
Health Check Path: /health
Auto-Deploy: Yes
```

6. Add environment variables:

```text
NODE_ENV=production
MONGO_URI=your-mongodb-atlas-uri
JWT_SECRET=your-long-random-secret
API_READ_ACCESS=your-tmdb-read-access-token
API_KEY=your-tmdb-api-key
```

7. Click Create Web Service.

## 5. Verify Deployment

After deploy, open:

```text
https://YOUR-APP.onrender.com/health
```

Expected:

```json
{
  "ok": true,
  "service": "vmax",
  "mongo": "connected"
}
```

If Mongo still says `connecting`, wait a few seconds and refresh.

Then open:

```text
https://YOUR-APP.onrender.com/api/warmup
https://YOUR-APP.onrender.com
```

## 6. Test Frontend + Backend

1. Open the app URL.
2. Create an account.
3. Sign in.
4. Create a room.
5. Copy the room code.
6. Open incognito or another browser.
7. Sign in there too.
8. Join the room.
9. In browser one, click Watch in Room.
10. Confirm browser two opens the same movie.
11. Test chat, play, pause, and seek.

## 7. Custom Domain

1. In Render, open the `vmax` service.
2. Go to Settings.
3. Go to Custom Domains.
4. Add your domain.
5. Render shows DNS records.
6. Add those records at your domain provider.
7. Wait for Render to issue SSL.

After that, the same app works at:

```text
https://your-domain.com
https://your-domain.com/api/warmup
https://your-domain.com/health
```

No frontend code change is needed because the browser uses `window.location.origin`.

## 8. Updating the App

After you change code:

```bash
git add .
git commit -m "Your change"
git push
```

Render auto-deploys from GitHub.

## 9. If Cold Starts Still Feel Bad

Best free-plan options:

- Open `/api/warmup` once before sharing the room link.
- Keep the first request simple and wait for `/health` to return.
- Upgrade Render to a paid instance when you want no spin-down.

Free Render can be made smoother, but not truly always-on.
