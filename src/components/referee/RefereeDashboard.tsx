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
import { 
  Menu, X, LogOut, Camera, CheckCircle, AlertCircle, Clock, FileText, Trophy,
  ChevronDown, MessageSquare, Edit3, CheckCircle2 
} from "lucide-react";

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
  const [showReportCenter, setShowReportCenter] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;
  const storage = getStorage();
  const currentRefereeId = user?.uid || "";
  const currentRefereeEmail = user?.email || "";

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed Out" });
      window.location.href = "/";
    } catch {
      toast({ title: "Error", description: "Logout failed.", variant: "destructive" });
    }
  };

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentRefereeId) return;
    setUploading(true);
    try {
      const fileRef = storageRef(storage, `referees/${currentRefereeId}/profile.jpg`);
      const uploadTask = uploadBytesResumable(fileRef, file);
      uploadTask.on(
        "state_changed",
        null,
        () => setUploading(false),
        async () => {
          const url = await getDownloadURL(fileRef);
          await updateDoc(doc(db, "referees", currentRefereeId), { photoURL: url });
          if (auth.currentUser) await updateAuthProfile(auth.currentUser, { photoURL: url });
          setProfile((p: any) => ({ ...p, photoURL: url }));
          toast({ title: "Photo updated" });
          setUploading(false);
        }
      );
    } catch {
      setUploading(false);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const toggleAvailability = async () => {
    if (!profile?.id) return;
    const newStatus = profile.availabilityStatus === "available" ? "unavailable" : "available";
    await updateDoc(doc(db, "referees", profile.id), { availabilityStatus: newStatus });
    setProfile((p: any) => ({ ...p, availabilityStatus: newStatus }));
    toast({ title: `Now ${newStatus}` });
  };

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
    return () => { unsubRef(); unsubAR(); };
  }, [currentRefereeEmail]);

  useEffect(() => {
    if (!currentRefereeId) return;
    const q = query(collection(db, "reports"), where("refereeId", "==", currentRefereeId), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, async (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const grouped = raw.reduce((acc: any, r) => {
        const key = r.matchId || r.id;
        if (!acc[key]) acc[key] = { matchId: key, matchDisplay: `${r.homeTeam} vs ${r.awayTeam}`, reports: [], auditTrail: [] };
        acc[key].reports.push({ id: r.id, type: r.type, reviewed: r.reviewed });
        acc[key].auditTrail.push(...(r.auditTrail || []));
        return acc;
      }, {});
      setReports(Object.values(grouped));
    });
    return () => unsub();
  }, [currentRefereeId]);

  const handleResponse = async (id: string, response: "accepted" | "rejected", role: string) => {
    const aptRef = doc(db, "appointments", id);
    await updateDoc(aptRef, {
      [`responses.${role}`]: { status: response, respondedAt: Timestamp.now() },
      status: response,
      auditTrail: arrayUnion({ by: currentRefereeEmail, action: response === "accepted" ? "Accepted" : "Rejected", timestamp: new Date().toISOString() }),
    });
    toast({ title: response === "accepted" ? "Accepted" : "Declined" });
  };

  const pending = appointments.filter((a) => !a.responses?.[a._role]?.status || a.responses[a._role].status === "pending").length;
  const accepted = appointments.filter((a) => a.responses?.[a._role]?.status === "accepted").length;
  const rejected = appointments.filter((a) => a.responses?.[a._role]?.status === "rejected").length;

  if (viewProfile) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">My Profile</h2>
          <Button variant="outline" size="sm" onClick={() => setViewProfile(false)}>Back</Button>
        </div>
        <RefereeProfiles currentRefereeId={currentRefereeId} editable />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-4 pb-24 sm:pb-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Mobile Header */}
          <div className="sm:hidden bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
                <div>
                  <h2 className="text-xl font-bold">Referee</h2>
                  <button onClick={toggleAvailability} className="flex items-center gap-1 text-xs">
                    <span className={`w-2 h-2 rounded-full ${profile?.availabilityStatus === "available" ? "bg-green-500" : "bg-red-500"}`} />
                    <span className={profile?.availabilityStatus === "available" ? "text-green-700" : "text-red-600"}>
                      {profile?.availabilityStatus === "available" ? "Available" : "Unavailable"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <img
                    src={profile?.photoURL || "/default-avatar.png"}
                    onClick={() => setViewProfile(true)}
                    className={`w-10 h-10 rounded-full border-2 ${uploading ? "animate-pulse opacity-60" : "border-emerald-500"} cursor-pointer`}
                    alt="profile"
                  />
                  <label className="absolute bottom-0 right-0 bg-emerald-600 text-white text-xs p-1 rounded cursor-pointer">
                    <Camera className="w-3 h-3" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
                <Button size="sm" variant="ghost" onClick={handleLogout} className="text-red-600">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {mobileMenuOpen && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <button onClick={() => { setViewProfile(true); setMobileMenuOpen(false); }} className="w-full text-left py-2 text-sm font-medium text-gray-700">
                  My Profile
                </button>
                <button onClick={handleLogout} className="w-full text-left py-2 text-sm font-medium text-red-600">
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Desktop Header */}
          <div className="hidden sm:flex justify-between items-center bg-white p-6 rounded-xl shadow-sm">
            <div>
              <h2 className="text-text-3xl font-bold">Referee Dashboard</h2>
              <p className="text-gray-600">Manage appointments, results & reports</p>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={toggleAvailability} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${profile?.availabilityStatus === "available" ? "bg-green-500" : "bg-red-500"}`} />
                <span className="font-medium">{profile?.availabilityStatus === "available" ? "Available" : "Unavailable"}</span>
              </button>
              <div className="relative">
                <img src={profile?.photoURL || "/default-avatar.png"} className="w-12 h-12 rounded-full border-2 border-emerald-500 cursor-pointer" onClick={() => setViewProfile(true)} />
                <label className="absolute bottom-0 right-0 bg-emerald-600 text-white p-1 rounded cursor-pointer">
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>
              <Button variant="outline" onClick={handleLogout} className="text-red-600 border-red-600">Logout</Button>
            </div>
          </div>

          {/* Stats */}
          <div>
            <Button variant="ghost" size="sm" className="sm:hidden w-full justify-between mb-2" onClick={() => setStatsOpen(!statsOpen)}>
              Stats <ChevronDown className={`w-4 h-4 transition ${statsOpen ? "rotate-180" : ""}`} />
            </Button>
            {(statsOpen || window.innerWidth >= 640) && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard title="Pending" value={pending} icon={<AlertCircle className="w-5 h-5" />} color="amber" />
                <StatCard title="Accepted" value={accepted} icon={<CheckCircle className="w-5 h-5" />} color="emerald" />
                <StatCard title="Rejected" value={rejected} icon={<X className="w-5 h-5" />} color="red" />
                <StatCard title="Reports" value={reports.length} icon={<FileText className="w-5 h-5" />} color="blue" />
                <StatCard title="Total" value={accepted + rejected} icon={<Trophy className="w-5 h-5" />} color="purple" />
              </div>
            )}
          </div>

          {/* Appointments */}
          <div>
            <h3 className="text-xl sm:text-2xl font-bold mb-3">Appointments</h3>
            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : appointments.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No appointments.</p>
            ) : (
              <div className="space-y-4">
                {appointments.map((apt) => {
                  const status = apt.responses?.[apt._role]?.status || "pending";
                  const role = apt._role === "referee" ? "Referee" : "AR";
                  const matchReport = reports.find((r: any) => r.matchId === apt.id);
                  const hasReport = matchReport?.reports?.length > 0;

                  return (
                    <Card key={apt.id} className="p-4 shadow-sm">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-lg">{apt.homeTeam} vs {apt.awayTeam}</h4>
                            <p className="text-sm text-gray-600">{apt.date} • {apt.time} • {apt.venue}</p>
                            <p className="text-xs text-emerald-700 font-medium">Role: {role}</p>
                          </div>
                          <Badge variant={status === "accepted" ? "success" : status === "rejected" ? "danger" : "warning"}>
                            {status.toUpperCase()}
                          </Badge>
                        </div>

                        {hasReport && (
                          <div className="flex gap-1 flex-wrap">
                            {matchReport.reports.map((r: any) => (
                              <Badge key={r.id} variant={r.reviewed ? "success" : "warning"} className="text-xs">
                                {r.type.replace("_", " ")}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1" onClick={() => handleResponse(apt.id, "accepted", apt._role)}>
                              Accept
                            </Button>
                            <Button size="sm" variant="danger" className="flex-1" onClick={() => handleResponse(apt.id, "rejected", apt._role)}>
                              Decline
                            </Button>
                          </div>
                        )}

                        {status === "accepted" && (
                          <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => setShowReportCenter(apt.id)} className="flex-1">
                              <MessageSquare className="w-3 h-3 mr-1" /> Report
                            </Button>
                            <Button size="sm" onClick={() => setExpandedResultId(expandedResultId === apt.id ? null : apt.id)} className="flex-1">
                              <Edit3 className="w-3 h-3 mr-1" /> {apt.resultSubmitted ? "Edit" : "Result"}
                            </Button>
                          </div>
                        )}

                        {apt.resultSubmitted && !expandedResultId && (
                          <p className="text-emerald-700 text-sm font-medium">{apt.resultSummary}</p>
                        )}

                        {(apt.auditTrail?.length > 0 || matchReport?.auditTrail?.length > 0) && (
                          <div>
                            <Button variant="ghost" size="sm" className="w-full justify-between" onClick={() => setExpandedAudit(expandedAudit === apt.id ? null : apt.id)}>
                              Audit Trail ({(apt.auditTrail?.length || 0) + (matchReport?.auditTrail?.length || 0)})
                              <ChevronDown className={`w-4 h-4 transition ${expandedAudit === apt.id ? "rotate-180" : ""}`} />
                            </Button>
                            {expandedAudit === apt.id && (
                              <div className="mt-2 p-3 bg-gray-50 rounded text-xs space-y-1 max-h-32 overflow-y-auto">
                                {[...(apt.auditTrail || []), ...(matchReport?.auditTrail || [])]
                                  .sort((a: any, b: any) => new Date(a.timestamp) - new Date(b.timestamp))
                                  .map((log: any, i: number) => (
                                    <p key={i}><strong>{log.by}</strong>: {log.action} <span className="text-gray-400">({new Date(log.timestamp).toLocaleString()})</span></p>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}

                        {expandedResultId === apt.id && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="overflow-hidden">
                            <div className="space-y-3 mt-3 p-3 bg-gray-50 rounded">
                              <div className="grid grid-cols-2 gap-2">
                                <input type="number" placeholder="Home" className="border rounded px-2 py-1 text-sm" value={resultForm.homeScore ?? ""} onChange={(e) => setResultForm({ ...resultForm, homeScore: e.target.value })} />
                                <input type="number" placeholder="Away" className="border rounded px-2 py-1 text-sm" value={resultForm.awayScore ?? ""} onChange={(e) => setResultForm({ ...resultForm, awayScore: e.target.value })} />
                              </div>
                              <input type="text" placeholder="Player of match" className="w-full border rounded px-2 py-1 text-sm" value={resultForm.playerOfMatch ?? ""} onChange={(e) => setResultForm({ ...resultForm, playerOfMatch: e.target.value })} />
                              <textarea placeholder="Notes" rows={2} className="w-full border rounded px-2 py-1 text-sm" value={resultForm.notes ?? ""} onChange={(e) => setResultForm({ ...resultForm, notes: e.target.value })} />
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setExpandedResultId(null)} className="flex-1">Cancel</Button>
                                <Button size="sm" className="flex-1" onClick={async () => {
                                  if (!resultForm.homeScore || !resultForm.awayScore) return toast({ title: "Enter scores", variant: "destructive" });
                                  const summary = `${apt.homeTeam} ${resultForm.homeScore} - ${resultForm.awayScore} ${apt.awayTeam}`;
                                  await setDoc(doc(db, "results", apt.id), { ...apt, resultSubmitted: true, resultSummary: summary, ...resultForm }, { merge: true });
                                  await updateDoc(doc(db, "appointments", apt.id), { resultSubmitted: true, resultSummary: summary, auditTrail: arrayUnion({ by: currentRefereeEmail, action: "Result", details: summary, timestamp: new Date().toISOString() }) });
                                  toast({ title: "Result saved" });
                                  setExpandedResultId(null);
                                  setResultForm({});
                                }}>Save</Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reports */}
          <div>
            <h3 className="text-xl sm:text-2xl font-bold mb-3">My Reports</h3>
            {reports.length === 0 ? (
              <p className="text-center py-6 text-gray-500">No reports yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {reports.map((group: any) => (
                  <Card key={group.matchId} className="p-4 cursor-pointer hover:shadow-md transition" onClick={() => setActiveReportId(group.reports[0].id)}>
                    <div className="flex justify-between mb-2">
                      <div className="flex gap-1 flex-wrap">
                        {group.reports.map((r: any) => (
                          <Badge key={r.id} variant={r.reviewed ? "success" : "warning"} className="text-xs">
                            {r.type.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <p className="font-medium">{group.matchDisplay}</p>
                    <p className="text-xs text-gray-500 mt-1">{group.auditTrail.length} audit actions</p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-Screen Modals */}
      {showReportCenter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <RefereeUnifiedReportCenter
              appointmentId={showReportCenter}
              onClose={() => setShowReportCenter(null)}
              onSuccess={() => { toast({ title: "Report submitted" }); setShowReportCenter(null); }}
            />
          </div>
        </div>
      )}

      {activeReportId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setActiveReportId(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <ReportDetailModal reportId={activeReportId} onClose={() => setActiveReportId(null)} onSave={() => { toast({ title: "Saved" }); setActiveReportId(null); }} />
          </div>
        </div>
      )}
    </>
  );
};