# UT Reserve — Project Context Document

---

## 0. Working Agreement — Read This Every Session

r is a beginner full-stack dev building this app to learn, not just to ship, and wants to be able to explain and defend any part of it in a technical interview. Whichever assistant/session is working on this project should follow this approach for the whole project, not just once:

- Move fast generating code (vibecode), but treat every bug fix and design decision as a teaching moment, not just a patch.
- When explaining a bug or diff: ask r to guess what broke and why *first*, before giving the explanation. Only fill in what they miss. Don't just explain then quiz — retrieval before the answer is what actually builds recall; being told and then asked to repeat it back mostly tests short-term memory.
- Prioritize depth over breadth. Don't aim for uniform understanding of the whole stack — focus on the genuinely unusual decisions in this app (the ones an interviewer would actually probe), not RN/Expo/Postgres boilerplate. Current examples: WebView-as-scraper (`injectJavaScript`/`postMessage`), why `fetch()` can't carry the UT session (HttpOnly cookies), crowdsourced-vs-background-scraper (the UT policy tradeoff), Supabase RLS's silent-deny behavior, `innerText`-requires-layout.
- Keep logging real bugs and their root causes in section 6 ("Gotchas and Lessons Learned") as they happen — that log is r's interview prep material (pre-written STAR stories), so don't skip updating it after fixing something nontrivial.
- Periodically suggest r try building something structurally similar to existing code with no AI help (e.g. a new scraper/hook mirroring an existing pattern) as the real test of understanding — being able to produce new code unaided is a stronger signal than being able to explain code that's already in front of them.

---

## 1. What the Project Does

UT Reserve is a mobile app for UT Austin students that provides a better interface for booking recreational sports courts and library study rooms. The official UT RecSports website is poorly optimized for mobile and lacks key features. The app adds:

- Clean mobile UI for viewing and booking courts across all UT RecSports facilities
- Native availability picker (sport/facility + date) with a live per-facility scrape, replacing the old WebView-based Courts tab
- Home screen showing upcoming reservations, a crowdsourced "open now" overview, and remind/cancel buttons
- One-tap cancel directly from home screen without navigating to the website
- Reservation reminders via push notifications (local, scheduled on device)
- Study rooms tab via LibCal (no auth required)
- Auto-redirect to My Bookings tab after booking or cancelling a court

The app is not a clone — it embeds UT's reservation website in WebViews (for login and for study rooms/my-reservations) but has a native layer on top for the home screen and for browsing/booking courts, backed by scraped and crowdsourced data.

---

## 2. Tech Stack and Key Dependencies

**Frontend — React Native + Expo**
```
expo SDK 54
expo-router (file-based routing, like Next.js for React Native)
react-native-webview (embeds UT's site for login, my-reservations, study rooms)
expo-secure-store (encrypted local storage for session flags)
expo-notifications (local push notifications for reminders)
@supabase/supabase-js (crowdsourced availability read/write)
typescript
```

**Backend scraping (Python — separate from mobile app)**
```
requests
beautifulsoup4
playwright (for login automation — see Duo trust note below)
supabase-py
python-dotenv
```

**Services**
```
Supabase — NOW ACTIVE. facility_availability table (crowdsourced court
  availability) and facility_hours table are both live and read/written
  by the mobile app and backend scripts.
EAS Build (Expo Application Services for dev builds and App Store)
Apple Developer Program ($99/yr — purchased)
```

**Key URLs**
```
Courts:          https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php
My Reservations: https://apps.rs.utexas.edu/app/myrecsports/myreservations.php
Study Rooms:     https://libcal.lib.utexas.edu/spaces?lid=16542
Logout:          https://apps.rs.utexas.edu/logout
```

---

## 3. File Structure

