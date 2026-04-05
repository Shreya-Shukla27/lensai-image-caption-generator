import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-6 flex items-center justify-center">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <h1 className="font-display font-700 text-3xl text-white mb-2">Welcome back</h1>
          <p className="text-muted font-body">Log in to access your caption history</p>
        </div>

        <div className="glass rounded-3xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-body text-muted mb-2">Email</label>
              <input
                id="login-email"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white font-body text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-body text-muted mb-2">Password</label>
              <input
                id="login-password"
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white font-body text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-white rounded-xl font-display font-600 text-sm transition-all mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <p className="text-center text-sm text-muted font-body mt-6">
            No account?{' '}
            <Link to="/register" className="text-accent-light hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
