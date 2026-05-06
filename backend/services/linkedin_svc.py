"""
LinkedIn profile scraper — uses the linkedin-api package (authenticated) when
LINKEDIN_USERNAME / LINKEDIN_PASSWORD env vars are set, otherwise falls back to
the old public-page HTML scrape (which LinkedIn now blocks with a login wall).
"""

import os
import re
import httpx
from bs4 import BeautifulSoup

_LI_USER = os.environ.get("LINKEDIN_USERNAME", "")
_LI_PASS = os.environ.get("LINKEDIN_PASSWORD", "")

# Cached Linkedin client (one auth session per process)
_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not _LI_USER or not _LI_PASS:
        return None
    try:
        from linkedin_api import Linkedin
        _client = Linkedin(_LI_USER, _LI_PASS, refresh_cookies=False)
        return _client
    except Exception as e:
        print(f"[linkedin_svc] auth failed: {e}")
        return None


def _extract_public_id(url: str) -> str:
    """Extract the public profile ID from a LinkedIn URL."""
    m = re.search(r'linkedin\.com/in/([^/?#]+)', url)
    return m.group(1) if m else ''


def _scrape_authenticated(public_id: str) -> dict:
    """Use linkedin-api (cookie-based auth) to fetch structured profile data."""
    client = _get_client()
    if not client:
        return {}
    profile = client.get_profile(public_id=public_id)
    if not profile:
        return {}

    name = ' '.join(filter(None, [profile.get('firstName', ''), profile.get('lastName', '')])).strip()
    headline = profile.get('headline', '')
    summary = profile.get('summary', '')
    institution = ''

    # Experiences
    experiences = []
    for pos in profile.get('experience', []):
        title = pos.get('title', '')
        company = (pos.get('companyName') or pos.get('company', {}).get('name', '') or '')
        if title:
            experiences.append({'title': title, 'company': company})
    experiences = experiences[:6]

    # Education
    education = []
    for edu in profile.get('education', []):
        school = edu.get('schoolName', '')
        if school:
            education.append({'school': school})
    education = education[:3]
    if education:
        institution = education[0]['school']

    # Skills
    skills = [s.get('name', '') for s in profile.get('skills', []) if s.get('name')][:10]

    exp_text = '\n'.join(
        f"  - {e['title']}" + (f" @ {e['company']}" if e.get('company') else '')
        for e in experiences
    )
    edu_text = '\n'.join(f"  - {e['school']}" for e in education)
    raw_summary = (
        f"Name: {name}\n"
        f"Headline: {headline}\n"
        f"About: {summary}\n"
        f"Experience:\n{exp_text}\n"
        f"Education:\n{edu_text}"
    ).strip()

    return {
        'headline': headline,
        'summary': summary,
        'institution': institution,
        'experiences': experiences,
        'education': education,
        'skills': skills,
        'raw_summary': raw_summary,
    }


# ── HTML fallback (public page, often blocked) ────────────────────────────────

_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}


def _clean_lines(soup: BeautifulSoup) -> list[str]:
    return [l.strip() for l in soup.get_text(separator='\n').split('\n')
            if l.strip() and len(l.strip()) > 2]


def _section_lines(lines: list[str], header: str, next_headers: list[str]) -> list[str]:
    try:
        start = next(i for i, l in enumerate(lines) if l == header)
    except StopIteration:
        return []
    end = len(lines)
    for h in next_headers:
        try:
            idx = next(i for i, l in enumerate(lines) if l == h and i > start)
            end = min(end, idx)
        except StopIteration:
            pass
    return lines[start + 1: end]


def _scrape_html(linkedin_url: str) -> dict:
    try:
        r = httpx.get(linkedin_url, headers=_HEADERS, follow_redirects=True, timeout=15)
        if r.status_code != 200:
            return {}
        soup = BeautifulSoup(r.text, 'lxml')
        lines = _clean_lines(soup)

        name = ''
        h1 = soup.find('h1')
        if h1:
            name = h1.get_text(strip=True)

        headline = ''
        skip_phrases = {'sign in', 'join now', 'linkedin', 'email or phone', 'password'}
        for h in soup.find_all('h2'):
            txt = h.get_text(strip=True)
            if txt and not any(p in txt.lower() for p in skip_phrases) and len(txt) > 5:
                headline = txt
                break

        about_lines = _section_lines(lines, 'About', ['Experience', 'Education', 'Skills', 'Activity'])
        about = about_lines[0] if about_lines else ''

        exp_lines = _section_lines(lines, 'Experience', ['Education', 'Skills', 'Activity', 'Licenses'])
        experiences = []
        i = 0
        while i < len(exp_lines):
            line = exp_lines[i]
            if i + 1 < len(exp_lines):
                next_line = exp_lines[i + 1]
                if not re.match(r'^\d{4}', line) and not re.match(r'^\d+ year', line.lower()):
                    company = next_line if not re.match(r'^\d', next_line) else ''
                    experiences.append({'title': line, 'company': company})
                    i += 2 if company else 1
                    continue
            i += 1

        _skip = {'view', 'see', 'get', 'contact', 'join', '- present', 'present'}
        seen = set()
        deduped = []
        for e in experiences:
            key = (e['title'], e['company'])
            if key not in seen and e['title'].lower().strip('-').strip() not in _skip:
                seen.add(key)
                deduped.append(e)
        experiences = deduped[:6]

        edu_lines = _section_lines(lines, 'Education', ['Skills', 'Activity', 'Licenses', 'View'])
        education = []
        for line in edu_lines:
            if (not re.match(r'^\d', line)
                    and line.lower() not in _skip
                    and not line.lower().startswith("view ")
                    and not line.lower().startswith("see ")):
                education.append({'school': line})
        education = education[:3]
        institution = education[0]['school'] if education else ''

        exp_text = '\n'.join(
            f"  - {e['title']}" + (f" @ {e['company']}" if e.get('company') else '')
            for e in experiences
        )
        edu_text = '\n'.join(f"  - {e['school']}" for e in education)
        raw_summary = (
            f"Name: {name}\n"
            f"Headline: {headline}\n"
            f"About: {about}\n"
            f"Experience:\n{exp_text}\n"
            f"Education:\n{edu_text}"
        ).strip()

        return {
            'headline': headline,
            'summary': about,
            'institution': institution,
            'experiences': experiences,
            'education': education,
            'skills': [],
            'raw_summary': raw_summary,
        }
    except Exception as e:
        print(f"[linkedin_svc] html scrape failed: {e}")
        return {}


# ── Public entry point ────────────────────────────────────────────────────────

def scrape_profile(linkedin_url: str) -> dict:
    """
    Scrape a LinkedIn profile. Uses authenticated API if credentials are
    configured in env (LINKEDIN_USERNAME / LINKEDIN_PASSWORD), otherwise falls
    back to the unauthenticated HTML scrape (usually blocked by LinkedIn now).
    Returns an empty dict on failure (non-blocking).
    """
    public_id = _extract_public_id(linkedin_url)
    if not public_id:
        return {}

    if _LI_USER and _LI_PASS:
        try:
            result = _scrape_authenticated(public_id)
            if result:
                print(f"[linkedin_svc] authenticated scrape OK for {public_id}")
                return result
        except Exception as e:
            print(f"[linkedin_svc] authenticated scrape failed, trying html fallback: {e}")

    # HTML fallback
    return _scrape_html(linkedin_url)
