"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/lib/context/AuthContext";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login form submitted', { email, password: '***' });

    // Basic validation
    if (!email || !password) {
      console.log('Validation failed: missing email or password');
      return;
    }

    try {
      console.log('Calling login function...');
      await login(email, password);
      // Navigation is handled in the AuthContext after successful login
    } catch (error) {
      // Error handling is done in AuthContext with toast notifications
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] p-4 ">
      <Card className="max-w-md h-1/2 w-full flex flex-col gap-3 rounded-2xl shadow-xl border border-gray-200">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-blue-600">
            Тавтай морил
          </CardTitle>
          <CardDescription className="text-gray-600 mt-2">
            Эцэг эхийнхээ эрүүл мэндийг удирдахын тулд нэвтэрнэ үү
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-4">
          <form onSubmit={handleLogin} className="flex flex-col gap-8">
            <div>
              <label className="text-gray-700 text-sm  font-semibold">Имэйл хаяг
              </label>
              <Input
                type="email"
                placeholder="Имэйлээ оруулна уу"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 shadow-lg"
              />
            </div>

            <div>
              <label className="flex justify-between text-gray-700 text-sm font-semibold">
                Нууц үг
                <a href="#" className="text-blue-500 hover:underline text-sm font-semibold">
                  Нууц үгээ мартсан уу?
                </a>
              </label>
              <Input
                type="password"
                placeholder="Нууц үгээ оруулна уу"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 shadow-lg"
              />
            </div>

            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
              {isLoading ? "Нэвтэрч байна..." : "Нэвтрэх"}
            </Button>

           
          </form>

          <p className="mt-6 text-center text-gray-600 text-sm">
            Бүртгэл байхгүй юу?{" "}
            <a href="/auth/register" className="text-blue-500 hover:underline font-semibold ">
              Бүртгүүлэх
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
