import React, { useEffect, useState, useMemo } from "react";
import { Card, StatCard } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/input";
import { Label } from "../ui/label"; // Added missing import
import { db } from "../../lib/firebase";
import { RefereeUnifiedReportCenter } from "./reports/RefereeUnifiedReportCenter";
import { RefereeProfiles } from "../executive/RefereeProfiles";
import {
  Timestamp, getDoc, updateDoc, setDoc, doc, collection, query, where, 
  onSnapshot, arrayUnion, serverTimestamp, addDoc
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

  // Result Form
  const [resultForm, setResultForm] = useState({
    appointmentId: "",
    homeScore: "",
    awayScore: "",
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
const handleSubmitResult = async (aptId: string) => {
  if (!resultForm.homeScore || !resultForm.awayScore) {
    toast({ variant: "destructive", title: "Missing Scores" });
    return;
  }

  try {
    // 1. Create the Result document (Creates if missing, overwrites if exists)
    const resultRef = doc(db, "match_results", aptId);
    
    await setDoc(resultRef, {
      appointmentId: aptId,
      homeScore: Number(resultForm.homeScore),
      awayScore: Number(resultForm.awayScore),
      finalResult: `${resultForm.homeScore} - ${resultForm.awayScore}`,
      homeSquad: selectedMatchPlayers[`${aptId}_home`] || [],
      awaySquad: selectedMatchPlayers[`${aptId}_away`] || [],
      submittedAt: serverTimestamp(),
      submittedBy: currentRefereeId
    }, { merge: true }); // { merge: true } prevents accidental data loss if you add fields later

    // 2. Mark the appointment as done so the UI updates
    const aptRef = doc(db, "appointments", aptId);
    await updateDoc(aptRef, {
      resultSubmitted: true
    });

    toast({ title: "Success", description: "Match result created and recorded." });
    setResultForm({ appointmentId: "", homeScore: "", awayScore: "", notes: "" });

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
        </div>

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
                      <Button 
                        className="w-full bg-emerald-600 font-bold hover:bg-emerald-700 transition-all"
                        disabled={!canSubmitResult(apt)}
                        onClick={() => handleSubmitResult(apt.id)} // Calls the function with the match ID
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
                        <Button variant="ghost" size="sm" className="text-emerald-700 font-bold underline text-xs">View Card</Button>
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
    </div>
  );
};