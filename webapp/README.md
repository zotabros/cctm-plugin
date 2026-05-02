# cctm-server

CCTokenManager server: Next.js dashboard, ingest API, Postgres (Prisma), OAuth device pairing for [cctm-agent](https://github.com/zotabros/cctm-agent).

## Quick install (recommended)
One-shot installer — handles brew/apt, Docker, Node 20+, pnpm, .env secrets, Postgres, migrations, seed, and starts the web container.

```bash
git clone https://github.com/zotabros/cctm-server.git
cd cctm-server
./install.sh
```
Windows: run `install.ps1` in PowerShell.

After install: dashboard at `http://localhost:3636` (or the auto-picked free port if 3636 was busy).

## Manual setup
Requires: Docker + Compose v2, Node 20+, pnpm.

```bash
cp .env.example .env
# generate secrets
sed -i '' "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$(openssl rand -base64 32)|" .env
sed -i '' "s|CRON_SECRET=.*|CRON_SECRET=$(openssl rand -base64 32)|" .env

pnpm install
pnpm prisma:generate
docker compose up -d postgres
pnpm prisma migrate deploy
docker compose up -d --build web
```

## Daily ops
```bash
./server.sh start        # postgres + web
./server.sh stop
./server.sh restart
./server.sh logs         # tail web logs
./server.sh status
./server.sh migrate      # apply new migrations
./server.sh shell        # open shell in web container
./server.sh nuke         # ⚠ wipe DB volumes
```

## Pair an agent
```bash
npm install -g @zotabros/cctm-agent
cctm-agent pair http://your-server:3636
```
