import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Search, ChevronRight } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { searchStudents } from '../../services/dashboardService';

export default function TopBar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);

  // Simple breadcrumb gen
  const path = location.pathname.split('/').filter(Boolean);
  const breadcrumb = path.length > 0 ? path[path.length - 1].charAt(0).toUpperCase() + path[path.length - 1].slice(1) : 'Dashboard';

  const initial = user?.display_name ? user.display_name.charAt(0).toUpperCase() : '?';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await searchStudents(searchQuery);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStudentSelect = (studentId) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    // For now we'll just navigate to history, but the History page doesn't take params yet.
    // However, clicking it shows the intent, and we can enhance History.jsx later to parse params.
    navigate(`/history?studentId=${studentId}`);
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-border-subtle bg-canvas md:bg-transparent z-50">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-body text-fg-secondary">
        <span className="hidden md:inline">Overview</span>
        <span className="text-fg-tertiary hidden md:inline">/</span>
        <span className="text-fg-primary font-medium">{breadcrumb}</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-6">
        {user?.role === 'mentor' && (
          <div className="relative hidden md:block" ref={searchRef}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
            <input 
              type="text" 
              placeholder="Search students..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="input !h-9 !py-1 !pl-9 !pr-4 !rounded-full w-64 bg-surface"
            />
            
            {/* Search Dropdown */}
            {isSearchOpen && searchQuery.trim() !== '' && (
              <div className="absolute top-12 left-0 w-full bg-surface-raised border border-border-default rounded-xl shadow-raised overflow-hidden">
                {searchResults.length > 0 ? (
                  <ul className="py-2">
                    {searchResults.map(s => (
                      <li key={s.id}>
                        <button 
                          onClick={() => handleStudentSelect(s.id)}
                          className="w-full text-left px-4 py-2 hover:bg-surface flex items-center justify-between text-body"
                        >
                          <div>
                            <span className="text-fg-primary block">{s.name}</span>
                            <span className="text-caption text-fg-tertiary font-mono">{s.usn}</span>
                          </div>
                          <ChevronRight size={14} className="text-fg-tertiary" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-body-sm text-fg-secondary">
                    No students found.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* User Profile */}
        <Link to="/settings" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="text-right hidden sm:block">
            <p className="text-body-sm font-medium text-fg-primary">{user?.display_name || 'User'}</p>
            <p className="text-caption text-fg-tertiary">{user?.role === 'mentor' ? 'Mentor' : 'Student'}</p>
          </div>
          <div className="h-9 w-9 rounded-full bg-accent-glow flex items-center justify-center text-body font-semibold text-canvas">
            {initial}
          </div>
        </Link>
      </div>
    </header>
  );
}
