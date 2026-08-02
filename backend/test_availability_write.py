"""
End-to-end check for the crowdsourced facility_availability table (v2:
keyed by facility_id + date, stores real slot times). Run AFTER pasting
backend/sql/facility_availability.sql into the Supabase SQL Editor.

Uses the same publishable key as the mobile app on purpose — this tests
exactly what a real device can do against your RLS policies.
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=representation",
}

FAKE_ROW = {
    "facility_id": 999999,
    "facility_name": "TEST — delete me",
    "date": "2026-08-01",
    "slots": [
        {"court": "GRE - SQ - 02", "time": "2:00 PM", "bookUrl": "https://example.com/book/1"},
        {"court": "GRE - SQ - 03", "time": "3:00 PM", "bookUrl": "https://example.com/book/2"},
    ],
}


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("FAIL — SUPABASE_URL / SUPABASE_KEY not set in .env")
        return

    write_resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/facility_availability",
        headers=HEADERS,
        json=FAKE_ROW,
    )
    if write_resp.status_code not in (200, 201):
        print(f"FAIL — write returned {write_resp.status_code}: {write_resp.text}")
        print("If this says 'relation does not exist' or a column mismatch, run facility_availability.sql first.")
        return
    print("Write OK:", write_resp.json())

    read_resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/facility_availability",
        headers=HEADERS,
        params={"facility_id": "eq.999999", "date": "eq.2026-08-01", "select": "*"},
    )
    rows = read_resp.json()
    if read_resp.status_code == 200 and len(rows) == 1 and len(rows[0]["slots"]) == 2:
        print("PASS — round-tripped correctly:", rows[0])
    else:
        print(f"FAIL — read returned {read_resp.status_code}: {read_resp.text}")
        return

    requests.delete(
        f"{SUPABASE_URL}/rest/v1/facility_availability",
        headers=HEADERS,
        params={"facility_id": "eq.999999", "date": "eq.2026-08-01"},
    )
    print("Cleaned up test row.")


if __name__ == "__main__":
    main()
