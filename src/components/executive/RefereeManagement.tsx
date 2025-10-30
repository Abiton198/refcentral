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
  deleteDoc,
} from "firebase/firestore";


interface Referee {
  id: string;
  name: string;
  surname?: string;
  email: string;
  contact?: string;
  area?: string;
  school?: string;
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
}

export const RefereeManagement: React.FC = () => {
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRefereeId, setSelectedRefereeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "suspended">("approved");
  const [searchTerm, setSearchTerm] = useState("");
  const currentExec = auth.currentUser?.email || "Unknown Executive";
  const [deleting, setDeleting] = useState<string | null>(null);


  // 🔄 Real-time Firestore sync
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
          school: data.school || "",
          availabilityStatus: data.availabilityStatus || "unknown",
          approved: data.approved ?? false,
          status: data.status || (data.approved ? "active" : "pending"),
          profileImage: data.profileImage || data.photoURL || "/default-avatar.png",
          suspensionReason: data.suspensionReason || "",
          activityTrail: data.activityTrail || [],
        } as Referee;
      });
      setReferees(refs);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 🧾 Helper: log admin actions
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
    alert("✅ Approved");
  };

  const handleSuspend = async (id: string) => {
    const reason = prompt("Enter suspension reason:");
    if (!reason) return;
    await updateDoc(doc(db, "referees", id), { status: "suspended", suspensionReason: reason });
    await updateDoc(doc(db, "users", id), { approved: false });
    await addTrail(id, "Suspended", reason);
    alert("🚫 Suspended");
  };

  const handleActivate = async (id: string) => {
    await updateDoc(doc(db, "referees", id), { status: "active", suspensionReason: "" });
    await updateDoc(doc(db, "users", id), { approved: true });
    await addTrail(id, "Reactivated");
    alert("✅ Reactivated");
  };

// 🚨 Delete referee and all related data
const handleDeleteReferee = async (ref: Referee) => {
  if (
    !window.confirm(
      `⚠️ Are you sure you want to permanently delete ${ref.name} ${
        ref.surname || ""
      }?\n\nThis will remove their user account, match reports, appointments, and all linked data.`
    )
  )
    return;

  setDeleting(ref.id);
  try {
    const batch = writeBatch(db);

    // 1️⃣ Delete referee profile
    batch.delete(doc(db, "referees", ref.id));

    // 2️⃣ Delete user record
    batch.delete(doc(db, "users", ref.id));

    // 3️⃣ Delete reports by this referee
    const reportsSnap = await getDocs(
      query(collection(db, "reports"), where("refereeId", "==", ref.id))
    );
    reportsSnap.forEach((d) => batch.delete(d.ref));

    // 4️⃣ Delete appointments linked to this referee
    const apptSnap = await getDocs(
      query(collection(db, "appointments"), where("refereeId", "==", ref.id))
    );
    apptSnap.forEach((d) => batch.delete(d.ref));

    // ✅ Commit all deletions
    await batch.commit();

    alert(`🗑️ Referee ${ref.name} ${ref.surname || ""} and related data deleted successfully.`);
  } catch (error) {
    console.error("Error deleting referee:", error);
    alert("❌ Failed to delete referee and related data.");
  } finally {
    setDeleting(null);
  }
};


  // 🔍 Filtering & search
  const filteredReferees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return referees
      .filter((r) => {
        if (activeTab === "pending") return !r.approved;
        if (activeTab === "approved") return r.approved && r.status !== "suspended";
        if (activeTab === "suspended") return r.status === "suspended";
        return true;
      })
      .filter(
        (r) =>
          r.name?.toLowerCase().includes(term) ||
          r.surname?.toLowerCase().includes(term) ||
          r.email?.toLowerCase().includes(term) ||
          r.area?.toLowerCase().includes(term) ||
          r.school?.toLowerCase().includes(term)
      );
  }, [referees, activeTab, searchTerm]);

  if (loading) return <div className="text-center text-gray-500 py-10">Loading referees…</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">🏉 Referee Management</h2>
        <input
          type="text"
          placeholder="Search referees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded-lg px-4 py-2 w-80 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        />
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b pb-2 mb-4">
        {["pending", "approved", "suspended"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 rounded-t-lg font-medium ${
              activeTab === tab
                ? "bg-emerald-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab === "pending"
              ? "⏳ Pending"
              : tab === "approved"
              ? "✅ Approved"
              : "🚫 Suspended"}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredReferees.map((ref) => {
          const availabilityColor =
            ref.availabilityStatus === "available"
              ? "bg-green-500"
              : ref.availabilityStatus === "unavailable"
              ? "bg-red-500"
              : "bg-gray-400";

          return (
            <Card key={ref.id} className="p-4 shadow-sm hover:shadow-md transition">
              <div className="flex justify-between">
                <div className="flex gap-3">
                  <img
                    src={ref.profileImage || "/default-avatar.png"}
                    alt={ref.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {ref.name} {ref.surname}
                      </h4>
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${availabilityColor}`}
                        title={ref.availabilityStatus || "unknown"}
                      ></span>
                    </div>
                    <p className="text-sm text-gray-600">{ref.email}</p>
                    <p className="text-sm text-gray-500">{ref.school || "No school"}</p>
                    <p className="text-sm text-gray-500">📍 {ref.area || "Unknown"}</p>
                    <Badge
                      variant={
                        ref.status === "active"
                          ? "success"
                          : ref.status === "suspended"
                          ? "danger"
                          : "warning"
                      }
                      className="mt-2"
                    >
                      {ref.status?.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  {!ref.approved && (
                    <Button size="sm" variant="success" onClick={() => handleApprove(ref.id)}>
                      Approve
                    </Button>
                  )}
                  {ref.status === "active" && (
                    <Button size="sm" variant="danger" onClick={() => handleSuspend(ref.id)}>
                      Suspend
                    </Button>
                  )}
                  {ref.status === "suspended" && (
                    <Button size="sm" onClick={() => handleActivate(ref.id)}>
                      Activate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedRefereeId(ref.id)}
                  >
                    View Profile
                  </Button>
                </div>
              </div>
    
    {/* button handles deleting */}
        <Button
        size="sm"
        variant="outline"
        onClick={() => handleDeleteReferee(ref)}
        disabled={deleting === ref.id}
      >
        {deleting === ref.id ? "Deleting..." : "🗑️ Delete"}
      </Button>


            </Card>
          );
        })}
      </div>



      {/* Profile modal */}
      {selectedRefereeId && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40"
          onClick={() => setSelectedRefereeId(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-4xl w-full shadow-lg overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <RefereeProfiles currentRefereeId={selectedRefereeId} />
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setSelectedRefereeId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
