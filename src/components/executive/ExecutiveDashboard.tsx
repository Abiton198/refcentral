import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  getDocs,
  query,
  where,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, signOut } from "firebase/auth";
import { AppointmentForm } from "./AppointmentForm";
import { CoachAppointmentForm } from "@/components/executive/CoachAppointmentForm";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { mockVenues } from "@/data/mockData";
import { ResultsView } from "./ResultsView";
import { CoachManagement } from "./CoachManagement";
import { RefereeManagement } from "./RefereeManagement";
import { TeamRegistrationForm } from "./TeamRegistrationForm";
import { ReportsTab } from "./ReportsTab";
import { format, isAfter, parseISO } from "date-fns";
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Trophy,
  FileText,
  Search,
  Flag,
  MessageSquare,
  CheckCircle2,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CoachingReportUnified } from "../coach/CoachingReportUnified";

const formatTimestamp = (ts: any): Date => {
  if (!ts) return new Date();
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  return new Date();
};

interface Appointment {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  gameType?: string;
  isSchoolGame?: boolean;
  referee?: string;
  ar?: string;
  coachId?: string;
  coachName?: string;
  status?: "pending" | "accepted" | "rejected";
  appointedBy?: string;
  auditTrail?: { action: string; by: string; at: any }[];
}

