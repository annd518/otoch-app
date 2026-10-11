// components/ui/FilterButton.tsx
"use client";

import React, { useState } from "react";
import { label } from "@/lib/labels";
import { Button } from "./button";
import { ChevronDown } from "lucide-react";

type FilterButtonProps = {
  current: string;
  onChange: (status: string) => void;
};

export const FilterButton: React.FC<FilterButtonProps> = ({ current, onChange }) => {
  const [open, setOpen] = useState(false);

  const options = ["ALL", "PENDING", "IN_PROGRESS", "COMPLETED", "REPORTED"];

  return (
    <div className="relative inline-block text-left">
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => setOpen(!open)}
      >
       Төлөв: {label(current)}
        <ChevronDown className="w-4 h-4" />
      </Button>

      {open && (
        <div className="absolute mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          {options.map((status) => (
            <button
              key={status}
              onClick={() => {
                onChange(status);
                setOpen(false);
              }}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-[#EDEFF2] ${
                status === current ? "font-semibold text-[#2E5C8A]" : "text-gray-700"
              }`}
            >
              {label(status)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