```
UT Reservations/
├── backend/
│   ├── scraper.py               # Python scraper (facility_hours + court availability, not wired into a schedule)
│   ├── login.py                 # Playwright login script; also tests whether saved cookies/Duo trust carry over on rerun
│   ├── test_session.py          # Standalone check: do saved cookies in auth.json still authenticate?
│   ├── test_availability_write.py  # Round-trip test for facility_availability against real Supabase, using the publishable key (same access a device has)
│   ├── sql/
│   │   └── facility_availability.sql  # Table + RLS policies (select/insert/update/delete) for crowdsourced availability
│   ├── auth.json                # UT session cookies (gitignored)
│   └── .env                     # UT_EID, UT_PASSWORD, SUPABASE_URL, SUPABASE_KEY
│
└── mobile-app/
    ├── app/
    │   ├── _layout.tsx              # Root layout: Stack with (tabs), login, court-availability
    │   ├── login.tsx                # WebView login screen
    │   ├── court-availability.tsx   # NEW — grid screen for one facility+date: live scrape, confirm dialog, silent hidden-WebView booking
    │   └── (tabs)/
    │       ├── _layout.tsx          # Tab bar config (Home, Courts, Rooms, My Reservations)
    │       ├── index.tsx            # REWRITTEN — Home is now a dashboard: crowdsourced "open now" + single next-reservation ReservationCard + "See all" link + find-a-court CTA. No WebView/scrape logic of its own anymore.
    │       ├── courts.tsx           # REWRITTEN — native picker: date chips (7 days) + facilities grouped by sport, taps into court-availability.tsx
    │       ├── myreservations.tsx   # REWRITTEN — fully native full reservation list (was a WebView wrapper before). Refreshes on focus via ReservationsContext.
    │       └── studyrooms.tsx       # Study rooms (WebView, LibCal) — still the only screen with a Logout button, now that myreservations is native
    ├── components/
    │   ├── WebViewScreen.tsx        # Reusable WebView component with header (used by studyrooms only now)
    │   ├── AvailabilityScraper.tsx  # One hidden WebView per facility+date; scrapes reserve_courts.php — CONFIRMED working on device
    │   └── ReservationCard.tsx      # NEW — shared Remind me/Cancel card, used by both Home (single card) and My Reservations (full list)
    ├── context/
    │   └── ReservationsContext.tsx  # REWRITTEN — now owns the single shared hidden WebView + scrape JS + session-expiry detection (moved out of index.tsx), exposes upcoming/loading/refreshing/session/refresh()/cancelReservation()
    ├── hooks/
    │   ├── useNotifications.ts      # Notification permission + scheduling logic (now uses lib/dates.ts's parseUtDateString/parseUtTime instead of its own inline parsing)
    │   ├── useCourtAvailability.tsx # Runs N AvailabilityScrapers in parallel, aggregates results, pushes to Supabase on success
    │   └── useFacilityOverview.ts   # Reads today's crowdsourced Supabase rows for the home screen
    ├── lib/
    │   ├── facilityAvailability.ts  # pushFacilityAvailability() / fetchTodayOverview() (Supabase read/write)
    │   ├── dates.ts                 # UT date format / ISO date / dateLabel / timeAgo / parseUtDateString / parseUtTime helpers
    │   └── reservations.ts          # NEW — formatFacility, reservationDateLabel, formatReservationDate, sortReservationsByDate (moved out of index.tsx, single source now)
    ├── constants/
    │   ├── facilities.ts            # FACILITIES (name->id), FACILITY_CODE_MAP (single source now — no longer duplicated in index.tsx), FACILITY_NAMES_BY_ID, FACILITIES_BY_SPORT
    │   ├── types.ts                 # CourtSlot, FacilityAvailability, FacilityOverviewRow, FacilityHours, Reservation (moved here from ReservationsContext.tsx)
    │   └── supabase.ts              # Supabase client (publishable/anon key, from EXPO_PUBLIC_ env vars)
    └── eas.json                     # EAS build configuration
```

---

## 4. Key Decisions and Approaches

**Authentication — WebView only, no cookie extraction**

UT uses Shibboleth SSO with Duo 2FA. Session cookies are HttpOnly and cannot be read by JavaScript. Instead of fighting this:
- Login happens in a WebView that handles Duo naturally
- All authenticated requests go through WebViews (not fetch())
- A `has_logged_in` flag is stored in SecureStore after first login
- The hidden WebView on the home screen uses the WebView's native cookie store to make authenticated requests automatically

**Court availability — crowdsourced, not a background scraper (important policy decision)**

