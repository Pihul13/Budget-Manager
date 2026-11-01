# Budget Manager - Personal Finance Tracker

A multi-user personal finance tracker. Each person signs in, keeps a private
workspace, and can personalize it with their own display name (for example,
“Alex's Finance”).

## Features

- Bank, cash, investment, and credit-card accounts
- Expense and income categories with subcategories
- Transfers between accounts
- Monthly and category budgets
- Saving goals and funds
- Recurring transaction rules
- Dashboard, month history, and net-worth snapshots
- Private browser cache for faster page navigation
- INR currency
- Private JSON export/import backups
- Responsive interface

## Stack

- React + Vite
- Express + Node.js
- MongoDB + Mongoose
- Clerk authentication
- Recharts

## Local development

Requirements: Node.js 20+ and MongoDB (local or Atlas), plus a Clerk
application.

1. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI`,
   `CLERK_SECRET_KEY`, and `CLERK_PUBLISHABLE_KEY`.
2. Copy `client/.env.example` to `client/.env.local` and set
   `VITE_CLERK_PUBLISHABLE_KEY` to the same Clerk publishable key. Leave
   `VITE_API_URL` unset for local development.
3. Install dependencies and start both services:

   ```bash
   npm install
   npm --prefix client install
   npm --prefix server install
   npm run dev
   ```

The Vite development server runs on port 5173 and proxies `/api` to the API on
port 5001.

## Deploy to Render

1. Create a MongoDB Atlas database and restrict network access to the Render
   service as appropriate. Do not commit the database URI.
2. Create a Clerk application and configure its allowed application origins
   for the Render URL.
3. Push this repository to GitHub, then create a Render Blueprint from
   `render.yaml`.
4. In Render, set the requested environment values:
   - `MONGODB_URI`
   - `CLERK_SECRET_KEY`
   - `CLERK_PUBLISHABLE_KEY`
   - `VITE_CLERK_PUBLISHABLE_KEY` (same publishable key; used at build time)
5. Redeploy after setting the publishable key. The frontend and API are served
   from one Render web service, so `VITE_API_URL` can remain unset.

The Render service exposes `/api/health` for health checks. Keep the service
single-instance while the in-process automatic credit-card payment scheduler
is enabled; multiple instances could process the same due payment concurrently.
Choose a paid Render instance for an always-on public service; free instances
may sleep when idle.

## Privacy and data

- The API requires a valid Clerk identity and scopes database reads and writes
  to that identity.
- Use a **new, empty production database**. Existing single-user records have
  no owner and are deliberately not visible to newly registered users. Export
  any local data before deployment if you want to restore it into your own
  account.
- Never commit `.env` files, API keys, database credentials, backups, or real
  financial data. GitHub visibility does not grant a license to reuse this
  code.
- Settings provides a JSON backup for the signed-in user's records. Store
  downloaded backups somewhere private and secure.
- API responses are cached in browser IndexedDB, partitioned by signed-in
  account, and cleared when the user signs out or switches accounts. Cached
  data is not encrypted at rest; use a private device/browser profile and
  sign out when finished.

## Accounting model

- Expenses reduce the selected account; credit-card expenses increase card
  owed and reduce available credit.
- Income increases the selected account.
- Transfers move money between accounts and are not income or expenses.
- Credit-card payments are transfers, avoiding double-counting as expenses.
- Automatic card payments only record transfers in the tracker; they do not
  initiate real bank payments.
- Goal-tagged transfers remain in the destination account while also counting
  toward the goal.
