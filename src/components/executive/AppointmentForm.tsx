// src/components/appointments/AppointmentForm.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/input";
import { db } from "../../lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { toast } from "@/components/ui/use-toast";
import { Search, ArrowUpDown } from "lucide-react";

export const AppointmentForm: React.FC = () => {
  const [referees, setReferees] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [refSearch, setRefSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [formData, setFormData] = useState({
    date: "",
    time: "",
    homeTeam: "",
    awayTeam: "",
    venue: "",
    role: "referee",
    selectedReferee: "",
    gameType: "league",
    game: "",
    isSchoolGame: false,
  });

  const auth = getAuth();
  const user = auth.currentUser;
  const appointedBy = user?.displayName || user?.email?.split("@")[0] || "Executive";

  // Fetch referees
  useEffect(() => {
    const refQuery = query(collection(db, "referees"), where("status", "==", "active"));
    const unsub = onSnapshot(refQuery, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setReferees(data);
    });
    return () => unsub();
  }, []);

  // Fetch teams
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "teams"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeams(data);
    });
    return () => unsub();
  }, []);

  // Auto-populate venue
  useEffect(() => {
    if (formData.homeTeam && teams.length > 0) {
      const selectedTeam = teams.find((t) => t.name === formData.homeTeam);
      if (selectedTeam?.homeGround) {
        setFormData((prev) => ({ ...prev, venue: selectedTeam.homeGround }));
      }
    }
  }, [formData.homeTeam, teams]);

  // Fetch appointments
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "appointments"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAppointments(data);
    });
    return () => unsub();
  }, []);

  // Filtered & Sorted Referees
  const filteredAndSortedReferees = useMemo(() => {
    let filtered = referees;

    if (refSearch.trim()) {
      const term = refSearch.toLowerCase();
      filtered = referees.filter((ref) => {
        const fullName = `${ref.name || ""} ${ref.surname || ""}`.toLowerCase();
        return fullName.includes(term);
      });
    }

    return filtered.sort((a, b) => {
      const nameA = `${a.name || ""} ${a.surname || ""}`.trim();
      const nameB = `${b.name || ""} ${b.surname || ""}`.trim();
      return sortOrder === "asc"
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });
  }, [referees, refSearch, sortOrder]);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const required = [
      formData.date, formData.time, formData.homeTeam, formData.awayTeam,
      formData.venue, formData.selectedReferee, formData.gameType, formData.game,
    ];
    if (required.some((f) => !f)) {
      toast({ title: "Missing Fields", description: "Please complete all required fields.", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);

      const selectedRef = referees.find((r) => {
        const fullName = `${r.name || ""} ${r.surname || ""}`.trim();
        return fullName === formData.selectedReferee;
      });

      if (!selectedRef) {
        toast({ title: "Referee not found", description: "Please select a valid referee.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const fullName = `${selectedRef.name || ""} ${selectedRef.surname || ""}`.trim();

      const appointmentData = {
        date: formData.date,
        time: formData.time,
        homeTeam: formData.homeTeam,
        awayTeam: formData.awayTeam,
        venue: formData.venue,
        gameType: formData.gameType,
        game: formData.game,
        isSchoolGame: formData.isSchoolGame,
        appointedBy,
        createdBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        responses: {},
      };

      if (formData.role === "referee") {
        appointmentData.referee = fullName;
        appointmentData.refereeId = selectedRef.id;
        appointmentData.refereeEmail = selectedRef.email || "";
      } else {
        appointmentData.ar = fullName;
        appointmentData.arId = selectedRef.id;
        appointmentData.arEmail = selectedRef.email || "";
      }

      const auditEntry = {
        action: editId ? "updated" : "created",
        by: appointedBy,
        timestamp: new Date().toISOString(),
        details: `${editId ? "Updated" : "Created"} appointment for ${fullName} as ${formData.role.toUpperCase()}`,
      };

      if (editId) {
        const existingDoc = await getDoc(doc(db, "appointments", editId));
        const existingData = existingDoc.exists() ? existingDoc.data() : {};
        const auditTrail = existingData?.auditTrail || [...existingData.auditTrail || [], auditEntry];
        await updateDoc(doc(db, "appointments", editId), { ...appointmentData, auditTrail });
        toast({ title: "Updated", description: "Appointment updated successfully." });
      } else {
        await addDoc(collection(db, "appointments"), {
          ...appointmentData,
          auditTrail: [auditEntry],
        });
        toast({ title: "Created", description: "Appointment created successfully." });
      }

      resetForm();
    } catch (err) {
      console.error("Error saving appointment:", err);
      toast({ title: "Error", description: "Failed to save appointment.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      date: "", time: "", homeTeam: "", awayTeam: "", venue: "",
      role: "referee", selectedReferee: "", gameType: "league", game: "", isSchoolGame: false,
    });
    setEditId(null);
    setShowForm(false);
  };

  const handleEdit = (appt: any) => {
    const role = appt.referee ? "referee" : "ar";
    const selectedReferee = appt.referee || appt.ar || "";
    setFormData({
      date: appt.date,
      time: appt.time,
      homeTeam: appt.homeTeam,
      awayTeam: appt.awayTeam,
      venue: appt.venue,
      role,
      selectedReferee,
      gameType: appt.gameType || "league",
      game: appt.game || "",
      isSchoolGame: appt.isSchoolGame || false,
    });
    setEditId(appt.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;
    try {
      await deleteDoc(doc(db, "appointments", id));
      toast({ title: "Deleted", description: "Appointment removed." });
    } catch (err) {
      console.error("Error deleting appointment:", err);
      toast({ title: "Error", description: "Failed to delete appointment.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900">Appointment Management</h3>
        <Button variant="outline" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Close Form" : "New Appointment"}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-6 border rounded-lg bg-gray-50 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="border rounded-lg px-4 py-2" required />
            <input type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className="border rounded-lg px-4 py-2" required />
          </div>

          {/* Teams */}
          <select value={formData.homeTeam} onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })} className="w-full border rounded-lg px-4 py-2" required>
            <option value="">Select Home Team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.name}>{team.name}</option>
            ))}
          </select>

          <select value={formData.awayTeam} onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })} className="w-full border rounded-lg px-4 py-2" required>
            <option value="">Select Away Team</option>
            {teams
              .filter((t) => t.name !== formData.homeTeam)
              .map((team) => (
                <option key={team.id} value={team.name}>{team.name}</option>
              ))}
          </select>

          <input type="text" value={formData.venue} onChange={(e) => setFormData({ ...formData, venue: e.target.value })} className="w-full border rounded-lg px-4 py-2" placeholder="Venue" required />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={formData.gameType} onChange={(e) => setFormData({ ...formData, gameType: e.target.value })} className="border rounded-lg px-4 py-2" required>
              <option value="league">League</option>
              <option value="school">School</option>
              <option value="tournament">Tournament</option>
              <option value="friendly">Friendly</option>
            </select>

            <select value={formData.game} onChange={(e) => setFormData({ ...formData, game: e.target.value })} className="border rounded-lg px-4 py-2" required>
              <option value="">Select Game</option>
              <option value="1st team">1st Team</option>
              <option value="1st reserve">1st Reserve</option>
              <option value="2nd team">2nd Team</option>
            </select>
          </div>

          <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full border rounded-lg px-4 py-2" required>
            <option value="referee">Referee</option>
            <option value="ar">Assistant Referee</option>
          </select>

          {/* Referee Search + Sort + Dropdown */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search referees..."
                  value={refSearch}
                  onChange={(e) => setRefSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="shrink-0"
              >
                <ArrowUpDown className="w-4 h-4" />
              </Button>
            </div>

            <select
              value={formData.selectedReferee}
              onChange={(e) => setFormData({ ...formData, selectedReferee: e.target.value })}
              className="w-full border rounded-lg px-4 py-2 text-sm"
              required
            >
              <option value="">Select Referee</option>
              {filteredAndSortedReferees.map((ref) => {
                const fullName = `${ref.name || ""} ${ref.surname || ""}`.trim();
                return (
                  <option key={ref.id} value={fullName}>
                    {fullName} {ref.email ? `(${ref.email})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : editId ? "Update" : "Create"} Appointment
          </Button>
        </form>
      )}

      {/* List */}
      <div>
        <h4 className="text-lg font-semibold mt-8 mb-2">Current Appointments</h4>
        {appointments.length === 0 ? (
          <p className="text-gray-600">No appointments yet.</p>
        ) : (
          <ul className="space-y-3">
            {appointments.map((appt) => {
              const officialName = appt.referee || appt.ar || "Unnamed";
              const roleLabel = appt.referee ? "Referee" : "Assistant Referee";
              return (
                <li key={appt.id} className="border rounded-lg p-3 bg-white shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold">{appt.homeTeam} vs {appt.awayTeam}</p>
                      <p className="text-sm text-gray-600">{appt.date} • {appt.time} • {appt.venue}</p>
                      <p className="text-sm text-emerald-700 font-medium">{roleLabel}: {officialName}</p>
                    </div>
                    <div className="flex gap-2 mt-2 sm:mt-0">
                      <Button size="sm" onClick={() => handleEdit(appt)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(appt.id)}>Delete</Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};