We considered running a scheduled background job (one service account, Playwright login, poll all facilities on a timer, write to Supabase) so the home screen could show live-ish availability with zero on-device scraping. This was **deliberately rejected**: UT's Information Resources Use and Security Policy and Authentication Acceptable Use Policy both prohibit circumventing centralized authentication / login procedures, and a background job that logs in unattended (even leaning on Duo's legitimate 30-day "remember this device" trust) reads as exactly that. `backend/login.py` and `backend/test_session.py` still exist to test whether Duo trust survives a scripted re-login, but this is exploratory only — not wired into anything running on a schedule, and not currently planned to be.

**What we do instead: crowdsourced writes from real user sessions.** Every time a user opens the Courts tab and the on-device scraper runs (using *their own* live, human-triggered session — same as booking already does), the result is also pushed to Supabase's `facility_availability` table as a side effect. The home screen reads that table directly. No account is used unattended; every write is a byproduct of a real person actively using the app. Tradeoff: data can be stale or missing for facilities nobody's checked recently, especially early on with few users — this is accepted as fine for a home-screen "at a glance" feature, not for anything that needs guaranteed freshness.

We also drafted (not yet sent) an email to UT RecSports / ISO asking whether an official API or data feed exists, framed as "want to do this the right way," explicitly not as an MFA-bypass or special-account request.

**`facility_availability` schema** — keyed by `(facility_id, date)`, stores the actual list of open slots (`[{court, time, bookUrl}]`) as jsonb, not just a count, so the home screen can show real times ("open at 2, 3, 4pm"). RLS is enabled with public select/insert/update/delete policies — this is fine since the data is non-sensitive (aggregate open-slot info, no personal reservation data). **Gotcha already hit once:** the delete policy was missing initially, which silently no-ops deletes (no error, RLS just filters them out) rather than erroring — a test row sat in the table for a while looking like real data before this was caught.

**Native Courts tab flow (replaces the old WebView-based courts.tsx)**

1. `courts.tsx` — date chips for the next 7 days + facilities grouped by sport (derived from the "Location - Sport" naming convention in `FACILITIES`). Shows crowdsourced open times inline when browsing today; "tap to check availability" otherwise.
2. Tapping a facility navigates to `court-availability.tsx` with `facilityId`, `facilityName`, `date` as route params.
3. That screen scrapes just the one selected facility (via `useCourtAvailability({ facilityIds: [id], date })` — NOT all 8, to avoid the memory/server-load cost of firing 8 hidden WebViews at once for something the user only wants to check one of).
4. Tapping an open slot shows a native confirm `Alert` (the UT book URL executes the reservation immediately on load — there's no confirmation on UT's end — so this native confirm is the only safety gate).
5. On confirm, a hidden WebView is mounted pointed at the book URL (same silent pattern as the existing cancel-from-home-screen flow), and `onNavigationStateChange` watches for UT's own post-booking redirect (`index.php`) to know it succeeded, then routes to My Reservations.

**CONFIRMED on-device 2026-08-02** (Gregory Gym - Squash, via `DEBUG_VISIBLE_SCRAPER`):
- `facility_id` + `date=MM/DD/YYYY` are the correct params — the real page's Location dropdown and Date field both matched the request.
- Table orientation was backwards, as `backend/scraper.py` had hinted: header row is `[Time-label, courtName, courtName, ...]`, body rows are `[time, cell, cell, ...]` — i.e. rows = time slots, columns = courts. `AvailabilityScraper.tsx`'s `buildScrapeJs()` has been fixed to match (court names now read from header cells after the first, time read from each body row's first cell).
- `<td class="success">` + `reservationAction=reserve` link for open slots was already correct, unchanged.

**Second bug found after the above fix, via on-device test with debug flag off:** slot *count* was correct (courts.tsx showed "+18 more" etc.) but every slot's `time`/`court` text came back empty (blank cards in the grid, empty "Open at , ," strings). Cause: `AvailabilityScraper.tsx`'s hidden-WebView container/style constrained both height AND width to ~0 (`{ height: 0, width: 0 }` / `{ height: 1, width: 1 }`), unlike `index.tsx`'s working hidden WebView which only zeroes height. `innerText` (unlike `textContent`) reflects rendered layout, not just the DOM — a ~0px-wide WebView collapses the table's text layout so `innerText` reads `''`, even though `querySelector`/`classList` matches (DOM-only) still work, which is why counts were right but text was blank. Fixed by only constraining height, matching `index.tsx`'s pattern.

