import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppointmentForm } from "./AppointmentForm";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { mockVenues } from "@/data/mockData";
import { ResultsView } from "./ResultsView";
interface Appointment {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  gameType?: string;
  secondTeamGame?: string;
  isSchoolGame?: boolean;
  mainReferee: string;
  refereeEmail?: string;
  firstReserve?: string;
  status: "pending" | "accepted" | "rejected";
}

interface MatchResult {
  id: string;
  homeScore: number;
  awayScore: number;
  referee: string;
  submittedAt: string;
  notes?: string;
}

interface Report {
  id: string;
  referee: string;
  refereeEmail?: string;
  type: string;
  lawBroken?: string;
  description: string;
  date: string;
  timeOfIncident?: string;
  reviewed?: boolean;
  matchDetails?: {
    homeTeam: string;
    awayTeam: string;
    venue: string;
    time: string;
  };
}

export const ExecutiveDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportFilter, setReportFilter] = useState<"all" | "pending" | "reviewed">("all");
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [filter, setFilter] = useState({
    status: "all",
    referee: "",
    startDate: "",
    endDate: "",
  });

  // 🔥 Real-time Firestore listeners
  useEffect(() => {
    const unsubAppointments = onSnapshot(collection(db, "appointments"), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Appointment) }));
      setAppointments(data);
      setLoadingAppointments(false);
    });

    const unsubResults = onSnapshot(collection(db, "results"), (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as MatchResult) }))
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setResults(data);
      setLoadingResults(false);
    });

    const unsubReports = onSnapshot(collection(db, "reports"), (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Report) }))
        .sort((a, b) => (b.date > a.date ? 1 : -1));
      setReports(data);
      setLoadingReports(false);
    });

    return () => {
      unsubAppointments();
      unsubResults();
      unsubReports();
    };
  }, []);

  // ✅ Handle appointment status
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "appointments", id), { status: newStatus });
      toast({ title: "Status Updated", description: `Marked as ${newStatus}` });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  // 🗑️ Delete appointment
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this appointment?")) return;
    try {
      await deleteDoc(doc(db, "appointments", id));
      toast({ title: "Deleted", description: "Appointment removed." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Delete failed.", variant: "destructive" });
    }
  };

  // ✏️ Edit appointment inline
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
      await updateDoc(doc(db, "appointments", id), { ...editForm, updatedAt: new Date().toISOString() });
      setActiveEditId(null);
      toast({ title: "Updated", description: "Appointment successfully updated." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    }
  };

  // ✅ Mark report as reviewed
  const markReportReviewed = async (id: string) => {
    try {
      await updateDoc(doc(db, "reports", id), { reviewed: true });
      toast({ title: "Reviewed", description: "Report marked as reviewed." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Could not update report.", variant: "destructive" });
    }
  };

  // 🧩 Filters
  const filteredReports = reports.filter((r) => {
    if (reportFilter === "pending") return !r.reviewed;
    if (reportFilter === "reviewed") return r.reviewed;
    return true;
  });

  const reportBadge = (type: string) => {
    switch (type) {
      case "red_card":
        return <Badge variant="danger">🟥 Red Card / Misconduct</Badge>;
      case "incident":
        return <Badge variant="warning">🏉 Incident</Badge>;
      default:
        return <Badge variant="outline">📝 General</Badge>;
    }
  };

  return (
    <div className="space-y-8">
   
      <p className="text-gray-600">Oversee all appointments, match results, and referee reports</p>

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="flex space-x-4 border-b mb-4">
          <TabsTrigger value="appointments">🗓️ Appointments</TabsTrigger>
          <TabsTrigger value="results">🏉  Results</TabsTrigger>
          <TabsTrigger value="reports">🧾 Reports</TabsTrigger>
        </TabsList>

        {/* 🗓️ Appointments */}
        <TabsContent value="appointments">
          <AppointmentForm />

          <h3 className="text-2xl font-bold mt-6 mb-4 text-gray-900">All Appointments</h3>
          {loadingAppointments ? (
            <p className="text-center text-gray-500 py-8">Loading...</p>
          ) : appointments.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No appointments found.</p>
          ) : (
            <div className="space-y-4">
              {appointments.map((apt) => (
                <Card key={apt.id} className="p-4">
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
                          {apt.status.toUpperCase()}
                        </Badge>
                        {apt.isSchoolGame && (
                          <Badge variant="outline" className="border-emerald-600 text-emerald-700">
                            🏫 School Game
                          </Badge>
                        )}
                      </div>

                      <p className="text-gray-600">📅 {apt.date} • ⏰ {apt.time}</p>
                      <p className="text-gray-600">📍 {apt.venue}</p>
                      <p className="text-gray-600">🎯 {apt.gameType || "General Match"}</p>
                      <p className="text-gray-600">👨‍⚖️ {apt.mainReferee}</p>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <select
                        className="border rounded-lg px-2 py-1 text-sm"
                        value={apt.status}
                        onChange={(e) => handleStatusChange(apt.id, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={() => handleEditToggle(apt)}>
                        {activeEditId === apt.id ? "Close" : "✏️ Edit"}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(apt.id)}>
                        🗑️ Delete
                      </Button>
                    </div>
                  </div>

                  {/* Inline Edit Form */}
                  {activeEditId === apt.id && (
                    <div className="mt-4 border-t pt-3 bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <input
                          type="date"
                          value={editForm.date}
                          onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                          className="border rounded-lg px-3 py-2"
                        />
                        <input
                          type="time"
                          value={editForm.time}
                          onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                          className="border rounded-lg px-3 py-2"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Home Team"
                        value={editForm.homeTeam}
                        onChange={(e) => setEditForm({ ...editForm, homeTeam: e.target.value })}
                        className="border rounded-lg px-3 py-2 w-full mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Away Team"
                        value={editForm.awayTeam}
                        onChange={(e) => setEditForm({ ...editForm, awayTeam: e.target.value })}
                        className="border rounded-lg px-3 py-2 w-full mb-2"
                      />
                      <select
                        value={editForm.venue}
                        onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                        className="border rounded-lg px-3 py-2 w-full mb-2"
                      >
                        {mockVenues.map((venue) => (
                          <option key={venue} value={venue}>
                            {venue}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(apt.id)} className="flex-1">
                          💾 Save
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setActiveEditId(null)} className="flex-1">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ⚽ Results
        <TabsContent value="results">
          <h3 className="text-2xl font-bold mb-4 text-gray-900">Submitted Match Results</h3>
          {loadingResults ? (
            <p className="text-center text-gray-500 py-8">Loading...</p>
          ) : results.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No results submitted yet.</p>
          ) : (
            <div className="space-y-4">
              {results.map((r) => (
                <Card key={r.id} className="p-4">
                  <p className="font-semibold text-gray-900">
                    {r.referee} — {new Date(r.submittedAt).toLocaleString()}
                  </p>
                  <p className="text-gray-700">🏆 {r.homeScore} - {r.awayScore}</p>
                  {r.notes && <p className="text-gray-600 italic mt-1">“{r.notes}”</p>}
                </Card>
              ))}
            </div>
          )}
        </TabsContent> */}

        <TabsContent value="results">
  <ResultsView />
</TabsContent>


        {/* 🧾 Reports */}
        <TabsContent value="reports">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-gray-900">Referee Reports</h3>
            <div className="flex gap-2">
              {["all", "pending", "reviewed"].map((type) => (
                <Button
                  key={type}
                  variant={reportFilter === type ? "default" : "outline"}
                  onClick={() => setReportFilter(type as any)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {loadingReports ? (
            <p className="text-center text-gray-500 py-8">Loading reports...</p>
          ) : filteredReports.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No reports found.</p>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((rep) => (
                <Card key={rep.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {reportBadge(rep.type)}
                        {rep.reviewed && <Badge variant="success">✅ Reviewed</Badge>}
                      </div>
                      <p className="font-semibold text-gray-900">
                        {rep.referee} — {rep.date}
                        {rep.timeOfIncident && (
                          <span className="text-gray-600 text-sm ml-2">
                            🕓 {rep.timeOfIncident}
                          </span>
                        )}
                      </p>
                      {rep.refereeEmail && <p className="text-sm text-gray-600">📧 {rep.refereeEmail}</p>}
                      {rep.lawBroken && (
                        <p className="text-sm text-emerald-700 font-medium mt-2">
                          ⚖️ {rep.lawBroken}
                        </p>
                      )}
                      <p className="text-gray-800 mt-2 whitespace-pre-line leading-relaxed">
                        {rep.description}
                      </p>
                    </div>
                    {!rep.reviewed && (
                      <Button size="sm" onClick={() => markReportReviewed(rep.id)}>
                        Mark as Reviewed
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
