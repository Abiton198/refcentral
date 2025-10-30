import React, { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { db } from "../../lib/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { toast } from "@/components/ui/use-toast";

export const TeamRegistrationForm: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", homeGround: "" });
  const [formData, setFormData] = useState({ name: "", homeGround: "" });

  // 🔹 Fetch registered teams in real time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "teams"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeams(list);
    });
    return () => unsub();
  }, []);

  // 🔹 Add new team
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.homeGround) {
      toast({
        title: "Missing Fields",
        description: "Please enter both team name and home ground.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, "teams"), {
        name: formData.name.trim(),
        homeGround: formData.homeGround.trim(),
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Team Registered",
        description: `${formData.name} added successfully ✅`,
      });
      setFormData({ name: "", homeGround: "" });
    } catch (err) {
      console.error("Error adding team:", err);
      toast({
        title: "Error",
        description: "Failed to register team.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Delete team
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this team?")) return;
    try {
      await deleteDoc(doc(db, "teams", id));
      toast({ title: "Deleted", description: "Team removed 🗑️" });
    } catch (err) {
      console.error("Error deleting team:", err);
      toast({
        title: "Error",
        description: "Failed to delete team.",
        variant: "destructive",
      });
    }
  };

  // 🔹 Toggle edit mode
  const handleEdit = (team: any) => {
    if (editingId === team.id) {
      setEditingId(null);
      setEditData({ name: "", homeGround: "" });
    } else {
      setEditingId(team.id);
      setEditData({ name: team.name, homeGround: team.homeGround });
    }
  };

  // 🔹 Save edited team
  const handleSaveEdit = async (id: string) => {
    if (!editData.name || !editData.homeGround) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all fields before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateDoc(doc(db, "teams", id), {
        name: editData.name.trim(),
        homeGround: editData.homeGround.trim(),
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Updated", description: "Team updated successfully ✅" });
      setEditingId(null);
      setEditData({ name: "", homeGround: "" });
    } catch (err) {
      console.error("Error updating team:", err);
      toast({
        title: "Error",
        description: "Failed to update team.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900">Team Registration</h3>
      </div>

      {/* Registration Form */}
      <form
        onSubmit={handleSubmit}
        className="p-6 border rounded-lg bg-gray-50 space-y-4"
      >
        <input
          type="text"
          placeholder="Team Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full border rounded-lg px-4 py-2"
          required
        />

        <input
          type="text"
          placeholder="Home Ground / Venue"
          value={formData.homeGround}
          onChange={(e) =>
            setFormData({ ...formData, homeGround: e.target.value })
          }
          className="w-full border rounded-lg px-4 py-2"
          required
        />

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Saving..." : "✅ Register Team"}
        </Button>
      </form>

      {/* Registered Teams List */}
      <div>
        <h4 className="text-lg font-semibold mb-2">Registered Teams</h4>
        {teams.length === 0 ? (
          <p className="text-gray-600">No teams registered yet.</p>
        ) : (
          <ul className="space-y-3 text-sm text-gray-700">
            {teams.map((t) => (
              <li
                key={t.id}
                className="border rounded-lg p-3 bg-white shadow-sm flex justify-between items-start"
              >
                <div className="flex-1">
                  {editingId === t.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) =>
                          setEditData({ ...editData, name: e.target.value })
                        }
                        className="w-full border rounded-lg px-3 py-2"
                      />
                      <input
                        type="text"
                        value={editData.homeGround}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            homeGround: e.target.value,
                          })
                        }
                        className="w-full border rounded-lg px-3 py-2"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(t.id)}
                          className="flex-1"
                        >
                          💾 Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-gray-600 text-sm">🏟 {t.homeGround}</p>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(t)}
                  >
                    {editingId === t.id ? "Close" : "✏️ Edit"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(t.id)}
                  >
                    🗑️
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
