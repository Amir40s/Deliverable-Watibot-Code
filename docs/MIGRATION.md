# Contabo Server Migration & Media Storage Guide

This document outlines the self-hosted media storage architecture, server-to-server migration procedure, and automated backup/restore procedures for WatiBot.

---

## 1. Environment Configuration

Set the following environment variables in `.env` or `.env.local`:

```env
# Local Self-Hosted Media Storage Configuration
STORAGE_DRIVER=local

# Dedicated Persistent Storage Directory (outside app build)
# Linux VPS path example:
LOCAL_STORAGE_DIR=/var/storage/watibot/media

# App Public URL (Used to construct public media links)
NEXT_PUBLIC_APP_URL=https://app.watibot.io
```

---

## Nginx Upload Limit Configuration (Fix HTTP 413 Error)

Nginx's default upload limit is 1MB. To allow large media uploads (images, audio, videos up to 100MB), add `client_max_body_size 100M;` to Nginx:

### Command (One-line fix for Contabo Ubuntu VPS):
```bash
sudo sed -i '/http {/a \    client_max_body_size 100M;' /etc/nginx/nginx.conf && sudo nginx -t && sudo systemctl reload nginx
```

Or add `client_max_body_size 100M;` inside `/etc/nginx/sites-available/app.watibot.io` server block and reload Nginx:
```bash
sudo systemctl reload nginx
```

---

## 2. Directory Structure

Media files are automatically categorized and stored as:

```
/var/storage/watibot/media/
├── images/YYYY/MM/uuid.jpg
├── videos/YYYY/MM/uuid.mp4
├── audio/YYYY/MM/uuid.ogg
├── documents/YYYY/MM/uuid.pdf
├── stickers/YYYY/MM/uuid.webp
└── profiles/YYYY/MM/uuid.png
```

---

## 3. Automated Backup Cron Job Setup

To run daily automated backups at 2:00 AM server time, add a cron job on your Contabo VPS:

```bash
# Edit crontab
crontab -e

# Add daily backup entry:
0 2 * * * cd /var/www/watibot && node scripts/backup.js >> /var/log/watibot_backup.log 2>&1
```

Backups are saved to `/var/www/watibot/backups/YYYY-MM-DD_HHMM/` containing:
- `db_dump_YYYY-MM-DD_HHMM.sql`
- `media_backup_YYYY-MM-DD_HHMM.tar.gz`
- `env_meta_YYYY-MM-DD_HHMM.json`

---

## 3.1 Campaign Worker Daemon Setup (Contabo VPS)

To ensure campaign broadcasts run continuously without interruption (even when browser tabs are closed), run the background worker daemon via PM2 on your Contabo server:

```bash
# Start the background campaign worker with PM2
pm2 start scripts/campaign-worker.js --name "watibot-worker"

# Save PM2 process list so it automatically restarts on server reboot
pm2 save
pm2 startup
```

Alternatively, add a cron job to trigger the scheduled message processor every minute:
```bash
# Edit crontab
crontab -e

# Add cron entry:
* * * * * curl -s http://localhost:7860/api/cron/process-scheduled >> /var/log/watibot_worker.log 2>&1
```

---

## 4. Server-to-Server Migration Guide (Contabo to New Server)

To migrate WatiBot and all media to a new Contabo VPS with **zero data loss**:

### Step 1: Prepare New Server
Install Node.js 20+, PostgreSQL, and Git on the new server.

### Step 2: Sync Media Directory
Run `rsync` from the old server to copy the entire media folder directly to the new server:

```bash
rsync -avzP /var/storage/watibot/media/ root@<NEW_SERVER_IP>:/var/storage/watibot/media/
```

### Step 3: Dump and Restore Database
Dump the database on the old server:
```bash
pg_dump $DATABASE_URL > watibot_migration.sql
```

Transfer and restore on the new server:
```bash
psql $DATABASE_URL < watibot_migration.sql
```

### Step 4: Clone Code and Start Application
1. Clone the repository on the new server.
2. Copy `.env` to the new server.
3. Run `npm install` and `npx prisma generate`.
4. Start the application: `npm run build && npm run start`.

### Step 5: Update DNS / Nginx Reverse Proxy
Point domain DNS records to the new server IP. All media URLs (`https://app.watibot.io/api/media/files/...`) and existing Cloudinary URLs will continue working without any manual URL edits.

---

## 5. Disaster Recovery / Fresh Server Restoration

If restoring from a backup archive:

```bash
node scripts/restore.js /path/to/backups/2026-07-31_0200
```
Then start the application.
