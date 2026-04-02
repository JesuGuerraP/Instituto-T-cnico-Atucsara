import { useContext, useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { auth } from '../../firebaseConfig';
import { signOut } from 'firebase/auth';
import { AuthContext } from '../../context/AuthContext';
import Modal from 'react-modal';
import { Home, People, Book, Calendar, DegreeHat, User, ChartHistogram, SettingTwo, Logout, Wallet, Dashboard } from '@icon-park/react';
import { useLocation } from 'react-router-dom';
import './DashboardLayout.css';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen]         = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [careersExpanded, setCareersExpanded] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const { currentUser } = useContext(AuthContext);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const openModal  = () => { setSidebarOpen(false); setIsModalOpen(true); };
  const closeModal = () => setIsModalOpen(false);

  const activeLink = "bg-blue-100 border-r-4 border-blue-700 text-blue-900";
  const iconColor  = "text-blue-700";

  /* ── Componente de enlace reutilizable ── */
  const NavLink = ({ to, icon: Icon, label }) => {
    const isActive = location.pathname === to;
    return (
      <li>
        <Link
          to={to}
          onClick={() => setSidebarOpen(false)}
          title={sidebarCollapsed ? label : ''}
          className={`flex items-center py-3 transition-all duration-200 ${
            sidebarCollapsed ? 'justify-center px-0' : 'px-6'
          } ${isActive ? activeLink : 'text-gray-700 hover:bg-blue-50 hover:text-blue-900'}`}
        >
          <span className={`shrink-0 ${isActive ? 'text-blue-900' : iconColor} ${sidebarCollapsed ? '' : 'mr-3'}`}>
            <Icon theme={isActive ? 'filled' : 'outline'} size="22" />
          </span>
          {!sidebarCollapsed && <span className="truncate">{label}</span>}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        fixed md:relative inset-y-0 left-0
        w-64 ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'}
        bg-white border-r-2 border-blue-900 shadow-lg
        transition-all duration-300 ease-in-out
        z-30 flex flex-col shrink-0 overflow-hidden
      `}>

        {/* Logo */}
        <div className={`flex flex-col items-center justify-center overflow-hidden bg-blue-900 transition-all duration-300 ${sidebarCollapsed ? 'h-16 py-2' : 'h-28 py-4'}`}>
          <img
            src="/assets/logoInstituto.jpg"
            alt="Logo"
            className={`rounded-full bg-white object-contain transition-all duration-300 ${sidebarCollapsed ? 'w-9 h-9' : 'w-14 h-14 mb-1'}`}
          />
          {!sidebarCollapsed && (
            <>
              <h1 className="text-base font-bold text-white truncate">Instituto Técnico</h1>
              <span className="text-[10px] text-blue-200">Sistema de Gestión</span>
            </>
          )}
        </div>

        {/* Navegación */}
        <nav className="mt-2 flex-1 overflow-y-auto custom-scrollbar">
          <ul>

            {/* Panel principal (no estudiante) */}
            {currentUser?.role !== 'student' && (
              <NavLink to="/dashboard" icon={Home} label="Mi Panel" />
            )}

            {/* ── ADMIN ── */}
            {currentUser?.role === 'admin' && (
              <>
                <NavLink to="/dashboard/students"    icon={People}         label="Estudiantes" />
                <NavLink to="/dashboard/grades"      icon={Book}           label="Notas" />
                <NavLink to="/dashboard/attendance"  icon={Calendar}       label="Asistencia" />

                {/* Carreras colapsable */}
                <li>
                  <button
                    onClick={() => { 
                      if (sidebarCollapsed) {
                        setSidebarCollapsed(false);
                        setCareersExpanded(true);
                      } else {
                        setCareersExpanded(!careersExpanded);
                      }
                    }}
                    title={sidebarCollapsed ? 'Carreras' : ''}
                    className={`w-full flex items-center py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition ${
                      sidebarCollapsed ? 'justify-center px-0' : 'px-6'
                    }`}
                  >
                    <span className={`shrink-0 ${iconColor} ${sidebarCollapsed ? '' : 'mr-3'}`}>
                      <DegreeHat theme="outline" size="22" />
                    </span>
                    {!sidebarCollapsed && (
                      <>
                        <span>Carreras</span>
                        <svg className={`ml-auto w-4 h-4 transition-transform ${careersExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                  {careersExpanded && !sidebarCollapsed && (
                    <ul className="bg-blue-50">
                      {[
                        { to: '/dashboard/careers',        label: 'Gestionar Carreras' },
                        { to: '/dashboard/general-modules', label: 'Módulos Generales' },
                        { to: '/dashboard/courses',        label: 'Cursos' },
                      ].map(item => (
                        <li key={item.to}>
                          <Link to={item.to} onClick={() => setSidebarOpen(false)} className="flex items-center px-12 py-3 text-gray-700 hover:bg-blue-100 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-3 shrink-0" />{item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>

                <NavLink to="/dashboard/teachers"   icon={User}           label="Profesores" />
                <NavLink to="/dashboard/finances"   icon={ChartHistogram} label="Finanzas" />
                <NavLink to="/dashboard/admin"      icon={SettingTwo}     label="Administración" />
              </>
            )}

            {/* ── TEACHER ── */}
            {currentUser?.role === 'teacher' && (
              <>
                <NavLink to="/dashboard/grades"     icon={Book}       label="Notas" />
                <NavLink to="/dashboard/attendance" icon={Calendar}   label="Asistencia" />
                <NavLink to="/dashboard/settings"   icon={SettingTwo} label="Configuración" />
              </>
            )}

            {/* ── STUDENT ── */}
            {currentUser?.role === 'student' && (
              <>
                <NavLink to="/dashboard"           icon={Dashboard}  label="Inicio" />
                <NavLink to="/dashboard/academic"  icon={Book}       label="Académico" />
                <NavLink to="/dashboard/finance"   icon={Wallet}     label="Finanzas" />
                <NavLink to="/dashboard/settings"  icon={SettingTwo} label="Configuración" />
              </>
            )}

          </ul>
        </nav>

        {/* Footer sidebar */}
        <div className="mt-auto">

          {/* Botón colapsar — solo escritorio, dentro del sidebar, sin interferir */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
            className={`
              hidden md:flex w-full items-center py-3 border-t border-blue-100
              text-blue-400 hover:text-blue-700 hover:bg-blue-50
              transition-all duration-200
              ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-5'}
            `}
          >
            {!sidebarCollapsed && (
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Contraer menú</span>
            )}
            <div className={`flex items-center justify-center rounded-lg transition-all duration-200 ${
              sidebarCollapsed
                ? 'w-8 h-8 bg-blue-50 border border-blue-200 hover:bg-blue-100'
                : 'w-7 h-7 bg-blue-50 border border-blue-100'
            }`}>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </button>

          {/* Separador */}
          <div className="border-t border-blue-100" />

          {/* Usuario + Logout */}
          <div className={`pb-4 pt-2 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-blue-100 text-blue-900 font-bold rounded-full px-3 py-1 text-xs capitalize truncate">
                  {currentUser?.name || 'Usuario'}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{currentUser?.role || 'Rol'}</span>
              </div>
            )}
            <button
              onClick={openModal}
              title="Cerrar sesión"
              className={`w-full flex items-center justify-center py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-all ${
                sidebarCollapsed ? 'px-1' : 'gap-2 px-3'
              }`}
            >
              <Logout theme="outline" size="18" fill="#fff" />
              {!sidebarCollapsed && <span>Cerrar sesión</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Modal confirmación logout */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        contentLabel="Confirmar cierre de sesión"
        className="modal-center"
        overlayClassName="overlay-center"
      >
        <h2 className="text-lg font-bold mb-4">¿Estás seguro de que deseas cerrar sesión?</h2>
        <div className="flex justify-end gap-4">
          <button onClick={closeModal} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">Cancelar</button>
          <button onClick={handleLogout} className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">Cerrar sesión</button>
        </div>
      </Modal>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Hamburguesa — solo móvil */}
        <div className="md:hidden bg-white shadow-sm border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button className="text-gray-500 hover:text-blue-700 focus:outline-none" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-bold text-blue-900 uppercase tracking-widest">Instituto Técnico</span>
        </div>

        <main className="flex-1 overflow-y-auto bg-gray-50 pl-4 md:pl-8 lg:pl-10 pr-0 py-8 transition-all duration-300">
          <Outlet />
        </main>
      </div>

    </div>
  );
};

export default DashboardLayout;