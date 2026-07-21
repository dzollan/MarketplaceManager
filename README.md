# TCG Marketplace Pricing Manager

Web app for managing TCG Player marketplace pricing via bulk pricing rules.

## Setup

```bash
# Install all dependencies
npm run install-all
```

## Running

You'll need two terminals:

**Terminal 1 (Backend):**
```bash
cd backend
npm start
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Then open http://localhost:5173 in your browser.

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
