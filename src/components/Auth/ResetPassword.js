import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { toast } from 'react-toastify';

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  hasUpperCase: /[A-Z]/,
  hasLowerCase: /[a-z]/,
  hasNumbers: /[0-9]/,
  hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
};

const validatePassword = (password) => {
  const errors = [];
  if ((password || '').length < PASSWORD_REQUIREMENTS.minLength) {
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

const ResetPassword = () => {
  const navigate = useNavigate();
  const [oobCode, setOobCode] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Obtener oobCode de parámetros URL (múltiples formatos soportados)
    const params = new URLSearchParams(window.location.search);
    let code = params.get('oobCode');
    
    // Soporte para formato genérico de Firebase (__/auth/action?mode=resetPassword&oobCode=XXX)
    if (!code) {
      code = params.get('code');
    }
    
    // Si no viene en query, intentar extraerlo del hash
    if (!code && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      code = hashParams.get('oobCode') || hashParams.get('code');
    }
    
    if (!code) {
      setError('Código de restablecimiento no proporcionado. Por favor, usa el enlace del correo electrónico.');
      setLoading(false);
      return;
    }
    setOobCode(code);

    const verify = async () => {
      try {
        const auth = getAuth();
        const emailFromCode = await verifyPasswordResetCode(auth, code);
        setEmail(emailFromCode);
      } catch (err) {
        console.error('Error verifying reset code:', err);
        setError('El enlace de restablecimiento es inválido o ha expirado. Solicita uno nuevo desde el login.');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    const pwErrors = validatePassword(newPassword);
    if (pwErrors.length > 0) {
      setError('Contraseña inválida: ' + pwErrors.join(', '));
      return;
    }

    setSubmitting(true);
    try {
      const auth = getAuth();
      await confirmPasswordReset(auth, oobCode, newPassword);
      toast.success('Contraseña restablecida correctamente. Inicia sesión con tu nueva contraseña.');
      navigate('/login');
    } catch (err) {
      console.error('Error confirming password reset:', err);
      setError('No se pudo restablecer la contraseña. Intenta solicitar un nuevo enlace.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-green-100 to-white">
        <div className="text-center">
          <div className="loader border-t-4 border-green-600 rounded-full w-12 h-12 animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Validando enlace de restablecimiento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-green-100 to-white p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border-t-8 border-green-600">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-green-600 text-white rounded-full w-16 h-16 flex items-center justify-center mb-3">
            <span className="text-2xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-[#23408e] text-center">Restablecer contraseña</h1>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-red-700 font-semibold mb-3">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Volver al login
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-2 text-center">
              Restableciendo acceso para:
            </p>
            <p className="text-sm font-semibold text-[#23408e] mb-6 text-center break-all">{email}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#009245] mb-2">Nueva contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:outline-none"
                  placeholder="Mínimo 8 caracteres"
                  required
                  disabled={submitting}
                />
                {newPassword && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs space-y-1">
                    <div className={validatePassword(newPassword).length > 0 ? 'text-red-600' : 'text-green-600'}>
                      ✓ {newPassword.length}+ caracteres ({PASSWORD_REQUIREMENTS.minLength} requeridos)
                    </div>
                    <div className={PASSWORD_REQUIREMENTS.hasUpperCase.test(newPassword) ? 'text-green-600' : 'text-gray-400'}>
                      {PASSWORD_REQUIREMENTS.hasUpperCase.test(newPassword) ? '✓' : '○'} Una mayúscula
                    </div>
                    <div className={PASSWORD_REQUIREMENTS.hasLowerCase.test(newPassword) ? 'text-green-600' : 'text-gray-400'}>
                      {PASSWORD_REQUIREMENTS.hasLowerCase.test(newPassword) ? '✓' : '○'} Una minúscula
                    </div>
                    <div className={PASSWORD_REQUIREMENTS.hasNumbers.test(newPassword) ? 'text-green-600' : 'text-gray-400'}>
                      {PASSWORD_REQUIREMENTS.hasNumbers.test(newPassword) ? '✓' : '○'} Un número
                    </div>
                    <div className={PASSWORD_REQUIREMENTS.hasSpecialChar.test(newPassword) ? 'text-green-600' : 'text-gray-400'}>
                      {PASSWORD_REQUIREMENTS.hasSpecialChar.test(newPassword) ? '✓' : '○'} Un carácter especial (!@#$%^&*)
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#009245] mb-2">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:outline-none"
                  placeholder="Repite la nueva contraseña"
                  required
                  disabled={submitting}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-600 mt-1">Las contraseñas no coinciden</p>
                )}
                {confirmPassword && newPassword === confirmPassword && newPassword !== '' && (
                  <p className="text-xs text-green-600 mt-1">✓ Las contraseñas coinciden</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || validatePassword(newPassword).length > 0 || !confirmPassword || newPassword !== confirmPassword}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting && <span className="animate-spin">⏳</span>}
                {submitting ? 'Procesando...' : 'Restablecer contraseña'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">¿Recordaste tu contraseña?</p>
              <button
                onClick={() => navigate('/login')}
                className="text-blue-600 hover:underline text-sm font-semibold"
              >
                Volver al login
              </button>
            </div>
          </>
        )}

        <div className="mt-8 text-center text-gray-400 text-xs border-t pt-4">
          &copy; {new Date().getFullYear()} Instituto Técnico Laboral Atucsara.
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
