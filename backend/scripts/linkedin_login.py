"""
Run this script once locally to generate LinkedIn session cookies.

Usage:
    cd backend
    source venv/bin/activate
    python scripts/linkedin_login.py

A browser window opens. Log in to LinkedIn manually (your dummy account).
Once you see the LinkedIn feed, press Enter in this terminal.
The cookies are saved and printed as a JSON string — paste that value
into Railway as the LINKEDIN_COOKIES environment variable.
"""

import json
from playwright.sync_api import sync_playwright

def main():
    print("Opening browser for LinkedIn login...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        ctx = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
        )
        page = ctx.new_page()
        page.goto("https://www.linkedin.com/login")

        print("\n>>> Log in to LinkedIn in the browser window that just opened.")
        print(">>> Once you see your LinkedIn feed, come back here and press Enter.")
        input("Press Enter when logged in... ")

        cookies = ctx.cookies()
        browser.close()

    cookies_json = json.dumps(cookies)
    print("\n" + "="*60)
    print("LINKEDIN_COOKIES value (copy everything between the lines):")
    print("="*60)
    print(cookies_json)
    print("="*60)
    print("\nPaste this as LINKEDIN_COOKIES in Railway → Variables.")
    print("Re-run this script if scraping stops working (session expired).")

if __name__ == "__main__":
    main()
