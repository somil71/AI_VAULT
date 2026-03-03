"""
Phishing Detector Service
=========================
Combines two scoring methods:
  1. Keyword Heuristic Engine – fast rule-based analysis
  2. HuggingFace Transformer – NLP model for contextual understanding

Final Score Formula:
  fraud_probability = (0.4 × heuristic_score) + (0.6 × model_confidence)

Risk Levels:
  0–25  → LOW
  26–50 → MEDIUM
  51–75 → HIGH
  76–100→ CRITICAL
"""

import re
import json
import hashlib
from pathlib import Path
from urllib.parse import urlparse
from typing import Optional, List, Dict, Any

# Try to load HuggingFace model; fall back to heuristic-only if unavailable
try:
    from transformers import pipeline
    _HF_AVAILABLE = True
except ImportError:
    _HF_AVAILABLE = False

class PhishingDetector:
    """
    Multi-layer phishing and scam detection engine.
    """

    # ── Phishing Keyword Database ──────────────────────────────────────────────
    URGENCY_KEYWORDS = [
        "urgent", "immediately", "account suspended", "verify now",
        "act fast", "expire", "24 hours", "limited time", "final notice",
        "last chance", "must respond", "critical alert", "action required",
    ]

    FINANCIAL_BAIT_KEYWORDS = [
        "bank account", "credit card", "ssn", "social security", "password",
        "pin number", "wire transfer", "bitcoin", "crypto", "gift card",
        "prize", "won", "lottery", "inheritance", "claim now", "cash reward",
        "free money", "investment opportunity", "guaranteed returns",
    ]

    AUTHORITY_KEYWORDS = [
        "irs", "fbi", "police", "government", "official", "microsoft support",
        "apple support", "amazon security", "paypal", "your bank",
    ]

    REQUEST_KEYWORDS = [
        "click here", "click the link", "follow this link", "open attachment",
        "download now", "enter your details", "confirm your", "provide your",
        "update your information", "verify your identity",
    ]

    # Known phishing TLD patterns
    SUSPICIOUS_TLDS = [".xyz", ".tk", ".ml", ".ga", ".cf", ".gq", ".cc", ".su"]

    # Legitimate domain lookalikes (typosquatting detection)
    BRAND_LOOKALIKES = {
        "paypal": ["paypa1", "pay-pal", "paypai", "paypаl"],
        "amazon": ["amaz0n", "amazone", "amazon-secure"],
        "google": ["g00gle", "gooogle", "googie"],
        "apple": ["app1e", "apple-secure", "appleid-verify"],
        "microsoft": ["micros0ft", "microsoft-support"],
        "bank": ["bank-secure", "bankverify", "bank-alert"],
    }

    def __init__(self):
        self._model = None
        self._model_loaded = False
        self._pattern_dataset = self._load_pattern_dataset()
        self._load_model()

    def _load_pattern_dataset(self) -> List[Dict[str, str]]:
        try:
            dataset_path = Path(__file__).resolve().parents[1] / "data" / "scam_patterns.json"
            with open(dataset_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return [item for item in data if isinstance(item, dict)]
        except Exception:
            pass
        return []

    def _load_model(self):
        """Load a lightweight HuggingFace text classification model."""
        if not _HF_AVAILABLE:
            print("HuggingFace not available. Using heuristic-only mode.")
            return

        try:
            # Use a small zero-shot or text classification model
            # mrm8488/bert-tiny-finetuned-sms-spam-detection is very lightweight
            print("Loading HuggingFace model (this may take a moment on first run)...")
            self._model = pipeline(
                "text-classification",
                model="mrm8488/bert-tiny-finetuned-sms-spam-detection",
                truncation=True,
                max_length=512,
            )
            self._model_loaded = True
            print("NLP model loaded successfully")
        except Exception as e:
            print(f"Model load failed ({e}). Using heuristic-only mode.")
            self._model = None
            self._model_loaded = False

    def get_model_status(self) -> Dict[str, Any]:
        return {
            "hf_available": _HF_AVAILABLE,
            "model_loaded": self._model_loaded,
            "mode": "full_ai" if self._model_loaded else "heuristic_only",
        }

    def _heuristic_score(self, text: str) -> tuple[float, List[str]]:
        """
        Rule-based keyword scoring.

        Returns:
            score (float): 0–100
            detected_patterns (List[str]): human-readable findings
        """
        score = 0.0
        patterns = []
        text_lower = text.lower()

        # Check urgency keywords (up to 30 pts)
        urgency_hits = [k for k in self.URGENCY_KEYWORDS if k in text_lower]
        if urgency_hits:
            score += min(30, len(urgency_hits) * 8)
            patterns.append(f"Urgency manipulation: '{', '.join(urgency_hits[:3])}'")

        # Check financial bait (up to 30 pts)
        financial_hits = [k for k in self.FINANCIAL_BAIT_KEYWORDS if k in text_lower]
        if financial_hits:
            score += min(30, len(financial_hits) * 10)
            patterns.append(f"Financial data request: '{', '.join(financial_hits[:3])}'")

        # Check authority spoofing (up to 20 pts)
        authority_hits = [k for k in self.AUTHORITY_KEYWORDS if k in text_lower]
        if authority_hits:
            score += min(20, len(authority_hits) * 7)
            patterns.append(f"Authority impersonation: '{', '.join(authority_hits[:3])}'")

        # Check action requests (up to 20 pts)
        action_hits = [k for k in self.REQUEST_KEYWORDS if k in text_lower]
        if action_hits:
            score += min(20, len(action_hits) * 6)
            patterns.append(f"Action request found: '{action_hits[0]}'")

        return min(score, 100.0), patterns

    def _analyze_url(self, url: str) -> tuple[float, Dict[str, Any]]:
        """
        Analyze a URL for phishing indicators.

        Returns:
            score (float): 0–100
            analysis (dict): detailed URL breakdown
        """
        score = 0.0
        analysis = {
            "url": url,
            "findings": [],
            "is_suspicious": False,
        }

        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            path = parsed.path.lower()

            # Check for suspicious TLD
            for tld in self.SUSPICIOUS_TLDS:
                if domain.endswith(tld):
                    score += 30
                    analysis["findings"].append(f"Suspicious TLD: {tld}")
                    break

            # Check for IP address instead of domain
            ip_pattern = re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b')
            if ip_pattern.search(domain):
                score += 40
                analysis["findings"].append("IP address used instead of domain name")

            # Check for number substitutions (l33t speak: amaz0n)
            if re.search(r'[a-z]+[0-9][a-z]+', domain):
                score += 25
                analysis["findings"].append("Number substitution in domain (typosquatting)")

            # Check for brand lookalikes
            for brand, lookalikes in self.BRAND_LOOKALIKES.items():
                for lookalike in lookalikes:
                    if lookalike in domain:
                        score += 35
                        analysis["findings"].append(f"Domain mimics '{brand}' brand ('{lookalike}')")
                        break

            # Check for suspicious path keywords
            suspicious_paths = ["verify", "login", "secure", "account", "update", "confirm"]
            path_hits = [p for p in suspicious_paths if p in path]
            if path_hits:
                score += 15
                analysis["findings"].append(f"Suspicious path keywords: {path_hits}")

            # Check for HTTP (not HTTPS) for financial-looking sites
            if parsed.scheme == "http" and any(w in domain for w in ["bank", "paypal", "secure", "account"]):
                score += 20
                analysis["findings"].append("HTTP used for sensitive-looking domain")

            # Excessive subdomains
            subdomain_count = domain.count(".")
            if subdomain_count > 3:
                score += 15
                analysis["findings"].append(f"Excessive subdomains ({subdomain_count} dots)")

        except Exception as e:
            analysis["findings"].append(f"URL parsing error: {e}")

        analysis["is_suspicious"] = score > 30
        return min(score, 100.0), analysis

    def _model_confidence(self, text: str) -> float:
        """
        Get confidence score from HuggingFace model.
        Returns 0.0–100.0 (where 100 = definitely spam/phishing)
        """
        if not self._model_loaded or not self._model:
            return 0.0

        try:
            result = self._model(text[:512])[0]
            # Model returns LABEL_0 (ham) or LABEL_1 (spam)
            if result["label"] == "LABEL_1":
                return result["score"] * 100
            else:
                return (1 - result["score"]) * 100
        except Exception:
            return 0.0

    def _get_risk_level(self, score: float) -> str:
        if score < 25:
            return "LOW"
        elif score < 50:
            return "MEDIUM"
        elif score < 75:
            return "HIGH"
        else:
            return "CRITICAL"

    def _build_explanation(self, final_score: float, patterns: List[str], risk_level: str) -> List[str]:
        explanation = []

        if risk_level == "LOW":
            explanation.append("No significant phishing indicators detected.")
            explanation.append("This message appears legitimate.")
        elif risk_level == "MEDIUM":
            explanation.append("Some suspicious patterns detected. Exercise caution.")
        elif risk_level == "HIGH":
            explanation.append("Multiple phishing indicators found. Do NOT click any links.")
            explanation.append("Do NOT provide personal or financial information.")
        elif risk_level == "CRITICAL":
            explanation.append("⚠️ CRITICAL: Classic phishing attack pattern detected.")
            explanation.append("This is almost certainly a scam. Delete immediately.")
            explanation.append("Report to your bank/service provider if it claims to be from them.")

        return explanation

    def _classify_scam_context(self, text: str, patterns: List[str], risk_level: str) -> Dict[str, Any]:
        lowered = (text or "").lower()
        combined_patterns = " ".join(patterns).lower()
        context = f"{lowered} {combined_patterns}"

        category = "general_phishing"
        similar_pattern = "Generic credential harvesting message"

        if any(x in context for x in ["upi", "qr", "collect request", "payment request"]):
            category = "upi_scam"
            similar_pattern = "UPI payment request impersonation pattern"
        elif any(x in context for x in ["deepfake", "voice clone", "video call verification"]):
            category = "deepfake_impersonation"
            similar_pattern = "Synthetic identity impersonation attempt"
        elif any(x in context for x in ["job offer", "work from home", "interview fee"]):
            category = "fake_job_fraud"
            similar_pattern = "Advance fee fake job offer pattern"
        elif any(x in context for x in ["otp", "bank account", "kyc", "verify now"]):
            category = "bank_impersonation"
            similar_pattern = "Urgent account verification social-engineering pattern"
        elif "authority impersonation" in context:
            category = "authority_impersonation"
            similar_pattern = "Government or institution impersonation pattern"

        if self._pattern_dataset:
            tokens = set(re.findall(r"[a-z0-9]+", context))
            best_match = None
            best_score = 0
            for row in self._pattern_dataset:
                candidate = str(row.get("pattern", "")).lower()
                candidate_tokens = set(re.findall(r"[a-z0-9]+", candidate))
                if not candidate_tokens:
                    continue
                overlap = len(tokens.intersection(candidate_tokens))
                if overlap > best_score:
                    best_score = overlap
                    best_match = row
            if best_match and best_score > 1:
                category = str(best_match.get("category", category))
                similar_pattern = str(best_match.get("pattern", similar_pattern))

        confidence = 55.0
        if risk_level == "MEDIUM":
            confidence = 68.0
        elif risk_level == "HIGH":
            confidence = 82.0
        elif risk_level == "CRITICAL":
            confidence = 92.0

        return {
            "scam_category": category,
            "similar_pattern": similar_pattern,
            "confidence_score": confidence,
        }

    def _recommended_action(self, risk_level: str, scam_category: str) -> str:
        if risk_level in {"HIGH", "CRITICAL"}:
            return "Do not click links or share details. Block sender and verify via official channel."
        if scam_category == "upi_scam":
            return "Never approve unknown UPI collect requests. Confirm with the sender directly."
        return "Proceed with caution and validate sender identity before taking action."

    def analyze(self, text: Optional[str] = None, url: Optional[str] = None) -> Dict[str, Any]:
        """Main analysis method combining all scoring layers."""
        combined_text = ""
        url_score = 0.0
        url_analysis_result = None

        if text:
            combined_text += text + " "

        if url:
            url_score, url_analysis_result = self._analyze_url(url)
            combined_text += url + " "

        combined_text = combined_text.strip()

        # Layer 1: Heuristic scoring
        heuristic_score, patterns = self._heuristic_score(combined_text)

        # Layer 2: ML model confidence
        model_conf = self._model_confidence(combined_text)

        # Layer 3: URL analysis (adds to heuristic)
        if url_score > 0:
            heuristic_score = min(100, heuristic_score + url_score * 0.5)

        # Final combined score
        if self._model_loaded:
            final_score = (0.4 * heuristic_score) + (0.6 * model_conf)
        else:
            # Heuristic-only mode
            final_score = heuristic_score

        final_score = min(100.0, final_score)
        risk_level = self._get_risk_level(final_score)
        explanation = self._build_explanation(final_score, patterns, risk_level)
        context = self._classify_scam_context(combined_text, patterns, risk_level)
        recommended_action = self._recommended_action(risk_level, context["scam_category"])

        return {
            "risk_score": round(final_score / 100.0, 2),
            "risk_level": risk_level,
            "explanation": explanation,
            "heuristic_score": round(heuristic_score, 2),
            "model_confidence": round(model_conf, 2),
            "reasoning": patterns + ([f"URL findings: {', '.join(url_analysis_result['findings'])}"] if url_analysis_result and url_analysis_result.get('findings') else []),
            "confidence": round(context.get("confidence_score", 0) / 100.0, 2),
            "url_analysis": url_analysis_result,
            "scam_category": context.get("scam_category", "unknown"),
            "similar_pattern": context.get("similar_pattern", ""),
            "recommended_action": recommended_action,
        }