Next: reload the app again (debug flag can stay off now), confirm the Courts tab grid shows real times/court names (e.g. "2:00 PM", "A") for Gregory Gym - Squash today, and that the home screen's "Open at ..." line shows real times instead of blank commas.

**Hidden WebView pattern**

The home screen contains an invisible WebView (`height: 0, overflow: hidden`) that loads `myreservations.php`. After the page loads, JavaScript is injected to scrape reservation data and send it back via `postMessage`. This data populates the native home screen UI without the user seeing a browser. The same pattern is now used by `AvailabilityScraper.tsx` (for court availability) and the silent booking flow in `court-availability.tsx`.

**Reusable WebViewScreen component**

Still used by My Reservations and Study Rooms (visible WebView tabs). Handles: custom header with Back/Logout, navbar hiding via injected CSS, session expiry detection, post-booking redirect detection, `forwardRef` + `useImperativeHandle` exposing `reload()`.

**Session expiry handling**

The shared hidden WebView (now in `ReservationsContext.tsx`, moved out of `index.tsx`) detects SAML2 redirect using `onNavigationStateChange`, using a `redirectedRef` (useRef, not useState) to prevent multiple redirects firing. `court-availability.tsx`'s booking flow does the same SAML2 check before its post-booking check.

**Home vs. My Reservations split (decided 2026-08-02)**

Deliberately not one combined screen, even though most users will have very few reservations at once — they serve different intents (dashboard/discovery vs. management), matching how OpenTable/Airbnb/Ticketmaster split these. Home: greeting, crowdsourced "open now", just the *single next* upcoming reservation via `ReservationCard`, "See all" link, find-a-court CTA. My Reservations: the complete sorted list, each with its own Remind/Cancel. Both read the same `ReservationsContext` — one shared hidden WebView, not two.

---

## 5. What's Working vs In Progress

**Working:**
```
✅ Login with UT EID + Duo via WebView
✅ Session persistence (has_logged_in flag)
✅ Home screen (dashboard: crowdsourced "open now" + next reservation + find-a-court)
✅ Remind me button (wired to scheduleReservationReminder, now inside shared ReservationCard)
✅ Cancel (silently via shared WebView's cancelReservation() + cancelUrl)
✅ Cancel also cancels scheduled notification
✅ My Reservations tab — NOW FULLY NATIVE (was WebView), full sorted list, refreshes on focus
✅ Study Rooms tab (WebView, LibCal)
✅ Session expiry redirects to login
✅ Logout (clears has_logged_in flag) — reachable via Study Rooms tab only now that My Reservations is native
✅ Pull-to-refresh on relevant tabs
✅ ReservationsContext — REWRITTEN, now owns the single shared hidden WebView (upcoming/loading/refreshing/session/refresh()/cancelReservation())
✅ Push notifications — tested and working on device
✅ Customizable reminder time (ActionSheet: 15 min / 1 hr / 2 hr / Custom)
✅ Supabase facility_availability table + RLS policies (select/insert/update/delete), tested end to end via test_availability_write.py
✅ Native Courts tab UI (picker, date selection, availability grid, confirm dialog, silent booking) — CONFIRMED working end to end on device (2026-08-02), including a real booking through this flow
✅ AvailabilityScraper — facility_id/date params, table-orientation parsing, and hidden-WebView sizing all confirmed correct on device (2026-08-02)
✅ Home screen "open now" section reading crowdsourced data, showing real times
✅ Debug toggle (debugVisible) for inspecting the real reserve_courts.php page during scraper debugging
```

**Not yet built / in progress:**
```
🔧 IN PROGRESS: native My Reservations refactor just built (2026-08-02) — two
   bugs found and fixed (booking WebView stalling at 0x0 size; stale/empty
   data after booking until app restart, since consolidating the WebView
   lost myreservations.tsx's old refresh-on-focus side effect). Both fixed,
   NOT yet re-confirmed on device — need another on-device pass: book a
   court, confirm it appears on both My Reservations and Home without an
   app restart.
❌ AI voice assistant (speech-to-text + Anthropic API intent parsing + slot matching)
❌ Busyness reports / availability trends (would build on the crowdsourced table now that it exists)
❌ App icon + name + splash screen
❌ TestFlight setup
❌ App Store submission
❌ Decide whether to keep or cut the home screen "open now" section — it's
   currently sparse/low-value until there's real usage generating
   crowdsourced data; backend write path costs nothing to keep either way
❌ Send the drafted RecSports/ISO email about official API access (not yet sent)
```

