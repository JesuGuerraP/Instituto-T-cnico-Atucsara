import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import GradeForm from './GradeForm';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const GradeManager = () => {
  const { currentUser } = useAuth();
  const [grades, setGrades] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [filters, setFilters] = useState({ module: '', student: '', group: '' });
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editGrade, setEditGrade] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [gradeToDelete, setGradeToDelete] = useState(null);

  const navigate = useNavigate();

  // Estado para módulos del teacher (debe estar fuera del useEffect)
  const [teacherModules, setTeacherModules] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
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
          setStudents([]);
          setTeachers([]);
          setGrades([]);
          return;
        }
        // Buscar módulos asignados al docente
        const careersSnap = await getDocs(collection(db, 'careers'));
        let modulosAsignados = [];
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
              modulosAsignados.push({
                id: moduleDoc.id,
                nombre: modulo.nombre,
                ...modulo,
                carrera: carrera.nombre,
                careerId: careerDoc.id
              });
            }
          });
        }
        const modulosIds = modulosAsignados.map(m => m.id);
        // Filtrar estudiantes que tengan al menos uno de esos módulos
        const studentsSnap = await getDocs(collection(db, 'students'));
        const allStudents = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filteredStudents = allStudents.filter(student =>
          student.modulosAsignados?.some(m => modulosIds.includes(m.id))
        );
        setStudents(filteredStudents);
        // Filtrar notas solo de esos módulos y estudiantes
        const gradesSnap = await getDocs(collection(db, 'grades'));
        const allGrades = gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filteredGrades = allGrades.filter(g =>
          modulosIds.includes(g.moduleId) &&
          filteredStudents.some(s => s.id === g.studentId)
        );
        setGrades(filteredGrades);
        setTeachers([teacher]); // Solo el teacher logueado
        // Guardar también los módulos asignados para el formulario
        setTeacherModules(modulosAsignados);
      } else {
        // Admin/secretary: vista completa
        const studentsSnap = await getDocs(collection(db, 'students'));
        const allStudents = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStudents(allStudents);
        const teachersSnap = await getDocs(collection(db, 'teachers'));
        setTeachers(teachersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        const gradesSnap = await getDocs(collection(db, 'grades'));
        const allGrades = gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGrades(allGrades);
        // Obtener todos los módulos de todas las carreras
        const careersSnap = await getDocs(collection(db, 'careers'));
        let allModules = [];
        for (const careerDoc of careersSnap.docs) {
          const carrera = careerDoc.data();
          const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
          modulesSnap.forEach(moduleDoc => {
            const modulo = moduleDoc.data();
            allModules.push({
              id: moduleDoc.id,
              nombre: modulo.nombre,
              carrera: carrera.nombre,
              profesor: modulo.profesor || '',
              profesorEmail: modulo.profesorEmail || '',
            });
          });
        }
        setTeacherModules(allModules);
      }
    };
    fetchData();
  }, [currentUser]);

  // Opciones de módulos para filtros y formulario
  const moduleOptions = currentUser.role === 'teacher'
    ? (teacherModules || []).map(m => m.nombre).filter(Boolean)
    : Array.from(new Set(grades.map(g => g.moduleName))).filter(Boolean);

  // Opciones de grupos para filtros
  const groupOptions = currentUser.role === 'teacher'
    ? Array.from(new Set(grades.map(g => g.groupName))).filter(Boolean)
    : Array.from(new Set(grades.map(g => g.groupName))).filter(Boolean);

  const filteredGrades = grades.filter(g =>
    (filters.module ? g.moduleName === filters.module : true) &&
    (filters.student ? g.studentId === filters.student : true) &&
    (filters.group ? g.groupName === filters.group : true) &&
    (
      !search ||
      (g.studentName && g.studentName.toLowerCase().includes(search.toLowerCase())) ||
      (g.moduleName && g.moduleName.toLowerCase().includes(search.toLowerCase())) ||
      (g.activityName && g.activityName.toLowerCase().includes(search.toLowerCase()))
    )
  );

  const handleDelete = async (id) => {
    setGradeToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'grades', gradeToDelete));
      setGrades(grades.filter(g => g.id !== gradeToDelete));
      toast.success('Nota eliminada correctamente');
      setShowDeleteModal(false);
      setGradeToDelete(null);
    } catch (error) {
      toast.error('Error al eliminar la nota.');
      setShowDeleteModal(false);
      setGradeToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setGradeToDelete(null);
  };

  const handleEdit = (grade) => {
    setEditGrade(grade);
    setShowForm(true);
  };

  const handleReport = () => {
    navigate('/grades/report', {
      state: {
        grades: filteredGrades,
        modules: moduleOptions.map(m => ({ id: m, name: m })),
        groups: groupOptions.map(g => ({ id: g, name: g }))
      }
    });
  };

  const getGradeColor = (grade) => {
    const num = parseFloat(grade);
    if (num >= 0 && num <= 2.59) return 'bg-red-500';
    if (num >= 3.0 && num <= 3.99) return 'bg-yellow-400';
    if (num >= 4.0 && num <= 5.0) return 'bg-[#009245]';
    return 'bg-gray-300';
  };

  return (
    <div className="bg-white p-2 sm:p-6 rounded-lg shadow-md border-l-4 border-[#23408e]">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-[#23408e]">Gestión de Notas</h2>
        <button
          className="bg-[#009245] text-white px-4 py-2 rounded-md hover:bg-[#007a36] font-semibold w-full sm:w-auto mt-2 sm:mt-0"
          onClick={() => setShowForm(true)}
        >
          + Nueva Nota
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 mb-4 w-full overflow-x-auto">
        <select
          className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#23408e] text-sm min-w-[180px]"
          value={filters.module}
          onChange={e => setFilters(f => ({ ...f, module: e.target.value }))}
        >
          <option value="">Todos los módulos</option>
          {moduleOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#23408e] text-sm min-w-[180px]"
          value={filters.student}
          onChange={e => setFilters(f => ({ ...f, student: e.target.value }))}
        >
          <option value="">Todos los alumnos</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.lastName}</option>)}
        </select>
        <select
          className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#23408e] text-sm min-w-[140px]"
          value={filters.group}
          onChange={e => setFilters(f => ({ ...f, group: e.target.value }))}
        >
          <option value="">Todos los grupos</option>
          {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button
          className="bg-[#ffd600] text-[#23408e] px-4 py-2 rounded-md hover:bg-[#23408e] hover:text-white font-semibold text-sm min-w-[160px]"
          onClick={handleReport}
        >
          &#128196; Generar Informe
        </button>
        <input
          type="text"
          placeholder="Buscar..."
          className="p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#23408e] text-sm min-w-[160px]"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tarjetas de notas */}
      <div className="space-y-4">
        {filteredGrades.length === 0 && (
          <div className="text-gray-400 text-center">No hay calificaciones registradas.</div>
        )}
        {filteredGrades.map((g) => {
          const teacher = teachers.find(t => t.id === g.teacherId);
          const gradeNum = parseFloat(g.grade);
          let gradeColor = 'text-red-600';
          if (gradeNum >= 3.0 && gradeNum <= 3.99) gradeColor = 'text-orange-500';
          if (gradeNum >= 4.0 && gradeNum <= 5.0) gradeColor = 'text-green-600';
          return (
            <div key={g.id} className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white rounded-xl shadow p-4 sm:p-6 border border-gray-100 hover:shadow-md transition mb-2 gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#e3eafc] flex items-center justify-center">
                  <svg className="h-6 w-6 sm:h-7 sm:w-7 text-[#23408e]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-base sm:text-lg text-[#23408e]">{g.studentName}</div>
                  <div className="text-xs sm:text-sm font-semibold text-[#2563eb]">{g.moduleName}</div>
                  <div className="flex flex-wrap gap-2 mt-1 items-center">
                    <span className="px-2 py-1 rounded text-xs font-semibold text-[#ff9800] bg-yellow-50">{g.activityName}</span>
                    {teacher && (
                      <span className="text-xs text-gray-500">Prof. {teacher.name} {teacher.lastName}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-row md:flex-col items-end gap-2 mt-2 md:mt-0 min-w-[100px] sm:min-w-[120px]">
                <span className={`text-xl sm:text-2xl font-bold ${gradeColor}`}>{g.grade}</span>
                <span className="text-xs text-gray-500 flex items-center gap-1 mt-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V7a2 2 0 012-2h4l2-2h2l2 2h4a2 2 0 012 2v12a2 2 0 01-2 2z" /></svg>{g.date}</span>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleEdit(g)} className="border rounded px-2 py-1 text-[#ffd600] hover:bg-gray-50 text-xs" title="Editar">Editar</button>
                  <button onClick={() => handleDelete(g.id)} className="border rounded px-2 py-1 text-red-600 hover:bg-red-100 text-xs" title="Eliminar">Eliminar</button>
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
          modules={currentUser.role === 'teacher' ? (teacherModules || []) : teacherModules} // <-- para admin, pasar teacherModules
          currentUser={currentUser}
          onClose={() => { setShowForm(false); setEditGrade(null); }}
          onSave={grade => {
            if (editGrade) {
              setGrades(grades.map(g => g.id === grade.id ? grade : g));
              toast.success('Nota actualizada correctamente');
            } else {
              setGrades([grade, ...grades]);
              toast.success('Nota creada correctamente');
            }
            setShowForm(false);
            setEditGrade(null);
          }}
          editGrade={editGrade}
        />
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full relative border-t-4 border-[#23408e]">
            <h3 className="text-lg font-bold mb-4 text-[#23408e]">¿Eliminar nota?</h3>
            <p className="mb-6 text-gray-700">Esta acción no se puede deshacer. ¿Deseas continuar?</p>
            <div className="flex justify-end gap-4">
              <button onClick={cancelDelete} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeManager;