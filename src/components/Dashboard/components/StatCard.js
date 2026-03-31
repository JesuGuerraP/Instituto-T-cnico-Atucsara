import React from 'react';

const StatCard = ({ title, value, icon, trend, trendValue, color = 'blue', footer }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };

  const iconBgClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  const trendClasses = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  };

  return (
    <div className={`p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${iconBgClasses[color]}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold ${trendClasses[trend]} bg-white px-2 py-1 rounded-full border border-slate-50`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            {trendValue}%
          </div>
        )}
      </div>
      <div className="flex-1">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-tight">{title}</h3>
        <p className="text-2xl font-black text-slate-800 mt-1 truncate">{value}</p>
      </div>
      {footer && (
        <div className="mt-4 pt-3 border-t border-slate-50">
          {footer}
        </div>
      )}
    </div>
  );
};

export default StatCard;
