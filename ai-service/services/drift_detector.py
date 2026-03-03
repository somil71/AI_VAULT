from typing import Dict, Any, List

import numpy as np
from sklearn.ensemble import IsolationForest


class DriftDetector:
    """Detects behavioral drift from recent risk and activity signals."""

    def __init__(self):
        self.model = IsolationForest(
            n_estimators=120,
            contamination=0.12,
            random_state=42,
        )

    def _series_to_matrix(self, series: List[float]) -> np.ndarray:
        if not series:
            return np.empty((0, 3))
        arr = np.array(series, dtype=float)
        indexes = np.arange(len(arr), dtype=float)
        rolling = np.array([arr[max(0, i - 2): i + 1].mean() for i in range(len(arr))])
        return np.column_stack([arr, indexes, rolling])

    def detect(self, scam_probabilities: List[float], anomaly_scores: List[float], vault_activity_daily: List[float]) -> Dict[str, Any]:
        scam_matrix = self._series_to_matrix(scam_probabilities)
        anomaly_matrix = self._series_to_matrix(anomaly_scores)
        vault_matrix = self._series_to_matrix(vault_activity_daily)

        alerts = []

        for name, matrix in [
            ("scam_probability_spike", scam_matrix),
            ("anomaly_score_spike", anomaly_matrix),
            ("vault_activity_spike", vault_matrix),
        ]:
            if len(matrix) < 8:
                continue
            preds = self.model.fit_predict(matrix)
            outlier_indexes = np.where(preds == -1)[0]
            if outlier_indexes.size > 0:
                alerts.append({
                    "type": name,
                    "count": int(outlier_indexes.size),
                    "latest_index": int(outlier_indexes[-1]),
                })

        status = "stable" if len(alerts) == 0 else "drift_detected"
        return {
            "status": status,
            "alerts": alerts,
        }

