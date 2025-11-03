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
import { Printer, MessageSquare, X, User, Shield } from "lucide-react";

interface Report {
  id: string;
  collection: "reports" | "coachReports"; // Track source
  referee?: string;
  refereeEmail?: string;
  coachName?: string;
  coachEmail?: string;
  type: string;
  lawBroken?: string;
  description: string;
  timeOfIncident?: string;
  homeTeam?: string;
  awayTeam?: string;
  venue?: string;
  matchDate?: string;
  matchTime?: string;
  createdAt?: any;
  reviewed?: boolean;
  executiveComment?: string;
  source: "referee" | "coach";
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
  const [filterSource, setFilterSource] = useState<"all" | "referee" | "coach">("all");

  const printRef = useRef<HTMLDivElement>(null);

  // Listen to BOTH collections
 useEffect(() => {
  const reportsQuery = query(collection(db, "reports"), orderBy("createdAt", "desc"));
  const coachReportsQuery = query(collection(db, "coachReports"), orderBy("createdAt", "desc"));

  const unsub1 = onSnapshot(reportsQuery, (snap) => {
    const data = snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        collection: "reports" as const,
        referee: d.referee || d.refereeName || "Unknown Referee",
        refereeEmail: d.refereeEmail || "",
        type: d.type || "general_report",
        lawBroken: d.lawBroken || d.lawInfringed || d.cardType || "",
        description: d.description || d.details || d.offenceDescription || "",
        timeOfIncident: d.timeOfIncident || d.minute || "",
        homeTeam: d.homeTeam || (d.teams?.split?.(" vs ")?.[0]) || "Unknown",
        awayTeam: d.awayTeam || (d.teams?.split?.(" vs ")?.[1]) || "Unknown",
        venue: d.venue || "Unknown Venue",
        matchDate: d.matchDate || "",
        matchTime: d.matchTime || "",
        createdAt: d.createdAt,
        reviewed: d.reviewed || false,
        executiveComment: d.executiveComment || "",
        source: "referee" as const,
      };
    });
    updateReports(data, "referee");
  });

  const unsub2 = onSnapshot(coachReportsQuery, (snap) => {
    const data = snap.docs.map((docSnap) => {
      const d = docSnap.data();

      // Extract match string if no separate fields
      const matchStr = d.match || "";
      const teams = matchStr.includes(" vs ") ? matchStr.split(" vs ") : [matchStr, ""];

      return {
        id: docSnap.id,
        collection: "coachReports" as const,
        coachName: d.coachName || "Unknown Coach",
        coachEmail: d.coachEmail || "",
        type: d.reportType || "coaching_report",
        description:
          d.strengthsNotes ||
          d.notes ||
          Object.values(d)
            .filter((v) => typeof v === "string" && v.length > 20)
            .join("\n") ||
          "No notes",
        homeTeam: d.homeTeam || teams[0] || "Unknown",
        awayTeam: d.awayTeam || teams[1] || "Unknown",
        venue: d.venue || "Unknown Venue",
        matchDate: d.matchDate || "",
        matchTime: d.time || "",
        createdAt: d.createdAt,
        reviewed: d.reviewed || false,
        executiveComment: d.executiveComment || "",
        source: "coach" as const,
      };
    });
    updateReports(data, "coach");
  });

  const updateReports = (newData: any[], source: "referee" | "coach") => {
    setReports((prev) => {
      const filtered = prev.filter((r) => r.source !== source);
      return [...filtered, ...newData].sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });
    });
    if (loading) setLoading(false);
  };

  return () => {
    unsub1();
    unsub2();
  };
}, []);
  // Mark as reviewed
  const handleMarkReviewed = async (report: Report) => {
    try {
      await updateDoc(doc(db, report.collection, report.id), {
        reviewed: true,
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid,
      });
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id && r.collection === report.collection
            ? { ...r, reviewed: true }
            : r
        )
      );
      setSelectedReport((prev) =>
        prev?.id === report.id ? { ...prev, reviewed: true } : prev
      );
      toast({ title: "Report marked as reviewed" });
    } catch (err) {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  // Save comment
  const handleSaveComment = async () => {
    if (!selectedReport || !comment.trim()) return;
    setSavingComment(true);
    try {
      await updateDoc(doc(db, selectedReport.collection, selectedReport.id), {
        executiveComment: comment.trim(),
        updatedAt: serverTimestamp(),
      });
      setReports((prev) =>
        prev.map((r) =>
          r.id === selectedReport.id && r.collection === selectedReport.collection
            ? { ...r, executiveComment: comment.trim() }
            : r
        )
      );
      setSelectedReport((prev) =>
        prev ? { ...prev, executiveComment: comment.trim() } : prev
      );
      toast({ title: "Comment saved" });
      setComment("");
    } catch (err) {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSavingComment(false);
    }
  };

  // Print
  const handlePrint = () => {
    if (!printRef.current || !selectedReport) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const submittedBy = selectedReport.source === "coach" ? selectedReport.coachName : selectedReport.referee;

    const html = `
      <html><head><title>Report</title>
      <style>
        bodyody { font-family: Arial; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .section { margin: 15px 0; }
        .label { font-weight: bold; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .coach { background: #10b981; color: white; }
        .ref { background: #3b82f6; color: white; }
      </style></head><body>
        <div class="header">
          <h1>${selectedReport.source === "coach" ? "COACHING" : "REFEREE"} REPORT</h1>
          <h2>${selectedReport.homeTeam} vs ${selectedReport.awayTeam}</h2>
        </div>
        <div class="section"><span class="label">Submitted By:</span> ${submittedBy}</div>
        <div class="section"><span class="label">Date:</span> ${selectedReport.matchDate}</div>
        <div class="section"><span class="label">Venue:</span> ${selectedReport.venue}</div>
        <div class="section"><span class="label">Type:</span> ${selectedReport.type.replace(/_/g, " ").toUpperCase()}</div>
        <div class="section"><span class="label">Details:</span><p style="white-space: pre-line; margin-top: 8px;">${selectedReport.description}</p></div>
        ${selectedReport.executiveComment ? `<div class="section"><span class="label">Executive Comment:</span><p style="background:#f3f4f6;padding:10px;border-radius:8px;margin-top:8px;">${selectedReport.executiveComment}</p></div>` : ""}
      </body></html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // Filters
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchStatus = filterStatus === "all" ? true : filterStatus === "pending" ? !r.reviewed : r.reviewed;
      const searchTerm = filterRef.toLowerCase();
      const matchRef =
        filterRef.trim() === "" ||
        (r.source === "referee" &&
          (r.referee?.toLowerCase().includes(searchTerm) || r.refereeEmail?.toLowerCase().includes(searchTerm))) ||
        (r.source === "coach" &&
          (r.coachName?.toLowerCase().includes(searchTerm) || r.coachEmail?.toLowerCase().includes(searchTerm)));
      const matchType = filterType === "" || r.type === filterType;
      const matchSource = filterSource === "all" || r.source === filterSource;
      return matchStatus && matchRef && matchType && matchSource;
    });
  }, [reports, filterStatus, filterRef, filterType, filterSource]);

  const getTypeBadge = (type: string) => {
    const map: Record<string, { label: string; variant: any }> = {
      card_report: { label: "CARD", variant: "danger" },
      general_report: { label: "INCIDENT", variant: "warning" },
      coaching_report: { label: "COACHING", variant: "success" },
      junior_coaching: { label: "JUNIOR", variant: "emerald" },
      senior_coaching: { label: "SENIOR", variant: "blue" },
    };
    const def = map[type] || { label: type.toUpperCase(), variant: "outline" };
    return <Badge variant={def.variant}>{def.label}</Badge>;
  };

  const resetFilters = () => {
    setFilterStatus("all");
    setFilterRef("");
    setFilterType("");
    setFilterSource("all");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">All Reports</h2>
          <p className="text-gray-500 text-sm">Referee and coaching reports in one place</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={filterStatus === "all" ? "default" : "outline"} onClick={() => setFilterStatus("all")}>All</Button>
          <Button variant={filterStatus === "pending" ? "default" : "outline"} onClick={() => setFilterStatus("pending")}>Pending</Button>
          <Button variant={filterStatus === "reviewed" ? "default" : "outline"} onClick={() => setFilterStatus("reviewed")}>Reviewed</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="text-sm font-semibold text-gray-600">Search Name/Email</label>
          <input
            type="text"
            placeholder="Referee or coach..."
            value={filterRef}
            onChange={(e) => setFilterRef(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 mt-1"
          />
        </div>
        <div className="w-48">
          <label className="text-sm font-semibold text-gray-600">Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 mt-1"
          >
            <option value="">All</option>
            <option value="card_report">Card</option>
            <option value="general_report">Incident</option>
            <option value="coaching_report">Coaching</option>
            <option value="junior_coaching">Junior</option>
            <option value="senior_coaching">Senior</option>
          </select>
        </div>
        <div className="w-48">
          <label className="text-sm font-semibold text-gray-600">Source</label>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as any)}
            className="w-full border rounded-lg px-4 py-2 mt-1"
          >
            <option value="all">All</option>
            <option value="referee">Referee</option>
            <option value="coach">Coach</option>
          </select>
        </div>
        <Button variant="outline" onClick={resetFilters}>Reset</Button>
      </div>

      {/* Cards */}
      {loading ? (
        <p className="text-center py-8 text-gray-500 animate-pulse">Loading...</p>
      ) : filteredReports.length === 0 ? (
        <p className="text-center py-8 text-gray-500">No reports found.</p>
      ) : (
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredReports.map((report) => {
            const submittedBy = report.source === "coach" ? report.coachName : report.referee;
            return (
              <div
                key={`${report.collection}-${report.id}`}
                className="rounded-xl border bg-white p-5 hover:shadow-xl transition-all cursor-pointer"
                onClick={() => setSelectedReport(report)}
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {getTypeBadge(report.type)}
                    {report.reviewed && <Badge variant="success">Reviewed</Badge>}
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium">
                    {report.source === "coach" ? (
                      <>
                        <User className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-600">COACH</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span className="text-blue-600">REFEREE</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Match */}
                <h3 className="text-lg font-bold text-gray-900">
                  {report.homeTeam} vs {report.awayTeam}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {report.venue} • {report.matchDate && format(new Date(report.matchDate), "dd MMM yyyy")}
                </p>

                {/* Submitted By */}
                <p className="text-sm text-gray-700 mt-2">
                  <strong>{report.source === "coach" ? "Coach" : "Referee"}:</strong> {submittedBy}
                </p>

                {/* Timestamp */}
                <p className="text-xs text-gray-500 mt-3">
                  {report.createdAt && format(report.createdAt.toDate(), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedReport(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-5">
              <h3 className="text-2xl font-bold text-emerald-700">
                {selectedReport.source === "coach" ? "COACHING" : "REFEREE"} REPORT
              </h3>
              <button onClick={() => setSelectedReport(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div ref={printRef}>
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border rounded-xl p-5 mb-5">
                <p><strong>Match:</strong> {selectedReport.homeTeam} vs {selectedReport.awayTeam}</p>
                <p><strong>Venue:</strong> {selectedReport.venue}</p>
                <p><strong>Date:</strong> {selectedReport.matchDate && format(new Date(selectedReport.matchDate), "dd MMMM yyyy")}</p>
                <p><strong>Time:</strong> {selectedReport.matchTime || "N/A"}</p>
              </div>

              <div className="space-y-4 text-gray-800">
                <p><strong>Type:</strong> {selectedReport.type.replace(/_/g, " ").toUpperCase()}</p>
                {selectedReport.lawBroken && <p><strong>Law Broken:</strong> {selectedReport.lawBroken}</p>}
                {selectedReport.timeOfIncident && <p><strong>Time of Incident:</strong> {selectedReport.timeOfIncident}</p>}

                <div>
                  <strong>{selectedReport.source === "coach" ? "Coaching Notes" : "Description"}:</strong>
                  <p className="mt-2 p-4 bg-gray-50 rounded-lg border whitespace-pre-line">
                    {selectedReport.description}
                  </p>
                </div>

                {selectedReport.executiveComment && (
                  <div>
                    <strong>Executive Comment:</strong>
                    <p className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      {selectedReport.executiveComment}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t text-sm text-gray-600">
                <p><strong>Submitted By:</strong> {selectedReport.source === "coach" ? selectedReport.coachName : selectedReport.referee}</p>
                <p>{selectedReport.source === "coach" ? selectedReport.coachEmail : selectedReport.refereeEmail}</p>
              </div>
            </div>

            {/* Comment */}
            <div className="mt-6 space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Executive Comment
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add feedback, action items..."
                className="w-full border rounded-lg p-3 text-sm resize-none h-28"
              />
              <Button onClick={handleSaveComment} disabled={savingComment || !comment.trim()} className="w-full">
                {savingComment ? "Saving..." : "Save Comment"}
              </Button>
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-6 gap-3">
              <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
                <Printer className="w-4 h-4" /> Print / PDF
              </Button>
              <div className="flex gap-2">
                {!selectedReport.reviewed && (
                  <Button onClick={() => handleMarkReviewed(selectedReport)}>Mark Reviewed</Button>
                )}
                <Button variant="outline" onClick={() => setSelectedReport(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};