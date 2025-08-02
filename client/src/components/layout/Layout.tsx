import { Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Composants temporaires
const Header = () => (
  <header className="bg-transparent shadow-none">
    <div className="container mx-auto px-4 py-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MemoryMaster</h1>
    </div>
  </header>
);

const Footer = () => (
  <footer className="bg-transparent shadow-none mt-auto">
    <div className="container mx-auto px-4 py-4 text-center text-gray-600 dark:text-gray-300">
      <p>© {new Date().getFullYear()} MemoryMaster. Tous droits réservés.</p>
    </div>
  </footer>
);

const Layout = () => {
  return (
    <div className="homepage-bg min-h-screen flex flex-col relative">

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
