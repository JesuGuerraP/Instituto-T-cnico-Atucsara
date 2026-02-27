import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Este componente intercepta los enlaces genéricos de Firebase
 * (/__/auth/action?mode=resetPassword&oobCode=XXX)
 * y los redirecciona a nuestro componente ResetPassword personalizado
 */
const AuthAction = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');

    if (mode === 'resetPassword' && oobCode) {
      // Redireccionar a nuestra página personalizada con el oobCode
      navigate(`/reset-password?oobCode=${oobCode}`);
    } else if (mode === 'signIn' && oobCode) {
      // Para otros modos, simplemente redirigir a login
      navigate('/login');
    } else {
      // Si falta parámetros, ir a login
      navigate('/login');
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="text-center">
        <p className="text-gray-600">Procesando...</p>
      </div>
    </div>
  );
};

export default AuthAction;
