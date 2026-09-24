# WebRocz CRM — Hostinger VPS Deploy Guide

The app uses **SQLite** (a file DB), so it runs great on a VPS with a persistent disk.
No database migration needed. Below is the full one-time setup, then how to update.

Assumes an **Ubuntu 22.04/24.04** Hostinger VPS and a domain (e.g. `crm.webrocz.com`)
pointed to the VPS IP (A record). VPS IP for this account: **200.141.2.227**.

---

## ⚠️ SHARED VPS — do NOT disturb the existing sites (showyours, digitalhat, webrocz.com)

This VPS already runs other apps. Follow these rules so nothing breaks:

1. **New subdomain only.** Deploy the CRM on `crm.webrocz.com` (a NEW DNS A record →
   `200.141.2.227`). Never touch the `webrocz.com` / showyours / digitalhat DNS or configs.
2. **Own port.** The CRM listens on an internal port. First check which ports are free:
   ```bash
   ss -ltnp        # list listening ports — pick one NOT in use (e.g. 3000, else 3005/3010)
   ```
   If 3000 is taken, use another free port everywhere below (ecosystem env `PORT`, Nginx `proxy_pass`).
3. **Add a NEW Nginx server block** in its own file — never edit or delete the existing
   site files in `/etc/nginx/sites-available/`.
4. **Skip `apt upgrade`** — do NOT run a full system upgrade (it can restart the other sites).
   Only *install* the few packages below (additive, safe).
5. **Check what's already running first** so names/ports don't clash:
   ```bash
   pm2 list        # existing PM2 apps (our app name "webrocz-crm" is unique — safe to add)
   ls /etc/nginx/sites-enabled/   # existing site configs — leave them alone
   node -v         # is Node already installed? (skip step 2 if v18/20+ already there)
   ```
   Paste that output to confirm no clash before continuing.

---

## 1. Connect to the VPS

```bash
ssh root@YOUR_VPS_IP
```

## 2. Install Node.js 20 + tools (one time)

> **Do NOT run `apt upgrade`** on a shared VPS. Only install what's missing.
> Nginx is likely already installed (the other sites use it) — don't reinstall it.

```bash
apt update
# Only if Node is missing or older than v18:
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt -y install nodejs git build-essential python3      # (nginx already present — omit it)
npm i -g pm2
node -v   # should print v20.x
```
> `build-essential python3` are there in case better-sqlite3 needs to compile.

## 3. Put the app on the server

**Option A — via Git** (if you push this repo to GitHub):
```bash
cd /var/www && git clone YOUR_REPO_URL webrocz && cd webrocz/app
```
**Option B — upload** the `app/` folder with SFTP (FileZilla) to `/var/www/webrocz/app`, then:
```bash
cd /var/www/webrocz/app
```

## 4. Create the production `.env`

```bash
nano .env
```
Paste (change the secret!):
```
DATABASE_URL="file:./prisma/dev.db"
AUTH_SECRET="PASTE_A_STRONG_SECRET_HERE"
# Keep DEMO_DATE only while showing the demo data. DELETE this line for real live data.
DEMO_DATE="2026-08-25T10:00:00"
```
Generate a strong secret:
```bash
openssl rand -hex 32
```

## 5. Install, set up the DB, build

```bash
npm ci
npm run db:push        # creates the SQLite tables
npm run db:seed        # loads demo data — SKIP this for a real empty start
npm run build
```

## 6. Start with PM2 (keeps it running + auto-restart on reboot)

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup            # run the command it prints, once
```
Check it: `pm2 logs webrocz-crm` — should say "Ready". App is now on `localhost:3000`.

## 7. Nginx reverse proxy (domain → app)

```bash
nano /etc/nginx/sites-available/webrocz
```
Paste (change the domain):
```nginx
server {
  listen 80;
  server_name crm.webrocz.com;
  client_max_body_size 15M;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
```
Enable + reload:
```bash
ln -s /etc/nginx/sites-available/webrocz /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 8. Free SSL (HTTPS)

```bash
apt -y install certbot python3-certbot-nginx
certbot --nginx -d crm.webrocz.com
```
Now open **https://crm.webrocz.com** 🎉

## 9. Firewall (optional but recommended)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## Updating later (after code changes)

```bash
cd /var/www/webrocz/app
git pull                # or re-upload changed files
npm ci
npm run build
pm2 restart webrocz-crm
```

## Going from DEMO data → REAL data

1. Stop showing demo data: delete the `DEMO_DATE` line from `.env`.
2. Start with a clean DB:
   ```bash
   rm -f prisma/dev.db
   npm run db:push
   ```
   (do NOT run `db:seed`).
3. Log in as the first Super Admin — create it once by editing the seed, or ask me to add a
   `create-admin` script. Then add your real team + clients from the CRM UI.
4. `pm2 restart webrocz-crm`.

## Backups (SQLite = one file)

```bash
# daily copy of the DB
cp /var/www/webrocz/app/prisma/dev.db /root/backups/dev-$(date +%F).db
```
Add that to a cron job for automatic daily backups.

---

### Notes
- Change `AUTH_SECRET` in production (never keep the default) — it signs login sessions.
- Keep the `.env` file out of git (`.gitignore` it) so the secret isn't exposed.
- The app listens on port 3000 internally; only Nginx (80/443) is public.
