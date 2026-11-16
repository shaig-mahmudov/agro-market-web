# AgroMarket Web (`agro-market-web`)

Frontend web application for **AgroMarket** — a B2B direct agricultural marketplace connecting local farmers with restaurants and cafes through consolidated morning milk-run deliveries.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, React 19)
- **Styling:** Tailwind CSS v4
- **Deployment Modes:**
  - **Static Export (`output: "export"`):** Default mode for GitHub Pages / CDN hosting (`./out`)
  - **Standalone Node Server (`NEXT_OUTPUT_MODE=standalone`):** Used by `Dockerfile` for containerized deployments

## Key Features & Routes

- `/` — **Produce Catalog & Multi-Farmer Morning Cart:** Filter regional/organic produce, automatic volume tier pricing, and consolidated checkout across multiple farms.
- `/login` — **Passwordless Phone OTP Authentication:** E.164 phone number login and registration for Restaurants and Farmers.
- `/farmer` — **Farmer Hub:** Publish and edit harvest listings, manage stock & volume price tiers, and upload produce photos via presigned URLs.
- `/orders` — **Order Management & Consolidated B2B Invoices:**
  - Farmers accept/reject incoming orders and reconcile self-delivery weights.
  - Restaurants track multi-farmer checkout groups, review/approve or dispute doorstep scale weights, print consolidated statements, and trigger 1-click repeat orders.
- `/logistics` — **Morning Milk-Run Dispatch:** Batch confirmed farm orders into refrigerated delivery runs, advance pickup/transit status, and record scale weights & proof photos.
- `/admin` — **Pilot Onboarding & Verification:** Approve farmers, restaurants, and drivers, and manage order settlement statuses.
- `/profile` — **Business Profile & Telegram Alerts:** Manage business details (VOEN/Tax ID, region, delivery window) and generate Telegram bot deep-links for instant order notifications.

## Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

| Variable | Description | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Base URL of the AgroMarket backend API (no trailing slash) | `http://localhost:5095` |
| `NEXT_PUBLIC_BASE_PATH` | Optional base path when hosted under a subpath (e.g., `/agro-market-web` on GitHub Pages) | `""` |
| `NEXT_OUTPUT_MODE` | Set to `standalone` for Docker server builds; defaults to static `export` | `export` |

## Development & Build

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Run ESLint
npm run lint

# Build production static export (outputs to ./out)
npm run build
```

## Docker Build

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://your-backend-api.example.com \
  -t agro-market-web .

docker run -p 3000:3000 agro-market-web
```
