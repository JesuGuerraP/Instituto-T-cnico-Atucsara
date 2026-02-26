import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { toast } from 'react-toastify';
import { Dialog } from '@headlessui/react';

const GeneralModuleManager = () => {
  const [generalModules, setGeneralModules] = useState([]);
  const [careers, setCareers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados del modal
  const [showModal, setShowModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState(null);
  
  // Estados del formulario
  const [formData, setFormData] = useState({
    nombre: '',
    profesor: '',
    descripcion: '',
    semestres: [],
    carreraSemestres: [] // [{career: 'nombre', semester: '1'}, ...]
  });

  // Cargar carreras, profesores y módulos generales al inicializar
  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar carreras
        const careersSnap = await getDocs(collection(db, 'careers'));
        const careersData = careersSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setCareers(careersData);

        // Cargar profesores
        const teachersSnap = await getDocs(collection(db, 'teachers'));
        const teachersData = teachersSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setTeachers(teachersData);

        // Cargar módulos generales
        const modulesSnap = await getDocs(collection(db, 'generalModules'));
        const modulesData = modulesSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setGeneralModules(modulesData);

        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Error al cargar los datos');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const resetForm = () => {
    setFormData({
      nombre: '',
      profesor: '',
      descripcion: '',
      semestres: [],
      carreraSemestres: []
    });
    setEditingModule(null);
  };

  const openModal = (module = null) => {
    if (module) {
      setEditingModule(module);
      setFormData({
        nombre: module.nombre || '',
        profesor: module.profesor || '',
        descripcion: module.descripcion || '',
        semestres: module.semestres || [],
        carreraSemestres: module.carreraSemestres || []
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast.error('El nombre del módulo es requerido');
      return;
    }
    if (formData.carreraSemestres.length === 0) {
      toast.error('Debes seleccionar al menos una carrera y semestre');
      return;
    }

    try {
      const moduleData = {
        nombre: formData.nombre,
        profesor: formData.profesor,
        descripcion: formData.descripcion,
        semestres: Array.from(new Set(formData.carreraSemestres.map(cs => cs.semester))),
        carreraSemestres: formData.carreraSemestres,
        isGeneral: true
      };

      if (editingModule) {
        // Actualizar módulo existente
        await updateDoc(doc(db, 'generalModules', editingModule.id), moduleData);
        setGeneralModules(generalModules.map(m => 
          m.id === editingModule.id ? { id: editingModule.id, ...moduleData } : m
        ));
        toast.success('Módulo general actualizado correctamente');
      } else {
        // Crear nuevo módulo
        const newId = doc(collection(db, 'generalModules')).id;
        await setDoc(doc(db, 'generalModules', newId), moduleData);
        setGeneralModules([...generalModules, { id: newId, ...moduleData }]);
        toast.success('Módulo general creado correctamente');
      }

      closeModal();
    } catch (error) {
      console.error('Error saving module:', error);
      toast.error('Error al guardar el módulo');
    }
  };

  const openDeleteModal = (module) => {
    setModuleToDelete(module);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'generalModules', moduleToDelete.id));
      setGeneralModules(generalModules.filter(m => m.id !== moduleToDelete.id));
      toast.success('Módulo general eliminado correctamente');
      setShowDeleteModal(false);
      setModuleToDelete(null);
    } catch (error) {
      console.error('Error deleting module:', error);
      toast.error('Error al eliminar el módulo');
    }
  };

  const handleAddCareerSemester = (career, semester) => {
    const exists = formData.carreraSemestres.some(cs => cs.career === career && cs.semester === semester);
    if (!exists) {
      setFormData(prev => ({
        ...prev,
        carreraSemestres: [...prev.carreraSemestres, { career, semester }]
      }));
    }
  };

  const handleRemoveCareerSemester = (index) => {
    setFormData(prev => ({
      ...prev,
      carreraSemestres: prev.carreraSemestres.filter((_, i) => i !== index)
    }));
  };

  const getTeacherName = (teacherId) => {
    const teacher = teachers.find(t => t.id === teacherId);
    return teacher ? `${teacher.name} ${teacher.lastName}` : 'Sin asignar';
  };

  if (loading) return <div className="text-[#23408e] font-semibold">Cargando módulos generales...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-6 gap-2 sm:gap-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#23408e] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-[#23408e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Módulos Generales
          </h1>
          <p className="text-gray-600 mt-1">Gestiona módulos que se ofrecen a múltiples carreras</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-[#2563eb] text-white px-4 py-2 rounded-md hover:bg-[#23408e] font-semibold flex items-center gap-2 w-full sm:w-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Módulo General
        </button>
      </div>

      <div className="space-y-4">
        {generalModules.length === 0 ? (
          <div className="text-gray-400 text-center py-8 bg-white rounded-lg">
            No hay módulos generales creados. Crea uno para empezar.
          </div>
        ) : (
          generalModules.map(module => (
            <div key={module.id} className="bg-white rounded-lg shadow p-6 border-l-4 border-[#2563eb]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#23408e]">{module.nombre}</h3>
                  <p className="text-gray-600 text-sm mt-1">{module.descripcion}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-semibold">Profesor</span>
                  <p className="text-gray-700">{getTeacherName(module.profesor)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-semibold">Semestres</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(module.semestres || []).map(s => (
                      <span key={s} className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        Sem. {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-xs text-gray-500 font-semibold">Carreras asignadas</span>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(module.carreraSemestres || []).map((cs, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded">
                      <svg className="w-4 h-4 text-[#009245]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.707 6.707a1 1 0 010 1.414L5.414 9l1.293 1.293a1 1 0 01-1.414 1.414l-2-2a1 1 0 010-1.414l2-2a1 1 0 011.414 0z" clipRule="evenodd" />
                        <path fillRule="evenodd" d="M13.293 6.707a1 1 0 010 1.414L14.586 9l-1.293 1.293a1 1 0 101.414 1.414l2-2a1 1 0 000-1.414l-2-2a1 1 0 00-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-700">{cs.career} - Semestre {cs.semester}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t">
                <button
                  onClick={() => openModal(module)}
                  className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded font-semibold text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => openDeleteModal(module)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded font-semibold text-sm"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal para crear/editar módulo */}
      {showModal && (
        <Dialog open={showModal} onClose={closeModal} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-0 max-w-2xl w-full relative border-t-4 border-[#2563eb] max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 p-6 border-b">
              <Dialog.Title className="text-xl font-bold text-[#23408e]">
                {editingModule ? 'Editar módulo general' : 'Crear nuevo módulo general'}
              </Dialog.Title>
            </div>

            <div className="p-6 space-y-6">
              {/* Nombre */}
              <div>
                <label className="block font-semibold mb-2 text-[#009245]">Nombre del módulo</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-[#23408e]"
                  value={formData.nombre}
                  onChange={e => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Seminario I, Gestión de Proyectos"
                />
              </div>

              {/* Profesor */}
              <div>
                <label className="block font-semibold mb-2 text-[#009245]">Profesor</label>
                <select
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-[#23408e]"
                  value={formData.profesor}
                  onChange={e => setFormData(prev => ({ ...prev, profesor: e.target.value }))}
                >
                  <option value="">Selecciona un profesor</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.lastName}</option>
                  ))}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label className="block font-semibold mb-2 text-[#009245]">Descripción</label>
                <textarea
                  className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-[#23408e] h-24"
                  value={formData.descripcion}
                  onChange={e => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción del módulo"
                />
              </div>

              {/* Seleccionar Carreras y Semestres */}
              <div>
                <label className="block font-semibold mb-2 text-[#009245]">Asignar a carreras y semestres</label>
                <div className="space-y-3 mb-4">
                  {careers.map(career => (
                    <div key={career.id} className="border rounded p-3 bg-gray-50">
                      <div className="font-semibold text-gray-700 mb-2">{career.nombre}</div>
                      <div className="flex flex-wrap gap-2">
                        {['1', '2', '3', '4'].map(semester => (
                          <button
                            key={semester}
                            onClick={() => handleAddCareerSemester(career.nombre, semester)}
                            disabled={formData.carreraSemestres.some(cs => cs.career === career.nombre && cs.semester === semester)}
                            className={`px-3 py-1 rounded text-sm font-medium transition ${
                              formData.carreraSemestres.some(cs => cs.career === career.nombre && cs.semester === semester)
                                ? 'bg-[#2563eb] text-white cursor-not-allowed opacity-50'
                                : 'bg-white border border-gray-300 text-gray-700 hover:border-[#2563eb]'
                            }`}
                          >
                            Sem. {semester}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Carrera-Semestre seleccionados */}
                {formData.carreraSemestres.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-700 mb-2">Seleccionados:</h4>
                    <div className="space-y-2">
                      {formData.carreraSemestres.map((cs, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded border border-blue-200">
                          <span className="text-sm text-gray-700">{cs.career} - Semestre {cs.semester}</span>
                          <button
                            onClick={() => handleRemoveCareerSemester(idx)}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-[#2563eb] text-white rounded-md hover:bg-[#23408e] font-semibold"
                >
                  {editingModule ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <Dialog.Title className="text-lg font-semibold text-[#23408e] mb-4">Eliminar módulo general</Dialog.Title>
            <div className="mb-4 text-gray-700">
              ¿Estás seguro de que deseas eliminar <strong>"{moduleToDelete?.nombre}"</strong>? Esta acción no se puede deshacer.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default GeneralModuleManager;
