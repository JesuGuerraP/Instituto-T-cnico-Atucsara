import React, { useRef } from 'react';

const calcularPromedioFinal = (notas) => {
  const notaHabilitacion = notas.find(n => n.groupId === 'HABILITACION' || n.groupName === 'HABILITACION');
  if (notaHabilitacion) return { finalGrade: parseFloat(notaHabilitacion.grade).toFixed(2), isHabilitacion: true };
  
  const getNota = (grupo) => {
    const grupoNotas = notas.filter(n => n.groupId === grupo || n.groupName === grupo);
    if (!grupoNotas.length) return null;
    return grupoNotas.reduce((acc, n) => acc + parseFloat(n.grade), 0) / grupoNotas.length;
  };

  const act1 = getNota('ACTIVIDADES_1');
  const act2 = getNota('ACTIVIDADES_2');
  const evalFinal = getNota('EVALUACION_FINAL');
  const p1 = act1 != null ? act1 : 0;
  const p2 = act2 != null ? act2 : 0;
  const pf = evalFinal != null ? evalFinal : 0;
  const promedio = (p1 * 0.3 + p2 * 0.3 + pf * 0.4);
  
  return { finalGrade: promedio.toFixed(2), isHabilitacion: false };
};

const StudentGradeReport = ({ grades, onClose, studentInfo }) => {
  const printRef = useRef();
  const moduleName = grades[0]?.moduleName || 'Sin módulo';
  const allNotas = grades.map(g => parseFloat(g.grade));
  
  const stats = {
    avg: allNotas.length ? (allNotas.reduce((a, b) => a + b, 0) / allNotas.length).toFixed(2) : '0.00',
    max: allNotas.length ? Math.max(...allNotas).toFixed(1) : '0.0',
    min: allNotas.length ? Math.min(...allNotas).toFixed(1) : '0.0'
  };

  const { finalGrade, isHabilitacion } = calcularPromedioFinal(grades);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white p-0 sm:p-2 max-w-4xl mx-auto print:p-0 print:mx-0 print:max-w-full print-area" ref={printRef}>
      {/* Header Institucional - Minimalista y Profesional */}
      <div className="flex items-center justify-between border-b-2 border-gray-900 pb-4 mb-6 print:mb-8">
        <div className="flex items-center gap-4">
          <img src={process.env.PUBLIC_URL + '/assets/logoInstituto.jpg'} alt="Logo" className="w-14 h-14 object-contain" />
          <div className="border-l-2 border-gray-200 pl-4">
            <h1 className="text-lg font-black text-[#23408e] leading-tight print:text-black">INSTITUTO TÉCNICO LABORAL</h1>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight -mt-0.5 print:text-black">ATUCSARA</h2>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] -mt-0.5">Innovación y Excelencia Educativa</p>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="bg-gray-900 text-white px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest mb-2 print:bg-black print:text-white">
            Reporte Académico
          </div>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-[#ffd600] text-[#23408e] rounded-lg font-black shadow-sm hover:scale-105 transition-all text-[11px] border border-[#23408e] print:hidden"
          >
            IMPRIMIR DOCUMENTO
          </button>
          <span className="text-[8px] text-gray-400 font-bold mt-1 uppercase tracking-tighter print:text-black">Generado: {new Date().toLocaleDateString('es-CO')}</span>
        </div>
      </div>

      {/* Grid de Información Principal - Diseño más limpio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 mb-8 border border-gray-200 rounded-xl overflow-hidden print:border-black">
        <div className="p-4 border-b md:border-b-0 md:border-r border-gray-100 print:border-black">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-black">Datos del Estudiante</p>
          <h3 className="text-sm font-black text-gray-900 uppercase leading-tight">
            {studentInfo?.fullName || `${studentInfo?.name || ''} ${studentInfo?.lastName || ''}`.trim()}
          </h3>
          <p className="text-[10px] font-bold text-[#23408e] mt-1 print:text-black">{studentInfo?.career}</p>
        </div>
        <div className="p-4 border-b md:border-b-0 md:border-r border-gray-100 print:border-black">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-black">Módulo Académico</p>
          <h3 className="text-sm font-black text-gray-900 leading-tight uppercase print:text-black break-words">{moduleName}</h3>
          <p className="text-[10px] font-bold text-gray-500 mt-1 print:text-black">Periodo Lectivo: Actual</p>
        </div>
        <div className="p-4 bg-gray-50 flex flex-col justify-center items-center print:bg-white print:border-l print:border-black">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-black">Calificación Final</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#23408e] print:text-black">{finalGrade}</span>
            {isHabilitacion && (
              <span className="text-[9px] font-black text-red-600 border border-red-600 px-1 rounded print:text-black print:border-black">
                HABILITACIÓN
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Resumen de Desempeño - Minimalista */}
      <div className="grid grid-cols-3 gap-6 mb-8 px-2">
        <div className="text-center border-b-2 border-gray-50 pb-2 print:border-black">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-black">Promedio Módulo</p>
          <p className="text-lg font-black text-gray-900 print:text-black">{stats.avg}</p>
        </div>
        <div className="text-center border-b-2 border-gray-50 pb-2 print:border-black">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-black">Mínima lograda</p>
          <p className="text-lg font-black text-gray-900 print:text-black">{stats.min}</p>
        </div>
        <div className="text-center border-b-2 border-gray-50 pb-2 print:border-black">
          <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 print:text-black">Máxima lograda</p>
          <p className="text-lg font-black text-gray-900 print:text-black">{stats.max}</p>
        </div>
      </div>

      {/* Detalle de Notas - Tabla Técnica y Limpia */}
      <div className="mb-10 border border-gray-200 rounded-lg overflow-hidden print:border-black">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200 print:bg-gray-200 print:border-black">
              <th className="w-1/3 px-4 py-2.5 text-[9px] font-black text-gray-500 uppercase tracking-wider print:text-black print:w-[40%]">Actividad de Evaluación</th>
              <th className="w-1/4 px-4 py-2.5 text-[9px] font-black text-gray-500 uppercase tracking-wider print:text-black print:w-[25%]">Grupo / Corte</th>
              <th className="w-1/6 px-4 py-2.5 text-[9px] font-black text-gray-500 uppercase tracking-wider text-center print:text-black print:w-[15%]">Nota</th>
              <th className="w-1/4 px-4 py-2.5 text-[9px] font-black text-gray-500 uppercase tracking-wider text-right print:text-black print:w-[20%]">Fecha Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 print:divide-black">
            {grades.map((n, i) => (
              <tr key={i} className="print:break-inside-avoid">
                <td className="px-4 py-3">
                  <p className="font-bold text-[11px] text-gray-900 print:text-black">{n.activityName || 'Evaluación'}</p>
                  <p className="text-[8px] text-gray-400 font-bold print:text-black">Prof: {n.teacherName || 'Institucional'}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[9px] font-bold text-gray-500 uppercase print:text-black">{n.groupName || n.groupId || '-'}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-base font-black ${parseFloat(n.grade) >= 3 ? 'text-gray-900' : 'text-red-600'} print:text-black`}>
                    {n.grade}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[10px] font-bold text-gray-400 print:text-black">
                    {n.date ? (n.date.seconds ? new Date(n.date.seconds * 1000).toLocaleDateString('es-CO') : new Date(n.date).toLocaleDateString('es-CO')) : '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      
      <div className="mt-8 pt-6 border-t border-gray-100 text-center print:border-black print:mt-10 print:mb-0 print:pb-0">
        <p className="text-[7px] text-gray-400 font-black uppercase tracking-[0.4em] print:text-black">
          Este documento es informativo y no constituye un certificado oficial de notas.
        </p>
      </div>
    </div>
  );
};

export default StudentGradeReport;
