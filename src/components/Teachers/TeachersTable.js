import { useState, useEffect } from 'react';
import { collection, getDocs, query, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { saveActivity } from '../../utils/activityLogger';
import { 
  User, Book, Calendar, Phone, Mail, 
  Finance, SettingConfig, Close, CheckOne, 
  Time, Topic, DegreeHat, Carousel, ApplicationOne
} from '@icon-park/react';

const TeachersTable = () => {
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [activeTab, setActiveTab] = useState('perfil'); // 'perfil' | 'academico' | 'cursos'
  const { currentUser } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState(null);
  const [modulesByTeacher, setModulesByTeacher] = useState({});

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const q = query(collection(db, 'teachers'));
        const querySnapshot = await getDocs(q);
        const teachersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTeachers(teachersData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching teachers: ", error);
        setLoading(false);
      }
    };
    fetchTeachers();

    const fetchCourses = async () => {
      try {
        const snap = await getDocs(collection(db, 'courses'));
        setCourses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching courses: ", error);
      }
    };
    fetchCourses();

    const fetchModules = async () => {
      try {
        let modulesMap = {};
        
        // 1. Módulos de Carreras
        const careersSnap = await getDocs(collection(db, 'careers'));
        for (const careerDoc of careersSnap.docs) {
          const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
          modulesSnap.forEach(mod => {
            const data = mod.data();
            const profs = Array.isArray(data.profesor) ? data.profesor : [data.profesor];
            profs.forEach(p => {
              if (p) {
                const pNorm = (p || '').trim().toLowerCase();
                if (!modulesMap[pNorm]) modulesMap[pNorm] = [];
                modulesMap[pNorm].push({
                  id: mod.id,
                  nombre: data.nombre,
                  carrera: careerDoc.data().nombre,
                  careerId: careerDoc.id,
                  semestre: data.semestre || '1',
                  estado: data.estado || 'pendiente',
                  type: 'career'
                });
              }
            });
          });
        }

        // 2. Módulos Generales
        const generalSnap = await getDocs(collection(db, 'generalModules'));
        generalSnap.forEach(gd => {
          const data = gd.data();
          if (data.profesor) {
            const pNorm = (data.profesor || '').trim().toLowerCase();
            if (!modulesMap[pNorm]) modulesMap[pNorm] = [];
            modulesMap[pNorm].push({
              id: gd.id,
              nombre: data.nombre,
              carrera: 'General',
              semestre: 'General',
              estado: data.estado || 'pendiente',
              type: 'general'
            });
          }
        });

        // 3. Módulos de Cursos Cortos
        const coursesSnap = await getDocs(collection(db, 'courses'));
        for (const courseDoc of coursesSnap.docs) {
          const modsSnap = await getDocs(collection(db, 'courses', courseDoc.id, 'modules'));
          modsSnap.forEach(md => {
            const data = md.data();
            if (data.profesorNombre) {
              const pNorm = (data.profesorNombre || '').trim().toLowerCase();
              if (!modulesMap[pNorm]) modulesMap[pNorm] = [];
              modulesMap[pNorm].push({
                id: md.id,
                courseId: courseDoc.id,
                nombre: data.nombre,
                carrera: courseDoc.data().nombre,
                semestre: 'Curso',
                estado: data.estado || 'pendiente',
                type: 'course'
              });
            }
          });
        }

        setModulesByTeacher(modulesMap);
      } catch (error) {
        console.error("Error fetching modules: ", error);
      }
    };
    fetchModules();
  }, []);

  const updateModuleStatusForTeacher = async (teacherNormName, module, newStatus) => {
    try {
      let docRef = null;
      if (module.type === 'career') {
        docRef = doc(db, 'careers', module.careerId, 'modules', module.id);
      } else if (module.type === 'general') {
        docRef = doc(db, 'generalModules', module.id);
      } else if (module.type === 'course') {
        docRef = doc(db, 'courses', module.courseId, 'modules', module.id);
      }

      if (docRef) {
        await updateDoc(docRef, { estado: newStatus });
        
        saveActivity(db, currentUser, {
          action: 'EDICIÓN',
          entityType: 'MODULO',
          entityName: module.nombre,
          details: `Estado actualizado a ${newStatus} para prof. ${teacherNormName} (Tipo: ${module.type})`
        });

        setModulesByTeacher(prev => {
          const updated = { ...prev };
          if (updated[teacherNormName]) {
            updated[teacherNormName] = updated[teacherNormName].map(m =>
              (m.id === module.id && m.type === module.type) ? { ...m, estado: newStatus } : m
            );
          }
          return updated;
        });

        toast.success('Estado del módulo actualizado');
      }
    } catch (error) {
      console.error('Error updating module status:', error);
      toast.error('Error al actualizar el estado');
    }
  };

  const handleDelete = async (id) => {
    setTeacherToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      const targetTeacher = teachers.find(t => t.id === teacherToDelete);
      await deleteDoc(doc(db, 'teachers', teacherToDelete));
      
      saveActivity(db, currentUser, {
        action: 'ELIMINACIÓN',
        entityType: 'DOCENTE',
        entityName: `${targetTeacher?.name} ${targetTeacher?.lastName || ''}`,
        details: `Docente eliminado (Email: ${targetTeacher?.email || 'N/A'})`
      });

      setTeachers(teachers.filter(teacher => teacher.id !== teacherToDelete));
      setShowDeleteModal(false);
      setTeacherToDelete(null);
      toast.success('Profesor eliminado correctamente');
    } catch (error) {
      console.error("Error deleting teacher: ", error);
      setShowDeleteModal(false);
      setTeacherToDelete(null);
      toast.error('Error al eliminar el profesor');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setTeacherToDelete(null);
  };

  const filteredTeachers = teachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (teacher.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="text-[#23408e] font-semibold">Cargando profesores...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#23408e] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-[#23408e]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Gestión de Profesores
          </h1>
          <p className="text-gray-600 mt-1">Administra la información del personal docente del instituto</p>
        </div>
        {currentUser.role === 'admin' && (
          <Link
            to="/dashboard/teachers/new"
            className="bg-[#2563eb] text-white px-4 py-2 rounded-md hover:bg-[#23408e] font-semibold flex items-center gap-2 w-full sm:w-auto mt-4 sm:mt-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Nuevo Profesor
          </Link>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 relative w-full">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input
            type="text"
            placeholder="Buscar por nombre, email o departamento..."
            className="pl-10 border rounded px-2 py-2 text-sm w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-40">
          <select className="border rounded px-2 py-2 text-sm w-full">
            <option value="">Todos</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredTeachers.length === 0 && (
          <div className="text-gray-400 text-center">No hay profesores registrados.</div>
        )}
        {filteredTeachers.map((teacher) => (
          <div key={teacher.id} className="bg-white rounded-lg shadow flex flex-col md:flex-row md:items-center justify-between p-6 border-l-4 border-[#009245]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-100 text-[#009245] font-bold text-xl">
                {teacher.name ? teacher.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div>
                <div className="font-bold text-lg text-[#23408e]">Prof. {teacher.name} {teacher.lastName}</div>
                <div className="text-gray-600 text-sm">{teacher.email}</div>
                <div className="text-[#009245] text-sm font-semibold">{teacher.specialty}</div>
                {teacher.career && (
                  <div className="text-xs text-[#2563eb] font-semibold">Carrera: {teacher.career}</div>
                )}
                {teacher.assignedCourses && teacher.assignedCourses.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {teacher.assignedCourses.slice(0, 2).map(cid => {
                      const c = courses.find(course => course.id === cid);
                      return c ? <span key={cid} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-medium">Curso: {c.nombre}</span> : null;
                    })}
                    {teacher.assignedCourses.length > 2 && <span className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded border border-gray-100">+{teacher.assignedCourses.length - 2} más</span>}
                  </div>
                )}
                {/* Los módulos asignados solo se muestran en el modal de Ver */}
              </div>
            </div>
            <div className="flex flex-col md:items-end gap-2 mt-4 md:mt-0">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${teacher.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{teacher.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                <span className="text-xs text-gray-500">Contratación</span>
                <span className="font-bold text-[#23408e]">{teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString('es-CO') : '--/--/----'}</span>
                {teacher.salary && (
                  <span className="text-green-700 font-semibold text-xs">${Number(teacher.salary).toLocaleString('es-CO')}/mes</span>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setSelectedTeacher(teacher)} className="border rounded px-2 py-1 text-[#23408e] hover:bg-gray-50 text-xs">Ver</button>
                {currentUser.role === 'admin' && (
                  <>
                    <Link to={`/dashboard/teachers/edit/${teacher.id}`} className="border rounded px-2 py-1 text-[#ffd600] hover:bg-gray-50 text-xs">Editar</Link>
                    <button onClick={() => handleDelete(teacher.id)} className="border rounded px-2 py-1 text-red-600 hover:bg-red-100 text-xs">Eliminar</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-4xl w-full relative overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
            
            {/* Cabecera Decorativa */}
            <div className="h-32 bg-gradient-to-r from-[#23408e] via-[#3b5cbd] to-[#23408e] relative shrink-0">
              <button
                className="absolute top-4 right-6 text-white/70 hover:text-white text-2xl font-bold p-2 bg-white/10 rounded-full backdrop-blur-md transition-all z-10"
                onClick={() => setSelectedTeacher(null)}
              >
                <Close size="20" />
              </button>
              
              {/* Avatar Flotante */}
              <div className="absolute -bottom-10 left-10 flex items-end gap-6">
                <div className="w-24 h-24 rounded-[2rem] bg-white p-2 shadow-xl">
                  <div className="w-full h-full rounded-[1.8rem] bg-gradient-to-br from-[#ffd600] to-[#ffb300] flex items-center justify-center text-[#23408e] font-black text-4xl border-4 border-white">
                    {selectedTeacher.name?.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="pb-4">
                  <h3 className="text-2xl font-black text-white drop-shadow-md">
                    Prof. {selectedTeacher.name} {selectedTeacher.lastName}
                  </h3>
                  <p className="text-white/80 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    {selectedTeacher.specialty}
                  </p>
                </div>
              </div>
            </div>

            {/* Navegación de Pestañas */}
            <div className="mt-14 px-10 flex border-b border-gray-100 gap-8 shrink-0">
              {[
                { id: 'perfil', label: 'PERFIL', icon: User },
                { id: 'academico', label: 'CARGA ACADÉMICA', icon: DegreeHat },
                { id: 'cursos', label: 'CURSOS CORTOS', icon: Carousel },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-4 text-xs font-black tracking-[0.2em] transition-all flex items-center gap-2 border-b-4 ${
                    activeTab === tab.id 
                      ? 'border-[#23408e] text-[#23408e]' 
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <tab.icon size="16" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Contenido Scrollable */}
            <div className="p-10 overflow-y-auto custom-scrollbar flex-1 bg-[#fcfdfe]">
              
              {/* TAB: PERFIL */}
              {activeTab === 'perfil' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#23408e] flex items-center justify-center"><Mail size="20" /></div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Correo Institucional</p>
                        <p className="font-bold text-gray-700">{selectedTeacher.email}</p>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center"><Phone size="20" /></div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Teléfono de Contacto</p>
                        <p className="font-bold text-gray-700">{selectedTeacher.phone || 'No registrado'}</p>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><Calendar size="20" /></div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha de Ingreso</p>
                        <p className="font-bold text-gray-700">
                          {selectedTeacher.createdAt ? new Date(selectedTeacher.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '--/--/----'}
                        </p>
                      </div>
                    </div>
                    {selectedTeacher.salary && (
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Finance size="20" /></div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Salario Mensual</p>
                          <p className="font-bold text-gray-700">${Number(selectedTeacher.salary).toLocaleString('es-CO')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {selectedTeacher.career && (
                    <div className="mt-8 p-6 bg-gradient-to-br from-[#23408e] to-[#3b5cbd] rounded-[2rem] text-white flex items-center justify-between shadow-lg">
                      <div>
                        <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Carrera Asignada</p>
                        <p className="text-xl font-black">{selectedTeacher.career}</p>
                      </div>
                      <DegreeHat size="48" className="text-white/20" />
                    </div>
                  )}
                </div>
              )}

              {/* TAB: CARGA ACADÉMICA (Módulos de Semestre) */}
              {activeTab === 'academico' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 space-y-8">
                  {(() => {
                    const normName = (selectedTeacher.name + ' ' + (selectedTeacher.lastName || '')).trim().toLowerCase();
                    const allMods = modulesByTeacher[normName] || [];
                    const filteredMods = allMods.filter(m => m.type !== 'course');
                    
                    if (filteredMods.length === 0) {
                      return (
                        <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                          <Book size="48" className="mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-400 font-bold">No hay módulos de carrera asignados para este docente.</p>
                        </div>
                      );
                    }

                    // Agrupar por semestre
                    const grouped = filteredMods.reduce((acc, m) => {
                      const sem = m.semestre || 'Extra';
                      if (!acc[sem]) acc[sem] = [];
                      acc[sem].push(m);
                      return acc;
                    }, {});

                    return Object.keys(grouped).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(sem => (
                      <div key={sem} className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-[#ffd600] flex items-center justify-center text-[#23408e] font-black text-sm shadow-sm">
                            {sem.match(/\d+/) ? sem.match(/\d+/)[0] : 'S'}
                          </span>
                          <h4 className="font-black text-gray-700 text-sm tracking-widest uppercase">
                            {sem === 'General' ? 'Módulos Generales' : `Semestre ${sem}`}
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {grouped[sem].map((m, idx) => (
                            <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                  <Topic size="20" />
                                </div>
                                <div>
                                  <p className="font-black text-gray-800 text-sm group-hover:text-[#23408e] transition-colors">{m.nombre}</p>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase">{m.carrera}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* TAB: CURSOS CORTOS */}
              {activeTab === 'cursos' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 space-y-6">
                  {(() => {
                    const normName = (selectedTeacher.name + ' ' + (selectedTeacher.lastName || '')).trim().toLowerCase();
                    const allMods = modulesByTeacher[normName] || [];
                    const courseMods = allMods.filter(m => m.type === 'course');
                    
                    if (courseMods.length === 0) {
                      return (
                        <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                          <Carousel size="48" className="mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-400 font-bold">Sin módulos de cursos cortos registrados.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 gap-4">
                        {courseMods.map((m, idx) => (
                          <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-amber-200 transition-all">
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <ApplicationOne size="28" />
                              </div>
                              <div>
                                <p className="font-black text-gray-800 text-lg leading-tight">{m.nombre}</p>
                                <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">{m.carrera}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Footer de acción */}
            <div className="p-8 bg-white border-t border-gray-50 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedTeacher(null)}
                className="px-10 py-3 bg-[#23408e] text-white rounded-2xl hover:bg-[#1a306d] font-black text-sm tracking-widest shadow-xl shadow-blue-200 transition-all uppercase"
              >
                Cerrar Perfil
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full">
            <h2 className="text-lg font-semibold text-[#23408e] mb-4">Eliminar Profesor</h2>
            <p className="text-gray-700 text-sm mb-6">
              ¿Estás seguro de que deseas eliminar a este profesor? Esta acción es irreversible.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-all text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 transition-all text-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeachersTable;