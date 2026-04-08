import React from 'react';
import {
  IdCard,
  Calendar,
  GoldMedal,
  ArrowRightUp,
  Announcement,
  CheckCorrect,
  Timer,
  CheckOne
} from '@icon-park/react';
import PremiumCard from './PremiumCard';

const DashboardHome = ({ studentInfo, currentUser, stats }) => {
  const {
    moduloResumenNombre,
    porcentajeResumen,
    modulosCursando,
    modulosAprobados,
    seminariosAprobados,
    carrera,
    porcentajeProgresoReal,
    progresoPorEtapa,
    semestreActual
  } = stats;

  const quickStats = [
    {
      label: 'Asistencia Actual',
      value: moduloResumenNombre ? `${porcentajeResumen}%` : '--',
      subtext: moduloResumenNombre || 'Sin datos',
      icon: Calendar,
      color: 'bg-green-50 text-green-600 border-green-100',
    },
    {
      label: 'Módulos en Curso',
      value: modulosCursando.length,
      subtext: modulosCursando.length > 0 ? modulosCursando.join(', ') : 'Ninguno',
      icon: Timer,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      label: 'Logros Totales',
      value: modulosAprobados.length + seminariosAprobados.length,
      subtext: 'Módulos y Seminarios',
      icon: GoldMedal,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
    }
  ];

  return (
    <div className="space-y-8 animate-in">
      {/* Welcome Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#23408e] to-[#3b5cbd] p-8 md:p-12 text-white shadow-2xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider border border-white/30">
              Panel Académico
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight leading-tight">
            ¡Hola, <span className="text-[#ffd600]">{studentInfo?.name || currentUser?.displayName || 'Estudiante'}</span>!
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl mb-8 font-medium">
            Bienvenido a tu portal de aprendizaje. Aquí tienes un vistazo rápido a tu progreso y las novedades de la institución.
          </p>
          {/* Determinar si tiene ambos ámbitos para aplicar el layout optimizado */}
          {(() => {
            const hasCareerInfo = carrera && carrera !== '-' && carrera !== '—';
            const hasCourseInfo = stats.progresoCursos && stats.progresoCursos.length > 0;
            const isHybrid = hasCareerInfo && hasCourseInfo;

            return (
              <div className={isHybrid ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mt-8" : "flex flex-wrap gap-4 mt-8"}>
                {/* Información de Carrera */}
                {hasCareerInfo && (
                  <div className={`flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 transition-all hover:bg-white/15 ${isHybrid ? 'px-4 py-3' : 'px-5 py-3'}`}>
                    <div className="p-2.5 bg-blue-400/20 rounded-xl shrink-0">
                      <IdCard theme="outline" size={isHybrid ? 20 : 22} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] md:text-[9px] uppercase font-black opacity-60 leading-none mb-1 tracking-[0.15em] text-blue-100 italic">Programa Profesional</span>
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className={`${isHybrid ? 'text-sm' : 'text-base'} font-bold truncate`}>{carrera}</span>
                        <span className="w-1 h-1 rounded-full bg-white/40" />
                        <span className={`${isHybrid ? 'text-xs' : 'text-sm'} font-black text-[#ffd600] shrink-0`}>Sem: {semestreActual}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Información de Cursos Cortos */}
                {hasCourseInfo && (
                  <div className={`flex items-center gap-3 bg-emerald-500/20 backdrop-blur-sm rounded-2xl border border-emerald-400/20 text-emerald-50 transition-all hover:bg-emerald-500/25 ${isHybrid ? 'px-4 py-3' : 'px-5 py-3'}`}>
                    <div className="p-2.5 bg-emerald-400/20 rounded-xl shrink-0">
                      <CheckOne theme="outline" size={isHybrid ? 20 : 22} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] md:text-[9px] uppercase font-black opacity-60 leading-none mb-1 tracking-[0.15em] text-emerald-100 italic">Formación Continua</span>
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className={`${isHybrid ? 'text-sm' : 'text-base'} font-bold truncate`}>
                          {stats.progresoCursos.map(c => c.nombre).join(', ')}
                        </span>
                        {studentInfo?.coursePeriod && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-emerald-400/40" />
                            <span className={`${isHybrid ? 'text-xs' : 'text-sm'} font-black text-emerald-300 shrink-0`}>{studentInfo.coursePeriod}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fecha de Ingreso Global */}
                <div className={`flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/5 transition-all hover:bg-white/10 ${isHybrid ? 'px-4 py-3' : 'px-5 py-3'}`}>
                  <div className="p-2.5 bg-white/10 rounded-xl shrink-0">
                    <Calendar theme="outline" size={isHybrid ? 20 : 22} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] md:text-[9px] uppercase font-black opacity-60 leading-none mb-1 tracking-[0.15em] text-blue-100 italic">Inscrito el</span>
                    <span className={`${isHybrid ? 'text-sm' : 'text-base'} font-bold truncate`}>
                      {studentInfo?.createdAt ? (studentInfo.createdAt.seconds ? new Date(studentInfo.createdAt.seconds * 1000).toLocaleDateString('es-CO') : new Date(studentInfo.createdAt).toLocaleDateString('es-CO')) : '--/--/----'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        {/* Decorative elements */}
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[300px] h-[300px] bg-blue-400/20 rounded-full blur-2xl" />
      </div>

      {/* Stats Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <div className="w-1 h-6 bg-[#23408e] rounded-full" />
          <h2 className="text-xl font-black text-gray-800">Resumen de Actividad</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickStats.map((stat, idx) => (
            <div key={idx} className="group bg-white rounded-3xl p-6 shadow-xl shadow-gray-200/40 border border-gray-100 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-4 rounded-2xl ${stat.color} border shadow-inner transition-transform group-hover:scale-110`}>
                  <stat.icon theme="outline" size="28" />
                </div>
                <div className="p-2 rounded-full bg-gray-50 text-gray-400 group-hover:text-[#23408e] group-hover:bg-blue-50 transition-all">
                  <ArrowRightUp theme="outline" size="18" />
                </div>
              </div>
              <div className="mt-2 text-wrap overflow-hidden">
                <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                <h2 className="text-4xl font-extrabold text-gray-900 mb-2">{stat.value}</h2>
                <div className="flex flex-wrap gap-2 mt-4 min-h-[40px]">
                  {stat.label === 'Módulos en Curso' && modulosCursando.length > 0 ? (
                    modulosCursando.map((m, i) => (
                      <span key={i} className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100 flex items-center gap-1.5 animate-in slide-in-from-left duration-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        {m}
                      </span>
                    ))
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      <p className="text-xs text-gray-500 font-bold">{stat.subtext}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Wall of Achievements (Logros Académicos) */}
        <PremiumCard title="Mis Logros Académicos" icon={GoldMedal}>
          <div className="space-y-6">
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Has completado con éxito los siguientes módulos y seminarios. ¡Sigue así!
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {modulosAprobados.length > 0 || seminariosAprobados.length > 0 ? (
                <>
                  {modulosAprobados.map((m, i) => (
                    <div key={`mod-${i}`} className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 border border-green-100 group hover:shadow-md transition-all">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-green-600 transition-transform group-hover:rotate-12">
                        <CheckCorrect theme="outline" size="20" />
                      </div>
                      <div className="overflow-hidden">
                        <h5 className="text-xs font-black text-gray-900 leading-tight truncate">{m}</h5>
                        <p className="text-[10px] font-bold text-green-600 tracking-wider uppercase opacity-70">Módulo Aprobado</p>
                      </div>
                    </div>
                  ))}
                  {seminariosAprobados.map((s, i) => (
                    <div key={`sem-${i}`} className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-100 group hover:shadow-md transition-all">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-purple-600 transition-transform group-hover:rotate-12">
                        <GoldMedal theme="outline" size="20" />
                      </div>
                      <div className="overflow-hidden">
                        <h5 className="text-xs font-black text-gray-900 leading-tight truncate">{s}</h5>
                        <p className="text-[10px] font-bold text-purple-600 tracking-wider uppercase opacity-70">Seminario</p>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="col-span-2 py-8 text-center text-gray-400 font-bold bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  Aún no has registrado logros certificados.
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg">
                <Timer theme="outline" size="16" />
              </div>
              <div>
                <h6 className="text-[11px] font-black text-blue-900 uppercase tracking-widest mb-1">Próxima Meta</h6>
                <p className="text-xs text-blue-700 font-medium leading-tight">
                  Al completar 3 módulos más, recibirás una certificación de progreso intermedio.
                </p>
              </div>
            </div>
          </div>
        </PremiumCard>

        {/* Global Progress Card - ROADMAP Version */}
        <PremiumCard title="Hoja de Ruta Académica" icon={CheckCorrect}>
          <div className="space-y-10">
            {/* 1. Ruta de Carrera (Si existe) */}
            {carrera && carrera !== '-' && (
              <div className="relative pt-2">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] block mb-1">Programa Profesional</span>
                    <p className="text-2xl font-black text-[#23408e] truncate max-w-[250px]">{carrera}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-1">Estatus</span>
                    <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-widest border border-blue-100">
                      En Curso
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Sem 1', val: progresoPorEtapa?.semestre1 || 0 },
                      { label: 'Sem 2', val: progresoPorEtapa?.semestre2 || 0 },
                      { label: 'Sem 3', val: progresoPorEtapa?.semestre3 || 0 },
                      { label: 'Prác.', val: progresoPorEtapa?.practica || 0 }
                    ].map((stage, i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-100 p-[1px]">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${stage.val === 100 ? 'bg-green-500' : 'bg-[#23408e]'}`}
                            style={{ width: `${stage.val}%` }}
                          />
                        </div>
                        <span className="block text-[8px] font-black text-center text-gray-400 uppercase tracking-tighter">{stage.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Rutas de Cursos (Si existen) */}
            {stats.progresoCursos && stats.progresoCursos.length > 0 && (
              <div className="space-y-8 pt-4">
                {stats.progresoCursos.map((curso, idx) => (
                  <div key={curso.id || idx} className="relative bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] block mb-0.5">Curso Certificado</span>
                        <h4 className="text-lg font-black text-gray-900">{curso.nombre}</h4>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-emerald-600">{curso.porcentaje}%</div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Generar segmentos basados en el número de módulos o duración */}
                      <div className="flex gap-1.5 h-2">
                        {Array.from({ length: curso.totalModulos }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`flex-1 rounded-full border border-white/50 ${
                              i < curso.aprobados ? 'bg-emerald-500 shadow-sm shadow-emerald-100' : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                        <span>Inicio</span>
                        <span>{curso.aprobados} de {curso.totalModulos} módulos</span>
                        <span>Meta</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(!carrera || carrera === '-') && (!stats.progresoCursos || stats.progresoCursos.length === 0) && (
              <div className="py-10 text-center text-gray-300 font-bold">
                No hay programas académicos activos para mostrar.
              </div>
            )}

            <div className="p-5 rounded-2xl bg-[#effaf4] border border-[#d1f2e1]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-white text-[#009245] shadow-sm">
                  <Announcement theme="outline" size="20" />
                </div>
                <h4 className="font-bold text-[#009245]">Tu Meta Global</h4>
              </div>
              <p className="text-xs text-[#237c4d] font-medium leading-relaxed">
                Tu progreso total de aprendizaje (Carrera + Cursos) es del <span className="font-black">{porcentajeProgresoReal}%</span>. 
                Sigue completando módulos para obtener tus certificaciones.
              </p>
            </div>
          </div>
        </PremiumCard>
      </div>
    </div>
  );
};

export default DashboardHome;
