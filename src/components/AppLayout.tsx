import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { LogOut, User, Calendar, Scissors, LayoutDashboard, Bell, Menu, X } from 'lucide-react';
import { ShorterMark } from '@/components/ShorterLogo';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

// The navigation is its own component because it is the one big self-contained
// region of this layout: the rest of AppLayout is just the header, the main
// area and the overlay.
function SidebarNav({
  isMenuOpen,
  navItems,
  user,
  onNavigate,
  onLogout,
}: {
  isMenuOpen: boolean;
  navItems: NavItem[];
  user: { full_name?: string; role?: string; avatar_url?: string | null } | null;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
      isMenuOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="flex flex-col h-full">
        <div className="p-6 hidden md:flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-black/10">
            <ShorterMark tone="light" className="w-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">Shorter</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 md:mt-0">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className="w-full flex items-center gap-3 px-4 py-3 text-neutral-600 hover:bg-stone-100 rounded-xl transition-colors font-medium"
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="text-stone-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.full_name}</p>
              <p className="text-xs text-neutral-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function AppLayout({ children, title }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = React.useMemo(() => {
    if (!user) return [];
    
    if (user.role === 'customer') {
      return [
        { label: 'Discover', icon: Scissors, path: '/' },
        { label: 'Bookings', icon: Calendar, path: '/bookings' },
        { label: 'Notifications', icon: Bell, path: '/notifications' },
        { label: 'Profile', icon: User, path: '/profile' },
      ];
    }
    
    if (user.role === 'barber') {
      return [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/barber' },
        { label: 'Schedule', icon: Calendar, path: '/barber/schedule' },
        { label: 'Services', icon: Scissors, path: '/barber/services' },
        { label: 'Profile', icon: User, path: '/barber/profile' },
      ];
    }

    if (user.role === 'admin') {
      return [
        { label: 'Admin Panel', icon: LayoutDashboard, path: '/admin' },
      ];
    }

    return [];
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-stone-50">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <ShorterMark tone="light" className="w-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">Shorter</span>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Sidebar (Desktop) / Drawer (Mobile) */}
      <SidebarNav
        isMenuOpen={isMenuOpen}
        navItems={navItems}
        user={user}
        onNavigate={(path) => {
          navigate(path);
          setIsMenuOpen(false);
        }}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {title && (
          <div className="hidden md:block p-8 pb-0">
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{title}</h1>
          </div>
        )}
        <div className="p-4 md:p-8 flex-1">
          {children}
        </div>
      </main>

      {/* Overlay for mobile menu */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
}
