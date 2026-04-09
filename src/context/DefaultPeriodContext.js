import React, { createContext, useState, useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext';

export const DefaultPeriodContext = createContext();

export const DefaultPeriodProvider = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  const [defaultPeriod, setDefaultPeriod] = useState('2025-1');

  useEffect(() => {
    // Si el usuario tiene una preferencia guardada, usarla.
    if (currentUser?.preferredPeriod) {
      setDefaultPeriod(currentUser.preferredPeriod);
    } else {
      // Si no hay usuario o no tiene preferencia, volver al default del sistema
      setDefaultPeriod('2025-1');
    }
  }, [currentUser]);

  return (
    <DefaultPeriodContext.Provider value={{ defaultPeriod, setDefaultPeriod }}>
      {children}
    </DefaultPeriodContext.Provider>
  );
};
