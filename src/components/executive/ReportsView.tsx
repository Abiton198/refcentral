import React, { useEffect, useState } from "react";
import { db, auth } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { toast } from "@/components/ui/use-toast";

interface Report {
  id: string;
  type: string;
  submittedBy: string;
  match: string;
  date: string;
  status: string;
  source: "referee" | "coach" | "result";
}

export const ReportsView: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Fetch all reports
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
          source: "referee" as const,
        };
      });
      setReports((prev) => {
        const others = prev.filter((r) => r.source !== "referee");
        return [...others, ...refs];
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
          source: "coach" as const,
        };
      });
      setReports((prev) => {
        const others = prev.filter((r) => r.source !== "coach");
        return [...others, ...coaches];
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
          source: "result" as const,
        };
      });
      setReports((prev) => {
        const others = prev.filter((r) => r.source !== "result");
        return [...others, ...results];
      });
    });

    return () => {
      unsubRef();
      unsubCoach();
      unsubResults();
    };
  }, []);

  // Filters + Search
  useEffect(() => {
    let filtered = [...reports];
    if (filterType !== "all") {
      filtered = filtered.filter((r) => r.type.toLowerCase() === filterType.toLowerCase());
    }
    if (filterStatus !== "all") {
      filtered = filtered.filter((r) => r.status.toLowerCase() === filterStatus.toLowerCase());
    }
    if (searchTerm.trim()) {
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
      case "card_report":
      case "redcard":
      case "red_card":
        return "danger";
      case "general_report":
      case "incident":
        return "warning";
      case "result":
        return "info";
      case "coaching_report":
      case "performance":
        return "success";
      default:
        return "outline";
    }
  };

  // Load full report details
  const openDetails = async (report: Report) => {
    try {
      let ref;
      let collectionName = "";

      if (report.source === "result") {
        ref = doc(db, "results", report.id);
        collectionName = "results";
      } else if (report.source === "coach") {
        ref = doc(db, "coachReports", report.id);
        collectionName = "coachReports";
      } else {
        ref = doc(db, "reports", report.id);
        collectionName = "reports";
      }

      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSelectedReport({
          id: report.id,
          type: report.type,
          source: report.source,
          collection: collectionName,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        });
      } else {
        toast({
          title: "Not Found",
          description: "Report not found in database.",
          variant: "destructive",
        });
        setSelectedReport(null);
      }
    } catch (err: any) {
      console.error("Error fetching report:", err);
      toast({
        title: "Access Denied",
        description: err.message.includes("permission") 
          ? "You don't have permission to view this report."
          : "Failed to load report details.",
        variant: "destructive",
      });
      setSelectedReport(null);
    }
  };

  // Mark as reviewed
  const markReviewed = async (id: string, source: string) => {
    let ref;
    if (source === "result") ref = doc(db, "results", id);
    else if (source === "coach") ref = doc(db, "coachReports", id);
    else ref = doc(db, "reports", id);

    try {
      await updateDoc(ref, {
        reviewed: true,
        reviewStatus: "reviewed",
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid || "executive",
      });

      setSelectedReport((prev: any) =>
        prev ? { ...prev, reviewed: true, reviewStatus: "reviewed" } : prev
      );

      toast({ title: "Marked as Reviewed" });
    } catch (err: any) {
      console.error("Error marking reviewed:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update status.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        Reports & Results Repository
      </h2>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or match..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/3 border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full md:w-1/4 border rounded-lg px-4 py-2 text-sm"
        >
          <option value="all">All Types</option>
          <option value="card_report">Card Report</option>
          <option value="general_report">Incident</option>
          <option value="coaching_report">Coaching</option>
          <option value="result">Match Result</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full md:w-1/4 border rounded-lg px-4 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      {/* Report Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.length === 0 ? (
          <Card className="col-span-full">
            <p className="text-center text-gray-500 py-8">
              No reports or results found.
            </p>
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card
              key={report.id}
              className="hover:border-emerald-500 border-2 border-transparent cursor-pointer transition-all p-4"
              onClick={() => openDetails(report)}
            >
              <div className="flex justify-between items-start mb-2">
                <Badge variant={getTypeColor(report.type) as any}>
                  {report.type.replace(/_/g, " ").toUpperCase()}
                </Badge>
                <Badge variant={report.status === "reviewed" ? "success" : "warning"}>
                  {report.status}
                </Badge>
              </div>
              <h4 className="font-bold text-gray-900 text-lg">{report.match}</h4>
              <p className="text-sm text-gray-600">By {report.submittedBy}</p>
              <p className="text-xs text-gray-500 mt-1">{report.date}</p>
            </Card>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {selectedReport.type.replace(/_/g, " ").toUpperCase()} REPORT
              </h3>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Match Result */}
            {selectedReport.type === "result" ? (
              <div className="space-y-3 text-gray-700">
                <p><strong>Match:</strong> {selectedReport.homeTeam} vs {selectedReport.awayTeam}</p>
                <p><strong>Score:</strong> {selectedReport.homeScore} - {selectedReport.awayScore}</p>
                <p><strong>Venue:</strong> {selectedReport.venue || "N/A"}</p>
                {selectedReport.notes && (
                  <p className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <strong>Notes:</strong> {selectedReport.notes}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-gray-700">
                {/* Card Report */}
                {selectedReport.cardType && (
                  <p className="text-lg font-semibold text-red-600">
                    Card: {selectedReport.cardType}
                  </p>
                )}
                {selectedReport.playerFullName && (
                  <p><strong>Player:</strong> {selectedReport.playerFullName} ({selectedReport.playerTeam})</p>
                )}
                {selectedReport.lawInfringements && selectedReport.lawInfringements.length > 0 && (
                  <p><strong>Law Infringements:</strong> {selectedReport.lawInfringements.join(", ")}</p>
                )}
                {selectedReport.offenceDescription && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg whitespace-pre-line">
                    <strong>Description:</strong> {selectedReport.offenceDescription}
                  </div>
                )}
                {selectedReport.details && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg whitespace-pre-line">
                    <strong>Details:</strong> {selectedReport.details}
                  </div>
                )}
                <div className="text-sm text-gray-600 space-y-1 mt-4">
                  {selectedReport.matchDate && <p><strong>Date:</strong> {selectedReport.matchDate}</p>}
                  {selectedReport.venue && <p><strong>Venue:</strong> {selectedReport.venue}</p>}
                  {selectedReport.refereeName && <p><strong>Referee:</strong> {selectedReport.refereeName}</p>}
                  {selectedReport.coachName && <p><strong>Coach:</strong> {selectedReport.coachName}</p>}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              {!selectedReport.reviewed && !selectedReport.reviewStatus?.includes("reviewed") && (
                <Button
                  onClick={() => markReviewed(selectedReport.id, selectedReport.source)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Mark as Reviewed
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