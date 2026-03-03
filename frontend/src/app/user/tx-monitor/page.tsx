import TransactionMonitor from "@/components/TransactionMonitor";

export default function UserTxMonitorPage() {
    return (
        <div className="space-y-4">
            <div className="glass-card p-5">
                <h2 className="text-lg font-semibold text-white">Transaction Anomaly Monitor</h2>
                <p className="text-sm text-slate-400">Upload activity history to spot unusual patterns.</p>
            </div>
            <TransactionMonitor />
        </div>
    );
}
