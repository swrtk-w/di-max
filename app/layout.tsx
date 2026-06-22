"use client";

import { useState, useEffect } from "react";
import "./globals.css";
import { Lock, Orbit } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const staff = sessionStorage.getItem("staff_session");
    if (staff) setIsAuthorized(true);
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
        setError("");
      } else {
        setError("รหัสไม่ถูกต้อง");
        setPin("");
      }
    }
  };

  return (
    <html lang="th" className="dark">
      <title>Velocity Forge</title>
      <body className="bg-[#131313] text-[#e5e2e1]">
        {!isAuthorized && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0e0e0e]/90 backdrop-blur-md">
            <div className="bg-[#1c1b1b] p-8 rounded-2xl shadow-2xl border border-[#414755] w-80 text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-[#adc6ff]/10 rounded-full flex items-center justify-center text-[#adc6ff] border border-[#adc6ff]/20">
                <Lock size={28} />
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => handleCheckPin(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full text-center text-3xl font-black py-4 bg-[#131313] border border-[#414755] rounded-xl outline-none text-[#adc6ff]"
                autoFocus
              />
              {error && <p className="text-[#ffb4ab] text-[10px] font-bold uppercase">{error}</p>}
            </div>
          </div>
        )}
        <main className="min-h-screen bg-[#131313]">
          {children}
        </main>
      </body>
    </html>
  );
}