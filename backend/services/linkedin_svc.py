"""
LinkedIn profile scraper — scrapes the public profile page (no login required).
Falls back gracefully if the page is unavailable.
"""

import re
import httpx
from bs4 import BeautifulSoup

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
    """Return lines between `header` and the next known section header."""
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


def scrape_profile(linkedin_url: str) -> dict:
    """
    Scrape a public LinkedIn profile page and return structured data.
    Returns an empty dict on failure (non-blocking).
    """
    try:
        r = httpx.get(linkedin_url, headers=_HEADERS, follow_redirects=True, timeout=15)
        if r.status_code != 200:
            return {}
        soup = BeautifulSoup(r.text, 'lxml')
        lines = _clean_lines(soup)

        # Name — first h1
        name = ''
        h1 = soup.find('h1')
        if h1:
            name = h1.get_text(strip=True)

        # Headline — typically the first line after name that isn't a nav/login phrase
        headline = ''
        skip_phrases = {'sign in', 'join now', 'linkedin', 'email or phone', 'password'}
        for h in soup.find_all('h2'):
            txt = h.get_text(strip=True)
            if txt and not any(p in txt.lower() for p in skip_phrases) and len(txt) > 5:
                headline = txt
                break

        # About
        about_lines = _section_lines(lines, 'About', ['Experience', 'Education', 'Skills', 'Activity'])
        about = about_lines[0] if about_lines else ''

        # Experience — parse triples: title, company, dates
        exp_lines = _section_lines(lines, 'Experience', ['Education', 'Skills', 'Activity', 'Licenses'])
        experiences = []
        i = 0
        while i < len(exp_lines):
            line = exp_lines[i]
            # Heuristic: title lines are followed by company name
            if i + 1 < len(exp_lines):
                next_line = exp_lines[i + 1]
                # Skip lines that look like dates or durations
                if not re.match(r'^\d{4}', line) and not re.match(r'^\d+ year', line.lower()):
                    company = next_line if not re.match(r'^\d', next_line) else ''
                    experiences.append({'title': line, 'company': company})
                    i += 2 if company else 1
                    continue
            i += 1
        # Deduplicate and filter noise
        _skip = {'view', 'see', 'get', 'contact', 'join', '- present', 'present'}
        seen = set()
        deduped = []
        for e in experiences:
            key = (e['title'], e['company'])
            if key not in seen and e['title'].lower().strip('-').strip() not in _skip:
                seen.add(key)
                deduped.append(e)
        experiences = deduped[:6]

        # Education
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

        # Build flat summary for LLM
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
        print(f"[linkedin_svc] scrape failed for {linkedin_url}: {e}")
        return {}
