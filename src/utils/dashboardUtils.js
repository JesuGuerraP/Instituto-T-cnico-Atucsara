/**
 * Utilidades para procesar datos de Firestore para el Dashboard de Administración
 * Sincronizado con la lógica de PaymentManager.js
 */

import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Procesa las transacciones financieras para obtener ingresos y gastos
 * Sincronizado con PaymentManager.js
 * @param {Array} transactions 
 * @param {string} filterPeriod - 'all' para no filtrar
 * @param {number} monthsToLookBack 
 */
export const processFinanceData = (transactions, filterPeriod = 'all', monthsToLookBack = 6) => {
  const now = new Date();
  const months = [];
  
  let totalIncome = 0;
  let totalExpense = 0;

  // 1. Calcular Totales (Balance General)
  transactions.forEach(t => {
    // Solo transacciones completadas (igual que PaymentManager)
    if (t.status !== 'completed' && t.status !== 'Pago Completo') return;
    
    // Filtro de Período (igual que PaymentManager)
    const transactionPeriod = t.periodo || t.period || '';
    if (filterPeriod && filterPeriod !== 'all' && transactionPeriod !== filterPeriod) {
      return;
    }

    const amount = Number(t.amount) || 0;
    if (t.type === 'income') {
      totalIncome += amount;
    } else if (t.type === 'expense') {
      totalExpense += amount;
    }
  });

  // 2. Procesar datos para el gráfico mensual (últimos 6 meses)
  // Nota: El gráfico siempre muestra los últimos meses independientemente del período seleccionado
  // para dar una visión de tendencia temporal, pero las transacciones dentro de esos meses
  // deben respetar el filtro de período si se desea (aunque usualmente los gráficos de tendencia son cronológicos)
  for (let i = monthsToLookBack - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    months.push({
      label: format(monthDate, 'MMM', { locale: es }),
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate),
      income: 0,
      expense: 0
    });
  }

  transactions.forEach(t => {
    if (t.status !== 'completed' && t.status !== 'Pago Completo') return;
    
    // Aplicar filtro de período al gráfico también si no es 'all'
    const transactionPeriod = t.periodo || t.period || '';
    if (filterPeriod && filterPeriod !== 'all' && transactionPeriod !== filterPeriod) {
      return;
    }

    const transDate = t.date ? (typeof t.date === 'string' ? parseISO(t.date) : t.date.toDate?.() || new Date(t.date)) : null;
    if (!transDate) return;

    months.forEach(month => {
      if (isWithinInterval(transDate, { start: month.start, end: month.end })) {
        const amount = Number(t.amount) || 0;
        if (t.type === 'income') month.income += amount;
        else if (t.type === 'expense') month.expense += amount;
      }
    });
  });

  return {
    labels: months.map(m => m.label),
    income: months.map(m => m.income),
    expense: months.map(m => m.expense),
    summary: {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense
    }
  };
};

/**
 * Procesa la distribución de estudiantes por carrera/curso y estado
 * @param {Array} students 
 * @param {Array} allCourses 
 * @param {string} filterPeriod 
 */
export const processStudentDistribution = (students, allCourses = [], filterPeriod = 'all') => {
  const distribution = {};
  
  const filtered = filterPeriod && filterPeriod !== 'all'
    ? students.filter(s => s.period === filterPeriod || s.periodo === filterPeriod)
    : students;

  filtered.forEach(s => {
    let groupName = s.career;
    
    if (!groupName || groupName === 'Individual' || groupName === 'Sin Carrera') {
      if (Array.isArray(s.courses) && s.courses.length > 0) {
        const courseId = s.courses[0];
        const course = allCourses.find(c => c.id === courseId);
        groupName = course ? `Curso: ${course.nombre}` : 'Individual / Sin Carrera';
      } else {
        groupName = 'Individual / Sin Carrera';
      }
    }

    if (!distribution[groupName]) {
      distribution[groupName] = { active: 0, inactive: 0, total: 0 };
    }

    distribution[groupName].total++;
    if (s.status === 'active' || s.estado === 'Activo') {
      distribution[groupName].active++;
    } else {
      distribution[groupName].inactive++;
    }
  });

  return {
    labels: Object.keys(distribution),
    data: Object.values(distribution).map(v => v.active),
    fullData: distribution
  };
};

