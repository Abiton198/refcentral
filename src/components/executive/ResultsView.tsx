import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
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
  referee: string; // display name already resolved
  venue: string;
  submittedAt: Date;
  notes?: string;
  resultSummary?: string;
  playerOfMatch?: string;
  appointmentId?: string;
}

export const ResultsView: React.FC = () => {
  // 🔄 live raw merged list of results
  const [results, setResults] = useState<MatchResult[]>([]);

  // 👤 map email/uid -> "FirstName Surname"
  const [refereeMap, setRefereeMap] = useState<Record<string, string>>({});

  // 🔎 modal + filters
  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRefFilter, setSelectedRefFilter] = useState("");
  const [startDate, setStartDate] = useState(""); // yyyy-mm-dd
  const [endDate, setEndDate] = useState(""); // yyyy-mm-dd

  // 1️⃣ Build refereeMap live from referees collection
  useEffect(() => {
    const qRefs = query(collection(db, "referees"));
    const unsubRefs = onSnapshot(qRefs, (snapshot) => {
      const map: Record<string, string> = {};
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as any;
        const fullName = `${d.firstName || ""} ${d.surname || ""}`.trim();

        // prefer firstName + surname, fallback to whatever we have
        const displayName =
          fullName ||
          d.preferredName ||
          d.displayName ||
          d.name ||
          d.email ||
          docSnap.id ||
          "Unknown Referee";

        // we map by email and by uid so we can resolve both later
        if (d.email) {
          map[d.email] = displayName;
        }
        map[docSnap.id] = displayName;
      });
      setRefereeMap(map);
    });
    return () => unsubRefs();
  }, []);

  // 2️⃣ Listen to `results` collection live
useEffect(() => {
  const resultsQuery = query(
    collection(db, "results"),
    orderBy("updatedAt", "desc")
  );

  const unsubResults = onSnapshot(resultsQuery, (snapshot) => {
    const incoming = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as any;

      const ts: Date =
        data.updatedAt?.toDate?.() ||
        data.createdAt?.toDate?.() ||
        new Date();

      // resolve referee name using map (we'll finalize after merge step)
      const refEmail = data.refereeEmail || data.referee || "";
      const refUid = data.refereeId || "";
      const resolvedRefName =
        refereeMap[refEmail] ||
        refereeMap[refUid] ||
        data.refereeName ||
        refEmail ||
        refUid ||
        "Unknown Referee";

      // ✅ Expanded venue field detection
      const resolvedVenue =
        data.venue ||
        data.venueName ||
        data.matchVenue ||
        data.matchDetails?.venue ||
        data.field ||
        data.location ||
        "Unknown Venue";

      return {
        id: docSnap.id,
        homeTeam: data.homeTeam || "",
        awayTeam: data.awayTeam || "",
        homeScore: String(data.homeScore ?? "0"),
        awayScore: String(data.awayScore ?? "0"),
        referee: resolvedRefName,
        venue: resolvedVenue,
        notes: data.notes || "",
        playerOfMatch: data.playerOfMatch || "",
        resultSummary: data.resultSummary || "",
        submittedAt: ts,
        appointmentId: data.appointmentId || data.matchId || "",
      } as MatchResult;
    });

    setResults((prev) => {
      const merged = mergeByAppointment([...prev, ...incoming], refereeMap);
      return merged;
    });
  });

  return () => {
    unsubResults();
  };
}, [refereeMap]); // runs again when refereeMap changes so names stay fresh

