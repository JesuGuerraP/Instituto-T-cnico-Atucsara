import { useEffect, useState, useContext, useRef } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { AuthContext } from '../../context/AuthContext';
import Modal from 'react-modal';
import { IdCard, Book, Calendar, Wallet, GoldMedal } from '@icon-park/react';
import PaymentReceipt from '../Finance/PaymentReceipt'; // Asegúrate de que la ruta sea correcta

const StudentDashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const [grades, setGrades] = useState([]);
  const [payments, setPayments] = useState([]);
  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studentAttendance, setStudentAttendance] = useState([]);
  const [detailRecord, setDetailRecord] = useState(null);
  // Estado para los módulos de la carrera
  const [careerModules, setCareerModules] = useState([]);
  // Estado para los seminarios de la carrera
  const [careerSeminarios, setCareerSeminarios] = useState([]);
  // Estado para mostrar todas las notas o solo las recientes
  const [verTodasLasNotas, setVerTodasLasNotas] = useState(false);
  // --- ESTADO Y FUNCIONES PARA IMPRESIÓN DE RECIBO ---
  const [showFinanceReceiptModal, setShowFinanceReceiptModal] = useState(false);
  const [selectedFinanceReceipt, setSelectedFinanceReceipt] = useState(null);
  const financePrintAreaRef = useRef();
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

  // Simulación de horario, asistencia, materias y logros
  const schedule = [
    { day: 'Lunes', time: '08:00 - 10:00', subject: 'Programación I', teacher: 'María García', room: 'Lab 1' },
    { day: 'Lunes', time: '10:30 - 12:30', subject: 'Matemáticas', teacher: 'Carlos López', room: 'Aula 201' },
    { day: 'Martes', time: '08:00 - 10:00', subject: 'Bases de Datos', teacher: 'María García', room: 'Lab 2' },
    { day: 'Martes', time: '10:30 - 12:30', subject: 'Inglés Técnico', teacher: 'Ana Rodríguez', room: 'Aula 105' },
    { day: 'Miércoles', time: '08:00 - 10:00', subject: 'Programación I', teacher: 'María García', room: 'Lab 1' },
  ];
  const attendance = 92; // %
  const subjectsCount = 4;
  const achievementsCount = 3;
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      // Buscar info del estudiante (de StudentsTable)
      const studentsSnap = await getDocs(query(collection(db, 'students'), where('email', '==', currentUser.email)));
      let student = null;
      studentsSnap.forEach(doc => student = { id: doc.id, ...doc.data() });
      setStudentInfo(student);
      if (!student) {
        setGrades([]);
        setPayments([]);
        setStudentAttendance([]);
        setLoading(false);
        return;
      }
      // Calificaciones recientes (por studentId)
      const gradesSnap = await getDocs(query(collection(db, 'grades'), where('studentId', '==', student.id)));
      const gradesArr = [];
      gradesSnap.forEach(doc => gradesArr.push({ id: doc.id, ...doc.data() }));
      // Guardar todas las notas en el estado, no solo las 4 recientes
      setGrades(gradesArr.sort((a, b) => {
        // Ordenar por fecha descendente si existe, si no, por id
        if (a.date && b.date) {
          // Si es tipo string o timestamp
          const da = a.date.seconds ? a.date.seconds : Date.parse(a.date);
          const db = b.date.seconds ? b.date.seconds : Date.parse(b.date);
          return db - da;
        }
        return b.id.localeCompare(a.id);
      }));
      // Pagos (por studentId)
      const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('studentId', '==', student.id)));
      const paymentsArr = [];
      paymentsSnap.forEach(doc => paymentsArr.push({ id: doc.id, ...doc.data() }));
      setPayments(paymentsArr);
      // Asistencias (por studentId)
      const attSnap = await getDocs(query(collection(db, 'attendance'), where('studentId', '==', student.id)));
      const attArr = [];
      attSnap.forEach(doc => attArr.push({ id: doc.id, ...doc.data() }));
      setStudentAttendance(attArr);
      // --- NUEVO: Traer módulos y seminarios de la carrera ---
      if (student && student.career) {
        // Buscar la carrera por nombre
        const careersSnap = await getDocs(query(collection(db, 'careers'), where('nombre', '==', student.career)));
        let careerDoc = null;
        careersSnap.forEach(doc => careerDoc = { id: doc.id, ...doc.data() });
        if (careerDoc) {
          const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
          const modulesArr = modulesSnap.docs.map(m => ({ id: m.id, ...m.data() }));
          setCareerModules(modulesArr);
          // Seminarios de la carrera
          setCareerSeminarios(Array.isArray(careerDoc.seminarios) ? careerDoc.seminarios.map((s, idx) => ({ id: `seminario${idx+1}`, ...s })) : []);
        } else {
          setCareerModules([]);
          setCareerSeminarios([]);
        }
      } else {
        setCareerModules([]);
        setCareerSeminarios([]);
      }
      setLoading(false);
    };
    fetchData();
  }, [currentUser]);

  // --- Lógica para promedio final por módulo ---
  // Agrupar notas por módulo
  const notasPorModulo = {};
  grades.forEach(g => {
    if (!notasPorModulo[g.moduleName]) notasPorModulo[g.moduleName] = [];
    notasPorModulo[g.moduleName].push(g);
  });
  // Agrupar notas por grupo de actividad dentro de cada módulo, asegurando que ACTIVIDADES_1, ACTIVIDADES_2 y EVALUACION_FINAL estén presentes aunque no existan notas
  const notasPorModuloYGrupo = {};
  Object.entries(notasPorModulo).forEach(([modulo, notas]) => {
    notasPorModuloYGrupo[modulo] = {
      'ACTIVIDADES_1': [],
      'ACTIVIDADES_2': [],
      'EVALUACION_FINAL': [],
      'Otro': []
    };
    notas.forEach(nota => {
      const grupo = nota.groupName || nota.groupId || 'Otro';
      if (grupo === 'ACTIVIDADES_1' || grupo === 'ACTIVIDADES_2' || grupo === 'EVALUACION_FINAL') {
        notasPorModuloYGrupo[modulo][grupo].push(nota);
      } else {
        notasPorModuloYGrupo[modulo]['Otro'].push(nota);
      }
    });
  });
  // Función para calcular promedio ponderado igual que en GradeReport.js (redondeando a 2 decimales, usando 0 si falta algún grupo)
  const calcularPromedioFinal = (notas) => {
    const getNota = (grupo) => {
      const grupoNotas = notas.filter(n => n.groupId === grupo || n.groupName === grupo);
      if (!grupoNotas.length) return 0;
      return grupoNotas.reduce((acc, n) => acc + parseFloat(n.grade), 0) / grupoNotas.length;
    };
    const act1 = getNota('ACTIVIDADES_1');
    const act2 = getNota('ACTIVIDADES_2');
    const evalFinal = getNota('EVALUACION_FINAL');
    const p1 = act1 != null ? act1 : 0;
    const p2 = act2 != null ? act2 : 0;
    const pf = evalFinal != null ? evalFinal : 0;
    return (p1 * 0.3 + p2 * 0.3 + pf * 0.4).toFixed(2);
  };

  // Calcular asistencia real por módulo
  const asistenciaPorModulo = {};
  studentAttendance.forEach(rec => {
    if (!asistenciaPorModulo[rec.moduleName]) asistenciaPorModulo[rec.moduleName] = { total: 0, asistidos: 0 };
    Object.entries(rec.attendance || {}).forEach(([dateStr, val]) => {
      asistenciaPorModulo[rec.moduleName].total++;
      if (val === true) asistenciaPorModulo[rec.moduleName].asistidos++;
    });
  });
  // --- Lógica para mostrar asistencia por módulo según estado (usando moduleName real del registro de asistencia) ---
  // Buscar módulo "cursando" (si hay), si no, el último "aprobado"
  let moduloResumenNombre = null;
  let porcentajeResumen = null;
  if (studentInfo && Array.isArray(studentInfo.modulosAsignados)) {
    // Buscar todos los módulos en estado cursando
    const cursandoArr = studentInfo.modulosAsignados.filter(m => m.estado === 'cursando');
    if (cursandoArr.length > 0) {
      // Si hay más de uno, buscar el de mayor porcentaje de asistencia
      let mejorModulo = null;
      let mejorPorcentaje = null;
      cursandoArr.forEach(modAsignado => {
        // Sumar todas las asistencias de todos los registros de ese módulo para el estudiante
        const registros = studentAttendance.filter(rec => (rec.moduleId === modAsignado.id || rec.moduleName === modAsignado.nombre || rec.moduleName === (careerModules.find(cm => cm.id === modAsignado.id)?.nombre)));
        let total = 0;
        let asistidos = 0;
        registros.forEach(rec => {
          Object.entries(rec.attendance || {}).forEach(([dateStr, val]) => {
            total++;
            if (val === true) asistidos++;
          });
        });
        let porcentaje = total > 0 ? Math.round((asistidos / total) * 100) : 0;
        let nombreModulo = registros.length > 0 ? registros[0].moduleName : (careerModules.find(cm => cm.id === modAsignado.id)?.nombre || 'Módulo');
        if (mejorModulo === null || porcentaje > mejorPorcentaje) {
          mejorModulo = nombreModulo;
          mejorPorcentaje = porcentaje;
        }
      });
      moduloResumenNombre = mejorModulo;
      porcentajeResumen = mejorPorcentaje;
    } else {
      // Buscar el último aprobado (por orden de aparición en modulosAsignados)
      const aprobados = studentInfo.modulosAsignados.filter(m => m.estado === 'aprobado');
      if (aprobados.length > 0) {
        const moduloAsignado = aprobados[aprobados.length - 1];
        const registros = studentAttendance.filter(rec => (rec.moduleId === moduloAsignado.id || rec.moduleName === moduloAsignado.nombre || rec.moduleName === (careerModules.find(cm => cm.id === moduloAsignado.id)?.nombre)));
        let total = 0;
        let asistidos = 0;
        registros.forEach(rec => {
          Object.entries(rec.attendance || {}).forEach(([dateStr, val]) => {
            total++;
            if (val === true) asistidos++;
          });
        });
        if (registros.length > 0) {
          moduloResumenNombre = registros[0].moduleName;
          porcentajeResumen = total > 0 ? Math.round((asistidos / total) * 100) : 0;
        } else {
          const moduloObj = careerModules.find(cm => cm.id === moduloAsignado.id);
          moduloResumenNombre = moduloObj ? moduloObj.nombre : 'Módulo';
          porcentajeResumen = 0;
        }
      }
    }
  }
  // Cantidad de módulos actualmente cursando y sus nombres (únicos, sin duplicados y solo válidos)
  const modulosCursando = Array.from(new Set(
    (studentInfo?.modulosAsignados || [])
      .filter(m => m.estado === 'cursando')
      .map(m => {
        const moduloObj = careerModules.find(cm => cm.id === m.id);
        return moduloObj ? moduloObj.nombre : null;
      })
      .filter(Boolean)
  ));
  // Cantidad de módulos logrados (aprobados)
  const modulosAprobados = (studentInfo?.modulosAsignados || [])
    .filter(m => m.estado === 'aprobado')
    .map(m => {
      const moduloObj = careerModules.find(cm => cm.id === m.id);
      return moduloObj ? moduloObj.nombre : m.id;
    });
  // Seminarios aprobados (combinando carrera y personalizados)
  const seminariosAprobados = (careerSeminarios || [])
    .map(seminario => {
      let estado = seminario.estado || 'pendiente';
      let info = { ...seminario };
      if (Array.isArray(studentInfo?.seminarios)) {
        const sem = studentInfo.seminarios.find(s => s.id === seminario.id);
        if (sem) {
          estado = sem.estado || seminario.estado || 'pendiente';
          info = { ...seminario, ...sem };
        }
      }
      return { ...info, estado };
    })
    .filter(s => s.estado === 'aprobado')
    .map(s => s.nombre);

  // Calcular valores de pagos y descuentos
  const valorSemestre = 200000;
  const descuento = studentInfo?.descuento || 0;
  const valorConDescuento = valorSemestre - (valorSemestre * (descuento / 100));
  const pagosModulo = payments.filter(p => p.category === 'Pago de módulo' && p.status === 'completed');
  const totalPagadoModulo = pagosModulo.reduce((sum, p) => sum + Number(p.amount), 0);
  const saldoPendiente = Math.max(0, valorConDescuento - totalPagadoModulo);
  const formatCOP = v => v?.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

  // Estado para mostrar/ocultar notas por módulo
  const [modulosNotasVisibles, setModulosNotasVisibles] = useState({});
  const toggleNotasModulo = (modulo) => {
    setModulosNotasVisibles(prev => ({ ...prev, [modulo]: !prev[modulo] }));
  };

  if (loading) return <div className="p-8">Cargando tu panel...</div>;

  return (
    <div className="p-0 md:p-8 bg-gradient-to-br from-[#f5faff] to-[#e3eafc] min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#23408e] mb-1 tracking-tight drop-shadow-sm">¡Bienvenido, {studentInfo?.name || currentUser?.name}!</h1>
            <p className="text-gray-500 text-base md:text-lg">Aquí tienes un resumen de tu información académica y financiera.</p>
          </div>
          <div className="flex gap-2 mt-2 md:mt-0">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#e3fcec] text-[#009245] font-bold text-sm shadow border border-[#009245]">
              <IdCard theme="outline" size="20" className="mr-1" />
              {studentInfo?.career || '-'}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#e3eafc] text-[#23408e] font-bold text-sm shadow border border-[#23408e]">
              Inscrito: {studentInfo?.createdAt ? (studentInfo.createdAt.seconds ? new Date(studentInfo.createdAt.seconds * 1000).toLocaleDateString('es-CO') : new Date(studentInfo.createdAt).toLocaleDateString('es-CO')) : '--/--/----'}
            </span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Asistencia por módulo (modificada según lógica requerida) */}
          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-green-400 hover:scale-105 transition-transform duration-200">
            <div className="text-3xl font-extrabold text-green-600 mb-1">{moduloResumenNombre ? `${porcentajeResumen}%` : '--'}</div>
            <div className="text-base font-semibold text-gray-700">{moduloResumenNombre ? moduloResumenNombre : 'Sin datos'}</div>
            <div className="mt-2 text-sm text-gray-400">Asistencia por módulo</div>
          </div>
          {/* Módulos actualmente cursando */}
          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-blue-400 hover:scale-105 transition-transform duration-200">
            <div className="text-3xl font-extrabold text-blue-700 mb-1">{modulosCursando.length}</div>
            <div className="text-base font-semibold text-gray-700">Actualmente cursando</div>
            <div className="mt-2 text-sm text-gray-400">
              {modulosCursando.length > 0 ? modulosCursando.join(', ') : 'Sin módulos'}
            </div>
          </div>
          {/* Módulos logrados */}
          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-purple-400 hover:scale-105 transition-transform duration-200">
            <GoldMedal theme="outline" size="32" className="mb-2 text-purple-600" />
            <div className="text-3xl font-extrabold text-purple-600 mb-1">{modulosAprobados.length + seminariosAprobados.length}</div>
            <div className="text-base font-semibold text-gray-700">Reconocimientos</div>
            <div className="mt-2 text-sm text-gray-700 text-center w-full">
              {modulosAprobados.length + seminariosAprobados.length > 0 ? (
                <>
                  {modulosAprobados.length > 0 && (
                    <div className="mb-1">
                      <span className="font-semibold text-purple-700">Módulos:</span>
                      <ul className="inline ml-1">
                        {modulosAprobados.map((id, idx) => {
                          const mod = careerModules.find(m => m.id === id);
                          return (
                            <li key={id} className="inline text-gray-800 font-medium">
                              {mod ? mod.nombre : id}{idx < modulosAprobados.length - 1 ? <span className="text-gray-400">, </span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {seminariosAprobados.length > 0 && (
                    <div>
                      <span className="font-semibold text-green-700">Seminarios:</span>
                      <ul className="inline ml-1">
                        {seminariosAprobados.map((id, idx) => {
                          const sem = careerSeminarios.find(s => s.id === id);
                          return (
                            <li key={id} className="inline text-gray-800 font-medium">
                              {sem ? sem.nombre : id}{idx < seminariosAprobados.length - 1 ? <span className="text-gray-400">, </span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-gray-400">Sin reconocimientos</span>
              )}
            </div>
          </div>
        </div>

        {/* Sección de Calificaciones y Estado de Pagos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Calificaciones */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-[#23408e]">
                <Book theme="outline" size="22" className="mr-1" />
                Mis Calificaciones
              </h2>
            </div>
            {/* Promedios finales por módulo y botón para ver notas */}
            {Object.keys(notasPorModulo).length > 0 ? (
              <div className="mb-4 space-y-2">
                {Object.entries(notasPorModulo).map(([modulo, notas]) => (
                  <div key={modulo} className="flex flex-col md:flex-row md:items-center md:gap-4 border-b pb-2 mb-2">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-bold text-[#23408e] text-base">{modulo}:</span>
                      <span className="inline-block px-3 py-1 rounded-lg bg-[#e3fcec] text-[#23408e] font-bold text-lg shadow border border-[#009245]">{calcularPromedioFinal(notas)}</span>
                    </div>
                    <button
                      className="ml-2 px-3 py-1 rounded-full font-semibold shadow-sm border border-[#2563eb] text-[#2563eb] bg-white hover:bg-[#2563eb] hover:text-white text-xs md:text-sm transition"
                      onClick={() => toggleNotasModulo(modulo)}
                    >
                      {modulosNotasVisibles[modulo] ? 'Ver menos' : 'Ver notas'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400">No hay calificaciones registradas.</div>
            )}
            {/* Detalle de notas por módulo, solo si está visible */}
            <div className="space-y-8 mt-4">
              {Object.entries(notasPorModuloYGrupo).map(([modulo, grupos]) => (
                modulosNotasVisibles[modulo] && (
                  <div key={modulo} className="border rounded-xl p-3 bg-gray-50">
                    <div className="font-bold text-[#23408e] mb-2">{modulo}</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border text-xs md:text-sm">
                        <thead>
                          <tr className="bg-[#e3eafc] text-[#23408e]">
                            <th className="border px-2 py-1 text-left">Actividad</th>
                            <th className="border px-2 py-1 text-left">Grupo</th>
                            <th className="border px-2 py-1 text-left">Nota</th>
                            <th className="border px-2 py-1 text-left">Fecha</th>
                            <th className="border px-2 py-1 text-left">Profesor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(grupos).flatMap(([grupo, notas]) => (
                            (verTodasLasNotas ? notas : notas.slice(0, 2)).map((nota, idx) => (
                              <tr key={nota.id || idx}>
                                <td className="border px-2 py-1">{nota.activityName || nota.description || 'Actividad'}</td>
                                <td className="border px-2 py-1">{grupo}</td>
                                <td className="border px-2 py-1">{nota.grade}</td>
                                <td className="border px-2 py-1">{nota.date ? (nota.date.seconds ? new Date(nota.date.seconds * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : nota.date) : ''}</td>
                                <td className="border px-2 py-1">{nota.teacherName || ''}</td>
                              </tr>
                            ))
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Botón para ver más notas por módulo si hay más de 2 en algún grupo */}
                    {Object.values(grupos).some(notas => notas.length > 2) && !verTodasLasNotas && (
                      <button
                        className="mt-2 text-xs text-blue-700 underline hover:text-blue-900"
                        onClick={() => setVerTodasLasNotas(true)}
                      >
                        Ver más notas de este módulo
                      </button>
                    )}
                  </div>
                )
              ))}
            </div>
          </div>
          {/* Estado de Pagos */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2 text-[#23408e]">
              <Wallet theme="outline" size="22" className="mr-1" />
              Estado de Pagos
            </h2>
            <p className="text-gray-500 text-sm mb-3">Información sobre tus pagos y mensualidades</p>
            {/* Resumen de pagos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-lg border-l-4 border-blue-400 bg-blue-50 p-4 flex flex-col items-center">
                <div className="text-xs text-blue-700 font-semibold mb-1">Descuento aplicado</div>
                <div className="text-2xl font-bold text-blue-800">{descuento}%</div>
              </div>
              <div className="rounded-lg border-l-4 border-green-400 bg-green-50 p-4 flex flex-col items-center">
                <div className="text-xs text-green-700 font-semibold mb-1">Valor semestre (con desc.)</div>
                <div className="text-lg font-bold text-green-800">{formatCOP(valorConDescuento)}</div>
                <div className="text-xs text-gray-500">Valor sin descuento: {formatCOP(valorSemestre)}</div>
              </div>
              <div className="rounded-lg border-l-4 border-[#ffd600] bg-yellow-50 p-4 flex flex-col items-center">
                <div className="text-xs text-yellow-700 font-semibold mb-1">Total pagado (módulos)</div>
                <div className="text-lg font-bold text-yellow-800">{formatCOP(totalPagadoModulo)}</div>
              </div>
              <div className="rounded-lg border-l-4 border-red-400 bg-red-50 p-4 flex flex-col items-center">
                <div className="text-xs text-red-700 font-semibold mb-1">Saldo pendiente</div>
                <div className="text-lg font-bold text-red-800">{formatCOP(saldoPendiente)}</div>
              </div>
            </div>
            {/* Lista de pagos individuales */}
            <div className="mt-2">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Pagos realizados</h3>
              {payments.length === 0 ? (
                <div className="text-gray-500">No hay pagos registrados.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {payments.map((p, idx) => (
                    <li key={p.id || idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 text-sm">
                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="font-semibold text-gray-700">{p.description || 'Pago'}</span>
                        <span className="text-xs text-gray-400">{p.date ? new Date(p.date.seconds ? p.date.seconds * 1000 : p.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</span>
                        <span className="text-xs text-gray-500">{p.category}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <span className="font-semibold text-gray-900">{formatCOP(p.amount)}</span>
                        <span className={`text-xs font-semibold rounded px-2 py-0.5 ${p.status === 'completed' ? 'bg-green-50 text-green-700 border border-green-200' : p.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>{p.status === 'completed' ? 'Pagado' : p.status === 'pending' ? 'Pendiente' : 'Otro'}</span>
                        <button
                          className="border rounded px-2 py-1 text-blue-600 hover:bg-blue-50 text-xs ml-2"
                          onClick={() => handlePrintFinanceReceipt(p)}
                        >Imprimir</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Asistencia Detallada */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-gray-100">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-[#23408e]">
            <Calendar theme="outline" size="22" className="mr-1" />
            Mi Asistencia
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border rounded-lg">
              <thead>
                <tr className="bg-[#23408e] text-white">
                  <th className="px-4 py-2 text-center font-semibold">Módulo</th>
                  <th className="px-4 py-2 text-center font-semibold">Sábados</th>
                  <th className="px-4 py-2 text-center font-semibold">Asistencias</th>
                  <th className="px-4 py-2 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {studentAttendance.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-gray-400 py-4">No hay registros de asistencia.</td></tr>
                )}
                {(() => {
                  // Agrupar y fusionar asistencias por módulo (todas las fechas de todos los meses)
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
                  // Mostrar una fila por módulo, sumando todos los sábados y asistencias de todos los meses
                  return Object.values(asistenciaPorModulo).map((modRec, idx) => {
                    const totalSab = Object.keys(modRec.attendance).length;
                    const asistidos = Object.values(modRec.attendance).filter(val => val === true).length;
                    return (
                      <tr key={modRec.moduleName} className="border-b">
                        <td className="px-4 py-2 text-center">{modRec.moduleName}</td>
                        <td className="px-4 py-2 text-center">{totalSab}</td>
                        <td className="px-4 py-2 text-center">
                          <span className="inline-block px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 mr-2">{asistidos} Asistió</span>
                          <span className="inline-block px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">{totalSab - asistidos} No asistió</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            className="border rounded px-2 py-1 text-[#23408e] hover:bg-gray-50 text-xs font-semibold"
                            onClick={() => setDetailRecord({ ...modRec.recs[0], moduleName: modRec.moduleName, attendance: modRec.attendance })}
                          >Ver detalles</button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          {/* Modal de detalle de asistencia para estudiante */}
          {detailRecord && (
            <Modal
              isOpen={!!detailRecord}
              onRequestClose={() => setDetailRecord(null)}
              contentLabel="Detalle de Asistencia"
              className="modal-center max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 border-t-4 border-[#009245] animate-fadeIn"
              overlayClassName="overlay-center bg-black bg-opacity-40"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-[#23408e] flex items-center gap-2">
                  <svg className="w-7 h-7 text-[#23408e]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Detalle de Asistencia
                </h2>
                <button onClick={() => setDetailRecord(null)} className="text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
              </div>
              <div className="mb-4">
                <div className="font-semibold text-lg text-[#23408e]">Módulo: {detailRecord.moduleName || '-'}</div>
                <div className="text-gray-500">Mostrando todas las asistencias registradas en este módulo</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border rounded-lg">
                  <thead>
                    <tr className="bg-[#23408e] text-white">
                      <th className="px-4 py-2 text-left font-semibold">Fecha</th>
                      <th className="px-4 py-2 text-center font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Mostrar todas las asistencias de todos los meses/años para este módulo */}
                    {(() => {
                      // Buscar todos los registros de asistencia de este módulo
                      const allModuleRecords = studentAttendance.filter(r => r.moduleName === detailRecord.moduleName);
                      // Unir todas las fechas de asistencia en un solo objeto
                      const allAttendance = {};
                      allModuleRecords.forEach(r => {
                        Object.entries(r.attendance || {}).forEach(([date, val]) => {
                          allAttendance[date] = val;
                        });
                      });
                      // Ordenar fechas descendente
                      const sortedDates = Object.keys(allAttendance).sort((a, b) => new Date(b) - new Date(a));
                      return sortedDates.map(date => (
                        <tr key={date} className="border-b">
                          <td className="px-4 py-2 font-semibold text-[#23408e]">{new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="px-4 py-2 text-center">
                            {allAttendance[date] === true ? (
                              <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 font-semibold">Asistió</span>
                            ) : (
                              <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 font-semibold">No asistió</span>
                            )}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setDetailRecord(null)}
                  className="px-6 py-2 bg-[#009245] text-white rounded-md hover:bg-[#23408e] font-semibold"
                >Cerrar</button>
              </div>
            </Modal>
          )}
        </div>

        {/* Módulos de la Carrera */}
        {careerModules.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-l-4 border-[#2563eb]">
            <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-[#2563eb]">
              <Book theme="outline" size="22" className="mr-1" />
              Módulos de la Carrera
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {careerModules.map((mod) => {
                // Buscar estado del módulo en los asignados al estudiante
                let estado = 'pendiente';
                if (studentInfo && Array.isArray(studentInfo.modulosAsignados)) {
                  const modAsignado = studentInfo.modulosAsignados.find(m => m.id === mod.id);
                  if (modAsignado) estado = modAsignado.estado || 'cursando';
                }
                let color = '';
                let border = '';
                if (estado === 'aprobado') {
                  color = 'bg-green-100 text-green-800';
                  border = 'border-green-400';
                } else if (estado === 'cursando') {
                  color = 'bg-blue-100 text-blue-800';
                  border = 'border-blue-400';
                } else {
                  color = 'bg-gray-100 text-gray-700';
                  border = 'border-gray-300';
                }
                return (
                  <div key={mod.id} className={`rounded-lg border-l-4 ${border} ${color} p-4 shadow-sm flex flex-col gap-1`}>
                    <div className="font-bold text-base">{mod.nombre}</div>
                    <div className="text-xs text-gray-500 mb-1">{mod.descripcion}</div>
                    <div className="text-xs font-semibold">
                      Estado: <span className="capitalize">{estado}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Seminarios obligatorios de la carrera */}
        {careerSeminarios.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-l-4 border-green-600">
            <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-green-700">
              <Book theme="outline" size="22" className="mr-1" />
              Seminarios obligatorios
            </h2>
            <ul className="space-y-2 mb-4">
              {careerSeminarios.map((seminario) => {
                // Buscar si el estudiante tiene estado propio para este seminario
                let estado = seminario.estado || 'pendiente';
                let info = { ...seminario };
                if (Array.isArray(studentInfo?.seminarios)) {
                  const sem = studentInfo.seminarios.find(s => s.id === seminario.id);
                  if (sem) {
                    estado = sem.estado || seminario.estado || 'pendiente';
                    info = { ...seminario, ...sem };
                  }
                }
                let estadoColor = '';
                switch ((estado || '').toLowerCase()) {
                  case 'aprobado':
                    estadoColor = 'bg-green-100 text-green-800 border-green-300';
                    break;
                  case 'cursando':
                    estadoColor = 'bg-blue-100 text-blue-800 border-blue-300';
                    break;
                  case 'pendiente':
                  default:
                    estadoColor = 'bg-gray-100 text-gray-700 border-gray-300';
                }
                return (
                  <li key={seminario.id} className="flex flex-col gap-1 p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-green-50 transition">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-green-900 text-base truncate max-w-[60%]">{info.nombre} <span className="text-xs text-gray-500">(Semestre {info.semestre})</span></span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${estadoColor} ml-2`}>
                        {estado.charAt(0).toUpperCase() + estado.slice(1)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-semibold">Profesor:</span> {info.profesor || 'Sin asignar'}<br/>
                      <span className="font-semibold">Horas:</span> {info.horas || '-'}<br/>
                      <span className="font-semibold">Estado:</span> {estado.charAt(0).toUpperCase() + estado.slice(1)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Pagos recientes */}
      {/* <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Wallet theme="filled" size="24" fill="#23408e" /> Finanzas
        </h2>
        {payments.length === 0 ? (
          <div className="text-gray-500">No hay pagos registrados.</div>
        ) : (
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">Fecha</th>
                <th className="text-left py-1">Descripción</th>
                <th className="text-left py-1">Categoría</th>
                <th className="text-right py-1">Valor</th>
                <th className="text-right py-1">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(pago => (
                <tr key={pago.id} className="border-b">
                  <td className="py-1">{pago.date ? new Date(pago.date.seconds ? pago.date.seconds * 1000 : pago.date).toLocaleDateString() : ''}</td>
                  <td className="py-1">{pago.description}</td>
                  <td className="py-1">{pago.category}</td>
                  <td className="py-1 text-right">${Number(pago.amount).toLocaleString()}</td>
                  <td className="py-1 text-right">
                    <button
                      className="border rounded px-2 py-1 text-blue-600 hover:bg-blue-50 text-xs"
                      onClick={() => handlePrintFinanceReceipt(pago)}
                    >Imprimir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div> */}

      {/* --- MODAL DE IMPRESIÓN DE RECIBO --- */}
      {showFinanceReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 print:bg-transparent">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full relative border-t-4 border-blue-600 print:shadow-none print:border-0 print:p-0 print:rounded-none">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 print:hidden" onClick={() => setShowFinanceReceiptModal(false)}>&times;</button>
            <div ref={financePrintAreaRef}>
              <PaymentReceipt
                pago={selectedFinanceReceipt}
                estudiante={studentInfo}
                reciboNumero={selectedFinanceReceipt ? selectedFinanceReceipt.id?.slice(-6) : ''}
              />
            </div>
            <div className="flex justify-end mt-6 gap-2 print:hidden">
              <button onClick={() => setShowFinanceReceiptModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cerrar</button>
              <button
                onClick={handlePrintFinanceModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
              >Imprimir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
