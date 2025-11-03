import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/Button";

interface PrefillData {
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  venue: string;
  referee: string;
  matchId: string;
}

interface CoachingReportUnifiedProps {
  coachName: string;
  coachEmail: string;
  prefill?: PrefillData;
  onSuccess?: () => void;
}

export const CoachingReportUnified: React.FC<CoachingReportUnifiedProps> = ({
  coachName,
  coachEmail,
  prefill,
  onSuccess,
}) => {
  const auth = getAuth();
  const user = auth.currentUser;

  const [reportType, setReportType] = useState<"junior_coaching" | "senior_coaching">(
    "junior_coaching"
  );

  const [formData, setFormData] = useState<any>({
    refereeName: user?.displayName || "",
    refereeEmail: user?.email || "",
    refereeId: user?.uid || "",

    match: "",
    matchDate: "",
    venue: "",
    level: "",
    coachName: coachName || "",

    // GAME STATS
    penalties: "",
    breakdownPens: "",
    lineoutPens: "",
    scrumPens: "",
    spacePens: "",
    foulPlayPens: "",
    generalPlayPens: "",

    // COACHING NOTES
    improvementAreas1: "",
    improvementAreas2: "",
    improvementAreas3: "",
    strengthsNotes: "",

    // HIDDEN
    matchId: "",
  });

  const [extra, setExtra] = useState<any>({}); // role-specific feedback
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Auto-fill from prefill
  useEffect(() => {
    if (prefill) {
      const matchStr = `${prefill.homeTeam} vs ${prefill.awayTeam}`;
      setFormData((prev: any) => ({
        ...prev,
        match: matchStr,
        matchDate: prefill.date,
        venue: prefill.venue,
        coachName: coachName,
        refereeName: prefill.referee || user?.displayName || "",
        matchId: prefill.matchId,
      }));
    }
  }, [prefill, coachName, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((p: any) => ({ ...p, [name]: value }));
  };

  const handleExtraChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setExtra((p: any) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("Please sign in.");
    if (!formData.coachName) return alert("Enter coach name.");

    try {
      setSubmitting(true);

      // Extract teams from match string if not saved separately
      const teams = formData.match.includes(" vs ")
        ? formData.match.split(" vs ")
        : [formData.match, ""];

      const payload = {
        // CORE INFO
        coachName: formData.coachName,
        coachEmail: coachEmail,
        refereeName: formData.refereeName,
        refereeEmail: formData.refereeEmail,
        refereeId: formData.refereeId,
        matchId: formData.matchId,
        reportType,

        // MATCH DETAILS (SAVED SEPARATELY)
        homeTeam: prefill?.homeTeam || teams[0] || "",
        awayTeam: prefill?.awayTeam || teams[1] || "",
        venue: formData.venue,
        matchDate: formData.matchDate,
        matchTime: prefill?.time || "",
        level: formData.level,

        // FULL FEEDBACK (extra)
        ...extra,

        // GAME STATS
        penalties: formData.penalties || 0,
        breakdownPens: formData.breakdownPens || 0,
        lineoutPens: formData.lineoutPens || 0,
        scrumPens: formData.scrumPens || 0,
        spacePens: formData.spacePens || 0,
        foulPlayPens: formData.foulPlayPens || 0,
        generalPlayPens: formData.generalPlayPens || 0,

        // COACHING IMPROVEMENT AREAS
        improvementAreas: [
          formData.improvementAreas1,
          formData.improvementAreas2,
          formData.improvementAreas3,
        ].filter(Boolean),

        // STRENGTHS
        strengthsNotes: formData.strengthsNotes || "",

        // METADATA
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        reviewed: false,
      };

      await addDoc(collection(db, "coachReports"), payload);
      setSubmitted(true);
      onSuccess?.();
    } catch (err: any) {
      console.error("Save error:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted)
    return (
      <div className="p-6 border rounded-lg bg-white text-center mt-8">
        <h2 className="text-2xl font-bold text-emerald-600 mb-2">
          Report Submitted
        </h2>
        <p className="text-gray-700">
          Your {reportType === "junior_coaching" ? "Junior" : "Senior"} coaching
          report has been recorded.
        </p>
      </div>
    );

  return (
    <div className="mt-8 border-t pt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Referee’s Coaching Report
        </h2>
        <select
          value={reportType}
          onChange={(e) =>
            setReportType(e.target.value as "junior_coaching" | "senior_coaching")
          }
          className="border rounded-md px-3 py-2 text-sm bg-white focus:ring-emerald-500"
        >
          <option value="junior_coaching">Junior</option>
          <option value="senior_coaching">Senior</option>
        </select>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white border rounded-lg p-4 shadow-sm"
      >
        {/* BASIC INFO */}
        <div className="grid md:grid-cols-2 gap-4">
          <Input label="Referee" value={formData.refereeName} disabled />
          <Input label="Match" value={formData.match} disabled />
          <Input label="Date" type="date" value={formData.matchDate} disabled />
          <Input label="Venue" value={formData.venue} disabled />
          <Input
            label="Level"
            name="level"
            value={formData.level}
            onChange={handleChange}
          />
        </div>

        {/* MANAGEMENT PERFORMANCE */}
        <Section title="MANAGEMENT PERFORMANCE">
          {reportType === "junior_coaching" ? (
            <>
              <TextArea
                label="Communication (Includes signals)"
                desc="Indicates clear intent to players and manages potential infringements."
                name="commsFeedback"
                value={extra.commsFeedback || ""}
                onChange={handleExtraChange}
              />
              <TextArea
                label="Whistle and Tone"
                desc="Referee uses correct whistle tone and clarity."
                name="whistleFeedback"
                value={extra.whistleFeedback || ""}
                onChange={handleExtraChange}
              />
              <TextArea
                label="Safety – General and Foul play"
                desc="Applies safety laws correctly and proactively."
                name="safetyFeedback"
                value={extra.safetyFeedback || ""}
                onChange={handleExtraChange}
              />
            </>
          ) : (
            <>
              <TextArea
                label="Communication"
                desc="Indicates clear intent to players and manages potential infringers."
                name="commsFeedback"
                value={extra.commsFeedback || ""}
                onChange={handleExtraChange}
              />
              <TextArea
                label="Advantage"
                desc="Creates flow and continuity by allowing territorial or tactical advantage."
                name="advantageFeedback"
                value={extra.advantageFeedback || ""}
                onChange={handleExtraChange}
              />
              <TextArea
                label="Control"
                desc="Manages hotspots and adjusts player behaviour effectively."
                name="controlFeedback"
                value={extra.controlFeedback || ""}
                onChange={handleExtraChange}
              />
            </>
          )}
        </Section>

        {/* TECHNICAL PERFORMANCE */}
        <Section title="TECHNICAL PERFORMANCE">
          {reportType === "junior_coaching" ? (
            <>
              <TextArea
                label="Scrum"
                name="scrumFeedback"
                value={extra.scrumFeedback || ""}
                onChange={handleExtraChange}
              />
              <TextArea
                label="Line-out"
                name="lineoutFeedback"
                value={extra.lineoutFeedback || ""}
                onChange={handleExtraChange}
              />
              <TextArea
                label="Tackle/Ruck/Maul"
                name="breakdownFeedback"
                value={extra.breakdownFeedback || ""}
                onChange={handleExtraChange}
              />
              <TextArea
                label="Offsides and Space"
                name="offsideFeedback"
                value={extra.offsideFeedback || ""}
                onChange={handleExtraChange}
              />
            </>
          ) : (
            <>
              <TextArea
                label="Scrum"
                name="scrumFeedback"
                value={extra.scrumFeedback || ""}
                onChange={handleExtraChange}
              />
              <TextArea
                label="Line-out"
                name="lineoutFeedback"
                value={extra.lineoutFeedback || ""}
                onChange={handleExtraChange}
              />
              <TextArea
                label="Tackle/Ruck/Maul"
                name="breakdownFeedback"
                value={extra.breakdownFeedback || ""}
                onChange={handleExtraChange}
              />
              <TextArea
                label="Kicks & General Play"
                name="kicksFeedback"
                value={extra.kicksFeedback || ""}
                onChange={handleExtraChange}
              />
            </>
          )}
        </Section>

        {/* GAME STATS */}
        <Section title="GAME STATS">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {["Penalties", "Breakdown", "Lineout", "Scrum", "Space", "Foul Play", "G/Play"].map(
              (label) => (
                <Input
                  key={label}
                  label={label}
                  type="number"
                  name={`${label.toLowerCase().replace(/[^a-z]/g, "")}Pens`}
                  value={formData[`${label.toLowerCase().replace(/[^a-z]/g, "")}Pens`] || ""}
                  onChange={handleChange}
                />
              )
            )}
          </div>
        </Section>

        {/* COACHING NOTES */}
        <Section title="COACHING NOTES">
          <label className="text-sm font-medium text-gray-700">
            Areas requiring improvement:
          </label>
          <div className="space-y-2 mt-1">
            {[1, 2, 3].map((i) => (
              <Input
                key={i}
                name={`improvementAreas${i}`}
                placeholder={`${i}.`}
                value={formData[`improvementAreas${i}`]}
                onChange={handleChange}
              />
            ))}
          </div>

          <label className="text-sm font-medium text-gray-700 mt-3 block">
            Strengths to be maintained:
          </label>
          <textarea
            name="strengthsNotes"
            rows={3}
            value={formData.strengthsNotes}
            onChange={handleChange}
            className="border rounded-lg w-full px-3 py-2 text-sm mt-1"
            placeholder="Strong communication, clear whistle, calm demeanor..."
          />
        </Section>

        {/* COACH NAME */}
        <Input
          label="Coach’s Name"
          name="coachName"
          value={formData.coachName}
          onChange={handleChange}
          required
        />

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Report"}
        </Button>
      </form>
    </div>
  );
};

// --- Reusable subcomponents ---
const Input = ({
  label,
  disabled,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; disabled?: boolean }) => (
  <div className="flex flex-col">
    {label && <label className="text-xs font-medium text-gray-700">{label}</label>}
    <input
      {...props}
      disabled={disabled}
      className={`border rounded-lg px-3 py-2 mt-1 text-sm ${
        disabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
      } ${props.className || ""}`}
    />
  </div>
);

const TextArea = ({
  label,
  desc,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; desc?: string }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    {desc && <p className="text-xs text-gray-500">{desc}</p>}
    <textarea
      {...props}
      rows={2}
      className={`border rounded-lg w-full px-3 py-2 text-sm mt-1 ${props.className || ""}`}
    />
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
    {children}
  </div>
);