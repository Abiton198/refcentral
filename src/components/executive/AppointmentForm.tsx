import React, { useEffect, useState } from "react";
import { Button } from "../ui/Button";
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
import { mockTeams, mockVenues } from "../../data/mockData";
import { toast } from "@/components/ui/use-toast";

export const AppointmentForm: React.FC = () => {
  const [referees, setReferees] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: "",
    time: "",
    homeTeam: "",
    awayTeam: "",
    venue: "",
    role: "referee", // ✅ Only referee or AR
    selectedReferee: "",
    gameType: "league",
    game: "",
    isSchoolGame: false,
  });

  const auth = getAuth();
  const user = auth.currentUser;
  const appointedBy =
    user?.displayName || user?.email?.split("@")[0] || "Executive";

  // ✅ Fetch referees
  useEffect(() => {
    const refQuery = query(collection(db, "referees"), where("status", "==", "active"));
    const unsub = onSnapshot(refQuery, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setReferees(data);
    });
    return () => unsub();
  }, []);

  // ✅ Fetch appointments
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "appointments"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAppointments(data);
    });
    return () => unsub();
  }, []);

  // ✅ Create / Update with audit trail
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const required = [
      formData.date,
      formData.time,
      formData.homeTeam,
      formData.awayTeam,
      formData.venue,
      formData.selectedReferee,
      formData.gameType,
      formData.game,
    ];
    if (required.some((f) => !f)) {
      toast({
        title: "Missing Fields",
        description: "Please complete all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const selectedRef = referees.find((r) => {
        const fullName = `${r.name || ""} ${r.surname || ""}`.trim();
        return fullName === formData.selectedReferee;
      });

      if (!selectedRef) {
        toast({
          title: "Referee not found",
          description: "Please select a valid referee.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const fullName = `${selectedRef.name || ""} ${selectedRef.surname || ""}`.trim() || "Unnamed Referee";

      // ✅ Simplified appointment structure (Referee + AR only)
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

        // Officials
        referee: "",
        refereeId: "",
        refereeEmail: "",
        ar: "",
        arId: "",
        arEmail: "",

        responses: {},
      };

      if (formData.role === "referee") {
        appointmentData.referee = fullName;
        appointmentData.refereeId = selectedRef.id;
        appointmentData.refereeEmail = selectedRef.email || selectedRef.id;
      } else if (formData.role === "ar") {
        appointmentData.ar = fullName;
        appointmentData.arId = selectedRef.id;
        appointmentData.arEmail = selectedRef.email || selectedRef.id;
      }

      // ✅ Audit trail
      const auditEntry = {
        action: editId ? "updated" : "created",
        by: appointedBy,
        timestamp: new Date().toISOString(),
        details: `${editId ? "Updated" : "Created"} appointment for ${fullName} as ${formData.role.toUpperCase()}`,
      };

      if (editId) {
        const existingDoc = await getDoc(doc(db, "appointments", editId));
        const existingData = existingDoc.exists() ? existingDoc.data() : {};
        const auditTrail = existingData?.auditTrail || [];

        await updateDoc(doc(db, "appointments", editId), {
          ...appointmentData,
          auditTrail: [...auditTrail, auditEntry],
        });

        toast({
          title: "Updated",
          description: `Appointment updated successfully ✅`,
        });
      } else {
        await addDoc(collection(db, "appointments"), {
          ...appointmentData,
          auditTrail: [auditEntry],
        });

        toast({
          title: "Created",
          description: `Appointment created successfully ✅`,
        });
      }

      setFormData({
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
      setEditId(null);
      setShowForm(false);
    } catch (err) {
      console.error("Error saving appointment:", err);
      toast({
        title: "Error",
        description: "Failed to save appointment. Check permissions or rules.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Edit appointment
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

  // ✅ Delete appointment
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;
    try {
      await deleteDoc(doc(db, "appointments", id));
      toast({ title: "Deleted", description: "Appointment removed 🗑️" });
    } catch (err) {
      console.error("Error deleting appointment:", err);
      toast({
        title: "Error",
        description: "Failed to delete appointment.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900">Appointment Management</h3>
        <Button variant="outline" onClick={() => setShowForm(!showForm)}>
          {showForm ? "➖ Close Form" : "➕ New Appointment"}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-6 border rounded-lg bg-gray-50 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="border rounded-lg px-4 py-2"
              required
            />
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="border rounded-lg px-4 py-2"
              required
            />
          </div>

          {/* Teams */}
          <select
            value={formData.homeTeam}
            onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })}
            className="w-full border rounded-lg px-4 py-2"
            required
          >
            <option value="">Select Home Team</option>
            {mockTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>

          <select
            value={formData.awayTeam}
            onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })}
            className="w-full border rounded-lg px-4 py-2"
            required
          >
            <option value="">Select Away Team</option>
            {mockTeams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>

          {/* Venue */}
          <select
            value={formData.venue}
            onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
            className="w-full border rounded-lg px-4 py-2"
            required
          >
            <option value="">Select Venue</option>
            {mockVenues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          {/* Game Type */}
          <select
            value={formData.gameType}
            onChange={(e) => setFormData({ ...formData, gameType: e.target.value })}
            className="w-full border rounded-lg px-4 py-2"
            required
          >
            <option value="league">League</option>
            <option value="school">School</option>
            <option value="tournament">Tournament</option>
            <option value="friendly">Friendly</option>
            <option value="ep">EP Game</option>
          </select>

          {/* Game */}
          <select
            value={formData.game}
            onChange={(e) => setFormData({ ...formData, game: e.target.value })}
            className="w-full border rounded-lg px-4 py-2"
            required
          >
            <option value="">Select Game</option>
            <option value="1st team">1st Team</option>
            <option value="1st reserve">1st Reserve</option>
            <option value="2nd team">2nd Team</option>
          </select>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Role *
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
              required
            >
              <option value="referee">Referee</option>
              <option value="ar">Assistant Referee</option>
            </select>
          </div>

          {/* Referee Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Referee *
            </label>
            <select
              value={formData.selectedReferee}
              onChange={(e) => setFormData({ ...formData, selectedReferee: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
              required
            >
              <option value="">Select Referee</option>
              {referees.map((ref) => {
                const fullName = `${ref.name || ""} ${ref.surname || ""}`.trim() || "Unnamed Referee";
                return (
                  <option key={ref.id} value={fullName}>
                    {fullName}
                  </option>
                );
              })}
            </select>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : editId ? "💾 Update Appointment" : "✅ Create Appointment"}
          </Button>
        </form>
      )}

      {/* Appointment List */}
      <div>
        <h4 className="text-lg font-semibold mt-8 mb-2">Current Appointments</h4>
        {appointments.length === 0 ? (
          <p className="text-gray-600">No appointments yet.</p>
        ) : (
          <ul className="space-y-3 text-sm text-gray-700">
            {appointments.map((appt) => {
              const roleLabel = appt.referee ? "Referee" : "Assistant Referee";
              const officialName = appt.referee || appt.ar || "Unnamed";

              return (
                <li key={appt.id} className="border rounded-lg p-3 bg-white shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">
                        {appt.date} • {appt.homeTeam} vs {appt.awayTeam}
                      </p>
                      <p className="text-gray-600">
                        ⏰ {appt.time} • 📍 {appt.venue}
                      </p>
                      <p className="text-gray-600 text-sm">
                        🎯 {(appt.gameType || "unknown").toUpperCase()} • {appt.game || "N/A"}
                      </p>
                      <p className="text-gray-600 text-sm">
                        {roleLabel}: {officialName}
                      </p>
                      {appt.appointedBy && (
                        <p className="text-xs text-gray-500 mt-1">
                          👤 Appointed by:{" "}
                          <span className="font-medium text-gray-700">{appt.appointedBy}</span>
                        </p>
                      )}
                      {appt.auditTrail && appt.auditTrail.length > 0 && (
                        <div className="mt-3 bg-gray-50 border rounded p-2">
                          <p className="font-medium text-sm text-gray-700 mb-1">🧾 Audit Trail:</p>
                          <ul className="text-xs text-gray-600 space-y-1 max-h-24 overflow-y-auto">
                            {appt.auditTrail.map((log: any, i: number) => (
                              <li key={i}>
                                <span className="font-semibold text-gray-800">{log.by}</span>{" "}
                                {log.action} — {log.details}{" "}
                                <span className="text-gray-400">
                                  ({new Date(log.timestamp).toLocaleString()})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleEdit(appt)}>
                        ✏️ Edit
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(appt.id)}>
                        🗑️ Delete
                      </Button>
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
