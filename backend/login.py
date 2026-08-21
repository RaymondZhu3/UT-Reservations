import os
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()

reservation_url = "https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php"

existing_state = "auth.json" if os.path.exists("auth.json") else None
if existing_state:
    print("Found existing auth.json — reusing it as the starting session.")

with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(storage_state=existing_state)
        page = context.new_page()
        page.goto(reservation_url)
        page.wait_for_load_state("networkidle")

        if "idp/profile/SAML2" in page.url:
            print("Redirected to login — saved session did not carry over on its own.")
            page.get_by_label("UT EID").fill(os.environ.get("UT_EID"))
            page.get_by_label("Password").fill(os.environ.get("UT_PASSWORD"))
            page.get_by_role("button", name="Sign in").click()

            try:
                page.get_by_role("button", name="Yes, this is my device").click(timeout=45000)
                print("Duo trust screen appeared and was confirmed — trust did NOT carry over automatically.")
            except Exception:
                print("No Duo trust screen appeared within 45s — check the browser window to confirm why.")
        else:
            print("Already authenticated — saved session/trust carried over with zero login steps.")

        page.wait_for_url(reservation_url, timeout=120000)
        print("Logged in! Current URL:", page.url)
        page.wait_for_load_state("networkidle")

        context.storage_state(path="auth.json")
        print("Saved session + trust cookies to auth.json")

        browser.close()
