import React, { useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { db, auth } from "../../lib/firebase";
import {
  collection,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";

// ✅ Import your detailed referee profile viewer
import { RefereeProfiles } from "../executive/RefereeProfiles";

interface Referee {
  id: string;
  name: string;
  surname?: string;
  email: string;
  contact?: string;
  area?: string;
  yearJoined?: string;
  gender?: string;
  dateOfBirth?: string;
  licenseNumber?: string;
  experienceLevel?: string;
  boksmartNumber?: string;
  boksmartExpiry?: string;
  approved?: boolean;
  status?: "active" | "pending" | "suspended";
  suspensionReason?: string;
  lastEdited?: any;
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
  const [selectedReferee, setSelectedReferee] = useState<Referee | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "suspended">("pending");
  const currentExec = auth.currentUser?.email || "Unknown Executive";

  // 🔄 Real-time fetch referees
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "referees"), (snapshot) => {
      const refs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Referee[];
      setReferees(refs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ✅ Helper: append to trail
  const addTrail = async (refereeId: string, action: string, reason?: string | null) => {
    const refereeDoc = doc(db, "referees", refereeId);
    await updateDoc(refereeDoc, {
      activityTrail: arrayUnion({
        action,
        by: currentExec,
        timestamp: serverTimestamp(),
        reason: reason || null,
      }),
      lastEdited: serverTimestamp(),
    });
  };

  // ✅ Approve referee
  const handleApprove = async (id: string) => {
    try {
      const refereeDoc = doc(db, "referees", id);
      const userDoc = doc(db, "users", id);
      await updateDoc(refereeDoc, {
        approved: true,
        status: "active",
        lastEdited: serverTimestamp(),
      });
      await updateDoc(userDoc, {
        approved: true,
        role: "referee",
        lastEdited: serverTimestamp(),
      });
      await addTrail(id, "Approved");
      alert("✅ Referee approved successfully!");
    } catch (error) {
      console.error("Error approving referee:", error);
      alert("❌ Failed to approve referee.");
    }
  };

  // 🚫 Suspend referee
  const handleSuspend = async (id: string) => {
    const reason = prompt("Enter suspension reason:");
    if (!reason) return;
    try {
      const refereeDoc = doc(db, "referees", id);
      const userDoc = doc(db, "users", id);
      await updateDoc(refereeDoc, {
        status: "suspended",
        suspensionReason: reason,
        lastEdited: serverTimestamp(),
      });
      await updateDoc(userDoc, {
        approved: false,
        lastEdited: serverTimestamp(),
      });
      await addTrail(id, "Suspended", reason);
      alert(`⚠️ Referee suspended. Reason: ${reason}`);
    } catch (error) {
      console.error("Error suspending referee:", error);
      alert("❌ Failed to suspend referee.");
    }
  };

  // 🔄 Reactivate referee
  const handleActivate = async (id: string) => {
    try {
      const refereeDoc = doc(db, "referees", id);
      const userDoc = doc(db, "users", id);
      await updateDoc(refereeDoc, {
        status: "active",
        suspensionReason: "",
        lastEdited: serverTimestamp(),
      });
      await updateDoc(userDoc, {
        approved: true,
        lastEdited: serverTimestamp(),
      });
      await addTrail(id, "Reactivated");
      alert("✅ Referee reactivated successfully!");
    } catch (error) {
      console.error("Error activating referee:", error);
      alert("❌ Failed to activate referee.");
    }
  };

  // 🧭 Filter referees by status
  const filteredReferees = referees.filter((ref) => {
    if (activeTab === "pending") return !ref.approved;
    if (activeTab === "approved") return ref.approved && ref.status !== "suspended";
    if (activeTab === "suspended") return ref.status === "suspended";
    return true;
  });

  if (loading) {
    return <div className="text-center text-gray-500 py-8">Loading referees...</div>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-gray-900">🏉 Referee Management</h3>

      {/* 🧭 Tabs */}
      <div className="flex space-x-4 border-b pb-2">
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

      {/* 🎯 Conditional Tab Content */}
      {activeTab === "approved" ? (
        // 🧾 Load full referee profiles here
        <RefereeProfiles />
      ) : (
        <>
          {/* 🧍 Referee List for Pending / Suspended */}
          {filteredReferees.length === 0 ? (
            <p className="text-gray-600">No referees in this category.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReferees.map((ref) => (
                <Card
                  key={ref.id}
                  onClick={() => setSelectedReferee(ref)}
                  className="cursor-pointer transition hover:shadow-lg"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">
                        {ref.name} {ref.surname}
                      </h4>
                      <p className="text-sm text-gray-600">{ref.email}</p>
                      <p className="text-sm text-gray-500 mt-1">📞 {ref.contact || "N/A"}</p>
                      <p className="text-sm text-gray-500">📍 {ref.area || "N/A"}</p>
                      <div className="mt-2">
                        <Badge
                          variant={
                            ref.status === "active"
                              ? "success"
                              : ref.status === "suspended"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {ref.status ? ref.status.toUpperCase() : "PENDING"}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {!ref.approved && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(ref.id);
                          }}
                        >
                          Approve
                        </Button>
                      )}
                      {ref.status === "active" && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSuspend(ref.id);
                          }}
                        >
                          Suspend
                        </Button>
                      )}
                      {ref.status === "suspended" && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActivate(ref.id);
                          }}
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* 📋 Modal for full details (still available for pending/suspended) */}
      {selectedReferee && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40"
          onClick={() => setSelectedReferee(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-lg overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-2xl font-bold text-gray-800 mb-4">Referee Profile</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
              <p><strong>First Name:</strong> {selectedReferee.name}</p>
              <p><strong>Surname:</strong> {selectedReferee.surname || "N/A"}</p>
              <p><strong>Email:</strong> {selectedReferee.email}</p>
              <p><strong>Contact:</strong> {selectedReferee.contact || "N/A"}</p>
              <p><strong>Area:</strong> {selectedReferee.area || "N/A"}</p>
              <p><strong>Year Joined:</strong> {selectedReferee.yearJoined || "N/A"}</p>
              <p><strong>Gender:</strong> {selectedReferee.gender || "N/A"}</p>
              <p><strong>Date of Birth:</strong> {selectedReferee.dateOfBirth || "N/A"}</p>
              <p><strong>License Number:</strong> {selectedReferee.licenseNumber || "N/A"}</p>
              <p><strong>Experience Level:</strong> {selectedReferee.experienceLevel || "N/A"}</p>
              <p><strong>BokSmart Number:</strong> {selectedReferee.boksmartNumber || "N/A"}</p>
              <p><strong>BokSmart Expiry:</strong> {selectedReferee.boksmartExpiry || "N/A"}</p>
              <p><strong>Status:</strong> {selectedReferee.status?.toUpperCase()}</p>
              <p><strong>Approved:</strong> {selectedReferee.approved ? "✅ Yes" : "❌ No"}</p>
            </div>

            {/* 🕓 Activity Trail */}
            {selectedReferee.activityTrail && (
              <div className="mt-5 border-t pt-3">
                <h5 className="font-semibold text-gray-800 mb-2">Activity Trail</h5>
                <ul className="space-y-1 text-sm text-gray-600 max-h-40 overflow-y-auto">
                  {selectedReferee.activityTrail.map((log, idx) => (
                    <li key={idx} className="border-b pb-1">
                      <strong>{log.action}</strong> by {log.by} <br />
                      <span className="text-xs text-gray-500">
                        {log.timestamp?.toDate
                          ? log.timestamp.toDate().toLocaleString()
                          : "Pending..."}
                        {log.reason ? ` — ${log.reason}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setSelectedReferee(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