---

## 6. Gotchas and Lessons Learned

**HttpOnly cookies are invisible to JavaScript**

`document.cookie` only returns non-HttpOnly cookies. The critical Shibboleth session cookie (`_shibsession_...`) is HttpOnly and never appears. This is why all authentication goes through WebViews rather than fetch().

**iOS date parsing**

iOS cannot parse `MM/DD/YYYY` format in `new Date()`. Must convert to `YYYY-MM-DD` first (see `lib/dates.ts`'s `toIsoDateString` / the pattern originally in `index.tsx`'s `parseDate`).

**The login loop bug**

`onNavigationStateChange` fires with `loading: true` when the page first starts loading. If you only check URL (not loading state) the handler fires immediately on `reserve_courts.php` before Duo redirect happens, thinking login is complete. Fix: `if (!url.includes('reserve_courts.php') || loading) return;`

**useState vs useRef for redirect flags**

useState is async — state updates don't take effect immediately. Using useState as a guard against multiple redirects doesn't work because the old value is still in the closure when the next event fires. Always use useRef for synchronous flags that need to prevent duplicate operations.

**useFocusEffect cleanup causes blank screens**

Removed from the home screen for this reason; home screen uses `useEffect` with `[]` for initial load only instead.

**Expo Go doesn't support expo-notifications properly**

Must use a dev build for any notification testing.

**Windows Firewall blocks Metro on port 8081**

Fix (run as administrator): `netsh advfirewall firewall add rule name="Expo Metro" dir=in action=allow protocol=TCP localport=8081`. Fallback: `npx expo start --dev-client --tunnel` (needs `@expo/ngrok`).

**Bundler cache issues**

`npx expo start --dev-client --clear` if code changes don't reflect.

**Horizontal ScrollView with no explicit height stretches to fill flex space**

Hit this building the Courts tab's date-chip row: a `<ScrollView horizontal>` placed in a flex-column parent without an explicit `height`/`flexGrow: 0` will stretch to fill remaining vertical space, and its row-direction children stretch with it (default cross-axis `alignItems: 'stretch'`). Rendered as full-height bars instead of small pills. Fix: give the horizontal ScrollView an explicit `height` and `flexGrow: 0`, and give children `alignSelf: 'center'`.

**Supabase RLS silently no-ops operations with no matching policy**

Enabling RLS without a `delete` policy doesn't error on a DELETE request — it just filters it to zero rows, silently. `test_availability_write.py`'s cleanup step looked like it worked but didn't, leaving a stale test row visible in the app. Always double check that every operation your client actually performs (select/insert/update/delete) has a matching policy, not just the ones you remembered to test.

**Background/unattended scraping vs UT policy**

See section 4 above — don't build a scheduled background scraper that logs in unattended, even leveraging legitimate Duo device trust. UT's own authentication policy reads this as circumventing login procedures. Crowdsourced writes from real, human-triggered sessions sidestep this entirely.

**A WebView rendered at 0x0 can stall navigation entirely, not just break innerText**

Hit this in `court-availability.tsx`'s silent booking WebView (2026-08): it had no explicit `style`, so it inherited its wrapper's `{ height: 0, width: 0 }` and rendered at literally zero size — same root cause as the `AvailabilityScraper` `innerText` bug, but a more severe symptom. A fully zero-sized `WKWebView` can be treated by iOS as non-visible and have its JS execution/network activity throttled or suspended, which stalled the booking redirect chain indefinitely ("Booking your court..." spinning forever) rather than just returning empty text. The fix is the same rule as before, stated more generally: never let a WebView's own rendered dimensions hit zero in either axis, even when you want it fully hidden. Clip it via a wrapper (`{ height: 0, overflow: 'hidden' }`) and give the WebView itself a real, non-zero size (`{ height: 1 }`, no width override) — exactly the pattern `index.tsx`'s original hidden WebView and `ReservationsContext`'s webview both already use correctly.

