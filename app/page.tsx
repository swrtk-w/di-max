"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Trash2, Filter, Loader2, Plus, SlidersHorizontal } from "lucide-react";

export default function CatalogPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [wheels, setWheels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [filterData, setFilterData] = useState({ inches: "all", holes: "all", pcd: "all" });
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [activeFilterData, setActiveFilterData] = useState(filterData);

  // States สำหรับระเบียบการเปิด-ปิดและฟอร์มของ Modal เพิ่มสินค้า
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    brand: "",
    design: "",
    inches: "15",
    holes: "4",
    pcd: "100",
    pck_price: "",
    ea_price: "",
    dsc_price: "",
    color: "",
    type: "",
  });

  useEffect(() => {
    const staff = sessionStorage.getItem("staff_session");
    if (staff) {
      const userData = JSON.parse(staff);
      setUserRole(userData.role);
    }
    const fetchWheels = async () => {
      const { data } = await supabase.from("wheels").select("*");
      if (data) setWheels(data);
      setLoading(false);
    };
    fetchWheels();
  }, []);

  const filteredWheels = useMemo(() => {
    if (!isFilterApplied) return [];
    return wheels
      .filter((w) => {
        const matchesInches = activeFilterData.inches === "all" || String(w.inches) === activeFilterData.inches;
        const matchesHoles = activeFilterData.holes === "all" || String(w.holes) === activeFilterData.holes;
        const matchesPcd = activeFilterData.pcd === "all" || String(w.pcd) === activeFilterData.pcd;
        return matchesInches && matchesHoles && matchesPcd;
      })
      .sort((a, b) => Number(a.inches) - Number(b.inches));
  }, [wheels, activeFilterData, isFilterApplied]);

  const handleDelete = async (id: string, url: string) => {
    if (!confirm("ยืนยันการลบสินค้า?")) return;
    await supabase.from("wheels").delete().eq("id", id);
    setWheels(wheels.filter(w => w.id !== id));
  };

  // จัดการการเปลี่ยนไฟล์ภาพและสร้าง URL พรีวิวข้อมูล
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // จัดการส่งฟอร์มเพื่อบันทึกข้อมูลและอัปโหลดรูปภาพ
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      alert("กรุณาเลือกรูปภาพสินค้า");
      return;
    }

    setSubmitting(true);

    try {
      // 1. ตั้งชื่อไฟล์ตามสเปกสินค้าที่เลือก: {brand}_{design}_{inches}x{holes}H{pcd}
      const cleanBrand = formData.brand.trim().replace(/\s+/g, "-");
      const cleanDesign = formData.design.trim().replace(/\s+/g, "-");
      const baseFileName = `${cleanBrand}_${cleanDesign}_${formData.inches}x${formData.holes}H${formData.pcd}`;
      
      let finalFileName = `${baseFileName}.webp`;
      let counter = 1;

      // ลูปตรวจสอบหาชื่อไฟล์ที่ซ้ำใน Supabase Storage Bucket 'wheel-images'
      while (true) {
        const { data } = await supabase.storage.from("wheel-images").list("", { search: finalFileName });
        const exists = data?.some((f) => f.name === finalFileName);
        if (!exists) break;
        
        finalFileName = `${baseFileName}-${counter}.webp`;
        counter++;
      }

      // 2. บีบอัดรูปภาพผ่าน HTML5 Canvas ให้เป็น WebP ขนาดกว้างยาวไม่เกิน 500px และขนาดไม่เกิน 100KB
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = async () => { // เปลี่ยนเป็น async เพื่อให้ใช้ await ภายในฟังก์ชันได้
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            // คำนวณ Aspect Ratio ล็อกด้านกว้างยาวสูงสุดไว้ไม่เกิน 500px
            if (width > height) {
              if (width > 500) {
                height = Math.round((height * 500) / width);
                width = 500;
              }
            } else {
              if (height > 500) {
                width = Math.round((width * 500) / height);
                height = 500;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);

            // ฟังก์ชัน Helper สำหรับแปลง Canvas เป็น Blob ในรูปแบบ Async/Await
            const getBlobFromCanvas = (quality: number): Promise<Blob | null> => {
              return new Promise((res) => canvas.toBlob(res, "image/webp", quality));
            };

            let currentQuality = 0.85; // เริ่มต้นที่คุณภาพ 85%
            let blob = await getBlobFromCanvas(currentQuality);

            // วนลูปเพื่อลดคุณภาพลงทีละ 5% (0.05) ตราบใดที่ขนาดไฟล์ยังเกิน 100KB และคุณภาพไม่ต่ำเกินไป (ขั้นต่ำ 0.1)
            const MAX_SIZE_BYTES = 100 * 1024; // 100KB
            while (blob && blob.size > MAX_SIZE_BYTES && currentQuality > 0.1) {
              currentQuality -= 0.05; 
              blob = await getBlobFromCanvas(currentQuality);
            }

            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("การบีบอัดรูปภาพล้มเหลว"));
            }
          };
        };
        reader.onerror = (err) => reject(err);
      });

      const processedFile = new File([compressedBlob], finalFileName, { type: "image/webp" });

      // 3. อัปโหลดไฟล์รูปภาพที่ผ่านการบีบอัดเรียบร้อยแล้วขึ้นไปที่ Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("wheel-images")
        .upload(finalFileName, processedFile);

      if (uploadError) throw uploadError;

      // 4. ดึงลิงก์ Public URL เพื่อเตรียมบันทึกลง Database
      const { data: { publicUrl } } = supabase.storage.from("wheel-images").getPublicUrl(finalFileName);

      // 5. ทำการ Insert ข้อมูลทั้งหมดเข้าสู่ตาราง 'wheels'
      const { data: insertData, error: insertError } = await supabase
        .from("wheels")
        .insert([
          {
            brand: formData.brand.trim(),
            design: formData.design.trim(),
            inches: Number(formData.inches),
            holes: Number(formData.holes),
            pcd: formData.pcd,
            pck_price: formData.pck_price ? Number(formData.pck_price) : null,
            ea_price: formData.ea_price ? Number(formData.ea_price) : null,
            dsc_price: formData.dsc_price ? Number(formData.dsc_price) : null,
            image_url: publicUrl,
            color: formData.color.trim() || null,
          },
        ])
        .select();

      if (insertError) throw insertError;

      // 6. อัปเดตข้อมูล State ของตารางหลัก และเคลียร์หน้า Modal
      if (insertData && insertData.length > 0) {
        setWheels((prev) => [...prev, insertData[0]]);
      }

      alert("เพิ่มข้อมูลสินค้าล้อแม็กซ์เสร็จสมบูรณ์!");
      setIsModalOpen(false);
      
      // รีเซ็ตค่าฟอร์มทั้งหมดกลับเป็นเริ่มต้น
      setFormData({
        brand: "",
        design: "",
        inches: "15",
        holes: "4",
        pcd: "100",
        pck_price: "",
        ea_price: "",
        dsc_price: "",
        color: "",
        type: "",
      });
      setImageFile(null);
      setImagePreview(null);
    } catch (error: any) {
      console.error(error);
      alert(`ไม่สามารถบันทึกสินค้าได้: ${error.message || error}`);
    } finally {
      setSubmitting(false);
    }
  };

  const FilterControls = () => (
    <div className="flex flex-col gap-3 w-full">
      <select 
        value={filterData.inches} 
        className="w-full bg-bg-main p-3 rounded-lg border border-border-default text-sm" 
        onChange={(e) => setFilterData({...filterData, inches: e.target.value})}
      >
        <option value="all">ทุกขนาด</option>
        <option value="15">15 นิ้ว</option>
        <option value="16">16 นิ้ว</option>
        <option value="17">17 นิ้ว</option>
        <option value="18">18 นิ้ว</option>
        <option value="20">20 นิ้ว</option>
      </select>
      <select 
        value={filterData.holes} 
        className="w-full bg-bg-main p-3 rounded-lg border border-border-default text-sm" 
        onChange={(e) => setFilterData({...filterData, holes: e.target.value})}
      >
        <option value="all">ทุกรู</option>
        <option value="4">4 รู</option>
        <option value="5">5 รู</option>
        <option value="6">6 รู</option>
      </select>
      <select 
        value={filterData.pcd} 
        className="w-full bg-bg-main p-3 rounded-lg border border-border-default text-sm" 
        onChange={(e) => setFilterData({...filterData, pcd: e.target.value})}
      >
        <option value="all">ทุกระยะ PCD</option>
        <option value="100">100</option>
        <option value="114.3">114.3</option>
        <option value="130">130</option>
        <option value="139.7">139.7</option>
      </select>
      <button 
        onClick={() => { setActiveFilterData(filterData); setIsFilterApplied(true); setShowMobileFilters(false); }}
        className="w-full bg-accent text-text-dark-btn font-bold py-3 rounded-lg text-sm uppercase cursor-pointer"
      >
        ใช้ตัวกรอง
      </button>
      {(userRole === 'admin') && (
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full border border-accent text-accent font-bold py-3 rounded-lg text-sm uppercase flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus size={16} /> เพิ่มสินค้า
        </button>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-bg-main text-text-primary">
      {/* แถบเมนูด้านข้างสำหรับกรองข้อมูลสินค้า (Desktop Sidebar Filter) */}
      <aside className="hidden md:flex w-64 border-r border-border-default p-6 flex-col gap-6 bg-bg-surface">
        <h2 className="font-bold uppercase text-accent">
          ตัวกรองข้อมูล
        </h2>
        <FilterControls />
      </aside>

      {/* ส่วนแสดงผลหลักของหน้ารายการสินค้า */}
      <main className="flex-1 p-3 md:p-8">
        {/* ปุ่มเปิด-ปิดระบบกรองข้อมูลบนอุปกรณ์พกพา (Mobile Filter Header) */}
        <div className="md:hidden mb-4 flex justify-between items-center bg-bg-surface p-3 rounded-lg border border-border-default">
          <span className="font-bold text-sm">ระบบกรองข้อมูล</span>
          <button onClick={() => setShowMobileFilters(!showMobileFilters)} className="p-2 bg-bg-main rounded-md border border-border-default cursor-pointer">
            <SlidersHorizontal size={18} />
          </button>
        </div>
        {showMobileFilters && <div className="md:hidden mb-4 bg-bg-surface p-4 rounded-lg border border-border-default"><FilterControls /></div>}

        {!isFilterApplied ? (
          /* หน้าจอแจ้งเตือนให้เลือกตัวกรองก่อนเริ่มค้นหาข้อมูล */
          <div className="flex flex-col items-center justify-center h-[50vh] text-text-muted">
            <Filter size={48} className="mb-4 opacity-50"/>
            <p className="text-sm">เลือกตัวกรองและกด "ใช้ตัวกรอง"</p>
          </div>
        ) : loading ? (
          /* หน้าจอแสดงสถานะกำลังโหลดข้อมูล (Loading State) */
          <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-accent" size={40} /></div>
        ) : (
          /* ส่วนตารางกริดแสดงรายการสินค้าล้อแม็กซ์ทั้งหมด (Product Catalog Grid) */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredWheels.map((w) => (
            /* การ์ดแสดงรายละเอียดของสินค้าแต่ละวง ดีไซน์ใหม่ (Product Card Item - Redesigned) */
            <div 
              key={w.id} 
              className="group relative flex flex-col bg-bg-surface border border-border-default overflow-hidden rounded-2xl transition-all duration-300 hover:border-border-accent-50 hover:shadow-xl w-full max-w-60 mx-auto"
            >
              {/* ปุ่มลบสินค้าสำหรับ Admin */}
              {(userRole === 'admin') && (
                <button 
                  onClick={() => handleDelete(w.id, w.image_url)} 
                  className="absolute top-2.5 right-2.5 bg-danger-main text-danger-text-light w-8 h-8 rounded-lg flex items-center justify-center z-10 hover:bg-danger-text transition-colors cursor-pointer shadow-md"
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* ส่วนแสดงรูปภาพสินค้า */}
              <div className="w-full aspect-square bg-bg-image relative overflow-hidden flex items-center justify-center p-3">
                <img 
                  src={w.image_url} 
                  alt={`${w.brand} - ${w.design}`} 
                  className="object-contain w-full h-full group-hover:scale-105 transition-transform duration-500" 
                />
              </div>

              {/* ส่วนข้อมูลรายละเอียดสินค้า */}
              <div className="p-3 sm:p-4 flex flex-col flex-1 gap-3">
                
                {/* แบรนด์สินค้า & Badge แสดงสี (Color Badge) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-black tracking-wider text-text-dark-btn uppercase bg-accent px-2 py-0.5 rounded-md shadow-sm">
                    {w.brand}
                  </span>
                  {w.color && (
                    <span className="inline-block bg-bg-accent-10 border border-border-accent-20 text-accent rounded-md px-2 py-0.5 text-[9px] sm:text-[10px] font-medium tracking-wide">
                      {w.color}
                    </span>
                  )}
                </div>

                {/* ชื่อลาย/รุ่นสินค้า */}
                <h3 className="text-sm sm:text-base font-bold text-text-primary leading-tight uppercase">
                  {w.design}
                </h3>
                
                {/* ตารางแสดงสเปกข้อมูลทางเทคนิค (นิ้ว, รู, PCD) */}
                <div className="grid grid-cols-3 bg-bg-main rounded-xl p-2 text-center border border-border-default/60 font-mono-spec">
                  <div className="border-r border-border-default/30">
                    <p className="text-[8px] sm:text-[9px] text-text-muted uppercase font-sans tracking-wide">ขนาด</p>
                    <p className="font-bold text-accent text-xs sm:text-sm mt-0.5">{w.inches}"</p>
                  </div>
                  <div className="border-r border-border-default/30">
                    <p className="text-[8px] sm:text-[9px] text-text-muted uppercase font-sans tracking-wide">รู</p>
                    <p className="font-bold text-accent text-xs sm:text-sm mt-0.5">{w.holes}H</p>
                  </div>
                  <div>
                    <p className="text-[8px] sm:text-[9px] text-text-muted uppercase font-sans tracking-wide">PCD</p>
                    <p className="font-bold text-accent text-xs sm:text-sm mt-0.5">{w.pcd}</p>
                  </div>
                </div>
                
                {/* ส่วนแสดงราคาสินค้าต่อชุด (ดันลงไปอยู่ล่างสุดเสมอเพื่อความเท่ากันของการ์ด) */}
                <div className="mt-auto w-full bg-bg-accent-10 border border-border-accent-20 text-accent py-2 px-3 rounded-xl flex justify-between items-center shadow-inner">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-text-muted">ราคาชุดละ</span>
                  <span className="font-black text-sm sm:text-base font-mono-spec">
                    {w.pck_price ? `฿${Number(w.pck_price).toLocaleString()}` : '-'}
                  </span>
                </div>
                
                {/* ราคาวงเบื้องหลังและส่วนลดพิเศษสำหรับ Admin เท่านั้น */}
                {userRole === 'admin' && (
                  <div className="grid grid-cols-2 gap-1.5 font-mono-spec pt-1.5 border-t border-border-default/30">
                    <div className="bg-bg-main py-1 px-2 rounded-lg border border-border-default flex flex-col justify-between">
                      <span className="text-[8px] sm:text-[9px] text-text-muted uppercase font-sans">วงละ</span>
                      <span className="font-bold text-[10px] sm:text-xs text-right text-text-primary mt-0.5">
                        {w.ea_price ? `฿${Number(w.ea_price).toLocaleString()}` : '-'}
                      </span>
                    </div>
                    <div className="bg-danger-bg-10 py-1 px-2 rounded-lg border border-danger-border-30 flex flex-col justify-between">
                      <span className="text-[8px] sm:text-[9px] text-danger-text uppercase font-sans">ลดได้</span>
                      <span className="font-bold text-[10px] sm:text-xs text-danger-text text-right mt-0.5">
                        {w.dsc_price ? `฿${Number(w.dsc_price).toLocaleString()}` : '-'}
                      </span>
                    </div>
                  </div>
                )}

              </div>
            </div>
          ))}
          </div>
        )}
      </main>

      {/* ==================== Modal สำหรับเพิ่มสินค้าใหม่ (Admin) ==================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-bg-surface border border-border-default rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-border-default pb-3">
              <h3 className="text-lg font-bold text-accent">เพิ่มข้อมูลสินค้าล้อแม็กซ์</h3>
              <button 
                onClick={() => { setIsModalOpen(false); setImageFile(null); setImagePreview(null); }}
                className="text-text-muted hover:text-text-primary text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* ส่วนจัดการรูปภาพสินค้า */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted uppercase">รูปภาพสินค้า</label>
                <div className="flex flex-col items-center justify-center border border-dashed border-border-default rounded-xl p-4 bg-bg-main min-h-35">
                  {imagePreview ? (
                    <div className="relative w-32 h-32 bg-bg-image rounded-lg overflow-hidden flex items-center justify-center">
                      <img src={imagePreview} alt="Preview" className="object-contain w-full h-full" />
                      <button 
                        type="button"
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        className="absolute top-1 right-1 bg-danger-main text-danger-text-light rounded px-1.5 py-0.5 text-xs cursor-pointer hover:bg-danger-text"
                      >
                        ลบออก
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer w-full py-6">
                      <Plus size={24} className="text-text-muted mb-2" />
                      <span className="text-xs text-text-muted">คลิกเพื่อเลือกภาพสินค้า</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        className="hidden" 
                        required 
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* ข้อมูลสเปกทั่วไป แบรนด์ และ ลาย */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase">ยี่ห้อ</label>
                  <input 
                    type="text" 
                    required
                    placeholder="เช่น Emotion-R"
                    value={formData.brand}
                    onChange={(e) => setFormData({...formData, brand: e.target.value})}
                    className="w-full bg-bg-main p-2.5 rounded-lg border border-border-default text-sm text-text-primary outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase">ลาย / รุ่น</label>
                  <input 
                    type="text" 
                    required
                    placeholder="เช่น TE37"
                    value={formData.design}
                    onChange={(e) => setFormData({...formData, design: e.target.value})}
                    className="w-full bg-bg-main p-2.5 rounded-lg border border-border-default text-sm text-text-primary outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase">สี</label>
                  <input 
                    type="text" 
                    placeholder="เช่น ดำเงา, ดำด้าน"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    className="w-full bg-bg-main p-2.5 rounded-lg border border-border-default text-sm text-text-primary outline-none focus:border-accent"
                  />
                </div>
                                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase">รถ</label>
                  <input 
                    type="text" 
                    placeholder="เช่น เก๋ง, ออฟโร้ด"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full bg-bg-main p-2.5 rounded-lg border border-border-default text-sm text-text-primary outline-none focus:border-accent"
                  />
                </div>
              </div>
              {/* ข้อมูลทางเทคนิคขนาด รู และ PCD */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase">ขนาด (นิ้ว)</label>
                  <select 
                    value={formData.inches} 
                    className="w-full bg-bg-main p-2.5 rounded-lg border border-border-default text-sm text-text-primary outline-none focus:border-accent" 
                    onChange={(e) => setFormData({...formData, inches: e.target.value})}
                  >
                    <option value="15">15 นิ้ว</option>
                    <option value="16">16 นิ้ว</option>
                    <option value="17">17 นิ้ว</option>
                    <option value="18">18 นิ้ว</option>
                    <option value="20">20 นิ้ว</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase">จำนวนรู</label>
                  <select 
                    value={formData.holes} 
                    className="w-full bg-bg-main p-2.5 rounded-lg border border-border-default text-sm text-text-primary outline-none focus:border-accent" 
                    onChange={(e) => setFormData({...formData, holes: e.target.value})}
                  >
                    <option value="4">4 รู</option>
                    <option value="5">5 รู</option>
                    <option value="6">6 รู</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase">ระยะ PCD</label>
                  <select 
                    value={formData.pcd} 
                    className="w-full bg-bg-main p-2.5 rounded-lg border border-border-default text-sm text-text-primary outline-none focus:border-accent" 
                    onChange={(e) => setFormData({...formData, pcd: e.target.value})}
                  >
                    <option value="100">100</option>
                    <option value="114.3">114.3</option>
                    <option value="130">130</option>
                    <option value="139.7">139.7</option>
                  </select>
                </div>
              </div>

              {/* ข้อมูลราคาจำหน่ายทัังหมดที่ Admin มองเห็น */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase">ราคาต่อชุด</label>
                  <input 
                    type="number" 
                    placeholder="บาท"
                    value={formData.pck_price}
                    onChange={(e) => setFormData({...formData, pck_price: e.target.value})}
                    className="w-full bg-bg-main p-2.5 rounded-lg border border-border-default text-sm text-text-primary outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase">ราคาต่อวง</label>
                  <input 
                    type="number" 
                    placeholder="บาท"
                    value={formData.ea_price}
                    onChange={(e) => setFormData({...formData, ea_price: e.target.value})}
                    className="w-full bg-bg-main p-2.5 rounded-lg border border-border-default text-sm text-text-primary outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-danger-text uppercase">ส่วนลดแอดมิน</label>
                  <input 
                    type="number" 
                    placeholder="บาท"
                    value={formData.dsc_price}
                    onChange={(e) => setFormData({...formData, dsc_price: e.target.value})}
                    className="w-full bg-bg-main p-2.5 rounded-lg border border-danger-border-30 text-sm text-text-primary outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* ปุ่มควบคุม ฟอร์ม */}
              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={() => { setIsModalOpen(false); setImageFile(null); setImagePreview(null); }} 
                  disabled={submitting}
                  className="flex-1 border border-border-default text-text-muted font-bold py-3 rounded-lg text-sm uppercase cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-accent text-text-dark-btn font-bold py-3 rounded-lg text-sm uppercase flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    "บันทึกสินค้า"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}