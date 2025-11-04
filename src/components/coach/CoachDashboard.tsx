import React, { useEffect, useState } from "react";
import { Card, StatCard } from "../ui/Card";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/avatar";
import { Badge } from "../ui/Badge";
import { db, auth } from "../../lib/firebase";
import {
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  collection,
  updateDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { CoachingReportUnified } from './CoachingReportUnified';
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Edit2, Save, X } from "lucide-react";

interface Report {
  id: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  reportType: string;
  content: string;
  playerName?: string;
  minute?: string;
  lawInfringed?: string;
  subject?: string;
  createdAt: any;
  reviewed?: boolean;
  reviewedBy?: string;
  reviewedAt?: any;
  venue?: string;
  referee?: string;
}

interface Appointment {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  venue: string;
  appointedBy: string;
  matchId: string;
  createdAt: any;
  auditTrail?: Array<{
    action: string;
    by: string;
    timestamp: any;
  }>;
  referee?: string;
}

interface AuditEntry {
  id: string;
  action: string;
  by: string;
  timestamp: any;
}

export const CoachDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"reports" | "profile" | "appointments">("appointments");
  const [showReportForm, setShowReportForm] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);

  const user = auth.currentUser;
  const coachName = user?.displayName || "Coach";
  const coachEmail = user?.email || "";
  const photoURL = user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(coachName)}&background=10b981&color=fff`;

  // === Load Profile (Full) ===
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "coaches", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setEditData({
          firstName: data.firstName || "",
          surname: data.surname || "",
          mobileNumber: data.mobileNumber || "",
          city: data.city || "",
          bankName: data.bankName || "",
          accountNumber: data.accountNumber || "",
          branch: data.branch || "",
          approved: data.approved || false,
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  // === Load Reports ===
  useEffect(() => {
    if (!coachEmail) return;

    const q = query(
      collection(db, "coachReports"),
      where("coachEmail", "==", coachEmail)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Report[];
      setReports(data);
    });

    return () => unsub();
  }, [coachEmail]);

  // === Load Appointments from `appointments` collection (aligned with Executive) ===
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "appointments"),
      where("coachId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const appts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Appointment[];

      setAppointments(appts);
    });

    return () => unsub();
  }, [user?.uid]);

  // === Open Report Form ===
  const openReportForm = (appt: Appointment) => {
    setSelectedMatch({
      homeTeam: appt.homeTeam,
      awayTeam: appt.awayTeam,
      date: appt.date,
      time: appt.time,
      venue: appt.venue,
      referee: appt.referee || "—",
      matchId: appt.id,
    });
    setShowReportForm(true);
  };

  const closeReportForm = () => {
    setShowReportForm(false);
    setSelectedMatch(null);
  };

  // === Audit Trail ===
  const loadAuditTrail = (apptId: string) => {
    if (selectedApptId === apptId) {
      setSelectedApptId(null);
      setAuditTrail([]);
      return;
    }

    const trailRef = collection(db, "appointments", apptId, "auditTrail");
    const unsub = onSnapshot(trailRef, (snap) => {
      const trail = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AuditEntry[];
      setAuditTrail(trail);
    });
    setSelectedApptId(apptId);
    return () => unsub();
  };

  // === Save Profile ===
  const handleSaveProfile = async () => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, "coaches", user.uid), editData);
      await updateDoc(doc(db, "users", user.uid), {
        displayName: `${editData.firstName} ${editData.surname}`.trim(),
      });
      setEditing(false);
    } catch (err) {
      alert("Failed to save profile.");
    }
  };

  // === Logout ===
  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (err) {
      alert("Logout failed.");
    }
  };

  // === Stats ===
  const totalReports = reports.length;
  const thisMonthReports = reports.filter((r) => {
    const date = r.createdAt?.toDate?.() || new Date(r.createdAt);
    if (!date) return false;
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
  const reviewedReports = reports.filter((r) => r.reviewed).length;
  const pendingReview = totalReports - reviewedReports;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header with Logout */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Avatar src={photoURL} size="lg" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">{coachName}</h2>
              <p className="text-sm text-gray-600">{coachEmail}</p>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <Button
              variant={activeTab === "appointments" ? "default" : "outline"}
              onClick={() => setActiveTab("appointments")}
            >
              Appointments
            </Button>
            <Button
              variant={activeTab === "reports" ? "default" : "outline"}
              onClick={() => setActiveTab("reports")}
            >
              Reports
            </Button>
            <Button
              variant={activeTab === "profile" ? "default" : "outline"}
              onClick={() => setActiveTab("profile")}
            >
              Profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* APPOINTMENTS TAB */}
        {activeTab === "appointments" && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">Your Match Appointments</h3>
            {appointments.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-500">No appointments yet. Check back after the executive assigns you.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {appointments.map((appt) => (
                  <Card key={appt.id} className="p-5 hover:shadow-md transition">
                    <div className="flex justify-between items-start gap-4">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => loadAuditTrail(appt.id)}
                      >
                        <h4 className="font-bold text-lg text-gray-900">
                          {appt.homeTeam} vs {appt.awayTeam}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {appt.date} • {appt.time} • {appt.venue}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          <strong>Referee:</strong> {appt.referee || "—"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Appointed by: <span className="font-medium">{appt.appointedBy}</span>
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <Badge variant="emerald">Active</Badge>
                        <Button
                          size="sm"
                          onClick={() => openReportForm(appt)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Submit Report
                        </Button>
                      </div>
                    </div>

                    {/* Audit Trail */}
                    {selectedApptId === appt.id && auditTrail.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">Audit Trail</p>
                        {auditTrail.map((entry) => (
                          <p key={entry.id} className="text-xs text-gray-500">
                            {entry.action} by <span className="font-medium">{entry.by}</span> •{" "}
                            {entry.timestamp?.toDate?.()
                              ? new Date(entry.timestamp.toDate()).toLocaleString()
                              : new Date(entry.timestamp).toLocaleString()}
                          </p>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REPORT FORM */}
        <AnimatePresence>
          {showReportForm && selectedMatch && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              onClick={closeReportForm}
            >
              <Card
                className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Submit Match Report</h3>
                  <Button variant="ghost" size="sm" onClick={closeReportForm}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <CoachingReportUnified
                  coachName={coachName}
                  coachEmail={coachEmail}
                  prefill={{
                    homeTeam: selectedMatch.homeTeam,
                    awayTeam: selectedMatch.awayTeam,
                    date: selectedMatch.date,
                    time: selectedMatch.time,
                    venue: selectedMatch.venue,
                    referee: selectedMatch.referee,
                    matchId: selectedMatch.matchId,
                  }}
                  onSuccess={closeReportForm}
                />
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* REPORTS TAB */}
        {activeTab === "reports" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total Reports" value={totalReports} icon="Document" color="emerald" />
              <StatCard title="This Month" value={thisMonthReports} icon="Calendar" color="amber" />
              <StatCard title="Reviewed" value={reviewedReports} icon="Check" color="blue" />
              <StatCard title="Pending" value={pendingReview} icon="Clock" color="purple" />
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-bold">Your Reports</h3>
              {loading ? (
                <Card><p className="text-center py-8 text-gray-500">Loading...</p></Card>
              ) : reports.length === 0 ? (
                <Card><p className="text-center py-8 text-gray-500">No reports yet. Submit from Appointments!</p></Card>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <Card key={report.id} className="p-5 hover:shadow-lg transition">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="font-bold text-lg text-gray-900">
                            {report.homeTeam} vs {report.awayTeam}
                          </h4>
                          <div className="text-sm text-gray-600 space-y-1 mt-1">
                            <p>
                              {report.matchDate && new Date(report.matchDate).toLocaleDateString()} • {report.venue}
                            </p>
                            <p>
                              <strong>Referee:</strong> {report.referee || "—"}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            {report.reportType === "junior_coaching" ? "Junior" : "Senior"} Coaching Report •{" "}
                            {new Date(report.createdAt?.toDate?.() || report.createdAt).toLocaleDateString()}
                          </p>
                          {report.reviewed && (
                            <p className="text-xs text-emerald-600 mt-1">
                              Reviewed by {report.reviewedBy}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {report.reviewed ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              Reviewed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* PROFILE TAB - FULL EDIT */}
        {activeTab === "profile" && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">Coach Profile</h3>
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                      <X className="w-4 h-4 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveProfile}>
                      <Save className="w-4 h-4 mr-1" /> Save
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <Edit2 className="w-4 h-4 mr-1" /> Edit
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Read-only Email */}
              <div>
                <p className="font-medium text-gray-700">Email</p>
                <p className="text-lg">{coachEmail}</p>
              </div>

              {editing ? (
                <>
                  <input
                    value={editData.firstName || ""}
                    onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                    placeholder="First Name"
                    className="w-full border rounded-lg px-4 py-2 text-sm"
                  />
                  <input
                    value={editData.surname || ""}
                    onChange={(e) => setEditData({ ...editData, surname: e.target.value })}
                    placeholder="Surname"
                    className="w-full border rounded-lg px-4 py-2 text-sm"
                  />
                  <input
                    value={editData.mobileNumber || ""}
                    onChange={(e) => setEditData({ ...editData, mobileNumber: e.target.value })}
                    placeholder="Mobile Number"
                    className="w-full border rounded-lg px-4 py-2 text-sm"
                  />
                  <input
                    value={editData.city || ""}
                    onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                    placeholder="City"
                    className="w-full border rounded-lg px-4 py-2 text-sm"
                  />
                  <input
                    value={editData.bankName || ""}
                    onChange={(e) => setEditData({ ...editData, bankName: e.target.value })}
                    placeholder="Bank Name"
                    className="w-full border rounded-lg px-4 py-2 text-sm"
                  />
                  <input
                    value={editData.accountNumber || ""}
                    onChange={(e) => setEditData({ ...editData, accountNumber: e.target.value })}
                    placeholder="Account Number"
                    className="w-full border rounded-lg px-4 py-2 text-sm"
                  />
                  <input
                    value={editData.branch || ""}
                    onChange={(e) => setEditData({ ...editData, branch: e.target.value })}
                    placeholder="Branch"
                    className="w-full border rounded-lg px-4 py-2 text-sm"
                  />
                </>
              ) : (
                <>
                  <div>
                    <p className="font-medium text-gray-700">Name</p>
                    <p className="text-lg">{profile?.firstName} {profile?.surname}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Mobile</p>
                    <p className="text-lg">{profile?.mobileNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">City</p>
                    <p className="text-lg">{profile?.city || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Bank</p>
                    <p className="text-lg">{profile?.bankName || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Account</p>
                    <p className="text-lg">{profile?.accountNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Branch</p>
                    <p className="text-lg">{profile?.branch || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Status</p>
                    <p className="text-lg">
                      {profile?.approved ? (
                        <span className="text-emerald-600 font-medium">Approved</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Pending Approval</span>
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};