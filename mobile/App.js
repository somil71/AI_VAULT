import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, StatusBar } from 'react-native';
import { Shield, Lock, Bell, Users, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import axios from 'axios';

// Backend configuration (using local IP or tunnel for physical device)
const API_BASE = "http://localhost:3000/api/v1"; 

export default function App() {
  const [url, setUrl] = React.useState("");
  const [scanning, setScanning] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const handleScan = async () => {
    if (!url) return;
    setScanning(true);
    setResult(null);
    try {
      // Phase 5: Mobile Guard Integration
      const response = await axios.post(`${API_BASE}/threat-detection/analyze`, { url });
      setResult(response.data.data);
    } catch (error) {
      console.error("Scan failed", error);
    } finally {
      setScanning(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>LifeVault AI</Text>
          <View style={styles.liveBadge}>
            <View style={styles.pulse} />
            <Text style={styles.liveText}>PROTECTED</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Mobile Guardian Active</Text>
      </View>

      <View style={styles.scannerSection}>
        <View style={styles.inputContainer}>
          <Shield color="#0ea5e9" size={20} style={styles.inputIcon} />
          <Text style={styles.inputLabel}>Scan suspicious link</Text>
          <View style={styles.scanRow}>
            <View style={styles.inputWrapper}>
               <Text style={styles.inputText}>{url || "https://..."}</Text>
            </View>
            <TouchableOpacity 
              style={styles.scanBtn} 
              onPress={handleScan}
              disabled={scanning}
            >
              <Text style={styles.scanBtnText}>{scanning ? "..." : "SCAN"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {result && (
          <View style={[styles.resultCard, result.score > 0.7 && styles.resultCardHigh]}>
            {result.score > 0.7 ? (
               <AlertTriangle color="#f43f5e" size={24} />
            ) : (
               <CheckCircle2 color="#10b981" size={24} />
            )}
            <View style={styles.resultTextContainer}>
              <Text style={styles.resultTitle}>{result.score > 0.7 ? "Malicious Link Detected" : "Link Appears Safe"}</Text>
              <Text style={styles.resultDesc}>AI Confidence: {(result.score * 100).toFixed(0)}%</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.card}>
          <Lock color="#a855f7" size={24} />
          <Text style={styles.cardTitle}>My Vaults</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card}>
          <Bell color="#f43f5e" size={24} />
          <Text style={styles.cardTitle}>Live Alerts</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card}>
          <Users color="#10b981" size={24} />
          <Text style={styles.cardTitle}>Team Access</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.card}>
          <Activity color="#0ea5e9" size={24} />
          <Text style={styles.cardTitle}>Analytics</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.loginBtn}>
          <Text style={styles.loginBtnText}>Sync Account Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050a14',
  },
  header: {
    padding: 24,
    paddingTop: 40,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,211,238,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.2)',
  },
  pulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22d3ee',
    marginRight: 6,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#22d3ee',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  scannerSection: {
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  inputContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  inputIcon: {
    marginBottom: 8,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
  },
  inputText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  scanBtn: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  scanBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  resultCard: {
    marginTop: 16,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultCardHigh: {
    backgroundColor: 'rgba(244,63,94,0.1)',
    borderColor: 'rgba(244,63,94,0.2)',
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  resultDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  card: {
    width: '47%',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardTitle: {
    color: '#e2e8f0',
    marginTop: 12,
    fontWeight: '600',
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: 24,
    marginTop: 'auto',
    marginBottom: 30,
  },
  loginBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  loginBtnText: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
