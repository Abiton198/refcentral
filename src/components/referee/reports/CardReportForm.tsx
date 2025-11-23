// CardReportForm.tsx - Corrected (Version 3)
import React, { useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { toast } from "@/components/ui/use-toast";

/* -----------------------------------------------------------
   REAL WORLD RUGBY LAW — DATA
   ----------------------------------------------------------- */
const RED_LAWS = [
  { number: "Law 9.12", title: "Striking / Punching", explanation: "Punching, striking or attempting to strike an opponent. Serious violent conduct." },
  { number: "Law 9.13", title: "Dangerous High Tackle (Head/Neck Contact)", explanation: "High tackle with direct contact to the head or neck with high danger." },
  { number: "Law 9.14", title: "Dangerous Lifting / Spear Tackle", explanation: "Player lifted and dropped or forced downward onto head/neck—automatic red card." },
  { number: "Law 9.17", title: "Tackling a Player in the Air", explanation: "Dangerous contact with airborne player resulting in high risk of injury." },
  { number: "Law 9.16", title: "Kicking an Opponent", explanation: "Deliberately kicking an opponent; especially dangerous to head." },
  { number: "Law 9.18", title: "Stamping / Trampling", explanation: "Stamping or trampling on a player lying on the ground." },
  { number: "Law 9.20", title: "Eye Gouging / Contact with Eyes", explanation: "Any contact with the eyes or eye area—major serious misconduct." },
  { number: "Law 9.19", title: "Biting", explanation: "Biting an opponent—severe misconduct." },
  { number: "Law 9.21", title: "Physical Assault on Match Official", explanation: "Any physical contact with intent or aggression towards an official." },
];

const YELLOW_LAWS = [
  { number: "Law 10.1", title: "Repeated Infringements", explanation: "Multiple repeated infringements by same player or team." },
  { number: "Law 10.2", title: "Dissent / Verbal Abuse", explanation: "Disrespectful language or gestures directed at the referee." },
  { number: "Law 10.3", title: "Deliberate Infringement", explanation: "Stopping play illegally or preventing tactical advantage." },
  { number: "Law 10.4", title: "Dangerous Play (Not Red Threshold)", explanation: "Dangerous or reckless actions that fall below red card severity." },
  { number: "Law 10.5", title: "Illegal Entry / Hands in Ruck", explanation: "Entering a ruck illegally or using hands while not permitted." },
  { number: "Law 10.6", title: "Offside Interference", explanation: "Interfering with play while offside." },
];

/* -----------------------------------------------------------
   Helper: standardise stored type
   ----------------------------------------------------------- */
const getStoredType = (type: string) => {
  if (type === "Red") return "red_card";
  if (type === "Yellow") return "yellow_card";
  return "incident"; // important: matches Firestore rules
};

/* -----------------------------------------------------------
   Component Props
   ----------------------------------------------------------- */
interface MatchProps {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string; // expected 'YYYY-MM-DD' or other ISO date-string
  venue?: string;
  time?: string; // expected 'HH:mm' or 'HH:mm:ss' ideally
}

interface CardReportFormProps {
  match: MatchProps;
  onSuccess?: () => void;
}

/* -----------------------------------------------------------
   MAIN EXPORT — CARD REPORT FORM
   ----------------------------------------------------------- */
const CardReportForm: React.FC<CardReportFormProps> = ({ match, onSuccess }) => {
  const auth = getAuth();
  const user = auth.currentUser;

  const [cardType, setCardType] = useState<"Yellow" | "Red" | "Incident">("Yellow");

  const [form, setForm] = useState({
    playerName: "",
    team: "Home",
    minute: "",
    lawNumber: "",
    description: "",
    signature: "",
  });

  const [saving, setSaving] = useState(false);

  const lawList = cardType === "Red" ? RED_LAWS : cardType === "Yellow" ? YELLOW_LAWS : [];

  const selectedLaw = form.lawNumber && lawList.find((l) => l.number === form.lawNumber);

  /* -----------------------------------------------------------
     Validate Form
     ----------------------------------------------------------- */
  const validate = () => {
    if (!form.playerName.trim()) {
      toast({ title: "Missing", description: "Player name is required.", variant: "destructive" });
      return false;
    }

    if (!form.signature.trim()) {
      toast({ title: "Missing", description: "Signature is required.", variant: "destructive" });
      return false;
    }

    if ((cardType === "Red" || cardType === "Yellow") && !form.lawNumber) {
      toast({ title: "Missing", description: "Select a law for this card.", variant: "destructive" });
      return false;
    }

    return true;
  };

  /* -----------------------------------------------------------
     Submit
     ----------------------------------------------------------- */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (saving) return; // Prevent double submit

    if (!user) {
      toast({ title: "Error", description: "You must be signed in.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);

      // Build matchDateTime as Firestore Timestamp (if both date and time present)
      const matchDateTime = match.date && match.time
        ? Timestamp.fromDate(new Date(`${match.date}T${match.time}`))
        : null;

      // Build payload
      const payload: any = {
        // Must match your Firestore rules
        type: "card_report",
        cardType: getStoredType(cardType),

        matchId: String(match.id),
        homeTeam: match.homeTeam ?? "",
        awayTeam: match.awayTeam ?? "",
        matchDate: match.date ?? "",
        venue: match.venue ?? "",
        matchTime: match.time ?? "",
        matchDateTime: matchDateTime, // Firestore Timestamp or null

        refereeId: user.uid,
        refereeName: user.displayName ?? "",
        refereeEmail: user.email ?? "",

        playerName: form.playerName,
        playerTeam: form.team,
        minute: form.minute,
        description: form.description || "No description provided",
        reporterSignature: form.signature,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Add optional law fields only when present
      if (selectedLaw) {
        payload.lawNumber = selectedLaw.number;
        payload.lawTitle = selectedLaw.title;
        payload.lawExplanation = selectedLaw.explanation;
      }

      // Submit once
      await addDoc(collection(db, "reports"), payload);

      toast({ title: "Success", description: `${cardType} report submitted successfully.` });

      // Reset form
      setForm({
        playerName: "",
        team: "Home",
        minute: "",
        lawNumber: "",
        description: "",
        signature: "",
      });

      onSuccess?.();
    } catch (err: any) {
      console.error("CardReportForm submit error:", err);
      toast({
        title: "Error",
        description: err?.message || "Could not submit report.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  /* -----------------------------------------------------------
     Render
     ----------------------------------------------------------- */
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Card Report</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* CARD TYPE SELECTOR */}
          <div>
            <Label>Report Type</Label>
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant={cardType === "Yellow" ? "default" : "outline"}
                className={cardType === "Yellow" ? "bg-yellow-400 hover:bg-yellow-500" : ""}
                onClick={() => { setCardType("Yellow"); setForm({ ...form, lawNumber: "" }); }}
              >
                Yellow Card
              </Button>

              <Button
                type="button"
                variant={cardType === "Red" ? "default" : "outline"}
                className={cardType === "Red" ? "bg-red-600 text-white hover:bg-red-700" : ""}
                onClick={() => { setCardType("Red"); setForm({ ...form, lawNumber: "" }); }}
              >
                Red Card
              </Button>

              <Button
                type="button"
                variant={cardType === "Incident" ? "default" : "outline"}
                className={cardType === "Incident" ? "bg-gray-600 text-white hover:bg-gray-700" : ""}
                onClick={() => { setCardType("Incident"); setForm({ ...form, lawNumber: "" }); }}
              >
                Incident
              </Button>
            </div>
          </div>

          {/* PLAYER NAME */}
          <div>
            <Label>Player Name</Label>
            <Input
              value={form.playerName}
              onChange={(e) => setForm({ ...form, playerName: e.target.value })}
              placeholder="Full name of player"
            />
          </div>

          {/* TEAM */}
          <div>
            <Label>Team</Label>
            <Select
              value={form.team}
              onValueChange={(v) => setForm({ ...form, team: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Home">{match.homeTeam}</SelectItem>
                <SelectItem value="Away">{match.awayTeam}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* MINUTE */}
          <div>
            <Label>Minute of incident</Label>
            <Input
              value={form.minute}
              onChange={(e) => setForm({ ...form, minute: e.target.value })}
              placeholder="e.g., 55'"
            />
          </div>

          {/* LAW SELECTION */}
          {(cardType === "Red" || cardType === "Yellow") && (
            <div>
              <Label>{cardType} Card Offence</Label>
              <Select
                value={form.lawNumber}
                onValueChange={(v) => setForm({ ...form, lawNumber: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Law" />
                </SelectTrigger>
                <SelectContent>
                  {lawList.map((law) => (
                    <SelectItem key={law.number} value={law.number}>
                      {law.number} — {law.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedLaw && (
                <div className="p-3 mt-2 bg-gray-50 border-l-2 text-sm">
                  <strong>{selectedLaw.number} — {selectedLaw.title}</strong>
                  <p className="text-xs mt-1">{selectedLaw.explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* DESCRIPTION */}
          <div>
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe what happened"
            />
          </div>

          {/* SIGNATURE */}
          <div>
            <Label>Signature</Label>
            <Input
              value={form.signature}
              onChange={(e) => setForm({ ...form, signature: e.target.value })}
              placeholder="Type your full name"
            />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Submitting..." : `Submit ${cardType} Report`}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
};

export default CardReportForm;
