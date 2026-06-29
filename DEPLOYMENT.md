# VMAX Deployment

## Recommended: Render Web Service

1. Push the repo to GitHub.
2. In Render, create a new Web Service from this repo.
3. Use these settings:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
4. Add environment variables in the Render dashboard:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `API_READ_ACCESS`
   - `API_KEY`
5. Deploy. Render will provide an HTTPS URL for the app.

The frontend is served by Express from `frontend/`, so you do not need a separate static-site deploy.

## Important Secret Cleanup

The local `.env` file is currently tracked by Git. Before pushing publicly, run:

```bash
git rm --cached .env
git add .gitignore .env.example
git commit -m "Stop tracking local environment file"
```

Then rotate any keys that were already pushed to GitHub.

## Local Test

```bash
npm install
npm start
```

Open `http://localhost:3000`.
