import { useState, useEffect } from 'react';
import { DegreeHat, Edit, Add, Book } from '@icon-park/react';
import { FaTrash } from 'react-icons/fa';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const VistaCarreras = () => {
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
  const [formModulo, setFormModulo] = useState({ nombre: '', profesor: '', sabadosSemana: 1, descripcion: '', semestre: 1 });
  const [editandoModulo, setEditandoModulo] = useState(null);
  // Estado para seminarios obligatorios
  const [modalSeminarios, setModalSeminarios] = useState(false);
  const [seminariosEdit, setSeminariosEdit] = useState([
    { nombre: 'Seminario I', profesor: '', horas: 20, semestre: 1, estado: 'Activo' },
    { nombre: 'Seminario II', profesor: '', horas: 20, semestre: 2, estado: 'Activo' },
    { nombre: 'Seminario III', profesor: '', horas: 20, semestre: 3, estado: 'Activo' },
    { nombre: 'Seminario IV', profesor: '', horas: 20, semestre: 4, estado: 'Activo' },
  ]);

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
  }, []);

  // Cargar seminarios de la carrera seleccionada
  useEffect(() => {
    if (carreraSeleccionada && carreraSeleccionada.seminarios) {
      setSeminariosEdit(carreraSeleccionada.seminarios);
    } else if (carreraSeleccionada) {
      setSeminariosEdit([
        { nombre: 'Seminario I', profesor: '', horas: 20, semestre: 1, estado: 'Activo' },
        { nombre: 'Seminario II', profesor: '', horas: 20, semestre: 2, estado: 'Activo' },
        { nombre: 'Seminario III', profesor: '', horas: 20, semestre: 3, estado: 'Activo' },
        { nombre: 'Seminario IV', profesor: '', horas: 20, semestre: 4, estado: 'Activo' },
      ]);
    }
  }, [carreraSeleccionada]);

  // Sincronizar estados de seminarios en estudiantes cuando se edita en la carrera
  useEffect(() => {
    if (!carreraSeleccionada || !carreraSeleccionada.seminarios) return;
    const actualizarSeminariosEstudiantes = async () => {
      // Buscar estudiantes de la carrera
      const estudiantesSnap = await getDocs(collection(db, 'students'));
      const estudiantes = estudiantesSnap.docs.filter(doc => doc.data().career === carreraSeleccionada.nombre);
      for (const est of estudiantes) {
        let seminariosEst = Array.isArray(est.data().seminarios) ? [...est.data().seminarios] : [];
        // Actualizar o agregar cada seminario de la carrera
        carreraSeleccionada.seminarios.forEach((sem, idx) => {
          const id = `seminario${idx+1}`;
          const existente = seminariosEst.find(s => s.id === id);
          if (existente) {
            existente.nombre = sem.nombre;
            existente.profesor = sem.profesor;
            existente.horas = sem.horas;
            existente.semestre = sem.semestre;
            existente.estado = sem.estado?.toLowerCase();
          } else {
            seminariosEst.push({ id, nombre: sem.nombre, profesor: sem.profesor, horas: sem.horas, semestre: sem.semestre, estado: sem.estado?.toLowerCase() });
          }
        });
        await updateDoc(doc(db, 'students', est.id), { seminarios: seminariosEst });
      }
    };
    actualizarSeminariosEstudiantes();
  }, [carreraSeleccionada?.seminarios]);

  // Abrir módulos de una carrera
  const handleVerModulos = (carrera) => {
    setCarreraSeleccionada(carrera);
    setTab('modulos');
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
      toast.success('Carrera creada correctamente');
      setFormCarrera({ nombre: '', descripcion: '', duracion: 6 });
      setModalCarrera(false);
      // Esperar a que Firestore propague el cambio antes de recargar
      setTimeout(fetchCarreras, 500);
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
      await deleteDoc(doc(db, 'careers', carreraAEliminar));
      toast.success('Carrera eliminada correctamente');
      setModalConfirmacion(false);
      setCarreraAEliminar(null);
      fetchCarreras();
    }
  };

  // Editar módulo: abre modal y carga datos
  const handleEditarModulo = (modulo) => {
    setFormModulo({ ...modulo });
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
        toast.success('Módulo creado correctamente');
      }
      setFormModulo({ nombre: '', profesor: '', sabadosSemana: 1, descripcion: '', semestre: 1 });
      setModalModulo(false);
      setEditandoModulo(null);
      // Esperar a que Firestore propague el cambio antes de recargar
      setTimeout(fetchCarreras, 500);
    } catch (e) {
      toast.error('Error al guardar el módulo');
    }
  };

  // Cerrar modal módulo
  const cerrarModalModulo = () => {
    setModalModulo(false);
    setEditandoModulo(null);
    setFormModulo({ nombre: '', profesor: '', sabadosSemana: 1, descripcion: '', semestre: 1 });
  };

  // Guardar seminarios en Firestore
  const handleGuardarSeminarios = async () => {
    if (!carreraSeleccionada) return;
    try {
      const carreraRef = doc(db, 'careers', carreraSeleccionada.id);
      await updateDoc(carreraRef, { seminarios: seminariosEdit });
      toast.success('Seminarios actualizados');
      setModalSeminarios(false);
      setTimeout(fetchCarreras, 500);
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
      await deleteDoc(doc(db, 'careers', carreraSeleccionada.id, 'modules', moduloAEliminar));
      toast.success('Módulo eliminado correctamente');
      setModalConfirmacionModulo(false);
      setModuloAEliminar(null);
      fetchCarreras();
    }
  };

  return (
    <div className="p-2 sm:p-4 md:p-8 bg-white min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="w-full md:w-auto">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <DegreeHat theme="outline" size="32" className="text-blue-600" />
            Gestión de Carreras
          </h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">Administra las carreras técnicas, sus módulos y profesores asignados</p>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-5 py-2 rounded-md font-semibold flex items-center gap-2 shadow transition-all w-full md:w-auto text-base sm:text-lg"
          onClick={() => setModalCarrera(true)}
        >
          <Add theme="outline" size="20" /> Nueva Carrera
        </button>
      </div>
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          className={`px-3 py-2 rounded-lg shadow-sm border text-xs sm:text-base ${tab === 'carreras' ? 'bg-blue-600 text-white font-bold border-blue-600' : 'bg-white text-blue-600 border-gray-200 hover:bg-blue-50'}`}
          onClick={() => setTab('carreras')}
        >
          Lista de Carreras
        </button>
        {tab === 'modulos' && carreraSeleccionada && (
          <button
            className="px-3 py-2 rounded-lg shadow-sm border bg-blue-600 text-white font-bold border-blue-600 text-xs sm:text-base"
            disabled
          >
            Módulos - {carreraSeleccionada.nombre}
          </button>
        )}
      </div>
      {/* Lista de Carreras */}
      {tab === 'carreras' && (
        <div className="grid gap-6">
          <div className="bg-white rounded-lg shadow p-2 sm:p-4 border-t-4 border-blue-600 overflow-x-auto">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 mb-4 text-blue-700">
              <DegreeHat theme="outline" size="28" className="text-blue-600" />
              Carreras Técnicas
            </h2>
            <div className="w-full overflow-x-auto">
              <table className="min-w-[500px] sm:min-w-[600px] w-full text-xs sm:text-base border rounded-lg">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="py-2 sm:py-3 px-1 sm:px-2 text-left font-semibold rounded-tl-xl">Carrera</th>
                    <th className="py-2 sm:py-3 px-1 sm:px-2 text-left font-semibold">Descripción</th>
                    <th className="py-2 sm:py-3 px-1 sm:px-2 text-center font-semibold">Duración</th>
                    <th className="py-2 sm:py-3 px-1 sm:px-2 text-center font-semibold">Estado</th>
                    <th className="py-2 sm:py-3 px-1 sm:px-2 text-center font-semibold rounded-tr-xl">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {carreras.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-blue-50 transition-all">
                      <td className="font-bold py-2 px-1 sm:px-2 max-w-[90px] sm:max-w-[120px] truncate text-blue-700">{c.nombre}</td>
                      <td className="max-w-[120px] sm:max-w-[180px] truncate px-1 sm:px-2 text-gray-600">{c.descripcion}</td>
                      <td className="text-center px-1 sm:px-2">{c.duracion} semestres</td>
                      <td className="text-center px-1 sm:px-2">
                        <span className="inline-block bg-green-100 text-green-800 px-2 sm:px-4 py-1 rounded-full text-xs font-semibold shadow">
                          {c.estado}
                        </span>
                      </td>
                      <td className="text-center px-1 sm:px-2">
                        {/* Botón Editar carrera */}
                        <button
                          className="p-1 mr-2 rounded hover:bg-gray-100 transition-all"
                          title="Editar carrera"
                          onClick={() => handleEditarCarrera(c)}
                        >
                          <Edit theme="outline" size="18" />
                        </button>
                        {/* Botón Eliminar carrera */}
                        <button
                          className="p-1 mr-2 rounded hover:bg-red-100 transition-all text-red-600"
                          title="Eliminar carrera"
                          onClick={() => confirmarEliminacionCarrera(c.id)}
                        >
                          <FaTrash size="18" />
                        </button>
                        <button
                          className="bg-blue-50 text-blue-600 px-2 sm:px-3 py-1 rounded font-semibold text-xs sm:text-sm hover:bg-blue-100 transition-all"
                          onClick={() => handleVerModulos(c)}
                        >
                          Ver Módulos
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                onClick={() => { setModalModulo(true); setEditandoModulo(null); setFormModulo({ nombre: '', profesor: '', sabadosSemana: 1, descripcion: '', semestre: 1 }); }}
              >
                <Add theme="outline" size="20" /> Nuevo Módulo
              </button>
            </div>
            {/* Seminarios obligatorios fijos con edición */}
            <div className="mb-8">
              <h3 className="text-base sm:text-lg font-bold text-green-700 mb-2 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <span className="flex items-center gap-2"><Book theme="outline" size="20" className="text-green-600" /> Seminarios obligatorios</span>
                <button
                  className="ml-0 sm:ml-2 mt-2 sm:mt-0 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold hover:bg-green-200 border border-green-300 w-full sm:w-auto"
                  onClick={() => setModalSeminarios(true)}
                >Editar seminarios</button>
              </h3>
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
                    {(carreraSeleccionada?.seminarios || seminariosEdit).map((s, idx) => {
                      let estadoColor = '';
                      switch (s.estado?.toLowerCase()) {
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
                        <tr key={idx} className="border-b">
                          <td className="py-2 px-2 font-semibold text-green-900 break-words max-w-[120px] sm:max-w-none">{s.nombre}</td>
                          <td className="py-2 px-2 text-center break-words max-w-[100px] sm:max-w-none">{s.profesor || <span className='italic text-gray-400'>Sin asignar</span>}</td>
                          <td className="py-2 px-2 text-center">{s.horas}</td>
                          <td className="py-2 px-2 text-center">{s.semestre}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${estadoColor}`}>{s.estado}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                            <span className="font-semibold text-green-600">Profesor:</span> {m.profesor || <span className='italic text-gray-400'>Sin asignar</span>} <span className="hidden sm:inline">|</span> <span className="font-semibold text-green-600">{m.sabadosSemana}</span> sábado/mes
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
                <label className="block text-blue-700 mb-1 font-semibold">Profesor</label>
                <select
                  className="w-full border border-green-500 rounded px-3 py-2 mb-2 text-xs sm:text-base focus:ring-2 focus:ring-blue-600"
                  value={formModulo.profesor}
                  onChange={e => setFormModulo({ ...formModulo, profesor: e.target.value })}
                >
                  <option value="">Sin asignar</option>
                  {profesores.map(p => (
                    <option key={p.id} value={p.name + ' ' + (p.lastName || '')}>{p.name} {p.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-blue-700 mb-1 font-semibold">Sábados por semana</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-green-500 rounded px-3 py-2 mb-2 text-xs sm:text-base focus:ring-2 focus:ring-blue-600"
                  value={formModulo.sabadosSemana}
                  onChange={e => setFormModulo({ ...formModulo, sabadosSemana: Number(e.target.value) })}
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
      {/* Modal edición seminarios */}
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
