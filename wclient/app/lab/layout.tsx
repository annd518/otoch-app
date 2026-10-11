import React from 'react'
import Link from 'next/link'

export const metadata = {
  title: "Sewa — Лаборатори",
  description: "PariwarCare-ийн лабораторийн ажлын орчин",
}

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen  text-gray-900">
      <header className="">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/lab" className="text-lg font-semibold text-blue-700 ">
            PariwarCare
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="inline-flex items-center px-4 py-2 rounded-md bg-white text-blue-600 border border-blue-600 shadow-sm hover:bg-blue-50 transitio"
            >
              Гарах
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">{children}</main>

      <footer className="border-t bg-white mt-auto">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">
              © {new Date().getFullYear()} Sewa Laboratory Services
            </span>
            <div className="flex gap-4 text-sm text-gray-500">
              <Link href="/lab/help" className="hover:text-blue-600">
                Тусламж
              </Link>
              <Link href="/lab/contact" className="hover:text-blue-600">
                Холбоо барих
              </Link>
              <Link href="/lab/privacy" className="hover:text-blue-600">
                Нууцлал
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}