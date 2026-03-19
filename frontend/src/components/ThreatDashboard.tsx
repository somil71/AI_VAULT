"use client";

import React, { useState, useEffect } from "react";

interface ThreatFeedItem {
  id: string;
  type: "url" | "text" | "transaction";
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  score: number;
  summary: string;
  timestamp: string;
  action: string;
}

interface DashboardMetrics {
  threatsBlocked: number;
  urlsAnalyzed: number;
  transactionsScanned: number;
  avgResponseMs: number;
}

const LEVEL_COLORS: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
  HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  LOW: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
};

const TYPE_ICONS: Record<string, string> = {
  url: "🔗",
  text: "📧",
  transaction: "💳",
};

export default function ThreatDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    threatsBlocked: 0,
    urlsAnalyzed: 0,
    transactionsScanned: 0,
    avgResponseMs: 0,
  });
  const [feed, setFeed] = useState<ThreatFeedItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  useEffect(() => {
    // Simulate live data — replace with actual API calls in production
    setMetrics({
      threatsBlocked: 47,
      urlsAnalyzed: 1234,
      transactionsScanned: 567,
      avgResponseMs: 42,
    });

    setFeed([
      {
        id: "1",
        type: "url",
        level: "CRITICAL",
        score: 0.95,
        summary: "Phishing URL imitating PayPal detected and blocked",
        timestamp: new Date(Date.now() - 300000).toISOString(),
        action: "BLOCK",
      },
      {
        id: "2",
        type: "text",
        level: "HIGH",
        score: 0.78,
        summary: 'Suspicious email with urgency markers: "verify now"',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        action: "WARN",
      },
      {
        id: "3",
        type: "transaction",
        level: "MEDIUM",
        score: 0.52,
        summary: "Unusual transaction amount from unfamiliar merchant",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        action: "WARN",
      },
      {
        id: "4",
        type: "url",
        level: "LOW",
        score: 0.15,
        summary: "Legitimate URL verified — google.com",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        action: "ALLOW",
      },
      {
        id: "5",
        type: "text",
        level: "CRITICAL",
        score: 0.92,
        summary: "Account suspension scam targeting Amazon users",
        timestamp: new Date(Date.now() - 600000).toISOString(),
        action: "BLOCK",
      },
    ]);
  }, []);

  const filteredFeed =
    selectedFilter === "all"
      ? feed
      : feed.filter((item) => item.level === selectedFilter);

  const timeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Threat Dashboard</h1>
          <p className="text-sm text-gray-400">
            Real-time threat intelligence powered by ML ensemble
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400">Live</span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Threats Blocked"
          value={metrics.threatsBlocked}
          icon="🛡️"
          color="text-red-400"
          bgColor="bg-red-500/10"
        />
        <MetricCard
          label="URLs Analyzed"
          value={metrics.urlsAnalyzed}
          icon="🔗"
          color="text-cyan-400"
          bgColor="bg-cyan-500/10"
        />
        <MetricCard
          label="Transactions Scanned"
          value={metrics.transactionsScanned}
          icon="💳"
          color="text-emerald-400"
          bgColor="bg-emerald-500/10"
        />
        <MetricCard
          label="Avg Response"
          value={`${metrics.avgResponseMs}ms`}
          icon="⚡"
          color="text-purple-400"
          bgColor="bg-purple-500/10"
        />
      </div>

      {/* Threat Level Distribution */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">
          Threat Level Distribution
        </h3>
        <div className="flex items-end gap-2 h-24">
          {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => {
            const count = feed.filter((f) => f.level === level).length;
            const maxCount = Math.max(...["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(l => feed.filter(f => f.level === l).length), 1);
            const height = (count / maxCount) * 100;
            return (
              <div key={level} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-gray-400">{count}</span>
                <div
                  className={`w-full rounded-t-md transition-all duration-700 ${
                    level === "CRITICAL"
                      ? "bg-red-500/40"
                      : level === "HIGH"
                      ? "bg-orange-500/40"
                      : level === "MEDIUM"
                      ? "bg-yellow-500/40"
                      : "bg-emerald-500/40"
                  }`}
                  style={{ height: `${Math.max(height, 10)}%` }}
                />
                <span className="text-[10px] text-gray-500">{level}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Threat Feed */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300">
            Live Threat Feed
          </h3>
          <div className="flex gap-1">
            {["all", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-all ${
                  selectedFilter === filter
                    ? "bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {filter === "all" ? "All" : filter}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filteredFeed.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-all hover:bg-gray-800/50 ${
                LEVEL_COLORS[item.level]
              }`}
            >
              <span className="text-lg">{TYPE_ICONS[item.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                      LEVEL_COLORS[item.level]
                    }`}
                  >
                    {item.level}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Score: {(item.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-gray-300 truncate">{item.summary}</p>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${
                    item.action === "BLOCK"
                      ? "bg-red-500/20 text-red-400"
                      : item.action === "WARN"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {item.action}
                </span>
                <p className="text-[10px] text-gray-500 mt-1">
                  {timeAgo(item.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {filteredFeed.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-8">
              No threats matching this filter
            </p>
          )}
        </div>
      </div>

      {/* Recent Activity Summary */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Model Performance
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl font-bold text-white">98.2%</p>
            <p className="text-[10px] text-gray-500">URL Detection Accuracy</p>
          </div>
          <div>
            <p className="text-xl font-bold text-white">96.7%</p>
            <p className="text-[10px] text-gray-500">Text Classification F1</p>
          </div>
          <div>
            <p className="text-xl font-bold text-white">0.003</p>
            <p className="text-[10px] text-gray-500">Model Drift (KL-div)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  color,
  bgColor,
}: {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${bgColor}`}
        >
          {icon}
        </span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
