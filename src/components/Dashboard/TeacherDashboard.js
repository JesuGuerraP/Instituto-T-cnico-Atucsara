import { useEffect, useState, useContext } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { AuthContext } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { IdCard, Book, Calendar, GoldMedal, User, People } from '@icon-park/react';
import Modal from 'react-modal';
import PaymentReceipt from '../Finance/PaymentReceipt';

// NUEVO: Para seminarios
import { toast } from 'react-toastify';

const TeacherDashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [modulosAsignados, setModulosAsignados] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedModule, setSelectedModule] = useState(null);
  const [estadisticas, setEstadisticas] = useState({
    totalModulos: 0,
    totalEstudiantes: 0,
    totalCarreras: 0,
    sabadosMensuales: 0,
    modulosPorSemestre: {}
  });
  const [pagos, setPagos] = useState([]);
  const [showRecibo, setShowRecibo] = useState(false);
  const [pagoParaRecibo, setPagoParaRecibo] = useState(null);
  const [reciboNumero, setReciboNumero] = useState('');
  const printAreaRef = useState(null);
  const [expandedSemestre, setExpandedSemestre] = useState(null);

  // NUEVO: Seminarios asignados al profesor
  const [seminariosAsignados, setSeminariosAsignados] = useState([]); // [{seminario, carreraId, carreraNombre}]
  const [estudiantesPorSeminario, setEstudiantesPorSeminario] = useState({}); // {seminarioId: [estudiantes]}
  const [showSeminarioModal, setShowSeminarioModal] = useState(false);
  const [selectedSeminario, setSelectedSeminario] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;

      try {
        // Buscar profesor por email o nombre normalizado
        let teacher = null;
        let teachersSnap = await getDocs(collection(db, 'teachers'));
        teachersSnap.forEach(docu => {
          const t = docu.data();
          // Normalizar nombre y apellido
          const fullName = (t.name + ' ' + (t.lastName || '')).trim().toLowerCase().replace(/\s+/g, ' ');
          const userFullName = (currentUser.name + ' ' + (currentUser.lastName || '')).trim().toLowerCase().replace(/\s+/g, ' ');
          if (
            (t.email && t.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            (fullName && userFullName && fullName === userFullName)
          ) {
            teacher = { id: docu.id, ...t };
          }
        });
        setTeacherInfo(teacher);

        if (!teacher) {
          setLoading(false);
          return;
        }

        const teacherFullName = (teacher.name + ' ' + (teacher.lastName || '')).trim();

        // Obtener módulos asignados
        const careersSnap = await getDocs(collection(db, 'careers'));
        let modulos = [];
        let carreras = new Set();
        let sabadosTotales = 0;

        for (const careerDoc of careersSnap.docs) {
          const carrera = careerDoc.data();
          const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
          modulesSnap.forEach(moduleDoc => {
            const modulo = moduleDoc.data();
            let isAssigned = false;

            if (Array.isArray(modulo.profesor)) {
              // New format: array of names. Check if teacher's full name is in the array.
              if (modulo.profesor.map(p => (p || '').trim()).includes(teacherFullName)) {
                isAssigned = true;
              }
            } else if (typeof modulo.profesor === 'string') {
              // Old format: single name string.
              if ((modulo.profesor || '').trim() === teacherFullName) {
                isAssigned = true;
              }
            }

            if (isAssigned) {
              modulos.push({
                id: moduleDoc.id,
                ...modulo,
                carrera: carrera.nombre,
                careerId: careerDoc.id
              });
              carreras.add(carrera.nombre);
              sabadosTotales += parseInt(modulo.sabadosSemana || 0);
            }
          });
        }

        // Incluir módulos generales asignados a este profesor (agregado por semestre, no por carrera)
        try {
          const generalSnap = await getDocs(collection(db, 'generalModules'));
          const generalBySem = new Map(); // key: `${id}::${semester}`
          generalSnap.forEach(gDoc => {
            const gm = gDoc.data();
            const gmProfesor = gm.profesor; // normalmente es ID del profesor
            const matchById = gmProfesor && teacher?.id && gmProfesor === teacher.id;
            const matchByName = typeof gmProfesor === 'string' && gmProfesor.trim() === teacherFullName; // compatibilidad por nombre
            if (matchById || matchByName) {
              (gm.carreraSemestres || []).forEach(cs => {
                const key = `${gDoc.id}::${String(cs.semester)}`;
                if (!generalBySem.has(key)) {
                  generalBySem.set(key, {
                    id: gDoc.id,
                    nombre: gm.nombre + ' (General)',
                    descripcion: gm.descripcion || '',
                    profesor: gmProfesor,
                    semestre: cs.semester,
                    carrera: '', // se setea luego
                    careerId: null,
                    isGeneral: true,
                    sabadosSemana: gm.sabadosSemana || 0,
                    careerList: new Set()
                  });
                }
                const entry = generalBySem.get(key);
                entry.careerList.add(cs.career);
              });
            }
          });
          // Convertir y añadir al arreglo de módulos
          Array.from(generalBySem.values()).forEach(entry => {
            const careersArr = Array.from(entry.careerList);
            careersArr.forEach(c => carreras.add(c));
            entry.careerList = careersArr; // persistir como array para usar en filtros
            entry.carrera = careersArr.length === 1 ? careersArr[0] : `${careersArr.length} carreras`;
            modulos.push(entry);
          });
        } catch (e) {
          console.warn('No se pudieron cargar módulos generales para el docente:', e);
        }

        // Dedupe por id+semestre y fusionar careerList en módulos generales
        const modMap = new Map();
        modulos.forEach(m => {
          const key = `${m.id}::${String(m.semestre || '')}::${m.isGeneral ? 'g' : 's'}`;
          if (!modMap.has(key)) {
            modMap.set(key, { ...m, careerList: Array.isArray(m.careerList) ? [...m.careerList] : m.careerList });
          } else {
            const existing = modMap.get(key);
            if (m.isGeneral) {
              const curr = new Set(Array.isArray(existing.careerList) ? existing.careerList : []);
              const incoming = new Set(Array.isArray(m.careerList) ? m.careerList : []);
              const merged = Array.from(new Set([...curr, ...incoming]));
              existing.careerList = merged;
              existing.carrera = merged.length === 1 ? merged[0] : `${merged.length} carreras`;
              modMap.set(key, existing);
            }
          }
        });
        setModulosAsignados(Array.from(modMap.values()));

        // Obtener estudiantes para estos módulos
        const studentsSnap = await getDocs(collection(db, 'students'));
        const estudiantesFiltrados = studentsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(student => student.status === 'active')
          .filter(student =>
            student.modulosAsignados?.some(m =>
              modulos.some(mod => mod.id === m.id)
            )
          );
        setEstudiantes(estudiantesFiltrados);

        const semesterCounts = modulos.reduce((acc, modulo) => {
          const semestre = modulo.semestre || 'Otro';
          acc[semestre] = (acc[semestre] || 0) + 1;
          return acc;
        }, {});

        // Actualizar estadísticas
        setEstadisticas({
          totalModulos: modulos.length,
          totalEstudiantes: estudiantesFiltrados.length,
          totalCarreras: carreras.size,
          sabadosMensuales: sabadosTotales,
          modulosPorSemestre: semesterCounts
        });

        setLoading(false);
      } catch (error) {
        console.error("Error fetching data: ", error);
        setLoading(false);
      }
    };

    fetchData();

    // Listener para recargar datos cuando la ventana vuelve a tener foco
    window.addEventListener('focus', fetchData);
    return () => window.removeEventListener('focus', fetchData);
  }, [currentUser]);

  // NUEVO: Buscar seminarios asignados al profesor y estudiantes de esos seminarios
  useEffect(() => {
    const fetchSeminariosYEstudiantes = async () => {
      if (!currentUser) return;
      // Buscar carreras
      const careersSnap = await getDocs(collection(db, 'careers'));
      let seminarios = [];
      for (const careerDoc of careersSnap.docs) {
        const carrera = careerDoc.data();
        const carreraId = careerDoc.id;
        (carrera.seminarios || []).forEach((sem, idx) => {
          // Coincidencia por email de profesor
          const profEmail = (sem.profesorEmail || '').trim().toLowerCase();
          const userEmail = (currentUser.email || '').trim().toLowerCase();
          if (profEmail && profEmail === userEmail) {
            seminarios.push({ ...sem, id: `seminario${idx+1}`, carreraId, carreraNombre: carrera.nombre });
          }
        });
      }
      setSeminariosAsignados(seminarios);
      // Buscar estudiantes de cada seminario
      const studentsSnap = await getDocs(collection(db, 'students'));
      const estudiantes = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(student => student.status === 'active');
      let estPorSem = {};
      seminarios.forEach(sem => {
        estPorSem[sem.id] = estudiantes.filter(est =>
          est.career === sem.carreraNombre &&
          Array.isArray(est.seminarios) &&
          est.seminarios.some(s => s.id === sem.id)
        );
      });
      setEstudiantesPorSeminario(estPorSem);
    };
    fetchSeminariosYEstudiantes();
  }, [currentUser]);

  // Cambiar estado de seminario para un estudiante
  const updateSeminarioStatus = async (studentId, seminarioId, newStatus) => {
    try {
      const studentRef = doc(db, 'students', studentId);
      const studentDoc = await getDoc(studentRef);
      if (studentDoc.exists()) {
        const studentData = studentDoc.data();
        const updatedSeminarios = (studentData.seminarios || []).map(sem =>
          sem.id === seminarioId ? { ...sem, estado: newStatus } : sem
        );
        await updateDoc(studentRef, { seminarios: updatedSeminarios });
        setEstudiantesPorSeminario(prev => {
          const nuevo = { ...prev };
          if (nuevo[seminarioId]) {
            nuevo[seminarioId] = nuevo[seminarioId].map(est =>
              est.id === studentId
                ? { ...est, seminarios: updatedSeminarios }
                : est
            );
          }
          return nuevo;
        });
        toast.success('Estado actualizado');
      }
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  useEffect(() => {
    const fetchPagos = async () => {
      if (!currentUser) return;
      // Buscar pagos hechos a este profesor
      const pagosSnap = await getDocs(collection(db, 'payments'));
      const pagosData = pagosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filtrar solo pagos a este profesor
      const pagosFiltrados = pagosData.filter(p => p.category === 'Pago a profesor' && p.teacherId === teacherInfo?.id);
      setPagos(pagosFiltrados);
    };
    if (teacherInfo) fetchPagos();
  }, [teacherInfo, currentUser]);

  // Generar número de recibo (igual que en PaymentManager)
  const generarNumeroRecibo = (pago) => {
    if (!pago?.id) return '';
    const fecha = pago.date ? new Date(pago.date) : new Date();
    return `${fecha.getDate().toString().padStart(2, '0')}${(fecha.getMonth()+1).toString().padStart(2, '0')}-${pago.id.slice(-6)}`;
  };

  const handlePrintModal = () => {
    if (printAreaRef.current) {
      const printContents = printAreaRef.current.innerHTML;
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload();
    }
  };

  const updateModuleStatus = async (studentId, moduleId, newStatus) => {
    try {
      const studentRef = doc(db, 'students', studentId);
      const studentDoc = await getDoc(studentRef);
      if (studentDoc.exists()) {
        const studentData = studentDoc.data();
        const updatedModules = studentData.modulosAsignados.map(mod =>
          mod.id === moduleId ? { ...mod, estado: newStatus } : mod
        );
        await setDoc(studentRef, { ...studentData, modulosAsignados: updatedModules });
        setEstudiantes(prev =>
          prev.map(est =>
            est.id === studentId
              ? { ...est, modulosAsignados: updatedModules }
              : est
          )
        );
      }
    } catch (error) {
      console.error('Error updating module status:', error);
    }
  };

  if (loading) return <div className="p-8">Cargando tu panel...</div>;
  if (!teacherInfo) return <div className="p-8 text-red-600 font-bold">No se encontró información de tu usuario docente. Contacta a administración.</div>;

  const modulosAgrupados = modulosAsignados.reduce((acc, modulo) => {
    const semestreModulo = modulo.semestre || 'Sin Semestre';

    const estudiantesDelModulo = estudiantes.filter(est =>
      est.modulosAsignados?.some(m => m.id === modulo.id) &&
      (
        !modulo.isGeneral
          ? true
          : (
              String(est.semester) === String(modulo.semestre) &&
              (Array.isArray(modulo.careerList) ? modulo.careerList.includes(est.career) : est.career === modulo.carrera)
            )
      )
    );

    const estudiantesPendientes = estudiantesDelModulo.filter(est => {
      const modEst = est.modulosAsignados.find(m => m.id === modulo.id);
      return modEst?.estado === 'pendiente';
    });

    const estudiantesCursando = estudiantesDelModulo.filter(est => {
      const modEst = est.modulosAsignados.find(m => m.id === modulo.id);
      return modEst?.estado === 'cursando';
    });

    const estudiantesAprobados = estudiantesDelModulo.filter(est => {
      const modEst = est.modulosAsignados.find(m => m.id === modulo.id);
      return modEst?.estado === 'aprobado';
    });

    if (!acc[semestreModulo]) {
      acc[semestreModulo] = { cursando: [], pendiente: [], aprobado: [] };
    }

    if (estudiantesPendientes.length > 0 && estudiantesCursando.length === 0 && estudiantesAprobados.length === 0) {
      const instancia = {
        ...modulo,
        idUnico: `${modulo.id}-pendiente`,
        estadoModulo: 'pendiente',
        estudiantes: estudiantesPendientes,
      };
      const exists = acc[semestreModulo].pendiente.some(x => x.id === instancia.id && (x.isGeneral ? 'g' : 's') === (instancia.isGeneral ? 'g' : 's'));
      if (!exists) acc[semestreModulo].pendiente.push(instancia);
    }

    if (estudiantesCursando.length > 0) {
      const instancia = {
        ...modulo,
        idUnico: `${modulo.id}-cursando`,
        estadoModulo: 'cursando',
        estudiantes: estudiantesCursando,
      };
      const exists = acc[semestreModulo].cursando.some(x => x.id === instancia.id && (x.isGeneral ? 'g' : 's') === (instancia.isGeneral ? 'g' : 's'));
      if (!exists) acc[semestreModulo].cursando.push(instancia);
    }

    if (estudiantesAprobados.length > 0) {
      const instancia = {
        ...modulo,
        idUnico: `${modulo.id}-aprobado`,
        estadoModulo: 'aprobado',
        estudiantes: estudiantesAprobados,
      };
      const exists = acc[semestreModulo].aprobado.some(x => x.id === instancia.id && (x.isGeneral ? 'g' : 's') === (instancia.isGeneral ? 'g' : 's'));
      if (!exists) acc[semestreModulo].aprobado.push(instancia);
    }
    
    // Si no hay estudiantes, no se muestra el módulo. Se podría añadir lógica para 'pendiente' si es necesario.

    return acc;
  }, {});

  const modulosEnCurso = Object.values(modulosAgrupados)
    .flatMap(semestre => semestre.cursando);

  const modulosEnCursoPorSemestre = modulosEnCurso.reduce((acc, modulo) => {
    const semestre = modulo.semestre || 'Otro';
    const key = `${modulo.id}::${String(modulo.semestre || '')}::${modulo.isGeneral ? 'g' : 's'}`;
    if (!acc[semestre]) {
      acc[semestre] = { list: [], seen: new Set() };
    }
    if (!acc[semestre].seen.has(key)) {
      acc[semestre].seen.add(key);
      acc[semestre].list.push(modulo);
    }
    return acc;
  }, {});

  const estudiantesPorSemestre = estudiantes.reduce((acc, estudiante) => {
    const semestre = estudiante.semester || 'Otro';
    acc[semestre] = (acc[semestre] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-0 md:p-8 bg-gradient-to-br from-[#f5faff] to-[#e3eafc] min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#23408e] mb-1 tracking-tight drop-shadow-sm">
              ¡Bienvenido, Prof. {teacherInfo?.name} {teacherInfo?.lastName}!
            </h1>
            <p className="text-gray-500 text-base md:text-lg">Panel de control docente</p>
          </div>
          <div className="flex gap-2 mt-2 md:mt-0">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#e3fcec] text-[#009245] font-bold text-sm shadow border border-[#009245]">
              <IdCard theme="outline" size="20" className="mr-1" />
              {teacherInfo?.specialty || 'Especialidad no definida'}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#e3eafc] text-[#23408e] font-bold text-sm shadow border border-[#23408e]">
              Ingreso: {teacherInfo?.createdAt ? new Date(teacherInfo.createdAt).toLocaleDateString('es-CO') : '-'}
            </span>
          </div>
        </div>

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-[#009245] hover:scale-105 transition-transform duration-200">
            <Book theme="outline" size="32" className="mb-2 text-[#009245]" />
            <div className="text-3xl font-extrabold text-[#009245] mb-1">{estadisticas.totalModulos}</div>
            <div className="text-base font-semibold text-gray-700 mb-2">Módulos Asignados</div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {Object.entries(estadisticas.modulosPorSemestre)
                .sort(([semA], [semB]) => semA - semB)
                .map(([semestre, count]) => (
                  <span key={semestre} className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    Sem {semestre}: {count}
                  </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-[#23408e] hover:scale-105 transition-transform duration-200">
            <People theme="outline" size="32" className="mb-2 text-[#23408e]" />
            <div className="text-3xl font-extrabold text-[#23408e] mb-1">{estadisticas.totalEstudiantes}</div>
            <div className="text-base font-semibold text-gray-700 mb-2">Estudiantes Total</div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {Object.entries(estudiantesPorSemestre)
                .sort(([semA], [semB]) => semA - semB)
                .map(([semestre, count]) => (
                  <span key={semestre} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    Sem {semestre}: {count}
                  </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-[#ffd600] hover:scale-105 transition-transform duration-200">
            <GoldMedal theme="outline" size="32" className="mb-2 text-[#ffd600]" />
            <div className="text-lg font-bold text-[#23408e] mb-1 text-center">Carrera Asignada</div>
            <div className="text-base font-semibold text-[#ffd600] text-center">{teacherInfo?.career || 'Sin carrera asignada'}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col border-t-4 border-[#ff9800] hover:scale-105 transition-transform duration-200">
            <div className="flex items-center w-full mb-3">
              <Calendar theme="outline" size="28" className="text-[#ff9800]" />
              <h3 className="text-lg font-bold text-[#23408e] text-center flex-grow">Módulos en Curso</h3>
            </div>
            <div className="w-full space-y-3">
              {(() => {
                if (modulosEnCurso.length === 0) {
                  return <p className="text-sm text-gray-500 text-center py-2">No hay módulos en curso.</p>;
                }

                return Object.entries(modulosEnCursoPorSemestre)
                  .sort(([semA], [semB]) => semA - semB)
                  .map(([semestre, entry]) => (
                    <div key={semestre}>
                      <p className="text-xs font-bold text-gray-500 mb-1">SEMESTRE {semestre}</p>
                      <div className="space-y-2">
                        {entry.list.map(modulo => (
                          <div key={`${modulo.id}-${modulo.semestre}-${modulo.carrera || 'gen'}`} className="p-2 bg-orange-50 rounded-md">
                            <p className="font-semibold text-sm text-orange-800">{modulo.nombre}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-[#23408e]">Acciones Rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to="/dashboard/grades" className="flex items-center p-4 bg-[#e3eafc] rounded-lg hover:bg-[#23408e] hover:text-white transition group">
              <Book theme="outline" size="24" className="mr-3 text-[#23408e] group-hover:text-white" />
              <div>
                <div className="font-semibold">Asignar Notas</div>
                <div className="text-sm opacity-75">Calificar actividades y evaluaciones</div>
              </div>
            </Link>
            <Link to="/dashboard/attendance" className="flex items-center p-4 bg-[#e3fcec] rounded-lg hover:bg-[#009245] hover:text-white transition group">
              <Calendar theme="outline" size="24" className="mr-3 text-[#009245] group-hover:text-white" />
              <div>
                <div className="font-semibold">Registrar Asistencia</div>
                <div className="text-sm opacity-75">Control de asistencia sabatina</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Lista de Módulos Asignados */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-[#23408e] flex items-center gap-2">
            <Book theme="outline" size="22" />
            Módulos Asignados
          </h2>
          <div className="space-y-3">
            {(() => {
              if (modulosAsignados.length === 0) {
                return <p className="text-gray-500 text-center py-4">No tienes módulos asignados actualmente.</p>;
              }

              return Object.keys(modulosAgrupados).sort((a, b) => a - b).map(semestre => (
                <div key={semestre} className="border border-gray-200 rounded-xl overflow-hidden transition-all duration-300">
                  <button
                    onClick={() => setExpandedSemestre(expandedSemestre === semestre ? null : semestre)}
                    className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 focus:outline-none flex justify-between items-center"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-lg text-gray-800">Semestre {semestre}</span>
                      <div className="flex items-center gap-2">
                        {modulosAgrupados[semestre]['cursando'].length > 0 && <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">{modulosAgrupados[semestre]['cursando'].length} Cursando</span>}
                        {modulosAgrupados[semestre]['pendiente'].length > 0 && <span className="px-2.5 py-0.5 bg-gray-200 text-gray-800 rounded-full text-xs font-semibold">{modulosAgrupados[semestre]['pendiente'].length} Pendiente</span>}
                        {modulosAgrupados[semestre]['aprobado'].length > 0 && <span className="px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">{modulosAgrupados[semestre]['aprobado'].length} Aprobado</span>}
                      </div>
                    </div>
                    <svg className={`w-5 h-5 text-gray-500 transform transition-transform duration-300 ${expandedSemestre === semestre ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </button>
                  
                  {expandedSemestre === semestre && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                      {['cursando', 'pendiente', 'aprobado'].flatMap(estado => 
                        modulosAgrupados[semestre][estado].map(modulo => {
                          const statusColors = {
                            aprobado: { border: 'border-green-500', text: 'text-green-800', bg: 'bg-green-50/50' },
                            cursando: { border: 'border-blue-500', text: 'text-blue-700', bg: 'bg-blue-50/50' },
                            pendiente: { border: 'border-gray-400', text: 'text-gray-600', bg: 'bg-gray-50/50' },
                          };
                          const colors = statusColors[modulo.estadoModulo];

                          return (
                            <div
                              key={modulo.idUnico}
                              className={`flex flex-col justify-between p-4 rounded-lg border-l-4 ${colors.border} ${colors.bg} transition-all duration-200 hover:shadow-lg hover:scale-[1.02]`}
                            >
                              <div>
                                <h3 className="font-bold text-lg text-gray-900">{modulo.nombre}</h3>
                                <p className={`text-sm font-semibold ${colors.text}`}>{modulo.carrera}</p>
                                <p className={`text-xs font-bold mt-1 ${colors.text}`}>{modulo.estadoModulo.charAt(0).toUpperCase() + modulo.estadoModulo.slice(1)}</p>
                              </div>
                              <div className="flex justify-between items-center mt-4">
                                <span className="text-xs text-gray-500">{modulo.sabadosSemana || 0} sábados</span>
                                <button
                                  onClick={() => {
                                    setSelectedModule(modulo);
                                    setShowStudentsModal(true);
                                  }}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-white text-[#23408e] rounded-full text-xs font-semibold border border-gray-300 hover:bg-[#e3eafc] hover:border-[#23408e] transition-colors"
                                >
                                  <User theme="outline" size="14" />
                                  <span>Estudiantes ({modulo.estudiantes.length})</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* NUEVO: Seminarios Asignados */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-green-700 flex items-center gap-2">
            <Book theme="outline" size="22" className="text-green-700" />
            Seminarios Asignados
          </h2>
          {seminariosAsignados.length === 0 ? (
            <div className="text-gray-400">No tienes seminarios asignados.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {seminariosAsignados.map((sem) => {
                const estudiantesSem = estudiantesPorSeminario[sem.id] || [];
                let estadoSeminario = 'pendiente';
                const estados = estudiantesSem.map(est => {
                  const semEst = (est.seminarios || []).find(s => s.id === sem.id);
                  return semEst?.estado || 'pendiente';
                });
                if (estados.length > 0) {
                  if (estados.every(e => e === 'aprobado')) {
                    estadoSeminario = 'aprobado';
                  } else if (estados.every(e => e === 'cursando')) {
                    estadoSeminario = 'cursando';
                  } else if (estados.some(e => e === 'pendiente')) {
                    estadoSeminario = 'pendiente';
                  } else if (estados.some(e => e === 'cursando')) {
                    estadoSeminario = 'cursando';
                  }
                }
                const colorBg = {
                  aprobado: 'bg-green-100 border-green-300',
                  cursando: 'bg-blue-100 border-blue-300',
                  pendiente: 'bg-gray-100 border-gray-300',
                }[estadoSeminario];
                const colorBadge = {
                  aprobado: 'bg-green-200 text-green-800',
                  cursando: 'bg-blue-200 text-blue-800',
                  pendiente: 'bg-gray-200 text-gray-800',
                }[estadoSeminario];
                return (
                  <div
                    key={sem.id}
                    className={`border rounded-lg p-4 transition-colors ${colorBg}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-lg text-green-700">{sem.nombre}</h3>
                        <p className="text-sm text-[#009245] font-semibold">Carrera: {sem.carreraNombre}</p>
                        <div className="text-xs text-gray-600">Semestre: {sem.semestre} | Horas: {sem.horas}</div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedSeminario(sem);
                          setShowSeminarioModal(true);
                        }}
                        className="px-3 py-1 bg-green-700 text-white rounded-full text-sm hover:bg-green-900 transition-colors"
                      >
                        Ver Estudiantes
                      </button>
                    </div>
                    <div className={`mt-2 px-2 py-1 rounded-full text-xs font-semibold text-center ${colorBadge}`}>{estadoSeminario.charAt(0).toUpperCase() + estadoSeminario.slice(1)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal de Estudiantes */}
        {showStudentsModal && selectedModule && (
          <Modal
            isOpen={showStudentsModal}
            onRequestClose={() => setShowStudentsModal(false)}
            style={{
              overlay: {
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                zIndex: 1000,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              },
              content: {
                position: 'relative',
                inset: 'auto',
                border: 'none',
                background: 'white',
                overflow: 'auto',
                borderRadius: '0.5rem',
                outline: 'none',
                padding: '2rem',
                width: '90%',
                maxWidth: '72rem',
                maxHeight: '90vh',
              }
            }}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#23408e]">{selectedModule.nombre}</h2>
                <p className="text-[#009245] font-semibold">Carrera: {selectedModule.carrera}</p>
              </div>
              <button
                onClick={() => setShowStudentsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="overflow-y-auto max-h-[60vh]">
              {(() => {
                const estudiantesCursando = (selectedModule.estudiantes || []).filter(est => {
                  const modEst = est.modulosAsignados?.find(m => m.id === selectedModule.id);
                  return modEst && (modEst.estado === 'cursando' || modEst.estado === 'pendiente');
                });

                const estudiantesAprobados = (selectedModule.estudiantes || []).filter(est => 
                  est.modulosAsignados?.some(m => m.id === selectedModule.id && m.estado === 'aprobado')
                );

                return (
                  <>
                    {estudiantesCursando.length > 0 && (
                      <div className="mb-8">
                        <h3 className="text-lg font-bold text-blue-600 mb-2">Estudiantes Cursando</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border rounded-lg text-sm">
                            <thead>
                              <tr className="bg-blue-50">
                                <th className="px-4 py-2 text-left text-blue-800 font-semibold">Nombre</th>
                                <th className="px-4 py-2 text-left text-blue-800 font-semibold">Email</th>
                                <th className="px-4 py-2 text-center text-blue-800 font-semibold">Estado</th>
                                <th className="px-4 py-2 text-center text-blue-800 font-semibold">Acciones</th>
                                <th className="px-4 py-2 text-center text-blue-800 font-semibold">Accesos</th>
                              </tr>
                            </thead>
                            <tbody>
                              {estudiantesCursando.map((estudiante, idx) => (
                                <tr key={estudiante.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/50'}>
                                  <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{estudiante.name} {estudiante.lastName}</td>
                                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{estudiante.email}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold border bg-blue-100 text-blue-800 border-blue-300">Cursando</span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <select
                                      className="px-2 py-1 rounded-full text-xs font-semibold border bg-blue-100 text-blue-800 border-blue-300"
                                      value={estudiante.modulosAsignados.find(m => m.id === selectedModule.id)?.estado || 'cursando'}
                                      onChange={e => updateModuleStatus(estudiante.id, selectedModule.id, e.target.value)}
                                    >
                                      <option value="pendiente">Pendiente</option>
                                      <option value="cursando">Cursando</option>
                                      <option value="aprobado">Aprobado</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex justify-center gap-2">
                                      <Link to={`/dashboard/grades?student=${estudiante.id}&module=${selectedModule.id}`} className="px-3 py-1 bg-[#23408e] text-white rounded-full text-xs hover:bg-blue-700 transition-colors">Calificar</Link>
                                      <Link to={`/dashboard/attendance?student=${estudiante.id}&module=${selectedModule.id}`} className="px-3 py-1 bg-[#009245] text-white rounded-full text-xs hover:bg-green-700 transition-colors">Asistencia</Link>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {estudiantesAprobados.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-green-600 mb-2">Estudiantes Aprobados</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border rounded-lg text-sm">
                            <thead>
                              <tr className="bg-green-50">
                                <th className="px-4 py-2 text-left text-green-800 font-semibold">Nombre</th>
                                <th className="px-4 py-2 text-left text-green-800 font-semibold">Email</th>
                                <th className="px-4 py-2 text-center text-green-800 font-semibold">Estado</th>
                                <th className="px-4 py-2 text-center text-green-800 font-semibold">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {estudiantesAprobados.map((estudiante, idx) => (
                                <tr key={estudiante.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-green-50/50'}>
                                  <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{estudiante.name} {estudiante.lastName}</td>
                                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{estudiante.email}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold border bg-green-100 text-green-800 border-green-300">Aprobado</span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <select
                                      className="px-2 py-1 rounded-full text-xs font-semibold border bg-green-100 text-green-800 border-green-300"
                                      value="aprobado"
                                      onChange={e => updateModuleStatus(estudiante.id, selectedModule.id, e.target.value)}
                                    >
                                      <option value="aprobado">Aprobado</option>
                                      <option value="cursando">Cursando</option>
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowStudentsModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-semibold"
              >
                Cerrar
              </button>
            </div>
          </Modal>
        )}

        {/* NUEVO: Modal de Estudiantes de Seminario */}
        {showSeminarioModal && selectedSeminario && (
          <Modal
            isOpen={showSeminarioModal}
            onRequestClose={() => setShowSeminarioModal(false)}
            className="modal-center max-w-4xl w-full bg-white rounded-lg shadow-lg p-8 border-t-4 border-green-700 animate-fadeIn"
            overlayClassName="overlay-center bg-black bg-opacity-40"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-green-700">{selectedSeminario.nombre}</h2>
                <p className="text-[#009245] font-semibold">Carrera: {selectedSeminario.carreraNombre}</p>
                <div className="text-xs text-gray-600">Semestre: {selectedSeminario.semestre} | Horas: {selectedSeminario.horas}</div>
              </div>
              <button
                onClick={() => setShowSeminarioModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full border rounded-lg text-sm">
                <thead>
                  <tr className="bg-green-100">
                    <th className="px-4 py-2 text-left text-green-700 font-semibold">Nombre</th>
                    <th className="px-4 py-2 text-left text-green-700 font-semibold">Email</th>
                    <th className="px-4 py-2 text-left text-green-700 font-semibold">Teléfono</th>
                    <th className="px-4 py-2 text-center text-green-700 font-semibold">Semestre</th>
                    <th className="px-4 py-2 text-center text-green-700 font-semibold">Estado</th>
                    <th className="px-4 py-2 text-center text-green-700 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(estudiantesPorSeminario[selectedSeminario.id] || []).map((estudiante, idx) => {
                    const semEst = (estudiante.seminarios || []).find(s => s.id === selectedSeminario.id);
                    const estado = semEst?.estado || 'pendiente';
                    let estadoColor = '';
                    switch (estado) {
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
                      <tr key={estudiante.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-green-50'}>
                        <td className="px-4 py-3 font-semibold text-green-900 whitespace-nowrap">{estudiante.name} {estudiante.lastName}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{estudiante.email}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{estudiante.phone || '-'}</td>
                        <td className="px-4 py-3 text-center">{estudiante.semester || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${estadoColor}`}>{estado.charAt(0).toUpperCase() + estado.slice(1)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select
                            className={`px-2 py-1 rounded-full text-xs font-semibold border ${estadoColor}`}
                            value={estado}
                            onChange={e =>
                              updateSeminarioStatus(
                                estudiante.id,
                                selectedSeminario.id,
                                e.target.value
                              )
                            }
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="cursando">Cursando</option>
                            <option value="aprobado">Aprobado</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowSeminarioModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-semibold"
              >
                Cerrar
              </button>
            </div>
          </Modal>
        )}

        {/* SECCIÓN PAGOS AL PROFESOR */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-[#23408e] flex items-center gap-2">
            <span className="inline-block w-6 h-6 bg-[#ffd600] rounded-full mr-2"></span>
            Pagos recibidos
          </h2>
          {pagos.length === 0 ? (
            <div className="text-gray-500">No hay pagos registrados a tu nombre.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[400px] w-full text-sm border rounded-lg">
                <thead>
                  <tr className="bg-blue-50 text-blue-900">
                    <th className="py-2 px-2 text-left font-semibold">Fecha</th>
                    <th className="py-2 px-2 text-left font-semibold">Descripción</th>
                    <th className="py-2 px-2 text-left font-semibold">Monto</th>
                    <th className="py-2 px-2 text-left font-semibold">Estado</th>
                    <th className="py-2 px-2 text-center font-semibold">Recibo</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map(pago => (
                    <tr key={pago.id} className="border-b">
                      <td className="py-2 px-2">{pago.date ? new Date(pago.date).toLocaleDateString() : ''}</td>
                      <td className="py-2 px-2">{pago.description}</td>
                      <td className="py-2 px-2 font-bold text-green-700">${Number(pago.amount).toLocaleString()}</td>
                      <td className="py-2 px-2">{pago.status === 'completed' ? 'Completado' : pago.status === 'pending' ? 'Pendiente' : 'Cancelado'}</td>
                      <td className="py-2 px-2 text-center">
                        <button onClick={() => { setPagoParaRecibo(pago); setReciboNumero(generarNumeroRecibo(pago)); setShowRecibo(true); }} className="border rounded px-2 py-1 text-blue-600 hover:bg-blue-50 text-xs">Imprimir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* MODAL RECIBO */}
        {showRecibo && pagoParaRecibo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 print:bg-transparent">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full relative border-t-4 border-blue-600 print:shadow-none print:border-0 print:p-0 print:rounded-none">
              <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 print:hidden" onClick={() => setShowRecibo(false)}>&times;</button>
              <div ref={printAreaRef}>
                <PaymentReceipt
                  pago={pagoParaRecibo}
                  estudiante={teacherInfo}
                  reciboNumero={reciboNumero}
                />
              </div>
              <div className="flex justify-end mt-6 gap-2 print:hidden">
                <button onClick={() => setShowRecibo(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cerrar</button>
                <button
                  onClick={handlePrintModal}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold"
                >Imprimir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
