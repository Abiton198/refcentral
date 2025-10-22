import React, { useState, useEffect } from "react";
import { Button } from "../ui/Button";
import { db } from "../../lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export const RefereeReportForm: React.FC = () => {
  const [formData, setFormData] = useState({
    type: "red_card",
    matchId: "",
    lawBroken: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    timeOfIncident: "",
  });
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(true);

  const auth = getAuth();
  const user = auth.currentUser;

  // ⚖️ Common Laws for Red Card
  const commonRedCardLaws = [
    { value: "Law 9.2 - Outside Interference", label: "Law 9.2 – Outside Interference (Serious Conduct)" },
    { value: "Law 12.3 - Serious foul play", label: "Law 12.3 – Serious Foul Play" },
    { value: "Law 12.4 - Violent conduct", label: "Law 12.4 – Violent Conduct" },
    { value: "Law 12.5 - Spitting at opponent/person", label: "Law 12.5 – Spitting at Opponent or Person" },
    { value: "Law 12.6 - Denying goal (handball)", label: "Law 12.6 – Denying Goal or Goal-Scoring Opportunity (Handball)" },
    { value: "Law 12.7 - Denying goal (foul)", label: "Law 12.7 – Denying Goal or Goal-Scoring Opportunity (Foul)" },
    { value: "Law 12.8 - Abusive language", label: "Law 12.8 – Offensive, Insulting or Abusive Language / Gestures" },
    { value: "Law 12.9 - Second caution", label: "Law 12.9 – Second Caution (Two Yellow Cards)" },
  ];

  // 🧾 Load referee’s assigned matches for that date
  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user?.email) return;
      try {
        const q = query(
          collection(db, "appointments"),
          where("refereeEmail", "==", user.email),
          where("date", "==", formData.date)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAppointments(data);
      } catch (err) {
        console.error("Error loading appointments:", err);
      }
    };
    fetchAppointments();
  }, [formData.date, user?.email]);

  // ✅ Validate incident time within match timeframe
  const isTimeWithinMatch = (match: any, time: string) => {
    if (!match?.time || !time) return false;

    const matchStart = new Date(`${match.date}T${match.time}`);
    const matchEnd = new Date(matchStart.getTime() + 90 * 60000); // +90 minutes
    const incident = new Date(`${match.date}T${time}`);
    return incident >= matchStart && incident <= matchEnd;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedMatch = appointments.find((m) => m.id === formData.matchId);

    if (!formData.matchId) {
      alert("Please select the appointed match for this report.");
      return;
    }

    if (!isTimeWithinMatch(selectedMatch, formData.timeOfIncident)) {
      alert("⏰ The incident time must be within the match timeframe (90 minutes).");
      return;
    }

    if (!formData.description) {
      alert("Please provide a description of the incident.");
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "reports"), {
        referee: user?.displayName || "Unknown Referee",
        refereeEmail: user?.email || "",
        ...formData,
        matchDetails: {
          homeTeam: selectedMatch.homeTeam,
          awayTeam: selectedMatch.awayTeam,
          venue: selectedMatch.venue,
          time: selectedMatch.time,
        },
        createdAt: serverTimestamp(),
      });

      alert("✅ Report submitted successfully!");
      setShowForm(false);
    } catch (err) {
      console.error("Error submitting report:", err);
      alert("❌ Failed to submit report.");
    } finally {
      setLoading(false);
    }
  };

  if (!showForm)
    return (
      <div className="mt-8 p-6 border-t text-center">
        <h3 className="text-2xl font-bold text-emerald-600 mb-2">✅ Report Submitted</h3>
        <p className="text-gray-700">Your report has been successfully recorded and forwarded to the Executive review board.</p>
      </div>
    );

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">🧾 Submit Match Report</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type of Report */}
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          className="w-full border rounded-lg px-4 py-2"
          required
        >
          <option value="red_card">🟥 Red Card / Misconduct</option>
          <option value="incident">⚽ Match Incident / Observation</option>
          <option value="general">📝 General Match Report</option>
        </select>

        {/* Match Selection */}
        <select
          value={formData.matchId}
          onChange={(e) => setFormData({ ...formData, matchId: e.target.value })}
          className="w-full border rounded-lg px-4 py-2"
          required
        >
          <option value="">Select Your Assigned Match</option>
          {appointments.length === 0 ? (
            <option disabled>No assigned matches on this date</option>
          ) : (
            appointments.map((m) => (
              <option key={m.id} value={m.id}>
                {m.homeTeam} vs {m.awayTeam} — {m.time} @ {m.venue}
              </option>
            ))
          )}
        </select>

        {/* Law Broken */}
        {formData.type === "red_card" && (
          <select
            value={formData.lawBroken}
            onChange={(e) =>
              setFormData({ ...formData, lawBroken: e.target.value })
            }
            className="w-full border rounded-lg px-4 py-2"
          >
            <option value="">Select Applicable Law (optional)</option>
            {commonRedCardLaws.map((law) => (
              <option key={law.value} value={law.value}>
                {law.label}
              </option>
            ))}
          </select>
        )}

        {/* Date */}
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          className="w-full border rounded-lg px-4 py-2"
          required
        />

        {/* Time of Incident */}
        <input
          type="time"
          value={formData.timeOfIncident}
          onChange={(e) =>
            setFormData({ ...formData, timeOfIncident: e.target.value })
          }
          className="w-full border rounded-lg px-4 py-2"
          required
        />

        {/* Description */}
        <textarea
          placeholder="Describe what happened, who was involved, and referee action taken..."
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="w-full border rounded-lg px-4 py-2"
          rows={4}
          required
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Submitting..." : "Submit Report"}
        </Button>
      </form>
    </div>
  );
};
