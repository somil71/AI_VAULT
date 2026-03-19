import numpy as np
from scipy.stats import ks_2samp

class DriftMonitor:
    """
    Model Drift Detection System
    Monitors data distribution changes using Kolmogorov-Smirnov (KS) tests.
    """
    
    def __init__(self, baseline_data=None):
        self.baseline_data = baseline_data
        self.last_check = None

    def check_drift(self, current_data):
        """
        Compare current input distribution to baseline.
        Returns drift_detected: bool, p_value: float
        """
        if self.baseline_data is None:
            return {"drift_detected": False, "p_value": 1.0, "message": "No baseline loaded"}

        # Simplified KS test on one key feature (e.g. risk scores)
        statistic, p_value = ks_2samp(self.baseline_data, current_data)
        
        drift_detected = p_value < 0.05
        return {
            "drift_detected": drift_detected,
            "p_value": round(p_value, 4),
            "statistic": round(statistic, 4),
            "message": "Drift detected! Retraining recommended." if drift_detected else "Distributions stable."
        }

def get_drift_monitor():
    # In production, load baseline metrics from disk/registry
    baseline = np.random.normal(0.2, 0.1, 1000) # Dummy baseline
    return DriftMonitor(baseline)
