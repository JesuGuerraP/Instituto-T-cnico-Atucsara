import { useState, useContext, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AuthContext } from '../../context/AuthContext';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Estado para la animación de carga
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
        ) : (
          <form className="mt-6 space-y-6" onSubmit={handleLogin}>
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
                  className="block w-full px-4 py-2 border border-green-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:outline-none text-blue-900"
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
                  className="block w-full px-4 py-2 border border-green-400 rounded-lg focus:ring-2 focus:ring-green-600 focus:outline-none text-blue-900"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition duration-150"
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