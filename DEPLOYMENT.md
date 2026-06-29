# VMAX Deployment Guide

This app deploys as one Node web service. Express runs the backend API, Socket.io, and serves the static frontend from `frontend/`.

## 1. Prepare MongoDB Atlas

1. Open MongoDB Atlas.
2. Go to Database Access and create a database user if you do not already have one.
3. Go to Network Access and add this IP while testing:
   - `0.0.0.0/0`
4. Go to Database, click Connect, then Drivers.
5. Copy the connection string. It should look like:

```text
mongodb+srv://USER:PASSWORD@cluster-name.mongodb.net/vmax
```

Replace `USER`, `PASSWORD`, and add the database name `vmax` at the end if Atlas does not include one.

## 2. Stop Tracking Local Secrets

Your `.env` file contains real secrets and should not be pushed.

Run this once:

```bash
git rm --cached .env
git add .gitignore .env.example render.yaml DEPLOYMENT.md package.json backend/server.js frontend/src/scripts.js
git commit -m "Prepare VMAX for deployment"
git push
```

If `.env` was already pushed to GitHub, rotate the MongoDB password and JWT secret.

## 3. Deploy on Render

1. Open Render.
2. Click New.
3. Choose Blueprint.
4. Connect your GitHub account if needed.
5. Select the `VMAX` repo.
6. Render will read `render.yaml`.
7. Fill the secret environment variables when Render asks:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `API_READ_ACCESS`
   - `API_KEY`
8. Click Apply or Deploy.

Render will run:

```bash
npm install
npm start
```

The live app will be available at Render's HTTPS URL, for example:

```text
https://vmax.onrender.com
```

## 4. If You Deploy Manually Instead

Create a Render Web Service with these settings:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

Add the same environment variables:

```text
MONGO_URI
JWT_SECRET
API_READ_ACCESS
API_KEY
NODE_ENV=production
```

## 5. Verify the Deployment

Open these URLs after deploy:

```text
https://YOUR-RENDER-URL.onrender.com
https://YOUR-RENDER-URL.onrender.com/health
```

The health URL should return JSON with `ok: true`.

Then test the room flow:

1. Sign in on browser one.
2. Create a room.
3. Copy the room code.
4. Open an incognito window or second browser.
5. Join the room.
6. In browser one, open a movie and click Watch in Room.
7. Confirm browser two opens the same movie.
8. Test play, pause, and seek.

## 6. Local Test

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
http://localhost:3000/health
```
