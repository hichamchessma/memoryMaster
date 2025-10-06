import { Outlet, NavLink } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../../context/AuthContext';

const Footer = () => (
  <footer className="bg-transparent shadow-none mt-auto">
    <div className="container mx-auto px-4 py-4 text-center text-gray-600 dark:text-gray-300">
      <p>© {new Date().getFullYear()} MemoryMaster. Tous droits réservés.</p>
    </div>
  </footer>
);

const Layout = () => {
  const { user } = useAuth();
  const displayName =
    (user?.firstName || '') +
    (user?.lastName ? ` ${user.lastName}` : (!user?.firstName && user?.lastName ? user.lastName : '')) ||
    (user as any)?.name ||
    (user as any)?.nickname ||
    (user as any)?.displayName ||
    (user as any)?.email ||
    'Invité';

  return (
    <div className="homepage-bg min-h-screen flex flex-col relative">

      {/* Top-right user pill */}
      <div className="absolute top-3 right-3 z-20">
        {user && (
          <NavLink
            to="/profile"
            title={displayName}
            className="group backdrop-blur bg-black/40 hover:bg-black/50 text-white text-sm sm:text-base pl-1.5 pr-3 py-1.5 rounded-full shadow-md border border-white/20 flex items-center gap-2 transition-colors"
          >
            <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 text-white font-semibold shadow ring-1 ring-white/30">
              {(user?.firstName?.[0] || user?.lastName?.[0] || 'G').toUpperCase()}
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black/50" />
            </span>
            <span className="max-w-[50vw] truncate">{displayName}</span>
          </NavLink>
        )}
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">

        <main className="flex-grow container mx-auto px-4 py-8">
          <Outlet />
        </main>
        <Footer />
        <ToastContainer position="bottom-right" />
      </div>
    </div>
  );
};

export default Layout;
