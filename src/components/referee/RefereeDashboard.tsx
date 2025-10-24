import React, { useEffect, useState } from "react";
import { Card, StatCard } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { db } from "../../lib/firebase";
import { ReportSubmission } from "./ReportSubmission";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { toast } from "@/components/ui/use-toast";
import { ChevronDown, ChevronUp } from "lucide-react";

export const RefereeDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeResult, setActiveResult] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<Record<string, any>>({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;
  const currentRefereeEmail = user?.email || "";
  const currentRefereeId = user?.uid || "";
  const profilePhoto = user?.photoURL || "/default-avatar.png";

  // 🔹 Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "Logged out successfully." });
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to log out.",
        variant: "destructive",
      });
    }
  };

  // 🔹 Fetch Referee Profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentRefereeEmail) return;
      try {
        const refDoc = doc(db, "referees", currentRefereeEmail);
        const snap = await getDoc(refDoc);
        if (snap.exists()) setProfile({ id: snap.id, ...snap.data() });
      } catch (e) {
        console.error("Error fetching profile:", e);
      }
    };
    fetchProfile();
  }, [currentRefereeEmail]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    try {
      const refDoc = doc(db, "referees", profile.id);
      await updateDoc(refDoc, { ...profile, updatedAt: new Date() });
      toast({ title: "Profile Saved ✅", description: "Changes saved." });
      setEditingProfile(false);
    } catch (e) {
      console.error("Save error:", e);
      toast({ title: "Error", description: "Failed to update.", variant: "destructive" });
    }
  };

  // 🔹 Fetch appointments
  useEffect(() => {
    if (!currentRefereeEmail && !currentRefereeId) return;
    const q = query(
      collection(db, "appointments"),
      where("refereeEmail", "==", currentRefereeEmail)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAppointments(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, [currentRefereeEmail, currentRefereeId]);

  // 🔹 Fetch Reports
  useEffect(() => {
    if (!currentRefereeId) return;
    const q = query(
      collection(db, "reports"),
      where("refereeId", "==", currentRefereeId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) =>
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [currentRefereeId]);

  // 🔹 Appointment actions
  const handleResponse = async (id: string, response: "accepted" | "rejected") => {
    try {
      await updateDoc(doc(db, "appointments", id), {
        status: response,
        respondedAt: new Date().toISOString(),
      });
      toast({
        title: "Updated",
        description: `Appointment ${response}`,
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to update appointment.",
        variant: "destructive",
      });
    }
  };

  const handleResultChange = (id: string, field: string, value: string) =>
    setMatchResults((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));

  const handleSubmitResult = async (id: string) => {
    const result = matchResults[id];
    const match = appointments.find((m) => m.id === id);
    if (!match) return;

    try {
      await addDoc(collection(db, "results"), {
        appointmentId: id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        refereeId: currentRefereeId,
        submittedAt: new Date(),
      });
      toast({ title: "Result Saved ✅" });
      setActiveResult(null);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save result." });
    }
  };

  // 🔹 Stats
  const pending = appointments.filter((a) => a.status === "pending").length;
  const accepted = appointments.filter((a) => a.status === "accepted").length;
  const rejected = appointments.filter((a) => a.status === "rejected").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Referee Dashboard</h2>
          <p className="text-gray-600">Manage your profile, matches, and reports</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Clickable Profile Photo */}
          <div className="relative">
            <img
              src={profilePhoto}
              alt="Profile"
              onClick={() => setShowProfile(!showProfile)}
              className="w-12 h-12 rounded-full border-2 border-emerald-500 cursor-pointer hover:scale-105 transition-transform"
            />
            {showProfile && profile && (
              <div className="absolute right-0 mt-2 w-80 bg-white border rounded-xl shadow-lg z-50 p-4">
                <h3 className="font-semibold text-gray-800 mb-2">
                  👤 {profile.firstName} {profile.surname}
                </h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><strong>Email:</strong> {profile.email}</p>
                  <p><strong>Contact:</strong> {profile.mobileNumber}</p>
                  <p><strong>Area:</strong> {profile.city}</p>
                  <p><strong>Gender:</strong> {profile.gender}</p>
                  <p><strong>Date of Birth:</strong> {profile.dob}</p>
                  <p><strong>Bank:</strong> {profile.bankName}</p>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <Button size="sm" onClick={() => setEditingProfile(true)}>
                    ✏️ Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowProfile(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <Button
            variant="outline"
            onClick={handleLogout}
            className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
          >
            🚪 Logout
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Pending" value={pending} icon="⏳" color="amber" />
        <StatCard title="Accepted" value={accepted} icon="✅" color="green" />
        <StatCard title="Rejected" value={rejected} icon="❌" color="red" />
        <StatCard title="Total Matches" value={accepted + rejected} icon="🏆" color="emerald" />
      </div>

      {/* Appointments */}
      <div>
        <h3 className="text-2xl font-bold mb-4 text-gray-900">Your Appointments</h3>
        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading appointments...</p>
        ) : appointments.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No appointments assigned</p>
        ) : (
          <div className="space-y-4">
            {appointments.map((apt) => (
              <Card key={apt.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">
                        {apt.homeTeam} vs {apt.awayTeam}
                      </h3>
                      <Badge
                        variant={
                          apt.status === "accepted"
                            ? "success"
                            : apt.status === "rejected"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {apt.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-gray-600">
                      📅 {apt.date} • ⏰ {apt.time}
                    </p>
                    <p className="text-gray-600">📍 {apt.venue}</p>
                    {apt.status === "pending" && (
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={() => handleResponse(apt.id, "accepted")}>
                          Accept
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleResponse(apt.id, "rejected")}>
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reports */}
      <div>
        <h3 className="text-2xl font-bold mb-4 text-gray-900">My Reports</h3>
        {reports.length === 0 ? (
          <p className="text-gray-500 text-center">No reports submitted yet.</p>
        ) : (
          <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((r) => (
              <Card
                key={r.id}
                className="p-4 bg-white border rounded-xl shadow hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setActiveReportId(r.id)}
              >
                <p className="font-semibold text-gray-900 text-lg">{r.teams}</p>
                <p className="text-sm text-gray-700">{r.matchDate}</p>
                <p className="text-gray-600">📋 {r.type?.toUpperCase()}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {activeReportId && (
        <ReportSubmission
          appointmentId={activeReportId}
          onClose={() => setActiveReportId(null)}
        />
      )}
    </div>
  );
};
