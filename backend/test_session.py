"""
Checks whether the cookies saved in auth.json still authenticate against
UT RecSports — no browser, no Duo, just a plain requests call.

Run this right after login.py to confirm it saved a working session, then
run it again a day (or several days) later. If it still says PASS with no
Duo prompt in between, the 30-day device trust is holding and a background
scraper is viable. If it flips to FAIL, the session (or the trust) expired
and background scraping needs a human to re-approve Duo periodically.
"""
import json
import requests

RESERVATION_URL = "https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php"


def load_cookies():
    with open("auth.json") as f:
        auth = json.load(f)
    return {c["name"]: c["value"] for c in auth["cookies"]}


def main():
    cookies = load_cookies()
    response = requests.get(RESERVATION_URL, cookies=cookies, allow_redirects=True)
    final_url = response.url

    if "idp/profile/SAML2" in final_url or "login" in final_url.lower():
        print("FAIL — bounced to login/SAML2, session is dead.")
        print(f"Ended at: {final_url}")
    elif response.status_code == 200 and "reserve_courts" in final_url:
        print("PASS — session is still authenticated, got the real page.")
        print(f"Ended at: {final_url}")
    else:
        print(f"UNCLEAR — status {response.status_code}, ended at {final_url}")
        print("Open the response body / check manually.")


if __name__ == "__main__":
    main()
