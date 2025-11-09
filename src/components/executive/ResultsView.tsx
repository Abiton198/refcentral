// src/components/ResultsView.tsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDoc,
} from "firebase/firestore";
import { getWeek } from "date-fns";

/** ───────────────────────────────────────────────
 * Helper functions
 * ─────────────────────────────────────────────── */
const isSameDay = (d1: Date, d2: Date) =>
  d1.toDateString() === d2.toDateString();

const isYesterday = (d: Date, now: Date) => {
  const diff = now.getTime() - d.getTime();
  return diff > 0 && diff < 1000 * 60 * 60 * 24 * 2 && d.getDate() === now.getDate() - 1;
};

/** ───────────────────────────────────────────────
 * Type definition
 * ─────────────────────────────────────────────── */
interface MatchResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  referee: string;
  venue: string;
  submittedAt: Date;
  notes?: string;
  resultSummary?: string;
  playerOfMatch?: string;
  appointmentId?: string;
}

/** ───────────────────────────────────────────────
 * ResultsView Component
 * ─────────────────────────────────────────────── */
export const ResultsView: React.FC = () => {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [appointments, setAppointments] = useState<Record<string, any>>({});
  const [refereeMap, setRefereeMap] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRefFilter, setSelectedRefFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  /** Build referee map */
  useEffect(() => {
    const qRefs = query(collection(db, "referees"));
    const unsubRefs = onSnapshot(qRefs, (snapshot) => {
      const map: Record<string, string> = {};
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as any;
        const name = `${d.firstName || ""} ${d.surname || ""}`.trim();
        const displayName =
          name || d.displayName || d.email || docSnap.id || "Unknown Referee";
        if (d.email) map[d.email] = displayName;
        map[docSnap.id] = displayName;
      });
      setRefereeMap(map);
    });
    return () => unsubRefs();
  }, []);

  /** Listen to match_results (FIXED!) */
  useEffect(() => {
    const resultsQuery = query(
      collection(db, "match_results"),
      orderBy("submittedAt", "desc")
    );

    const unsubResults = onSnapshot(resultsQuery, async (snapshot) => {
      const list: MatchResult[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as any;

        // Fetch appointment for team names & venue
        let apt: any = null;
        if (data.appointmentId) {
          if (!appointments[data.appointmentId]) {
            try {
              const aptSnap = await getDoc(doc(db, "appointments", data.appointmentId));
              if (aptSnap.exists()) {
                apt = aptSnap.data();
                setAppointments(prev => ({ ...prev, [data.appointmentId]: apt }));
              }
            } catch (err) {
              console.error("Failed to fetch appointment:", err);
            }
          } else {
            apt = appointments[data.appointmentId];
          }
        }

        const refName =
          refereeMap[data.submittedBy] ||
          refereeMap[data.submittedByName] ||
          data.submittedByName ||
          "Unknown Referee";

        const venue = apt?.venue || "Unknown Venue";

        list.push({
          id: docSnap.id,
          homeTeam: apt?.homeTeam || "TBD",
          awayTeam: apt?.awayTeam || "TBD",
          homeScore: String(data.homeScore ?? "0"),
          awayScore: String(data.awayScore ?? "0"),
          referee: refName,
          venue,
          notes: data.notes || "",
          submittedAt: data.submittedAt?.toDate?.() || new Date(),
          appointmentId: data.appointmentId,
        });
      }

      // Deduplicate
      const unique = new Map<string, MatchResult>();
      for (const r of list) {
        const key = r.appointmentId || r.id;
        const existing = unique.get(key);
        if (!existing || r.submittedAt > existing.submittedAt) {
          unique.set(key, r);
        }
      }
      setResults(Array.from(unique.values()));
    });

    return () => unsubResults();
  }, [refereeMap, appointments]);

  /** Filter & Sort */
  const refereeOptions = useMemo(() => {
    const names = Array.from(new Set(results.map((r) => r.referee)));
    return names.sort((a, b) => a.localeCompare(b));
  }, [results]);

  const filteredResults = useMemo(() => {
    let filtered = results.filter((r) => {
      const q = searchTerm.toLowerCase().trim();
      if (q) {
        const teamHit =
          r.homeTeam.toLowerCase().includes(q) ||
          r.awayTeam.toLowerCase().includes(q);
        const refHit = r.referee.toLowerCase().includes(q);
        if (!teamHit && !refHit) return false;
      }
      if (selectedRefFilter && r.referee !== selectedRefFilter) return false;
      if (startDate && r.submittedAt < new Date(`${startDate}T00:00:00`)) return false;
      if (endDate && r.submittedAt > new Date(`${endDate}T23:59:59`)) return false;
      return true;
    });

    filtered.sort((a, b) =>
      sortOrder === "desc"
        ? b.submittedAt.getTime() - a.submittedAt.getTime()
        : a.submittedAt.getTime() - b.submittedAt.getTime()
    );

    return filtered;
  }, [results, searchTerm, selectedRefFilter, startDate, endDate, sortOrder]);

  /** Group results */
  const groupedResults = useMemo(() => {
    const groups: Record<string, MatchResult[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Older: [],
    };

    const now = new Date();
    const currentWeek = getWeek(now);

    filteredResults.forEach((res) => {
      const d = res.submittedAt;
      const week = getWeek(d);

      if (isSameDay(d, now)) groups["Today"].push(res);
      else if (isYesterday(d, now)) groups["Yesterday"].push(res);
      else if (week === currentWeek) groups["This Week"].push(res);
      else groups["Older"].push(res);
    });

    return Object.entries(groups).filter(([_, arr]) => arr.length > 0);
  }, [filteredResults]);

  /** Expand */
  const toggleExpand = (res: MatchResult) => {
    setExpandedId(expandedId === res.id ? null : res.id);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-gray-900">Match Results</h3>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-4 flex-wrap bg-gray-50 border rounded-lg p-4">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">Search</label>
          <input
            type="text"
            placeholder="Team or ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-64 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">Referee</label>
          <select
            value={selectedRefFilter}
            onChange={(e) => setSelectedRefFilter(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-48 bg-white"
          >
            <option value="">All</option>
            {refereeOptions.map((refName) => (
              <option key={refName} value={refName}>{refName}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-40"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-40"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">Sort</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
            className="border rounded-md px-3 py-2 text-sm w-36 bg-white"
          >
            <option value="desc">Latest</option>
            <option value="asc">Oldest</option>
          </select>
        </div>

        <div className="flex items-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setSelectedRefFilter("");
              setStartDate("");
              setEndDate("");
              setSortOrder("desc");
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Results */}
      {groupedResults.length === 0 ? (
        <p className="p-6 text-center text-gray-500 border rounded-lg bg-white">
          No results found.
        </p>
      ) : (
        groupedResults.map(([groupName, matches]) => (
          <div key={groupName} className="border rounded-lg bg-white shadow-sm mb-6">
            <h4 className="bg-gray-100 px-4 py-2 font-semibold text-gray-800 text-sm uppercase">
              {groupName}
            </h4>
            <div className="divide-y">
              {matches.map((res) => (
                <div key={res.id}>
                  <button
                    onClick={() => toggleExpand(res)}
                    className="w-full flex justify-between items-center p-4 hover:bg-gray-50"
                  >
                    <span className="text-left font-medium">
                      {res.homeTeam} <span className="text-emerald-600">vs</span> {res.awayTeam}
                    </span>
                    <span className="text-lg font-semibold">
                      {res.homeScore} - {res.awayScore}
                    </span>
                  </button>

                  <AnimatePresence>
                    {expandedId === res.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-6 pb-4 bg-gray-50"
                      >
                        <p className="text-sm"><strong>Referee:</strong> {res.referee}</p>
                        <p className="text-sm"><strong>Venue:</strong> {res.venue}</p>
                        {res.notes && <p className="text-sm"><strong>Notes:</strong> {res.notes}</p>}
                        <p className="text-xs text-gray-500 mt-2">
                          {res.submittedAt.toLocaleString()}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};