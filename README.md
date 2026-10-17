# Blood App

A blood donation and healthcare platform for Bangladesh, built with **Next.js (App Router)**, **PostgreSQL** and **Prisma**.

## Features

- **Accounts & roles**: sign in with phone OTP, email OTP / magic link or Google. Every user is a receiver; anyone can also become a donor and switch between modes.
- **Profiles**: blood group, age, gender, Division / District / Upazila / Thana, emergency contact, optional NID / birth-registration verification (number stored encrypted, reviewed by admins).
- **Live donor map**: Leaflet / OpenStreetMap with donor and request pins, blood-group (and compatibility) and location filters, donor cards with distance and last donation. Contact details are only revealed after a donor accepts a request.
- **Blood requests**: blood group, units, hospital, location, date and urgency. Matching donors are alerted in-app (and by SMS for emergencies). Donors accept or decline; statuses Open → Accepted → Fulfilled / Cancelled.
- **Emergency mode**: one-tap emergency request with wider radius and SMS alerts, plus an "I can donate now" mode for donors.
- **Donation cycle**: donors upload proof, admins verify, the donor is hidden for 3 months and automatically becomes visible again with a notification.
- **History & rewards**: donation history, levels, badges, printable certificates, partner offers and a leaderboard.
- **Healthcare directory**: hospitals, clinics, diagnostic centers, doctors, pharmacies, ambulances (tap to call), blood banks and donation centers.
- **Pharmacy marketplace**: search medicines, compare prices, cart, delivery or pickup, prescription upload for Rx medicines, order tracking and partner discounts.
- **Payments**: pay partners in-app (bKash tokenized checkout; sandbox for other methods), automatic discounts, receipts and history.
- **Partner portal**: hospitals, diagnostics and pharmacies apply with a licence, manage stock, orders, offers and see payments.
- **AI assistant**: Bangla / English assistant using app data (donors, facilities, doctors, medicines) with a medical disclaimer and emergency redirection.
- **Messaging & safety**: in-app chat, block and report, approximate location by default, admin moderation.
- **Admin panel**: analytics, users, donation / ID verification, requests, facilities & partners, doctors, medicines, payment reports, awareness content and broadcast notifications.

## Getting started

### 1. Requirements

- Node.js 20+
- pnpm
- PostgreSQL 14+

### 2. Configure the environment

```bash
cp .env.example .env
```

Fill in at least `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY` and `ADMIN_EMAILS`. Everything else is optional:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in (redirect URI: `APP_URL/api/auth/google/callback`) |
| `SMS_API_URL` / `SMS_API_KEY` / `SMS_SENDER_ID` | SMS gateway for OTP and emergency alerts (printed to the console when unset) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email OTP and magic links (printed to the console when unset) |
| `BKASH_*` | bKash tokenized checkout; without it payments use the built-in sandbox page |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | Any OpenAI-compatible chat API; without it the assistant uses offline answers |
| `IDENTITY_VERIFY_URL` / `IDENTITY_VERIFY_KEY` | Optional automatic NID verification provider |
| `CRON_SECRET` | Protects the donation-cycle cron endpoint |
| `UPLOAD_DIR` | Where uploaded files are stored (default `./uploads`) |

### 3. Install, migrate and seed

```bash
pnpm install          # also runs `prisma generate`
pnpm db:migrate       # creates the database schema
pnpm db:seed          # optional demo data (Dhaka donors, facilities, medicines, content)
```

### 4. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). In development, OTP codes are shown on the login screen and printed in the terminal.

Seeded demo accounts (sign in with phone OTP):

- Receiver: `01800000001`
- Donors: `01700000001` - `01700000009`
- Partner pharmacy owner: `01900000001`
- Admin: the first address in `ADMIN_EMAILS` (sign in with email OTP)

### 5. Scheduled job

Donors whose 3-month rest period has ended are released automatically when they use the app. To also release inactive donors and notify them, call this endpoint daily:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/donation-cycle
```

## Production

```bash
pnpm db:deploy   # apply migrations
pnpm build
pnpm start
```

Set `APP_URL` to the public URL, use a strong `AUTH_SECRET` / `ENCRYPTION_KEY`, and make `UPLOAD_DIR` a persistent volume.

## Project structure

```
app/                 Pages (App Router) and API route handlers
  admin/             Admin panel
  api/               Map, messaging, notifications, assistant, auth, payments, files, cron
components/          UI components (map, chat, pharmacy cart, forms)
lib/                 Domain logic: auth, OTP, matching, donation cycle, payments, AI, storage
lib/actions/         Server Actions
prisma/schema.prisma Database schema
prisma/seed.ts       Demo data
proxy.ts             Redirects signed-out users away from private pages
```

## Notes and limitations

- "Real-time" features (map, chat, notifications) use short polling; browser notifications use the Notification API while the site is open (no service worker push yet).
- Masked calling requires a telephony provider and is not included; users chat in-app and see phone numbers only after a donor accepts.
- Nagad, card and bank payments run through the sandbox until merchant APIs are integrated.
