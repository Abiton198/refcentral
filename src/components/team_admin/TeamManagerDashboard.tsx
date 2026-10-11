import React, { useEffect, useMemo, useState } from "react";
import { Avatar } from "../ui/avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, StatCard } from "../ui/Card";
import { auth, db } from "../../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import {
  Calendar,
  Edit2,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

/**
 * TeamManagerDashboard
 *
 * ROLE MODEL
 * ----------
 * A Team Manager is NOT a global administrator.
 *
 * Their access comes from:
 *
 * users/{uid}
 *      role: "team_manager"
 *
 * team_memberships/{membershipId}
 *      userId: uid
 *      teamId: teamId
 *      role: "team_manager"
 *      status: "active"
 *
 * The dashboard therefore NEVER assumes that the user owns a team and
 * NEVER trusts a teamId supplied by the browser as proof of permission.
 *
 * The membership collection is the source of team-scoped access.
 *
 * RESPONSIBILITIES
 * ----------------
 * Team Manager can:
 *   - View teams they manage
 *   - View/register/update their team's players
 *   - Manage player jersey/position/status
 *   - View fixtures involving their team
 *   - Prepare the team for the later teamsheet workflow
 *
 * Executive responsibilities remain outside this dashboard:
 *   - Create teams
 *   - Create fixtures
 *   - Create team memberships
 *   - Assign referees
 *
 * Coaches have a separate dashboard and can use the same team membership
 * relationship with role = "coach".
 */

type Tab = "overview" | "players" | "fixtures" | "profile";

interface Team {
  id: string;
  name: string;
  homeGround?: string;
  league?: string;
  status?: string;
}

interface Membership {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  status: string;
}

interface Player {
  id: string;
  teamId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  position?: string;
  jerseyNumber?: number;
  photoUrl?: string;
  status?: string;
  registrationStatus?: string;
}

interface Appointment {
  id: string;
  homeTeamId: string;
  homeTeam: string;
  awayTeamId: string;
  awayTeam: string;
  matchTitle?: string;
  matchDate: string;
  matchTime: string;
  venue: string;
  competition?: string;
  season?: string;
  teamLevel?: string;
  refereeName?: string;
  officialRole?: string;
  status?: string;
}

interface UserProfile {
  displayName?: string;
  email?: string;
  role?: string;
  approvalStatus?: string;
  status?: string;
  photoURL?: string;
}

const emptyPlayer = {
  firstName: "",
  middleName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  position: "",
  jerseyNumber: "",
};

