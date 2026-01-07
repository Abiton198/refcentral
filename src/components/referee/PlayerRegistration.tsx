import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { UserPlus, Users, Edit2, Search, AlertTriangle } from "lucide-react";
import { differenceInYears, parseISO } from "date-fns";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  contact?: string;
  dob?: string;
  position: string;
  teamId: string;
  teamName: string;
  group: string;
}

interface Team {
  id: string;
  name: string;
  group: string;
}

export const PlayerRegistration: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contact, setContact] = useState("");
  const [dob, setDob] = useState("");
  const [position, setPosition] = useState("");
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  // 1. Fetch Teams in Real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "teams"), (snap) => {
      const teamData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
      setTeams(teamData);
    });
    return () => unsub();
  }, []);

  // 2. Fetch Players in Real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "players"), (snap) => {
      const playerData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      setPlayers(playerData);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const groups = useMemo(() => Array.from(new Set(teams.map(t => t.group))), [teams]);
  const filteredTeams = useMemo(() => teams.filter(t => t.group === selectedGroup), [selectedGroup, teams]);

  const calculateAge = (dateString: string) => {
    if (!dateString) return "";
    const age = differenceInYears(new Date(), parseISO(dateString));
    return `(${age} yrs)`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const teamName = teams.find(t => t.id === selectedTeamId)?.name || "";

    // Check for Duplicates (Only if not editing)
    if (!editingPlayerId) {
      const exists = players.find(p => 
        p.firstName.toLowerCase() === firstName.toLowerCase() && 
        p.lastName.toLowerCase() === lastName.toLowerCase()
      );

      if (exists) {
        toast({
          title: "Registration Denied",
          description: `Player ${firstName} ${lastName} is already registered with ${exists.teamName}.`,
          variant: "destructive"
        });
        return;
      }
    }

    const playerData = {
      firstName,
      lastName,
      contact,
      dob,
      position,
      teamId: selectedTeamId,
      teamName,
      group: selectedGroup,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingPlayerId) {
        await updateDoc(doc(db, "players", editingPlayerId), playerData);
        toast({ title: "Updated", description: "Player info updated successfully." });
      } else {
        await addDoc(collection(db, "players"), { ...playerData, createdAt: serverTimestamp() });
        toast({ title: "Registered", description: `${firstName} added to ${teamName}.` });
      }
      resetForm();
    } catch (err) {
      toast({ title: "Error", description: "Save failed.", variant: "destructive" });
    }
  };

  const handleEdit = (player: Player) => {
    setEditingPlayerId(player.id);
    setSelectedGroup(player.group);
    setSelectedTeamId(player.teamId);
    setFirstName(player.firstName);
    setLastName(player.lastName);
    setContact(player.contact || "");
    setDob(player.dob || "");
    setPosition(player.position);
  };

  const resetForm = () => {
    setEditingPlayerId(null);
    setFirstName("");
    setLastName("");
    setContact("");
    setDob("");
    setPosition("");
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <UserPlus className="text-emerald-600" /> 
          {editingPlayerId ? "Edit Player" : "Register New Player"}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>League/Group</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger><SelectValue placeholder="Select Group" /></SelectTrigger>
              <SelectContent>
                {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Team</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId} disabled={!selectedGroup}>
              <SelectTrigger><SelectValue placeholder="Select Team" /></SelectTrigger>
              <SelectContent>
                {filteredTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Input placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required />
          <Input placeholder="Surname" value={lastName} onChange={e => setLastName(e.target.value)} required />
          <Input placeholder="Contact Number (Optional)" value={contact} onChange={e => setContact(e.target.value)} />
          
          <div className="flex gap-2 items-center">
            <Input type="date" value={dob} onChange={e => setDob(e.target.value)} className="flex-1" />
            <span className="text-sm font-medium text-blue-600">{calculateAge(dob)}</span>
          </div>

          <Input placeholder="Position (e.g. 10 or GK)" value={position} onChange={e => setPosition(e.target.value)} required />

          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {editingPlayerId ? "Update Player" : "Register Player"}
            </Button>
            {editingPlayerId && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users className="text-blue-600" /> Registered Players
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Team</th>
                <th className="px-4 py-2">Pos</th>
                <th className="px-4 py-2">Age</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {players.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{p.firstName} {p.lastName}</td>
                  <td className="px-4 py-2 text-xs">
                    <span className="block font-bold">{p.teamName}</span>
                    <span className="text-gray-400">{p.group}</span>
                  </td>
                  <td className="px-4 py-2">({p.position})</td>
                  <td className="px-4 py-2">{calculateAge(p.dob || "")}</td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};