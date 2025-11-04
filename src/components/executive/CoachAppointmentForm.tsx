import React, { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { db, auth } from "../../lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { toast } from "@/components/ui/use-toast";

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  venue: string;
  referee?: string;
}

interface Coach {
  id: string;
  firstName: string;
  surname: string;
  email: string;
}

interface Appointment {
  id: string;
  coachId?: string;
  coachName?: string;
  coachEmail?: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  venue: string;
  appointedBy: string;
  status?: "pending" | "accepted" | "rejected";
  createdAt?: any;
  updatedAt?: any;
  auditTrail?: Array<{
    action: string;
    by: string;
    timestamp: string;
    details: string;
  }>;
}

// Props from ExecutiveDashboard
interface CoachAppointmentFormProps {
  showForm: boolean;
  setShowForm: (show: boolean) => void;
  appointments: Appointment[];
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  onSuccess?: () => void;
}

export const CoachAppointmentForm: React.FC<CoachAppointmentFormProps> = ({
  showForm,
  setShowForm,
  appointments,
  setAppointments,
  onSuccess,
}) => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [refereeMatches, setRefereeMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    selectedCoach: "",
    matchId: "",
    date: "",
    time: "",
    homeTeam: "",
    awayTeam: "",
    venue: "",
  });

  const user = auth.currentUser;
  const appointedBy = user?.displayName || user?.email?.split("@")[0] || "Executive";

  // === Fetch Approved Coaches ===
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "coaches"), where("approved", "==", true)),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Coach[];
        setCoaches(data);
      }
    );
    return () => unsub();
  }, []);

  // === Fetch Referee-Appointed Matches ===
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "appointments"), (snap) => {
      const data = snap.docs
        .map((d) => {
          const docData = d.data();
          if (docData.referee || docData.ar) {
            return {
              id: d.id,
              homeTeam: docData.homeTeam,
              awayTeam: docData.awayTeam,
              date: docData.date,
              time: docData.time,
              venue: docData.venue,
              referee: docData.referee || docData.ar,
            } as Match;
          }
          return null;
        })
        .filter((m): m is Match => m !== null);
      setRefereeMatches(data);
    });
    return () => unsub();
  }, []);

  // === Auto-fill Match Details ===
  useEffect(() => {
    if (formData.matchId) {
      const match = refereeMatches.find((m) => m.id === formData.matchId);
      if (match) {
        setFormData((prev) => ({
          ...prev,
          date: match.date || "",
          time: match.time || "",
          homeTeam: match.homeTeam || "",
          awayTeam: match.awayTeam || "",
          venue: match.venue || "",
        }));
      }
    }
  }, [formData.matchId, refereeMatches]);

  // === Edit Appointment ===
  const handleEdit = (appt: Appointment) => {
    setFormData({
      selectedCoach: appt.coachId || "",
      matchId: appt.matchId,
      date: appt.date,
      time: appt.time,
      homeTeam: appt.homeTeam,
      awayTeam: appt.awayTeam,
      venue: appt.venue,
    });
    setCurrentEditId(appt.id);
    setEditMode(true);
    setShowForm(true);
  };

  // === Delete Appointment ===
  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this coach appointment?")) return;
    try {
      await deleteDoc(doc(db, "appointments", id));
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Deleted", description: "Coach appointment removed." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    }
  };

  // === Submit (Create or Update) ===
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.selectedCoach || !formData.matchId) {
      toast({ title: "Error", description: "Select coach and match", variant: "destructive" });
      return;
    }

    const coach = coaches.find((c) => c.id === formData.selectedCoach);
    const match = refereeMatches.find((m) => m.id === formData.matchId);
    if (!coach || !match) return;

    const now = new Date().toISOString();

    const appointmentData = {
      coachId: coach.id,
      coachName: `${coach.firstName} ${coach.surname}`.trim(),
      coachEmail: coach.email,
      matchId: match.id,
      date: match.date,
      time: match.time,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      venue: match.venue,
      appointedBy,
      status: "pending",
      updatedAt: serverTimestamp(),
      auditTrail: editMode
        ? arrayUnion({
            action: "updated",
            by: appointedBy,
            timestamp: now,
            details: `Updated coach for ${match.homeTeam} vs ${match.awayTeam}`,
          })
        : [
            {
              action: "created",
              by: appointedBy,
              timestamp: now,
              details: `Coach appointed to ${match.homeTeam} vs ${match.awayTeam}`,
            },
          ],
    };

    try {
      setLoading(true);
      let newApptId: string;

      if (editMode && currentEditId) {
        // UPDATE
        await updateDoc(doc(db, "appointments", currentEditId), appointmentData);
        newApptId = currentEditId;
        toast({ title: "Updated", description: "Coach appointment updated." });
      } else {
        // CREATE
        const docRef = await addDoc(collection(db, "appointments"), {
          ...appointmentData,
          createdAt: serverTimestamp(),
        });
        newApptId = docRef.id;
        toast({ title: "Success", description: "Coach appointed!" });
      }

      // === UPDATE PARENT STATE INSTANTLY ===
      const newAppt: Appointment = {
        id: newApptId,
        ...appointmentData,
        date: match.date,
        time: match.time,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        venue: match.venue,
        coachId: coach.id,
        status: "pending",
        auditTrail: appointmentData.auditTrail,
      };

      setAppointments((prev) => {
        if (editMode) {
          return prev.map((a) => (a.id === currentEditId ? newAppt : a));
        }
        return [...prev, newAppt];
      });

      // Reset form
      setFormData({
        selectedCoach: "",
        matchId: "",
        date: "", time: "", homeTeam: "", awayTeam: "", venue: "",
      });
      setEditMode(false);
      setCurrentEditId(null);
      setShowForm(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Save error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to save appointment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // === Filter Coach Appointments from Parent State ===
  const coachAppointments = appointments.filter((a) => a.coachId);

  return (
    <div className="space-y-6">

      {/* === FORM === */}
      {showForm && (
        <Card className="p-6 border-t-4 border-emerald-500">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900">
              {editMode ? "Edit" : "Appoint"} Coach
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setEditMode(false);
                setCurrentEditId(null);
                setFormData({
                  selectedCoach: "",
                  matchId: "",
                  date: "", time: "", homeTeam: "", awayTeam: "", venue: "",
                });
              }}
            >
              Close
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Coach Select */}
            <div>
              <label className="block text-sm font-medium mb-1">Select Coach *</label>
              <select
                value={formData.selectedCoach}
                onChange={(e) => setFormData({ ...formData, selectedCoach: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
                required
              >
                <option value="">Choose coach...</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.surname} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Match Select */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Select Match (Referee Appointed) *
              </label>
              <select
                value={formData.matchId}
                onChange={(e) => setFormData({ ...formData, matchId: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
                required
              >
                <option value="">
                  {refereeMatches.length === 0
                    ? "No referee-appointed matches"
                    : "Choose match..."}
                </option>
                {refereeMatches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.homeTeam} vs {m.awayTeam} • {m.date} {m.time} • {m.venue} (Ref: {m.referee})
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-filled Match Info */}
            {formData.matchId && (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h4 className="font-medium mb-2">Match Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Date:</strong> {formData.date}</div>
                  <div><strong>Time:</strong> {formData.time}</div>
                  <div><strong>Home:</strong> {formData.homeTeam}</div>
                  <div><strong>Away:</strong> {formData.awayTeam}</div>
                  <div className="col-span-2"><strong>Venue:</strong> {formData.venue}</div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || refereeMatches.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? "Saving..." : editMode ? "Update Appointment" : "Appoint Coach"}
            </Button>
          </form>
        </Card>
      )}

      {/* === LIST OF COACH APPOINTMENTS === */}
      <div>
        <h3 className="text-xl font-bold mb-4">Coach Appointments</h3>
        {coachAppointments.length === 0 ? (
          <p className="text-gray-500 text-center py-6">
            No coach appointments yet. Appoint a referee first.
          </p>
        ) : (
          <div className="space-y-3">
            {coachAppointments.map((appt) => (
              <Card key={appt.id} className="p-4 hover:shadow-sm transition">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-lg">{appt.coachName}</p>
                    <p className="text-sm text-gray-700">
                      {appt.homeTeam} vs {appt.awayTeam}
                    </p>
                    <p className="text-sm text-gray-600">
                      {appt.date} • {appt.time} • {appt.venue}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Appointed by: <span className="font-medium">{appt.appointedBy}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(appt)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(appt.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};