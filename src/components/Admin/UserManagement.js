import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'teacher', label: 'Profesor' },
  { value: 'secretary', label: 'Secretaría' },
  { value: 'student', label: 'Estudiante' }
];

const initialFormState = {
  email: '',
  password: '',
  name: '',
  lastName: '',
  role: ''
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...initialFormState });
  const [editId, setEditId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

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
  };

  const handleNewUser = () => {
    setEditId(null);
    setForm({ ...initialFormState });
    setShowForm(true);
  };

  const handleCloseModal = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ ...initialFormState });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.role || (!editId && !form.password)) {
      toast.error('Email, rol y contraseña son obligatorios');
      return;
    }

    try {
      if (editId) {
        // Editar usuario existente
        const { password, ...rest } = form;
        await updateDoc(doc(db, 'users', editId), rest);
        setUsers(users.map(u => u.id === editId ? { ...u, ...rest } : u));
        toast.success('Usuario actualizado correctamente');
      } else {
        // Crear nuevo usuario
        const auth = getAuth();
        const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
        const newId = userCredential.user.uid;
        const { password, ...userData } = form;
        await setDoc(doc(db, 'users', newId), userData);
        setUsers([{ id: newId, ...userData }, ...users]);
        toast.success('Usuario creado correctamente');
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving user:", error);
      toast.error('Error guardando usuario: ' + (error.message || error));
    }
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

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full relative border-l-4 border-[#23408e]">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl"
              onClick={handleCloseModal}
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold mb-4 text-[#23408e]">
              {editId ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}
            </h2>
            <form onSubmit={handleFormSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block font-semibold mb-1 text-[#009245]">Email*</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleFormChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                    required
                    disabled={!!editId}
                    placeholder="ejemplo@correo.com"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#009245]">Rol*</label>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleFormChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                    required
                  >
                    <option value="" disabled>Selecciona un rol</option>
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                {!editId && (
                  <div>
                    <label className="block font-semibold mb-1 text-[#009245]">Contraseña*</label>
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleFormChange}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                      required
                      placeholder="Mínimo 6 caracteres"
                      minLength="6"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-semibold mb-1 text-[#009245]">Nombre</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                    placeholder="Nombre del usuario"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[#009245]">Apellido</label>
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleFormChange}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#23408e]"
                    placeholder="Apellido del usuario"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#009245] text-white rounded-md hover:bg-[#23408e] font-semibold"
                >
                  {editId ? 'Actualizar' : 'Guardar'}
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
            {users.map((user) => (
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