// src/components/referee/reports/CardReportForm.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// === MOST COMMON RED CARD OFFENCES (FIFA Laws) ===
const RED_CARD_LAWS = [
  "Serious foul play",
  "Violent conduct",
  "Spitting at an opponent or any other person",
  "Denying an obvious goal-scoring opportunity (DOGSO) – handball",
  "Denying an obvious goal-scoring opportunity (DOGSO) – foul",
  "Using offensive, insulting or abusive language and/or gestures",
  "Receiving a second caution in the same match",
  "Deliberate handball to prevent a goal",
  "Biting or spitting at someone",
  "Throwing an object at the ball, opponent or match official",
  "Entering the field without permission (violent conduct)",
  "Leaving the field without permission (violent conduct)",
  "Physical assault on a match official",
  "Threatening a match official",
  "Racial abuse or discrimination",
  "Excessive celebration (removing shirt, covering head)",
  "Entering the video operation room (VOR)",
];

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  venue?: string;
  time?: string;
}

interface CardReportFormProps {
  match: Match;
  user: any;
  onSuccess?: () => void;
}

export const CardReportForm: React.FC<CardReportFormProps> = ({ match, user, onSuccess }) => {
  const [formData, setFormData] = useState({
    playerFullName: "",
    playerTeam: "Home",
    minute: "",
    cardType: "Yellow" as "Yellow" | "Red",
    lawBroken: "",
    reason: "",
    reporterSignature: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.playerFullName.trim()) {
      toast({ title: "Required", description: "Player name is required.", variant: "destructive" });
      return;
    }
    if (!formData.reporterSignature.trim()) {
      toast({ title: "Required", description: "Signature is required.", variant: "destructive" });
      return;
    }
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    // Law Broken is required only for Red Cards
    if (formData.cardType === "Red" && !formData.lawBroken) {
      toast({ title: "Required", description: "Please select the Law Infringed for Red Card.", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);

      const payload: any = {
        // Core
        type: "card_report",
        matchId: match.id,
        status: "submitted",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        // Ownership
        refereeId: currentUser.uid,
        refereeEmail: currentUser.email || "",
        refereeName: currentUser.displayName || "Unknown Referee",

        // Match Details (auto-filled)
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        matchDate: match.date,
        venue: match.venue || "",
        matchTime: match.time || "",

        // Form Fields
        playerFullName: formData.playerFullName.trim(),
        playerTeam: formData.playerTeam,
        cardType: formData.cardType,
        minute: formData.minute.trim(),
        lawBroken: formData.cardType === "Red" ? formData.lawBroken : "N/A",
        reason: formData.reason.trim() || "No reason provided",
        reporterSignature: formData.reporterSignature.trim(),

        // Dashboard Compatibility
        timeOfIncident: formData.minute.trim() || "",
        description: formData.reason.trim() || "No reason provided",

        reviewed: false,
        executiveComment: "",
      };

      console.log("Submitting card report:", payload);

      await addDoc(collection(db, "reports"), payload);

      toast({ title: "Success", description: `${formData.cardType} card report submitted.` });
      onSuccess?.();
    } catch (err: any) {
      console.error("Submit error:", err);
      toast({
        title: "Failed",
        description: err.message.includes("permission")
          ? "Check refereeId matches your UID."
          : err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Card Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Match Info (Auto-Filled) */}
          <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-1">
            <p><strong>Match:</strong> {match.homeTeam} vs {match.awayTeam}</p>
            <p><strong>Date:</strong> {match.date}</p>
            <p><strong>Venue:</strong> {match.venue || "—"}</p>
            <p><strong>Time:</strong> {match.time || "—"}</p>
            <p><strong>Referee:</strong> {currentUser?.displayName || "Loading..."}</p>
          </div>

          {/* Card Type Dropdown */}
          <div>
            <Label>Card Type *</Label>
            <Select
              value={formData.cardType}
              onValueChange={(value: "Yellow" | "Red") => setFormData({ ...formData, cardType: value, lawBroken: "" })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select card type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yellow">Yellow Card</SelectItem>
                <SelectItem value="Red">Red Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Player Name */}
          <div>
            <Label>Player Full Name *</Label>
            <Input
              value={formData.playerFullName}
              onChange={(e) => setFormData({ ...formData, playerFullName: e.target.value })}
              placeholder="e.g. Xolani Haridi"
              required
            />
          </div>

          {/* Player Team Dropdown */}
          <div>
            <Label>Player Team *</Label>
            <Select
              value={formData.playerTeam}
              onValueChange={(value: "Home" | "Away") => setFormData({ ...formData, playerTeam: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Home">Home – {match.homeTeam}</SelectItem>
                <SelectItem value="Away">Away – {match.awayTeam}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Minute */}
          <div>
            <Label>Minute of Incident</Label>
            <Input
              type="text"
              value={formData.minute}
              onChange={(e) => setFormData({ ...formData, minute: e.target.value })}
              placeholder="e.g. 65'"
            />
          </div>

          {/* Law Infringed – Only for Red Card */}
          {formData.cardType === "Red" && (
            <div>
              <Label>Law Infringed *</Label>
              <Select
                value={formData.lawBroken}
                onValueChange={(value) => setFormData({ ...formData, lawBroken: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select the law broken" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {RED_CARD_LAWS.map((law) => (
                    <SelectItem key={law} value={law}>
                      {law}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reason */}
          <div>
            <Label>Reason for Card</Label>
            <Textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Brief description of the offence..."
              rows={3}
            />
          </div>

          {/* Signature */}
          <div>
            <Label>Reporter Signature *</Label>
            <Input
              value={formData.reporterSignature}
              onChange={(e) => setFormData({ ...formData, reporterSignature: e.target.value })}
              placeholder="Type your full name"
              required
            />
            <p className="text-xs text-gray-500 mt-1">By signing, you confirm this report is accurate.</p>
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Submitting..." : `Submit ${formData.cardType} Card Report`}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
};