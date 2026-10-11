"use client"

import React, { useState } from "react"
import { label } from "@/lib/labels"

type User = {
  id: string
  name: string
  email: string
  role: "Patient" | "Nurse" | "Medical Admin" | "Child" | "Admin"
  status: "Active" | "Suspended"
  lastActive: string
}

const mockUsers: User[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@example.com",
    role: "Patient",
    status: "Active",
    lastActive: "2025-11-02 10:30 AM",
  },
  {
    id: "2",
    name: "Sarah Wilson",
    email: "sarah.wilson@example.com",
    role: "Nurse",
    status: "Active",
    lastActive: "2025-11-02 11:45 AM",
  },
  {
    id: "3",
    name: "Mike Johnson",
    email: "mike.j@example.com",
    role: "Medical Admin",
    status: "Active",
    lastActive: "2025-11-02 09:15 AM",
  },
]

export const UserManagement = () => {
  const [users, setUsers] = useState(mockUsers)
  const [selectedRole, setSelectedRole] = useState<User["role"] | "All">("All")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredUsers = users.filter((user) => {
    const matchesRole = selectedRole === "All" || user.role === selectedRole
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesRole && matchesSearch
  })

  const handleStatusToggle = (userId: string) => {
    setUsers(
      users.map((user) =>
        user.id === userId
          ? {
              ...user,
              status:
                user.status === "Active"
                  ? ("Suspended" as const)
                  : ("Active" as const),
            }
          : user
      )
    )
  }

  const handleRoleChange = (userId: string, newRole: User["role"]) => {
    setUsers(
      users.map((user) =>
        user.id === userId ? { ...user, role: newRole } : user
      )
    )
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg" />
      <div className="relative overflow-hidden rounded-2xl">
        {/* Filters */}
        <div className="p-6 border-b border-gray-200/50 bg-gradient-to-r from-gray-50/50 to-white/50">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[250px] relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Хэрэглэгч хайх..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <select
              value={selectedRole}
              onChange={(e) =>
                setSelectedRole(e.target.value as User["role"] | "All")
              }
              className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="All">Бүх үүрэг</option>
              <option value="Patient">Өвчтөн</option>
              <option value="Nurse">Сувилагч</option>
              <option value="Medical Admin">Эмнэлгийн админ</option>
              <option value="Child">Хүүхэд</option>
              <option value="Admin">Админ</option>
            </select>
          </div>
        </div>

        {/* User List */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 backdrop-blur-sm">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Нэр
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Имэйл
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Үүрэг
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Төлөв
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Сүүлд идэвхтэй
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                  Үйлдэл
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/50">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{user.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-600">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(user.id, e.target.value as User["role"])
                      }
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                      <option value="Patient">Өвчтөн</option>
                      <option value="Nurse">Сувилагч</option>
                      <option value="Medical Admin">Эмнэлгийн админ</option>
                      <option value="Child">Хүүхэд</option>
                      <option value="Admin">Админ</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        user.status === "Active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {label(user.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">{user.lastActive}</div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleStatusToggle(user.id)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        user.status === "Active"
                          ? "bg-red-50 text-red-700 hover:bg-red-100 hover:shadow-sm"
                          : "bg-green-50 text-green-700 hover:bg-green-100 hover:shadow-sm"
                      }`}
                    >
                      {user.status === "Active" ? "Түдгэлзүүлэх" : "Идэвхжүүлэх"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
