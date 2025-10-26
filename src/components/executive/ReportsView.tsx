import React, { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface Report {
  id: string;
  type: string;
  submittedBy: string;
  match: string;
  date: string;
  status: string;
}

export const ReportsView: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // ✅ Fetch data from Firestore
  useEffect(() => {
    const refReportsQuery = query(
      collection(db, "reports"),
      orderBy("createdAt", "desc")
    );
    const coachReportsQuery = query(
      collection(db, "coachReports"),
      orderBy("createdAt", "desc")
    );
    const resultsQuery = query(
      collection(db, "results"),
      orderBy("submittedAt", "desc")
    );

    const unsubRef = onSnapshot(refReportsQuery, (snap) => {
      const refs = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type || "incident",
          submittedBy: data.refereeName || data.referee || "Unknown Referee",
          match:
            data.teams ||
            `${data.homeTeam || ""} vs ${data.awayTeam || ""}`.trim() ||
            "N/A",
          date:
            data.matchDate ||
            (data.createdAt?.toDate?.()?.toLocaleDateString() ?? ""),
          status: data.reviewed ? "reviewed" : "pending",
        };
      });
      setReports((prev) => {
        const others = prev.filter((r) => r.source !== "referee");
        return [...others, ...refs.map((r) => ({ ...r, source: "referee" }))];
      });
    });

    const unsubCoach = onSnapshot(coachReportsQuery, (snap) => {
      const coaches = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.reportType || "performance",
          submittedBy: data.coachName || "Unknown Coach",
          match: `${data.homeTeam || ""} vs ${data.awayTeam || ""}`.trim(),
          date: data.matchDate || "",
          status: data.reviewStatus || "pending",
        };
      });
      setReports((prev) => {
        const others = prev.filter((r) => r.source !== "coach");
        return [...others, ...coaches.map((r) => ({ ...r, source: "coach" }))];
      });
    });

    const unsubResults = onSnapshot(resultsQuery, (snap) => {
      const results = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: "result",
          submittedBy: data.referee || "Unknown Referee",
          match: `${data.homeTeam || ""} vs ${data.awayTeam || ""}`.trim(),
          date: data.submittedAt
            ? new Date(data.submittedAt).toLocaleDateString()
            : "—",
          status: "reviewed",
        };
      });
      setReports((prev) => {
        const others = prev.filter((r) => r.source !== "result");
        return [...others, ...results.map((r) => ({ ...r, source: "result" }))];
      });
    });

    return () => {
      unsubRef();
      unsubCoach();
      unsubResults();
    };
  }, []);

  // ✅ Filters + Search
  useEffect(() => {
    let filtered = [...reports];
    if (filterType !== "all") {
      filtered = filtered.filter(
        (r) => r.type.toLowerCase() === filterType.toLowerCase()
      );
    }
    if (filterStatus !== "all") {
      filtered = filtered.filter(
        (r) => r.status.toLowerCase() === filterStatus.toLowerCase()
      );
    }
    if (searchTerm.trim() !== "") {
      filtered = filtered.filter(
        (r) =>
          r.submittedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.match.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredReports(filtered);
  }, [reports, searchTerm, filterType, filterStatus]);

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "incident":
        return "warning";
      case "redcard":
      case "red_card":
        return "danger";
      case "result":
        return "info";
      case "performance":
        return "success";
      default:
        return "outline";
    }
  };

  // ✅ Load full details
  const openDetails = async (report: Report) => {
    try {
      let ref;
      if (report.type === "result") ref = doc(db, "results", report.id);
      else if (report.type === "performance")
        ref = doc(db, "coachReports", report.id);
      else ref = doc(db, "reports", report.id);

      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        setSelectedReport({
          id: report.id,
          type: report.type,
          ...snapshot.data(),
        });
      } else setSelectedReport(report);
    } catch (err) {
      console.error("Error fetching details:", err);
      setSelectedReport(report);
    }
  };

  // ✅ Mark as reviewed
  const markReviewed = async (id: string, type: string) => {
    const ref =
      type === "result"
        ? doc(db, "results", id)
        : type === "performance"
        ? doc(db, "coachReports", id)
        : doc(db, "reports", id);
    try {
      await updateDoc(ref, { reviewed: true, reviewStatus: "reviewed" });
      setSelectedReport((prev: any) =>
        prev ? { ...prev, reviewed: true, reviewStatus: "reviewed" } : prev
      );
    } catch (err) {
      console.error("Error marking reviewed:", err);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">
        Reports & Results Repository
      </h2>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center">
        <input
          type="text"
          placeholder="Search by referee or match..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/3 border rounded-lg px-4 py-2"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full md:w-1/4 border rounded-lg px-4 py-2"
        >
          <option value="all">All Types</option>
          <option value="incident">Incident</option>
          <option value="redcard">Red Card</option>
          <option value="result">Result</option>
          <option value="performance">Performance</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full md:w-1/4 border rounded-lg px-4 py-2"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.length === 0 ? (
          <Card>
            <p className="text-center text-gray-500 py-6">
              No reports or results found.
            </p>
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card
              key={report.id}
              className="hover:border-emerald-500 border-2 border-transparent cursor-pointer transition-all"
              onClick={() => openDetails(report)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getTypeColor(report.type) as any}>
                      {report.type.toUpperCase()}
                    </Badge>
                    <Badge
                      variant={
                        report.status === "reviewed" ? "success" : "warning"
                      }
                    >
                      {report.status}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-gray-900">{report.match}</h4>
                  <p className="text-sm text-gray-600">
                    👤 {report.submittedBy}
                  </p>
                  <p className="text-sm text-gray-500">📅 {report.date}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 relative overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold mb-4 text-gray-900">
              🧾 {selectedReport.type?.toUpperCase()} Report
            </h3>

            {/* Result Report */}
            {selectedReport.type === "result" ? (
              <>
                <p>
                  <strong>Match:</strong> {selectedReport.homeTeam} vs{" "}
                  {selectedReport.awayTeam}
                </p>
                <p>
                  <strong>Venue:</strong> {selectedReport.venue || "N/A"}
                </p>
                <p>
                  <strong>Score:</strong> {selectedReport.homeScore} -{" "}
                  {selectedReport.awayScore}
                </p>
                {selectedReport.notes && (
                  <p className="mt-2">
                    <strong>Notes:</strong> {selectedReport.notes}
                  </p>
                )}
              </>
            ) : (
              <>
                {selectedReport.details && (
                  <p className="whitespace-pre-line text-gray-800">
                    {selectedReport.details}
                  </p>
                )}
                {selectedReport.cardType && (
                  <p className="text-sm text-emerald-700 font-semibold">
                    🟥 Card Type: {selectedReport.cardType}
                  </p>
                )}
                {selectedReport.lawInfringed && (
                  <p className="text-sm text-emerald-700 font-semibold">
                    ⚖️ Law Infringed: {selectedReport.lawInfringed}
                  </p>
                )}
                {selectedReport.matchDate && (
                  <p className="text-sm text-gray-600 mt-2">
                    📅 Match Date: {selectedReport.matchDate}
                  </p>
                )}
                {selectedReport.venue && (
                  <p className="text-sm text-gray-600">🏟️ Venue: {selectedReport.venue}</p>
                )}
                {selectedReport.refereeName && (
                  <p className="text-sm text-gray-600">
                    👨‍⚖️ Referee: {selectedReport.refereeName}
                  </p>
                )}
              </>
            )}

            <div className="flex justify-end mt-6 gap-2">
              {!selectedReport.reviewed && (
                <Button
                  onClick={() =>
                    markReviewed(selectedReport.id, selectedReport.type)
                  }
                >
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
