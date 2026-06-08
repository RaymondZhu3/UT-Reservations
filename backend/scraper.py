import requests
import os
import json
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client
from playwright.sync_api import sync_playwright
from datetime import datetime

load_dotenv()

# urls
recsports_hours_url = "https://www.utrecsports.org/hours"
reservation_url = "https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php"

# supabase
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

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

def scrape_hours():
    response = requests.get(recsports_hours_url)

    if (response.status_code == 200):
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('tbody')

        for row in table.find_all('tr'):
            cells = row.find_all('td')

            data = [normalize_hours(cell.get_text(separator=" ; ", strip = True)) for cell in cells]

            save_row = {
                "facility_name": data[0],
                "mon_thu": data[1],
                "friday": data[2],
                "saturday": data[3],
                "sunday": data[4]
            }
            
            supabase.table("facility_hours").upsert(save_row, on_conflict="facility_name").execute()
            print(f"✅ Synced: {data[0]}")
    else:
        print(f"Failed to reach UT site. Status Code: {response.status_code}")

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
        header_col = table.find_all('tr')
        
        for row in header_col:
            row_data = [td.text.strip() for td in row.find_all('td')]
            # print(row_data)

# {
#     "facility_name": "Caven-Clark - Pickleball",
#     "facility_id": 30,
#     "date": "05/09/2026",
#     "time_slot": "4:00 PM",
#     "court": "4A",
#     "status": "available"  # or "reserved"
# }


if __name__ == "__main__":
    # scrape_hours()
    get_cookies()
    scrape_court_availability()