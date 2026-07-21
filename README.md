# TCG Marketplace Pricing Manager

Web app for managing TCG Player marketplace pricing via bulk pricing rules.

All processing happens in the browser — no backend required.

## Setup

```bash
cd frontend
npm install
```

## Running

```bash
cd frontend
npm run dev
```

Then open http://localhost:5173 in your browser.

## Deploying to GitHub Pages

```bash
cd frontend
npm run deploy
```

Then go to your GitHub repo → **Settings → Pages → Source: Deploy from a branch → `gh-pages` branch**.

## Usage

1. Upload your TCG Player pricing CSV
2. Set bulk pricing rules (e.g., "if quantity ≥ 3, increase price by 10%")
3. Apply the rules
4. Export the updated CSV

## Features

- Upload TCG Player inventory CSV
- View inventory in a paginated table
- Set bulk pricing rules based on quantity thresholds
- Apply pricing rules to all inventory
- Export updated pricing as CSV
- No backend required — everything runs in the browser
