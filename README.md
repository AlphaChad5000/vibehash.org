# vibehash.org

The Vibe Hash website: a React app (Vite, TypeScript, Tailwind) that reads the public testnet node directly from the
browser. The protocol and the CLI live in [AlphaChad5000/vibehash](https://github.com/AlphaChad5000/vibehash).

## Pages

| Route | What it is |
| --- | --- |
| `/` | The front page: the worker's dashboard replayed in the hero, live stats, how it works, research, CLI, downloads |
| `/jobs`, `/jobs/:id` | Every job on the network, and each one's curve, settings and commands |
| `/wallet?a=<address>` | Any address's balance, stake, unbonding and reputation, live. Read-only: never asks for a key |
| `/submit` | A job builder: checks a CSV or chat file in the browser (nothing is uploaded) and writes the `vibehash train` command |

Static files in `public/` are served as they are: the guide (`/guide/`), the network reports (`/network/`), the
installers (`install.ps1`, `install.sh`), the whitepaper, `og.png` and `CNAME`.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks, builds to dist/, and copies index.html to 404.html for the routes
npm run preview    # serves dist/
```

`?node=http://localhost:8545` on any page points it at another node, such as a local `vibehash testnet`.

## Code map

- `src/lib/node.tsx`: the node's API types, `LiveProvider` (/network and /status every 30 s, shared by every page), `useNode`
- `src/lib/terminal.ts`: the hero's dashboard, a port of the CLI's `minerui.py` and `termui.py` drawn on a canvas
- `src/components/`: layout (testnet bar, nav, footer), the terminal, live stats and job rows, the chart
- `src/pages/`: one file per page

## Deploy (Cloudflare Workers)

The site is one Worker, `vibehash-web` (`wrangler.jsonc`): `dist/` served as static assets, with `worker/index.ts`
in front of `/api/*` only. That Worker passes the node's public GETs through and caches them for a few seconds
(`/network` 10 s, `/status` 3 s), so visitors' polling doesn't all land on the node.

```sh
npx wrangler login     # once
npm run deploy         # build, then wrangler deploy
npm run preview:cf     # the real Worker locally, at http://localhost:8787
npm run types          # after changing wrangler.jsonc: regenerates worker-configuration.d.ts
```

- Preview: https://vibehash-web.vibe-hash.workers.dev (the Cache API does nothing on workers.dev, so `/api` isn't
  cached there; it is on the real domain)
- Production: vibehash.org and www.vibehash.org, the custom domains in `wrangler.jsonc`.
- Deploy on push: Workers Builds is connected to this repository. A push to `main` builds (`npm run build`, Node
  version from `.node-version`) and deploys (`npx wrangler deploy`); other branches get a preview URL. Build logs:
  dashboard → Workers & Pages → vibehash-web → Deployments. `npm run deploy` still works for a deploy by hand.
- Miner leaderboard (`/miners`): `worker/leaderboard.ts`. A cron trigger every 2 minutes reads new blocks from the
  node's `/blocks` and keeps 7 days of hourly per-address totals (reward pay for work and checks, FLOPs, rounds,
  slashes) in the `LEADERBOARD` KV namespace; `GET /api/leaderboard?window=day|week` reads them. To rebuild from
  scratch, delete the `state:v1` key: the next runs read the chain again, 300 blocks at a time.
- Analytics: Cloudflare Web Analytics, automatic setup. Cloudflare adds its beacon to every HTML page at the edge
  (cookie-free; app navigation counts too), so there's nothing for it in the code.

`.gitattributes` keeps Unix line endings on every checkout: `curl -fsSL https://vibehash.org/install.sh | sh` breaks
on a script with Windows line endings, and Wrangler uploads the files as they are on disk.

## Posting jobs from the browser

Not yet possible, and not because of the site: the node sends CORS headers only on GETs and has no OPTIONS handler,
so no web page can POST a transaction to it. In-browser posting also needs Ed25519 signing of the exact transaction
bytes the Python client makes, and the dataset upload. Until the node allows it, `/submit` produces the command that
does all of that from the user's own machine.
