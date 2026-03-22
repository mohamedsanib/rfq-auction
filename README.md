# RFQ Auction System

A full-stack British Auction platform where buyers post freight/logistics RFQs (Request for Quotation) and carriers compete by submitting live bids. The auction automatically extends when bidding activity happens near the closing time — preventing last-second sniping and keeping competition fair.

Built with **Express.js**, **PostgreSQL**, **Socket.io**, and **React**.

---

## What does this actually do?

Think of it like an eBay auction but flipped — instead of buyers competing to pay more, suppliers (carriers) compete to offer the *lowest* price for a shipment job.

A buyer creates an RFQ with a closing time. Carriers submit bids with their freight charges. If a carrier places a bid in the last 10 minutes (configurable), the clock extends by 5 minutes. This keeps going until nobody bids, or the hard "forced close" deadline is hit — after which no extensions are possible.

The entire rankings board and activity log update in real time via WebSockets, so every carrier watching the page sees instantly when they've been undercut.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Express.js (Node.js) |
| Database | PostgreSQL |
| Real-time | Socket.io |
| Scheduler | node-cron |
| Frontend | React (Create React App) |
| Auth | JWT in httpOnly cookie + bcrypt |

---

## Project Structure

```
rfq-auction/
│
├── backend/
│   ├── src/
│   │   ├── index.js                  ← Express app + Socket.io server entry point
│   │   ├── db/
│   │   │   └── index.js              ← PostgreSQL pool + auto-creates all tables on startup
│   │   ├── middleware/
│   │   │   └── auth.js               ← JWT verify middleware + requireRole() guard
│   │   ├── routes/
│   │   │   ├── auth.js               ← /api/auth — register, login, logout, me
│   │   │   ├── rfqs.js               ← /api/rfqs — create, list, detail, activate
│   │   │   └── bids.js               ← /api/bids — place, cancel, trigger extension logic
│   │   ├── jobs/
│   │   │   └── auctionCron.js        ← Runs every minute — closes expired auctions
│   │   └── socket/
│   │       └── index.js              ← Socket auth middleware + room join/leave
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── index.js                  ← CRA entry point
    │   ├── App.jsx                   ← Routes + role-based auth guards
    │   ├── index.css                 ← Global design system styles
    │   ├── context/
    │   │   └── AuthContext.jsx       ← Global user state, login/register/logout
    │   ├── hooks/
    │   │   └── useSocket.js          ← Singleton Socket.io connection + per-RFQ hook
    │   ├── components/
    │   │   ├── Navbar.jsx            ← Top nav with user info and logout
    │   │   ├── Countdown.jsx         ← Live HH:MM:SS timer, pulses red under 5 min
    │   │   └── BidModal.jsx          ← Bid form popup with live total calculation
    │   └── pages/
    │       ├── LoginPage.jsx
    │       ├── RegisterPage.jsx
    │       ├── BuyerDashboard.jsx    ← Create RFQs, view own auctions, activate
    │       ├── CarrierDashboard.jsx  ← Browse all auctions with status filters
    │       └── RFQDetailPage.jsx     ← Live bid rankings, activity log, bid controls
    └── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

### 1. Clone and install

```bash
git clone <your-repo-url>
cd rfq-auction
```

```bash
# Backend
cd backend
npm install

# Frontend (in a new terminal)
cd frontend
npm install
```

### 2. Set up the database

```bash
# Create the database (run this in psql or your DB client)
CREATE DATABASE rfq_auction;
```

The tables are created automatically when the server starts — no migration files needed. On first boot, `db/index.js` runs `CREATE TABLE IF NOT EXISTS` for all four tables.

### 3. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in your values:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/rfq_auction
JWT_SECRET=pick_something_long_and_random_here
PORT=3001
CLIENT_URL=http://localhost:3000
```

> **JWT_SECRET** — don't leave it as the default. Use a random string of at least 32 characters.

### 4. Start the servers

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How to Use It

### As a Buyer

