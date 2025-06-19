import { useEffect, useState, useContext } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { AuthContext } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { IdCard, Book, Calendar, GoldMedal, User, People } from '@icon-park/react';
import Modal from 'react-modal';
import PaymentReceipt from '../Finance/PaymentReceipt';

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
    sabadosMensuales: 0
  });
  const [pagos, setPagos] = useState([]);
  const [showRecibo, setShowRecibo] = useState(false);
  const [pagoParaRecibo, setPagoParaRecibo] = useState(null);
  const [reciboNumero, setReciboNumero] = useState('');
  const printAreaRef = useState(null);

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

        // Normalizar identificadores para coincidencia de módulos
        const teacherEmails = [teacher.email?.toLowerCase()].filter(Boolean);
        const teacherNames = [
          (teacher.name + ' ' + (teacher.lastName || '')).trim().toLowerCase().replace(/\s+/g, ' '),
          teacher.name?.toLowerCase(),
        ].filter(Boolean);

        // Obtener módulos asignados por email o nombre
        const careersSnap = await getDocs(collection(db, 'careers'));
        let modulos = [];
        let carreras = new Set();
        let sabadosTotales = 0;

        for (const careerDoc of careersSnap.docs) {
          const carrera = careerDoc.data();
          const modulesSnap = await getDocs(collection(db, 'careers', careerDoc.id, 'modules'));
          modulesSnap.forEach(moduleDoc => {
            const modulo = moduleDoc.data();
            // Normalizar campo profesor
            const moduloProfesor = (modulo.profesor || '').trim().toLowerCase().replace(/\s+/g, ' ');
            const moduloProfesorEmail = (modulo.profesorEmail || '').toLowerCase();
            // Coincidencia por email o nombre
            if (
              (moduloProfesor && teacherNames.includes(moduloProfesor)) ||
              (moduloProfesorEmail && teacherEmails.includes(moduloProfesorEmail)) ||
              (teacherEmails.length && modulo.profesor && teacherEmails.includes(modulo.profesor.toLowerCase()))
            ) {
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
        setModulosAsignados(modulos);

        // Obtener estudiantes para estos módulos
        const studentsSnap = await getDocs(collection(db, 'students'));
        const estudiantesFiltrados = studentsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(student =>
            student.modulosAsignados?.some(m =>
              modulos.some(mod => mod.id === m.id)
            )
          );
        setEstudiantes(estudiantesFiltrados);

        // Actualizar estadísticas
        setEstadisticas({
          totalModulos: modulos.length,
          totalEstudiantes: estudiantesFiltrados.length,
          totalCarreras: carreras.size,
          sabadosMensuales: sabadosTotales
        });

        setLoading(false);
      } catch (error) {
        console.error("Error fetching data: ", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

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
            <div className="text-base font-semibold text-gray-700">Módulos Asignados</div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-[#23408e] hover:scale-105 transition-transform duration-200">
            <People theme="outline" size="32" className="mb-2 text-[#23408e]" />
            <div className="text-3xl font-extrabold text-[#23408e] mb-1">{estadisticas.totalEstudiantes}</div>
            <div className="text-base font-semibold text-gray-700">Estudiantes Total</div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-[#ffd600] hover:scale-105 transition-transform duration-200">
            <GoldMedal theme="outline" size="32" className="mb-2 text-[#ffd600]" />
            <div className="text-lg font-bold text-[#23408e] mb-1 text-center">Carrera Asignada</div>
            <div className="text-base font-semibold text-[#ffd600] text-center">{teacherInfo?.career || 'Sin carrera asignada'}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-[#ff9800] hover:scale-105 transition-transform duration-200">
            <Calendar theme="outline" size="32" className="mb-2 text-[#ff9800]" />
            <div className="text-lg font-bold text-[#23408e] mb-1 text-center">Módulo Actual</div>
            <div className="text-base font-semibold text-[#ff9800] text-center">
              {modulosAsignados.find(mod => mod.estado === 'cursando')?.nombre || 'Sin módulo cursando'}
            </div>
            <div className="text-xs text-gray-600 text-center">4 sábados por módulo</div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {modulosAsignados.map((modulo) => (
              <div
                key={modulo.id}
                className={`border rounded-lg p-4 transition-colors ${{
                  aprobado: 'bg-green-100 border-green-300',
                  cursando: 'bg-blue-100 border-blue-300',
                  pendiente: 'bg-gray-100 border-gray-300',
                }[modulo.estado || 'pendiente']}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-[#23408e]">{modulo.nombre}</h3>
                    <p className="text-sm text-[#009245] font-semibold">Carrera: {modulo.carrera}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedModule(modulo);
                      setShowStudentsModal(true);
                    }}
                    className="px-3 py-1 bg-[#23408e] text-white rounded-full text-sm hover:bg-[#009245] transition-colors"
                  >
                    Ver Estudiantes
                  </button>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  <div>Semestre: {modulo.semestre}</div>
                  <div>Cantidad de sábados: {modulo.sabadosSemana || 0}</div>
                  <div className={`mt-2 px-2 py-1 rounded-full text-xs font-semibold text-center ${{
                    aprobado: 'bg-green-200 text-green-800',
                    cursando: 'bg-blue-200 text-blue-800',
                    pendiente: 'bg-gray-200 text-gray-800',
                  }[modulo.estado || 'pendiente']}`}>{modulo.estado || 'Pendiente'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal de Estudiantes */}
        {showStudentsModal && selectedModule && (
          <Modal
            isOpen={showStudentsModal}
            onRequestClose={() => setShowStudentsModal(false)}
            className="modal-center max-w-4xl w-full bg-white rounded-lg shadow-lg p-8 border-t-4 border-[#23408e] animate-fadeIn"
            overlayClassName="overlay-center bg-black bg-opacity-40"
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

            <div className="overflow-x-auto">
              <table className="min-w-full border rounded-lg">
                <thead>
                  <tr className="bg-[#e3eafc]">
                    <th className="px-4 py-2 text-left text-[#23408e] font-semibold">Estudiante</th>
                    <th className="px-4 py-2 text-left text-[#23408e] font-semibold">Email</th>
                    <th className="px-4 py-2 text-center text-[#23408e] font-semibold">Estado</th>
                    <th className="px-4 py-2 text-center text-[#23408e] font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {estudiantes
                    .filter(est => est.modulosAsignados?.some(m => m.id === selectedModule.id))
                    .map(estudiante => (
                      <tr key={estudiante.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#23408e]">{estudiante.name} {estudiante.lastName}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{estudiante.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <select
                              className={`px-2 py-1 rounded-full text-xs font-semibold border ${{
                                aprobado: 'bg-green-100 text-green-800 border-green-300',
                                cursando: 'bg-blue-100 text-blue-800 border-blue-300',
                                pendiente: 'bg-gray-100 text-gray-800 border-gray-300',
                              }[estudiante.modulosAsignados?.find(m => m.id === selectedModule.id)?.estado || 'pendiente']}`}
                              value={estudiante.modulosAsignados?.find(m => m.id === selectedModule.id)?.estado || 'pendiente'}
                              onChange={(e) =>
                                updateModuleStatus(
                                  estudiante.id,
                                  selectedModule.id,
                                  e.target.value
                                )
                              }
                            >
                              <option value="pendiente">Pendiente</option>
                              <option value="cursando">Cursando</option>
                              <option value="aprobado">Aprobado</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            <Link
                              to={`/dashboard/grades?student=${estudiante.id}&module=${selectedModule.id}`}
                              className="px-3 py-1 bg-[#23408e] text-white rounded-full text-xs hover:bg-blue-700 transition-colors"
                            >
                              Calificar
                            </Link>
                            <Link
                              to={`/dashboard/attendance?student=${estudiante.id}&module=${selectedModule.id}`}
                              className="px-3 py-1 bg-[#009245] text-white rounded-full text-xs hover:bg-green-700 transition-colors"
                            >
                              Asistencia
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
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
