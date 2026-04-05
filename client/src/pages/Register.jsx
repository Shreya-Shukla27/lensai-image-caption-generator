import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-6 flex items-center justify-center">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <h1 className="font-display font-700 text-3xl text-white mb-2">Create account</h1>
          <p className="text-muted font-body">Sign up to save your caption history</p>
        </div>

        <div className="glass rounded-3xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="register-name" className="block text-sm font-body text-muted mb-2">Full name</label>
              <input
                id="register-name"
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ravi Kumar"
                autoComplete="name"
                required
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white font-body text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-body text-muted mb-2">Email</label>
              <input
                id="register-email"
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
              <label htmlFor="register-password" className="block text-sm font-body text-muted mb-2">Password</label>
              <input
                id="register-password"
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                required
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-white font-body text-sm placeholder:text-muted/50 focus:outline-none focus:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-white rounded-xl font-display font-600 text-sm transition-all mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-muted font-body mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-light hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
