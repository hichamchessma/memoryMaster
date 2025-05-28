import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Contexts
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// Layout
import Layout from './components/layout/Layout';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Composants temporaires
const ProfilePage = () => <div>Profil en construction</div>;
const NotFoundPage = () => <div>Page non trouvée</div>;
const DashboardPage = () => <div>Tableau de bord en construction</div>;
const GamePage = () => <div>Jeu en construction</div>;

// Components
import ProtectedRoute from './components/auth/ProtectedRoute';

// Création du client React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <Router>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
              <Routes>
                {/* Routes publiques */}
                <Route path="/" element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="register" element={<RegisterPage />} />
                  
                  {/* Routes protégées */}
                  <Route element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }>
                    <Route path="dashboard" element={<DashboardPage />} />
                  </Route>
                  <Route element={
                    <ProtectedRoute>
                      <GamePage />
                    </ProtectedRoute>
                  }>
                    <Route path="game/:gameId" element={<GamePage />} />
                  </Route>
                  <Route element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }>
                    <Route path="profile" element={<ProfilePage />} />
                  </Route>
                  
                  {/* 404 */}
                  <Route path="404" element={<NotFoundPage />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Route>
              </Routes>
              
              {/* Composants globaux */}
              <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored"
              />
            </div>
          </Router>
          
          {/* Outils de développement */}
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
