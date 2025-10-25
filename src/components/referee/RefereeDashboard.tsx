import React, { useEffect, useState } from "react";
import { Card, StatCard } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { db } from "../../lib/firebase";
import { ReportSubmission } from "./ReportSubmission";
import { RefereeProfiles } from "../executive/RefereeProfiles";
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
  setDoc,
} from "firebase/firestore";
import {
  getAuth,
  signOut,
  updateProfile as updateAuthProfile,
} from "firebase/auth";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { toast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";





export const RefereeDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewProfile, setViewProfile] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;
  const storage = getStorage();
  const currentRefereeId = user?.uid || "";
  const currentRefereeEmail = user?.email || "";
  const profilePhoto = profile?.photoURL || user?.photoURL || "/default-avatar.png";

  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState<any>({});
  

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

  // 🔹 Fetch or Create Referee Profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentRefereeId) return;

      try {
        const refDoc = doc(db, "referees", currentRefereeId);
        const snap = await getDoc(refDoc);

        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() });
        } else {
          const defaultProfile = {
            uid: currentRefereeId,
            email: currentRefereeEmail,
            createdAt: new Date(),
          };
          await setDoc(refDoc, defaultProfile);
          setProfile({ id: currentRefereeId, ...defaultProfile });
          console.log("✅ Auto-created new referee profile");
        }
      } catch (e) {
        console.error("Error fetching profile:", e);
        toast({
          title: "Error fetching profile",
          description: "Please check your permissions or connection.",
          variant: "destructive",
        });
      }
    };

    fetchProfile();
  }, [currentRefereeId, currentRefereeEmail]);

  // 🔹 Upload Profile Image
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentRefereeId) return;

    try {
      setUploading(true);
      const fileRef = storageRef(storage, `referees/${currentRefereeId}/profile.jpg`);
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on(
        "state_changed",
        null,
        (error) => {
          console.error("Upload error:", error);
          setUploading(false);
          toast({
            title: "Upload Failed",
            description: "Unable to upload image.",
            variant: "destructive",
          });
        },
        async () => {
          const downloadURL = await getDownloadURL(fileRef);
          await updateDoc(doc(db, "referees", currentRefereeId), {
            photoURL: downloadURL,
            updatedAt: new Date(),
          });

          if (auth.currentUser) {
            await updateAuthProfile(auth.currentUser, { photoURL: downloadURL });
          }

          setProfile((prev: any) => ({ ...prev, photoURL: downloadURL }));
          setUploading(false);
          toast({ title: "Profile Photo Updated ✅" });
        }
      );
    } catch (e) {
      console.error("Upload error:", e);
      setUploading(false);
      toast({
        title: "Error",
        description: "Failed to upload photo.",
        variant: "destructive",
      });
    }
  };

  // 🔹 Fetch Appointments
  useEffect(() => {
    if (!currentRefereeEmail) return;

    const q = query(
      collection(db, "appointments"),
      where("refereeEmail", "==", currentRefereeEmail)
    );

    const unsub = onSnapshot(q, (snap) => {
      setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [currentRefereeEmail]);

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

  // 🔹 Appointment Actions
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

  // 🔹 Stats
  const pending = appointments.filter((a) => a.status === "pending").length;
  const accepted = appointments.filter((a) => a.status === "accepted").length;
  const rejected = appointments.filter((a) => a.status === "rejected").length;

  // 🔹 Conditional rendering for profile view
 if (viewProfile) {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">👤 My Profile</h2>
        <Button
          variant="outline"
          onClick={() => setViewProfile(false)}
          className="text-emerald-600 border-emerald-600 hover:bg-emerald-600 hover:text-white"
        >
          ← Back to Dashboard
        </Button>
      </div>
      <RefereeProfiles currentRefereeId={currentRefereeId} editable />
    </div>
  );
}


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Referee Dashboard</h2>
          <p className="text-gray-600">Manage your profile, matches, and reports</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Profile Photo */}
          <div className="relative">
            <img
              src={profilePhoto}
              alt="Profile"
              onClick={() => setViewProfile(true)}
              className={`w-12 h-12 rounded-full border-2 cursor-pointer ${
                uploading ? "opacity-50 animate-pulse" : "border-emerald-500"
              } hover:scale-105 transition-transform`}
            />
            <label className="absolute bottom-0 right-0 bg-emerald-600 text-white text-xs px-1.5 py-0.5 rounded cursor-pointer hover:bg-emerald-700">
              📷
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>
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

{/* 🏟️ Appointments Section */}
<div>
  <h3 className="text-2xl font-bold mb-4 text-gray-900">Your Appointments</h3>

  {loading ? (
    <p className="text-center text-gray-500 py-8">Loading appointments...</p>
  ) : appointments.length === 0 ? (
    <p className="text-center text-gray-500 py-8">No appointments assigned</p>
  ) : (
    <div className="space-y-4">
      {appointments.map((apt) => {
        const isExpanded = expandedResultId === apt.id;
        const isPending = apt.status === "pending";
        const isAccepted = apt.status === "accepted";
        const isRejected = apt.status === "rejected";

        return (
          <Card
            key={apt.id}
            className="p-5 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                {/* 🏷️ Header Info */}
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold">
                    {apt.homeTeam} vs {apt.awayTeam}
                  </h3>
                  <Badge
                    variant={
                      isAccepted
                        ? "success"
                        : isRejected
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

                {/* 🟡 Pending → Accept / Decline */}
                {isPending && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => handleResponse(apt.id, "accepted")}
                    >
                      ✅ Accept
                    </Button>
                    <Button
                      size="sm"
                      className="bg-red-500 text-white hover:bg-red-600"
                      onClick={() => handleResponse(apt.id, "rejected")}
                    >
                      ❌ Decline
                    </Button>
                  </div>
                )}

                {/* 🟢 Accepted → Show Submit Buttons */}
                {isAccepted && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setActiveReportId(apt.id)}
                    >
                      📄 Submit Report
                    </Button>

                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() =>
                        setExpandedResultId(isExpanded ? null : apt.id)
                      }
                    >
                      {apt.resultSubmitted ? "👁 View / Edit Result" : "🏆 Submit Result"}
                    </Button>
                  </div>
                )}

                {/* ✅ Result Submitted Summary */}
                {apt.resultSubmitted && !isExpanded && (
                  <p className="mt-3 text-emerald-700 font-medium">
                    ✅ Result: {apt.resultSummary || "Awaiting executive review"}
                  </p>
                )}
              </div>
            </div>

            {/* 🔽 Expandable inline result form */}
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 border-t pt-4"
              >
                <h4 className="font-semibold text-gray-800 mb-2">
                  {apt.resultSubmitted
                    ? "Edit / View Submitted Result"
                    : "Enter Match Results"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm text-gray-600">
                      🏠 Home Team Score
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded-md px-2 py-1"
                      value={resultForm.homeScore ?? apt.homeScore ?? ""}
                      onChange={(e) =>
                        setResultForm({
                          ...resultForm,
                          homeScore: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600">
                      🚌 Away Team Score
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded-md px-2 py-1"
                      value={resultForm.awayScore ?? apt.awayScore ?? ""}
                      onChange={(e) =>
                        setResultForm({
                          ...resultForm,
                          awayScore: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm text-gray-600">
                      🏅 Player of the Match
                    </label>
                    <input
                      type="text"
                      className="w-full border rounded-md px-2 py-1"
                      placeholder="Enter player name"
                      value={resultForm.player ?? apt.playerOfMatch ?? ""}
                      onChange={(e) =>
                        setResultForm({
                          ...resultForm,
                          player: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm text-gray-600">
                      🗒️ Notes / Summary
                    </label>
                    <textarea
                      className="w-full border rounded-md px-2 py-1"
                      rows={3}
                      placeholder="Any comments or incidents..."
                      value={resultForm.notes ?? apt.notes ?? ""}
                      onChange={(e) =>
                        setResultForm({
                          ...resultForm,
                          notes: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedResultId(null)}
                  >
                    Close
                  </Button>

                  <Button
                    size="sm"
                    className="bg-blue-600 text-white"
                    onClick={async () => {
                      if (!resultForm.homeScore || !resultForm.awayScore) {
                        toast({
                          title: "Missing info",
                          description: "Please enter both scores.",
                          variant: "destructive",
                        });
                        return;
                      }

                      try {
                        const summary = `${apt.homeTeam} ${resultForm.homeScore} - ${resultForm.awayScore} ${apt.awayTeam}`;
                        const resultData = {
                          refereeId: currentRefereeId,
                          refereeEmail: currentRefereeEmail,
                          matchId: apt.id,
                          homeTeam: apt.homeTeam,
                          awayTeam: apt.awayTeam,
                          homeScore: Number(resultForm.homeScore) || 0,
                          awayScore: Number(resultForm.awayScore) || 0,
                          playerOfMatch: resultForm.player || "",
                          notes: resultForm.notes || "",
                          resultSummary: summary,
                          resultSubmitted: true,
                          updatedAt: new Date(),
                        };

                        // ✅ Merge result into Firestore safely
                        await setDoc(doc(db, "appointments", apt.id), resultData, { merge: true });
                        await addDoc(collection(db, "results"), resultData);

                        toast({
                          title: apt.resultSubmitted ? "✅ Result Updated" : "✅ Result Submitted",
                          description: summary,
                        });

                        setExpandedResultId(null);
                        setResultForm({});
                        refreshAppointments?.();
                      } catch (e) {
                        console.error("Result submit error:", e);
                        toast({
                          title: "Error",
                          description: "Failed to submit result.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    💾 {apt.resultSubmitted ? "Update Result" : "Submit Result"}
                  </Button>
                </div>
              </motion.div>
            )}
          </Card>
        );
      })}
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
