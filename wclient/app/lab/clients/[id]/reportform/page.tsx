// app/lab/clients/[id]/reportform.tsx
"use client";

import React from "react";
import { useParams } from "next/navigation";

export default function ReportFormPage() {
  const { id } = useParams();

  return (
    <main className="min-h-screen bg-[#F5F6F8] p-6">
      <h1 className="text-2xl font-bold text-[#2E5C8A] mb-6">Create Report for Client {id}</h1>

      <form className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-xl mx-auto space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Шинжилгээний хариу</label>
          <textarea className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" rows={6}></textarea>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Тайлбар</label>
          <textarea className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2" rows={4}></textarea>
        </div>

        <button
          type="submit"
          className="px-4 py-2 rounded-md bg-[#5B9BD5] text-white hover:bg-[#4A8BC2] shadow-md transition"
        >
          Тайлан илгээх
        </button>
      </form>
    </main>
  );
}
