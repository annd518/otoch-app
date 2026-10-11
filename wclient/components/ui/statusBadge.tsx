// components/ui/statusBadge.tsx
"use client";

import React from "react";
import { label } from "@/lib/labels";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-indigo-100 text-indigo-800",
    COMPLETED: "bg-green-100 text-green-800",
    REPORTED: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || "bg-gray-100 text-gray-700"}`}>
      {label(status)}
    </span>
  );
}
