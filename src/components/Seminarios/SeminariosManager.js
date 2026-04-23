import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, doc, getDoc, updateDoc, addDoc,
  query, where, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { saveActivity } from '../../utils/activityLogger';
import { toast } from 'react-toastify';

/* ══════════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════════ */
const ESTADO_BADGE = {
  aprobado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  pendiente: 'bg-amber-50 text-amber-700 border-amber-300',
};
const estadoBadge = (e) =>
  ESTADO_BADGE[e?.toLowerCase()] ?? 'bg-gray-100 text-gray-500 border-gray-300';

/* ──────────────────────────────────────────────────────────────
   Confirmación inline (evita múltiples popups nativos)
────────────────────────────────────────────────────────────── */
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 border-t-4 border-amber-400">
      <p className="text-slate-700 font-semibold text-base mb-6 leading-relaxed">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition">Cancelar</button>
        <button onClick={onConfirm} className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm transition shadow-sm">Confirmar</button>
      </div>
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════ */
const SeminariosManager = ({ carreraId, carreraNombre, onClose }) => {
  const { currentUser } = useAuth();

  /* ── State ── */
  const [activeTab, setActiveTab] = useState('configurar');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Datos de la carrera
  const [carreraData, setCarreraData] = useState(null);
  const [seminarios, setSeminarios]   = useState([]); // array de seminarios de la carrera
  const [profesores, setProfesores]   = useState([]);

  // Estudiantes de la carrera
  const [allStudents, setAllStudents]       = useState([]);
  const [allCareers, setAllCareers]         = useState([]);

  // Modal asignación
  const [assignModal, setAssignModal]         = useState(false);
  const [assignSeminario, setAssignSeminario] = useState('');  // índice string
  const [assignCareers, setAssignCareers]     = useState([]); // carreras seleccionadas (multi)
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);

  // Control de estado
  const [controlCareer, setControlCareer]   = useState(carreraId || '');
  const [controlSemIdx, setControlSemIdx]   = useState('');
  const [controlStudents, setControlStudents] = useState([]);
  const [selectedControlStudents, setSelectedControlStudents] = useState([]); // para revocación masiva

  // Confirm dialog
  const [confirm, setConfirm] = useState(null); // { message, onConfirm }

  /* ── Carga inicial ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Profesores
      const profSnap = await getDocs(collection(db, 'teachers'));
      setProfesores(profSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Todas las carreras (para asignación multi-carrera)
      const careersSnap = await getDocs(collection(db, 'careers'));
      const careersArr = careersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllCareers(careersArr);

      // Carrera actual
      if (carreraId) {
        const carreraDoc = await getDoc(doc(db, 'careers', carreraId));
        if (carreraDoc.exists()) {
          const data = carreraDoc.data();
          setCarreraData(data);
          setSeminarios(
            (data.seminarios || []).map((s, idx) => ({
              ...s,
              _idx: idx,
              id: s.id || `seminario${idx + 1}`,
            }))
          );
        }
      }

      // Todos los estudiantes (para asignación y control)
      const studSnap = await getDocs(collection(db, 'students'));
      setAllStudents(
        studSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => s.status === 'active')
      );
    } catch (e) {
      console.error(e);
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, [carreraId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Guardar configuración de seminarios de la carrera ── */
  const handleGuardarSeminarios = async () => {
    setSaving(true);
    try {
      const toSave = seminarios.map(s => ({
        nombre: s.nombre || '',
        profesor: s.profesor || '',
        profesorEmail: s.profesorEmail || '',
        horas: s.horas || 20,
        semestre: s.semestre || 1,
        estado: s.estado || 'Activo',
        id: s.id,
      }));
      await updateDoc(doc(db, 'careers', carreraId), { seminarios: toSave });
      saveActivity(db, currentUser, {
        action: 'EDICIÓN',
        entityType: 'ESTRUCTURA',
        entityName: `Seminarios: ${carreraNombre}`,
        details: `Configuración de seminarios actualizada`,
      });
      toast.success('Seminarios guardados correctamente');
      fetchData();
    } catch (e) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  /* ── Abrir modal de asignación ── */
  const openAssignModal = (semIdx) => {
    setAssignSeminario(String(semIdx));
    setAssignCareers([carreraId]);
    setSelectedStudents([]);
    setAssignModal(true);
  };

  /* ── Calcular estudiantes elegibles cuando cambia selección en el modal ── */
  useEffect(() => {
    if (!assignModal) return;
    const sem = seminarios[Number(assignSeminario)];
    if (!sem) { setEligibleStudents([]); return; }

    // Carreras seleccionadas
    const selectedCareerNames = allCareers
      .filter(c => assignCareers.includes(c.id))
      .map(c => c.nombre);

    const elig = allStudents.filter(s => {
      if (!selectedCareerNames.includes(s.career)) return false;
      // Si ya está aprobado en este seminario → no incluir (ya está listo)
      const estSem = Array.isArray(s.seminarios)
        ? s.seminarios.find(ss => ss.id === sem.id || ss.nombre === sem.nombre)
        : null;
      return estSem?.estado?.toLowerCase() !== 'aprobado';
    });
    setEligibleStudents(elig);
  }, [assignModal, assignSeminario, assignCareers, allStudents, seminarios, allCareers]);

  /* ── Asignar aprobación (guardar en students.seminarios) ── */
  const handleAsignarAprobacion = async () => {
    if (!selectedStudents.length) return;
    setSaving(true);
    const sem = seminarios[Number(assignSeminario)];

    try {
      const promises = selectedStudents.map(async (sid) => {
        const studentRef = doc(db, 'students', sid);
        const studentSnap = await getDoc(studentRef);
        if (!studentSnap.exists()) return;
        
        const studentData = studentSnap.data();
        let semsEst = Array.isArray(studentData.seminarios) ? [...studentData.seminarios] : [];
        
        const existIdx = semsEst.findIndex(ss => ss.id === sem.id || ss.nombre === sem.nombre);

        const newEntry = {
          id: sem.id || `seminario${Number(assignSeminario) + 1}`,
          nombre: sem.nombre,
          semestre: sem.semestre,
          profesor: sem.profesor || '',
          horas: sem.horas || 20,
          estado: 'aprobado',
          aprobadoPor: currentUser?.uid || '',
          fechaAprobacion: new Date().toISOString(),
        };

        if (existIdx >= 0) {
          semsEst[existIdx] = { ...semsEst[existIdx], ...newEntry };
        } else {
          semsEst.push(newEntry);
        }

        await updateDoc(studentRef, { seminarios: semsEst });
      });

      await Promise.all(promises);

      saveActivity(db, currentUser, {
        action: 'ASIGNACIÓN',
        entityType: 'SEMINARIO',
        entityName: sem.nombre,
        details: `Aprobación registrada para ${selectedStudents.length} estudiante(s)`,
      });

      toast.success(`✅ Aprobación registrada para ${selectedStudents.length} estudiante(s)`);
      setAssignModal(false);
      setSelectedStudents([]);
      fetchData(); 
    } catch (e) {
      console.error('Error en asignación masiva:', e);
      toast.error('Ocurrió un error al guardar la asignación en la base de datos');
    } finally {
      setSaving(false);
    }
  };

  /* ── Cargar estudiantes para el panel de control ── */
  useEffect(() => {
    if (activeTab !== 'control') return;
    const carrera = allCareers.find(c => c.id === controlCareer);
    if (!carrera) { setControlStudents([]); return; }

    const sem = (carrera.seminarios || [])[Number(controlSemIdx)];
    if (!sem && controlSemIdx !== '') { setControlStudents([]); return; }

    const students = allStudents.filter(s => s.career === carrera.nombre);
    setControlStudents(students);
  }, [controlCareer, controlSemIdx, allStudents, allCareers, activeTab]);

  /* ── Revocar aprobación (soporta masivo si se pasa array) ── */
  const handleRevocarAprobacion = (students, semEntry) => {
    const isMasivo = Array.isArray(students);
    const targetStudents = isMasivo ? students : [students];
    const names = isMasivo ? `${targetStudents.length} estudiantes` : `${targetStudents[0].name} ${targetStudents[0].lastName || ''}`;

    setConfirm({
      message: `¿Revocar la aprobación de "${semEntry.nombre}" para ${names}? El estado pasará a PENDIENTE.`,
      onConfirm: async () => {
        setConfirm(null);
        setSaving(true);
        try {
          const promises = targetStudents.map(async (st) => {
            const studentRef = doc(db, 'students', st.id);
            const studentSnap = await getDoc(studentRef);
            if (!studentSnap.exists()) return;

            const studentData = studentSnap.data();
            let modificado = false;
            const updatedSems = (studentData.seminarios || []).map(ss => {
              if (ss.id === semEntry.id || ss.nombre === semEntry.nombre) {
                modificado = true;
                return { ...ss, estado: 'pendiente', aprobadoPor: '', fechaAprobacion: '' };
              }
              return ss;
            });

            if (modificado) {
              await updateDoc(studentRef, { seminarios: updatedSems });
            }
          });

          await Promise.all(promises);

          saveActivity(db, currentUser, {
            action: 'EDICIÓN',
            entityType: 'SEMINARIO',
            entityName: semEntry.nombre,
            details: `Aprobación revocada para ${targetStudents.length} estudiante(s)`,
          });

          toast.success(`Revocación completada exitosamente (${targetStudents.length})`);
          setSelectedControlStudents([]);
          fetchData();
        } catch (e) { 
          console.error('Error en revocación masiva:', e);
          toast.error('Error al guardar la revocación en la base de datos'); 
        } finally {
          setSaving(false);
        }
      },
    });
  };

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-green-700 font-bold text-sm">Cargando datos de seminarios...</p>
    </div>
  );

  const TABS = [
    { id: 'configurar', label: '⚙️ Configurar', title: 'Configurar seminarios de la carrera' },
    { id: 'asignar',    label: '✅ Asignar',    title: 'Registrar participación de estudiantes' },
    { id: 'control',    label: '🔍 Control',    title: 'Auditar estados por carrera y seminario' },
  ];

  return (
    <div className="flex flex-col gap-0 h-full">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-black text-green-800">Gestión de Seminarios</h2>
          <p className="text-sm text-gray-500 mt-0.5">{carreraNombre}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-2xl text-gray-300 hover:text-gray-600 font-bold transition">×</button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 px-6 pt-4 pb-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            title={t.title}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === t.id
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          TAB: CONFIGURAR
      ══════════════════════════════════════════ */}
      {activeTab === 'configurar' && (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 font-semibold">
              Define los seminarios de <strong>{carreraNombre}</strong>. Los estudiantes inician siempre en estado <span className="text-amber-600 font-bold">Pendiente</span>.
            </p>
            <button
              onClick={() => {
                const n = seminarios.length + 1;
                setSeminarios(prev => [...prev, {
                  _idx: prev.length,
                  id: `seminario${n}`,
                  nombre: `Seminario ${numToRoman(n)}`,
                  profesor: '', profesorEmail: '',
                  horas: 20, semestre: 1, estado: 'Activo',
                }]);
              }}
              className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 border border-green-200 transition whitespace-nowrap"
            >
              + Agregar
            </button>
          </div>

          {seminarios.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm font-semibold border-2 border-dashed border-gray-200 rounded-2xl">
              No hay seminarios configurados para esta carrera.
            </div>
          )}

          {seminarios.map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-green-700 uppercase tracking-wider">Seminario #{i + 1}</span>
                <button
                  onClick={() => setSeminarios(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-600 text-xs font-bold transition"
                >
                  Eliminar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nombre</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-400 focus:border-transparent"
                    value={s.nombre}
                    onChange={e => {
                      const arr = [...seminarios];
                      arr[i] = { ...arr[i], nombre: e.target.value };
                      setSeminarios(arr);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Semestre</label>
                  <input
                    type="number" min={1} max={carreraData?.duracion || 6}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-400"
                    value={s.semestre}
                    onChange={e => {
                      const arr = [...seminarios];
                      arr[i] = { ...arr[i], semestre: Number(e.target.value) };
                      setSeminarios(arr);
                    }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">Profesor</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-400"
                    value={s.profesor || ''}
                    onChange={e => {
                      const arr = [...seminarios];
                      const pObj = profesores.find(p => `${p.name} ${p.lastName || ''}`.trim() === e.target.value);
                      arr[i] = { ...arr[i], profesor: e.target.value, profesorEmail: pObj?.email || '' };
                      setSeminarios(arr);
                    }}
                  >
                    <option value="">Sin asignar</option>
                    {profesores.map(p => {
                      const fn = `${p.name} ${p.lastName || ''}`.trim();
                      return <option key={p.id} value={fn}>{fn}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Horas</label>
                  <input
                    type="number" min={1}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-400"
                    value={s.horas}
                    onChange={e => {
                      const arr = [...seminarios];
                      arr[i] = { ...arr[i], horas: Number(e.target.value) };
                      setSeminarios(arr);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {seminarios.length > 0 && (
            <div className="flex justify-end pt-2">
              <button
                disabled={saving}
                onClick={handleGuardarSeminarios}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm shadow transition disabled:opacity-60"
              >
                {saving ? 'Guardando...' : '💾 Guardar Seminarios'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: ASIGNAR
      ══════════════════════════════════════════ */}
      {activeTab === 'asignar' && (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs text-amber-700 font-semibold leading-relaxed">
              <strong>Regla de participación:</strong> Solo hay 2 estados — <span className="text-emerald-700 font-black">Aprobado</span> (participó) y <span className="text-amber-700 font-black">Pendiente</span> (no participó). Selecciona el seminario y marca quiénes lo aprobaron.
            </p>
          </div>

          {seminarios.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm font-semibold border-2 border-dashed border-gray-200 rounded-2xl">
              Primero configura los seminarios de esta carrera.
            </div>
          )}

          {seminarios.length > 0 && (
            <div className="grid gap-4">
              {seminarios.map((s, i) => {
                // Contar aprobados de esta carrera
                const studentsCarrera = allStudents.filter(st => {
                  const carrera = allCareers.find(c => c.id === carreraId);
                  return st.career === carrera?.nombre;
                });
                const aprobados = studentsCarrera.filter(st => {
                  const semEst = (st.seminarios || []).find(ss => ss.id === s.id || ss.nombre === s.nombre);
                  return semEst?.estado === 'aprobado';
                }).length;

                return (
                  <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:shadow-md transition">
                    <div>
                      <p className="font-black text-green-800 text-base">{s.nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Semestre {s.semestre} · {s.horas}h · {s.profesor || 'Sin profesor'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                          ✓ {aprobados} aprobados
                        </span>
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                          ⏳ {studentsCarrera.length - aprobados} pendientes
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => openAssignModal(i)}
                      className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm shadow transition whitespace-nowrap"
                    >
                      Registrar Aprobación
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: CONTROL
      ══════════════════════════════════════════ */}
      {activeTab === 'control' && (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs text-blue-700 font-semibold">
              Audita el estado de cada seminario por carrera. Puedes revocar aprobaciones incorrectas.
            </p>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-400"
              value={controlCareer}
              onChange={e => { setControlCareer(e.target.value); setControlSemIdx(''); }}
            >
              <option value="">Seleccionar carrera...</option>
              {allCareers.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <select
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-400"
              value={controlSemIdx}
              onChange={e => setControlSemIdx(e.target.value)}
              disabled={!controlCareer}
            >
              <option value="">Todos los seminarios</option>
              {(allCareers.find(c => c.id === controlCareer)?.seminarios || []).map((s, i) => (
                <option key={i} value={String(i)}>{s.nombre}</option>
              ))}
            </select>
          </div>

          {/* Tabla de control */}
          {controlCareer && (() => {
            const carrera = allCareers.find(c => c.id === controlCareer);
            const carrerasSems = carrera?.seminarios || [];
            const semsToShow = controlSemIdx !== ''
              ? [{ sem: carrerasSems[Number(controlSemIdx)], i: Number(controlSemIdx) }]
              : carrerasSems.map((s, i) => ({ sem: s, i }));

            if (!carrera) return null;
            if (semsToShow.length === 0) return (
              <div className="text-center py-12 text-gray-400 text-sm font-semibold">
                Esta carrera no tiene seminarios configurados.
              </div>
            );

            return semsToShow.map(({ sem, i }) => {
              if (!sem) return null;
              const studentsCarrera = controlStudents.filter(s => s.career === carrera.nombre);

              return (
                <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 flex items-center justify-between">
                    <span className="text-white font-black text-sm">{sem.nombre || `Seminario ${i + 1}`}</span>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-black text-blue-100 bg-white/20 px-2 py-0.5 rounded-full border border-white/20">
                        Sem. {sem.semestre}
                      </span>
                      <span className="text-[10px] font-black text-blue-100 bg-white/20 px-2 py-0.5 rounded-full border border-white/20">
                        {studentsCarrera.filter(st => {
                          const ss = (st.seminarios || []).find(s => s.id === sem.id || s.nombre === sem.nombre);
                          return ss?.estado === 'aprobado';
                        }).length}/{studentsCarrera.length} aprobados
                      </span>
                    </div>
                  </div>

                  {studentsCarrera.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-xs font-semibold">
                      No hay estudiantes activos en esta carrera.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase w-48">
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox"
                                  className="accent-blue-600"
                                  onChange={e => {
                                    if (e.target.checked) {
                                      const approved = studentsCarrera.filter(st => {
                                        const ss = (st.seminarios || []).find(s => s.id === sem.id || s.nombre === sem.nombre);
                                        return ss?.estado === 'aprobado';
                                      });
                                      setSelectedControlStudents(approved.map(s => s.id));
                                    } else {
                                      setSelectedControlStudents([]);
                                    }
                                  }}
                                  checked={selectedControlStudents.length > 0 && selectedControlStudents.length === studentsCarrera.filter(st => {
                                    const ss = (st.seminarios || []).find(s => s.id === sem.id || s.nombre === sem.nombre);
                                    return ss?.estado === 'aprobado';
                                  }).length}
                                />
                                {selectedControlStudents.length > 0 && (
                                  <button
                                    onClick={() => {
                                      const targetSts = controlStudents.filter(s => selectedControlStudents.includes(s.id));
                                      handleRevocarAprobacion(targetSts, { ...sem, id: sem.id || `seminario${Number(controlSemIdx) + 1}` });
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-lg transition-all animate-in zoom-in-95 duration-200"
                                  >
                                    Revocar {selectedControlStudents.length} seleccionados
                                  </button>
                                )}
                              </div>
                            </th>
                            <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase">Estudiante</th>
                            <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase text-center">Período</th>
                            <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase text-center">Estado</th>
                            <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase text-center">Aprobado por</th>
                            <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {studentsCarrera.sort((a, b) => {
                            // Aprobados primero
                            const aS = (a.seminarios || []).find(s => s.id === sem.id || s.nombre === sem.nombre);
                            const bS = (b.seminarios || []).find(s => s.id === sem.id || s.nombre === sem.nombre);
                            const aA = aS?.estado === 'aprobado' ? 0 : 1;
                            const bA = bS?.estado === 'aprobado' ? 0 : 1;
                            return aA - bA;
                          }).map(st => {
                            const semEst = (st.seminarios || []).find(
                              ss => ss.id === sem.id || ss.nombre === sem.nombre
                            );
                            const estado = semEst?.estado || 'pendiente';

                            return (
                              <tr key={st.id} className="hover:bg-gray-50/60 transition">
                                <td className="px-4 py-3">
                                  {estado === 'aprobado' && (
                                    <input 
                                      type="checkbox"
                                      className="accent-blue-600 mr-3"
                                      checked={selectedControlStudents.includes(st.id)}
                                      onChange={e => setSelectedControlStudents(prev => 
                                        e.target.checked ? [...prev, st.id] : prev.filter(x => x !== st.id)
                                      )}
                                    />
                                  )}
                                  <p className="font-bold text-slate-800 text-sm">{st.name} {st.lastName || ''}</p>
                                  <p className="text-[10px] text-gray-400">Sem. {st.semester}</p>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                    {st.period || '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-black border ${estadoBadge(estado)}`}>
                                    {estado === 'aprobado' ? '✓ Aprobado' : '⏳ Pendiente'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {semEst?.aprobadoPor ? (
                                    <span className="text-[10px] text-gray-500">
                                      {semEst.fechaAprobacion
                                        ? new Date(semEst.fechaAprobacion).toLocaleDateString('es-CO')
                                        : '—'}
                                    </span>
                                  ) : <span className="text-gray-300 text-[10px]">—</span>}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {estado === 'aprobado' ? (
                                    <button
                                      onClick={() => handleRevocarAprobacion(st, { ...sem, id: sem.id || `seminario${i + 1}` })}
                                      className="text-[10px] font-black text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
                                    >
                                      Revocar
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setAssignSeminario(String(i));
                                        setAssignCareers([controlCareer]);
                                        setSelectedStudents([st.id]);
                                        setAssignModal(true);
                                      }}
                                      className="text-[10px] font-black text-emerald-600 hover:text-emerald-800 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition"
                                    >
                                      Aprobar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            });
          })()}

          {/* Acción flotante para revocación masiva */}
          {selectedControlStudents.length > 1 && (
            <div className="sticky bottom-4 left-0 right-0 flex justify-center animate-in slide-in-from-bottom-2 duration-300 pointer-events-none">
              <div className="bg-white border-2 border-red-100 shadow-2xl rounded-2xl p-4 flex items-center gap-6 pointer-events-auto">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Acción Masiva</p>
                  <p className="text-sm font-bold text-red-600">{selectedControlStudents.length} seleccionados para revocar</p>
                </div>
                <button
                  onClick={() => {
                    const carrera = allCareers.find(c => c.id === controlCareer);
                    const sem = (carrera?.seminarios || [])[Number(controlSemIdx) || 0]; 
                    // Si controlSemIdx es '' (todos), necesitamos saber a qué seminario revocar.
                    // Para simplificar, la revocación masiva solo habilitada cuando hay un seminario específico seleccionado O enviamos el objeto correcto
                    if (controlSemIdx === '') {
                       toast.info('Selecciona un seminario específico para revocar masivamente');
                       return;
                    }
                    const targetSts = controlStudents.filter(s => selectedControlStudents.includes(s.id));
                    handleRevocarAprobacion(targetSts, { ...sem, id: sem.id || `seminario${Number(controlSemIdx) + 1}` });
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-200 transition-all active:scale-95"
                >
                  Revocación Masiva
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL: ASIGNAR APROBACIÓN
      ══════════════════════════════════════════ */}
      {assignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 border-t-4 border-green-500 max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-green-800 text-lg">Registrar Aprobación</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {seminarios[Number(assignSeminario)]?.nombre}
                </p>
              </div>
              <button onClick={() => { setAssignModal(false); setSelectedStudents([]); }} className="text-2xl text-gray-300 hover:text-gray-600 font-bold transition">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* Multi-carrera */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Carreras incluidas</label>
                <div className="flex flex-wrap gap-2">
                  {allCareers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setAssignCareers(prev =>
                        prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                      )}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                        assignCareers.includes(c.id)
                          ? 'bg-green-600 text-white border-green-600 shadow-sm'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de estudiantes elegibles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">
                    Estudiantes Elegibles ({eligibleStudents.length})
                  </label>
                  <button
                    className="text-xs font-bold text-green-700 hover:underline"
                    onClick={() => setSelectedStudents(eligibleStudents.map(s => s.id))}
                  >
                    Seleccionar todos
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-50">
                  {eligibleStudents.length === 0 && (
                    <div className="py-6 text-center text-gray-400 text-xs font-semibold">
                      No hay estudiantes pendientes en las carreras seleccionadas.
                    </div>
                  )}
                  {eligibleStudents.map(st => (
                    <label key={st.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 cursor-pointer transition">
                      <input
                        type="checkbox"
                        className="accent-green-600"
                        checked={selectedStudents.includes(st.id)}
                        onChange={e => setSelectedStudents(prev =>
                          e.target.checked ? [...prev, st.id] : prev.filter(x => x !== st.id)
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{st.name} {st.lastName || ''}</p>
                        <p className="text-[10px] text-gray-400">{st.career} · Sem. {st.semester} · {st.period || '—'}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Ya seleccionados */}
              {selectedStudents.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-black text-emerald-700">
                    {selectedStudents.length} estudiante{selectedStudents.length !== 1 ? 's' : ''} recibirá{selectedStudents.length !== 1 ? 'n' : ''} aprobación ✓
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setAssignModal(false); setSelectedStudents([]); }}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition"
              >
                Cancelar
              </button>
              <button
                disabled={selectedStudents.length === 0 || saving}
                onClick={handleAsignarAprobacion}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm shadow transition disabled:opacity-60"
              >
                {saving ? 'Guardando...' : `✅ Registrar Aprobación (${selectedStudents.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Utilidad: número a romano ── */
function numToRoman(n) {
  const vals = [10,9,5,4,1];
  const syms = ['X','IX','V','IV','I'];
  let res = '';
  vals.forEach((v, i) => { while (n >= v) { res += syms[i]; n -= v; } });
  return res;
}

export default SeminariosManager;
