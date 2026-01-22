import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDoc,
} from "firebase/firestore";
import { 
  User, MapPin, Trophy, Shield, ChevronDown, Search, Info 
} from "lucide-react";

/** Helper: Date Checkers **/
const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
const isYesterday = (d: Date, now: Date) => {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return isSameDay(d, yesterday);
};

interface MatchResult {
  id: string;
  appointmentId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  refereeName?: string;
  venue: string;
  submittedAt: Date;
  homeSquad: any[];
  awaySquad: any[];
}

export const ResultsView: React.FC = () => {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // ✅ Pointing to "match_results" (underscore) to match your DB and Rules
    const q = query(
      collection(db, "match_results"),
      orderBy("submittedAt", "desc")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
  const resultsData = await Promise.all(
    snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      
      // Default fallbacks
      let homeName = "Home Team";
      let awayName = "Away Team";
      let venue = "TBD";
      // let officialName = "Official"; // Fallback name

      // 1. Fetch the corresponding Appointment
      const aptRef = doc(db, "appointments", data.appointmentId);
      const aptSnap = await getDoc(aptRef);
      
      if (aptSnap.exists()) {
        const aptData = aptSnap.data();
        homeName = aptData.homeTeam || "Home Team";
        awayName = aptData.awayTeam || "Away Team";
        venue = aptData.venue || "TBD";
        // ✅ Grab the referee name from the appointment document
    
      }
      const squadRefereeName = data.homeSquad?.[0]?.refereeName || data.awaySquad?.[0]?.refereeName;
  const officialName = data.refereeName || squadRefereeName || "Official";

      return {
        id: docSnap.id,
        appointmentId: data.appointmentId,
        homeTeam: homeName,
        awayTeam: awayName,
        homeScore: data.homeScore || 0,
        awayScore: data.awayScore || 0,
        // ✅ Use the name we just found
        refereeName: officialName, 
        venue: venue,
        homeSquad: data.homeSquad || [],
        awaySquad: data.awaySquad || [],
        submittedAt: data.submittedAt?.toDate?.() || new Date(),
      };
    })
  );
  
  setResults(resultsData);
  setLoading(false);
});

    return () => unsub();
  }, []);

  const filteredResults = useMemo(() => {
    return results.filter(r => 
      r.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.awayTeam.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [results, searchTerm]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, MatchResult[]> = { Today: [], Yesterday: [], Older: [] };
    const now = new Date();

    filteredResults.forEach((res) => {
      if (isSameDay(res.submittedAt, now)) groups["Today"].push(res);
      else if (isYesterday(res.submittedAt, now)) groups["Yesterday"].push(res);
      else groups["Older"].push(res);
    });

    return Object.entries(groups).filter(([_, arr]) => arr.length > 0);
  }, [filteredResults]);

  if (loading) return <div className="p-10 text-center animate-pulse">Loading Official Results...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input 
          className="w-full bg-white border border-gray-100 py-4 pl-12 pr-4 rounded-2xl shadow-sm outline-none"
          placeholder="Search match results..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredResults.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-3xl border">
          <Trophy className="mx-auto text-gray-200 mb-2" size={40} />
          <p className="text-gray-400">No results found.</p>
        </div>
      ) : (
        groupedResults.map(([group, matches]) => (
          <div key={group} className="space-y-3">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">{group}</h3>
            {matches.map((res) => (
              <div key={res.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                <button 
                  onClick={() => setExpandedId(expandedId === res.id ? null : res.id)}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex-1 text-right font-black text-sm uppercase text-gray-700">{res.homeTeam}</div>
                    <div className="mx-6 bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-xl min-w-[80px] text-center">
                      {res.homeScore} - {res.awayScore}
                    </div>
                    <div className="flex-1 text-left font-black text-sm uppercase text-gray-700">{res.awayTeam}</div>
                  </div>
                  <ChevronDown className={`text-gray-300 transition-transform ${expandedId === res.id ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {expandedId === res.id && (
                    <motion.div 
                      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="bg-gray-50/50 border-t"
                    >
                      <div className="p-6 space-y-8">
                        {/* Match Info Header */}
                        <div className="flex justify-around bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                           <div className="text-center">
                              <p className="text-[9px] font-bold text-gray-400 uppercase">Referee</p>
                              <p className="text-xs font-black text-gray-700 flex items-center gap-1 justify-center">
                                <User size={12} className="text-emerald-500" /> {res.refereeName}
                              </p>
                           </div>
                           <div className="text-center border-l border-gray-100 pl-8">
                              <p className="text-[9px] font-bold text-gray-400 uppercase">Venue</p>
                              <p className="text-xs font-black text-gray-700 flex items-center gap-1 justify-center">
                                <MapPin size={12} className="text-emerald-500" /> {res.venue}
                              </p>
                           </div>
                        </div>

                        {/* Squad Comparison */}
                        <div className="grid grid-cols-2 gap-8">
                          <SquadList team={res.homeTeam} squad={res.homeSquad} color="blue" />
                          <SquadList team={res.awayTeam} squad={res.awaySquad} color="red" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};

const SquadList = ({ team, squad, color }: any) => (
  <div className="space-y-3">
    <div className={`flex items-center gap-2 border-b-2 pb-2 ${color === 'blue' ? 'border-blue-100' : 'border-red-100'}`}>
      <Shield size={14} className={color === 'blue' ? 'text-blue-600' : 'text-red-600'} />
      <p className="text-[10px] font-black uppercase text-gray-600 truncate">{team}</p>
    </div>
    <div className="space-y-1.5">
      {squad.length > 0 ? squad.map((player: any, idx: number) => (
        <div key={player.id || idx} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
           <div className="flex flex-col">
              <span className="text-[11px] font-black text-gray-800 leading-tight">
                {player.firstName} {player.lastName}
              </span>
              <span className="text-[9px] font-bold text-gray-400">
                {player.position || "Player"}
              </span>
           </div>
           <span className="text-[10px] font-black text-gray-300">#{player.regNumber?.toString().slice(-2) || idx + 1}</span>
        </div>
      )) : (
        <p className="text-[10px] text-gray-400 italic">No squad data available</p>
      )}
    </div>
  </div>
);