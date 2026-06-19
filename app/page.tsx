"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import imageCompression from "browser-image-compression";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [wheels, setWheels] = useState<any[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [formData, setFormData] = useState({ 
    brand: "", design: "", inches: "", holes: "5", pcd: "114.3", ea_price: "", pck_price: "", dsc_price: "" 
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // ฟังก์ชันค้นหาตามเงื่อนไข (เพื่อลด Bandwidth)
  const filterWheels = async () => {
    let query = supabase.from("wheels").select("*");
    if (formData.inches) query = query.eq("inches", formData.inches);
    if (formData.holes) query = query.eq("holes", formData.holes);
    if (formData.pcd) query = query.eq("pcd", formData.pcd);

    const { data, error } = await query;
    if (data) setWheels(data);
    else alert("ไม่พบข้อมูลหรือเกิดข้อผิดพลาด");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleUpload = async () => {
    if (!file || !formData.brand || !formData.design) return alert("กรุณากรอกข้อมูลให้ครบ");
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.1, maxWidthOrHeight: 400 });
      const baseName = `${formData.brand}-${formData.design}-${formData.inches}x${formData.holes}H${formData.pcd}`.toLowerCase().replace(/\s+/g, '-');
      const { data: existingFiles } = await supabase.storage.from("wheel-images").list('', { search: baseName });
      const fileName = `${baseName}${existingFiles && existingFiles.length > 0 ? `-${existingFiles.length + 1}` : ""}.webp`;

      await supabase.storage.from("wheel-images").upload(fileName, compressed);
      const { data: urlData } = supabase.storage.from("wheel-images").getPublicUrl(fileName);
      await supabase.from("wheels").insert({ ...formData, image_url: urlData.publicUrl });
      
      alert("บันทึกสำเร็จ!");
      setShowAdmin(false); setPreview(null);
    } catch (err) { alert("อัปโหลดไม่สำเร็จ"); }
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm("ยืนยันการลบ?")) return;
    const fileName = imageUrl.split('/').pop();
    if (fileName) await supabase.storage.from("wheel-images").remove([fileName]);
    await supabase.from("wheels").delete().eq("id", id);
    filterWheels();
  };

  if (!isLoggedIn) return (
    <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-xl border border-black text-center">
        <h2 className="text-2xl font-bold mb-6 text-black">เข้าสู่ระบบ</h2>
        <input type="password" className="w-full border border-black p-3 mb-4 rounded-lg text-black text-center" placeholder="รหัสลับ" onChange={(e) => setPasscode(e.target.value)} />
        <button onClick={async () => {
          const { data } = await supabase.from("users").select("*").eq("passcode", passcode).eq("is_active", true).single();
          if (data) { setUserRole(data.role); setIsLoggedIn(true); } else alert("รหัสผ่านไม่ถูกต้อง");
        }} className="w-full bg-black text-white p-3 rounded-lg font-bold">เข้าใช้งาน</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white p-4 border-b border-black flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-black">Wheels Catalog</h1>
        <button onClick={() => setIsLoggedIn(false)} className="text-sm underline">ออก</button>
      </header>

      {/* โซน Filter */}
      <div className="bg-white p-4 m-3 rounded-xl border border-black shadow-sm">
        <h3 className="font-bold mb-3 text-black">ค้นหาล้อแม็ก:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
<select 
      className="border border-black p-2 rounded-lg text-black" 
      onChange={(e) => setFormData({...formData, inches: e.target.value})}
    >
      <option value="">ทุกขอบ</option>
      {[14, 15, 16, 18, 20].map(size => (
        <option key={size} value={size}>{size}"</option>
      ))}
    </select>
          <select className="border border-black p-2 rounded-lg text-black" onChange={(e) => setFormData({...formData, holes: e.target.value})}>
            <option value="">ทุกรู</option><option value="4">4H</option><option value="5">5H</option><option value="6">6H</option>
          </select>
          <select className="border border-black p-2 rounded-lg text-black" onChange={(e) => setFormData({...formData, pcd: e.target.value})}>
            <option value="">ทุก PCD</option><option value="100">100</option><option value="114.3">114.3</option><option value="139.7">139.7</option>
          </select>
          <button onClick={filterWheels} className="bg-black text-white p-2 rounded-lg font-bold">ตกลง</button>
        </div>
      </div>

      {/* โซนแสดงผล */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
        {wheels.map((w) => (
          <div key={w.id} className="bg-white p-3 rounded-xl shadow-sm border border-black flex flex-col relative">
            {userRole === 'admin' && <button onClick={() => handleDelete(w.id, w.image_url)} className="absolute top-2 right-2 bg-red-600 text-white w-6 h-6 rounded-full text-xs font-bold z-10">X</button>}
            <div className="mx-auto w-full aspect-square overflow-hidden rounded-lg bg-gray-100 border border-black" style={{ maxWidth: '220px', maxHeight: '220px' }}>
              <img src={w.image_url} className="w-full h-full object-cover" />
            </div>
            <div className="mt-2 text-black">
              <h3 className="font-bold text-sm truncate">{w.brand} - {w.design}</h3>
              <p className="text-xs text-gray-700">{w.inches}" | {w.holes}H | PCD {w.pcd}</p>
              <div className="border-t border-black mt-1 pt-1 space-y-0.5">
                <p className="text-xs">ราคาวง: {w.ea_price}</p>
                <p className="text-sm font-bold">ราคาชุด: {w.pck_price}</p>
                {w.dsc_price && <div className="bg-black text-white p-1 rounded text-[10px] text-center font-bold">เสนอ: {w.dsc_price}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {userRole === 'admin' && <button onClick={() => setShowAdmin(true)} className="fixed bottom-6 right-6 bg-black text-white w-14 h-14 rounded-full shadow-xl text-2xl z-40">+</button>}
      


      {showAdmin && (
        <div className="fixed inset-0 bg-white flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full max-w-lg p-6 rounded-3xl border-2 border-black">
            <h2 className="text-xl font-bold mb-4 text-black border-b border-black pb-2">เพิ่มสินค้าใหม่</h2>
            
            {/* Custom File Upload UI */}
            <div className="mb-4">
              <label className="block w-full border-2 border-dashed border-black p-4 text-center cursor-pointer hover:bg-gray-100 rounded-lg">
                {preview ? <img src={preview} className="h-20 mx-auto" /> : <span className="text-black font-bold">คลิกเพื่อเลือกรูปภาพ</span>}
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input placeholder="ยี่ห้อ" className="border border-black p-2 rounded-lg text-black" onChange={(e) => setFormData({...formData, brand: e.target.value})} />
              <input placeholder="รุ่น (Design)" className="border border-black p-2 rounded-lg text-black" onChange={(e) => setFormData({...formData, design: e.target.value})} />
              <input placeholder="ขอบ" type="number" className="border border-black p-2 rounded-lg text-black" onChange={(e) => setFormData({...formData, inches: e.target.value})} />
              <select className="border border-black p-2 rounded-lg text-black" onChange={(e) => setFormData({...formData, holes: e.target.value})}>
                {[4, 5, 6].map(h => <option key={h} value={h}>{h}H</option>)}
              </select>
              <select className="border border-black p-2 rounded-lg text-black" onChange={(e) => setFormData({...formData, pcd: e.target.value})}>
                {[100, 114.3, 130, 139.7].map(p => <option key={p} value={p}>PCD {p}</option>)}
              </select>
              <input placeholder="ราคาวง" type="number" className="border border-black p-2 rounded-lg text-black" onChange={(e) => setFormData({...formData, ea_price: e.target.value})} />
              <input placeholder="ราคาชุด" type="number" className="border border-black p-2 rounded-lg text-black" onChange={(e) => setFormData({...formData, pck_price: e.target.value})} />
              <input placeholder="ราคาเสนอ" type="number" className="border border-black p-2 rounded-lg text-black" onChange={(e) => setFormData({...formData, dsc_price: e.target.value})} />
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={handleUpload} className="flex-1 bg-black text-white p-3 rounded-lg font-bold hover:bg-gray-800">บันทึก</button>
              <button onClick={() => {setShowAdmin(false); setPreview(null);}} className="flex-1 bg-gray-200 p-3 rounded-lg font-bold text-black hover:bg-gray-300">ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}