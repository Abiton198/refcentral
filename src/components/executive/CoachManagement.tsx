import React, { useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

interface Coach {
  id: string;
  name: string;
  surname?: string;
  email: string;
  contact?: string;
  club?: string;
  clubRole?: string;
  approved?: boolean;
  status?: "active" | "pending" | "suspended";
  suspensionReason?: string;
}

export const CoachManagement: React.FC = () => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ✅ Real-time Firestore listener for coaches
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "coaches"), (snapshot) => {
      const coachesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Coach[];
      setCoaches(coachesData);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ✅ Approve coach
  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, "coaches", id), {
        approved: true,
        status: "active",
      });
      await updateDoc(doc(db, "users", id), { approved: true });
      alert("✅ Coach approved successfully!");
    } catch (err) {
      console.error("Error approving coach:", err);
      alert("❌ Failed to approve coach.");
    }
  };

  // ✅ Suspend coach
  const handleSuspend = async (id: string) => {
    const reason = prompt("Enter suspension reason:");
    if (!reason) return;
    try {
      await updateDoc(doc(db, "coaches", id), {
        status: "suspended",
        suspensionReason: reason,
      });
      await updateDoc(doc(db, "users", id), { approved: false });
      alert(`⚠️ Coach suspended. Reason: ${reason}`);
    } catch (err) {
      console.error("Error suspending coach:", err);
      alert("❌ Failed to suspend coach.");
    }
  };

  // ✅ Reactivate coach
  const handleActivate = async (id: string) => {
    try {
      await updateDoc(doc(db, "coaches", id), {
        status: "active",
        suspensionReason: "",
      });
      await updateDoc(doc(db, "users", id), { approved: true });
      alert("✅ Coach reactivated successfully!");
    } catch (err) {
      console.error("Error activating coach:", err);
      alert("❌ Failed to activate coach.");
    }
  };

  // 🚨 Delete coach and all related data
  const handleDeleteCoach = async (coach: Coach) => {
    if (
      !window.confirm(
        `⚠️ Are you sure you want to permanently delete ${coach.name} ${coach.surname || ""}? 
This will remove their user account, reports, appointments, and all linked data.`
      )
    )
      return;

    setDeleting(coach.id);
    try {
      const batch = writeBatch(db);

      // 1️⃣ Delete coach record
      batch.delete(doc(db, "coaches", coach.id));

      // 2️⃣ Delete user record (if exists)
      batch.delete(doc(db, "users", coach.id));

      // 3️⃣ Delete all reports linked to this coach
      const reportsSnap = await getDocs(
        query(collection(db, "reports"), where("coachId", "==", coach.id))
      );
      reportsSnap.forEach((d) => batch.delete(d.ref));

      // 4️⃣ Delete all appointments linked to this coach
      const apptSnap = await getDocs(
        query(collection(db, "appointments"), where("coachId", "==", coach.id))
      );
      apptSnap.forEach((d) => batch.delete(d.ref));

      // 5️⃣ Commit all deletions
      await batch.commit();

      alert(`🗑️ Coach ${coach.name} ${coach.surname || ""} and related data deleted successfully.`);
    } catch (err) {
      console.error("Error deleting coach:", err);
      alert("❌ Failed to delete coach and related data.");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-gray-500 py-8">Loading coaches...</div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-gray-900">Coach Management</h3>

      {coaches.length === 0 ? (
        <p className="text-gray-600">No coaches found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coaches.map((coach) => (
            <Card key={coach.id}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-bold text-gray-900">
                    {coach.name} {coach.surname}
                  </h4>
                  <p className="text-sm text-gray-600">{coach.email}</p>
                  {coach.club && (
                    <p className="text-sm text-gray-500">🏉 {coach.club}</p>
                  )}
                  {coach.clubRole && (
                    <p className="text-sm text-gray-500">
                      Role: {coach.clubRole}
                    </p>
                  )}
                  {coach.contact && (
                    <p className="text-sm text-gray-500 mt-1">
                      📞 {coach.contact}
                    </p>
                  )}

                  <div className="mt-2">
                    <Badge
                      variant={
                        coach.status === "active"
                          ? "success"
                          : coach.status === "suspended"
                          ? "danger"
                          : "warning"
                      }
                    >
                      {coach.status ? coach.status.toUpperCase() : "PENDING"}
                    </Badge>
                  </div>

                  {coach.suspensionReason && (
                    <p className="text-xs text-red-600 mt-1 italic">
                      Reason: {coach.suspensionReason}
                    </p>
                  )}
                </div>

                <div className="space-y-2 text-right">
                  {!coach.approved && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => handleApprove(coach.id)}
                    >
                      Approve
                    </Button>
                  )}
                  {coach.status === "active" && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleSuspend(coach.id)}
                    >
                      Suspend
                    </Button>
                  )}
                  {coach.status === "suspended" && (
                    <Button size="sm" onClick={() => handleActivate(coach.id)}>
                      Activate
                    </Button>
                  )}

                  {/* 🗑️ Delete Coach Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteCoach(coach)}
                    disabled={deleting === coach.id}
                  >
                    {deleting === coach.id ? "Deleting..." : "🗑️ Delete"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
