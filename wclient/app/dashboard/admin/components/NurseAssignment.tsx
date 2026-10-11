"use client"

import React, { useState, useEffect } from "react"
import { label } from "@/lib/labels"
import { visitAPI } from "@/lib/api/client"

type Nurse = {
  id: string;
  name: string;
  email: string;
  region: string;
  activeVisits: number;
  status: 'Available' | 'On Visit' | 'Off Duty';
};

type Visit = {
  id: string;
  patientName: string;
  date: string;
  time: string;
  region: string;
  status: 'Unassigned' | 'Assigned' | 'Completed';
  assignedNurse?: string;
};

const mockNurses: Nurse[] = [
  {
    id: '1',
    name: 'Sarah Wilson',
    email: 'sarah.w@example.com',
    region: 'North',
    activeVisits: 2,
    status: 'Available'
  },
  {
    id: '2',
    name: 'Michael Brown',
    email: 'michael.b@example.com',
    region: 'South',
    activeVisits: 3,
    status: 'On Visit'
  }
];

const mockVisits: Visit[] = [
  {
    id: '1',
    patientName: 'John Doe',
    date: '2025-11-03',
    time: '10:00 AM',
    region: 'North',
    status: 'Unassigned'
  },
  {
    id: '2',
    patientName: 'Jane Smith',
    date: '2025-11-03',
    time: '2:30 PM',
    region: 'South',
    status: 'Unassigned'
  }
];

export const NurseAssignment = () => {
  const [visits, setVisits] = useState(mockVisits)
  const [selectedRegion, setSelectedRegion] = useState<string>("All")
  const [loading, setLoading] = useState(false)

  const filteredVisits = visits.filter(
    (visit) => selectedRegion === "All" || visit.region === selectedRegion
  )

  // Example: Fetch visits from API
  // const getVisits = async () => {
  //   try {
  //     setLoading(true);
  //     const response = await visitAPI.getChildVisits();
  //     if (response.data.success && response.data.data) {
  //       console.log("Visit data", response.data.data.visits);
  //       // You can map API visits to your local Visit type here
  //       // setVisits(mappedVisits);
  //     }
  //   } catch (error) {
  //     console.log("Error fetching visits", error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const getVisits = async () => {
    try {
      console.log("calling get visit api")
      setLoading(true)
      const data = await visitAPI.getChildVisits()
      console.log("Fetched visits", data)
    } catch (error) {
      console.log("Error fetching visits", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getVisits()
  }, []) // Empty dependency array to run only once on mount

  // Uncomment to fetch on component mount
  // useEffect(() => {
  //   getVisits();
  // }, []);

  const handleAssignNurse = (visitId: string, nurseId: string) => {
    setVisits(
      visits.map((visit) =>
        visit.id === visitId
          ? { ...visit, status: "Assigned" as const, assignedNurse: nurseId }
          : visit
      )
    )
  }

  const handleAutoAssign = () => {
    // Simple auto-assignment logic (could be made more sophisticated)
    const availableNurses = mockNurses.filter((n) => n.status === "Available")

    setVisits(
      visits.map((visit) => {
        if (visit.status !== "Unassigned") return visit

        const matchingNurse = availableNurses.find(
          (n) => n.region === visit.region
        )
        if (!matchingNurse) return visit

        return {
          ...visit,
          status: "Assigned" as const,
          assignedNurse: matchingNurse.id,
        }
      })
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex gap-4 items-center flex-wrap">
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">Бүх бүс</option>
          <option value="North">Хойд</option>
          <option value="South">Өмнөд</option>
          <option value="East">Зүүн</option>
          <option value="West">Баруун</option>
        </select>
        <button
          onClick={handleAutoAssign}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg transition-all duration-200 font-medium"
        >
          Боломжтой сувилагчдыг автоматаар томилох
        </button>
      </div>

      {/* Nurses Overview */}
      <div className="relative">
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg" />
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-6">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-800">
              Боломжтой сувилагчид
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {mockNurses.map((nurse) => (
              <div key={nurse.id} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-gray-50 rounded-xl border border-gray-200 shadow-sm group-hover:shadow-md group-hover:border-blue-200 transition-all duration-200" />
                <div className="relative p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-lg mb-1">
                        {nurse.name}
                      </h4>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        {nurse.email}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                        nurse.status === "Available"
                          ? "bg-green-100 text-green-800 ring-1 ring-green-200"
                          : nurse.status === "On Visit"
                          ? "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200"
                          : "bg-gray-100 text-gray-800 ring-1 ring-gray-200"
                      }`}
                    >
                      {label(nurse.status)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="text-sm font-medium">
                        Бүс: {label(nurse.region)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 rounded-full">
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      <span className="text-sm font-semibold text-blue-700">
                        {nurse.activeVisits}
                      </span>
                      <span className="text-xs text-blue-600">идэвхтэй</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Visits List */}
      <div className="relative">
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg" />
        <div className="relative overflow-hidden rounded-2xl">
          <div className="p-6 border-b border-gray-200/50 bg-gradient-to-r from-gray-50/50 to-white/50">
            <div className="flex items-center gap-2">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">
                Удахгүй болох үзлэгүүд
              </h3>
              <span className="ml-auto px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                {filteredVisits.length} visits
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 backdrop-blur-sm border-b border-gray-200/50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Өвчтөн
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Огноо ба цаг
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Бүс
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Төлөв
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Сувилагч томилох
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/50">
                {filteredVisits.map((visit) => (
                  <tr
                    key={visit.id}
                    className="hover:bg-blue-50/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">
                        {visit.patientName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <span className="font-medium">{visit.date}</span>
                        <span className="text-gray-500">цагт</span>
                        <span className="font-medium">{visit.time}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg">
                        <svg
                          className="w-3.5 h-3.5 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">
                          {label(visit.region)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                          visit.status === "Unassigned"
                            ? "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200"
                            : visit.status === "Assigned"
                            ? "bg-green-100 text-green-800 ring-1 ring-green-200"
                            : "bg-blue-100 text-blue-800 ring-1 ring-blue-200"
                        }`}
                      >
                        {label(visit.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {visit.status === "Unassigned" && (
                        <select
                          onChange={(e) =>
                            handleAssignNurse(visit.id, e.target.value)
                          }
                          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Сувилагч сонгох
                          </option>
                          {mockNurses
                            .filter(
                              (n) =>
                                n.status === "Available" &&
                                n.region === visit.region
                            )
                            .map((nurse) => (
                              <option key={nurse.id} value={nurse.id}>
                                {nurse.name}
                              </option>
                            ))}
                        </select>
                      )}
                      {visit.status === "Assigned" && (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-green-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {
                              mockNurses.find(
                                (n) => n.id === visit.assignedNurse
                              )?.name
                            }
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}