
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();

  // Pendant le chargement de la session, ne pas rediriger (évite le reset sur F5)
  if (isLoading) {
    return <></>;
  }

  // DEV: accepte le user de dev même si pas d'appel API
  if (!user) {
    if (import.meta.env.DEV && localStorage.getItem('token') === 'dev-token') {
      return <Outlet />;
    }
    // Non authentifié une fois le chargement terminé
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
