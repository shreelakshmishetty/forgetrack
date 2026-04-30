import { useAuth } from '../../contexts/AuthContext';
import { Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function TopBar() {
  const { user } = useAuth();
  const location = useLocation();

  // Simple breadcrumb gen
  const path = location.pathname.split('/').filter(Boolean);
  const breadcrumb = path.length > 0 ? path[path.length - 1].charAt(0).toUpperCase() + path[path.length - 1].slice(1) : 'Dashboard';

  const initial = user?.display_name ? user.display_name.charAt(0).toUpperCase() : '?';

  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-border-subtle bg-canvas md:bg-transparent">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-body text-fg-secondary">
        <span className="hidden md:inline">Overview</span>
        <span className="text-fg-tertiary hidden md:inline">/</span>
        <span className="text-fg-primary font-medium">{breadcrumb}</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-6">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="input !h-9 !py-1 !pl-9 !pr-4 !rounded-full w-64 bg-surface"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-body-sm font-medium text-fg-primary">{user?.display_name || 'User'}</p>
            <p className="text-caption text-fg-tertiary">{user?.role === 'mentor' ? 'Mentor' : 'Student'}</p>
          </div>
          <div className="h-9 w-9 rounded-full bg-accent-glow flex items-center justify-center text-body font-semibold text-canvas">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
