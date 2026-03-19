"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Filler,
    Tooltip,
    Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { getDashboardStats, getRecentActivity, getCommunityStats } from "@/lib/api";
import { useWallet } from "@/context/WalletContext";
import { useAuth } from "@/context/AuthContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

const fetcher = async ([_key, walletAddress, userEmail]: [string, string | null, string | null]) =>
    getDashboardStats({ walletAddress: walletAddress || undefined, userEmail: userEmail || undefined, days: 30 });
const activityFetcher = async ([_key, walletAddress, userEmail]: [string, string | null, string | null]) =>
    getRecentActivity({ walletAddress: walletAddress || undefined, userEmail: userEmail || undefined, limit: 30 });

function statusBadge(status: string) {
    if (status === "Healthy") return "risk-badge-low";
    if (status === "Needs Setup") return "risk-badge-medium";
    return "risk-badge-high";
}

export default function UserDashboardPage() {
    const { walletAddress } = useWallet();
    const { userEmail, user, isAuthenticated, ensureAuth } = useAuth();

    const swrKey = isAuthenticated ? ["dashboard-stats", walletAddress || null, userEmail || null] : null;
    const feedKey = isAuthenticated ? ["dashboard-feed", walletAddress || null, userEmail || null] : null;

    const { data, error, isLoading, isValidating, mutate } = useSWR(swrKey, fetcher, {
        refreshInterval: 15000,
        revalidateOnFocus: true,
        refreshWhenHidden: true,
        dedupingInterval: 2000,
    });
    const { data: feedData, mutate: mutateFeed } = useSWR(
        feedKey,
        activityFetcher,
        { refreshInterval: 10000, revalidateOnFocus: true, refreshWhenHidden: true, dedupingInterval: 1000 },
    );
    const { data: communityData } = useSWR(["community-stats"], () => getCommunityStats(), {
        refreshInterval: 30000,
    });

    useEffect(() => {
        const onUpdated = () => mutate();
        const onWalletChanged = () => mutate();
        const onFeedUpdated = () => mutateFeed();
        window.addEventListener("lifevault:activity-updated", onUpdated);
        window.addEventListener("lifevault:activity-updated", onFeedUpdated);
        window.addEventListener("lifevault:tx-confirmed", onUpdated as EventListener);
        window.addEventListener("accountsChanged", onWalletChanged as EventListener);
        return () => {
            window.removeEventListener("lifevault:activity-updated", onUpdated);
            window.removeEventListener("lifevault:activity-updated", onFeedUpdated);
            window.removeEventListener("lifevault:tx-confirmed", onUpdated as EventListener);
            window.removeEventListener("accountsChanged", onWalletChanged as EventListener);
        };
    }, [mutate, mutateFeed]);

    const kpis = data?.kpis || {
        total_protected_assets: 0,
        risk_exposure_score: 0,
        suspicious_alerts_30d: 0,
        vault_health_status: "Unknown",
    };

    const riskTrend = data?.charts?.risk_trend || [];
    const vaultGrowth = data?.charts?.vault_growth || [];
    const alertFrequency = data?.charts?.alert_frequency || [];
    const distribution = data?.charts?.scam_probability_distribution || { low: 0, medium: 0, high: 0, critical: 0 };
    const activityFeed = (feedData?.events as any[]) || data?.activity_feed || [];
    const riskIntelligence = data?.risk_intelligence || { score: 0, category: "Low", explanation: "No data", suggested_actions: [] };
    const driftAlerts = data?.drift_alerts || [];
    const forecast = data?.risk_forecast_7d || { probability_high_risk_event: 0, confidence_interval: { low: 0, high: 0 }, series: [] };
    const generatedAt = data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "n/a";

    const lineData = useMemo(
        () => ({
            labels: riskTrend.map((x: any) => x.date),
            datasets: [
                {
                    label: "Risk score",
                    data: riskTrend.map((x: any) => x.score),
                    borderColor: "#0ea5e9",
                    backgroundColor: "rgba(14,165,233,0.15)",
                    tension: 0.25,
                    fill: true,
                },
            ],
        }),
        [riskTrend],
    );

    const areaData = useMemo(
        () => ({
            labels: vaultGrowth.map((x: any) => x.date),
            datasets: [
                {
                    label: "Protected assets",
                    data: vaultGrowth.map((x: any) => x.count),
                    borderColor: "#22c55e",
                    backgroundColor: "rgba(34,197,94,0.2)",
                    fill: true,
                    tension: 0.3,
                },
            ],
        }),
        [vaultGrowth],
    );

    const distributionData = {
        labels: ["Low", "Medium", "High", "Critical"],
        datasets: [
            {
                label: "Scam checks",
                data: [distribution.low, distribution.medium, distribution.high, distribution.critical],
                backgroundColor: ["#22c55e", "#f59e0b", "#f97316", "#ef4444"],
            },
        ],
    };

    const alertsData = {
        labels: alertFrequency.map((x: any) => x.date),
        datasets: [
            {
                label: "Alert count",
                data: alertFrequency.map((x: any) => x.count),
                borderColor: "#ef4444",
                backgroundColor: "rgba(239,68,68,0.2)",
                fill: true,
                tension: 0.25,
            },
        ],
    };

    const forecastData = {
        labels: (forecast.series || []).map((x: any) => x.date),
        datasets: [
            {
                label: "Predicted risk",
                data: (forecast.series || []).map((x: any) => x.predicted_risk),
                borderColor: "#a855f7",
                backgroundColor: "rgba(168,85,247,0.2)",
                tension: 0.3,
                fill: true,
            },
        ],
    };

    if (!isAuthenticated) {
        return (
            <div className="glass-card p-10 text-center space-y-6">
                <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#1e3a52] flex items-center justify-center border border-cyan-500/30">
                        <span className="text-2xl">🔒</span>
                    </div>
                </div>
                <div className="space-y-2">
                    <p className="text-xl font-semibold text-white">Dashboard Access Restricted</p>
                    <p className="text-sm text-slate-400">Please sign in to view your protection metrics and security intelligence.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={ensureAuth} // Assuming ensureAuth is the correct handler for "Sign In for Demo"
                        className="btn-primary px-8 py-3" 
                    >
                        Sign In for Demo
                    </button>
                    <a 
                        href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/activity/export?format=csv`}
                        target="_blank"
                        className="btn-primary flex items-center gap-2"
                    >
                        Export Audit Log (CSV)
                    </a>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return <div className="glass-card p-6 text-sm text-slate-400">Loading dashboard intelligence...</div>;
    }

    if (error) {
        return <div className="glass-card p-6 text-sm text-red-300">Unable to load dashboard data. Please retry.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="hero-panel p-7">
                <div className="relative z-10">
                    <h2 className="text-3xl font-semibold text-white">Executive Risk Overview</h2>
                    <p className="text-sm text-slate-300 mt-2 max-w-2xl">Live protection metrics, intelligence signals, and actionable guidance for your digital safety.</p>
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                        <span className="risk-badge-low">Live</span>
                        <span className="text-xs text-slate-400">Last refresh: {generatedAt}</span>
                        
                        {user?.tier !== "free" && (
                            <button
                                onClick={async () => {
                                    const { getMonthlyReport } = await import("@/lib/api");
                                    const report = await getMonthlyReport();
                                    alert(report.content); // Simplified for now, would open a modal/PDF in prod
                                }}
                                className="bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-xs px-4 py-2 rounded-lg border border-teal-500/30 transition-all font-semibold"
                            >
                                📊 Generate Monthly Report
                            </button>
                        )}

                        <button
                            className="btn-ghost text-xs"
                            onClick={() => {
                                mutate();
                                mutateFeed();
                            }}
                            disabled={isValidating}
                        >
                            {isValidating ? "Refreshing..." : "Refresh Now"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="metric-card"><div className="text-xs text-slate-500">Total Protected Assets</div><div className="text-3xl font-bold text-cyan-300 mt-1">{kpis.total_protected_assets}</div><div className="text-[11px] text-slate-500 mt-2">Stored and secured locally</div></div>
                <div className="metric-card"><div className="text-xs text-slate-500">Community Threats Blocked</div><div className="text-3xl font-bold text-teal-400 mt-1">{communityData?.confirmedCount || 0}</div><div className="text-[11px] text-slate-500 mt-2">Global proactive protection</div></div>
                <div className="metric-card"><div className="text-xs text-slate-500">Risk Exposure Score</div><div className="text-3xl font-bold text-amber-300 mt-1">{kpis.risk_exposure_score}</div><div className="text-[11px] text-slate-500 mt-2">Composite risk intelligence</div></div>
                <div className="metric-card"><div className="text-xs text-slate-500">Suspicious Alerts (30d)</div><div className="text-3xl font-bold text-rose-300 mt-1">{kpis.suspicious_alerts_30d}</div><div className="text-[11px] text-slate-500 mt-2">Watchlist and scam detections</div></div>
                <div className="metric-card"><div className="text-xs text-slate-500">Vault Health Status</div><div className="mt-3"><span className={statusBadge(kpis.vault_health_status)}>{kpis.vault_health_status}</span></div><div className="text-[11px] text-slate-500 mt-3">Readiness snapshot</div></div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                <div className="chart-card">
                    <h3 className="section-title mb-3">Risk Trend Over Time</h3>
                    <div className="h-56"><Line data={lineData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
                </div>
                <div className="chart-card">
                    <h3 className="section-title mb-3">Scam Probability Distribution</h3>
                    <div className="h-56"><Bar data={distributionData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
                </div>
                <div className="chart-card">
                    <h3 className="section-title mb-3">Vault Growth</h3>
                    <div className="h-56"><Line data={areaData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
                </div>
                <div className="chart-card">
                    <h3 className="section-title mb-3">Alert Frequency</h3>
                    <div className="h-56"><Line data={alertsData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                <div className="chart-card">
                    <h3 className="section-title mb-3">Risk Intelligence Engine</h3>
                    <p className="text-sm text-slate-300">{riskIntelligence.explanation}</p>
                    <div className="mt-3 text-xs text-slate-400">Category: <span className="text-white">{riskIntelligence.category}</span></div>
                    <div className="mt-2 space-y-1">
                        {(riskIntelligence.suggested_actions || []).map((action: string, idx: number) => (
                            <div key={idx} className="text-xs text-slate-400">- {action}</div>
                        ))}
                    </div>
                    {driftAlerts.length > 0 && (
                        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                            Behavioral drift alerts: {driftAlerts.map((x: any) => x.type).join(", ")}
                        </div>
                    )}
                </div>

                <div className="chart-card">
                    <h3 className="section-title mb-3">Live Activity Feed</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {activityFeed.length === 0 ? (
                            <p className="text-sm text-slate-500">No recent activity available.</p>
                        ) : (
                            activityFeed.map((item: any) => (
                                <div key={item.id} className="p-3 rounded-xl border border-[#1e3a52] bg-[#0f172a]/75">
                                    <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                                    <div className="text-sm text-white capitalize">{String(item.type).replaceAll("_", " ")}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="chart-card">
                <h3 className="section-title mb-3">Digital Risk Forecast (Next 7 Days)</h3>
                <p className="text-xs text-slate-400 mb-3">
                    Probability of high-risk event: {Number(forecast.probability_high_risk_event || 0).toFixed(1)}%
                    {" "}({Number(forecast.confidence_interval?.low || 0).toFixed(1)} - {Number(forecast.confidence_interval?.high || 0).toFixed(1)} confidence band)
                </p>
                <div className="h-52"><Line data={forecastData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
            </div>
        </div>
    );
}
