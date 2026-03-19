"""
DataPipeline — Feature engineering and dataset preparation for ML threat detection.

Responsibilities:
  1. Load phishing URLs from OpenPhish, PhishTank CSV, and local samples.
  2. Load benign URLs from Tranco top-1M list.
  3. Extract URL features: length, entropy, subdomain depth, special chars, TLD risk, etc.
  4. Extract text features: urgency keywords, URL count, readability, HTML ratio.
  5. Output train/test CSVs for model training.

Usage:
    python -m ml.data_pipeline
"""

import os
import re
import math
import json
import hashlib
import logging
import urllib.parse
from pathlib import Path
from typing import List, Dict, Optional, Tuple

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ── Constants ────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"

RISKY_TLDS = {
    ".xyz": 0.8, ".top": 0.85, ".tk": 0.9, ".ml": 0.85, ".ga": 0.85,
    ".cf": 0.85, ".gq": 0.85, ".buzz": 0.7, ".club": 0.6, ".info": 0.5,
    ".click": 0.75, ".link": 0.6, ".work": 0.65, ".online": 0.6,
    ".site": 0.55, ".icu": 0.8, ".cam": 0.7, ".rest": 0.7,
}

TOP_BRANDS = ["google", "paypal", "amazon", "apple", "microsoft", "facebook",
              "netflix", "instagram", "twitter", "linkedin", "whatsapp", "bank"]

URGENCY_KEYWORDS = [
    "verify now", "account suspended", "click immediately", "urgent action",
    "confirm your identity", "unauthorized access", "security alert",
    "your account will be", "act now", "limited time", "expire",
    "update your payment", "suspicious activity", "verify your account",
    "reset your password", "confirm your details", "unusual sign-in",
    "click here immediately", "within 24 hours", "immediately",
]


# ── Feature Engineering: URLs ────────────────────────────────────────────────

def _shannon_entropy(s: str) -> float:
    """Compute Shannon entropy of a string. Higher = more randomness/obfuscation."""
    if not s:
        return 0.0
    prob = {c: s.count(c) / len(s) for c in set(s)}
    return -sum(p * math.log2(p) for p in prob.values())


def _levenshtein(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return _levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]


def _brand_impersonation_score(domain: str) -> float:
    """Score how closely a domain resembles a top brand (higher = more suspicious)."""
    domain_lower = domain.lower()
    min_dist = float("inf")
    for brand in TOP_BRANDS:
        if brand in domain_lower and domain_lower != f"{brand}.com":
            return 0.95  # Direct brand name in non-official domain
        dist = _levenshtein(domain_lower.split(".")[0], brand)
        if dist < min_dist:
            min_dist = dist
    # Normalize: distance of 0 = exact match (score 1.0), 10+ = low risk
    return max(0.0, 1.0 - (min_dist / 10.0))


def extract_url_features(url: str) -> Dict:
    """
    Extract feature vector from a URL for the URL classifier.

    Returns dict with keys:
      url_length, has_ip_in_url, subdomain_depth, special_char_count,
      tld_risk_score, entropy, has_https, path_depth, brand_impersonation_score,
      num_dots, num_hyphens, num_digits_in_domain, domain_length
    """
    try:
        parsed = urllib.parse.urlparse(url if "://" in url else f"http://{url}")
    except Exception:
        parsed = urllib.parse.urlparse(f"http://{url}")

    hostname = parsed.hostname or ""
    path = parsed.path or ""

    # IP address in URL
    ip_pattern = re.compile(r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}")
    has_ip = bool(ip_pattern.search(hostname))

    # Subdomain depth
    parts = hostname.split(".")
    subdomain_depth = max(0, len(parts) - 2)

    # Special characters
    special_chars = sum(1 for c in url if c in "@-_~%!$&'()*+,;=")

    # TLD risk
    tld = "." + parts[-1] if parts else ""
    tld_risk = RISKY_TLDS.get(tld.lower(), 0.1)

    # Entropy
    entropy = _shannon_entropy(url)

    # HTTPS
    has_https = parsed.scheme == "https"

    # Path depth
    path_depth = len([seg for seg in path.split("/") if seg])

    # Brand impersonation
    brand_score = _brand_impersonation_score(hostname)

    # Additional features
    domain_no_tld = parts[0] if parts else ""
    num_digits_in_domain = sum(1 for c in domain_no_tld if c.isdigit())

    return {
        "url_length": len(url),
        "has_ip_in_url": int(has_ip),
        "subdomain_depth": subdomain_depth,
        "special_char_count": special_chars,
        "tld_risk_score": tld_risk,
        "entropy": round(entropy, 4),
        "has_https": int(has_https),
        "path_depth": path_depth,
        "brand_impersonation_score": round(brand_score, 4),
        "num_dots": hostname.count("."),
        "num_hyphens": hostname.count("-"),
        "num_digits_in_domain": num_digits_in_domain,
        "domain_length": len(hostname),
    }


