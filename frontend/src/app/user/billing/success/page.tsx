"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function BillingSuccessPage() {
    useEffect(() => {
        // In a real app, we might poll the backend to verify the session
        // and update local state
    }, []);

    return (
        <div className="max-w-2xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
            <div className="w-20 h-20 bg-teal-500/20 text-teal-400 rounded-full flex items-center justify-center text-4xl mb-8 animate-pulse">
                ✓
            </div>
            
            <h1 className="text-4xl font-bold text-white mb-4">Subscription Activated</h1>
            <p className="text-slate-400 text-lg mb-8">
                Welcome to Guardian Pro. Your real-time AI protection is now active across all connected devices and your browser extension.
            </p>

            <div className="grid grid-cols-2 gap-4 w-full">
                <Link href="/user/dashboard" className="btn-primary py-3">
                    Go to Dashboard
                </Link>
                <Link href="/user/vault" className="btn-ghost py-3">
                    Configure Vault
                </Link>
            </div>

            <p className="mt-12 text-xs text-slate-500">
                A confirmation email with your invoice has been sent. 
                You can manage your subscription anytime in the Settings.
            </p>
        </div>
    );
}
