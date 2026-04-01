import React, { useRef } from 'react';

const FullAcademicReport = ({ studentInfo, notasPorModulo, findModule, getModuleSemester, calcularPromedioFinal }) => {
  const printRef = useRef();

  // Agrupar módulos asignados por semestre
  const modulosAgrupados = (studentInfo?.modulosAsignados || []).reduce((acc, modAsignado) => {
    const modDetails = findModule(modAsignado.id);
    if (!modDetails) return acc;
    const semestre = getModuleSemester(modDetails);
    if (!acc[semestre]) acc[semestre] = [];
    acc[semestre].push({ ...modDetails, ...modAsignado });
    return acc;
  }, {});

  const handlePrint = () => {
    window.print();
  };

  // Calcular promedio acumulado de la carrera
  const todasLasNotasFinales = Object.values(notasPorModulo).map(notas => {
    const prom = calcularPromedioFinal(notas);
    return parseFloat(prom.finalGrade);
  }).filter(n => !isNaN(n));
  
  const promedioAcumulado = todasLasNotasFinales.length > 0 
    ? (todasLasNotasFinales.reduce((a, b) => a + b, 0) / todasLasNotasFinales.length).toFixed(2)
    : '0.00';

  return (
    <div className="bg-white p-0 sm:p-2 max-w-4xl mx-auto print:p-0 print-area" ref={printRef}>
      {/* Header Institucional */}
      <div className="flex items-center justify-between border-b-2 border-gray-900 pb-4 mb-6 print:mb-8">
        <div className="flex items-center gap-4">
          <img src={process.env.PUBLIC_URL + '/assets/logoInstituto.jpg'} alt="Logo" className="w-14 h-14 object-contain" />
          <div className="border-l-2 border-gray-200 pl-4">
            <h1 className="text-lg font-black text-[#23408e] leading-tight print:text-black">INSTITUTO TÉCNICO LABORAL</h1>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight -mt-0.5 print:text-black">ATUCSARA</h2>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] -mt-0.5">Registro Académico Global</p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="bg-gray-900 text-white px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest mb-2 print:bg-black print:text-white">
            Certificado Informativo
          </div>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-[#ffd600] text-[#23408e] rounded-lg font-black shadow-sm hover:scale-105 transition-all text-[11px] border border-[#23408e] print:hidden"
          >
            IMPRIMIR RECOR RÉDORD
          </button>
          <span className="text-[8px] text-gray-400 font-bold mt-1 uppercase tracking-tighter print:text-black">Generado: {new Date().toLocaleDateString('es-CO')}</span>
        </div>
      </div>

      {/* Información del Estudiante */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 border border-gray-100 rounded-2xl p-6 bg-gray-50/30 print:border-black print:bg-white print:p-4">
        <div>
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-black">Estudiante</p>
          <h3 className="text-xl font-black text-gray-900 uppercase leading-tight print:text-black">
            {studentInfo?.fullName || `${studentInfo?.name || ''} ${studentInfo?.lastName || ''}`.trim()}
          </h3>
          <p className="text-sm font-bold text-[#23408e] mt-1 print:text-black">{studentInfo?.career}</p>
        </div>
        <div className="flex flex-col md:items-end justify-center">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-black">Promedio Acumulado</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-[#23408e] print:text-black">{promedioAcumulado}</span>
            <span className="text-[10px] font-black text-gray-400 uppercase print:text-black">/ 5.0</span>
          </div>
        </div>
      </div>

      {/* Cuerpo del Reporte - Agrupado por semestres */}
      <div className="space-y-10">
        {Object.entries(modulosAgrupados)
          .sort(([semA], [semB]) => semA.localeCompare(semB))
          .map(([semestre, modulos]) => (
            <div key={semestre} className="print:break-inside-avoid">
              <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-2 print:border-black">
                <span className="px-3 py-1 bg-[#23408e] text-white text-[10px] font-black rounded-lg print:bg-black print:text-white uppercase tracking-widest">
                  Semestre {semestre}
                </span>
                <div className="h-px bg-gray-100 flex-1 print:hidden" />
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-100 print:border-black">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 print:bg-gray-100 print:border-black">
                      <th className="w-1/2 px-4 py-3 text-[9px] font-black text-gray-500 uppercase tracking-wider print:text-black">Módulo Académico</th>
                      <th className="w-1/4 px-4 py-3 text-[9px] font-black text-gray-500 uppercase tracking-wider text-center print:text-black">Estado</th>
                      <th className="w-1/4 px-4 py-3 text-[9px] font-black text-gray-500 uppercase tracking-wider text-right print:text-black">Promedio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 print:divide-black">
                    {modulos.map((mod, i) => {
                      const notas = notasPorModulo[mod.nombre] || [];
                      const promedio = notas.length > 0 ? calcularPromedioFinal(notas) : null;
                      const isAprobado = mod.estado === 'aprobado' || (promedio && parseFloat(promedio.finalGrade) >= 3.0);

                      return (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4">
                            <p className="font-bold text-[11px] text-gray-900 uppercase leading-tight print:text-black">{mod.nombre}</p>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border ${
                              isAprobado ? 'bg-green-50 text-green-700 border-green-100 print:text-black' : 
                              mod.estado === 'cursando' ? 'bg-blue-50 text-blue-700 border-blue-100 print:text-black' :
                              'bg-gray-50 text-gray-400 border-gray-100 print:text-black'
                            }`}>
                              {mod.estado || 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            {promedio ? (
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-black text-gray-900 print:text-black">{promedio.finalGrade}</span>
                                {promedio.isHabilitacion && (
                                  <span className="text-[7px] font-black text-red-600 uppercase tracking-tighter print:text-black">Habilitación</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300 font-bold print:text-black">--</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
      </div>

      <div className="mt-16 pt-8 border-t border-gray-100 text-center print:border-black print:mt-12">
        <p className="text-[8px] text-gray-400 font-black uppercase tracking-[0.4em] print:text-black">
          Este documento es informativo y refleja el historial académico a la fecha.
        </p>
      </div>
    </div>
  );
};

export default FullAcademicReport;
