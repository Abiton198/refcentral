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
  User, MapPin, Trophy, Shield, ChevronDown, Search, History, AlertCircle, CheckCircle2
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
  homeTries: number;
  awayTries: number;
  refereeName?: string;
  venue: string;
  submittedAt: Date;
  homeSquad: any[];
  awaySquad: any[];
  // Audit Trail Fields
  isEdited: boolean;
  editCount: number;
  lastEditedAt?: Date;
  originalEntry?: {
    homeScore: number;
    awayScore: number;
    homeTries: number;
    awayTries: number;
    submittedAt: any;
  };
}

export const ResultsView: React.FC = () => {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "match_results"),
      orderBy("submittedAt", "desc")
    );

    // ✅ Real-time listener: updates automatically when referee submits or edits
    const unsub = onSnapshot(q, async (snapshot) => {
      const resultsData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();

          let homeName = "Home Team";
          let awayName = "Away Team";
          let venue = "TBD";

          const aptRef = doc(db, "appointments", data.appointmentId);
          const aptSnap = await getDoc(aptRef);

          if (aptSnap.exists()) {
            const aptData = aptSnap.data();
            homeName = aptData.homeTeam || "Home Team";
            awayName = aptData.awayTeam || "Away Team";
            venue = aptData.venue || "TBD";
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
            homeTries: data.homeTries || 0,
            awayTries: data.awayTries || 0,
            refereeName: officialName,
            venue: data.venue || venue,
            homeSquad: data.homeSquad || [],
            awaySquad: data.awaySquad || [],
            submittedAt: data.submittedAt?.toDate?.() || new Date(),
            // Audit Fields
            isEdited: data.isEdited || false,
            editCount: data.editCount || 0,
            lastEditedAt: data.lastEditedAt?.toDate?.() || null,
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

  if (loading) return <div className="p-10 text-center animate-pulse font-black text-slate-400">LOADING OFFICIAL ARCHIVES...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          className="w-full bg-white border border-gray-100 py-4 pl-12 pr-4 rounded-2xl shadow-sm outline-none focus:ring-2 ring-emerald-500/20"
          placeholder="Search teams or referees..."
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
              <div key={res.id} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === res.id ? null : res.id)}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex-1 text-right font-black text-xs uppercase text-gray-500">{res.homeTeam}</div>

                    <div className="mx-6 flex flex-col items-center">
                      <div className="bg-slate-900 text-white px-5 py-2 rounded-2xl font-black text-2xl min-w-[100px] text-center shadow-lg ring-4 ring-slate-50">
                        {res.homeScore} - {res.awayScore}
                      </div>
                      <div className="mt-1 text-[10px] font-black text-slate-400 italic">
                        ({res.homeTries}T - {res.awayTries}T)
                      </div>
                    </div>

                    <div className="flex-1 text-left font-black text-xs uppercase text-gray-500">{res.awayTeam}</div>
                  </div>
                  <ChevronDown className={`text-gray-300 transition-transform ${expandedId === res.id ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {expandedId === res.id && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="bg-gray-50/50 border-t"
                    >

                      {/* Audit Trail: Previous Entry Cancellation */}
                      {res.isEdited && res.originalEntry && (
                        <div className="mb-6 relative">
                          <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-amber-200 border-dashed"></div>
                          </div>
                          <div className="relative flex justify-center">
                            <span className="bg-gray-50 px-3 text-[9px] font-black text-amber-600 uppercase tracking-tighter">
                              Previous Submission Cancelled
                            </span>
                          </div>

                          <div className="mt-4 flex items-center justify-center gap-8 opacity-40 grayscale pointer-events-none">
                            <div className="text-right">
                              <p className="text-[10px] font-black line-through">{res.homeTeam}</p>
                              <p className="text-2xl font-black line-through">{res.originalEntry.homeScore}</p>
                            </div>
                            <div className="text-[10px] font-black text-slate-400">VS</div>
                            <div className="text-left">
                              <p className="text-[10px] font-black line-through">{res.awayTeam}</p>
                              <p className="text-2xl font-black line-through">{res.originalEntry.awayScore}</p>
                            </div>
                          </div>
                          <p className="text-center text-[8px] font-medium text-gray-400 mt-1 italic">
                            Originally submitted at {res.originalEntry.submittedAt?.toDate?.().toLocaleTimeString()}
                          </p>
                        </div>
                      )}

                      <div className="p-6 space-y-8">

                        {/* Executive Audit Trail Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                            <div className="p-2 bg-emerald-50 rounded-full text-emerald-600">
                              <User size={18} />
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-gray-400 uppercase">Match Official</p>
                              <p className="text-sm font-black text-gray-800">{res.refereeName}</p>
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                            <div className={`p-2 rounded-full ${res.isEdited ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                              {res.isEdited ? <History size={18} /> : <CheckCircle2 size={18} />}
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-gray-400 uppercase">Audit Status</p>
                              <p className="text-sm font-black text-gray-800">
                                {res.isEdited ? `Edited (${res.editCount}x)` : "Original Submission"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Timeline & Venue */}
                        <div className="bg-slate-900 text-slate-400 p-4 rounded-2xl flex justify-between items-center px-8">
                          <div className="text-center">
                            <p className="text-[8px] font-bold uppercase opacity-50">First Submitted</p>
                            <p className="text-[11px] font-black text-white">{res.submittedAt.toLocaleTimeString()}</p>
                          </div>
                          <div className="h-6 w-px bg-slate-800"></div>
                          <div className="text-center">
                            <p className="text-[8px] font-bold uppercase opacity-50">Venue</p>
                            <p className="text-[11px] font-black text-white uppercase">{res.venue}</p>
                          </div>
                          {res.isEdited && (
                            <>
                              <div className="h-6 w-px bg-slate-800"></div>
                              <div className="text-center">
                                <p className="text-[8px] font-bold uppercase text-amber-400">Last Revised</p>
                                <p className="text-[11px] font-black text-amber-400">{res.lastEditedAt?.toLocaleTimeString()}</p>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Player Squads */}
                        <div className="grid grid-cols-2 gap-8">
                          <SquadList team={res.homeTeam} squad={res.homeSquad} color="emerald" />
                          <SquadList team={res.awayTeam} squad={res.awaySquad} color="slate" />
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
    <div className={`flex items-center gap-2 border-b-2 pb-2 ${color === 'emerald' ? 'border-emerald-100' : 'border-slate-200'}`}>
      <Shield size={14} className={color === 'emerald' ? 'text-emerald-600' : 'text-slate-600'} />
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