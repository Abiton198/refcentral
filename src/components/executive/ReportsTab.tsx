import React, { useEffect, useState, useMemo } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

interface Report {
  id: string;
  referee: string;
  refereeEmail: string;
  type: string;
  lawBroken?: string;
  description: string;
  timeOfIncident?: string;
  matchDetails?: {
    homeTeam?: string;
    awayTeam?: string;
    venue?: string;
    date?: string;
    time?: string;
  };
  createdAt?: any;
  reviewed?: boolean;
}

export const ReportsTab: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "reviewed">("all");
  const [filterRef, setFilterRef] = useState("");
  const [filterType, setFilterType] = useState("");

  // 🔁 Real-time listener — normalize Firestore structure
  useEffect(() => {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();

        // Normalize “teams” field (e.g., “Parks vs Brumbies”)
        const [homeTeam, awayTeam] = d.teams?.includes(" vs ")
          ? d.teams.split(" vs ")
          : ["Home", "Away"];

        return {
          id: docSnap.id,
          referee: d.referee || d.refereeName || "Unknown Referee",
          refereeEmail: d.refereeEmail || "",
          type: d.type || "general",
          lawBroken: d.lawBroken || d.lawInfringed || d.cardType || "",
          description: d.description || d.details || "",
          timeOfIncident: d.timeOfIncident || d.minute || "",
          matchDetails: {
            homeTeam,
            awayTeam,
            venue: d.venue || "Unknown Venue",
            date: d.matchDate || "",
            time: d.matchTime || "",
          },
          createdAt: d.createdAt,
          reviewed: d.reviewed || false,
        } as Report;
      });
      setReports(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ✅ Mark as reviewed
  const handleMarkReviewed = async (id: string) => {
    try {
      await updateDoc(doc(db, "reports", id), { reviewed: true });
      setSelectedReport((prev) => (prev ? { ...prev, reviewed: true } : prev));
    } catch (err) {
      console.error("Error updating report:", err);
      alert("❌ Failed to update report.");
    }
  };

  // ✅ Filtered list
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchStatus =
        filterStatus === "all"
          ? true
          : filterStatus === "pending"
          ? !r.reviewed
          : r.reviewed;

      const matchRef =
        filterRef.trim() === "" ||
        r.referee.toLowerCase().includes(filterRef.toLowerCase()) ||
        r.refereeEmail.toLowerCase().includes(filterRef.toLowerCase());

      const matchType =
        filterType.trim() === "" ||
        r.type.toLowerCase() === filterType.toLowerCase();

      return matchStatus && matchRef && matchType;
    });
  }, [reports, filterStatus, filterRef, filterType]);

  // ✅ Badge display
  const getTypeBadge = (type: string) => {
    switch (type) {
      case "red_card":
        return <Badge variant="danger">🟥 Red Card</Badge>;
      case "incident":
        return <Badge variant="warning"> Incident</Badge>;
      default:
        return <Badge variant="outline">📝 General</Badge>;
    }
  };

  const resetFilters = () => {
    setFilterStatus("all");
    setFilterRef("");
    setFilterType("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Referee Reports</h2>
          <p className="text-gray-500 text-sm">
            Click a card to view full report details.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          <Button
            variant={filterStatus === "all" ? "default" : "outline"}
            onClick={() => setFilterStatus("all")}
          >
            All
          </Button>
          <Button
            variant={filterStatus === "pending" ? "default" : "outline"}
            onClick={() => setFilterStatus("pending")}
          >
            Pending
          </Button>
          <Button
            variant={filterStatus === "reviewed" ? "default" : "outline"}
            onClick={() => setFilterStatus("reviewed")}
          >
            Reviewed
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row flex-wrap gap-4 items-end">
        <div className="flex flex-col space-y-1 w-full md:w-1/3">
          <label className="text-sm font-semibold text-gray-600">
            Filter by Referee
          </label>
          <input
            type="text"
            placeholder="Name or email..."
            value={filterRef}
            onChange={(e) => setFilterRef(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>

        <div className="flex flex-col space-y-1 w-full md:w-1/4">
          <label className="text-sm font-semibold text-gray-600">
            Filter by Type
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          >
            <option value="">All Types</option>
            <option value="red_card">Red Card</option>
            <option value="incident">Incident</option>
            <option value="general">General</option>
          </select>
        </div>

        <Button
          variant="outline"
          onClick={resetFilters}
          className="h-10 mt-1 md:mt-0"
        >
          🔄 Reset
        </Button>
      </div>

      {/* Reports list */}
      {loading ? (
        <p className="text-gray-500 text-center py-8 animate-pulse">
          Loading reports...
        </p>
      ) : filteredReports.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No reports found.</p>
      ) : (
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="rounded-lg border bg-white p-4 hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => setSelectedReport(report)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getTypeBadge(report.type)}
                    {report.reviewed && (
                      <Badge variant="success">✅ Reviewed</Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {report.matchDetails?.homeTeam} vs {report.matchDetails?.awayTeam}
                  </h3>
                  <p className="text-sm text-gray-600">
                    🏟️ {report.matchDetails?.venue}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    📅 {report.matchDetails?.date} ⏰ {report.matchDetails?.time}
                  </p>
                  <p className="text-sm text-gray-600">👨‍⚖️ {report.referee}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl relative overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold text-emerald-700 mb-4 flex items-center gap-2">
              🧾 Match Report Details
            </h3>

            {/* Match Info */}
            <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-700 space-y-1 mb-4">
              <p>
                ⚽ <strong>Match:</strong> {selectedReport.matchDetails?.homeTeam} vs{" "}
                {selectedReport.matchDetails?.awayTeam}
              </p>
              <p>
                🏟️ <strong>Venue:</strong>{" "}
                {selectedReport.matchDetails?.venue || "Unknown Venue"}
              </p>
              <p>
                📅 <strong>Date:</strong> {selectedReport.matchDetails?.date || "N/A"}
              </p>
              <p>
                ⏰ <strong>Time:</strong> {selectedReport.matchDetails?.time || "N/A"}
              </p>
            </div>

            {/* Incident Info */}
            <div className="space-y-2 text-gray-800 text-sm">
              <p>
                <strong>Incident Type:</strong>{" "}
                {selectedReport.type === "red_card"
                  ? "🟥 Red Card / Misconduct"
                  : selectedReport.type === "incident"
                  ? "⚽ Match Incident / Observation"
                  : "📝 General Match Report"}
              </p>

              {selectedReport.lawBroken && (
                <p>
                  <strong>Law Broken:</strong> {selectedReport.lawBroken}
                </p>
              )}

              {selectedReport.timeOfIncident && (
                <p>
                  <strong>Time of Incident:</strong>{" "}
                  {selectedReport.timeOfIncident}
                </p>
              )}

              <div className="mt-3">
                <strong>Description:</strong>
                <p className="whitespace-pre-line mt-1 text-gray-700 border rounded-lg bg-gray-50 p-3">
                  {selectedReport.description}
                </p>
              </div>
            </div>

            {/* Referee Info */}
            <div className="mt-4 border-t pt-3 text-sm text-gray-600">
              <p>
                👨‍⚖️ <strong>Referee:</strong> {selectedReport.referee}
              </p>
              <p>📧 {selectedReport.refereeEmail}</p>
            </div>

            {/* Actions */}
            <div className="flex justify-end mt-6 gap-2">
              {!selectedReport.reviewed && (
                <Button onClick={() => handleMarkReviewed(selectedReport.id)}>
                  ✅ Mark as Reviewed
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedReport(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
