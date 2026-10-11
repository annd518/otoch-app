"use client"

import { NurseVisitList } from './NurseVisitList';
import { NurseStats } from './NurseStats';
import { useRoleProtection } from "@/lib/hooks/useRoleProtection"

export default function NurseDashboard() {
  // Only NURSE role can access this page
  useRoleProtection(['NURSE']);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header with subtle blur background */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-white/40 backdrop-blur-md rounded-2xl" />
          <div className="relative p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Сувилагчийн самбар</h1>
            <p className="text-gray-600">Үзлэг болон өдөр тутмын ажлаа хянах</p>
          </div>
        </div>

        {/* Quick Stats with blur background */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-white/60 backdrop-blur-lg rounded-2xl shadow-xl" />
          <div className="relative p-6">
            <NurseStats />
          </div>
        </div>

        {/* Visit List Section */}
        <section className="mb-8">
          <div className="mb-4 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-gray-100/80 to-white/80 backdrop-blur-sm rounded-xl" />
            <div className="relative px-6 py-3">
              <h2 className="text-xl font-semibold text-gray-800">Томилогдсон үзлэгүүд</h2>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg" />
            <div className="relative p-6">
              <NurseVisitList />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};