**`.reload()` reloads whatever page the WebView is on, not the page you think it's on (the big one — multi-day debugging saga, 2026-08)**

Symptom: after booking a court, the reservation often didn't appear on Home or My Reservations no matter how many times you pulled to refresh — only a full app restart would make it show up. Took several wrong turns before finding the real cause, each one worth remembering for what it teaches, not just because it was wrong:

1. First guess: consolidating `myreservations.tsx` and `index.tsx`'s separate WebViews into one shared instance in `ReservationsContext` (good, intentional DRY-up) had accidentally removed `myreservations.tsx`'s old `useFocusEffect(() => reload())`, which used to force a fresh scrape (and update the shared state `index.tsx` also read from) every time you landed on that tab. True, and worth fixing regardless — but restoring `useFocusEffect(() => refresh())` only worked ~2 times out of many. **Lesson:** when you DRY up duplicated code, check whether the duplication was accidentally doing useful work beyond what it looked like it was for — removing it removes that too, silently, unless you replace it on purpose.
2. The intermittent-not-random pattern (worked sometimes, not others) was itself a clue: found a guard (`hasFocusedOnce`, meant to skip a redundant reload on the tab's very first focus) that was skipping refresh() on exactly the focus that mattered — the auto-redirect to My Reservations right after booking is usually that tab's *first* focus of the session. Removed the guard. **Lesson:** an intermittent bug that depends on "what did the user do earlier in this session" is usually a stateful guard/condition, not a timing race.
3. Still intermittent, and — key clue — explicit pull-to-refresh (calling the same `refresh()`) *also* didn't fix it, ruling out focus-timing as the whole story. Landed on WebView HTTP caching: `.reload()` on iOS isn't guaranteed to bypass cache. Set `cacheEnabled={false}` everywhere a WebView reflects live server state (`ReservationsContext`, `AvailabilityScraper`, the booking WebView). This was a legitimate, worthwhile fix — just not the actual cause of what was still happening.
4. Added a retry-with-backoff (refresh at +0s/2s/4s/7s) on the theory that UT's server had a short propagation delay after a booking/cancel. Also legitimate defensive engineering, also not the real cause.
5. **The actual root cause**, found only by adding full timestamped logging of every WebView navigation event (`lib/debugLog.ts`) and reading the resulting trace carefully: UT's cancel-action redirect chain (release → index.php → myreservations.php, per section 9's docs) does not reliably complete that last hop. The shared WebView got stuck sitting on `index.php` after a cancel and never continued on to `myreservations.php`. From that point, `.reload()` — which reloads *whatever page the WebView currently thinks it's on*, not a fixed URL — was correctly, repeatedly reloading `index.php` forever. `index.php` has zero `.card-body .card` elements, so every scrape correctly, honestly returned 0 reservations — of the wrong page. A full app restart always "fixed" it purely because remounting resets the WebView's `source` back to `myreservations.php` from scratch. **None of it was caching, and none of it was a race condition** — steps 3 and 4 were reasonable, defensible fixes for real (if secondary) issues, but the actual bug was never diagnosed by reasoning about plausible causes; it only surfaced once the exact sequence of navigation events was logged and read line by line.

**Fix:** stop trusting `reload()` to mean "reload the right page." `refresh()` now explicitly does `injectJavaScript("window.location.href = '${MY_RESERVATIONS_URL}'")` instead of `.reload()`, so it self-corrects back to the intended URL regardless of where a previous action's redirect chain left the WebView. `cancelReservation()` no longer assumes its own redirect chain will land back on `myreservations.php` either — it now explicitly calls `refresh()` ~1.5s after firing the release action instead of hoping.

**Debugging-methodology lesson, the main one to keep:** several plausible, well-reasoned hypotheses (focus timing, HTTP caching, server propagation delay) were each partially true and each produced real, worthwhile fixes — but none of them were *the* bug, and no amount of reasoning about "what's plausible" found it. What found it was brute-force, boring instrumentation: logging every navigation event with a timestamp and actually reading the URLs in the trace. When a bug survives two or three reasoned fix attempts, that's the signal to stop hypothesizing and start logging the exact, literal sequence of what the system is doing — not what you assume it's doing.

