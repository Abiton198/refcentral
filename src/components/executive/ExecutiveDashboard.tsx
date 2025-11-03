import React, { useEffect, useState } from "react";
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
  status?: "pending" | "accepted" | "rejected";
  appointedBy?: string;
  auditTrail?: any[];
}

export const ExecutiveDashboard: React.FC = () => {
  // State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState<
    "appointments" | "results" | "reports" | "coaches" | "referees" | "teams"
  >("appointments");

  // Form toggles
  const [showRefForm, setShowRefForm] = useState(false);
  const [showCoachForm, setShowCoachForm] = useState(false);

  // Real-time appointments
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

  // Logout
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

  // Delete cascade
  const handleDelete = async (appointmentId: string) => {
    if (!window.confirm("Delete this appointment and ALL related data?")) return;

    try {
      await deleteDoc(doc(db, "appointments", appointmentId));
      const resultRef = doc(db, "results", appointmentId);
      const resultSnap = await getDoc(resultRef);
      if (resultSnap.exists()) await deleteDoc(resultRef);

      const reportsQuery = query(
        collection(db, "reports"),
        where("matchId", "==", appointmentId)
      );
      const reportsSnap = await getDocs(reportsQuery);
      const deletePromises: Promise<any>[] = [];
      reportsSnap.forEach((reportDoc) => {
        const reportId = reportDoc.id;
        deletePromises.push(deleteDoc(doc(db, "reports", reportId)));
        const auditQuery = query(collection(db, "reports", reportId, "auditTrail"));
        deletePromises.push(
          getDocs(auditQuery).then((auditSnap) =>
            Promise.all(auditSnap.docs.map((d) => deleteDoc(d.ref)))
          )
        );
      });
      await Promise.all(deletePromises);
      toast({ title: "Deleted", description: "All data removed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Delete failed.", variant: "destructive" });
    }
  };

  // Edit
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Executive Dashboard</h2>
            <p className="text-gray-600">Manage appointments, teams, results, reports, coaches & referees</p>
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
          <TabsList className="grid grid-cols-2 md:grid-cols-6 gap-2 p-1 bg-gray-100 rounded-xl">
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="coaches">Coaches</TabsTrigger>
            <TabsTrigger value="referees">Referees</TabsTrigger>
          </TabsList>

          {/* APPOINTMENTS TAB */}
          <TabsContent value="appointments" className="space-y-6">

            {/* TOGGLE BUTTONS */}
            <div className="flex justify-center gap-3 p-4 bg-white rounded-xl shadow-sm">
              <Button
                variant={showRefForm ? "default" : "outline"}
                onClick={() => {
                  setShowRefForm(true);
                  setShowCoachForm(false);
                }}
                className="flex items-center gap-2"
              >
                Appoint Referee
              </Button>
              <Button
                variant={showCoachForm ? "default" : "outline"}
                onClick={() => {
                  setShowCoachForm(true);
                  setShowRefForm(false);
                }}
                className="flex items-center gap-2"
              >
                Appoint Coach
              </Button>
            </div>

            {/* REFEREE FORM */}
            {showRefForm && (
              <div className="border-t pt-6">
                <AppointmentForm />
              </div>
            )}

            {/* COACH FORM */}
            {showCoachForm && (
              <div className="border-t pt-6">
                <CoachAppointmentForm
                  showForm={showCoachForm}
                  setShowForm={setShowCoachForm}
                  onSuccess={() => toast({ title: "Success", description: "Coach appointed!" })}
                />
              </div>
            )}

            {/* APPOINTMENTS LIST */}
            <h3 className="text-2xl font-bold mt-8 mb-4">All Appointments</h3>
            {loadingAppointments ? (
              <p className="text-center text-gray-500 py-8">Loading appointments...</p>
            ) : appointments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No appointments yet. Create one!</p>
            ) : (
              <div className="space-y-4">
                {appointments.map((apt) => {
                  const officialName = apt.referee || apt.ar || "—";
                  const roleLabel = apt.referee ? "Referee" : "Assistant Referee";

                  return (
                    <Card key={apt.id} className="p-5 hover:shadow-md transition">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold">
                              {apt.homeTeam} vs {apt.awayTeam}
                            </h3>

                            {/* FIXED: Safe status display */}
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
                                School Game
                              </Badge>
                            )}
                          </div>

                          <p className="text-gray-600">
                            Date: {apt.date} • Time: {apt.time}
                          </p>
                          <p className="text-gray-600">Venue: {apt.venue}</p>
                          <p className="text-gray-600">
                            {roleLabel}: <strong>{officialName}</strong>
                          </p>

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
                            <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="input" />
                            <input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} className="input" />
                          </div>
                          <input type="text" placeholder="Home Team" value={editForm.homeTeam} onChange={(e) => setEditForm({ ...editForm, homeTeam: e.target.value })} className="input" />
                          <input type="text" placeholder="Away Team" value={editForm.awayTeam} onChange={(e) => setEditForm({ ...editForm, awayTeam: e.target.value })} className="input" />
                          <select value={editForm.venue} onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })} className="input">
                            {mockVenues.map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveEdit(apt.id)} className="flex-1">Save</Button>
                            <Button size="sm" variant="danger" onClick={() => setActiveEditId(null)} className="flex-1">Cancel</Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
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