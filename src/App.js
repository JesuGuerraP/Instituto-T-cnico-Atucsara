import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AuthContext } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layouts
import DashboardLayout from './components/Layout/DashboardLayout';

// Páginas/componentes
import './styles.css';
import LoginForm from './components/Auth/LoginForm';
import AdminDashboard from './components/Dashboard/AdminDashboard';
import StudentDashboard from './components/Dashboard/StudentDashboard';
import TeacherDashboard from './components/Dashboard/TeacherDashboard';
import StudentForm from './components/Students/StudentForm';
import StudentSettings from './components/Dashboard/StudentSettings';
import StudentsTable from './components/Students/StudentsTable';
import TeachersTable from './components/Teachers/TeachersTable';
import TeacherForm from './components/Teachers/TeacherForm';
import GradeManager from './components/Grades/GradeManager';
import PaymentManager from './components/Finance/PaymentManager';
import UserManagement from './components/Admin/UserManagement';
import ReportGenerator from './components/Reports/ReportGenerator';
import GradeReportPage from './components/Grades/GradeReportPage'; // Importa la nueva página
import AttendanceManager from './components/Attendance/AttendanceManager';
import VistaCarreras from './components/Carreras/VistaCarreras';

const Page404 = () => <div>Página no encontrada</div>;

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setCurrentUser({
            uid: user.uid,
            email: user.email,
            ...userDoc.data()
          });
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const ProtectedRoute = ({ children, roles }) => {
    if (!currentUser) {
      return <Navigate to="/login" replace />;
    }
    if (roles && !roles.includes(currentUser.role)) {
      return <Navigate to="/dashboard" replace />;
    }
    return children;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando aplicación...</div>;
  }

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser }}>
      <Router>
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
        <Routes>
          {/* Ruta pública de login */}
          <Route path="/login" element={<LoginForm />} />

          {/* Ruta pública para el reporte */}
          <Route path="/grades/report" element={<GradeReportPage />} />

          {/* Rutas protegidas bajo /dashboard */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>            <Route index element={
              currentUser?.role === 'student' ? <StudentDashboard /> : 
              currentUser?.role === 'teacher' ? <TeacherDashboard /> : 
              <AdminDashboard />
            } />
            <Route path="settings" element={
              <ProtectedRoute>
                {/* Usar AccountSettings si existe, si no StudentSettings */}
                {/* import AccountSettings from './components/Dashboard/AccountSettings'; */}
                {/* <AccountSettings /> */}
                <StudentSettings />
              </ProtectedRoute>
            } />
            <Route path="students" element={
              <ProtectedRoute roles={['admin', 'secretary']}>
                <StudentsTable />
              </ProtectedRoute>
            } />
            <Route path="students/form" element={
              <ProtectedRoute roles={['admin', 'secretary']}>
                <StudentForm />
              </ProtectedRoute>
            } />
            <Route path="students/form/:id" element={
              <ProtectedRoute roles={['admin', 'secretary']}>
                <StudentForm />
              </ProtectedRoute>
            } />
            <Route path="teachers" element={
              <ProtectedRoute roles={['admin']}>
                <TeachersTable />
              </ProtectedRoute>
            } />
            <Route path="teachers/new" element={
              <ProtectedRoute roles={['admin']}>
                <TeacherForm />
              </ProtectedRoute>
            } />
            <Route path="teachers/edit/:id" element={
              <ProtectedRoute roles={['admin']}>
                <TeacherForm />
              </ProtectedRoute>
            } />
            <Route path="grades" element={
              <ProtectedRoute roles={['admin', 'teacher']}>
                <GradeManager />
              </ProtectedRoute>
            } />
            <Route path="finances" element={
              <ProtectedRoute roles={['admin', 'secretary']}>
                <PaymentManager />
              </ProtectedRoute>
            } />
            <Route path="admin" element={
              <ProtectedRoute roles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="reports" element={
              <ProtectedRoute roles={['admin', 'secretary']}>
                <ReportGenerator />
              </ProtectedRoute>
            } />
            <Route path="attendance" element={
              <ProtectedRoute roles={['admin', 'secretary', 'teacher']}>
                <AttendanceManager />
              </ProtectedRoute>
            } />
            <Route path="careers" element={
              <ProtectedRoute roles={['admin']}>
                <VistaCarreras />
              </ProtectedRoute>
            } />
          </Route>

          {/* Redirección de la raíz a dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<Page404 />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;