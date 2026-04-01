import React, { useState } from 'react';
import { 
  User, 
  Lock, 
  Key, 
  Mail, 
  Phone, 
  CheckOne, 
  Attention,
  Shield,
  UpdateRotation,
  PersonalPrivacy,
  Announcement
} from '@icon-park/react';
import PremiumCard from './PremiumCard';
import { getAuth, updatePassword } from 'firebase/auth';

const SettingsSection = ({ studentInfo, currentUser }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Password Validation Logic
  const validations = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*]/.test(newPassword)
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!validations.length || !validations.upper || !validations.lower || !validations.number || !validations.special) {
      setMessage({ type: 'error', text: 'La contraseña no cumple con todos los requisitos de seguridad.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    const auth = getAuth();
    const user = auth.currentUser;

    try {
      // Nota: Firebase requiere re-autenticación para cambios de contraseña sensibles si la sesión es antigua.
      // Aquí se procede con updatePassword directamente siguiendo la lógica previa.
      await updatePassword(user, newPassword);
      setMessage({ type: 'success', text: 'Contraseña actualizada correctamente.' });
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Error de seguridad. Reintenta iniciando sesión nuevamente para confirmar tu identidad.' });
    } finally {
      setLoading(false);
    }
  };

  const ValidationItem = ({ fulfilled, text }) => (
    <div className={`flex items-center gap-2 text-[11px] font-bold transition-all duration-300 ${fulfilled ? 'text-green-500' : 'text-gray-400'}`}>
      <span className="flex-shrink-0">
        {fulfilled ? '✓' : '○'}
      </span>
      <span className={fulfilled ? 'line-through decoration-2 opacity-60' : ''}>{text}</span>
    </div>
  );

  return (
    <div className="space-y-8 animate-in pb-12">
      <div>
        <h1 className="text-3xl font-black text-[#23408e] tracking-tight">Mi Perfil y Seguridad</h1>
        <div className="flex items-center gap-2 mt-2">
           <span className="px-3 py-1 rounded-full bg-blue-100 text-[#23408e] text-[10px] font-black uppercase tracking-widest">{currentUser?.role || 'Estudiante'}</span>
           <span className="text-gray-400 font-bold text-sm">{currentUser?.email}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-10">
        {/* Profile Info */}
        <div className="space-y-8">
          <PremiumCard title="Información Personal" icon={User}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nombre Completo</label>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <User theme="outline" size="18" className="text-gray-400" />
                  <span className="font-bold text-gray-700">{studentInfo?.name || currentUser?.displayName || 'No definido'}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Correo Electrónico</label>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <Mail theme="outline" size="18" className="text-gray-400" />
                  <span className="font-bold text-gray-700">{currentUser?.email}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Teléfono</label>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                   <Phone theme="outline" size="18" className="text-gray-400" />
                   <span className="font-bold text-gray-700">{studentInfo?.phone || 'No registrado'}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Carrera / Programa</label>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <Shield theme="outline" size="18" className="text-gray-400" />
                  <span className="font-bold text-gray-700">{studentInfo?.career || '-'}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 rounded-3xl bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-3 mb-3">
                  <Announcement theme="outline" size="20" className="text-[#23408e]" />
                  <h4 className="font-black text-sm text-[#23408e]">Oficina Virtual</h4>
              </div>
              <p className="text-sm text-blue-700 font-medium leading-relaxed">
                  Recuerda que para modificar datos críticos como tu nombre o carrera, debes solicitarlo formalmente ante la secretaría académica del instituto.
              </p>
            </div>
          </PremiumCard>
        </div>

        {/* Security / Password */}
        <div className="space-y-8">
          <PremiumCard title="Seguridad y contraseña" icon={Lock}>
            <div className="mb-6">
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                Cambia tu contraseña regularmente para mantener tu cuenta segura. Asegúrate de elegir una contraseña fuerte y única.
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-gray-900 px-1">Contraseña actual</label>
                  <input 
                    type={showPassword ? "text" : "password"}
                    placeholder="Introduce tu contraseña actual"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 rounded-2xl border border-gray-100 focus:bg-white focus:border-[#23408e] transition-all font-bold text-gray-700 placeholder:font-normal text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-gray-900 px-1">Nueva contraseña</label>
                  <input 
                    type={showPassword ? "text" : "password"}
                    placeholder="Nueva contraseña"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 rounded-2xl border border-gray-100 focus:bg-white focus:border-[#23408e] transition-all font-bold text-gray-700 placeholder:font-normal text-sm"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-gray-900 px-1">Confirmar nueva contraseña</label>
                  <input 
                    type={showPassword ? "text" : "password"}
                    placeholder="Repite la nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 rounded-2xl border border-gray-100 focus:bg-white focus:border-[#23408e] transition-all font-bold text-gray-700 placeholder:font-normal text-sm"
                    required
                  />
                </div>
              </div>
              
              <div className="px-1">
                <p className="text-[11px] text-gray-400 font-black uppercase tracking-widest mb-3">Requisitos de la Nueva Contraseña:</p>
                {/* Requirements Checklist in 2 columns for better vertical space */}
                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  <ValidationItem fulfilled={validations.length} text={`${newPassword.length}+ caracteres (8 requeridos)`} />
                  <ValidationItem fulfilled={validations.upper} text="Una mayúscula" />
                  <ValidationItem fulfilled={validations.lower} text="Una minúscula" />
                  <ValidationItem fulfilled={validations.number} text="Un número" />
                  <ValidationItem fulfilled={validations.special} text="Un carácter especial (!@#$%^&*)" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-1">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="showPass" 
                    checked={showPassword} 
                    onChange={() => setShowPassword(!showPassword)}
                    className="w-4 h-4 rounded border-gray-300 text-[#23408e] focus:ring-[#23408e]" 
                  />
                  <label htmlFor="showPass" className="text-[11px] font-bold text-gray-500 uppercase tracking-widest cursor-pointer select-none">Mostrar contraseñas</label>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-12 py-4 bg-[#23408e] text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? 'Procesando...' : 'Cambiar contraseña'}
                </button>
              </div>

              {message.text && (
                <div className={`p-4 rounded-2xl text-xs font-bold animate-in slide-in-from-top-1 ${
                  message.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
                }`}>
                  {message.text}
                </div>
              )}
            </form>
          </PremiumCard>

          <div className="p-8 rounded-3xl bg-gray-900 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-[0.03] group-hover:opacity-[0.08] transition-all rounded-full -mr-16 -mt-16 blur-3xl" />
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 shadow-inner flex items-center justify-center">
                    <Announcement theme="outline" size="22" />
                  </div>
                  <h4 className="font-black text-sm text-white tracking-tight">Consejos para una contraseña segura:</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    'Utiliza al menos 8 caracteres.',
                    'Incluye letras mayúsculas, minúsculas, números y símbolos.',
                    'No uses información personal fácil de guess.',
                    'Cambia tu contraseña periódicamente.'
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                      <p className="text-xs text-gray-400 font-medium leading-relaxed">{tip}</p>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsSection;