/**
 * Calcula el promedio de notas por módulo
 */
export const processAcademicPerformance = (grades, filterPeriod = 'all') => {
  const moduleGrades = {};
  
  const filtered = filterPeriod && filterPeriod !== 'all'
    ? grades.filter(g => g.period === filterPeriod || g.periodo === filterPeriod)
    : grades;

  filtered.forEach(g => {
    const module = g.moduleName || 'General';
    const gradeValue = parseFloat(g.grade);
    if (isNaN(gradeValue)) return;

    if (!moduleGrades[module]) {
      moduleGrades[module] = { sum: 0, count: 0 };
    }
    moduleGrades[module].sum += gradeValue;
    moduleGrades[module].count += 1;
  });

  const modules = Object.keys(moduleGrades).map(name => ({
    name,
    average: (moduleGrades[name].sum / moduleGrades[name].count).toFixed(2)
  }));

  return modules.sort((a, b) => b.average - a.average).slice(0, 8);
};

/**
 * Procesa actividades recientes combinando múltiples colecciones
 */
/**
 * Procesa actividades recientes registradas en la colección activityLogs
 * @param {Array} activityLogs - Datos de la colección activityLogs
 * @param {number} limit 
 */
export const processRecentActivities = (activityLogs = [], limit = 10) => {
  return activityLogs
    .sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateB - dateA;
    })
    .map(log => ({
      type: log.entityType?.toLowerCase() || 'system',
      user: log.user || 'Sistema',
      role: log.userRole || '',
      action: `${log.action}: ${log.entityName || ''}`,
      detail: log.details || '',
      date: log.timestamp,
      color: 
        log.action?.includes('ELIMINACIÓN') ? 'red' : 
        log.action?.includes('CREACIÓN') ? 'green' : 
        log.action?.includes('EDICIÓN') ? 'blue' : 
        'purple'
    }))
    .slice(0, limit);
};

/**
 * Procesa la tasa de asistencia global
 */
export const processAttendanceRate = (attendanceRecords, filterPeriod = 'all') => {
  let totalPresent = 0;
  let totalRecords = 0;

  const filtered = filterPeriod && filterPeriod !== 'all'
    ? attendanceRecords.filter(r => r.period === filterPeriod || r.periodo === filterPeriod)
    : attendanceRecords;

  filtered.forEach(record => {
    if (record.attendance && typeof record.attendance === 'object') {
      Object.values(record.attendance).forEach(val => {
        if (val === true) totalPresent++;
        totalRecords++;
      });
    }
  });

  const rate = totalRecords > 0 ? (totalPresent / totalRecords) * 100 : 0;
  return {
    rate: rate.toFixed(1),
    present: totalPresent,
    total: totalRecords
  };
};

/**
 * Identifica alertas críticas
 */
export const identifyInsights = (students, grades, payments, filterPeriod = 'all') => {
  const insights = [];
  
  const fStudents = filterPeriod && filterPeriod !== 'all' ? students.filter(s => s.period === filterPeriod || s.periodo === filterPeriod) : students;
  const fGrades = filterPeriod && filterPeriod !== 'all' ? grades.filter(g => g.period === filterPeriod || g.periodo === filterPeriod) : grades;
  const fPayments = filterPeriod && filterPeriod !== 'all' ? payments.filter(p => p.periodo === filterPeriod || p.period === filterPeriod) : payments;

  // 1. Rendimiento Bajo (Notas < 3.0)
  const lowGrades = fGrades.filter(g => parseFloat(g.grade) < 3.0);
  if (lowGrades.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Bajo Rendimiento Académico',
      description: `${lowGrades.length} estudiantes tienen notas críticas en este período.`,
      action: '/dashboard/grades'
    });
  }

  // 2. Pagos Pendientes
  const pendingPayments = fPayments.filter(p => p.status === 'pending');
  if (pendingPayments.length > 0) {
    const totalPending = pendingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    insights.push({
      type: 'error',
      title: 'Cartera Pendiente',
      description: `Hay $${totalPending.toLocaleString()} por recaudar en este período.`,
      action: '/dashboard/finance'
    });
  }

  return insights;
};
