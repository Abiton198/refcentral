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
  ChevronUp, ChevronDown, Menu, X, Clock, 
  MapPin, Mail, Phone, ShieldCheck, Trash2 
} from "lucide-react";

interface Referee {
  id: string;
  name: string;
  surname?: string;
  email: string;
  contact?: string;
  area?: string;
  availabilityStatus?: "available" | "unavailable" | "unknown";
  approved?: boolean;
  status?: "active" | "pending" | "suspended";
  profileImage?: string;
  suspensionReason?: string;
  activityTrail?: any[];
  createdAt?: any;
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const currentExec = auth.currentUser?.email || "Unknown Executive";

  // 🔹 Real-time listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "referees"), (snapshot) => {
      const refs = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.firstName || data.name || "",
          surname: data.surname || data.lastName || "",
          email: data.email || "",
          contact: data.contact || data.mobileNumber || "",
          area: data.area || data.city || "",
          availabilityStatus: data.availabilityStatus || "unknown",
          approved: data.approved ?? false,
          status: data.status || (data.approved ? "active" : "pending"),
          profileImage: data.profileImage || "/default-avatar.png",
          suspensionReason: data.suspensionReason || "",
          activityTrail: data.activityTrail || [],
          createdAt: data.createdAt,
          lastActive: data.lastActive || null,
        } as Referee;
      });
      setReferees(refs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 🔹 Activity trail helper
  const addTrail = async (id: string, action: string, reason?: string | null) => {
    await updateDoc(doc(db, "referees", id), {
      activityTrail: arrayUnion({
        action,
        by: currentExec,
        timestamp: serverTimestamp(),
        reason: reason || null,
      }),
      lastEdited: serverTimestamp(),
    });
  };

  // 🔹 Actions
  const handleApprove = async (id: string) => {
    await updateDoc(doc(db, "referees", id), { approved: true, status: "active" });
    await updateDoc(doc(db, "users", id), { approved: true, role: "referee" });
    await addTrail(id, "Approved");
  };

  const handleSuspend = async (id: string) => {
    const reason = prompt("Enter suspension reason:");
    if (!reason) return;
    await updateDoc(doc(db, "referees", id), { status: "suspended", suspensionReason: reason });
    await updateDoc(doc(db, "users", id), { approved: false });
    await addTrail(id, "Suspended", reason);
  };

  const handleActivate = async (id: string) => {
    await updateDoc(doc(db, "referees", id), { status: "active", suspensionReason: "" });
    await updateDoc(doc(db, "users", id), { approved: true });
    await addTrail(id, "Reactivated");
  };

  const handleDeleteReferee = async (ref: Referee) => {
    if (!window.confirm(`Delete ${ref.name} ${ref.surname}? This is permanent.`)) return;
    setDeleting(ref.id);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "referees", ref.id));
      batch.delete(doc(db, "users", ref.id));
      
      const reportsSnap = await getDocs(query(collection(db, "reports"), where("refereeId", "==", ref.id)));
      reportsSnap.forEach((d) => batch.delete(d.ref));
      
      const apptSnap = await getDocs(query(collection(db, "appointments"), where("refereeId", "==", ref.id)));
      apptSnap.forEach((d) => batch.delete(d.ref));
      
      await batch.commit();
    } catch (err) {
      alert("Failed to delete referee.");
    } finally {
      setDeleting(null);
    }
  };

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
    if (!ts) return "—";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return formatDistanceToNow(date, { addSuffix: true });
  };

  if (loading) return <div className="text-center py-10 font-bold text-slate-500">Syncing Referees...</div>;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Referee Management</h2>
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search by name, email or area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border-2 border-slate-100 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {(["approved", "pending", "suspended"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all min-w-[100px] ${
              activeTab === tab ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab} ({counts[tab]})
          </button>
        ))}
      </div>

      {/* Sorting Controls (Desktop) */}
      <div className="hidden sm:flex justify-end gap-2 mb-4">
        <Button 
          variant="outline" size="sm" 
          className="text-[10px] font-bold"
          onClick={() => { setSortField("name"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
        >
          Sort Name {sortField === "name" && (sortOrder === "asc" ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}
        </Button>
        <Button 
          variant="outline" size="sm" 
          className="text-[10px] font-bold"
          onClick={() => { setSortField("lastActive"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
        >
          Sort Activity {sortField === "lastActive" && (sortOrder === "asc" ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)}
        </Button>
      </div>

      {/* MOBILE LIST VIEW */}
      <div className="block sm:hidden space-y-4">
        {filteredReferees.map((ref) => (
          <div key={ref.id} className="bg-white border-2 border-slate-100 rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${ref.availabilityStatus === 'available' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <div>
                  <h3 className="font-bold text-slate-900 uppercase">{ref.name} {ref.surname}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                    <MapPin size={10} /> {ref.area || "No Area"}
                  </p>
                </div>
              </div>
              <Badge variant={ref.status === 'active' ? 'success' : ref.status === 'suspended' ? 'danger' : 'warning'}>
                {ref.status}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
                <a href={`mailto:${ref.email}`} className="flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 p-2 rounded-lg">
                    <Mail size={12} /> Email
                </a>
                <a href={`tel:${ref.contact}`} className="flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 p-2 rounded-lg">
                    <Phone size={12} /> Call
                </a>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1 rounded-lg text-[10px] font-black" onClick={() => setSelectedRefereeId(ref.id)}>PROFILE</Button>
              {activeTab === 'pending' && (
                  <Button variant="success" size="sm" className="flex-1 rounded-lg text-[10px]" onClick={() => handleApprove(ref.id)}>APPROVE</Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden sm:block bg-white rounded-2xl border-2 border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b-2 border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Referee</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Active</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Region</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-50">
            {filteredReferees.map((ref) => (
              <tr key={ref.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                     <div className={`w-2 h-2 rounded-full ${ref.availabilityStatus === 'available' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                     <div>
                        <p className="font-bold text-slate-900 uppercase text-sm">{ref.name} {ref.surname}</p>
                        <p className="text-[10px] font-medium text-slate-400 italic">{ref.email}</p>
                     </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs font-medium text-slate-500">
                  {formatLastActive(ref.lastActive)}
                </td>
                <td className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">
                  {ref.area || "—"}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <Button size="sm" variant="ghost" className="text-[10px] font-black" onClick={() => setSelectedRefereeId(ref.id)}>VIEW</Button>
                  
                  {ref.status === 'active' && (
                    <Button size="sm" variant="danger" className="h-8 w-8 p-0 rounded-lg" onClick={() => handleSuspend(ref.id)}><X size={14}/></Button>
                  )}
                  
                  {ref.status === 'suspended' && (
                    <Button size="sm" className="h-8 w-8 p-0 rounded-lg bg-emerald-600 text-white" onClick={() => handleActivate(ref.id)}><ShieldCheck size={14}/></Button>
                  )}

                  {!ref.approved && (
                    <Button size="sm" variant="success" className="h-8 w-8 p-0 rounded-lg" onClick={() => handleApprove(ref.id)}><ShieldCheck size={14}/></Button>
                  )}

                  <Button 
                    size="sm" variant="outline" 
                    className="h-8 w-8 p-0 rounded-lg text-red-500 border-red-100 hover:bg-red-50" 
                    onClick={() => handleDeleteReferee(ref)}
                    disabled={deleting === ref.id}
                  >
                    <Trash2 size={14}/>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Profile View */}
      {selectedRefereeId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedRefereeId(null)}>
          <div className="bg-white rounded-[2rem] p-4 md:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedRefereeId(null)} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            <RefereeProfiles currentRefereeId={selectedRefereeId} />
          </div>
        </div>
      )}
    </div>
  );
};