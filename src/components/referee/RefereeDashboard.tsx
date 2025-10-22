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
import { getAuth } from "firebase/auth";
import { toast } from "@/components/ui/use-toast";

interface Appointment {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  secondTeamGame?: string;
  venue: string;
  status: "pending" | "accepted" | "rejected";
  mainReferee: string;
  firstReserve?: string;
  gameType?: string;
  isSchoolGame?: boolean;
  refereeId?: string;
  refereeEmail?: string;
}

interface Report {
  id: string;
  matchDate: string;
  teams: string;
  venue: string;
  type: string;
  details: string;
  createdAt?: any;
  updatedAt?: any;
}

interface RefereeProfile {
  id: string;
  name: string;
  surname: string;
  gender: string;
  contact: string;
  area: string;
  yearJoined: string;
  status: string;
}

export const RefereeDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [profile, setProfile] = useState<RefereeProfile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeResult, setActiveResult] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<Record<string, any>>({});

  const auth = getAuth();
  const user = auth.currentUser;
  const currentRefereeName = user?.displayName || "";
  const currentRefereeEmail = user?.email || "";
  const currentRefereeId = user?.uid || "";

  // ✅ Fetch referee profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentRefereeEmail) return;
      const refDoc = doc(db, "referees", currentRefereeEmail);
      const snapshot = await getDoc(refDoc);
      if (snapshot.exists()) {
        setProfile({ id: snapshot.id, ...(snapshot.data() as RefereeProfile) });
      }
    };
    fetchProfile();
  }, [currentRefereeEmail]);

  // ✅ Listen for referee appointments
  useEffect(() => {
    if (!currentRefereeId && !currentRefereeEmail) return;

    const refIdQuery = query(
      collection(db, "appointments"),
      where("refereeId", "==", currentRefereeId)
    );

    const unsubId = onSnapshot(refIdQuery, (snapshot) => {
      const idMatches = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Appointment),
      }));

      const refEmailQuery = query(
        collection(db, "appointments"),
        where("refereeEmail", "==", currentRefereeEmail)
      );

      const unsubEmail = onSnapshot(refEmailQuery, (emailSnap) => {
        const emailMatches = emailSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Appointment),
        }));

        const unique = [
          ...new Map(
            [...idMatches, ...emailMatches].map((a) => [a.id, a])
          ).values(),
        ];
        setAppointments(unique);
        setLoading(false);
      });

      return () => unsubEmail();
    });

    return () => unsubId();
  }, [currentRefereeId, currentRefereeEmail]);

  // ✅ Listen for referee reports
  useEffect(() => {
    if (!currentRefereeId) return;
    const q = query(
      collection(db, "reports"),
      where("refereeId", "==", currentRefereeId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Report),
      }));
      setReports(data);
    });

    return () => unsub();
  }, [currentRefereeId]);

  // ✅ Handle Accept / Reject
  const handleResponse = async (id: string, response: "accepted" | "rejected") => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: response } : a))
    );

    try {
      await updateDoc(doc(db, "appointments", id), {
        status: response,
        respondedAt: new Date().toISOString(),
      });
      toast({
        title: "Updated",
        description: `Appointment ${response === "accepted" ? "accepted ✅" : "rejected ❌"}`,
      });
    } catch (err) {
      console.error("Error updating status:", err);
      toast({
        title: "Error",
        description: "Permission denied or failed to update status.",
        variant: "destructive",
      });
    }
  };

  // ✅ Match result input handlers
  const handleResultChange = (id: string, field: string, value: string) => {
    setMatchResults((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  // ✅ Submit Match Result
const handleSubmitResult = async (id: string) => {
  const result = matchResults[id];
  if (!result?.homeScore || !result?.awayScore) {
    toast({
      title: "Incomplete",
      description: "Please enter both scores before submitting.",
      variant: "destructive",
    });
    return;
  }

  const match = appointments.find((a) => a.id === id);
  if (!match) {
    toast({
      title: "Error",
      description: "Match not found in appointments.",
      variant: "destructive",
    });
    return;
  }

  try {
    await addDoc(collection(db, "results"), {
      appointmentId: id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      venue: match.venue,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      notes: result.notes || "",
      refereeId: currentRefereeId,
      referee: currentRefereeName,
      submittedAt: new Date().toISOString(),
    });

    setActiveResult(null);
    toast({
      title: "Success ✅",
      description: "Match result submitted successfully.",
    });
  } catch (err) {
    console.error("Error submitting result:", err);
    toast({
      title: "Error",
      description: "Failed to submit match result.",
      variant: "destructive",
    });
  }
};


  // ✅ Stats
  const pending = appointments.filter((a) => a.status === "pending").length;
  const accepted = appointments.filter((a) => a.status === "accepted").length;
  const rejected = appointments.filter((a) => a.status === "rejected").length;

  return (
    <div className="space-y-10">
     

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Pending" value={pending} icon="⏳" color="amber" />
        <StatCard title="Accepted" value={accepted} icon="✅" color="green" />
        <StatCard title="Rejected" value={rejected} icon="❌" color="red" />
        <StatCard
          title="Career Matches"
          value={accepted + rejected}
          icon="🏆"
          color="emerald"
        />
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

                    {/* Match result form */}
                    {apt.status === "accepted" && (
                      <div className="mt-3 border-t pt-3 space-y-2">
                        {activeResult === apt.id ? (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="number"
                                placeholder={`${apt.homeTeam} Score`}
                                className="border rounded-lg px-3 py-2"
                                value={matchResults[apt.id]?.homeScore || ""}
                                onChange={(e) =>
                                  handleResultChange(
                                    apt.id,
                                    "homeScore",
                                    e.target.value
                                  )
                                }
                              />
                              <input
                                type="number"
                                placeholder={`${apt.awayTeam} Score`}
                                className="border rounded-lg px-3 py-2"
                                value={matchResults[apt.id]?.awayScore || ""}
                                onChange={(e) =>
                                  handleResultChange(
                                    apt.id,
                                    "awayScore",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <textarea
                              placeholder="Notes or comments"
                              className="border rounded-lg w-full px-3 py-2"
                              rows={2}
                              value={matchResults[apt.id]?.notes || ""}
                              onChange={(e) =>
                                handleResultChange(
                                  apt.id,
                                  "notes",
                                  e.target.value
                                )
                              }
                            />

                            <Button
                              className="w-full"
                              onClick={() => handleSubmitResult(apt.id)}
                            >
                              ✅ Submit Result
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveResult(apt.id)}
                          >
                            📝 Submit Match Result
                          </Button>
                        )}

                        {/* Add report button */}
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => setActiveReportId(apt.id)}
                        >
                          📋 View / Edit Report
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Accept / Reject */}
                  {apt.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleResponse(apt.id, "accepted")}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleResponse(apt.id, "rejected")}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 🧾 My Reports */}
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
                {r.updatedAt ? (
                  <p className="text-xs text-gray-500 mt-1">
                    ✏️ Edited: {new Date(r.updatedAt.toDate()).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    🕓 Submitted:{" "}
                    {r.createdAt
                      ? new Date(r.createdAt.toDate()).toLocaleString()
                      : "—"}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 📝 Report Modal */}
      {activeReportId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 overflow-y-auto max-h-[90vh]">
            <ReportSubmission
              reportId={activeReportId}
              onClose={() => setActiveReportId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
