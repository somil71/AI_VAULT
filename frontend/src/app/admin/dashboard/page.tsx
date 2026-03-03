"use client";

import { useEffect } from "react";
import useSWR from "swr";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { getAdminStats } from "@/lib/api";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

const fetcher = async () => getAdminStats();

export default function AdminDashboardPage() {
    const { data, isLoading, error, mutate } = useSWR("admin-stats", fetcher, { refreshInterval: 15000, revalidateOnFocus: true });

    useEffect(() => {
        const onUpdated = () => mutate();
        window.addEventListener("lifevault:activity-updated", onUpdated);
        return () => window.removeEventListener("lifevault:activity-updated", onUpdated);
    }, [mutate]);

    if (isLoading) {
        return <div className="glass-card p-6 text-sm text-slate-400">Loading admin analytics...</div>;
    }

    if (error) {
        return <div className="glass-card p-6 text-sm text-red-300">Unable to load admin analytics.</div>;
    }

    const heatmap = data?.risk_heatmap || [];
    const topCategories = data?.top_scam_categories || [];

    const trendData = {
        labels: (data?.ai_performance_trend || []).map((x: any) => x.date),
        datasets: [{ label: "AI Performance", data: (data?.ai_performance_trend || []).map((x: any) => x.score), borderColor: "#0ea5e9", tension: 0.3 }],
    };

    const categoryData = {
        labels: topCategories.map((x: any) => x.category),
        datasets: [{ label: "Scam categories", data: topCategories.map((x: any) => x.count), backgroundColor: "rgba(14,165,233,0.6)" }],
    };

    const healthClass = data?.model_health_indicator === "healthy" ? "risk-badge-low" : "risk-badge-high";

    return (
        <div className="space-y-6">
            <div className="hero-panel p-7">
                <div className="relative z-10">
                    <h2 className="text-3xl font-semibold text-white">Platform Intelligence Dashboard</h2>
                    <p className="text-sm text-slate-300 mt-2">Unified operations view across model performance, risk distribution, and user safety posture.</p>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="metric-card"><div className="text-xs text-slate-500">Fraud Detection Accuracy</div><div className="text-3xl font-bold text-cyan-300 mt-1">{data?.fraud_detection_accuracy_rate || 0}%</div><div className="text-[11px] text-slate-500 mt-2">Inference confidence baseline</div></div>
                <div className="metric-card"><div className="text-xs text-slate-500">Average User Risk Score</div><div className="text-3xl font-bold text-amber-300 mt-1">{data?.average_user_risk_score || 0}</div><div className="text-[11px] text-slate-500 mt-2">30-day aggregate risk profile</div></div>
                <div className="metric-card"><div className="text-xs text-slate-500">Model Health Indicator</div><div className="mt-3"><span className={healthClass}>{data?.model_health_indicator || "unknown"}</span></div><div className="text-[11px] text-slate-500 mt-3">Realtime quality monitor</div></div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                <div className="chart-card">
                    <h3 className="section-title mb-3">Top 10 Scam Categories</h3>
                    <div className="h-64"><Bar data={categoryData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
                </div>
                <div className="chart-card">
                    <h3 className="section-title mb-3">AI Performance Trend</h3>
                    <div className="h-64"><Line data={trendData} options={{ responsive: true, maintainAspectRatio: false }} /></div>
                </div>
            </div>

            <div className="chart-card">
                <h3 className="section-title mb-3">Platform-Wide Risk Heatmap</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {heatmap.length === 0 ? (
                        <p className="text-sm text-slate-500">No risk points yet.</p>
                    ) : (
                        heatmap.map((point: any) => {
                            const intensity = Math.min(1, Number(point.score || 0) / 100);
                            return (
                                <div key={point.date} className="rounded-lg p-2 text-xs border border-[#1e3a52]" style={{ backgroundColor: `rgba(239,68,68,${0.12 + intensity * 0.58})` }}>
                                    <div className="text-slate-200">{point.date.slice(5)}</div>
                                    <div className="text-white font-semibold">{Number(point.score || 0).toFixed(1)}</div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
