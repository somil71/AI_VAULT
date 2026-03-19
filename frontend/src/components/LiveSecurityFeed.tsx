import React, { useEffect, useState } from 'react';
import { Bell, Shield, Zap, Activity } from 'lucide-react';

interface SecurityAlert {
  id: string;
  type: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: string;
}

const LiveSecurityFeed: React.FC = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Phase 3: Connect to SSE Stream
    const eventSource = new EventSource('/api/v1/alerts/stream');
    
    eventSource.onopen = () => setIsActive(true);
    eventSource.onerror = () => setIsActive(false);

    eventSource.onmessage = (event) => {
      try {
        const newAlert = JSON.parse(event.data);
        setAlerts(prev => [newAlert, ...prev].slice(0, 5));
      } catch (err) {
        // Heartbeats or invalid data
      }
    };

    return () => eventSource.close();
  }, []);

  return (
    <div className="p-5 rounded-2xl bg-[#0b1221] border border-[#1e293b] flex flex-col h-full shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-500" />
            Live Security Feed
          </h2>
        </div>
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Real-time</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 opacity-50">
            <Shield className="w-8 h-8" />
            <p className="text-xs">No active threats detected.</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`p-3 rounded-lg border flex gap-3 animate-in slide-in-from-right-2 duration-300 ${
                alert.type === 'critical' ? 'bg-red-400/5 border-red-500/20' : 
                alert.type === 'warning' ? 'bg-yellow-400/5 border-yellow-500/20' : 
                'bg-cyan-400/5 border-cyan-500/20'
              }`}
            >
              <div className={`p-2 rounded-md h-fit ${
                alert.type === 'critical' ? 'bg-red-500/20' : 
                alert.type === 'warning' ? 'bg-yellow-500/20' : 
                'bg-cyan-500/20'
              }`}>
                {alert.type === 'critical' ? <Zap className="w-3 h-3 text-red-400" /> : <Bell className="w-3 h-3 text-cyan-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-bold text-slate-100 truncate">{alert.title}</h4>
                  <span className="text-[9px] text-slate-500">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{alert.message}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
        <button 
          onClick={async () => {
             const { logActivity } = await import("@/lib/api");
             await logActivity({ type: "simulate_threat_alert" });
             // We can also call the /api/v1/alerts/test endpoint
             fetch('/api/v1/alerts/test', { method: 'POST' });
          }}
          className="flex-1 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-all uppercase tracking-widest"
        >
            Simulate Threat
        </button>
        <button className="flex-1 py-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-cyan-400 transition-colors uppercase tracking-widest">
            History
        </button>
      </div>
    </div>
  );
};

export default LiveSecurityFeed;
