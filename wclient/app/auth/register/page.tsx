"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useAuth } from "@/lib/context/AuthContext";
import { UserRole } from "@/lib/services/auth";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const { signup, isLoading } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "CHILD" as UserRole,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password match
    if (form.password !== form.confirmPassword) {
      toast.error("Нууц үг таарахгүй байна!");
      return;
    }

    // Validate password length
    if (form.password.length < 6) {
      toast.error("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой!");
      return;
    }

    try {
      await signup(form.name, form.email, form.password, form.role);
      // Navigation is handled in AuthContext after successful signup
    } catch (error) {
      // Error handling is done in AuthContext with toast notifications
      console.error('Signup failed:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] p-4">
      <Card className="max-w-md w-full rounded-2xl shadow-xl border border-gray-200">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-blue-600">
            Бүртгэл үүсгэх
          </CardTitle>
          <CardDescription className="text-gray-600 mt-2">
            Хайртай хүмүүсийнхээ эрүүл мэндийг хялбархан хянахын тулд PariwarCare-д нэгдээрэй
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-4">
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div>
              <label className="text-gray-700 text-sm font-semibold">
                Овог нэр
              </label>
              <Input
                name="name"
                type="text"
                placeholder="Бат-Эрдэнэ Дорж"
                value={form.name}
                onChange={handleChange}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-gray-700 text-sm font-semibold">
                Имэйл
              </label>
              <Input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-gray-700 text-sm font-semibold">
                Үүрэг
              </label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                required
              >
                <option value="CHILD">Хүүхэд (өвчтөний ар гэр)</option>
                <option value="NURSE">Сувилагч (асран хамгаалагч)</option>
                <option value="ADMIN">Админ</option>
                <option value="MEDICAL_ADMIN">Эмнэлгийн админ</option>
              </select>
            </div>

            <div>
              <label className="text-gray-700 text-sm font-semibold">
                Нууц үг
              </label>
              <Input
                name="password"
                type="password"
                placeholder="********"
                value={form.password}
                onChange={handleChange}
                className="mt-1"
                required
              />
            </div>

            <div>
              <label className="text-gray-700 text-sm font-semibold">
                Нууц үг баталгаажуулах
              </label>
              <Input
                name="confirmPassword"
                type="password"
                placeholder="********"
                value={form.confirmPassword}
                onChange={handleChange}
                className="mt-1"
                required
              />
            </div>

            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? "Бүртгэл үүсгэж байна..." : "Бүртгүүлэх"}
            </Button>
          </form>

          <p className="mt-6 text-center text-gray-600 text-sm">
            Бүртгэлтэй юу?{" "}
            <a
              href="/auth/login"
              className="text-blue-600 hover:underline font-medium"
            >
              Нэвтрэх
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
