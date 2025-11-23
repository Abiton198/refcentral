/*  ReportsTab.tsx – Executive Stats + Full Reports  */
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { toast } from "@/components/ui/use-toast";
import { format, startOfDay, isToday } from "date-fns";
import { Printer, MessageSquare, X, User, Shield, Flag, TrendingUp, FileCheck, Clock, CheckCircle } from "lucide-react";

type ReportSource = "referee" | "coach";

interface BaseReport {
  id: string;
  collection: "reports" | "coachReports";
  source: ReportSource;
  reviewed?: boolean;
  executiveComment?: string;
  createdAt?: any;
}

interface RefereeReport extends BaseReport {
  source: "referee";
  referee?: string;
  refereeEmail?: string;
  type: string;
  lawBroken?: string;
  description: string;
  timeOfIncident?: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  matchDate?: string;
  matchTime?: string;
}

interface CoachReport extends BaseReport {
  source: "coach";
  coachName?: string;
  coachEmail?: string;
  reportType: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  matchDate?: string;
  matchTime?: string;
  refereeName?: string;
  refereeEmail?: string;
  refereeId?: string;

  level?: string;
  strengthsNotes?: string;
  improvementAreas?: string[];
  commsFeedback?: string;
  whistleFeedback?: string;
  scrumFeedback?: string;
  scrumPens?: string | number;
  lineoutFeedback?: string;
  lineoutPens?: string | number;
  breakdownFeedback?: string;
  breakdownPens?: string | number;
  offsideFeedback?: string;
  spacePens?: string | number;
  foulPlayPens?: number;
  generalPlayPens?: number;
  penalties?: number;
  safetyFeedback?: string;
}

type Report = RefereeReport | CoachReport;

