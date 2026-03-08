import React, { useEffect, useState, useMemo } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { db, auth } from "../../lib/firebase";
import { RefereeProfiles } from "../executive/RefereeProfiles";
import {
  collection,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { formatDistanceToNow, format } from "date-fns";
import { 
  ChevronUp, ChevronDown, X, Clock, 
  MapPin, Mail, Phone, ShieldCheck, Trash2, RefreshCw, Search, Trophy 
} from "lucide-react";
import { toast } from "../../hooks/use-toast";

interface Referee {
  id: string;
  name: string;
  surname?: string;
  email: string;
  contact?: string;
  area?: string;
  availabilityStatus?: string;
  approved?: boolean;
  status?: "active" | "pending" | "suspended";
  experienceLevel?: string;
  lastActive?: any;

}

export const RefereeManagement: React.FC = () => {
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRefereeId, setSelectedRefereeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "suspended">("approved");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [sortField, setSortField] = useState<"name" | "lastActive">("name");
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const currentExec = auth.currentUser?.email || "Unknown Executive";

  // 🔹 Real-time listener with proper data mapping
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "referees"), (snapshot) => {
      const refs = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          // Support both firstName and name fields from your DB
          name: data.firstName || data.name || "Unknown",
          surname: data.surname || data.lastName || "",
          email: data.email || "",
          contact: data.mobileNumber || data.contact || "",
          area: data.city || data.area || "—",
          availabilityStatus: data.availabilityStatus || "Unavailable",
          approved: data.approved ?? false,
          status: data.status || (data.approved ? "active" : "pending"),
          experienceLevel: data.experienceLevel || "Beginner",
          lastActive: data.updatedAt || null,
        } as Referee;
      });
      setReferees(refs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 🔹 Action: Toggle Availability
  const handleToggleAvailability = async (refId: string, currentStatus?: string) => {
    const isCurrentlyAvailable = currentStatus?.toLowerCase() === 'available';
    const newStatus = isCurrentlyAvailable ? 'Unavailable' : 'Available';
    
    try {
      await updateDoc(doc(db, "referees", refId), {
        availabilityStatus: newStatus,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Status Updated", description: `Marked as ${newStatus}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    }
  };

  // 🔹 Action: Approval
  const handleApprove = async (id: string) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "referees", id), { 
        approved: true, 
        status: "active",
        activityTrail: arrayUnion({ action: "Approved", by: currentExec, timestamp: new Date() }) 
      });
      batch.update(doc(db, "users", id), { approved: true, role: "referee" });
      await batch.commit();
      toast({ title: "Referee Approved", description: "Access granted." });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Could not approve referee." });
    }
  };

  // 🔹 Action: Suspension
  const handleSuspend = async (id: string) => {
    const reason = prompt("Enter suspension reason:");
    if (!reason) return;
    try {
      await updateDoc(doc(db, "referees", id), { 
        status: "suspended", 
        suspensionReason: reason,
        activityTrail: arrayUnion({ action: "Suspended", by: currentExec, timestamp: new Date(), reason })
      });
      toast({ title: "Referee Suspended" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to suspend." });
    }
  };

  // 🔹 Filtering Logic
  const filteredReferees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return referees
      .filter((r) => {
        if (activeTab === "pending") return !r.approved;
        if (activeTab === "approved") return r.approved && r.status !== "suspended";
        if (activeTab === "suspended") return r.status === "suspended";
        return true;
      })
      .filter((r) => `${r.name} ${r.surname} ${r.email} ${r.area}`.toLowerCase().includes(term))
      .sort((a, b) => {
        if (sortField === "name") {
          const nameA = `${a.name} ${a.surname}`.toLowerCase();
          const nameB = `${b.name} ${b.surname}`.toLowerCase();
          return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        }
        const aTime = a.lastActive?.toMillis?.() || 0;
        const bTime = b.lastActive?.toMillis?.() || 0;
        return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
      });
  }, [referees, activeTab, searchTerm, sortOrder, sortField]);

  const counts = useMemo(() => ({
    pending: referees.filter(r => !r.approved).length,
    approved: referees.filter(r => r.approved && r.status !== 'suspended').length,
    suspended: referees.filter(r => r.status === 'suspended').length
  }), [referees]);

 const formatLastActive = (ts: any) => {
  // 1. Guard against null or undefined
  if (!ts) return "No recent activity";

  try {
    let date: Date;

    // 2. Handle Firestore Timestamp object { seconds, nanoseconds }
    if (typeof ts.toDate === "function") {
      date = ts.toDate();
    } 
    // 3. Handle cases where it's already a JS Date or an ISO String
    else if (ts instanceof Date) {
      date = ts;
    } 
    else if (typeof ts === "string" || typeof ts === "number") {
      date = new Date(ts);
    }
    // 4. Handle the "Server Timestamp" pending state (local cache)
    else {
      return "Updating...";
    }

    // Check if the date is valid before formatting
    if (isNaN(date.getTime())) return "Invalid Date";

    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Error";
  }
};

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-black text-slate-400 uppercase text-xs tracking-widest">Syncing Officials...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Trophy className="text-emerald-500" /> REFEREE MANAGEMENT
          </h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest italic">Executive Oversight Panel</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Filter by name, region or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-3 text-sm font-bold shadow-inner outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-slate-200/50 p-1.5 rounded-2xl mb-8 overflow-x-auto">
        {(["approved", "pending", "suspended"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all min-w-[120px] ${
              activeTab === tab ? "bg-white text-emerald-600 shadow-md" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab} <span className="ml-2 bg-slate-100 px-2 py-0.5 rounded-md">{counts[tab]}</span>
          </button>
        ))}
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Referee Official</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Region / Level</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredReferees.map((ref) => {
              const isAvailable = ref.availabilityStatus?.toLowerCase() === 'available';
              
              return (
                <tr key={ref.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="relative flex h-3 w-3">
                        {isAvailable && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${isAvailable ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-400'}`}></span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900 uppercase text-sm">{ref.name} {ref.surname}</p>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-md border ${isAvailable ? 'text-emerald-600 border-emerald-100 bg-emerald-50' : 'text-slate-400 border-slate-100 bg-slate-50'}`}>
                            {ref.availabilityStatus}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 italic mt-0.5">{ref.email}</p>
                      </div>
                    </div>
                  </td>
                 <td className="px-8 py-6">
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      {/* Icon changes color if they've been active in the last 24 hours */}
      <Clock 
        size={14} 
        className={`${
          ref.lastActive && (new Date().getTime() - (ref.lastActive.toMillis?.() || 0) < 86400000)
            ? "text-emerald-500" 
            : "text-slate-300"
        }`} 
      />
      <span className="text-slate-700 font-black text-[11px] uppercase tracking-tight">
        {formatLastActive(ref.lastActive)}
      </span>
    </div>
    
    {/* Secondary small timestamp for precise verification */}
    {ref.lastActive && (
      <p className="text-[9px] text-slate-400 font-bold ml-5">
        {ref.lastActive.toDate 
          ? format(ref.lastActive.toDate(), "dd MMM, HH:mm") 
          : "—"}
      </p>
    )}
  </div>
</td>
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-600 uppercase flex items-center gap-1">
                        <MapPin size={10} className="text-emerald-500" /> {ref.area}
                      </p>
                      <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md uppercase">
                        {ref.experienceLevel}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right space-x-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-[10px] font-black h-9 rounded-xl hover:bg-slate-100" 
                      onClick={() => setSelectedRefereeId(ref.id)}
                    >
                      VIEW PROFILE
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-9 w-9 p-0 rounded-xl border-slate-200 hover:border-emerald-500 hover:text-emerald-600 transition-all"
                      onClick={() => handleToggleAvailability(ref.id, ref.availabilityStatus)}
                    >
                      <RefreshCw size={14} />
                    </Button>

                    {activeTab === 'pending' && (
                      <Button 
                        size="sm" 
                        variant="success" 
                        className="h-9 w-9 p-0 rounded-xl" 
                        onClick={() => handleApprove(ref.id)}
                      >
                        <ShieldCheck size={16} />
                      </Button>
                    )}

                    {activeTab === 'approved' && (
                      <Button 
                        size="sm" 
                        variant="danger" 
                        className="h-9 w-9 p-0 rounded-xl bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-500 hover:text-white"
                        onClick={() => handleSuspend(ref.id)}
                      >
                        <X size={16} />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredReferees.length === 0 && (
          <div className="p-20 text-center">
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No officials found in this category.</p>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {selectedRefereeId && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setSelectedRefereeId(null)}>
          <div className="bg-white rounded-[3rem] p-4 md:p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedRefereeId(null)} className="absolute top-8 right-8 p-3 hover:bg-slate-100 rounded-full transition-all text-slate-400">
              <X size={24}/>
            </button>
            <RefereeProfiles currentRefereeId={selectedRefereeId} />
          </div>
        </div>
      )}
    </div>
  );
};