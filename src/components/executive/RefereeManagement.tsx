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

interface Referee {
  id: string;
  name: string;
  surname?: string;
  email: string;
  contact?: string;
  area?: string;
  yearJoined?: string;
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
  const addTrail = async (
    refereeId: string,
    action: string,
    reason?: string | null
  ) => {
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

  if (loading) {
    return (
      <div className="text-center text-gray-500 py-8">Loading referees...</div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-gray-900">🏉 Referee Management</h3>

      {referees.length === 0 ? (
        <p className="text-gray-600">No referees found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {referees.map((ref) => (
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
                  {ref.contact && (
                    <p className="text-sm text-gray-500 mt-1">📞 {ref.contact}</p>
                  )}
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

                  {ref.suspensionReason && (
                    <p className="text-xs text-red-600 mt-1 italic">
                      Reason: {ref.suspensionReason}
                    </p>
                  )}

                  {ref.lastEdited && (
                    <p className="text-xs text-gray-500 mt-2">
                      🕒 Last edited:{" "}
                      {ref.lastEdited.toDate
                        ? ref.lastEdited.toDate().toLocaleString()
                        : "N/A"}
                    </p>
                  )}
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

      {/* 📋 Modal for detail view */}
      {selectedReferee && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40"
          onClick={() => setSelectedReferee(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-lg w-full shadow-lg relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-xl font-bold text-gray-800 mb-2">
              Referee Details
            </h4>
            <p className="text-sm text-gray-600">
              <strong>Name:</strong> {selectedReferee.name}{" "}
              {selectedReferee.surname}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Email:</strong> {selectedReferee.email}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Contact:</strong> {selectedReferee.contact || "N/A"}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Area:</strong> {selectedReferee.area || "N/A"}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Year Joined:</strong>{" "}
              {selectedReferee.yearJoined || "N/A"}
            </p>

            {/* 🕓 Activity Trail */}
            {selectedReferee.activityTrail && (
              <div className="mt-4 border-t pt-3">
                <h5 className="font-semibold text-gray-800 mb-1">
                  Activity Trail
                </h5>
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