export const TeamManagerDashboard: React.FC = () => {
  const user = auth.currentUser;

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerForm, setPlayerForm] = useState<any>(emptyPlayer);
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const uid = user?.uid || "";
  const displayName =
    profile?.displayName || user?.displayName || "Team Manager";
  const email = profile?.email || user?.email || "";
  const photoURL =
    profile?.photoURL ||
    user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=2563eb&color=fff`;

  const managedTeamIds = useMemo(
    () => new Set(memberships.map((membership) => membership.teamId)),
    [memberships]
  );

  const selectedTeam = teams.find((team) => team.id === selectedTeamId);

  const teamPlayers = useMemo(
    () =>
      players.filter(
        (player) =>
          player.teamId === selectedTeamId &&
          managedTeamIds.has(player.teamId)
      ),
    [players, selectedTeamId, managedTeamIds]
  );

  const teamAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          managedTeamIds.has(appointment.homeTeamId) ||
          managedTeamIds.has(appointment.awayTeamId)
      ),
    [appointments, managedTeamIds]
  );

  // ---------------------------------------------------------
  // Load the manager's global user profile.
  // ---------------------------------------------------------
  useEffect(() => {
    if (!uid) return;

    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data() as UserProfile);
      }
    });

    return () => unsubscribe();
  }, [uid]);

  // ---------------------------------------------------------
  // Load ONLY active team-manager memberships for this user.
  //
  // This is the key authorization relationship for the dashboard.
  // ---------------------------------------------------------
  useEffect(() => {
    if (!uid) return;

    setLoading(true);

    const membershipsQuery = query(
      collection(db, "team_memberships"),
      where("userId", "==", uid),
      where("role", "==", "team_manager"),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(
      membershipsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Membership[];

        setMemberships(data);

        if (data.length > 0 && !selectedTeamId) {
          setSelectedTeamId(data[0].teamId);
        }

        if (data.length === 0) {
          setSelectedTeamId("");
        }

        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [uid, selectedTeamId]);

  // ---------------------------------------------------------
  // Load the teams belonging to the manager's active memberships.
  // ---------------------------------------------------------
  useEffect(() => {
    if (!memberships.length) {
      setTeams([]);
      return;
    }

    let cancelled = false;

    const loadTeams = async () => {
      const results: Team[] = [];

      for (const membership of memberships) {
        const snapshot = await getDocs(
          query(collection(db, "teams"), where("__name__", "==", membership.teamId))
        );

        snapshot.forEach((item) => {
          results.push({
            id: item.id,
            ...item.data(),
          } as Team);
        });
      }

      if (!cancelled) {
        setTeams(results);
        if (
          results.length > 0 &&
          !results.some((team) => team.id === selectedTeamId)
        ) {
          setSelectedTeamId(results[0].id);
        }
      }
    };

    loadTeams();

    return () => {
      cancelled = true;
    };
  }, [memberships]);

  // ---------------------------------------------------------
  // Load players belonging ONLY to teams managed by this user.
  //
  // The backend must enforce this same rule. This frontend filter
  // is for UI correctness, not security.
  // ---------------------------------------------------------
  useEffect(() => {
    if (!managedTeamIds.size) {
      setPlayers([]);
      return;
    }

    const playerQuery = query(collection(db, "players"));

    const unsubscribe = onSnapshot(playerQuery, (snapshot) => {
      const data = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data(),
        }))
        .filter((player: any) => managedTeamIds.has(player.teamId)) as Player[];

      setPlayers(data);
    });

    return () => unsubscribe();
  }, [managedTeamIds]);

  // ---------------------------------------------------------
  // Load fixtures.
  //
  // The new appointment model stores homeTeamId/awayTeamId.
  // We therefore do NOT query coachId or team-manager UID.
  // ---------------------------------------------------------
  useEffect(() => {
    if (!managedTeamIds.size) {
      setAppointments([]);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "appointments"),
      (snapshot) => {
        const data = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .filter(
            (appointment: any) =>
              managedTeamIds.has(appointment.homeTeamId) ||
              managedTeamIds.has(appointment.awayTeamId)
          ) as Appointment[];

        setAppointments(data);
      }
    );

    return () => unsubscribe();
  }, [managedTeamIds]);

  const openNewPlayer = () => {
    if (!selectedTeamId) {
      alert("Select a team before registering a player.");
      return;
    }

    setSelectedPlayer(null);
    setPlayerForm({ ...emptyPlayer });
    setShowPlayerForm(true);
  };

  const openEditPlayer = (player: Player) => {
    // Never allow editing a player outside the manager's team scope.
    if (!managedTeamIds.has(player.teamId)) {
      alert("You do not have permission to edit this player.");
      return;
    }

    setSelectedPlayer(player);
    setPlayerForm({
      firstName: player.firstName || "",
      middleName: player.middleName || "",
      lastName: player.lastName || "",
      dateOfBirth: player.dateOfBirth || "",
      gender: player.gender || "",
      position: player.position || "",
      jerseyNumber: player.jerseyNumber ?? "",
    });
    setShowPlayerForm(true);
  };

  const savePlayer = async () => {
    if (!uid || !selectedTeamId) return;

    if (!playerForm.firstName.trim() || !playerForm.lastName.trim()) {
      alert("First name and surname are required.");
      return;
    }

    setSaving(true);

    try {
      const data = {
        firstName: playerForm.firstName.trim(),
        middleName: playerForm.middleName.trim(),
        lastName: playerForm.lastName.trim(),
        dateOfBirth: playerForm.dateOfBirth,
        gender: playerForm.gender || null,
        position: playerForm.position || null,
        jerseyNumber:
          playerForm.jerseyNumber === ""
            ? null
            : Number(playerForm.jerseyNumber),
        updatedAt: new Date(),
        updatedBy: uid,
      };

      if (selectedPlayer) {
        // Confirm the player still belongs to a team the manager controls.
        if (!managedTeamIds.has(selectedPlayer.teamId)) {
          throw new Error("You do not have permission to update this player.");
        }

        await updateDoc(doc(db, "players", selectedPlayer.id), data);
      } else {
        await addDoc(collection(db, "players"), {
          ...data,
          teamId: selectedTeamId,
          photoUrl: null,
          photoStoragePath: null,
          status: "active",
          registrationStatus: "registered",
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: uid,
          updatedBy: uid,
        });
      }

      setShowPlayerForm(false);
      setSelectedPlayer(null);
      setPlayerForm({ ...emptyPlayer });
    } catch (error: any) {
      alert(error?.message || "Unable to save player.");
    } finally {
      setSaving(false);
    }
  };

  const removePlayer = async (player: Player) => {
    if (!managedTeamIds.has(player.teamId)) {
      alert("You do not have permission to remove this player.");
      return;
    }

    const confirmed = window.confirm(
      `Remove ${player.firstName} ${player.lastName} from the active player list?`
    );

    if (!confirmed) return;

    try {
      // Prefer deactivation over physical deletion because player history
      // may later be referenced by teamsheets, reports and match verification.
      await updateDoc(doc(db, "players", player.id), {
        status: "inactive",
        updatedAt: new Date(),
        updatedBy: uid,
      });
    } catch (error: any) {
      alert(error?.message || "Unable to deactivate player.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  const activePlayers = teamPlayers.filter(
    (player) => player.status !== "inactive"
  );

  const upcomingFixtures = teamAppointments
    .filter((appointment) => appointment.status !== "cancelled")
    .sort((a, b) =>
      `${a.matchDate} ${a.matchTime}`.localeCompare(
        `${b.matchDate} ${b.matchTime}`
      )
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <Card className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-center gap-4">
              <Avatar src={photoURL} size="lg" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {displayName}
                  </h1>
                  <Badge variant="blue">Team Manager</Badge>
                </div>
                <p className="text-sm text-gray-600">{email}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Team-scoped management access
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["overview", "players", "fixtures", "profile"] as Tab[]).map(
                (tab) => (
                  <Button
                    key={tab}
                    variant={activeTab === tab ? "default" : "outline"}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Button>
                )
              )}

              <Button
                variant="outline"
                onClick={handleLogout}
                className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </Card>

        {/* TEAM SELECTOR */}
        <Card className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">Managing team</p>
              <h2 className="text-xl font-bold text-gray-900">
                {selectedTeam?.name || "No team assigned"}
              </h2>
              {selectedTeam && (
                <p className="text-sm text-gray-600">
                  {selectedTeam.homeGround || "No home ground"}{" "}
                  {selectedTeam.league ? `• ${selectedTeam.league}` : ""}
                </p>
              )}
            </div>

            {teams.length > 1 && (
              <select
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
                className="border rounded-lg px-4 py-2 bg-white"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </Card>

        {loading ? (
          <Card className="p-10 text-center text-gray-500">
            Loading your team access...
          </Card>
        ) : teams.length === 0 ? (
          <Card className="p-10 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            <h3 className="font-bold text-lg">No team assigned yet</h3>
            <p className="text-gray-500 mt-2">
              Your Team Manager account is registered, but an Executive must
              assign you to a team before you can manage players or fixtures.
            </p>
          </Card>
        ) : (
          <>
            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    title="Managed Teams"
                    value={teams.length}
                    icon="Users"
                    color="blue"
                  />
                  <StatCard
                    title="Active Players"
                    value={activePlayers.length}
                    icon="Users"
                    color="emerald"
                  />
                  <StatCard
                    title="Fixtures"
                    value={upcomingFixtures.length}
                    icon="Calendar"
                    color="amber"
                  />
                  <StatCard
                    title="Role"
                    value="Manager"
                    icon="Shield"
                    color="purple"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold">Player Management</h3>
                        <p className="text-sm text-gray-500">
                          Register and maintain your team's player records.
                        </p>
                      </div>
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>

                    <Button onClick={() => setActiveTab("players")}>
                      Manage Players
                    </Button>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold">Fixtures</h3>
                        <p className="text-sm text-gray-500">
                          View fixtures created by the Executive.
                        </p>
                      </div>
                      <Calendar className="w-6 h-6 text-amber-600" />
                    </div>

                    <Button onClick={() => setActiveTab("fixtures")}>
                      View Fixtures
                    </Button>
                  </Card>
                </div>

                <Card className="p-6">
                  <h3 className="text-xl font-bold mb-4">Your Management Scope</h3>
                  <div className="space-y-3 text-sm text-gray-700">
                    <p>
                      <strong>Team Manager:</strong> You can manage players
                      only for teams where an Executive has created an active
                      Team Manager membership for you.
                    </p>
                    <p>
                      <strong>Executive:</strong> Creates teams, fixtures,
                      memberships and referee appointments.
                    </p>
                    <p>
                      <strong>Coach:</strong> Has separate team-scoped access
                      for coaching and squad preparation.
                    </p>
                    <p>
                      <strong>Referee:</strong> Sees appointments assigned to
                      them and handles matchday verification.
                    </p>
                  </div>
                </Card>
              </div>
            )}

            {/* PLAYERS */}
            {activeTab === "players" && (
              <div className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">Team Players</h2>
                    <p className="text-sm text-gray-500">
                      {selectedTeam?.name} • {activePlayers.length} active
                      players
                    </p>
                  </div>

                  <Button onClick={openNewPlayer} className="flex gap-2">
                    <Plus className="w-4 h-4" />
                    Register Player
                  </Button>
                </div>

                {activePlayers.length === 0 ? (
                  <Card className="p-10 text-center">
                    <Users className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                    <h3 className="font-bold">No players registered</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Start by registering the players for this team.
                    </p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activePlayers.map((player) => (
                      <Card key={player.id} className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={
                                player.photoUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  `${player.firstName} ${player.lastName}`
                                )}`
                              }
                              size="md"
                            />
                            <div>
                              <h3 className="font-bold">
                                {player.firstName}{" "}
                                {player.middleName
                                  ? `${player.middleName} `
                                  : ""}
                                {player.lastName}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {player.position || "Position not set"}
                              </p>
                            </div>
                          </div>

                          {player.jerseyNumber && (
                            <Badge variant="blue">#{player.jerseyNumber}</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                          <div>
                            <p className="text-gray-500">DOB</p>
                            <p className="font-medium">
                              {player.dateOfBirth || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Registration</p>
                            <p className="font-medium">
                              {player.registrationStatus || "registered"}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditPlayer(player)}
                            className="flex-1"
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removePlayer(player)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FIXTURES */}
            {activeTab === "fixtures" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold">Team Fixtures</h2>
                  <p className="text-sm text-gray-500">
                    Fixtures involving your managed team(s).
                  </p>
                </div>

                {upcomingFixtures.length === 0 ? (
                  <Card className="p-10 text-center text-gray-500">
                    No fixtures have been created for your team yet.
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {upcomingFixtures.map((appointment) => {
                      const isHome =
                        managedTeamIds.has(appointment.homeTeamId);

                      return (
                        <Card key={appointment.id} className="p-5">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap gap-2 mb-2">
                                <Badge variant={isHome ? "blue" : "emerald"}>
                                  {isHome ? "HOME" : "AWAY"}
                                </Badge>
                                <Badge variant="gray">
                                  {appointment.status || "scheduled"}
                                </Badge>
                              </div>

                              <h3 className="text-xl font-bold">
                                {appointment.homeTeam} vs{" "}
                                {appointment.awayTeam}
                              </h3>

                              <p className="text-sm text-gray-600 mt-1">
                                {appointment.matchDate} •{" "}
                                {appointment.matchTime} •{" "}
                                {appointment.venue}
                              </p>

                              {appointment.competition && (
                                <p className="text-sm text-gray-500 mt-1">
                                  {appointment.competition}
                                  {appointment.season
                                    ? ` • ${appointment.season}`
                                    : ""}
                                </p>
                              )}
                            </div>

                            <div className="text-sm lg:text-right">
                              <p className="text-gray-500">Referee</p>
                              <p className="font-medium">
                                {appointment.refereeName || "Not assigned"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                            Teamsheet preparation will use this appointment
                            and the team's registered players.
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PROFILE */}
            {activeTab === "profile" && (
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-5">Team Manager Profile</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium text-lg">{displayName}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-lg">{email}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Global Role</p>
                    <Badge variant="blue">Team Manager</Badge>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Managed Teams</p>
                    <p className="font-medium">{teams.length}</p>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500 mb-2">
                      Active Team Memberships
                    </p>
                    <div className="space-y-2">
                      {teams.map((team) => (
                        <div
                          key={team.id}
                          className="border rounded-lg p-3 flex items-center justify-between"
                        >
                          <span className="font-medium">{team.name}</span>
                          <Badge variant="emerald">Team Manager</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {/* PLAYER FORM */}
        {showPlayerForm && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => !saving && setShowPlayerForm(false)}
          >
            <Card
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold">
                    {selectedPlayer ? "Edit Player" : "Register Player"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedTeam?.name}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPlayerForm(false)}
                  disabled={saving}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  value={playerForm.firstName}
                  onChange={(e) =>
                    setPlayerForm({
                      ...playerForm,
                      firstName: e.target.value,
                    })
                  }
                  placeholder="First name *"
                  className="border rounded-lg px-4 py-2"
                />

                <input
                  value={playerForm.middleName}
                  onChange={(e) =>
                    setPlayerForm({
                      ...playerForm,
                      middleName: e.target.value,
                    })
                  }
                  placeholder="Middle name"
                  className="border rounded-lg px-4 py-2"
                />

                <input
                  value={playerForm.lastName}
                  onChange={(e) =>
                    setPlayerForm({
                      ...playerForm,
                      lastName: e.target.value,
                    })
                  }
                  placeholder="Surname *"
                  className="border rounded-lg px-4 py-2"
                />

                <input
                  type="date"
                  value={playerForm.dateOfBirth}
                  onChange={(e) =>
                    setPlayerForm({
                      ...playerForm,
                      dateOfBirth: e.target.value,
                    })
                  }
                  className="border rounded-lg px-4 py-2"
                />

                <select
                  value={playerForm.gender}
                  onChange={(e) =>
                    setPlayerForm({
                      ...playerForm,
                      gender: e.target.value,
                    })
                  }
                  className="border rounded-lg px-4 py-2 bg-white"
                >
                  <option value="">Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>

                <input
                  value={playerForm.position}
                  onChange={(e) =>
                    setPlayerForm({
                      ...playerForm,
                      position: e.target.value,
                    })
                  }
                  placeholder="Position"
                  className="border rounded-lg px-4 py-2"
                />

                <input
                  type="number"
                  min={1}
                  max={99}
                  value={playerForm.jerseyNumber}
                  onChange={(e) =>
                    setPlayerForm({
                      ...playerForm,
                      jerseyNumber: e.target.value,
                    })
                  }
                  placeholder="Jersey number"
                  className="border rounded-lg px-4 py-2"
                />
              </div>

              <div className="mt-6 p-4 rounded-lg bg-blue-50 text-sm text-blue-800">
                Player photos and identity documents belong to the secure
                player-registration workflow. They should be uploaded through
                the protected backend endpoints, not exposed as public
                Firestore fields.
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowPlayerForm(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={savePlayer}
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Player"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamManagerDashboard;
