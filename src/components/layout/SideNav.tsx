'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { LayoutDashboard, FileText, Clock, Settings, Sun, Moon, LogOut, Plus, Zap, Search, Hash, FlaskConical } from 'lucide-react';
import Image from 'next/image';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/drafts', label: 'Drafts', icon: FileText },
  { href: '/queue', label: 'Queue', icon: Clock },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const newMenuItems = {
  workflows: [
    { href: '/get-started', label: 'Content Machine', icon: Zap, description: 'AI-powered setup' },
    { href: '/dashboard', label: 'Research Run', icon: Search, description: 'Run now' },
  ],
  manual: [
    { href: '/channels/new', label: 'Channel', icon: Hash },
    { href: '/research/new', label: 'Researcher', icon: FlaskConical },
  ],
};

export function SideNav() {
  const path = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
    }
    if (newMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [newMenuOpen]);

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <nav className="w-56 shrink-0 border-r border-border flex flex-col bg-card/50 backdrop-blur-sm">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image src="/destink-logo.svg" alt="Destink logo" width={26} height={26} />
          <span className="font-mono text-sm font-bold tracking-[0.2em] uppercase text-primary">
            Destink
          </span>
        </Link>
      </div>

      {/* New button + dropdown */}
      <div className="px-3 pt-4 pb-2" ref={menuRef}>
        <button
          onClick={() => setNewMenuOpen(!newMenuOpen)}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          <span>New</span>
          <svg className={`w-3 h-3 ml-auto transition-transform duration-200 ${newMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Dropdown */}
        {newMenuOpen && (
          <div className="mt-2 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
            <div className="p-1.5">
              <p className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Workflows</p>
              {newMenuItems.workflows.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNewMenuOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors duration-150"
                >
                  <item.icon className="w-4 h-4 text-primary" />
                  <div>
                    <span className="font-medium">{item.label}</span>
                    <span className="text-[11px] text-muted-foreground ml-1.5">{item.description}</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="border-t border-border p-1.5">
              <p className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Manual</p>
              {newMenuItems.manual.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNewMenuOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Nav links */}
      <div className="flex flex-col gap-1 px-3 pt-2 flex-1">
        {navLinks.map(l => {
          const active = path === l.href || path.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-primary/10 text-primary border-l-[3px] border-primary pl-[9px] shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 hover:translate-x-0.5'
              }`}
            >
              <l.icon className={`w-[18px] h-[18px] ${active ? 'text-primary' : ''}`} />
              {l.label}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] text-muted-foreground/60 tracking-widest uppercase">v0.1.0</p>
          <div className="flex items-center gap-1.5">
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
