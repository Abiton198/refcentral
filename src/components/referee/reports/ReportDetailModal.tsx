// src/components/referee/reports/ReportDetailModal.tsx
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { toast } from "@/components/ui/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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

interface ReportDetailModalProps {
  reportId: string;
  onClose: () => void;
  onSave: () => void;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({ reportId, onClose, onSave }) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const auth = getAuth();
  const currentUser = auth.currentUser;

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const docRef = doc(db, "reports", reportId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          toast({ title: "Error", description: "Report not found.", variant: "destructive" });
          onClose();
          return;
        }
        const data = snap.data();
        setReport(data);
        setFormData(data);
      } catch (err) {
        toast({ title: "Error", description: "Failed to load report.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [reportId, onClose]);

  const handleSave = async () => {
    if (!currentUser || report.reviewed) return;

    try {
      const payload: any = {
        ...formData,
        updatedAt: serverTimestamp(),
        // Preserve audit trail
        auditTrail: report.auditTrail || [],
      };

      await updateDoc(doc(db, "reports", reportId), payload);
      setReport(payload);
      setEditing(false);
      onSave();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Save failed.", variant: "destructive" });
    }
  };

  if (loading) return <p className="text-center">Loading report...</p>;
  if (!report) return null;

  const isReviewed = report.reviewed;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start">
        <h3 className="text-2xl font-bold text-emerald-700">
          {report.type.replace("_", " ").toUpperCase()}
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Match Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Match Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><strong>Match:</strong> {report.homeTeam} vs {report.awayTeam}</p>
          <p><strong>Date:</strong> {report.matchDate}</p>
          <p><strong>Venue:</strong> {report.venue || "—"}</p>
          <p><strong>Time:</strong> {report.matchTime || "—"}</p>
        </CardContent>
      </Card>

      {/* Card Report */}
      {report.type === "card_report" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Card Report
              <Badge variant={report.cardType === "Red" ? "danger" : "warning"}>
                {report.cardType} Card
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Player Name</Label>
              {editing ? (
                <Input
                  value={formData.playerFullName || ""}
                  onChange={(e) => setFormData({ ...formData, playerFullName: e.target.value })}
                />
              ) : (
                <p className="mt-1">{report.playerFullName}</p>
              )}
            </div>

            <div>
              <Label>Player Team</Label>
              {editing ? (
                <Select
                  value={formData.playerTeam}
                  onValueChange={(v) => setFormData({ ...formData, playerTeam: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Home">{report.homeTeam}</SelectItem>
                    <SelectItem value="Away">{report.awayTeam}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1">{report.playerTeam === "Home" ? report.homeTeam : report.awayTeam}</p>
              )}
            </div>

            <div>
              <Label>Minute</Label>
              {editing ? (
                <Input
                  value={formData.minute || ""}
                  onChange={(e) => setFormData({ ...formData, minute: e.target.value })}
                  placeholder="e.g. 65'"
                />
              ) : (
                <p className="mt-1">{report.minute || "—"}</p>
              )}
            </div>

            {report.cardType === "Red" && (
              <div>
                <Label>Law Infringed</Label>
                {editing ? (
                  <Select
                    value={formData.lawBroken}
                    onValueChange={(v) => setFormData({ ...formData, lawBroken: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select law" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {RED_CARD_LAWS.map((law) => (
                        <SelectItem key={law} value={law}>{law}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="mt-1 font-medium">{report.lawBroken}</p>
                )}
              </div>
            )}

            <div>
              <Label>Reason</Label>
              {editing ? (
                <Textarea
                  value={formData.reason || ""}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                />
              ) : (
                <p className="mt-1 whitespace-pre-line">{report.reason || "No reason provided"}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* General / Coaching Report */}
      {(report.type === "general_report" || report.type === "coaching_report") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {report.type === "coaching_report" ? "Coaching Report" : "Incident Report"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <Textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                placeholder="Enter details..."
              />
            ) : (
              <p className="whitespace-pre-line">{report.description || "No details provided"}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit Trail */}
      {report.auditTrail?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Audit Trail</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs space-y-1">
              {report.auditTrail
                .sort((a: any, b: any) => new Date(a.timestamp) - new Date(b.timestamp))
                .map((log: any, i: number) => (
                  <li key={i}>
                    <span className="font-medium">{log.by}</span> — {log.action}: {log.details}{" "}
                    <span className="text-gray-400">
                      ({new Date(log.timestamp).toLocaleString()})
                    </span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6">
        {isReviewed ? (
          <Badge variant="success">Reviewed by Executive</Badge>
        ) : editing ? (
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
              Save Changes
            </Button>
          </>
        ) : (
          <Button
            onClick={() => setEditing(true)}
            disabled={isReviewed}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Edit Report
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
};