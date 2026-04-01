import React from 'react';

const PremiumCard = ({ children, className = '', title, icon: Icon, delay = 0 }) => {
  return (
    <div 
      className={`glass-card p-6 rounded-2xl animate-in ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {(title || Icon) && (
        <div className="flex items-center gap-3 mb-6">
          {Icon && (
            <div className="p-2 rounded-xl bg-blue-50 text-[#23408e]">
              <Icon theme="outline" size="24" />
            </div>
          )}
          {title && <h3 className="text-xl font-bold text-[#23408e]">{title}</h3>}
        </div>
      )}
      {children}
    </div>
  );
};

export default PremiumCard;
