/**
 * Calcula el período académico basado en una fecha
 * Período 1: Enero - Junio
 * Período 2: Julio - Diciembre
 * @param {Date | string} date - Fecha a procesar
 * @returns {string} Período en formato "YYYY-P" (ej: 2025-1)
 */
export const calculatePeriod = (date) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // getMonth() es 0-indexed
  
  // Período 1: enero-junio (meses 1-6)
  // Período 2: julio-diciembre (meses 7-12)
  const period = month <= 6 ? 1 : 2;
  
  return `${year}-${period}`;
};

/**
 * Obtiene los períodos únicos de una lista de estudiantes
 * @param {Array} students - Array de estudiantes
 * @returns {Array} Array de períodos ordenados
 */
export const getUniquePeriods = (students) => {
  const periods = new Set(
    students
      .map(s => s.period)
      .filter(Boolean)
  );
  return Array.from(periods).sort().reverse(); // Más recientes primero
};
