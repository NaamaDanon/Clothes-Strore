# Clothes Store – Developer Notes

## Overview
A Node.js/Express clothes store with static HTML pages and JSON-file-based persistence (no database).

## Architecture
- **Backend**: Express 5 server at `server/app.js`, route handlers in `server/routes/`.
- **Frontend**: Static HTML pages served from `public/` — `store.html` is the main entry.
- **Data**: JSON files in `data/` (users, carts, purchases, wishlist, feedback, etc.).
- **Images**: Product images and prints in `public/images/`.
- **Auth**: Cookie-based (`username` cookie), no sessions or tokens.

## Running
```bash
docker compose -f docker-compose.base44.yml up -d
```
The app listens on port 3000. Root `/` redirects to `/store.html`.

## Key Pages
- `/store.html` – Product listing
- `/login.html` / `/register.html` – Authentication
- `/cart.html` – Shopping cart
- `/checkout.html` – Checkout flow
- `/wishlist.html` – Wishlist
- `/my-items.html` – Past purchases
- `/admin.html` – Admin panel (requires admin user)
- `/feedback.html` – Submit feedback

## Notes
- `node_modules` is committed to the repo.
- No external services or API keys required.
- No database — all data persists to JSON files in `data/`.
- No live-reload dev server; restart the container after server-side code changes.
