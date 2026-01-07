import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; 
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { UserPlus, ShieldCheck, CheckCircle2, AlertTriangle, User } from "lucide-react";
import { format } from "date-fns";

const RUGBY_POSITIONS = [
  "Loosehead Prop (1)", "Hooker (2)", "Tighthead Prop (3)", "Left Lock (4)", "Right Lock (5)",
  "Blindside Flanker (6)", "Openside Flanker (7)", "Number 8 (8)", "Scrum-half (9)", "Fly-half (10)",
  "Left Wing (11)", "Inside Centre (12)", "Outside Centre (13)", "Right Wing (14)", "Full-back (15)",
  "Substitute (16-23)"
];

export const PlayerRegistrationModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredPlayerId, setRegisteredPlayerId] = useState<string | null>(null);
  const [liveSuggestion, setLiveSuggestion] = useState<any | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    position: "",
    teamId: "",
  });

  // 1. Fetch Teams
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "teams"), (snap) => {
      setAllTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // 2. LIVE DUPLICATE CHECK
  useEffect(() => {
    const checkDuplicate = async () => {
      if (formData.firstName.trim().length > 2 && formData.lastName.trim().length > 2) {
        const q = query(collection(db, "players"), 
          where("firstName", "==", formData.firstName.trim()), 
          where("lastName", "==", formData.lastName.trim()));
        const snap = await getDocs(q);
        setLiveSuggestion(!snap.empty ? snap.docs[0].data() : null);
      } else {
        setLiveSuggestion(null);
      }
    };
    const timer = setTimeout(checkDuplicate, 400);
    return () => clearTimeout(timer);
  }, [formData.firstName, formData.lastName]);

  const leagues = useMemo(() => {
    const uniqueLeagues = new Set<string>();
    allTeams.forEach(t => t.league && uniqueLeagues.add(t.league));
    return Array.from(uniqueLeagues).sort();
  }, [allTeams]);

  const filteredTeams = useMemo(() => {
    if (selectedLeague === "all") return allTeams;
    return allTeams.filter(t => t.league === selectedLeague);
  }, [allTeams, selectedLeague]);

  // 3. ID GENERATION LOGIC
  const generatePlayerId = async (teamName: string, teamId: string) => {
    const prefix = teamName.substring(0, 3).toUpperCase();
    const startNumber = 10000;

    try {
      const q = query(
        collection(db, "players"), 
        where("teamId", "==", teamId), 
        orderBy("regNumber", "desc"), 
        limit(1)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const lastNum = Number(snap.docs[0].data().regNumber);
        const nextNum = isNaN(lastNum) ? startNumber + 1 : lastNum + 1;
        return { fullId: `${prefix}${nextNum}`, regNumber: nextNum };
      }
    } catch (e) {
      console.error("Index Error:", e);
    }
    return { fullId: `${prefix}${startNumber + 1}`, regNumber: startNumber + 1 };
  };


 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // 1. Basic Validation
  if (!formData.teamId || isSubmitting || !!liveSuggestion) {
    if (!!liveSuggestion) toast({ title: "Duplicate Found", description: "Cannot register an existing player.", variant: "destructive" });
    return;
  }

  setIsSubmitting(true);
  
  // 2. Timeout safety (In case of missing Firestore Index)
  const timeoutId = setTimeout(() => {
    setIsSubmitting(false);
    toast({ 
      title: "Connection Timeout", 
      description: "Database is slow to respond. Check your browser console for a Firestore Index link.", 
      variant: "destructive" 
    });
  }, 10000);

  try {
    const team = allTeams.find(t => t.id === formData.teamId);
    
    // 3. Generate the unique Player ID
    const { fullId, regNumber } = await generatePlayerId(team?.name || "PLA", formData.teamId);

    // 4. Build the final data object exactly how the Rules expect it
    const finalPlayerData = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      dob: formData.dob || null,
      position: formData.position,
      teamId: formData.teamId,
      teamName: team?.name || "Unknown",
      displayId: fullId,
      regNumber: Number(regNumber),
      
      // CRITICAL: This matches your Security Rules requirement
      registeredBy: "Referee", 
      refereeUid: currentUser?.uid || "unknown",
      refereeName: currentUser?.displayName || "Official",
      
      registrationTime: new Date().toISOString(),
      createdAt: serverTimestamp(),
    };

    // 5. Save to Firestore
    await addDoc(collection(db, "players"), finalPlayerData);

    clearTimeout(timeoutId);
    setRegisteredPlayerId(fullId); // Shows the success view
    toast({ title: "Success", description: "Player registration confirmed." });

  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error("Firestore Error:", err);
    
    // Specifically handle permission errors
    if (err.code === 'permission-denied') {
      toast({ 
        title: "Permission Denied", 
        description: "Firestore rejected this write. Ensure your security rules are published.", 
        variant: "destructive" 
      });
    } else {
      toast({ 
        title: "Error", 
        description: "Failed to save player. Check console for index issues.", 
        variant: "destructive" 
      });
    }
  } finally {
    setIsSubmitting(false);
  }
};

  if (registeredPlayerId) {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-800">Registration Recorded</h3>
          <p className="text-sm text-gray-500 mb-4">Player ID assigned to {formData.firstName}:</p>
          <div className="text-3xl font-mono font-black text-emerald-700 bg-emerald-50 py-4 rounded-xl border-2 border-emerald-200 mb-6">
            {registeredPlayerId}
          </div>
          <Button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold h-12 shadow-lg">
            Complete Process
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden my-auto border-emerald-100">
        {/* REFEREE HEADER */}
        <div className="bg-emerald-600 p-4 text-white flex justify-between items-center shadow-md">
          <div className="flex items-center gap-2 font-bold"><UserPlus className="w-5 h-5"/> Player Entry</div>
          <div className="flex items-center gap-2 text-[11px] bg-emerald-700/50 px-3 py-1.5 rounded-full border border-emerald-400">
            <User className="w-3 h-3" />
            <span className="font-medium">Ref: {currentUser?.displayName || "Admin Session"}</span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* LIVE WARNING */}
          {liveSuggestion && (
            <div className="bg-red-50 border-2 border-red-100 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top duration-300">
              <AlertTriangle className="text-red-500 w-6 h-6 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-black text-red-900 uppercase tracking-tighter">Registration Blocked</p>
                <p className="text-red-700"><strong>{liveSuggestion.firstName} {liveSuggestion.lastName}</strong> is already registered with <strong>{liveSuggestion.teamName}</strong>.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-4 bg-emerald-50/40 rounded-xl border border-emerald-100">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-emerald-700 uppercase">League</Label>
              <Select onValueChange={setSelectedLeague}>
                <SelectTrigger className="bg-white border-emerald-200"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="all">All Leagues</SelectItem>
                  {leagues.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-emerald-700 uppercase">Target Team</Label>
              <Select value={formData.teamId} onValueChange={(v) => setFormData({ ...formData, teamId: v })} required>
                <SelectTrigger className="bg-white border-emerald-500 shadow-sm"><SelectValue placeholder="Select Team" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {filteredTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-gray-600 font-semibold">First Name</Label>
              <Input 
                className={`transition-colors ${liveSuggestion ? 'border-red-300 bg-red-50' : ''}`}
                placeholder="Required" 
                value={formData.firstName} 
                onChange={e => setFormData({...formData, firstName: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-600 font-semibold">Surname</Label>
              <Input 
                className={`transition-colors ${liveSuggestion ? 'border-red-300 bg-red-50' : ''}`}
                placeholder="Required" 
                value={formData.lastName} 
                onChange={e => setFormData({...formData, lastName: e.target.value})} 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-gray-600 font-semibold">Rugby Position</Label>
              <Select onValueChange={(v) => setFormData({...formData, position: v})} required>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select Position" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {RUGBY_POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-600 font-semibold">Date of Birth (Optional)</Label>
              <Input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button 
            type="submit" 
            disabled={isSubmitting || !!liveSuggestion} 
            className={`flex-1 shadow-md font-bold ${liveSuggestion ? 'bg-red-400 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {isSubmitting ? "Recording..." : "Register Player"}
          </Button>
        </div>
      </form>
    </div>
  );
};