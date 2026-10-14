"use client";

import React, { useState } from "react";
import { label } from "@/lib/labels";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardPlus, FileText } from "lucide-react";

interface ClientProfile {
  id: string;
  name: string;
  age: number;
  gender: string;
  bloodPressure: string;
  location: string;
  weight: string;
  height: string;
  testType: string;
  image: string;
  report?: {
    reportId: string;
    summary: string;
    findings: string;
    date: string;
  };
}

export default function ClientProfilePage() {
  const { id } = useParams();
  const [showReport, setShowReport] = useState(false);

  // Dummy Data
  const clients: ClientProfile[] = [
    {
      id: "1",
      name: "Б. Бат",
      age: 32,
      gender: "Male",
      bloodPressure: "120/80 mmHg",
      location: "Улаанбаатар, Баянзүрх дүүрэг",
      weight: "72 kg",
      height: "175 cm",
      testType: "Blood Sugar",
      image: "/demo-avatar.svg",
      report: {
        reportId: "RPT001",
        summary: "Цусан дахь сахарын хэмжээ бага зэрэг өндөр.",
        findings:
          "Өвчтөн чихрийн шижингийн өмнөх үе шатанд байж магадгүй. Хоол хүнсээ хянаж, 3 сарын дараа дахин шинжилгээ өгөхийг зөвлөж байна.",
        date: "2025-10-31",
      },
    },
    {
      id: "2",
      name: "Д. Цэцэг",
      age: 29,
      gender: "Female",
      bloodPressure: "118/75 mmHg",
      location: "Улаанбаатар, Хан-Уул дүүрэг",
      weight: "60 kg",
      height: "168 cm",
      testType: "CBC",
      image: "/demo-avatar.svg",
    },
  ];

  const client = clients.find((d) => d.id === id);

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Үйлчлүүлэгч олдсонгүй.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F7FB] py-10 px-4 flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-3xl w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
          <motion.img
            src={client.image}
            alt={client.name}
            className="w-28 h-28 rounded-full border-4 border-blue-100 shadow-md object-cover"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100 }}
          />
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-semibold text-blue-700">{client.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{label(client.testType)}</p>
            <p className="text-xs text-gray-400 mt-1">Client ID: {client.id}</p>
          </div>
        </div>

        {/* Animated Details Section */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm mb-8"
        >
          {[
            { label: "Нас", value: client.age },
            { label: "Хүйс", value: label(client.gender) },
            { label: "Цусны даралт", value: client.bloodPressure },
            { label: "Жин", value: client.weight },
            { label: "Өндөр", value: client.height },
            { label: "Байршил", value: client.location },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-blue-50 rounded-xl p-3 text-center hover:shadow-sm transition"
            >
              <p className="text-gray-500 text-xs">{item.label}</p>
              <p className="text-blue-700 font-medium">{item.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Link
            href="/lab/makereport"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-all hover:scale-105"
          >
            <ClipboardPlus size={18} />
            Тайлан гаргах
          </Link>

          {client.report && (
            <button
              onClick={() => setShowReport(!showReport)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-white text-blue-600 border border-blue-500 hover:bg-blue-50 transition-all hover:scale-105"
            >
              <FileText size={18} />
              {showReport ? "Тайлан нуух" : "Тайлан харах"}
            </button>
          )}
        </div>

        {/* Animated Report Section */}
        <AnimatePresence>
          {showReport && client.report && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="border-t border-gray-200 pt-4 mt-4"
            >
              <h2 className="text-lg font-semibold text-blue-700 mb-2 flex items-center gap-2">
                <FileText size={18} />
                Тайлангийн хураангуй
              </h2>
              <div className="space-y-2 text-sm text-gray-700">
                <p>
                  <strong>Огноо:</strong> {client.report.date}
                </p>
                <p>
                  <strong>Хураангуй:</strong> {client.report.summary}
                </p>
                <p>
                  <strong>Дүгнэлт:</strong> {client.report.findings}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
