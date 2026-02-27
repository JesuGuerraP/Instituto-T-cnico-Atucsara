import { useState, useEffect, useContext, useCallback } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import Modal from 'react-modal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DefaultPeriodContext } from '../../context/DefaultPeriodContext';

const months = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const AttendanceManager = () => {
  const { currentUser } = useContext(AuthContext);
  const { defaultPeriod } = useContext(DefaultPeriodContext);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [academicPeriods, setAcademicPeriods] = useState([defaultPeriod]);
  const [selectedScope, setSelectedScope] = useState('career'); // 'career' | 'course'
  const [coursesList, setCoursesList] = useState([]); // [{id, nombre}]
  const [selectedCourse, setSelectedCourse] = useState('');

  // Sincronizar selectedPeriod con defaultPeriod del contexto
  useEffect(() => {
    if (defaultPeriod && academicPeriods.length > 0) {
      if (academicPeriods.includes(defaultPeriod)) {
        setSelectedPeriod(defaultPeriod);
      }
    }
  }, [defaultPeriod, academicPeriods]);

  // Función para cargar períodos académicos
  const loadAcademicPeriods = async () => {
    try {
      const periodsRef = collection(db, 'academicPeriods');
      const periodsSnap = await getDocs(periodsRef);
      const periods = periodsSnap.docs
        .map(doc => doc.data().period)
        .filter(Boolean);
      
      // Ensure DEFAULT_PERIOD is present for migration purposes, but don't rely on it for default selection.
      const allPeriods = Array.from(new Set([...periods, defaultPeriod]));

      if (allPeriods.length > 0) {
        const sortedPeriods = allPeriods.sort((a, b) => {
            const [yearA, periodA] = a.split('-');
            const [yearB, periodB] = b.split('-');
            if (parseInt(yearB) !== parseInt(yearA)) return parseInt(yearB) - parseInt(yearA);
            return parseInt(periodB) - parseInt(periodA);
        });
        
        setAcademicPeriods(sortedPeriods);
        setSelectedPeriod(sortedPeriods[0]); // Set the most recent as default
      } else {
        setAcademicPeriods([defaultPeriod]);
        setSelectedPeriod(defaultPeriod);
      }
    } catch (error) {
      console.error('Error al cargar períodos:', error);
      toast.error('Error al cargar los períodos académicos');
    }
  };
  // Estructura: attendance[studentId][dateStr] = true/false
  const [attendance, setAttendance] = useState({});
  
  // Utilidad para obtener fecha local en formato YYYY-MM-DD
  function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
  }
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
  const [teacherModules, setTeacherModules] = useState([]); // Nuevo: para módulos del profesor
  const [editStudentId, setEditStudentId] = useState(null); // Nuevo: para saber si se está editando un estudiante
  // Filtro de módulo para la tabla principal
  const [filterModule, setFilterModule] = useState('');
  // Lista global de módulos para el filtro
  const [allModuleNames, setAllModuleNames] = useState([]);
  const [studentToEdit, setStudentToEdit] = useState(null);

  const migrateAttendanceRecords = async () => {
    try {
      const attendanceRef = collection(db, 'attendance');
      const batch = writeBatch(db);
      let updateCount = 0;

      // Para añadir la carrera, necesitamos un mapa de estudiantes.
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentsMap = new Map();
      studentsSnap.forEach(doc => {
        studentsMap.set(doc.id, doc.data());
      });

      const snapshot = await getDocs(attendanceRef);

      snapshot.forEach((document) => {
        const data = document.data();
        const updates = {};

        // Asignar período y semestre por defecto si no existen.
        if (!data.period) {
          updates.period = '2025-1';
        }
        if (!data.semester) {
          updates.semester = '1';
        }

        // Asignar carrera si no existe, basándose en el estudiante.
        if (!data.carrera && data.studentId) {
          const student = studentsMap.get(data.studentId);
          if (student && student.career) {
            updates.carrera = student.career;
          }
        }
        
        // Si hay algo que actualizar, se añade al batch.
        if (Object.keys(updates).length > 0) {
          batch.update(document.ref, updates);
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`Se migraron/actualizaron ${updateCount} registros de asistencia.`);
        toast.success(`Se han actualizado ${updateCount} registros de asistencia con datos faltantes.`);
      }
    } catch (error) {
      console.error('Error al migrar asistencias:', error);
      toast.error('Error al intentar migrar los registros de asistencia.');
    }
  };

  // Cargar períodos académicos al iniciar
  useEffect(() => {
    loadAcademicPeriods();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Primero cargar los períodos académicos
      await loadAcademicPeriods();
      
      // Luego migrar las asistencias existentes
      await migrateAttendanceRecords();
      
      // Obtener todos los usuarios para mostrar nombre en "registrado por"
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersArr = [];
      usersSnap.forEach(doc => usersArr.push({ id: doc.id, ...doc.data() }));
      setUsers(usersArr);
      // Obtener estudiantes y carreras según el rol
      const allStudentsSnap = await getDocs(collection(db, 'students'));
      const allStudentsArr = [];
      allStudentsSnap.forEach(doc => allStudentsArr.push({ id: doc.id, ...doc.data() }));
      const activeStudents = allStudentsArr.filter(student => student.status === 'active');
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
            const teacherFullName = (teacher.name + ' ' + (teacher.lastName || '')).trim();

            // Handle both array of professors and single professor string
            const profesoresAsignados = Array.isArray(modulo.profesor)
              ? modulo.profesor
              : (typeof modulo.profesor === 'string' ? [modulo.profesor] : []);

            const isProfessorMatch = profesoresAsignados.some(p => (p || '').trim() === teacherFullName);
            
            // Fallback for email match for older data
            const teacherEmail = teacher.email?.toLowerCase();
            const moduloProfesorEmail = (modulo.profesorEmail || '').toLowerCase();
            const isEmailMatch = teacherEmail && moduloProfesorEmail === teacherEmail;

            // Verificar si el módulo corresponde al semestre seleccionado
            const moduloSemestre = String(modulo.semestre || modulo.semester);
            const semestreMatch = !selectedSemester || moduloSemestre === selectedSemester;
            
            if (semestreMatch && (isProfessorMatch || isEmailMatch)) {
              teacherCareers.add(carrera.nombre);
              teacherModules.push({
                ...modulo,
                id: moduleDoc.id,
                nombre: modulo.nombre,
                careerId: careerDoc.id,
                careerName: carrera.nombre,
                semester: moduloSemestre
              });
            }
          });
        }
        // Incluir módulos generales asignados al docente (por carrera/semestre)
        try {
          const gmSnap = await getDocs(collection(db, 'generalModules'));
          const teacherId = teacher.id;
          gmSnap.forEach(gDoc => {
            const gm = gDoc.data();
            // Coincidencia por ID de profesor (formato actual) o por nombre (compatibilidad antigua)
            const gmProf = gm.profesor;
            const matchById = gmProf && teacherId && gmProf === teacherId;
            const matchByName = typeof gmProf === 'string' && gmProf.trim() === ((teacher.name + ' ' + (teacher.lastName || '')).trim());
            if (!(matchById || matchByName)) return;
            (gm.carreraSemestres || []).forEach(cs => {
              const sem = String(cs.semester);
              if (!selectedSemester || sem === selectedSemester) {
                teacherCareers.add(cs.career);
                teacherModules.push({
                  id: gDoc.id,
                  nombre: (gm.nombre || '') + ' (General)',
                  careerId: null,
                  careerName: cs.career,
                  semester: sem,
                  isGeneral: true
                });
              }
            });
          });
        } catch (e) {
          console.warn('No se pudieron cargar módulos generales del docente:', e);
        }

        // Solo mostrar la(s) carrera(s) del docente
        const careersArr = Array.from(teacherCareers);
        setCareers(careersArr);
        setSelectedCareer(careersArr[0] || '');
        
        // Cargar cursos donde el teacher imparte (VistaCursos: modules.profesorId o profesorNombre)
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const coursesTmp = [];
        for (const courseDoc of coursesSnap.docs) {
          const courseData = courseDoc.data();
          const modsSnap = await getDocs(collection(db, 'courses', courseDoc.id, 'modules'));
          let teacherHasModule = false;
          modsSnap.forEach(md => {
            const m = md.data();
            if ((m.profesorId && m.profesorId === teacher.id) || ((m.profesorNombre || '').toLowerCase().includes(((teacher.name + ' ' + (teacher.lastName || '')).trim().toLowerCase())))) {
              teacherHasModule = true;
            }
          });
          if (teacherHasModule) {
            coursesTmp.push({ id: courseDoc.id, nombre: courseData.nombre });
          }
        }
        setCoursesList(coursesTmp);
        if (coursesTmp.length && !selectedCourse) setSelectedCourse(coursesTmp[0].id);
        
        // Solo mostrar estudiantes que estén en el semestre seleccionado y tengan módulos asignados del docente
        const filteredStudents = activeStudents.filter(student => {
          const studentSemester = String(student.semester || student.semestre || '1');
          return (
            // Verificar que el estudiante esté en el semestre seleccionado
            (!selectedSemester || studentSemester === selectedSemester) &&
            // Y que tenga módulos asignados del docente en ese semestre
            student.modulosAsignados?.some(m => 
              teacherModules.some(tm => 
                tm.id === m.id && 
                String(tm.semester) === studentSemester
              )
            )
          );
        });
        setStudents(filteredStudents);
        setCareerModules(teacherModules);
        setModulesForCareer(teacherModules);
        setTeacherModules(teacherModules); // Guardar los módulos del profesor
        setLoading(false);
      } else {
        // Admin/secretary: mostrar todo, pero filtrar por semestre
        const filteredStudents = activeStudents.filter(student => {
          const studentSemester = String(student.semester || student.semestre || '1');
          return !selectedSemester || studentSemester === selectedSemester;
        });
        
        const uniqueCareers = Array.from(new Set(filteredStudents.map(s => s.career).filter(Boolean)));
        setCareers(['Todos', ...uniqueCareers]);
        setSelectedCareer('Todos');
        setStudents(filteredStudents);
        // Cargar lista de cursos para admin
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const allCourses = coursesSnap.docs.map(d => ({ id: d.id, nombre: d.data().nombre }));
        setCoursesList(allCourses);
        if (allCourses.length && !selectedCourse) setSelectedCourse(allCourses[0].id);
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  useEffect(() => {
    // Filtrar estudiantes por carrera/curso seleccionada según ámbito
    const fetchStudentsByScope = async () => {
      setLoading(true);
      let allStudents = [];
      const studentsSnap = await getDocs(collection(db, 'students'));
      studentsSnap.forEach(doc => allStudents.push({ id: doc.id, ...doc.data() }));
      const activeStudents = allStudents.filter(student => student.status === 'active');

      let filtered = [];
      if (selectedScope === 'career') {
        let base = activeStudents;
        if (selectedCareer && selectedCareer !== 'Todos') {
          base = base.filter(s => (s.career || '') === selectedCareer);
        }
        filtered = base;
      } else {
        // ámbito curso: filtrar por selectedCourse (id en array student.courses)
        const courseId = selectedCourse;
        filtered = activeStudents.filter(s => Array.isArray(s.courses) && (!courseId || s.courses.includes(courseId)));
      }

      // Filtrar por semestre si aplica (solo carreras usan semestre; mantener para ambos por compatibilidad)
      filtered = filtered.filter(student => {
        const studentSemester = String(student.semester || student.semestre || '1');
        return !selectedSemester || studentSemester === selectedSemester;
      });

      setStudents(filtered);
      setSelectedStudent(filtered[0]?.id || '');
      setLoading(false);
    };
    // Ejecutar si hay datos cargados
    if ((selectedScope === 'career' && careers.length > 0) || (selectedScope === 'course' && coursesList.length >= 0)) {
      fetchStudentsByScope();
    }
  }, [selectedCareer, selectedCourse, currentUser, careers, coursesList, selectedSemester, selectedScope]);

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

  const fetchAttendanceRecords = useCallback(async () => {
    try {
      setLoading(true);

      // Se necesita la lista completa de estudiantes para buscar nombres y carreras en la tabla.
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentsArr = studentsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(student => student.status === 'active');
      setStudents(studentsArr);

      // Construir la consulta a Firestore para asistencias de forma dinámica y robusta.
      const queryConstraints = [];

      // Siempre se filtra por período.
      if (selectedPeriod) {
        queryConstraints.push(where('period', '==', selectedPeriod));
      } else {
        // Si no hay período, no se muestra nada para evitar cargar toda la base de datos.
        setAttendanceRecords([]);
        setLoading(false);
        return;
      }

      if (selectedScope === 'career') {
        // Ámbito carrera: filtrar por carrera y semestre.
        if (selectedCareer && selectedCareer !== 'Todos') {
          queryConstraints.push(where('carrera', '==', selectedCareer));
        }
        if (selectedSemester) {
          queryConstraints.push(where('semester', '==', String(selectedSemester)));
        }
      } else {
        // Ámbito curso: filtrar por ID de curso.
        queryConstraints.push(where('scope', '==', 'course'));
        if (selectedCourse) {
          queryConstraints.push(where('courseId', '==', selectedCourse));
        }
      }

      if (filterModule) {
        queryConstraints.push(where('moduleName', '==', filterModule));
      }

      const attendanceQuery = query(collection(db, 'attendance'), ...queryConstraints);
      const attSnap = await getDocs(attendanceQuery);
      
      const finalAttendanceRecords = attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(data => {
          // Filtro adicional en el cliente para el ámbito de carrera, por si algún dato antiguo no tiene 'carrera'.
          if (selectedScope === 'career' && data.scope === 'course') {
            return false;
          }
          return true;
        });
      
      setAttendanceRecords(finalAttendanceRecords);

      if (finalAttendanceRecords.length === 0 && (selectedSemester || (selectedCareer && selectedCareer !== 'Todos') || filterModule)) {
        toast.info('No se encontraron registros de asistencia para los filtros seleccionados.');
      }

    } catch (error) {
      console.error('Error al cargar datos de asistencia:', error);
      toast.error('Error al cargar los registros de asistencia.');
    } finally {
      setLoading(false);
    }
  }, [selectedCareer, selectedCourse, filterModule, selectedSemester, selectedPeriod, selectedScope]);

  useEffect(() => {
    fetchAttendanceRecords();
  }, [fetchAttendanceRecords]);

  const handleAttendanceChange = (studentId, dateStr, value) => {
    setAttendance(prev => {
      const newStudentAttendance = { ...prev[studentId], [dateStr]: value };
      return {
        ...prev,
        [studentId]: newStudentAttendance,
      };
    });
  };

  const handleSave = async () => {
    const studentsToSave = getFilteredStudentsForAttendance();
    if (studentsToSave.length === 0 || !moduleName) {
      toast.error('No hay estudiantes en la lista o falta el nombre del módulo.');
      return;
    }
    if (!selectedPeriod) {
      toast.error('Debes seleccionar un período académico.');
      return;
    }
    if (!selectedSemester) {
      toast.error('Debes seleccionar un semestre.');
      return;
    }
    try {
      // Guardar solo la asistencia de los estudiantes que tengan algún valor marcado (asistió/no asistió en al menos una fecha)
      const studentsWithAttendance = studentsToSave.filter(student => 
        attendance[student.id] && Object.keys(attendance[student.id]).length > 0
      );

      if (studentsWithAttendance.length === 0) {
        toast.info('No se encontraron cambios en la asistencia para guardar.');
        return;
      }
      
      for (const student of studentsWithAttendance) {
        // Leer asistencia previa (si existe)
        const docRef = doc(db, 'attendance', `${student.id}_${moduleName}_${selectedPeriod}_${selectedSemester}`);
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
          if (!(dateStr in (attendance[student.id] || {}))) {
            hasChanges = true;
            delete mergedAttendance[dateStr];
          }
        }
        // Si no queda ninguna asistencia, eliminar el documento
        if (hasChanges) {
          if (Object.keys(mergedAttendance).length === 0) {
            await deleteDoc(docRef);
          } else {
            const dataToSave = {
              studentId: student.id,
              moduleName,
              attendance: mergedAttendance,
              period: selectedPeriod,
              semester: selectedSemester,
              scope: selectedScope,
              studentName: `${student.name} ${student.lastName || ''}`.trim(),
              updatedBy: currentUser.uid,
              updatedAt: new Date().toISOString(),
            };

            if (selectedScope === 'career') {
              dataToSave.carrera = student.career;
            } else { // scope === 'course'
              dataToSave.courseId = selectedCourse;
              dataToSave.courseName = coursesList.find(c => c.id === selectedCourse)?.nombre || '';
            }
            await setDoc(docRef, dataToSave);
          }
        }
      }
      toast.success('Asistencia guardada correctamente');
      fetchAttendanceRecords(); // Recargar la tabla principal
    } catch (e) {
      console.error("Error saving attendance:", e);
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

  const handleDeleteIndividualAttendance = async (dateToDelete) => {
    if (!detailRecord) return;

    const { id, attendance } = detailRecord;
    const docRef = doc(db, 'attendance', id);

    try {
      const newAttendance = { ...attendance };
      delete newAttendance[dateToDelete];

      if (Object.keys(newAttendance).length === 0) {
        await deleteDoc(docRef);
        toast.success('Registro de asistencia completo eliminado.');
        setAttendanceRecords(prev => prev.filter(r => r.id !== id));
        setShowDetailModal(false);
      } else {
        await setDoc(docRef, { attendance: newAttendance }, { merge: true });
        toast.success(`Asistencia del ${dateToDelete} eliminada.`);
        
        const updatedDetailRecord = { ...detailRecord, attendance: newAttendance };
        setDetailRecord(updatedDetailRecord);

        setAttendanceRecords(prev => prev.map(r => 
          r.id === id ? { ...r, attendance: newAttendance } : r
        ));
      }
    } catch (error) {
      console.error("Error deleting individual attendance:", error);
      toast.error("Error al eliminar la asistencia.");
    }
  };

  useEffect(() => {
    // Cuando cambia la carrera/curso seleccionado o el semestre, cargar los módulos según ámbito
    const fetchModules = async () => {
      setLoading(true);
      try {
        if (selectedScope === 'course') {
          if (!selectedCourse) { setCareerModules([]); return; }
          const modsSnap = await getDocs(collection(db, 'courses', selectedCourse, 'modules'));
          const allModules = modsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          // Añadir módulos que ya tienen asistencia guardada
          const attendanceSnap = await getDocs(collection(db, 'attendance'));
          const attendanceModules = new Set();
          attendanceSnap.forEach(docu => {
            const data = docu.data();
            if (data.scope === 'course' && data.courseId === selectedCourse && data.period === selectedPeriod) {
              attendanceModules.add(data.moduleName);
            }
          });
          const moduleNames = new Set([...allModules.map(m => m.nombre), ...Array.from(attendanceModules)]);
          const finalModules = Array.from(moduleNames).map(nombre => {
            const existing = allModules.find(m => m.nombre === nombre);
            return existing || { id: nombre, nombre };
          }).sort((a, b) => a.nombre.localeCompare(b.nombre));
          setCareerModules(finalModules);
          return;
        }

        if (!selectedCareer || selectedCareer === 'Todos' || !selectedPeriod || !selectedSemester) {
          setCareerModules([]);
          return;
        }

        let allModules = [];

        // Buscar en la colección de módulos directamente
        const modulesRef = collection(db, 'modulos');
        const modulesSnap = await getDocs(query(
          modulesRef,
          where('carrera', '==', selectedCareer)
        ));
        
        allModules = modulesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Si no hay módulos en 'modulos', buscar en la subcollección de careers
        if (allModules.length === 0) {
          const careersSnap = await getDocs(collection(db, 'careers'));
          const careerDoc = careersSnap.docs.find(doc => 
            (doc.data().nombre || '').toLowerCase() === selectedCareer.toLowerCase()
          );
          
          if (careerDoc) {
            const careerModulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
            allModules = careerModulesSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
          }
        }

        // Verificar si hay asistencias registradas para los módulos
        const attendanceSnap = await getDocs(collection(db, 'attendance'));
        const attendanceModules = new Set();
        
        attendanceSnap.forEach(doc => {
          const data = doc.data();
          if (
            data.period === selectedPeriod && 
            String(data.semester) === String(selectedSemester) &&
            (data.carrera === selectedCareer) &&
            (data.scope !== 'course')
          ) {
            attendanceModules.add(data.moduleName);
          }
        });

        // Combinar módulos de ambas fuentes
        const moduleNames = new Set([
          ...allModules.map(m => m.nombre),
          ...Array.from(attendanceModules)
        ]);

        const finalModules = Array.from(moduleNames).map(nombre => {
          const existingModule = allModules.find(m => m.nombre === nombre);
          return existingModule || {
            id: nombre,
            nombre: nombre,
            carrera: selectedCareer,
            period: selectedPeriod,
            semester: selectedSemester
          };
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));

        console.log('Módulos totales encontrados:', finalModules.length);
        setCareerModules(finalModules);

        // Solo mostrar notificación si no hay módulos NI asistencias
        if (finalModules.length === 0 && attendanceModules.size === 0) {
          toast.info(`No hay módulos ni asistencias registradas para ${selectedCareer} en el período ${selectedPeriod}, semestre ${selectedSemester}`);
        }
      } catch (error) {
        console.error('Error al cargar módulos:', error);
        toast.error('Error al cargar los módulos');
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, [selectedCareer, selectedCourse, selectedPeriod, selectedSemester, selectedScope]);

  useEffect(() => {
    // Cargar módulos de la carrera seleccionada SOLO cuando el modal está abierto
    const fetchModules = async () => {
      if (!showModal || !selectedCareer || selectedCareer === 'Todos' || !selectedSemester) {
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
      let allModules = modulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filtrar por semestre
      allModules = allModules.filter(modulo => {
        const moduloSemestre = String(modulo.semestre || modulo.semester || '1');
        return moduloSemestre === selectedSemester;
      });

      // Si el usuario es un profesor, filtrar por los módulos que tiene asignados
      if (currentUser.role === 'teacher') {
        const teachersSnap = await getDocs(query(collection(db, 'teachers'), where('email', '==', currentUser.email)));
        if (!teachersSnap.empty) {
          const teacher = teachersSnap.docs[0].data();
          const teacherFullName = (teacher.name + ' ' + (teacher.lastName || '')).trim();
          
          allModules = allModules.filter(modulo => {
            const profesoresAsignados = Array.isArray(modulo.profesor)
              ? modulo.profesor
              : (typeof modulo.profesor === 'string' ? [modulo.profesor] : []);
            return profesoresAsignados.some(p => (p || '').trim() === teacherFullName);
          });
        }
      }
      
      // Incluir módulos generales para la carrera y semestre seleccionados
      try {
        if (selectedCareer && selectedSemester) {
          const gmSnap = await getDocs(collection(db, 'generalModules'));
          let teacherId = null;
          if (currentUser.role === 'teacher') {
            const tSnap = await getDocs(query(collection(db, 'teachers'), where('email', '==', currentUser.email)));
            if (!tSnap.empty) teacherId = tSnap.docs[0].id;
          }
          gmSnap.forEach(gDoc => {
            const gm = gDoc.data();
            const applies = (gm.carreraSemestres || []).some(cs => cs.career === selectedCareer && String(cs.semester) === String(selectedSemester));
            if (!applies) return;
            if (currentUser.role === 'teacher') {
              if (!(gm.profesor && teacherId && gm.profesor === teacherId)) return;
            }
            allModules.push({
              id: gDoc.id,
              nombre: (gm.nombre || '') + ' (General)',
              semestre: String(selectedSemester),
              carrera: selectedCareer,
              isGeneral: true
            });
          });
        }
      } catch (e) {
        console.warn('No se pudieron cargar módulos generales para el modal:', e);
      }

      setModulesForCareer(allModules);
      
      // Si hay un módulo seleccionado que no está en el semestre actual o no es del profesor, limpiarlo
      if (moduleName && !allModules.some(m => m.nombre === moduleName)) {
        setModuleName('');
      }
    };
    
    fetchModules();
  }, [selectedCareer, showModal, selectedSemester, currentUser]);

  // Limpiar módulo seleccionado cuando cambia la carrera en el modal
  useEffect(() => {
    if (showModal && !editStudentId) setModuleName('');
  }, [selectedCareer, showModal, editStudentId]);

  useEffect(() => {
    if (selectedDate) {
      setMonth(selectedDate.getMonth());
      setYear(selectedDate.getFullYear());
    }
  }, [selectedDate]);

  // Filtrar estudiantes por semestre y módulo seleccionado
  const getFilteredStudentsForAttendance = () => {
    if (editStudentId && studentToEdit) return [studentToEdit];

    let filteredStudents = students.filter(student => 
      student.status === 'active' &&
      (!selectedSemester || String(student.semester || student.semestre || '1') === selectedSemester)
    );

    if (moduleName) {
      const selectedModuleData = modulesForCareer.find(m => m.nombre === moduleName);
      if (selectedModuleData) {
        filteredStudents = filteredStudents.filter(student => {
          return student.modulosAsignados?.some(m => m.id === selectedModuleData.id);
        });
      } else {
        // Si el módulo no se encuentra (p.ej. se está escribiendo), no mostrar estudiantes
        return [];
      }
    } else {
        // Si no hay módulo seleccionado, no mostrar estudiantes para evitar registros sin módulo.
        return [];
    }

    return filteredStudents;
  };

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
    if (rec.semester) {
      setSelectedSemester(String(rec.semester));
    }
    setSelectedStudent(student.id);
    setAttendance(prev => ({ ...prev, [student.id]: rec.attendance || {} }));
    setEditStudentId(student.id);
    setStudentToEdit(student);
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

  // Cargar asistencias existentes para el módulo seleccionado cuando el modal está abierto
  useEffect(() => {
    const loadAttendanceForModule = async () => {
      if (!showModal || !moduleName || !selectedPeriod || !selectedSemester) {
        setAttendance({});
        return;
      }

      const studentsForAttendance = getFilteredStudentsForAttendance();
      if (studentsForAttendance.length === 0) {
        setAttendance({});
        return;
      }

      try {
        const studentIds = studentsForAttendance.map(s => s.id);
        const attSnap = await getDocs(query(
          collection(db, 'attendance'),
          where('moduleName', '==', moduleName),
          where('period', '==', selectedPeriod),
          where('semester', '==', selectedSemester),
          where('studentId', 'in', studentIds)
        ));
        
        const attData = {};
        attSnap.forEach(docu => {
          const data = docu.data();
          if (data.studentId && data.attendance) {
            attData[data.studentId] = data.attendance;
          }
        });
        setAttendance(attData);
      } catch (error) {
        console.error("Error loading attendance for module:", error);
        toast.error("Error al cargar las asistencias previas.");
      }
    };

    loadAttendanceForModule();
  }, [showModal, moduleName, selectedPeriod, selectedSemester, students]); // Depende de students para recalcular si la lista de estudiantes cambia

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Gestión de Asistencia</h1>
            <p className="mt-1 text-md text-gray-500">
              Administra y registra la asistencia de los estudiantes por carrera, curso y módulo.
            </p>
          </div>
          <button
            onClick={() => {
              setShowModal(true);
              setModuleName('');
              setSelectedModule('');
              setSelectedStudent('');
              setEditStudentId(null);
              setStudentToEdit(null);
              setAttendance({});
              setSelectedDate(new Date());
            }}
            className="mt-4 sm:mt-0 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <span>Registrar Asistencia</span>
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Columna 1: Período y Ámbito */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período Académico</label>
              <div className="flex items-center gap-2">
                <select
                  className="w-full bg-gray-50 border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                  value={selectedPeriod}
                  onChange={e => setSelectedPeriod(e.target.value)}
                >
                  {Array.from(new Set([...academicPeriods]))
                    .sort((a, b) => b.localeCompare(a))
                    .filter(Boolean)
                    .map(period => (
                      <option key={period} value={period}>
                        {period.replace('-', ' - ')}
                      </option>
                    ))}
                </select>
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={async () => {
                      const year = new Date().getFullYear();
                      const currentPeriods = Array.from(new Set([...academicPeriods]));
                      const lastPeriod = currentPeriods.sort((a, b) => b.localeCompare(a))[0];
                      let suggestedYear = year;
                      let suggestedPeriod = "1";
                      
                      if (lastPeriod) {
                        const [lastYear, lastNum] = lastPeriod.split('-');
                        if (lastNum === "1") {
                          suggestedYear = lastYear;
                          suggestedPeriod = "2";
                        } else {
                          suggestedYear = parseInt(lastYear) + 1;
                          suggestedPeriod = "1";
                        }
                      }

                      const newPeriod = prompt(
                        'Ingrese el nuevo período académico:\n\nFormato: AAAA-N (ej: 2025-1)',
                        `${suggestedYear}-${suggestedPeriod}`
                      );

                      if (newPeriod && /^\d{4}-[12]$/.test(newPeriod)) {
                        if (currentPeriods.includes(newPeriod)) {
                          toast.warn('Este período ya existe');
                          return;
                        }
                        try {
                          const periodsRef = collection(db, 'academicPeriods');
                          await setDoc(doc(periodsRef, newPeriod), {
                            period: newPeriod,
                            createdAt: new Date().toISOString(),
                            createdBy: currentUser.email,
                            active: true
                          });
                          await loadAcademicPeriods();
                          setSelectedPeriod(newPeriod);
                          toast.success('Período académico creado');
                        } catch (error) {
                          console.error('Error al crear período:', error);
                          toast.error('Error al crear el período');
                        }
                      } else if (newPeriod) {
                        toast.error('Formato inválido. Use AAAA-N');
                      }
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="Agregar nuevo período"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ámbito</label>
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  className={`w-full px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${selectedScope === 'career' ? 'bg-white text-blue-600 shadow-sm' : 'bg-transparent text-gray-600'}`}
                  onClick={() => { setSelectedScope('career'); setSelectedCourse(''); }}
                >Carreras</button>
                <button
                  type="button"
                  className={`w-full px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${selectedScope === 'course' ? 'bg-white text-blue-600 shadow-sm' : 'bg-transparent text-gray-600'}`}
                  onClick={() => { setSelectedScope('course'); setSelectedSemester(''); }}
                >Cursos</button>
              </div>
            </div>
          </div>

          {/* Columna 2: Selección de Carrera/Curso y Semestre */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{selectedScope === 'career' ? 'Carrera' : 'Curso'}</label>
              {selectedScope === 'career' ? (
                <select className="w-full bg-gray-50 border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm" value={selectedCareer} onChange={e => setSelectedCareer(e.target.value)}>
                  {careers.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <select className="w-full bg-gray-50 border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm" value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
                  {coursesList.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              )}
            </div>
            {selectedScope === 'career' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Semestre</label>
                <div className="flex flex-wrap gap-2">
                  {["1", "2", "3"].map(num => (
                    <button
                      key={num}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${selectedSemester === num ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                      onClick={() => setSelectedSemester(num)}
                    >
                      Sem. {num}
                    </button>
                  ))}
                  <button
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${!selectedSemester ? "bg-gray-200 text-gray-800" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                    onClick={() => setSelectedSemester("")}
                  >
                    Todos
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Columna 3: Filtro por Módulo */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Módulo</label>
              <select className="w-full bg-gray-50 border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm" value={filterModule} onChange={e => setFilterModule(e.target.value)}>
                <option value="">Todos los módulos</option>
                {currentUser.role === 'teacher'
                  ? teacherModules
                      .filter(m =>
                        (!selectedCareer || m.careerName === selectedCareer) &&
                        (!selectedSemester || String(m.semester) === selectedSemester)
                      )
                      .map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)
                  : (selectedCareer && selectedCareer !== 'Todos' && careerModules.length > 0
                      ? careerModules
                          .filter(m => !selectedSemester || String(m.semestre || m.semester) === selectedSemester)
                          .map(m => <option key={m.nombre} value={m.nombre}>{m.nombre}</option>)
                      : allModuleNames.map(m => <option key={m} value={m}>{m}</option>)
                    )
                }
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de información de asistencia */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando registros...</div>
        ) : attendanceRecords.length === 0 ? (
          <div className="text-center py-12 px-6 bg-gray-50">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-800">No se encontraron registros</h3>
            <p className="text-gray-500 mt-1">
              Intenta ajustar los filtros o registra una nueva asistencia.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">{selectedScope === 'course' ? 'Curso' : 'Carrera'}</th>
                  <th className="px-6 py-3 text-left font-semibold">Módulo</th>
                  <th className="px-6 py-3 text-left font-semibold">Estudiante</th>
                  <th className="px-6 py-3 text-center font-semibold">Resumen Asistencia</th>
                  <th className="px-6 py-3 text-left font-semibold">Actualizado por</th>
                  <th className="px-6 py-3 text-left font-semibold">Fecha Actualización</th>
                  <th className="px-6 py-3 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(() => {
                  const filteredRecords = filterModule ? attendanceRecords.filter(r => r.moduleName === filterModule) : attendanceRecords;
                  const grouped = {};
                  filteredRecords.forEach(rec => {
                    const student = students.find(s => s.id === rec.studentId);
                    if (!student) return;
                    const key = selectedScope === 'course' ? (rec.courseName || 'Curso') : (student.career || 'Sin carrera');
                    if (!grouped[key]) grouped[key] = {};
                    if (!grouped[key][rec.moduleName]) grouped[key][rec.moduleName] = [];
                    grouped[key][rec.moduleName].push({ ...rec, student });
                  });
                  return Object.entries(grouped).flatMap(([groupKey, modules]) =>
                    Object.entries(modules).flatMap(([modName, records]) =>
                      records.map((rec, idx) => {
                        let totalSab = 0;
                        let asistidos = 0;
                        Object.values(rec.attendance || {}).forEach(val => {
                          totalSab++;
                          if (val === true) asistidos++;
                        });
                        const user = users.find(u => u.id === rec.updatedBy);
                        const updatedBy = user ? `${user.name || ''} ${user.lastName || ''}`.trim() : rec.updatedBy;
                        return (
                          <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">{groupKey}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{modName}</td>
                            <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">{rec.student.name} {rec.student.lastName}</td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">{asistidos} Asist.</span>
                                <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">{totalSab - asistidos} Faltas</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{updatedBy}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{rec.updatedAt ? new Date(rec.updatedAt).toLocaleString('es-CO') : '-'}</td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                                  onClick={() => { setDetailRecord({ ...rec, student: rec.student }); setShowDetailModal(true); }}
                                  title="Ver Detalles"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </button>
                                <button
                                  className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-full"
                                  onClick={() => handleUpdateClick(rec, rec.student)}
                                  title="Actualizar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                </button>
                                <button
                                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                                  onClick={() => { setDeleteRecord(rec); setShowDeleteModal(true); }}
                                  title="Eliminar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para registrar asistencia */}
      <Modal
        isOpen={showModal}
        onRequestClose={() => {
          setShowModal(false);
          setSelectedStudent('');
          setModuleName('');
          setEditStudentId(null);
          setStudentToEdit(null);
        }}
        contentLabel="Registrar Asistencia"
        className="modal-center w-11/12 max-w-screen-xl bg-white rounded-2xl shadow-2xl p-8 border-t-8 border-blue-600 overflow-y-auto max-h-[95vh]"
        overlayClassName="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      >
        <header className="flex justify-between items-center mb-6 pb-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Registrar Asistencia</h2>
          <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{selectedScope === 'course' ? 'Curso' : 'Carrera'}</label>
            {selectedScope === 'course' ? (
              <select className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm" value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
                {coursesList.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            ) : (
              <select className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm" value={selectedCareer} onChange={e => setSelectedCareer(e.target.value)}>
                {careers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <DatePicker
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              dateFormat="dd/MM/yyyy"
              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Módulo</label>
            {modulesForCareer.length > 0 ? (
              <select
                name="moduleName"
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={moduleName}
                onChange={e => setModuleName(e.target.value)}
              >
                <option value="">Selecciona un módulo...</option>
                {modulesForCareer.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
              </select>
            ) : (
              <input type="text" className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm" placeholder="Nombre del módulo..." value={moduleName} onChange={e => setModuleName(e.target.value)} />
            )}
          </div>
        </div>

        <div className="overflow-y-auto max-h-96 border rounded-lg">
          <table className="min-w-full w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estudiante</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Asistencia</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getFilteredStudentsForAttendance().map(student => {
                const dateStr = toLocalDateString(selectedDate);
                const isEditable = !selectedStudent || student.id === selectedStudent;
                const currentValue = attendance[student.id]?.[dateStr];
                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{student.name} {student.lastName}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-4">
                        <label className="inline-flex items-center cursor-pointer">
                          <input type="radio" name={`attendance-${student.id}`} checked={currentValue === true} onChange={() => handleAttendanceChange(student.id, dateStr, true)} className="form-radio h-5 w-5 text-green-600" disabled={!isEditable} />
                          <span className="ml-2 text-sm text-gray-700">Asistió</span>
                        </label>
                        <label className="inline-flex items-center cursor-pointer">
                          <input type="radio" name={`attendance-${student.id}`} checked={currentValue === false} onChange={() => handleAttendanceChange(student.id, dateStr, false)} className="form-radio h-5 w-5 text-red-600" disabled={!isEditable} />
                          <span className="ml-2 text-sm text-gray-700">No asistió</span>
                        </label>
                        <button onClick={() => setAttendance(prev => { const newAtt = { ...prev[student.id] }; delete newAtt[dateStr]; return { ...prev, [student.id]: newAtt }; })} className="text-gray-400 hover:text-gray-600" title="Limpiar selección">&#x2715;</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="flex justify-end mt-8 pt-6 border-t">
          <button
            onClick={async () => { await handleSave(); setShowModal(false); setEditStudentId(null); setStudentToEdit(null); }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm transition-all duration-200 disabled:bg-gray-400"
            disabled={loading}
          >
            Guardar Asistencia
          </button>
        </footer>
      </Modal>

      {/* Modal de detalle de asistencia */}
      {showDetailModal && detailRecord && (
        <Modal
          isOpen={showDetailModal}
          onRequestClose={() => setShowDetailModal(false)}
          contentLabel="Detalle de Asistencia"
          className="modal-center max-w-lg w-full bg-white rounded-xl shadow-xl p-8 border-t-4 border-blue-500"
          overlayClassName="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
        >
          <header className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Detalle de Asistencia</h2>
              <p className="text-gray-500 text-sm mt-1">Módulo: {detailRecord.moduleName || '-'}</p>
            </div>
            <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
          </header>
          <div className="mb-6 text-sm">
            <p><span className="font-semibold">Estudiante:</span> {detailRecord.student.name} {detailRecord.student.lastName}</p>
            <p><span className="font-semibold">Registrado por:</span> {(() => { const user = users.find(u => u.id === detailRecord.updatedBy); return user ? `${user.name || ''} ${user.lastName || ''}`.trim() : detailRecord.updatedBy; })()}</p>
            <p><span className="font-semibold">Última actualización:</span> {detailRecord.updatedAt ? new Date(detailRecord.updatedAt).toLocaleString('es-CO') : '-'}</p>
          </div>
          <div className="overflow-y-auto max-h-80 border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(detailRecord.attendance || {}).sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB)).map(([date, val]) => (
                  <tr key={date}>
                    <td className="px-4 py-2 font-medium text-gray-800">{new Date(date + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    <td className="px-4 py-2 text-center">
                      {val === true ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Asistió</span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">No asistió</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleDeleteIndividualAttendance(date)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full"
                        title={`Eliminar asistencia del ${date}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="flex justify-end mt-6">
            <button onClick={() => setShowDetailModal(false)} className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm">Cerrar</button>
          </footer>
        </Modal>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && deleteRecord && (
        <Modal
          isOpen={showDeleteModal}
          onRequestClose={() => setShowDeleteModal(false)}
          contentLabel="Eliminar asistencia"
          className="modal-center max-w-md w-full bg-white rounded-xl shadow-xl p-8 border-t-4 border-red-500"
          overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <h3 className="text-xl font-bold text-gray-800">Confirmar Eliminación</h3>
          <p className="my-4 text-gray-600">¿Estás seguro de que deseas eliminar este registro de asistencia? Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-4 mt-6">
            <button onClick={() => setShowDeleteModal(false)} className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold">Cancelar</button>
            <button onClick={handleDelete} className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold">Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AttendanceManager;
