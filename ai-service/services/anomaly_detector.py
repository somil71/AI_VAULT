"""
Transaction Anomaly Detector
============================
Uses scikit-learn's Isolation Forest algorithm to detect unusual transactions.

Feature Engineering:
  - amount (normalized)
  - log_amount (to handle skewed distributions)
  - merchant_novelty (is this a new/rare merchant?)
  - time_of_day_encoded (encoded hour)
  - category_encoded (categorical label encoding)

Isolation Forest:
  - Unsupervised anomaly detection
  - Works by isolating observations using random trees
  - Anomalies require fewer splits → get lower anomaly scores
  - contamination=0.1 means ~10% of transactions expected to be anomalous
"""

import re
import numpy as np
from typing import List, Dict, Any
from collections import Counter

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    _SKLEARN_AVAILABLE = True
except ImportError:
    _SKLEARN_AVAILABLE = False

class AnomalyDetector:
    """
    Isolation Forest-based transaction anomaly detection engine.
    """

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler() if _SKLEARN_AVAILABLE else None

    def _engineer_features(self, transactions: List[Dict]) -> tuple:
        """
        Convert raw transaction list into ML-ready feature matrix.

        Features:
          [0] amount           – Raw transaction amount
          [1] log_amount       – Log-transformed amount (handles large outliers)
          [2] merchant_freq    – How often this merchant appears (rarity score)
          [3] category_encoded – Integer encoding of category
          [4] is_round_amount  – Round amounts (e.g., $200.00) can be suspicious
        """
        amounts = np.array([t["amount"] for t in transactions], dtype=float)

        # Merchant frequency (novelty = 1/frequency)
        merchant_counts = Counter(t["merchant"] for t in transactions)
        total = len(transactions)
        merchant_freq = np.array([
            merchant_counts[t["merchant"]] / total for t in transactions
        ])

        # Category encoding
        categories = list(set(t.get("category", "Unknown") for t in transactions))
        cat_map = {c: i for i, c in enumerate(categories)}
        cat_encoded = np.array([
            cat_map.get(t.get("category", "Unknown"), 0) for t in transactions
        ], dtype=float)

        # Log amount (add 1 to handle 0)
        log_amounts = np.log1p(amounts)

        # Round amount flag (exactly divisible by 100 or 500)
        is_round = np.array([
            1.0 if (t["amount"] % 100 == 0 or t["amount"] % 500 == 0) and t["amount"] > 0
            else 0.0
            for t in transactions
        ])

        features = np.column_stack([
            amounts,
            log_amounts,
            merchant_freq,
            cat_encoded,
            is_round,
        ])

        return features, merchant_counts, total

    def _get_anomaly_reasons(
        self,
        transaction: Dict,
        score: float,
        amounts: np.ndarray,
        merchant_counts: Counter,
        total: int,
    ) -> List[str]:
        """Generate human-readable reasons why a transaction is anomalous."""
        reasons = []
        amount = transaction["amount"]
        merchant = transaction["merchant"]
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)

        # Unusually high amount (> 2 standard deviations above mean)
        if amount > mean_amount + 2 * std_amount:
            reasons.append(
                f"Amount (${amount:.2f}) is {((amount - mean_amount) / max(std_amount, 1)):.1f}× above average"
            )

        # New or very rare merchant
        freq = merchant_counts[merchant] / total
        if freq < 0.1:
            reasons.append(f"Unusual merchant: '{merchant}' (only {merchant_counts[merchant]} transaction(s))")

        # Round amount + high value (cash-out pattern)
        if amount >= 500 and amount % 100 == 0:
            reasons.append(f"Suspicious round amount: ${amount:.0f}")

        # Very high absolute amount
        if amount >= 5000:
            reasons.append(f"Very large transfer: ${amount:,.2f}")
        elif amount >= 1000:
            reasons.append(f"Large transaction: ${amount:,.2f}")

        # Unknown/suspicious merchant keywords
        suspicious_keywords = ["offshore", "unknown", "suspicious", "crypto", "wire", "transfer", "atm"]
        desc_lower = transaction.get("description", "").lower()
        merch_lower = merchant.lower()
        for kw in suspicious_keywords:
            if kw in desc_lower or kw in merch_lower:
                reasons.append(f"Suspicious keyword detected: '{kw}'")
                break

        if not reasons:
            reasons.append("Statistical outlier detected by Isolation Forest model")

        return reasons

    def _get_risk_level(self, score: float) -> str:
        """Map anomaly score to risk level."""
        if score < 0.3:
            return "CRITICAL"
        elif score < 0.5:
            return "HIGH"
        elif score < 0.7:
            return "MEDIUM"
        else:
            return "LOW"

    def analyze(self, transactions: List[Dict]) -> Dict[str, Any]:
        """
        Run full anomaly detection pipeline.
        Returns structured results with per-transaction risk assessment.
        """
        if not _SKLEARN_AVAILABLE:
            # Fallback: heuristic-only detection
            return self._heuristic_fallback(transactions)

        features, merchant_counts, total = self._engineer_features(transactions)

        # Scale features
        features_scaled = self.scaler.fit_transform(features)

        # Train Isolation Forest
        # contamination: expected fraction of outliers (~10%)
        isolation_forest = IsolationForest(
            n_estimators=100,
            contamination=0.1,
            random_state=42,
            n_jobs=-1,
        )
        isolation_forest.fit(features_scaled)

        # Get anomaly scores (-1 = outlier, 1 = inlier)
        predictions = isolation_forest.predict(features_scaled)
        # decision_function returns negative scores; more negative = more anomalous
        raw_scores = isolation_forest.decision_function(features_scaled)

        # Normalize scores to 0–1 range (0 = most anomalous, 1 = most normal)
        min_score, max_score = raw_scores.min(), raw_scores.max()
        score_range = max_score - min_score if max_score != min_score else 1
        normalized_scores = (raw_scores - min_score) / score_range

        amounts = features[:, 0]

        results = []
        flagged_count = 0

        for i, (transaction, pred, norm_score) in enumerate(
            zip(transactions, predictions, normalized_scores)
        ):
            is_anomaly = bool(pred == -1)

            if is_anomaly:
                flagged_count += 1
                reasons = self._get_anomaly_reasons(
                    transaction, norm_score, amounts, merchant_counts, total
                )
            else:
                reasons = []

            results.append({
                "index": i,
                "date": transaction["date"],
                "description": transaction["description"],
                "amount": transaction["amount"],
                "merchant": transaction["merchant"],
                "is_anomaly": is_anomaly,
                "anomaly_score": round(float(1 - norm_score) * 100, 2),  # higher = more anomalous
                "risk_level": self._get_risk_level(float(norm_score)) if is_anomaly else "LOW",
                "reasons": reasons,
            })

        # Overall risk score (average anomaly score of flagged transactions)
        flagged_scores = [r["anomaly_score"] for r in results if r["is_anomaly"]]
        overall_risk = np.mean(flagged_scores) if flagged_scores else 0.0

        if flagged_count == 0:
            summary = "No anomalous transactions detected. Your statement looks normal."
        elif flagged_count <= 2:
            summary = f"{flagged_count} suspicious transaction(s) found. Review flagged items carefully."
        else:
            summary = f"⚠️ {flagged_count} anomalous transactions detected! Immediate review recommended."

        all_reasons = []
        for r in results:
            if r["is_anomaly"]:
                all_reasons.extend(r["reasons"])
        top_triggers = [item for item, _ in Counter(all_reasons).most_common(3)]

        top_risk_level = "LOW"
        if flagged_count > 0:
            top_risk_level = max([r["risk_level"] for r in results if r["is_anomaly"]], key=lambda x: {"LOW":0, "MEDIUM":1, "HIGH":2, "CRITICAL":3}[x])

        return {
            "anomaly_score": round(float(raw_scores.min()) if _SKLEARN_AVAILABLE else 0.0, 4),
            "risk_category": top_risk_level,
            "trigger_factors": top_triggers,
            "results": results,
            "total_transactions": len(transactions),
            "flagged_count": flagged_count,
            "overall_risk_score": round(float(overall_risk), 2),
            "summary": summary,
        }

    def _heuristic_fallback(self, transactions: List[Dict]) -> Dict[str, Any]:
        """Simple heuristic detection when sklearn is unavailable."""
        amounts = [t["amount"] for t in transactions]
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)

        results = []
        flagged_count = 0
        suspicious_keywords = ["offshore", "unknown", "crypto", "wire", "suspicious"]

        for i, t in enumerate(transactions):
            is_anomaly = False
            reasons = []

            if t["amount"] > mean_amount + 2 * std_amount:
                is_anomaly = True
                reasons.append(f"Amount ${t['amount']:.2f} significantly above average")

            for kw in suspicious_keywords:
                if kw in t["description"].lower() or kw in t["merchant"].lower():
                    is_anomaly = True
                    reasons.append(f"Suspicious keyword: '{kw}'")
                    break

            if is_anomaly:
                flagged_count += 1

            results.append({
                "index": i, "date": t["date"], "description": t["description"],
                "amount": t["amount"], "merchant": t["merchant"],
                "is_anomaly": is_anomaly,
                "anomaly_score": 75.0 if is_anomaly else 10.0,
                "risk_level": "HIGH" if is_anomaly else "LOW",
                "reasons": reasons,
            })

        all_reasons = []
        for r in results:
            if r["is_anomaly"]:
                all_reasons.extend(r["reasons"])
        top_triggers = [item for item, _ in Counter(all_reasons).most_common(3)]

        return {
            "anomaly_score": -0.5, # Static fallback score
            "risk_category": "MEDIUM" if flagged_count > 0 else "LOW",
            "trigger_factors": top_triggers,
            "results": results, "total_transactions": len(transactions),
            "flagged_count": flagged_count, "overall_risk_score": 50.0 if flagged_count > 0 else 0.0,
            "summary": f"{flagged_count} suspicious transaction(s) found (heuristic mode).",
        }

