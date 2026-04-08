import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Printer, 
  Down, 
  CheckOne, 
  Time,
  Attention,
  Currency,
  Gift
} from '@icon-park/react';
import PremiumCard from './PremiumCard';

const FinanceSection = ({ 
  payments, 
  semesterPrices, 
  studentInfo, 
  toggleSemester, 
  openSemesters, 
  handlePrintFinanceReceipt,
  formatCOP,
  courseModules = [],
  courseDiscounts = {}
}) => {
  const [selectedScope, setSelectedScope] = useState('career');
  const careerDescuento = studentInfo?.descuento || 0;

  // Helpers to distinguish scopes and validate enrollments
  const isCoursePayment = (p) => p.category === 'Pago de módulo (Curso)' || p.category === 'Matrícula Curso' || p.ambito === 'curso' || !!p.courseId;
  const isCareerPayment = (p) => !isCoursePayment(p);

  // VALIDACIÓN DINÁMICA DE MATRÍCULA
  // El beneficio solo se activa si existe un pago de matrícula completado para el ámbito
  const hasCareerMatricula = payments.some(p => p.category === 'Matrícula' && p.status === 'completed');
  const getCourseMatricula = (courseId) => payments.some(p => p.category === 'Matrícula Curso' && p.courseId === courseId && p.status === 'completed');

  const effectiveCareerDiscount = hasCareerMatricula ? careerDescuento : 0;
  
  const hasCareer = studentInfo?.career && studentInfo?.career !== '—' && studentInfo?.career !== 'Sin Carrera';
  const hasCourses = courseModules.length > 0;

  // Dynamic discount percentage for the badge
  const activeDiscountRate = selectedScope === 'career' 
    ? effectiveCareerDiscount 
    : (() => {
        // Para cursos, mostramos el descuento del primer curso que tenga matrícula paga
        const firstEnrolledCourse = courseModules.find(m => getCourseMatricula(m.courseId));
        return firstEnrolledCourse ? (courseDiscounts[firstEnrolledCourse.courseId] || 0) : 0;
      })();

  // Auto-selection logic
  useEffect(() => {
    if (!hasCareer && hasCourses) {
      setSelectedScope('course');
    }
  }, [hasCareer, hasCourses]);

  // Agrupar pagos por semestre
  const pagosPorSemestre = payments.reduce((acc, p) => {
    const semester = p.semestre || 'General';
    if (!acc[semester]) acc[semester] = [];
    acc[semester].push(p);
    return acc;
  }, {});

  // Current statistics based on scope
  const isCourseScope = selectedScope === 'course';
  const filteredPayments = payments.filter(isCourseScope ? isCoursePayment : isCareerPayment);
  
  const subscribedPayments = filteredPayments.filter(p => (p.category === 'Pago de módulo' || p.category === 'Pago de módulo (Curso)') && p.status === 'completed');
  const totalAbonado = subscribedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  
  const otherPayments = filteredPayments.filter(p => !['Pago de módulo', 'Pago de módulo (Curso)'].includes(p.category) && p.status === 'completed');
  const totalOtros = otherPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const relevantSemesters = Object.entries(pagosPorSemestre).filter(([sem]) => {
    if (isCourseScope) return sem === 'Curso';
    return sem !== 'Curso';
  });

  const totalSaldoPendiente = relevantSemesters.reduce((acc, [sem, pagos]) => {
    if (sem === 'Curso') {
      // Calculate course balance using per-course discounts (only if enrolled)
      const totalValorCursosConDesc = courseModules.reduce((sum, m) => {
        const mPrice = Number(m.precio || 0);
        const hasEnrollment = getCourseMatricula(m.courseId);
        const mDiscount = hasEnrollment ? (courseDiscounts[m.courseId] || 0) : 0;
        return sum + (mPrice - (mPrice * (mDiscount / 100)));
      }, 0);
      
      const pagosCursosEfectivos = pagos.filter(isCoursePayment)
        .filter(p => (p.category === 'Pago de módulo' || p.category === 'Pago de módulo (Curso)') && p.status === 'completed');
      const pagadoCursos = pagosCursosEfectivos.reduce((sum, p) => sum + Number(p.amount), 0);
      
      return acc + Math.max(0, totalValorCursosConDesc - pagadoCursos);
    } else {
      // Career semester balance (check if student has career enrollment paid)
      const periodo = pagos.length > 0 ? (pagos[0].periodo || '2025-1') : '2025-1';
      const priceId = `${periodo}_${sem}`;
      const valorSem = semesterPrices[priceId] !== undefined ? semesterPrices[priceId] : 200000;
      
      // We apply the career discount ONLY if there is at least one Matrícula payment in history
      const valorConDesc = valorSem - (valorSem * (effectiveCareerDiscount / 100));
      
      const pagosSemEfectivos = pagos.filter(isCareerPayment)
        .filter(p => (p.category === 'Pago de módulo' || p.category === 'Pago de módulo (Curso)') && p.status === 'completed');
      const pagadoSem = pagosSemEfectivos.reduce((sum, p) => sum + Number(p.amount), 0);
      
      return acc + Math.max(0, valorConDesc - pagadoSem);
    }
  }, 0);

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-[#23408e] tracking-tight">Gestión Financiera</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Resumen de Obligaciones y Pagos</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Discount Card - Hides if no discount or no enrollment paid */}
          {activeDiscountRate > 0 && (
            <div className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-orange-100 shadow-sm animate-pulse">
              <div className="p-1.5 bg-orange-500 rounded-lg text-white">
                <Gift theme="outline" size="16" />
              </div>
              <div>
                <p className="text-[9px] font-black text-orange-400 uppercase tracking-tighter leading-none">Descuento {isCourseScope ? 'Cursos' : 'Beca'}</p>
                <p className="text-lg font-black text-orange-600 leading-none">{activeDiscountRate}%</p>
              </div>
            </div>
          )}

          {/* Scope Selector */}
          {hasCareer && hasCourses && (
            <div className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner border border-gray-200">
              <button 
                onClick={() => setSelectedScope('career')}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${selectedScope === 'career' ? 'bg-white text-[#23408e] shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Carrera
              </button>
              <button 
                onClick={() => setSelectedScope('course')}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${selectedScope === 'course' ? 'bg-white text-emerald-600 shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Cursos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resumen dinámico basado en ámbito */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`bg-gradient-to-br ${isCourseScope ? 'from-emerald-500 to-emerald-600 shadow-emerald-200' : 'from-green-500 to-green-600 shadow-green-200'} rounded-[2.5rem] p-8 text-white shadow-xl group transition-all`}>
          <div className="flex items-center gap-3 mb-6 opacity-80 uppercase tracking-widest text-xs font-black">
            <CheckOne theme="outline" size="18" />
            Abonado a Módulos
          </div>
          <div className="text-4xl font-black mb-2 tracking-tight">{formatCOP(totalAbonado)}</div>
          <p className="opacity-80 text-sm font-medium">Total aplicado al costo del programa</p>
        </div>

        <div className={`bg-gradient-to-br ${isCourseScope ? 'from-teal-500 to-teal-600 shadow-teal-200' : 'from-blue-500 to-blue-600 shadow-blue-200'} rounded-[2.5rem] p-8 text-white shadow-xl group transition-all`}>
          <div className="flex items-center gap-3 mb-6 opacity-80 uppercase tracking-widest text-xs font-black">
            <Wallet theme="outline" size="18" />
            Otros Conceptos
          </div>
          <div className="text-4xl font-black mb-2 tracking-tight">{formatCOP(totalOtros)}</div>
          <p className="opacity-80 text-sm font-medium">Matrículas y certificaciones</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-orange-200 group transition-all">
          <div className="flex items-center gap-3 mb-6 opacity-80 uppercase tracking-widest text-xs font-black">
            <Attention theme="outline" size="18" />
            Saldo Pendiente
          </div>
          <div className="text-4xl font-black mb-2 tracking-tight">{formatCOP(totalSaldoPendiente)}</div>
          <p className="opacity-80 text-sm font-medium">Costo por liquidar ({isCourseScope ? 'Cursos' : 'Carrera'})</p>
        </div>
      </div>

      {/* Detalle Histórico */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 px-2 mt-12 pb-2">
          <div className={`w-1.5 h-6 ${isCourseScope ? 'bg-emerald-500' : 'bg-[#23408e]'} rounded-full`} />
          <h2 className="text-xl font-black text-gray-800">Historial de Pagos ({isCourseScope ? 'Cursos' : 'Carrera'})</h2>
        </div>

        {relevantSemesters.length > 0 ? (
          relevantSemesters
            .sort(([semA], [semB]) => semA.localeCompare(semB))
            .map(([semestre, pagosSemestre]) => {
              const isCourse = semestre === 'Curso';
              const periodo = pagosSemestre.length > 0 ? pagosSemestre[0].periodo : null;
              
              let valorConDesc = 0;
              if (isCourse) {
                // Course logic with payment-based discount validation
                valorConDesc = courseModules.reduce((sum, m) => {
                  const mPrice = Number(m.precio || 0);
                  const hasEnrollment = getCourseMatricula(m.courseId);
                  const mDiscount = hasEnrollment ? (courseDiscounts[m.courseId] || 0) : 0;
                  return sum + (mPrice - (mPrice * (mDiscount / 100)));
                }, 0);
              } else {
                const priceId = periodo ? `${periodo}_${semestre}` : null;
                const valorSem = priceId && semesterPrices[priceId] !== undefined ? semesterPrices[priceId] : 200000;
                valorConDesc = valorSem - (valorSem * (effectiveCareerDiscount / 100));
              }

              const totalPagadoSem = pagosSemestre.filter(p => (p.category === 'Pago de módulo' || p.category === 'Pago de módulo (Curso)') && p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0);
              const saldoPendienteSem = Math.max(0, valorConDesc - totalPagadoSem);

              return (
                <PremiumCard 
                  key={semestre} 
                  title={isCourse ? 'Módulos de Curso Corto' : `Semestre ${semestre}`} 
                  icon={isCourse ? CheckOne : Wallet}
                  className={isCourse ? 'border-emerald-100 shadow-emerald-50' : ''}
                >
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 ${isCourse ? 'text-emerald-900' : ''}`}>
                    <div className="p-6 rounded-[2rem] bg-gray-50 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-70">Costo Neto con Descuento</p>
                      <p className="text-2xl font-black text-gray-900">{formatCOP(valorConDesc)}</p>
                    </div>
                    <div className="p-6 rounded-[2rem] bg-gray-50 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-70">Saldo por Pagar</p>
                      <p className={`text-2xl font-black ${saldoPendienteSem > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {formatCOP(saldoPendienteSem)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 mb-2">Transacciones Registradas</p>
                    {pagosSemestre.map((p, idx) => (
                      <div key={p.id || idx} className="flex flex-col sm:flex-row items-center justify-between p-6 rounded-3xl bg-white border border-gray-100 hover:border-blue-200 transition-all hover:shadow-lg group gap-4">
                        <div className="flex items-center gap-5 w-full sm:w-auto">
                          <div className={`w-14 h-14 rounded-2xl ${isCourse ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'} flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform`}>
                            <Currency theme="outline" size="28" />
                          </div>
                          <div>
                            <h5 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-[#23408e] transition-colors">{p.description || 'Pago de Cuota'}</h5>
                            <div className="flex items-center gap-3 mt-1.5 single-line overflow-hidden">
                              <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase border ${['Pago de módulo', 'Pago de módulo (Curso)'].includes(p.category) ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                {p.category || 'Otros'}
                              </span>
                              <p className="text-[11px] font-bold text-gray-400">
                                {p.date ? (typeof p.date === 'string' ? new Date(p.date) : new Date(p.date.seconds * 1000)).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Fecha no disponible'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                          <div className="text-right">
                            <span className="text-xl font-black text-gray-900 block tracking-tight">{formatCOP(p.amount)}</span>
                            <div className="flex items-center justify-end gap-1 font-black text-green-500 text-[9px] uppercase tracking-widest">
                              <CheckOne size="12" />
                              Completado
                            </div>
                          </div>
                          <button 
                            onClick={() => handlePrintFinanceReceipt(p)}
                            className="p-4 rounded-2xl bg-gray-50 text-gray-400 hover:bg-[#23408e] hover:text-white transition-all shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-95"
                          >
                            <Printer theme="outline" size="22" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </PremiumCard>
              );
            })
        ) : (
          <div className="p-20 text-center bg-white rounded-[2.5rem] border border-dashed border-gray-200">
            <Wallet theme="outline" size="64" className="mx-auto text-gray-100 mb-6" />
            <p className="text-gray-400 font-bold text-lg">No se encontraron registros en este ámbito.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceSection;
