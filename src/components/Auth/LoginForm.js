import { useState, useContext, useEffect } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AuthContext } from '../../context/AuthContext';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Estado para la animación de carga
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);

  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); // Mostrar animación de carga
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('¡Bienvenido!');
      // No navegamos aquí, dejamos que el useEffect lo haga cuando currentUser cambie
    } catch (err) {
      toast.error('Correo o contraseña incorrectos');
      setError('Correo o contraseña incorrectos');
    } finally {
      setLoading(false); // Ocultar animación de carga
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Por favor, ingresa tu correo electrónico para restablecer la contraseña.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success('Enlace enviado. Revisa tu bandeja de entrada o spam.', {
        position: "top-center",
        autoClose: 5000,
      });
      setIsResetMode(false);
      setResetEmail('');
    } catch (err) {
      console.error('Error reset password:', err);
      // Personalizar el mensaje de error para una mejor UX
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
         toast.error('No hay un usuario registrado con este correo.');
      } else {
         toast.error('Ocurrió un error al intentar restablecer la contraseña.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-green-100 to-white">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-2xl shadow-2xl border-t-8 border-green-600">
        <div className="flex flex-col items-center">
          <img
            src="/assets/logoInstituto.jpg"
            alt="Logo Instituto Técnico Laboral Atucsara"
            className="w-28 h-28 mb-2"
            style={{ objectFit: 'contain' }}
          />
          <h1 className="text-2xl font-extrabold text-blue-900 text-center">
            INSTITUTO TÉCNICO LABORAL ATUCSARA
          </h1>
          <p className="text-green-700 font-semibold text-center mb-2">
            Innovación y Excelencia
          </p>
          <p className="text-gray-500 text-center text-sm mb-2">
            Plataforma de gestión académica
          </p>
        </div>
        {loading ? (
          <div className="flex justify-center items-center">
            <div className="loader border-t-4 border-green-600 rounded-full w-12 h-12 animate-spin"></div>
          </div>
        ) : isResetMode ? (
          <div className="mt-6 bg-blue-50 p-6 rounded-xl border border-blue-100 animate-fade-in-down transition-all duration-300">
             <h2 className="text-xl font-bold text-blue-900 mb-4 text-center">Restablecer Contraseña</h2>
             <p className="text-sm text-gray-600 mb-6 text-center">
               Ingresa tu correo electrónico y te enviaremos un enlace para que puedas recuperar el acceso a tu cuenta.
             </p>
             <form className="space-y-6" onSubmit={handleResetPassword}>
               <div>
                 <label htmlFor="reset-email" className="block text-blue-900 font-semibold mb-1">
                   Correo electrónico
                 </label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                       <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                       <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                     </svg>
                   </div>
                   <input
                     id="reset-email"
                     name="email"
                     type="email"
                     required
                     className="block w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-blue-900 transition-all duration-200"
                     placeholder="ejemplo@instituto.edu.co"
                     value={resetEmail}
                     onChange={(e) => setResetEmail(e.target.value)}
                   />
                 </div>
               </div>
               
               <div className="space-y-3">
                 <button
                   type="submit"
                   className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
                 >
                   Enviar enlace de recuperación
                 </button>
                 <button
                   type="button"
                   onClick={() => setIsResetMode(false)}
                   className="w-full py-3 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-2"
                 >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                   Volver al inicio de sesión
                 </button>
               </div>
             </form>
          </div>
        ) : (
          <form className="mt-6 space-y-6 animate-fade-in transition-all duration-300" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-blue-900 font-semibold mb-1">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  className="block w-full px-4 py-2 border border-green-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:outline-none text-blue-900 transition-colors"
                  placeholder="ejemplo@instituto.edu.co"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-blue-900 font-semibold mb-1">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full px-4 py-2 border border-green-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:outline-none text-blue-900 transition-colors"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setIsResetMode(true);
                }}
                className="text-sm font-semibold text-green-600 hover:text-green-800 transition-colors duration-200"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <div>
              <button
                type="submit"
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
              >
                Iniciar sesión
              </button>
            </div>
          </form>
        )}
        <div className="mt-6 text-center text-gray-400 text-xs">
          &copy; {new Date().getFullYear()} Instituto Técnico Laboral Atucsara. Todos los derechos reservados. <br />Development & Design: Jesús Guerra
        </div>
      </div>
    </div>
  );
};

export default LoginForm;