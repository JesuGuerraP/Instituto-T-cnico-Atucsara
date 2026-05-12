import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { pdf } from '@react-pdf/renderer';
import { FinancialReportPDF } from './FinancialReportPDF';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
};

const CategoryAccordion = ({ categoryName, data, isIncome }) => {
  const [isOpen, setIsOpen] = useState(false);
  const colorClass = isIncome ? 'text-green-600' : 'text-red-600';
  const bgHoverClass = isIncome ? 'hover:bg-green-50' : 'hover:bg-red-50';

  return (
    <div className="border border-gray-200 rounded-xl mb-3 overflow-hidden shadow-sm transition-all duration-200">
      <button 
        className={`w-full flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white transition-colors ${bgHoverClass} focus:outline-none`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3 mb-2 sm:mb-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isIncome ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            {isIncome ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
            )}
          </div>
          <span className="font-bold text-gray-800 text-left">{categoryName}</span>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full whitespace-nowrap">
            {data.aggregatedItems.length} {data.aggregatedItems.length === 1 ? 'involucrado' : 'involucrados'}
          </span>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
          <span className={`text-lg font-bold ${colorClass}`}>{formatCurrency(data.total)}</span>
          <div className={`p-1 rounded-full ${isOpen ? 'bg-gray-200' : 'bg-gray-100'}`}>
            <svg className={`w-5 h-5 text-gray-500 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </button>
      
      {isOpen && (
        <div className="bg-gray-50 p-4 border-t border-gray-200 animate-fade-in-up">
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-inner bg-white">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-4 font-bold text-gray-700">Persona Asociada</th>
                  <th className="px-5 py-4 font-bold text-gray-700">Detalle / Curso / Descripción</th>
                  <th className="px-5 py-4 font-bold text-center text-gray-700">Transacciones</th>
                  <th className="px-5 py-4 font-bold text-right text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.aggregatedItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-blue-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-gray-800 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold uppercase">
                        {item.personName.charAt(0)}
                      </div>
                      {item.personName}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <div className="flex flex-col gap-1 max-w-md whitespace-normal">
                        {item.courseName && (
                           <span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-0.5 rounded w-max">
                             {item.courseName}
                           </span>
                        )}
                        <span className="text-xs text-gray-500 line-clamp-2" title={item.descriptions}>{item.descriptions}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-gray-600 bg-gray-100 rounded-full">
                        {item.count}
                      </span>
                    </td>
                    <td className={`px-5 py-3 text-right font-bold ${colorClass}`}>{formatCurrency(item.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const FinancialReport = ({ transactions, academicPeriods, students = [], teachers = [], courses = [], onClose }) => {
  const [filterType, setFilterType] = useState('all'); // 'all', 'date_range', 'month', 'period'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); // 'yyyy-MM'
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedSemester, setSelectedSemester] = useState('all');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.status !== 'completed') return false;
      
      const txDate = t.date ? new Date(t.date + 'T00:00:00') : null;
      
      if (filterType === 'date_range') {
        if (dateFrom && txDate && txDate < new Date(dateFrom + 'T00:00:00')) return false;
        if (dateTo && txDate && txDate > new Date(dateTo + 'T00:00:00')) return false;
      } else if (filterType === 'month') {
        if (selectedMonth && txDate) {
          const monthStr = format(txDate, 'yyyy-MM');
          if (monthStr !== selectedMonth) return false;
        } else if (selectedMonth) {
          return false;
        }
      } else if (filterType === 'period') {
        if (selectedPeriod !== 'all' && t.periodo !== selectedPeriod) return false;
        if (selectedSemester !== 'all' && t.semestre !== selectedSemester) return false;
      }
      return true;
    });
  }, [transactions, filterType, dateFrom, dateTo, selectedMonth, selectedPeriod, selectedSemester]);

  const stats = useMemo(() => {
    let incomeCarrera = 0;
    let incomeCurso = 0;
    let expenseCarrera = 0;
    let expenseCurso = 0;
    
    const categoriesIncome = {};
    const categoriesExpense = {};

    filteredTransactions.forEach(t => {
      const amount = Number(t.amount) || 0;
      const isIncome = t.type === 'income';
      const isCurso = t.ambito === 'curso' || !!t.courseId || t.category === 'Matrícula Curso' || t.category === 'Pago de módulo (Curso)';
      
      // Intentar obtener el nombre real de la persona involucrada
      let personName = 'Desconocido';
      if (t.studentId) {
        const st = students.find(s => s.id === t.studentId);
        if (st) {
          personName = st.name && st.lastName ? `${st.name} ${st.lastName}` : (st.name || st.fullName || st.email || 'Estudiante');
        }
      } else if (t.teacherId) {
        const tc = teachers.find(tch => tch.id === t.teacherId);
        if (tc) {
          personName = tc.name || tc.fullName || tc.email || 'Profesor';
        }
      } else {
         personName = 'Instituto / General'; // Si no hay estudiante ni profesor
      }

      let courseName = '';
      if (t.courseId) {
        const crs = courses.find(c => c.id === t.courseId);
        if (crs) {
          courseName = crs.nombre || 'Curso';
        }
      }

      const itemDetail = {
        id: t.id,
        personName,
        courseName,
        description: t.description,
        amount
      };

      const catName = t.category || 'Otros';

      if (isIncome) {
        if (!isCurso) incomeCarrera += amount;
        else incomeCurso += amount;
        
        if (!categoriesIncome[catName]) categoriesIncome[catName] = { total: 0, items: [] };
        categoriesIncome[catName].total += amount;
        categoriesIncome[catName].items.push(itemDetail);
      } else {
        if (!isCurso) expenseCarrera += amount;
        else expenseCurso += amount;
        
        if (!categoriesExpense[catName]) categoriesExpense[catName] = { total: 0, items: [] };
        categoriesExpense[catName].total += amount;
        categoriesExpense[catName].items.push(itemDetail);
      }
    });

    const aggregateItems = (categories) => {
      Object.keys(categories).forEach(cat => {
        const catObj = categories[cat];
        const aggregated = {};
        catObj.items.forEach(item => {
          const key = `${item.personName}-${item.courseName}`;
          if (!aggregated[key]) {
            aggregated[key] = {
              personName: item.personName,
              courseName: item.courseName,
              count: 0,
              totalAmount: 0,
              descriptions: new Set()
            };
          }
          aggregated[key].count += 1;
          aggregated[key].totalAmount += item.amount;
          if (item.description) aggregated[key].descriptions.add(item.description);
        });
        catObj.aggregatedItems = Object.values(aggregated).map(v => ({
          ...v,
          descriptions: Array.from(v.descriptions).join(' | ')
        })).sort((a, b) => b.totalAmount - a.totalAmount);
      });
    };

    aggregateItems(categoriesIncome);
    aggregateItems(categoriesExpense);

    const totalIncome = incomeCarrera + incomeCurso;
    const totalExpense = expenseCarrera + expenseCurso;

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      incomeCarrera,
      incomeCurso,
      expenseCarrera,
      expenseCurso,
      categoriesIncome,
      categoriesExpense
    };
  }, [filteredTransactions, students, teachers, courses]);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Construir objeto de filtros para el PDF
  const filtersForPdf = useMemo(() => {
    let filterTypeLabel = 'Todo el tiempo';
    let detailLabel = '';
    
    if (filterType === 'date_range') {
      filterTypeLabel = 'Fechas Personalizadas';
      detailLabel = `Desde: ${dateFrom || 'N/A'} - Hasta: ${dateTo || 'N/A'}`;
    } else if (filterType === 'month') {
      filterTypeLabel = 'Por Mes';
      detailLabel = selectedMonth ? format(new Date(selectedMonth + '-01T00:00:00'), 'MMMM yyyy', { locale: es }) : 'Mes no seleccionado';
    } else if (filterType === 'period') {
      filterTypeLabel = 'Por Período Académico';
      detailLabel = `Período: ${selectedPeriod === 'all' ? 'Todos' : selectedPeriod} | Semestre: ${selectedSemester === 'all' ? 'Todos' : selectedSemester}`;
    }

    return { filterTypeLabel, detailLabel };
  }, [filterType, dateFrom, dateTo, selectedMonth, selectedPeriod, selectedSemester]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden animate-fade-in-up border border-gray-200">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-5 flex justify-between items-center shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-2.5 rounded-xl">
              <svg className="w-7 h-7 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-800">Informe Financiero Integral</h2>
              <p className="text-sm text-gray-500 font-medium">Análisis detallado de ingresos y egresos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={isGeneratingPDF}
              onClick={async () => {
                setIsGeneratingPDF(true);
                try {
                  const blob = await pdf(<FinancialReportPDF stats={stats} filters={filtersForPdf} />).toBlob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Informe_Financiero_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch (error) {
                  console.error('Error al generar PDF:', error);
                  alert('Hubo un error al generar el PDF.');
                } finally {
                  setIsGeneratingPDF(false);
                }
              }}
              className={`${isGeneratingPDF ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#009245] hover:bg-green-700'} text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-colors`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
              {isGeneratingPDF ? 'Generando...' : 'Exportar a PDF'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded-full p-2">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          {/* Filtros */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              Criterios de Análisis
            </h3>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex flex-col w-full sm:w-auto">
                <label className="text-xs font-bold text-gray-600 mb-1.5">Filtro Temporal</label>
                <select 
                  className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-blue-800 bg-blue-50 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all cursor-pointer"
                  value={filterType} 
                  onChange={e => setFilterType(e.target.value)}
                >
                  <option value="all">Todo el tiempo</option>
                  <option value="period">Por Período Académico</option>
                  <option value="month">Por Mes</option>
                  <option value="date_range">Fechas Personalizadas</option>
                </select>
              </div>

              {filterType === 'date_range' && (
                <>
                  <div className="flex flex-col w-full sm:w-auto">
                    <label className="text-xs font-bold text-gray-600 mb-1.5">Desde</label>
                    <input type="date" className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  </div>
                  <div className="flex flex-col w-full sm:w-auto">
                    <label className="text-xs font-bold text-gray-600 mb-1.5">Hasta</label>
                    <input type="date" className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  </div>
                </>
              )}

              {filterType === 'month' && (
                <div className="flex flex-col w-full sm:w-auto">
                  <label className="text-xs font-bold text-gray-600 mb-1.5">Mes y Año</label>
                  <input type="month" className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                </div>
              )}

              {filterType === 'period' && (
                <>
                  <div className="flex flex-col w-full sm:w-auto">
                    <label className="text-xs font-bold text-gray-600 mb-1.5">Período</label>
                    <select className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
                      <option value="all">Todos los Períodos</option>
                      {academicPeriods.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col w-full sm:w-auto">
                    <label className="text-xs font-bold text-gray-600 mb-1.5">Semestre</label>
                    <select className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} disabled={selectedPeriod === 'all'}>
                      <option value="all">Todos los Semestres</option>
                      <option value="1">Semestre 1</option>
                      <option value="2">Semestre 2</option>
                      <option value="3">Semestre 3</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tarjetas Principales (Balance Global) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl shadow-xl p-8 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity"></div>
              <p className="text-green-100 text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Ingresos Totales
              </p>
              <h3 className="text-4xl lg:text-5xl font-black tracking-tight">{formatCurrency(stats.totalIncome)}</h3>
            </div>
            
            <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-3xl shadow-xl p-8 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity"></div>
              <p className="text-red-100 text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                Egresos Totales
              </p>
              <h3 className="text-4xl lg:text-5xl font-black tracking-tight">{formatCurrency(stats.totalExpense)}</h3>
            </div>

            <div className={`bg-gradient-to-br rounded-3xl shadow-xl p-8 text-white relative overflow-hidden group ${stats.balance >= 0 ? 'from-[#23408e] to-blue-600' : 'from-orange-500 to-red-600'}`}>
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity"></div>
              <p className="text-white/80 text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                Balance Neto
              </p>
              <h3 className="text-4xl lg:text-5xl font-black tracking-tight">{formatCurrency(stats.balance)}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Desglose Macro */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 flex flex-col justify-center">
              <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center border-b pb-4">
                Origen de Ingresos
              </h3>
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <span className="block text-sm font-bold text-gray-500 uppercase tracking-wide">Carreras Técnicas</span>
                      <span className="block text-2xl font-black text-green-600">{formatCurrency(stats.incomeCarrera)}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-400">
                      {stats.totalIncome > 0 ? ((stats.incomeCarrera / stats.totalIncome) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full shadow-inner" style={{ width: `${stats.totalIncome > 0 ? (stats.incomeCarrera / stats.totalIncome) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <span className="block text-sm font-bold text-gray-500 uppercase tracking-wide">Cursos Especiales</span>
                      <span className="block text-2xl font-black text-emerald-500">{formatCurrency(stats.incomeCurso)}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-400">
                      {stats.totalIncome > 0 ? ((stats.incomeCurso / stats.totalIncome) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="bg-emerald-400 h-3 rounded-full shadow-inner" style={{ width: `${stats.totalIncome > 0 ? (stats.incomeCurso / stats.totalIncome) * 100 : 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 flex flex-col justify-center">
              <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center border-b pb-4">
                Destino de Egresos
              </h3>
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <span className="block text-sm font-bold text-gray-500 uppercase tracking-wide">Carreras Técnicas</span>
                      <span className="block text-2xl font-black text-red-600">{formatCurrency(stats.expenseCarrera)}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-400">
                      {stats.totalExpense > 0 ? ((stats.expenseCarrera / stats.totalExpense) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="bg-red-500 h-3 rounded-full shadow-inner" style={{ width: `${stats.totalExpense > 0 ? (stats.expenseCarrera / stats.totalExpense) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <span className="block text-sm font-bold text-gray-500 uppercase tracking-wide">Cursos Especiales</span>
                      <span className="block text-2xl font-black text-rose-400">{formatCurrency(stats.expenseCurso)}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-400">
                      {stats.totalExpense > 0 ? ((stats.expenseCurso / stats.totalExpense) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="bg-rose-400 h-3 rounded-full shadow-inner" style={{ width: `${stats.totalExpense > 0 ? (stats.expenseCurso / stats.totalExpense) * 100 : 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desglose Detallado por Categorías usando Acordeones */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Detalles de Ingresos */}
            <div>
              <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center bg-green-50 p-4 rounded-xl border border-green-100 text-green-800">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Detalle de Ingresos por Categoría
              </h3>
              {Object.keys(stats.categoriesIncome).length === 0 ? (
                <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">No hay ingresos registrados en este período.</p>
              ) : (
                Object.entries(stats.categoriesIncome)
                  .sort((a,b) => b[1].total - a[1].total)
                  .map(([catName, data]) => (
                    <CategoryAccordion key={catName} categoryName={catName} data={data} isIncome={true} />
                  ))
              )}
            </div>

            {/* Detalles de Egresos */}
            <div>
              <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center bg-red-50 p-4 rounded-xl border border-red-100 text-red-800">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
                Detalle de Egresos por Categoría
              </h3>
              {Object.keys(stats.categoriesExpense).length === 0 ? (
                <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">No hay egresos registrados en este período.</p>
              ) : (
                Object.entries(stats.categoriesExpense)
                  .sort((a,b) => b[1].total - a[1].total)
                  .map(([catName, data]) => (
                    <CategoryAccordion key={catName} categoryName={catName} data={data} isIncome={false} />
                  ))
              )}
            </div>
          </div>
          
          <div className="text-center text-xs text-gray-400 mt-12 bg-gray-50 p-4 rounded-xl border border-gray-200">
            Reporte generado en base a transacciones con estado <span className="font-bold text-green-600">Completado</span>.
            Total de transacciones procesadas: <span className="font-bold text-gray-700">{filteredTransactions.length}</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FinancialReport;
