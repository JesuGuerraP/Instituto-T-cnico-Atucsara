import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DegreeHat, Edit, Add, Book, Lightning } from '@icon-park/react';
import { FaTrash } from 'react-icons/fa';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { toast, ToastContainer } from 'react-toastify';
import { saveActivity } from '../../utils/activityLogger';
import 'react-toastify/dist/ReactToastify.css';
import SeminariosManager from '../Seminarios/SeminariosManager';

const VistaCarreras = () => {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState('carreras');
  const [carreraSeleccionada, setCarreraSeleccionada] = useState(null);
  const [modalCarrera, setModalCarrera] = useState(false);
  const [modalModulo, setModalModulo] = useState(false);
  const [carreras, setCarreras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profesores, setProfesores] = useState([]);
  const [modalConfirmacion, setModalConfirmacion] = useState(false);
  const [carreraAEliminar, setCarreraAEliminar] = useState(null);
  const [modalConfirmacionModulo, setModalConfirmacionModulo] = useState(false);
  const [moduloAEliminar, setModuloAEliminar] = useState(null);

  // Formulario Nueva Carrera
  const [formCarrera, setFormCarrera] = useState({ nombre: '', descripcion: '', duracion: 6 });
  // Formulario Nuevo Módulo
  const [formModulo, setFormModulo] = useState({ nombre: '', profesor: [], sabadosSemana: 1, descripcion: '', semestre: 1 });
  const [editandoModulo, setEditandoModulo] = useState(null);
  // Estado para seminarios — nuevo gestor

  // LEGACY: mantener compatibilidad
  const [modalSeminarios, setModalSeminarios] = useState(false);
  const [seminariosEdit, setSeminariosEdit] = useState([]);

  // Cargar carreras y módulos desde Firestore
  const fetchCarreras = async () => {
    setLoading(true);
    const carrerasSnap = await getDocs(collection(db, 'careers'));
    const carrerasArr = [];
    for (const docSnap of carrerasSnap.docs) {
      const data = docSnap.data();
      // Obtener módulos de la subcolección
      const modulosSnap = await getDocs(collection(db, 'careers', docSnap.id, 'modules'));
      const modulosArr = modulosSnap.docs.map(m => ({ id: m.id, ...m.data() }));
      carrerasArr.push({ id: docSnap.id, ...data, modulos: modulosArr });
    }
    setCarreras(carrerasArr);
    setLoading(false);
  };

  // Refrescar carreraSeleccionada con datos actualizados de Firestore
  const refreshCarreraSeleccionada = async (carreraId) => {
    if (!carreraId) return;
    const docSnap = await getDoc(doc(db, 'careers', carreraId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      const modulosSnap = await getDocs(collection(db, 'careers', carreraId, 'modules'));
      const modulosArr = modulosSnap.docs.map(m => ({ id: m.id, ...m.data() }));
      setCarreraSeleccionada({ id: carreraId, ...data, modulos: modulosArr });
    }
  };

  // Cargar profesores para el select
  useEffect(() => {
    const fetchProfesores = async () => {
      const snap = await getDocs(collection(db, 'teachers'));
      setProfesores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchProfesores();
  }, []);

  // Cargar al montar
  useEffect(() => {
    fetchCarreras();
    // No refrescar carreraSeleccionada aquí, porque puede ser null al inicio
  }, []);

  // Cargar seminarios de la carrera seleccionada
  useEffect(() => {
    if (carreraSeleccionada?.seminarios) {
      setSeminariosEdit(carreraSeleccionada.seminarios);
    } else {
      setSeminariosEdit([]);
    }
  }, [carreraSeleccionada]);


  // Abrir módulos de una carrera
  const handleVerModulos = (carrera) => {
    setCarreraSeleccionada(carrera);
    setTab('modulos');
  };

  const handleVerSeminarios = (carrera) => {
    setCarreraSeleccionada(carrera);
    setTab('seminarios');
  };

  // Crear carrera en Firestore
  const handleCrearCarrera = async () => {
    try {
      await addDoc(collection(db, 'careers'), {
        nombre: formCarrera.nombre,
        descripcion: formCarrera.descripcion,
        duracion: formCarrera.duracion,
        estado: 'Activa',
      });
      saveActivity(db, currentUser, {
        action: 'CREACIÓN',
        entityType: 'ESTRUCTURA',
        entityName: formCarrera.nombre,
        details: `Nueva carrera técnica creada: ${formCarrera.descripcion}`
      });
      toast.success('Carrera creada correctamente');
      setFormCarrera({ nombre: '', descripcion: '', duracion: 6 });
      setModalCarrera(false);
      // Esperar a que Firestore propague el cambio antes de recargar
      setTimeout(() => {
        fetchCarreras();
        if (carreraSeleccionada) refreshCarreraSeleccionada(carreraSeleccionada.id);
      }, 500);
    } catch (e) {
      toast.error('Error al crear la carrera');
    }
  };

  // Editar carrera: abre modal y carga datos
  const handleEditarCarrera = (carrera) => {
    setCarreraSeleccionada(carrera);
    setFormCarrera({
      nombre: carrera.nombre,
      descripcion: carrera.descripcion,
      duracion: carrera.duracion,
    });
    setModalCarrera(true);
  };

  // Guardar cambios de edición de carrera
  const guardarEdicionCarrera = async () => {
    if (carreraSeleccionada) {
      const carreraRef = doc(db, 'careers', carreraSeleccionada.id);
      await updateDoc(carreraRef, {
        nombre: formCarrera.nombre,
        descripcion: formCarrera.descripcion,
        duracion: formCarrera.duracion,
      });
      saveActivity(db, currentUser, {
        action: 'EDICIÓN',
        entityType: 'ESTRUCTURA',
        entityName: formCarrera.nombre,
        details: `Datos de la carrera actualizados`
      });
      toast.success('Carrera actualizada correctamente');
      setModalCarrera(false);
      fetchCarreras();
    }
  };

  // Confirmar eliminación de carrera
  const confirmarEliminacionCarrera = (carreraId) => {
    setCarreraAEliminar(carreraId);
    setModalConfirmacion(true);
  };

  // Eliminar carrera
  const eliminarCarrera = async () => {
    if (carreraAEliminar) {
      const target = carreras.find(c => c.id === carreraAEliminar);
      await deleteDoc(doc(db, 'careers', carreraAEliminar));
      saveActivity(db, currentUser, {
        action: 'ELIMINACIÓN',
        entityType: 'ESTRUCTURA',
        entityName: target?.nombre || 'Carrera',
        details: `Carrera técnica eliminada permanentemente`
      });
      toast.success('Carrera eliminada correctamente');
      setModalConfirmacion(false);
      setCarreraAEliminar(null);
      fetchCarreras();
    }
  };

  // Editar módulo: abre modal y carga datos
  const handleEditarModulo = (modulo) => {
    setFormModulo({
      ...modulo,
      profesor: Array.isArray(modulo.profesor) ? modulo.profesor : (modulo.profesor ? [modulo.profesor] : [])
    });
    setEditandoModulo(modulo.id);
    setModalModulo(true);
  };

  // Crear o actualizar módulo en Firestore
  const handleCrearModulo = async () => {
    if (!carreraSeleccionada) return;
    try {
      if (editandoModulo) {
        // Actualizar
        const moduloRef = doc(db, 'careers', carreraSeleccionada.id, 'modules', editandoModulo);
        await updateDoc(moduloRef, {
          nombre: formModulo.nombre,
          profesor: formModulo.profesor,
          sabadosSemana: formModulo.sabadosSemana,
          descripcion: formModulo.descripcion,
          semestre: formModulo.semestre,
        });
        saveActivity(db, currentUser, {
          action: 'EDICIÓN',
          entityType: 'ESTRUCTURA',
          entityName: formModulo.nombre,
          details: `Módulo actualizado en carrera: ${carreraSeleccionada.nombre}`
        });
        toast.success('Módulo actualizado correctamente');
      } else {
        // Crear
        await addDoc(collection(db, 'careers', carreraSeleccionada.id, 'modules'), {
          nombre: formModulo.nombre,
          profesor: formModulo.profesor,
          sabadosSemana: formModulo.sabadosSemana,
          descripcion: formModulo.descripcion,
          semestre: formModulo.semestre,
        });
        saveActivity(db, currentUser, {
          action: 'CREACIÓN',
          entityType: 'ESTRUCTURA',
          entityName: formModulo.nombre,
          details: `Nuevo módulo creado en carrera: ${carreraSeleccionada.nombre} (Semestre ${formModulo.semestre})`
        });
        toast.success('Módulo creado correctamente');
      }
      setFormModulo({ nombre: '', profesor: [], sabadosSemana: 1, descripcion: '', semestre: 1 });
      setModalModulo(false);
      setEditandoModulo(null);
      // Esperar a que Firestore propague el cambio antes de recargar
      setTimeout(() => {
        fetchCarreras();
        if (carreraSeleccionada) refreshCarreraSeleccionada(carreraSeleccionada.id);
      }, 500);
    } catch (e) {
      toast.error('Error al guardar el módulo');
    }
  };

  // Cerrar modal módulo
  const cerrarModalModulo = () => {
    setModalModulo(false);
    setEditandoModulo(null);
    setFormModulo({ nombre: '', profesor: [], sabadosSemana: 1, descripcion: '', semestre: 1 });
  };

  // Guardar seminarios en Firestore
  const handleGuardarSeminarios = async () => {
    if (!carreraSeleccionada) return;
    try {
      const carreraRef = doc(db, 'careers', carreraSeleccionada.id);
      await updateDoc(carreraRef, { seminarios: seminariosEdit });
      saveActivity(db, currentUser, {
        action: 'EDICIÓN',
        entityType: 'ESTRUCTURA',
        entityName: `Seminarios: ${carreraSeleccionada.nombre}`,
        details: `Configuración de seminarios obligatorios actualizada`
      });
      toast.success('Seminarios actualizados');
      setModalSeminarios(false);
      setTimeout(() => {
        fetchCarreras();
        if (carreraSeleccionada) refreshCarreraSeleccionada(carreraSeleccionada.id);
      }, 500);
    } catch (e) {
      toast.error('Error al guardar seminarios');
    }
  };

  // Confirmar eliminación de módulo
  const confirmarEliminacionModulo = (moduloId) => {
    setModuloAEliminar(moduloId);
    setModalConfirmacionModulo(true);
  };

  // Eliminar módulo
  const eliminarModulo = async () => {
    if (moduloAEliminar) {
      const target = carreraSeleccionada.modulos.find(m => m.id === moduloAEliminar);
      await deleteDoc(doc(db, 'careers', carreraSeleccionada.id, 'modules', moduloAEliminar));
      saveActivity(db, currentUser, {
        action: 'ELIMINACIÓN',
        entityType: 'ESTRUCTURA',
        entityName: target?.nombre || 'Módulo',
        details: `Módulo eliminado de la carrera ${carreraSeleccionada.nombre}`
      });
      toast.success('Módulo eliminado correctamente');
      setModalConfirmacionModulo(false);
      setModuloAEliminar(null);
      setTimeout(() => {
        fetchCarreras();
        if (carreraSeleccionada) refreshCarreraSeleccionada(carreraSeleccionada.id);
      }, 500);
    }
  };

  return (
    <div className="p-2 sm:p-4 md:p-8 bg-white min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            <DegreeHat theme="filled" size="36" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">
              Gestión de <span className="text-blue-600">Carreras Técnicas</span>
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Estructura Académica • Atucsara Portal</p>
          </div>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-1 active:scale-95 w-full md:w-auto justify-center"
          onClick={() => setModalCarrera(true)}
        >
          <Add theme="outline" size="20" /> Nueva Carrera
        </button>
      </div>

      {/* Tabs / Navegación */}
      <div className="flex flex-wrap items-center gap-3 mb-10 bg-slate-50 p-2 rounded-3xl border border-slate-100 w-fit">
        <button
          className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
            tab === 'carreras' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
              : 'text-slate-400 hover:bg-white hover:text-blue-600'
          }`}
          onClick={() => setTab('carreras')}
        >
          Lista de Carreras
        </button>
        
        {tab === 'modulos' && carreraSeleccionada && (
          <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 shadow-sm animate-in zoom-in-95 duration-300">
            <Book theme="filled" size="14" />
            <span className="text-[11px] font-black uppercase tracking-widest">
              Módulos: {carreraSeleccionada.nombre}
            </span>
          </div>
        )}
        
        {tab === 'seminarios' && carreraSeleccionada && (
          <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-green-50 text-green-700 border border-green-100 shadow-sm animate-in zoom-in-95 duration-300">
            <Lightning theme="filled" size="14" />
            <span className="text-[11px] font-black uppercase tracking-widest">
              Seminarios: {carreraSeleccionada.nombre}
            </span>
          </div>
        )}
      </div>

      {/* Lista de Carreras — Rediseño Profesional */}
      {tab === 'carreras' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {carreras.map((c) => (
            <div 
              key={c.id} 
              className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group"
            >
              {/* Header de la tarjeta */}
              <div className="p-6 pb-4 flex justify-between items-start border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                    <DegreeHat theme="filled" size="28" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg leading-tight uppercase tracking-tight">
                      {c.nombre}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                        {c.duracion} Semestres
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                        c.estado === 'Activa' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'
                      }`}>
                        {c.estado}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Acciones de administración (Edit/Delete) */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button 
                    onClick={() => handleEditarCarrera(c)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="Editar Carrera"
                  >
                    <Edit theme="outline" size="18" />
                  </button>
                  <button 
                    onClick={() => confirmarEliminacionCarrera(c.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Eliminar Carrera"
                  >
                    <FaTrash size="16" />
                  </button>
                </div>
              </div>

              {/* Cuerpo / Descripción */}
              <div className="p-6 py-5">
                <p className="text-slate-500 text-sm font-medium leading-relaxed line-clamp-2 h-10 mb-4 italic">
                  {c.descripcion || "Sin descripción disponible para esta carrera técnica."}
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Módulos</p>
                    <p className="text-xl font-black text-blue-700">{(c.modulos || []).length}</p>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Seminarios</p>
                    <p className="text-xl font-black text-green-700">{(c.seminarios || []).length}</p>
                  </div>
                </div>
              </div>

              {/* Botones de acción principales */}
              <div className="p-6 pt-0 flex gap-2">
                <button
                  onClick={() => handleVerModulos(c)}
                  className="flex-1 bg-[#23408e] hover:bg-[#1a306d] text-white py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-900/10 hover:shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                >
                  <Book theme="outline" size="16" />
                  Ver Módulos
                </button>
                <button
                  onClick={() => handleVerSeminarios(c)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-green-900/10 hover:shadow-green-900/20 transition-all flex items-center justify-center gap-2"
                >
                  <Lightning theme="outline" size="16" />
                  Seminarios
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vista de Módulos */}
      {tab === 'modulos' && carreraSeleccionada && (
        <div className="grid gap-6">
          <div className="bg-white rounded-lg shadow p-2 sm:p-6 border-t-4 border-green-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold mb-1 text-blue-700 break-words">{carreraSeleccionada.nombre}</h2>
                <p className="text-gray-600 text-xs sm:text-sm">Gestión de módulos por semestre</p>
              </div>
              <button
                className="bg-green-500 hover:bg-blue-700 text-white px-4 sm:px-5 py-2 rounded-md font-semibold flex items-center gap-2 shadow transition-all w-full sm:w-auto text-base"
                onClick={() => { setModalModulo(true); setEditandoModulo(null); setFormModulo({ nombre: '', profesor: [], sabadosSemana: 1, descripcion: '', semestre: 1 }); }}
              >
                <Add theme="outline" size="20" /> Nuevo Módulo
              </button>
            </div>

            {/* Agrupar módulos por semestre */}
            {[...Array(carreraSeleccionada.duracion)].map((_, idx) => {
              const semestre = idx + 1;
              const modulos = carreraSeleccionada.modulos.filter(m => m.semestre === semestre);
              return (
                <div key={semestre} className="bg-white rounded-lg shadow mb-4 border-l-4 border-blue-600 p-2 sm:p-4">
                  <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Book theme="outline" size="22" className="text-blue-600" />
                      <span className="font-bold text-sm sm:text-lg text-blue-700">Semestre {semestre}</span>
                    </div>
                    <span className="ml-0 sm:ml-2 text-xs text-gray-500">{modulos.length} módulos</span>
                  </div>
                  {modulos.length === 0 ? (
                    <div className="text-gray-400 py-2 sm:py-4 text-center text-xs sm:text-base">No hay módulos asignados para este semestre</div>
                  ) : (
                    modulos.map((m) => (
                      <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-2 sm:p-4 mb-2 shadow-sm relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="w-full">
                          <div className="font-bold text-xs sm:text-base text-blue-700 break-words">{m.nombre}</div>
                          <div className="text-xs sm:text-sm text-gray-500 mb-1 flex flex-col sm:flex-row gap-1 sm:gap-2">
                            <span className="font-semibold text-green-600">Profesor:</span> {(Array.isArray(m.profesor) ? m.profesor.join(', ') : m.profesor) || <span className='italic text-gray-400'>Sin asignar</span>} <span className="hidden sm:inline">|</span> <span className="font-semibold text-green-600">{m.sabadosSemana}</span> sábado(s)/mes
                          </div>
                          <div className="text-gray-400 text-xs sm:text-sm break-words">{m.descripcion}</div>
                        </div>
                        <button className="absolute top-2 right-2 sm:static sm:ml-4 p-1 rounded hover:bg-gray-100 transition-all" onClick={() => handleEditarModulo(m)} title="Editar módulo">
                          <Edit theme="outline" size="16" />
                        </button>
                        {/* Botón Eliminar módulo */}
                        <button
                          className="absolute top-2 right-2 sm:static sm:ml-4 p-1 rounded hover:bg-red-100 transition-all text-red-600"
                          title="Eliminar módulo"
                          onClick={() => confirmarEliminacionModulo(m.id)}
                        >
                          <FaTrash size="16" />
                        </button>
                      </div>
                    ))
              )  }
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Vista de Seminarios (Separada) */}
      {tab === 'seminarios' && carreraSeleccionada && (
        <div className="fade-in duration-500">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <SeminariosManager 
              carreraId={carreraSeleccionada.id}
              carreraNombre={carreraSeleccionada.nombre}
              onClose={() => setTab('carreras')}
            />
          </div>
        </div>
      )}

      {/* Modal Nueva Carrera */}
      {modalCarrera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-8 max-w-md w-full relative border-t-4 border-blue-600 mx-2">
            <button
              className="absolute top-2 right-4 text-2xl text-gray-400 hover:text-gray-700 font-bold"
              onClick={() => setModalCarrera(false)}
            >&times;</button>
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-blue-700">{carreraSeleccionada ? 'Actualizar Carrera' : 'Nueva Carrera'}</h2>
            <div className="mb-4">
              <label className="block text-blue-700 mb-1 font-semibold">Nombre</label>
              <input
                className="w-full border border-blue-600 rounded px-3 py-2 mb-2 text-xs sm:text-base focus:ring-2 focus:ring-green-500"
                placeholder="Nombre de la carrera"
                value={formCarrera.nombre}
                onChange={e => setFormCarrera({ ...formCarrera, nombre: e.target.value })}
              />
              <label className="block text-blue-700 mb-1 font-semibold">Descripción</label>
              <textarea
                className="w-full border border-blue-600 rounded px-3 py-2 mb-2 text-xs sm:text-base focus:ring-2 focus:ring-green-500"
                placeholder="Descripción de la carrera"
                value={formCarrera.descripcion}
                onChange={e => setFormCarrera({ ...formCarrera, descripcion: e.target.value })}
              />
              <label className="block text-blue-700 mb-1 font-semibold">Duración (semestres)</label>
              <input
                type="number"
                min={1}
                className="w-full border border-blue-600 rounded px-3 py-2 text-xs sm:text-base focus:ring-2 focus:ring-green-500"
                value={formCarrera.duracion}
                onChange={e => setFormCarrera({ ...formCarrera, duracion: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                className="px-4 py-2 bg-gray-100 rounded-md text-xs sm:text-base hover:bg-gray-200"
                onClick={() => setModalCarrera(false)}
              >Cancelar</button>
              <button
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-xs sm:text-base shadow"
                onClick={carreraSeleccionada ? guardarEdicionCarrera : handleCrearCarrera}
                disabled={!formCarrera.nombre}
              >{carreraSeleccionada ? 'Actualizar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Módulo */}
      {modalModulo && carreraSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-8 max-w-md w-full relative border-t-4 border-green-500 mx-2">
            <button
              className="absolute top-2 right-4 text-2xl text-gray-400 hover:text-gray-700 font-bold"
              onClick={cerrarModalModulo}
            >&times;</button>
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-green-600">{editandoModulo ? 'Editar Módulo' : 'Nuevo Módulo'}</h2>
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-blue-700 mb-1 font-semibold">Nombre del módulo</label>
                <input
                  className="w-full border border-green-500 rounded px-3 py-2 mb-2 text-xs sm:text-base focus:ring-2 focus:ring-blue-600"
                  placeholder="Nombre del módulo"
                  value={formModulo.nombre}
                  onChange={e => setFormModulo({ ...formModulo, nombre: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-blue-700 mb-1 font-semibold">Semestre</label>
                <select
                  className="w-full border border-green-500 rounded px-3 py-2 mb-2 text-xs sm:text-base focus:ring-2 focus:ring-blue-600"
                  value={formModulo.semestre}
                  onChange={e => setFormModulo({ ...formModulo, semestre: Number(e.target.value) })}
                >
                  {[...Array(carreraSeleccionada.duracion)].map((_, idx) => (
                    <option key={idx + 1} value={idx + 1}>Semestre {idx + 1}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-blue-700 mb-1 font-semibold">Profesores Asignados</label>
                <div className="flex flex-wrap gap-2 mb-2 p-2 border border-gray-300 rounded-md min-h-[40px]">
                  {formModulo.profesor.map(pName => (
                    <div key={pName} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-2 text-sm">
                      <span>{pName}</span>
                      <button
                        type="button"
                        className="text-blue-600 hover:text-blue-800 font-bold"
                        onClick={() => setFormModulo(prev => ({ ...prev, profesor: prev.profesor.filter(name => name !== pName) }))}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  {formModulo.profesor.length === 0 && <span className="text-gray-400 italic">Ningún profesor asignado</span>}
                </div>

                <label className="block text-blue-700 mb-1 font-semibold">Añadir Profesor</label>
                <select
                  className="w-full border border-green-500 rounded px-3 py-2 text-xs sm:text-base focus:ring-2 focus:ring-blue-600"
                  value=""
                  onChange={e => {
                    const selectedTeacher = e.target.value;
                    if (selectedTeacher && !formModulo.profesor.includes(selectedTeacher)) {
                      setFormModulo(prev => ({ ...prev, profesor: [...prev.profesor, selectedTeacher] }));
                    }
                  }}
                >
                  <option value="">-- Seleccionar para añadir --</option>
                  {profesores
                    .filter(p => {
                      const fullName = `${p.name} ${p.lastName || ''}`.trim();
                      return !formModulo.profesor.includes(fullName);
                    })
                    .map(p => {
                      const fullName = `${p.name} ${p.lastName || ''}`.trim();
                      return <option key={p.id} value={fullName}>{fullName}</option>
                    })}
                </select>
              </div>
              <div>
                <label className="block text-blue-700 mb-1 font-semibold">Sábados por mes</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-green-500 rounded px-3 py-2 mb-2 text-xs sm:text-base focus:ring-2 focus:ring-blue-600"
                  value={formModulo.sabadosSemana}
                  onChange={e => setFormModulo({ ...formModulo, sabadosSemana: Number(e.target.value) })}
                  placeholder="Cantidad de sábados por mes"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-blue-700 mb-1 font-semibold">Descripción</label>
                <textarea
                  className="w-full border border-green-500 rounded px-3 py-2 text-xs sm:text-base focus:ring-2 focus:ring-blue-600"
                  placeholder="Descripción del módulo"
                  value={formModulo.descripcion}
                  onChange={e => setFormModulo({ ...formModulo, descripcion: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                className="px-4 py-2 bg-gray-100 rounded-md text-xs sm:text-base hover:bg-gray-200"
                onClick={cerrarModalModulo}
              >Cancelar</button>
              <button
                className="px-4 py-2 bg-green-500 hover:bg-blue-700 text-white rounded-md font-semibold text-xs sm:text-base shadow"
                onClick={handleCrearModulo}
                disabled={!formModulo.nombre}
              >{editandoModulo ? 'Actualizar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}


      {/* Modal edición seminarios LEGACY (mantenido para compatibilidad) */}
      {modalSeminarios && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-8 max-w-2xl w-full relative border-t-4 border-green-600 mx-2">
            <button
              className="absolute top-2 right-4 text-2xl text-gray-400 hover:text-gray-700 font-bold"
              onClick={() => setModalSeminarios(false)}
            >&times;</button>
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-green-700">Editar seminarios obligatorios</h2>
            <div className="overflow-x-auto">
              <table className="min-w-[400px] w-full text-xs sm:text-base border rounded-lg">
                <thead>
                  <tr className="bg-green-100 text-green-900">
                    <th className="py-2 px-2 text-left font-semibold">Nombre</th>
                    <th className="py-2 px-2 text-center font-semibold">Profesor</th>
                    <th className="py-2 px-2 text-center font-semibold">Horas</th>
                    <th className="py-2 px-2 text-center font-semibold">Semestre</th>
                    <th className="py-2 px-2 text-center font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {seminariosEdit.map((s, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-2 px-2">
                        <input
                          className="w-full border border-green-300 rounded px-2 py-1 text-xs sm:text-base"
                          value={s.nombre}
                          onChange={e => {
                            const arr = [...seminariosEdit];
                            arr[idx].nombre = e.target.value;
                            setSeminariosEdit(arr);
                          }}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1">
                          <select
                            className="w-full border border-green-300 rounded px-2 py-1 text-xs sm:text-base"
                            value={profesores.some(p => (p.name + ' ' + (p.lastName || '')) === s.profesor) ? s.profesor : ''}
                            onChange={e => {
                              const arr = [...seminariosEdit];
                              arr[idx].profesor = e.target.value;
                              // Buscar email del profesor seleccionado
                              const profObj = profesores.find(p => (p.name + ' ' + (p.lastName || '')) === e.target.value);
                              arr[idx].profesorEmail = profObj ? profObj.email : '';
                              setSeminariosEdit(arr);
                            }}
                          >
                            <option value="">Escribir manualmente</option>
                            {profesores.map(p => (
                              <option key={p.id} value={p.name + ' ' + (p.lastName || '')}>{p.name} {p.lastName}</option>
                            ))}
                          </select>
                          {(!profesores.some(p => (p.name + ' ' + (p.lastName || '')) === s.profesor) || s.profesor === '') && (
                            <input
                              className="w-full border border-green-300 rounded px-2 py-1 text-xs sm:text-base"
                              value={s.profesor}
                              onChange={e => {
                                const arr = [...seminariosEdit];
                                arr[idx].profesor = e.target.value;
                                arr[idx].profesorEmail = '';
                                setSeminariosEdit(arr);
                              }}
                              placeholder="Nombre del profesor"
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={1}
                          className="w-full border border-green-300 rounded px-2 py-1 text-xs sm:text-base"
                          value={s.horas}
                          onChange={e => {
                            const arr = [...seminariosEdit];
                            arr[idx].horas = Number(e.target.value);
                            setSeminariosEdit(arr);
                          }}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min={1}
                          max={carreraSeleccionada?.duracion || 6}
                          className="w-full border border-green-300 rounded px-2 py-1 text-xs sm:text-base"
                          value={s.semestre}
                          onChange={e => {
                            const arr = [...seminariosEdit];
                            arr[idx].semestre = Number(e.target.value);
                            setSeminariosEdit(arr);
                          }}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          className="w-full border border-green-300 rounded px-2 py-1 text-xs sm:text-base"
                          value={s.estado}
                          onChange={e => {
                            const arr = [...seminariosEdit];
                            arr[idx].estado = e.target.value;
                            setSeminariosEdit(arr);
                          }}
                        >
                          <option value="Pendiente">Pendiente</option>
                          <option value="Cursando">Cursando</option>
                          <option value="Aprobado">Aprobado</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
              <button
                className="px-4 py-2 bg-gray-100 rounded-md text-xs sm:text-base hover:bg-gray-200"
                onClick={() => setModalSeminarios(false)}
              >Cancelar</button>
              <button
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold text-xs sm:text-base shadow"
                onClick={handleGuardarSeminarios}
              >Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de confirmación para eliminar carrera */}
      {modalConfirmacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-8 max-w-md w-full relative border-t-4 border-red-600 mx-2">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-red-700">Confirmar Eliminación</h2>
            <p className="text-gray-600 mb-4">¿Estás seguro de que deseas eliminar esta carrera? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button
                className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded-md font-semibold shadow transition-all"
                onClick={eliminarCarrera}
              >Eliminar</button>
              <button
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md font-semibold shadow transition-all"
                onClick={() => setModalConfirmacion(false)}
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de confirmación para eliminar módulo */}
      {modalConfirmacionModulo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-8 max-w-md w-full relative border-t-4 border-red-600 mx-2">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-red-700">Confirmar Eliminación</h2>
            <p className="text-gray-600 mb-4">¿Estás seguro de que deseas eliminar este módulo? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button
                className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded-md font-semibold shadow transition-all"
                onClick={eliminarModulo}
              >Eliminar</button>
              <button
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md font-semibold shadow transition-all"
                onClick={() => setModalConfirmacionModulo(false)}
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VistaCarreras;