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
  const [showPassword, setShowPassword] = useState(false);

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

  // Utilidad para mostrar fecha de registro si existe
  const getRegistrationDate = () => {
    if (currentUser && currentUser.metadata && currentUser.metadata.creationTime) {
      const date = new Date(currentUser.metadata.creationTime);
      return date.toLocaleDateString();
    }
    return null;
  };

  return (
    <div className="max-w-lg mx-auto mt-10 bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
      {/* Sección de información de usuario */}
      <div className="flex items-center gap-4 mb-8 border-b pb-6 border-gray-100">
        <div className="bg-[#23408e] text-white rounded-full w-16 h-16 flex items-center justify-center text-3xl font-bold">
          <span role="img" aria-label="user">👤</span>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-800">{currentUser?.displayName || (currentUser?.role === 'teacher' ? 'Profesor' : 'Estudiante')}</div>
          <div className="text-sm text-gray-600">{currentUser?.email}</div>
          {getRegistrationDate() && (
            <div className="text-xs text-gray-400 mt-1">Miembro desde: {getRegistrationDate()}</div>
          )}
        </div>
      </div>

      {/* Sección de cambio de contraseña */}
      <h2 className="text-xl font-bold mb-2 text-[#23408e] flex items-center gap-2">
        <span role="img" aria-label="lock">🔒</span> Seguridad y contraseña
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Cambia tu contraseña regularmente para mantener tu cuenta segura. Asegúrate de elegir una contraseña fuerte y única.
      </p>
      <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Contraseña actual</label>
          <input
            type={showPassword ? 'text' : 'password'}
            className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#23408e]"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
            disabled={loading}
            autoComplete="current-password"
            placeholder="Introduce tu contraseña actual"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Nueva contraseña</label>
          <input
            type={showPassword ? 'text' : 'password'}
            className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#23408e]"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            minLength={6}
            required
            disabled={loading}
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres, combina letras y números"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Confirmar nueva contraseña</label>
          <input
            type={showPassword ? 'text' : 'password'}
            className="border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#23408e]"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            minLength={6}
            required
            disabled={loading}
            autoComplete="new-password"
            placeholder="Repite la nueva contraseña"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showPassword"
            checked={showPassword}
            onChange={() => setShowPassword(!showPassword)}
            disabled={loading}
          />
          <label htmlFor="showPassword" className="text-xs text-gray-600 cursor-pointer">Mostrar contraseñas</label>
        </div>
        <button
          type="submit"
          className="bg-[#23408e] text-white rounded px-4 py-2 font-semibold hover:bg-[#009245] transition disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Cambiando...' : 'Cambiar contraseña'}
        </button>
        {msg && (
          <div className={`text-sm mt-2 ${msg.includes('correctamente') ? 'text-green-600' : 'text-red-600'}`}>{msg}</div>
        )}
      </form>
      {/* Consejos de seguridad */}
      <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <div className="font-semibold text-blue-800 mb-1 flex items-center gap-1">
          <span role="img" aria-label="info">ℹ️</span> Consejos para una contraseña segura:
        </div>
        <ul className="text-xs text-blue-700 list-disc ml-5">
          <li>Utiliza al menos 8 caracteres.</li>
          <li>Incluye letras mayúsculas, minúsculas, números y símbolos.</li>
          <li>No uses información personal fácil de adivinar.</li>
          <li>Cambia tu contraseña periódicamente.</li>
        </ul>
      </div>
    </div>
  );
};

export default StudentSettings;
