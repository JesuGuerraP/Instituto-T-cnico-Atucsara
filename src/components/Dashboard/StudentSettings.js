import { useState, useContext, useEffect } from 'react';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const StudentSettings = () => {
  const { currentUser, setCurrentUser } = useContext(AuthContext);
  const [academicPeriods, setAcademicPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(currentUser?.preferredPeriod || '2025-1');
  const [savingPref, setSavingPref] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Reglas de contraseña (coincidentes con UserManagement)
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMsg('');
    if (newPassword !== confirmPassword) {
      setMsg('La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    const pwErrors = validatePassword(newPassword);
    if (pwErrors.length > 0) {
      const msgText = 'Contraseña inválida: ' + pwErrors.join(', ');
      setMsg(msgText);
      toast.error(msgText);
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
      const successMsg = 'Contraseña actualizada correctamente.';
      setMsg(successMsg);
      toast.success(successMsg);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        const em = 'La contraseña actual es incorrecta.';
        setMsg(em);
        toast.error(em);
      } else if (error.code === 'auth/weak-password') {
        const em = 'La nueva contraseña es demasiado débil. Debe cumplir los requisitos.';
        setMsg(em);
        toast.error(em);
      } else if (error.code === 'auth/requires-recent-login') {
        const em = 'Por seguridad, debes volver a iniciar sesión para cambiar la contraseña.';
        setMsg(em);
        toast.error(em);
      } else {
        const em = 'Error: ' + (error.message || error.code);
        setMsg(em);
        toast.error(em);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadPeriods = async () => {
      try {
        const periodsSnap = await getDocs(collection(db, 'academicPeriods'));
        const periods = periodsSnap.docs.map(doc => doc.data().period).filter(Boolean);
        const uniquePeriods = Array.from(new Set([...periods, '2025-1']));
        setAcademicPeriods(uniquePeriods.sort((a,b) => {
          const [yearA, periodA] = a.split('-');
          const [yearB, periodB] = b.split('-');
          if (yearB !== yearA) return parseInt(yearB) - parseInt(yearA);
          return parseInt(periodB) - parseInt(periodA);
        }));
      } catch (e) { console.warn('Error loading periods:', e); }
    };
    loadPeriods();
  }, []);

  const handleSavePreferences = async () => {
    if (!currentUser) return;
    setSavingPref(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        preferredPeriod: selectedPeriod
      });
      setCurrentUser(prev => ({ ...prev, preferredPeriod: selectedPeriod }));
      toast.success('Preferencias guardadas correctamente');
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar las preferencias');
    } finally {
      setSavingPref(false);
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

  const pwErrors = validatePassword(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword !== '';
  const canSubmit = !loading && passwordsMatch && pwErrors.length === 0 && currentPassword;

  return (
    <div className="max-w-5xl mx-auto mt-10 px-4 pb-20">
      {/* ── HEADER CARD ── */}
      <div className="bg-gradient-to-r from-[#23408e] to-[#3b5cbd] rounded-[2.5rem] shadow-2xl overflow-hidden mb-8 text-white relative">
        <div className="px-10 py-10 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-4xl border-2 border-white/30 shadow-lg">
              👤
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest border border-white/10">
                  {currentUser?.role === 'teacher' ? 'Perfil Docente' : 'Perfil Estudiante'}
                </span>
                <span className="px-3 py-1 rounded-full bg-green-500/30 text-[10px] font-black uppercase tracking-widest border border-green-400/30 text-green-300">
                  Activo
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight">{currentUser?.displayName || (currentUser?.role === 'teacher' ? 'Catedrático' : 'Estudiante')}</h1>
              <p className="text-white/60 font-bold tracking-tight">{currentUser?.email}</p>
              {getRegistrationDate() && (
                <p className="text-white/40 text-[10px] font-black uppercase mt-2 tracking-widest">Registrado: {getRegistrationDate()}</p>
              )}
            </div>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-white/30 text-sm font-black uppercase tracking-[0.3em] mb-1">Instituto Atucsara</div>
            <div className="text-[#ffd600] text-lg font-black italic tracking-tighter">Sistema de Gestión Académica</div>
          </div>
        </div>
        <div className="absolute top-[-40%] right-[-10%] w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* ── LEFT COLUMN: PREFERENCES ── */}
        <div className="space-y-8">
          {(currentUser?.role === 'teacher' || currentUser?.role === 'admin') && (
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-[#ffd600] rounded-full" />
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">Configuración Académica</h3>
                </div>
                
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Personaliza tu experiencia de trabajo. Esta preferencia determinará qué periodo aparecerá seleccionado por defecto en tus gestores de <span className="font-bold text-[#23408e]">Notas</span> y <span className="font-bold text-[#23408e]">Asistencia</span>.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="relative group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Periodo Predeterminado</label>
                    <select
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      className="w-full appearance-none bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-slate-700 font-black text-sm focus:border-[#23408e] focus:bg-white outline-none transition-all cursor-pointer group-hover:border-slate-200"
                    >
                      {academicPeriods.map(p => (
                        <option key={p} value={p}>Periodo Académico {p.replace('-', ' - ')}</option>
                      ))}
                    </select>
                    <div className="absolute top-[38px] right-6 flex items-center pointer-events-none text-slate-400 group-hover:text-[#23408e] transition-colors">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <button
                    onClick={handleSavePreferences}
                    disabled={savingPref}
                    className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
                      savingPref 
                        ? 'bg-slate-100 text-slate-400' 
                        : 'bg-[#23408e] text-white hover:bg-[#1a316e] shadow-lg shadow-blue-100 active:scale-95'
                    }`}
                  >
                    {savingPref ? (
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                    ) : 'Guardar Preferencia'}
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 px-8 py-4 border-t border-slate-100">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center">
                  El sistema recordará esta selección en todas tus sesiones.
                </p>
              </div>
            </div>
          )}

          {/* Tips Card */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-8 space-y-4">
            <h4 className="font-black text-indigo-900 text-sm uppercase tracking-widest flex items-center gap-2">
              <span>💡</span> Consejos de Seguridad
            </h4>
            <ul className="text-xs text-indigo-700/80 space-y-3 font-bold">
              <li className="flex gap-3">
                <span className="text-indigo-400">•</span> Utiliza al menos 8 caracteres para tu contraseña.
              </li>
              <li className="flex gap-3">
                <span className="text-indigo-400">•</span> Combina mayúsculas, minúsculas, números y símbolos.
              </li>
              <li className="flex gap-3">
                <span className="text-indigo-400">•</span> No compartas tus credenciales de acceso con terceros.
              </li>
              <li className="flex gap-3">
                <span className="text-indigo-400">•</span> Cierra tu sesión al terminar de trabajar en un dispositivo público.
              </li>
            </ul>
          </div>
        </div>

        {/* ── RIGHT COLUMN: SECURITY ── */}
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-red-500 rounded-full" />
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">Seguridad y Acceso</h3>
            </div>
            
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Mantén tu cuenta protegida actualizando tu contraseña periódicamente.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña Actual</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-slate-700 font-black text-sm focus:border-[#23408e] focus:bg-white outline-none transition-all"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-slate-700 font-black text-sm focus:border-[#23408e] focus:bg-white outline-none transition-all"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  placeholder="Nueva clave fuerte"
                />
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl space-y-2 border border-slate-100">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                    <div className={`text-[9px] font-black uppercase tracking-tight flex items-center gap-1.5 transition-all ${newPassword.length >= 8 ? 'text-green-600 line-through opacity-50' : 'text-slate-400'}`}>
                      {newPassword.length >= 8 ? '✓' : '○'} 8+ Caracteres
                    </div>
                    <div className={`text-[9px] font-black uppercase tracking-tight flex items-center gap-1.5 transition-all ${PASSWORD_REQUIREMENTS.hasUpperCase.test(newPassword) ? 'text-green-600 line-through opacity-50' : 'text-slate-400'}`}>
                      {PASSWORD_REQUIREMENTS.hasUpperCase.test(newPassword) ? '✓' : '○'} Mayúscula
                    </div>
                    <div className={`text-[9px] font-black uppercase tracking-tight flex items-center gap-1.5 transition-all ${PASSWORD_REQUIREMENTS.hasLowerCase.test(newPassword) ? 'text-green-600 line-through opacity-50' : 'text-slate-400'}`}>
                      {PASSWORD_REQUIREMENTS.hasLowerCase.test(newPassword) ? '✓' : '○'} Minúscula
                    </div>
                    <div className={`text-[9px] font-black uppercase tracking-tight flex items-center gap-1.5 transition-all ${PASSWORD_REQUIREMENTS.hasNumbers.test(newPassword) ? 'text-green-600 line-through opacity-50' : 'text-slate-400'}`}>
                      {PASSWORD_REQUIREMENTS.hasNumbers.test(newPassword) ? '✓' : '○'} Número
                    </div>
                    <div className={`text-[9px] font-black uppercase tracking-tight flex items-center gap-1.5 transition-all ${PASSWORD_REQUIREMENTS.hasSpecialChar.test(newPassword) ? 'text-green-600 line-through opacity-50' : 'text-slate-400'}`}>
                      {PASSWORD_REQUIREMENTS.hasSpecialChar.test(newPassword) ? '✓' : '○'} Símbolo
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Nueva Contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-slate-700 font-black text-sm focus:border-[#23408e] focus:bg-white outline-none transition-all"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  placeholder="Repite la clave"
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-2 ml-1">Las contraseñas no coinciden</p>
                )}
              </div>

              <div className="flex items-center gap-3 ml-1">
                <div 
                  onClick={() => setShowPassword(!showPassword)}
                  className={`w-10 h-6 rounded-full transition-all cursor-pointer relative ${showPassword ? 'bg-[#23408e]' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showPassword ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                  Mostrar contraseñas
                </span>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg flex items-center justify-center gap-3 ${
                  !canSubmit 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-[#23408e] text-white hover:bg-[#1a316e] hover:-translate-y-1 active:scale-95 shadow-blue-100'
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                ) : 'Actualizar Seguridad'}
              </button>

              {msg && (
                <div className={`p-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-center animate-in fade-in zoom-in-95 ${
                  msg.includes('correctamente') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                }`}>
                  {msg}
                </div>
              )}
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StudentSettings;
