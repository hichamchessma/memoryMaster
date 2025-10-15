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
import { Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/ProtectedRoute';
import StartGamePage from './pages/StartGamePage';
import TablePage from './pages/TablePage';
import OnlineGamePage from './pages/OnlineGamePage';
import LobbyPage from './pages/LobbyPage';

// Temporary placeholder pages
const ProfilePage = () => <div>Profil en construction</div>;
const NotFoundPage = () => <div>Page non trouvée</div>;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Supprime l'auto-redirection depuis la home pour préserver la page au rafraîchissement

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <Router>
            <Routes>
              <Route element={<Layout />}>
                  {/* Public Routes */}
                  <Route path="/" element={<HomePage />} />
                  {/* Legacy routes -> redirect to Home (Google/Guest only) */}
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="/register" element={<Navigate to="/" replace />} />
                  <Route path="/training" element={<TrainingPage />} />

                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/lobby" element={<LobbyPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/start-game" element={<StartGamePage />} />
                    <Route path="/table/:tableId" element={<TablePage />} />
                    <Route path="/game/:gameId" element={<OnlineGamePage />} />
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
