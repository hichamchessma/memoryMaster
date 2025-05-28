import { Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Composants temporaires
const Header = () => (
  <header className="bg-white dark:bg-gray-800 shadow">
    <div className="container mx-auto px-4 py-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MemoryMaster</h1>
    </div>
  </header>
);

const Footer = () => (
  <footer className="bg-white dark:bg-gray-800 shadow-inner mt-auto">
    <div className="container mx-auto px-4 py-4 text-center text-gray-600 dark:text-gray-300">
      <p>© {new Date().getFullYear()} MemoryMaster. Tous droits réservés.</p>
    </div>
  </footer>
);

const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <Outlet />
      </main>
      
      <Footer />
      <ToastContainer position="bottom-right" />
    </div>
  );
};

export default Layout;