---

## 7. Where We Left Off / Next Steps

**Completed recently:**
- Crowdsourced availability architecture designed and built end to end (Supabase schema, RLS, mobile read/write, wired into the scrape success path)
- Native Courts tab flow built (picker, date selection, grid, confirm, silent booking) — type-checked, not yet confirmed against live UT HTML
- Home screen "open now" section wired up
- Found and fixed: date-chip layout bug (RN horizontal ScrollView height), missing delete RLS policy
- Committed and pushed all of the above to `main` (commit `9439564`)
- Drafted (not sent) an email to UT RecSports/ISO about official API access
- **AvailabilityScraper.tsx CONFIRMED WORKING end to end on device (2026-08-02).** Two bugs found and fixed via on-device screenshots: (1) table orientation was backwards — header cells are court names not time labels, body row's first cell is the time; (2) hidden WebView container/style zeroed both height and width, and `innerText` needs real layout to compute non-empty text, so a ~0px-wide WebView made every cell's text read as `''` even though element/class matching still worked. Fixed by only zeroing height, matching `index.tsx`'s already-working hidden WebView. Times/court names now render correctly in the grid and on the home screen's "Open at ..." line, and a live booking through this flow was confirmed to still work.
- `DEBUG_VISIBLE_SCRAPER` is back to `false` in `court-availability.tsx`.
- **Native My Reservations screen built (2026-08-02).** Home/My Reservations split decided (dashboard vs. full manager, see section 4). Shipped: `ReservationsContext` rewritten to own one shared hidden WebView (was duplicated across `index.tsx` and the old WebView-based `myreservations.tsx`); new `components/ReservationCard.tsx` shared by both screens; new `lib/reservations.ts` consolidating formatting/sorting helpers that used to live inline in `index.tsx`; dead "Quick rebook" section removed (relied on `past`, which was never actually populated); `useNotifications.ts` de-duplicated against `lib/dates.ts`'s new `parseUtDateString`/`parseUtTime`.
- **Booking/refresh bug saga CONFIRMED RESOLVED on device (2026-08-02) — see section 6's big writeup.** Root cause: `refresh()` used `.reload()`, which reloads whatever page the WebView is currently on — and a cancel's redirect chain could leave it stuck on `index.php` instead of `myreservations.php`, so every "refresh" was silently, correctly re-scraping the wrong page forever. Fixed by having `refresh()` explicitly navigate back to `MY_RESERVATIONS_URL` instead of blindly reloading. Also fixed along the way: booking WebView stalling at 0x0 size, a missing timeout/fallback on the booking flow (now 15s), and `hasFocusedOnce`'s refresh-skip bug. `DEBUG_VISIBLE_BOOKING` flipped back to `false` in `court-availability.tsx` now that it's confirmed. Added `lib/debugLog.ts`, a timestamped `__DEV__`-gated logger instrumented across the whole reservation flow (tab focus, button taps, WebView navigation, scrape results) — this is what actually found the root cause after several reasoned-but-wrong hypotheses (see section 6). Book → cancel → book-again, the exact sequence that used to break, now works.

**Immediate next steps:**
```
1. DONE (2026-08-02): Cleanup pass. Deleted components/ui/collapsible.tsx,
   components/external-link.tsx, and hooks/use-theme-color.ts (all dead
   Expo-template boilerplate, zero consumers, confirmed via grep before
   deleting). Also found and deleted scripts/reset-project.js + its
   "reset-project" npm script — not just clutter, it would have moved/
   deleted the real app/components/hooks/constants directories if ever
   run. Rewrote README.md (was still 100% generic create-expo-app
   boilerplate, including a section pointing at the now-deleted reset
   script) to actually describe the project and point to this doc.
   Trimmed lib/debugLog.ts call sites from 28 to 21 — kept everything
   tied to WebView nav tracing, refresh/session state guards, and
   confirmed user-triggered actions (the categories that actually caught
   the .reload() bug); cut "tab focused" breadcrumbs and pre-confirmation
   button-tap logs. Trimmed the multi-paragraph "CONFIRMED (2026-08)"
   bug-narrative comments in ReservationsContext.tsx, court-availability.tsx,
   myreservations.tsx, and AvailabilityScraper.tsx down to 1-2 lines each,
   pointing back to section 6 instead of re-explaining. Verified clean
   with tsc --noEmit after each phase.
2. DONE (2026-08-02): RecSports email sent to derek.knight@austin.utexas.edu.
   Derek replied same-ish day, positively — wants to set up a call this
   week to discuss. Non-blocking on the rest of the roadmap, but worth
   prepping a short list of talking points before that call (what the app
   does, why an official feed would help, what you're currently doing
   without one) whenever convenient.
```

