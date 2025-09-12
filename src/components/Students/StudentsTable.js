import { useState, useEffect } from 'react';
import { collection, getDocs, query, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LocalPhoneIcon from '@mui/icons-material/LocalPhone';
import OutgoingMailIcon from '@mui/icons-material/OutgoingMail';
import { toast } from 'react-toastify';
import { Dialog } from '@headlessui/react';

const StudentsTable = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [careerFilter, setCareerFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCareer, setAssignCareer] = useState('');
  const [assignStudents, setAssignStudents] = useState([]);
  const [assignModule, setAssignModule] = useState('');
  const [assignStatus, setAssignStatus] = useState('cursando');
  const [modulesByCareer, setModulesByCareer] = useState([]);
  const [careersList, setCareersList] = useState([]);
  const [studentsByCareer, setStudentsByCareer] = useState([]);
  const [coursesList, setCoursesList] = useState([]);
  const { currentUser } = useAuth();
  const [studentTab, setStudentTab] = useState('modulos');
  const [showModulosDetalle, setShowModulosDetalle] = useState(false);
  const [showSeminariosDetalle, setShowSeminariosDetalle] = useState(false);
  const [showCursosDetalle, setShowCursosDetalle] = useState(false);
  const [courseModulesInfo, setCourseModulesInfo] = useState([]); // [{courseId, courseName, modules: []}]

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'students'));
        const querySnapshot = await getDocs(q);
        const studentsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStudents(studentsData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching students: ", error);
        setLoading(false);
      }
    };

    const fetchTeachers = async () => {
      const snapshot = await getDocs(collection(db, 'teachers'));
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    fetchStudents();
    fetchTeachers();
  }, []);

  useEffect(() => {
    // Obtener carreras y módulos para el modal y para mostrar nombres de módulos
    const fetchCareers = async () => {
      const careersSnap = await getDocs(collection(db, 'careers'));
      const careersArr = [];
      for (const docSnap of careersSnap.docs) {
        const data = docSnap.data();
        // Obtener módulos de la subcolección
        const modulosSnap = await getDocs(collection(db, 'careers', docSnap.id, 'modules'));
        const modulosArr = modulosSnap.docs.map(m => ({ id: m.id, ...m.data() }));
        careersArr.push({ id: docSnap.id, ...data, modulos: modulosArr });
      }
      setCareersList(careersArr);
    };
    fetchCareers();
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      const coursesSnap = await getDocs(collection(db, 'courses'));
      setCoursesList(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCourses();
  }, []);

  // Cargar módulos de los cursos del estudiante seleccionado
  useEffect(() => {
    const loadCourseModules = async () => {
      if (!selectedStudent || !Array.isArray(selectedStudent.courses) || selectedStudent.courses.length === 0) {
        setCourseModulesInfo([]);
        return;
      }
      const result = [];
      for (const courseId of selectedStudent.courses) {
        const course = coursesList.find(c => c.id === courseId);
        try {
          const snap = await getDocs(collection(db, 'courses', courseId, 'modules'));
          const modules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          result.push({ courseId, courseName: course?.nombre || 'Curso', modules });
        } catch (e) {
          result.push({ courseId, courseName: course?.nombre || 'Curso', modules: [] });
        }
      }
      setCourseModulesInfo(result);
    };
    loadCourseModules();
  }, [selectedStudent, coursesList]);

  useEffect(() => {
    // Filtrar estudiantes por carrera seleccionada
    if (assignCareer) {
      setStudentsByCareer(students.filter(s => s.career === assignCareer));
      const careerObj = careersList.find(c => c.nombre === assignCareer);
      if (careerObj) {
        getDocs(collection(db, 'careers', careerObj.id, 'modules')).then(snap => {
          setModulesByCareer(snap.docs.map(m => ({ id: m.id, ...m.data() })));
        });
      } else {
        setModulesByCareer([]);
      }
    } else {
      setStudentsByCareer([]);
      setModulesByCareer([]);
    }
  }, [assignCareer, students, careersList]);

  const handleDelete = async (id) => {
    setStudentToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'students', studentToDelete));
      setStudents(students.filter(student => student.id !== studentToDelete));
      setShowDeleteModal(false);
      setStudentToDelete(null);
      toast.success('Estudiante eliminado correctamente');
    } catch (error) {
      console.error("Error deleting student: ", error);
      setShowDeleteModal(false);
      setStudentToDelete(null);
      toast.error('Error al eliminar el estudiante');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setStudentToDelete(null);
  };

  const handleAssignModule = async () => {
    if (!assignModule || assignStudents.length === 0) return;
    for (const studentId of assignStudents) {
      const studentRef = doc(db, 'students', studentId);
      const studentSnap = await getDoc(studentRef);
      let modulosAsignados = studentSnap.data().modulosAsignados || [];
      // Si ya existe el módulo, actualiza el estado, si no, lo agrega
      const idx = modulosAsignados.findIndex(m => m.id === assignModule);
      if (idx >= 0) {
        modulosAsignados[idx].estado = assignStatus;
      } else {
        modulosAsignados.push({ id: assignModule, estado: assignStatus });
      }
      await updateDoc(studentRef, { modulosAsignados });
    }
    toast.success('Módulo asignado/actualizado correctamente');
    setShowAssignModal(false);
    setAssignCareer('');
    setAssignStudents([]);
    setAssignModule('');
    setAssignStatus('cursando');
    // Refrescar estudiantes
    const q = query(collection(db, 'students'));
    const querySnapshot = await getDocs(q);
    setStudents(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  // Obtener todas las carreras únicas para el filtro
  const careers = Array.from(new Set(students.map(s => s.career).filter(Boolean)));

  const filteredStudents = students.filter(student => {
    const matchesText = (
      (student.name && student.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (student.lastName && student.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (student.dni && student.dni.includes(searchTerm))
    );
    const isCareer = !!student.career;
    const isCourse = Array.isArray(student.courses) && student.courses.length > 0;

    const matchesScope = scopeFilter
      ? (scopeFilter === 'career' ? isCareer : (scopeFilter === 'course' ? isCourse : (isCareer || isCourse)))
      : true;

    const matchesCareerOrCourse = scopeFilter === 'course'
      ? (courseFilter ? (Array.isArray(student.courses) && student.courses.includes(courseFilter)) : true)
      : (careerFilter ? student.career === careerFilter : true);

    return matchesText && matchesCareerOrCourse && matchesScope;
  });

  const getTeacherName = (teacherId) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher ? `${teacher.name} ${teacher.lastName}` : 'Sin asignar';
  };

  if (loading) return <div className="text-[#23408e] font-semibold">Cargando estudiantes...</div>;

  // Seminarios fijos para todos los estudiantes
  const seminariosFijos = [
    { id: 'seminario1', nombre: 'Seminario I', semestre: 1 },
    { id: 'seminario2', nombre: 'Seminario II', semestre: 2 },
    { id: 'seminario3', nombre: 'Seminario III', semestre: 3 },
    { id: 'seminario4', nombre: 'Seminario IV', semestre: 4 },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-6 gap-2 sm:gap-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#23408e] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-[#23408e]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 7a4 4 0 11-8 0 4 4 0 018 0zm6 13v-2a6 6 0 00-5-5.91M2 20v-2a6 6 0 015-5.91" /></svg>
            Gestión de Estudiantes
          </h1>
          <p className="text-gray-600 mt-1">Administra la información de los estudiantes del instituto</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-4 sm:mt-0">
          {(currentUser.role === 'admin' || currentUser.role === 'secretary') && (
            <>
              <button
                onClick={() => setShowAssignModal(true)}
                className="bg-[#ffd600] text-[#23408e] px-4 py-2 rounded-md hover:bg-[#fff176] font-semibold flex items-center gap-2 w-full sm:w-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Asignar Módulo
              </button>
              <Link
                to="/dashboard/students/form"
                className="bg-[#2563eb] text-white px-4 py-2 rounded-md hover:bg-[#23408e] font-semibold flex items-center gap-2 w-full sm:w-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Nuevo Estudiante
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 relative w-full">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input
            type="text"
            placeholder="Buscar estudiantes..."
            className="pl-10 border rounded px-2 py-2 text-sm w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-1/4">
          {scopeFilter === 'course' ? (
            <select
              className="border rounded px-2 py-2 text-sm w-full"
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
            >
              <option value="">Todos los cursos</option>
              {coursesList.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          ) : (
            <select
              className="border rounded px-2 py-2 text-sm w-full"
              value={careerFilter}
              onChange={e => setCareerFilter(e.target.value)}
            >
              <option value="">Todas las carreras</option>
              {careers.map(career => (
                <option key={career} value={career}>{career}</option>
              ))}
            </select>
          )}
        </div>
        <div className="w-full md:w-1/4">
          <select
            className="border rounded px-2 py-2 text-sm w-full"
            value={scopeFilter}
            onChange={e => setScopeFilter(e.target.value)}
          >
            <option value="">Todos los ámbitos</option>
            <option value="career">Carrera</option>
            <option value="course">Curso</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredStudents.length === 0 && (
          <div className="text-gray-400 text-center">No hay estudiantes registrados.</div>
        )}
        {filteredStudents.map((student) => (
          <div key={student.id} className="bg-white rounded-lg shadow flex flex-col md:flex-row md:items-center justify-between p-6 border-l-4 border-[#009245]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#e3eafc] text-[#23408e] font-bold text-xl">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-lg text-[#23408e]">{student.name} {student.lastName}</div>
                <div className="flex flex-wrap gap-2 items-center text-gray-600 text-sm">
                  <span><OutgoingMailIcon className="inline w-4 h-4 mr-1 text-[#23408e]" fontSize="small" />{student.email}</span>
                  {student.phone && <span><LocalPhoneIcon className="inline w-4 h-4 mr-1 text-[#23408e]" fontSize="small" />{student.phone}</span>}
                </div>
                <div className="text-sm mt-1"><span className="font-bold text-[#23408e]">Carrera:</span> {student.career || '—'}</div>
                {/* Mostrar semestre y/o período según corresponda */}
                {student.career && (
                  <div className="text-sm mt-1"><span className="font-bold text-[#23408e]">Semestre:</span> {student.semester ? `Semestre ${student.semester}` : 'Sin asignar'}</div>
                )}
                {(Array.isArray(student.courses) && student.courses.length > 0) && (
                  <div className="text-sm mt-1"><span className="font-bold text-[#23408e]">Período (curso):</span> {student.coursePeriod || '—'}</div>
                )}
              </div>
            </div>
            <div className="flex flex-col md:items-end gap-2 mt-4 md:mt-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 flex items-center gap-1"><svg className="w-4 h-4 text-[#23408e]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 4h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h2a2 2 0 012 2z" /></svg>Inscrito: {student.createdAt ? new Date(student.createdAt).toLocaleDateString('es-CO') : '--/--/----'}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${student.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{student.status === 'active' ? 'Activo' : 'Inactivo'}</span>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setSelectedStudent(student)} className="border rounded px-2 py-1 text-[#23408e] hover:bg-gray-50 text-xs">Ver</button>
                {(currentUser.role === 'admin' || currentUser.role === 'secretary') && (
                  <>
                    <Link to={`/dashboard/students/form/${student.id}`} className="border rounded px-2 py-1 text-[#ffd600] hover:bg-gray-50 text-xs">Editar</Link>
                    <button onClick={() => handleDelete(student.id)} className="border rounded px-2 py-1 text-red-600 hover:bg-red-100 text-xs">Eliminar</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal para asignar módulo */}
      {showAssignModal && (
        <Dialog open={showAssignModal} onClose={() => setShowAssignModal(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full relative border-t-4 border-[#ffd600]">
            <Dialog.Title className="text-xl font-bold mb-4 text-[#23408e]">Asignar módulo a estudiantes</Dialog.Title>
            <div className="mb-4">
              <label className="block font-semibold mb-1 text-[#009245]">Carrera</label>
              <select className="w-full border rounded px-3 py-2 mb-2" value={assignCareer} onChange={e => setAssignCareer(e.target.value)}>
                <option value="">Selecciona una carrera</option>
                {careersList.map(c => (
                  <option key={c.id} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block font-semibold mb-1 text-[#009245]">Estudiantes</label>
              <select multiple className="w-full border rounded px-3 py-2 mb-2 h-32" value={assignStudents} onChange={e => setAssignStudents(Array.from(e.target.selectedOptions, o => o.value))}>
                {studentsByCareer.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.lastName}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block font-semibold mb-1 text-[#009245]">Módulo</label>
              <select className="w-full border rounded px-3 py-2 mb-2" value={assignModule} onChange={e => setAssignModule(e.target.value)}>
                <option value="">Selecciona un módulo</option>
                {modulesByCareer.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block font-semibold mb-1 text-[#009245]">Estado</label>
              <select className="w-full border rounded px-3 py-2 mb-2" value={assignStatus} onChange={e => setAssignStatus(e.target.value)}>
                <option value="cursando">Cursando</option>
                <option value="aprobado">Aprobado</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-100 rounded-md" onClick={() => setShowAssignModal(false)}>Cancelar</button>
              <button className="px-4 py-2 bg-[#ffd600] text-[#23408e] rounded-md font-semibold" onClick={handleAssignModule} disabled={!assignModule || assignStudents.length === 0}>Asignar</button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Modal para ver estudiante */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-3xl w-full relative border-t-8 border-[#2563eb] max-h-[90vh] overflow-y-auto">
            <button className="absolute top-3 right-4 text-2xl text-gray-300 hover:text-[#2563eb] font-bold" onClick={() => setSelectedStudent(null)}>&times;</button>
            <h2 className="text-3xl font-extrabold text-[#23408e] mb-4 tracking-tight">{selectedStudent.name} {selectedStudent.lastName}</h2>
            <div className="grid grid-cols-1 gap-2 mb-4">
              <div className="flex items-center gap-2 text-[#009245] text-base"><span className="font-semibold">DNI:</span> <span className="text-gray-700">{selectedStudent.dni}</span></div>
              <div className="flex items-center gap-2 text-[#009245] text-base"><span className="font-semibold">Email:</span> <span className="text-gray-700">{selectedStudent.email}</span></div>
              <div className="flex items-center gap-2 text-[#009245] text-base"><span className="font-semibold">Teléfono:</span> <span className="text-gray-700">{selectedStudent.phone || 'No registrado'}</span></div>
              <div className="flex items-center gap-2 text-[#009245] text-base"><span className="font-semibold">Carrera:</span> <span className="text-gray-700">{selectedStudent.career}</span></div>
              {Array.isArray(selectedStudent.courses) && selectedStudent.courses.length > 0 && (
                <div className="flex items-center gap-2 text-[#009245] text-base">
                  <span className="font-semibold">Cursos:</span>
                  <span className="text-gray-700">
                    {selectedStudent.courses
                      .map(cid => coursesList.find(c => c.id === cid)?.nombre)
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[#009245] text-base"><span className="font-semibold">Estado:</span> <span className={selectedStudent.status === 'active' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{selectedStudent.status === 'active' ? 'Activo' : 'Inactivo'}</span></div>
            </div>
            {/* NUEVO: Tabs Modulos/Seminarios/Cursos */}
            <div className="flex gap-4 mb-4">
              <button
                className={`px-4 py-2 rounded font-bold border ${studentTab === 'modulos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-600'}`}
                onClick={() => setStudentTab('modulos')}
              >Módulos</button>
              <button
                className={`px-4 py-2 rounded font-bold border ${studentTab === 'seminarios' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-600'}`}
                onClick={() => setStudentTab('seminarios')}
              >Seminarios</button>
              {Array.isArray(selectedStudent.courses) && selectedStudent.courses.length > 0 && (
                <button
                  className={`px-4 py-2 rounded font-bold border ${studentTab === 'cursos' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-yellow-700 border-yellow-500'}`}
                  onClick={() => setStudentTab('cursos')}
                >Módulos de cursos</button>
              )}
            </div>
            {/* NUEVO: Detalle expandible */}
            {studentTab === 'modulos' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-[#23408e] text-lg">Módulos de la carrera</span>
                  <button className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-semibold" onClick={() => setShowModulosDetalle(!showModulosDetalle)}>{showModulosDetalle ? 'Ver menos' : 'Ver más'}</button>
                </div>
                {showModulosDetalle && (
                  <ul className="space-y-2 mb-4">
                    {(selectedStudent.modulosAsignados || []).map((mod) => {
                      const moduloObj = (careersList.find(c => c.nombre === selectedStudent.career)?.modulos || []).find(m => m.id === mod.id);
                      let estadoColor = '';
                      switch (mod.estado) {
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
                        <li key={mod.id} className="flex flex-col gap-1 p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-blue-50 transition">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-blue-900 text-base truncate max-w-[60%]">{moduloObj?.nombre || 'Módulo'}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${estadoColor} ml-2`}>{mod.estado?.charAt(0).toUpperCase() + mod.estado?.slice(1)}</span>
                          </div>
                          {moduloObj && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-semibold">Profesor:</span> {moduloObj.profesor || 'Sin asignar'}<br/>
                              <span className="font-semibold">Semestre:</span> {moduloObj.semestre}<br/>
                              <span className="font-semibold">Descripción:</span> {moduloObj.descripcion}
                            </div>
                          )}
                        </li>
                      );
                    })}
                    {(!selectedStudent.modulosAsignados || selectedStudent.modulosAsignados.length === 0) && (
                      <li className="text-gray-400 text-xs">No tiene módulos asignados.</li>
                    )}
                  </ul>
                )}
              </div>
            )}
            {studentTab === 'seminarios' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-green-700 text-lg">Seminarios obligatorios</span>
                  <button className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 font-semibold" onClick={() => setShowSeminariosDetalle(!showSeminariosDetalle)}>{showSeminariosDetalle ? 'Ver menos' : 'Ver más'}</button>
                </div>
                {showSeminariosDetalle && (
                  <ul className="space-y-2 mb-4">
                    {/* Obtener seminarios completos de la carrera */}
                    {(careersList.find(c => c.nombre === selectedStudent.career)?.seminarios || []).map((seminario, idx) => {
                      // Buscar si el estudiante tiene estado propio para este seminario
                      let estado = seminario.estado || 'pendiente';
                      let info = { ...seminario };
                      if (Array.isArray(selectedStudent.seminarios)) {
                        // Buscar por id
                        let sem = selectedStudent.seminarios.find(s => s.id === seminario.id);
                        // Si no encuentra por id, buscar por nombre y semestre
                        if (!sem) {
                          sem = selectedStudent.seminarios.find(s => s.nombre === seminario.nombre && s.semestre === seminario.semestre);
                        }
                        if (sem) {
                          estado = sem.estado || seminario.estado || 'pendiente';
                          info = { ...seminario, ...sem };
                        }
                      }
                      let estadoColor = '';
                      switch (estado.toLowerCase()) {
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
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${estadoColor} ml-2`}>{estado.charAt(0).toUpperCase() + estado.slice(1)}</span>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            <span className="font-semibold">Profesor:</span> {info.profesor || 'Sin asignar'}<br/>
                            <span className="font-semibold">Horas:</span> {info.horas || '-'}<br/>
                            <span className="font-semibold">Estado:</span> {estado.charAt(0).toUpperCase() + estado.slice(1)}
                          </div>
                        </li>
                      );
                    })}
                    {/* Si la carrera no tiene seminarios definidos, mostrar mensaje */}
                    {(careersList.find(c => c.nombre === selectedStudent.career)?.seminarios || []).length === 0 && (
                      <li className="text-gray-400 text-xs">No hay seminarios definidos para esta carrera.</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {studentTab === 'cursos' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-yellow-600 text-lg">Módulos de cursos</span>
                  <button className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 font-semibold" onClick={() => setShowCursosDetalle(!showCursosDetalle)}>{showCursosDetalle ? 'Ver menos' : 'Ver más'}</button>
                </div>
                {showCursosDetalle && (
                  <div className="space-y-3 mb-4">
                    {courseModulesInfo.length === 0 && (
                      <div className="text-gray-400 text-xs">No tiene cursos asignados.</div>
                    )}
                    {courseModulesInfo.map(ci => (
                      <div key={ci.courseId} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                        <div className="font-semibold text-blue-900 mb-2">{ci.courseName}</div>
                        {ci.modules.length === 0 ? (
                          <div className="text-gray-400 text-xs">Este curso no tiene módulos.</div>
                        ) : (
                          <ul className="space-y-1">
                            {ci.modules.map(m => (
                              <li key={m.id} className="flex items-center justify-between text-sm">
                                <span className="text-gray-700">{m.nombre}</span>
                                <span className="text-gray-500 text-xs">{m.horas ? `${m.horas} h` : ''} {m.precio ? `• ${Number(m.precio).toLocaleString()}` : ''}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end mt-8">
              <button className="px-6 py-2 bg-[#2563eb] hover:bg-[#23408e] text-white rounded-lg font-bold shadow transition" onClick={() => setSelectedStudent(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <Dialog open={showDeleteModal} onClose={cancelDelete} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <Dialog.Title className="text-lg font-semibold text-[#23408e] mb-4">Eliminar Estudiante</Dialog.Title>
            <div className="mb-4 text-gray-700">
              ¿Estás seguro de que deseas eliminar a este estudiante? Esta acción no se puede deshacer.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={cancelDelete} className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default StudentsTable;
