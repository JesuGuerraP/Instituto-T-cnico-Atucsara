import { useEffect, useState, useContext, useRef } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { AuthContext } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Book, Calendar, GoldMedal, User, People,
  Dashboard, Finance, TableReport,
  FileEditing, Search, Close, Printer, Time,
  ArrowRightUp, CheckOne, Announcement
} from '@icon-park/react';
import PremiumCard from './components/PremiumCard';
import Modal from 'react-modal';
import PaymentReceipt from '../Finance/PaymentReceipt';
import { toast } from 'react-toastify';
import { calculatePeriod } from '../../utils/periodHelper';

const TeacherDashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const [teacherInfo, setTeacherInfo]     = useState(null);
  const [modulosAsignados, setModulosAsignados] = useState([]);
  const [estudiantes, setEstudiantes]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedModule, setSelectedModule]       = useState(null);
  const [pagos, setPagos]                 = useState([]);
  const [showRecibo, setShowRecibo]       = useState(false);
  const [pagoParaRecibo, setPagoParaRecibo] = useState(null);
  const [reciboNumero, setReciboNumero]   = useState('');
  const printAreaRef = useRef(null);
  const [seminariosAsignados, setSeminariosAsignados] = useState([]);
  const [estudiantesPorSeminario, setEstudiantesPorSeminario] = useState({});
  const [showSeminarioModal, setShowSeminarioModal] = useState(false);
  const [selectedSeminario, setSelectedSeminario]   = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [searchTerm, setSearchTerm] = useState('');
  const [openSemesters, setOpenSemesters] = useState({});
  const [openPeriods, setOpenPeriods] = useState({});
  const [estadisticas, setEstadisticas] = useState({
    totalModulos: 0, totalEstudiantes: 0, totalCarreras: 0, sesionesTotales: 0
  });

  /* ─── DATA FETCH ─── */
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        // Resolve teacher record
        let teacher = null;
        const teachersSnap = await getDocs(collection(db, 'teachers'));
        teachersSnap.forEach(d => {
          const t = d.data();
          const tFull = (t.name + ' ' + (t.lastName || '')).trim().toLowerCase().replace(/\s+/g, ' ');
          const uFull = (currentUser.name + ' ' + (currentUser.lastName || '')).trim().toLowerCase().replace(/\s+/g, ' ');
          if ((t.email && t.email.toLowerCase() === currentUser.email.toLowerCase()) || tFull === uFull) {
            teacher = { id: d.id, ...t };
          }
        });
        setTeacherInfo(teacher);
        if (!teacher) { setLoading(false); return; }

        const teacherFullName = (teacher.name + ' ' + (teacher.lastName || '')).trim();

        // Career modules
        const careersSnap  = await getDocs(collection(db, 'careers'));
        const studentsSnap = await getDocs(collection(db, 'students'));
        let modulos = [];
        let carreras = new Set();
        let sesionesTotales = 0;

        for (const careerDoc of careersSnap.docs) {
          const cd = careerDoc.data();
          const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
          modulesSnap.forEach(md => {
            const m = md.data();
            const isAssigned = Array.isArray(m.profesor)
              ? m.profesor.map(p => (p||'').trim()).includes(teacherFullName)
              : (m.profesor||'').trim() === teacherFullName;
            if (isAssigned) {
              modulos.push({ id: md.id, ...m, carrera: cd.nombre, careerId: careerDoc.id });
              carreras.add(cd.nombre);
              sesionesTotales += parseInt(m.sabadosSemana || 0);
            }
          });
        }

        // General modules
        try {
          const generalSnap = await getDocs(collection(db, 'generalModules'));
          const gMap = new Map();
          generalSnap.forEach(gd => {
            const gm = gd.data();
            const p = gm.profesor;
            const matchId   = p && teacher?.id && p === teacher.id;
            const matchName = typeof p === 'string' && p.trim() === teacherFullName;
            if (matchId || matchName) {
              (gm.carreraSemestres || []).forEach(cs => {
                const key = `${gd.id}::${cs.semester}`;
                if (!gMap.has(key))
                  gMap.set(key, { id: gd.id, nombre: gm.nombre + ' (General)', semestre: cs.semester, isGeneral: true, sabadosSemana: gm.sabadosSemana || 0, careerList: new Set() });
                gMap.get(key).careerList.add(cs.career);
              });
            }
          });
          gMap.forEach(e => {
            const ca = Array.from(e.careerList);
            ca.forEach(c => carreras.add(c));
            e.careerList = ca;
            e.carrera = ca.length === 1 ? ca[0] : `${ca.length} carreras`;
            modulos.push(e);
            sesionesTotales += parseInt(e.sabadosSemana || 0);
          });
        } catch (e) { console.warn('General modules:', e); }
        
        // Short courses modules
        try {
          const coursesSnap = await getDocs(collection(db, 'courses'));
          for (const courseDoc of coursesSnap.docs) {
            const courseData = courseDoc.data();
            const modsSnap = await getDocs(collection(db, 'courses', courseDoc.id, 'modules'));
            for (const md of modsSnap.docs) {
              const m = md.data();
              const matchId = m.profesorId && teacher?.id && m.profesorId === teacher.id;
              const matchName = typeof m.profesorNombre === 'string' && m.profesorNombre.toLowerCase().includes(teacherFullName.toLowerCase());
              
              if (matchId || matchName) {
                // Evitar duplicados en el arreglo de módulos por ID
                if (!modulos.some(existingMod => existingMod.id === md.id)) {
                  modulos.push({ 
                    id: md.id, 
                    ...m, 
                    carrera: courseData.nombre, 
                    courseId: courseDoc.id, 
                    isCourse: true,
                    semestre: 'Curso' // Label for grouping
                  });
                  carreras.add(courseData.nombre);
                  sesionesTotales += parseInt(m.horas || 0) / 4;
                }
              }
            }
          }
        } catch (e) { console.warn('Course modules:', e); }

        setModulosAsignados(modulos);

        const allStudents = studentsSnap.docs.map(d => {
          const data = d.data();
          const period = data.createdAt ? calculatePeriod(data.createdAt) : (data.period || 'Sin periodo');
          return { id: d.id, ...data, period };
        }).filter(s => s.status === 'active');

        // Filter students in career/general modules
        let filtered = allStudents.filter(s => s.modulosAsignados?.some(ma => modulos.some(mod => !mod.isCourse && mod.id === ma.id)));
        
        // Add students from course modules
        for (const mod of modulos.filter(m => m.isCourse)) {
          try {
            const courseStudentsSnap = await getDocs(collection(db, 'courses', mod.courseId, 'modules', mod.id, 'students'));
            courseStudentsSnap.forEach(csd => {
              const csData = csd.data();
              // Buscar en la lista general o en la ya filtrada
              let student = allStudents.find(s => s.id === csd.id) || filtered.find(f => f.id === csd.id);
              
              if (student) {
                if (!student.courseModules) student.courseModules = [];
                if (!student.courseModules.includes(mod.id)) student.courseModules.push(mod.id);
                
                // Persistir estado específico del módulo para la lógica grupal
                student[`status_${mod.id}`] = csData.estado || 'pendiente';
                
                if (!filtered.some(f => f.id === student.id)) {
                  filtered.push(student);
                }
              } else {
                // Crear objeto mínimo si no existe en ningún lado
                const newStudent = { 
                  id: csd.id, 
                  name: csData.name || 'Estudiante', 
                  lastName: '', 
                  status: 'active', 
                  isCourseOnly: true,
                  courseModules: [mod.id],
                  [`status_${mod.id}`]: csData.estado || 'pendiente'
                };
                filtered.push(newStudent);
              }
            });
          } catch (e) { console.warn(`Error fetching students for course module ${mod.id}:`, e); }
        }
        
        setEstudiantes(filtered);

        // Seminarios
        let seminarios = [];
        careersSnap.docs.forEach(cd => {
          const c = cd.data();
          (c.seminarios || []).forEach((sem, idx) => {
            if ((sem.profesorEmail || '').trim().toLowerCase() === (currentUser.email || '').toLowerCase()) {
              seminarios.push({ ...sem, id: `seminario${idx+1}`, carreraId: cd.id, carreraNombre: c.nombre });
            }
          });
        });
        setSeminariosAsignados(seminarios);
        const epSem = {};
        seminarios.forEach(sem => {
          epSem[sem.id] = filtered.filter(s => s.career === sem.carreraNombre && s.seminarios?.some(ss => ss.id === sem.id));
        });
        setEstudiantesPorSeminario(epSem);

        setEstadisticas({ totalModulos: modulos.length, totalEstudiantes: filtered.length, totalCarreras: carreras.size, sesionesTotales });

        // Payments
        const pagosSnap = await getDocs(collection(db, 'payments'));
        const pFilt = pagosSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.category === 'Pago a profesor' && p.teacherId === teacher.id);
        setPagos(pFilt);

      } catch (err) { console.error(err); toast.error('Error cargando datos'); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [currentUser]);

  /* ─── ACTIONS ─── */
  const updateModuleStatus = async (studentId, moduleId, newStatus) => {
    try {
      const mod = modulosAsignados.find(m => m.id === moduleId);
      if (!mod) return;

      if (mod.isCourse) {
        // Update in course subcollection
        const ref = doc(db, 'courses', mod.courseId, 'modules', moduleId, 'students', studentId);
        await updateDoc(ref, { estado: newStatus });
        
        // Update local state for reflected change
        setEstudiantes(prev => prev.map(e => {
          if (e.id === studentId) {
             // We use a virtual property or just rely on state refresh
             // For simplicity, we can update a local 'courseStatus' map if needed, 
             // but here we just update the student object if we want it reactive
             return { ...e, [`status_${moduleId}`]: newStatus };
          }
          return e;
        }));
        toast.success('Estado del curso actualizado');
      } else {
        // Career/General module (uses modulosAsignados)
        const ref = doc(db, 'students', studentId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const upd = snap.data().modulosAsignados.map(m => m.id === moduleId ? { ...m, estado: newStatus } : m);
          await updateDoc(ref, { modulosAsignados: upd });
          setEstudiantes(prev => prev.map(e => e.id === studentId ? { ...e, modulosAsignados: upd } : e));
          toast.success('Estado actualizado');
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar');
    }
  };

  const updateSeminarioStatus = async (studentId, seminarioId, newStatus) => {
    try {
      const ref = doc(db, 'students', studentId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const upd = (snap.data().seminarios || []).map(s => s.id === seminarioId ? { ...s, estado: newStatus } : s);
        await updateDoc(ref, { seminarios: upd });
        setEstudiantesPorSeminario(prev => {
          const n = { ...prev };
          if (n[seminarioId]) n[seminarioId] = n[seminarioId].map(e => e.id === studentId ? { ...e, seminarios: upd } : e);
          return n;
        });
        toast.success('Estado actualizado');
      }
    } catch { toast.error('Error al actualizar'); }
  };

  const handlePrintReceipt = (pago) => {
    setPagoParaRecibo(pago);
    const d = new Date(pago.date);
    setReciboNumero(`${d.getDate()}${d.getMonth()+1}-${pago.id?.slice(-6)}`);
    setShowRecibo(true);
  };


  const handlePrint = () => {
    if (printAreaRef.current) {
      const orig = document.body.innerHTML;
      document.body.innerHTML = printAreaRef.current.innerHTML;
      window.print();
      document.body.innerHTML = orig;
      window.location.reload();
    }
  };

  // Estado global de cada módulo, AHORA BASADO EN UMBRAL DE 90%
  const getEstadoModulo = (estados) => {
    if (!estados.length) return 'pendiente';
    const total = estados.length;
    const countAprobado = estados.filter(e => e === 'aprobado').length;
    const countCursando = estados.filter(e => e === 'cursando').length;
    const countPendiente = estados.filter(e => e === 'pendiente').length;

    if (countAprobado / total >= 0.9) return 'aprobado';
    if (countCursando / total >= 0.9) return 'cursando';
    if (countPendiente / total >= 0.9) return 'pendiente';

    // Si nadie llega al 90%, priorizar mayoría
    if (countAprobado > Math.max(countCursando, countPendiente)) return 'aprobado';
    if (countCursando > countPendiente) return 'cursando';
    return 'pendiente';
  };

  // Dividir los módulos según los períodos a los que pertenecen los estudiantes
  const modulosPorPeriodo = [];
  modulosAsignados.forEach(mod => {
    const estDelMod = estudiantes.filter(e => {
        if (mod.isCourse) {
            return Array.isArray(e.courseModules) && e.courseModules.includes(mod.id);
        }
        return e.modulosAsignados?.some(ma => ma.id === mod.id);
    });

    if (mod.isCourse) {
        // Para cursos, no dividimos por período virtual para evitar duplicidad visual innecesaria
        modulosPorPeriodo.push({ ...mod, virtualPeriod: 'Sin asignar', _estudiantes: estDelMod });
    } else {
        if (estDelMod.length === 0) {
            modulosPorPeriodo.push({ ...mod, virtualPeriod: 'Sin asignar', _estudiantes: [] });
        } else {
            const byPeriod = estDelMod.reduce((acc, e) => {
                const p = e.period || 'Sin periodo';
                if (!acc[p]) acc[p] = [];
                acc[p].push(e);
                return acc;
            }, {});
            Object.keys(byPeriod).forEach(p => {
                modulosPorPeriodo.push({ ...mod, virtualPeriod: p, _estudiantes: byPeriod[p] });
            });
        }
    }
  });

  // Agrupar por semestre, luego por periodo y estado usando los módulos divididos
  const modulosAgrupados = modulosPorPeriodo.reduce((acc, mod) => {
    const sem = mod.semestre || 'Extra';
    const periodo = mod.virtualPeriod || 'Sin asignar';
    const estados = mod._estudiantes.map(e => {
        if (mod.isCourse) {
            return e[`status_${mod.id}`] || e.estado || 'pendiente';
        }
        return e.modulosAsignados?.find(m => m.id === mod.id)?.estado || 'pendiente';
    });
    const est = getEstadoModulo(estados);

    if (!acc[sem]) acc[sem] = {};
    if (!acc[sem][periodo]) acc[sem][periodo] = { cursando: [], pendiente: [], aprobado: [], reprobado: [] };
    
    acc[sem][periodo][est].push({ ...mod, estadoCalculado: est, refEstudiantes: mod._estudiantes.length });
    return acc;
  }, {});

  const modulosCursando = modulosPorPeriodo.filter(mod => {
    const estados = mod._estudiantes.map(e => {
        if (mod.isCourse) {
            return e[`status_${mod.id}`] || e.estado || 'pendiente';
        }
        return e.modulosAsignados?.find(m => m.id === mod.id)?.estado || 'pendiente';
    });
    return getEstadoModulo(estados) === 'cursando';
  });

  /* ─── LOADING / ERROR ─── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5faff] gap-4">
      <div className="w-12 h-12 border-4 border-[#23408e] border-t-transparent rounded-full animate-spin" />
      <p className="text-[#23408e] font-bold animate-pulse">Cargando tu portal docente...</p>
    </div>
  );

  if (!teacherInfo) return (
    <div className="p-8 text-center mt-20 text-red-600 font-bold max-w-lg mx-auto bg-white shadow-xl rounded-3xl">
      No se encontró información del docente. Contacta a administración.
    </div>
  );

  /* ─── HELPERS ─── */
  const colorEstado = (e) => ({
    cursando: 'bg-blue-50 text-blue-700 border-blue-200',
    pendiente: 'bg-orange-50 text-orange-600 border-orange-200',
    aprobado:  'bg-emerald-50 text-emerald-600 border-emerald-200',
    reprobado: 'bg-red-50 text-red-600 border-red-200',
  }[e] || 'bg-slate-100 text-slate-500 border-slate-200');

  const btnColorEstado = (e) => ({
    cursando: 'bg-[#23408e] text-white hover:bg-[#3b5cbd]',
    pendiente: 'bg-slate-700 text-white hover:bg-slate-800',
    aprobado:  'bg-emerald-600 text-white hover:bg-emerald-700',
    reprobado: 'bg-red-600 text-white hover:bg-red-700',
  }[e] || 'bg-slate-600 text-white');

  const TABS = [
    { id: 'home',       label: 'Inicio',     icon: Dashboard  },
    { id: 'modulos',    label: 'Módulos',    icon: Book       },
    { id: 'seminarios', label: 'Seminarios', icon: TableReport },
    { id: 'pagos',      label: 'Pagos',      icon: Finance    },
  ];

  /* ════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <div className="w-full bg-[#f5f7fa] min-h-screen pb-20 custom-scrollbar">
      <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">

        {/* ── WELCOME HERO ── */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-[#23408e] to-[#3b5cbd] px-8 py-6 md:px-12 md:py-8 text-white shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-4 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-black uppercase tracking-widest border border-white/30">
                  Portal Docente
                </span>
                <span className="px-4 py-1 rounded-full bg-green-500/20 text-[10px] font-black uppercase tracking-widest border border-green-400/30 text-green-300">
                  Activo
                </span>
              </div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">
                ¡Hola, <span className="text-[#ffd600]">Prof. {teacherInfo.name} {teacherInfo.lastName}</span>!
              </h1>
            </div>
            {/* Datos del docente — compactos en fila */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                <User theme="filled" size="16" className="text-[#ffd600] shrink-0" />
                <span className="text-xs font-bold text-white/90 uppercase tracking-tight">
                  {teacherInfo.specialty || teacherInfo.career || 'Especialista'}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                <Calendar theme="filled" size="16" className="text-[#ffd600] shrink-0" />
                <span className="text-xs font-bold text-white/90">
                  Ingreso: {teacherInfo.createdAt
                    ? (teacherInfo.createdAt.seconds
                        ? new Date(teacherInfo.createdAt.seconds * 1000).toLocaleDateString('es-CO')
                        : new Date(teacherInfo.createdAt).toLocaleDateString('es-CO'))
                    : '--/--/----'}
                </span>
              </div>
            </div>
          </div>
          <div className="absolute top-[-30%] right-[-10%] w-[400px] h-[400px] bg-white/5 rounded-full blur-3xl" />
        </div>

        {/* ── NAVIGATION TABS ── */}
        {/* sticky solo en escritorio, z-index por debajo del sidebar móvil (z-30) */}
        <div className="md:sticky md:top-4 md:z-20">
          <div className="flex overflow-x-auto p-1.5 bg-white rounded-[2rem] shadow-md border border-slate-100 gap-1 scrollbar-none">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-[#23408e] text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <tab.icon theme={activeTab === tab.id ? 'filled' : 'outline'} size="16" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            TAB: INICIO
        ══════════════════════════════════════════ */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Stats cards — Detalladas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Card: Módulos Asignados — breakdown por semestre */}
              {(() => {
                const porSem = modulosAsignados.reduce((acc, m) => {
                  const s = m.semestre || 'Extra';
                  acc[s] = (acc[s] || 0) + 1;
                  return acc;
                }, {});
                return (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#23408e] flex items-center justify-center shrink-0"><Book theme="filled" size="24" /></div>
                      <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Módulos Asignados</p>
                        <p className="text-3xl font-black text-slate-800 tracking-tighter">{modulosAsignados.length}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      {Object.keys(porSem).sort((a,b)=>a-b).map(s => (
                        <div key={s} className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-400">Semestre {s}</span>
                          <span className="text-xs font-black text-[#23408e] bg-blue-50 px-2 py-0.5 rounded-full">{porSem[s]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Card: Estudiantes — breakdown por semestre */}
              {(() => {
                const porSem = estudiantes.reduce((acc, e) => {
                  const s = (e.semester || e.semestre) ? String(e.semester || e.semestre) : (e.isCourseOnly || (Array.isArray(e.courseModules) && e.courseModules.length > 0) ? 'Curso' : 'N/D');
                  acc[s] = (acc[s] || 0) + 1;
                  return acc;
                }, {});
                return (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0"><People theme="filled" size="24" /></div>
                      <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Estudiantes Activos</p>
                        <p className="text-3xl font-black text-slate-800 tracking-tighter">{estudiantes.length}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      {Object.keys(porSem).sort((a,b) => {
                        if (a === 'Curso') return 1;
                        if (b === 'Curso') return -1;
                        return a.localeCompare(b);
                      }).map(s => (
                        <div key={s} className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-400">Semestre {s}</span>
                          <span className="text-xs font-black text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{porSem[s]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Card: Sesiones Totales */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><Time theme="filled" size="24" /></div>
                  <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sesiones Totales</p>
                    <p className="text-3xl font-black text-slate-800 tracking-tighter">{estadisticas.sesionesTotales}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-300 font-bold pt-2 border-t border-slate-100">Carga horaria semanal acumulada</p>
              </div>

              {/* Card: Carreras — lista de nombres */}
              {(() => {
                const carrerasUnicas = [...new Set(modulosAsignados.map(m => m.carrera).filter(Boolean))];
                return (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center shrink-0"><GoldMedal theme="filled" size="24" /></div>
                      <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Carreras Vinculadas</p>
                        <p className="text-3xl font-black text-slate-800 tracking-tighter">{carrerasUnicas.length}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      {carrerasUnicas.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-500 truncate">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Active modules + Quick links */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Módulos en curso */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-1 h-5 bg-[#23408e] rounded-full" />
                  <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs">Clases Activas este Ciclo</h3>
                </div>
                {modulosCursando.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {modulosCursando.map((m, idx) => (
                      <div key={`${m.id}-${idx}`} className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 hover:bg-blue-50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-black text-slate-800 text-sm truncate max-w-[70%]">{m.nombre}</p>
                          {m.virtualPeriod !== 'Sin asignar' && (
                            <span className="text-[9px] font-black text-[#23408e] bg-blue-100/50 px-2 py-0.5 rounded-full uppercase shrink-0 border border-blue-200">
                              {m.virtualPeriod}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-blue-600 bg-white px-2 py-0.5 rounded-full border border-blue-100">Sem. {m.semestre}</span>
                          <span className="text-[9px] font-bold text-slate-400 truncate">{m.carrera}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                ) : (
                  <p className="text-center py-8 text-slate-300 font-black text-xs uppercase">No tienes módulos activos (cursando)</p>
                )}
              </div>

              {/* Atajos */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-1 h-5 bg-[#009245] rounded-full" />
                  <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs">Atajos Directos</h3>
                </div>
                <div className="space-y-3">
                  <Link to="/dashboard/grades" className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#23408e] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileEditing size="20" />
                      </div>
                      <div>
                        <p className="font-black text-slate-700 text-sm">Asignar Notas</p>
                        <p className="text-[10px] text-slate-400 font-bold">Evaluaciones y actividades</p>
                      </div>
                    </div>
                    <ArrowRightUp size="16" className="text-slate-200 group-hover:text-[#23408e] transition-colors" />
                  </Link>
                  <Link to="/dashboard/attendance" className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-green-200 hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-50 text-[#009245] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <CheckOne size="20" />
                      </div>
                      <div>
                        <p className="font-black text-slate-700 text-sm">Control de Asistencia</p>
                        <p className="text-[10px] text-slate-400 font-bold">Registro sabatino</p>
                      </div>
                    </div>
                    <ArrowRightUp size="16" className="text-slate-200 group-hover:text-[#009245] transition-colors" />
                  </Link>
                  {/* Info reminder */}
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
                    <Announcement theme="filled" size="18" className="text-[#23408e] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                      Recuerda subir las notas finales antes del cierre del módulo.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: MÓDULOS ASIGNADOS — ACORDEÓN POR SEMESTRE
        ══════════════════════════════════════════ */}
        {activeTab === 'modulos' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {Object.keys(modulosAgrupados).length === 0 && (
              <div className="py-20 text-center bg-white rounded-2xl shadow-sm border border-slate-100">
                <Book size="40" className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-300 font-black text-xs uppercase">Sin módulos asignados</p>
              </div>
            )}

            {Object.keys(modulosAgrupados).sort((a, b) => a - b).map((sem, idx) => {
              const periodosEnSem = modulosAgrupados[sem];
              const totalMods = Object.values(periodosEnSem).reduce((s, p) => 
                s + ['cursando', 'pendiente', 'aprobado'].reduce((ss, e) => ss + p[e].length, 0)
              , 0);

              if (totalMods === 0) return null;

              // Por defecto, el primer semestre viene abierto
              const isOpen = openSemesters[sem] !== undefined ? openSemesters[sem] : idx === 0;
              const toggle = () => setOpenSemesters(prev => ({ ...prev, [sem]: !isOpen }));

              return (
                <div key={sem} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all">

                  {/* ── Header del acordeón ── */}
                  <button
                    onClick={toggle}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Indicador de semestre */}
                      <div className="w-10 h-10 rounded-xl bg-[#23408e] flex items-center justify-center shrink-0">
                        <span className="text-base font-black text-white">{sem}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-black text-slate-800 text-sm">Semestre {sem}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {totalMods} módulo{totalMods !== 1 ? 's' : ''} 
                            {Object.keys(periodosEnSem).length > 0 && ` (${Object.keys(periodosEnSem).map(p => {
                              const pT = ['cursando', 'pendiente', 'aprobado'].reduce((ss, e) => ss + periodosEnSem[p][e].length, 0);
                              return `${pT} en ${p}`;
                            }).join(', ')})`}
                          </span>
                          {/* Badges de estado totales en el header */}
                          {['cursando', 'pendiente', 'aprobado'].map(e => {
                            const totalEst = Object.values(periodosEnSem).reduce((s, p) => s + p[e].length, 0);
                            if (totalEst === 0) return null;
                            return (
                              <span key={e} className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${colorEstado(e)}`}>
                                {totalEst} {e}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {/* Chevron animado */}
                    <svg
                      className={`w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-all duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* ── Contenido desplegable por Período ── */}
                  {isOpen && (
                    <div className="border-t border-slate-100 px-6 pb-6 pt-4 space-y-4 animate-in fade-in duration-200">
                      {Object.keys(periodosEnSem).sort((a, b) => b.localeCompare(a)).map((periodo, pIdx) => {
                        const estadosPeriodo = periodosEnSem[periodo];
                        const hayContenidoPeriodo = ['cursando', 'pendiente', 'aprobado'].some(e => estadosPeriodo[e].length > 0);
                        if (!hayContenidoPeriodo) return null;

                        const pKey = `${sem}-${periodo}`;
                        const isPeriodOpen = openPeriods[pKey] !== undefined ? openPeriods[pKey] : true; // Por defecto abiertos o el idx 0
                        const togglePeriod = () => setOpenPeriods(prev => ({ ...prev, [pKey]: !isPeriodOpen }));

                        return (
                          <div key={periodo} className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm transition-all">
                            {/* Cabecera del Período (Acordeón) */}
                            <button
                              onClick={togglePeriod}
                              className="w-full bg-slate-50 hover:bg-slate-100 px-5 py-3 border-b border-slate-100 flex items-center justify-between transition-colors group"
                            >
                              <div className="flex items-center gap-2">
                                <Calendar size="16" className="text-[#23408e]" />
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                  Período: {periodo}
                                </span>
                              </div>
                              <svg
                                className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-all duration-300 ${isPeriodOpen ? 'rotate-180' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            
                            {/* Contenido del Período */}
                            {isPeriodOpen && (
                              <div className="p-0 animate-in fade-in duration-200 bg-white">
                                {(() => {
                                  // Juntamos todos los módulos del período en una sola lista para organizarlos mejor
                                  const allMods = [
                                    ...(estadosPeriodo.cursando || []).map(m => ({ ...m, _estado: 'cursando' })),
                                    ...(estadosPeriodo.pendiente || []).map(m => ({ ...m, _estado: 'pendiente' })),
                                    ...(estadosPeriodo.aprobado || []).map(m => ({ ...m, _estado: 'aprobado' })),
                                    ...(estadosPeriodo.reprobado || []).map(m => ({ ...m, _estado: 'reprobado' }))
                                  ];
                                  if (allMods.length === 0) return null;

                                  return (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left">
                                        <thead>
                                          <tr className="bg-slate-50/80 border-b border-slate-100">
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Módulo</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Carrera</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Inscritos</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Estado Global</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Acción</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {allMods.map((mod, idx) => (
                                            <tr key={`${mod.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                                              <td className="px-6 py-4">
                                                {modulosAsignados.some(m => m.isCourse) && (
                                                  <div className="flex items-center gap-2 mb-1.5">
                                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${mod.isCourse ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                      {mod.isCourse ? 'Curso' : 'Carrera'}
                                                    </span>
                                                  </div>
                                                )}
                                                <p className="font-black text-slate-800 text-sm leading-tight">{mod.nombre}</p>
                                                {mod.virtualPeriod !== 'Sin asignar' && (
                                                  <span className="inline-block mt-1.5 text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                    cohorte: {mod.virtualPeriod}
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-6 py-4 align-middle">
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight max-w-[200px] truncate">{mod.carrera}</p>
                                              </td>
                                              <td className="px-6 py-4 text-center align-middle">
                                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50/50 border border-indigo-100/50 text-xs font-black text-indigo-700">
                                                  {mod.refEstudiantes}
                                                </div>
                                              </td>
                                              <td className="px-6 py-4 text-center align-middle">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${colorEstado(mod._estado)}`}>
                                                  {mod._estado}
                                                </span>
                                              </td>
                                              <td className="px-6 py-4 text-right align-middle">
                                                <button
                                                  onClick={() => { setSelectedModule(mod); setShowStudentsModal(true); }}
                                                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm hover:shadow hover:-translate-y-0.5 ${btnColorEstado(mod._estado)}`}
                                                >
                                                  Ver Estudiantes
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: SEMINARIOS
        ══════════════════════════════════════════ */}
        {activeTab === 'seminarios' && (
          <div className="animate-in fade-in duration-300">
            {seminariosAsignados.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-2xl shadow-sm border border-slate-100">
                <TableReport size="40" className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-300 font-black text-xs uppercase">No tienes seminarios asignados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {seminariosAsignados.map(sem => {
                  const count = (estudiantesPorSeminario[sem.id] || []).length;
                  return (
                    <div key={sem.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col justify-between">
                      <div className="mb-5">
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-purple-100">
                            Seminario
                          </span>
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-tight truncate max-w-[110px]">
                            {sem.carreraNombre}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-slate-800 leading-snug mb-1">{sem.nombre}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{count} estudiante{count !== 1 ? 's' : ''}</p>
                      </div>
                      <button
                        onClick={() => { setSelectedSeminario(sem); setShowSeminarioModal(true); }}
                        className="w-full py-3 bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-800 transition-all"
                      >
                        Gestionar Grupo
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB: PAGOS
        ══════════════════════════════════════════ */}
        {activeTab === 'pagos' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-50">
                <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs">Historial de Honorarios Recibidos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Monto</th>
                      <th className="px-8 py-4 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pagos.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-12 text-slate-300 font-black text-xs uppercase">
                          Sin registros financieros
                        </td>
                      </tr>
                    ) : (
                      pagos.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5 text-sm font-bold text-slate-600">{new Date(p.date).toLocaleDateString('es-CO')}</td>
                          <td className="px-8 py-5 text-sm font-black text-[#23408e]">#{p.id?.slice(-6).toUpperCase()}</td>
                          <td className="px-8 py-5 text-sm font-medium text-slate-500">{p.description || p.category || '—'}</td>
                          <td className="px-8 py-5 text-sm font-black text-green-600 text-right">
                            $ {new Intl.NumberFormat('es-CO').format(p.amount)}
                          </td>
                          <td className="px-8 py-5 text-center">
                            <button
                              onClick={() => handlePrintReceipt(p)}
                              className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-[#23408e] hover:bg-white transition-all"
                            >
                              <Printer size="16" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        {/* ══════════════════════════════════════════
            MODALS
        ══════════════════════════════════════════ */}

        {/* Modal: Lista de Estudiantes por Módulo */}
        {showStudentsModal && selectedModule && (
          <Modal
            isOpen
            onRequestClose={() => setShowStudentsModal(false)}
            className="modal-center !max-w-6xl w-[95%] md:w-full p-4 outline-none"
            overlayClassName="overlay-center bg-slate-900/40 backdrop-blur-sm z-[1000]"
          >
            <div className="bg-white rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex justify-between items-center p-8 border-b border-slate-50 bg-gradient-to-r from-[#23408e] to-[#3b5cbd] text-white">
                <div className="pr-4">
                  <h2 className="text-xl md:text-2xl font-black tracking-tight leading-none mb-3">{selectedModule.nombre}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-white/90 text-[10px] font-black uppercase tracking-wider">
                    <span className="bg-white/20 px-2.5 py-1 rounded-md shadow-sm border border-white/10">{selectedModule.carrera}</span>
                    <span className="bg-white/20 px-2.5 py-1 rounded-md shadow-sm border border-white/10">
                        {selectedModule.isCourse ? 'Curso' : `Semestre ${selectedModule.semestre}`}
                    </span>
                    {selectedModule.virtualPeriod && selectedModule.virtualPeriod !== 'Sin asignar' && (
                      <span className="bg-emerald-500/80 px-2.5 py-1 rounded-md shadow-sm border border-emerald-400 text-white">
                        Cohorte: {selectedModule.virtualPeriod}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowStudentsModal(false)}
                  className="w-10 h-10 rounded-full bg-white/20 flex flex-shrink-0 items-center justify-center hover:bg-white/30 transition-all hover:scale-105"
                >
                  <Close size="20" />
                </button>
              </div>
              {/* Table */}
              <div className="overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 shadow-sm">
                    <tr>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Estudiante</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Carrera / Sem</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Estado del Alumno</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right whitespace-nowrap">Gestión Interna</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {estudiantes
                      .filter(e => {
                        if (selectedModule.isCourse) {
                          return e.courseModules?.includes(selectedModule.id);
                        }
                        return e.modulosAsignados?.some(m => m.id === selectedModule.id) &&
                               (selectedModule.virtualPeriod === 'Sin asignar' || (e.period === selectedModule.virtualPeriod));
                      })
                      .map(est => {
                        const ma = !selectedModule.isCourse ? est.modulosAsignados.find(m => m.id === selectedModule.id) : null;
                        const courseStatus = selectedModule.isCourse ? (est[`status_${selectedModule.id}`] || est.estado || 'pendiente') : null;
                        const currentStatus = selectedModule.isCourse ? courseStatus : (ma?.estado || 'pendiente');
                        const isDefinitivo = !selectedModule.isCourse ? ma?.esDefinitivo : false;
                        return (
                          <tr key={est.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-5 align-middle">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 text-[#23408e] flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                                  {est.name?.[0] || ''}{est.lastName?.[0] || ''}
                                </div>
                                <div>
                                  <p className="font-black text-slate-800 text-sm leading-tight group-hover:text-[#23408e] transition-colors">{est.name} {est.lastName}</p>
                                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5 tracking-tight">{est.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-5 align-middle">
                              <p className="text-[11px] font-black text-slate-600 uppercase tracking-wider">{est.career || '—'}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Semestre {est.semester || '—'}</p>
                            </td>
                            <td className="px-8 py-5 text-center align-middle">
                              <div className="relative inline-block text-left w-32">
                                <select
                                  value={currentStatus}
                                  onChange={e => updateModuleStatus(est.id, selectedModule.id, e.target.value)}
                                  disabled={isDefinitivo}
                                  className={`appearance-none w-full pl-4 pr-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm hover:shadow outline-none 
                                    ${colorEstado(currentStatus)} 
                                    ${isDefinitivo ? 'opacity-80 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}
                                  `}
                                >
                                  <option value="pendiente">Pendiente</option>
                                  <option value="cursando">Cursando</option>
                                  <option value="aprobado">Aprobado</option>
                                  <option value="reprobado">Reprobado</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-current opacity-50">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right align-middle">
                              <div className="flex justify-end gap-2.5">
                                <Link to={`/dashboard/grades?student=${est.id}&module=${selectedModule.id}`} className="group/btn relative flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50/50 border border-indigo-100/50 rounded-xl text-[10px] font-black text-indigo-600 hover:bg-indigo-600 hover:border-indigo-600 hover:text-white transition-all shadow-sm">
                                  <FileEditing size="14" />
                                  <span>Notas</span>
                                </Link>
                                <Link to={`/dashboard/attendance?student=${est.id}&module=${selectedModule.id}`} className="group/btn relative flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50/50 border border-emerald-100/50 rounded-xl text-[10px] font-black text-emerald-600 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all shadow-sm">
                                  <CheckOne size="14" />
                                  <span>Asistencia</span>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal: Gestionar Seminario */}
        {showSeminarioModal && selectedSeminario && (
          <Modal
            isOpen
            onRequestClose={() => setShowSeminarioModal(false)}
            className="modal-center max-w-4xl w-full p-4 outline-none"
            overlayClassName="overlay-center bg-slate-900/40 backdrop-blur-sm z-[1000]"
          >
            <div className="bg-white rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex justify-between items-center p-8 border-b bg-gradient-to-r from-purple-700 to-purple-500 text-white">
                <div>
                  <h2 className="text-xl font-black tracking-tight">{selectedSeminario.nombre}</h2>
                  <p className="text-white/60 text-[10px] font-black uppercase mt-1">{selectedSeminario.carreraNombre}</p>
                </div>
                <button onClick={() => setShowSeminarioModal(false)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                  <Close size="20" />
                </button>
              </div>
              <div className="overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-50 shadow-sm">
                    <tr>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estudiante</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Carrera</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(estudiantesPorSeminario[selectedSeminario.id] || []).map(est => {
                      const sData = est.seminarios?.find(s => s.id === selectedSeminario.id);
                      return (
                        <tr key={est.id} className="hover:bg-purple-50/20 transition-colors">
                          <td className="px-8 py-4">
                            <p className="font-black text-slate-800 text-sm">{est.name} {est.lastName}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{est.email}</p>
                          </td>
                          <td className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase">{est.career}</td>
                          <td className="px-8 py-4 text-center">
                            <select
                              value={sData?.estado || 'pendiente'}
                              onChange={e => updateSeminarioStatus(est.id, selectedSeminario.id, e.target.value)}
                              className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-purple-100 bg-white text-purple-700"
                            >
                              <option value="pendiente">Pendiente</option>
                              <option value="cursando">Cursando</option>
                              <option value="aprobado">Aprobado</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal: Recibo de Pago */}
        {showRecibo && pagoParaRecibo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm print:bg-transparent px-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full relative border-t-8 border-[#23408e] print:shadow-none print:border-0 print:p-0">
              <button
                className="absolute top-5 right-5 w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-red-500 flex items-center justify-center print:hidden transition-colors"
                onClick={() => setShowRecibo(false)}
              >
                <Close size="20" />
              </button>
              <div ref={printAreaRef} className="print:p-0">
                <PaymentReceipt pago={pagoParaRecibo} estudiante={teacherInfo} reciboNumero={reciboNumero} />
              </div>
              <div className="flex justify-end mt-8 gap-3 print:hidden">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-8 py-3 bg-[#23408e] text-white rounded-full font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                >
                  <Printer size="16" />
                  Imprimir Recibo
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default TeacherDashboard;
