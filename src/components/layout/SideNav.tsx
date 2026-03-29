'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { LayoutDashboard, FileText, Clock, Settings, Sun, Moon, LogOut, Plus, Zap, Search, Hash, FlaskConical, User, ChevronUp, Menu, X } from 'lucide-react';
import Image from 'next/image';

interface PipelineNav {
  researcherId: string | null;
  researcherName: string | null;
  channel: {
    id: string;
    name: string;
    platform: string;
    hasVoice: boolean;
    hasCredentials: boolean;
  } | null;
  lastRun: { id: string } | null;
  pendingDraftCount: number;
}

const newMenuItems = {
  workflows: [
    { href: '/get-started', label: 'Pipeline', icon: Zap, description: 'AI-powered setup' },
    { href: '/dashboard', label: 'Research Run', icon: Search, description: 'Run now' },
  ],
  manual: [
    { href: '/channels/new', label: 'Channel', icon: Hash },
    { href: '/research/new', label: 'Researcher', icon: FlaskConical },
  ],
};

function getPipelineStatusColor(p: PipelineNav): string {
  if (!p.researcherId) return 'bg-amber-500'; // orphan channel
  if (!p.channel?.hasCredentials) return 'bg-amber-500';
  if (!p.lastRun) return 'bg-muted-foreground/30';
  if (p.pendingDraftCount > 0) return 'bg-blue-500';
  return 'bg-green-500';
}

interface SideNavProps {
  userEmail?: string;
}

export function SideNav({ userEmail }: SideNavProps) {
  const path = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineNav[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Fetch pipelines for nav
  const fetchPipelines = () => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setPipelines(data);
      })
      .catch(() => {});
  };

  // Re-fetch on navigation and on custom 'pipelines-changed' event
  useEffect(() => { fetchPipelines(); }, [path]);
  useEffect(() => {
    const handler = () => fetchPipelines();
    window.addEventListener('pipelines-changed', handler);
    return () => window.removeEventListener('pipelines-changed', handler);
  }, []);

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

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [path]);

  function closeMobile() {
    setMobileOpen(false);
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-card border border-border shadow-md"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={closeMobile}
        />
      )}

    <nav className={`
      w-56 shrink-0 border-r border-border flex flex-col bg-card/50 backdrop-blur-sm
      fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
      ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      md:static md:translate-x-0 md:transition-none
    `}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border flex items-center justify-between">
        <Link href="/dashboard" onClick={closeMobile} className="flex items-center gap-2.5">
          <Image
            src="/destink-icon.svg"
            alt="Destink logo"
            width={28}
            height={28}
          />
          <span className="font-display text-[17px] font-semibold tracking-tight text-foreground">
            Destink
          </span>
        </Link>
        <button
          onClick={closeMobile}
          className="md:hidden p-1 rounded-md hover:bg-accent transition-colors"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* New button + dropdown */}
      <div className="px-3 pt-4 pb-2 relative" ref={menuRef}>
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
          <div className="absolute left-3 right-3 mt-2 rounded-lg border border-border bg-popover shadow-lg overflow-hidden z-50">
            <div className="p-1.5">
              <p className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Workflows</p>
              {newMenuItems.workflows.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => { setNewMenuOpen(false); closeMobile(); }}
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
                  onClick={() => { setNewMenuOpen(false); closeMobile(); }}
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

      {/* Main nav + pipelines in scrollable area */}
      <div className="flex flex-col flex-1 overflow-y-auto px-3 pt-2">
        {/* Dashboard */}
        <Link
          href="/dashboard"
          onClick={closeMobile}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            path === '/dashboard'
              ? 'bg-primary/10 text-primary border-l-[3px] border-primary pl-[9px] shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 hover:translate-x-0.5'
          }`}
        >
          <LayoutDashboard className={`w-[18px] h-[18px] ${path === '/dashboard' ? 'text-primary' : ''}`} />
          Dashboard
        </Link>

        {/* Pipelines section */}
        {pipelines.length > 0 && (
          <div className="mt-3 mb-1">
            <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Pipelines
            </p>
            <div className="flex flex-col gap-0.5 mt-1">
              {pipelines.map(p => {
                const id = p.researcherId ?? p.channel?.id ?? '';
                const href = p.researcherId ? `/pipelines/${p.researcherId}` : `/research/new?channelId=${p.channel?.id}`;
                const name = p.researcherName ?? p.channel?.name ?? 'Untitled';
                const platform = p.channel?.platform ?? '';
                const active = path === href || (p.researcherId && path === `/pipelines/${p.researcherId}`);
                const statusColor = getPipelineStatusColor(p);

                return (
                  <Link
                    key={id}
                    href={href}
                    onClick={closeMobile}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                      active
                        ? 'bg-primary/10 text-primary border-l-[3px] border-primary pl-[9px]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 hover:translate-x-0.5'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
                    <span className="truncate">{name}</span>
                    {platform && (
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 ml-auto shrink-0">
                        {platform.slice(0, 2)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="h-px bg-border my-2" />

        {/* Other nav links */}
        <div className="flex flex-col gap-1">
          {[
            { href: '/drafts', label: 'Drafts', icon: FileText },
            { href: '/queue', label: 'Queue', icon: Clock },
            { href: '/settings', label: 'Settings', icon: Settings },
          ].map(l => {
            const active = path === l.href || path.startsWith(l.href + '/');
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={closeMobile}
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
      </div>

      {/* User menu */}
      <div className="px-3 pb-3 pt-2 border-t border-border shrink-0 relative" ref={userMenuRef}>
        {/* Dropdown (pops up) */}
        {userMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
            <div className="p-2 space-y-0.5">
              {/* User profile */}
              <Link
                href="/profile"
                onClick={() => { setUserMenuOpen(false); closeMobile(); }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors"
              >
                <User className="w-4 h-4 text-muted-foreground" />
                Profile
              </Link>

              {/* Theme toggle */}
              {mounted && (
                <button
                  onClick={() => { toggleTheme(); setUserMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors text-left"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
              )}

              {/* Sign out */}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-left"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>

            {/* Version */}
            <div className="px-3 py-2 border-t border-border">
              <p className="font-mono text-[10px] text-muted-foreground/50 tracking-widest uppercase">Destink v0.1.0</p>
            </div>
          </div>
        )}

        {/* Trigger button */}
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm hover:bg-accent/60 transition-all duration-200 text-left"
        >
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {userEmail ?? 'Account'}
            </p>
          </div>
          <ChevronUp className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </nav>
    </>
  );
}
