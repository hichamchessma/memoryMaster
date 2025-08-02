import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Contexts and Layout
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/layout/Layout';

// Page Components
import TrainingPage from './pages/TrainingPage';
import { useAuth } from './context/AuthContext';
import { Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/ProtectedRoute';

// Temporary placeholder pages
const ProfilePage = () => <div>Profil en construction</div>;
const GamePage = () => <div>Jeu en construction</div>;
const NotFoundPage = () => <div>Page non trouvée</div>;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AuthRedirectHome() {
  const { user } = useAuth();
  if (user || (import.meta.env.DEV && localStorage.getItem('token') === 'dev-token')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <HomePage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <Router>
            <Routes>
              <Route element={<Layout />}>
                  {/* Public Routes */}
                  <Route path="/" element={<AuthRedirectHome />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/training" element={<TrainingPage />} />

                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/game/:gameId" element={<GamePage />} />
                  </Route>

                  {/* Not Found */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
            </Routes>
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
            />
            {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
          </Router>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