export const ExecutiveDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [coachReports, setCoachReports] = useState<Set<string>>(new Set());
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState<
    "overview" | "appointments" | "all-appointments" | "results" | "reports" | "coaches" | "referees" | "teams"
  >("overview");

  const [showRefForm, setShowRefForm] = useState(false);
  const [showCoachForm, setShowCoachForm] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterReferee, setFilterReferee] = useState("");
  const [filterVenue, setFilterVenue] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const [isCoachingOpen, setIsCoachingOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [overviewDetailsOpen, setOverviewDetailsOpen] = useState(false);

  const currentUser = getAuth().currentUser;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "appointments"), (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Appointment),
      }));
      setAppointments(data);
      setLoadingAppointments(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "coachReports"));
    const unsub = onSnapshot(q, (snap) => {
      const reportedMatchIds = new Set<string>();
      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.matchId) reportedMatchIds.add(data.matchId);
      });
      setCoachReports(reportedMatchIds);
    });
    return () => unsub();
  }, []);

  const openCoachingForm = (match?: Appointment) => {
    if (match) setSelectedMatchId(match.id);
    else setSelectedMatchId("");
    setIsCoachingOpen(true);
  };

  const selectedMatch = useMemo(() => {
    return appointments.find((a) => a.id === selectedMatchId) || null;
  }, [selectedMatchId, appointments]);

  const stats = useMemo(() => {
    const now = new Date();
    const current = appointments.filter((a) => isAfter(parseISO(a.date), now));
    const past = appointments.filter((a) => !isAfter(parseISO(a.date), now));
    const pending = appointments.filter((a) => a.status === "pending").length;
    const accepted = appointments.filter((a) => a.status === "accepted").length;
    const rejected = appointments.filter((a) => a.status === "rejected").length;

    return {
      total: appointments.length,
      current: current.length,
      past: past.length,
      pending,
      accepted,
      rejected,
      acceptanceRate: appointments.length > 0 ? Math.round((accepted / appointments.length) * 100) : 0,
    };
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const matchSearch =
        apt.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        apt.awayTeam.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRef = !filterReferee || apt.referee === filterReferee || apt.ar === filterReferee;
      const matchVenue = !filterVenue || apt.venue === filterVenue;
      const matchDate = !filterDate || apt.date === filterDate;
      return matchSearch && matchRef && matchVenue && matchDate;
    });
  }, [appointments, searchTerm, filterReferee, filterVenue, filterDate]);

  const uniqueReferees = Array.from(new Set(appointments.map((a) => a.referee || a.ar).filter(Boolean)));
  const uniqueVenues = Array.from(new Set(appointments.map((a) => a.venue)));

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "Logged out successfully." });
      window.location.href = "/";
    } catch (err) {
      toast({ title: "Error", description: "Logout failed.", variant: "destructive" });
    }
  };

  const handleDelete = async (appointmentId: string) => {
    if (!window.confirm("Delete this appointment and ALL related data?")) return;
    try {
      await deleteDoc(doc(db, "appointments", appointmentId));
      const resultRef = doc(db, "results", appointmentId);
      const resultSnap = await getDoc(resultRef);
      if (resultSnap.exists()) await deleteDoc(resultRef);

      const reportsQuery = query(collection(db, "reports"), where("matchId", "==", appointmentId));
      const reportsSnap = await getDocs(reportsQuery);
      const deletePromises: Promise<any>[] = [];
      reportsSnap.forEach((reportDoc) => {
        deletePromises.push(deleteDoc(doc(db, "reports", reportDoc.id)));
      });
      await Promise.all(deletePromises);
      toast({ title: "Deleted", description: "All data removed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Delete failed.", variant: "destructive" });
    }
  };

  const handleEditToggle = (apt: Appointment) => {
    if (activeEditId === apt.id) {
      setActiveEditId(null);
      return;
    }
    setActiveEditId(apt.id);
    setEditForm({
      date: apt.date,
      time: apt.time,
      homeTeam: apt.homeTeam,
      awayTeam: apt.awayTeam,
      venue: apt.venue,
      gameType: apt.gameType || "league",
      isSchoolGame: apt.isSchoolGame || false,
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, "appointments", id), {
        ...editForm,
        updatedAt: new Date().toISOString(),
      });
      setActiveEditId(null);
      toast({ title: "Updated", description: "Appointment saved." });
    } catch (err) {
      toast({ title: "Error", description: "Save failed.", variant: "destructive" });
    }
  };

  const handleReportSubmitted = async (matchId: string, coachName: string) => {
    const aptRef = doc(db, "appointments", matchId);
    await updateDoc(aptRef, {
      auditTrail: [
        ...(appointments.find(a => a.id === matchId)?.auditTrail || []),
        {
          action: "Coaching report submitted",
          by: coachName,
          at: serverTimestamp(),
        },
      ],
    });
  };

  const renderAppointmentCard = (apt: Appointment, showTrail = false, isPast = false) => {
    const officialName = apt.referee || apt.ar || "—";
    const roleLabel = apt.referee ? "Referee" : apt.ar ? "Assistant Referee" : "Official";
    const hasReport = coachReports.has(apt.id);

    return (
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="text-lg font-bold">{apt.homeTeam} vs {apt.awayTeam}</h3>
            <Badge
              variant={apt.status === "accepted" ? "success" : apt.status === "rejected" ? "danger" : "warning"}
            >
              {apt.status ? apt.status.toUpperCase() : "PENDING"}
            </Badge>
            {apt.isSchoolGame && (
              <Badge variant="outline" className="border-emerald-600 text-emerald-700 text-xs">
                School
              </Badge>
            )}
            {hasReport ? (
              <Badge variant="success" className="flex items-center gap-1 text-xs">
                <CheckCircle2 className="w-3 h-3" /> Report
              </Badge>
            ) : isPast ? (
              <Badge variant="secondary" className="text-xs">Not yet</Badge>
            ) : null}
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Date:</strong> {apt.date} • <strong>Time:</strong> {apt.time}</p>
            <p><strong>Venue:</strong> {apt.venue}</p>
            <p><strong>{roleLabel}:</strong> {officialName}</p>
            {apt.coachName && <p><strong>Coach:</strong> {apt.coachName}</p>}
            {apt.appointedBy && <p className="text-xs text-gray-500">Appointed by: {apt.appointedBy}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <select
            className="text-xs border rounded px-2 py-1"
            value={apt.status || "pending"}
            onChange={(e) => updateDoc(doc(db, "appointments", apt.id), { status: e.target.value })}
            disabled={isPast}
          >
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>

          {!isPast && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleEditToggle(apt)}>
                {activeEditId === apt.id ? "Close" : "Edit"}
              </Button>
              <Button size="sm" variant="danger" onClick={() => handleDelete(apt.id)}>Delete</Button>
            </>
          )}

          {!hasReport && !isPast && (
            <Button
              size="sm"
              variant="default"
              className="bg-gradient-to-r from-indigo-500 to-purple-600 text-xs"
              onClick={() => openCoachingForm(apt)}
            >
              <MessageSquare className="w-3 h-3 mr-1" /> Report
            </Button>
          )}
        </div>

        {activeEditId === apt.id && !isPast && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="border rounded px-2 py-1" />
              <input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} className="border rounded px-2 py-1" />
            </div>
            <input type="text" placeholder="Home" value={editForm.homeTeam} onChange={(e) => setEditForm({ ...editForm, homeTeam: e.target.value })} className="w-full border rounded px-2 py-1" />
            <input type="text" placeholder="Away" value={editForm.awayTeam} onChange={(e) => setEditForm({ ...editForm, awayTeam: e.target.value })} className="w-full border rounded px-2 py-1" />
            <select value={editForm.venue} onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })} className="w-full border rounded px-2 py-1">
              {mockVenues.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSaveEdit(apt.id)} className="flex-1">Save</Button>
              <Button size="sm" variant="danger" onClick={() => setActiveEditId(null)} className="flex-1">Cancel</Button>
            </div>
          </div>
        )}

        {showTrail && apt.auditTrail && apt.auditTrail.length > 0 && (
          <div className="mt-3 pt-3 border-t text-xs text-gray-500">
            <p className="font-medium mb-1">Trail:</p>
            {apt.auditTrail.slice(0, 3).map((log, i) => {
              const date = formatTimestamp(log.at);
              return <p key={i}>• {log.action} by {log.by} at {format(date, "dd MMM HH:mm")}</p>;
            })}
            {apt.auditTrail.length > 3 && <p className="italic">...more</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-4 pb-24 sm:pb-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex justify-between items-center gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Executive Dashboard</h2>
              <p className="text-sm text-gray-600 hidden sm:block">Real-time insights and management</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-600 border-red-600 text-xs sm:text-sm">
                Logout
              </Button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden p-2 rounded-lg bg-white shadow"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Desktop Tabs */}
          <div className="hidden sm:block">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid grid-cols-4 lg:grid-cols-8 gap-1 p-1 bg-white/80 backdrop-blur rounded-xl shadow-sm">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="appointments">Current</TabsTrigger>
                <TabsTrigger value="all-appointments">All</TabsTrigger>
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="coaches">Coaches</TabsTrigger>
                <TabsTrigger value="referees">Referees</TabsTrigger>
                <TabsTrigger value="teams">Teams</TabsTrigger>
              </TabsList>

              {/* OVERVIEW - FULLY RESTORED */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-emerald-100 text-sm">Total Appointments</p>
                        <p className="text-3xl font-bold">{stats.total}</p>
                      </div>
                      <Calendar className="w-10 h-10 text-emerald-200" />
                    </div>
                  </Card>

                  <Card className="p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm">Upcoming</p>
                        <p className="text-3xl font-bold">{stats.current}</p>
                      </div>
                      <Clock className="w-10 h-10 text-blue-200" />
                    </div>
                  </Card>

                  <Card className="p-5 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-amber-100 text-sm">Acceptance Rate</p>
                        <p className="text-3xl font-bold">{stats.acceptanceRate}%</p>
                      </div>
                      <CheckCircle className="w-10 h-10 text-amber-200" />
                    </div>
                  </Card>

                  <Card className="p-5 bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm">Pending</p>
                        <p className="text-3xl font-bold">{stats.pending}</p>
                      </div>
                      <AlertCircle className="w-10 h-10 text-purple-200" />
                    </div>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-5">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-600" /> Status Breakdown
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Accepted</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-emerald-500 h-2 rounded-full"
                              style={{ width: `${stats.acceptanceRate}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{stats.accepted}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Rejected</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full"
                              style={{ width: `${stats.rejected / Math.max(stats.total, 1) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{stats.rejected}</span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-5">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" /> Recent Activity
                    </h3>
                    <p className="text-sm text-gray-500 italic">Live updates from appointments, reports, and results</p>
                  </Card>
                </div>
              </TabsContent>

              {/* Other Tabs */}
              <TabsContent value="appointments">
                <div className="space-y-8">
                  <div className="flex justify-center gap-3 p-4 bg-white rounded-xl shadow-sm">
                    <Button
                      variant={showRefForm ? "default" : "outline"}
                      onClick={() => { setShowRefForm(true); setShowCoachForm(false); }}
                    >
                      Appoint Referee
                    </Button>
                    <Button
                      variant={showCoachForm ? "default" : "outline"}
                      onClick={() => { setShowCoachForm(true); setShowRefForm(false); }}
                    >
                      Appoint Coach
                    </Button>
                  </div>

                  {showRefForm && <AppointmentForm onSuccess={() => toast({ title: "Success", description: "Referee appointed!" })} />}
                  {showCoachForm && <CoachAppointmentForm showForm={showCoachForm} setShowForm={setShowCoachForm} appointments={appointments} setAppointments={setAppointments} onSuccess={() => toast({ title: "Success", description: "Coach appointed!" })} />}

                  <div>
                    <h3 className="text-2xl font-bold mb-4">Current Appointments</h3>
                    {loadingAppointments ? (
                      <p className="text-center text-gray-500 py-8">Loading appointments...</p>
                    ) : appointments.filter((a) => isAfter(parseISO(a.date), new Date())).length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No upcoming matches.</p>
                    ) : (
                      <div className="space-y-4">
                        {appointments
                          .filter((a) => isAfter(parseISO(a.date), new Date()))
                          .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
                          .map((apt) => (
                            <Card key={apt.id} className="p-5 hover:shadow-md transition">
                              {renderAppointmentCard(apt, false, false)}
                            </Card>
                          ))}
                      </div>
                    )}
                  </div>

                  {appointments.filter((a) => !isAfter(parseISO(a.date), new Date())).length > 0 && (
                    <div className="mt-12 border-t pt-8">
                      <h3 className="text-xl font-bold mb-4 text-gray-700">Recent Appointments</h3>
                      <p className="text-sm text-gray-500 mb-4 italic">
                        Matches that have already taken place. Editing and deletion are locked.
                      </p>
                      <div className="space-y-4">
                        {appointments
                          .filter((a) => !isAfter(parseISO(a.date), new Date()))
                          .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
                          .map((apt) => (
                            <Card key={apt.id} className="p-5 opacity-75 border-l-4 border-l-gray-400 bg-gray-50">
                              {renderAppointmentCard(apt, false, true)}
                            </Card>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="all-appointments">
                <div className="space-y-6">
                  <Card className="p-4 bg-white">
                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search teams..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <select
                        value={filterReferee}
                        onChange={(e) => setFilterReferee(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">All Officials</option>
                        {uniqueReferees.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <select
                        value={filterVenue}
                        onChange={(e) => setFilterVenue(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">All Venues</option>
                        {uniqueVenues.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchTerm("");
                          setFilterReferee("");
                          setFilterVenue("");
                          setFilterDate("");
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </Card>

                  <h3 className="text-2xl font-bold mb-4">All Appointments</h3>
                  {filteredAppointments.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No matches found.</p>
                  ) : (
                    <div className="space-y-4">
                      {filteredAppointments.map((apt) => {
                        const isPast = !isAfter(parseISO(apt.date), new Date());
                        return (
                          <Card key={apt.id} className="p-5 hover:shadow-md transition">
                            {renderAppointmentCard(apt, true, isPast)}
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="results"><ResultsView /></TabsContent>
              <TabsContent value="reports"><ReportsTab /></TabsContent>
              <TabsContent value="coaches"><CoachManagement /></TabsContent>
              <TabsContent value="referees"><RefereeManagement /></TabsContent>
              <TabsContent value="teams"><TeamRegistrationForm /></TabsContent>
            </Tabs>
          </div>

          {/* Mobile: Dropdown + Content */}
          {mobileMenuOpen && (
            <div className="sm:hidden bg-white rounded-xl shadow-lg p-3 space-y-1">
              {[
                { value: "overview", label: "Overview" },
                { value: "appointments", label: "Current" },
                { value: "all-appointments", label: "All Appts" },
                { value: "results", label: "Results" },
                { value: "reports", label: "Reports" },
                { value: "coaches", label: "Coaches" },
                { value: "referees", label: "Referees" },
                { value: "teams", label: "Teams" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setActiveTab(tab.value as any);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === tab.value
                      ? "bg-emerald-600 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Mobile Content */}
          <div className="sm:hidden space-y-6">
            {activeTab === "overview" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3 text-center bg-emerald-500 text-white">
                    <p className="text-xs">Total</p>
                    <p className="text-xl font-bold">{stats.total}</p>
                  </Card>
                  <Card className="p-3 text-center bg-blue-500 text-white">
                    <p className="text-xs">Upcoming</p>
                    <p className="text-xl font-bold">{stats.current}</p>
                  </Card>
                  <Card className="p-3 text-center bg-amber-500 text-white">
                    <p className="text-xs">Rate</p>
                    <p className="text-xl font-bold">{stats.acceptanceRate}%</p>
                  </Card>
                  <Card className="p-3 text-center bg-purple-500 text-white">
                    <p className="text-xs">Pending</p>
                    <p className="text-xl font-bold">{stats.pending}</p>
                  </Card>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setOverviewDetailsOpen(!overviewDetailsOpen)}
                >
                  {overviewDetailsOpen ? "Hide" : "Show"} Details
                  <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${overviewDetailsOpen ? "rotate-180" : ""}`} />
                </Button>

                {overviewDetailsOpen && (
                  <div className="space-y-3">
                    <Card className="p-3">
                      <h3 className="font-medium text-sm mb-2 flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-amber-600" /> Status
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span>Accepted</span>
                          <span className="font-medium">{stats.accepted}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${stats.acceptanceRate}%` }}></div>
                        </div>
                        <div className="flex justify-between">
                          <span>Rejected</span>
                          <span className="font-medium">{stats.rejected}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${stats.rejected / Math.max(stats.total, 1) * 100}%` }}></div>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-3">
                      <h3 className="font-medium text-sm mb-1 flex items-center gap-1">
                        <FileText className="w-4 h-4 text-blue-600" /> Activity
                      </h3>
                      <p className="text-xs text-gray-500 italic">Live updates from appointments, reports, and results</p>
                    </Card>
                  </div>
                )}
              </>
            )}

            {activeTab === "appointments" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={showRefForm ? "default" : "outline"}
                    onClick={() => { setShowRefForm(true); setShowCoachForm(false); }}
                    className="flex-1 text-xs"
                  >
                    Referee
                  </Button>
                  <Button
                    size="sm"
                    variant={showCoachForm ? "default" : "outline"}
                    onClick={() => { setShowCoachForm(true); setShowRefForm(false); }}
                    className="flex-1 text-xs"
                  >
                    Coach
                  </Button>
                </div>
                {showRefForm && <AppointmentForm onSuccess={() => toast({ title: "Appointed!" })} />}
                {showCoachForm && <CoachAppointmentForm showForm={showCoachForm} setShowForm={setShowCoachForm} appointments={appointments} setAppointments={setAppointments} onSuccess={() => toast({ title: "Appointed!" })} />}
              </div>
            )}

            {activeTab === "all-appointments" && (
              <div className="space-y-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => setFilterOpen(!filterOpen)}
                >
                  Filters {filterOpen ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1 rotate-180" />}
                </Button>
                {filterOpen && (
                  <div className="p-3 bg-gray-50 rounded-lg space-y-2 text-xs">
                    <input type="text" placeholder="Search teams..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border rounded px-2 py-1" />
                    <select value={filterReferee} onChange={(e) => setFilterReferee(e.target.value)} className="w-full border rounded px-2 py-1">
                      <option value="">All Officials</option>
                      {uniqueReferees.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={filterVenue} onChange={(e) => setFilterVenue(e.target.value)} className="w-full border rounded px-2 py-1">
                      <option value="">All Venues</option>
                      {uniqueVenues.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full border rounded px-2 py-1" />
                  </div>
                )}
              </div>
            )}

            {["results", "reports", "coaches", "referees", "teams"].includes(activeTab) && (
              <div className="bg-white rounded-xl p-4 shadow">
                {activeTab === "results" && <ResultsView />}
                {activeTab === "reports" && <ReportsTab />}
                {activeTab === "coaches" && <CoachManagement />}
                {activeTab === "referees" && <RefereeManagement />}
                {activeTab === "teams" && <TeamRegistrationForm />}
              </div>
            )}
          </div>

          {/* Shared Appointment Lists */}
          {["appointments", "all-appointments"].includes(activeTab) && (
            <div className="space-y-4">
              {loadingAppointments ? (
                <p className="text-center py-8 text-gray-500">Loading...</p>
              ) : filteredAppointments.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No matches.</p>
              ) : (
                filteredAppointments.map((apt) => {
                  const isPast = !isAfter(parseISO(apt.date), new Date());
                  return (
                    <Card key={apt.id} className="p-4 shadow-sm">
                      {renderAppointmentCard(apt, activeTab === "all-appointments", isPast)}
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => openCoachingForm()}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium rounded-full shadow-xl hover:shadow-lg transform hover:scale-105 transition"
        >
          <MessageSquare className="w-5 h-5" />
          Report
        </button>
      </div>

      {/* Coaching Dialog */}
      <Dialog open={isCoachingOpen} onOpenChange={setIsCoachingOpen}>
        <DialogContent className="max-w-full w-full h-full sm:max-w-4xl sm:h-auto sm:max-h-[90vh] p-0 overflow-y-auto">
          <DialogHeader className="p-4 sm:p-6 border-b">
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Flag className="w-6 h-6 text-indigo-600" />
              Referee’s Coaching Report
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Match <span className="text-red-500">*</span>
              </label>
              <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a match to report on..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {appointments
                    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
                    .filter((apt) => !coachReports.has(apt.id))
                    .map((apt) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{apt.homeTeam} vs {apt.awayTeam}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {apt.date} @ {apt.venue}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMatch && !coachReports.has(selectedMatch.id) ? (
              <CoachingReportUnified
                coachName={selectedMatch.coachName || ""}
                coachEmail=""
                prefill={{
                  homeTeam: selectedMatch.homeTeam,
                  awayTeam: selectedMatch.awayTeam,
                  date: selectedMatch.date,
                  time: selectedMatch.time,
                  venue: selectedMatch.venue,
                  referee: selectedMatch.referee || selectedMatch.ar || "",
                  matchId: selectedMatch.id,
                }}
                onSuccess={(coachName: string) => {
                  toast({ title: "Success", description: "Coaching report submitted." });
                  handleReportSubmitted(selectedMatch.id, coachName || "Unknown Coach");
                  setIsCoachingOpen(false);
                  setSelectedMatchId("");
                }}
              />
            ) : selectedMatch && coachReports.has(selectedMatch.id) ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
                <p className="text-lg font-medium">Report already submitted for this match.</p>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-600">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Please select a match to begin</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};