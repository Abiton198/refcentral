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
import { motion, AnimatePresence } from "framer-motion";

interface Coach {
  id: string;
  firstName?: string;
  surname?: string;
  preferredName?: string;
  gender?: string;
  nationality?: string;
  dob?: string;
  idNumber?: string;
  languages?: string;
  mobileNumber?: string;
  altContact?: string;
  email: string;
  residentialAddress?: string;
  city?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branchCode?: string;
  accountType?: string;
  approved?: boolean;
  status?: "active" | "pending" | "suspended";
  suspensionReason?: string;
  createdAt?: any;
}

export const CoachManagement: React.FC = () => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Real-time listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "coaches"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Coach[];
      setCoaches(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Stats
  const pending = coaches.filter((c) => !c.approved && c.status !== "suspended").length;
  const approved = coaches.filter((c) => c.approved && c.status === "active").length;
  const suspended = coaches.filter((c) => c.status === "suspended").length;

  // Approve
  const handleApprove = async (id: string) => {
    if (!window.confirm("Approve this coach? They will gain full access.")) return;
    try {
      await updateDoc(doc(db, "coaches", id), { approved: true, status: "active" });
      await updateDoc(doc(db, "users", id), { approved: true });
      setSelectedCoach(null);
    } catch (err) {
      alert("Failed to approve.");
    }
  };

  // Reject
  const handleReject = async (id: string) => {
    const reason = prompt("Reason for rejection (optional):");
    if (!window.confirm("Reject this coach?")) return;
    try {
      await updateDoc(doc(db, "coaches", id), {
        approved: false,
        status: "pending",
        rejectionReason: reason || "No reason provided",
      });
      await updateDoc(doc(db, "users", id), { approved: false });
      setSelectedCoach(null);
    } catch (err) {
      alert("Failed to reject.");
    }
  };

  // Suspend
  const handleSuspend = async (id: string) => {
    const reason = prompt("Enter suspension reason:");
    if (!reason || !window.confirm("Suspend this coach?")) return;
    try {
      await updateDoc(doc(db, "coaches", id), { status: "suspended", suspensionReason: reason });
      await updateDoc(doc(db, "users", id), { approved: false });
    } catch (err) {
      alert("Failed to suspend.");
    }
  };

  // Reactivate
  const handleActivate = async (id: string) => {
    if (!window.confirm("Reactivate this coach?")) return;
    try {
      await updateDoc(doc(db, "coaches", id), { status: "active", suspensionReason: "" });
      await updateDoc(doc(db, "users", id), { approved: true });
    } catch (err) {
      alert("Failed to activate.");
    }
  };

  // Full Delete
  const handleDeleteCoach = async (coach: Coach) => {
    if (
      !window.confirm(
        `Permanently delete ${coach.firstName} ${coach.surname}? This removes ALL data.`
      )
    )
      return;

    setDeleting(coach.id);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "coaches", coach.id));
      batch.delete(doc(db, "users", coach.id));

      const reportsSnap = await getDocs(
        query(collection(db, "reports"), where("coachId", "==", coach.id))
      );
      reportsSnap.forEach((d) => batch.delete(d.ref));

      const apptSnap = await getDocs(
        query(collection(db, "appointments"), where("coachId", "==", coach.id))
      );
      apptSnap.forEach((d) => batch.delete(d.ref));

      await batch.commit();
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading coaches...</div>;
  }

  return (
    <div className="space-y-6">
      {/* STATS */}
      <div className="flex flex-wrap gap-4 justify-center md:justify-start">
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-3">
          <p className="text-sm font-medium text-amber-800">Pending</p>
          <p className="text-2xl font-bold text-amber-900">({pending})</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-3">
          <p className="text-sm font-medium text-emerald-800">Approved</p>
          <p className="text-2xl font-bold text-emerald-900">({approved})</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-3">
          <p className="text-sm font-medium text-red-800">Suspended</p>
          <p className="text-2xl font-bold text-red-900">({suspended})</p>
        </div>
      </div>

      <h3 className="text-2xl font-bold text-gray-900">Coach Management</h3>

      {coaches.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No coaches registered yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coaches.map((coach) => (
            <Card key={coach.id} className="p-4 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-gray-900">
                    {coach.preferredName || coach.firstName} {coach.surname}
                  </h4>
                  <p className="text-sm text-gray-600">{coach.email}</p>
                  {coach.mobileNumber && (
                    <p className="text-xs text-gray-500">Phone: {coach.mobileNumber}</p>
                  )}
                </div>
                <Badge
                  variant={
                    coach.status === "active"
                      ? "success"
                      : coach.status === "suspended"
                      ? "danger"
                      : "warning"
                  }
                >
                  {coach.status?.toUpperCase() || "PENDING"}
                </Badge>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedCoach(coach)}
                >
                  View Details
                </Button>

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
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                  onClick={() => handleDeleteCoach(coach)}
                  disabled={deleting === coach.id}
                >
                  {deleting === coach.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL: View Coach Details */}
      <AnimatePresence>
        {selectedCoach && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedCoach(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Coach Profile
              </h3>

              <div className="space-y-4 text-sm">
                {/* Personal */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium text-gray-700">Full Name</p>
                    <p>{selectedCoach.firstName} {selectedCoach.surname}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Preferred Name</p>
                    <p>{selectedCoach.preferredName || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Gender</p>
                    <p>{selectedCoach.gender || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Nationality</p>
                    <p>{selectedCoach.nationality || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Date of Birth</p>
                    <p>{selectedCoach.dob || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">ID Number</p>
                    <p>{selectedCoach.idNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Languages</p>
                    <p>{selectedCoach.languages || "-"}</p>
                  </div>
                </div>

                <hr />

                {/* Contact */}
                <div>
                  <p className="font-medium text-gray-700 mb-2">Contact</p>
                  <p>Email: {selectedCoach.email}</p>
                  <p>Mobile: {selectedCoach.mobileNumber || "-"}</p>
                  <p>Alt: {selectedCoach.altContact || "-"}</p>
                  <p>Address: {selectedCoach.residentialAddress || "-"}, {selectedCoach.city || "-"}</p>
                </div>

                <hr />

                {/* Bank */}
                <div>
                  <p className="font-medium text-gray-700 mb-2">Bank Details</p>
                  <p>Bank: {selectedCoach.bankName || "-"}</p>
                  <p>Holder: {selectedCoach.accountHolder || "-"}</p>
                  <p>Account: {selectedCoach.accountNumber || "-"}</p>
                  <p>Branch: {selectedCoach.branchCode || "-"}</p>
                  <p>Type: {selectedCoach.accountType || "-"}</p>
                </div>

                {selectedCoach.suspensionReason && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="font-medium text-red-800">Suspension Reason</p>
                    <p className="text-red-700">{selectedCoach.suspensionReason}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                {!selectedCoach.approved && selectedCoach.status !== "suspended" && (
                  <>
                    <Button
                      variant="success"
                      onClick={() => handleApprove(selectedCoach.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleReject(selectedCoach.id)}
                    >
                      Reject
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setSelectedCoach(null)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};