import React, { useState, useEffect, useMemo, useContext } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { DefaultPeriodContext } from '../../context/DefaultPeriodContext';
import { Link } from 'react-router-dom';
import { calculatePeriod } from '../../utils/periodHelper';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Íconos
import { 
  People, 
  User, 
  DegreeHat, 
  ChartHistogram, 
  Book, 
  Calendar, 
  Wallet, 
  Lightning, 
  Analysis,
  Attention,
  CheckOne,
  EnterKey,
  Transaction,
  ActivitySource
} from '@icon-park/react';

// Componentes del Dashboard
import StatCard from './components/StatCard';
import FinanceChart from './components/FinanceChart';
import StudentDistribution from './components/StudentDistribution';
import AcademicOverview from './components/AcademicOverview';
import RecentAlerts from './components/RecentAlerts';

// Utilidades
import { 
  processFinanceData, 
  processStudentDistribution, 
  processAcademicPerformance, 
  processAttendanceRate,
  identifyInsights,
  processRecentActivities
} from '../../utils/dashboardUtils';

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const { defaultPeriod } = useContext(DefaultPeriodContext);
  
  // Estados de datos crudos
  const [data, setData] = useState({
    students: [],
    teachers: [],
    payments: [],
    grades: [],
    attendance: [],
    careers: [],
    courses: [],
    activityLogs: []
  });
  
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState('all'); 
  const [academicPeriods, setAcademicPeriods] = useState(['2025-1', '2025-2', '2026-1']); 

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const collections = [
          'students', 'teachers', 'payments', 'grades', 'attendance', 'careers', 'courses', 'activityLogs'
        ];
        
        const results = await Promise.all(
          collections.map(col => getDocs(collection(db, col)))
        );
        
        const newData = {};
        collections.forEach((col, index) => {
          let items = results[index].docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Enriquecimiento de datos de estudiantes (Calculo de periodo si falta)
          if (col === 'students') {
            items = items.map(s => {
              const dateSource = s.createdAt?.toDate ? s.createdAt.toDate() : s.createdAt;
              const calculated = s.period || s.periodo || (dateSource ? calculatePeriod(dateSource) : '');
              return { ...s, period: calculated, periodo: calculated };
            });
          }
          
          newData[col] = items;
        });
        
        setData(newData);
        
        const periodsSnap = await getDocs(collection(db, 'academicPeriods'));
        const dbPeriods = periodsSnap.docs.map(doc => doc.data().period).filter(Boolean);
        const mergedPeriods = Array.from(new Set([...academicPeriods, ...dbPeriods]));
        
        const sortedPeriods = mergedPeriods.sort((a, b) => {
          const [yearA, periodA] = a.split('-');
          const [yearB, periodB] = b.split('-');
          if (parseInt(yearB) !== parseInt(yearA)) return parseInt(yearB) - parseInt(yearA);
          return parseInt(periodB) - parseInt(periodA);
        });
        
        setAcademicPeriods(sortedPeriods);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const stats = useMemo(() => {
    const periodFilteredStudents = activePeriod === 'all' 
      ? data.students 
      : data.students.filter(s => s.period === activePeriod);

    const activeCount = periodFilteredStudents.filter(s => s.status === 'active' || s.estado === 'Activo').length;
    const inactiveCount = periodFilteredStudents.filter(s => s.status === 'inactive' || s.estado === 'Inactivo').length;
    
    const financeData = processFinanceData(data.payments, activePeriod);
    const attendanceStats = processAttendanceRate(data.attendance, activePeriod);
    const periodFilteredGrades = activePeriod === 'all'
      ? data.grades
      : data.grades.filter(g => g.period === activePeriod || g.periodo === activePeriod);

    const avgGrade = periodFilteredGrades.length > 0
      ? (periodFilteredGrades.reduce((sum, g) => sum + (parseFloat(g.grade) || 0), 0) / periodFilteredGrades.length).toFixed(2)
      : '0.0';

    return {
      totalStudents: periodFilteredStudents.length,
      activeStudents: activeCount,
      inactiveStudents: inactiveCount,
      balance: financeData.summary.balance,
      totalIncome: financeData.summary.totalIncome,
      totalExpense: financeData.summary.totalExpense,
      attendanceRate: attendanceStats.rate,
      averageGrade: avgGrade
    };
  }, [data, activePeriod]);

  const financeChartData = useMemo(() => processFinanceData(data.payments, activePeriod), [data.payments, activePeriod]);
  const studentDistData = useMemo(() => processStudentDistribution(data.students, data.courses, activePeriod), [data, activePeriod]);
  const academicData = useMemo(() => processAcademicPerformance(data.grades, activePeriod), [data.grades, activePeriod]);
  const insights = useMemo(() => identifyInsights(data.students, data.grades, data.payments, activePeriod), [data, activePeriod]);
  const recentActivities = useMemo(() => processRecentActivities(data.activityLogs, 10), [data.activityLogs]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-[#23408e]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#23408e] mb-4"></div>
        <p className="font-black text-xl animate-pulse tracking-widest uppercase">Cargando Analíticas...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#fcfdff] min-h-screen pb-12">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        
        {/* Header Superior */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6 bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">
              Dashboard de <span className="text-[#23408e]">Gestión Administrativa</span>
            </h1>
            <p className="text-slate-400 mt-2 font-bold uppercase tracking-widest text-[11px]">
               Atucsara • Control de Mandos Profesional
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100 pr-6">
            <div className="w-10 h-10 rounded-xl bg-[#23408e] flex items-center justify-center text-white shadow-lg">
              <Calendar theme="outline" size="20" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Filtro Global</span>
              <select 
                className="bg-transparent border-none rounded-lg text-sm font-black text-[#23408e] cursor-pointer outline-none p-0 focus:ring-0"
                value={activePeriod}
                onChange={(e) => setActivePeriod(e.target.value)}
              >
                <option value="all">Ver todos los tiempos</option>
                {academicPeriods.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard 
            title="Población Estudiantil" 
            value={stats.totalStudents} 
            icon={<People theme="filled" size="24" />}
            color="blue"
            footer={
              <div className="flex justify-between text-[11px] font-black uppercase">
                <span className="text-green-600 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Activos: {stats.activeStudents}</span>
                <span className="text-red-400 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> Inactivos: {stats.inactiveStudents}</span>
              </div>
            }
          />

          <StatCard 
            title="Balance Tesorería" 
            value={stats.balance.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })} 
            icon={<Wallet theme="filled" size="24" />}
            color={stats.balance >= 0 ? "green" : "red"}
            footer={
              <div className="flex justify-between text-[11px] font-black uppercase">
                <span className="text-green-600">INC: +{stats.totalIncome.toLocaleString()}</span>
                <span className="text-red-400">GST: -{stats.totalExpense.toLocaleString()}</span>
              </div>
            }
          />

          <StatCard 
            title="Rendimiento Global" 
            value={stats.averageGrade} 
            icon={<Analysis theme="filled" size="24" />}
            color="purple"
            footer={
              <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                <div className="bg-purple-500 h-1 rounded-full" style={{ width: `${(parseFloat(stats.averageGrade) / 5) * 100}%` }}></div>
              </div>
            }
          />

          <StatCard 
            title="Asistencia Promedio" 
            value={`${stats.attendanceRate}%`} 
            icon={<CheckOne theme="filled" size="24" />}
            color="yellow"
            footer={
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight overflow-hidden text-ellipsis whitespace-nowrap">Período: {activePeriod === 'all' ? 'Histórico' : activePeriod}</div>
            }
          />
        </div>

        {/* Sección de Estudiantes - PRIORIZADA */}
        <div className="mb-10 min-h-[500px]">
          <StudentDistribution 
             labels={studentDistData.labels} 
             fullData={studentDistData.fullData} 
          />
        </div>

        {/* Gráfico de Finanzas */}
        <div className="mb-10">
          <FinanceChart 
            labels={financeChartData.labels} 
            income={financeChartData.income} 
            expense={financeChartData.expense} 
          />
        </div>

        {/* SECCIÓN DE ACTIVIDAD RECIENTE - REDISEÑADA FULL WIDTH */}
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm mb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-[#23408e]/10 flex items-center justify-center text-[#23408e] shadow-inner">
                <ActivitySource theme="filled" size="32" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Registro de Actividad Reciente (Auditoría Global)</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Historial completo de acciones • Todas las áreas y roles</p>
              </div>
            </div>
            <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] bg-slate-50 px-6 py-3 rounded-full border border-slate-100/50">
              Mostrando últimos 10 eventos
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recentActivities.length > 0 ? recentActivities.map((act, idx) => (
              <div key={idx} className="flex items-start gap-6 p-6 rounded-[2rem] bg-slate-50/50 border border-slate-100/30 hover:bg-white hover:shadow-xl hover:translate-x-2 transition-all duration-300 group">
                <div className={`w-16 h-16 rounded-[1.2rem] flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform ${
                  act.type === 'finance' ? 'bg-green-100 text-green-600' : 
                  act.type === 'student' ? 'bg-blue-100 text-blue-600' : 
                  'bg-purple-100 text-purple-600'
                }`}>
                   {act.type === 'finance' && <Transaction theme="filled" size="28" />}
                   {act.type === 'student' && <People theme="filled" size="28" />}
                   {act.type === 'academic' && <Book theme="filled" size="28" />}
                   {act.type === 'teacher' && <User theme="filled" size="28" />}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 text-lg leading-none truncate pr-4">{act.user}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{act.role || 'Usuario'}</span>
                    </div>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap mt-1">
                      {act.date?.toDate ? format(act.date.toDate(), 'HH:mm • dd MMM', { locale: es }) : ''}
                    </span>
                  </div>
                  <div className={`text-[10px] font-black uppercase tracking-[0.15em] mb-2 leading-none ${
                    act.type === 'finance' ? 'text-green-600' : 
                    act.type === 'student' ? 'text-blue-600' : 
                    'text-purple-600'
                  }`}>{act.action}</div>
                  <div className="text-xs text-slate-400 font-bold line-clamp-1 italic">{act.detail}</div>
                </div>
              </div>
            )) : (
              <div className="col-span-1 md:col-span-2 py-10 text-center opacity-40">
                <p className="text-lg font-black uppercase tracking-widest text-slate-300">No hay actividades para reportar</p>
              </div>
            )}
          </div>
        </div>

        {/* Inteligencia y Acciones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
          <AcademicOverview modules={academicData} />
          <RecentAlerts insights={insights} />
        </div>

        {/* Acceso Directo */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-8">
            <Lightning theme="filled" size="24" fill="#ffd600" />
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Acceso Directo Profesional</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <QuickActionLink to="/dashboard/students/form" icon={<People theme="outline" size="24" />} label="Estudiantes" color="bg-blue-50 text-blue-700" />
            <QuickActionLink to="/dashboard/grades" icon={<Book theme="outline" size="24" />} label="Notas" color="bg-purple-50 text-purple-700" />
            <QuickActionLink to="/dashboard/finance" icon={<Wallet theme="outline" size="24" />} label="Finanzas" color="bg-green-50 text-green-700" />
            <QuickActionLink to="/dashboard/teachers" icon={<User theme="outline" size="24" />} label="Docentes" color="bg-orange-50 text-orange-700" />
            <QuickActionLink to="/dashboard/attendance" icon={<Calendar theme="outline" size="24" />} label="Asistencia" color="bg-cyan-50 text-cyan-700" />
            <QuickActionLink to="/dashboard/careers" icon={<DegreeHat theme="outline" size="24" />} label="Carreras" color="bg-indigo-50 text-indigo-700" />
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickActionLink = ({ to, icon, label, color }) => (
  <Link 
    to={to} 
    className={`flex flex-col items-center justify-center p-6 rounded-2xl ${color} hover:shadow-lg hover:translate-y-[-4px] transition-all duration-300 border border-transparent hover:border-current group`}
  >
    <div className="mb-3 transform group-hover:scale-110 group-hover:rotate-6 transition-transform">
      {icon}
    </div>
    <span className="text-[10px] font-black text-center uppercase tracking-widest leading-none">{label}</span>
  </Link>
);

export default AdminDashboard;