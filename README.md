# UT Reserve

An iOS app for booking UT Austin RecSports courts. It wraps
`apps.rs.utexas.edu`, which handles reservations fine but only one facility at a
time, with a native layer for finding a court and managing what you've booked.

**Status:** v1 feature-complete, not yet released. TestFlight beta is next.

> Not affiliated with, endorsed by, or sponsored by The University of Texas at
> Austin or UT RecSports. "UT" and "Longhorns" are trademarks of their
> respective owners. This is an independent student project, and a client for a
> system you already have your own account on.
>
> It never logs in on your behalf and never books a court automatically. Every
> authenticated request happens because someone is actively using the app.

## What it does

- Log in with your UT EID and Duo, in a WebView. The app never sees your
  password.
- Browse open courts by facility and date, scraped live from the real
  reservation page.
- Book and cancel without leaving the app, with a confirmation step before
  anything is booked.
- Get a reminder notification before your reservation (15 min, 1 hr, 2 hr, or a
  time you pick).
- See facility hours next to availability, scraped daily from
  `utrecsports.org/hours`.
- Home screen shows your next reservation and which courts are open right now.

Covers the 8 RecSports court facilities: squash, racquetball, pickleball and
tennis at Gregory Gym, Bellmont Hall, Caven-Clark, Whitaker, and the Rec Sports
Center. Library study rooms are planned for v1.1.

## Why I built it

The RecSports site is not actually bad on mobile. It's responsive and the
availability grid is readable. The problems are structural:

**You can only look at one facility at a time.** Location is a single dropdown,
so "where can I play at 7 tonight" means eight dropdown changes and eight page
loads. The app shows all eight on one screen.

**Nothing reminds you.** The site forgets about you the moment you book, and
no-shows are a real problem for RecSports.

**Hours are on a different website** from the booking system, so "is it open"
and "can I book" are two separate lookups.

## How it works

UT's session cookies are `HttpOnly`, so JavaScript can't read them. There's no
way to pull the session out of the WebView and use it with `fetch()`. Rather
than fight that, the app never leaves the WebView's cookie jar. Every
authenticated request runs inside a hidden `react-native-webview` that shares
the native cookie store from login.

```
User logs in (visible WebView, Shibboleth + Duo)
        │
        ▼
Native cookie store now holds the session
        │
        ├──▶ ReservationsContext: one shared hidden WebView on myreservations.php
        │      injects JS → scrapes reservation cards → postMessage → native UI
        │
        ├──▶ AvailabilityScraper: one hidden WebView per facility+date on
        │      reserve_courts.php → scrapes the slot table → native grid
        │
        └──▶ Booking and cancelling: a hidden WebView pointed at UT's action URL,
               watching onNavigationStateChange for UT's own redirect to
               confirm it worked
```

Session expiry is caught by watching for the SAML2 redirect in
`onNavigationStateChange`, guarded by a `useRef` so the redirect to login can
only fire once.

**If you touch `AvailabilityScraper.tsx`:** the hidden WebView constrains height
only, never width. `innerText` reflects rendered layout, not just the DOM, so a
WebView that's zero pixels wide collapses the table's text layout and every
`innerText` read comes back empty, while `querySelector` and `classList` checks
keep working because they only touch the DOM. The symptom is a correct slot
count with blank times and court names.

### Where availability data comes from

The home screen needs availability across all eight facilities without making
you wait for eight scrapes. The obvious fix is a scheduled job with a service
account polling every facility. I didn't build that: UT's Information Resources
Use and Security Policy and Authentication Acceptable Use Policy both prohibit
circumventing centralized authentication, and a job that logs in on a timer is
exactly that, even leaning on Duo's legitimate 30-day device trust.

Instead, when you open the Courts tab and the scraper runs against your own
session, the result is also written to a Supabase table. Other users' home
screens read from that table.

The tradeoff: data is stale or missing for facilities nobody has checked
recently, which is worst when there are few users. That's acceptable for an
at-a-glance home screen and not acceptable for anything that needs to be
current. The UI keeps "read failed", "loading", "nobody has checked yet today"
and "nothing open" as four distinct states instead of showing one empty message
for all of them.

