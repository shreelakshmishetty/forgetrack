import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LayoutDashboard, 
  CheckSquare, 
  History, 
  BookOpen, 
  Upload, 
  UserCheck, 
  Calendar, 
  Settings, 
  LogOut,
  ChevronLeft
} from 'lucide-react';

export default function Sidebar() {
  const { role, logout } = useAuth();

  const mentorLinks = [
    { label: 'Overview', items: [{ name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard }] },
    { label: 'Activity', items: [
      { name: 'Mark Attendance', to: '/attendance', icon: CheckSquare },
      { name: 'Student History', to: '/history', icon: History },
      { name: 'Materials', to: '/materials', icon: BookOpen },
    ]},
    { label: 'Data', items: [{ name: 'Upload CSV', to: '/upload', icon: Upload }] },
  ];

  const studentLinks = [
    { label: 'Overview', items: [{ name: 'My Attendance', to: '/me/attendance', icon: UserCheck }] },
    { label: 'Activity', items: [
      { name: 'Upcoming', to: '/me/upcoming', icon: Calendar },
      { name: 'Materials', to: '/me/materials', icon: BookOpen },
    ]},
  ];

  const links = role === 'mentor' ? mentorLinks : studentLinks;

  return (
    <aside className="w-[260px] hidden md:flex flex-col h-screen border-r border-border-subtle bg-canvas">
      {/* Logo Area */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-border-subtle">
        <span className="text-h2 text-fg-primary tracking-tight">ForgeTrack</span>
        <button className="text-fg-tertiary hover:text-fg-primary transition-colors">
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-8">
        {links.map((section, idx) => (
          <div key={idx}>
            <h3 className="text-label text-fg-tertiary mb-3 px-2">{section.label}</h3>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg text-body transition-colors ${
                        isActive
                          ? 'bg-surface-raised text-fg-primary border-l-2 border-accent-glow'
                          : 'text-fg-secondary hover:bg-surface hover:text-fg-primary border-l-2 border-transparent'
                      }`
                    }
                  >
                    <item.icon size={20} strokeWidth={1.75} />
                    {item.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Account Bottom Section */}
      <div className="p-4 border-t border-border-subtle">
        <h3 className="text-label text-fg-tertiary mb-3 px-2">Account</h3>
        <ul className="space-y-1">
          <li>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-body text-fg-secondary hover:bg-surface hover:text-fg-primary transition-colors border-l-2 border-transparent">
              <Settings size={20} strokeWidth={1.75} />
              Settings
            </button>
          </li>
          <li>
            <button 
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-body text-fg-secondary hover:bg-surface hover:text-fg-primary transition-colors border-l-2 border-transparent"
            >
              <LogOut size={20} strokeWidth={1.75} />
              Logout
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