1. Register an account with role **Buyer**
2. Log in — you'll land on the Buyer Dashboard
3. Click **+ New RFQ** and fill in the form:
   - Give the RFQ a name (e.g. "Delhi → Mumbai Shipment March 2024")
   - Set a **Bid Start** time — when carriers can start bidding
   - Set a **Bid Close** time — when bidding normally ends
   - Set a **Forced Close** time — the absolute hard deadline (must be after Bid Close)
   - Set a **Pickup Date** — when the actual service is needed
   - Optionally adjust **Trigger Window** (default 10 min) and **Extension Time** (default 5 min)
4. The RFQ is created as a **Draft**. Click **Activate** to open it for bidding, or wait — it auto-activates when the Bid Start time arrives.
5. Click any RFQ to see live rankings, all carrier bids, and the full activity log.

### As a Carrier

1. Register an account with role **Carrier**
2. Log in — you'll land on the Carrier Dashboard showing all available auctions
3. Filter by status: All / Active / Closed / Draft
4. Click any active auction to open the detail page
5. Click **Place Bid** — fill in:
   - Freight Charges
   - Origin Charges
   - Destination Charges
   - Transit Time (days)
   - Quote Validity date
   - The total cost is calculated automatically
6. Your rank (L1, L2, L3...) updates instantly on everyone's screen
7. You can **Update Bid** to submit a lower price, or **Cancel Bid** to withdraw
8. Watch the countdown timer — if it extends due to trigger window activity, the new time shows immediately

---

## Auction Extension Logic

This is the core mechanic. When a bid or cancellation happens, the system checks three conditions. If **any** of them is true and we're inside the trigger window, the auction extends.

**Trigger window** = the last X minutes before closing (default: 10 minutes)

| Condition | What triggers it |
|-----------|-----------------|
| **A** | Any new bid placed OR any bid cancelled during the trigger window |
| **B** | Any carrier's rank position changed compared to before the action |
| **C** | The L1 (lowest bidder) changed — a different carrier took the top spot |

**Example:** Bid Close is 6:00 PM. Trigger Window is 10 minutes. Extension is 5 minutes.

- A carrier bids at 5:55 PM → Condition A fires → Close extends to 6:05 PM
- Another carrier undercuts them at 6:02 PM → Condition A + C fire → Close extends to 6:07 PM
- Forced Close is 6:15 PM → if the next extension would push past 6:15, it gets capped at 6:15
- Once 6:15 PM hits → auction is marked **force_closed**, no more extensions possible

The extension cap is important — nobody can keep an auction alive indefinitely.

---

## API Reference

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Create account. Body: `{ name, email, password, role }` |
| POST | `/api/auth/login` | — | Login. Sets httpOnly JWT cookie. Body: `{ email, password }` |
| POST | `/api/auth/logout` | — | Clears the cookie |
| GET | `/api/auth/me` | cookie | Returns current user from cookie |

### RFQs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/rfqs` | buyer | Create a new RFQ |
| GET | `/api/rfqs` | any | Buyer: own RFQs. Carrier: all RFQs. Includes `lowest_bid` field. |
| GET | `/api/rfqs/:id` | any | Full detail — ranked bids, logs, `myBid` for carriers |
| PATCH | `/api/rfqs/:id/activate` | buyer | Manually activate a draft RFQ |

