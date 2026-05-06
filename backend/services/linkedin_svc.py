"""
LinkedIn profile scraper using Playwright with pre-saved session cookies.

Setup (run once locally):
    python backend/scripts/linkedin_login.py
This opens a browser, you log in manually, cookies are saved and printed
as LINKEDIN_COOKIES env var value. Paste that into Railway.

Runtime: loads cookies from LINKEDIN_COOKIES env var and scrapes profiles.
"""

import os
import re
import json
import time


def _extract_public_id(url: str) -> str:
    m = re.search(r'linkedin\.com/in/([^/?#]+)', url)
    return m.group(1) if m else ''


def _clean_url(url: str) -> str:
    return re.sub(r'\?.*$', '', url.rstrip('/'))


def _get_cookies() -> list | None:
    """Load cookies from LINKEDIN_COOKIES env var (JSON array)."""
    raw = os.environ.get("LINKEDIN_COOKIES", "")
    if not raw:
        return None
    try:
        cookies = json.loads(raw)
        return cookies
    except Exception as e:
        print(f"[linkedin_svc] invalid LINKEDIN_COOKIES JSON: {e}")
        return None


def _scroll_page(page):
    """Scroll slowly to trigger lazy-loaded sections."""
    page.evaluate("window.scrollTo(0, 0)")
    time.sleep(1)
    for _ in range(12):
        page.evaluate("window.scrollBy(0, 500)")
        time.sleep(0.6)
    time.sleep(2)


def _click_show_all(page, keyword: str):
    """Click 'Show all X experiences / education' link if visible."""
    try:
        links = page.locator("a:has-text('Show all')").all()
        for link in links:
            try:
                txt = (link.inner_text(timeout=500) or "").lower()
                if keyword.lower() in txt and link.is_visible(timeout=500):
                    link.click()
                    time.sleep(2)
                    return True
            except Exception:
                continue
    except Exception:
        pass
    return False


def _parse_body(body: str) -> dict:
    lines = [l.strip() for l in body.split("\n") if l.strip() and len(l.strip()) > 1]

    nav_exact = {
        "home", "my network", "jobs", "messaging", "notifications", "me",
        "for business", "skip to main content", "0 notifications",
        "more", "message", "connect", "follow", "·", "500+ connections",
        "accessibility", "talent solutions", "community guidelines", "careers",
        "marketing solutions", "privacy & terms", "ad choices", "advertising",
        "sales solutions", "mobile", "small business", "safety center",
        "show all", "contact info",
    }
    nav_prefix = ("try premium", "linkedin corporation", "questions?",
                  "visit our help", "manage your account", "go to your settings",
                  "recommendation transparency", "learn more about",
                  "premium subscribers")

    content = []
    for l in lines:
        ll = l.lower()
        if ll in nav_exact:
            continue
        if any(ll.startswith(p) for p in nav_prefix):
            continue
        content.append(l)

    if not content:
        return {}

    # Name is first meaningful content line; headline directly below it
    name = content[0]
    headline = content[1] if len(content) > 1 else ""

    # Location
    location = ""
    location_kw = ["india", "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad",
                   "chennai", "pune", "gurugram", "noida", "kolkata", "karnataka",
                   "maharashtra", "telangana", "area, india"]
    for l in content[2:10]:
        if any(k in l.lower() for k in location_kw) and len(l) < 60:
            location = l
            break

    # About — multi-line, collect all paragraphs until next section
    about_lines = []
    section_headers = {"Activity", "Experience", "Education", "Skills",
                       "Licenses & certifications", "Volunteer", "Recommendations"}
    try:
        about_idx = next(i for i, l in enumerate(content) if l == "About")
        for l in content[about_idx + 1:]:
            if l in section_headers:
                break
            if not re.match(r'^\d', l) and len(l) > 5:
                about_lines.append(l)
    except StopIteration:
        pass
    about = " ".join(about_lines).strip()

    # Experience
    experiences = []
    skip_exp = {"full-time", "part-time", "contract", "freelance", "self-employed",
                "internship", "show all", "present"}
    try:
        exp_idx = next(i for i, l in enumerate(content) if l == "Experience")
        exp_lines = []
        for l in content[exp_idx + 1:]:
            if l in section_headers:
                break
            exp_lines.append(l)

        i = 0
        while i < len(exp_lines) and len(experiences) < 10:
            l = exp_lines[i]
            if (re.match(r'^\d{4}', l)
                    or re.match(r'^\d+ yr', l.lower())
                    or re.match(r'^\d+ mo', l.lower())
                    or l.lower() in skip_exp
                    or re.search(r'\d{4}\s*[-–]\s*(\d{4}|present)', l, re.I)
                    or ("skills" in l.lower() and "+" in l)
                    or len(l) < 3):
                i += 1
                continue

            title = l
            company = ""
            if i + 1 < len(exp_lines):
                nxt = exp_lines[i + 1]
                if (not re.match(r'^\d', nxt)
                        and nxt.lower() not in skip_exp
                        and not re.search(r'\d{4}', nxt)
                        and len(nxt) > 1):
                    company = nxt.split("·")[0].strip()
                    i += 1

            if title not in [e["title"] for e in experiences]:
                experiences.append({"title": title, "company": company})
            i += 1
    except StopIteration:
        pass

    # Education
    education = []
    try:
        edu_idx = next(i for i, l in enumerate(content) if l == "Education")
        edu_lines = []
        for l in content[edu_idx + 1:]:
            if l in section_headers:
                break
            edu_lines.append(l)

        i = 0
        while i < len(edu_lines) and len(education) < 6:
            l = edu_lines[i]
            if (re.match(r'^\d', l)
                    or re.search(r'\d{4}\s*[-–]', l)
                    or l.lower().startswith("grade")
                    or ("skills" in l.lower() and "+" in l)
                    or len(l) < 3):
                i += 1
                continue
            school = l
            degree = ""
            if i + 1 < len(edu_lines):
                nxt = edu_lines[i + 1]
                if (not re.match(r'^\d', nxt)
                        and not re.search(r'\d{4}', nxt)
                        and len(nxt) > 3):
                    degree = nxt
                    i += 1
            if school not in [e["school"] for e in education]:
                education.append({"school": school, "degree": degree})
            i += 1
    except StopIteration:
        pass

    institution = education[0]["school"] if education else ""
    exp_text = "\n".join(
        f"  - {e['title']}" + (f" @ {e['company']}" if e.get("company") else "")
        for e in experiences
    )
    edu_text = "\n".join(
        f"  - {e['school']}" + (f" ({e['degree']})" if e.get("degree") else "")
        for e in education
    )
    raw_summary = (
        f"Name: {name}\n"
        f"Headline: {headline}\n"
        f"Location: {location}\n"
        f"About: {about}\n"
        f"Experience:\n{exp_text}\n"
        f"Education:\n{edu_text}"
    ).strip()

    return {
        "headline": headline,
        "summary": about,
        "institution": institution,
        "experiences": experiences,
        "education": education,
        "skills": [],
        "raw_summary": raw_summary,
    }


