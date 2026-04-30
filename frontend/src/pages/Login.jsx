import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [role, setRole] = useState('mentor'); // 'mentor' or 'student'
  const [identifier, setIdentifier] = useState(''); // email or usn
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const email = role === 'student' ? `${identifier}@forge.local` : identifier;

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // First-time student login requires password change
      if (role === 'student' && password === identifier) {
        navigate('/change-password');
      } else if (role === 'student') {
        navigate('/me/attendance');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Invalid credentials or account not found.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6 app-main">
      <div className="card w-full max-w-[440px] !p-12 relative z-10 space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="h-8 w-8 bg-accent-glow rounded-full mx-auto mb-6" />
          <h2 className="text-h2">Sign In</h2>
          <p className="text-body text-fg-secondary">Access your ForgeTrack account</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-surface-inset p-1 rounded-lg">
          <button 
            type="button"
            className={`flex-1 py-2 text-body font-medium rounded-md transition-colors ${role === 'mentor' ? 'bg-surface-raised text-fg-primary shadow-sm border border-border-subtle' : 'text-fg-tertiary hover:text-fg-primary'}`}
            onClick={() => setRole('mentor')}
          >
            Mentor
          </button>
          <button 
            type="button"
            className={`flex-1 py-2 text-body font-medium rounded-md transition-colors ${role === 'student' ? 'bg-surface-raised text-fg-primary shadow-sm border border-border-subtle' : 'text-fg-tertiary hover:text-fg-primary'}`}
            onClick={() => setRole('student')}
          >
            Student
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-label text-fg-secondary mb-2">
                {role === 'mentor' ? 'EMAIL ADDRESS' : 'USN'}
              </label>
              <input 
                type={role === 'mentor' ? 'email' : 'text'}
                className="input" 
                placeholder={role === 'mentor' ? 'mentor@theboringpeople.in' : '4SH24CS001'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-label text-fg-secondary">PASSWORD</label>
                {role === 'mentor' && (
                  <button type="button" className="text-caption text-accent-glow hover:underline">Forgot?</button>
                )}
              </div>
              <input 
                type="password" 
                className="input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <p className="text-caption text-danger-fg text-center">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full h-11 flex items-center justify-center">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
