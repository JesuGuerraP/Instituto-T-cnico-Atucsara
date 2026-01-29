import React, { createContext, useState } from 'react';

export const DefaultPeriodContext = createContext();

export const DefaultPeriodProvider = ({ children }) => {
  const [defaultPeriod, setDefaultPeriod] = useState('2025-1');

  return (
    <DefaultPeriodContext.Provider value={{ defaultPeriod, setDefaultPeriod }}>
      {children}
    </DefaultPeriodContext.Provider>
  );
};
