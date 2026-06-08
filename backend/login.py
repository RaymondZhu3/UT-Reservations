import os
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()

reservation_url = "https://apps.rs.utexas.edu/app/myrecsports/reserve_courts.php"

with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        page.goto(reservation_url)
        page.wait_for_url("**idp/profile/SAML2/**")
        # page.get_by_label("UT EID").fill(os.environ.get("UT_EID"))
        # page.get_by_label("Password").fill(os.environ.get("UT_PASSWORD"))
        # page.get_by_role("button", name="Sign in").click()
        # page.get_by_role("button", name="Yes, this is my device").click()
        # page.wait_for_url(reservation_url, timeout=120000)
        # print("Logged in! Current URL:", page.url)
        # page.wait_for_load_state("networkidle")
        # storage = context.storage_state(path="auth.json")
        