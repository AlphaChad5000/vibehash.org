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

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. It needs a one-time
setting: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Until that is switched, Pages keeps
serving the branch as files, which no longer works now that the site needs a build.

Cloudflare Pages works too: build command `npm run build`, output directory `dist`.

## Posting jobs from the browser

Not yet possible, and not because of the site: the node sends CORS headers only on GETs and has no OPTIONS handler,
so no web page can POST a transaction to it. In-browser posting also needs Ed25519 signing of the exact transaction
bytes the Python client makes, and the dataset upload. Until the node allows it, `/submit` produces the command that
does all of that from the user's own machine.
