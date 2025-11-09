// src/pages/referee/RefereeDashboard.tsx
import React, { useEffect, useState } from "react";
import { Card, StatCard } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/input";
import { db } from "../../lib/firebase";
import { RefereeUnifiedReportCenter } from "./reports/RefereeUnifiedReportCenter";
import { RefereeProfiles } from "../executive/RefereeProfiles";
import {
  Timestamp,
  getDoc,
  updateDoc,
  setDoc,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { getAuth, signOut, updateProfile as updateAuthProfile } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { toast } from "@/components/ui/use-toast";
import {
  Menu, X, LogOut, Camera, CheckCircle, AlertCircle, FileText, Trophy, XCircle,
  CheckCircle2, XCircle as XCircleIcon, Trophy as TrophyIcon, Send, User, Calendar, Clock, MapPin, ChevronDown
} from "lucide-react";
import { LawsOfTheGameWidget } from "@/components/LawsOfTheGameWidget";
import { format } from "date-fns";

export const RefereeDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewProfile, setViewProfile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showReportCenter, setShowReportCenter] = useState<string | null>(null);
  const [expandedTrail, setExpandedTrail] = useState<string | null>(null);

  // Result Form
  const [resultForm, setResultForm] = useState({
    appointmentId: "",
    homeScore: "",
    awayScore: "",
    notes: "",
  });

  const auth = getAuth();
  const user = auth.currentUser;
  const storage = getStorage();
  const currentRefereeId = user?.uid || "";
  const currentRefereeEmail = user?.email || "";
  const currentRefereeName = user?.displayName || `${user?.email?.split("@")[0] || ""}`;

  const updateLastActive = async () => {
    if (!currentRefereeId) return;
    try {
      await updateDoc(doc(db, "referees", currentRefereeId), { lastActive: serverTimestamp() });
    } catch (err) {
      console.error("Failed to update lastActive:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed Out" });
      window.location.href = "/";
    } catch {
      toast({ title: "Error", description: "Logout failed.", variant: "destructive" });
    }
  };

  // Profile
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
          name: currentRefereeName,
          createdAt: new Date(),
          status: "active",
          availabilityStatus: "available",
        };
        await setDoc(refDoc, defaultProfile);
        setProfile(defaultProfile);
      }
    };
    fetchProfile();
  }, [currentRefereeId, currentRefereeEmail, currentRefereeName]);

  // Auto lastActive
  useEffect(() => {
    if (!currentRefereeId) return;
    updateLastActive();
    const interval = setInterval(updateLastActive, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentRefereeId]);

  // Photo upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentRefereeId) return;
    setUploading(true);
    try {
      const fileRef = storageRef(storage, `referees/${currentRefereeId}/profile.jpg`);
      const uploadTask = uploadBytesResumable(fileRef, file);
      uploadTask.on("state_changed", null, () => setUploading(false), async () => {
        const url = await getDownloadURL(fileRef);
        await updateDoc(doc(db, "referees", currentRefereeId), { photoURL: url });
        if (auth.currentUser) await updateAuthProfile(auth.currentUser, { photoURL: url });
        setProfile((p: any) => ({ ...p, photoURL: url }));
        toast({ title: "Photo updated" });
        updateLastActive();
        setUploading(false);
      });
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
    updateLastActive();
  };

  // Appointments
  useEffect(() => {
    if (!currentRefereeName && !currentRefereeEmail) return;

    const queries = [];
    if (currentRefereeName) {
      queries.push(query(collection(db, "appointments"), where("referee", "==", currentRefereeName)));
      queries.push(query(collection(db, "appointments"), where("ar", "==", currentRefereeName)));
    }
    if (currentRefereeEmail) {
      queries.push(query(collection(db, "appointments"), where("refereeEmail", "==", currentRefereeEmail)));
      queries.push(query(collection(db, "appointments"), where("arEmail", "==", currentRefereeEmail)));
    }

    const unsubs: any[] = [];
    let combined: any[] = [];

    queries.forEach((q, index) => {
      const role = index % 2 === 0 ? "referee" : "ar";
      const unsub = onSnapshot(q, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data(), _role: role }));
        combined = [...docs, ...combined.filter(a => a._role !== role)];
        setAppointments(deduplicate(combined));
      });
      unsubs.push(unsub);
    });

    function deduplicate(list: any[]) {
      const seen = new Set();
      return list.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    }

    setLoading(false);
    return () => unsubs.forEach(u => u());
  }, [currentRefereeName, currentRefereeEmail]);

  // Listen to match_results → update appointments with final score
  useEffect(() => {
    const q = query(collection(db, "match_results"));
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type === "added" || change.type === "modified") {
          const data = change.doc.data();
          const aptId = data.appointmentId;
          if (aptId) {
            const scoreEntry = {
              by: data.submittedByName || "Referee",
              action: `Final Score: ${data.homeScore} - ${data.awayScore}`,
              timestamp: data.submittedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            };

            setAppointments(prev => prev.map(apt => {
              if (apt.id === aptId) {
                return {
                  ...apt,
                  finalResult: `${data.homeScore} - ${data.awayScore}`,
                  resultNotes: data.notes || "",
                  auditTrail: [scoreEntry, ...(apt.auditTrail || [])].slice(0, 50),
                };
              }
              return apt;
            }));
          }
        }
      });
    });
    return () => unsub();
  }, []);

  // Accept/Decline
  const handleResponse = async (id: string, response: "accepted" | "rejected", role: string) => {
    try {
      const aptRef = doc(db, "appointments", id);
      const responseObj = { status: response, respondedAt: Timestamp.now() };

      await updateDoc(aptRef, {
        [`responses.${role}`]: responseObj,
        status: response,
        auditTrail: arrayUnion({
          by: currentRefereeEmail || currentRefereeName,
          action: response === "accepted" ? "Accepted" : "Rejected",
          timestamp: new Date().toISOString(),
        }),
      });

      setAppointments(prev => prev.map(apt => 
        apt.id === id 
          ? { ...apt, responses: { ...apt.responses, [role]: responseObj }, status: response }
          : apt
      ));

      toast({ title: response === "accepted" ? "Accepted" : "Declined" });
      updateLastActive();
    } catch (err) {
      console.error("Response failed:", err);
      toast({ title: "Error", description: "Failed to respond.", variant: "destructive" });
    }
  };

  // SUBMIT RESULT
  const handleSubmitResult = async (e: React.FormEvent) => {
    e.preventDefault();
    const { appointmentId, homeScore, awayScore, notes } = resultForm;
    if (!homeScore || !awayScore || !appointmentId) {
      toast({ title: "Error", description: "Please fill in scores.", variant: "destructive" });
      return;
    }

    try {
      const resultData = {
        appointmentId,
        homeScore: parseInt(homeScore),
        awayScore: parseInt(awayScore),
        notes: notes.trim(),
        submittedBy: currentRefereeId,
        submittedByName: currentRefereeName,
        submittedAt: serverTimestamp(),
        status: "pending_review",
      };

      await addDoc(collection(db, "match_results"), resultData);

      const scoreEntry = {
        by: currentRefereeName,
        action: `Final Score: ${homeScore} - ${awayScore}`,
        timestamp: new Date().toISOString(),
      };

      await updateDoc(doc(db, "appointments", appointmentId), {
        resultSubmitted: true,
        resultStatus: "pending_review",
        finalResult: `${homeScore} - ${awayScore}`,
        resultNotes: notes.trim(),
        auditTrail: arrayUnion(scoreEntry),
      });

      // Update local state
      setAppointments(prev => prev.map(apt =>
        apt.id === appointmentId
          ? {
              ...apt,
              resultSubmitted: true,
              finalResult: `${homeScore} - ${awayScore}`,
              resultNotes: notes.trim(),
              auditTrail: [scoreEntry, ...(apt.auditTrail || [])].slice(0, 50),
            }
          : apt
      ));

      setResultForm({ appointmentId: "", homeScore: "", awayScore: "", notes: "" });
      toast({ title: "Result Submitted", description: "Pending review." });
      updateLastActive();
    } catch (err) {
      console.error("Result submission failed:", err);
      toast({ title: "Error", description: "Failed to submit result.", variant: "destructive" });
    }
  };

  const pending = appointments.filter(a => 
    !a.responses?.[a._role]?.status || a.responses[a._role].status === "pending"
  ).length;
  const accepted = appointments.filter(a => a.responses?.[a._role]?.status === "accepted").length;
  const rejected = appointments.filter(a => a.responses?.[a._role]?.status === "rejected").length;

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
                <Button size="sm" variant=".ghost" onClick={handleLogout} className="text-red-600">
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
              <h2 className="text-3xl font-bold">Referee Dashboard</h2>
              <p className="text-gray-600">Full match history with final score</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard title="Pending" value={pending} icon={<AlertCircle className="w-5 h-5" />} color="amber" />
            <StatCard title="Accepted" value={accepted} icon={<CheckCircle className="w-5 h-5" />} color="emerald" />
            <StatCard title="Rejected" value={rejected} icon={<XCircleIcon className="w-5 h-5" />} color="red" />
            <StatCard title="Total" value={appointments.length} icon={<TrophyIcon className="w-5 h-5" />} color="purple" />
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
                  const trail = (apt.auditTrail || []).sort((a: any, b: any) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                  );

                  return (
                    <Card key={apt.id} className="p-4 shadow-sm">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-lg">{apt.homeTeam} vs {apt.awayTeam}</h4>
                            <div className="flex flex-wrap gap-2 text-xs text-gray-600 mt-1">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {apt.date}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {apt.time}</span>
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {apt.venue}</span>
                            </div>
                            <p className="text-xs text-emerald-700 font-medium mt-1">Role: {role}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant={status === "accepted" ? "success" : status === "rejected" ? "danger" : "warning"}>
                              {status.toUpperCase()}
                            </Badge>
                            {apt.finalResult && (
                              <p className="text-lg font-bold text-emerald-600 mt-1">
                                {apt.finalResult}
                              </p>
                            )}
                          </div>
                        </div>

                        {status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 flex items-center justify-center gap-1" onClick={() => handleResponse(apt.id, "accepted", apt._role)}>
                              <CheckCircle2 className="w-4 h-4" /> Accept
                            </Button>
                            <Button size="sm" variant="danger" className="flex-1 flex items-center justify-center gap-1" onClick={() => handleResponse(apt.id, "rejected", apt._role)}>
                              <XCircleIcon className="w-4 h-4" /> Decline
                            </Button>
                          </div>
                        )}

                        {status === "accepted" && (
                          <div className="space-y-3">
                            {/* RESULT FORM */}
                            {!apt.resultSubmitted && (
                              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                <h5 className="font-semibold text-sm mb-2 flex items-center gap-1">
                                  <TrophyIcon className="w-4 h-4" /> Submit Result
                                </h5>
                                <form onSubmit={handleSubmitResult} className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      placeholder={apt.homeTeam}
                                      value={resultForm.appointmentId === apt.id ? resultForm.homeScore : ""}
                                      onChange={(e) => setResultForm({ ...resultForm, appointmentId: apt.id, homeScore: e.target.value })}
                                      required
                                    />
                                    <Input
                                      type="number"
                                      min="0"
                                      placeholder={apt.awayTeam}
                                      value={resultForm.appointmentId === apt.id ? resultForm.awayScore : ""}
                                      onChange={(e) => setResultForm({ ...resultForm, appointmentId: apt.id, awayScore: e.target.value })}
                                      required
                                    />
                                  </div>
                                  <Input
                                    placeholder="Notes (optional)"
                                    value={resultForm.appointmentId === apt.id ? resultForm.notes : ""}
                                    onChange={(e) => setResultForm({ ...resultForm, appointmentId: apt.id, notes: e.target.value })}
                                  />
                                  <Button type="submit" size="sm" className="w-full">
                                    <Send className="w-3 h-3 mr-1" /> Submit Result
                                  </Button>
                                </form>
                              </div>
                            )}

                            {apt.resultSubmitted && !apt.finalResult && (
                              <p className="text-xs text-emerald-600 font-medium">Result submitted (pending)</p>
                            )}

                            {/* REPORT BUTTON */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full flex items-center justify-center gap-1 border-amber-600 text-amber-700"
                              onClick={() => setShowReportCenter(apt.id)}
                            >
                              <FileText className="w-4 h-4" /> Match Report
                            </Button>
                          </div>
                        )}

                        {/* AUDIT TRAIL */}
                        <div className="border-t pt-3">
                          <button
                            onClick={() => setExpandedTrail(expandedTrail === apt.id ? null : apt.id)}
                            className="w-full flex justify-between items-center text-xs font-medium text-gray-600 hover:text-gray-800"
                          >
                            <span className="flex items-center gap-1">
                              <ChevronDown className={`w-3 h-3 transition ${expandedTrail === apt.id ? "rotate-180" : ""}`} />
                              Activity Trail ({trail.length})
                            </span>
                          </button>

                          {expandedTrail === apt.id && (
                            <div className="mt-2 space-y-2 text-xs">
                              {trail.map((entry: any, i: number) => (
                                <div key={i} className="flex items-start gap-2">
                                  <User className="w-3 h-3 mt-0.5 text-gray-400" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-700">{entry.by}</span>
                                      {entry.action.includes("Final Score") && (
                                        <span className="text-emerald-600 font-bold text-sm">
                                          {entry.action.split(": ")[1]}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-gray-500">{entry.action.split(": ")[0]}</p>
                                    <p className="text-gray-400">
                                      {format(new Date(entry.timestamp), "dd MMM yyyy, HH:mm")}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: RefereeUnifiedReportCenter */}
      {showReportCenter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <RefereeUnifiedReportCenter
              appointmentId={showReportCenter}
              onClose={() => setShowReportCenter(null)}
              onSuccess={async () => {
                toast({ title: "Report submitted" });
                setShowReportCenter(null);
                updateLastActive();

                await updateDoc(doc(db, "appointments", showReportCenter), {
                  auditTrail: arrayUnion({
                    by: currentRefereeName,
                    action: "Submitted Match Report",
                    timestamp: new Date().toISOString(),
                  }),
                });
              }}
            />
          </div>
        </div>
      )}

      <LawsOfTheGameWidget />
    </>
  );
};