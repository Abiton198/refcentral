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
    secondTeamGame: "",
    venue: "",
    mainReferee: "",
    firstReserve: "",
    gameType: "league",
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

  // ✅ Create / Update with Audit Trail
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const required = [
      formData.date,
      formData.time,
      formData.homeTeam,
      formData.awayTeam,
      formData.venue,
      formData.mainReferee,
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
      const selectedRef = referees.find(
        (r) => `${r.name} ${r.surname}` === formData.mainReferee
      );
      if (!selectedRef) {
        toast({
          title: "Referee not found",
          description: "Please select a valid referee.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const appointmentData = {
        date: formData.date,
        time: formData.time,
        homeTeam: formData.homeTeam,
        awayTeam: formData.awayTeam,
        secondTeamGame: formData.secondTeamGame,
        venue: formData.venue,
        mainReferee: formData.mainReferee,
        refereeId: selectedRef.id,
        refereeEmail: selectedRef.email || selectedRef.id,
        firstReserve: formData.firstReserve,
        gameType: formData.gameType,
        isSchoolGame: formData.isSchoolGame,
        status: "pending",
        appointedBy,
        createdBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (editId) {
        // 🧾 Append audit trail entry
        const existingDoc = await getDoc(doc(db, "appointments", editId));
        const existingData = existingDoc.exists() ? existingDoc.data() : {};
        const auditTrail = existingData?.auditTrail || [];

        const newEntry = {
          action: "reassigned/updated",
          by: appointedBy,
          timestamp: new Date().toISOString(),
          details: `Assigned to ${formData.mainReferee}`,
        };

        await updateDoc(doc(db, "appointments", editId), {
          ...appointmentData,
          auditTrail: [...auditTrail, newEntry],
        });

        toast({
          title: "Updated",
          description: `Appointment updated and audit logged ✅`,
        });
      } else {
        // 🧾 Create new appointment with initial audit
        const newEntry = {
          action: "created",
          by: appointedBy,
          timestamp: new Date().toISOString(),
          details: `Initial assignment to ${formData.mainReferee}`,
        };

        await addDoc(collection(db, "appointments"), {
          ...appointmentData,
          auditTrail: [newEntry],
        });

        toast({
          title: "Created",
          description: `Appointment assigned and audit logged ✅`,
        });
      }

      setFormData({
        date: "",
        time: "",
        homeTeam: "",
        awayTeam: "",
        secondTeamGame: "",
        venue: "",
        mainReferee: "",
        firstReserve: "",
        gameType: "league",
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

  // ✅ Edit
  const handleEdit = (appt: any) => {
    setFormData({
      date: appt.date,
      time: appt.time,
      homeTeam: appt.homeTeam,
      awayTeam: appt.awayTeam,
      secondTeamGame: appt.secondTeamGame || "",
      venue: appt.venue,
      mainReferee: appt.mainReferee,
      firstReserve: appt.firstReserve || "",
      gameType: appt.gameType || "league",
      isSchoolGame: appt.isSchoolGame || false,
    });
    setEditId(appt.id);
    setShowForm(true);
  };

  // ✅ Delete
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
        <h3 className="text-2xl font-bold text-gray-900">
          Appointment Management
        </h3>
        <Button variant="outline" onClick={() => setShowForm(!showForm)}>
          {showForm ? "➖ Close Form" : "➕ New Appointment"}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-6 border rounded-lg bg-gray-50 space-y-4"
        >
          {/* Standard Fields */}
          <div className="grid grid-cols-2 gap-4">
            <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="border rounded-lg px-4 py-2" required />
            <input type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} className="border rounded-lg px-4 py-2" required />
          </div>

          <select value={formData.homeTeam} onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })} className="w-full border rounded-lg px-4 py-2" required>
            <option value="">Select Home Team</option>
            {mockTeams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>

          <select value={formData.awayTeam} onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })} className="w-full border rounded-lg px-4 py-2" required>
            <option value="">Select Away Team</option>
            {mockTeams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>

          <input type="text" placeholder="Second Team Game (optional)" value={formData.secondTeamGame} onChange={(e) => setFormData({ ...formData, secondTeamGame: e.target.value })} className="w-full border rounded-lg px-4 py-2" />

          <select value={formData.venue} onChange={(e) => setFormData({ ...formData, venue: e.target.value })} className="w-full border rounded-lg px-4 py-2" required>
            <option value="">Select Venue</option>
            {mockVenues.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          {/* Referees */}
          <select value={formData.mainReferee} onChange={(e) => setFormData({ ...formData, mainReferee: e.target.value })} className="w-full border rounded-lg px-4 py-2" required>
            <option value="">Select Main Referee</option>
            {referees.map((ref) => (
              <option key={ref.id} value={`${ref.name} ${ref.surname}`}>
                {ref.name} {ref.surname}
              </option>
            ))}
          </select>

          <select value={formData.firstReserve} onChange={(e) => setFormData({ ...formData, firstReserve: e.target.value })} className="w-full border rounded-lg px-4 py-2">
            <option value="">Select 1st Reserve</option>
            {referees.map((ref) => (
              <option key={ref.id} value={`${ref.name} ${ref.surname}`}>
                {ref.name} {ref.surname}
              </option>
            ))}
          </select>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : editId ? "💾 Update / Reassign" : "✅ Create Appointment"}
          </Button>
        </form>
      )}

      {/* Appointment List */}
      <div>
        <h4 className="text-lg font-semibold mt-8 mb-2">
          Current Appointments
        </h4>
        {appointments.length === 0 ? (
          <p className="text-gray-600">No appointments yet.</p>
        ) : (
          <ul className="space-y-3 text-sm text-gray-700">
            {appointments.map((appt) => (
              <li
                key={appt.id}
                className="border rounded-lg p-3 bg-white shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">
                      {appt.date} • {appt.homeTeam} vs {appt.awayTeam}
                    </p>
                    <p className="text-gray-600">
                      ⏰ {appt.time} • 📍 {appt.venue}
                    </p>
                    <p className="text-gray-600 text-sm">
                      Referee: {appt.mainReferee}
                    </p>
                    {appt.appointedBy && (
                      <p className="text-xs text-gray-500 mt-1">
                        👤 Appointed by:{" "}
                        <span className="font-medium text-gray-700">
                          {appt.appointedBy}
                        </span>
                      </p>
                    )}
                    {/* 🧾 Audit Trail Display */}
                    {appt.auditTrail && appt.auditTrail.length > 0 && (
                      <div className="mt-3 bg-gray-50 border rounded p-2">
                        <p className="font-medium text-sm text-gray-700 mb-1">
                          🧾 Audit Trail:
                        </p>
                        <ul className="text-xs text-gray-600 space-y-1 max-h-24 overflow-y-auto">
                          {appt.auditTrail.map((log: any, i: number) => (
                            <li key={i}>
                              <span className="font-semibold text-gray-800">
                                {log.by}
                              </span>{" "}
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
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(appt.id)}
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
