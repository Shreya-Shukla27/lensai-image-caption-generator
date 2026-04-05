import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/');
  };

  return (
    <nav aria-label="Primary" className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="white" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-display font-700 text-lg text-white tracking-tight">
            Lens<span className="text-accent">AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                to="/history"
                className="text-sm text-muted hover:text-white transition-colors font-body rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                My history
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted font-body">
                  {user.name.split(' ')[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm px-4 py-1.5 border border-border rounded-lg text-muted hover:text-white hover:border-accent/50 transition-all font-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-muted hover:text-white transition-colors font-body rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="text-sm px-4 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg transition-all font-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
