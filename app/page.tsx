"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import imageCompression from "browser-image-compression";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  
  const [wheels, setWheels] = useState<any[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // เพิ่ม State เช็คการกดค้นหา
  
  // 1. แยก State สำหรับฝั่งตัวค้นหา (Filter)
  const [filterData, setFilterData] = useState({
    inches: "",
    holes: "",
    pcd: ""
  });

  // 2. State สำหรับฝั่งกรอกข้อมูลสินค้าใหม่ (Modal)
  const [formData, setFormData] = useState({ 
    brand: "", 
    design: "", 
    inches: "", 
    holes: "5", 
    pcd: "114.3", 
    color: "", 
    type: "", 
    ea_price: "", 
    pck_price: "", 
    dsc_price: "" 
  });
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // ฟังก์ชันเช็ค PIN
  const handlePinChange = async (val: string) => {
    const numericValue = val.replace(/[^0-9]/g, "").slice(0, 6);
    setPin(numericValue);
    setErrorMsg("");

    if (numericValue.length === 6) {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("passcode", numericValue)
        .eq("is_active", true)
        .single();

      if (data) {
        setUserRole(data.role);
        setIsLoggedIn(true);
      } else {
        setErrorMsg("รหัส PIN ไม่ถูกต้อง");
        setPin("");
      }
    }
  };

  // ฟังก์ชันค้นหา/ฟิลเตอร์ (ดึงข้อมูลเฉพาะตอนกดปุ่ม)
  const filterWheels = async () => {
    setHasSearched(true); // เปลี่ยนสถานะว่ามีการกดค้นหาแล้ว
    let query = supabase.from("wheels").select("*");
    
    if (filterData.inches) query = query.eq("inches", filterData.inches);
    if (filterData.holes) query = query.eq("holes", filterData.holes);
    if (filterData.pcd) query = query.eq("pcd", filterData.pcd);
    
    const { data } = await query;
    if (data) setWheels(data);
  };

  // ฟังก์ชันจัดการตอนเลือกไฟล์ภาพ
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  // ฟังก์ชันอัปโหลดและบันทึกข้อมูล
  const handleUpload = async () => {
    if (!file || !formData.brand || !formData.design || !formData.inches) {
      return alert("กรุณากรอกข้อมูลสำคัญให้ครบถ้วน (รูปภาพ, ยี่ห้อ, รุ่น, และขนาดขอบ)");
    }

    setIsUploading(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.1, maxWidthOrHeight: 800 });
      const fileName = `${Date.now()}.webp`;
      
      const { error: uploadError } = await supabase.storage.from("wheel-images").upload(fileName, compressed);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("wheel-images").getPublicUrl(fileName);
      
      const { error: insertError } = await supabase.from("wheels").insert({ 
        ...formData, 
        image_url: urlData.publicUrl 
      });
      if (insertError) throw insertError;

      alert("บันทึกข้อมูลสำเร็จ!");
      closeModal();
      
      // อัปเดตรายการสินค้าเฉพาะถ้าเคยค้นหาไว้แล้ว
      if (hasSearched) filterWheels();
    } catch (error: any) {
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // ฟังก์ชันลบสินค้า
  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm("ยืนยันการลบสินค้านี้?")) return;
    const fileName = imageUrl.split('/').pop();
    if (fileName) {
      await supabase.storage.from("wheel-images").remove([fileName]);
    }
    await supabase.from("wheels").delete().eq("id", id);
    
    // รีเฟรชข้อมูลล่าสุด
    filterWheels();
  };

  // ฟังก์ชันปิด Modal และล้างค่าฟอร์ม
  const closeModal = () => {
    setShowAdmin(false);
    setPreview(null);
    setFile(null);
    setFormData({ brand: "", design: "", inches: "", holes: "5", pcd: "114.3", color: "", type: "", ea_price: "", pck_price: "", dsc_price: "" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilterData(prev => ({ ...prev, [name]: value }));
  };

  // --- หน้าจอ Login ---
  if (!isLoggedIn) return (
    <div className="flex h-screen items-center justify-center p-6" style={{ backgroundColor: "#F5F3F4" }}>
      <div className="w-full max-w-sm p-8 rounded-2xl shadow-xl border border-[#660708] text-center bg-white">
        <h2 className="text-2xl font-bold mb-6" style={{ color: "#660708" }}>กรอก PIN Code</h2>
        <input 
          type="password" maxLength={6} value={pin}
          className="w-full border-b-4 border-[#660708] p-3 mb-4 text-center text-3xl tracking-[0.5em] focus:outline-none" 
          style={{ color: "#161A1D" }} placeholder="------" 
          onChange={(e) => handlePinChange(e.target.value)} 
        />
        {errorMsg && <p className="text-sm font-bold animate-pulse" style={{ color: "#E5383B" }}>{errorMsg}</p>}
      </div>
    </div>
  );

  // --- หน้าจอหลัก ---
  return (
    <div className="min-h-screen pb-20 relative" style={{ backgroundColor: "#F5F3F4" }}>
      <header className="p-4 border-b border-[#660708] flex justify-between items-center sticky top-0 z-10 bg-white shadow-sm">
        <h1 className="text-xl font-bold" style={{ color: "#660708" }}>Wheels Catalog</h1>
        <button onClick={() => setIsLoggedIn(false)} className="text-sm underline" style={{ color: "#A4161A" }}>ออกจากระบบ</button>
      </header>

      {/* ------------------------------------------- */}
      {/* ส่วนค้นหาสินค้า (Filter ด้านบนสุด) */}
      {/* ------------------------------------------- */}
      <div className="p-4 m-3 rounded-xl border border-[#660708] shadow-sm bg-white">
        <h3 className="font-bold mb-3" style={{ color: "#660708" }}>ค้นหาล้อแม็ก:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select name="inches" className="border border-[#660708] p-2 rounded-lg text-[#161A1D]" value={filterData.inches} onChange={handleFilterChange}>
            <option value="">ทุกขอบ</option>
            <option value="15">15"</option>
            <option value="16">16"</option>
            <option value="17">17"</option>
            <option value="18">18"</option>
            <option value="20">20"</option>
          </select>
          
          <select name="holes" className="border border-[#660708] p-2 rounded-lg text-[#161A1D]" value={filterData.holes} onChange={handleFilterChange}>
            <option value="">ทุกรู</option>
            <option value="4">4H</option>
            <option value="5">5H</option>
            <option value="6">6H</option>
          </select>
          
          <select name="pcd" className="border border-[#660708] p-2 rounded-lg text-[#161A1D]" value={filterData.pcd} onChange={handleFilterChange}>
            <option value="">ทุก PCD</option>
            <option value="100">100</option>
            <option value="114.3">114.3</option>
            <option value="130">130</option>
            <option value="139.7">139.7</option>
          </select>
          
          <button onClick={filterWheels} className="p-2 rounded-lg font-bold text-white transition-opacity hover:opacity-90 shadow-sm" style={{ backgroundColor: "#E5383B" }}>ค้นหา</button>
        </div>
      </div>

      {/* ส่วนแสดงรายการสินค้า */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
        {wheels.map((w) => (
          <div key={w.id} className="p-3 rounded-xl shadow-md border border-[#660708] flex flex-col relative bg-white hover:shadow-lg transition-shadow">
            {userRole === 'admin' && (
              <button onClick={() => handleDelete(w.id, w.image_url)} className="absolute top-2 right-2 bg-red-600 text-white w-7 h-7 rounded-full text-xs font-bold z-10 flex items-center justify-center hover:bg-red-700">✕</button>
            )}
            <img src={w.image_url} alt={w.design} className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
            <div className="mt-3" style={{ color: "#161A1D" }}>
              <h3 className="font-bold text-sm truncate uppercase">{w.brand} - {w.design}</h3>
              <p className="text-xs text-gray-600 mt-1">ขอบ {w.inches} | {w.holes}H {w.pcd}</p>
              {w.color && <p className="text-xs text-gray-400">สี: {w.color}</p>}
              <p className="text-xs font-semibold mt-1 text-[#E5383B]">ชุดละ: {w.pck_price ? `${Number(w.pck_price).toLocaleString()} ฿` : '-'}</p>
            </div>
          </div>
        ))}
        
        {/* ข้อความแจ้งเตือนเมื่อไม่มีสินค้า */}
        {wheels.length === 0 && (
          <div className="col-span-full text-center py-12 px-4 border-2 border-dashed border-gray-300 rounded-xl mt-4 bg-gray-50">
            <span className="text-4xl mb-3 block">{hasSearched ? "🔍" : "⚙️"}</span>
            <p className="text-gray-600 font-medium">
              {hasSearched ? "ไม่พบข้อมูลสินค้าที่คุณค้นหา" : "กรุณาเลือกตัวกรองและกดค้นหาเพื่อดูสินค้า"}
            </p>
          </div>
        )}
      </div>

      {/* ปุ่ม Floating Button สำหรับ Admin */}
      {userRole === 'admin' && (
        <button 
          onClick={() => setShowAdmin(true)} 
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl text-3xl text-white flex items-center justify-center hover:scale-105 transition-transform" 
          style={{ backgroundColor: "#E5383B" }}
        >
          +
        </button>
      )}

      {/* ------------------------------------------- */}
      {/* DIALOG / MODAL สำหรับเพิ่มสินค้าใหม่ */}
      {/* ------------------------------------------- */}
      {showAdmin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-[#660708]">
            
            {/* Header Modal */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold" style={{ color: "#660708" }}>เพิ่มสินค้าใหม่ (ล้อแม็ก)</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-red-500 text-2xl font-bold">✕</button>
            </div>

            {/* ฟอร์มกรอกข้อมูล */}
            <div className="p-6 space-y-5">
              
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 relative">
                {preview ? (
                  <div className="relative w-48 h-48">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-lg border border-gray-300 shadow-sm" />
                    <button onClick={() => { setPreview(null); setFile(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md">✕</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer text-gray-500 hover:text-[#E5383B]">
                    <span className="text-4xl mb-2">📸</span>
                    <span className="text-sm font-medium">คลิกเพื่ออัปโหลดรูปภาพ</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1 text-[#161A1D]">ยี่ห้อ (Brand) <span className="text-red-500">*</span></label>
                  <input type="text" name="brand" value={formData.brand} onChange={handleInputChange} className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-[#E5383B] outline-none" placeholder="เช่น TE37" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-[#161A1D]">รุ่น (Design) <span className="text-red-500">*</span></label>
                  <input type="text" name="design" value={formData.design} onChange={handleInputChange} className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-[#E5383B] outline-none" placeholder="เช่น ก้านตรง" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1 text-[#161A1D]">ขอบ (Inches) <span className="text-red-500">*</span></label>
                  <select name="inches" value={formData.inches} onChange={handleInputChange} className="w-full border p-2 rounded-lg focus:ring-2 outline-none text-[#161A1D]">
                    <option value="">เลือกขอบ</option>
                    <option value="15">15"</option>
                    <option value="16">16"</option>
                    <option value="17">17"</option>
                    <option value="18">18"</option>
                    <option value="20">20"</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-[#161A1D]">รู (Holes)</label>
                  <select name="holes" value={formData.holes} onChange={handleInputChange} className="w-full border p-2 rounded-lg focus:ring-2 outline-none text-[#161A1D]">
                    <option value="4">4H</option>
                    <option value="5">5H</option>
                    <option value="6">6H</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-[#161A1D]">ระยะ (PCD)</label>
                  <select name="pcd" value={formData.pcd} onChange={handleInputChange} className="w-full border p-2 rounded-lg focus:ring-2 outline-none text-[#161A1D]">
                    <option value="100">100</option>
                    <option value="114.3">114.3</option>
                    <option value="130">130</option>
                    <option value="139.7">139.7</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1 text-[#161A1D]">สี (Color)</label>
                  <input type="text" name="color" value={formData.color} onChange={handleInputChange} className="w-full border p-2 rounded-lg focus:ring-2 outline-none" placeholder="เช่น น้ำตาล, ดำเงา" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-[#161A1D]">สไตล์ (Type)</label>
                  <input type="text" name="type" value={formData.type} onChange={handleInputChange} className="w-full border p-2 rounded-lg focus:ring-2 outline-none" placeholder="เช่น รถเก๋ง, กระบะ" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-gray-200 pt-4 mt-2">
                <div>
                  <label className="block text-sm font-bold mb-1 text-[#161A1D]">ราคาวง (EA)</label>
                  <input type="number" name="ea_price" value={formData.ea_price} onChange={handleInputChange} className="w-full border p-2 rounded-lg focus:ring-2 outline-none" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-[#161A1D]">ราคาชุด (Pack)</label>
                  <input type="number" name="pck_price" value={formData.pck_price} onChange={handleInputChange} className="w-full border p-2 rounded-lg focus:ring-2 outline-none border-[#A4161A]/30" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-[#161A1D]">ราคาลด (Discount)</label>
                  <input type="number" name="dsc_price" value={formData.dsc_price} onChange={handleInputChange} className="w-full border p-2 rounded-lg focus:ring-2 outline-none text-[#E5383B]" placeholder="0" />
                </div>
              </div>

            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end space-x-3 rounded-b-2xl">
              <button 
                onClick={closeModal} 
                className="px-5 py-2 font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                disabled={isUploading}
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleUpload} 
                className={`px-5 py-2 font-bold text-white rounded-lg transition-colors flex items-center ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#E5383B] hover:bg-[#BA1826]'}`}
                disabled={isUploading}
              >
                {isUploading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}