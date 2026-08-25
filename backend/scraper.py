import requests
import os
import json
import re
import sys
import base64
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime

load_dotenv()

# urls
recsports_hours_url = "https://www.utrecsports.org/hours"
reservation_url = "https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php"

# supabase
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)


def describe_key(key):
    # Report WHICH key we are holding, without ever printing the key.
    if not key:
        return "MISSING"
    if key.startswith("sb_publishable_"):
        return "publishable (RLS applies -- cannot write facility_hours)"
    if key.startswith("sb_secret_"):
        return "secret (bypasses RLS)"
    parts = key.split(".")
    if len(parts) == 3:
        try:
            payload = parts[1] + "=" * (-len(parts[1]) % 4)
            role = json.loads(base64.urlsafe_b64decode(payload)).get("role", "?")
        except Exception:
            return "jwt (payload unreadable)"
        note = "bypasses RLS" if role == "service_role" else "RLS applies -- cannot write facility_hours"
        return f"jwt role={role} ({note})"
    return "unrecognized key format"

# auth
SHIBBOLETH_KEY = "_shibsession_64656661756c7468747470733a2f2f617070732e72732e7574657861732e6564752f73686962626f6c657468"

def get_cookies():
    # return {
    #     "PHPSESSID": os.environ.get("PHPSESSID"),
    #     "SC": os.environ.get("SC"),
    #     SHIBBOLETH_KEY: os.environ.get("SHIBSESSION")
    # }
    with open("auth.json") as f:
        auth = json.load(f)
    cookies = {c["name"]: c["value"] for c in auth["cookies"]}

    # see cookie expiration dates
    for c in auth["cookies"]:
        expires = c.get("expires")
        if expires and expires > 0:
            print(f"{c['name']}: expires {datetime.fromtimestamp(expires)}")
        else:
            print(f"{c['name']}: session cookie (expires when browser closes)")
    
    return cookies

FACILITIES = {
    "Bellmont Hall - Squash":           28,
    "Caven-Clark - Pickleball":         30,
    "Gregory Gym - Racquetball":        35,
    "Gregory Gym - Squash":             40,
    "RSC - Squash":                     55,
    "RSC - Racquetball":                50,
    "Whitaker - Tennis":                60,
    "Whitaker - Pickleball/Tennis":     65,
}

def normalize_hours(raw_text):
    clean_text = raw_text.strip()

    if clean_text == "View":
        return "Refer to Site"
    return clean_text

# The heading naming the current period ("8/15 - 8/22/26") sits outside the
# table. Match the date range itself so a page redesign won't break it.
PERIOD_RE = re.compile(r"[A-Za-z ]*\d{1,2}/\d{1,2}\s*[-\u2013]\s*\d{1,2}/\d{1,2}(?:/\d{2,4})?")


def find_period_label(soup):
    text = soup.get_text(separator=" ", strip=True)
    match = PERIOD_RE.search(text)
    return match.group(0).strip() if match else None


