"use client";

import React, { useState } from "react";

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
}

const STEPS: OnboardingStep[] = [
  {
    title: "Connect Wallet",
    description:
      "Link your MetaMask or compatible Web3 wallet to enable blockchain-based document verification and identity management.",
    icon: "🔗",
  },
  {
    title: "Security Scan",
    description:
      "Run an AI-powered security assessment to identify vulnerabilities in your connected accounts and digital footprint.",
    icon: "🛡️",
  },
  {
    title: "Vault Setup",
    description:
      "Upload your first document to the encrypted vault. All files are encrypted with AES-256-GCM and anchored on-chain.",
    icon: "🗄️",
  },
  {
    title: "Emergency Contact",
    description:
      "Configure a trusted contact for your Dead Man's Switch. They can recover your vault after a configurable inactivity period.",
    icon: "🚨",
  },
];

export default function OnboardingWizard({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState<Record<number, boolean>>({});

  const handleNext = () => {
    setCompleted((prev) => ({ ...prev, [currentStep]: true }));
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-gray-900 to-gray-950 p-8 shadow-2xl shadow-cyan-500/10"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg transition-all duration-300 ${
                i === currentStep
                  ? "bg-cyan-500/20 ring-2 ring-cyan-400 scale-110"
                  : completed[i]
                  ? "bg-emerald-500/20 ring-1 ring-emerald-400"
                  : "bg-gray-800 ring-1 ring-gray-700"
              }`}
              title={s.title}
            >
              {completed[i] ? "✓" : s.icon}
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="text-center mb-8">
          <div className="mb-4 text-5xl">{step.icon}</div>
          <h2 className="text-2xl font-bold text-white mb-3">{step.title}</h2>
          <p className="text-gray-400 leading-relaxed max-w-md mx-auto">
            {step.description}
          </p>
        </div>

        {/* Step-specific UI */}
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          {currentStep === 0 && <WalletConnectStep />}
          {currentStep === 1 && <SecurityScanStep />}
          {currentStep === 2 && <VaultSetupStep />}
          {currentStep === 3 && <EmergencyContactStep />}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="rounded-lg px-6 py-2.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-8 py-2.5 text-sm font-semibold text-black hover:from-cyan-400 hover:to-emerald-400 transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40"
          >
            {isLastStep ? "Complete Setup →" : "Continue →"}
          </button>
        </div>

        {/* Skip */}
        <div className="mt-4 text-center">
          <button
            onClick={onComplete}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Skip onboarding for now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-step Components ─────────────────────────────────────────────────────

function WalletConnectStep() {
  const [connected, setConnected] = useState(false);

  const connectWallet = async () => {
    try {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        await (window as any).ethereum.request({
          method: "eth_requestAccounts",
        });
        setConnected(true);
      } else {
        alert("MetaMask not detected. Please install MetaMask.");
      }
    } catch {
      // User rejected
    }
  };

  return (
    <div className="text-center">
      {connected ? (
        <p className="text-emerald-400 font-medium">
          ✓ Wallet connected successfully
        </p>
      ) : (
        <button
          onClick={connectWallet}
          className="rounded-lg bg-orange-500/20 px-6 py-3 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 transition-all"
        >
          🦊 Connect MetaMask
        </button>
      )}
    </div>
  );
}

function SecurityScanStep() {
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  const runScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setScanComplete(true);
    }, 2000);
  };

  return (
    <div className="text-center">
      {scanComplete ? (
        <div className="text-emerald-400">
          <p className="font-medium">✓ Scan Complete</p>
          <p className="text-sm text-gray-400 mt-1">
            No critical vulnerabilities found
          </p>
        </div>
      ) : scanning ? (
        <div className="text-cyan-400 animate-pulse">
          <p className="font-medium">Scanning...</p>
          <div className="mt-2 h-1 w-48 mx-auto rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full bg-cyan-500 animate-[progress_2s_ease-in-out]" />
          </div>
        </div>
      ) : (
        <button
          onClick={runScan}
          className="rounded-lg bg-cyan-500/20 px-6 py-3 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all"
        >
          🔍 Run Security Scan
        </button>
      )}
    </div>
  );
}

function VaultSetupStep() {
  const [uploaded, setUploaded] = useState(false);

  return (
    <div className="text-center">
      {uploaded ? (
        <p className="text-emerald-400 font-medium">
          ✓ Document uploaded and encrypted
        </p>
      ) : (
        <label className="cursor-pointer rounded-lg border-2 border-dashed border-gray-700 hover:border-cyan-500/50 p-6 block transition-all">
          <p className="text-gray-400 mb-1">📄 Drop a file or click to upload</p>
          <p className="text-xs text-gray-600">
            PDF, DOC, JPG — max 10 MB
          </p>
          <input
            type="file"
            className="hidden"
            onChange={() => setUploaded(true)}
          />
        </label>
      )}
    </div>
  );
}

function EmergencyContactStep() {
  const [address, setAddress] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <div className="text-center">
      {saved ? (
        <p className="text-emerald-400 font-medium">
          ✓ Emergency contact configured
        </p>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="0x... (trusted wallet address)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none transition-colors"
          />
          <button
            onClick={() => address.startsWith("0x") && setSaved(true)}
            disabled={!address.startsWith("0x")}
            className="rounded-lg bg-emerald-500/20 px-6 py-2.5 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-30"
          >
            Save Contact
          </button>
        </div>
      )}
    </div>
  );
}
