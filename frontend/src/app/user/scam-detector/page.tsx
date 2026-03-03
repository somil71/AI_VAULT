import ScamDetector from "@/components/ScamDetector";

export default function UserScamDetectorPage() {
    return (
        <div className="space-y-4">
            <div className="glass-card p-5">
                <h2 className="text-lg font-semibold text-white">Scam Protection</h2>
                <p className="text-sm text-slate-400">Check suspicious messages and links before taking action.</p>
            </div>
            <ScamDetector />
        </div>
    );
}
