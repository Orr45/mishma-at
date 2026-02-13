'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Link from 'next/link';
import {
  LayoutDashboard,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { href: '/', label: 'לוח בקרה', icon: LayoutDashboard },
  { href: '/events', label: 'אירועים', icon: CalendarClock },
  { href: '/checklists', label: 'נוכחות', icon: ClipboardCheck },
  { href: '/tracking', label: 'מעקבים', icon: ClipboardList },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [soldierRequestCount, setSoldierRequestCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // Count unread soldier requests (source='soldier', not ended)
  useEffect(() => {
    async function fetchCount() {
      const { count } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'soldier')
        .is('ended_at', null);
      setSoldierRequestCount(count || 0);
    }
    fetchCount();

    const channel = supabase
      .channel('navbar-events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => { fetchCount(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold">משמעת</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              const badge = item.href === '/events' && soldierRequestCount > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'hover:bg-card-hover text-muted-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {badge && (
                    <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] flex items-center justify-center bg-accent-red text-white text-[10px] font-bold rounded-full px-1">
                      {soldierRequestCount}
                    </span>
                  )}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-accent-red hover:bg-accent-red/10 transition-colors font-medium ms-2"
            >
              <LogOut className="w-4 h-4" />
              יציאה
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-xl hover:bg-card-hover transition-colors lg:hidden"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Side Menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-72 bg-card border-s border-border z-50 p-4 flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Shield className="w-6 h-6 text-primary" />
                  <span className="text-lg font-bold">משמעת</span>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 rounded-xl hover:bg-card-hover transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href));
                  const badge = item.href === '/events' && soldierRequestCount > 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-white'
                          : 'hover:bg-card-hover text-muted-foreground'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                      {badge && (
                        <span className="min-w-[20px] h-[20px] flex items-center justify-center bg-accent-red text-white text-[11px] font-bold rounded-full px-1 ms-auto">
                          {soldierRequestCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-accent-red hover:bg-accent-red/10 transition-colors font-medium"
              >
                <LogOut className="w-5 h-5" />
                יציאה
              </button>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Tab Bar (Mobile only) */}
      <nav className="fixed bottom-0 inset-x-0 bg-card/90 backdrop-blur-lg border-t border-border z-40 lg:hidden">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            const badge = item.href === '/events' && soldierRequestCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[60px] ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
                {badge && (
                  <span className="absolute -top-0.5 right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-accent-red text-white text-[9px] font-bold rounded-full px-0.5">
                    {soldierRequestCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
