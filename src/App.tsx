import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Router } from './routes';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { AuthModal } from './components/auth/AuthModal';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { useAuth } from './context/AuthContext';

function App() {
  const location = useLocation();
  const { loading } = useAuth();
  const isAdminShell = location.pathname.startsWith('/admin');

  if (loading && !isAdminShell) {
    return <LoadingScreen />;
  }

  if (isAdminShell) {
    return (
      <div className="scheme-light min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Router />
      </div>
    );
  }

  return (
    <div className="scheme-dark min-h-screen bg-slate-950 text-slate-100 antialiased">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="relative overflow-hidden"
        >
          <Router />
        </motion.main>
      </AnimatePresence>
      <Footer />
      <AuthModal />
    </div>
  );
}

export default App;
