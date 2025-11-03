import React, { useState, useEffect } from "react";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { db } from "../../../lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  getDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";

// External sub‑forms
import { CardReportForm } from "./CardReportForm";

interface RefereeUnifiedReportCenterProps {
  onClose: () => void;
  reportId?: string | null;
}

export const RefereeUnifiedReportCenter: React.FC<RefereeUnifiedReportCenterProps> = ({
  onClose,
  reportId,
}) => {
  const [reportType, setReportType] = useState<"card" | "general">("card");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const auth = getAuth();
  const user = auth.currentUser;

  const refereeName = user?.displayName || "Unknown Referee";
  const refereeEmail = user?.email || "unknown@example.com";

  /* --------------------------------------------------- */
  /* 1. Fetch assigned matches                           */
  /* --------------------------------------------------- */
  useEffect(() => {
    const fetchAppointments = async () => {
      if (!refereeEmail) return;
      try {
        const q = query(
          collection(db, "appointments"),
          where("refereeEmail", "==", refereeEmail)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAppointments(data);
      } catch (err) {
        console.error(err);
        toast({
          title: "Error",
          description: "Failed to load your matches.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, [refereeEmail]);

  /* --------------------------------------------------- */
  /* 2. Auto‑select the match once an id is chosen       */
  /* --------------------------------------------------- */
  useEffect(() => {
    const found = appointments.find((m) => m.id === selectedMatchId);
    setSelectedMatch(found ?? null);
  }, [selectedMatchId, appointments]);

  /* --------------------------------------------------- */
  /* 3. Load an existing report (edit mode)              */
  /* --------------------------------------------------- */
  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId || appointments.length === 0) return;
      try {
        const snap = await getDoc(doc(db, "reports", reportId));
        if (snap.exists()) {
          const data = snap.data();
          // Only allow card/general in this centre
          if (data.type === "coaching_report") {
            toast({
              title: "Info",
              description: "Coaching reports are edited in their own modal.",
            });
            onClose();
            return;
          }
          setReportType(data.type === "card_report" ? "card" : "general");
          setCreatedAt(data.createdAt?.toDate?.() ?? null);
          setUpdatedAt(data.updatedAt?.toDate?.() ?? null);

          if (data.matchId) {
            setSelectedMatchId(data.matchId);
            const matchSnap = await getDoc(doc(db, "appointments", data.matchId));
            if (matchSnap.exists()) {
              setSelectedMatch({ id: matchSnap.id, ...matchSnap.data() });
            }
          }
        }
      } catch (err) {
        console.error(err);
        toast({
          title: "Error",
          description: "Failed to load existing report.",
          variant: "destructive",
        });
      }
    };
    fetchReport();
  }, [reportId, appointments, onClose]);

  /* --------------------------------------------------- */
  /* 4. Render the correct sub‑form                      */
  /* --------------------------------------------------- */
  const renderReportForm = () => {
    if (!selectedMatch) {
      return (
        <div className="border border-dashed rounded-lg p-8 text-center text-gray-500">
          Select a match to start your report.
        </div>
      );
    }

    if (reportType === "card") {
      return <CardReportForm match={selectedMatch} user={user} onClose={onClose} />;
    }
    return <GeneralIncidentForm match={selectedMatch} user={user} onClose={onClose} />;
  };

  return (
    <Card className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold">Referee Report Center</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-2xl"
        >
          ×
        </button>
      </div>

      {/* Timestamps */}
      {(createdAt || updatedAt) && (
        <div className="mb-4 text-sm text-gray-600 space-y-1">
          {createdAt && <p>Submitted: {format(createdAt, "dd MMM yyyy, HH:mm")}</p>}
          {updatedAt && <p>Last Edited: {format(updatedAt, "dd MMM yyyy, HH:mm")}</p>}
        </div>
      )}

      {/* Match selector */}
      <div className="mb-4">
        <label className="font-medium text-sm text-gray-700">Select Match</label>
        <select
          value={selectedMatchId}
          onChange={(e) => setSelectedMatchId(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 mt-1 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="">Choose from your appointments</option>
          {loading ? (
            <option disabled>Loading matches…</option>
          ) : appointments.length === 0 ? (
            <option disabled>No matches assigned</option>
          ) : (
            appointments.map((m) => (
              <option key={m.id} value={m.id}>
                {m.homeTeam} vs {m.awayTeam} — {m.date} @ {m.venue || m.location}
              </option>
            ))
          )}
        </select>

        {selectedMatch && (
          <div className="bg-gray-50 border rounded-lg p-3 mt-2 text-sm text-gray-700">
            <p><strong>Venue:</strong> {selectedMatch.venue || selectedMatch.venueName || selectedMatch.location}</p>
            <p><strong>Date:</strong> {selectedMatch.date}</p>
            <p><strong>Time:</strong> {selectedMatch.time}</p>
          </div>
        )}
      </div>

      {/* Report‑type toggle (Card ↔ General) */}
      <div className="mb-6">
        <label className="font-medium text-sm text-gray-700">Report Type</label>
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => setReportType("card")}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              reportType === "card"
                ? "bg-emerald-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Card Report
          </button>
          <button
            type="button"
            onClick={() => setReportType("general")}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              reportType === "general"
                ? "bg-emerald-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            General Report
          </button>
        </div>
      </div>

      {/* Dynamic form */}
      {renderReportForm()}

      {/* Footer */}
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/* General / Incident Report (kept inline – no external file)        */
/* ------------------------------------------------------------------ */
const GeneralIncidentForm = ({
  match,
  user,
  onClose,
}: {
  match: any;
  user: any;
  onClose?: () => void;
}) => {
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!match?.id) {
      toast({ title: "Error", description: "Match not found.", variant: "destructive" });
      return;
    }
    if (!details.trim()) {
      toast({ title: "Required", description: "Please enter report details.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        type: "general_report" as const,
        matchId: match.id,
        refereeId: user.uid,
        refereeEmail: user.email || "",
        refereeName: user.displayName || "Unknown Referee",
        status: "submitted" as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        details: details.trim(),
      };

      await addDoc(collection(db, "reports"), payload);
      toast({ title: "Success", description: "General report submitted." });
      setDetails("");
      onClose?.();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Failed",
        description: err.message.includes("permission")
          ? "Check login and report data."
          : err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white border p-5 rounded-lg">
      <textarea
        placeholder="Describe the incident, observations, or general feedback..."
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        className="w-full border rounded-lg px-4 py-2 h-32 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        required
      />
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Submitting…" : "Submit General Report"}
      </Button>
    </form>
  );
};