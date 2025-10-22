import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  getDocs,
  where,
} from "firebase/firestore";
import { format } from "date-fns";

interface MatchResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time?: string;
  venue?: string;
  refereeName?: string;
  leagueType?: string;
  homeScore?: string;
  awayScore?: string;
  notes?: string;
  createdAt: any;
}

interface ReportData {
  id: string;
  matchDate: string;
  teams: string;
  venue: string;
  details: string;
  refereeName: string;
  lawInfringed?: string;
  playerName?: string;
  cardType?: string;
  minute?: string;
  type?: string;
}

export const ResultsView: React.FC = () => {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<MatchResult[]>([]);
  const [searchTeam, setSearchTeam] = useState("");
  const [searchReferee, setSearchReferee] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // ✅ Fetch match results
  useEffect(() => {
    const q = query(collection(db, "matchResults"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        homeTeam: doc.data().homeTeam || "",
        awayTeam: doc.data().awayTeam || "",
        homeScore: doc.data().homeScore || "",
        awayScore: doc.data().awayScore || "",
        date: doc.data().matchDate || "",
        time: doc.data().matchTime || "",
        venue: doc.data().venue || "",
        leagueType: doc.data().gameType || "League",
        refereeName: doc.data().refereeName || "Unknown Referee",
        notes: doc.data().notes || "",
        createdAt: doc.data().createdAt,
      })) as MatchResult[];
      setResults(data);
      setFilteredResults(data);
    });
    return () => unsub();
  }, []);

  // ✅ Filtering logic
  useEffect(() => {
    let filtered = results;

    if (searchTeam.trim()) {
      filtered = filtered.filter(
        (r) =>
          r.homeTeam.toLowerCase().includes(searchTeam.toLowerCase()) ||
          r.awayTeam.toLowerCase().includes(searchTeam.toLowerCase())
      );
    }

    if (searchReferee.trim()) {
      filtered = filtered.filter((r) =>
        r.refereeName?.toLowerCase().includes(searchReferee.toLowerCase())
      );
    }

    if (dateFilter.trim()) {
      filtered = filtered.filter((r) => r.date === dateFilter);
    }

    setFilteredResults(filtered);
  }, [searchTeam, searchReferee, dateFilter, results]);

  // ✅ Toggle expanded view
  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setSelectedReport(null);
  };

  // ✅ Load related referee report
  const loadReport = async (match: MatchResult) => {
    setLoadingReport(true);
    setSelectedReport(null);
    try {
      const q = query(
        collection(db, "reports"),
        where("matchDate", "==", match.date),
        where("teams", "==", `${match.homeTeam} vs ${match.awayTeam}`)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const reportDoc = snap.docs[0];
        setSelectedReport({
          id: reportDoc.id,
          ...(reportDoc.data() as ReportData),
        });
      } else {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error("Error loading report:", err);
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="bg-white shadow-xl rounded-xl p-6">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">🏆 Match Results</h3>

      {/* 🔍 Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by Team..."
          value={searchTeam}
          onChange={(e) => setSearchTeam(e.target.value)}
          className="w-full md:w-1/3 border rounded-lg px-4 py-2"
        />
        <input
          type="text"
          placeholder="Search by Referee..."
          value={searchReferee}
          onChange={(e) => setSearchReferee(e.target.value)}
          className="w-full md:w-1/3 border rounded-lg px-4 py-2"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-full md:w-1/3 border rounded-lg px-4 py-2"
        />
      </div>

      {/* 🧾 Results List */}
      {filteredResults.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No results found.</p>
      ) : (
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResults.map((match) => {
            const formattedDate = match.date
              ? format(new Date(match.date), "yyyy-MM-dd")
              : "N/A";

            return (
              <div
                key={match.id}
                className="border rounded-xl shadow-md hover:shadow-lg transition-all bg-gray-50 cursor-pointer"
                onClick={() => toggleExpand(match.id)}
              >
                {/* Compact card view */}
                <div className="p-4 border-b flex flex-col items-center">
                  <p className="font-semibold text-gray-900 text-lg">
                    {match.homeTeam} <span className="text-emerald-600">vs</span> {match.awayTeam}
                  </p>
                  <p className="text-xl font-bold mt-1">
                    {match.homeScore || 0} - {match.awayScore || 0}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{formattedDate}</p>
                </div>

                {/* Expanded card details */}
                {expandedId === match.id && (
                  <div className="p-4 text-sm text-gray-700 space-y-2">
                    <p><strong>🏟️ Venue:</strong> {match.venue || "—"}</p>
                    <p><strong>🕒 Time:</strong> {match.time || "—"}</p>
                    <p><strong>🎯 Type:</strong> {match.leagueType}</p>
                    <p><strong>👨‍⚖️ Referee:</strong> {match.refereeName}</p>
                    {match.notes && <p><strong>🗒️ Notes:</strong> {match.notes}</p>}

                    {/* 🧾 View Full Report */}
                    <div className="pt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          loadReport(match);
                        }}
                        className="text-emerald-700 font-semibold hover:underline"
                      >
                        {loadingReport ? "Loading..." : "📄 View Full Report"}
                      </button>

                      {/* Display report data inline */}
                      {selectedReport && selectedReport.matchDate === match.date && (
                        <div className="mt-3 border-t pt-2 text-gray-800 space-y-1">
                          <p><strong>Teams:</strong> {selectedReport.teams}</p>
                          <p><strong>Venue:</strong> {selectedReport.venue}</p>
                          <p><strong>Details:</strong> {selectedReport.details}</p>
                          {selectedReport.lawInfringed && (
                            <p><strong>Law:</strong> {selectedReport.lawInfringed}</p>
                          )}
                          {selectedReport.playerName && (
                            <p><strong>Player:</strong> {selectedReport.playerName}</p>
                          )}
                          {selectedReport.cardType && (
                            <p><strong>Card:</strong> {selectedReport.cardType}</p>
                          )}
                          {selectedReport.minute && (
                            <p><strong>Minute:</strong> {selectedReport.minute}'</p>
                          )}
                        </div>
                      )}

                      {/* No report case */}
                      {!loadingReport && selectedReport === null && (
                        <p className="text-gray-500 mt-2 italic">
                          No report submitted for this match.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
