import React from "react";
import { Badge } from "@/components/ui/Badge";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/components/ui/use-toast";

interface StatusBadgeProps {
    appointment: any;
    isPast?: boolean;
    hasRefReport?: boolean;
    hasCoachReport?: boolean;
    isReviewed?: boolean;
    onReview?: () => void;
    onCoachReport?: () => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ appointment, isPast }) => {
    const apt = appointment;

    // Unified Logic: Handles 2025 (Legacy) and 2026 (New) structures
    const getStatus = () => {
        // 2. Added optional chaining (?.) and nullish coalescing
        // Check New 2026 Structure
        if (apt?.refereeId && apt.responses?.[apt.refereeId]) {
            return apt.responses[apt.refereeId];
        }

        // 3. Check Legacy 2025 Structure (Safe access)
        const legacyStatus = apt?.responses?.referee?.status;
        if (legacyStatus) return legacyStatus;

        // 4. Final Fallbacks
        return apt?.status || "pending";
    };

    const currentStatus = getStatus();

    const badgeStyles: Record<string, string> = {
        accepted: "bg-emerald-100 text-emerald-700 border-emerald-200",
        rejected: "bg-red-100 text-red-700 border-red-200",
        pending: "bg-amber-100 text-amber-700 border-amber-200"
    };

    const handleStatusChange = async (newStatus: string) => {
        try {
            const updateData: any = {
                status: newStatus,
                updatedAt: new Date().toISOString()
            };

            // Update BOTH structures to ensure forward compatibility
            if (apt.refereeId) {
                updateData[`responses.${apt.refereeId}`] = newStatus;
                updateData[`responses.referee.status`] = newStatus;
            }

            await updateDoc(doc(db, "appointments", apt.id), updateData);
            toast({ title: "Status Updated", description: `Set to ${newStatus}` });
        } catch (err: any) {
            toast({
                title: "Update Failed",
                description: err.message,
                variant: "destructive"
            });
        }
    };

    return (
        <div className="flex flex-col gap-2 sm:items-end">
            <Badge
                className={`px-3 py-1 rounded-full font-black text-[10px] uppercase border w-fit ${badgeStyles[currentStatus] || badgeStyles.pending
                    }`}
            >
                {currentStatus === "accepted" ? "✓ Confirmed" :
                    currentStatus === "rejected" ? "✕ Rejected" : "● Pending"}
            </Badge>

            <select
                className="text-[10px] border rounded px-2 py-1 font-bold bg-white"
                value={currentStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={isPast}
            >
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
            </select>
        </div>
    );
};