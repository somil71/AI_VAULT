import React from 'react';
import { ShieldAlert, CheckCircle, Info, ExternalLink } from 'lucide-react';

interface ThreatExplanationProps {
  score: number;
  level: string;
  reasoning: string;
  topFeatures: string[];
  recommendation: string;
}

const ThreatExplanationPanel: React.FC<ThreatExplanationProps> = ({
  score,
  level,
  reasoning,
  topFeatures,
  recommendation
}) => {
  const isHighRisk = score > 0.65;
  const isMediumRisk = score > 0.4 && score <= 0.65;

  const color = isHighRisk ? 'text-red-400' : isMediumRisk ? 'text-yellow-400' : 'text-emerald-400';
  const bgColor = isHighRisk ? 'bg-red-400/10' : isMediumRisk ? 'bg-yellow-400/10' : 'bg-emerald-400/10';
  const borderColor = isHighRisk ? 'border-red-400/30' : isMediumRisk ? 'border-yellow-400/30' : 'border-emerald-400/30';

  return (
    <div className={`p-4 rounded-xl border ${borderColor} ${bgColor} space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
      <div className="flex items-center gap-3">
        {isHighRisk ? (
          <ShieldAlert className={`w-6 h-6 ${color}`} />
        ) : (
          <CheckCircle className={`w-6 h-6 ${color}`} />
        )}
        <div>
          <h3 className={`font-bold ${color}`}>LifeVault AI Analysis: {level} Risk</h3>
          <p className="text-xs text-slate-400">Confidence Score: {(score * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-slate-200">
          <span className="font-semibold text-slate-400 underline decoration-slate-700 underline-offset-4 mr-2">Why it was flagged:</span>
          {reasoning}
        </p>
        
        {topFeatures.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topFeatures.map((feat, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300 uppercase tracking-tight">
                {feat}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-700/50">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-400 mt-0.5" />
          <p className="text-xs text-slate-300 leading-relaxed italic">
            <span className="font-bold not-italic">Recommended Action:</span> {recommendation}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThreatExplanationPanel;
