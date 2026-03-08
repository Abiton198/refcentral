import React, { useEffect, useState, useMemo } from "react";
import { Card, StatCard } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Edit2 } from "lucide-react";
import { db } from "../../lib/firebase";
import { RefereeUnifiedReportCenter } from "./reports/RefereeUnifiedReportCenter";
import { RefereeProfiles } from "../executive/RefereeProfiles";
import MatchAppointmentModal from "./MatchAppointmentModal";

import {
  Timestamp, getDoc, updateDoc, setDoc, doc, collection, query, where,
  onSnapshot, arrayUnion, serverTimestamp, addDoc, increment
} from "firebase/firestore";
import { getAuth, signOut, updateProfile as updateAuthProfile } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { toast } from "@/components/ui/use-toast";
import {
  Menu, X, LogOut, Camera, CheckCircle, AlertCircle, FileText, Trophy, XCircle,
  CheckCircle2, Send, User, Calendar, Clock, MapPin, ChevronDown,
  UserPlus, Search, Sparkles, ShieldCheck, ClipboardCheck, Plus
} from "lucide-react";
import { LawsOfTheGameWidget } from "@/components/LawsOfTheGameWidget";
import { PlayerRegistrationModal } from "./PlayerRegistrationModal";
import { motion } from "framer-motion";

