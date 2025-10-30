import React, { useEffect, useState, useMemo, useRef } from "react";
import { db, auth } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { Printer, MessageSquare, X } from "lucide-react";

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
  executiveComment?: string;
}

export const ReportsTab: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [comment, setComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "reviewed">("all");
  const [filterRef, setFilterRef] = useState("");
  const [filterType, setFilterType] = useState("");

  const printRef = useRef<HTMLDivElement>(null);

  // Real-time listener
  useEffect(() => {
    const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();

        const [homeTeam, awayTeam] = d.teams?.includes(" vs ")
          ? d.teams.split(" vs ")
          : [d.homeTeam || "Home", d.awayTeam || "Away"];

        return {
          id: docSnap.id,
          referee: d.referee || d.refereeName || "Unknown Referee",
          refereeEmail: d.refereeEmail || "",
          type: d.type || "general_report",
          lawBroken: d.lawBroken || d.lawInfringed || d.cardType || "",
          description: d.description || d.details || d.offenceDescription || "",
          timeOfIncident: d.timeOfIncident || d.minute || d.elapsedTime || "",
          matchDetails: {
            homeTeam,
            awayTeam,
            venue: d.venue || "Unknown Venue",
            date: d.matchDate || "",
            time: d.matchTime || "",
          },
          createdAt: d.createdAt,
          reviewed: d.reviewed || false,
          executiveComment: d.executiveComment || "",
        } as Report;
      });
      setReports(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Mark as reviewed
  const handleMarkReviewed = async (id: string) => {
    try {
      await updateDoc(doc(db, "reports", id), {
        reviewed: true,
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid,
      });
      setSelectedReport((prev) => (prev?.id === id ? { ...prev, reviewed: true } : prev));
      toast({ title: "Report marked as reviewed" });
    } catch (err) {
      console.error("Error updating report:", err);
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  // Save executive comment
  const handleSaveComment = async () => {
    if (!selectedReport || !comment.trim()) return;
    setSavingComment(true);
    try {
      await updateDoc(doc(db, "reports", selectedReport.id), {
        executiveComment: comment.trim(),
        updatedAt: serverTimestamp(),
      });
      setSelectedReport((prev) => prev ? { ...prev, executiveComment: comment.trim() } : prev);
      toast({ title: "Comment saved" });
      setComment("");
    } catch (err) {
      toast({ title: "Failed to save comment", variant: "destructive" });
    } finally {
      setSavingComment(false);
    }
  };

  // Print PDF
  const handlePrint = () => {
    if (!printRef.current || !selectedReport) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>${selectedReport.matchDetails?.homeTeam} vs ${selectedReport.matchDetails?.awayTeam}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .section { margin: 15px 0; }
            .label { font-weight: bold; }
            .comment { background: #f0f0f0; padding: 10px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Referee Report</h1>
            <h2>${selectedReport.matchDetails?.homeTeam} vs ${selectedReport.matchDetails?.awayTeam}</h2>
          </div>
          <div class="section">
            <span class="label">Referee:</span> ${selectedReport.referee}
          </div>
          <div class="section">
            <span class="label">Date:</span> ${selectedReport.matchDetails?.date}
          </div>
          <div class="section">
            <span class="label">Type:</span> ${selectedReport.type.replace(/_/g, " ").toUpperCase()}
          </div>
          <div class="section">
            <span class="label">Description:</span>
            <p style="white-space: pre-line;">${selectedReport.description}</p>
          </div>
          ${selectedReport.executiveComment ? `
            <div class="section">
              <span class="label">Executive Comment:</span>
              <div class="comment">${selectedReport.executiveComment}</div>
            </div>
          ` : ""}
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // Filters
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
        filterType === "" || r.type === filterType;

      return matchStatus && matchRef && matchType;
    });
  }, [reports, filterStatus, filterRef, filterType]);

  // Badge
  const getTypeBadge = (type: string) => {
    switch (type) {
      case "card_report":
        return <Badge variant="danger">Red Card</Badge>;
      case "general_report":
        return <Badge variant="warning">Incident</Badge>;
      case "coaching_report":
        return <Badge variant="success">Coaching</Badge>;
      default:
        return <Badge variant="outline">General</Badge>;
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
            Click a card to view details, comment, or export as PDF.
          </p>
        </div>

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

      {/* Filters */}
      <div className="flex flex-col md:flex-row flex-wrap gap-4 items-end">
        <div className="flex flex-col space-y-1 w-full md:w-1/3">
          <label className="text-sm font-semibold text-gray-600">Filter by Referee</label>
          <input
            type="text"
            placeholder="Name or email..."
            value={filterRef}
            onChange={(e) => setFilterRef(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>

        <div className="flex flex-col space-y-1 w-full md:w-1/4">
          <label className="text-sm font-semibold text-gray-600">Filter by Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          >
            <option value="">All Types</option>
            <option value="card_report">Red Card</option>
            <option value="general_report">Incident</option>
            <option value="coaching_report">Coaching</option>
          </select>
        </div>

        <Button variant="outline" onClick={resetFilters} className="h-10">
          Reset
        </Button>
      </div>

      {/* Report Cards */}
      {loading ? (
        <p className="text-center py-8 text-gray-500 animate-pulse">Loading reports...</p>
      ) : filteredReports.length === 0 ? (
        <p className="text-center py-8 text-gray-500">No reports found.</p>
      ) : (
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="rounded-lg border bg-white p-4 hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer select-none"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedReport(report);
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  {getTypeBadge(report.type)}
                  {report.reviewed && <Badge variant="success">Reviewed</Badge>}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {report.matchDetails?.homeTeam || "Unknown"} vs {report.matchDetails?.awayTeam || "Unknown"}
              </h3>
              <p className="text-sm text-gray-600">{report.matchDetails?.venue || "Unknown Venue"}</p>
              <p className="text-sm text-gray-600 mb-2">
                {report.matchDetails?.date || "N/A"}{" "}
                {report.matchDetails?.time ? `• ${report.matchDetails.time}` : ""}
              </p>
              <p className="text-sm text-gray-600">{report.referee}</p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
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
              <h3 className="text-2xl font-bold text-emerald-700">Match Report</h3>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Print Area */}
            <div ref={printRef} className="print-content">
              <div className="bg-gray-50 border rounded-lg p-4 text-sm space-y-2 mb-4">
                <p><strong>Match:</strong> {selectedReport.matchDetails?.homeTeam} vs {selectedReport.matchDetails?.awayTeam}</p>
                <p><strong>Venue:</strong> {selectedReport.matchDetails?.venue}</p>
                <p><strong>Date:</strong> {selectedReport.matchDetails?.date}</p>
                <p><strong>Time:</strong> {selectedReport.matchDetails?.time}</p>
              </div>

              <div className="space-y-3 text-gray-800">
                <p><strong>Type:</strong> {selectedReport.type.replace(/_/g, " ").toUpperCase()}</p>
                {selectedReport.lawBroken && <p><strong>Law:</strong> {selectedReport.lawBroken}</p>}
                {selectedReport.timeOfIncident && <p><strong>Time:</strong> {selectedReport.timeOfIncident}</p>}

                <div>
                  <strong>Description:</strong>
                  <p className="mt-1 p-3 bg-gray-50 rounded-lg whitespace-pre-line border">
                    {selectedReport.description}
                  </p>
                </div>

                {selectedReport.executiveComment && (
                  <div>
                    <strong>Executive Comment:</strong>
                    <p className="mt-1 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      {selectedReport.executiveComment}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t text-sm text-gray-600">
                <p><strong>Referee:</strong> {selectedReport.referee}</p>
                <p>{selectedReport.refereeEmail}</p>
              </div>
            </div>

            {/* Executive Comment Input */}
            <div className="mt-6 space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Add Executive Comment
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add your feedback or action items..."
                className="w-full border rounded-lg p-3 text-sm resize-none h-24"
              />
              <Button
                onClick={handleSaveComment}
                disabled={savingComment || !comment.trim()}
                className="w-full"
              >
                {savingComment ? "Saving..." : "Save Comment"}
              </Button>
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-6 gap-2">
              <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
                <Printer className="w-4 h-4" /> Print / PDF
              </Button>

              <div className="flex gap-2">
                {!selectedReport.reviewed && (
                  <Button onClick={() => handleMarkReviewed(selectedReport.id)}>
                    Mark as Reviewed
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedReport(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};