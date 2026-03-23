# RFQ Auction System

A full-stack **British Auction** platform for logistics RFQ (Request for Quotation).
Buyers post freight routes, carriers compete by submitting progressively lower bids.
The auction automatically extends when qualifying bids arrive near closing time.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [File Structure](#3-file-structure)
4. [Database Schema](#4-database-schema)
5. [Auction Lifecycle](#5-auction-lifecycle)
6. [British Auction Extension Rules](#6-british-auction--extension-rules)
7. [API Reference](#7-api-reference)
8. [Socket Events](#8-socket-events)
9. [Setup — Backend](#9-setup--backend)
10. [Setup — Frontend](#10-setup--frontend)
11. [Environment Variables](#11-environment-variables)
12. [Roles and Permissions](#12-roles--permissions)

---

## 1. Project Overview

### What is an RFQ?
A **Request for Quotation** is a process where a buyer asks multiple suppliers
(carriers) to submit price quotes for a freight or logistics service. Carriers
compete on price and the buyer selects the best quote.

### What is a British Auction?
A British Auction in this system is a descending-price open auction where:

- Carriers submit bids openly and can see current rankings in real time
- Carriers can keep lowering their own price to beat competitors
- If a qualifying bid arrives close to the auction end time, the auction
  automatically extends to allow fair competition
- A forced close time acts as a hard ceiling — the auction can never
  extend past it no matter what

### What this system does
- Buyers create timed RFQ auctions with configurable British Auction rules
- Carriers browse active auctions, submit bids, and watch live rankings
- A background cron job manages auction state transitions automatically
- All live changes (new bids, rank updates, time extensions, status changes)
  are pushed to all connected clients via WebSockets

---

## 2. Tech Stack

### Backend
| Package | Version | Purpose |
|---------|---------|---------|
| Node.js | >= 18.x | Runtime |
| Express | ^5.2.1 | HTTP server and routing |
| pg | ^8.20.0 | PostgreSQL client |
| socket.io | ^4.8.3 | Real-time WebSocket events |
| jsonwebtoken | ^9.0.3 | JWT auth tokens |
| bcryptjs | ^3.0.3 | Password hashing |
| node-cron | ^4.2.1 | Scheduled auction state jobs |
| dotenv | ^17.3.1 | Environment variable loading |
| cors | ^2.8.6 | Cross-origin requests (open) |

### Frontend
| Package | Version | Purpose |
|---------|---------|---------|
| React | ^19.2.4 | UI framework |
| react-router-dom | ^7.13.1 | Client-side routing |
| axios | ^1.13.6 | HTTP requests |
| socket.io-client | ^4.8.3 | Real-time updates |
| date-fns | ^4.1.0 | Date formatting |

### Database
PostgreSQL (any version >= 13)

---

## 3. File Structure

```
rfq-auction/
│
├── README.md
│
├── backend/
│   ├── server.js                        # Entry point — Express + Socket.IO + cron bootstrap
│   ├── package.json
│   ├── .env                             # Environment variables
│   │
│   └── src/
│       ├── config/
│       │   ├── db.js                    # PostgreSQL connection pool (pg.Pool)
│       │   └── schema.js                # Auto-creates all tables on first start
│       │
│       ├── middleware/
│       │   └── auth.js                  # JWT verification + role guard (buyer/carrier)
│       │
│       ├── controllers/
│       │   ├── authController.js        # signup, signin
│       │   ├── auctionController.js     # createAuction, getBuyerAuctions,
│       │   │                            #   getAllAuctions, getAuctionDetails
│       │   └── bidController.js         # submitBid — core bid flow + socket emit
│       │
│       ├── services/
│       │   └── auctionService.js        # All core business logic:
│       │                                #   computeRanks    — best bid per carrier,
│       │                                #                     correct tie-rank (L1,L1,L3)
│       │                                #   checkAndExtend  — all 4 extension rules
│       │                                #   activateAuction — draft to active
│       │                                #   closeAuction    — active to closed/force_closed
│       │                                #   addAuctionLog   — insert to auction_logs
│       │
│       ├── routes/
│       │   ├── auth.js                  # POST /api/auth/signup  /signin
│       │   ├── auctions.js              # GET/POST /api/auctions/...
│       │   └── bids.js                  # POST /api/auctions/:id/bid
│       │
│       └── jobs/
│           └── cronJobs.js              # Runs every 30 seconds:
│                                        #   draft to active  (start_time reached)
│                                        #   active to closed (current_end_time passed)
│                                        #   active to force_closed (forced_end_time passed)
│
└── frontend/
    ├── package.json
    ├── .env                             # API and socket URLs
    │
    ├── public/
    │   └── index.html                   # Loads Google Fonts: Syne, DM Mono, DM Sans
    │
    └── src/
        ├── index.js                     # React DOM root
        ├── index.css                    # Full design system (CSS variables, all components)
        ├── App.js                       # Router + role-based protected route wrappers
        │
        ├── context/
        │   └── AuthContext.js           # Global auth state: user, token, login(), logout()
        │
        ├── services/
        │   ├── api.js                   # Axios instance with auto JWT header + auth/auction/bid APIs
        │   └── socket.js                # Socket.IO singleton (one connection for the app)
        │
        ├── hooks/
        │   └── useCountdown.js          # Live countdown timer hook, ticks every second
        │
        ├── utils/
        │   └── format.js                # fmtDate, fmtDateTime, fmtCurrency (INR), getRankClass
        │
        ├── components/
        │   └── Layout.js                # Sidebar shell: logo, nav links, user chip, logout
        │
        └── pages/
            ├── SignIn.js                # Email + password sign in form
            ├── SignUp.js                # Name, email, password, role picker (buyer/carrier)
            │
            ├── BuyerDashboard.js        # Buyer's auction list
            │                            #   Stat cards: total / active / draft / closed
            │                            #   "New Auction" modal with server-side validation
            │                            #   Live socket updates to list
            │
            ├── AuctionDetails.js        # Buyer view of one auction:
            │                            #   Auction info card + live countdown timer card
            │                            #   Ranked bids table (all carriers, live via socket)
            │                            #   Activity log (all events, live via socket)
            │
            ├── CarrierDashboard.js      # All active/closed/force_closed auctions
            │                            #   Filter tabs: All / Active / Closed / Force Closed
            │                            #   Live socket updates (new actives, closures)
            │
            └── CarrierAuctionDetail.js  # Carrier view of one auction:
                                         #   Left panel: auction info, config, my current best bid
                                         #   Right panel: countdown timer, ranked bids, activity log
                                         #   Bid modal: charge fields, live running total in INR
                                         #   "Place Bid" / "Bid Again" based on whether bid exists
```

---

## 4. Database Schema

### users

```sql
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255)        NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255)        NOT NULL,   -- bcrypt hash, never stored plain
  role       VARCHAR(20)         NOT NULL CHECK (role IN ('buyer', 'carrier')),
  created_at TIMESTAMP           DEFAULT NOW()
);
```

### auctions

```sql
CREATE TABLE auctions (
  id                  SERIAL PRIMARY KEY,
  rfq_name            VARCHAR(255)  NOT NULL,
  buyer_id            INTEGER       REFERENCES users(id) ON DELETE CASCADE,

  -- Scheduled time bounds (stored as UTC)
  start_time          TIMESTAMP     NOT NULL,   -- when cron activates the auction
  end_time            TIMESTAMP     NOT NULL,   -- original scheduled end time
  forced_end_time     TIMESTAMP     NOT NULL,   -- absolute hard ceiling, never exceeded
  pickup_date         DATE          NOT NULL,   -- freight service/pickup date
  current_end_time    TIMESTAMP     NOT NULL,   -- actual end (pushed forward by extensions)

  -- British Auction configuration
  trigger_window      INTEGER       NOT NULL DEFAULT 5,   -- X: monitor last X minutes
  extension_duration  INTEGER       NOT NULL DEFAULT 5,   -- Y: extend by Y minutes

  -- State
  status              VARCHAR(20)   NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'closed', 'force_closed')),
  lowest_bid          NUMERIC(15,2),   -- cached for fast list display

  created_at          TIMESTAMP     DEFAULT NOW(),
  updated_at          TIMESTAMP     DEFAULT NOW()
);
```

### bids

```sql
CREATE TABLE bids (
  id                   SERIAL PRIMARY KEY,
  auction_id           INTEGER        REFERENCES auctions(id) ON DELETE CASCADE,
  carrier_id           INTEGER        REFERENCES users(id)    ON DELETE CASCADE,
  carrier_name         VARCHAR(255)   NOT NULL,

  -- Charge breakdown (all amounts in INR)
  freight_charges      NUMERIC(15,2)  NOT NULL DEFAULT 0,
  origin_charges       NUMERIC(15,2)  NOT NULL DEFAULT 0,
  destination_charges  NUMERIC(15,2)  NOT NULL DEFAULT 0,
  total_amount         NUMERIC(15,2)  NOT NULL,  -- = freight + origin + destination

  transit_time         VARCHAR(100)   NOT NULL,
  quote_validity       DATE           NOT NULL,

  created_at           TIMESTAMP      DEFAULT NOW()
);
```

One carrier can submit multiple bids on one auction.
Rankings always use the carrier's single lowest bid
(`DISTINCT ON (carrier_id) ORDER BY carrier_id, total_amount ASC`).
Each new bid must have a total strictly less than the carrier's previous best.

### auction_logs

```sql
CREATE TABLE auction_logs (
  id          SERIAL PRIMARY KEY,
  auction_id  INTEGER      REFERENCES auctions(id) ON DELETE CASCADE,
  action      VARCHAR(100) NOT NULL,
  description TEXT         NOT NULL,
  created_at  TIMESTAMP    DEFAULT NOW()
);
```

**All possible action values:**

| Action | Triggered when |
|--------|---------------|
| `CREATED` | Auction saved as draft by buyer |
| `ACTIVATED` | Cron promotes draft to active |
| `BID_SUBMITTED` | Any carrier submits a bid |
| `TIME_EXTENDED` | Extension condition met, end time pushed forward |
| `EXTENSION_BLOCKED` | Extension would have fired but forced close already reached |
| `CLOSED` | Cron closes auction at current_end_time |
| `FORCE_CLOSED` | Cron closes auction at forced_end_time |

### Indexes

```sql
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_buyer  ON auctions(buyer_id);
CREATE INDEX idx_bids_auction    ON bids(auction_id);
CREATE INDEX idx_bids_carrier    ON bids(carrier_id);
CREATE INDEX idx_logs_auction    ON auction_logs(auction_id);
```

The schema is auto-created on first `npm start`. No migration tool needed.

---

## 5. Auction Lifecycle

```
[draft] ──── cron: start_time reached ─────────▶ [active]
                                                      │
                    ┌─────────────────────────────────┤
                    │                                 │
     cron: current_end_time passed        cron: forced_end_time passed
                    │                                 │
                    ▼                                 ▼
               [closed]                        [force_closed]
```

The cron job in `src/jobs/cronJobs.js` runs every **30 seconds** and checks:

1. Any `draft` auction where `start_time <= now` → set status `active`, emit `auction_activated`
2. Any `active` auction where `current_end_time <= now` AND `forced_end_time > now` → set `closed`, emit `auction_closed`
3. Any `active` auction where `forced_end_time <= now` → set `force_closed`, emit `auction_closed`

Each transition writes a log entry and emits socket events to relevant rooms.

---

## 6. British Auction — Extension Rules

### Per-auction configuration

| Field | Default | Meaning |
|-------|---------|---------|
| `trigger_window` (X) | 5 min | The system monitors bids in the last X minutes before `current_end_time` |
| `extension_duration` (Y) | 5 min | When triggered, `current_end_time` is pushed forward by Y minutes |

### Gate check (runs first on every bid)

```
windowStart   = current_end_time − (X minutes)
inWindow      = (now >= windowStart) AND (now <= current_end_time)
```

If `inWindow` is false, the function returns immediately with no extension.

### The single extension rule

> Extend if and only if: the bid is inside the trigger window AND the bidder
> is at L1 in the current rankings after their bid is recorded.

This one rule handles all four scenarios:

| # | Scenario | Bidder at L1 after bid? | Extend? |
|---|----------|------------------------|---------|
| 1 | First ever bid on the auction | Yes — only bidder | Yes |
| 2 | Bidder was L2 or lower, undercuts current L1 | Yes — new sole L1 | Yes |
| 3 | Bidder was already sole L1, bids even lower | Yes — still sole L1 | Yes |
| 4 | A and B tied at L1 (100), A bids 90 — B evicted | Yes — A now sole L1 | Yes |
| 5 | A and B tied at L1 (100), C bids 100 — joins tie | Yes — C is now L1 too | Yes |
| 6 | A is L1 (90), B bids 95 — still L2 | No | No |
| 7 | A is L1 (90), C bids 92 — L3 | No | No |

The only non-extend case: bidder's best amount after the bid is strictly
greater than the current auction minimum. They are L2 or lower and their
bid changed nothing about who holds L1.

### Forced close guard

```
newEnd   = current_end_time + Y minutes
finalEnd = min(newEnd, forced_end_time)

if finalEnd > current_end_time  →  apply extension, log TIME_EXTENDED
else                            →  log EXTENSION_BLOCKED (already at hard ceiling)
```

The auction can never exceed `forced_end_time`.

### Rank tie-breaking

When two or more carriers have the same `total_amount`, they share the same rank.
The next distinct rank skips to reflect actual positions:

```
Carrier A  80    L1
Carrier B  100   L2
Carrier C  100   L2   (tie — same rank as B)
Carrier D  150   L4   (L3 skipped, positions 3 and 4 were occupied by the L2 tie)
```

---

## 7. API Reference

All endpoints except auth require the header:
```
Authorization: Bearer <jwt_token>
```

### Auth

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/signup` | `name, email, password, role` | `{ token, user }` |
| POST | `/api/auth/signin` | `email, password` | `{ token, user }` |

`role` must be `"buyer"` or `"carrier"`. Password minimum 6 characters.

### Auctions

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/auctions` | buyer | Create a new auction |
| GET | `/api/auctions/my` | buyer | List this buyer's auctions with bid counts |
| GET | `/api/auctions/all` | any | List all active/closed auctions |
| GET | `/api/auctions/:id` | any | Full detail: auction + ranked bids + all logs |

**POST `/api/auctions` — request body:**
```json
{
  "rfq_name":           "Kerala to Mumbai",
  "start_time":         "2024-10-15T10:00:00",
  "end_time":           "2024-10-15T12:00:00",
  "forced_end_time":    "2024-10-15T13:00:00",
  "pickup_date":        "2024-10-20",
  "trigger_window":     5,
  "extension_duration": 5
}
```

**Validation enforced server-side:**
- `start_time` must be in the future
- `end_time > start_time`
- `forced_end_time > end_time`
- `trigger_window >= 1`
- `extension_duration >= 1`

### Bids

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/api/auctions/:auction_id/bid` | carrier | Submit a bid |

**POST body:**
```json
{
  "freight_charges":     15000,
  "origin_charges":      2000,
  "destination_charges": 1500,
  "transit_time":        "3-4 days",
  "quote_validity":      "2024-10-25"
}
```

`total_amount` is computed server-side as `freight + origin + destination`.

**Bid validation rules:**
- Auction status must be `active`
- `now <= current_end_time`
- `total_amount > 0`
- If carrier has bid before: new total must be strictly less than their existing best

---

## 8. Socket Events

### Client sends to server

| Event | Payload | When to call |
|-------|---------|-------------|
| `join_auction` | `auction_id` (number) | On mounting an auction detail page |
| `leave_auction` | `auction_id` (number) | On unmounting an auction detail page |

### Server sends to client

| Event | Scope | Payload | Triggered by |
|-------|-------|---------|-------------|
| `bid_update` | auction room | `{ auction, ranked_bids, new_bid, extended, logs }` | Any new bid |
| `auction_activated` | broadcast | `{ auction }` | Cron: draft to active |
| `auction_closed` | auction room | `{ auction, status }` | Cron: any closure |
| `auction_list_update` | broadcast | `{ auction }` | Any auction state change |

---

## 9. Setup — Backend

### Prerequisites
- Node.js >= 18
- PostgreSQL >= 13 running locally or accessible remotely

### Step 1 — Create the database
```bash
psql -U postgres
CREATE DATABASE rfq_auction;
\q
```

### Step 2 — Install dependencies
```bash
cd backend
npm install
```

### Step 3 — Configure environment
Edit `backend/.env`:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/rfq_auction
JWT_SECRET=replace_with_a_long_random_secret_string
NODE_ENV=development
```

### Step 4 — Start the server
```bash
npm start
```

Expected output on first start:
```
✅ Database schema initialized
✅ Cron jobs started (every 30s)
🚀 RFQ Auction server running on port 5000
```

Tables are created automatically. No manual migration needed.

### Optional — auto-restart on changes
```bash
npm install -g nodemon
nodemon server.js
```

---

## 10. Setup — Frontend

### Prerequisites
- Node.js >= 18

### Step 1 — Install dependencies
```bash
cd frontend
npm install
```

### Step 2 — Configure environment
Edit `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

### Step 3 — Start development server
```bash
npm start
```

Opens at http://localhost:3000

### Step 4 — Production build
```bash
npm run build
```

Output goes to `frontend/build/`. Serve with Nginx, Apache, or any static host.

---

## 11. Environment Variables

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default 5000) | HTTP server port |
| `DATABASE_URL` | Yes | Full PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs. Use a long random value in production. |
| `NODE_ENV` | No | Set to `production` to enable SSL on DB connection |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | No (default localhost:5000/api) | Backend API base URL |
| `REACT_APP_SOCKET_URL` | No (default localhost:5000) | Socket.IO server URL |

---

## 12. Roles and Permissions

| Feature | Buyer | Carrier |
|---------|-------|---------|
| Sign up / Sign in | Yes | Yes |
| Create auction | Yes | No |
| View own auctions (with bid counts) | Yes | No |
| View all active and closed auctions | No | Yes |
| View full auction detail, rankings, logs | Yes | Yes |
| Submit a bid | No | Yes |
| Live updates via WebSocket | Yes | Yes |

---

## Quick Start (run both together)

```bash
# Terminal 1
cd rfq-auction/backend
npm install
npm start

# Terminal 2
cd rfq-auction/frontend
npm install
npm start
```

Open http://localhost:3000, create a buyer account, create an auction with a
start time a few minutes from now. Open a second browser tab, create a carrier
account, wait for the auction to go active, and start bidding.
