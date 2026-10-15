# Ghost Cart

A "what-if" spending tracker: log the things you almost bought (the ghosts in your cart), see how much you kept, and track a savings goal.

Self-hosted: Node + Hono + SQLite backend, React + Vite frontend, reached over Tailscale.

## Develop

```sh
npm install
npm run dev        # API on :3000 (as DEV_USER, default dev@local) + Vite on :5173
npm test
```

Use `DEV_USER=someone@x npm run dev` to try a different user; each login has separate data.

## Run on your machine

```sh
npm run build
PORT=3000 DB_PATH=$HOME/ghost-cart/ghostcart.db npm start   # listens on 127.0.0.1 only
tailscale serve --bg 3000                                 # HTTPS on your tailnet
```

Identity comes from the `Tailscale-User-Login` header that `tailscale serve` adds, so each tailnet user gets their own data automatically.
The server binds to loopback only; do not expose it any other way (and do not use `tailscale funnel`), or the header could be spoofed.

## Stop it

Two things are running: the Tailscale proxy and the Node server.

1. Stop exposing it on your tailnet:
   ```sh
   tailscale serve status   # see what's being served
   tailscale serve reset    # remove all serve config (or: tailscale serve --https=443 off)
   ```
2. Stop the server:
   - Foreground (`npm start` in a terminal): `Ctrl+C`.
   - Background or lost terminal:
     ```sh
     lsof -nP -iTCP:3000 -sTCP:LISTEN   # note the PID
     kill <PID>
     ```
   - launchd job (see below), which restarts if you only kill the process:
     ```sh
     launchctl unload ~/Library/LaunchAgents/com.ghostcart.plist
     ```

Stopping loses no data; it all lives in the SQLite file. If you stop only the server, the Tailscale URL returns a 502 until it's back.

## Start on boot (macOS)

Create `~/Library/LaunchAgents/com.ghostcart.plist` that runs `npm start` in this directory with `PORT` and `DB_PATH` set, then `launchctl load` it.

## Backup

The whole database is one file (`DB_PATH`, plus `-wal`/`-shm` while running). Copy it with `sqlite3 ghostcart.db ".backup backup.db"`.
