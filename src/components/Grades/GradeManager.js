import { useState, useEffect, useMemo, useContext } from 'react';
import { collection, getDocs, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import GradeForm from './GradeForm';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { DefaultPeriodContext } from '../../context/DefaultPeriodContext';

// Opciones de grupo hardcodeadas para consistencia
const GROUP_OPTIONS = [
  'ACTIVIDADES_1',
  'ACTIVIDADES_2',
  'EVALUACION_FINAL'
];

const GradeManager = () => {
  const { defaultPeriod } = useContext(DefaultPeriodContext);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Estados generales
  const [grades, setGrades] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [academicPeriods, setAcademicPeriods] = useState([defaultPeriod]);
  const [teacherModules, setTeacherModules] = useState([]);
  
  // Estados de UI y filtros
  const [selectedScope, setSelectedScope] = useState('career');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editGrade, setEditGrade] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [gradeToDelete, setGradeToDelete] = useState(null);

  // Estados para filtro de CARRERAS
  const [selectedSemester, setSelectedSemester] = useState('');
  const [careerFilters, setCareerFilters] = useState({ module: '', student: '', group: '' });

  // Estados para filtro de CURSOS
  const [courseFilters, setCourseFilters] = useState({ student: '', group: '' });
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedCourseModule, setSelectedCourseModule] = useState('');

  // Función para cargar períodos académicos
  const loadAcademicPeriods = async () => {
    try {
      const periodsRef = collection(db, 'academicPeriods');
      const periodsSnap = await getDocs(periodsRef);
      const periods = periodsSnap.docs.map(doc => doc.data().period).filter(Boolean);
      const allPeriods = Array.from(new Set([defaultPeriod, ...periods]));

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
    }
  };

  // Sincronizar selectedPeriod con defaultPeriod del contexto
  useEffect(() => {
    if (defaultPeriod && academicPeriods.length > 0) {
      if (academicPeriods.includes(defaultPeriod)) {
        setSelectedPeriod(defaultPeriod);
      }
    }
  }, [defaultPeriod, academicPeriods]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      await loadAcademicPeriods();
      
      const studentsSnap = await getDocs(collection(db, 'students'));
      const allStudents = studentsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(student => student.status === 'active');
      
      const teachersSnap = await getDocs(collection(db, 'teachers'));
      const allTeachers = teachersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const gradesSnap = await getDocs(collection(db, 'grades'));
      const allGrades = gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Obtener todos los módulos de carreras y cursos
      const careersSnap = await getDocs(collection(db, 'careers'));
      let allModules = [];
      for (const careerDoc of careersSnap.docs) {
        const carrera = careerDoc.data();
        const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
        modulesSnap.forEach(moduleDoc => {
          allModules.push({
            id: moduleDoc.id, ...moduleDoc.data(),
            carrera: carrera.nombre, careerId: careerDoc.id, source: 'career'
          });
        });
      }
      const coursesSnap = await getDocs(collection(db, 'courses'));
      for (const courseDoc of coursesSnap.docs) {
        const courseData = courseDoc.data();
        const modsSnap = await getDocs(collection(db, 'courses', courseDoc.id, 'modules'));
        modsSnap.forEach(moduleDoc => {
          allModules.push({
            id: moduleDoc.id, ...moduleDoc.data(),
            courseId: courseDoc.id, courseName: courseData.nombre, source: 'course'
          });
        });
      }
      // Incluir módulos generales (como ámbito carrera) agrupados por semestre
      try {
        const generalSnap = await getDocs(collection(db, 'generalModules'));
        generalSnap.forEach(gDoc => {
          const gm = gDoc.data();
          const semesters = Array.from(new Set((gm.carreraSemestres || []).map(cs => String(cs.semester))))
            || (Array.isArray(gm.semestres) ? gm.semestres.map(s => String(s)) : []);
          const careerList = Array.from(new Set((gm.carreraSemestres || []).map(cs => cs.career)));
          semesters.forEach(sem => {
            allModules.push({
              id: gDoc.id,
              nombre: (gm.nombre || '') + ' (General)',
              profesor: gm.profesor,
              descripcion: gm.descripcion || '',
              semestre: sem,
              source: 'career',
              isGeneral: true,
              careerList
            });
          });
        });
      } catch (e) {
        console.warn('No se pudieron cargar módulos generales:', e);
      }

      if (currentUser.role === 'teacher') {
        const teacher = allTeachers.find(t => t.email?.toLowerCase() === currentUser.email.toLowerCase());
        if (!teacher) {
          setStudents([]); setTeachers([]); setGrades([]); setTeacherModules([]);
          return;
        }
        
        const teacherFullName = (teacher.name + ' ' + (teacher.lastName || '')).trim();
        
        const assignedModules = allModules.filter(m => {
            if (m.source === 'career') {
                const moduleProfesor = m.profesor;
                let isMatch = false;
                if (Array.isArray(moduleProfesor)) {
                    isMatch = moduleProfesor.map(p => (p || '').trim()).includes(teacherFullName);
                } else if (typeof moduleProfesor === 'string') {
                    // Permitir coincidencia por nombre completo o por ID (módulos generales guardan ID)
                    isMatch = (moduleProfesor || '').trim() === teacherFullName || moduleProfesor === teacher.id;
                }
                
                if (!isMatch && m.profesorEmail && teacher.email) {
                    isMatch = m.profesorEmail.toLowerCase() === teacher.email.toLowerCase();
                }
                return isMatch;
            }
            if (m.source === 'course') {
                const teacherFullNameLower = teacherFullName.toLowerCase();
                const moduleProfesorCourse = (m.profesorNombre || '').toLowerCase().trim();
                return m.profesorId === teacher.id || moduleProfesorCourse.includes(teacherFullNameLower);
            }
            return false;
        });

        const assignedModuleIds = new Set(assignedModules.map(m => m.id));
        const assignedCourseIds = new Set(assignedModules.filter(m => m.source === 'course').map(m => m.courseId));

        const filteredStudents = allStudents.filter(s => 
            s.modulosAsignados?.some(m => assignedModuleIds.has(m.id)) ||
            s.courses?.some(cId => assignedCourseIds.has(cId))
        );
        
        const filteredGrades = allGrades.filter(g => 
            assignedModuleIds.has(g.moduleId) && filteredStudents.some(s => s.id === g.studentId)
        );

        setTeacherModules(assignedModules);
        setStudents(filteredStudents);
        setGrades(filteredGrades);
        setTeachers([teacher]);

        const hasCareerMod = assignedModules.some(m => m.source === 'career');
        const hasCourseMod = assignedModules.some(m => m.source === 'course');
        if (!hasCareerMod && hasCourseMod) setSelectedScope('course');
        else setSelectedScope('career');

      } else { // Admin/Secretary
        setStudents(allStudents);
        setTeachers(allTeachers);
        setGrades(allGrades);
        setTeacherModules(allModules);
      }
    };
    fetchData();
  }, [currentUser]);

  const hasCareerModules = useMemo(() => teacherModules.some(m => m.source === 'career'), [teacherModules]);
  const hasCourseModules = useMemo(() => teacherModules.some(m => m.source === 'course'), [teacherModules]);

  // Reset dependientes al cambiar ámbito o semestre para evitar estados inconsistentes
  useEffect(() => {
    // Cuando cambia el scope, limpiar filtros específicos
    if (selectedScope === 'career') {
      setCourseFilters({ student: '', group: '' });
      setSelectedCourse('');
      setSelectedCourseModule('');
    } else if (selectedScope === 'course') {
      setCareerFilters({ module: '', student: '', group: '' });
      setSelectedSemester('');
    }
    setSearch('');
  }, [selectedScope]);

  useEffect(() => {
    // Al cambiar semestre, limpiar filtros de carrera dependientes
    setCareerFilters({ module: '', student: '', group: '' });
    setSearch('');
  }, [selectedSemester]);

  useEffect(() => {
    // Al cambiar período, limpiar filtros y búsquedas para evitar estados inconsistentes
    setCareerFilters({ module: '', student: '', group: '' });
    setCourseFilters({ student: '', group: '' });
    setSelectedCourse('');
    setSelectedCourseModule('');
    setSearch('');
  }, [selectedPeriod]);

  // Opciones para los selectores de CURSOS
  const courseOptions = useMemo(() => {
      const courses = teacherModules
          .filter(m => m.source === 'course')
          .map(m => ({ id: m.courseId, name: m.courseName }));
      return [...new Map(courses.map(item => [item['id'], item])).values()];
  }, [teacherModules]);

  const courseModuleOptions = useMemo(() => {
      if (!selectedCourse) return [];
      return teacherModules.filter(m => m.source === 'course' && m.courseId === selectedCourse);
  }, [teacherModules, selectedCourse]);

  // Calificaciones filtradas
  const filteredGrades = useMemo(() => {
    return grades.filter(g => {
      const gradePeriod = g.period || defaultPeriod;
      if (selectedPeriod && gradePeriod !== selectedPeriod) return false;

      const moduleInfo = teacherModules.find(m => m.id === g.moduleId);

      if (selectedScope === 'career') {
        if (moduleInfo?.source !== 'career') return false;
        if (selectedSemester && String(g.semester) !== String(selectedSemester)) return false;
        if (careerFilters.module && g.moduleName !== careerFilters.module) return false;
        if (careerFilters.student && g.studentId !== careerFilters.student) return false;
        // Usar groupId para el filtro para ser consistente con el formulario
        if (careerFilters.group && g.groupId !== careerFilters.group) return false;
      }
      
      if (selectedScope === 'course') {
        if (moduleInfo?.source !== 'course') return false;
        if (selectedCourse && moduleInfo.courseId !== selectedCourse) return false;
        if (selectedCourseModule && g.moduleId !== selectedCourseModule) return false;
        if (courseFilters.student && g.studentId !== courseFilters.student) return false;
        // Usar groupId para el filtro para ser consistente con el formulario
        if (courseFilters.group && g.groupId !== courseFilters.group) return false;
      }

      if (search) {
        const s = search.toLowerCase();
        return (g.studentName?.toLowerCase().includes(s) ||
                g.moduleName?.toLowerCase().includes(s) ||
                g.activityName?.toLowerCase().includes(s));
      }
      return true;
    });
  }, [grades, selectedPeriod, selectedScope, selectedSemester, careerFilters, courseFilters, selectedCourse, selectedCourseModule, search, teacherModules]);

  const studentOptions = useMemo(() => {
    let filtered = [];
    if (selectedScope === 'career') {
        // Filtra estudiantes por semestre si está seleccionado
        filtered = students.filter(s => !selectedSemester || String(s.semester) === String(selectedSemester));
        // Si hay un módulo seleccionado, filtrar además por pertenencia al módulo
        if (careerFilters.module) {
          const moduloSel = teacherModules.find(m => m.source === 'career' && m.nombre === careerFilters.module && (!selectedSemester || String(m.semestre || m.semester) === String(selectedSemester)));
          if (moduloSel) {
            filtered = filtered.filter(s => Array.isArray(s.modulosAsignados) && s.modulosAsignados.some(ms => ms.id === moduloSel.id));
          } else {
            // Si el módulo seleccionado no existe para el semestre, no mostrar estudiantes
            filtered = [];
          }
        }
    } else if (selectedScope === 'course') {
        // Filtra estudiantes que pertenecen al curso seleccionado
        if (selectedCourse) {
            filtered = students.filter(s => Array.isArray(s.courses) && s.courses.includes(selectedCourse));
        } else {
            // Opcional: mostrar todos los estudiantes de cursos si no hay un curso seleccionado
            filtered = students.filter(s => Array.isArray(s.courses) && s.courses.length > 0);
        }
    } else {
        filtered = students;
    }
    return filtered.sort((a, b) => `${a.name} ${a.lastName}`.localeCompare(`${b.name} ${b.lastName}`));
  }, [students, selectedScope, selectedSemester, selectedCourse, careerFilters.module, teacherModules]);


  const handleDelete = (id) => {
    setGradeToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'grades', gradeToDelete));
      setGrades(grades.filter(g => g.id !== gradeToDelete));
      toast.success('Nota eliminada correctamente');
    } catch (error) {
      toast.error('Error al eliminar la nota.');
    } finally {
      setShowDeleteModal(false);
      setGradeToDelete(null);
    }
  };

  const handleEdit = (grade) => {
    setEditGrade(grade);
    setShowForm(true);
  };

  const handleReport = () => {
    navigate('/grades/report', { state: { grades: filteredGrades } });
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      {/* Encabezado y Período */}
      <div className="mb-4 border-b pb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
          <h1 className="text-2xl font-bold text-[#23408e]">Gestión Académica</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Período:</span>
            <select
              className="bg-gray-50 border-none rounded-lg p-2 text-[#23408e] font-semibold focus:ring-0 text-sm"
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
            >
              {academicPeriods.map(p => <option key={p} value={p}>{p.replace('-', ' - ')}</option>)}
            </select>
          </div>
        </div>
        
        {/* Selector de Ámbito */}
        <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600">Ámbito:</span>
            <div className="flex flex-wrap gap-2">
                {hasCareerModules && (
                    <button type="button"
                        className={`px-3 py-1.5 rounded-md text-sm ${selectedScope === 'career' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => setSelectedScope('career')}>
                        Carreras
                    </button>
                )}
                {hasCourseModules && (
                    <button type="button"
                        className={`px-3 py-1.5 rounded-md text-sm ${selectedScope === 'course' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => setSelectedScope('course')}>
                        Cursos
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* Filtros Condicionales */}
      <div className="bg-white rounded-lg mb-6">
        {selectedScope === 'career' && (
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                        {["1", "2", "3"].map(num => (
                            <button key={num}
                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${selectedSemester === num ? "bg-[#23408e] text-white" : "text-gray-600 hover:bg-gray-50"}`}
                                onClick={() => setSelectedSemester(num)}>
                                Semestre {num}
                            </button>
                        ))}
                        <button
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${!selectedSemester ? "bg-gray-100 text-gray-700" : "text-gray-600 hover:bg-gray-50"}`}
                            onClick={() => setSelectedSemester("")}>
                            Todos
                        </button>
                    </div>
                    <span className="text-sm text-gray-500 text-right">
                        {selectedSemester ? `Semestre ${selectedSemester} - ${selectedPeriod}` : `Período ${selectedPeriod}`}
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Módulo</label>
                        <select
                            className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#23408e]"
                            value={careerFilters.module}
                            onChange={e => setCareerFilters(f => ({ ...f, module: e.target.value }))}>
                            <option value="">Todos los Módulos</option>
                            {teacherModules
                                .filter(m => m.source === 'career' && (!selectedSemester || String(m.semestre || m.semester) === String(selectedSemester)))
                                .map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-700">Estudiante</label>
                        <select
                            className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#23408e]"
                            value={careerFilters.student}
                            onChange={e => setCareerFilters(f => ({ ...f, student: e.target.value }))}>
                            <option value="">Todos los Estudiantes</option>
                            {studentOptions.map(s => <option key={s.id} value={s.id}>{s.name} {s.lastName}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-700">Grupo</label>
                        <select
                            className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#23408e]"
                            value={careerFilters.group}
                            onChange={e => setCareerFilters(f => ({ ...f, group: e.target.value }))}>
                            <option value="">Todos los Grupos</option>
                            {GROUP_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        )}

        {selectedScope === 'course' && (
            <div className="flex flex-col gap-4 p-4 bg-green-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                      <label className="text-sm font-medium text-gray-700">Curso</label>
                      <select
                          className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#23408e]"
                          value={selectedCourse}
                          onChange={e => { setSelectedCourse(e.target.value); setSelectedCourseModule(''); }}>
                          <option value="">Todos los Cursos</option>
                          {courseOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="text-sm font-medium text-gray-700">Módulo</label>
                      <select
                          className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#23408e]"
                          value={selectedCourseModule}
                          onChange={e => setSelectedCourseModule(e.target.value)}
                          disabled={!selectedCourse}>
                          <option value="">Todos los Módulos</option>
                          {courseModuleOptions.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="text-sm font-medium text-gray-700">Estudiante</label>
                      <select
                          className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#23408e]"
                          value={courseFilters.student}
                          onChange={e => setCourseFilters(f => ({ ...f, student: e.target.value }))}>
                          <option value="">Todos los Estudiantes</option>
                          {studentOptions.map(s => <option key={s.id} value={s.id}>{s.name} {s.lastName}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="text-sm font-medium text-gray-700">Grupo</label>
                      <select
                          className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-[#23408e]"
                          value={courseFilters.group}
                          onChange={e => setCourseFilters(f => ({ ...f, group: e.target.value }))}>
                          <option value="">Todos los Grupos</option>
                          {GROUP_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                  </div>
              </div>
            </div>
        )}
        
        {/* Acciones y Búsqueda */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mt-6">
            <div className="flex-1 relative">
                <input
                    type="text"
                    placeholder="Buscar por estudiante, módulo o actividad..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-lg text-sm text-gray-700 focus:ring-1 focus:ring-[#23408e]"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <button
                    className="w-full lg:w-auto px-4 py-2 bg-[#009245] text-white rounded-lg hover:bg-[#007a36] font-medium text-sm flex items-center justify-center gap-2"
                    onClick={() => { setEditGrade(null); setShowForm(true); }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    Nueva Nota
                </button>
                <button
                    className="w-full lg:w-auto px-4 py-2 bg-[#ffd600] text-[#23408e] rounded-lg hover:bg-[#23408e] hover:text-white font-medium text-sm flex items-center justify-center gap-2"
                    onClick={handleReport}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    Generar Informe
                </button>
            </div>
        </div>
      </div>

      {/* Tarjetas de notas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredGrades.length === 0 ? (
          <div className="col-span-full text-gray-400 text-center py-8 bg-white rounded-lg">
            No hay calificaciones que coincidan con los filtros actuales.
          </div>
        ) : filteredGrades.map((g) => {
          const teacher = teachers.find(t => t.id === g.teacherId);
          const gradeNum = parseFloat(g.grade);
          let gradeColor = 'bg-red-50 text-red-700';
          if (gradeNum >= 3.0 && gradeNum < 4.0) gradeColor = 'bg-orange-50 text-orange-700';
          if (gradeNum >= 4.0) gradeColor = 'bg-green-50 text-green-700';
          
          return (
            <div key={g.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-all">
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-2xl font-bold px-3 py-1 rounded-md ${gradeColor}`}>{g.grade}</span>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">{g.period || defaultPeriod}</span>
                    <span className="block text-xs text-gray-400">{g.date}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 truncate">{g.studentName}</h3>
                  <div>
                    <div className="text-sm text-gray-600">{g.moduleName}</div>
                    <div className="text-xs text-gray-500 mt-1">{teacher && `Prof. ${teacher.name} ${teacher.lastName}`}</div>
                  </div>
                  <div className="pt-2">
                    <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md">{g.activityName}</span>
                    {g.groupName && <span className="ml-2 inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-md">{g.groupName}</span>}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end gap-2">
                  <button onClick={() => handleEdit(g)} className="text-xs px-3 py-1.5 rounded-md text-blue-600 hover:bg-blue-50">Editar</button>
                  <button onClick={() => handleDelete(g.id)} className="text-xs px-3 py-1.5 rounded-md text-red-600 hover:bg-red-50">Eliminar</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Formulario modal */}
      {showForm && (
        <GradeForm
          students={students}
          teachers={teachers}
          modules={teacherModules}
          currentUser={currentUser}
          scope={selectedScope}
          selectedSemester={selectedSemester}
          selectedPeriod={selectedPeriod}
          onClose={() => { setShowForm(false); setEditGrade(null); }}
          onSave={async (gradeData, isEditing) => {
            try {
              if (isEditing) {
                await updateDoc(doc(db, 'grades', gradeData.id), gradeData);
                setGrades(grades.map(g => g.id === gradeData.id ? gradeData : g));
                toast.success('Nota actualizada correctamente');
              } else {
                const newGradeRef = doc(collection(db, 'grades'), gradeData.id);
                await setDoc(newGradeRef, gradeData);
                setGrades(prevGrades => [gradeData, ...prevGrades]);
                toast.success('Nota creada correctamente');
              }
            } catch (error) {
              console.error('Error al guardar la nota:', error);
              toast.error('Error al guardar la nota: ' + error.message);
            } finally {
              setShowForm(false);
              setEditGrade(null);
            }
          }}
          editGrade={editGrade}
        />
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full relative border-t-4 border-[#23408e]">
            <h3 className="text-lg font-bold mb-4 text-[#23408e]">¿Eliminar nota?</h3>
            <p className="mb-6 text-gray-700">Esta acción no se puede deshacer. ¿Deseas continuar?</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeManager;
