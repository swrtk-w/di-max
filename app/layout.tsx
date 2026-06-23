"use client";

import { useState, useEffect } from "react";
import "./globals.css";
import { Lock } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState<string>("admin");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const staff = sessionStorage.getItem("staff_session");
    if (staff) {
      setIsAuthorized(true);
      const userData = JSON.parse(staff);
      setRole(userData.role || "admin");
    }
  }, []);

  const handleCheckPin = async (val: string) => {
    setPin(val);
    if (val.length === 4) {
      const { data } = await supabase
        .from("users")
        .select("passcode, role")
        .eq("passcode", val)
        .single();

      if (data) {
        sessionStorage.setItem("staff_session", JSON.stringify(data));
        setIsAuthorized(true);
        setRole(data.role || "admin");
        setError("");
      } else {
        setError("รหัสไม่ถูกต้อง");
        setPin("");
      }
    }
  };

  return (
    <html lang="th" data-theme={role}>
      <title>ล้อแม็กซ์ - ดิยางยนต์ ละงู</title>
      <body className="bg-bg-main text-text-primary antialiased">
        {!isAuthorized ? (
          /* หน้าจอสำหรับกรอกรหัสผ่าน (PIN Authorization) */
          <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="bg-bg-surface p-8 rounded-2xl shadow-2xl border border-border-default w-80 text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-bg-accent-10 rounded-full flex items-center justify-center text-accent border border-border-accent-20">
                <Lock size={28} />
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => handleCheckPin(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full text-center text-3xl font-black py-4 bg-bg-main border border-border-default rounded-xl outline-none text-accent"
                autoFocus
              />
              {error && <p className="text-danger-text text-[10px] font-bold uppercase">{error}</p>}
            </div>
          </div>
        ) : (
          /* หน้าจอส่วนแสดงผลเนื้อหาหลักของระบบเมื่อผ่านการตรวจสอบ */
          <main className="min-h-screen bg-bg-main">
            {children}
          </main>
        )}
      </body>
    </html>
  );
}