// 3️⃣ Listen to `appointments` collection live (for inline referee updates)
useEffect(() => {
  const apptQuery = query(collection(db, "appointments"));
  const unsubAppts = onSnapshot(apptQuery, (snapshot) => {
    const incomingFromAppts = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() as any;

        if (!data.resultSubmitted) return null;

        const ts: Date =
          data.updatedAt?.toDate?.() ||
          data.respondedAt?.toDate?.() ||
          new Date();

        // resolve referee name
        const refEmail = data.refereeEmail || data.referee || "";
        const refUid = data.refereeId || "";
        const resolvedRefName =
          refereeMap[refEmail] ||
          refereeMap[refUid] ||
          data.refereeName ||
          refEmail ||
          refUid ||
          "Unknown Referee";

        // ✅ Expanded venue field detection (same logic as above)
        const resolvedVenue =
          data.venue ||
          data.venueName ||
          data.matchVenue ||
          data.matchDetails?.venue ||
          data.field ||
          data.location ||
          "Unknown Venue";

        return {
          id: docSnap.id,
          homeTeam: data.homeTeam || "",
          awayTeam: data.awayTeam || "",
          homeScore: String(data.homeScore ?? data.home_score ?? "0"),
          awayScore: String(data.awayScore ?? data.away_score ?? "0"),
          referee: resolvedRefName,
          venue: resolvedVenue,
          notes: data.notes || "",
          playerOfMatch: data.playerOfMatch || "",
          resultSummary: data.resultSummary || "",
          submittedAt: ts,
          appointmentId: docSnap.id,
        } as MatchResult;
      })
      .filter(Boolean) as MatchResult[];

    setResults((prev) => {
      const merged = mergeByAppointment([...prev, ...incomingFromAppts], refereeMap);
      return merged;
    });
  });

  return () => {
    unsubAppts();
  };
}, [refereeMap]);


  // 🔁 Helper: dedupe and prefer newest per appointment
  function mergeByAppointment(list: MatchResult[], mapRef: Record<string, string>) {
    const bestByKey = new Map<string, MatchResult>();

    for (const item of list) {
      const key = item.appointmentId || item.id;

      // ensure referee is up-to-date with current map
      const fixedRef =
        mapRef[item.referee] || // rare case if referee is actually an email string used as key
        item.referee;

      const normalizedItem: MatchResult = {
        ...item,
        referee: fixedRef || "Unknown Referee",
      };

      const existing = bestByKey.get(key);
      if (!existing) {
        bestByKey.set(key, normalizedItem);
        continue;
      }

      // choose the newer submission
      if (
        normalizedItem.submittedAt &&
        existing.submittedAt &&
        normalizedItem.submittedAt.getTime() > existing.submittedAt.getTime()
      ) {
        bestByKey.set(key, normalizedItem);
      }
    }

    // newest first
    return Array.from(bestByKey.values()).sort(
      (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
    );
  }

  // 🧮 build unique referee list for dropdown
  const refereeOptions = useMemo(() => {
    const names = Array.from(new Set(results.map((r) => r.referee || "Unknown Referee")));
    return names.sort((a, b) => a.localeCompare(b));
  }, [results]);

  // 🔍 filtered list for display
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      // text match
      const needle = searchTerm.trim().toLowerCase();
      if (needle) {
        const teamHit =
          r.homeTeam.toLowerCase().includes(needle) ||
          r.awayTeam.toLowerCase().includes(needle);
        const refHit = r.referee.toLowerCase().includes(needle);
        if (!teamHit && !refHit) return false;
      }

      // referee dropdown match
      if (selectedRefFilter && r.referee !== selectedRefFilter) {
        return false;
      }

      // date range filter
      if (startDate) {
        const startTs = new Date(`${startDate}T00:00:00`);
        if (r.submittedAt < startTs) return false;
      }
      if (endDate) {
        const endTs = new Date(`${endDate}T23:59:59`);
        if (r.submittedAt > endTs) return false;
      }

      return true;
    });
  }, [results, searchTerm, selectedRefFilter, startDate, endDate]);

  // 🔎 open modal with freshest snapshot for 1 result
  const openDetails = async (match: MatchResult) => {
    try {
      // Pull from `results` first
      const ref = doc(db, "results", match.id);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data() as any;
        const ts: Date =
          data.updatedAt?.toDate?.() ||
          data.createdAt?.toDate?.() ||
          match.submittedAt;

        const refEmail = data.refereeEmail || data.referee || "";
        const refUid = data.refereeId || "";

        const resolvedRefName =
          refereeMap[refEmail] ||
          refereeMap[refUid] ||
          data.refereeName ||
          refEmail ||
          refUid ||
          match.referee ||
          "Unknown Referee";

        setSelectedResult({
          id: match.id,
          homeTeam: data.homeTeam || match.homeTeam,
          awayTeam: data.awayTeam || match.awayTeam,
          homeScore: String(data.homeScore ?? match.homeScore ?? "0"),
          awayScore: String(data.awayScore ?? match.awayScore ?? "0"),
          referee: resolvedRefName,
          venue: data.venue || match.venue || "N/A",
          notes: data.notes || match.notes || "",
          playerOfMatch: data.playerOfMatch || match.playerOfMatch || "",
          resultSummary: data.resultSummary || match.resultSummary || "",
          submittedAt: ts,
          appointmentId: data.appointmentId || data.matchId || match.appointmentId,
        });
      } else {
        // fallback to what we already have from merged list
        setSelectedResult(match);
      }
    } catch (err) {
      console.error("Error loading result details:", err);
      setSelectedResult(match);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-gray-900">🏆 Live Match Results</h3>

      {/* 🔧 FILTER BAR */}
      <div className="flex flex-col lg:flex-row gap-4 flex-wrap bg-gray-50 border rounded-lg p-4">
        {/* 🔎 Search text */}
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

        {/* 👤 Referee filter */}
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

        {/* 📅 From date */}
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

        {/* 📅 To date */}
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

        {/* ♻️ Clear filters */}
        <div className="flex items-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setSelectedRefFilter("");
              setStartDate("");
              setEndDate("");
            }}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {/* 📋 RESULTS GRID */}
      {filteredResults.length === 0 ? (
        <Card className="p-6">
          <p className="text-center text-gray-500">
            No results match your filters.
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResults.map((res) => (
            <Card
              key={res.appointmentId || res.id}
              onClick={() => openDetails(res)}
              className="hover:border-emerald-500 border-2 border-transparent cursor-pointer transition-all bg-white shadow-sm rounded-xl"
            >
              <div className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-900 text-lg">
                    {res.homeTeam}{" "}
                    <span className="text-emerald-600">vs</span> {res.awayTeam}
                  </h4>
                  <Badge variant="success">Live</Badge>
                </div>

                <p className="text-2xl font-semibold text-gray-800">
                  {res.homeScore} - {res.awayScore}
                </p>

                {res.playerOfMatch && (
                  <p className="text-sm text-gray-600 mt-1">
                    🏅 Player of Match: {res.playerOfMatch}
                  </p>
                )}

                {res.resultSummary && (
                  <p className="text-sm text-gray-700 mt-1">
                    📌 {res.resultSummary}
                  </p>
                )}

                <p className="text-sm text-gray-600 mt-2">🏟️ {res.venue}</p>
                <p className="text-sm text-gray-500 mt-1">
                  👨‍⚖️ {res.referee}
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  {res.submittedAt
                    ? res.submittedAt.toLocaleString()
                    : "Just now"}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 🔍 MODAL DETAILS */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4 text-gray-900">
              Match Result Details
            </h3>

            <p className="text-gray-700">
              <strong>Match:</strong> {selectedResult.homeTeam} vs{" "}
              {selectedResult.awayTeam}
            </p>
            <p className="text-gray-700">
              <strong>Score:</strong> {selectedResult.homeScore} -{" "}
              {selectedResult.awayScore}
            </p>
            <p className="text-gray-700">
              <strong>Venue:</strong>{" "}
              {selectedResult.venue || "N/A"}
            </p>
            <p className="text-gray-700">
              <strong>Referee:</strong> {selectedResult.referee}
            </p>

            {selectedResult.playerOfMatch && (
              <p className="text-gray-700 mt-2">
                <strong>Player of Match:</strong>{" "}
                {selectedResult.playerOfMatch}
              </p>
            )}

            {selectedResult.notes && (
              <p className="text-gray-700 mt-2 whitespace-pre-wrap">
                <strong>Notes:</strong> {selectedResult.notes}
              </p>
            )}

            {selectedResult.resultSummary && (
              <p className="text-gray-700 mt-2">
                <strong>Summary:</strong>{" "}
                {selectedResult.resultSummary}
              </p>
            )}

            <p className="text-sm text-gray-500 mt-4">
              Last updated:{" "}
              {selectedResult.submittedAt
                ? selectedResult.submittedAt.toLocaleString()
                : "N/A"}
            </p>

            <div className="flex justify-end mt-6">
              <Button variant="outline" onClick={() => setSelectedResult(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
