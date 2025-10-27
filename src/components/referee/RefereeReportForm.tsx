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
    timeOfIncident: "",
  });
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(true);

  const auth = getAuth();
  const user = auth.currentUser;

  // ⚖️ Common Laws for Red Card
  const commonRedCardLaws = [
    { value: "Law 9.2 - Outside Interference", label: "Law 9.2 – Outside Interference (Serious Conduct)" },
    { value: "Law 12.3 - Serious foul play", label: "Law 12.3 – Serious Foul Play" },
    { value: "Law 12.4 - Violent conduct", label: "Law 12.4 – Violent Conduct" },
    { value: "Law 12.5 - Spitting", label: "Law 12.5 – Spitting at Opponent/Person" },
    { value: "Law 12.6 - Denying goal (handball)", label: "Law 12.6 – Denying Goal (Handball)" },
    { value: "Law 12.7 - Denying goal (foul)", label: "Law 12.7 – Denying Goal (Foul)" },
    { value: "Law 12.8 - Abusive language", label: "Law 12.8 – Abusive Language / Gestures" },
    { value: "Law 12.9 - Second caution", label: "Law 12.9 – Second Caution (Two Yellow Cards)" },
  ];

  // 🧾 Load referee’s assigned matches
  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user?.email) return;
      try {
        const q = query(
          collection(db, "appointments"),
          where("refereeEmail", "==", user.email)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setAppointments(data);
      } catch (err) {
        console.error("Error loading appointments:", err);
      }
    };
    fetchAppointments();
  }, [user?.email]);

  // 🧩 Auto-fill when a match is selected
  useEffect(() => {
    const match = appointments.find((m) => m.id === formData.matchId);
    setSelectedMatch(match || null);
  }, [formData.matchId, appointments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.matchId) {
      alert("Please select your assigned match.");
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
        type: formData.type,
        lawBroken: formData.lawBroken,
        description: formData.description,
        timeOfIncident: formData.timeOfIncident,
        matchId: formData.matchId,
        matchDetails: {
          homeTeam: selectedMatch?.homeTeam || "",
          awayTeam: selectedMatch?.awayTeam || "",
          venue:
            selectedMatch?.venue ||
            selectedMatch?.venueName ||
            selectedMatch?.location ||
            "Unknown Venue",
          date: selectedMatch?.date || "",
          time: selectedMatch?.time || "",
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
        <h3 className="text-2xl font-bold text-emerald-600 mb-2">
          ✅ Report Submitted
        </h3>
        <p className="text-gray-700">
          Your report has been successfully recorded and forwarded to the
          Executive board.
        </p>
      </div>
    );

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">
        🧾 Match Incident Report
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Match Selection */}
        <div>
          <label className="font-medium text-sm text-gray-700">
            Select Match
          </label>
          <select
            value={formData.matchId}
            onChange={(e) =>
              setFormData({ ...formData, matchId: e.target.value })
            }
            className="w-full border rounded-lg px-4 py-2 mt-1"
            required
          >
            <option value="">Select from your appointments</option>
            {appointments.length === 0 ? (
              <option disabled>No assigned matches</option>
            ) : (
              appointments.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.homeTeam} vs {m.awayTeam} — {m.date} @{" "}
                  {m.venue || m.venueName || m.location}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Auto-filled details */}
        {selectedMatch && (
          <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-700">
            <p>
              🏟️ <strong>Venue:</strong>{" "}
              {selectedMatch.venue || selectedMatch.venueName || selectedMatch.location}
            </p>
            <p>
              📅 <strong>Date:</strong> {selectedMatch.date}
            </p>
            <p>
              ⏰ <strong>Time:</strong> {selectedMatch.time}
            </p>
          </div>
        )}

        {/* Type of Report */}
        <div>
          <label className="font-medium text-sm text-gray-700">
            Type of Incident
          </label>
          <select
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value })
            }
            className="w-full border rounded-lg px-4 py-2 mt-1"
            required
          >
            <option value="red_card">🟥 Red Card / Misconduct</option>
            <option value="incident"> Match Incident / Observation</option>
            <option value="general">📝 General Match Report</option>
          </select>
        </div>

        {/* Law Broken (if red card) */}
        {formData.type === "red_card" && (
          <div>
            <label className="font-medium text-sm text-gray-700">
              Law Broken (optional)
            </label>
            <select
              value={formData.lawBroken}
              onChange={(e) =>
                setFormData({ ...formData, lawBroken: e.target.value })
              }
              className="w-full border rounded-lg px-4 py-2 mt-1"
            >
              <option value="">Select Law</option>
              {commonRedCardLaws.map((law) => (
                <option key={law.value} value={law.value}>
                  {law.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Time of Incident */}
        <div>
          <label className="font-medium text-sm text-gray-700">
            Time of Incident
          </label>
          <input
            type="time"
            value={formData.timeOfIncident}
            onChange={(e) =>
              setFormData({ ...formData, timeOfIncident: e.target.value })
            }
            className="w-full border rounded-lg px-4 py-2 mt-1"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="font-medium text-sm text-gray-700">
            Description of Incident
          </label>
          <textarea
            placeholder="Describe what happened, who was involved, and your actions..."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="w-full border rounded-lg px-4 py-2 mt-1"
            rows={4}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Submitting..." : "Submit Report"}
        </Button>
      </form>
    </div>
  );
};
