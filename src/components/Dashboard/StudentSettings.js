import { useState, useContext } from 'react';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { AuthContext } from '../../context/AuthContext';

const StudentSettings = () => {
  const { currentUser } = useContext(AuthContext);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMsg('');
    if (newPassword !== confirmPassword) {
      setMsg('La nueva contraseña y la confirmación no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      setMsg('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('Usuario no autenticado.');
      // Reautenticación
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setMsg('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        setMsg('La contraseña actual es incorrecta.');
      } else if (error.code === 'auth/weak-password') {
        setMsg('La nueva contraseña es demasiado débil.');
      } else if (error.code === 'auth/requires-recent-login') {
        setMsg('Por seguridad, debes volver a iniciar sesión para cambiar la contraseña.');
      } else {
        setMsg('Error: ' + (error.message || error.code));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white rounded-xl shadow p-6 border border-gray-200">
      <h2 className="text-2xl font-bold mb-4 text-[#23408e]">Configuración de cuenta</h2>
      <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Contraseña actual</label>
          <input
            type="password"
            className="border rounded px-3 py-2 w-full"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Nueva contraseña</label>
          <input
            type="password"
            className="border rounded px-3 py-2 w-full"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            minLength={6}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Confirmar nueva contraseña</label>
          <input
            type="password"
            className="border rounded px-3 py-2 w-full"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            minLength={6}
            required
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          className="bg-[#23408e] text-white rounded px-4 py-2 font-semibold hover:bg-[#009245] transition"
          disabled={loading}
        >
          {loading ? 'Cambiando...' : 'Cambiar contraseña'}
        </button>
        {msg && (
          <div className={`text-sm mt-2 ${msg.includes('correctamente') ? 'text-green-600' : 'text-red-600'}`}>{msg}</div>
        )}
      </form>
    </div>
  );
};

export default StudentSettings;
