import { useState, useEffect } from 'react';
import { collection, getDocs, query, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const TeachersTable = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
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

    // Obtener módulos agrupados por profesor
    const fetchModules = async () => {
      const careersSnap = await getDocs(collection(db, 'careers'));
      let modulesMap = {};
      for (const careerDoc of careersSnap.docs) {
        const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
        modulesSnap.forEach(mod => {
          const data = mod.data();
          if (data.profesor) {
            if (!modulesMap[data.profesor]) modulesMap[data.profesor] = [];
            modulesMap[data.profesor].push({
              nombre: data.nombre,
              carrera: careerDoc.data().nombre,
              semestre: data.semestre,
              estado: data.estado || 'pendiente' // Mantener el estado del módulo
            });
          }
        });
      }
      setModulesByTeacher(modulesMap);
    };
    fetchModules();
  }, []);

  const handleDelete = async (id) => {
    setTeacherToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'teachers', teacherToDelete));
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

  const updateModuleStatusForTeacher = async (teacherName, moduleName, newStatus) => {
    try {
      const careersSnap = await getDocs(collection(db, 'careers'));
      for (const careerDoc of careersSnap.docs) {
        const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
        for (const moduleDoc of modulesSnap.docs) {
          const moduleData = moduleDoc.data();
          if (moduleData.nombre === moduleName && moduleData.profesor === teacherName) {
            await setDoc(doc(db, 'careers', careerDoc.id, 'modules', moduleDoc.id), {
              ...moduleData,
              estado: newStatus
            });
          }
        }
      }
      setModulesByTeacher(prev => {
        const updatedModules = { ...prev };
        updatedModules[teacherName] = updatedModules[teacherName].map(mod =>
          mod.nombre === moduleName ? { ...mod, estado: newStatus } : mod
        );
        return updatedModules;
      });
    } catch (error) {
      console.error('Error updating module status for teacher:', error);
    }
  };

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-2xl w-full relative border-t-8 border-[#009245] animate-fadeIn flex flex-col overflow-y-auto max-h-[80vh]">
            <button
              className="absolute top-4 right-6 text-gray-400 hover:text-gray-700 text-3xl font-bold transition-all"
              onClick={() => setSelectedTeacher(null)}
            >
              &times;
            </button>
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center bg-green-100 text-[#009245] font-bold text-3xl border-4 border-[#009245]">
                {selectedTeacher.name ? selectedTeacher.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div>
                <h3 className="text-3xl font-bold mb-2 text-[#23408e]">Prof. {selectedTeacher.name} {selectedTeacher.lastName}</h3>
                <div className="text-lg text-gray-600 mb-1">{selectedTeacher.email}</div>
                <div className="text-[#009245] text-lg font-semibold mb-1">{selectedTeacher.specialty}</div>
                {selectedTeacher.career && (
                  <div className="text-base text-[#2563eb] font-semibold mb-1">Carrera asignada: {selectedTeacher.career}</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <div className="mb-4">
                  <span className="font-semibold text-[#009245]">Teléfono:</span> {selectedTeacher.phone || 'No disponible'}
                </div>
                <div className="mb-4">
                  <span className="font-semibold text-[#009245]">Estado:</span> {selectedTeacher.status === 'active' ? 'Activo' : 'Inactivo'}
                </div>
                {selectedTeacher.salary && (
                  <div className="mb-4">
                    <span className="font-semibold text-[#009245]">Salario mensual:</span> ${Number(selectedTeacher.salary).toLocaleString('es-CO')}
                  </div>
                )}
                <div className="mb-4">
                  <span className="font-semibold text-[#009245]">Contratación:</span> {selectedTeacher.createdAt ? new Date(selectedTeacher.createdAt).toLocaleDateString('es-CO') : '--/--/----'}
                </div>
              </div>
              <div>
                <div className="font-semibold text-[#23408e] mb-4">Módulos asignados</div>
                {modulesByTeacher[selectedTeacher.name + ' ' + (selectedTeacher.lastName || '')] ? (
                  <ul className="list-none space-y-4">
                    {modulesByTeacher[selectedTeacher.name + ' ' + (selectedTeacher.lastName || '')].map((m, idx) => (
                      <li key={idx} className="flex flex-col gap-2">
                        <div className="text-[#009245] text-base font-semibold">
                          {m.nombre} <span className="text-gray-500 font-normal">({m.carrera}, Sem. {m.semestre})</span>
                        </div>
                        <select
                          className={`px-2 py-1 rounded-full text-xs font-semibold border ${{
                            aprobado: 'bg-green-100 text-green-800 border-green-300',
                            cursando: 'bg-blue-100 text-blue-800 border-blue-300',
                            pendiente: 'bg-gray-100 text-gray-800 border-gray-300',
                          }[m.estado || 'pendiente']}`}
                          value={m.estado || 'pendiente'}
                          onChange={(e) =>
                            updateModuleStatusForTeacher(
                              selectedTeacher.name + ' ' + (selectedTeacher.lastName || ''),
                              m.nombre,
                              e.target.value
                            )
                          }
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="cursando">Cursando</option>
                          <option value="aprobado">Aprobado</option>
                        </select>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-gray-400">No tiene módulos asignados.</div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setSelectedTeacher(null)}
                className="px-8 py-3 bg-[#009245] text-white rounded-xl hover:bg-[#23408e] font-bold text-lg shadow-lg transition-all"
              >
                Cerrar
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