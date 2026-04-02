import { useEffect, useState, useContext, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { AuthContext } from '../../context/AuthContext';
import { MenuUnfold } from '@icon-park/react';

// New Components
import DashboardHome from './components/DashboardHome';
import AcademicSection from './components/AcademicSection';
import FinanceSection from './components/FinanceSection';
import SettingsSection from './components/SettingsSection';
import PaymentReceipt from '../Finance/PaymentReceipt';

const StudentDashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('home');
  const [loading, setLoading] = useState(true);

  // Data States
  const [studentInfo, setStudentInfo] = useState(null);
  const [grades, setGrades] = useState([]);
  const [payments, setPayments] = useState([]);
  const [studentAttendance, setStudentAttendance] = useState([]);
  const [careerModules, setCareerModules] = useState([]);
  const [generalModules, setGeneralModules] = useState([]);
  const [careerSeminarios, setCareerSeminarios] = useState([]);
  const [semesterPrices, setSemesterPrices] = useState({});
  const [openSemesters, setOpenSemesters] = useState({});

  // Finance Receipt States
  const [showFinanceReceiptModal, setShowFinanceReceiptModal] = useState(false);
  const [selectedFinanceReceipt, setSelectedFinanceReceipt] = useState(null);
  const financePrintAreaRef = useRef();

  // Helpers
  const findModule = useCallback((id) => {
    return careerModules.find(m => m.id === id) || generalModules.find(m => m.id === id);
  }, [careerModules, generalModules]);

  const findModuleByName = useCallback((name) => {
    return careerModules.find(m => m.nombre === name) || generalModules.find(m => m.nombre === name);
  }, [careerModules, generalModules]);

  const getModuleSemester = useCallback((module) => {
    if (!module) return 'General';
    if (module.semestre || module.semester) return module.semestre || module.semester;
    if (Array.isArray(module.semestres) && module.semestres.length > 0) return module.semestres[0];
    if (Array.isArray(module.carreraSemestres) && studentInfo?.career) {
      const entry = module.carreraSemestres.find(cs => cs.career === studentInfo.career);
      if (entry) return entry.semester;
    }
    return 'General';
  }, [studentInfo]);

  const toggleSemester = (semester) => {
    setOpenSemesters(prev => ({ ...prev, [semester]: !prev[semester] }));
  };

  const formatCOP = (v) => v?.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

  const handlePrintFinanceReceipt = (pago) => {
    setSelectedFinanceReceipt(pago);
    setShowFinanceReceiptModal(true);
  };

  const handlePrintFinanceModal = () => {
    if (financePrintAreaRef.current) {
      const printContents = financePrintAreaRef.current.innerHTML;
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload();
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      setLoading(true);

      try {
        // Fetch Student Info
        const studentsSnap = await getDocs(query(collection(db, 'students'), where('email', '==', currentUser.email)));
        let student = null;
        studentsSnap.forEach(doc => student = { id: doc.id, ...doc.data() });
        setStudentInfo(student);

        if (student) {
          // Fetch Grades
          const gradesSnap = await getDocs(query(collection(db, 'grades'), where('studentId', '==', student.id)));
          setGrades(gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
            const dateA = a.date?.seconds || Date.parse(a.date) || 0;
            const dateB = b.date?.seconds || Date.parse(b.date) || 0;
            return dateB - dateA;
          }));

          // Fetch Payments
          const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('studentId', '==', student.id)));
          setPayments(paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

          // Fetch Attendance
          const attSnap = await getDocs(query(collection(db, 'attendance'), where('studentId', '==', student.id)));
          setStudentAttendance(attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

          // Fetch Career Modules & Seminarios
          if (student.career) {
            const careersSnap = await getDocs(query(collection(db, 'careers'), where('nombre', '==', student.career)));
            let careerDoc = null;
            careersSnap.forEach(doc => careerDoc = { id: doc.id, ...doc.data() });
            if (careerDoc) {
              const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
              setCareerModules(modulesSnap.docs.map(m => ({ id: m.id, ...m.data() })));
              setCareerSeminarios(Array.isArray(careerDoc.seminarios) ? careerDoc.seminarios.map((s, idx) => ({ id: `seminario${idx + 1}`, ...s })) : []);
            }
          }

          // Fetch General Modules
          const gmSnap = await getDocs(collection(db, 'generalModules'));
          setGeneralModules(gmSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            isGeneral: true,
            nombre: doc.data().nombre + (doc.data().nombre?.includes('(General)') ? '' : ' (General)')
          })));

          // Fetch Semester Prices
          const pricesSnap = await getDocs(collection(db, 'semesterPrices'));
          const prices = {};
          pricesSnap.forEach(doc => prices[doc.id] = doc.data().value);
          setSemesterPrices(prices);
        }
      } catch (error) {
        console.error("Error fetching data: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  // Sync activeSection with URL
  useEffect(() => {
    const path = location.pathname;
    if (path.endsWith('/academic')) setActiveSection('academic');
    else if (path.endsWith('/finance')) setActiveSection('finance');
    else if (path.endsWith('/settings')) setActiveSection('settings');
    else setActiveSection('home');
  }, [location.pathname]);

  // Derived Values for Dashboard Home
  const getStats = () => {
    let moduloResumenNombre = null;
    let porcentajeResumen = null;
    let cursandoArr = [];
    let aprobadosArr = [];

    if (studentInfo?.modulosAsignados) {
      cursandoArr = Array.from(new Set(
        studentInfo.modulosAsignados
          .filter(m => m.estado === 'cursando')
          .map(m => findModule(m.id)?.nombre)
          .filter(Boolean)
      ));

      aprobadosArr = studentInfo.modulosAsignados
        .filter(m => m.estado === 'aprobado')
        .map(m => findModule(m.id)?.nombre || m.id);

      // Simple attendance resumen logic (from original code)
      const cursandoFull = studentInfo.modulosAsignados.filter(m => m.estado === 'cursando');
      if (cursandoFull.length > 0) {
        let mejorModulo = null;
        let mejorPorcentaje = -1;
        cursandoFull.forEach(modAsignado => {
          const registros = studentAttendance.filter(rec => (rec.moduleId === modAsignado.id || rec.moduleName === modAsignado.nombre || rec.moduleName === (findModule(modAsignado.id)?.nombre)));
          let total = 0, asistidos = 0;
          registros.forEach(rec => {
            Object.values(rec.attendance || {}).forEach(val => {
              total++;
              if (val === true) asistidos++;
            });
          });
          if (total > 0) {
            let p = Math.round((asistidos / total) * 100);
            if (p > mejorPorcentaje) {
              mejorPorcentaje = p;
              mejorModulo = registros[0].moduleName || findModule(modAsignado.id)?.nombre;
            }
          }
        });
        if (mejorModulo) {
          moduloResumenNombre = mejorModulo;
          porcentajeResumen = mejorPorcentaje;
        }
      }
    }

    const seminariosAprobadosArr = careerSeminarios.filter(s => {
      const studentSem = studentInfo?.seminarios?.find(ss => ss.id === s.id);
      return (studentSem?.estado || s.estado) === 'aprobado';
    }).map(s => s.nombre);

    // Realistic Progress Calculation
    const totalModules = careerModules.length;
    const totalSeminarios = careerSeminarios.length;
    const totalItems = totalModules + totalSeminarios;
    const approvedModulesCount = studentInfo?.modulosAsignados?.filter(m => m.estado === 'aprobado').length || 0;
    const approvedSeminariosCount = studentInfo?.seminarios?.filter(s => s.estado === 'aprobado').length || 0;
    const totalApproved = approvedModulesCount + approvedSeminariosCount;
    const porcentajeProgresoReal = totalItems > 0 ? Math.round((totalApproved / totalItems) * 100) : 0;

    // Progress per "Stage" (1, 2, 3, Prácticas/Seminarios)
    const progresoPorEtapa = {
      semestre1: 0,
      semestre2: 0,
      semestre3: 0,
      practica: 0
    };

    if (totalItems > 0) {
      const calcStage = (sem) => {
        const modsSem = careerModules.filter(m => Number(m.semestre || m.semester) === sem);
        if (modsSem.length === 0) return 0; // Si no hay módulos registrados, el progreso es 0
        const aprobadosSem = modsSem.filter(m => studentInfo?.modulosAsignados?.some(ma => ma.id === m.id && ma.estado === 'aprobado')).length;
        return Math.round((aprobadosSem / modsSem.length) * 100);
      };

      progresoPorEtapa.semestre1 = calcStage(1);
      progresoPorEtapa.semestre2 = calcStage(2);
      progresoPorEtapa.semestre3 = calcStage(3);
      progresoPorEtapa.practica = totalSeminarios > 0 ? Math.round((approvedSeminariosCount / totalSeminarios) * 100) : 0;
    }

    return {
      moduloResumenNombre,
      porcentajeResumen,
      modulosCursando: cursandoArr,
      modulosAprobados: aprobadosArr,
      seminariosAprobados: seminariosAprobadosArr,
      carrera: studentInfo?.career || '-',
      porcentajeProgresoReal,
      progresoPorEtapa,
      semestreActual: studentInfo?.semester || '1'
    };
  };

  // Logic for Academic Section
  const notasPorModulo = {};
  grades.forEach(g => {
    if (!notasPorModulo[g.moduleName]) notasPorModulo[g.moduleName] = [];
    notasPorModulo[g.moduleName].push(g);
  });

  const notasPorModuloYGrupo = {};
  Object.entries(notasPorModulo).forEach(([modulo, notas]) => {
    notasPorModuloYGrupo[modulo] = { 'ACTIVIDADES_1': [], 'ACTIVIDADES_2': [], 'EVALUACION_FINAL': [], 'Otro': [] };
    notas.forEach(nota => {
      const grupo = nota.groupName || nota.groupId || 'Otro';
      if (notasPorModuloYGrupo[modulo][grupo]) notasPorModuloYGrupo[modulo][grupo].push(nota);
      else notasPorModuloYGrupo[modulo]['Otro'].push(nota);
    });
  });

  const calcularPromedioFinal = (notas) => {
    const notaHabilitacion = notas.find(n => n.groupId === 'HABILITACION' || n.groupName === 'HABILITACION');
    if (notaHabilitacion) return { finalGrade: parseFloat(notaHabilitacion.grade).toFixed(2), isHabilitacion: true };

    const getNota = (grupo) => {
      const gNotas = notas.filter(n => n.groupId === grupo || n.groupName === grupo);
      return gNotas.length ? gNotas.reduce((acc, n) => acc + parseFloat(n.grade), 0) / gNotas.length : 0;
    };
    const p1 = getNota('ACTIVIDADES_1'), p2 = getNota('ACTIVIDADES_2'), pf = getNota('EVALUACION_FINAL');
    return { finalGrade: (p1 * 0.3 + p2 * 0.3 + pf * 0.4).toFixed(2), isHabilitacion: false };
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5faff] space-y-4">
      <div className="w-12 h-12 border-4 border-[#23408e] border-t-transparent rounded-full animate-spin" />
      <p className="text-[#23408e] font-bold animate-pulse">Preparando tu portal académico...</p>
    </div>
  );

  return (
    <div className="w-full">
      {/* Contenido Dinámico */}
      <div className="max-w-7xl mx-auto py-8 px-4">
        {activeSection === 'home' && (
          <DashboardHome
            studentInfo={studentInfo}
            currentUser={currentUser}
            stats={getStats()}
          />
        )}

        {activeSection === 'academic' && (
          <AcademicSection
            notasPorModulo={notasPorModulo}
            findModuleByName={findModuleByName}
            getModuleSemester={getModuleSemester}
            calcularPromedioFinal={calcularPromedioFinal}
            notasPorModuloYGrupo={notasPorModuloYGrupo}
            studentAttendance={studentAttendance}
            findModule={findModule}
            careerSeminarios={careerSeminarios}
            toggleSemester={toggleSemester}
            openSemesters={openSemesters}
            studentInfo={studentInfo}
          />
        )}

        {activeSection === 'finance' && (
          <FinanceSection
            payments={payments}
            semesterPrices={semesterPrices}
            studentInfo={studentInfo}
            toggleSemester={toggleSemester}
            openSemesters={openSemesters}
            handlePrintFinanceReceipt={handlePrintFinanceReceipt}
            formatCOP={formatCOP}
          />
        )}

        {activeSection === 'settings' && (
          <SettingsSection
            studentInfo={studentInfo}
            currentUser={currentUser}
          />
        )}
      </div>

      {/* Shared Finance Receipt Modal */}
      {showFinanceReceiptModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm print:bg-transparent">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full relative border-t-8 border-[#23408e] print:shadow-none print:border-0 print:p-0 print:rounded-none animate-in">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 print:hidden text-2xl font-bold"
              onClick={() => setShowFinanceReceiptModal(false)}
            >
              &times;
            </button>
            <div ref={financePrintAreaRef}>
              <PaymentReceipt
                pago={selectedFinanceReceipt}
                estudiante={studentInfo}
                reciboNumero={selectedFinanceReceipt ? selectedFinanceReceipt.id?.slice(-6) : ''}
              />
            </div>
            <div className="flex justify-end mt-8 gap-4 print:hidden">
              <button
                onClick={() => setShowFinanceReceiptModal(false)}
                className="px-6 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100"
              >
                Cerrar
              </button>
              <button
                onClick={handlePrintFinanceModal}
                className="px-8 py-2 bg-[#23408e] text-white rounded-xl font-bold shadow-lg shadow-blue-200"
              >
                Imprimir Recibo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