**Build order — pre-launch, remaining:**
```
1. ✅ DONE — native availability scraper confirmed working end to end
2. 🔧 Native My Reservations screen — built, two bugs fixed, awaiting on-device re-confirmation (see above)
3. AI voice assistant (speech-to-text + Anthropic API intent parsing + slot matching) — ~4-5 days
4. App icon + splash screen — ~2-3 hours
5. TestFlight + App Store submission — ~2-3 days
6. Launch during UT org week (first week of September)
```

**Post-launch features (Supabase-backed, infra now partially exists):**
```
- Court availability notifications
- Crowdsourced busyness reports / availability trends (facility_availability
  table already has the shape to support this)
- Recurring reservations
- Group booking / court sharing
- Booking window alerts
- No-show warning tracker
```

---

## 8. Facilities Reference

```typescript
const FACILITIES = {
    "Bellmont Hall - Squash":        28,
    "Caven-Clark - Pickleball":      30,
    "Gregory Gym - Racquetball":     35,
    "Gregory Gym - Squash":          40,
    "RSC - Squash":                  55,
    "RSC - Racquetball":             50,
    "Whitaker - Tennis":             60,
    "Whitaker - Pickleball/Tennis":  65,
}

const FACILITY_CODE_MAP = {
    'GRE': 'Gregory Gym',
    'CCF': 'Caven-Clark',
    'WC':  'Whitaker Courts',
    'BEL': 'Bellmont Hall',
    'RSC': 'Rec Sports Center',
}
```

Facility names from UT's HTML are in format `GRE - RB - 01` (code - type - court number). Now defined in `mobile-app/constants/facilities.ts` (also includes `FACILITY_NAMES_BY_ID` and `FACILITIES_BY_SPORT`, derived from the map above).

---

## 9. UT RecSports HTML Structure Reference

**Reservation cards on myreservations.php:**
```html
<div class="card-body">
  <div class="card">
    <div class="card-header">
      GRE - RB - 01        <!-- lines[0]: facility -->
      05/22/2026            <!-- lines[1]: date MM/DD/YYYY -->
      2:00 PM               <!-- lines[2]: time -->
    </div>
    <a href="reserve_courts.php?id=XXXX&reservationAction=release">Cancel</a>
  </div>
</div>
```
Confirmed working — this is the pattern used by both `index.tsx` and `myreservations.tsx`'s scrapers.

**Court availability on reserve_courts.php — PARTIALLY CONFIRMED:**
- Available courts: `<td class="success ...">` containing a link with `reservationAction=reserve` — confirmed (this is what `backend/scraper.py` and `AvailabilityScraper.tsx` both key off).
- Cancel URL format: `reserve_courts.php?id=XXXX&reservationAction=release`
- Book URL format: `reserve_courts.php?id=XXXX&reservationAction=reserve&courtType=XX`
- Query param for facility: `facility_id` (per `backend/scraper.py`), not `fid`.
- **CONFIRMED (2026-08-02):** header row = court names (after a leading "Time" label cell), body rows = time slots — `AvailabilityScraper.tsx` fixed to match. `backend/scraper.py`'s hint was correct.
- **CONFIRMED (2026-08-02):** `date=MM/DD/YYYY` is the correct param name/format for requesting a specific day.

**Post-action redirect flow:**
```
After booking:    reserve_courts.php → index.php → myreservations.php
After cancelling: myreservations.php → index.php → myreservations.php
```
App detects `index.php` to trigger tab switching and page resets. Same detection now reused by `court-availability.tsx`'s silent booking flow.
