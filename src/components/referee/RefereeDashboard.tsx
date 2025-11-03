// src/pages/referee/RefereeDashboard.tsx
import React, { useEffect, useState } from "react";
import { Card, StatCard } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { db } from "../../lib/firebase";
import { RefereeUnifiedReportCenter } from "./reports/RefereeUnifiedReportCenter";
import { RefereeProfiles } from "../executive/RefereeProfiles";
import { ReportDetailModal } from "./reports/ReportDetailModal";
import {
  Timestamp,
  getDoc,
  updateDoc,
  setDoc,
  getDocs,
  doc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, signOut, updateProfile as updateAuthProfile } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { toast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";

/**
 * Referee Dashboard
 * - View appointments, accept/reject, submit results
 * - Submit reports (card/general) immediately after accepting
 * - View/edit reports in detail
 * - Full audit trail
 * - Stats: Pending, Accepted, Rejected, Reports, Total
 */
export const RefereeDashboard: React.FC = () => {
  // === STATE ===
  const [appointments, setAppointments] = useState<any[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [reports, setReports] = useState<any[]>([]); // Grouped by matchId
  const [loading, setLoading] = useState(true);
  const [activeReportId, setActiveReportId] = useState<string | null>(null); // For edit modal
  const [uploading, setUploading] = useState(false);
  const [viewProfile, setViewProfile] = useState(false);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null); // Result form
  const [resultForm, setResultForm] = useState<any>({});
  const [showReportCenter, setShowReportCenter] = useState<string | null>(null); // appointmentId

  // === AUTH & FIREBASE ===
  const auth = getAuth();
  const user = auth.currentUser;
  const storage = getStorage();
  const currentRefereeId = user?.uid || "";
  const currentRefereeEmail = user?.email || "";
  const profilePhoto = profile?.photoURL || user?.photoURL || "/default-avatar.png";

  // === LOGOUT ===
  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "Logged out successfully." });
      window.location.href = "/";
    } catch {
      toast({ title: "Error", description: "Failed to log out.", variant: "destructive" });
    }
  };

  // === FETCH OR CREATE REFEREE PROFILE ===
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

  // === UPLOAD PROFILE IMAGE ===
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
          if (auth.currentUser)
            await updateAuthProfile(auth.currentUser, { photoURL: downloadURL });
          setProfile((p: any) => ({ ...p, photoURL: downloadURL }));
          toast({ title: "Profile photo updated" });
          setUploading(false);
        }
      );
    } catch {
      setUploading(false);
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    }
  };

  // === TOGGLE AVAILABILITY ===
  const toggleAvailability = async () => {
    if (!profile?.id) return;
    const newStatus = profile.availabilityStatus === "available" ? "unavailable" : "available";
    try {
      await updateDoc(doc(db, "referees", profile.id), {
        availabilityStatus: newStatus,
        updatedAt: new Date(),
      });
      setProfile((prev: any) => ({ ...prev, availabilityStatus: newStatus }));
      toast({ title: `You are now ${newStatus === "available" ? "Available" : "Unavailable"}` });
    } catch (err) {
      console.error("Availability toggle error:", err);
      toast({ title: "Error", description: "Failed to update availability.", variant: "destructive" });
    }
  };

  // === FETCH APPOINTMENTS (Referee + AR) ===
  useEffect(() => {
    if (!currentRefereeEmail) return;

    const qRef = query(collection(db, "appointments"), where("refereeEmail", "==", currentRefereeEmail));
    const qAR = query(collection(db, "appointments"), where("arEmail", "==", currentRefereeEmail));

    let combined: any[] = [];

    const unsubRef = onSnapshot(qRef, (snap) => {
      const refs = snap.docs.map((d) => ({ id: d.id, ...d.data(), _role: "referee" }));
      combined = [...refs, ...combined.filter((a) => a._role !== "referee")];
      setAppointments(deduplicate(combined));
    });

    const unsubAR = onSnapshot(qAR, (snap) => {
      const ars = snap.docs.map((d) => ({ id: d.id, ...d.data(), _role: "ar" }));
      combined = [...ars, ...combined.filter((a) => a._role !== "ar")];
      setAppointments(deduplicate(combined));
    });

    function deduplicate(list: any[]) {
      return list.reduce((acc: any[], curr) => {
        const exists = acc.find((a) => a.id === curr.id);
        if (!exists) acc.push(curr);
        else acc = acc.map((a) => (a.id === curr.id ? curr : a));
        return acc;
      }, []);
    }

    setLoading(false);
    return () => {
      unsubRef();
      unsubAR();
    };
  }, [currentRefereeEmail]);

  // === FETCH REPORTS + GROUP BY MATCH + AUDIT TRAIL ===
  useEffect(() => {
    if (!currentRefereeId) return;
    const q = query(
      collection(db, "reports"),
      where("refereeId", "==", currentRefereeId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const rawReports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const reportsWithAudit = await Promise.all(
        rawReports.map(async (r) => {
          let auditTrail = r.auditTrail || [];
          try {
            const auditSnap = await getDocs(collection(db, "reports", r.id, "auditTrail"));
            auditTrail = auditSnap.docs.map((a) => a.data());
          } catch (e) {
            console.warn("Audit subcollection fetch failed, using root-level:", e);
          }

          const matchDisplay = r.homeTeam && r.awayTeam
            ? `${r.homeTeam} vs ${r.awayTeam}`
            : r.teams || "Unknown Match";

          return {
            id: r.id,
            matchId: r.matchId || r.id,
            type: r.type || "general_report",
            matchDisplay,
            createdAt: r.createdAt?.toDate(),
            reviewed: r.reviewed || false,
            reviewedBy: r.reviewedBy || null,
            reviewedAt: r.reviewedAt?.toDate() || null,
            auditTrail: auditTrail.sort((a: any, b: any) => new Date(a.timestamp) - new Date(b.timestamp)),
          };
        })
      );

      // Group by matchId
      const grouped = reportsWithAudit.reduce((acc: any, r) => {
        const key = r.matchId;
        if (!acc[key]) {
          acc[key] = {
            matchId: key,
            matchDisplay: r.matchDisplay,
            reports: [],
            auditTrail: [],
          };
        }
        acc[key].reports.push({ id: r.id, type: r.type, reviewed: r.reviewed, reviewedBy: r.reviewedBy, reviewedAt: r.reviewedAt });
        acc[key].auditTrail.push(...r.auditTrail);
        return acc;
      }, {});

      const mergedReports = Object.values(grouped).map((g: any) => {
        g.auditTrail = [...new Set(g.auditTrail.map((a: any) => JSON.stringify(a)))].map((s: string) => JSON.parse(s));
        g.auditTrail.sort((a: any, b: any) => new Date(a.timestamp) - new Date(b.timestamp));
        return g;
      });

      setReports(mergedReports);
    });
    return () => unsub();
  }, [currentRefereeId]);

  // === ACCEPT / REJECT APPOINTMENT ===
  const handleResponse = async (id: string, response: "accepted" | "rejected", role: string) => {
    try {
      const aptRef = doc(db, "appointments", id);
      const auditEntry = {
        by: currentRefereeEmail,
        action: response === "accepted" ? "Accepted" : "Rejected",
        details: `Appointment as ${role}`,
        timestamp: new Date().toISOString(),
      };

      await updateDoc(aptRef, {
        [`responses.${role}`]: {
          status: response,
          respondedAt: Timestamp.now(),
        },
        status: response,
        updatedAt: Timestamp.now(),
        auditTrail: arrayUnion(auditEntry),
      });

      toast({ title: "Updated", description: `You have ${response} this appointment.` });
    } catch (error: any) {
      console.error("UPDATE FAILED:", error);
      toast({
        title: "Permission Denied",
        description: error.message || "You cannot update this appointment.",
        variant: "destructive",
      });
    }
  };

  // === COMPUTE STATS ===
  const pending = appointments.filter((a) => a.responses?.[a._role]?.status === "pending" || !a.responses?.[a._role]).length;
  const accepted = appointments.filter((a) => a.responses?.[a._role]?.status === "accepted").length;
  const rejected = appointments.filter((a) => a.responses?.[a._role]?.status === "rejected").length;

  // === PROFILE VIEW ===
  if (viewProfile) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">My Profile</h2>
          <Button variant="outline" onClick={() => setViewProfile(false)}>
            Back
          </Button>
        </div>
        <RefereeProfiles currentRefereeId={currentRefereeId} editable />
      </div>
    );
  }

  // === MAIN RENDER ===
  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-900">Referee Dashboard</h2>
            <button onClick={toggleAvailability} className="flex items-center gap-1 text-sm font-medium cursor-pointer">
              <span className={`inline-block w-3 h-3 rounded-full ${profile?.availabilityStatus === "available" ? "bg-green-500" : "bg-red-500"}`}></span>
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
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>
          <Button variant="outline" onClick={handleLogout} className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white">
            Logout
          </Button>
        </div>
      </div>

      {/* STATS – Now includes Reports count */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard title="Pending" value={pending} icon="Pending" color="amber" />
        <StatCard title="Accepted" value={accepted} icon="Accepted" color="green" />
        <StatCard title="Rejected" value={rejected} icon="Rejected" color="red" />
        <StatCard title="Reports" value={reports.length} icon="FileText" color="blue" />
        <StatCard title="Total" value={accepted + rejected} icon="Trophy" color="emerald" />
      </div>

      {/* APPOINTMENTS */}
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
              const status = apt.responses?.[apt._role]?.status || "pending";
              const yourRole = apt._role === "referee" ? "Referee" : "Assistant Referee";
              const yourName = apt._role === "referee" ? apt.refereeName : apt.arName;
              const matchReport = reports.find((r: any) => r.matchId === apt.id);
              const hasReport = matchReport?.reports?.length > 0;

              return (
                <Card key={`${apt.id}-${apt._role}`} className="p-5 border shadow-sm hover:shadow-md transition">
                  <div className="flex justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{apt.homeTeam} vs {apt.awayTeam}</h3>
                        <Badge variant={status === "accepted" ? "success" : status === "rejected" ? "danger" : "warning"}>
                          {status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-gray-600">{apt.date} • {apt.time} • {apt.venue}</p>
                      <p className="text-sm text-gray-600">{apt.gameType?.toUpperCase()} • {apt.game}</p>
                      <p className="mt-2 text-sm font-medium text-emerald-700">
                        Your Role: {yourRole} ({yourName})
                      </p>

                      {/* Reports Submitted */}
                      {hasReport && (
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {matchReport.reports.map((r: any) => (
                            <Badge key={r.id} variant={r.reviewed ? "success" : "warning"} className="text-xs">
                              {r.type.replace("_", " ")} {r.reviewed ? "Reviewed" : "Pending"}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Audit Trail */}
                      {((apt.auditTrail?.length > 0 || matchReport?.auditTrail?.length > 0)) && (
                        <div className="mt-3 bg-gray-50 border rounded p-2">
                          <p className="font-medium text-sm text-gray-700 mb-1">Audit Trail:</p>
                          <ul className="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                            {[...(apt.auditTrail || []), ...(matchReport?.auditTrail || [])]
                              .sort((a: any, b: any) => new Date(a.timestamp) - new Date(b.timestamp))
                              .map((log: any, i: number) => (
                                <li key={i}>
                                  <span className="font-semibold text-gray-800">{log.by}</span> — {log.action}: {log.details}{" "}
                                  <span className="text-gray-400">
                                    ({new Date(log.timestamp).toLocaleString()})
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}

                      {/* Actions */}
                      {status === "pending" && (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" className="bg-green-600 text-white" onClick={() => handleResponse(apt.id, "accepted", apt._role)}>
                            Accept
                          </Button>
                          <Button size="sm" className="bg-red-500 text-white" onClick={() => handleResponse(apt.id, "rejected", apt._role)}>
                            Decline
                          </Button>
                        </div>
                      )}

                      {status === "accepted" && (
                        <div className="mt-3 flex gap-2 flex-wrap">
                          {/* Report Button – Always visible after accept */}
                          {!hasReport ? (
                            <Button
                              size="sm"
                              className="bg-blue-600 text-white"
                              onClick={() => setShowReportCenter(apt.id)}
                            >
                              Submit Report
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveReportId(matchReport.reports[0].id)}
                            >
                              View Report
                            </Button>
                          )}

                          <Button
                            size="sm"
                            className="bg-emerald-600 text-white"
                            onClick={() => setExpandedResultId(isExpanded ? null : apt.id)}
                          >
                            {apt.resultSubmitted ? "Edit Result" : "Submit Result"}
                          </Button>
                        </div>
                      )}

                      {apt.resultSubmitted && !isExpanded && (
                        <p className="mt-2 text-emerald-700 font-medium">{apt.resultSummary}</p>
                      )}
                    </div>
                  </div>

                  {/* Result Form */}
                  {isExpanded && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 border-t pt-3">
                      <h4 className="font-semibold mb-2">Enter Match Result</h4>
                      <div className="grid sm:grid-cols-2 gap-3 mb-3">
                        <input type="number" placeholder="Home score" className="border rounded px-2 py-1"
                          value={resultForm.homeScore ?? apt.homeScore ?? ""} onChange={(e) => setResultForm({ ...resultForm, homeScore: e.target.value })} />
                        <input type="number" placeholder="Away score" className="border rounded px-2 py-1"
                          value={resultForm.awayScore ?? apt.awayScore ?? ""} onChange={(e) => setResultForm({ ...resultForm, awayScore: e.target.value })} />
                      </div>
                      <input type="text" placeholder="Player of the match" className="border w-full rounded px-2 py-1 mb-2"
                        value={resultForm.playerOfMatch ?? apt.playerOfMatch ?? ""} onChange={(e) => setResultForm({ ...resultForm, playerOfMatch: e.target.value })} />
                      <textarea placeholder="Notes" rows={3} className="border w-full rounded px-2 py-1"
                        value={resultForm.notes ?? apt.notes ?? ""} onChange={(e) => setResultForm({ ...resultForm, notes: e.target.value })} />
                      <div className="flex justify-end gap-2 mt-3">
                        <Button variant="outline" onClick={() => setExpandedResultId(null)}>
                          Cancel
                        </Button>
                        <Button className="bg-blue-600 text-white" onClick={async () => {
                          try {
                            if (!resultForm.homeScore || !resultForm.awayScore) {
                              toast({ title: "Incomplete", description: "Enter both scores.", variant: "destructive" });
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
                              updatedAt: serverTimestamp(),
                            };

                            await setDoc(doc(db, "results", apt.id), {
                              ...apt,
                              ...resultData,
                              appointmentId: apt.id,
                              refereeId: currentRefereeId,
                              refereeEmail: currentRefereeEmail,
                              createdAt: apt.createdAt || serverTimestamp(),
                            }, { merge: true });

                            const aptRef = doc(db, "appointments", apt.id);
                            const auditEntry = {
                              by: currentRefereeEmail,
                              action: "Result Submitted",
                              details: summary,
                              playerOfMatch: resultForm.playerOfMatch || "N/A",
                              timestamp: new Date().toISOString(),
                            };

                            await updateDoc(aptRef, {
                              ...resultData,
                              auditTrail: arrayUnion(auditEntry),
                            });

                            toast({ title: "Result saved", description: summary });
                            setExpandedResultId(null);
                            setResultForm({});
                          } catch (e) {
                            console.error("Result error:", e);
                            toast({ title: "Error", description: "Failed to save result.", variant: "destructive" });
                          }
                        }}>
                          Save
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

      {/* UNIFIED REPORT CENTER MODAL */}
      {showReportCenter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
            <RefereeUnifiedReportCenter
              appointmentId={showReportCenter}
              onClose={() => setShowReportCenter(null)}
              onSuccess={() => {
                toast({ title: "Report Submitted" });
                setShowReportCenter(null);
              }}
            />
          </div>
        </div>
      )}

      {/* MY REPORTS SECTION */}
      <div>
        <h3 className="text-2xl font-bold mb-4">My Reports</h3>
        {reports.length === 0 ? (
          <p className="text-center text-gray-500">No reports yet.</p>
        ) : (
          <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((group: any) => (
              <Card
                key={group.matchId}
                className="p-4 bg-white border rounded-xl shadow hover:shadow-lg cursor-pointer transition"
                onClick={() => setActiveReportId(group.reports[0]?.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-1 flex-wrap">
                    {group.reports.map((r: any) => (
                      <Badge key={r.id} variant={r.reviewed ? "success" : "warning"} className="text-xs">
                        {r.type.replace("_", " ")} {r.reviewed ? "Reviewed" : "Pending"}
                      </Badge>
                    ))}
                  </div>
                  {group.reports.some((r: any) => r.reviewed) && (
                    <span className="text-xs text-gray-500">
                      Reviewed {group.reports.filter((r: any) => r.reviewed).length}/{group.reports.length}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-gray-900">{group.matchDisplay}</p>
                <p className="text-sm text-gray-600">Audit: {group.auditTrail.length} actions</p>
                <p className="text-gray-500 text-sm">{group.reports.length} report{group.reports.length > 1 ? 's' : ''}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* REPORT DETAIL + EDIT MODAL */}
      {activeReportId && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setActiveReportId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ReportDetailModal
              reportId={activeReportId}
              onClose={() => setActiveReportId(null)}
              onSave={() => {
                toast({ title: "Saved", description: "Report updated successfully." });
                setActiveReportId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};