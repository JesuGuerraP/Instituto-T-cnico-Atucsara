import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { toast } from 'react-toastify';

// Componente minimalista y responsivo para gestionar cursos cortos
// Colección Firestore: courses
//  - Campos: nombre, descripcion, duracionMeses, valorTotal, valorMatricula, estado, createdAt
//  - Subcolección: modules (nombre, precio, horas)
//  - Campo opcional en curso: students: [{ id, name }]

const VistaCursos = () => {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('cursos');
  const [cursos, setCursos] = useState([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState(null);
  const [modalCurso, setModalCurso] = useState(false);
  const [modalModulo, setModalModulo] = useState(false);
  const [modalAsignar, setModalAsignar] = useState(false);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [formCurso, setFormCurso] = useState({
    nombre: '',
    descripcion: '',
    duracionMeses: 1,
    valorTotal: 0,
    valorMatricula: 0,
    estado: 'Activo'
  });

  const [formModulo, setFormModulo] = useState({
    nombre: '',
    precio: 0,
    horas: 0,
    profesorId: '',
    profesorNombre: ''
  });
  const [editandoModulo, setEditandoModulo] = useState(null);

  const [asignaciones, setAsignaciones] = useState([]); // [{id, name}]
  const [studentFilter, setStudentFilter] = useState('');
  // Asignación de estudiantes a módulo del curso
  const [modalAsignarModulo, setModalAsignarModulo] = useState(false);
  const [moduloParaAsignar, setModuloParaAsignar] = useState(null); // {id, nombre}
  const [moduleAssignedIds, setModuleAssignedIds] = useState([]); // IDs seleccionados
  const [moduleAssignedIdsOrig, setModuleAssignedIdsOrig] = useState([]); // IDs originales
  const [moduleStudentFilter, setModuleStudentFilter] = useState('');

  const valorTotalFmt = useMemo(() => Number(formCurso.valorTotal || 0).toLocaleString(), [formCurso.valorTotal]);
  const valorMatriculaFmt = useMemo(() => Number(formCurso.valorMatricula || 0).toLocaleString(), [formCurso.valorMatricula]);

  const filteredStudents = useMemo(() => {
    const q = studentFilter.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s => {
      const name = `${s.name || ''} ${s.lastName || ''} ${s.email || ''}`.toLowerCase();
      const dni = (s.dni || '').toLowerCase();
      return name.includes(q) || dni.includes(q);
    });
  }, [students, studentFilter]);

  const fetchCursos = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'courses'));
      const arr = [];
      for (const c of snap.docs) {
        const data = c.data();
        const modsSnap = await getDocs(collection(db, 'courses', c.id, 'modules'));
        const modules = modsSnap.docs.map(m => ({ id: m.id, ...m.data() }));
        arr.push({ id: c.id, ...data, modules });
      }
      setCursos(arr);
    } catch (e) {
      console.error('Error cargando cursos:', e);
      toast.error('No se pudieron cargar los cursos');
    } finally {
      setLoading(false);
    }
  };

  const refreshCursoSeleccionado = async (cursoId) => {
    if (!cursoId) return;
    const docSnap = await getDoc(doc(db, 'courses', cursoId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      const modsSnap = await getDocs(collection(db, 'courses', cursoId, 'modules'));
      const modules = modsSnap.docs.map(m => ({ id: m.id, ...m.data() }));
      setCursoSeleccionado({ id: cursoId, ...data, modules });
      setAsignaciones(Array.isArray(data.students) ? data.students : []);
    }
  };

  useEffect(() => {
    fetchCursos();
    // cargar estudiantes para asignar
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'students'));
        setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Error cargando estudiantes:', e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'teachers'));
        setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Error cargando profesores:', e);
      }
    })();
  }, []);

  const abrirNuevoCurso = () => {
    setCursoSeleccionado(null);
    setFormCurso({ nombre: '', descripcion: '', duracionMeses: 1, valorTotal: 0, valorMatricula: 0, estado: 'Activo' });
    setModalCurso(true);
  };

  const guardarCurso = async () => {
    try {
      if (cursoSeleccionado) {
        await updateDoc(doc(db, 'courses', cursoSeleccionado.id), formCurso);
        toast.success('Curso actualizado');
      } else {
        await addDoc(collection(db, 'courses'), { ...formCurso, createdAt: new Date().toISOString() });
        toast.success('Curso creado');
      }
      setModalCurso(false);
      setTimeout(fetchCursos, 300);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar el curso');
    }
  };

  const editarCurso = (curso) => {
    setCursoSeleccionado(curso);
    setFormCurso({
      nombre: curso.nombre || '',
      descripcion: curso.descripcion || '',
      duracionMeses: curso.duracionMeses || 1,
      valorTotal: Number(curso.valorTotal || 0),
      valorMatricula: Number(curso.valorMatricula || 0),
      estado: curso.estado || 'Activo'
    });
    setModalCurso(true);
  };

  const eliminarCurso = async (cursoId) => {
    if (!window.confirm('¿Eliminar curso?')) return;
    try {
      await deleteDoc(doc(db, 'courses', cursoId));
      toast.success('Curso eliminado');
      setTimeout(fetchCursos, 300);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo eliminar el curso');
    }
  };

  const abrirModulos = (curso) => {
    setCursoSeleccionado(curso);
    setTab('modulos');
  };

  const guardarModulo = async () => {
    if (!cursoSeleccionado) return;
    try {
      if (editandoModulo) {
        await updateDoc(doc(db, 'courses', cursoSeleccionado.id, 'modules', editandoModulo), formModulo);
        toast.success('Módulo actualizado');
      } else {
        await addDoc(collection(db, 'courses', cursoSeleccionado.id, 'modules'), formModulo);
        toast.success('Módulo creado');
      }
      setFormModulo({ nombre: '', precio: 0, horas: 0, profesorId: '', profesorNombre: '' });
      setEditandoModulo(null);
      setModalModulo(false);
      setTimeout(() => refreshCursoSeleccionado(cursoSeleccionado.id), 300);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar el módulo');
    }
  };

  const eliminarModulo = async (moduloId) => {
    if (!cursoSeleccionado) return;
    if (!window.confirm('¿Eliminar módulo del curso?')) return;
    try {
      await deleteDoc(doc(db, 'courses', cursoSeleccionado.id, 'modules', moduloId));
      toast.success('Módulo eliminado');
      setTimeout(() => refreshCursoSeleccionado(cursoSeleccionado.id), 300);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo eliminar el módulo');
    }
  };

  // Abrir modal para asignar estudiantes a un módulo
  const abrirAsignarModulo = async (modulo) => {
    if (!cursoSeleccionado) return;
    setModuloParaAsignar(modulo);
    setModuleStudentFilter('');
    try {
      const snap = await getDocs(collection(db, 'courses', cursoSeleccionado.id, 'modules', modulo.id, 'students'));
      const ids = snap.docs.map(d => d.id);
      setModuleAssignedIds(ids);
      setModuleAssignedIdsOrig(ids);
    } catch (e) {
      console.error('Error cargando estudiantes del módulo:', e);
      setModuleAssignedIds([]);
      setModuleAssignedIdsOrig([]);
    }
    setModalAsignarModulo(true);
  };

  const toggleAsignacionModulo = (studentId) => {
    setModuleAssignedIds(prev => prev.includes(studentId)
      ? prev.filter(id => id !== studentId)
      : [...prev, studentId]
    );
  };

  const guardarAsignacionesModulo = async () => {
    if (!cursoSeleccionado || !moduloParaAsignar) return;
    try {
      const toAdd = moduleAssignedIds.filter(id => !moduleAssignedIdsOrig.includes(id));
      const toRemove = moduleAssignedIdsOrig.filter(id => !moduleAssignedIds.includes(id));
      // Agregar
      for (const sid of toAdd) {
        const st = (cursoSeleccionado.students || asignaciones || []).find(s => s.id === sid) || {};
        await setDoc(doc(db, 'courses', cursoSeleccionado.id, 'modules', moduloParaAsignar.id, 'students', sid), {
          id: sid,
          name: st.name || '',
          assignedAt: new Date().toISOString()
        });
      }
      // Eliminar
      for (const sid of toRemove) {
        await deleteDoc(doc(db, 'courses', cursoSeleccionado.id, 'modules', moduloParaAsignar.id, 'students', sid));
      }
      setModuleAssignedIdsOrig(moduleAssignedIds);
      toast.success('Asignaciones de módulo actualizadas');
      setModalAsignarModulo(false);
    } catch (e) {
      console.error('Error guardando asignaciones de módulo:', e);
      toast.error('No se pudieron guardar las asignaciones del módulo');
    }
  };

  const abrirAsignar = async (curso) => {
    setCursoSeleccionado(curso);
    // cargar asignaciones actuales del curso
    await refreshCursoSeleccionado(curso.id);
    setModalAsignar(true);
  };

  const toggleAsignacion = (student) => {
    const exists = asignaciones.some(s => s.id === student.id);
    if (exists) {
      setAsignaciones(prev => prev.filter(s => s.id !== student.id));
    } else {
      setAsignaciones(prev => [...prev, { id: student.id, name: `${student.name} ${student.lastName || ''}`.trim() }]);
    }
  };

  const guardarAsignaciones = async () => {
    if (!cursoSeleccionado) return;
    try {
      // Guardar arreglo en el curso
      await updateDoc(doc(db, 'courses', cursoSeleccionado.id), { students: asignaciones });
      // Actualizar estudiantes con el id del curso en un array courses
      const allStudentsSnap = await getDocs(collection(db, 'students'));
      const byId = new Map(allStudentsSnap.docs.map(d => [d.id, d.data()]));
      const asignadosSet = new Set(asignaciones.map(a => a.id));

      // Para cada estudiante, si está en asignaciones lo agregamos; si no, lo removemos
      const updates = [];
      for (const sDoc of allStudentsSnap.docs) {
        const sid = sDoc.id;
        const data = byId.get(sid) || {};
        const currentCourses = Array.isArray(data.courses) ? data.courses : [];
        const hasCourse = currentCourses.includes(cursoSeleccionado.id);
        if (asignadosSet.has(sid) && !hasCourse) {
          updates.push(updateDoc(doc(db, 'students', sid), { courses: [...currentCourses, cursoSeleccionado.id] }));
        } else if (!asignadosSet.has(sid) && hasCourse) {
          updates.push(updateDoc(doc(db, 'students', sid), { courses: currentCourses.filter(c => c !== cursoSeleccionado.id) }));
        }
      }
      await Promise.all(updates);
      toast.success('Asignaciones guardadas');
      setModalAsignar(false);
    } catch (e) {
      console.error(e);
      toast.error('No se pudieron guardar las asignaciones');
    }
  };

  return (
    <div className="p-4 md:p-8 bg-white rounded-lg shadow">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Cursos</h1>
          <p className="text-gray-600 text-sm">Administra cursos cortos, módulos y estudiantes inscritos</p>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-semibold"
          onClick={abrirNuevoCurso}
        >Nuevo Curso</button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          className={`px-3 py-2 rounded-lg border text-sm ${tab === 'cursos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-gray-200 hover:bg-blue-50'}`}
          onClick={() => setTab('cursos')}
        >Lista de Cursos</button>
        {tab === 'modulos' && cursoSeleccionado && (
          <button className="px-3 py-2 rounded-lg border text-sm bg-blue-600 text-white border-blue-600" disabled>
            Módulos - {cursoSeleccionado.nombre}
          </button>
        )}
      </div>

      {/* Lista de cursos */}
      {tab === 'cursos' && (
        <div className="bg-white rounded-lg border-t-4 border-blue-600 shadow p-3 overflow-x-auto">
          {loading ? (
            <div className="text-gray-500">Cargando...</div>
          ) : cursos.length === 0 ? (
            <div className="text-gray-400 py-6 text-center">No hay cursos registrados.</div>
          ) : (
            <table className="min-w-[600px] w-full text-sm">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="py-2 px-2 text-left font-semibold">Curso</th>
                  <th className="py-2 px-2 text-left font-semibold">Descripción</th>
                  <th className="py-2 px-2 text-center font-semibold">Duración</th>
                  <th className="py-2 px-2 text-center font-semibold">Matrícula</th>
                  <th className="py-2 px-2 text-center font-semibold">Total</th>
                  <th className="py-2 px-2 text-center font-semibold">Estudiantes</th>
                  <th className="py-2 px-2 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cursos.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-blue-50">
                    <td className="py-2 px-2 font-semibold text-blue-700 whitespace-nowrap">{c.nombre}</td>
                    <td className="py-2 px-2 text-gray-600 max-w-[280px] truncate">{c.descripcion}</td>
                    <td className="py-2 px-2 text-center">{c.duracionMeses} meses</td>
                    <td className="py-2 px-2 text-center">${Number(c.valorMatricula || 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-center">${Number(c.valorTotal || 0).toLocaleString()}</td>
                    <td className="py-2 px-2 text-center">{Array.isArray(c.students) ? c.students.length : 0}</td>
                    <td className="py-2 px-2">
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button className="px-2 py-1 border rounded text-blue-700 hover:bg-gray-50 text-xs" onClick={() => abrirModulos(c)}>Módulos</button>
                        <button className="px-2 py-1 border rounded text-green-700 hover:bg-green-50 text-xs" onClick={() => abrirAsignar(c)}>Asignar</button>
                        <button className="px-2 py-1 border rounded text-yellow-600 hover:bg-yellow-50 text-xs" onClick={() => editarCurso(c)}>Editar</button>
                        <button className="px-2 py-1 border rounded text-red-600 hover:bg-red-50 text-xs" onClick={() => eliminarCurso(c.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Módulos del curso */}
      {tab === 'modulos' && cursoSeleccionado && (
        <div className="bg-white rounded-lg border-t-4 border-green-500 shadow p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <h2 className="text-lg font-bold text-blue-700">{cursoSeleccionado.nombre}</h2>
              <p className="text-xs text-gray-500">Gestión de módulos del curso</p>
            </div>
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded text-sm"
              onClick={() => { setModalModulo(true); setEditandoModulo(null); setFormModulo({ nombre: '', precio: 0, horas: 0, profesorId: '', profesorNombre: '' }); }}
            >Nuevo Módulo</button>
          </div>
          {cursoSeleccionado.modules?.length === 0 ? (
            <div className="text-gray-400 py-4 text-center">No hay módulos en este curso</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[500px] w-full text-sm">
                <thead>
                  <tr className="bg-green-50 text-green-900">
                    <th className="py-2 px-2 text-left font-semibold">Nombre</th>
                    <th className="py-2 px-2 text-center font-semibold">Precio</th>
                    <th className="py-2 px-2 text-center font-semibold">Horas</th>
                    <th className="py-2 px-2 text-center font-semibold">Profesor</th>
                    <th className="py-2 px-2 text-center font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cursoSeleccionado.modules.map(m => (
                    <tr key={m.id} className="border-b">
                      <td className="py-2 px-2 font-semibold text-blue-700">{m.nombre}</td>
                      <td className="py-2 px-2 text-center">${Number(m.precio || 0).toLocaleString()}</td>
                      <td className="py-2 px-2 text-center">{m.horas}</td>
                      <td className="py-2 px-2 text-center">{m.profesorNombre || '—'}</td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex gap-2 justify-center">
                          <button className="px-2 py-1 border rounded text-yellow-600 hover:bg-yellow-50 text-xs" onClick={() => { setEditandoModulo(m.id); setFormModulo({ nombre: m.nombre, precio: Number(m.precio || 0), horas: Number(m.horas || 0), profesorId: m.profesorId || '', profesorNombre: m.profesorNombre || '' }); setModalModulo(true); }}>Editar</button>
                          <button className="px-2 py-1 border rounded text-red-600 hover:bg-red-50 text-xs" onClick={() => eliminarModulo(m.id)}>Eliminar</button>
                          <button className="px-2 py-1 border rounded text-blue-600 hover:bg-blue-50 text-xs" onClick={() => abrirAsignarModulo(m)}>Asignar Estudiantes</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Curso */}
      {modalCurso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full relative border-t-4 border-blue-600">
            <button className="absolute top-2 right-3 text-2xl text-gray-400 hover:text-gray-700 font-bold" onClick={() => setModalCurso(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-4 text-blue-700">{cursoSeleccionado ? 'Editar Curso' : 'Nuevo Curso'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-blue-700">Nombre</label>
                <input className="w-full border rounded px-3 py-2" value={formCurso.nombre} onChange={e => setFormCurso({ ...formCurso, nombre: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-blue-700">Descripción</label>
                <textarea className="w-full border rounded px-3 py-2" value={formCurso.descripcion} onChange={e => setFormCurso({ ...formCurso, descripcion: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-700">Duración (meses)</label>
                <input type="number" min={1} className="w-full border rounded px-3 py-2" value={formCurso.duracionMeses} onChange={e => setFormCurso({ ...formCurso, duracionMeses: Number(e.target.value || 1) })} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-700">Matrícula</label>
                <input type="number" min={0} className="w-full border rounded px-3 py-2" value={formCurso.valorMatricula} onChange={e => setFormCurso({ ...formCurso, valorMatricula: Number(e.target.value || 0) })} />
                <div className="text-xs text-gray-500 mt-1">${valorMatriculaFmt}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-700">Total del curso</label>
                <input type="number" min={0} className="w-full border rounded px-3 py-2" value={formCurso.valorTotal} onChange={e => setFormCurso({ ...formCurso, valorTotal: Number(e.target.value || 0) })} />
                <div className="text-xs text-gray-500 mt-1">${valorTotalFmt}</div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-700">Estado</label>
                <select className="w-full border rounded px-3 py-2" value={formCurso.estado} onChange={e => setFormCurso({ ...formCurso, estado: e.target.value })}>
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="px-4 py-2 border rounded" onClick={() => setModalCurso(false)}>Cancelar</button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold" onClick={guardarCurso}>
                {cursoSeleccionado ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Módulo */}
      {modalModulo && cursoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative border-t-4 border-green-600">
            <button className="absolute top-2 right-3 text-2xl text-gray-400 hover:text-gray-700 font-bold" onClick={() => setModalModulo(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-4 text-green-700">{editandoModulo ? 'Editar Módulo' : 'Nuevo Módulo'}</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-semibold text-blue-700">Nombre</label>
                <input className="w-full border rounded px-3 py-2" value={formModulo.nombre} onChange={e => setFormModulo({ ...formModulo, nombre: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-700">Precio</label>
                <input type="number" min={0} className="w-full border rounded px-3 py-2" value={formModulo.precio} onChange={e => setFormModulo({ ...formModulo, precio: Number(e.target.value || 0) })} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-700">Horas</label>
                <input type="number" min={0} className="w-full border rounded px-3 py-2" value={formModulo.horas} onChange={e => setFormModulo({ ...formModulo, horas: Number(e.target.value || 0) })} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-700">Profesor</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={formModulo.profesorId || ''}
                  onChange={e => {
                    const profesorId = e.target.value;
                    const t = teachers.find(tt => tt.id === profesorId);
                    setFormModulo({ ...formModulo, profesorId, profesorNombre: t ? `Prof. ${t.name || ''} ${t.lastName || ''}`.trim() : '' });
                  }}
                >
                  <option value="">Selecciona un profesor</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{`Prof. ${t.name || ''} ${t.lastName || ''}`.trim()}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="px-4 py-2 border rounded" onClick={() => setModalModulo(false)}>Cancelar</button>
              <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold" onClick={guardarModulo}>
                {editandoModulo ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Asignar Estudiantes */}
      {modalAsignar && cursoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full relative border-t-4 border-blue-600 max-h-[85vh] overflow-y-auto">
            <button className="absolute top-2 right-3 text-2xl text-gray-400 hover:text-gray-700 font-bold" onClick={() => setModalAsignar(false)}>&times;</button>
            <h3 className="text-lg font-bold mb-4 text-blue-700">Asignar estudiantes a {cursoSeleccionado.nombre}</h3>
            <div className="mb-3">
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Buscar estudiante por nombre, email o DNI..."
                value={studentFilter}
                onChange={e => setStudentFilter(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredStudents.map(s => {
                const checked = asignaciones.some(a => a.id === s.id);
                return (
                  <label key={s.id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50">
                    <input type="checkbox" checked={checked} onChange={() => toggleAsignacion(s)} />
                    <span className="text-sm">{s.name} {s.lastName || ''}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="px-4 py-2 border rounded" onClick={() => setModalAsignar(false)}>Cancelar</button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold" onClick={guardarAsignaciones}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    {/* Modal Asignar Estudiantes a Módulo */}
    {modalAsignarModulo && cursoSeleccionado && moduloParaAsignar && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full relative border-t-4 border-green-600 max-h-[85vh] overflow-y-auto">
          <button className="absolute top-2 right-3 text-2xl text-gray-400 hover:text-gray-700 font-bold" onClick={() => setModalAsignarModulo(false)}>&times;</button>
          <h3 className="text-lg font-bold mb-4 text-green-700">Asignar estudiantes al módulo: {moduloParaAsignar.nombre}</h3>
          <div className="mb-3">
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Buscar estudiante por nombre..."
              value={moduleStudentFilter}
              onChange={e => setModuleStudentFilter(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(asignaciones || []).filter(s => (s.name || '').toLowerCase().includes(moduleStudentFilter.trim().toLowerCase())).map(s => {
              const checked = moduleAssignedIds.includes(s.id);
              return (
                <label key={s.id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50">
                  <input type="checkbox" checked={checked} onChange={() => toggleAsignacionModulo(s.id)} />
                  <span className="text-sm">{s.name}</span>
                </label>
              );
            })}
            {(!asignaciones || asignaciones.length === 0) && (
              <div className="text-gray-400 text-sm">No hay estudiantes asignados al curso.</div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button className="px-4 py-2 border rounded" onClick={() => setModalAsignarModulo(false)}>Cancelar</button>
            <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold" onClick={guardarAsignacionesModulo}>Guardar</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default VistaCursos;
