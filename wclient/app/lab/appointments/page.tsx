// app/lab/appointments/page.tsx
"use client";

import React, { useState } from "react";
import { label } from "@/lib/labels";
import Link from "next/link";
import { sampleClients, Client } from "@/lib/mockData";
import { StatusBadge } from "@/components/ui/statusBadge";

export default function AppointmentsPage() {
  const [filter, setFilter] = useState<string>("ALL");

  const filteredClients = filter === "ALL" ? sampleClients : sampleClients.filter(c => c.status === filter);

  return (
    <main className="min-h-screen bg-[#F5F6F8] p-6">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
        <h1 className="text-3xl px-45 font-bold text-blue-600">Шинэ захиалгууд</h1>
      </header>

      <ul className="space-y-4 w-3/4 mx-auto">
        {filteredClients.map((client: Client) => (
          <li key={client.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex justify-between items-center hover:shadow-md transition">
         <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
                  <img
                    src={client.img}
                    alt={client.name}
                    className="w-10 h-10 rounded-full object-cover border"
                  /> </div>
            <div>
              <div className="font-semibold text-[#2E5C8A]">{client.name}</div>
              <div className="text-sm text-gray-500">{label(client.testType)} — Нас {client.age}</div>
            </div></div>
            
              <Link href={`/lab/clients/${client.id}`} className="text-blue-600 hover:underline text-sm font-medium">
                Харах
              </Link>
           
          </li>
        ))}
      </ul>
    </main>
  );
}