# ── Feature Engineering: Text ────────────────────────────────────────────────

def extract_text_features(text: str, sender: str = "", subject: str = "") -> Dict:
    """
    Extract feature vector from email/message text for the text classifier.

    Returns dict with keys:
      urgency_keyword_count, num_urls_in_body, text_length,
      has_html, exclamation_count, all_caps_word_ratio,
      suspicious_sender, avg_word_length
    """
    text_lower = text.lower()

    # Urgency keywords
    urgency_count = sum(1 for kw in URGENCY_KEYWORDS if kw in text_lower)

    # URLs in body
    url_pattern = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
    num_urls = len(url_pattern.findall(text))

    # HTML presence
    has_html = int(bool(re.search(r"<[a-zA-Z][^>]*>", text)))

    # Exclamation marks
    exclamation_count = text.count("!")

    # ALL CAPS words ratio
    words = text.split()
    all_caps_words = sum(1 for w in words if w.isupper() and len(w) > 2)
    all_caps_ratio = all_caps_words / max(len(words), 1)

    # Suspicious sender (free email providers used in phishing)
    suspicious_domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "protonmail.com"]
    suspicious_sender = 0
    if sender:
        sender_domain = sender.split("@")[-1].lower() if "@" in sender else ""
        if sender_domain in suspicious_domains:
            suspicious_sender = 1

    # Average word length (phishing texts tend to have shorter words)
    avg_word_length = np.mean([len(w) for w in words]) if words else 0

    return {
        "urgency_keyword_count": urgency_count,
        "num_urls_in_body": num_urls,
        "text_length": len(text),
        "has_html": has_html,
        "exclamation_count": exclamation_count,
        "all_caps_word_ratio": round(all_caps_ratio, 4),
        "suspicious_sender": suspicious_sender,
        "avg_word_length": round(avg_word_length, 2),
    }


# ── Dataset Loading ──────────────────────────────────────────────────────────

def load_phishing_urls() -> List[str]:
    """Load phishing URLs from available sources."""
    urls = []

    # Source 1: Local phishing examples
    local_path = RAW_DIR / "phishing_examples.json"
    if local_path.exists():
        try:
            with open(local_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, str):
                        urls.append(item)
                    elif isinstance(item, dict) and "url" in item:
                        urls.append(item["url"])
            logger.info(f"Loaded {len(urls)} URLs from local examples")
        except Exception as e:
            logger.warning(f"Could not load local examples: {e}")

    # Source 2: PhishTank CSV
    phishtank_path = RAW_DIR / "phishtank.csv"
    if phishtank_path.exists():
        try:
            df = pd.read_csv(phishtank_path, usecols=["url"], nrows=50000)
            pt_urls = df["url"].dropna().tolist()
            urls.extend(pt_urls)
            logger.info(f"Loaded {len(pt_urls)} URLs from PhishTank")
        except Exception as e:
            logger.warning(f"Could not load PhishTank data: {e}")

    # Source 3: OpenPhish feed (pre-downloaded)
    openphish_path = RAW_DIR / "openphish_feed.txt"
    if openphish_path.exists():
        try:
            with open(openphish_path, "r") as f:
                op_urls = [line.strip() for line in f if line.strip()]
            urls.extend(op_urls)
            logger.info(f"Loaded {len(op_urls)} URLs from OpenPhish")
        except Exception as e:
            logger.warning(f"Could not load OpenPhish data: {e}")

    # Deduplicate
    urls = list(set(urls))
    logger.info(f"Total unique phishing URLs: {len(urls)}")

    # Generate synthetic phishing URLs if we have too few samples
    if len(urls) < 500:
        logger.info("Generating synthetic phishing URLs for training...")
        synthetic = _generate_synthetic_phishing_urls(500 - len(urls))
        urls.extend(synthetic)
        logger.info(f"Added {len(synthetic)} synthetic URLs. Total: {len(urls)}")

    return urls


