import React, { useEffect, useState, useMemo } from "react";
import { Card } from "../ui/Card";
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
import { format } from "date-fns";
import { ChevronUp, ChevronDown, Menu, X } from "lucide-react";

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
  activityTrail?: {
    action: string;
    by: string;
    timestamp: any;
    reason?: string;
  }[];
  createdAt?: any;
}

export const RefereeManagement: React.FC = () => {
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRefereeId, setSelectedRefereeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "suspended">("approved");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentExec = auth.currentUser?.email || "Unknown Executive";
  const [deleting, setDeleting] = useState<string | null>(null);

  // Real-time sync
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "referees"), (snapshot) => {
      const refs = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || data.firstName || "",
          surname: data.surname || data.lastName || "",
          email: data.email || "",
          contact: data.contact || data.mobileNumber || "",
          area: data.area || data.city || "",
          availabilityStatus: data.availabilityStatus || "unknown",
          approved: data.approved ?? false,
          status: data.status || (data.approved ? "active" : "pending"),
          profileImage: data.profileImage || data.photoURL || "/default-avatar.png",
          suspensionReason: data.suspensionReason || "",
          activityTrail: data.activityTrail || [],
          createdAt: data.createdAt,
        } as Referee;
      });
      setReferees(refs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Handlers
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

  const handleApprove = async (id: string) => {
    await updateDoc(doc(db, "referees", id), { approved: true, status: "active" });
    await updateDoc(doc(db, "users", id), { approved: true, role: "referee" });
    await addTrail(id, "Approved");
    alert("Approved");
  };

  const handleSuspend = async (id: string) => {
    const reason = prompt("Enter suspension reason:");
    if (!reason) return;
    await updateDoc(doc(db, "referees", id), { status: "suspended", suspensionReason: reason });
    await updateDoc(doc(db, "users", id), { approved: false });
    await addTrail(id, "Suspended", reason);
    alert("Suspended");
  };

  const handleActivate = async (id: string) => {
    await updateDoc(doc(db, "referees", id), { status: "active", suspensionReason: "" });
    await updateDoc(doc(db, "users", id), { approved: true });
    await addTrail(id, "Reactivated");
    alert("Reactivated");
  };

  const handleDeleteReferee = async (ref: Referee) => {
    if (!window.confirm(`Delete ${ref.name} ${ref.surname || ""}? This is permanent.`)) return;
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
      alert("Deleted");
    } catch (error) {
      alert("Failed");
    } finally {
      setDeleting(null);
    }
  };

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedRows(newSet);
  };

  // Filters & counts
  const filteredReferees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return referees
      .filter((r) => {
        if (activeTab === "pending") return !r.approved;
        if (activeTab === "approved") return r.approved && r.status !== "suspended";
        if (activeTab === "suspended") return r.status === "suspended";
        return true;
      })
      .filter((r) =>
        `${r.name} ${r.surname || ""} ${r.email} ${r.area || ""}`.toLowerCase().includes(term)
      )
      .sort((a, b) => {
        const nameA = `${a.name} ${a.surname || ""}`.trim();
        const nameB = `${b.name} ${b.surname || ""}`.trim();
        return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
  }, [referees, activeTab, searchTerm, sortOrder]);

  const counts = useMemo(() => ({
    pending: referees.filter((r) => !r.approved).length,
    approved: referees.filter((r) => r.approved && r.status !== "suspended").length,
    suspended: referees.filter((r) => r.status === "suspended").length,
  }), [referees]);

  const formatDate = (ts: any) => ts ? format(ts.toDate(), "dd MMM yyyy") : "—";

  if (loading) return <div className="text-center py-10 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Referee Management</h2>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 sm:flex-initial border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 rounded-lg bg-gray-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Desktop Tabs */}
      <div className="hidden sm:flex space-x-2 border juventus-b pb-2 mb-6 overflow-x-auto">
        {(["pending", "approved", "suspended"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg font-medium flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab
                ? "bg-emerald-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab === "pending" ? "Pending" : tab === "approved" ? "Approved" : "Suspended"}
            <span className={`text-sm font-bold ${activeTab === tab ? "text-white" : "text-emerald-600"}`}>
              ({counts[tab]})
            </span>
          </button>
        ))}
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden mb-4 bg-white rounded-lg shadow-md p-3 space-y-2">
          {(["pending", "approved", "suspended"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg flex justify-between items-center ${
                activeTab === tab ? "bg-emerald-600 text-white" : "bg-gray-50 text-gray-700"
              }`}
            >
              <span>
                {tab === "pending" ? "Pending" : tab === "approved" ? "Approved" : "Suspended"}
              </span>
              <span className="text-sm font-bold">{counts[tab]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Sort Toggle (Desktop Only) */}
      <div className="hidden sm:flex justify-end mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          className="flex items-center gap-1 text-xs"
        >
          Name {sortOrder === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </div>

      {/* Mobile Cards / Desktop Table */}
      <div className="space-y-3 sm:space-y-0">
        {filteredReferees.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No referees found.</p>
        ) : (
          <>
            {/* Mobile: Stacked Cards */}
            <div className="sm:hidden space-y-3">
              {filteredReferees.map((ref, idx) => {
                const isExpanded = expandedRows.has(ref.id);
                const dotColor =
                  ref.availabilityStatus === "available"
                    ? "bg-green-500"
                    : ref.availabilityStatus === "unavailable"
                    ? "bg-red-500"
                    : "bg-gray-400";

                return (
                  <Card key={ref.id} className="p-4 shadow-sm">
                    <div className="flex justify-between items-start" onClick={() => toggleRow(ref.id)}>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-500">#{idx + 1}</span>
                        <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                        <div>
                          <p className="font-medium text-gray-900">{ref.name} {ref.surname}</p>
                          <p className="text-xs text-gray-500">{formatDate(ref.createdAt)}</p>
                        </div>
                      </div>
                      <Badge variant={ref.status === "active" ? "success" : ref.status === "suspended" ? "danger" : "warning"}>
                        {ref.status?.toUpperCase()}
                      </Badge>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        <p className="text-sm"><strong>Email:</strong> {ref.email}</p>
                        <p className="text-sm"><strong>Area:</strong> {ref.area || "—"}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {!ref.approved && (
                            <Button size="sm" variant="success" onClick={() => handleApprove(ref.id)}>Approve</Button>
                          )}
                          {ref.status === "active" && (
                            <Button size="sm" variant="danger" onClick={() => handleSuspend(ref.id)}>Suspend</Button>
                          )}
                          {ref.status === "suspended" && (
                            <Button size="sm" onClick={() => handleActivate(ref.id)}>Activate</Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setSelectedRefereeId(ref.id)}>
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600"
                            onClick={() => handleDeleteReferee(ref)}
                            disabled={deleting === ref.id}
                          >
                            {deleting === ref.id ? "..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Desktop: Table */}
            <div className="hidden sm:block bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Referee</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Registered</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredReferees.map((ref, idx) => {
                    const isExpanded = expandedRows.has(ref.id);
                    const dotColor =
                      ref.availabilityStatus === "available"
                        ? "bg-green-500"
                        : ref.availabilityStatus === "unavailable"
                        ? "bg-red-500"
                        : "bg-gray-400";

                    return (
                      <React.Fragment key={ref.id}>
                        <tr
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleRow(ref.id)}
                        >
                          <td className="px-4 py-3 text-sm font-medium">#{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                              <span className="font-medium">{ref.name} {ref.surname}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(ref.createdAt)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={ref.status === "active" ? "success" : ref.status === "suspended" ? "danger" : "warning"}>
                              {ref.status?.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedRefereeId(ref.id); }}>
                              View
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="p-0">
                              <div className="bg-emerald-50 border-t p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-6 text-sm">
                                  <div>
                                    <p className="font-medium text-gray-700">Contact</p>
                                    <p>{ref.email}</p>
                                    <p>{ref.contact || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-700">Location</p>
                                    <p>{ref.area || "—"}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {!ref.approved && <Button size="sm" variant="success" onClick={() => handleApprove(ref.id)}>Approve</Button>}
                                  {ref.status === "active" && <Button size="sm" variant="danger" onClick={() => handleSuspend(ref.id)}>Suspend</Button>}
                                  {ref.status === "suspended" && <Button size="sm" onClick={() => handleActivate(ref.id)}>Activate</Button>}
                                  <Button size="sm" variant="outline" onClick={() => setSelectedRefereeId(ref.id)}>Full Profile</Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-600"
                                    onClick={() => handleDeleteReferee(ref)}
                                    disabled={deleting === ref.id}
                                  >
                                    {deleting === ref.id ? "..." : "Delete"}
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Profile Modal */}
      {selectedRefereeId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRefereeId(null)}>
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <RefereeProfiles currentRefereeId={selectedRefereeId} />
            <div className="flex justify-end mt-6">
              <Button variant="outline" onClick={() => setSelectedRefereeId(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};