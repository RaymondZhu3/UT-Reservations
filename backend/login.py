import os
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()

reservation_url = "https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php"

# If auth.json exists from a previous run, load it as the starting cookie
# jar. This is what actually lets us test whether Duo's 30-day device trust
# works for a scripted client — without this, every run starts from a blank
# context and Duo has no way of knowing it's "the same device" as last time,
# so it would always challenge fresh regardless of whether trust would have
# carried over.
existing_state = "auth.json" if os.path.exists("auth.json") else None
if existing_state:
    print("Found existing auth.json — reusing it as the starting session.")

with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(storage_state=existing_state)
        page = context.new_page()
        page.goto(reservation_url)
        page.wait_for_load_state("networkidle")

        # With a fresh context (no auth.json) we always land on SAML2. With a
        # reused one, this branch is the actual test: did the old session or
        # Duo's 30-day trust carry over, or do we get bounced to login again?
        if "idp/profile/SAML2" in page.url:
            print("Redirected to login — saved session did not carry over on its own.")
            page.get_by_label("UT EID").fill(os.environ.get("UT_EID"))
            page.get_by_label("Password").fill(os.environ.get("UT_PASSWORD"))
            page.get_by_role("button", name="Sign in").click()

            # Watch the browser window here — that's the real signal, this is
            # just a convenience log. If Duo's "trust this browser" screen
            # shows up, trust did NOT skip and you'll need to approve a push.
            # If the page jumps straight to the reservation page instead,
            # trust worked and this click will simply time out with nothing
            # to click — that's expected, not an error.
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