Facility hours are different. `utrecsports.org/hours` is public and needs no
login, so that one can be a scheduled job. `backend/scraper.py` runs daily in
GitHub Actions.

### Stack

Expo SDK 54, expo-router, TypeScript, react-native-webview, expo-secure-store,
expo-notifications, supabase-js. New architecture and React Compiler are both
on.

The scraper is Python: requests, beautifulsoup4, supabase, python-dotenv.

Supabase for Postgres and RLS, EAS Build, GitHub Actions, GitHub Pages.

## Repo layout

```
.
├── .github/workflows/scrape-hours.yml   # Daily hours scrape, 11:00 UTC
├── backend/
│   ├── scraper.py                       # Public hours scraper → Supabase
│   ├── login.py, test_session.py        # Exploratory only, not on a schedule
│   ├── test_availability_write.py       # Round-trip test with the publishable key
│   └── sql/                             # Table DDL and RLS migrations
├── docs/                                # GitHub Pages: privacy policy, support
└── mobile-app/
    ├── app/                             # expo-router screens
    │   ├── welcome.tsx  login.tsx  court-availability.tsx
    │   └── (tabs)/      index.tsx (Home)  courts.tsx  myreservations.tsx
    ├── components/                      # AvailabilityScraper, ReservationCard, ui/
    ├── context/ReservationsContext.tsx  # Owns the shared hidden WebView
    ├── hooks/                           # useCourtAvailability, useFacilityHours
    ├── lib/                             # dates, reservations, hoursPeriod
    └── constants/                       # facilities, types, theme, supabase client
```

## Running it locally

You'll need Node 20+, a Supabase project (free tier is fine), and an Expo
account. Python 3.12+ only if you're working on the scraper. You also need a
valid UT EID: without one you can browse the UI, but you can't log in, scrape,
or book anything.

```bash
cd mobile-app
npm install
npx expo start --dev-client
```

Expo Go won't work. `expo-notifications` and the cookie behavior this app
depends on both need a development build:

```bash
npx eas build --profile development --platform ios
```

The dev build uses bundle ID `com.rz9.UTReservations.dev` and is named "UT
Reserve (dev)", set by `APP_VARIANT=development` in `eas.json`, so a
production or TestFlight install won't replace your dev client on the same
device.

### Environment variables

`mobile-app/.env`. These ship inside the binary, so they have to be
RLS-constrained keys. Never put a service key here.

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable / anon key>
```

Setting these in EAS is not enough on its own. Each build profile in `eas.json`
also has to name an EAS environment (`"environment": "production"`), or the
variables resolve to empty strings in the built binary and nothing tells you.

`backend/.env`:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<secret key; the publishable key can't write facility_hours>
UT_EID=...        # only for the exploratory login scripts
UT_PASSWORD=...   # only for the exploratory login scripts
```

`scraper.py` prints which class of key it's holding at startup, never the key
itself, and exits non-zero if it wrote zero rows.

### Database

Run the SQL in `backend/sql/` against your Supabase project, in this order:

```
facility_availability.sql
harden_facility_availability.sql
facility_hours.sql
harden_facility_hours.sql
```

Two things to know if you change these. RLS denials are silent: a missing
`delete` policy doesn't throw, the delete is filtered out and the call returns
success. And a migration that drops policies by name will skip any policy
created by hand under a different name, so query `pg_policies` to check what is
actually on the table rather than trusting what the migration meant to do.

### Scraper

```bash
cd backend
pip install -r requirements.txt
python scraper.py
```

## Roadmap

- [ ] TestFlight beta
- [ ] App Store submission
- [ ] Slot alarm: pick a facility, day and time, get a notification just before
      the booking window opens that deep-links into the confirm dialog
- [ ] Study rooms via LibCal, native (v1.1)
- [ ] Busyness trends from the crowdsourced data
- [ ] Android build

## Contributing

Issues and pull requests are welcome. Please run `npx tsc --noEmit` and
`npm run lint` first, and if you've touched anything to do with the scrapers,
test it on a real device with a real UT session. Several bugs in this codebase
were invisible in the simulator.

I won't merge anything that adds unattended login, stores credentials, or books
courts automatically.

## License

[MIT](LICENSE) © Raymond Zhu

Privacy policy and support: https://raymondzhu3.github.io/UT-Reservations/
