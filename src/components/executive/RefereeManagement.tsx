import React, { useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { db } from "../../lib/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";

interface Referee {
  id: string;
  name: string;
  surname?: string;
  email: string;
  contact?: string;
  area?: string;
  yearJoined?: string;
  approved?: boolean;
  status?: "active" | "pending" | "suspended";
  suspensionReason?: string;
}

export const RefereeManagement: React.FC = () => {
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch referees from Firestore in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "referees"), (snapshot) => {
      const refs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Referee[];
      setReferees(refs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ✅ Approve referee
  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, "referees", id), {
        approved: true,
        status: "active",
      });

      // Update main user record as well
      await updateDoc(doc(db, "users", id), {
        approved: true,
      });

      alert("Referee approved successfully!");
    } catch (error) {
      console.error("Error approving referee:", error);
      alert("Failed to approve referee.");
    }
  };

  // ✅ Suspend referee
  const handleSuspend = async (id: string) => {
    const reason = prompt("Enter suspension reason:");
    if (!reason) return;

    try {
      await updateDoc(doc(db, "referees", id), {
        status: "suspended",
        suspensionReason: reason,
      });

      await updateDoc(doc(db, "users", id), {
        approved: false,
      });

      alert(`Referee suspended. Reason: ${reason}`);
    } catch (error) {
      console.error("Error suspending referee:", error);
      alert("Failed to suspend referee.");
    }
  };

  // ✅ Reactivate referee
  const handleActivate = async (id: string) => {
    try {
      await updateDoc(doc(db, "referees", id), {
        status: "active",
        suspensionReason: "",
      });

      await updateDoc(doc(db, "users", id), {
        approved: true,
      });

      alert("Referee reactivated successfully!");
    } catch (error) {
      console.error("Error activating referee:", error);
      alert("Failed to activate referee.");
    }
  };

  if (loading) {
    return (
      <div className="text-center text-gray-500 py-8">
        Loading referees...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-gray-900">Referee Management</h3>

      {referees.length === 0 ? (
        <p className="text-gray-600">No referees found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {referees.map((ref) => (
            <Card key={ref.id}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-bold text-gray-900">
                    {ref.name} {ref.surname}
                  </h4>
                  <p className="text-sm text-gray-600">{ref.email}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {ref.contact ? `📞 ${ref.contact}` : ""}
                  </p>
                  <div className="mt-2">
                    <Badge
                      variant={
                        ref.status === "active"
                          ? "success"
                          : ref.status === "suspended"
                          ? "danger"
                          : "warning"
                      }
                    >
                      {ref.status ? ref.status.toUpperCase() : "PENDING"}
                    </Badge>
                  </div>
                  {ref.suspensionReason && (
                    <p className="text-xs text-red-600 mt-1 italic">
                      Reason: {ref.suspensionReason}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  {!ref.approved && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => handleApprove(ref.id)}
                    >
                      Approve
                    </Button>
                  )}

                  {ref.status === "active" && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleSuspend(ref.id)}
                    >
                      Suspend
                    </Button>
                  )}

                  {ref.status === "suspended" && (
                    <Button size="sm" onClick={() => handleActivate(ref.id)}>
                      Activate
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
