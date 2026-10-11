"use client"

import React, { useState } from "react"
import { label } from "@/lib/labels"

type Report = {
  id: string
  patientName: string
  nurseName: string
  visitDate: string
  submittedAt: string
  status: "Pending Review" | "Approved" | "Rejected"
  vitals: {
    temperature: string
    bloodPressure: string
    pulseRate: string
    oxygenLevel: string
    weight: string
  }
  notes: string
}

const mockReports: Report[] = [
  {
    id: "1",
    patientName: "John Doe",
    nurseName: "Sarah Wilson",
    visitDate: "2025-11-02",
    submittedAt: "2025-11-02 11:30 AM",
    status: "Pending Review",
    vitals: {
      temperature: "98.6°F",
      bloodPressure: "120/80",
      pulseRate: "72",
      oxygenLevel: "98%",
      weight: "70kg",
    },
    notes: "Өвчтөн бага зэрэг толгой өвдөж байгаа гэв. Бүх амин үзүүлэлт хэвийн.",
  },
  {
    id: "2",
    patientName: "Jane Smith",
    nurseName: "Michael Brown",
    visitDate: "2025-11-02",
    submittedAt: "2025-11-02 2:45 PM",
    status: "Pending Review",
    vitals: {
      temperature: "98.8°F",
      bloodPressure: "118/75",
      pulseRate: "68",
      oxygenLevel: "99%",
      weight: "65kg",
    },
    notes: "Давтан үзлэг. Эдгэрэлт сайн явагдаж байна.",
  },
]

export const ReportList = () => {
  const [reports, setReports] = useState(mockReports)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [showRejectModal, setShowRejectModal] = useState(false)

  const handleApprove = (reportId: string) => {
    setReports(
      reports.map((report) =>
        report.id === reportId
          ? { ...report, status: "Approved" as const }
          : report
      )
    )
  }

  const handleReject = (reportId: string) => {
    setSelectedReport(reports.find((r) => r.id === reportId) || null)
    setShowRejectModal(true)
  }

  const submitRejection = () => {
    if (!selectedReport) return

    setReports(
      reports.map((report) =>
        report.id === selectedReport.id
          ? { ...report, status: "Rejected" as const }
          : report
      )
    )
    setShowRejectModal(false)
    setRejectReason("")
    setSelectedReport(null)
  }

  return (
    <>
      <div className="space-y-5">
        {reports.map((report) => (
          <div key={report.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{report.patientName}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Nurse: {report.nurseName}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {report.visitDate}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    report.status === "Pending Review"
                      ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                      : report.status === "Approved"
                      ? "bg-green-100 text-green-800 border border-green-200"
                      : "bg-red-100 text-red-800 border border-red-200"
                  }`}
                >
                  {label(report.status)}
                </span>
              </div>

              {/* Vitals */}
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Амин үзүүлэлт</h4>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Биеийн халуун</p>
                      <p className="text-lg font-semibold text-gray-900">{report.vitals.temperature}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Цусны даралт</p>
                      <p className="text-lg font-semibold text-gray-900">{report.vitals.bloodPressure}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Судасны цохилт</p>
                      <p className="text-lg font-semibold text-gray-900">{report.vitals.pulseRate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Хүчилтөрөгчийн түвшин</p>
                      <p className="text-lg font-semibold text-gray-900">{report.vitals.oxygenLevel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Жин</p>
                      <p className="text-lg font-semibold text-gray-900">{report.vitals.weight}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Тэмдэглэл</h4>
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-md border border-gray-200">
                  {report.notes}
                </p>
              </div>

              {/* Actions */}
              {report.status === "Pending Review" && (
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleApprove(report.id)}
                    className="flex-1 bg-green-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Батлах
                  </button>
                  <button
                    onClick={() => handleReject(report.id)}
                    className="flex-1 bg-white text-red-600 py-2.5 px-4 rounded-lg font-medium border-2 border-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Татгалзах
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full shadow-xl">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Тайланг татгалзах</h3>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Татгалзсан шалтгаан
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Энэ тайланг татгалзах шалтгаанаа бичнэ үү..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[100px] resize-none"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Үүнийг сувилагчид илгээнэ
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={submitRejection}
                  disabled={!rejectReason.trim()}
                  className="flex-1 bg-red-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Илгээх
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setRejectReason("")
                    setSelectedReport(null)
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Цуцлах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
