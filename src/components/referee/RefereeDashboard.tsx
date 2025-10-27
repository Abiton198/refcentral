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
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState<any>({});

  const auth = getAuth();
  const user = auth.currentUser;
  const storage = getStorage();
  const currentRefereeId = user?.uid || "";
  const currentRefereeEmail = user?.email || "";
  const profilePhoto = profile?.photoURL || user?.photoURL || "/default-avatar.png";

  // 🔹 Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "Logged out successfully." });
      window.location.href = "/";
    } catch (err) {
      toast({ title: "Error", description: "Failed to log out.", variant: "destructive" });
    }
  };

  // 🔹 Fetch or Create Referee Profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentRefereeId) return;

      const refDoc = doc(db, "referees", currentRefereeId);
      const snap = await getDoc(refDoc);

      if (snap.exists()) {
        setProfile({ id: snap.id, ...snap.data() });
      } else {
        const defaultProfile = {
          uid: currentRefereeId,
          email: currentRefereeEmail,
          createdAt: new Date(),
          status: "active",
          availabilityStatus: "available",
        };
        await setDoc(refDoc, defaultProfile);
        setProfile(defaultProfile);
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
        },
        async () => {
          const downloadURL = await getDownloadURL(fileRef);
          await updateDoc(doc(db, "referees", currentRefereeId), {
            photoURL: downloadURL,
            updatedAt: new Date(),
          });
          if (auth.currentUser) await updateAuthProfile(auth.currentUser, { photoURL: downloadURL });
          setProfile((p: any) => ({ ...p, photoURL: downloadURL }));
          toast({ title: "Profile photo updated ✅" });
          setUploading(false);
        }
      );
    } catch {
      setUploading(false);
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    }
  };

  // 🔹 Toggle Availability
  const toggleAvailability = async () => {
    if (!profile?.id) return;
    const newStatus = profile.availabilityStatus === "available" ? "unavailable" : "available";
    try {
      await updateDoc(doc(db, "referees", profile.id), {
        availabilityStatus: newStatus,
        updatedAt: new Date(),
      });
      setProfile((prev: any) => ({ ...prev, availabilityStatus: newStatus }));
      toast({
        title: `You are now marked as ${newStatus === "available" ? "✅ Available" : "❌ Unavailable"}`,
      });
    } catch (err) {
      console.error("Availability toggle error:", err);
      toast({
        title: "Error",
        description: "Failed to update availability.",
        variant: "destructive",
      });
    }
  };

  // 🔹 Fetch Appointments
  useEffect(() => {
    if (!currentRefereeEmail) return;
    const q = query(collection(db, "appointments"), where("refereeEmail", "==", currentRefereeEmail));
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
    const unsub = onSnapshot(q, (snap) => setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [currentRefereeId]);

  // 🔹 Accept / Reject appointment
  const handleResponse = async (id: string, response: "accepted" | "rejected") => {
    try {
      await updateDoc(doc(db, "appointments", id), {
        status: response,
        respondedAt: new Date().toISOString(),
      });
      toast({ title: "Updated", description: `Appointment ${response}` });
    } catch {
      toast({ title: "Error", description: "Failed to update appointment", variant: "destructive" });
    }
  };

  // 🔹 Stats
  const pending = appointments.filter((a) => a.status === "pending").length;
  const accepted = appointments.filter((a) => a.status === "accepted").length;
  const rejected = appointments.filter((a) => a.status === "rejected").length;

  // 🔹 Profile view toggle
  if (viewProfile) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">👤 My Profile</h2>
          <Button variant="outline" onClick={() => setViewProfile(false)}>
            ← Back
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
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-900">Referee Dashboard</h2>

            {/* Availability Toggle */}
            <button
              onClick={toggleAvailability}
              className="flex items-center gap-1 text-sm font-medium cursor-pointer"
            >
              <span
                className={`inline-block w-3 h-3 rounded-full ${
                  profile?.availabilityStatus === "available"
                    ? "bg-green-500"
                    : "bg-red-500"
                }`}
              ></span>
              {profile?.availabilityStatus === "available" ? (
                <span className="text-green-700">Available</span>
              ) : (
                <span className="text-red-600">Unavailable</span>
              )}
            </button>
          </div>
          <p className="text-gray-600">Manage your profile, appointments, and results</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={profilePhoto}
              onClick={() => setViewProfile(true)}
              className={`w-12 h-12 rounded-full cursor-pointer border-2 ${
                uploading ? "animate-pulse opacity-60" : "border-emerald-500"
              }`}
              alt="profile"
            />
            <label className="absolute bottom-0 right-0 bg-emerald-600 text-white text-xs px-1.5 py-0.5 rounded cursor-pointer">
              📷
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>
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
        <StatCard title="Total" value={accepted + rejected} icon="🏆" color="emerald" />
      </div>

      {/* Appointments */}
      <div>
        <h3 className="text-2xl font-bold mb-4">Your Appointments</h3>
        {loading ? (
          <p className="text-gray-500 text-center py-6">Loading...</p>
        ) : appointments.length === 0 ? (
          <p className="text-gray-500 text-center py-6">No appointments yet.</p>
        ) : (
          <div className="space-y-4">
            {appointments.map((apt) => {
              const isExpanded = expandedResultId === apt.id;
              const status = apt.status || "pending";
              return (
                <Card key={apt.id} className="p-5 border shadow-sm hover:shadow-md transition">
                  <div className="flex justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {apt.homeTeam} vs {apt.awayTeam}
                        </h3>
                        <Badge
                          variant={
                            status === "accepted"
                              ? "success"
                              : status === "rejected"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-gray-600">
                        📅 {apt.date} • ⏰ {apt.time}
                      </p>
                      <p className="text-gray-600">📍 {apt.venue}</p>
                      <p className="text-gray-500 text-sm">
                        🏆 {apt.gameType?.toUpperCase()} • {apt.game}
                      </p>

                      {status === "pending" && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 text-white"
                            onClick={() => handleResponse(apt.id, "accepted")}
                          >
                            ✅ Accept
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-500 text-white"
                            onClick={() => handleResponse(apt.id, "rejected")}
                          >
                            ❌ Decline
                          </Button>
                        </div>
                      )}

                      {status === "accepted" && (
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            className="bg-blue-600 text-white"
                            onClick={() => setActiveReportId(apt.id)}
                          >
                            📄 Report
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 text-white"
                            onClick={() =>
                              setExpandedResultId(isExpanded ? null : apt.id)
                            }
                          >
                            {apt.resultSubmitted ? "👁 Edit Result" : "🏆 Submit Result"}
                          </Button>
                        </div>
                      )}

                      {apt.resultSubmitted && !isExpanded && (
                        <p className="mt-2 text-emerald-700 font-medium">
                          ✅ {apt.resultSummary}
                        </p>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 border-t pt-3"
                    >
                      <h4 className="font-semibold mb-2">Enter Match Result</h4>
                      <div className="grid sm:grid-cols-2 gap-3 mb-3">
                        <input
                          type="number"
                          placeholder="Home score"
                          className="border rounded px-2 py-1"
                          value={resultForm.homeScore ?? apt.homeScore ?? ""}
                          onChange={(e) =>
                            setResultForm({ ...resultForm, homeScore: e.target.value })
                          }
                        />
                        <input
                          type="number"
                          placeholder="Away score"
                          className="border rounded px-2 py-1"
                          value={resultForm.awayScore ?? apt.awayScore ?? ""}
                          onChange={(e) =>
                            setResultForm({ ...resultForm, awayScore: e.target.value })
                          }
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Player of the match"
                        className="border w-full rounded px-2 py-1 mb-2"
                        value={resultForm.playerOfMatch ?? apt.playerOfMatch ?? ""}
                        onChange={(e) =>
                          setResultForm({ ...resultForm, playerOfMatch: e.target.value })
                        }
                      />
                      <textarea
                        placeholder="Notes"
                        rows={3}
                        className="border w-full rounded px-2 py-1"
                        value={resultForm.notes ?? apt.notes ?? ""}
                        onChange={(e) =>
                          setResultForm({ ...resultForm, notes: e.target.value })
                        }
                      />
                      <div className="flex justify-end gap-2 mt-3">
                        <Button
                          variant="outline"
                          onClick={() => setExpandedResultId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
  className="bg-blue-600 text-white"
  onClick={async () => {
    try {
      if (!resultForm.homeScore || !resultForm.awayScore) {
        toast({
          title: "Incomplete",
          description: "Enter both scores.",
          variant: "destructive",
        });
        return;
      }

      const summary = `${apt.homeTeam} ${resultForm.homeScore} - ${resultForm.awayScore} ${apt.awayTeam}`;

      const resultData = {
        resultSubmitted: true,
        homeScore: Number(resultForm.homeScore),
        awayScore: Number(resultForm.awayScore),
        playerOfMatch: resultForm.playerOfMatch || "",
        notes: resultForm.notes || "",
        resultSummary: summary,
        updatedAt: new Date(),
      };

      // ✅ 1. Update appointment record
      await setDoc(doc(db, "appointments", apt.id), resultData, { merge: true });

      // ✅ 2. Write result under same appointmentId (prevents duplicates)
      await setDoc(doc(db, "results", apt.id), {
        ...apt,
        ...resultData,
        appointmentId: apt.id,
        refereeId: currentRefereeId,
        refereeEmail: currentRefereeEmail,
        createdAt: apt.createdAt || new Date(),
      }, { merge: true });

      toast({
        title: "Result saved ✅",
        description: summary,
      });

      setExpandedResultId(null);
      setResultForm({});
    } catch (e) {
      console.error("Result error:", e);
      toast({
        title: "Error",
        description: "Failed to save result.",
        variant: "destructive",
      });
    }
  }}
>
  💾 Save
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
        <h3 className="text-2xl font-bold mb-4">My Reports</h3>
        {reports.length === 0 ? (
          <p className="text-center text-gray-500">No reports yet.</p>
        ) : (
          <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((r) => (
              <Card
                key={r.id}
                className="p-4 bg-white border rounded-xl shadow hover:shadow-lg cursor-pointer"
                onClick={() => setActiveReportId(r.id)}
              >
                <p className="font-semibold text-gray-900">{r.teams}</p>
                <p className="text-sm text-gray-600">{r.matchDate}</p>
                <p className="text-gray-500 text-sm">📋 {r.type?.toUpperCase()}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {activeReportId && (
        <ReportSubmission appointmentId={activeReportId} onClose={() => setActiveReportId(null)} />
      )}
    </div>
  );
};
