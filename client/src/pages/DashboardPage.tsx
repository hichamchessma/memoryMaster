
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto mt-10 p-4 text-center">
      <h1 className="text-4xl font-bold mb-4">Bienvenue, {user?.firstName || 'Joueur'} !</h1>
      <p className="text-lg mb-8">Que souhaitez-vous faire ?</p>

      <div className="max-w-md mx-auto space-y-4">
        <button 
          className="w-full bg-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-600 transition duration-300 shadow-lg"
          onClick={() => navigate('/start-game')}
        >
          Commencer une partie
        </button>
        <button 
          className="w-full bg-green-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 transition duration-300 shadow-lg"
        >
          Voir les scores
        </button>
        <button 
          className="w-full bg-yellow-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-yellow-600 transition duration-300 shadow-lg"
          onClick={() => navigate('/training')}
        >
          S'entraîner
        </button>
      </div>

      <div className="mt-12">
        <button 
          onClick={logout}
          className="text-sm text-gray-600 hover:text-red-500 underline"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;
