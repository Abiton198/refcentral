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
  Filter,
  Users,
} from "lucide-react";

// Safe timestamp conversion
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
  // === State ===
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState<
    "overview" | "appointments" | "all-appointments" | "results" | "reports" | "coaches" | "referees" | "teams"
  >("overview");

  // Form toggles
  const [showRefForm, setShowRefForm] = useState(false);
  const [showCoachForm, setShowCoachForm] = useState(false);

  // Search & Filter (All Appointments)
  const [searchTerm, setSearchTerm] = useState("");
  const [filterReferee, setFilterReferee] = useState("");
  const [filterVenue, setFilterVenue] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // === Real-time Data ===
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

  // === Computed Stats (Overview) ===
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

  // === Filtered Appointments (All Tab) ===
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

  // Unique filters
  const uniqueReferees = Array.from(new Set(appointments.map((a) => a.referee || a.ar).filter(Boolean)));
  const uniqueVenues = Array.from(new Set(appointments.map((a) => a.venue)));

  // === Logout ===
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

  // === Delete with Cascade ===
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

  // === Edit Appointment ===
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

  // === Reusable Appointment Card Renderer ===
  const renderAppointmentCard = (apt: Appointment, showTrail = false) => {
    const officialName = apt.referee || apt.ar || "—";
    const roleLabel = apt.referee ? "Referee" : apt.ar ? "Assistant Referee" : "Official";

    return (
      <>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-bold">
                {apt.homeTeam} vs {apt.awayTeam}
              </h3>
              <Badge
                variant={
                  apt.status === "accepted"
                    ? "success"
                    : apt.status === "rejected"
                    ? "danger"
                    : "warning"
                }
              >
                {apt.status ? apt.status.toUpperCase() : "PENDING"}
              </Badge>
              {apt.isSchoolGame && (
                <Badge variant="outline" className="border-emerald-600 text-emerald-700">
                  School
                </Badge>
              )}
            </div>
            <p className="text-gray-600">Date: {apt.date} • Time: {apt.time}</p>
            <p className="text-gray-600">Venue: {apt.venue}</p>
            <p className="text-gray-600">
              {roleLabel}: <strong>{officialName}</strong>
            </p>
            {apt.coachName && (
              <p className="text-gray-600">
                Coach: <strong>{apt.coachName}</strong>
              </p>
            )}
            {apt.appointedBy && (
              <p className="text-xs text-gray-500 mt-1">
                Appointed by: <span className="font-medium">{apt.appointedBy}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 ml-4">
            <select
              className="border rounded-lg px-2 py-1 text-sm"
              value={apt.status || "pending"}
              onChange={(e) =>
                updateDoc(doc(db, "appointments", apt.id), { status: e.target.value })
              }
            >
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => handleEditToggle(apt)}>
              {activeEditId === apt.id ? "Close" : "Edit"}
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleDelete(apt.id)}>
              Delete
            </Button>
          </div>
        </div>

        {/* Inline Edit Form */}
        {activeEditId === apt.id && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                className="border rounded px-2 py-1 text-sm"
              />
              <input
                type="time"
                value={editForm.time}
                onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="Home Team"
              value={editForm.homeTeam}
              onChange={(e) => setEditForm({ ...editForm, homeTeam: e.target.value })}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Away Team"
              value={editForm.awayTeam}
              onChange={(e) => setEditForm({ ...editForm, awayTeam: e.target.value })}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <select
              value={editForm.venue}
              onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              {mockVenues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSaveEdit(apt.id)} className="flex-1">
                Save
              </Button>
              <Button size="sm" variant="danger" onClick={() => setActiveEditId(null)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Audit Trail (only in All Appointments) */}
        {showTrail && apt.auditTrail && apt.auditTrail.length > 0 && (
          <div className="mt-3 pt-3 border-t text-xs text-gray-500">
            <p className="font-medium mb-1">Audit Trail:</p>
            {apt.auditTrail.slice(0, 3).map((log, i) => {
              const date = formatTimestamp(log.at);
              return (
                <p key={i}>
                  • {log.action} by {log.by} at {format(date, "dd MMM HH:mm")}
                </p>
              );
            })}
            {apt.auditTrail.length > 3 && <p className="italic">...and more</p>}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Executive Dashboard</h2>
            <p className="text-gray-600">Real-time insights and management</p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
          >
            Logout
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-3 md:grid-cols-8 gap-1 p-1 bg-white/80 backdrop-blur rounded-xl shadow-sm">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="appointments">Current</TabsTrigger>
            <TabsTrigger value="all-appointments">All Appts</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="coaches">Coaches</TabsTrigger>
            <TabsTrigger value="referees">Referees</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
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

          {/* CURRENT APPOINTMENTS - Only Future Fixtures */}
          <TabsContent value="appointments" className="space-y-6">
            <div className="flex justify-center gap-3 p-4 bg-white rounded-xl shadow-sm">
              <Button
                variant={showRefForm ? "default" : "outline"}
                onClick={() => {
                  setShowRefForm(true);
                  setShowCoachForm(false);
                }}
              >
                Appoint Referee
              </Button>
              <Button
                variant={showCoachForm ? "default" : "outline"}
                onClick={() => {
                  setShowCoachForm(true);
                  setShowRefForm(false);
                }}
              >
                Appoint Coach
              </Button>
            </div>

            {/* REFEREE FORM */}
            {showRefForm && (
              <AppointmentForm
                onSuccess={() => toast({ title: "Success", description: "Referee appointed!" })}
              />
            )}

            {/* COACH FORM - Pass state for instant update */}
            {showCoachForm && (
              <CoachAppointmentForm
                showForm={showCoachForm}
                setShowForm={setShowCoachForm}
                appointments={appointments}
                setAppointments={setAppointments}
                onSuccess={() => toast({ title: "Success", description: "Coach appointed!" })}
              />
            )}

            <h3 className="text-2xl font-bold mt-8 mb-4">Current Appointments</h3>

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
                      {renderAppointmentCard(apt)}
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* ALL APPOINTMENTS WITH FILTERS & AUDIT TRAIL */}
          <TabsContent value="all-appointments" className="space-y-6">
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
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  value={filterVenue}
                  onChange={(e) => setFilterVenue(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">All Venues</option>
                  {uniqueVenues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
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
                {filteredAppointments.map((apt) => (
                  <Card key={apt.id} className="p-5 hover:shadow-md transition">
                    {renderAppointmentCard(apt, true)}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* OTHER TABS */}
          <TabsContent value="teams"><TeamRegistrationForm /></TabsContent>
          <TabsContent value="results"><ResultsView /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          <TabsContent value="coaches"><CoachManagement /></TabsContent>
          <TabsContent value="referees"><RefereeManagement /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};