export const ReportsTab: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [comment, setComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "reviewed">("all");
  const [filterRef, setFilterRef] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | "referee" | "coach">("all");

  const printRef = useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------------ */
  /*  Real-time listeners – merge reports + appointments                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const qRef = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const qCoach = query(collection(db, "coachReports"), orderBy("createdAt", "desc"));
    const qAppts = query(collection(db, "appointments"));

    const unsubRef = onSnapshot(qRef, (snap) => {
      const data: RefereeReport[] = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          collection: "reports",
          source: "referee",
          referee: raw.referee || raw.refereeName || "Unknown Referee",
          refereeEmail: raw.refereeEmail || "",
          type: raw.type || "general_report",
          lawBroken: raw.lawBroken || raw.lawInfringed || raw.cardType || "",
          description: raw.description || raw.details || raw.offenceDescription || "No description",
          timeOfIncident: raw.timeOfIncident || raw.minute || "",
          homeTeam: raw.homeTeam || (raw.teams?.split?.(" vs ")?.[0]) || "Unknown",
          awayTeam: raw.awayTeam || (raw.teams?.split?.(" vs ")?.[1]) || "Unknown",
          playerName: raw.playerName || "",
          playerTeam: raw.playerTeam || "",
          venue: raw.venue || "Unknown Venue",
          lawNumber: raw.lawNumber || "",
          lawTitle: raw.lawTitle || "",
          lawExplanation: raw.lawExplanation || "",
          minute: raw.minute || "",
          matchDate: raw.matchDate || "",
          matchTime: raw.matchTime || "",
          createdAt: raw.createdAt,
          reviewed: raw.reviewed ?? false,
          executiveComment: raw.executiveComment || "",
        };
      });
      mergeReports(data, "referee");
    });

    const unsubCoach = onSnapshot(qCoach, (snap) => {
      const data: CoachReport[] = snap.docs.map((d) => {
        const raw = d.data();
        const teams = raw.match?.includes?.(" vs ") ? raw.match.split(" vs ") : [raw.homeTeam, raw.awayTeam];

        return {
          id: d.id,
          collection: "coachReports",
          source: "coach",
          coachName: raw.coachName || "Unknown Coach",
          coachEmail: raw.coachEmail || "",
          reportType: raw.reportType || "coaching_report",
          homeTeam: raw.homeTeam || teams[0] || "Unknown",
          awayTeam: raw.awayTeam || teams[1] || "Unknown",
          venue: raw.venue || "Unknown Venue",
          matchDate: raw.matchDate || raw.date || "",
          matchTime: raw.matchTime || raw.time || "",
          refereeName: raw.refereeName || raw.referee || "Unknown Referee",
          refereeEmail: raw.refereeEmail || "",
          refereeId: raw.refereeId || "",
          level: raw.level,
          strengthsNotes: raw.strengthsNotes,
          improvementAreas: raw.improvementAreas,
          commsFeedback: raw.commsFeedback,
          whistleFeedback: raw.whistleFeedback,
          scrumFeedback: raw.scrumFeedback,
          scrumPens: raw.scrumPens,
          lineoutFeedback: raw.lineoutFeedback,
          lineoutPens: raw.lineoutPens,
          breakdownFeedback: raw.breakdownFeedback,
          breakdownPens: raw.breakdownPens,
          offsideFeedback: raw.offsideFeedback,
          spacePens: raw.spacePens,
          foulPlayPens: raw.foulPlayPens,
          generalPlayPens: raw.generalPlayPens,
          penalties: raw.penalties,
          safetyFeedback: raw.safetyFeedback,
          createdAt: raw.createdAt,
          reviewed: raw.reviewed ?? false,
          executiveComment: raw.executiveComment || "",
        };
      });
      mergeReports(data, "coach");
    });

    const unsubAppts = onSnapshot(qAppts, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAppointments(data);
    });

    const mergeReports = (newBatch: Report[], src: ReportSource) => {
      setReports((prev) => {
        const withoutSrc = prev.filter((r) => r.source !== src);
        const combined = [...withoutSrc, ...newBatch];
        return combined.sort((a, b) => {
          const aT = a.createdAt?.toMillis?.() ?? 0;
          const bT = b.createdAt?.toMillis?.() ?? 0;
          return bT - aT;
        });
      });
      if (loading) setLoading(false);
    };

    return () => {
      unsubRef();
      unsubCoach();
      unsubAppts();
    };
  }, [loading]);

  /* ------------------------------------------------------------------ */
  /*  Executive Statistics                                              */
  /* ------------------------------------------------------------------ */
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const todayReports = reports.filter((r) => r.createdAt && isToday(r.createdAt.toDate()));

    const coachReports = reports.filter((r) => r.source === "coach");
    const refReports = reports.filter((r) => r.source === "referee");

    const pending = reports.filter((r) => !r.reviewed).length;
    const reviewed = reports.filter((r) => r.reviewed).length;

    const withComment = reports.filter((r) => !!r.executiveComment).length;

    const avgPenalties = coachReports.reduce((sum, r) => sum + (r.penalties || 0), 0) / (coachReports.length || 1);

    const typeCount = reports.reduce((acc, r) => {
      const type = r.source === "coach" ? (r as CoachReport).reportType : (r as RefereeReport).type;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const mostFrequentType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    const appointedCoaches = appointments.filter((a) => a.coachName).length;

    return {
      total: reports.length,
      today: todayReports.length,
      coach: coachReports.length,
      referee: refReports.length,
      pending,
      reviewed,
      withComment,
      avgPenalties: Math.round(avgPenalties),
      mostFrequentType,
      appointedCoaches,
    };
  }, [reports, appointments]);

  /* ------------------------------------------------------------------ */
  /*  Actions – review, comment, print                                   */
  /* ------------------------------------------------------------------ */
  const markReviewed = async (r: Report) => {
    try {
      await updateDoc(doc(db, r.collection, r.id), {
        reviewed: true,
        reviewedAt: serverTimestamp(),
        reviewedBy: auth.currentUser?.uid,
      });
      setReports((p) =>
        p.map((x) =>
          x.id === r.id && x.collection === r.collection ? { ...x, reviewed: true } : x
        )
      );
      setSelectedReport((s) => (s?.id === r.id ? { ...s, reviewed: true } : s));
      toast({ title: "Marked as reviewed" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const saveComment = async () => {
    if (!selectedReport || !comment.trim()) return;
    setSavingComment(true);
    try {
      await updateDoc(doc(db, selectedReport.collection, selectedReport.id), {
        executiveComment: comment.trim(),
        updatedAt: serverTimestamp(),
      });
      const newComment = comment.trim();
      setReports((p) =>
        p.map((x) =>
          x.id === selectedReport.id && x.collection === selectedReport.collection
            ? { ...x, executiveComment: newComment }
            : x
        )
      );
      setSelectedReport((s) => (s ? { ...s, executiveComment: newComment } : s));
      toast({ title: "Comment saved" });
      setComment("");
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    } finally {
      setSavingComment(false);
    }
  };

  const printReport = () => {
    if (!printRef.current || !selectedReport) return;
    const win = window.open("", "_blank");
    if (!win) return;

    const isCoach = selectedReport.source === "coach";
    const submitted = isCoach ? (selectedReport as CoachReport).coachName : (selectedReport as RefereeReport).referee;
    const refereeName = isCoach ? (selectedReport as CoachReport).refereeName : (selectedReport as RefereeReport).referee;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${isCoach ? "COACHING" : "REFEREE"} REPORT</title>
        <style>
          body{font-family:Arial,sans-serif;padding:20px;line-height:1.5;}
          h1,h2{margin:0 0 .5rem;}
          .section{margin:1rem 0;}
          .label{font-weight:bold;}
          .badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;color:#fff;}
          .coach{background:#10b981;}
          .ref{background:#3b82f6;}
          pre{white-space:pre-wrap;background:#f9fafb;padding:10px;border-radius:6px;}
        </style>
      </head>
      <body>
        <h1 class="badge ${isCoach ? "coach" : "ref"}">
          ${isCoach ? "COACHING" : "REFEREE"} REPORT
        </h1>
        <h2>${selectedReport.homeTeam} vs ${selectedReport.awayTeam}</h2>
        <div class="section"><span class="label">Referee:</span> ${refereeName}</div>
        <div class="section"><span class="label">Submitted by:</span> ${submitted}</div>
        <div class="section"><span class="label">Date / Time:</span> ${
          selectedReport.matchDate
            ? format(new Date(selectedReport.matchDate), "dd MMM yyyy")
            : ""
        } ${selectedReport.matchTime ? `@ ${selectedReport.matchTime}` : ""}</div>
        <div class="section"><span class="label">Venue:</span> ${selectedReport.venue}</div>
        ${isCoach ? renderCoachDetails(selectedReport as CoachReport) : ""}
        ${!isCoach ? renderRefereeDetails(selectedReport as RefereeReport) : ""}
        ${
          selectedReport.executiveComment
            ? `<div class="section"><span class="label">Executive comment:</span><pre>${selectedReport.executiveComment}</pre></div>`
            : ""
        }
      </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const renderCoachDetails = (r: CoachReport) => `
    <div class="section"><span class="label">Report type:</span> ${(r.reportType || "").replace(/_/g, " ")}</div>
    ${r.level ? `<div class="section"><span class="label">Level:</span> ${r.level}</div>` : ""}
    ${r.strengthsNotes ? `<div class="section"><span class="label">Strengths:</span><pre>${r.strengthsNotes}</pre></div>` : ""}
    ${Array.isArray(r.improvementAreas) && r.improvementAreas.length
      ? `<div class="section"><span class="label">Improvement areas:</span><pre>${r.improvementAreas.join("\n")}</pre></div>`
      : ""}
    ${r.commsFeedback ? `<div class="section"><span class="label">Communication:</span><pre>${r.commsFeedback}</pre></div>` : ""}
    ${r.whistleFeedback ? `<div class="section"><span class="label">Whistle:</span><pre>${r.whistleFeedback}</pre></div>` : ""}
    ${r.scrumFeedback ? `<div class="section"><span class="label">Scrum:</span><pre>${r.scrumFeedback}</pre></div>` : ""}
    ${r.scrumPens != null ? `<div class="section"><span class="label">Scrum penalties:</span> ${r.scrumPens}</div>` : ""}
    ${r.lineoutFeedback ? `<div class="section"><span class="label">Line-out:</span><pre>${r.lineoutFeedback}</pre></div>` : ""}
    ${r.lineoutPens != null ? `<div class="section"><span class="label">Line-out penalties:</span> ${r.lineoutPens}</div>` : ""}
    ${r.breakdownFeedback ? `<div class="section"><span class="label">Breakdown:</span><pre>${r.breakdownFeedback}</pre></div>` : ""}
    ${r.breakdownPens != null ? `<div class="section"><span class="label">Breakdown penalties:</span> ${r.breakdownPens}</div>` : ""}
    ${r.offsideFeedback ? `<div class="section"><span class="label">Offside:</span><pre>${r.offsideFeedback}</pre></div>` : ""}
    ${r.spacePens != null ? `<div class="section"><span class="label">Space penalties:</span> ${r.spacePens}</div>` : ""}
    ${r.foulPlayPens != null ? `<div class="section"><span class="label">Foul-play penalties:</span> ${r.foulPlayPens}</div>` : ""}
    ${r.generalPlayPens != null ? `<div class="section"><span class="label">General-play penalties:</span> ${r.generalPlayPens}</div>` : ""}
    ${r.penalties != null ? `<div class="section"><span class="label">Total penalties:</span> ${r.penalties}</div>` : ""}
    ${r.safetyFeedback ? `<div class="section"><span class="label">Safety:</span><pre>${r.safetyFeedback}</pre></div>` : ""}
  `;

  const renderRefereeDetails = (r: RefereeReport) => {
    // Safely extract the new/detailed fields using type assertion since the shared
    // interface might not define them, but the runtime data should have them.
    const reportData = r as any;
    const cardType = reportData.cardType || r.type;
    const lawNumber = reportData.lawNumber || r.lawBroken;
    const lawTitle = reportData.lawTitle || "N/A";
    const lawExplanation = reportData.lawExplanation || "N/A";
    const playerName = reportData.playerName;
    const playerTeam = reportData.playerTeam;
    const incidentMinute = reportData.minute || r.timeOfIncident;

    let detailsHtml = `
      <div class="section"><span class="label">Action Type:</span> ${cardType.replace(/_/g, " ").toUpperCase()}</div>
    `;

    // Player Details
    if (playerName || playerTeam) {
      detailsHtml += `
        <div class="section" style="border-left: 3px solid #f97316; padding-left: 10px; margin-top: 15px;">
          <h3 style="font-size: 14px; margin-bottom: 5px;">PLAYER DETAILS</h3>
          ${playerName ? `<div class="section"><span class="label">Player Name:</span> ${playerName}</div>` : ''}
          ${playerTeam ? `<div class="section"><span class="label">Player Team:</span> ${playerTeam}</div>` : ''}
        </div>
      `;
    }

    // Incident Time
    if (incidentMinute) {
      detailsHtml += `<div class="section"><span class="label">Time of Incident:</span> ${incidentMinute}</div>`;
    }

    // Law Details (if applicable)
    if (lawNumber && lawNumber !== "N/A") {
      detailsHtml += `
        <div class="section" style="border-left: 3px solid #3b82f6; padding-left: 10px; margin-top: 15px;">
          <h3 style="font-size: 14px; margin-bottom: 5px;">LAW INFRINGEMENT</h3>
          <div class="section">
            <span class="label">Law Broken:</span> ${lawNumber} — ${lawTitle}
          </div>
          <div class="section">
            <span class="label">Explanation:</span> ${lawExplanation}
          </div>
        </div>
      `;
    }

    // Description
    detailsHtml += `
      <div class="section">
        <span class="label">Referee's Description:</span>
        <pre>${r.description}</pre>
      </div>
    `;

    return detailsHtml;
  };

  /* ------------------------------------------------------------------ */
  /*  Filters                                                            */
  /* ------------------------------------------------------------------ */
  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const statusOk =
        filterStatus === "all" ||
        (filterStatus === "pending" && !r.reviewed) ||
        (filterStatus === "reviewed" && r.reviewed);

      const refOk =
        !filterRef ||
        (r.source === "referee" &&
          (r.referee?.toLowerCase().includes(filterRef.toLowerCase()) ||
            r.refereeEmail?.toLowerCase().includes(filterRef.toLowerCase()))) ||
        (r.source === "coach" &&
          (r.coachName?.toLowerCase().includes(filterRef.toLowerCase()) ||
            r.coachEmail?.toLowerCase().includes(filterRef.toLowerCase()) ||
            r.refereeName?.toLowerCase().includes(filterRef.toLowerCase())));

      const typeOk =
        !filterType ||
        (r.source === "referee" ? r.type === filterType : (r as CoachReport).reportType === filterType);

      const srcOk = filterSource === "all" || r.source === filterSource;

      return statusOk && refOk && typeOk && srcOk;
    });
  }, [reports, filterStatus, filterRef, filterType, filterSource]);

  /* ------------------------------------------------------------------ */
  /*  UI helpers                                                          */
  /* ------------------------------------------------------------------ */
  const badgeForType = (type: string) => {
    const map: Record<string, { label: string; variant: any }> = {
      card_report: { label: "CARD", variant: "danger" },
      general_report: { label: "INCIDENT", variant: "warning" },
      junior_coaching: { label: "JUNIOR", variant: "emerald" },
      senior_coaching: { label: "SENIOR", variant: "blue" },
      coaching_report: { label: "COACHING", variant: "success" },
    };
    const def = map[type] || { label: type.toUpperCase(), variant: "outline" };
    return <Badge variant={def.variant}>{def.label}</Badge>;
  };

  const reset = () => {
    setFilterStatus("all");
    setFilterRef("");
    setFilterType("");
    setFilterSource("all");
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* === EXECUTIVE STATS DASHBOARD === */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-xs">Total Reports</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <FileCheck className="w-8 h-8 text-blue-200" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-xs">Today</p>
              <p className="text-2xl font-bold">{stats.today}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-200" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-xs">Pending</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-200" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-500 to-pink-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-xs">Reviewed</p>
              <p className="text-2xl font-bold">{stats.reviewed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-purple-200" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cyan-100 text-xs">Appointed Coaches</p>
              <p className="text-2xl font-bold">{stats.appointedCoaches}</p>
            </div>
            <User className="w-8 h-8 text-cyan-200" />
          </div>
        </Card>
      </div>

      {/* === MINI STATS ROW === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="bg-gray-50 p-3 rounded-lg border">
          <p className="text-gray-600">Coaching Reports</p>
          <p className="font-bold text-lg">{stats.coach}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border">
          <p className="text-gray-600">Referee Reports</p>
          <p className="font-bold text-lg">{stats.referee}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border">
          <p className="text-gray-600">Avg Penalties</p>
          <p className="font-bold text-lg">{stats.avgPenalties}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border">
          <p className="text-gray-600">Most Frequent</p>
          <p className="font-bold text-sm truncate">{stats.mostFrequentType.replace(/_/g, " ")}</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">All Reports</h2>
          <p className="text-gray-500 text-sm">Referee & coaching reports</p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search name / email / referee
          </label>
          <input
            type="text"
            placeholder="Coach, referee, or email…"
            value={filterRef}
            onChange={(e) => setFilterRef(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as any)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="all">All</option>
            <option value="referee">Referee</option>
            <option value="coach">Coach</option>
          </select>
        </div>

        <Button variant="outline" onClick={reset}>
          Reset
        </Button>
      </div>

      {/* Cards */}
      {loading ? (
        <p className="text-center py-8 text-gray-500 animate-pulse">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center py-8 text-gray-500">No reports found.</p>
      ) : (
        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((r) => {
            const submitted = r.source === "coach" ? (r as CoachReport).coachName : (r as RefereeReport).referee;
            const refereeName = r.source === "coach" ? (r as CoachReport).refereeName : (r as RefereeReport).referee;

            return (
              <div
                key={`${r.collection}-${r.id}`}
                className="rounded-xl border bg-white p-5 hover:shadow-xl transition cursor-pointer"
                onClick={() => setSelectedReport(r)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {badgeForType(r.source === "coach" ? (r as CoachReport).reportType : r.type)}
                    {r.reviewed && <Badge variant="success">Reviewed</Badge>}
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium">
                    {r.source === "coach" ? (
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

                <h3 className="text-lg font-bold text-gray-900">
                  {r.homeTeam} vs {r.awayTeam}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {r.venue} • {r.matchDate && format(new Date(r.matchDate), "dd MMM yyyy")}
                </p>

                <p className="text-sm text-gray-700 mt-2">
                  <strong>{r.source === "coach" ? "Coach" : "Referee"}:</strong> {submitted}
                </p>

                <p className="text-sm text-gray-700 mt-1 flex items-center gap-1">
                  <Flag className="w-4 h-4 text-indigo-600" />
                  <strong>Referee:</strong> {refereeName}
                </p>

                <p className="text-xs text-gray-500 mt-3">
                  {r.createdAt && format(r.createdAt.toDate(), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedReport && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
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
                <p><strong>Referee:</strong> {
                  selectedReport.source === "coach"
                    ? (selectedReport as CoachReport).refereeName
                    : (selectedReport as RefereeReport).referee
                }</p>
                <p><strong>Venue:</strong> {selectedReport.venue}</p>
                <p><strong>Date:</strong> {selectedReport.matchDate && format(new Date(selectedReport.matchDate), "dd MMMM yyyy")}</p>
                <p><strong>Time:</strong> {selectedReport.matchTime || "N/A"}</p>
              </div>

              {selectedReport.source === "coach" ? (
                <CoachDetailView report={selectedReport as CoachReport} />
              ) : (
                <RefereeDetailView report={selectedReport as RefereeReport} />
              )}

              {selectedReport.executiveComment && (
                <div className="mt-5">
                  <strong>Executive comment:</strong>
                  <p className="mt-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    {selectedReport.executiveComment}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Executive comment
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add feedback, action items…"
                className="w-full border rounded-lg p-3 text-sm resize-none h-28"
              />
              <Button
                onClick={saveComment}
                disabled={savingComment || !comment.trim()}
                className="w-full"
              >
                {savingComment ? "Saving…" : "Save comment"}
              </Button>
            </div>

            <div className="flex justify-between mt-6 gap-3">
              <Button variant="outline" onClick={printReport} className="flex items-center gap-2">
                <Printer className="w-4 h-4" /> Print / PDF
              </Button>
              <div className="flex gap-2">
                {!selectedReport.reviewed && (
                  <Button onClick={() => markReviewed(selectedReport)}>Mark reviewed</Button>
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

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */
const CoachDetailView: React.FC<{ report: CoachReport }> = ({ report }) => (
  <div className="space-y-4 text-gray-800">
    <p><strong>Report type:</strong> {(report.reportType || "").replace(/_/g, " ").toUpperCase()}</p>
    {report.level && <p><strong>Level:</strong> {report.level}</p>}
    {report.strengthsNotes && (
      <div>
        <strong>Strengths:</strong>
        <p className="mt-1 p-3 bg-gray-50 rounded-lg border whitespace-pre-line">{report.strengthsNotes}</p>
      </div>
    )}
    {Array.isArray(report.improvementAreas) && report.improvementAreas.length > 0 && (
      <div>
        <strong>Improvement areas:</strong>
        <ul className="mt-1 p-3 bg-gray-50 rounded-lg border list-disc pl-6">
          {report.improvementAreas.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </div>
    )}
    {report.commsFeedback && <p><strong>Communication:</strong> <span className="block mt-1 p-2 bg-gray-50 rounded">{report.commsFeedback}</span></p>}
    {report.whistleFeedback && <p><strong>Whistle:</strong> <span className="block mt-1 p-2 bg-gray-50 rounded">{report.whistleFeedback}</span></p>}
    {report.scrumFeedback && <p><strong>Scrum:</strong> <span className="block mt-1 p-2 bg-gray-50 rounded">{report.scrumFeedback}</span></p>}
    {report.scrumPens != null && <p><strong>Scrum penalties:</strong> {report.scrumPens}</p>}
    {report.lineoutFeedback && <p><strong>Line-out:</strong> <span className="block mt-1 p-2 bg-gray-50 rounded">{report.lineoutFeedback}</span></p>}
    {report.lineoutPens != null && <p><strong>Line-out penalties:</strong> {report.lineoutPens}</p>}
    {report.breakdownFeedback && <p><strong>Breakdown:</strong> <span className="block mt-1 p-2 bg-gray-50 rounded">{report.breakdownFeedback}</span></p>}
    {report.breakdownPens != null && <p><strong>Breakdown penalties:</strong> {report.breakdownPens}</p>}
    {report.offsideFeedback && <p><strong>Offside:</strong> <span className="block mt-1 p-2 bg-gray-50 rounded">{report.offsideFeedback}</span></p>}
    {report.spacePens != null && <p><strong>Space penalties:</strong> {report.spacePens}</p>}
    {report.foulPlayPens != null && <p><strong>Foul-play penalties:</strong> {report.foulPlayPens}</p>}
    {report.generalPlayPens != null && <p><strong>General-play penalties:</strong> {report.generalPlayPens}</p>}
    {report.penalties != null && <p><strong>Total penalties:</strong> {report.penalties}</p>}
    {report.safetyFeedback && <p><strong>Safety:</strong> <span className="block mt-1 p-2 bg-gray-50 rounded">{report.safetyFeedback}</span></p>}
  </div>
);

const RefereeDetailView: React.FC<{ report: RefereeReport }> = ({ report }) => {
  // Use a helper function to determine the card/incident label
  const getCardLabel = () => {
    const t = (report as any).cardType?.toLowerCase() || report.type?.toLowerCase() || "";
    
    if (t.includes("yellow")) return "Yellow Card";
    if (t.includes("red")) return "Red Card";
    if (t.includes("incident") || t.includes("general")) return "Incident Report";

    return t.replace(/_/g, " ").toUpperCase() || "DISCIPLINARY ACTION";
  };
  
  const lawBroken = (report as any).lawNumber || report.lawBroken;
  const lawTitle = (report as any).lawTitle;
  const lawExplanation = (report as any).lawExplanation;
  const incidentTime = (report as any).minute || report.timeOfIncident;
  const playerName = (report as any).playerName;
  const playerTeam = (report as any).playerTeam;
  

  return (
    <div className="space-y-6 text-gray-800">
      
      {/* CARD / INCIDENT TYPE HEADER */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-red-200">
        <h3 className="text-xl font-bold text-red-700">
            {getCardLabel()}
        </h3>
        {incidentTime && (
          
            <span className="text-xl font-extrabold text-red-600 bg-red-100 px-3 py-1 rounded-lg">
               Time of incident: {incidentTime} min
            </span>
        )}
      </div>

      {/* Player Information */}
      {(playerName || playerTeam) && (
        <div className="p-4 bg-gray-50 rounded-xl border">
          <p className="text-sm font-semibold text-gray-700">PLAYER DETAILS:</p>
          {playerName && (
            <p>
              <strong>Player Name:</strong> {playerName}
            </p>
          )}
          {playerTeam && (
            <p>
              <strong>Player Team:</strong> {playerTeam}
            </p>
          )}
        </div>
      )}

      {/* LAW BROKEN DETAILS */}
      {lawBroken && (
        <div className="space-y-2 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
          <p className="text-sm font-semibold text-blue-700">RUGBY LAW REFERENCE:</p>
          
          <p className="text-lg font-bold text-blue-900">
            {lawBroken} {lawTitle ? `— ${lawTitle}` : ''}
          </p>

          {lawExplanation && (
            <p className="italic text-blue-800">
              <strong className="text-blue-900">Explanation:</strong> {lawExplanation}
            </p>
          )}
        </div>
      )}
      
      {/* DESCRIPTION */}
      <div>
        <strong className="block mb-2 text-lg">Referee's Description of Incident:</strong>
        <p className="mt-1 p-4 bg-gray-100 rounded-lg border border-gray-300 whitespace-pre-line text-lg">
          {report.description}
        </p>
      </div>
    </div>
  );
};

/* Modified RefereeDetailView Component */
interface RefereeReport {
  id: string;
  source: "referee";
  type: string;
  cardType?: string;
  description: string;
  minute?: string;
  timeOfIncident?: string;
  playerName?: string;
  playerTeam?: string;
  lawNumber?: string;
  lawTitle?: string;
  lawExplanation?: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  matchDate?: string;
  matchTime?: string;
}

const getCardColor = (report: RefereeReport) => {
  const type = (report.cardType || report.type || "").toLowerCase();
  switch (type) {
    case "red_card":
    case "red":
      return {
        bg: "bg-red-100",
        border: "border-red-400",
        text: "text-red-700",
      };
    case "yellow_card":
    case "yellow":
      return {
        bg: "bg-yellow-100",
        border: "border-yellow-400",
        text: "text-yellow-700",
      };
    case "incident":
    case "general_report":
      return {
        bg: "bg-blue-100",
        border: "border-blue-400",
        text: "text-blue-700",
      };
    default:
      return {
        bg: "bg-gray-100",
        border: "border-gray-400",
        text: "text-gray-700",
      };
  }
};

const RefereeReportCard: React.FC<{ report: RefereeReport }> = ({ report }) => {
  const colors = getCardColor(report);
  const incidentTime = report.minute || report.timeOfIncident;

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-4 shadow-md space-y-3`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className={`text-lg font-bold ${colors.text}`}>
          {report.cardType || report.type || "DISCIPLINARY ACTION"}
        </h3>
        {incidentTime && (
          <span className="px-2 py-1 bg-white rounded-lg font-semibold text-sm border">{`Min ${incidentTime}`}</span>
        )}
      </div>

      {/* Match Info */}
      <div className="text-sm text-gray-800">
        <p><strong>Match:</strong> {report.homeTeam} vs {report.awayTeam}</p>
        <p><strong>Venue:</strong> {report.venue}</p>
        {(report.matchDate || report.matchTime) && (
          <p>
            <strong>Date/Time:</strong> {report.matchDate || "N/A"} {report.matchTime ? `at ${report.matchTime}` : ""}
          </p>
        )}
      </div>

      {/* Player Info */}
      {(report.playerName || report.playerTeam) && (
        <div className="text-sm border-t border-gray-300 pt-2">
          {report.playerName && <p><strong>Player:</strong> {report.playerName}</p>}
          {report.playerTeam && <p><strong>Team:</strong> {report.playerTeam}</p>}
        </div>
      )}

      {/* Law Reference */}
      {report.lawNumber && (
        <div className="text-sm border-t border-gray-300 pt-2 space-y-1">
          <p className="font-semibold">{report.lawNumber} – {report.lawTitle || "Law Title N/A"}</p>
          {report.lawExplanation && <p className="italic">{report.lawExplanation}</p>}
        </div>
      )}

      {/* Description */}
      <p className="text-sm border-t border-gray-300 pt-2 whitespace-pre-line">
        {report.description}
      </p>
    </div>
  );
};

// ----------------------------
// Example List Component
// ----------------------------
const RefereeReportList: React.FC<{ reports: RefereeReport[] }> = ({ reports }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {reports.map((r) => (
        <RefereeReportCard key={r.id} report={r} />
      ))}
    </div>
  );
};

export default RefereeReportList;

