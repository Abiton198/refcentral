import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/use-toast";

interface CardReportFormProps {
  match?: any; // Optional: pass match data from parent if available
  onSuccess?: () => void;
}

export const CardReportForm: React.FC<CardReportFormProps> = ({ match, onSuccess }) => {
  const auth = getAuth();
  const user = auth.currentUser;

  const [formData, setFormData] = useState({
    reporterRole: "Referee",
    reporterName: user?.displayName || "",
    reporterEmail: user?.email || "",
    reporterContact: "",
    reporterSignature: "",

    competition: match?.gameType || "",
    homeTeam: match?.homeTeam || "",
    visitingTeam: match?.awayTeam || "",
    playerFullName: "",
    playerTeam: "",
    playerPosition: "",
    playerNumber: "",
    venue: match?.venue || match?.venueName || match?.location || "",
    matchDate: match?.date || "",
    cardType: "Yellow" as "Yellow" | "Red",
    periodOfGame: "",
    elapsedTime: "",
    cautionIndividual: "NO",
    cautionGeneral: "NO",

    lawInfringements: [] as string[],
    offenceDescription: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const toggleLaw = (law: string) => {
    setFormData((p) => {
      const exists = p.lawInfringements.includes(law);
      return {
        ...p,
        lawInfringements: exists
          ? p.lawInfringements.filter((l) => l !== law)
          : [...p.lawInfringements, law],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Required fields
    if (!formData.matchDate || !formData.playerFullName || !formData.homeTeam) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in match date, home team, and player name.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.reporterSignature.trim()) {
      toast({
        title: "Signature Required",
        description: "Please type your full name as signature.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        ...formData,
        reporterId: user?.uid || "",           // ← REQUIRED FOR SECURITY RULES
        refereeId: user?.uid || "",            // ← Match your rules
        refereeEmail: user?.email || "",       // ← Recommended
        matchId: match?.id || null,            // ← Link to appointment
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        reviewed: false,
        status: "submitted",
        type: "card_report",
      };

      await addDoc(collection(db, "reports"), payload);

      setSubmitted(true);
      toast({
        title: "Card Report Submitted",
        description: `${formData.cardType} card report recorded successfully.`,
      });

      onSuccess?.();
    } catch (err: any) {
      console.error("Error submitting card report:", err);
      toast({
        title: "Submission Failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 border rounded-lg bg-white text-center mt-8">
        <h2 className="text-2xl font-bold text-emerald-600 mb-2">
          Report Submitted
        </h2>
        <p className="text-gray-700">
          Your {formData.cardType} card report has been recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t pt-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        REFEREE / ASSISTANT REFEREE / TMO REPORT ON TEMPORARY SUSPENSION OR SEND-OFF
      </h2>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white border rounded-lg p-4 shadow-sm"
      >
        {/* Card Type */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Card Type:</label>
          <select
            name="cardType"
            value={formData.cardType}
            onChange={handleChange}
            className={`border rounded-md px-3 py-2 text-sm font-medium ${
              formData.cardType === "Red"
                ? "border-red-500 text-red-600 bg-red-50"
                : "border-yellow-400 text-yellow-700 bg-yellow-50"
            }`}
          >
            <option value="Yellow">Yellow Card (Temporary Suspension)</option>
            <option value="Red">Red Card (Send Off)</option>
          </select>
        </div>

        {/* Competition Info */}
        <Section title="Competition Details">
          <Input
            label="EPRU Competition"
            name="competition"
            value={formData.competition}
            onChange={handleChange}
            placeholder="e.g. U20 League"
          />
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Home Team"
              name="homeTeam"
              value={formData.homeTeam}
              onChange={handleChange}
              required
            />
            <Input
              label="Visiting Team"
              name="visitingTeam"
              value={formData.visitingTeam}
              onChange={handleChange}
            />
          </div>
        </Section>

        {/* Player Info */}
        <Section title="Player Details">
          <Input
            label="Player’s Full Name"
            name="playerFullName"
            value={formData.playerFullName}
            onChange={handleChange}
            required
          />
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Team"
              name="playerTeam"
              value={formData.playerTeam}
              onChange={handleChange}
              placeholder="Home or Visiting"
            />
            <Input
              label="Playing Position"
              name="playerPosition"
              value={formData.playerPosition}
              onChange={handleChange}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Playing Number"
              name="playerNumber"
              value={formData.playerNumber}
              onChange={handleChange}
            />
            <Input
              label="Venue"
              name="venue"
              value={formData.venue}
              onChange={handleChange}
            />
          </div>
          <Input
            label="Date of Match"
            type="date"
            name="matchDate"
            value={formData.matchDate}
            onChange={handleChange}
            required
          />
        </Section>

        {/* Law 9 Infringements */}
        <Section title="Law 9 Infringements (Select Applicable)">
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {[
              "1", "2", "3", "4", "5", "6", "7a", "7b", "7c", "8", "9", "10", "11", "12", "13",
              "14", "15", "16", "17", "18", "19a", "19b", "19c", "19d", "20a", "20b", "20c",
              "21", "22", "23", "24", "25", "26", "27"
            ].map((num) => (
              <button
                type="button"
                key={num}
                onClick={() => toggleLaw(num)}
                className={`border rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  formData.lawInfringements.includes(num)
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </Section>

        {/* Game Context */}
        <Section title="Match Context">
          <Input
            label="Period of Game"
            name="periodOfGame"
            value={formData.periodOfGame}
            onChange={handleChange}
            placeholder="e.g. First Half, Second Half, Extra Time"
          />
          <Input
            label="Elapsed Time"
            name="elapsedTime"
            value={formData.elapsedTime}
            onChange={handleChange}
            placeholder="e.g. 23' or 67:45"
          />
        </Section>

        {/* Cautions */}
        <Section title="Cautions Issued">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Individual Caution?</label>
            <select
              name="cautionIndividual"
              value={formData.cautionIndividual}
              onChange={handleChange}
              className="border rounded-md px-3 py-1 text-sm"
            >
              <option>YES</option>
              <option>NO</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">General Caution?</label>
            <select
              name="cautionGeneral"
              value={formData.cautionGeneral}
              onChange={handleChange}
              className="border rounded-md px-3 py-1 text-sm"
            >
              <option>YES</option>
              <option>NO</option>
            </select>
          </div>
        </Section>

        {/* Reporting Official */}
        <Section title="Reporting Official">
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Role"
              name="reporterRole"
              value={formData.reporterRole}
              onChange={handleChange}
            />
            <Input
              label="Name"
              name="reporterName"
              value={formData.reporterName}
              onChange={handleChange}
              readOnly
            />
            <Input
              label="Contact Number"
              name="reporterContact"
              value={formData.reporterContact}
              onChange={handleChange}
            />
            <Input
              label="Email"
              name="reporterEmail"
              value={formData.reporterEmail}
              onChange={handleChange}
              readOnly
            />
          </div>
          <Input
            label="Signature (Type Full Name)"
            name="reporterSignature"
            value={formData.reporterSignature}
            onChange={handleChange}
            placeholder="Type your full name to sign"
            required
          />
        </Section>

        {/* Offence Description */}
        <Section title="DESCRIPTION OF OFFENCE">
          <textarea
            name="offenceDescription"
            rows={6}
            value={formData.offenceDescription}
            onChange={handleChange}
            className="border rounded-lg w-full px-3 py-2 text-sm placeholder-gray-400"
            placeholder="Provide a clear, factual description of the incident, player actions, and outcome..."
            required
          />
        </Section>

        {/* Submit Button */}
        <Button
          type="submit"
          className={`w-full text-white font-medium py-3 rounded-lg transition-colors ${
            formData.cardType === "Red"
              ? "bg-red-600 hover:bg-red-700"
              : "bg-yellow-500 hover:bg-yellow-600"
          }`}
          disabled={submitting}
        >
          {submitting
            ? "Submitting Report..."
            : `Submit ${formData.cardType} Card Report`}
        </Button>
      </form>
    </div>
  );
};

// Reusable Input Component
const Input = ({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div className="flex flex-col">
    <label className="text-xs font-medium text-gray-700 mb-1">{label}</label>
    <input
      {...props}
      className={`border rounded-lg px-3 py-2 text-sm transition-colors focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
        props.readOnly ? "bg-gray-50" : "bg-white"
      } ${props.className || ""}`}
    />
  </div>
);

// Reusable Section Component
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
    <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
    <div className="space-y-3">{children}</div>
  </div>
);