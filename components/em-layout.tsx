'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import EMScheduleChat from '@/components/em-schedule-chat';

interface User {
  role: string;
  user: {
    name: string;
    email: string;
  };
}

export default function EMLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.error || data.role !== 'EM') {
          router.push('/login');
        } else {
          setUser(data);
          setLoading(false);
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  useEffect(() => {
    setExpandedMenus(new Set());
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-potens-line border-t-potens-navy rounded-full animate-spin" />
          <p className="text-sm text-potens-body">로딩 중...</p>
        </div>
      </div>
    );
  }

  const toggleMenu = (menuKey: string) => {
    const next = new Set(expandedMenus);
    if (next.has(menuKey)) next.delete(menuKey);
    else next.add(menuKey);
    setExpandedMenus(next);
  };

  const menuItems = [
    { href: '/em', label: '대시보드' },
    { href: '/em/schedule', label: '강사 일정확인' },
    { href: '/em/instructor-schedule-edit', label: '강사 일정 수정하기' },
    { href: '/em/instructors', label: '강사 현황' },
    { href: '/em/settlement', label: '강사 정산 금액' },
    { href: '/em/change-credentials', label: 'id/pw변경' },
  ];

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="fixed left-0 top-0 w-44 bg-white border-r border-potens-line h-screen overflow-y-auto z-20">
        <div className="px-4 py-5 border-b border-potens-line">
          <a href="/em" className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.svg" alt="Potens" className="h-8 w-auto shrink-0" />
            <div className="min-w-0">
              <span className="potens-brand text-base leading-none">Potens</span>
              <p className="text-[11px] text-potens-body mt-0.5">강사 ADMIN</p>
            </div>
          </a>
        </div>

        <nav className="p-3">
          <p className="text-[10px] font-medium text-potens-navy tracking-wider px-2 mb-2">
            MENU
          </p>
          <ul className="space-y-0.5">
            {menuItems.map((item) => {
              if ('children' in item && Array.isArray((item as { children?: unknown }).children)) {
                const menuKey = item.href;
                const children = (item as { children: Array<{ href: string; label: string }> }).children;
                const isExpanded = expandedMenus.has(menuKey);
                const hasActiveChild = children.some((c) => pathname === c.href);
                return (
                  <li key={menuKey}>
                    <button
                      onClick={() => toggleMenu(menuKey)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 text-[12px] rounded-sm transition-colors duration-soft ${
                        hasActiveChild
                          ? 'bg-[#f3f4f9] text-potens-navy font-medium'
                          : 'text-potens-body hover:bg-[#f7f8fc] hover:text-potens-navy'
                      }`}
                    >
                      <span>{item.label}</span>
                      <svg
                        className={`w-3 h-3 transition-transform duration-soft ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-potens-line pl-2">
                        {children.map((child) => {
                          const isActive = pathname === child.href;
                          return (
                            <li key={child.href}>
                              <a
                                href={child.href}
                                className={`block px-2 py-1.5 text-[11px] rounded-sm transition-colors duration-soft ${
                                  isActive
                                    ? 'text-potens-navy font-medium bg-[#f3f4f9]'
                                    : 'text-potens-body hover:text-potens-navy'
                                }`}
                              >
                                {child.label}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              }

              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={`flex items-center px-2.5 py-2 text-[12px] rounded-sm transition-colors duration-soft ${
                      isActive
                        ? 'bg-[#f3f4f9] text-potens-navy font-medium border-l-2 border-potens-orange -ml-px pl-[9px]'
                        : 'text-potens-body hover:bg-[#f7f8fc] hover:text-potens-navy'
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="ml-44 flex flex-col min-h-screen flex-1">
        <header className="bg-white border-b border-potens-line sticky top-0 z-10">
          <div className="px-5 md:px-8 py-3.5 flex justify-end items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-potens-navy flex items-center justify-center text-white text-xs font-semibold">
                {user?.user.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden md:block text-right">
                <div className="text-xs font-medium text-potens-black">{user?.user.name}</div>
                <div className="text-[10px] text-potens-body truncate max-w-[140px]">{user?.user.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="ml-1 p-2 text-potens-body hover:text-potens-navy transition-colors duration-soft"
                title="로그아웃"
              >
                <svg className="w-4.5 h-4.5 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-5 md:p-8 overflow-auto bg-white">{children}</main>
      </div>

      <EMScheduleChat />
    </div>
  );
}
