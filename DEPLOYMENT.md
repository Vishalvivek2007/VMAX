# VMAX Deployment Guide: Free, No Cold Starts

Best free option for VMAX: deploy it on an Oracle Cloud Always Free VM.

This avoids Render-style cold starts because your app runs on an always-on virtual machine. Express serves the backend, Socket.io, and the static frontend from one Node process.

## What You Need

- GitHub repo with this project pushed
- MongoDB Atlas connection string
- Oracle Cloud account
- Optional but recommended: a domain name

## 1. Prepare MongoDB Atlas

1. Open MongoDB Atlas.
2. Go to Database Access and create a database user.
3. Go to Network Access.
4. Add your Oracle VM public IP after creating the VM.
5. For quick testing only, you can temporarily allow:

```text
0.0.0.0/0
```

6. Copy your connection string:

```text
mongodb+srv://USER:PASSWORD@cluster-name.mongodb.net/vmax
```

## 2. Stop Tracking Local Secrets

Your `.env` file contains real secrets and should not be pushed.

Run this once locally:

```bash
git rm --cached .env
git add .gitignore .env.example DEPLOYMENT.md ecosystem.config.cjs deploy/Caddyfile.example package.json backend/server.js frontend/src/scripts.js
git commit -m "Prepare VMAX for VPS deployment"
git push
```

If `.env` was ever pushed to GitHub, rotate the MongoDB password and JWT secret.

## 3. Create the Oracle Always Free VM

1. Open Oracle Cloud.
2. Go to Compute, then Instances.
3. Click Create instance.
4. Image: Ubuntu 22.04 or Ubuntu 24.04.
5. Shape: choose an Always Free eligible shape.
6. Add or generate an SSH key.
7. Create the instance.
8. Copy the public IP.

In the Oracle instance security list, allow:

```text
TCP 22
TCP 80
TCP 443
TCP 3000
```

You can remove `3000` later if you use a domain with Caddy.

## 4. SSH Into the VM

From your computer:

```bash
ssh ubuntu@YOUR_VM_PUBLIC_IP
```

If Oracle gives you an `opc` user instead:

```bash
ssh opc@YOUR_VM_PUBLIC_IP
```

## 5. Install Node, Git, PM2, and Caddy

Run on the VM:

```bash
sudo apt update
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
sudo apt install -y caddy
```

Check versions:

```bash
node -v
npm -v
pm2 -v
```

## 6. Clone and Configure VMAX

```bash
git clone https://github.com/Vishalvivek2007/VMAX.git
cd VMAX
npm install
cp .env.example .env
nano .env
```

Fill `.env`:

```text
PORT=3000
MONGO_URI=your-mongodb-atlas-uri
JWT_SECRET=your-long-random-secret
API_READ_ACCESS=your-tmdb-read-access-token
API_KEY=your-tmdb-api-key
```

Save in nano:

```text
Ctrl+O
Enter
Ctrl+X
```

## 7. Start the App Forever

```bash
npm run pm2:start
pm2 save
pm2 startup
```

The `pm2 startup` command prints another command. Copy and run that printed command too.

Check logs:

```bash
npm run pm2:logs
```

Open:

```text
http://YOUR_VM_PUBLIC_IP:3000
http://YOUR_VM_PUBLIC_IP:3000/health
```

## 8. Add HTTPS With a Domain

In your domain DNS, create an `A` record:

```text
Type: A
Name: @
Value: YOUR_VM_PUBLIC_IP
```

For `www`:

```text
Type: A
Name: www
Value: YOUR_VM_PUBLIC_IP
```

Then on the VM:

```bash
sudo nano /etc/caddy/Caddyfile
```

Use:

```text
your-domain.com {
  reverse_proxy localhost:3000
}
```

For `www` too:

```text
your-domain.com, www.your-domain.com {
  reverse_proxy localhost:3000
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

Open:

```text
https://your-domain.com
https://your-domain.com/health
```

## 9. Updating After Code Changes

On the VM:

```bash
cd VMAX
git pull
npm install
npm run pm2:restart
```

## 10. Room Sync Test

1. Sign in on browser one.
2. Create a room.
3. Copy the room code.
4. Open incognito or another browser.
5. Join the room.
6. In browser one, click Watch in Room.
7. Confirm browser two opens the same movie.
8. Test play, pause, and seek.

## Useful Commands

```bash
pm2 status
npm run pm2:logs
npm run pm2:restart
pm2 stop vmax
```