def scrape_hours():
    """Scrape UT's public hours page into facility_hours.

    Returns the number of rows CONFIRMED written.

    Every print in here reports an OUTCOME, not an intention. The previous
    version printed "Synced:" before anything checked whether the upsert had
    affected a row, so three consecutive zero-write runs printed seventeen
    confident success lines and exited 0. See context.md section 6 -- an
    instrument that reports what was attempted is worse than no instrument,
    because it actively rules out the correct hypothesis.
    """
    response = requests.get(recsports_hours_url, timeout=30)

    if response.status_code != 200:
        print(f"FAIL: UT hours page returned status {response.status_code}")
        return 0

    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("tbody")
    if table is None:
        # Distinguish "UT redesigned the page" from "this runner was served a
        # bot-check page". A GitHub runner is a datacenter IP and a laptop is
        # not, so a WAF can make this fail in CI and pass locally -- which is
        # why testing this hypothesis with a local run proves nothing.
        title = soup.title.get_text(strip=True) if soup.title else "(no title)"
        print(f"FAIL: no hours table found. status={response.status_code} "
              f"bytes={len(response.text)} title={title!r}")
        return 0

    period_label = find_period_label(soup)
    print(f"Period: {period_label or 'unknown'}")

    scraped_at = datetime.now().astimezone().isoformat()
    parsed = 0
    written = 0
    rejected = 0

    for row in table.find_all("tr"):
        cells = row.find_all("td")
        data = [normalize_hours(cell.get_text(separator=" ; ", strip=True)) for cell in cells]

        # Skip malformed rows instead of dying halfway through.
        if len(data) < 5:
            continue

        parsed += 1
        name = data[0]
        save_row = {
            "facility_name": name,
            "mon_thu": data[1],
            "friday": data[2],
            "saturday": data[3],
            "sunday": data[4],
            "period_label": period_label,
            "scraped_at": scraped_at,
        }

        try:
            res = supabase.table("facility_hours").upsert(
                save_row, on_conflict="facility_name"
            ).execute()
        except Exception as e:
            # RLS fails asymmetrically. A blocked INSERT raises 42501; a
            # blocked UPDATE with no matching policy does not raise at all --
            # it filters to zero rows and returns 200. Only one of those two
            # paths would ever have shown up on its own, so catch both here
            # and report them the same way.
            rejected += 1
            print(f"  REJECTED {name}: {type(e).__name__}: {e}")
            continue

        # PostgREST defaults to Prefer: return=representation, so a write that
        # actually landed echoes the row back. Empty .data means zero rows were
        # affected. NOTE: this check is only valid while we use the default
        # return mode -- a returning="minimal" upsert comes back empty on
        # success too, and would make this report false failures.
        if not res.data:
            rejected += 1
            print(f"  REJECTED {name}: upsert affected zero rows (RLS filtered?)")
            continue

        written += 1
        print(f"  wrote {name}")

    print(f"Parsed {parsed} rows | confirmed written {written} | rejected {rejected}")

    # Independent read-back. The per-row check above trusts the write response;
    # this trusts nothing and asks the table directly whether it now holds this
    # run's timestamp. This is the check that would have caught the freeze on
    # day one instead of day four.
    if written:
        check = (supabase.table("facility_hours")
                 .select("facility_name, scraped_at")
                 .eq("scraped_at", scraped_at)
                 .execute())
        print(f"Read-back: {len(check.data)} row(s) now carry this run's scraped_at.")
        if not check.data:
            print("FAIL: upserts reported success but the table does not contain them.")
            return 0

    return written


def scrape_court_availability():
    for facility_name, facility_id in FACILITIES.items():
        url = f"{reservation_url}?facility_id={facility_id}"
        response = requests.get(url, cookies=get_cookies())
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('table')
        header_row = table.find('thead')
        court_names = [th.text.strip() for th in header_row.find_all('th')]
        print(facility_name)
        print(court_names)
        # organize time rows into lists
        # update supabase rows 
        # print availability table


if __name__ == "__main__":
    # Only scrape_hours() is wired into the app. Court availability is
    # crowdsourced on-device instead -- context.md section 4.
    # Print the project ref, not just "set". A secret pointing at the wrong
    # project writes 17 rows successfully into a database nobody reads -- green
    # CI, confident log, frozen app. The host is not sensitive; it ships inside
    # the app binary.
    print(f"SUPABASE_URL: {supabase_url.split('//')[-1].rstrip('/') if supabase_url else 'MISSING'}")
    print(f"SUPABASE_KEY: {describe_key(supabase_key)}")

    written = scrape_hours()

    if written == 0:
        # Exit nonzero so a run that writes nothing goes RED in the Actions
        # tab. Three green runs across three days is what let the data freeze
        # sit unnoticed going into org week -- context.md section 6.
        print("FAIL: zero rows written.")
        sys.exit(1)

    print(f"OK: {written} rows written.")
