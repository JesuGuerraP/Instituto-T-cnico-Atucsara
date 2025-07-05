import { useState, useEffect, useContext } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import Modal from 'react-modal';

const months = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getSaturdays(year, month) {
  const saturdays = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    if (date.getDay() === 6) {
      saturdays.push(new Date(date));
    }
    date.setDate(date.getDate() + 1);
  }
  return saturdays;
}

const AttendanceManager = () => {
  const { currentUser } = useContext(AuthContext);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  // Estructura: attendance[studentId][dateStr] = true/false
  const [attendance, setAttendance] = useState({});
  
  // Utilidad para obtener fecha local en formato YYYY-MM-DD
  function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
  }
  // Estado para mostrar sábados del mes siguiente
  const [showNextMonthSaturdays, setShowNextMonthSaturdays] = useState(false);
  const [loading, setLoading] = useState(true);
  const [careers, setCareers] = useState([]);
  const [selectedCareer, setSelectedCareer] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [careerModules, setCareerModules] = useState([]);
  const [modulesForCareer, setModulesForCareer] = useState([]);
  const [editStudentId, setEditStudentId] = useState(null); // Nuevo: para saber si se está editando un estudiante
  // Filtro de módulo para la tabla principal
  const [filterModule, setFilterModule] = useState('');
  // Lista global de módulos para el filtro
  const [allModuleNames, setAllModuleNames] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Obtener todos los usuarios para mostrar nombre en "registrado por"
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersArr = [];
      usersSnap.forEach(doc => usersArr.push({ id: doc.id, ...doc.data() }));
      setUsers(usersArr);
      // Obtener estudiantes y carreras según el rol
      const allStudentsSnap = await getDocs(collection(db, 'students'));
      const allStudentsArr = [];
      allStudentsSnap.forEach(doc => allStudentsArr.push({ id: doc.id, ...doc.data() }));
      if (currentUser.role === 'teacher') {
        // Buscar el docente en la colección teachers
        let teacher = null;
        const teachersSnap = await getDocs(collection(db, 'teachers'));
        teachersSnap.forEach(docu => {
          const t = docu.data();
          const fullName = (t.name + ' ' + (t.lastName || '')).trim().toLowerCase().replace(/\s+/g, ' ');
          const userFullName = (currentUser.name + ' ' + (currentUser.lastName || '')).trim().toLowerCase().replace(/\s+/g, ' ');
          if (
            (t.email && t.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            (fullName && userFullName && fullName === userFullName)
          ) {
            teacher = { id: docu.id, ...t };
          }
        });
        if (!teacher) {
          setCareers([]);
          setStudents([]);
          setLoading(false);
          return;
        }
        // Buscar módulos asignados al docente
        const careersSnap = await getDocs(collection(db, 'careers'));
        let teacherCareers = new Set();
        let teacherModules = [];
        for (const careerDoc of careersSnap.docs) {
          const carrera = careerDoc.data();
          const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
          modulesSnap.forEach(moduleDoc => {
            const modulo = moduleDoc.data();
            const moduloProfesor = (modulo.profesor || '').trim().toLowerCase().replace(/\s+/g, ' ');
            const moduloProfesorEmail = (modulo.profesorEmail || '').toLowerCase();
            const teacherEmails = [teacher.email?.toLowerCase()].filter(Boolean);
            const teacherNames = [
              (teacher.name + ' ' + (teacher.lastName || '')).trim().toLowerCase().replace(/\s+/g, ' '),
              teacher.name?.toLowerCase(),
            ].filter(Boolean);
            if (
              (moduloProfesor && teacherNames.includes(moduloProfesor)) ||
              (moduloProfesorEmail && teacherEmails.includes(moduloProfesorEmail)) ||
              (teacherEmails.length && modulo.profesor && teacherEmails.includes(modulo.profesor.toLowerCase()))
            ) {
              teacherCareers.add(carrera.nombre);
              teacherModules.push({
                ...modulo,
                id: moduleDoc.id,
                nombre: modulo.nombre,
                careerId: careerDoc.id,
                careerName: carrera.nombre
              });
            }
          });
        }
        // Solo mostrar la(s) carrera(s) del docente
        const careersArr = Array.from(teacherCareers);
        setCareers(careersArr);
        setSelectedCareer(careersArr[0] || '');
        // Solo mostrar estudiantes que tengan módulos asignados del docente
        const filteredStudents = allStudentsArr.filter(student =>
          student.modulosAsignados?.some(m => teacherModules.some(tm => tm.id === m.id))
        );
        setStudents(filteredStudents);
        setCareerModules(teacherModules);
        setModulesForCareer(teacherModules);
        setLoading(false);
      } else {
        // Admin/secretary: mostrar todo
        const uniqueCareers = Array.from(new Set(allStudentsArr.map(s => s.career).filter(Boolean)));
        setCareers(['Todos', ...uniqueCareers]);
        setSelectedCareer('Todos');
        setStudents(allStudentsArr);
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  useEffect(() => {
    // Filtrar estudiantes por carrera seleccionada
    const fetchStudentsByCareer = async () => {
      setLoading(true);
      let studentsSnap;
      if (selectedCareer === 'Todos' || !selectedCareer) {
        // Mostrar todos los estudiantes para admin y teacher
        studentsSnap = await getDocs(collection(db, 'students'));
      } else {
        // Filtrar solo por carrera seleccionada (sin importar el rol)
        studentsSnap = await getDocs(query(collection(db, 'students'), where('career', '==', selectedCareer)));
      }
      const studentsArr = [];
      studentsSnap.forEach(doc => studentsArr.push({ id: doc.id, ...doc.data() }));
      setStudents(studentsArr);
      setSelectedStudent(studentsArr[0]?.id || '');
      setLoading(false);
    };
    // Solo ejecutar si hay carreras cargadas
    if (careers.length > 0 && selectedCareer !== undefined) fetchStudentsByCareer();
  }, [selectedCareer, currentUser, careers]);

  useEffect(() => {
    // Cargar asistencia guardada para todos los estudiantes de la carrera/modulo/mes/año
    const fetchAttendance = async () => {
      if (!students.length || !selectedModule) return;
      const attSnap = await getDocs(query(
        collection(db, 'attendance'),
        where('year', '==', year),
        where('month', '==', month),
        where('moduleId', '==', selectedModule)
      ));
      const attData = {};
      attSnap.forEach(docu => {
        const data = docu.data();
        if (data.studentId && data.attendance) {
          attData[data.studentId] = data.attendance;
        }
      });
      setAttendance(attData);
    };
    fetchAttendance();
  }, [students, year, month, selectedModule]);

  // Cargar registros de asistencia para la carrera seleccionada o todos
  // Cargar todos los módulos posibles para el filtro
  useEffect(() => {
    const fetchAllModules = async () => {
      const attSnap = await getDocs(collection(db, 'attendance'));
      const modulesMap = new Map();
      attSnap.forEach(docu => {
        const data = docu.data();
        // Solo módulos con al menos una fecha de asistencia
        if (data.moduleName && data.attendance && Object.keys(data.attendance).length > 0) {
          const normalized = data.moduleName.trim().toLowerCase();
          if (!modulesMap.has(normalized)) {
            modulesMap.set(normalized, data.moduleName.trim());
          }
        }
      });
      setAllModuleNames(Array.from(modulesMap.values()));
    };
    fetchAllModules();
  }, []);

  useEffect(() => {
    const fetchAttendanceRecords = async () => {
      setLoading(true);
      let studentsArr = [];
      if (selectedCareer === 'Todos' || !selectedCareer) {
        // Mostrar todos los estudiantes para admin y teacher
        const studentsSnap = await getDocs(collection(db, 'students'));
        studentsSnap.forEach(doc => studentsArr.push({ id: doc.id, ...doc.data() }));
      } else {
        // Filtrar solo por carrera seleccionada (sin importar el rol)
        const studentsSnap = await getDocs(query(collection(db, 'students'), where('career', '==', selectedCareer)));
        studentsSnap.forEach(doc => studentsArr.push({ id: doc.id, ...doc.data() }));
      }
      setStudents(studentsArr);
      // Traer asistencias según filtro de módulo
      let attArr = [];
      if (filterModule) {
        // Traer todas las asistencias de ese módulo (sin importar mes ni año)
        const attSnap = await getDocs(query(collection(db, 'attendance'), where('moduleName', '==', filterModule)));
        attSnap.forEach(docu => {
          const data = docu.data();
          attArr.push({ id: docu.id, ...data });
        });
      } else {
        // Traer todos los documentos de asistencia y filtrar por mes/año en frontend
        const attSnap = await getDocs(collection(db, 'attendance'));
        attSnap.forEach(docu => {
          const data = docu.data();
          attArr.push({ id: docu.id, ...data });
        });
      }
      setAttendanceRecords(attArr);
      setLoading(false);
    };
    fetchAttendanceRecords();
  }, [selectedCareer, year, month, showModal, currentUser, filterModule]);

  const saturdays = getSaturdays(year, month);
  // Sábados del mes siguiente
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonthSaturdays = getSaturdays(nextMonthYear, nextMonth);

  const handleAttendanceChange = (studentId, dateStr, value) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [dateStr]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!students.length || !moduleName) {
      toast.error('Debes ingresar el nombre del módulo.');
      return;
    }
    try {
      // Guardar solo la asistencia de los estudiantes que tengan algún valor marcado (asistió/no asistió en al menos una fecha)
      const studentsWithAttendance = students.filter(student => attendance[student.id] && Object.keys(attendance[student.id]).length > 0);
      for (const student of studentsWithAttendance) {
        // Leer asistencia previa (si existe)
        const docRef = doc(db, 'attendance', `${student.id}_${moduleName}`);
        let prevAttendance = {};
        try {
          const prevDoc = await getDocs(query(collection(db, 'attendance'), where('studentId', '==', student.id), where('moduleName', '==', moduleName)));
          prevDoc.forEach(d => {
            if (d.id === `${student.id}_${moduleName}` && d.data().attendance) {
              prevAttendance = d.data().attendance;
            }
          });
        } catch (e) {}
        // Solo guardar si hay cambios reales
        let hasChanges = false;
        const mergedAttendance = { ...prevAttendance };
        for (const [dateStr, value] of Object.entries(attendance[student.id])) {
          if (prevAttendance[dateStr] !== value) {
            hasChanges = true;
            mergedAttendance[dateStr] = value;
          }
        }
        // Eliminar fechas que ya no están en attendance[student.id]
        for (const dateStr of Object.keys(prevAttendance)) {
          if (!(dateStr in attendance[student.id])) {
            hasChanges = true;
            delete mergedAttendance[dateStr];
          }
        }
        // Si no queda ninguna asistencia, eliminar el documento
        if (hasChanges) {
          if (Object.keys(mergedAttendance).length === 0) {
            await deleteDoc(docRef);
          } else {
            await setDoc(docRef, {
              studentId: student.id,
              moduleName,
              attendance: mergedAttendance,
              updatedBy: currentUser.uid,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
      toast.success('Asistencia guardada correctamente');
    } catch (e) {
      toast.error('Error al guardar la asistencia');
    }
  };

  // Eliminar asistencia
  const handleDelete = async () => {
    if (!deleteRecord) return;
    try {
      await deleteDoc(doc(db, 'attendance', deleteRecord.id));
      setAttendanceRecords(prev => prev.filter(r => r.id !== deleteRecord.id));
      setShowDeleteModal(false);
      setDeleteRecord(null);
      toast.success('Registro de asistencia eliminado');
    } catch (e) {
      toast.error('Error al eliminar el registro');
    }
  };

  useEffect(() => {
    // Cuando cambia la carrera seleccionada, cargar los módulos de esa carrera
    const fetchModules = async () => {
      if (!selectedCareer || selectedCareer === 'Todos') {
        setCareerModules([]);
        return;
      }
      const careersSnap = await getDocs(collection(db, 'careers'));
      const careerDoc = careersSnap.docs.find(doc => (doc.data().nombre || '').toLowerCase() === selectedCareer.toLowerCase());
      if (!careerDoc) {
        setCareerModules([]);
        return;
      }
      const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
      setCareerModules(modulesSnap.docs.map(m => ({ id: m.id, ...m.data() })));
    };
    fetchModules();
  }, [selectedCareer]);

  useEffect(() => {
    // Cargar módulos de la carrera seleccionada SOLO cuando el modal está abierto
    const fetchModules = async () => {
      if (!showModal || !selectedCareer || selectedCareer === 'Todos') {
        setModulesForCareer([]);
        return;
      }
      // Buscar la carrera por nombre
      const careersSnap = await getDocs(collection(db, 'careers'));
      const careerDoc = careersSnap.docs.find(doc => (doc.data().nombre || '').toLowerCase() === selectedCareer.toLowerCase());
      if (!careerDoc) {
        setModulesForCareer([]);
        return;
      }
      // Traer módulos de la subcolección
      const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
      const modulesArr = modulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setModulesForCareer(modulesArr);
    };
    fetchModules();
  }, [selectedCareer, showModal]);

  // Limpiar módulo seleccionado cuando cambia la carrera en el modal
  useEffect(() => {
    if (showModal && !editStudentId) setModuleName('');
  }, [selectedCareer, showModal, editStudentId]);

  // --- NUEVO: Mantener módulo seleccionado y cargar asistencias previas correctamente ---
  // Cuando se abre el modal para actualizar, mantener el módulo y cargar asistencias previas
  useEffect(() => {
    if (showModal && selectedStudent && (moduleName || selectedModule)) {
      // Buscar asistencia previa para ese estudiante, módulo, mes y año
      let rec = null;
      if (selectedModule) {
        rec = attendanceRecords.find(r =>
          r.studentId === selectedStudent &&
          (r.moduleId === selectedModule || r.moduleName === moduleName) &&
          r.month === month && r.year === year
        );
      } else if (moduleName) {
        rec = attendanceRecords.find(r =>
          r.studentId === selectedStudent &&
          r.moduleName === moduleName &&
          r.month === month && r.year === year
        );
      }
      if (rec) {
        setAttendance(prev => ({ ...prev, [selectedStudent]: rec.attendance || {} }));
        if (rec.moduleName && moduleName !== rec.moduleName) setModuleName(rec.moduleName);
        if (rec.moduleId && selectedModule !== rec.moduleId) setSelectedModule(rec.moduleId);
      }
    }
  }, [showModal, selectedStudent, moduleName, selectedModule, month, year, attendanceRecords]);

  // Al abrir el modal de actualizar, asegurar que el select de módulo tenga el valor correcto
  const handleUpdateClick = (rec, student) => {
    setShowModal(true);
    setModuleName(rec.moduleName);
    setSelectedModule(rec.moduleId || '');
    // Si existen los campos mes y año en el registro, usarlos; si no, intentar inferirlos de las fechas de asistencia
    if (typeof rec.month === 'number' && typeof rec.year === 'number') {
      setMonth(rec.month);
      setYear(rec.year);
    } else if (rec.attendance && Object.keys(rec.attendance).length > 0) {
      // Tomar la primera fecha de asistencia
      const firstDate = Object.keys(rec.attendance)[0];
      const [y, m] = firstDate.split('-');
      setYear(Number(y));
      setMonth(Number(m) - 1);
    }
    setSelectedCareer(student.career);
    setSelectedStudent(student.id);
    setAttendance(prev => ({ ...prev, [student.id]: rec.attendance || {} }));
    setEditStudentId(student.id);
  };

  // --- CORRECCIÓN FINAL: Sincronizar el valor del select de módulo al abrir el modal (rol teacher) ---
  useEffect(() => {
    if (showModal && modulesForCareer.length > 0 && moduleName) {
      // Si el módulo existe en la lista, forzar el valor del select
      const exists = modulesForCareer.some(m => m.nombre === moduleName);
      if (!exists && selectedModule) {
        // Buscar por id si el nombre no está sincronizado
        const mod = modulesForCareer.find(m => m.id === selectedModule);
        if (mod) setModuleName(mod.nombre);
      }
    }
  }, [showModal, modulesForCareer, moduleName, selectedModule]);

  // --- NUEVO: Cargar asistencias previas solo al seleccionar módulo en modo registro ---
  useEffect(() => {
    // Solo cargar si el modal está abierto, no estamos editando, y hay módulo seleccionado
    if (showModal && !editStudentId && moduleName && modulesForCareer.length > 0) {
      // Buscar el módulo seleccionado por nombre
      const mod = modulesForCareer.find(m => m.nombre === moduleName);
      if (!mod) return;
      // Traer asistencias previas de todos los estudiantes para ese módulo (todas las fechas)
      (async () => {
        const attSnap = await getDocs(query(
          collection(db, 'attendance'),
          where('moduleName', '==', moduleName)
        ));
        const attData = {};
        attSnap.forEach(docu => {
          const data = docu.data();
          if (data.studentId && data.attendance) {
            attData[data.studentId] = data.attendance;
          }
        });
        setAttendance(attData);
      })();
    }
    // Si se borra el módulo, limpiar asistencias
    if (showModal && !editStudentId && !moduleName) {
      setAttendance({});
    }
  }, [showModal, moduleName, modulesForCareer, editStudentId]);

  return (
    <div className="max-w-5xl mx-auto p-2 sm:p-6 bg-white rounded-lg shadow border border-gray-100 mt-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-[#23408e] flex items-center gap-2">
          <svg className="w-7 h-7 text-[#23408e]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          Gestión de Asistencia
        </h1>
        <button
          onClick={() => {
            setShowModal(true);
            setModuleName('');
            setSelectedModule('');
            setSelectedStudent('');
            setEditStudentId(null);
            setAttendance({}); // Limpiar todas las asistencias al abrir el modal
            // Establecer mes y año actual
            const now = new Date();
            setMonth(now.getMonth());
            setYear(now.getFullYear());
          }}
          className="bg-[#009245] hover:bg-[#23408e] text-white font-semibold px-4 py-2 rounded shadow flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Registrar Asistencia
        </button>
      </div>
      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold mb-1 text-[#23408e]">Carrera</label>
          <select className="w-full border border-[#23408e] rounded px-2 py-2 focus:ring-2 focus:ring-[#009245] text-[#23408e] font-semibold text-sm" value={selectedCareer} onChange={e => setSelectedCareer(e.target.value)}>
            {careers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-[#23408e]">Filtrar por módulo</label>
          <select className="w-full border border-[#23408e] rounded px-2 py-2 focus:ring-2 focus:ring-[#009245] text-[#23408e] font-semibold text-sm" value={filterModule} onChange={e => setFilterModule(e.target.value)}>
            <option value="">Todos</option>
            {(
              selectedCareer && selectedCareer !== 'Todos' && careerModules.length > 0
                ? careerModules.map(m => (
                    <option key={m.nombre} value={m.nombre}>{m.nombre}</option>
                  ))
                : allModuleNames.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))
            )}
          </select>
        </div>
      </div>
      {/* Tabla de información de asistencia */}
      <div className="overflow-x-auto mt-4">
        <table className="min-w-[700px] w-full border rounded-lg text-xs sm:text-base">
          <thead>
            <tr className="bg-[#23408e] text-white">
              <th className="px-4 py-2 text-left font-semibold">Carrera</th>
              <th className="px-4 py-2 text-center font-semibold">Módulo</th>
              <th className="px-4 py-2 text-center font-semibold">Estudiante</th>
              <th className="px-4 py-2 text-center font-semibold">Sábados</th>
              <th className="px-4 py-2 text-center font-semibold">Asistencias</th>
              <th className="px-4 py-2 text-center font-semibold">Registrado por</th>
              <th className="px-4 py-2 text-center font-semibold">Última actualización</th>
              <th className="px-4 py-2 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {/* Agrupar por carrera y módulo */}
            {(() => {
              // Filtrar registros por módulo si está seleccionado
              let filteredRecords = filterModule
                ? attendanceRecords.filter(r => r.moduleName === filterModule)
                : attendanceRecords;
              // Agrupar por carrera, luego por módulo
              const grouped = {};
              filteredRecords.forEach(rec => {
                const student = students.find(s => s.id === rec.studentId);
                if (!student) return;
                const career = student.career || 'Sin carrera';
                if (!grouped[career]) grouped[career] = {};
                if (!grouped[career][rec.moduleName]) grouped[career][rec.moduleName] = [];
                grouped[career][rec.moduleName].push({ ...rec, student });
              });
              // Renderizar agrupado
              return Object.entries(grouped).map(([career, modules]) => (
                Object.entries(modules).map(([modName, records]) => (
                  records.map((rec, idx) => {
                    let totalSab = 0;
                    let asistidos = 0;
                    Object.entries(rec.attendance || {}).forEach(([dateStr, val]) => {
                      totalSab++;
                      if (val === true) asistidos++;
                    });
                    return (
                      <tr key={rec.id} className="border-b hover:bg-[#f0f6ff]">
                        <td className="px-4 py-2 font-semibold whitespace-nowrap text-[#23408e]">{career}</td>
                        <td className="px-4 py-2 text-center text-[#009245] font-semibold">{modName}</td>
                        <td className="px-4 py-2 font-semibold whitespace-nowrap text-[#23408e]">{rec.student.name} {rec.student.lastName}</td>
                        <td className="px-4 py-2 text-center">{totalSab}</td>
                        <td className="px-4 py-2 text-center">
                          <span className="inline-block px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 mr-2">{asistidos} Asistió</span>
                          <span className="inline-block px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">{totalSab - asistidos} No asistió</span>
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-gray-700">{
                          (() => {
                            const user = users.find(u => u.id === rec.updatedBy);
                            return user ? `${user.name || ''} ${user.lastName || ''}`.trim() : rec.updatedBy;
                          })()
                        }</td>
                        <td className="px-4 py-2 text-center text-xs text-gray-500">{rec.updatedAt ? new Date(rec.updatedAt).toLocaleString('es-CO') : '-'}</td>
                        <td className="px-4 py-2 text-center flex gap-2 justify-center">
                          <button
                            className="border rounded px-2 py-1 text-[#23408e] hover:bg-gray-50 text-xs font-semibold"
                            onClick={() => { setDetailRecord({ ...rec, student: rec.student }); setShowDetailModal(true); }}
                          >Ver</button>
                          <button
                            className="border rounded px-2 py-1 text-[#009245] hover:bg-blue-50 text-xs font-semibold"
                            onClick={() => handleUpdateClick(rec, rec.student)}
                          >Actualizar</button>
                          <button
                            className="border rounded px-2 py-1 text-red-600 hover:bg-red-100 text-xs font-semibold"
                            onClick={() => { setDeleteRecord(rec); setShowDeleteModal(true); }}
                          >Eliminar</button>
                        </td>
                      </tr>
                    );
                  })
                ))
              ));
            })()}
          </tbody>
        </table>
      </div>
      {/* Modal para registrar asistencia */}
      <Modal
        isOpen={showModal}
        onRequestClose={() => {
          setShowModal(false);
          setSelectedStudent('');
          setModuleName('');
          setEditStudentId(null); // Limpiar modo edición
        }}
        contentLabel="Registrar Asistencia"
        className="modal-center max-w-[900px] min-w-[65vw] w-[75vw] bg-white rounded-2xl shadow-2xl p-2 sm:p-10 border-t-8 border-[#009245] overflow-y-auto max-h-[90vh]"
        overlayClassName="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50"
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#23408e] flex items-center gap-3">
            <svg className="w-8 h-8 text-[#23408e]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Registrar Asistencia
          </h2>
          <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 text-3xl font-bold">&times;</button>
        </div>
        {/* Formulario de asistencia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <div>
            <label className="block text-base font-semibold mb-2 text-[#23408e]">Carrera</label>
            <select className="w-full border-2 border-[#23408e] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#009245] text-[#23408e] font-semibold text-base bg-white shadow-sm" value={selectedCareer} onChange={e => setSelectedCareer(e.target.value)}>
              {careers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-base font-semibold mb-2 text-[#23408e]">Mes</label>
            <select className="w-full border-2 border-[#23408e] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#009245] text-[#23408e] font-semibold text-base bg-white shadow-sm" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {months.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-base font-semibold mb-2 text-[#23408e]">Año</label>
            <input type="number" className="w-full border-2 border-[#23408e] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#009245] text-[#23408e] font-semibold text-base bg-white shadow-sm" value={year} onChange={e => setYear(Number(e.target.value))} min={2020} max={2100} />
          </div>
          <div>
            <label className="block text-base font-semibold mb-2 text-[#23408e]">Módulo</label>
            {modulesForCareer.length > 0 ? (
              <select
                name="moduleName"
                className="w-full border-2 border-[#009245] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#23408e] text-[#009245] font-semibold text-base bg-white shadow-sm"
                value={moduleName}
                onChange={e => setModuleName(e.target.value)}
              >
                <option value="">Selecciona un módulo...</option>
                {modulesForCareer.map(m => (
                  <option key={m.id} value={m.nombre}>{m.nombre}</option>
                ))}
              </select>
            ) : (
              <input type="text" className="w-full border-2 border-[#009245] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#23408e] text-[#009245] font-semibold text-base bg-white shadow-sm" placeholder="Nombre del módulo..." value={moduleName} onChange={e => setModuleName(e.target.value)} />
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full border rounded-2xl text-xs sm:text-base shadow-md">
            <thead>
              <tr className="bg-[#23408e] text-white">
                <th className="px-4 py-3 text-left font-semibold">Estudiante</th>
                {saturdays.map((date, idx) => {
                  const isLast = idx === saturdays.length - 1;
                  return (
                    <th key={toLocalDateString(date)} className="px-4 py-3 text-center font-semibold relative">
                    {date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      {isLast && (
                        <button
                          type="button"
                          title="Agregar sábados del mes siguiente"
                          onClick={() => setShowNextMonthSaturdays(true)}
                          style={{ position: 'absolute', right: '-18px', top: '50%', transform: 'translateY(-50%)', display: showNextMonthSaturdays ? 'none' : 'block' }}
                          className="ml-2 bg-[#009245] hover:bg-[#23408e] text-white rounded-full w-7 h-7 flex items-center justify-center shadow border border-white"
                        >
                          <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
                        </button>
                      )}
                    </th>
                  );
                })}
                {showNextMonthSaturdays && nextMonthSaturdays.map((date, idx) => (
                  <th key={toLocalDateString(date)} className="px-4 py-3 text-center font-semibold bg-[#e6f9ed] text-[#009245] relative">
                    {date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                    {idx === 0 && (
                      <button
                        type="button"
                        title="Quitar sábados del mes siguiente"
                        onClick={() => setShowNextMonthSaturdays(false)}
                        style={{ position: 'absolute', left: '-18px', top: '50%', transform: 'translateY(-50%)' }}
                        className="mr-2 bg-[#d32f2f] hover:bg-[#23408e] text-white rounded-full w-7 h-7 flex items-center justify-center shadow border border-white"
                      >
                        <span style={{ fontSize: 22, lineHeight: 1 }}>-</span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id} className="border-b hover:bg-[#f0f6ff]">
                  <td className="px-4 py-3 font-semibold whitespace-nowrap text-[#23408e] text-base">{student.name} {student.lastName}</td>
                  {saturdays.map(date => {
                    const dateStr = toLocalDateString(date);
                    const isEditable = !selectedStudent || student.id === selectedStudent;
                    const currentValue = attendance[student.id]?.[dateStr];
                    return (
                      <td key={dateStr} className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          {/* Checkbox Asistió */}
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentValue === true}
                              onChange={() => {
                                if (!isEditable) return;
                                if (currentValue === true) {
                                  setAttendance(prev => {
                                    const copy = { ...prev };
                                    if (copy[student.id]) {
                                      copy[student.id] = { ...copy[student.id] };
                                      delete copy[student.id][dateStr];
                                      if (Object.keys(copy[student.id]).length === 0) delete copy[student.id];
                                    }
                                    return copy;
                                  });
                                } else {
                                  handleAttendanceChange(student.id, dateStr, true);
                                }
                              }}
                              className="accent-[#009245] w-6 h-6 rounded-lg border-2 border-[#009245] shadow-sm"
                              disabled={!isEditable}
                            />
                            <span className="ml-2 text-green-700 font-semibold text-sm">Asistió</span>
                          </label>
                          {/* Checkbox No asistió */}
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentValue === false}
                              onChange={() => {
                                if (!isEditable) return;
                                if (currentValue === false) {
                                  setAttendance(prev => {
                                    const copy = { ...prev };
                                    if (copy[student.id]) {
                                      copy[student.id] = { ...copy[student.id] };
                                      delete copy[student.id][dateStr];
                                      if (Object.keys(copy[student.id]).length === 0) delete copy[student.id];
                                    }
                                    return copy;
                                  });
                                } else {
                                  handleAttendanceChange(student.id, dateStr, false);
                                }
                              }}
                              className="accent-[#d32f2f] w-6 h-6 rounded-lg border-2 border-[#d32f2f] shadow-sm"
                              disabled={!isEditable}
                            />
                            <span className="ml-2 text-red-600 font-semibold text-sm">No asistió</span>
                          </label>
                        </div>
                      </td>
                    );
                  })}
                  {/* Sábados del mes siguiente si showNextMonthSaturdays está activo */}
                  {showNextMonthSaturdays && nextMonthSaturdays.map(date => {
                    const dateStr = toLocalDateString(date);
                    const isEditable = !selectedStudent || student.id === selectedStudent;
                    const currentValue = attendance[student.id]?.[dateStr];
                    return (
                      <td key={dateStr} className="px-4 py-3 text-center bg-[#e6f9ed]">
                        <div className="flex items-center justify-center gap-3">
                          {/* Checkbox Asistió */}
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentValue === true}
                              onChange={() => {
                                if (!isEditable) return;
                                if (currentValue === true) {
                                  setAttendance(prev => {
                                    const copy = { ...prev };
                                    if (copy[student.id]) {
                                      copy[student.id] = { ...copy[student.id] };
                                      delete copy[student.id][dateStr];
                                      if (Object.keys(copy[student.id]).length === 0) delete copy[student.id];
                                    }
                                    return copy;
                                  });
                                } else {
                                  handleAttendanceChange(student.id, dateStr, true);
                                }
                              }}
                              className="accent-[#009245] w-6 h-6 rounded-lg border-2 border-[#009245] shadow-sm"
                              disabled={!isEditable}
                            />
                            <span className="ml-2 text-green-700 font-semibold text-sm">Asistió</span>
                          </label>
                          {/* Checkbox No asistió */}
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentValue === false}
                              onChange={() => {
                                if (!isEditable) return;
                                if (currentValue === false) {
                                  setAttendance(prev => {
                                    const copy = { ...prev };
                                    if (copy[student.id]) {
                                      copy[student.id] = { ...copy[student.id] };
                                      delete copy[student.id][dateStr];
                                      if (Object.keys(copy[student.id]).length === 0) delete copy[student.id];
                                    }
                                    return copy;
                                  });
                                } else {
                                  handleAttendanceChange(student.id, dateStr, false);
                                }
                              }}
                              className="accent-[#d32f2f] w-6 h-6 rounded-lg border-2 border-[#d32f2f] shadow-sm"
                              disabled={!isEditable}
                            />
                            <span className="ml-2 text-red-600 font-semibold text-sm">No asistió</span>
                          </label>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-10">
          <button
            onClick={async () => { await handleSave(); setShowModal(false); setEditStudentId(null); }}
            className="bg-[#009245] hover:bg-[#23408e] text-white font-semibold px-8 sm:px-12 py-4 rounded-xl shadow-lg text-lg sm:text-xl w-full sm:w-auto transition-all duration-200"
            disabled={loading}
          >
            Guardar Asistencia
          </button>
        </div>
      </Modal>
      {/* Modal de detalle de asistencia */}
      {showDetailModal && detailRecord && (
        <Modal
          isOpen={showDetailModal}
          onRequestClose={() => setShowDetailModal(false)}
          contentLabel="Detalle de Asistencia"
          className="modal-center max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 border-t-4 border-[#009245] animate-fadeIn"
          overlayClassName="overlay-center bg-black bg-opacity-40"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-[#23408e] flex items-center gap-2">
              <svg className="w-7 h-7 text-[#23408e]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Detalle de Asistencia
            </h2>
            <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-700 text-2xl font-bold">&times;</button>
          </div>
          <div className="mb-4">
            <div className="font-semibold text-lg text-[#23408e]">{detailRecord.student.name} {detailRecord.student.lastName}</div>
            <div className="text-[#009245] font-semibold">Módulo: {detailRecord.moduleName || '-'}</div>
            <div className="text-gray-500">Registrado por: {(() => { const user = users.find(u => u.id === detailRecord.updatedBy); return user ? `${user.name || ''} ${user.lastName || ''}`.trim() : detailRecord.updatedBy; })()}</div>
            <div className="text-gray-500">Última actualización: {detailRecord.updatedAt ? new Date(detailRecord.updatedAt).toLocaleString('es-CO') : '-'}</div>
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
                {Object.entries(detailRecord.attendance || {}).map(([date, val]) => (
                  <tr key={date} className="border-b">
                    <td className="px-4 py-2 font-semibold text-[#23408e]">{(() => {
                      // date es string 'YYYY-MM-DD', parsear como local
                      const [y, m, d] = date.split('-');
                      const localDate = new Date(Number(y), Number(m) - 1, Number(d));
                      return localDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
                    })()}</td>
                    <td className="px-4 py-2 text-center">
                      {val === true ? (
                        <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 font-semibold">Asistió</span>
                      ) : (
                        <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 font-semibold">No asistió</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={() => setShowDetailModal(false)}
              className="px-6 py-2 bg-[#009245] text-white rounded-md hover:bg-[#23408e] font-semibold"
            >Cerrar</button>
          </div>
        </Modal>
      )}
      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && deleteRecord && (
        <Modal
          isOpen={showDeleteModal}
          onRequestClose={() => setShowDeleteModal(false)}
          contentLabel="Eliminar asistencia"
          className="modal-center max-w-md w-full bg-white rounded-lg shadow-lg p-8 border-t-4 border-[#d32f2f]"
          overlayClassName="overlay-center bg-black bg-opacity-40"
        >
          <h3 className="text-lg font-bold mb-4 text-[#d32f2f]">¿Eliminar registro de asistencia?</h3>
          <p className="mb-6 text-gray-700">Esta acción no se puede deshacer. ¿Deseas continuar?</p>
          <div className="flex justify-end gap-4">
            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>
            <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AttendanceManager;