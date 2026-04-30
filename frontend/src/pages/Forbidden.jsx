import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Forbidden() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const handleReturn = () => {
    if (role === 'mentor') navigate('/dashboard');
    else navigate('/me/attendance');
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="card max-w-md text-center space-y-6">
        <h1 className="text-display-md text-danger-fg">403</h1>
        <h2 className="text-h2">Access Forbidden</h2>
        <p className="text-body-lg text-fg-secondary">
          You don't have permission to access this page.
        </p>
        <button onClick={handleReturn} className="btn-primary w-full mt-4">
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
