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
  const [hasSearched, setHasSearched] = useState(false);
  
  const [filterData, setFilterData] = useState({
    inches: "",
    holes: "",
    pcd: ""
  });

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

  const filterWheels = async () => {
    setHasSearched(true);
    let query = supabase.from("wheels").select("*");
    
    if (filterData.inches) query = query.eq("inches", filterData.inches);
    if (filterData.holes) query = query.eq("holes", filterData.holes);
    if (filterData.pcd) query = query.eq("pcd", filterData.pcd);
    
    const { data } = await query;
    if (data) setWheels(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleUpload = async () => {
    if (!file || !formData.brand || !formData.design || !formData.inches) {
      return alert("กรุณากรอกข้อมูลสำคัญให้ครบถ้วน (รูปภาพ, ยี่ห้อ, รุ่น, และขนาดขอบ)");
    }

    setIsUploading(true);
    let uploadedFileName = "";

    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.1, maxWidthOrHeight: 800 });
      
      const safeBrand = formData.brand.trim().replace(/\s+/g, '_').replace(/[\/\\]/g, '-');
      const safeDesign = formData.design.trim().replace(/\s+/g, '_').replace(/[\/\\]/g, '-');
      
      const baseFileName = `${safeBrand}_${safeDesign}_${formData.inches}x${formData.holes}H${formData.pcd}`;
      let finalFileName = `${baseFileName}.webp`;

      const { data: existingFiles } = await supabase.storage
        .from("wheel-images")
        .list("", { search: baseFileName });

      if (existingFiles && existingFiles.length > 0) {
        let counter = 1;
        while (existingFiles.some(f => f.name === finalFileName)) {
          finalFileName = `${baseFileName}-${counter}.webp`;
          counter++;
        }
      }

      const { error: uploadError } = await supabase.storage.from("wheel-images").upload(finalFileName, compressed);
      if (uploadError) throw uploadError;
      
      uploadedFileName = finalFileName;

      const { data: urlData } = supabase.storage.from("wheel-images").getPublicUrl(finalFileName);
      
      const { error: insertError } = await supabase.from("wheels").insert({ 
        ...formData, 
        image_url: urlData.publicUrl 
      });

      if (insertError) {
        await supabase.storage.from("wheel-images").remove([uploadedFileName]);
        throw insertError;
      }

      alert("บันทึกข้อมูลสำเร็จ!");
      closeModal();
      
      if (hasSearched) filterWheels();
    } catch (error: any) {
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm("ยืนยันการลบสินค้านี้?")) return;
    const fileName = imageUrl.split('/').pop();
    if (fileName) {
      await supabase.storage.from("wheel-images").remove([fileName]);
    }
    await supabase.from("wheels").delete().eq("id", id);
    filterWheels();
  };

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

  if (!isLoggedIn) return (
    <div className="flex h-screen items-center justify-center p-6 bg-[#131313] text-[#e5e2e1] font-sans">
      <div className="w-full max-w-sm p-8 rounded-xl shadow-2xl border border-[#414755] bg-[#1c1b1b] text-center">
        <h2 className="text-2xl font-extrabold tracking-tighter mb-6 text-[#adc6ff] uppercase">SYSTEM LOGIN</h2>
        <p className="text-xs text-[#8b90a0] tracking-widest uppercase mb-6">Enter Administrative PIN</p>
        <input 
          type="password" maxLength={6} value={pin}
          className="w-full border-b border-[#414755] bg-[#131313] p-4 mb-4 text-center text-3xl tracking-[0.5em] focus:outline-none focus:border-[#adc6ff] text-[#e5e2e1] rounded-t-md transition-colors" 
          placeholder="------" 
          onChange={(e) => handlePinChange(e.target.value)} 
        />
        {errorMsg && <p className="text-sm font-bold text-[#ffb4ab] mt-2 bg-[#93000a]/20 py-2 rounded">{errorMsg}</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1] font-sans selection:bg-[#adc6ff] selection:text-[#002e69]">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;700;800&family=Hanken+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .font-sora { font-family: 'Sora', sans-serif; }
        .font-hanken { font-family: 'Hanken Grotesk', sans-serif; }
        .font-mono-spec { font-family: 'JetBrains Mono', monospace; }
        .spec-grid-item { border-right: 1px solid rgba(139, 144, 160, 0.2); }
        .spec-grid-item:last-child { border-right: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #131313; }
        ::-webkit-scrollbar-thumb { background: #414755; border-radius: 10px; }
      `}} />

      <nav className="w-full top-0 sticky z-40 bg-[#131313] border-b border-[#414755] h-20 flex items-center">
        <div className="flex justify-between items-center px-6 md:px-16 w-full max-w-[1440px] mx-auto">
          <div className="font-sora text-2xl md:text-3xl font-extrabold tracking-tighter text-[#e5e2e1] uppercase">
            WHEELS CATALOG
          </div>
          <button onClick={() => setIsLoggedIn(false)} className="flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] border border-[#414755] hover:bg-[#353534] hover:text-[#ffb4ab] transition-all rounded-lg group text-[#c1c6d7]">
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="text-[12px] font-bold tracking-[0.1em] hidden sm:inline uppercase">Logout</span>
          </button>
        </div>
      </nav>

      <div className="flex flex-col lg:flex-row max-w-[1440px] mx-auto min-h-[calc(100vh-80px)] relative">
        
        {/* Sidebar / Filter System */}
        <aside className="w-full lg:w-72 flex flex-col gap-4 p-6 lg:p-8 lg:sticky lg:top-20 bg-[#1c1b1b] border-r border-[#414755] shrink-0 h-auto lg:h-[calc(100vh-80px)] z-10">
          <div className="mb-4">
            <h2 className="font-sora text-[20px] font-bold text-[#adc6ff] mb-1">FILTER SYSTEM</h2>
            <p className="font-hanken text-[12px] font-bold tracking-[0.1em] text-[#c1c6d7] opacity-70 uppercase">Technical Specifications</p>
          </div>
          
          <div className="flex flex-col gap-5 overflow-y-auto pr-2 pb-4">
            <div className="border-b border-[#414755]/30 pb-4">
              <label className="block text-[12px] font-bold tracking-[0.1em] text-[#e5e2e1] mb-3 uppercase">Size (Inches)</label>
              <select name="inches" value={filterData.inches} onChange={handleFilterChange} className="w-full bg-[#131313] border border-[#414755] text-[#adc6ff] text-sm p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] font-hanken">
                <option value="">ALL SIZES</option>
                <option value="15">15"</option><option value="16">16"</option><option value="17">17"</option><option value="18">18"</option><option value="20">20"</option>
              </select>
            </div>

            <div className="border-b border-[#414755]/30 pb-4">
              <label className="block text-[12px] font-bold tracking-[0.1em] text-[#e5e2e1] mb-3 uppercase">Holes</label>
              <select name="holes" value={filterData.holes} onChange={handleFilterChange} className="w-full bg-[#131313] border border-[#414755] text-[#adc6ff] text-sm p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] font-hanken">
                <option value="">ALL HOLES</option>
                <option value="4">4H</option><option value="5">5H</option><option value="6">6H</option>
              </select>
            </div>

            <div className="border-b border-[#414755]/30 pb-4">
              <label className="block text-[12px] font-bold tracking-[0.1em] text-[#e5e2e1] mb-3 uppercase">PCD Distance</label>
              <select name="pcd" value={filterData.pcd} onChange={handleFilterChange} className="w-full bg-[#131313] border border-[#414755] text-[#adc6ff] text-sm p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] font-hanken">
                <option value="">ALL PCD</option>
                <option value="100">100</option><option value="114.3">114.3</option><option value="130">130</option><option value="139.7">139.7</option>
              </select>
            </div>
          </div>

          <div className="mt-auto pt-4">
            <button onClick={filterWheels} className="w-full py-4 bg-[#adc6ff] text-[#002e69] text-[12px] font-bold tracking-[0.1em] rounded-lg hover:brightness-110 active:scale-[0.98] transition-all uppercase shadow-lg shadow-[#adc6ff]/20">
              Apply Filters
            </button>
          </div>
        </aside>

        {/* Main Content Canvas */}
        <main className="flex-1 p-6 md:p-8 bg-[#131313] overflow-x-hidden relative">
          <header className="mb-10">
            <h1 className="font-sora text-4xl md:text-[48px] font-extrabold text-[#e5e2e1] mb-3 tracking-tight">WHEELS COLLECTION</h1>
            <p className="text-[#c1c6d7] max-w-2xl font-hanken text-base leading-relaxed">
              Precision engineered monoblock and multi-piece wheels for the ultimate performance pursuit. Explore our inventory.
            </p>
          </header>

          <div className="flex flex-wrap justify-center sm:justify-start gap-6">
            {wheels.map((w) => (
              <div key={w.id} className="group relative flex flex-col bg-[#1c1b1b] border border-[#414755] overflow-hidden rounded-lg transition-all duration-300 hover:border-[#adc6ff]/50 w-[220px] shrink-0">
                {userRole === 'admin' && (
                  <button onClick={() => handleDelete(w.id, w.image_url)} className="absolute top-2 right-2 bg-[#93000a] text-[#ffdad6] w-7 h-7 rounded flex items-center justify-center z-10 hover:bg-[#ffb4ab] hover:text-[#690005] transition-colors border border-[#ffb4ab]/30 shadow-lg">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
                
                <div className="w-[220px] h-[220px] relative overflow-hidden bg-[#353534]">
                  <img src={w.image_url} alt={w.design} className="object-cover w-full h-full transform group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1c1b1b] via-transparent to-transparent opacity-80"></div>
                </div>
                
                <div className="p-4 flex flex-col gap-3">
                  <div>
                    <h3 className="font-sora text-[18px] font-bold text-[#e5e2e1] mb-1 uppercase truncate">{w.brand} - {w.design}</h3>
                    <p className="font-hanken text-[10px] font-bold tracking-[0.1em] text-[#c1c6d7] uppercase truncate">{w.color || "Standard Finish"} {w.type && `| ${w.type}`}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 bg-[#353534]/50 rounded-lg py-2 px-1 text-center border border-[#414755]/50">
                    <div className="spec-grid-item">
                      <p className="text-[9px] font-bold tracking-[0.1em] text-[#8b90a0] mb-1 uppercase">Size</p>
                      <p className="font-mono-spec text-[12px] text-[#adc6ff]">{w.inches}"</p>
                    </div>
                    <div className="spec-grid-item">
                      <p className="text-[9px] font-bold tracking-[0.1em] text-[#8b90a0] mb-1 uppercase">Holes</p>
                      <p className="font-mono-spec text-[12px] text-[#adc6ff]">{w.holes}</p>
                    </div>
                    <div className="spec-grid-item">
                      <p className="text-[9px] font-bold tracking-[0.1em] text-[#8b90a0] mb-1 uppercase">PCD</p>
                      <p className="font-mono-spec text-[12px] text-[#adc6ff]">{w.pcd}</p>
                    </div>
                  </div>
                  
                  {/* กล่องแสดงราคาทั้ง 3 ส่วน */}
                  <div className="flex flex-col gap-1 mt-1">
                    {/* ราคาชุด (Pack) */}
                    <div className="w-full bg-[#353534] border border-[#414755] text-[#e5e2e1] py-1.5 px-3 rounded flex justify-between items-center group-hover:bg-[#2a2a2a] transition-colors">
                      <span className="font-hanken text-[9px] font-bold tracking-[0.1em] uppercase text-[#8b90a0]">PACK</span>
                      <span className="font-mono-spec text-[13px] text-[#adc6ff] font-bold">{w.pck_price ? `฿${Number(w.pck_price).toLocaleString()}` : '-'}</span>
                    </div>
                    
                    {/* ราคาวง (Each) */}
                    <div className="w-full bg-[#353534]/40 border border-[#414755]/50 text-[#e5e2e1] py-1.5 px-3 rounded flex justify-between items-center group-hover:bg-[#2a2a2a]/50 transition-colors">
                      <span className="font-hanken text-[9px] font-bold tracking-[0.1em] uppercase text-[#8b90a0]">EACH</span>
                      <span className="font-mono-spec text-[12px] text-[#c1c6d7]">{w.ea_price ? `฿${Number(w.ea_price).toLocaleString()}` : '-'}</span>
                    </div>

                    {/* ราคาลด (Discount) */}
                    <div className="w-full bg-[#353534]/20 border border-[#ffb4ab]/20 text-[#e5e2e1] py-1.5 px-3 rounded flex justify-between items-center">
                      <span className="font-hanken text-[9px] font-bold tracking-[0.1em] uppercase text-[#ffb4ab]/80">DISC</span>
                      <span className="font-mono-spec text-[12px] text-[#ffb4ab]">{w.dsc_price ? `฿${Number(w.dsc_price).toLocaleString()}` : '-'}</span>
                    </div>
                  </div>
                  
                </div>
              </div>
            ))}
          </div>

          {wheels.length === 0 && (
            <div className="w-full py-20 px-4 border border-dashed border-[#414755] rounded-xl bg-[#1c1b1b]/50 text-center flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-[48px] text-[#414755] mb-4">
                {hasSearched ? "search_off" : "tune"}
              </span>
              <p className="text-[#c1c6d7] font-hanken text-lg">
                {hasSearched ? "No matching wheels found in inventory." : "Select specifications and apply filters to view collection."}
              </p>
            </div>
          )}
        </main>
      </div>

      {userRole === 'admin' && (
        <div className="fixed bottom-6 right-6 z-30">
          <button 
            onClick={() => setShowAdmin(true)} 
            className="w-16 h-16 bg-[#adc6ff] text-[#002e69] rounded-full flex items-center justify-center shadow-2xl hover:brightness-110 hover:scale-105 transition-all duration-300 shadow-[#adc6ff]/20"
          >
            <span className="material-symbols-outlined text-[32px]">add</span>
          </button>
        </div>
      )}

      {showAdmin && (
        <div className="fixed inset-0 bg-[#0e0e0e]/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#1c1b1b] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-[#414755]">
            
            <div className="sticky top-0 bg-[#1c1b1b] px-6 py-5 border-b border-[#414755] flex justify-between items-center z-10">
              <div>
                <h2 className="font-sora text-xl font-bold text-[#e5e2e1] uppercase">Add New Inventory</h2>
                <p className="font-hanken text-[12px] font-bold tracking-[0.1em] text-[#8b90a0] uppercase mt-1">Wheel Database Entry</p>
              </div>
              <button onClick={closeModal} className="text-[#8b90a0] hover:text-[#ffb4ab] transition-colors">
                <span className="material-symbols-outlined text-[28px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              
              <div className="flex flex-col items-center justify-center border border-dashed border-[#414755] rounded-xl p-4 bg-[#131313] relative transition-colors hover:border-[#adc6ff]/50">
                {preview ? (
                  <div className="relative w-48 h-48 group">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-lg border border-[#414755]" />
                    <button onClick={() => { setPreview(null); setFile(null); }} className="absolute -top-3 -right-3 bg-[#93000a] text-[#ffdad6] rounded-full w-8 h-8 flex items-center justify-center shadow-lg border border-[#ffb4ab]/30 hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer text-[#8b90a0] hover:text-[#adc6ff] transition-colors py-8">
                    <span className="material-symbols-outlined text-[48px] mb-3">add_photo_alternate</span>
                    <span className="font-hanken text-[12px] font-bold tracking-[0.1em] uppercase">Click to upload image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[12px] font-bold tracking-[0.1em] text-[#c1c6d7] mb-2 uppercase">Brand <span className="text-[#ffb4ab]">*</span></label>
                  <input type="text" name="brand" value={formData.brand} onChange={handleInputChange} className="w-full bg-[#131313] border border-[#414755] p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] text-[#e5e2e1] font-hanken" placeholder="e.g. TE37" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold tracking-[0.1em] text-[#c1c6d7] mb-2 uppercase">Design <span className="text-[#ffb4ab]">*</span></label>
                  <input type="text" name="design" value={formData.design} onChange={handleInputChange} className="w-full bg-[#131313] border border-[#414755] p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] text-[#e5e2e1] font-hanken" placeholder="e.g. SL" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className="block text-[12px] font-bold tracking-[0.1em] text-[#c1c6d7] mb-2 uppercase">Size <span className="text-[#ffb4ab]">*</span></label>
                  <select name="inches" value={formData.inches} onChange={handleInputChange} className="w-full bg-[#131313] border border-[#414755] p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] text-[#adc6ff] font-hanken">
                    <option value="">Select</option><option value="15">15"</option><option value="16">16"</option><option value="17">17"</option><option value="18">18"</option><option value="20">20"</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-bold tracking-[0.1em] text-[#c1c6d7] mb-2 uppercase">Holes</label>
                  <select name="holes" value={formData.holes} onChange={handleInputChange} className="w-full bg-[#131313] border border-[#414755] p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] text-[#adc6ff] font-hanken">
                    <option value="4">4H</option><option value="5">5H</option><option value="6">6H</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-bold tracking-[0.1em] text-[#c1c6d7] mb-2 uppercase">PCD</label>
                  <select name="pcd" value={formData.pcd} onChange={handleInputChange} className="w-full bg-[#131313] border border-[#414755] p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] text-[#adc6ff] font-hanken">
                    <option value="100">100</option><option value="114.3">114.3</option><option value="130">130</option><option value="139.7">139.7</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[12px] font-bold tracking-[0.1em] text-[#c1c6d7] mb-2 uppercase">Finish / Color</label>
                  <input type="text" name="color" value={formData.color} onChange={handleInputChange} className="w-full bg-[#131313] border border-[#414755] p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] text-[#e5e2e1] font-hanken" placeholder="e.g. Matte Black" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold tracking-[0.1em] text-[#c1c6d7] mb-2 uppercase">Type / Style</label>
                  <input type="text" name="type" value={formData.type} onChange={handleInputChange} className="w-full bg-[#131313] border border-[#414755] p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] text-[#e5e2e1] font-hanken" placeholder="e.g. Monoblock" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5 border-t border-[#414755]/50 pt-5 mt-2">
                <div>
                  <label className="block text-[12px] font-bold tracking-[0.1em] text-[#c1c6d7] mb-2 uppercase">Price (EA)</label>
                  <input type="number" name="ea_price" value={formData.ea_price} onChange={handleInputChange} className="w-full bg-[#131313] border border-[#414755] p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] text-[#e5e2e1] font-mono-spec" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold tracking-[0.1em] text-[#c1c6d7] mb-2 uppercase">Price (Pack)</label>
                  <input type="number" name="pck_price" value={formData.pck_price} onChange={handleInputChange} className="w-full bg-[#131313] border border-[#adc6ff]/30 p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] text-[#adc6ff] font-mono-spec" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold tracking-[0.1em] text-[#c1c6d7] mb-2 uppercase">Discount</label>
                  <input type="number" name="dsc_price" value={formData.dsc_price} onChange={handleInputChange} className="w-full bg-[#131313] border border-[#414755] p-3 rounded-lg focus:outline-none focus:border-[#adc6ff] text-[#ffb59e] font-mono-spec" placeholder="0" />
                </div>
              </div>

            </div>

            <div className="sticky bottom-0 bg-[#1c1b1b] px-6 py-5 border-t border-[#414755] flex justify-end space-x-4 rounded-b-xl">
              <button 
                onClick={closeModal} 
                className="px-6 py-3 font-hanken text-[12px] font-bold tracking-[0.1em] uppercase text-[#c1c6d7] bg-transparent border border-[#414755] rounded-lg hover:bg-[#353534] transition-colors"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button 
                onClick={handleUpload} 
                className={`px-6 py-3 font-hanken text-[12px] font-bold tracking-[0.1em] uppercase text-[#002e69] rounded-lg transition-all flex items-center shadow-lg ${isUploading ? 'bg-[#c1c6d7] cursor-not-allowed' : 'bg-[#adc6ff] hover:brightness-110 active:scale-95'}`}
                disabled={isUploading}
              >
                {isUploading ? 'Syncing...' : 'Save Record'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}