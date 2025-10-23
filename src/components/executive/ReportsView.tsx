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
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // ✅ Fetch data from Firestore (reports, coachReports, results)
  useEffect(() => {
    const refReportsQuery = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const coachReportsQuery = query(collection(db, "coachReports"), orderBy("createdAt", "desc"));
    const resultsQuery = query(collection(db, "results"), orderBy("submittedAt", "desc"));

    const unsubRef = onSnapshot(refReportsQuery, (snap) => {
      const refs = snap.docs.map((doc) => ({
        id: doc.id,
        type: doc.data().type || "incident",
        submittedBy: doc.data().refereeName || "Unknown Referee",
        match: doc.data().teams || "N/A",
        date: doc.data().matchDate || "",
        status: doc.data().reviewStatus || "pending",
      }));
      setReports((prev) => {
        const others = prev.filter((r) => !r.type.includes("referee"));
        return [...others, ...refs];
      });
    });

    const unsubCoach = onSnapshot(coachReportsQuery, (snap) => {
      const coaches = snap.docs.map((doc) => ({
        id: doc.id,
        type: doc.data().reportType || "performance",
        submittedBy: doc.data().coachName || "Unknown Coach",
        match: `${doc.data().homeTeam || ""} vs ${doc.data().awayTeam || ""}`.trim(),
        date: doc.data().matchDate || "",
        status: doc.data().reviewStatus || "pending",
      }));
      setReports((prev) => {
        const others = prev.filter((r) => !r.submittedBy.startsWith("Coach"));
        return [...others, ...coaches];
      });
    });

    const unsubResults = onSnapshot(resultsQuery, (snap) => {
      const results = snap.docs.map((doc) => ({
        id: doc.id,
        type: "result",
        submittedBy: doc.data().referee || "Unknown Referee",
        match: `${doc.data().homeTeam || ""} vs ${doc.data().awayTeam || ""}`.trim(),
        date: doc.data().submittedAt
          ? new Date(doc.data().submittedAt).toLocaleString()
          : "—",
        status: "reviewed",
      }));
      setReports((prev) => {
        const nonResults = prev.filter((r) => r.type !== "result");
        return [...nonResults, ...results];
      });
    });

    return () => {
      unsubRef();
      unsubCoach();
      unsubResults();
    };
  }, []);

  // ✅ Apply filters + search
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
  }, [searchTerm, filterType, filterStatus, reports]);

  // ✅ Type color
  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "incident":
        return "warning";
      case "redcard":
        return "danger";
      case "result":
        return "info";
      case "performance":
        return "success";
      default:
        return "outline";
    }
  };

  // ✅ Fetch full report details
  const openDetails = async (report: Report) => {
    try {
      if (report.type === "result") {
        const ref = doc(db, "results", report.id);
        const snapshot = await getDoc(ref);
        if (snapshot.exists()) {
          setSelectedReport({ id: report.id, type: "result", ...snapshot.data() });
        } else {
          setSelectedReport(report);
        }
      } else {
        const ref = doc(db, "reports", report.id);
        const snapshot = await getDoc(ref);
        if (snapshot.exists()) {
          setSelectedReport({ id: report.id, ...snapshot.data() });
        } else {
          setSelectedReport(report);
        }
      }
    } catch (err) {
      console.error("Error loading report details:", err);
      setSelectedReport(report);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-gray-900">Reports & Results Repository</h3>

      {/* 🔍 Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or match..."
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
          <option value="redCard">Red Card</option>
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

      {/* 🧾 Cards */}
      <div className="space-y-3">
        {filteredReports.length === 0 ? (
          <Card>
            <p className="text-center text-gray-500 py-6">No reports or results found.</p>
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card
              key={report.id}
              onClick={() => openDetails(report)}
              className="hover:border-emerald-500 border-2 border-transparent cursor-pointer transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={getTypeColor(report.type) as any}>
                      {report.type.toUpperCase()}
                    </Badge>
                    <h4 className="font-bold text-gray-900">{report.match}</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Submitted by: {report.submittedBy}
                  </p>
                  <p className="text-sm text-gray-600">Date: {report.date}</p>
                </div>
                <Badge
                  variant={report.status === "reviewed" ? "success" : "warning"}
                >
                  {report.status}
                </Badge>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* 🪟 Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4 text-gray-900">
              {selectedReport.type?.toUpperCase() || "DETAILS"}
            </h3>

            {/* Result details */}
            {selectedReport.type === "result" ? (
              <>
                <p className="text-gray-700">
                  <strong>Match:</strong> {selectedReport.homeTeam} vs {selectedReport.awayTeam}
                </p>
                <p className="text-gray-700">
                  <strong>Venue:</strong> {selectedReport.venue}
                </p>
                <p className="text-gray-700">
                  <strong>Score:</strong> {selectedReport.homeScore} - {selectedReport.awayScore}
                </p>
                {selectedReport.notes && (
                  <p className="text-gray-700 mt-2">
                    <strong>Notes:</strong> {selectedReport.notes}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-4">
                  Submitted by {selectedReport.referee} on{" "}
                  {new Date(selectedReport.submittedAt).toLocaleString()}
                </p>
              </>
            ) : (
              <>
                {selectedReport.description && (
                  <p className="text-gray-700 mb-2 whitespace-pre-line">
                    {selectedReport.description}
                  </p>
                )}
                {selectedReport.lawBroken && (
                  <p className="text-sm text-emerald-700 font-semibold">
                    ⚖️ Law Broken: {selectedReport.lawBroken}
                  </p>
                )}
                {selectedReport.matchDate && (
                  <p className="text-sm text-gray-500 mt-3">
                    📅 Match Date: {selectedReport.matchDate}
                  </p>
                )}
              </>
            )}

            <div className="flex justify-end mt-6">
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
