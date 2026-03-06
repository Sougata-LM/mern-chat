import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        if (form.password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        await register(form.username, form.email, form.password);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m) => { setMode(m); setError(''); setForm({ username: '', email: '', password: '' }); };

  return (
    <div className="min-h-screen bg-base-300 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-primary-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-base-content">ChatFlow</h1>
          <p className="text-base-content/50 mt-1 text-sm">Real-time messaging, zero friction</p>
        </div>

        <div className="card bg-base-100 shadow-2xl">
          <div className="card-body p-8">

            {/* Tab switcher */}
            <div className="tabs tabs-boxed bg-base-200 mb-6">
              <button className={`tab flex-1 ${mode === 'login' ? 'tab-active' : ''}`} onClick={() => switchMode('login')}>
                Sign In
              </button>
              <button className={`tab flex-1 ${mode === 'register' ? 'tab-active' : ''}`} onClick={() => switchMode('register')}>
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="form-control">
                  <label className="label"><span className="label-text font-medium">Username</span></label>
                  <input
                    type="text" name="username" className="input input-bordered w-full"
                    placeholder="e.g. john_doe" value={form.username} onChange={handleChange}
                    required minLength={3} maxLength={20} autoComplete="username"
                  />
                </div>
              )}

              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Email</span></label>
                <input
                  type="email" name="email" className="input input-bordered w-full"
                  placeholder="you@example.com" value={form.email} onChange={handleChange}
                  required autoComplete="email"
                />
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Password</span></label>
                <input
                  type="password" name="password" className="input input-bordered w-full"
                  placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                  value={form.password} onChange={handleChange} required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>

              {error && (
                <div className="alert alert-error py-2 text-sm animate-fade-in">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className={`btn btn-primary w-full mt-2 ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-xs text-base-content/30 mt-4">
              {mode === 'login' ? "Don't have an account? Click Create Account above." : 'Already have an account? Click Sign In above.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
