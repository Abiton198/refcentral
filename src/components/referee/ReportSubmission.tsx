import React, { useState, useEffect } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { db } from "../../lib/firebase";
import {
  addDoc,
  collection,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { format } from "date-fns";

interface ReportSubmissionProps {
  onClose: () => void;
  reportId?: string | null;
}

const rugbyLaws = [
  { number: "Law 9.11", title: "Players must not do anything that is reckless or dangerous to others" },
  { number: "Law 9.12", title: "A player must not physically or verbally abuse anyone" },
  { number: "Law 9.13", title: "Dangerous tackling of an opponent" },
  { number: "Law 9.16", title: "No charging without attempting to grasp the opponent" },
  { number: "Law 9.17", title: "No tackling a player whose feet are off the ground" },
  { number: "Law 9.18", title: "No tackling the jumper in the air" },
  { number: "Law 9.20", title: "Dangerous play in a ruck or maul" },
  { number: "Law 9.25", title: "Unsporting conduct" },
  { number: "Law 9.27", title: "Disputing the referee’s decisions" },
  { number: "Law 9.28", title: "Repeated infringements" },
  { number: "Law 9.29", title: "Foul play not specifically covered by other laws" },
];

export const ReportSubmission: React.FC<ReportSubmissionProps> = ({
  onClose,
  reportId,
}) => {
  const [reportType, setReportType] = useState("incident");
  const [loading, setLoading] = useState(false);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    matchDate: "",
    teams: "",
    venue: "",
    details: "",
    playerName: "",
    cardType: "Red Card",
    minute: "",
    lawInfringed: "",
    subject: "",
  });

  const auth = getAuth();
  const user = auth.currentUser;
  const refereeName = user?.displayName || "Unknown Referee";
  const refereeEmail = user?.email || "unknown@example.com";
  const refereeId = user?.uid || "";

  // ✅ Prefill existing report if editing
  useEffect(() => {
    const fetchReport = async () => {
      if (reportId) {
        const ref = doc(db, "reports", reportId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setReportType(data.type || "incident");
          setCreatedAt(data.createdAt?.toDate?.() || null);
          setUpdatedAt(data.updatedAt?.toDate?.() || null);
          setFormData({
            matchDate: data.matchDate || "",
            teams: data.teams || "",
            venue: data.venue || "",
            details: data.details || "",
            playerName: data.playerName || "",
            cardType: data.cardType || "Red Card",
            minute: data.minute || "",
            lawInfringed: data.lawInfringed || "",
            subject: data.subject || "",
          });
        }
      }
    };
    fetchReport();
  }, [reportId]);

  // ✅ Fetch referee's appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      if (!refereeEmail) return;
      try {
        const q = query(
          collection(db, "appointments"),
          where("refereeEmail", "==", refereeEmail)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAppointments(data);
      } catch (err) {
        console.error("Error fetching appointments:", err);
      }
    };
    fetchAppointments();
  }, [refereeEmail]);

  // ✅ Filter appointments when matchDate changes
  useEffect(() => {
    if (!formData.matchDate) return;
    const sameDate = appointments.filter(
      (a) => a.date === formData.matchDate
    );
    setFilteredAppointments(sameDate);
  }, [formData.matchDate, appointments]);

  // ✅ When selecting a game, auto-fill team + venue
  const handleSelectGame = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const match = filteredAppointments.find((a) => a.id === selectedId);
    if (match) {
      setFormData({
        ...formData,
        teams: `${match.homeTeam} vs ${match.awayTeam}`,
        venue: match.venue,
      });
    }
  };

  // ✅ Submit or Update Report
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (reportId) {
        const ref = doc(db, "reports", reportId);
        await updateDoc(ref, {
          ...formData,
          type: reportType,
          updatedAt: serverTimestamp(),
        });
        alert("✅ Report updated successfully!");
      } else {
        await addDoc(collection(db, "reports"), {
          ...formData,
          type: reportType,
          refereeName,
          refereeEmail,
          refereeId,
          createdAt: serverTimestamp(),
        });
        alert("✅ Report submitted successfully!");
      }
      onClose();
    } catch (err) {
      console.error("Error saving report:", err);
      alert("❌ Failed to save report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold">
          {reportId ? "Edit Report" : "Submit Report"}
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
          &times;
        </button>
      </div>

      {/* 🕒 Submission Trail */}
      {(createdAt || updatedAt) && (
        <div className="mb-4 text-sm text-gray-600">
          {createdAt && <p>🕓 Submitted: {format(createdAt, "dd MMM yyyy, HH:mm")}</p>}
          {updatedAt && <p>✏️ Last Edited: {format(updatedAt, "dd MMM yyyy, HH:mm")}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 font-semibold"
        >
          <option value="incident">Incident Report</option>
          <option value="redCard">Red Card Report</option>
          <option value="other">Other Report</option>
        </select>

        {/* 🗓 Select Match Date */}
        <input
          type="date"
          value={formData.matchDate}
          onChange={(e) => setFormData({ ...formData, matchDate: e.target.value })}
          className="w-full border rounded-lg px-4 py-2"
          required
        />

        {/* ⚽ Select Match from Appointments */}
        {filteredAppointments.length > 0 && (
          <select
            onChange={handleSelectGame}
            className="w-full border rounded-lg px-4 py-2"
            defaultValue=""
          >
            <option value="" disabled>
              Select your match on {formData.matchDate}
            </option>
            {filteredAppointments.map((match) => (
              <option key={match.id} value={match.id}>
                {match.homeTeam} vs {match.awayTeam} — {match.venue} @ {match.time}
              </option>
            ))}
          </select>
        )}

        {/* 🏟 Teams & Venue auto-filled */}
        <input
          type="text"
          placeholder="Teams"
          value={formData.teams}
          onChange={(e) => setFormData({ ...formData, teams: e.target.value })}
          className="w-full border rounded-lg px-4 py-2"
          required
        />
        <input
          type="text"
          placeholder="Venue"
          value={formData.venue}
          onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
          className="w-full border rounded-lg px-4 py-2"
          required
        />

        {reportType === "redCard" && (
          <>
            <input
              type="text"
              placeholder="Player Name"
              value={formData.playerName}
              onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
            />
            <input
              type="number"
              placeholder="Minute of Offense"
              value={formData.minute}
              onChange={(e) => setFormData({ ...formData, minute: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
            />
            <select
              value={formData.lawInfringed}
              onChange={(e) => setFormData({ ...formData, lawInfringed: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
            >
              <option value="">Select Law Infringed</option>
              {rugbyLaws.map((law) => (
                <option key={law.number} value={law.number}>
                  {law.number} — {law.title}
                </option>
              ))}
            </select>
          </>
        )}

        <textarea
          placeholder="Full report details..."
          value={formData.details}
          onChange={(e) => setFormData({ ...formData, details: e.target.value })}
          className="w-full border rounded-lg px-4 py-2 h-32"
          required
        />

        <div className="flex gap-3">
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Saving..." : reportId ? "Update Report" : "Submit Report"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};
