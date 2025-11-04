import React, { useEffect, useState, useMemo } from "react";
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
  limit,
  orderBy,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trophy,
  Calendar,
  TrendingUp,
  Clock,
  FileText,
} from "lucide-react";

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
  auditTrail?: { action: string; by: string; at: any }[];
}

interface Appointment {
  id: string;
  coachId?: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  status?: "pending" | "accepted" | "rejected";
}

export const CoachManagement: React.FC = () => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Real-time: Coaches + Appointments
  useEffect(() => {
    const unsubCoaches = onSnapshot(collection(db, "coaches"), (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Coach[];
      setCoaches(data);
    });

    const unsubAppts = onSnapshot(collection(db, "appointments"), (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Appointment[];
      setAppointments(data);
      setLoading(false);
    });

    return () => {
      unsubCoaches();
      unsubAppts();
    };
  }, []);

  // === STATS ===
  const stats = useMemo(() => {
    const total = coaches.length;
    const pending = coaches.filter((c) => !c.approved && c.status !== "suspended").length;
    const approved = coaches.filter((c) => c.approved && c.status === "active").length;
    const suspended = coaches.filter((c) => c.status === "suspended").length;

    // Appointed coaches
    const appointedCoachIds = new Set(
      appointments
        .filter((a) => a.coachId && a.status !== "rejected")
        .map((a) => a.coachId)
    );
    const appointedCount = appointedCoachIds.size;

    // Games per coach
    const gamesByCoach = appointments.reduce((acc, appt) => {
      if (appt.coachId && appt.status !== "rejected") {
        acc[appt.coachId] = (acc[appt.coachId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topCoach = Object.entries(gamesByCoach)
      .sort((a, b) => b[1] - a[1])[0];
    const topCoachName = topCoach
      ? coaches.find((c) => c.id === topCoach[0])?.preferredName ||
        coaches.find((c) => c.id === topCoach[0])?.firstName ||
        "Unknown"
      : null;

    return {
      total,
      pending,
      approved,
      suspended,
      appointedCount,
      totalGames: Object.values(gamesByCoach).reduce((a, b) => a + b, 0),
      avgGamesPerCoach: appointedCount > 0 ? (Object.values(gamesByCoach).reduce((a, b) => a + b, 0) / appointedCount).toFixed(1) : "0",
      topCoach: topCoachName ? `${topCoachName} (${topCoach?.[1]})` : "None",
    };
  }, [coaches, appointments]);

  // === AUDIT TRAIL (Last 5 actions) ===
  const recentActions = useMemo(() => {
    const all = coaches
      .flatMap((c) => (c.auditTrail || []).map((log) => ({ ...log, coachId: c.id })))
      .sort((a, b) => (b.at?.toMillis?.() || 0) - (a.at?.toMillis?.() || 0))
      .slice(0, 5);
    return all;
  }, [coaches]);

  // Safe timestamp
  const formatTimestamp = (ts: any) => {
    if (!ts) return "—";
    if (typeof ts.toDate === "function") return ts.toDate();
    if (ts instanceof Date) return ts;
    if (typeof ts === "string") return new Date(ts);
    return new Date();
  };

  // === Actions ===
  const handleApprove = async (id: string) => {
    if (!window.confirm("Approve this coach?")) return;
    try {
      await updateDoc(doc(db, "coaches", id), { approved: true, status: "active" });
      await updateDoc(doc(db, "users", id), { approved: true });
    } catch (err) {
      alert("Failed.");
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Reason:");
    if (!window.confirm("Reject?")) return;
    try {
      await updateDoc(doc(db, "coaches", id), {
        approved: false,
        status: "pending",
        rejectionReason: reason || "None",
      });
      await updateDoc(doc(db, "users", id), { approved: false });
    } catch (err) {
      alert("Failed.");
    }
  };

  const handleSuspend = async (id: string) => {
    const reason = prompt("Suspension reason:");
    if (!reason || !window.confirm("Suspend?")) return;
    try {
      await updateDoc(doc(db, "coaches", id), { status: "suspended", suspensionReason: reason });
      await updateDoc(doc(db, "users", id), { approved: false });
    } catch (err) {
      alert("Failed.");
    }
  };

  const handleActivate = async (id: string) => {
    if (!window.confirm("Reactivate?")) return;
    try {
      await updateDoc(doc(db, "coaches", id), { status: "active", suspensionReason: "" });
      await updateDoc(doc(db, "users", id), { approved: true });
    } catch (err) {
      alert("Failed.");
    }
  };

  const handleDeleteCoach = async (coach: Coach) => {
    if (!window.confirm(`Delete ${coach.firstName} ${coach.surname}?`)) return;
    setDeleting(coach.id);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "coaches", coach.id));
      batch.delete(doc(db, "users", coach.id));
      const reports = await getDocs(query(collection(db, "reports"), where("coachId", "==", coach.id)));
      reports.forEach((d) => batch.delete(d.ref));
      const appts = await getDocs(query(collection(db, "appointments"), where("coachId", "==", coach.id)));
      appts.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      alert("Delete failed.");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-8">

      {/* === STATISTICAL DASHBOARD === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="p-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">Total Coaches</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <Users className="w-10 h-10 text-emerald-200" />
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Appointed Coaches</p>
              <p className="text-3xl font-bold">{stats.appointedCount}</p>
            </div>
            <Trophy className="w-10 h-10 text-blue-200" />
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm">Total Games</p>
              <p className="text-3xl font-bold">{stats.totalGames}</p>
            </div>
            <Calendar className="w-10 h-10 text-amber-200" />
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-purple-500 to-pink-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Avg Games/Coach</p>
              <p className="text-3xl font-bold">{stats.avgGamesPerCoach}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-purple-200" />
          </div>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-gray-700">Pending Approval</p>
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${(stats.pending / Math.max(stats.total, 1)) * 100}%` }}></div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-gray-700">Active & Approved</p>
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700">{stats.approved}</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(stats.approved / Math.max(stats.total, 1)) * 100}%` }}></div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-gray-700">Suspended</p>
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700">{stats.suspended}</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(stats.suspended / Math.max(stats.total, 1)) * 100}%` }}></div>
          </div>
        </Card>
      </div>

      {/* Top Performer + Audit Trail */}
      <div className="grid md:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-600" /> Top Appointed Coach
          </h3>
          <p className="text-lg font-medium text-gray-700">{stats.topCoach}</p>
          <p className="text-sm text-gray-500 mt-1">Most games assigned</p>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Recent Audit Trail
          </h3>
          <div className="space-y-2 text-xs">
            {recentActions.length === 0 ? (
              <p className="text-gray-500 italic">No recent actions</p>
            ) : (
              recentActions.map((log, i) => (
                <div key={i} className="flex justify-between text-gray-600">
                  <span>{log.action} by {log.by}</span>
                  <span>{format(formatTimestamp(log.at), "dd MMM HH:mm")}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* === COACH LIST === */}
      <h3 className="text-2xl font-bold text-gray-900">All Coaches</h3>

      {coaches.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No coaches registered.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coaches.map((coach) => {
            const games = appointments.filter(
              (a) => a.coachId === coach.id && a.status !== "rejected"
            ).length;

            return (
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
                  <div className="text-right">
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
                    {games > 0 && (
                      <p className="text-xs text-emerald-600 mt-1">
                        {games} game{games > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setSelectedCoach(coach)}>
                    View
                  </Button>
                  {coach.status === "active" && (
                    <Button size="sm" variant="danger" onClick={() => handleSuspend(coach.id)}>
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
            );
          })}
        </div>
      )}

      {/* === MODAL === */}
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
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Coach Profile</h3>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="font-medium">Name</p><p>{selectedCoach.firstName} {selectedCoach.surname}</p></div>
                  <div><p className="font-medium">Preferred</p><p>{selectedCoach.preferredName || "-"}</p></div>
                  <div><p className="font-medium">Gender</p><p>{selectedCoach.gender || "-"}</p></div>
                  <div><p className="font-medium">Nationality</p><p>{selectedCoach.nationality || "-"}</p></div>
                  <div><p className="font-medium">DOB</p><p>{selectedCoach.dob || "-"}</p></div>
                  <div><p className="font-medium">ID</p><p>{selectedCoach.idNumber || "-"}</p></div>
                </div>

                <hr />

                <div>
                  <p className="font-medium mb-1">Contact</p>
                  <p>Email: {selectedCoach.email}</p>
                  <p>Mobile: {selectedCoach.mobileNumber || "-"}</p>
                  <p>Address: {selectedCoach.residentialAddress || "-"}, {selectedCoach.city || "-"}</p>
                </div>

                <hr />

                <div>
                  <p className="font-medium mb-1">Bank</p>
                  <p>Bank: {selectedCoach.bankName || "-"}</p>
                  <p>Holder: {selectedCoach.accountHolder || "-"}</p>
                  <p>Account: {selectedCoach.accountNumber || "-"}</p>
                </div>

                {selectedCoach.suspensionReason && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="font-medium text-red-800">Suspension</p>
                    <p className="text-red-700">{selectedCoach.suspensionReason}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                {!selectedCoach.approved && selectedCoach.status !== "suspended" && (
                  <>
                    <Button variant="success" onClick={() => handleApprove(selectedCoach.id)}>
                      Approve
                    </Button>
                    <Button variant="danger" onClick={() => handleReject(selectedCoach.id)}>
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