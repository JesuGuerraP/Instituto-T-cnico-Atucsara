import React from 'react';
import { 
  Wallet, 
  Printer, 
  Down, 
  CheckOne, 
  Time,
  Attention,
  Currency
} from '@icon-park/react';
import PremiumCard from './PremiumCard';

const FinanceSection = ({ 
  payments, 
  semesterPrices, 
  studentInfo, 
  toggleSemester, 
  openSemesters, 
  handlePrintFinanceReceipt,
  formatCOP 
}) => {
  const descuento = studentInfo?.descuento || 0;

  // Agrupar pagos por semestre
  const pagosPorSemestre = payments.reduce((acc, p) => {
    const semester = p.semestre || 'General';
    if (!acc[semester]) acc[semester] = [];
    acc[semester].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-black text-[#23408e] tracking-tight">Gestión Financiera</h1>
        <div className="px-4 py-2 bg-blue-50 text-[#23408e] rounded-xl border border-blue-100 font-bold text-sm">
          Descuento aplicado: {descuento}%
        </div>
      </div>

      {/* Resumen General */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-3xl p-8 text-white shadow-xl shadow-green-200">
          <div className="flex items-center gap-3 mb-6 opacity-80 uppercase tracking-widest text-xs font-black">
            <CheckOne theme="outline" size="18" />
            Abonado a Módulos
          </div>
          <div className="text-4xl font-black mb-2 tracking-tight">
            {formatCOP(payments.filter(p => p.category === 'Pago de módulo' && p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0))}
          </div>
          <p className="text-green-100 text-sm font-medium">Total aplicado al costo del semestre</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-200">
          <div className="flex items-center gap-3 mb-6 opacity-80 uppercase tracking-widest text-xs font-black">
            <Wallet theme="outline" size="18" />
            Otros Conceptos
          </div>
          <div className="text-4xl font-black mb-2 tracking-tight">
            {formatCOP(payments.filter(p => p.category !== 'Pago de módulo' && p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0))}
          </div>
          <p className="text-blue-100 text-sm font-medium">Matrícula, certificaciones y otros</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-8 text-white shadow-xl shadow-orange-200">
          <div className="flex items-center gap-3 mb-6 opacity-80 uppercase tracking-widest text-xs font-black">
            <Attention theme="outline" size="18" />
            Saldo Pendiente
          </div>
          <div className="text-4xl font-black mb-2 tracking-tight">
            {formatCOP(Object.entries(pagosPorSemestre).reduce((acc, [sem, pagos]) => {
              const periodo = pagos.length > 0 ? (pagos[0].periodo || '2025-1') : '2025-1';
              const priceId = `${periodo}_${sem}`;
              const valorSem = semesterPrices[priceId] !== undefined ? semesterPrices[priceId] : 200000;
              const valorConDesc = valorSem - (valorSem * (descuento / 100));
              const totalPagadoSem = pagos.filter(p => p.category === 'Pago de módulo' && p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0);
              return acc + Math.max(0, valorConDesc - totalPagadoSem);
            }, 0))}
          </div>
          <p className="text-orange-100 text-sm font-medium">Costo académico total por liquidar</p>
        </div>
      </div>

      {/* Detalle por Semestre */}
      <div className="space-y-6">
        {Object.keys(pagosPorSemestre).length > 0 ? (
          Object.entries(pagosPorSemestre)
            .sort(([semA], [semB]) => semA.localeCompare(semB))
            .map(([semestre, pagosSemestre]) => {
              const periodo = pagosSemestre.length > 0 ? pagosSemestre[0].periodo : null;
              const priceId = periodo ? `${periodo}_${semestre}` : null;
              const valorSem = priceId && semesterPrices[priceId] !== undefined ? semesterPrices[priceId] : 200000;
              const valorConDesc = valorSem - (valorSem * (descuento / 100));
              const totalPagadoSem = pagosSemestre.filter(p => p.category === 'Pago de módulo' && p.status === 'completed').reduce((sum, p) => sum + Number(p.amount), 0);
              const saldoPendienteSem = Math.max(0, valorConDesc - totalPagadoSem);

              return (
                <PremiumCard key={semestre} title={`Semestre ${semestre}`} icon={Wallet}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Costo Neto</p>
                      <p className="text-xl font-black text-gray-900">{formatCOP(valorConDesc)}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pendiente</p>
                      <p className={`text-xl font-black ${saldoPendienteSem > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {formatCOP(saldoPendienteSem)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Historial de Transacciones</p>
                    {pagosSemestre.map((p, idx) => (
                      <div key={p.id || idx} className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-2xl bg-white border border-gray-100 hover:border-blue-200 transition-colors group gap-4">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Currency theme="outline" size="24" />
                          </div>
                          <div>
                            <h5 className="font-bold text-gray-900 leading-tight">{p.description || 'Pago de Cuota'}</h5>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${p.category === 'Pago de módulo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {p.category || 'Otros'}
                                {p.category === 'Pago de módulo' ? '' : ' (No aplica a saldo semestre)'}
                              </span>
                              <p className="text-xs font-semibold text-gray-400">
                                {p.date ? new Date(p.date.seconds ? p.date.seconds * 1000 : p.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Fecha no disponible'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0">
                          <div className="text-right">
                            <span className="text-lg font-black text-gray-900 block">{formatCOP(p.amount)}</span>
                            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Completado</span>
                          </div>
                          <button 
                            onClick={() => handlePrintFinanceReceipt(p)}
                            className="p-3 rounded-xl bg-gray-50 text-gray-400 hover:bg-[#23408e] hover:text-white transition-all shadow-sm group-hover:scale-105"
                          >
                            <Printer theme="outline" size="20" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </PremiumCard>
              );
            })
        ) : (
          <div className="p-12 text-center text-gray-400 font-bold bg-white rounded-3xl border border-gray-100">
            <Wallet theme="outline" size="48" className="mx-auto text-gray-200 mb-4" />
            No hay registros financieros disponibles.
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceSection;
