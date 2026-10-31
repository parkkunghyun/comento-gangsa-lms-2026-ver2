'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

interface User {
  role: string;
  user: {
    name: string;
    email: string;
    mobile?: string;
    fee?: string;
  };
}

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.error || data.role !== 'INSTRUCTOR') {
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

  const menuItems = [
    { href: '/instructor', label: '캘린더' },
    { href: '/instructor/settlement', label: '정산' },
    { href: '/instructor/expense-report', label: '지출결의서 작성' },
    { href: '/instructor/feedback', label: '코멘토에 문의하기' },
    { href: '/instructor/reset-pin', label: '핀코드 재설정' },
  ];

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="w-56 bg-white border-r border-potens-line min-h-screen">
        <div className="px-5 py-5 border-b border-potens-line">
          <a href="/instructor" className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.svg" alt="Potens" className="h-8 w-auto shrink-0" />
            <div className="min-w-0">
              <span className="potens-brand text-base leading-none">Potens</span>
              <p className="text-[11px] text-potens-body mt-0.5">강사 ADMIN</p>
            </div>
          </a>
        </div>
        <nav className="p-3">
          <p className="text-[10px] font-medium text-potens-navy tracking-wider px-2 mb-2">MENU</p>
          <ul className="space-y-0.5">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={`block px-2.5 py-2 text-[12px] rounded-sm transition-colors duration-soft ${
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

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-potens-line">
          <div className="px-6 py-3.5 flex justify-between items-center">
            <h2 className="text-sm font-medium text-potens-navy">강사 섭외 관리</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-potens-body">{user?.user.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-potens-body hover:text-potens-navy transition-colors duration-soft"
              >
                로그아웃
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto bg-white">{children}</main>
      </div>
    </div>
  );
}
