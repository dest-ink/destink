'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { LogOut, Sun, Moon } from 'lucide-react';

const links = [
  { href: '/channels', label: 'Channels', icon: '◈' },
  { href: '/research', label: 'Research', icon: '◆' },
  { href: '/drafts', label: 'Drafts', icon: '◇' },
  { href: '/queue', label: 'Queue', icon: '◉' },
  { href: '/audit', label: 'AI Usage', icon: '◎' }, // route is /audit, label is "AI Usage" intentionally
];

export function SideNav() {
  const path = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <nav className="w-52 shrink-0 border-r border-border flex flex-col bg-card">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <span className="font-mono text-sm font-semibold tracking-widest uppercase text-primary">
          Orbitl
        </span>
      </div>
      {/* Links */}
      <div className="flex flex-col gap-0.5 p-2 flex-1">
        {links.map(l => {
          const active = path === l.href || path.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[10px]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              ].join(' ')}
            >
              <span className="font-mono text-xs">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </div>
      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">v0.1.0</p>
        <div className="flex items-center gap-2">
          {mounted && (
            <button
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
