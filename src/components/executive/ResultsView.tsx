import React, { useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDoc,
} from "firebase/firestore";
import { Button } from "../ui/Button";

interface MatchResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  referee: string;
  venue: string;
  submittedAt: string;
  notes?: string;
  appointmentId?: string;
}

export const ResultsView: React.FC = () => {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<MatchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // ✅ Fetch results in real time
  useEffect(() => {
    const q = query(collection(db, "results"), orderBy("submittedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        homeTeam: doc.data().homeTeam || "",
        awayTeam: doc.data().awayTeam || "",
        homeScore: doc.data().homeScore || "0",
        awayScore: doc.data().awayScore || "0",
        referee: doc.data().referee || "Unknown",
        venue: doc.data().venue || "N/A",
        notes: doc.data().notes || "",
        submittedAt: doc.data().submittedAt || "",
        appointmentId: doc.data().appointmentId || "",
      })) as MatchResult[];
      setResults(data);
      setFilteredResults(data);
    });
    return () => unsubscribe();
  }, []);

  // ✅ Search filtering
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredResults(results);
      return;
    }
    const lower = searchTerm.toLowerCase();
    setFilteredResults(
      results.filter(
        (r) =>
          r.homeTeam.toLowerCase().includes(lower) ||
          r.awayTeam.toLowerCase().includes(lower) ||
          r.referee.toLowerCase().includes(lower)
      )
    );
  }, [searchTerm, results]);

  // ✅ Load extra details if needed
  const openDetails = async (result: MatchResult) => {
    try {
      const ref = doc(db, "results", result.id);
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        setSelectedResult({ id: result.id, ...snapshot.data() } as MatchResult);
      } else {
        setSelectedResult(result);
      }
    } catch (err) {
      console.error("Error loading result details:", err);
      setSelectedResult(result);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-gray-900">🏆 Match Results</h3>

      {/* 🔍 Search bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by team or referee..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/3 border rounded-lg px-4 py-2"
        />
      </div>

      {/* 📋 Results list */}
      {filteredResults.length === 0 ? (
        <Card>
          <p className="text-center text-gray-500 py-6">No results found.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResults.map((res) => (
            <Card
              key={res.id}
              onClick={() => openDetails(res)}
              className="hover:border-emerald-500 border-2 border-transparent cursor-pointer transition-all bg-gray-50"
            >
              <div className="p-4">
                <h4 className="font-bold text-gray-900 text-lg mb-2">
                  {res.homeTeam} <span className="text-emerald-600">vs</span> {res.awayTeam}
                </h4>
                <p className="text-xl font-semibold">
                  {res.homeScore} - {res.awayScore}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  🏟️ {res.venue}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  👨‍⚖️ {res.referee}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(res.submittedAt).toLocaleString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 🪟 Modal for result details */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4 text-gray-900">
              Match Result Details
            </h3>

            <p className="text-gray-700">
              <strong>Match:</strong> {selectedResult.homeTeam} vs {selectedResult.awayTeam}
            </p>
            <p className="text-gray-700">
              <strong>Score:</strong> {selectedResult.homeScore} - {selectedResult.awayScore}
            </p>
            <p className="text-gray-700">
              <strong>Venue:</strong> {selectedResult.venue}
            </p>
            <p className="text-gray-700">
              <strong>Referee:</strong> {selectedResult.referee}
            </p>
            {selectedResult.notes && (
              <p className="text-gray-700 mt-2">
                <strong>Notes:</strong> {selectedResult.notes}
              </p>
            )}
            <p className="text-sm text-gray-500 mt-4">
              Submitted on {new Date(selectedResult.submittedAt).toLocaleString()}
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
