import { useState, useEffect, useContext } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, addDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { DefaultPeriodContext } from '../../context/DefaultPeriodContext';
import { toast } from 'react-toastify';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'teacher', label: 'Profesor' },
  { value: 'secretary', label: 'Secretaría' },
  { value: 'student', label: 'Estudiante' }
];

// Validaciones de contraseña
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  hasUpperCase: /[A-Z]/,
  hasLowerCase: /[a-z]/,
  hasNumbers: /[0-9]/,
  hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
};

const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Mínimo ${PASSWORD_REQUIREMENTS.minLength} caracteres`);
  }
  if (!PASSWORD_REQUIREMENTS.hasUpperCase.test(password)) {
    errors.push('Al menos una mayúscula');
  }
  if (!PASSWORD_REQUIREMENTS.hasLowerCase.test(password)) {
    errors.push('Al menos una minúscula');
  }
  if (!PASSWORD_REQUIREMENTS.hasNumbers.test(password)) {
    errors.push('Al menos un número');
  }
  if (!PASSWORD_REQUIREMENTS.hasSpecialChar.test(password)) {
    errors.push('Al menos un carácter especial (!@#$%^&*)');
  }
  
  return errors;
};

const initialFormState = {
  email: '',
  password: '',
  confirmPassword: '',
  name: '',
  lastName: '',
  role: ''
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { currentUser } = useAuth();
  const { defaultPeriod, setDefaultPeriod } = useContext(DefaultPeriodContext);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...initialFormState });
  const [editId, setEditId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [periodOptions] = useState([
    '2025-1',
    '2025-2',
    '2026-1',
    '2026-2',
  ]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching users:", error);
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(user => user.id === userId ? { ...user, role: newRole } : user));
      toast.success('Rol actualizado correctamente');
    } catch (error) {
      toast.error("Error actualizando el rol");
    }
  };

  const handleDeleteUser = async (userId) => {
    setUserToDelete(userId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'users', userToDelete));
      setUsers(users.filter(user => user.id !== userToDelete));
      toast.success('Usuario eliminado correctamente');
    } catch (error) {
      toast.error("Error eliminando usuario");
    } finally {
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  const handleEditUser = (user) => {
    setEditId(user.id);
    setForm({
      email: user.email,
      password: '',
      name: user.name || '',
      lastName: user.lastName || '',
      role: user.role
    });
    setShowForm(true);
  };

  const handleViewUser = (user) => {
    alert(
      `Usuario: ${user.name || ''} ${user.lastName || ''}\nEmail: ${user.email}\nRol: ${user.role}`
    );
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    
    // Validar contraseña en tiempo real si se está editando el campo password
    if (name === 'password' && value) {
      const errors = validatePassword(value);
      setPasswordErrors(errors);
    } else if (name === 'password') {
      setPasswordErrors([]);
    }
  };

  const handleNewUser = () => {
    setEditId(null);
    setForm({ ...initialFormState });
    setPasswordErrors([]);
    setShowForm(true);
  };

  const handleCloseModal = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ ...initialFormState });
    setPasswordErrors([]);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones básicas
    if (!form.email || !form.role || !form.name) {
      toast.error('Email, rol y nombre son obligatorios');
      return;
    }

    if (editId) {
      // MODO EDICIÓN: Solo actualizar perfil, no contraseña
      if (!form.password && form.lastName === undefined) {
        toast.error('Completa al menos un campo para editar');
        return;
      }

      setSubmitting(true);
      try {
        const updateData = {
          name: form.name,
          lastName: form.lastName,
          email: form.email
        };
        
        await updateDoc(doc(db, 'users', editId), updateData);
        setUsers(users.map(u => u.id === editId ? { ...u, ...updateData } : u));
        toast.success('Usuario actualizado correctamente');
        handleCloseModal();
      } catch (error) {
        console.error("Error updating user:", error);
        toast.error(`Error al actualizar: ${error.message}`);
      } finally {
        setSubmitting(false);
      }
    } else {
      // MODO CREACIÓN: Validaciones de contraseña
      if (!form.password || !form.confirmPassword) {
        toast.error('Las contraseñas son obligatorias');
        return;
      }

      if (form.password !== form.confirmPassword) {
        toast.error('Las contraseñas no coinciden');
        return;
      }

      const passwordErrors = validatePassword(form.password);
      if (passwordErrors.length > 0) {
        toast.error(`Contraseña débil: ${passwordErrors.join(', ')}`);
        return;
      }

      setSubmitting(true);
      const auth = getAuth();
      const originalUser = currentUser;

      try {
        // 1. Crear usuario en Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
        const newUserId = userCredential.user.uid;

        // 2. Crear documento en Firestore
        await setDoc(doc(db, 'users', newUserId), {
          email: form.email,
          name: form.name,
          lastName: form.lastName,
          role: form.role,
          createdAt: new Date(),
          status: 'active'
        });

        // 3. Volver a loguear como el usuario original (admin) para mantener la sesión
        if (originalUser && originalUser.email) {
          // Obtenemos la contraseña del usuario original del localStorage (debe estar guardada en login)
          const adminPassword = sessionStorage.getItem('adminPassword');
          if (adminPassword) {
            try {
              await signOut(auth);
              await signInWithEmailAndPassword(auth, originalUser.email, adminPassword);
              toast.success(`Usuario ${form.email} creado correctamente. Sesión restaurada.`);
            } catch (reAuthError) {
              toast.warning(`Usuario creado pero no se pudo restaurar la sesión. Recargue la página.`);
            }
          } else {
            await signOut(auth);
            toast.warning(`Usuario creado correctamente, pero debe volver a iniciar sesión.`);
          }
        }

        // 4. Actualizar lista de usuarios
        setUsers([{ 
          id: newUserId, 
          email: form.email, 
          name: form.name, 
          lastName: form.lastName, 
          role: form.role 
        }, ...users]);

        handleCloseModal();
      } catch (error) {
        console.error("Error creating user:", error);
        if (error.code === 'auth/email-already-in-use') {
          toast.error('Este correo ya está registrado en el sistema');
        } else if (error.code === 'auth/weak-password') {
          toast.error('La contraseña es muy débil. Debe cumplir con los requisitos.');
        } else {
          toast.error(`Error: ${error.message}`);
        }
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleDefaultPeriodChange = (newPeriod) => {
    setDefaultPeriod(newPeriod);
    // Aquí se puede agregar lógica para actualizar el periodo en otros módulos
  };

  if (loading) return <div className="text-[#23408e] font-semibold">Cargando usuarios...</div>;

  return (
    <div className="bg-white p-8 rounded-lg shadow-md border-l-4 border-[#23408e] max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[#23408e]">Gestión de Usuarios</h2>
        {currentUser.role === 'admin' && (
          <button
            className="bg-[#009245] text-white px-4 py-2 rounded-md hover:bg-[#007a36] font-semibold"
            onClick={handleNewUser}
          >
            + Nuevo Usuario
          </button>
        )}
      </div>

      {/* Período por Defecto */}
      {currentUser.role === 'admin' && (
        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <label className="block text-sm font-bold text-[#23408e] mb-2">
            Período Académico por Defecto
          </label>
          <div className="flex items-center gap-3">
            <select
              value={defaultPeriod}
              onChange={(e) => setDefaultPeriod(e.target.value)}
              className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e] font-semibold text-[#009245]"
            >
              {periodOptions.map(period => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-600">
              Este período se aplicará por defecto en Asistencia, Finanzas y Notas
            </p>
          </div>
        </div>
      )}

      {/* Filtros y Búsqueda */}
      <div className="flex justify-start items-center mb-4 gap-4">
        <input
          type="text"
          placeholder="Buscar por nombre o apellido..."
          className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Todos los roles</option>
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full relative border-l-4 border-[#23408e] my-8">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl"
              onClick={handleCloseModal}
              disabled={submitting}
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold mb-2 text-[#23408e]">
              {editId ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {editId ? 'Actualiza la información del usuario' : 'Completa todos los campos requeridos (*)'}
            </p>
            
            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block font-semibold mb-1 text-[#009245]">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                  required
                  disabled={!!editId || submitting}
                  placeholder="usuario@ejemplo.com"
                />
                {!editId && <p className="text-xs text-gray-500 mt-1">No puede ser modificado luego</p>}
              </div>

              {/* Nombre */}
              <div>
                <label className="block font-semibold mb-1 text-[#009245]">Nombre *</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                  required
                  disabled={submitting}
                  placeholder="Juan"
                />
              </div>

              {/* Apellido */}
              <div>
                <label className="block font-semibold mb-1 text-[#009245]">Apellido</label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                  disabled={submitting}
                  placeholder="Pérez"
                />
              </div>

              {/* Rol */}
              <div>
                <label className="block font-semibold mb-1 text-[#009245]">Rol *</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                  required
                  disabled={submitting}
                >
                  <option value="" disabled>-- Selecciona un rol --</option>
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Contraseña - Solo en modo creación */}
              {!editId && (
                <>
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-gray-700 mb-3 text-center">Requisitos de Contraseña</p>
                    
                    <div>
                      <label className="block font-semibold mb-1 text-[#009245]">Contraseña *</label>
                      <input
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleFormChange}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                        required
                        disabled={submitting}
                        placeholder="Mínimo 8 caracteres"
                      />
                      
                      {/* Indicador de requisitos */}
                      {form.password && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs space-y-1">
                          <div className={validatePassword(form.password).length > 0 ? 'text-red-600' : 'text-green-600'}>
                            ✓ {form.password.length}+ caracteres ({PASSWORD_REQUIREMENTS.minLength} requeridos)
                          </div>
                          <div className={PASSWORD_REQUIREMENTS.hasUpperCase.test(form.password) ? 'text-green-600' : 'text-gray-400'}>
                            {PASSWORD_REQUIREMENTS.hasUpperCase.test(form.password) ? '✓' : '○'} Una mayúscula
                          </div>
                          <div className={PASSWORD_REQUIREMENTS.hasLowerCase.test(form.password) ? 'text-green-600' : 'text-gray-400'}>
                            {PASSWORD_REQUIREMENTS.hasLowerCase.test(form.password) ? '✓' : '○'} Una minúscula
                          </div>
                          <div className={PASSWORD_REQUIREMENTS.hasNumbers.test(form.password) ? 'text-green-600' : 'text-gray-400'}>
                            {PASSWORD_REQUIREMENTS.hasNumbers.test(form.password) ? '✓' : '○'} Un número
                          </div>
                          <div className={PASSWORD_REQUIREMENTS.hasSpecialChar.test(form.password) ? 'text-green-600' : 'text-gray-400'}>
                            {PASSWORD_REQUIREMENTS.hasSpecialChar.test(form.password) ? '✓' : '○'} Un carácter especial (!@#$%^&*)
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <label className="block font-semibold mb-1 text-[#009245]">Confirmar Contraseña *</label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={handleFormChange}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                        required
                        disabled={submitting}
                        placeholder="Repite la contraseña"
                      />
                      {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                        <p className="text-xs text-red-600 mt-1">Las contraseñas no coinciden</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Botones */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || (passwordErrors.length > 0 && !editId)}
                  className="px-4 py-2 bg-[#009245] text-white rounded-md hover:bg-[#23408e] font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && <span className="animate-spin">⏳</span>}
                  {submitting ? 'Procesando...' : editId ? 'Actualizar' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full relative border-t-4 border-[#23408e]">
            <h3 className="text-lg font-bold mb-4 text-[#23408e]">¿Eliminar usuario?</h3>
            <p className="mb-6 text-gray-700">Esta acción no se puede deshacer. ¿Deseas continuar?</p>
            <div className="flex justify-end gap-4">
              <button 
                onClick={cancelDelete} 
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete} 
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de usuarios */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[#e3eafc]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-[#23408e] uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-[#23408e] uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-[#23408e] uppercase">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-[#23408e] uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users
              .filter(user => {
                const fullName = `${user.name || ''} ${user.lastName || ''}`.toLowerCase();
                const search = searchTerm.toLowerCase();
                const roleMatch = roleFilter ? user.role === roleFilter : true;
                const nameMatch = fullName.includes(search);
                return roleMatch && nameMatch;
              })
              .map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-[#23408e]">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {user.name} {user.lastName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {currentUser.uid === user.id ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {ROLES.find(r => r.value === user.role)?.label || user.role} (Tú)
                    </span>
                  ) : currentUser.role === 'admin' ? (
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="border border-gray-300 rounded-md p-1 text-sm"
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      {ROLES.find(r => r.value === user.role)?.label || user.role}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                  <button
                    onClick={() => handleViewUser(user)}
                    className="text-[#23408e] hover:underline"
                    title="Ver"
                  >
                    Ver
                  </button>
                  {currentUser.role === 'admin' && (
                    <>
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-[#ffd600] hover:text-[#23408e] font-semibold"
                        title="Editar"
                      >
                        Editar
                      </button>
                      {currentUser.uid !== user.id && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900 font-semibold"
                          title="Eliminar"
                        >
                          Eliminar
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
