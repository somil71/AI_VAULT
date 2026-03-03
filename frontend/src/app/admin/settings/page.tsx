"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export default function AdminSettingsPage() {
    const [password, setPassword] = useState(process.env.NEXT_PUBLIC_ADMIN_DEMO_PASSWORD || "admin123");

    return (
        <div className="space-y-6">
            <div className="glass-card p-6">
                <h2 className="text-xl font-semibold text-white">Admin Settings</h2>
                <p className="text-sm text-slate-400">Local demo controls only.</p>
            </div>

            <div className="glass-card p-5 space-y-3 max-w-xl">
                <label className="text-xs text-slate-500">Demo Admin Password</label>
                <input className="input-dark" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button
                    className="btn-primary"
                    onClick={() => {
                        localStorage.setItem("lifevault_admin_demo_password", password);
                        toast.success("Saved locally for this browser session.");
                    }}
                >
                    Save Local Setting
                </button>
                <p className="text-xs text-slate-500">Note: unlock uses env `NEXT_PUBLIC_ADMIN_DEMO_PASSWORD` first, then default `admin123`.</p>
            </div>
        </div>
    );
}
