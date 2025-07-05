import { useContext, useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { auth } from '../../firebaseConfig';
import { signOut } from 'firebase/auth';
import { AuthContext } from '../../context/AuthContext';
import Modal from 'react-modal';
import { Home, People, Book, Calendar, DegreeHat, User, ChartHistogram, SettingTwo, Logout } from '@icon-park/react';
import './DashboardLayout.css';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext); // Usar currentUser

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Colores principales del logo: azul (#23408e), verde (#009245), amarillo (#ffd600)
  const sidebarBg = "bg-white";
  const sidebarBorder = "border-r-2 border-blue-900";
  const logoBg = "bg-blue-900";
  const logoText = "text-white";
  const activeLink = "bg-blue-100 border-r-4 border-blue-700 text-blue-900";
  const iconColor = "text-blue-700";

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative inset-y-0 left-0 transform w-64 ${sidebarBg} ${sidebarBorder} shadow-lg transition duration-200 ease-in-out z-30 flex flex-col`}>
        {/* Logo */}
        <div className={`flex flex-col items-center justify-center h-28 px-4 ${logoBg}`}>
          <img
            src="/assets/logoInstituto.jpg"
            alt="Logo Instituto Técnico"
            className="w-16 h-16 mb-1 rounded-full bg-white object-contain"
          />
          <h1 className={`text-lg font-bold ${logoText}`}>Instituto Técnico</h1>
          <span className="text-xs text-blue-100">Sistema de Gestión</span>
        </div>
        {/* Navegación */}
        <nav className="mt-4 flex-1">
          <ul>
            <li>
              <Link to="/dashboard" className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition group" onClick={() => setSidebarOpen(false)}>
                <span className={`mr-3 ${iconColor}`}><Home theme="outline" size="22" /></span>
                Mi Panel
              </Link>
            </li>
            {/* Solo mostrar el resto si el usuario NO es estudiante */}
            {currentUser?.role !== 'student' && (
              <>
                {currentUser?.role === 'admin' && (
                  <>
                    <li>
                      <Link to="/dashboard/students" className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition group" onClick={() => setSidebarOpen(false)}>
                        <span className={`mr-3 ${iconColor}`}><People theme="outline" size="22" /></span>
                        Estudiantes
                      </Link>
                    </li>
                    <li>
                      <Link to="/dashboard/grades" className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition group" onClick={() => setSidebarOpen(false)}>
                        <span className={`mr-3 ${iconColor}`}><Book theme="outline" size="22" /></span>
                        Notas
                      </Link>
                    </li>
                    <li>
                      <Link to="/dashboard/attendance" className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition group" onClick={() => setSidebarOpen(false)}>
                        <span className={`mr-3 ${iconColor}`}><Calendar theme="outline" size="22" /></span>
                        Asistencia
                      </Link>
                    </li>
                    <li>
                      <Link to="/dashboard/careers" className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition group" onClick={() => setSidebarOpen(false)}>
                        <span className={`mr-3 ${iconColor}`}><DegreeHat theme="outline" size="22" /></span>
                        Carreras
                      </Link>
                    </li>
                    <li>
                      <Link to="/dashboard/teachers" className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition group" onClick={() => setSidebarOpen(false)}>
                        <span className={`mr-3 ${iconColor}`}><User theme="outline" size="22" /></span>
                        Profesores
                      </Link>
                    </li>
                    <li>
                      <Link to="/dashboard/finances" className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition group" onClick={() => setSidebarOpen(false)}>
                        <span className={`mr-3 ${iconColor}`}><ChartHistogram theme="outline" size="22" /></span>
                        Finanzas
                      </Link>
                    </li>
                    <li>
                      <Link to="/dashboard/admin" className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition group" onClick={() => setSidebarOpen(false)}>
                        <span className={`mr-3 ${iconColor}`}><SettingTwo theme="outline" size="22" /></span>
                        Administración
                      </Link>
                    </li>
                  </>
                )}
                {currentUser?.role === 'teacher' && (
                  <>
                    <li>
                      <Link to="/dashboard/grades" className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition group" onClick={() => setSidebarOpen(false)}>
                        <span className={`mr-3 ${iconColor}`}><Book theme="outline" size="22" /></span>
                        Notas
                      </Link>
                    </li>
                    <li>
                      <Link to="/dashboard/attendance" className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition group" onClick={() => setSidebarOpen(false)}>
                        <span className={`mr-3 ${iconColor}`}><Calendar theme="outline" size="22" /></span>
                        Asistencia
                      </Link>
                    </li>
                    {/* Configuración como última opción solo para teacher */}
                    <li>
                      <Link to="/dashboard/settings" className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition group" onClick={() => setSidebarOpen(false)}>
                        <span className={`mr-3 ${iconColor}`}><SettingTwo theme="outline" size="22" /></span>
                        Configuración
                      </Link>
                    </li>
                  </>
                )}
              </>
            )}
          </ul>
        </nav>
        {/* Usuario y logout */}
        <div className="mt-auto mb-2 px-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block bg-blue-100 text-blue-900 font-bold rounded-full px-3 py-1 text-xs capitalize">{currentUser?.name || 'Usuario'}</span>
            <span className="text-xs text-gray-500">{currentUser?.role || 'Rol'}</span>
          </div>
          <button 
            onClick={openModal}
            className="w-full flex items-center justify-center px-4 py-2 text-sm text-white bg-red-500 rounded-md hover:bg-red-600"
          >
            <span className="mr-2"><Logout theme="outline" size="20" fill="#fff" /></span>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Modal de confirmación */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        contentLabel="Confirmar cierre de sesión"
        className="modal-center"
        overlayClassName="overlay-center"
      >
        <h2 className="text-lg font-bold mb-4">¿Estás seguro de que deseas cerrar sesión?</h2>
        <div className="flex justify-end gap-4">
          <button
            onClick={closeModal}
            className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
          >
            Cancelar
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Cerrar sesión
          </button>
        </div>
      </Modal>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-10">
          <div className="flex items-center justify-between px-6 py-4">
            <button 
              className="md:hidden text-gray-500 focus:outline-none"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Buscar..."
                />
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;