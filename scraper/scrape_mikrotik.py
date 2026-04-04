#!/usr/bin/env python3
"""
MikroTik Product Scraper

Scrapes product data from mikrotik.com for routers, switches, and related
networking equipment. Outputs a structured JSON file used by the
MikroTik Network Configurator web application.

Usage:
    python scrape_mikrotik.py [--output ../public/data/products.json]
    python scrape_mikrotik.py --use-selenium  # if requests-based scraping is blocked
"""

import argparse
import json
import logging
import re
import sys
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

BASE_URL = "https://mikrotik.com"
PRODUCTS_PAGE = "/products"

# Headers that mimic a real browser to avoid 403 blocks
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;"
        "q=0.9,image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}


def create_session() -> requests.Session:
    """Create a requests session with browser-like headers."""
    session = requests.Session()
    session.headers.update(BROWSER_HEADERS)
    return session


def fetch_page(session: requests.Session, url: str, retries: int = 3) -> Optional[BeautifulSoup]:
    """Fetch a page and return parsed BeautifulSoup, with retry logic."""
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "lxml")
        except requests.RequestException as e:
            logger.warning(f"Attempt {attempt + 1} failed for {url}: {e}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    return None


def fetch_page_selenium(url: str) -> Optional[BeautifulSoup]:
    """Fetch a page using Selenium as fallback for sites blocking requests."""
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from webdriver_manager.chrome import ChromeDriverManager

        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument(f"user-agent={BROWSER_HEADERS['User-Agent']}")

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.get(url)
        time.sleep(3)  # Wait for JS rendering
        soup = BeautifulSoup(driver.page_source, "lxml")
        driver.quit()
        return soup
    except Exception as e:
        logger.error(f"Selenium fetch failed for {url}: {e}")
        return None


def discover_product_groups(
    session: requests.Session, use_selenium: bool = False
) -> dict[str, str]:
    """Discover available product groups from the MikroTik products page.

    Returns a dict mapping group slug (e.g. "ethernet-routers") to the
    group's display name (e.g. "Ethernet routers").
    """
    url = urljoin(BASE_URL, PRODUCTS_PAGE)
    logger.info(f"Discovering product groups from {url}")

    if use_selenium:
        soup = fetch_page_selenium(url)
    else:
        soup = fetch_page(session, url)

    if not soup:
        logger.error("Failed to fetch products page for group discovery")
        return {}

    groups = {}
    for a_tag in soup.select("a[href*='/products/group/']"):
        href = a_tag.get("href", "")
        name = a_tag.get_text().strip()
        if href and "/products/group/" in href:
            slug = href.rstrip("/").split("/")[-1]
            if slug not in groups:
                groups[slug] = name
                logger.info(f"  Discovered group: {slug} ({name})")

    logger.info(f"Discovered {len(groups)} product groups")
    return groups


def extract_product_links(soup: BeautifulSoup) -> list[str]:
    """Extract individual product page URLs from a product group listing page."""
    links = []
    # MikroTik product listings typically use specific CSS classes
    for a_tag in soup.select("a[href*='/product/']"):
        href = a_tag.get("href", "")
        if href and "/product/" in href:
            full_url = urljoin(BASE_URL, href)
            if full_url not in links:
                links.append(full_url)
    return links


def parse_spec_value(text: str) -> str:
    """Clean up a specification value string."""
    return re.sub(r"\s+", " ", text.strip())


def _spec_int(specs: dict, pattern: str) -> int:
    """Find a spec key matching the pattern and return its value as an int."""
    for key, val in specs.items():
        if re.search(pattern, key, re.I):
            m = re.search(r"(\d+)", val)
            if m:
                return int(m.group(1))
    return 0


def _spec_int_val(val: str) -> int:
    """Extract the first integer from a spec value string."""
    m = re.search(r"(\d+)", val)
    return int(m.group(1)) if m else 0


def extract_ports_info(specs: dict, description: str) -> dict:
    """Extract structured port information from specs and description text."""
    ports = {
        "ethernet_count": 0,
        "ethernet_speed": [],
        "sfp_count": 0,
        "sfp_plus_count": 0,
        "sfp28_count": 0,
        "qsfp_plus_count": 0,
        "qsfp28_count": 0,
        "poe_in": False,
        "poe_out": False,
        "poe_out_ports": 0,
        "poe_budget_watts": None,
        "usb_count": 0,
        "serial_port": False,
    }

    # Iterate all spec keys to extract port counts by matching known patterns.
    # Each key is checked once; matched keys are skipped to avoid double-counting.
    matched_keys = set()
    for key in specs:
        lk = key.lower()

        # 10/100/1000 Gigabit Ethernet
        if re.search(r"10/100/1000", key) and key not in matched_keys:
            val = _spec_int_val(specs[key])
            if val:
                ports["ethernet_count"] += val
                if "1G" not in ports["ethernet_speed"]:
                    ports["ethernet_speed"].append("1G")
                matched_keys.add(key)
                continue

        # 10/100 Fast Ethernet (but NOT 10/100/1000)
        if re.search(r"10/100(?!/1000)", key) and key not in matched_keys:
            val = _spec_int_val(specs[key])
            if val:
                ports["ethernet_count"] += val
                if "100M" not in ports["ethernet_speed"]:
                    ports["ethernet_speed"].append("100M")
                matched_keys.add(key)
                continue

        # 10G Ethernet (various formats: "10G", "10 Gigabit", "10GbE")
        if re.search(r"\b10\s*G", key, re.I) and "ethernet" in lk and key not in matched_keys:
            val = _spec_int_val(specs[key])
            if val:
                ports["ethernet_count"] += val
                if "10G" not in ports["ethernet_speed"]:
                    ports["ethernet_speed"].append("10G")
                matched_keys.add(key)
                continue

        # 2.5G Ethernet
        if re.search(r"2\.5\s*G", key, re.I) and ("ethernet" in lk or "port" in lk) and key not in matched_keys:
            val = _spec_int_val(specs[key])
            if val:
                ports["ethernet_count"] += val
                if "2.5G" not in ports["ethernet_speed"]:
                    ports["ethernet_speed"].append("2.5G")
                matched_keys.add(key)
                continue

        # Multi-speed Ethernet (e.g. "1G/2.5G/5G/10G Ethernet ports")
        if re.search(r"\d+G/\d+G", key, re.I) and ("ethernet" in lk or "port" in lk) and key not in matched_keys:
            val = _spec_int_val(specs[key])
            if val:
                # Use the highest speed mentioned
                speeds_in_key = re.findall(r"(\d+(?:\.\d+)?)\s*G", key, re.I)
                if speeds_in_key:
                    highest = max(float(s) for s in speeds_in_key)
                    speed_label = f"{highest:g}G"
                else:
                    speed_label = "1G"
                ports["ethernet_count"] += val
                if speed_label not in ports["ethernet_speed"]:
                    ports["ethernet_speed"].append(speed_label)
                matched_keys.add(key)
                continue

        # QSFP28 ports (check before QSFP+)
        if re.search(r"QSFP28", key) and "port" in lk and key not in matched_keys:
            val = _spec_int_val(specs[key])
            if val:
                ports["qsfp28_count"] += val
                matched_keys.add(key)
                continue

        # QSFP+ ports
        if re.search(r"QSFP\+", key) and "port" in lk and key not in matched_keys:
            val = _spec_int_val(specs[key])
            if val:
                ports["qsfp_plus_count"] += val
                matched_keys.add(key)
                continue

        # SFP28 ports (check before SFP+)
        if re.search(r"SFP28", key) and "port" in lk and key not in matched_keys:
            val = _spec_int_val(specs[key])
            if val:
                ports["sfp28_count"] += val
                matched_keys.add(key)
                continue

        # SFP+ ports (also match "Combo ... SFP+" keys)
        if re.search(r"SFP\+", key) and "port" in lk and key not in matched_keys:
            val = _spec_int_val(specs[key])
            if val:
                ports["sfp_plus_count"] += val
                matched_keys.add(key)
                continue

        # SFP ports (plain, not SFP+ or SFP28)
        if re.search(r"\bSFP\b(?!\+|28)", key) and "port" in lk and key not in matched_keys:
            val = _spec_int_val(specs[key])
            if val:
                ports["sfp_count"] += val
                matched_keys.add(key)
                continue

        # USB ports
        if "usb" in lk and "port" in lk and key not in matched_keys:
            val = _spec_int_val(specs[key])
            if val:
                ports["usb_count"] += val
                matched_keys.add(key)
                continue

    # PoE – check both spec keys and combined text
    combined_text = " ".join(f"{k}: {v}" for k, v in specs.items()) + " " + description

    if re.search(r"PoE[\s-]*in", combined_text, re.I):
        ports["poe_in"] = True
    if re.search(r"PoE[\s-]*out", combined_text, re.I):
        ports["poe_out"] = True
        poe_out_count = _spec_int(specs, r"PoE[\s-]*out.*port")
        if poe_out_count:
            ports["poe_out_ports"] = poe_out_count

    poe_budget = re.search(r"(?:PoE|power)\s*budget[:\s]*(\d+)\s*W", combined_text, re.I)
    if poe_budget:
        ports["poe_budget_watts"] = int(poe_budget.group(1))

    if re.search(r"serial|RS232|console\s*port", combined_text, re.I):
        ports["serial_port"] = True

    return ports


def extract_product_data(soup: BeautifulSoup, url: str) -> Optional[dict]:
    """Extract structured product data from an individual product page."""
    product = {
        "url": url,
        "name": "",
        "model": "",
        "category": "",
        "description": "",
        "specs": {},
        "ports": {},
        "cpu": "",
        "ram_mb": None,
        "storage_mb": None,
        "routeros_license": None,
        "switch_os": None,
        "max_power_consumption_watts": None,
        "operating_temp_c": "",
        "dimensions": "",
        "price_usd": None,
        "image_url": "",
    }

    # Product name
    title = soup.select_one("h1.title, h1")
    if title:
        product["name"] = parse_spec_value(title.get_text())

    # Model from URL
    model = url.rstrip("/").split("/")[-1]
    product["model"] = model

    # Description – try meta tag first, then in-page elements
    desc_meta = soup.select_one("meta[name='description']")
    desc_el = soup.select_one(".product-description, .description")
    if desc_el:
        product["description"] = parse_spec_value(desc_el.get_text())
    elif desc_meta and desc_meta.get("content"):
        product["description"] = parse_spec_value(desc_meta["content"])

    # Image – prefer og:image meta tag (most reliable), then fall back to
    # in-page selectors, and finally derive a CDN URL from the product slug.
    og_img = soup.select_one("meta[property='og:image']")
    if og_img and og_img.get("content"):
        product["image_url"] = og_img["content"]
    else:
        img = soup.select_one(".product-image img, .gallery img, img[src*='product']")
        if img:
            src = img.get("src", "")
            product["image_url"] = urljoin(BASE_URL, src) if src else ""

    # If we still don't have an image URL, derive one from the product slug
    if not product["image_url"]:
        slug = urlparse(url).path.rstrip("/").split("/")[-1]
        product["image_url"] = f"https://i.mt.lv/cdn/rb_images/{slug}_big.png"

    # Specifications – MikroTik uses <li> elements with <span> pairs for specs
    specs = {}
    for li in soup.select("li.flex"):
        spans = li.find_all("span", recursive=False)
        if len(spans) >= 2:
            key = parse_spec_value(spans[0].get_text())
            val = parse_spec_value(spans[1].get_text())
            if key:
                specs[key] = val

    # Fallback: also check for table-based specs and definition lists
    if not specs:
        for row in soup.select("table tr, .specs tr, .specifications tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) >= 2:
                key = parse_spec_value(cells[0].get_text())
                val = parse_spec_value(cells[1].get_text())
                specs[key] = val
        for dl in soup.select("dl"):
            dts = dl.find_all("dt")
            dds = dl.find_all("dd")
            for dt, dd in zip(dts, dds):
                specs[parse_spec_value(dt.get_text())] = parse_spec_value(dd.get_text())

    product["specs"] = specs

    # Price – extract from specs (listed as "Suggested price")
    for key in specs:
        if re.search(r"price", key, re.I):
            price_match = re.search(r"\$\s*([\d,]+(?:\.\d{2})?)", specs[key])
            if price_match:
                product["price_usd"] = float(price_match.group(1).replace(",", ""))
            break

    # CPU
    for key in specs:
        if re.search(r"CPU|processor", key, re.I):
            product["cpu"] = specs[key]
            break

    # RAM
    for key in specs:
        if re.search(r"RAM|memory", key, re.I):
            ram_match = re.search(r"(\d+)\s*(MB|GB)", specs[key], re.I)
            if ram_match:
                val = int(ram_match.group(1))
                if ram_match.group(2).upper() == "GB":
                    val *= 1024
                product["ram_mb"] = val
            break

    # Storage
    for key in specs:
        if re.search(r"storage|flash|NAND", key, re.I):
            stor_match = re.search(r"(\d+)\s*(MB|GB)", specs[key], re.I)
            if stor_match:
                val = int(stor_match.group(1))
                if stor_match.group(2).upper() == "GB":
                    val *= 1024
                product["storage_mb"] = val
            break

    # RouterOS license
    for key in specs:
        if re.search(r"license|RouterOS", key, re.I):
            lic_match = re.search(r"(?:L(?:evel)?\s*)?(\d)", specs[key], re.I)
            if lic_match:
                product["routeros_license"] = int(lic_match.group(1))
            break

    # Power consumption
    for key in specs:
        if re.search(r"power consumption|max power", key, re.I):
            pwr_match = re.search(r"(\d+)\s*W", specs[key], re.I)
            if pwr_match:
                product["max_power_consumption_watts"] = int(pwr_match.group(1))
            break

    # Port information
    product["ports"] = extract_ports_info(specs, product["description"])

    return product


def scrape_product_group(
    session: requests.Session,
    group_url: str,
    category: str,
    use_selenium: bool = False,
) -> list[dict]:
    """Scrape all products from a product group page."""
    full_url = urljoin(BASE_URL, group_url)
    logger.info(f"Scraping group: {full_url}")

    if use_selenium:
        soup = fetch_page_selenium(full_url)
    else:
        soup = fetch_page(session, full_url)

    if not soup:
        logger.error(f"Failed to fetch group page: {full_url}")
        return []

    product_links = extract_product_links(soup)
    logger.info(f"Found {len(product_links)} products in {group_url}")

    products = []
    for link in product_links:
        logger.info(f"  Scraping product: {link}")
        if use_selenium:
            product_soup = fetch_page_selenium(link)
        else:
            product_soup = fetch_page(session, link)
            time.sleep(1)  # Polite delay

        if product_soup:
            product = extract_product_data(product_soup, link)
            if product:
                product["category"] = category
                products.append(product)
        else:
            logger.warning(f"  Failed to fetch: {link}")

    return products


def scrape_all_products(use_selenium: bool = False) -> dict:
    """Scrape all MikroTik products across all discovered categories."""
    session = create_session()
    groups = discover_product_groups(session, use_selenium)

    if not groups:
        logger.error("No product groups discovered — aborting")
        return {}

    all_products = {}
    for slug, name in groups.items():
        group_url = f"/products/group/{slug}"
        category = slug
        all_products[category] = scrape_product_group(
            session, group_url, category, use_selenium
        )
        logger.info(f"Total {category}: {len(all_products[category])} products")

    return all_products


def build_output(products_by_category: dict) -> dict:
    """Build the final JSON output structure."""
    return {
        "metadata": {
            "source": "mikrotik.com",
            "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "version": "1.0.0",
            "categories": list(products_by_category.keys()),
            "total_products": sum(
                len(prods) for prods in products_by_category.values()
            ),
        },
        "products": products_by_category,
    }


def main():
    parser = argparse.ArgumentParser(description="Scrape MikroTik product data")
    parser.add_argument(
        "--output",
        default=str(Path(__file__).parent.parent / "public" / "data" / "products.json"),
        help="Output JSON file path",
    )
    parser.add_argument(
        "--use-selenium",
        action="store_true",
        help="Use Selenium for scraping (slower but bypasses JS-based blocks)",
    )
    args = parser.parse_args()

    logger.info("Starting MikroTik product scraper...")
    products = scrape_all_products(use_selenium=args.use_selenium)
    output = build_output(products)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    logger.info(f"Wrote {output['metadata']['total_products']} products to {output_path}")


if __name__ == "__main__":
    main()
