"use client";

// Lab report detail placeholder. The lab section uses demo data only and has no
// report API yet, so this page only states that the detail view is not implemented.
import Link from "next/link";
import { useParams } from "next/navigation";

export default function LabReportDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <main className="min-h-screen bg-[#F5F6F8] p-6">
      <h1 className="text-2xl font-bold text-[#2E5C8A] mb-4">Тайлан</h1>
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-2">
        <p className="text-sm text-gray-500">Тайлангийн дугаар: {id}</p>
        <p className="text-gray-700">
          Тайлангийн дэлгэрэнгүй хараахан хэрэгжээгүй байна (демо хэсэг).
        </p>
      </div>
      <Link href="/lab/reports" className="inline-block mt-4 text-blue-600 hover:underline">
        ← Тайлангийн жагсаалт руу буцах
      </Link>
    </main>
  );
}
