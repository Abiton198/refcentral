import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getWeek } from "date-fns";
import { 
  User, MapPin, Calendar, Clock, Info, 
  ChevronDown, Search, Trophy, Shield 
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
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  refereeName?: string;
  venue: string;
  submittedAt: Date;
  notes?: string;
  homeSquad?: any[];
  awaySquad?: any[];
}

export const ResultsView: React.FC = () => {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // IMPORTANT: This query looks at "appointments" because that's where 
    // your RefereeDashboard.jsx saves the data.
    const q = query(
      collection(db, "appointments"),
      where("resultSubmitted", "==", true), // Only get matches that are finished
      orderBy("submittedAt", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          homeTeam: data.homeTeam || "Home Team",
          awayTeam: data.awayTeam || "Away Team",
          homeScore: String(data.homeScore || "0"),
          awayScore: String(data.awayScore || "0"),
          refereeName: data.refereeName || "Official",
          venue: data.venue || "TBD",
          notes: data.notes || "",
          homeSquad: data.homeSquad || [],
          awaySquad: data.awaySquad || [],
          // Convert Firebase Timestamp to JS Date
          submittedAt: data.submittedAt?.toDate?.() || new Date(),
        };
      });
      setResults(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredResults = useMemo(() => {
    return results.filter(r => 
      r.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.refereeName?.toLowerCase().includes(searchTerm.toLowerCase())
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

  if (loading) return <div className="p-10 text-center animate-pulse">Loading Results...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {/* Search */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
        <input 
          className="w-full bg-white border border-gray-100 py-4 pl-12 pr-4 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          placeholder="Search matches, teams or referees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredResults.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-gray-200">
          <Trophy className="mx-auto text-gray-200 mb-4" size={48} />
          <p className="text-gray-500 font-medium">No match results recorded yet.</p>
        </div>
      ) : (
        groupedResults.map(([group, matches]) => (
          <div key={group} className="space-y-3">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">{group}</h3>
            {matches.map((res) => (
              <div key={res.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-50 overflow-hidden">
                <button 
                  onClick={() => setExpandedId(expandedId === res.id ? null : res.id)}
                  className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-right flex-1 font-bold text-sm uppercase">{res.homeTeam}</div>
                    <div className="bg-emerald-600 text-white px-3 py-1 rounded-lg font-black text-lg shadow-sm">
                      {res.homeScore} - {res.awayScore}
                    </div>
                    <div className="text-left flex-1 font-bold text-sm uppercase">{res.awayTeam}</div>
                  </div>
                  <ChevronDown className={`ml-4 text-gray-300 transition-transform ${expandedId === res.id ? "rotate-180" : ""}`} size={20} />
                </button>

                <AnimatePresence>
                  {expandedId === res.id && (
                    <motion.div 
                      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="border-t border-gray-50 bg-gray-50/30 overflow-hidden"
                    >
                      <div className="p-6 space-y-6">
                        {/* Meta Data */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <User size={14} className="text-emerald-500" /> <b>Ref:</b> {res.refereeName}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin size={14} className="text-emerald-500" /> <b>Venue:</b> {res.venue}
                          </div>
                        </div>

                        {/* Squad Lists */}
                        <div className="grid grid-cols-2 gap-6">
                          <SquadColumn team={res.homeTeam} squad={res.homeSquad} side="home" />
                          <SquadColumn team={res.awayTeam} squad={res.awaySquad} side="away" />
                        </div>

                        {res.notes && (
                          <div className="bg-white p-4 rounded-xl border border-gray-100 text-xs italic text-gray-600">
                            <Info size={12} className="inline mr-2 text-emerald-500" /> {res.notes}
                          </div>
                        )}
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

// Internal Component for Squad List
const SquadColumn = ({ team, squad, side }: any) => (
  <div className="space-y-2">
    <p className={`text-[9px] font-black uppercase flex items-center gap-1 ${side === 'home' ? 'text-blue-600' : 'text-red-600'}`}>
       <Shield size={10} /> {team}
    </p>
    <div className="space-y-1">
      {squad.length > 0 ? squad.map((p: any, i: number) => (
        <div key={i} className="text-[11px] font-semibold text-gray-700 bg-white p-2 rounded-lg border border-gray-50 flex justify-between">
          <span>{p.firstName} {p.lastName}</span>
          <span className="text-gray-300">#{p.jerseyNumber || i+1}</span>
        </div>
      )) : <p className="text-[10px] text-gray-400 italic">No squad info</p>}
    </div>
  </div>
);