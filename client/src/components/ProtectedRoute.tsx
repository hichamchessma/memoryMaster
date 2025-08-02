
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
  const { user } = useAuth();

  // DEV: accepte le user de dev même si pas d'appel API
  if (!user) {
    if (import.meta.env.DEV && localStorage.getItem('token') === 'dev-token') {
      // On considère l'utilisateur comme connecté en dev
      return <Outlet />;
    }
    // Sinon, redirige vers la page de connexion
    return <Navigate to="/login" replace />;
  }

  // Si l'utilisateur est connecté, affiche le contenu de la route protégée
  return <Outlet />;
};

export default ProtectedRoute;
