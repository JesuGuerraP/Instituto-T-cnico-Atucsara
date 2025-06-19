import React, { useRef } from 'react';

const getUnique = (arr, key) => [...new Map(arr.map(item => [item[key], item])).values()];

// Calcula el promedio ponderado final según los grupos
const calcularPromedioFinal = (notas) => {
  // Buscar la nota de cada grupo
  const getNota = (grupo) => {
    // Puede haber varias, tomar el promedio si hay más de una
    const grupoNotas = notas.filter(n => n.groupId === grupo || n.groupName === grupo);
    if (!grupoNotas.length) return null;
    return grupoNotas.reduce((acc, n) => acc + parseFloat(n.grade), 0) / grupoNotas.length;
  };
  const act1 = getNota('ACTIVIDADES_1');
  const act2 = getNota('ACTIVIDADES_2');
  const evalFinal = getNota('EVALUACION_FINAL');
  // Si falta alguna, se considera 0
  const p1 = act1 != null ? act1 : 0;
  const p2 = act2 != null ? act2 : 0;
  const pf = evalFinal != null ? evalFinal : 0;
  // Ponderación
  return (p1 * 0.3 + p2 * 0.3 + pf * 0.4).toFixed(2);
};

const getStats = (grades) => {
  if (!grades.length) return { avg: 0, max: 0, min: 0, total: 0 };
  const notas = grades.map(g => parseFloat(g.grade));
  return {
    avg: (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(2),
    max: Math.max(...notas).toFixed(1),
    min: Math.min(...notas).toFixed(1),
    total: notas.length
  };
};

const GradeReport = ({ grades, onClose }) => {
  const printRef = useRef();

  const moduleName = grades[0]?.moduleName || 'Sin módulo';
  const students = getUnique(grades, 'studentId');
  const allNotas = grades.map(g => parseFloat(g.grade));
  const resumenModulo = {
    totalAlumnos: students.length,
    promedioGeneral: allNotas.length ? (allNotas.reduce((a, b) => a + b, 0) / allNotas.length).toFixed(2) : '0.00',
    notaMaxima: allNotas.length ? Math.max(...allNotas).toFixed(1) : '0.0',
    notaMinima: allNotas.length ? Math.min(...allNotas).toFixed(1) : '0.0'
  };

  const notasPorAlumno = students.map(stu => ({
    ...stu,
    notas: grades.filter(g => g.studentId === stu.studentId),
    fullName: `${grades.find(g => g.studentId === stu.studentId)?.studentName || ''}`
  }));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 md:p-8 max-w-5xl w-full mx-auto border-l-4 border-[#009245]" ref={printRef}>
      {/* Botón imprimir */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold bg-[#23408e] text-white px-3 py-2 rounded w-full">
          Informe de Notas por Módulo: {moduleName}
        </h2>
        <button
          onClick={handlePrint}
          className="ml-4 px-4 py-2 bg-[#ffd600] text-[#23408e] rounded hover:bg-[#23408e] hover:text-white border border-[#23408e] font-semibold print:hidden"
        >
          Imprimir
        </button>
      </div>
      {onClose && (
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl print:hidden"
          onClick={onClose}
        >
          &times;
        </button>
      )}

      {/* Resumen general */}
      <div className="mb-4">
        <h3 className="font-semibold text-lg mb-2 text-[#009245]">Resumen General del Módulo</h3>
        <table className="min-w-full border mb-2">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left">Total Alumnos</th>
              <th className="border px-2 py-1 text-left">Promedio General</th>
              <th className="border px-2 py-1 text-left">Nota Máxima</th>
              <th className="border px-2 py-1 text-left">Nota Mínima</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-2 py-1">{resumenModulo.totalAlumnos}</td>
              <td className="border px-2 py-1">{resumenModulo.promedioGeneral}</td>
              <td className="border px-2 py-1">{resumenModulo.notaMaxima}</td>
              <td className="border px-2 py-1">{resumenModulo.notaMinima}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Panel por alumno */}
      {notasPorAlumno.map(stu => {
        const stats = getStats(stu.notas);
        const promedioFinal = calcularPromedioFinal(stu.notas);
        return (
          <div key={stu.studentId} className="mb-6 border rounded bg-[#f5f7fa]">
            <div className="font-semibold bg-[#e3eafc] px-3 py-2 rounded-t text-[#23408e]">
              {stu.fullName}
            </div>
            <div className="p-3">
              <div className="mb-2 font-bold text-[#009245]">Promedio Final del Módulo: <span className="inline-block px-2 py-1 rounded bg-[#e3fcec] text-[#23408e]">{promedioFinal}</span></div>
              <table className="min-w-full border mb-2">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left">Promedio</th>
                    <th className="border px-2 py-1 text-left">Nota Máxima</th>
                    <th className="border px-2 py-1 text-left">Nota Mínima</th>
                    <th className="border px-2 py-1 text-left">Total Actividades</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-2 py-1">{stats.avg}</td>
                    <td className="border px-2 py-1">{stats.max}</td>
                    <td className="border px-2 py-1">{stats.min}</td>
                    <td className="border px-2 py-1">{stats.total}</td>
                  </tr>
                </tbody>
              </table>
              <div className="font-semibold mb-1 text-[#009245]">Detalle de Notas</div>
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1 text-left">Actividad</th>
                      <th className="border px-2 py-1 text-left">Grupo</th>
                      <th className="border px-2 py-1 text-left">Nota</th>
                      <th className="border px-2 py-1 text-left">Fecha</th>
                      <th className="border px-2 py-1 text-left">Profesor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stu.notas.map((n, i) => (
                      <tr key={i}>
                        <td className="border px-2 py-1">{n.activityName}</td>
                        <td className="border px-2 py-1">{n.groupName}</td>
                        <td className="border px-2 py-1">{n.grade}</td>
                        <td className="border px-2 py-1">{n.date}</td>
                        <td className="border px-2 py-1">{n.teacherName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GradeReport;