### Bids

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/bids/:rfqId` | carrier | Place or replace bid. Triggers extension check. |
| DELETE | `/api/bids/:rfqId` | carrier | Cancel active bid. Triggers extension check. |

---

## WebSocket Events

The frontend maintains a single Socket.io connection. When a user opens an RFQ detail page, they join that auction's room (`rfq_{id}`). All events are scoped to that room — you only get updates for the RFQ you're currently viewing.

### Client → Server

| Event | Payload | When to send |
|-------|---------|-------------|
| `join_rfq` | `rfqId` | On RFQ detail page mount |
| `leave_rfq` | `rfqId` | On RFQ detail page unmount |

### Server → Client

| Event | Payload | What happened |
|-------|---------|--------------|
| `bids_updated` | `{ bids[], logs[], newBid? }` | A bid was placed or cancelled |
| `rfq_updated` | `{ rfq, reason }` | Auction end time was extended |
| `auction_ended` | `{ status }` | Cron job closed the auction |

---

## Database Schema

### users
```sql
id         SERIAL PRIMARY KEY
name       VARCHAR(255) NOT NULL
email      VARCHAR(255) UNIQUE NOT NULL
password   VARCHAR(255) NOT NULL          -- bcrypt hash
role       VARCHAR(20) CHECK (role IN ('buyer', 'carrier'))
created_at TIMESTAMP DEFAULT NOW()
```

### rfqs
```sql
id               SERIAL PRIMARY KEY
buyer_id         INTEGER REFERENCES users(id)
name             VARCHAR(255) NOT NULL
start_date       TIMESTAMP NOT NULL
end_date         TIMESTAMP NOT NULL        -- extends during trigger window
forced_end_date  TIMESTAMP NOT NULL        -- hard cap, never changes
pickup_date      DATE NOT NULL
trigger_window   INTEGER DEFAULT 10        -- minutes
extension_time   INTEGER DEFAULT 5         -- minutes
status           VARCHAR(20) DEFAULT 'draft'
                 CHECK (status IN ('draft','active','closed','force_closed'))
created_at       TIMESTAMP DEFAULT NOW()
```

### bids
```sql
id                   SERIAL PRIMARY KEY
rfq_id               INTEGER REFERENCES rfqs(id)
user_id              INTEGER REFERENCES users(id)
freight_charges      NUMERIC(12,2) NOT NULL
origin_charges       NUMERIC(12,2) NOT NULL
destination_charges  NUMERIC(12,2) NOT NULL
total_cost           NUMERIC(12,2) GENERATED ALWAYS AS
                       (freight_charges + origin_charges + destination_charges) STORED
transit_time         INTEGER NOT NULL      -- days
validity_of_quote    DATE NOT NULL
is_active            BOOLEAN DEFAULT true  -- false = replaced or cancelled
created_at           TIMESTAMP DEFAULT NOW()
```

> `total_cost` is a generated column — PostgreSQL computes it automatically. You never set it directly.
> `is_active = false` means the bid was replaced (carrier updated their bid) or cancelled. Old bids are kept for history.

### logs
```sql
id          SERIAL PRIMARY KEY
rfq_id      INTEGER REFERENCES rfqs(id)
action      VARCHAR(50) CHECK (action IN ('bid','bid_extension','status_change'))
description TEXT NOT NULL
created_at  TIMESTAMP DEFAULT NOW()
```

---

## Cron Job

Runs every minute via `node-cron` (`* * * * *`).

**What it does:**

1. Finds all `active` RFQs where `end_date <= now`
2. For each expired RFQ:
   - If `forced_end_date <= now` → mark as `force_closed`
   - Otherwise → mark as `closed`
3. Inserts a `status_change` log entry
4. Broadcasts `rfq_updated` + `auction_ended` to the RFQ's Socket.io room
5. Also finds all `draft` RFQs where `start_date <= now` and auto-activates them

The cron runs independently of HTTP requests — even if no one is browsing the app, auctions will close on time.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/rfq_auction` |
| `JWT_SECRET` | Secret key for signing JWTs | `rfq_auction_secret_key` ← **change this** |
| `PORT` | Port for the Express server | `3001` |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:3000` |

---

## Notes and Gotchas

**One bid per carrier per RFQ** — when a carrier places a new bid, the old one is set to `is_active = false` and a new row is inserted. This means the full bid history is preserved in the database even though only the latest active bid shows in the rankings.

**Carrier anonymity** — on the RFQ detail page, carriers can only see their own name. Other carriers show as "Carrier 1", "Carrier 2" etc. Buyers can see all names.

**Auth is cookie-based** — the JWT is stored in an `httpOnly` cookie, so JavaScript can't read it. This means `credentials: 'include'` is required on every fetch call from the frontend.

**Socket auth** — the Socket.io connection also authenticates using the JWT from the cookie header. If the cookie is missing or invalid, the socket connection is rejected.

**The trigger window check happens on the `rfq` object fetched before the bid write** — this is intentional. If the end_date gets extended between reading and writing, the check uses the end_date that was current when the bid came in. Extensions compound correctly because each bid re-reads the latest `end_date` from the database.

---

## License

MIT
