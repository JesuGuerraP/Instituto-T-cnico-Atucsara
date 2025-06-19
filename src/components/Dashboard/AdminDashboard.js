import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { People, User, DegreeHat, ChartHistogram, Book, Calendar, IdCard, Wallet, Medal, Lightning, Tips } from '@icon-park/react';

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    courses: 0,
    finances: 0
  });
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const studentsSnapshot = await getDocs(query(collection(db, 'students')));
        const teachersSnapshot = await getDocs(query(collection(db, 'teachers')));
        // Cambiar: contar carreras en vez de cursos
        const careersSnapshot = await getDocs(query(collection(db, 'careers')));
        // const coursesSnapshot = await getDocs(query(collection(db, 'courses')));
        // Obtener ingresos totales reales desde la colección de pagos
        const paymentsSnapshot = await getDocs(collection(db, 'payments'));
        let totalIncome = 0;
        paymentsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.type === 'income' && data.status === 'completed') {
            totalIncome += Number(data.amount);
          }
        });
        setStats({
          students: studentsSnapshot.size,
          teachers: teachersSnapshot.size,
          courses: careersSnapshot.size, // Ahora muestra la cantidad de carreras
          finances: totalIncome
        });
        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };

    // Actividades recientes reales y simuladas
    const fetchActivities = async () => {
      // Estudiantes
      const studentDocs = await getDocs(query(collection(db, 'students'), orderBy('updatedAt', 'desc'), limit(2)));
      const studentActs = studentDocs.docs.map(doc => {
        const data = doc.data();
        let action = '';
        if (data.deletedAt) {
          action = `eliminó al estudiante: ${data.name} ${data.lastName}`;
        } else if (data.createdAt === data.updatedAt) {
          action = `creó un estudiante: ${data.name} ${data.lastName}`;
        } else {
          action = `actualizó al estudiante: ${data.name} ${data.lastName}`;
        }
        return {
          type: 'student',
          action,
          time: data.updatedAt
            ? new Date(data.updatedAt).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, day: '2-digit', month: '2-digit' })
            : '',
          color: '#23408e'
        };
      });

      // Profesores
      const teacherDocs = await getDocs(query(collection(db, 'teachers'), orderBy('updatedAt', 'desc'), limit(2)));
      const teacherActs = teacherDocs.docs.map(doc => {
        const data = doc.data();
        let action = '';
        if (data.deletedAt) {
          action = `eliminó al profesor: ${data.name} ${data.lastName}`;
        } else if (data.createdAt === data.updatedAt) {
          action = `creó un profesor: ${data.name} ${data.lastName}`;
        } else {
          action = `actualizó al profesor: ${data.name} ${data.lastName}`;
        }
        return {
          type: 'teacher',
          action,
          time: data.updatedAt
            ? new Date(data.updatedAt).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, day: '2-digit', month: '2-digit' })
            : '',
          color: '#009245'
        };
      });

      // Notas
      const gradeDocs = await getDocs(query(collection(db, 'grades'), orderBy('date', 'desc'), limit(2)));
      const gradeActs = gradeDocs.docs.map(doc => {
        const data = doc.data();
        let action = '';
        if (data.deletedAt) {
          action = `eliminó una nota de ${data.studentName} en ${data.moduleName}`;
        } else if (data.createdAt === data.date) {
          action = `creó una nota (${data.grade}) para ${data.studentName} en ${data.moduleName}`;
        } else {
          action = `actualizó una nota (${data.grade}) para ${data.studentName} en ${data.moduleName}`;
        }
        return {
          type: 'grade',
          action,
          time: data.date
            ? data.date
            : '',
          color: '#ffd600'
        };
      });

      // Finanzas (simulado)
      const financeActs = [
        {
          type: 'finance',
          action: 'creó un ingreso mensual',
          time: new Date().toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, day: '2-digit', month: '2-digit' }),
          color: '#ff9800'
        },
        {
          type: 'finance',
          action: 'actualizó un registro de finanzas',
          time: new Date(Date.now() - 1000 * 60 * 60).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, day: '2-digit', month: '2-digit' }),
          color: '#ff9800'
        }
      ];

      // Unimos y ordenamos por tiempo (simulado)
      const acts = [...studentActs, ...teacherActs, ...gradeActs, ...financeActs]
        .sort((a, b) => new Date(b.time) - new Date(a.time)) // Asegurar orden descendente por fecha
        .slice(0, 6);

      setActivities(acts);
    };

    fetchStats();
    fetchActivities();
  }, []);

  if (loading) return <div className="text-[#23408e] font-semibold">Cargando estadísticas...</div>;

  return (
    <div className="bg-[#f5f7fa] min-h-screen py-6 px-2">
      <div className="max-w-7xl mx-auto">
        {/* Bienvenida */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#23408e]">
            ¡Bienvenido, {currentUser?.name || 'usuario'}!
          </h1>
          <p className="text-gray-500 mt-1">Aquí tienes un resumen de la actividad del instituto</p>
        </div>

        {/* Estadísticas principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-5 flex flex-col items-start border-t-4 border-[#23408e]">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#e3eafc] p-2 rounded-full">
                <People theme="filled" size="24" fill="#23408e" />
              </span>
              <span className="font-semibold text-[#23408e]">Total Estudiantes</span>
            </div>
            <div className="text-3xl font-bold text-[#23408e]">{stats.students}</div>
            <div className="text-gray-500 text-sm">Estudiantes registrados</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 flex flex-col items-start border-t-4 border-[#009245]">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#e3fcec] p-2 rounded-full">
                <User theme="filled" size="24" fill="#009245" />
              </span>
              <span className="font-semibold text-[#009245]">Profesores Activos</span>
            </div>
            <div className="text-3xl font-bold text-[#009245]">{stats.teachers}</div>
            <div className="text-gray-500 text-sm">Personal docente activo</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 flex flex-col items-start border-t-4 border-[#9966FF]">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#f3e8ff] p-2 rounded-full">
                <DegreeHat theme="filled" size="24" fill="#9966FF" />
              </span>
              <span className="font-semibold text-[#9966FF]">Cursos Disponibles</span>
            </div>
            <div className="text-3xl font-bold text-[#9966FF]">{stats.courses}</div>
            <div className="text-gray-500 text-sm">Especialidades ofrecidas</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 flex flex-col items-start border-t-4 border-[#ff9800]">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#fff3e0] p-2 rounded-full">
                <ChartHistogram theme="filled" size="24" fill="#ff9800" />
              </span>
              <span className="font-semibold text-[#ff9800]">Ingresos Mensuales</span>
            </div>
            <div className="text-3xl font-bold text-[#ff9800]">
              {stats.finances.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
            </div>
            <div className="text-gray-500 text-sm">Ingresos del mes actual</div>
          </div>
        </div>

        {/* Paneles de actividades y acciones rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Actividades recientes */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Tips theme="outline" size="24" fill="#23408e" className="mr-2" />
              <h2 className="text-xl font-bold text-[#23408e]">Actividades Recientes</h2>
            </div>
            <p className="text-gray-500 mb-2">Últimas actividades en el sistema</p>
            <ul>
              {activities.length === 0 && (
                <li className="text-gray-400">No hay actividades recientes.</li>
              )}
              {activities.map((a, i) => (
                <li key={i} className="flex items-center mb-2">
                  <span className="h-3 w-3 rounded-full mr-2" style={{ background: a.color }}></span>
                  <span className="font-semibold">{a.action}</span>
                  <span className="ml-auto text-xs text-gray-400">{a.time}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Acciones rápidas */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <Lightning theme="outline" size="24" fill="#23408e" className="mr-2" />
              <h2 className="text-xl font-bold text-[#23408e]">Acciones Rápidas</h2>
            </div>
            <p className="text-gray-500 mb-2">Tareas comunes del sistema</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link to="/dashboard/students/form" className="flex items-center p-4 bg-[#e3eafc] rounded-lg hover:bg-[#23408e] hover:text-white transition">
                <People theme="outline" size="22" fill="#23408e" className="mr-2" />
                <div>
                  <div className="font-semibold">Registrar Estudiante</div>
                  <div className="text-xs">Agregar nuevo estudiante</div>
                </div>
              </Link>
              <Link to="/dashboard/grades" className="flex items-center p-4 bg-[#e3fcec] rounded-lg hover:bg-[#009245] hover:text-white transition">
                <Book theme="outline" size="22" fill="#009245" className="mr-2" />
                <div>
                  <div className="font-semibold">Cargar Notas</div>
                  <div className="text-xs">Actualizar calificaciones</div>
                </div>
              </Link>
              <Link to="/dashboard/finances" className="flex items-center p-4 bg-[#f3e8ff] rounded-lg hover:bg-[#9966FF] hover:text-white transition">
                <ChartHistogram theme="outline" size="22" fill="#9966FF" className="mr-2" />
                <div>
                  <div className="font-semibold">Ver Finanzas</div>
                  <div className="text-xs">Gestionar transacciones</div>
                </div>
              </Link>
              <Link to="/dashboard/teachers" className="flex items-center p-4 bg-[#fff3e0] rounded-lg hover:bg-[#ff9800] hover:text-white transition">
                <User theme="outline" size="22" fill="#ff9800" className="mr-2" />
                <div>
                  <div className="font-semibold">Gestionar Profesores</div>
                  <div className="text-xs">Administrar personal</div>
                </div>
              </Link>
              <Link to="/dashboard/attendance" className="flex items-center p-4 bg-[#e0f7fa] rounded-lg hover:bg-[#0097a7] hover:text-white transition">
                <Calendar theme="outline" size="22" fill="#0097a7" className="mr-2" />
                <div>
                  <div className="font-semibold">Gestionar Asistencias</div>
                  <div className="text-xs">Registrar y revisar asistencia</div>
                </div>
              </Link>
              <Link to="/dashboard/careers" className="flex items-center p-4 bg-[#ede7f6] rounded-lg hover:bg-[#7c4dff] hover:text-white transition">
                <DegreeHat theme="outline" size="22" fill="#7c4dff" className="mr-2" />
                <div>
                  <div className="font-semibold">Gestionar Carreras</div>
                  <div className="text-xs">Administrar carreras técnicas</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;