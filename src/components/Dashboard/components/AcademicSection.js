import React, { useState } from 'react';
import { 
  Book, 
  Calendar, 
  Printer, 
  Down, 
  Up,
  Search,
  CheckOne,
  Attention
} from '@icon-park/react';
import PremiumCard from './PremiumCard';
import Modal from 'react-modal';
import StudentGradeReport from '../../Grades/StudentGradeReport';
import FullAcademicReport from '../../Grades/FullAcademicReport';

const AcademicSection = ({ 
  studentInfo,
  notasPorModulo, 
  findModuleByName, 
  getModuleSemester, 
  calcularPromedioFinal,
  notasPorModuloYGrupo,
  studentAttendance,
  findModule,
  careerSeminarios,
  toggleSemester,
  openSemesters,
  courseModules = []
}) => {
  const [selectedScope, setSelectedScope] = useState('career');
  const [modulosNotasVisibles, setModulosNotasVisibles] = useState({});
  const [showGradeReportModal, setShowGradeReportModal] = useState(false);
  const [showFullReportModal, setShowFullReportModal] = useState(false);
  const [selectedModuleForReport, setSelectedModuleForReport] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  
  // Nuevo: Efecto para autoseleccionar ámbito si el estudiante solo tiene cursos
  React.useEffect(() => {
    if ((!studentInfo?.career || studentInfo?.career === '—') && courseModules.length > 0) {
      setSelectedScope('course');
    }
  }, [studentInfo, courseModules]);

  const toggleNotasModulo = (modulo) => {
    setModulosNotasVisibles(prev => ({ ...prev, [modulo]: !prev[modulo] }));
  };

  const handleOpenGradeReport = (modulo) => {
    setSelectedModuleForReport(modulo);
    setShowGradeReportModal(true);
  };

  const handleCloseGradeReport = () => {
    setShowGradeReportModal(false);
    setSelectedModuleForReport(null);
  };

  const handleOpenFullReport = () => {
    setShowFullReportModal(true);
  };

  const handleCloseFullReport = () => {
    setShowFullReportModal(false);
  };

  // Agrupar módulos de CARRERA por semestre
  const modulosCarreraAgrupados = (studentInfo?.modulosAsignados || []).reduce((acc, modAsignado) => {
    const modDetails = findModule(modAsignado.id);
    const semestre = modDetails ? getModuleSemester(modDetails) : 'General';
    if (!acc[semestre]) acc[semestre] = [];
    acc[semestre].push({ 
      id: modAsignado.id, 
      nombre: modAsignado.nombre || modDetails?.nombre || 'Módulo', 
      ...modDetails, 
      ...modAsignado 
    });
    return acc;
  }, {});

  // Agrupar módulos de CURSOS (por el nombre del curso o solo una lista)
  const modulosCursoAgrupados = courseModules.reduce((acc, mod) => {
    const courseName = mod.courseName || 'Mi Curso';
    if (!acc[courseName]) acc[courseName] = [];
    acc[courseName].push(mod);
    return acc;
  }, {});

  const currentModulosAgrupados = selectedScope === 'career' ? modulosCarreraAgrupados : modulosCursoAgrupados;

  // Agrupar asistencia por semestre
  const asistenciaPorModulo = {};
  studentAttendance.forEach(rec => {
    const mod = rec.moduleName;
    if (!mod) return;
    if (!asistenciaPorModulo[mod]) {
      asistenciaPorModulo[mod] = { attendance: {}, moduleName: mod, recs: [] };
    }
    Object.entries(rec.attendance || {}).forEach(([dateStr, val]) => {
      asistenciaPorModulo[mod].attendance[dateStr] = val;
    });
    asistenciaPorModulo[mod].recs.push(rec);
  });

  const asistenciaPorSemestre = Object.values(asistenciaPorModulo).reduce((acc, modRec) => {
    const moduleDetails = findModuleByName(modRec.moduleName) || 
                         (courseModules.find(m => m.nombre === modRec.moduleName)) ||
                         (studentInfo?.modulosAsignados?.find(m => m.nombre === modRec.moduleName));
    
    // Si no hay detalles ni del nombre, lo categorizamos como carrera por defecto para evitar que desaparezca
    const isActuallyCourse = moduleDetails?.isCourse || modRec.scope === 'course';
    
    // Filtrar por ámbito seleccionado de forma más elástica
    if (selectedScope === 'career' && isActuallyCourse) return acc;
    if (selectedScope === 'course' && !isActuallyCourse) return acc;
    if (!moduleDetails && selectedScope === 'course') return acc; // Si realmente no hay nada y estamos en curso, lo dejamos

    const semester = moduleDetails ? getModuleSemester(moduleDetails) : 'General';
    if (!acc[semester]) acc[semester] = [];
    acc[semester].push(modRec);
    return acc;
  }, {});

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-[#23408e] tracking-tight">Registro Académico</h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Instituto Técnico Atucsara</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {courseModules.length > 0 && (
            <div className="flex bg-gray-100 p-1 rounded-xl mr-2">
              <button 
                onClick={() => setSelectedScope('career')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${selectedScope === 'career' ? 'bg-white text-[#23408e] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Carrera
              </button>
              <button 
                onClick={() => setSelectedScope('course')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${selectedScope === 'course' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Cursos
              </button>
            </div>
          )}
          <button 
            onClick={handleOpenFullReport}
            className="flex items-center gap-2 px-4 py-2 bg-[#23408e] text-white rounded-xl shadow-lg hover:shadow-blue-200 transition-all font-bold text-sm"
          >
            <Printer theme="outline" size="18" />
            Descargar Reporte Completo
          </button>
        </div>
      </div>

      {/* Calificaciones y Módulos */}
      <div className="space-y-6">
        {Object.keys(currentModulosAgrupados).length > 0 ? (
          Object.entries(currentModulosAgrupados)
            .sort(([semA], [semB]) => semA.localeCompare(semB))
            .map(([semestre, modulos]) => (
              <div key={semestre} className="mb-8">
                <button
                  onClick={() => toggleSemester(`grades-${semestre}`)}
                  className="w-full flex items-center justify-between p-5 bg-white rounded-2xl hover:shadow-md transition-all group border border-gray-100"
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner ${selectedScope === 'career' ? 'bg-blue-50 text-[#23408e]' : 'bg-emerald-50 text-emerald-600'}`}>
                      {selectedScope === 'career' ? semestre : <Book size="20" />}
                    </div>
                    <div className="text-left">
                      <h4 className="font-black text-gray-900 text-lg">
                        {selectedScope === 'career' ? `Semestre ${semestre}` : semestre}
                      </h4>
                      <p className={`text-[9px] font-black uppercase tracking-[0.15em] leading-none mt-1 ${selectedScope === 'career' ? 'text-blue-500' : 'text-emerald-500'}`}>
                        {selectedScope === 'career' ? 'Calificaciones Académicas' : 'Módulos del Curso'}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        {modulos.length} Módulos inscritos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`hidden md:inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                        selectedScope === 'career' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                      {modulos.filter(m => m.estado === 'aprobado').length} Aprobados
                    </span>
                    <Down theme="outline" size="20" className={`text-gray-400 transform transition-transform duration-300 ${openSemesters[`grades-${semestre}`] ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {openSemesters[`grades-${semestre}`] && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in">
                    {modulos.map((mod) => {
                      const notas = notasPorModulo[mod.nombre] || [];
                      const promedio = notas.length > 0 ? calcularPromedioFinal(notas) : null;
                      
                      // Unificar normalización de estado
                      const status = (mod.estado || 'pendiente').toLowerCase();
                      const isAprobado = status === 'aprobado' || (promedio && parseFloat(promedio.finalGrade) >= 3.0);
                      
                      return (
                        <div key={mod.id} className="group bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300 relative overflow-hidden">
                          {/* Status Indicator Bar */}
                          <div className={`absolute top-0 left-0 w-full h-1.5 ${
                            status === 'aprobado' ? 'bg-emerald-500' : 
                            status === 'reprobado' ? 'bg-red-500' : 
                            status === 'cursando' ? 'bg-blue-500' : 
                            'bg-gray-200'
                          }`} />
                          
                          <div className="flex justify-between items-start mb-6 pt-2">
                            <div className="flex-1 pr-4">
                              <h5 className="font-extrabold text-gray-900 text-lg leading-tight mb-2 group-hover:text-[#23408e] transition-colors">
                                {mod.nombre}
                              </h5>
                              <div className="flex flex-wrap gap-2">
                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                                  status === 'aprobado' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                  status === 'reprobado' ? 'bg-red-50 text-red-700 border-red-100' :
                                  status === 'cursando' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                  'bg-gray-50 text-gray-400 border-gray-100'
                                }`}>
                                  {status}
                                </span>
                              </div>
                            </div>
                            
                            {promedio && (
                              <div className="flex flex-col items-end">
                                <div className={`text-3xl font-black px-4 py-2 rounded-2xl shadow-premium border-2 ${
                                  isAprobado ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'
                                }`}>
                                  {promedio.finalGrade}
                                </div>
                                {promedio.isHabilitacion && (
                                  <span className="mt-2 px-2 py-1 bg-orange-500 text-white text-[9px] font-black rounded-md shadow-sm animate-pulse">
                                    HABILITACIÓN
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {notas.length > 0 ? (
                              <>
                                <button 
                                  onClick={() => toggleNotasModulo(mod.nombre)}
                                  className="flex-1 py-3 rounded-2xl bg-gray-50 text-gray-500 text-xs font-black uppercase tracking-widest hover:bg-[#23408e] hover:text-white transition-all border border-gray-100 shadow-sm"
                                >
                                  {modulosNotasVisibles[mod.nombre] ? 'Ocultar detalles' : 'Ver actividades'}
                                </button>
                                <button 
                                  onClick={() => handleOpenGradeReport(mod.nombre)}
                                  className="p-3 rounded-2xl bg-blue-50 text-[#23408e] border border-blue-100 hover:bg-[#23408e] hover:text-white transition-all shadow-sm"
                                  title="Imprimir reporte"
                                >
                                  <Printer theme="outline" size="20" />
                                </button>
                              </>
                            ) : (
                              <div className="w-full py-3 rounded-2xl bg-gray-50 text-gray-400 text-[10px] font-bold text-center border border-gray-100 border-dashed">
                                Sin calificaciones registradas
                              </div>
                            )}
                          </div>

                          {modulosNotasVisibles[mod.nombre] && (
                            <div className="mt-6 space-y-3 pt-6 border-t border-gray-100 border-dashed animate-in">
                              <h6 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Desglose de Actividades</h6>
                              {Object.entries(notasPorModuloYGrupo[mod.nombre] || {}).flatMap(([grupo, notasGrupo]) =>
                                notasGrupo.map((nota, idx) => (
                                  <div key={nota.id || idx} className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full shadow-sm ${parseFloat(nota.grade) >= 3 ? 'bg-green-400' : 'bg-red-400'}`} />
                                      <div>
                                        <p className="text-gray-800 font-bold text-sm leading-none">{nota.activityName || 'Actividad'}</p>
                                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider mt-1">{grupo.replace(/_/g, ' ')}</p>
                                      </div>
                                    </div>
                                    <span className={`text-base font-black ${parseFloat(nota.grade) >= 3 ? 'text-gray-900' : 'text-red-500'}`}>{nota.grade}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
        ) : (
          <div className="p-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <Book theme="outline" size="64" className="mx-auto text-gray-100 mb-6" />
            <p className="text-gray-400 font-black text-lg">No hay módulos registrados en tu carrera.</p>
          </div>
        )}
      </div>

      {/* Seminarios obligatorios — Panel mejorado con progreso individual */}
      {careerSeminarios && careerSeminarios.length > 0 && (
        <PremiumCard className="mt-12 overflow-hidden !p-0 border-none shadow-none bg-transparent">
          <button
            onClick={() => toggleSemester('all-seminarios')}
            className="w-full flex items-center justify-between p-6 bg-white border border-gray-100 rounded-3xl hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all">
                <Book theme="outline" size="26" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-black text-gray-900 leading-tight">Seminarios Obligatorios</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                  {careerSeminarios.length} Seminarios · Solo participación
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                openSemesters['all-seminarios'] ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-50 text-gray-400 border-gray-100'
              }`}>
                {openSemesters['all-seminarios'] ? 'Ocultar' : 'Ver Todos'}
              </span>
              <Down theme="outline" size="22" className={`text-gray-300 transform transition-transform duration-500 ${openSemesters['all-seminarios'] ? 'rotate-180 text-purple-600' : ''}`} />
            </div>
          </button>

          {openSemesters['all-seminarios'] && (
            <div className="mt-6 animate-in slide-in-from-top-4 duration-500">
              {/* Barra de progreso general */}
              {(() => {
                const aprobados = careerSeminarios.filter(s => {
                  const ss = studentInfo?.seminarios?.find(e => e.id === s.id || e.nombre === s.nombre);
                  return (ss?.estado || '').toLowerCase() === 'aprobado';
                }).length;
                const total = careerSeminarios.length;
                const pct = total > 0 ? Math.round((aprobados / total) * 100) : 0;
                return (
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-5 flex items-center gap-6">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-black text-gray-500 uppercase tracking-wider">Progreso de Seminarios</span>
                        <span className="text-xs font-black text-purple-700">{aprobados}/{total} aprobados</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-3xl font-black text-purple-700 shrink-0">{pct}%</div>
                  </div>
                );
              })()}

              {/* Cards de cada seminario */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {careerSeminarios.map((seminario) => {
                  const studentSem = studentInfo?.seminarios?.find(
                    s => s.id === seminario.id || s.nombre === seminario.nombre
                  );
                  const estado = (studentSem?.estado || 'pendiente').toLowerCase();
                  const isAprobado = estado === 'aprobado';

                  return (
                    <div key={seminario.id} className="p-6 rounded-3xl bg-white border border-gray-100 hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
                      {/* Barra lateral de estado */}
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${isAprobado ? 'bg-emerald-400' : 'bg-amber-300'}`} />
                      <div className="flex justify-between items-start mb-4 pl-2">
                        <div className="p-2 rounded-xl bg-gray-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all">
                          <Book theme="outline" size="18" />
                        </div>
                        <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase border tracking-tighter ${
                          isAprobado
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {isAprobado ? '✓ Aprobado' : '⏳ Pendiente'}
                        </span>
                      </div>
                      <h5 className="font-black text-gray-900 text-sm leading-tight mb-4 pl-2 group-hover:text-purple-700 transition-colors">
                        {seminario.nombre}
                      </h5>
                      <div className="space-y-2 pt-4 border-t border-gray-50 border-dashed pl-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Profesor</p>
                          <p className="text-[10px] text-gray-900 font-black truncate max-w-[140px]">{seminario.profesor || 'Sin asignar'}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Semestre</p>
                          <p className="text-[10px] text-gray-900 font-black">{seminario.semestre || '-'}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Horas</p>
                          <p className="text-[10px] text-gray-900 font-black">{seminario.horas || 20}h</p>
                        </div>
                        {isAprobado && studentSem?.fechaAprobacion && (
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Aprobado</p>
                            <p className="text-[10px] text-emerald-700 font-black">
                              {new Date(studentSem.fechaAprobacion).toLocaleDateString('es-CO')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </PremiumCard>
      )}

      {/* Asistencia */}
      <PremiumCard title="Registro de Asistencia" icon={Calendar} className="mt-12">
        {Object.keys(asistenciaPorSemestre).length > 0 ? (
          Object.entries(asistenciaPorSemestre)
            .sort(([semA], [semB]) => semA.localeCompare(semB))
            .map(([semestre, modulos]) => (
              <div key={semestre} className="mb-6 last:mb-0">
                <button
                  onClick={() => toggleSemester(`attendance-${semestre}`)}
                  className="w-full flex items-center justify-between p-4 bg-green-50/50 rounded-2xl hover:bg-green-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-green-600">
                      {semestre}
                    </span>
                    <div>
                      <h4 className="font-bold text-gray-800">Semestre {semestre}</h4>
                      <p className="text-[9px] font-black text-green-500 uppercase tracking-[0.15em] leading-none mt-1">Seguimiento de Asistencias</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-white text-xs font-bold text-gray-400 group-hover:text-green-600 transition-colors border border-gray-100">
                      {modulos.length} Módulos
                    </span>
                  </div>
                  <Down theme="outline" size="20" className={`text-gray-400 transform transition-transform ${openSemesters[`attendance-${semestre}`] ? 'rotate-180' : ''}`} />
                </button>

                {openSemesters[`attendance-${semestre}`] && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Módulo</th>
                          <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Clases</th>
                          <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                          <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {modulos.map((modRec) => {
                          const total = Object.keys(modRec.attendance).length;
                          const asistidos = Object.values(modRec.attendance).filter(v => v === true).length;
                          const porcentaje = Math.round((asistidos / total) * 100) || 0;
                          
                          return (
                            <tr key={modRec.moduleName} className="hover:bg-gray-50 transition-colors group">
                              <td className="px-6 py-4">
                                <span className="font-bold text-gray-900">{modRec.moduleName}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="font-black text-gray-500">{total}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-full max-w-[80px] h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                    <div 
                                      className={`h-full rounded-full ${porcentaje >= 80 ? 'bg-green-500' : 'bg-orange-500'}`}
                                      style={{ width: `${porcentaje}%` }}
                                    />
                                  </div>
                                  <span className={`text-[10px] font-black ${porcentaje >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                                    {porcentaje}% cumplimiento
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => setDetailRecord({ ...modRec.recs[0], moduleName: modRec.moduleName, attendance: modRec.attendance })}
                                  className="p-2 rounded-xl text-blue-500 hover:bg-blue-50 transition-all"
                                >
                                  <Search theme="outline" size="18" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
        ) : (
          <div className="p-12 text-center text-gray-400 font-bold">
            <Calendar theme="outline" size="48" className="mx-auto text-gray-200 mb-4" />
            No hay registros de asistencia.
          </div>
        )}
      </PremiumCard>

      {/* Modal Detalle Asistencia */}
      {detailRecord && (
        <Modal
          isOpen={!!detailRecord}
          onRequestClose={() => setDetailRecord(null)}
          className="modal-center max-w-lg w-full p-0 outline-none"
          overlayClassName="overlay-center bg-black/40 backdrop-blur-sm"
        >
          <div className="bg-white rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in">
            {/* Header Compacto */}
            <div className="p-5 border-b border-gray-100 bg-white shrink-0">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Registro Detallado</h2>
                  <p className="text-xl font-black text-[#23408e] leading-tight truncate max-w-[300px]">{detailRecord.moduleName}</p>
                </div>
                <button 
                  onClick={() => setDetailRecord(null)}
                  className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all font-bold text-2xl flex items-center justify-center shadow-sm"
                >
                  &times;
                </button>
              </div>

              {/* Stats Ribbon - Horizontal & Clean */}
              <div className="bg-blue-50/50 rounded-2xl p-3 flex items-center justify-around border border-blue-100/50">
                {(() => {
                  const dates = Object.values(detailRecord.attendance);
                  const attended = dates.filter(v => v === true).length;
                  const total = dates.length;
                  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
                  
                  return (
                    <>
                      <div className="text-center group">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Clases</p>
                        <p className="text-base font-black text-gray-900">{total}</p>
                      </div>
                      <div className="w-px h-6 bg-blue-100" />
                      <div className="text-center">
                        <p className="text-[8px] font-black text-green-500 uppercase tracking-widest mb-0.5">Asistió</p>
                        <p className="text-base font-black text-green-600">{attended}</p>
                      </div>
                      <div className="w-px h-6 bg-blue-100" />
                      <div className="text-center">
                        <p className="text-[8px] font-black text-red-500 uppercase tracking-widest mb-0.5">Faltó</p>
                        <p className="text-base font-black text-red-600">{total - attended}</p>
                      </div>
                      <div className="w-px h-6 bg-blue-100" />
                      <div className="text-center">
                        <p className="text-[8px] font-black text-[#23408e] uppercase tracking-widest mb-0.5">Promedio</p>
                        <div className="flex items-center gap-1 justify-center">
                          <p className="text-base font-black text-[#23408e]">{percentage}%</p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            
            {/* Listado con Scroll - Altura controlada */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-gray-50/30">
              <div className="space-y-4">
                {(() => {
                  const sortedDates = Object.keys(detailRecord.attendance).sort((a, b) => new Date(b) - new Date(a));
                  const months = sortedDates.reduce((acc, date) => {
                    const monthName = new Date(date).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
                    if (!acc[monthName]) acc[monthName] = [];
                    acc[monthName].push(date);
                    return acc;
                  }, {});

                  return Object.entries(months).map(([month, dates]) => (
                    <div key={month} className="space-y-2">
                      <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 mb-1">{month}</h4>
                      <div className="grid grid-cols-1 gap-1.5">
                        {dates.map(date => (
                          <div key={date} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all group">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${detailRecord.attendance[date] ? 'bg-green-50 text-green-500 group-hover:bg-green-500 group-hover:text-white' : 'bg-red-50 text-red-500 group-hover:bg-red-500 group-hover:text-white'}`}>
                                {detailRecord.attendance[date] ? <CheckOne theme="filled" size="16" /> : <Attention theme="filled" size="16" />}
                              </div>
                              <div>
                                <p className="font-bold text-gray-800 text-sm capitalize leading-none mb-1">
                                  {new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                </p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                  {new Date(date).toLocaleDateString('es-CO', { weekday: 'short' })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg border ${detailRecord.attendance[date] ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                {detailRecord.attendance[date] ? 'Presente' : 'Ausente'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
            
            {/* Footer Compacto */}
            <div className="p-5 border-t border-gray-100 flex justify-end bg-white shrink-0">
              <button 
                onClick={() => setDetailRecord(null)}
                className="w-full sm:w-auto px-10 py-3 bg-[#23408e] text-white rounded-2xl font-black text-xs shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Reporte Notas */}
      {showGradeReportModal && (
        <Modal
          isOpen={showGradeReportModal}
          onRequestClose={handleCloseGradeReport}
          className="relative bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in mx-4"
          overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[1000]"
        >
          {/* Header del Modal (No del reporte) */}
          <div className="flex justify-between items-center px-8 py-4 border-b border-gray-100 bg-gray-50/50 print:hidden">
            <h3 className="font-black text-[#23408e] uppercase tracking-widest text-xs">Vista Previa de Reporte</h3>
            <button 
              onClick={handleCloseGradeReport}
              className="p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all font-bold text-xl"
            >
              &times;
            </button>
          </div>

          {/* Área de Contenido con Scroll */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
            <StudentGradeReport 
              grades={notasPorModulo[selectedModuleForReport] || []}
              onClose={handleCloseGradeReport}
              studentInfo={studentInfo}
            />
          </div>

          {/* Footer del Modal (Acciones rápidas) */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 print:hidden">
            <button 
              onClick={handleCloseGradeReport}
              className="px-6 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-200 transition-all text-sm"
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Reporte Académico Completo */}
      {showFullReportModal && (
        <Modal
          isOpen={showFullReportModal}
          onRequestClose={handleCloseFullReport}
          className="relative bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in mx-4"
          overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]"
        >
          {/* Header del Modal */}
          <div className="flex justify-between items-center px-8 py-4 border-b border-gray-100 bg-gray-50/50 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#23408e] animate-pulse" />
              <h3 className="font-black text-[#23408e] uppercase tracking-widest text-xs">Historial Académico Completo</h3>
            </div>
            <button 
              onClick={handleCloseFullReport}
              className="p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all font-bold text-xl"
            >
              &times;
            </button>
          </div>

          {/* Área de Contenido con Scroll */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
            <FullAcademicReport 
              studentInfo={studentInfo}
              notasPorModulo={notasPorModulo}
              findModule={findModule}
              getModuleSemester={getModuleSemester}
              calcularPromedioFinal={calcularPromedioFinal}
            />
          </div>

          {/* Footer del Modal */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 print:hidden">
            <button 
              onClick={handleCloseFullReport}
              className="px-6 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-200 transition-all text-sm"
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AcademicSection;
