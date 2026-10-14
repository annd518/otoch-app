"use client"
import React from "react"
import { label } from "@/lib/labels"
import Link from "next/link"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

type TestItem = {
  id: string
  patient: string
  testType: string
  scheduledFor: string
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REPORTED"
  img: string
}

const sampleTests: TestItem[] = [
  {
    id: "t1",
    patient: "Б. Бат",
    testType: "Blood Sugar",
    scheduledFor: "2025-11-02 09:30",
    status: "PENDING",
    img: "/demo-avatar.svg",
  },
  {
    id: "t2",
    patient: "Д. Цэцэг",
    testType: "CBC",
    scheduledFor: "2025-11-02 10:00",
    status: "IN_PROGRESS",
    img: "/demo-avatar.svg",
  },
  {
    id: "t3",
    patient: "Г. Номин",
    testType: "Lipid Panel",
    scheduledFor: "2025-10-30 08:45",
    status: "COMPLETED",
    img: "/demo-avatar.svg",
  },
  {
    id: "t4",
    patient: "Д. Ганболд",
    testType: "Urinalysis",
    scheduledFor: "2025-10-29 14:00",
    status: "REPORTED",
    img: "/demo-avatar.svg",
  },
]

function StatusPill({ status }: { status: TestItem["status"] }) {
  const map: Record<TestItem["status"], string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-indigo-100 text-indigo-800",
    COMPLETED: "bg-green-100 text-green-800",
    REPORTED: "bg-blue-100 text-blue-800",
  }
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}
    >
      {label(status)}
    </span>
  )
}

// Dummy data for charts
const barData = [
  { name: "Да", tests: 12 },
  { name: "Мя", tests: 18 },
  { name: "Лх", tests: 14 },
  { name: "Пү", tests: 20 },
  { name: "Ба", tests: 10 },
  { name: "Бя", tests: 15 },
  { name: "Ня", tests: 8 },
]

const pieData = [
  { name: "Хүлээгдэж буй", value: 4, color: "#FACC15" },
  { name: "Явагдаж буй", value: 3, color: "#6366F1" },
  { name: "Дууссан", value: 5, color: "#22C55E" },
  { name: "Тайлагнасан", value: 6, color: "#3B82F6" },
]

export default function LabDashboardPage() {
  const pending = sampleTests.filter((t) => t.status === "PENDING").length
  const inProgress = sampleTests.filter(
    (t) => t.status === "IN_PROGRESS"
  ).length
  const completed = sampleTests.filter((t) => t.status === "COMPLETED").length
  const reported = sampleTests.filter((t) => t.status === "REPORTED").length

  return (
    <main className="min-h-screen bg-[#F5F7FB] px-6 py-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-600">Лабораторийн самбар</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Захиалга, тайлан болон лабораторийн үйл ажиллагааг үр дүнтэй удирдах.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          <Link
            href="/lab/appointments"
            className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white shadow-md hover:bg-blue-700 transition"
          >
            Шинэ захиалгууд
          </Link>
        </div>
      </header>

      {/* Stats Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          {
            label: "Хүлээгдэж буй",
            count: pending,
            color: "border-yellow-300 bg-yellow-50",
          },
          {
            label: "Явагдаж буй",
            count: inProgress,
            color: "border-indigo-300 bg-indigo-50",
          },
          {
            label: "Дууссан",
            count: completed,
            color: "border-green-300 bg-green-50",
          },
          {
            label: "Бэлэн тайлан",
            count: reported,
            color: "border-blue-300 bg-blue-50",
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-xl p-5 shadow-sm border ${item.color} hover:shadow-md transition`}
          >
            <p className="text-sm text-gray-600">{item.label}</p>
            <p className="text-3xl font-semibold text-blue-600">{item.count}</p>
          </div>
        ))}
      </section>

      {/* Charts Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-blue-600 mb-4">
            Долоо хоногийн шинжилгээний тойм
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}>
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip />
              <Bar dataKey="tests" fill="#3B82F6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-blue-600 mb-4">
            Тайлангийн төлөвийн хураангуй
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="grid grid-cols-2 lg:grid-cols-1 gap-8 ">
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-6 w-3/4 mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-blue-600">
              Үйлчлүүлэгчид харах
            </h2>
            <Link
              href="/lab/clients"
              className="text-sm text-blue-600 hover:underline"
            >
              Бүгдийг харах
            </Link>
          </div>

          <ul className="space-y-4">
            {sampleTests.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between border border-gray-100 hover:border-blue-600 rounded-lg p-4 transition"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={t.img}
                    alt={t.patient}
                    className="w-10 h-10 rounded-full object-cover border"
                  />
                  <div>
                    <div className="font-medium text-gray-800">
                      {t.patient}{" "}
                      <span className="text-gray-500 text-sm">
                        — {label(t.testType)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {t.scheduledFor}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusPill status={t.status} />
                  <Link
                    href={`/lab/tests/${t.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Нээх
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
