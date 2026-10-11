"use client"

import React from "react"
import { label } from "@/lib/labels"

type Visit = {
  id: string
  patientName: string
  date: string
  time: string
  address: string
  visitType: "Check-up" | "Diagnostic" | "Follow-up"
  status: "Pending" | "In Progress" | "Completed"
}

const mockVisits: Visit[] = [
  {
    id: "1",
    patientName: "John Doe",
    date: "2025-11-02",
    time: "10:00 AM",
    address: "123 Healthcare St, Medical City",
    visitType: "Check-up",
    status: "Pending",
  },
  {
    id: "2",
    patientName: "Jane Smith",
    date: "2025-11-02",
    time: "2:30 PM",
    address: "456 Wellness Ave, Care Town",
    visitType: "Follow-up",
    status: "Pending",
  },
]

export function NurseVisitList() {
  const handleStartVisit = (visitId: string) => {
    // TODO: Implement visit start logic
    console.log("Starting visit:", visitId)
  }

  const getVisitTypeBadge = (type: Visit["visitType"]) => {
    const styles = {
      "Check-up": "bg-blue-50 text-blue-700 border-blue-200",
      "Diagnostic": "bg-purple-50 text-purple-700 border-purple-200",
      "Follow-up": "bg-green-50 text-green-700 border-green-200"
    }
    return styles[type]
  }

  return (
    <div className="space-y-4">
      {mockVisits.map((visit) => (
        <div key={visit.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="p-5">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{visit.patientName}</h3>
                <p className="text-sm text-gray-600">
                  {visit.date} at {visit.time}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  visit.status === "Pending"
                    ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                    : visit.status === "In Progress"
                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                    : "bg-green-100 text-green-800 border border-green-200"
                }`}
              >
                {label(visit.status)}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-2 text-sm">
                <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-xs text-gray-500">Хаяг</p>
                  <p className="text-gray-900 font-medium">{visit.address}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Үзлэгийн төрөл:</span>
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${getVisitTypeBadge(visit.visitType)}`}>
                  {label(visit.visitType)}
                </span>
              </div>
            </div>

            {/* Action Button */}
            {visit.status === "Pending" && (
              <button
                onClick={() => handleStartVisit(visit.id)}
                className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Үзлэг эхлүүлэх
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
