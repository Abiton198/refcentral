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

export const ResultsView: React.FC = () => {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [refereeMap, setRefereeMap] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRefFilter, setSelectedRefFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  /** 🧑‍⚖️ Build referee map */
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

  /** 🏆 Listen to results collection */
  useEffect(() => {
    const resultsQuery = query(
      collection(db, "results"),
      orderBy("updatedAt", "desc")
    );

    const unsubResults = onSnapshot(resultsQuery, (snapshot) => {
      const list: MatchResult[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as any;
        const ts =
          data.updatedAt?.toDate?.() ||
          data.createdAt?.toDate?.() ||
          new Date();

        const refEmail = data.refereeEmail || data.referee || "";
        const refUid = data.refereeId || "";
        const refName =
          refereeMap[refEmail] ||
          refereeMap[refUid] ||
          data.refereeName ||
          refEmail ||
          refUid ||
          "Unknown Referee";

        const venue =
          data.venue ||
          data.venueName ||
          data.matchVenue ||
          data.field ||
          data.location ||
          "Unknown Venue";

        return {
          id: docSnap.id,
          homeTeam: data.homeTeam || "",
          awayTeam: data.awayTeam || "",
          homeScore: String(data.homeScore ?? "0"),
          awayScore: String(data.awayScore ?? "0"),
          referee: refName,
          venue,
          notes: data.notes || "",
          playerOfMatch: data.playerOfMatch || "",
          resultSummary: data.resultSummary || "",
          submittedAt: ts,
          appointmentId: data.appointmentId || docSnap.id,
        };
      });

      // Deduplicate by appointmentId
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
  }, [refereeMap]);

  /** 🔎 Filters + Sorting */
  const refereeOptions = useMemo(() => {
    const names = Array.from(
      new Set(results.map((r) => r.referee || "Unknown Referee"))
    );
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
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (r.submittedAt < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59`);
        if (r.submittedAt > end) return false;
      }
      return true;
    });

    filtered.sort((a, b) =>
      sortOrder === "desc"
        ? b.submittedAt.getTime() - a.submittedAt.getTime()
        : a.submittedAt.getTime() - b.submittedAt.getTime()
    );

    return filtered;
  }, [results, searchTerm, selectedRefFilter, startDate, endDate, sortOrder]);

  /** 📅 Group results by date range (Today, Yesterday, This Week, Older) */
  const groupedResults = useMemo(() => {
    const groups: Record<string, MatchResult[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Older: [],
    };

    const now = new Date();
    const today = now.getDate();
    const currentWeek = getWeek(now);

    filteredResults.forEach((res) => {
      const d = res.submittedAt;
      const week = getWeek(d);

      if (isSameDay(d, now)) groups["Today"].push(res);
      else if (isYesterday(d, now)) groups["Yesterday"].push(res);
      else if (week === currentWeek) groups["This Week"].push(res);
      else groups["Older"].push(res);
    });

    // Remove empty categories
    return Object.entries(groups).filter(([_, arr]) => arr.length > 0);
  }, [filteredResults]);

  /** Utility functions */
  const isSameDay = (d1: Date, d2: Date) =>
    d1.toDateString() === d2.toDateString();

  const isYesterday = (d: Date, now: Date) => {
    const diff = now.getTime() - d.getTime();
    return diff > 0 && diff < 1000 * 60 * 60 * 24 * 2 && d.getDate() === now.getDate() - 1;
  };

  const getWeek = (date: Date) => {
    const oneJan = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - oneJan.getTime();
    return Math.ceil((diff / 86400000 + oneJan.getDay() + 1) / 7);
  };

  /** Expand handler */
  const toggleExpand = async (res: MatchResult) => {
    if (expandedId === res.id) return setExpandedId(null);
    try {
      const ref = doc(db, "results", res.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        res = {
          ...res,
          notes: data.notes || res.notes,
          resultSummary: data.resultSummary || res.resultSummary,
          playerOfMatch: data.playerOfMatch || res.playerOfMatch,
          venue: data.venue || res.venue,
        };
      }
    } catch (err) {
      console.error("Error loading details:", err);
    }
    setExpandedId(res.id);
  };

  /** 🧾 UI */
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-gray-900">🏆 Match Results</h3>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-4 flex-wrap bg-gray-50 border rounded-lg p-4">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">
            Search (team or ref)
          </label>
          <input
            type="text"
            placeholder="e.g. Grey College, Mokoena..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-64 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">
            Referee
          </label>
          <select
            value={selectedRefFilter}
            onChange={(e) => setSelectedRefFilter(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-48 bg-white focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">All referees</option>
            {refereeOptions.map((refName) => (
              <option key={refName} value={refName}>
                {refName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">
            From date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-40 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">
            To date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-40 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-600 mb-1">
            Sort by
          </label>
          <select
            value={sortOrder}
            onChange={(e) =>
              setSortOrder(e.target.value as "asc" | "desc")
            }
            className="border rounded-md px-3 py-2 text-sm w-36 bg-white focus:ring-emerald-500 focus:outline-none"
          >
            <option value="desc">Latest first</option>
            <option value="asc">Oldest first</option>
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
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Grouped List */}
      {groupedResults.length === 0 ? (
        <p className="p-6 text-center text-gray-500 border rounded-lg bg-white shadow-sm">
          No results match your filters.
        </p>
      ) : (
        groupedResults.map(([groupName, matches]) => (
          <div
            key={groupName}
            className="border rounded-lg bg-white shadow-sm mb-6 overflow-hidden"
          >
            <h4 className="bg-gray-100 px-4 py-2 font-semibold text-gray-800 text-sm uppercase tracking-wide">
              {groupName}
            </h4>
            <div className="divide-y">
              {matches.map((res) => (
                <div key={res.id}>
                  <button
                    onClick={() => toggleExpand(res)}
                    className="w-full flex justify-between items-center p-4 hover:bg-gray-50 transition"
                  >
                    <span className="text-left font-medium text-gray-900">
                      {res.homeTeam}{" "}
                      <span className="text-emerald-600">vs</span> {res.awayTeam}
                    </span>
                    <span className="text-lg font-semibold text-gray-800">
                      {res.homeScore} - {res.awayScore}
                    </span>
                  </button>

                  <AnimatePresence>
                    {expandedId === res.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="px-6 pb-4 bg-gray-50"
                      >
                        <p className="text-sm text-gray-700">
                          <strong>Referee:</strong> {res.referee}
                        </p>
                        <p className="text-sm text-gray-700">
                          <strong>Venue:</strong> {res.venue}
                        </p>
                        {res.playerOfMatch && (
                          <p className="text-sm text-gray-700">
                            <strong>Player of Match:</strong> {res.playerOfMatch}
                          </p>
                        )}
                        {res.resultSummary && (
                          <p className="text-sm text-gray-700">
                            <strong>Summary:</strong> {res.resultSummary}
                          </p>
                        )}
                        {res.notes && (
                          <p className="text-sm text-gray-700">
                            <strong>Notes:</strong> {res.notes}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Last updated: {res.submittedAt.toLocaleString()}
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
