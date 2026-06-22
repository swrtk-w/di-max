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
    return wheels.filter((w) => {
      const matchesInches = activeFilterData.inches === "all" || String(w.inches) === activeFilterData.inches;
      const matchesHoles = activeFilterData.holes === "all" || String(w.holes) === activeFilterData.holes;
      const matchesPcd = activeFilterData.pcd === "all" || String(w.pcd) === activeFilterData.pcd;
      return matchesInches && matchesHoles && matchesPcd;
    });
  }, [wheels, activeFilterData, isFilterApplied]);

  const handleDelete = async (id: string, url: string) => {
    if (!confirm("ยืนยันการลบสินค้า?")) return;
    await supabase.from("wheels").delete().eq("id", id);
    setWheels(wheels.filter(w => w.id !== id));
  };

  const FilterControls = () => (
    <div className="flex flex-col gap-3 w-full">
      <select 
        value={filterData.inches} 
        className="w-full bg-[#131313] p-3 rounded-lg border border-[#414755] text-sm" 
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
        className="w-full bg-[#131313] p-3 rounded-lg border border-[#414755] text-sm" 
        onChange={(e) => setFilterData({...filterData, holes: e.target.value})}
      >
        <option value="all">ทุกรู</option>
        <option value="4">4 รู</option>
        <option value="5">5 รู</option>
        <option value="6">6 รู</option>
      </select>
      <select 
        value={filterData.pcd} 
        className="w-full bg-[#131313] p-3 rounded-lg border border-[#414755] text-sm" 
        onChange={(e) => setFilterData({...filterData, pcd: e.target.value})}
      >
        <option value="all">ทุกระยะ PCD</option>
        <option value="100">100</option>
        <option value="114.3">114.3</option>
        <option value="139.7">130</option>
        <option value="139.7">139.7</option>
      </select>
      <button 
        onClick={() => { setActiveFilterData(filterData); setIsFilterApplied(true); setShowMobileFilters(false); }}
        className="w-full bg-[#adc6ff] text-[#002e69] font-bold py-3 rounded-lg text-sm uppercase"
      >
        ใช้ตัวกรอง
      </button>
      {(userRole === 'admin' || userRole === 'owner') && (
        <button className="w-full border border-[#adc6ff] text-[#adc6ff] font-bold py-3 rounded-lg text-sm uppercase flex items-center justify-center gap-2">
          <Plus size={16} /> เพิ่มสินค้า
        </button>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#131313] text-[#e5e2e1]">
      <aside className="hidden md:flex w-64 border-r border-[#414755] p-6 flex-col gap-6 bg-[#1c1b1b]">
        <h2 className="font-bold uppercase text-[#adc6ff]">ตัวกรองข้อมูล</h2>
        <FilterControls />
      </aside>

      <main className="flex-1 p-3 md:p-8">
        <div className="md:hidden mb-4 flex justify-between items-center bg-[#1c1b1b] p-3 rounded-lg border border-[#414755]">
          <span className="font-bold text-sm">ระบบกรองข้อมูล</span>
          <button onClick={() => setShowMobileFilters(!showMobileFilters)} className="p-2 bg-[#131313] rounded-md border border-[#414755]">
            <SlidersHorizontal size={18} />
          </button>
        </div>
        {showMobileFilters && <div className="md:hidden mb-4 bg-[#1c1b1b] p-4 rounded-lg border border-[#414755]"><FilterControls /></div>}

        {!isFilterApplied ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-[#8b90a0]"><Filter size={48} className="mb-4 opacity-50"/><p className="text-sm">เลือกตัวกรองและกด "ใช้ตัวกรอง"</p></div>
        ) : loading ? (
          <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-[#adc6ff]" size={40} /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredWheels.map((w) => (
              <div key={w.id} className="group relative flex flex-col bg-[#1c1b1b] border border-[#414755] overflow-hidden rounded-xl transition-all hover:border-[#adc6ff]/50 w-[160px] sm:w-[220px]">
                {(userRole === 'admin' || userRole === 'owner') && (
                  <button onClick={() => handleDelete(w.id, w.image_url)} className="absolute top-2 right-2 bg-[#93000a] text-[#ffdad6] w-7 h-7 rounded flex items-center justify-center z-10 hover:bg-[#ffb4ab]">
                    <Trash2 size={14} />
                  </button>
                )}
<div className="w-full h-auto aspect-square max-w-[220px] max-h-[220px] mx-auto bg-[#201f1f] relative overflow-hidden flex items-center justify-center">
  <img 
    src={w.image_url} 
    alt={w.design} 
    className="object-contain w-full h-full group-hover:scale-110 transition-transform duration-700" 
  />
</div>
                <div className="p-2 sm:p-4 flex flex-col gap-2">
                  <h3 className="text-xs sm:text-base font-bold text-[#e5e2e1] truncate uppercase">{w.brand} - {w.design}</h3>
                  <div className="grid grid-cols-3 bg-[#131313] rounded-lg p-1 sm:p-2 text-center border border-[#414755]/50">
                    <div><p className="text-[8px] sm:text-[9px] text-[#8b90a0] uppercase">นิ้ว</p><p className="font-bold text-[#adc6ff] text-[10px] sm:text-sm">{w.inches}"</p></div>
                    <div><p className="text-[8px] sm:text-[9px] text-[#8b90a0] uppercase">รู</p><p className="font-bold text-[#adc6ff] text-[10px] sm:text-sm">{w.holes}</p></div>
                    <div><p className="text-[8px] sm:text-[9px] text-[#8b90a0] uppercase">PCD</p><p className="font-bold text-[#adc6ff] text-[10px] sm:text-sm">{w.pcd}</p></div>
                  </div>
                  
                  <div className="w-full bg-[#adc6ff]/10 border border-[#adc6ff]/20 text-[#adc6ff] py-1 sm:py-1.5 px-2 rounded flex justify-between items-center">
                    <span className="text-[8px] sm:text-[9px] font-bold uppercase">ราคาชุด</span>
                    <span className="font-bold text-xs sm:text-sm">{w.pck_price ? `฿${Number(w.pck_price).toLocaleString()}` : '-'}</span>
                  </div>
                  
                  {userRole === 'admin' && (
                    <div className="flex justify-between gap-1 sm:gap-2">
                      <div className="flex-1 bg-[#131313] py-1 px-1 sm:px-2 rounded border border-[#414755]">
                        <p className="text-[7px] sm:text-[8px] text-[#8b90a0] uppercase">ราคาวง</p>
                        <p className="font-bold text-[10px] sm:text-xs">{w.ea_price ? `฿${Number(w.ea_price).toLocaleString()}` : '-'}</p>
                      </div>
                      <div className="flex-1 bg-[#93000a]/10 py-1 px-1 sm:px-2 rounded border border-[#ffb4ab]/30">
                        <p className="text-[7px] sm:text-[8px] text-[#ffb4ab] uppercase">ลดเหลือ</p>
                        <p className="font-bold text-[10px] sm:text-xs text-[#ffb4ab]">{w.dsc_price ? `฿${Number(w.dsc_price).toLocaleString()}` : '-'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}