export const RefereeDashboard: React.FC = () => {
  const auth = getAuth();
  const user = auth.currentUser;
  const currentRefereeName = user?.displayName || "Referee";
  const currentRefereeId = user?.uid || "";

  // Core States
  const [appointments, setAppointments] = useState<any[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlayerReg, setShowPlayerReg] = useState(false);
  const [expandedTrail, setExpandedTrail] = useState<string | null>(null);
  const [showReportCenter, setShowReportCenter] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewProfile, setViewProfile] = useState(false);

  // Match Logic States
  const [selectedMatchPlayers, setSelectedMatchPlayers] = useState<{ [key: string]: any[] }>({});
  const [activeSelectionTeam, setActiveSelectionTeam] = useState<{ id: string, side: 'home' | 'away', teamName: string } | null>(null);
  const [teamDatabase, setTeamDatabase] = useState<any[]>([]);
  const [availabilityModal, setAvailabilityModal] = useState(false);
  const [viewingResult, setViewingResult] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isLoadingCard, setIsLoadingCard] = useState(false);
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [pendingAppointment, setPendingAppointment] = useState<any | null>(null);

  // Result Form
  const [resultForm, setResultForm] = useState({
    appointmentId: "",
    refereeName: "",
    homeScore: "",
    awayScore: "",
    homeTries: "",
    awayTries: "",
    venue: "",
    notes: "",
  });

  // 1. SAFE DATA FETCHING
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "players"), (snap) => {
      setTeamDatabase(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    if (user?.email) {
      const q = query(collection(db, "appointments"), where("refereeEmail", "==", user.email));
      const unsubApt = onSnapshot(q, (snap) => {
        setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
      return () => { unsub(); unsubApt(); };
    }
    return () => unsub();
  }, [user]);

  // 2. HELPERS (Null Safe)
  const canSubmitResult = (apt: any) => {
    if (!apt) return false;
    const homePlayers = selectedMatchPlayers[`${apt.id}_home`]?.length || 0;
    const awayPlayers = selectedMatchPlayers[`${apt.id}_away`]?.length || 0;
    return homePlayers > 0 && awayPlayers > 0;
  };



  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "appointments"),
      where("refereeId", "==", auth.currentUser.uid)
      // Note: We handle the 'pending' check in the snapshot logic 
      // because Firestore 'empty map' queries can be tricky.
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pending = snapshot.docs.find(doc => {
        const data = doc.data();
        // Logic: If there is no entry in the 'responses' map for this referee, it's new!
        return !data.responses || Object.keys(data.responses).length === 0;
      });

      if (pending) {
        setPendingAppointment({ id: pending.id, ...pending.data() });
      } else {
        setPendingAppointment(null);
      }
    });

    return () => unsubscribe();
  }, [auth.currentUser]);


  const handleAccept = async (aptId: string) => {
    const aptRef = doc(db, "appointments", aptId);
    const refereeId = auth.currentUser?.uid;

    if (!refereeId) return;



    await updateDoc(aptRef, {
      // Add to the responses map so the modal knows it's dealt with
      [`responses.${refereeId}`]: "accepted",
      // Keep your audit trail consistent with the admin's format
      auditTrail: arrayUnion({
        action: "accepted",
        by: auth.currentUser?.email || "Referee",
        details: "Referee accepted the appointment",
        timestamp: Timestamp.now()
      }),
      updatedAt: serverTimestamp()
    });
    setPendingAppointment(null);
  };

  const handleReject = async (id: string, reason: string) => {
    const aptRef = doc(db, "appointments", id);
    const timestamp = new Date().toISOString();

    await updateDoc(aptRef, {
      [`responses.${auth.currentUser?.uid}`]: "rejected",
      rejectionReason: reason, // Store the reason you requested
      auditTrail: arrayUnion({
        action: "rejected",
        by: auth.currentUser?.email || "Referee",
        details: `Referee rejected: ${reason}`,
        timestamp: timestamp
      }),
      updatedAt: serverTimestamp()
    });
    setPendingAppointment(null);
  };

  // 
  const handlePlayerToggle = (matchKey: string, player: any) => {
    setSelectedMatchPlayers(prev => {
      const current = prev[matchKey] || [];
      const exists = current.find(p => p.id === player.id);
      if (exists) {
        return { ...prev, [matchKey]: current.filter(p => p.id !== player.id) };
      }
      return { ...prev, [matchKey]: [...current, player] };
    });
  };

  // 3. RESULT SUBMISSION HANDLER

  const handleSubmitResult = async (apt: any) => {
    const aptId = apt.id; // Get the ID from the object
    if (!resultForm.homeScore || !resultForm.awayScore) {
      toast({ variant: "destructive", title: "Missing Scores" });
      return;
    }

    if (!apt || !apt.id) {
      console.error("Submission failed: Match ID is missing.");
      alert("Error: Match data is incomplete.");
      return;
    }


    try {
      // 1. Create the Result document (Creates if missing, overwrites if exists)
      const resultRef = doc(db, "match_results", aptId);
      const refereeDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const refereeName = refereeDoc.exists() ? `${refereeDoc.data().firstName} ${refereeDoc.data().lastName}` : "Unknown Referee";

      await setDoc(resultRef, {
        appointmentId: aptId,
        refereeName: refereeName,
        homeScore: Number(resultForm.homeScore),
        awayScore: Number(resultForm.awayScore),
        homeTries: Number(resultForm.homeTries),
        awayTries: Number(resultForm.awayTries),
        finalResult: `${resultForm.homeScore} - ${resultForm.awayScore}`,
        homeSquad: selectedMatchPlayers[`${aptId}_home`] || [],
        awaySquad: selectedMatchPlayers[`${aptId}_away`] || [],
        venue: apt.venue,
        submittedAt: serverTimestamp(),
        submittedBy: currentRefereeId,
        editCount: 0,
        isEdited: false
      }, { merge: true }); // { merge: true } prevents accidental data loss if you add fields later

      // 2. Mark the appointment as done so the UI updates
      const aptRef = doc(db, "appointments", aptId);
      await updateDoc(aptRef, {
        resultSubmitted: true
      });

      toast({ title: "Success", description: "Match result created and recorded." });
      setResultForm({ appointmentId: "", refereeName: "", homeScore: "", awayScore: "", homeTries: "", awayTries: "", venue: "", notes: "" });

    } catch (error) {
      console.error("Submission error:", error);
      toast({ variant: "destructive", title: "Write Failed" });
    }
  };


  // Logout Handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Use navigate if you have react-router-dom, otherwise window.location
      window.location.href = "/";
      toast({
        title: "Logged out successfully",
        description: "Redirecting to home page...",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: "Please try again.",
      });
    }
  };

  // REFEREE AVAILIBILITY TOGGLE HANDLER

  // 1. Fetch Profile and Status in real-time
  useEffect(() => {
    if (!user?.uid) return;
    const unsubProfile = onSnapshot(doc(db, "referees", user.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data());
      }
    });
    return () => unsubProfile();
  }, [user]);

  // 2. Toggle Function
  const handleToggleAvailability = async () => {
    if (!profile || !user?.uid) return;

    // If turning ON, show the confirmation modal
    if (profile.availabilityStatus !== "Available") {
      setAvailabilityModal(true);
    } else {
      // If turning OFF, just do it
      updateStatus("Unavailable");
    }
  };

  const updateStatus = async (newStatus: "Available" | "Unavailable") => {
    try {
      const refDoc = doc(db, "referees", user!.uid);
      const userDoc = doc(db, "users", user!.uid);

      const updateData = {
        availabilityStatus: newStatus,
        updatedAt: serverTimestamp()
      };

      await updateDoc(refDoc, updateData);
      await updateDoc(userDoc, updateData);

      setAvailabilityModal(false);
      toast({
        title: `Status: ${newStatus}`,
        description: `You are now listed as ${newStatus.toLowerCase()}.`
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Update Failed" });
    }
  };

  // VIEW RESULT
  const handleViewCard = async (appointmentId: string) => {
    setIsLoadingCard(true);
    try {
      const docRef = doc(db, "match_results", appointmentId);
      const docSnap = await getDoc(docRef);

      console.log(docSnap.data());
      if (docSnap.exists()) {
        setViewingResult(docSnap.data());
      } else {
        alert("Match card not found.");
      }
    } catch (error) {
      console.error("Error fetching match card:", error);
    } finally {
      setIsLoadingCard(false);
    }
  };

  // Close View Result Modal
  const closeViewModal = () => {
    setIsViewModalOpen(false);
    setViewingResult(null);
  };

  // EDIT RESULT
  const canEditResult = (result: any) => {
    if (!result || !result.submittedAt) return false;

    const now = new Date().getTime();
    const submissionTime = result.submittedAt.toMillis();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    // Rule: Current time is within 24h AND editCount is less than 1
    const isWithinWindow = (now - submissionTime) < twentyFourHours;
    const hasNotBeenEdited = (result.editCount || 0) < 1;

    return isWithinWindow && hasNotBeenEdited;
  };

  // UPDATE RESULT
  const handleUpdateResult = async (appointmentId: string, updatedData: any) => {
    try {
      const resultRef = doc(db, "match_results", appointmentId);

      // FETCH current data to preserve it as the "Original"
      const currentSnap = await getDoc(resultRef);
      const oldData = currentSnap.data();

      await updateDoc(resultRef, {
        homeScore: updatedData.homeScore,
        awayScore: updatedData.awayScore,
        homeTries: updatedData.homeTries,
        awayTries: updatedData.awayTries,
        editCount: increment(1),
        isEdited: true,
        lastEditedAt: serverTimestamp(),
        // Store the previous values for the Executive audit trail
        originalEntry: {
          homeScore: oldData?.homeScore,
          awayScore: oldData?.awayScore,
          homeTries: oldData?.homeTries,
          awayTries: oldData?.awayTries,
          submittedAt: oldData?.submittedAt
        }
      });
      alert("Result Updated.");
    } catch (e) { console.error(e); }
  };

  const handleFinalSubmission = async (appointmentId: string) => {
    // 1. Convert strings to numbers
    const hScore = Number(editingMatch.homeScore);
    const aScore = Number(editingMatch.awayScore);
    const hTries = Number(editingMatch.homeTries || 0);
    const aTries = Number(editingMatch.awayTries || 0);

    // 2. Validate Data (Check if conversion resulted in NaN or negative)
    if (isNaN(hScore) || isNaN(aScore) || hScore < 0 || aScore < 0) {
      alert("Please enter valid positive numbers for scores.");
      return;
    }

    // 3. Update the editingMatch state with the clean numbers
    const cleanedMatch = {
      ...editingMatch,
      homeScore: hScore,
      awayScore: aScore,
      homeTries: hTries,
      awayTries: aTries
    };

    // 4. Call the existing update logic with cleaned data
    await handleUpdateResult(appointmentId, cleanedMatch);

    // 5. Close the edit modal
    setShowEditForm(false);
  };

  const handleInitiateEdit = (matchData: any) => {
    // We check the 24-hour rule one last time before opening the form
    const now = new Date().getTime();
    const submissionTime = matchData.submittedAt?.toMillis() || 0;
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if ((now - submissionTime) > twentyFourHours) {
      alert("This card is now locked (24 hours have passed).");
      return;
    }

    // Clone the current result into the edit state
    setEditingMatch({ ...matchData });
    setShowEditForm(true);

    // Close the view modal so the edit form can show
    setViewingResult(null);
  };

  // 3. UI RENDER (With Loading Guard)
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">

      {/* SPARKLY TOP BAR */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-600 p-6 text-white shadow-lg relative overflow-hidden">
        <div className="max-w-5xl mx-auto flex justify-between items-center relative z-10">
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" /> REFCENTRAL ELITE
            </h1>
            <p className="text-emerald-100 text-xs font-medium">Ref: {currentRefereeName}</p>
          </div>
          <Button
            onClick={() => setShowPlayerReg(true)}
            className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-md"
          >
            <UserPlus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Register Player</span>
          </Button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 -mt-4">

        {/* STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-blue-500">
            <p className="text-gray-500 text-[10px] font-bold uppercase">Matches</p>
            <p className="text-xl font-black">{appointments.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border-b-4 border-emerald-500">
            <p className="text-gray-500 text-[10px] font-bold uppercase">Status</p>
            <p className="text-xl font-black text-emerald-600 uppercase">Live</p>
          </div>

          {/* AVAILABILITY TOGGLE */}
          <div
            onClick={handleToggleAvailability}
            className="bg-white p-4 rounded-2xl shadow-sm border-b-4 cursor-pointer transition-all active:scale-95 border-emerald-500"
          >
            <p className="text-gray-500 text-[10px] font-bold uppercase">Availability</p>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full animate-pulse ${profile?.availabilityStatus === 'Available' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <p className={`text-xl font-black ${profile?.availabilityStatus === 'Available' ? 'text-emerald-600' : 'text-red-600'} uppercase`}>
                {profile?.availabilityStatus || "Offline"}
              </p>
            </div>
          </div>
        </div>

        {/* MATCH APPOINTMENT MODAL */}
        <MatchAppointmentModal
          appointment={pendingAppointment}
          onAccept={handleAccept}
          onReject={handleReject}
        />


        {/* AVAILABILITY CONFIRMATION MODAL */}
        {availabilityModal && (
          <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Go Active?</h3>
              <p className="text-gray-500 text-sm mb-8">
                This will signal to the Executive Board that you are ready for match appointments today.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  className="bg-emerald-600 h-14 rounded-2xl font-bold text-lg"
                  onClick={() => updateStatus("Available")}
                >
                  YES, I'M AVAILABLE
                </Button>
                <Button
                  variant="ghost"
                  className="text-gray-400 font-bold"
                  onClick={() => setAvailabilityModal(false)}
                >
                  NOT YET
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        <div className="space-y-6">
          {appointments.map((apt) => (
            <Card key={apt.id} className="overflow-hidden border-none shadow-xl rounded-3xl bg-white">
              <div className="bg-gray-900 p-5 text-white flex justify-between items-center">
                <div>
                  <h4 className="text-lg font-black uppercase tracking-tight">
                    {apt?.homeTeam || "Team A"} <span className="text-emerald-400">vs</span> {apt?.awayTeam || "Team B"}
                  </h4>
                  <p className="text-[10px] font-medium text-gray-400">
                    {apt?.venue} • {apt?.date}
                  </p>
                </div>
                {apt?.finalResult && <div className="text-xl font-black text-emerald-400">{apt.finalResult}</div>}
              </div>

              <div className="p-6">
                {!apt?.resultSubmitted ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Step 1: Verify Squads</p>
                      {['home', 'away'].map((side) => {
                        const teamName = side === 'home' ? apt?.homeTeam : apt?.awayTeam;
                        const key = `${apt.id}_${side}`;
                        const count = selectedMatchPlayers[key]?.length || 0;
                        return (
                          <div key={side} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${side === 'home' ? 'bg-blue-600' : 'bg-red-600'}`}>
                                {teamName?.[0] || "?"}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-gray-800">{teamName}</p>
                                <p className="text-[9px] text-gray-500">{count} Players</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-emerald-600"
                              onClick={() => setActiveSelectionTeam({ id: apt.id, side: side as any, teamName })}
                            >
                              {count > 0 ? "Edit" : "Select"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Step 2: Score */}
                    <div className={`p-5 rounded-3xl ${canSubmitResult(apt) ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-gray-50 opacity-40'}`}>
                      <p className="text-[10px] font-black text-emerald-700 uppercase mb-4">Step 2: Score</p>
                      <div className="flex items-center gap-4 justify-center mb-4">
                        <Input
                          type="number" className="w-16 h-12 text-center text-xl font-black rounded-xl"
                          disabled={!canSubmitResult(apt)}
                          value={resultForm.appointmentId === apt.id ? resultForm.homeScore : ""}
                          onChange={(e) => setResultForm({ ...resultForm, appointmentId: apt.id, homeScore: e.target.value })}
                        />
                        <div className="font-bold text-emerald-300">VS</div>
                        <Input
                          type="number" className="w-16 h-12 text-center text-xl font-black rounded-xl"
                          disabled={!canSubmitResult(apt)}
                          value={resultForm.appointmentId === apt.id ? resultForm.awayScore : ""}
                          onChange={(e) => setResultForm({ ...resultForm, appointmentId: apt.id, awayScore: e.target.value })}
                        />
                      </div>


                      {/* TRIES INPUTS */}
                      <div className="flex items-center gap-4 justify-center mb-6 bg-white/50 p-3 rounded-2xl border border-emerald-100">
                        <div className="flex flex-col items-center">
                          <Label className="text-[8px] uppercase font-black text-emerald-600">Home Tries</Label>
                          <Input
                            type="number" className="w-12 h-10 text-center font-bold rounded-lg mt-1 border-emerald-200"
                            placeholder="0"
                            onChange={(e) => setResultForm({ ...resultForm, homeTries: e.target.value })}
                          />
                        </div>
                        <div className="w-px h-8 bg-emerald-200" />
                        <div className="flex flex-col items-center">
                          <Label className="text-[8px] uppercase font-black text-emerald-600">Away Tries</Label>
                          <Input
                            type="number" className="w-12 h-10 text-center font-bold rounded-lg mt-1 border-emerald-200"
                            placeholder="0"
                            onChange={(e) => setResultForm({ ...resultForm, awayTries: e.target.value })}
                          />
                        </div>
                      </div>

                      <Button
                        className="w-full bg-emerald-600 font-bold hover:bg-emerald-700 transition-all"
                        disabled={!canSubmitResult(apt)}
                        onClick={() => handleSubmitResult(apt)} // Calls the function with the match ID
                      >
                        SUBMIT RESULT
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="text-emerald-600 w-5 h-5" />
                      <p className="font-bold text-emerald-900 text-xs">Result Recorded</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isLoadingCard}
                      className="text-emerald-700 font-bold underline text-xs"
                      onClick={() => handleViewCard(apt.id)}
                    >
                      {isLoadingCard ? "Loading..." : "View Card"}
                    </Button>

                    <Button
                      className="w-1/5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl h-8 font-sm"
                      onClick={() => {
                        // Pass the data we just viewed into the edit state
                        setEditingMatch(viewingResult);
                        setShowEditForm(true);
                        setViewingResult(null); // Close the view modal
                      }}
                    >
                      EDIT
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </main>

      {/* FIXED BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 z-[100] flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col items-center gap-1 text-emerald-600">
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Matches</span>
        </div>

        <button
          onClick={() => setShowPlayerReg(true)}
          className="bg-emerald-600 text-white p-4 rounded-2xl -mt-10 shadow-lg shadow-emerald-200 border-4 border-[#f8fafc]"
        >
          <Plus className="w-6 h-6" />
        </button>

        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-red-500 hover:text-red-700 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Logout</span>
        </button>
      </div>

      {/* MATCH PLAYER SELECTION */}
      {activeSelectionTeam && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-end justify-center">
          <div className="bg-white w-full max-w-lg h-[80vh] rounded-t-[2.5rem] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
              <h3 className="font-black uppercase">{activeSelectionTeam.teamName}</h3>
              <Button variant="ghost" className="text-white" onClick={() => setActiveSelectionTeam(null)}><X /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {teamDatabase.filter(p => p.teamName === activeSelectionTeam.teamName).map(player => {
                const key = `${activeSelectionTeam.id}_${activeSelectionTeam.side}`;
                const isSelected = selectedMatchPlayers[key]?.some(p => p.id === player.id);
                return (
                  <div
                    key={player.id}
                    onClick={() => handlePlayerToggle(key, player)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${isSelected ? 'bg-emerald-50 border-emerald-500' : 'bg-gray-50 border-transparent'}`}
                  >
                    <span className="font-bold text-sm">{player.firstName} {player.lastName}</span>
                    <CheckCircle2 className={`w-5 h-5 ${isSelected ? 'text-emerald-600' : 'text-gray-200'}`} />
                  </div>
                )
              })}
            </div>
            <div className="p-6">
              <Button className="w-full bg-emerald-600 h-12 rounded-xl font-bold" onClick={() => setActiveSelectionTeam(null)}>Confirm Selection</Button>
            </div>
          </div>
        </div>
      )}

      {/* PLAYER REG MODAL */}
      {showPlayerReg && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <PlayerRegistrationModal onClose={() => setShowPlayerReg(false)} />
        </div>
      )}

      {viewingResult?.isEdited && (
        <div className="flex justify-center mb-4">
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] font-black uppercase">
            Revised Result • Edited {viewingResult.lastEditedAt?.toDate().toLocaleDateString()}
          </Badge>
        </div>
      )}

      {showEditForm && editingMatch && (
        <div className="fixed inset-0 z-[1001] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border-4 border-amber-400">
            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-slate-900 italic uppercase">Edit Match Card</h2>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-1">
                ⚠️ Final attempt: This will lock the result forever.
              </p>
            </div>

            <div className="space-y-6">
              {/* Home Team Inputs */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-3">Home: {editingMatch.homeSquad?.[0]?.teamName}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[8px] font-bold uppercase ml-1">Points</Label>
                    <Input
                      type="number" value={editingMatch.homeScore}
                      className="h-12 font-black text-lg text-center rounded-xl"
                      onChange={(e) => setEditingMatch({ ...editingMatch, homeScore: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-[8px] font-bold uppercase ml-1">Tries</Label>
                    <Input
                      type="number" value={editingMatch.homeTries}
                      className="h-12 font-black text-lg text-center rounded-xl border-amber-200"
                      onChange={(e) => setEditingMatch({ ...editingMatch, homeTries: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Away Team Inputs */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-3 text-right">Away: {editingMatch.awaySquad?.[0]?.teamName}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[8px] font-bold uppercase ml-1 text-right">Points</Label>
                    <Input
                      type="number" value={editingMatch.awayScore}
                      className="h-12 font-black text-lg text-center rounded-xl"
                      onChange={(e) => setEditingMatch({ ...editingMatch, awayScore: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-[8px] font-bold uppercase ml-1">Tries</Label>
                    <Input
                      type="number" value={editingMatch.awayTries}
                      className="h-12 font-black text-lg text-center rounded-xl border-amber-200"
                      onChange={(e) => setEditingMatch({ ...editingMatch, awayTries: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <Button
                variant="ghost" className="flex-1 font-bold text-slate-400"
                onClick={() => setShowEditForm(false)}
              >
                DISCARD
              </Button>
              <Button
                className="flex-1 bg-slate-900 text-white font-black rounded-2xl h-14 shadow-xl"
                onClick={() => handleFinalSubmission(editingMatch.appointmentId)}
              >
                CONFIRM & LOCK
              </Button>
            </div>
          </div>
        </div>
      )}

      {viewingResult && (
        <div className="fixed inset-0 z-[999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in duration-200">

            {/* Header: Scoreline */}
            <div className="bg-slate-900 p-8 text-white">
              <div className="flex justify-between items-center mb-6">
                <Badge className="bg-emerald-500 text-white border-none">OFFICIAL RESULT</Badge>
                <p className="text-[10px] font-mono opacity-60 uppercase tracking-widest">
                  Referee: {viewingResult?.refereeName || "Verified"}
                </p>
              </div>

              <div className="flex items-center justify-between text-center">
                {/* Home Team Column */}
                <div className="flex-1">
                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-300">
                    {viewingResult.homeSquad?.[0]?.teamName || "Home"}
                  </h3>
                  <div className="mt-2">
                    <p className="text-6xl font-black text-emerald-400 leading-none">
                      {viewingResult.homeScore}
                    </p>
                    <p className="text-sm font-bold text-emerald-400/60 mt-2 italic">
                      ({viewingResult.homeTries || 0} Tries)
                    </p>
                  </div>
                </div>

                {/* Center Divider */}
                <div className="px-4 flex flex-col items-center">
                  <div className="text-2xl font-black text-slate-700 italic">VS</div>
                  <div className="w-px h-12 bg-slate-800 my-2"></div>
                </div>

                {/* Away Team Column */}
                <div className="flex-1">
                  <h3 className="text-xl font-black uppercase tracking-tight text-slate-300">
                    {viewingResult.awaySquad?.[0]?.teamName || "Away"}
                  </h3>
                  <div className="mt-2">
                    <p className="text-6xl font-black text-white leading-none">
                      {viewingResult.awayScore}
                    </p>
                    <p className="text-sm font-bold text-white/40 mt-2 italic">
                      ({viewingResult.awayTries || 0} Tries)
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* Content: Squads & Details */}
            <div className="p-8">
              <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Home Squad List */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-3 border-b pb-1">Home Squad</p>
                  <div className="space-y-2">
                    {viewingResult.homeSquad?.map((player: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[11px] border-b border-slate-50 pb-1">
                        <span className="font-bold text-slate-700">{player.firstName} {player.lastName}</span>
                        <span className="text-slate-400 font-medium italic">{player.position?.split('(')[1]?.replace(')', '') || idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Away Squad List */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-3 border-b pb-1 text-right">Away Squad</p>
                  <div className="space-y-2">
                    {viewingResult.awaySquad?.map((player: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[11px] border-b border-slate-50 pb-1">
                        <span className="text-slate-400 font-medium italic">{player.position?.split('(')[1]?.replace(')', '') || idx + 1}</span>
                        <span className="font-bold text-slate-700 text-right">{player.firstName} {player.lastName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Referee Footer */}
              <div className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center border border-slate-100">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase">Venue</p>
                  <p className="text-sm font-black text-slate-800">{viewingResult.venue}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Submission Date</p>
                  <p className="text-sm font-bold text-slate-600">
                    {viewingResult.submittedAt?.toDate().toLocaleDateString('en-ZA')}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl font-bold border-2"
                  onClick={() => window.print()}
                >
                  Export PDF
                </Button>
                {/* Inside the Result Card Modal Footer */}
                <div className="mt-8 flex flex-col gap-3">
                  {canEditResult(viewingResult) ? (
                    <Button
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl h-12 flex items-center justify-center gap-2"
                      onClick={() => handleInitiateEdit(viewingResult)}
                    >
                      <Edit2 size={16} /> EDIT(Once)
                    </Button>
                  ) : (
                    <div className="bg-slate-100 p-3 rounded-xl text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase">
                        {viewingResult?.editCount >= 1 ? "⚠️ Edit Limit Reached" : "🔒 Result Locked (24h Passed)"}
                      </p>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    className="w-full text-slate-500 font-bold"
                    onClick={() => setViewingResult(null)}
                  >
                    CLOSE
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};