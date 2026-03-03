"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { logActivity, uploadTransactions } from "@/lib/api";
import { appendAuditLog, appendTxHistory } from "@/lib/localData";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

interface TransactionResult {
    date: string;
    description: string;
    amount: number;
    merchant: string;
    is_anomaly: boolean;
    anomaly_score: number;
    risk_level: string;
    reasons: string[];
}

interface AnalysisResponse {
    results: TransactionResult[];
    total_transactions: number;
    flagged_count: number;
    overall_risk_score: number;
    summary: string;
}

export default function TransactionMonitor() {
    const [loading, setLoading] = useState(false);
    const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        if (!file.name.toLowerCase().endsWith(".csv")) {
            toast.error("Please upload a CSV file.");
            return;
        }

        setFileName(file.name);
        setLoading(true);
        setAnalysisData(null);

        try {
            const data = (await uploadTransactions(file)) as AnalysisResponse;
            setAnalysisData(data);
            appendTxHistory({
                fileName: file.name,
                total: data.total_transactions,
                flagged: data.flagged_count,
                risk: data.overall_risk_score,
            });
            appendAuditLog({
                type: "scam_scan",
                message: "Transaction monitor processed uploaded CSV",
                metadata: { total: data.total_transactions, flagged: data.flagged_count },
            });
            await logActivity({
                type: "transaction_analyzed",
                riskScore: data.overall_risk_score,
                metadata: {
                    fileName: file.name,
                    total: data.total_transactions,
                    flagged: data.flagged_count,
                    overallRisk: data.overall_risk_score,
                },
            });
            toast.success(`Checked ${data.total_transactions} actions.`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Analysis failed";
            if (msg.includes("AI service")) {
                toast.error("Transaction AI service is offline. Start local AI service on port 8000.");
            } else {
                toast.error(msg.replace("User rejected", "Action canceled"));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    };

    const chartData = analysisData
        ? {
            labels: analysisData.results.map((r) => r.date),
            datasets: [
                {
                    label: "Amount",
                    data: analysisData.results.map((r) => r.amount),
                    backgroundColor: analysisData.results.map((r) =>
                        r.is_anomaly ? "rgba(239,68,68,0.8)" : "rgba(14,165,233,0.5)",
                    ),
                },
            ],
        }
        : null;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="glass-card p-6">
                <h2 className="text-base font-semibold text-white mb-4">Transaction Activity Check</h2>
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300"
                    style={{ borderColor: dragOver ? "#0ea5e9" : "#1e3a52" }}
                >
                    <input
                        ref={fileInputRef}
                        id="csv-file-input"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                    {loading ? (
                        <div className="text-sm text-slate-300">Checking uploaded file...</div>
                    ) : (
                        <>
                            <div className="text-sm text-slate-300">
                                {fileName ? `${fileName} selected` : "Drop CSV file here or click to browse"}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">Columns: date, description, amount, merchant, category</div>
                        </>
                    )}
                </div>
            </div>

            {analysisData && (
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="glass-card p-4 text-center">
                            <div className="text-2xl font-bold text-primary-400">{analysisData.total_transactions}</div>
                            <div className="text-xs text-slate-500">Total Actions</div>
                        </div>
                        <div className="glass-card p-4 text-center">
                            <div className="text-2xl font-bold text-danger-400">{analysisData.flagged_count}</div>
                            <div className="text-xs text-slate-500">Flagged</div>
                        </div>
                        <div className="glass-card p-4 text-center">
                            <div className="text-2xl font-bold text-warning-400">{analysisData.overall_risk_score.toFixed(0)}%</div>
                            <div className="text-xs text-slate-500">Risk Score</div>
                        </div>
                    </div>

                    {chartData && (
                        <div className="glass-card p-6">
                            <h3 className="text-sm font-semibold text-white mb-4">Timeline</h3>
                            <div className="h-56">
                                <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
                            </div>
                        </div>
                    )}

                    <div className="glass-card p-6">
                        <h3 className="text-sm font-semibold text-white mb-4">Details</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-slate-500 border-b border-[#1e3a52]/50">
                                        <th className="text-left pb-3">Date</th>
                                        <th className="text-left pb-3">Description</th>
                                        <th className="text-right pb-3">Amount</th>
                                        <th className="text-left pb-3">Merchant</th>
                                        <th className="text-center pb-3">Risk</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analysisData.results.map((tx, i) => (
                                        <tr key={i} className="border-b border-[#1e3a52]/30">
                                            <td className="py-2 text-slate-400">{tx.date}</td>
                                            <td className="py-2 text-slate-300">{tx.description}</td>
                                            <td className="py-2 text-right text-slate-200">${tx.amount.toLocaleString()}</td>
                                            <td className="py-2 text-slate-400">{tx.merchant}</td>
                                            <td className="py-2 text-center">
                                                <span className={tx.is_anomaly ? "risk-badge-high" : "risk-badge-low"}>{tx.is_anomaly ? tx.risk_level : "LOW"}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