def _scrape_with_browser(linkedin_url: str) -> dict:
    cookies = _get_cookies()
    if not cookies:
        print("[linkedin_svc] LINKEDIN_COOKIES not set — run scripts/linkedin_login.py first")
        return {}

    profile_url = _clean_url(linkedin_url)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[linkedin_svc] playwright not installed")
        return {}

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ],
            )
            ctx = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
                locale="en-US",
            )
            ctx.add_cookies(cookies)

            page = ctx.new_page()

            # Verify session is still valid
            page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded", timeout=30000)
            time.sleep(2)
            if "login" in page.url or "authwall" in page.url:
                print("[linkedin_svc] session expired — refresh LINKEDIN_COOKIES by re-running scripts/linkedin_login.py")
                browser.close()
                return {}

            print(f"[linkedin_svc] session valid, loading {profile_url}")
            page.goto(profile_url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(3)

            # Scroll to load all lazy sections
            _scroll_page(page)

            # Click "Show all" for experience and education
            _click_show_all(page, "experience")
            _click_show_all(page, "education")

            body_text = page.inner_text("body")
            browser.close()

        result = _parse_body(body_text)
        if not result or (not result.get("headline") and not result.get("experiences")):
            print("[linkedin_svc] parse returned no usable data")
            return {}

        exp_count = len(result.get("experiences", []))
        edu_count = len(result.get("education", []))
        print(f"[linkedin_svc] OK — {result.get('raw_summary','')[:60]} | {exp_count} exp | {edu_count} edu")
        return result

    except Exception as e:
        print(f"[linkedin_svc] browser scrape failed: {type(e).__name__}: {e}")
        return {}


def scrape_profile(linkedin_url: str) -> dict:
    public_id = _extract_public_id(linkedin_url)
    if not public_id:
        print(f"[linkedin_svc] could not extract public_id from: {linkedin_url}")
        return {}
    return _scrape_with_browser(linkedin_url)