def load_benign_urls() -> List[str]:
    """Load benign URLs from Tranco list or generate synthetic ones."""
    urls = []

    tranco_path = RAW_DIR / "tranco_1m.csv"
    if tranco_path.exists():
        try:
            df = pd.read_csv(tranco_path, header=None, names=["rank", "domain"], nrows=50000)
            urls = ["https://" + d for d in df["domain"].dropna().tolist()]
            logger.info(f"Loaded {len(urls)} benign URLs from Tranco")
        except Exception as e:
            logger.warning(f"Could not load Tranco list: {e}")

    if len(urls) < 500:
        logger.info("Generating synthetic benign URLs...")
        synthetic = _generate_synthetic_benign_urls(max(500, 500 - len(urls)))
        urls.extend(synthetic)

    return list(set(urls))


def _generate_synthetic_phishing_urls(count: int) -> List[str]:
    """Generate realistic-looking phishing URLs for training."""
    import random
    brands = ["g00gle", "paypa1", "amaz0n", "app1e", "micros0ft", "netfl1x",
              "faceb00k", "1nstagram", "twltter", "linkedln"]
    tlds = [".xyz", ".tk", ".ml", ".ga", ".top", ".club", ".click", ".info"]
    paths = ["/login", "/verify", "/account", "/secure", "/update", "/confirm",
             "/signin", "/auth", "/reset", "/payment"]
    urls = []
    for _ in range(count):
        brand = random.choice(brands)
        tld = random.choice(tlds)
        path = random.choice(paths)
        subdomain = random.choice(["secure", "login", "verify", "account", "www", "m", ""])
        prefix = f"{subdomain}." if subdomain else ""
        suffix = "".join(random.choices("abcdefghijklmnop0123456789", k=random.randint(3, 8)))
        url = f"http://{prefix}{brand}-{suffix}{tld}{path}"
        urls.append(url)
    return urls


def _generate_synthetic_benign_urls(count: int) -> List[str]:
    """Generate synthetic benign URLs from well-known domains."""
    import random
    domains = ["google.com", "youtube.com", "facebook.com", "amazon.com",
               "wikipedia.org", "reddit.com", "twitter.com", "instagram.com",
               "linkedin.com", "microsoft.com", "apple.com", "github.com",
               "stackoverflow.com", "netflix.com", "yahoo.com", "bing.com",
               "cnn.com", "bbc.com", "nytimes.com", "medium.com"]
    paths = ["/", "/about", "/help", "/contact", "/products", "/services",
             "/blog", "/news", "/support", "/faq", ""]
    urls = []
    for _ in range(count):
        domain = random.choice(domains)
        path = random.choice(paths)
        urls.append(f"https://www.{domain}{path}")
    return urls


# ── Pipeline ─────────────────────────────────────────────────────────────────

def build_url_dataset() -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Build the complete URL feature dataset and split into train/test.

    Returns:
      (train_df, test_df) — DataFrames with features + 'label' column (0=benign, 1=phishing)
    """
    from sklearn.model_selection import train_test_split

    logger.info("=== Building URL Feature Dataset ===")

    phishing_urls = load_phishing_urls()
    benign_urls = load_benign_urls()

    # Balance classes
    min_count = min(len(phishing_urls), len(benign_urls))
    if min_count < len(phishing_urls):
        phishing_urls = phishing_urls[:min_count]
    if min_count < len(benign_urls):
        benign_urls = benign_urls[:min_count]

    logger.info(f"Using {len(phishing_urls)} phishing + {len(benign_urls)} benign URLs")

    # Extract features
    records = []
    for url in phishing_urls:
        features = extract_url_features(url)
        features["label"] = 1
        features["url"] = url
        records.append(features)

    for url in benign_urls:
        features = extract_url_features(url)
        features["label"] = 0
        features["url"] = url
        records.append(features)

    df = pd.DataFrame(records)

    # Split
    train_df, test_df = train_test_split(
        df, test_size=0.2, stratify=df["label"], random_state=42
    )

    # Save
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    train_path = DATA_DIR / "url_features_train.csv"
    test_path = DATA_DIR / "url_features_test.csv"
    train_df.to_csv(train_path, index=False)
    test_df.to_csv(test_path, index=False)

    logger.info(f"Train set: {len(train_df)} samples → {train_path}")
    logger.info(f"Test set:  {len(test_df)} samples → {test_path}")

    return train_df, test_df


# ── CLI Entry Point ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    build_url_dataset()
    logger.info("Data pipeline complete.")
