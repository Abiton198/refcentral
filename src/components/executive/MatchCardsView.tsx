import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { 
  FileText, Printer, ChevronDown, MapPin, 
  Calendar, User, Shield, Users, Search
} from "lucide-react";
import { Button } from "../ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

export const MatchCardsView: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [refereeNames, setRefereeNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  // 1. Fetch Referee Name Mapping
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "referees"), (snap) => {
      const names: Record<string, string> = {};
      snap.forEach(doc => {
        const data = doc.data();
        const fullName = `${data.firstName || ""} ${data.surname || ""}`.trim();
        // Map both ID and Email to the Name
        if (data.email) names[data.email] = fullName;
        names[doc.id] = fullName;
      });
      setRefereeNames(names);
    });
    return () => unsub();
  }, []);

  // 2. Fetch Appointments
  useEffect(() => {
    const q = query(
      collection(db, "appointments"),
      where("resultSubmitted", "==", true),
      orderBy("submittedAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 3. Process Stats
const { refereeStats, totalMatches, activeRefs } = useMemo(() => {
  // Use the selectedMonth if valid, otherwise fallback to the current month
  const safeMonth = (selectedMonth && selectedMonth.length >= 7)
    ? selectedMonth
    : format(new Date(), "yyyy-MM");

  // Create a valid start and end date for the interval check
  const start = startOfMonth(parseISO(`${safeMonth}-01`));
  const end = endOfMonth(start);

  const grouped: Record<string, any> = {};
  let matchCount = 0;

  appointments.forEach((apt) => {
    // Check if submittedAt is a Firestore Timestamp and convert to JS Date
    const matchDate = apt.submittedAt?.toDate ? apt.submittedAt.toDate() : null;
    
    if (!matchDate) return;

    // Filtering logic based on selected month
    if (isWithinInterval(matchDate, { start, end })) {
      matchCount++;

      const name =
        refereeNames[apt.refereeEmail] ||
        apt.refereeName ||
        apt.submittedByName ||
        apt.refereeEmail ||
        "Unknown Ref";

      if (!grouped[name]) {
        grouped[name] = { matches: [], refCount: 0, arCount: 0 };
      }

      grouped[name].matches.push(apt);
      apt.role === "Referee"
        ? grouped[name].refCount++
        : grouped[name].arCount++;
    }
  });

  return {
    refereeStats: grouped,
    totalMatches: matchCount,
    activeRefs: Object.keys(grouped).length,
  };
}, [appointments, selectedMonth, refereeNames]);

  // 4. Print Handler
  const printSingleRef = (refName: string) => {
    setExpandedRef(refName); // Ensure it's open for printing
    setTimeout(() => window.print(), 500);
  };

  if (loading) return <div className="p-10 text-center font-bold">Generating Match Cards...</div>;


  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 min-h-screen bg-[#F8FAFC]">
   <style dangerouslySetInnerHTML={{ __html: `
  @media print {
    body { background: white; }
    .no-print { display: none !important; }
    .print-section { page-break-inside: avoid; }
  }
`}} />


      {/* HEADER */}
      <div className="no-print flex justify-between items-center mb-10 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="text-emerald-500" /> MONTHLY MATCH CARDS
          </h2>
          <p className="text-slate-500 text-xs font-medium">Click a referee to view details and print reports.</p>
        </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                setSelectedMonth(val);
              }
            }}
            className="bg-slate-100 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
          />

      </div>

      {/* REFEREE CARDS */}
      <div className="space-y-4 mb-12">
        {Object.entries(refereeStats).map(([refName, data]) => (
          <div key={refName} className={`print-section bg-white rounded-[2rem] border border-slate-200 shadow-sm transition-all ${expandedRef === refName ? 'ring-2 ring-emerald-500' : ''}`}>
            
            {/* COLLAPSIBLE HEADER */}
        <div className="p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <button 
                onClick={() => setExpandedRef(expandedRef === refName ? null : refName)}
                className="flex items-center gap-4 flex-1 text-left"
              >
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black shadow-lg">
                  {refName[0]}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase">{refName}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded uppercase">Ref: {data.refCount}</span>
                    <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase">Asst: {data.arCount}</span>
                  </div>
                </div>
              </button>
              
              <div className="no-print flex items-center gap-4">
                <Button 
                  onClick={() => printSingleRef(refName)}
                  size="sm" 
                  className="bg-emerald-600 text-white font-bold rounded-xl"
                >
                  <Printer size={16} className="mr-2" /> Print Report
                </Button>
                <ChevronDown className={`text-slate-300 transition-transform ${expandedRef === refName ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {/* EXPANDABLE DETAILS */}
            <AnimatePresence>
              {expandedRef === refName && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: "auto", opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-slate-50/50"
                >
                  <div className="p-6 space-y-6">
                    {data.matches.map((match: any) => (
                      <div key={match.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                       
                        {/* Match Header */}
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 border-b pb-4 mb-4">

                          <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Match Date: {match.date || format(match.submittedAt?.toDate(), "dd MMM yyyy")}</p>
                            <h4 className="text-lg font-black uppercase">{match.homeTeam} VS {match.awayTeam}</h4>
                            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-1">
                              <MapPin size={10} /> {match.venue} • <User size={10} /> Ref: {refName}
                            </p>
                          </div>
                          <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xl font-black">
                            {match.homeScore} : {match.awayScore}
                          </div>
                        </div>

                        {/* Squad Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                          <SquadList title={match.homeTeam} squad={match.homeSquad} color="blue" />
                          <SquadList title={match.awayTeam} squad={match.awaySquad} color="red" />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* STATS AT THE BOTTOM */}
      <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-4 mt-20 p-8 bg-slate-900 rounded-[2.5rem] text-white">
        <div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Summary Statistics</p>
          <h2 className="text-3xl font-black mt-2">Monthly Total</h2>
        </div>
        <div className="flex justify-between md:justify-end gap-12">
          <div className="text-center">
            <p className="text-emerald-400 text-[10px] font-black uppercase">Active Refs</p>
            <p className="text-3xl font-black">{activeRefs}</p>
          </div>
          <div className="text-center">
            <p className="text-blue-400 text-[10px] font-black uppercase">Total Games</p>
            <p className="text-3xl font-black">{totalMatches}</p>
          </div>

          {Object.keys(refereeStats).length === 0 && (
  <div className="text-center text-slate-400 text-sm py-10">
    No match data for this month
  </div>
)}

        </div>
      </div>
    </div>
  );
};

// Helper components
const SquadList = ({ title, squad, color }: any) => {
  const colorMap: Record<string, string> = {
    blue: "text-blue-600",
    red: "text-red-600",
  };

  return (
    <div className="space-y-2">
      <p className={`text-[10px] font-black uppercase ${colorMap[color]} flex items-center gap-1`}>
        <Shield size={10} /> {title}
      </p>

      <div className="grid grid-cols-1 gap-1">
        {squad?.map((p: any, i: number) => (
          <div
            key={i}
            className="text-[10px] font-medium text-slate-600 flex justify-between border-b border-slate-50"
          >
            <span>{p.firstName} {p.lastName}</span>
            <span className="text-slate-300">#{p.jerseyNumber}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
