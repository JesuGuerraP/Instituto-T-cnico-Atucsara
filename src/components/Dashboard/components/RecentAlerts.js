import React from 'react';
import { 
  Attention, 
  CheckOne, 
  Error, 
  ArrowRight,
  Analysis,
  Lightning
} from '@icon-park/react';
import { Link } from 'react-router-dom';

const RecentAlerts = ({ insights }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'warning': return <Attention theme="filled" size="20" fill="#f59e0b" />;
      case 'error': return <Error theme="filled" size="20" fill="#ef4444" />;
      case 'success': return <CheckOne theme="filled" size="20" fill="#10b981" />;
      default: return <Analysis theme="filled" size="20" fill="#23408e" />;
    }
  };

  const getBgColor = (type) => {
    switch (type) {
      case 'warning': return 'bg-amber-50 border-amber-100/50';
      case 'error': return 'bg-red-50 border-red-100/50';
      case 'success': return 'bg-emerald-50 border-emerald-100/50';
      default: return 'bg-slate-50 border-slate-100/50';
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-[400px] flex flex-col transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm">
            <Lightning theme="filled" size="22" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">Inteligencia de Datos</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Alertas y Sugerencias Críticas</p>
          </div>
        </div>
        <div className="bg-slate-50 px-3 py-1 rounded-full text-[10px] font-black text-slate-400 border border-slate-100 uppercase tracking-widest">IA Insight</div>
      </div>

      <div className="space-y-4 flex-1">
        {insights.length > 0 ? insights.map((insight, idx) => (
          <div 
            key={idx} 
            className={`flex items-start gap-4 p-5 rounded-[1.5rem] border ${getBgColor(insight.type)} transition-all hover:translate-x-1 duration-200 group`}
          >
            <div className="mt-0.5 shrink-0 group-hover:scale-110 transition-transform">
              {getIcon(insight.type)}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{insight.title}</h4>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{insight.description}</p>
              {insight.action && (
                <Link 
                  to={insight.action} 
                  className="inline-flex items-center gap-1 text-[10px] font-black text-blue-700 uppercase tracking-widest mt-3 hover:gap-2 transition-all p-1 rounded"
                >
                  Gestionar Ahora <ArrowRight theme="outline" size="14" />
                </Link>
              )}
            </div>
          </div>
        )) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70">
            <div className="w-16 h-16 rounded-[2rem] bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckOne theme="filled" size="32" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Todo bajo control</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">No se detectan anomalías críticas hoy</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentAlerts;
