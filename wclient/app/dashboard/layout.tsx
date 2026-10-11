'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { clearSession, getSessionUser } from '@/lib/auth/session';
import { label } from '@/lib/labels';
import toast from 'react-hot-toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userData, setUserData] = useState<{ name?: string; email?: string; role?: string } | null>(null);

  useEffect(() => {
    // Validated user object saved at login (not a JWT decode)
    setUserData(getSessionUser());
  }, []);

  const handleLogout = () => {
    clearSession();

    toast.success('Амжилттай гарлаа');
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Shared navigation/sidebar can go here */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 hidden lg:block">
          <div className="h-full flex flex-col">
            {/* Profile Section */}
            <div className="px-3 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-3 px-3 py-2">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {userData?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {userData?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {userData?.role ? label(userData.role) : 'Role'}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <Link
                href="/dashboard"
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  pathname === '/dashboard'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                Тойм
              </Link>
              <Link
                href="/dashboard/nurse"
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  pathname === '/dashboard/nurse'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                Сувилагчийн самбар
              </Link>
              <Link
                href="/dashboard/medical-admin"
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  pathname === '/dashboard/medical-admin'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                Эмнэлгийн админ
              </Link>
              <Link
                href="/dashboard/admin"
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  pathname === '/dashboard/admin'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                Админ
              </Link>
            </nav>

            {/* Logout Button */}
            <div className="px-3 py-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Гарах
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:pl-64">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}