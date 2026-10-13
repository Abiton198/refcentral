import React, { useEffect, useMemo, useState, useRef } from "react";
import { Avatar } from "../ui/avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, StatCard } from "../ui/Card";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
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
 * Team Managers have team-scoped access.
 *
 * users/{uid}
 *   role: "team_manager"
 *
 * team_memberships/{membershipId}
 *   userId: uid
 *   teamId: teamId
 *   role: "team_manager"
 *   status: "active"
 *
 * Executive responsibilities:
 *   - Create teams
 *   - Create fixtures
 *   - Assign team memberships
 *   - Assign referees
 *
 * Team Manager responsibilities:
 *   - View assigned teams
 *   - Register and update players
 *   - Upload player photographs
 *   - Deactivate players
 *   - View fixtures involving their teams
 *
 * Player records and photographs are handled by the protected backend API.
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

interface PlayerForm {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  position: string;
  jerseyNumber: string | number;
}

const emptyPlayer: PlayerForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  position: "",
  jerseyNumber: "",
};

// Cloudflare Worker API base URL.
// You can override this using VITE_API_BASE_URL in your frontend .env file.
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://refcentral-backend-wpzq.onrender.com"
).replace(/\/$/, "");

/**
 * Makes an authenticated request to the RefCentral backend.
 *
 * Firebase Authentication supplies an ID token.
 * The backend must validate this token and enforce authorization.
 */
async function authenticatedApiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const token = await currentUser.getIdToken();

  const headers = new Headers(init.headers || {});

  headers.set("Authorization", `Bearer ${token}`);

  // Do not manually set Content-Type for FormData.
  // The browser needs to add the multipart boundary for photo uploads.
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const body = await response.json();
      message = body.detail || body.message || message;
    } catch {
      // The response did not contain JSON.
    }

    throw new Error(message);
  }

  return response;
}

/**
 * Converts a player response from the Python API's snake_case
 * fields into the frontend's camelCase player model.
 */
function mapApiPlayer(raw: any): Player {
  return {
    id: raw.player_id ?? raw.id,
    teamId: raw.team_id ?? raw.teamId,
    firstName: raw.first_name ?? raw.firstName ?? "",
    middleName: raw.middle_name ?? raw.middleName ?? "",
    lastName: raw.last_name ?? raw.lastName ?? "",
    dateOfBirth:
      typeof (raw.date_of_birth ?? raw.dateOfBirth) === "string"
        ? raw.date_of_birth ?? raw.dateOfBirth
        : "",
    gender: raw.gender || "",
    position: raw.position || "",
    jerseyNumber: raw.jersey_number ?? raw.jerseyNumber ?? undefined,
    photoUrl: raw.photo_url ?? raw.photoUrl ?? undefined,
    status: raw.status || "active",
    registrationStatus:
      raw.registration_status ?? raw.registrationStatus ?? "registered",
  };
}

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
  const [playerForm, setPlayerForm] =
    useState<PlayerForm>({ ...emptyPlayer });

  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const uid = user?.uid || "";

  const displayName =
    profile?.displayName || user?.displayName || "Team Manager";

  const email = profile?.email || user?.email || "";

  const cameraInputRef = useRef(null);

  const photoURL =
    profile?.photoURL ||
    user?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=2563eb&color=fff`;

  // Team IDs for which this user has an active Team Manager membership.
  const managedTeamIds = useMemo(
    () =>
      new Set(
        memberships
          .filter(
            (membership) =>
              membership.role === "team_manager" &&
              membership.status === "active"
          )
          .map((membership) => membership.teamId)
      ),
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
  // Load the manager's user profile.
  // ---------------------------------------------------------
  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", uid),
      (snapshot) => {
        if (snapshot.exists()) {
          setProfile(snapshot.data() as UserProfile);
        }
      },
      (error) => {
        console.error("Unable to load user profile:", error);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // ---------------------------------------------------------
  // Load active Team Manager memberships.
  //
  // This frontend query is used to display assigned teams.
  // The backend must independently verify authorization on every
  // player or photograph request.
  // ---------------------------------------------------------
  useEffect(() => {
    if (!uid) {
      setMemberships([]);
      setSelectedTeamId("");
      setLoading(false);
      return;
    }

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

        setSelectedTeamId((currentTeamId) => {
          if (
            currentTeamId &&
            data.some((membership) => membership.teamId === currentTeamId)
          ) {
            return currentTeamId;
          }

          return data[0]?.teamId || "";
        });

        setLoading(false);
      },
      (error) => {
        console.error("Unable to load team memberships:", error);
        setMemberships([]);
        setSelectedTeamId("");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // ---------------------------------------------------------
  // Load the teams associated with active memberships.
  // ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadTeams = async () => {
      if (!memberships.length) {
        setTeams([]);
        return;
      }

      try {
        const results = await Promise.all(
          memberships.map(async (membership) => {
            const snapshot = await getDocs(
              query(
                collection(db, "teams"),
                where("__name__", "==", membership.teamId)
              )
            );

            return snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })) as Team[];
          })
        );

        const allTeams = results.flat();

        if (!cancelled) {
          setTeams(allTeams);

          setSelectedTeamId((currentTeamId) => {
            if (
              currentTeamId &&
              allTeams.some((team) => team.id === currentTeamId)
            ) {
              return currentTeamId;
            }

            return allTeams[0]?.id || "";
          });
        }
      } catch (error) {
        console.error("Unable to load teams:", error);

        if (!cancelled) {
          setTeams([]);
        }
      }
    };

    void loadTeams();

    return () => {
      cancelled = true;
    };
  }, [memberships]);

  // ---------------------------------------------------------
  // Load player records through the protected backend API.
  // ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadPlayers = async () => {
      if (!managedTeamIds.size) {
        setPlayers([]);
        return;
      }

      try {
        const results = await Promise.all(
          Array.from(managedTeamIds).map(async (teamId) => {
            const response = await authenticatedApiFetch(
              `/api/teams/${encodeURIComponent(teamId)}/players`
            );

            const rows = await response.json();

            return (rows as any[]).map((row) => {
              const player = mapApiPlayer(row);

              // Some APIs omit team_id from individual player records.
              return {
                ...player,
                teamId: player.teamId || teamId,
              };
            });
          })
        );

        if (!cancelled) {
          setPlayers(results.flat());
        }
      } catch (error: any) {
        if (!cancelled) {
          setPlayers([]);

          console.error(
            "Unable to load team players from RefCentral API:",
            error
          );

          alert(
            error?.message ||
            "Unable to load players from the RefCentral backend."
          );
        }
      }
    };

    void loadPlayers();

    return () => {
      cancelled = true;
    };
  }, [managedTeamIds]);

  // ---------------------------------------------------------
  // Fetch private player photographs.
  //
  // A protected photo URL cannot normally be used directly as an
  // image src because the browser cannot attach our Firebase token.
  // Fetch the image with authorization and create a temporary URL.
  // ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    const loadPhotos = async () => {
      const next: Record<string, string> = {};

      await Promise.all(
        players.map(async (player) => {
          if (
            !player.photoUrl ||
            !player.teamId ||
            !managedTeamIds.has(player.teamId)
          ) {
            return;
          }

          try {
            const response = await authenticatedApiFetch(
              `/api/teams/${encodeURIComponent(
                player.teamId
              )}/players/${encodeURIComponent(player.id)}/photo`
            );

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            createdUrls.push(objectUrl);
            next[player.id] = objectUrl;
          } catch (error) {
            console.warn(
              `Could not load photograph for player ${player.id}:`,
              error
            );
          }
        })
      );

      if (!cancelled) {
        setPhotoUrls((previous) => {
          Object.values(previous).forEach((url) => URL.revokeObjectURL(url));
          return next;
        });
      } else {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    };

    void loadPhotos();

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [players, managedTeamIds]);

  // ---------------------------------------------------------
  // Load fixtures involving the manager's teams.
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
      },
      (error) => {
        console.error("Unable to load fixtures:", error);
        setAppointments([]);
      }
    );

    return () => unsubscribe();
  }, [managedTeamIds]);

  // ---------------------------------------------------------
  // Open a blank player registration form.
  // ---------------------------------------------------------
  const openNewPlayer = () => {
    if (!selectedTeamId) {
      alert("Select a team before registering a player.");
      return;
    }

    setSelectedPlayer(null);
    setPlayerForm({ ...emptyPlayer });
    setPhotoFile(null);
    setPhotoPreview("");
    setShowPlayerForm(true);
  };

  // ---------------------------------------------------------
  // Open the player edit form.
  // ---------------------------------------------------------
  const openEditPlayer = (player: Player) => {
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

    setPhotoFile(null);
    setPhotoPreview("");
    setShowPlayerForm(true);
  };

  // ---------------------------------------------------------
  // Save a new player or update an existing player.
  //
  // Player JSON is sent to the backend.
  // A selected photograph is uploaded separately as multipart data.
  // ---------------------------------------------------------
  const savePlayer = async () => {
    const teamId = selectedPlayer?.teamId || selectedTeamId;

    if (!uid || !teamId) {
      alert("Your account or team selection is missing.");
      return;
    }

    if (!managedTeamIds.has(teamId)) {
      alert("You are not assigned to manage this team.");
      return;
    }

    if (
      !playerForm.firstName.trim() ||
      !playerForm.lastName.trim()
    ) {
      alert("First name and surname are required.");
      return;
    }

    if (!playerForm.dateOfBirth) {
      alert("Date of birth is required.");
      return;
    }

    const jerseyNumber =
      playerForm.jerseyNumber === "" ||
        playerForm.jerseyNumber === null
        ? null
        : Number(playerForm.jerseyNumber);

    if (
      jerseyNumber !== null &&
      (!Number.isInteger(jerseyNumber) ||
        jerseyNumber < 1 ||
        jerseyNumber > 99)
    ) {
      alert("Jersey number must be a whole number from 1 to 99.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        first_name: playerForm.firstName.trim(),
        middle_name: playerForm.middleName.trim(),
        last_name: playerForm.lastName.trim(),
        date_of_birth: playerForm.dateOfBirth,
        gender: playerForm.gender || null,
        position: playerForm.position || null,
        jersey_number: jerseyNumber,
      };

      let savedPlayer: Player;

      if (selectedPlayer) {
        if (!managedTeamIds.has(selectedPlayer.teamId)) {
          throw new Error(
            "You do not have permission to update this player."
          );
        }

        const response = await authenticatedApiFetch(
          `/api/teams/${encodeURIComponent(
            selectedPlayer.teamId
          )}/players/${encodeURIComponent(selectedPlayer.id)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );

        savedPlayer = mapApiPlayer(await response.json());

        savedPlayer = {
          ...savedPlayer,
          teamId: savedPlayer.teamId || selectedPlayer.teamId,
        };
      } else {
        const response = await authenticatedApiFetch(
          `/api/teams/${encodeURIComponent(teamId)}/players`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        savedPlayer = mapApiPlayer(await response.json());

        savedPlayer = {
          ...savedPlayer,
          teamId: savedPlayer.teamId || teamId,
        };
      }

      // Preserve the saved ID so a failed photograph upload does not
      // accidentally create a duplicate player on the next attempt.
      setSelectedPlayer(savedPlayer);

      // Upload a photograph only after the player record exists.
      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);

        await authenticatedApiFetch(
          `/api/teams/${encodeURIComponent(
            savedPlayer.teamId
          )}/players/${encodeURIComponent(savedPlayer.id)}/photo`,
          {
            method: "POST",
            body: formData,
          }
        );
      }

      // Reload this team's players from the backend.
      const listResponse = await authenticatedApiFetch(
        `/api/teams/${encodeURIComponent(savedPlayer.teamId)}/players`
      );

      const refreshedRows = (await listResponse.json()) as any[];

      const refreshedPlayers = refreshedRows.map((row) => {
        const player = mapApiPlayer(row);

        return {
          ...player,
          teamId: player.teamId || savedPlayer.teamId,
        };
      });

      setPlayers((current) => [
        ...current.filter(
          (player) => player.teamId !== savedPlayer.teamId
        ),
        ...refreshedPlayers,
      ]);

      setShowPlayerForm(false);
      setSelectedPlayer(null);
      setPlayerForm({ ...emptyPlayer });
      setPhotoFile(null);
      setPhotoPreview("");
    } catch (error: any) {
      console.error("Unable to save player:", error);

      alert(
        error?.message ||
        "Unable to save player. Check the API URL and backend logs."
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------
  // Deactivate a player instead of permanently deleting the record.
  // This helps preserve future teamsheet and match history.
  // ---------------------------------------------------------
  const removePlayer = async (player: Player) => {
    if (!managedTeamIds.has(player.teamId)) {
      alert("You do not have permission to remove this player.");
      return;
    }

    const confirmed = window.confirm(
      `Deactivate ${player.firstName} ${player.lastName}?`
    );

    if (!confirmed) return;

    try {
      await authenticatedApiFetch(
        `/api/teams/${encodeURIComponent(
          player.teamId
        )}/players/${encodeURIComponent(player.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "inactive" }),
        }
      );

      setPlayers((current) =>
        current.map((item) =>
          item.id === player.id
            ? { ...item, status: "inactive" }
            : item
        )
      );
    } catch (error: any) {
      console.error("Unable to deactivate player:", error);

      alert(error?.message || "Unable to deactivate player.");
    }
  };

  // ---------------------------------------------------------
  // Sign out of Firebase Authentication.
  // ---------------------------------------------------------
  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  const activePlayers = teamPlayers.filter(
    (player) => player.status !== "inactive"
  );

  const upcomingFixtures = teamAppointments
    .filter(
      (appointment) =>
        (appointment.status || "").toLowerCase() !== "cancelled"
    )
    .sort((a, b) =>
      `${a.matchDate} ${a.matchTime}`.localeCompare(
        `${b.matchDate} ${b.matchTime}`
      )
    );

  // ---------------------------------------------------------
  // Dashboard interface.
  // ---------------------------------------------------------
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
              {(
                ["overview", "players", "fixtures", "profile"] as Tab[]
              ).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "default" : "outline"}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Button>
              ))}

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
                  {selectedTeam.homeGround || "No home ground"}
                  {selectedTeam.league
                    ? ` • ${selectedTeam.league}`
                    : ""}
                </p>
              )}
            </div>

            {teams.length > 1 && (
              <select
                value={selectedTeamId}
                onChange={(event) =>
                  setSelectedTeamId(event.target.value)
                }
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

        {/* LOADING AND NO-TEAM STATES */}
        {loading ? (
          <Card className="p-10 text-center text-gray-500">
            Loading your team access...
          </Card>
        ) : teams.length === 0 ? (
          <Card className="p-10 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-gray-400" />

            <h3 className="font-bold text-lg">
              No team assigned yet
            </h3>

            <p className="text-gray-500 mt-2">
              Your Team Manager account is registered, but an Executive
              must assign you to a team before you can manage players
              or fixtures.
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
                        <h3 className="text-xl font-bold">
                          Player Management
                        </h3>

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
                  <h3 className="text-xl font-bold mb-4">
                    Your Management Scope
                  </h3>

                  <div className="space-y-3 text-sm text-gray-700">
                    <p>
                      <strong>Team Manager:</strong> You can manage
                      players only for teams where an Executive has
                      created an active Team Manager membership for you.
                    </p>

                    <p>
                      <strong>Executive:</strong> Creates teams,
                      fixtures, memberships and referee appointments.
                    </p>

                    <p>
                      <strong>Coach:</strong> Has separate team-scoped
                      access for coaching and squad preparation.
                    </p>

                    <p>
                      <strong>Referee:</strong> Sees appointments assigned
                      to them and handles matchday verification.
                    </p>
                  </div>
                </Card>
              </div>
            )}

            {/* PLAYERS */}
            {/* {activeTab === "players" && (
              <div className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">Team Players</h2>

                    <p className="text-sm text-gray-500">
                      {selectedTeam?.name} • {activePlayers.length} active
                      players
                    </p>
                  </div>

                  <Button
                    onClick={openNewPlayer}
                    className="flex gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Register Player
                  </Button>
                </div>

                {activePlayers.length === 0 ? (
                  <Card className="p-10 text-center">
                    <Users className="w-10 h-10 mx-auto mb-3 text-gray-400" />

                    <h3 className="font-bold">
                      No players registered
                    </h3>

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
                                photoUrls[player.id] ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  `${player.firstName} ${player.lastName}`
                                )}&background=2563eb&color=fff`
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

                          {player.jerseyNumber != null && (
                            <Badge variant="blue">
                              #{player.jerseyNumber}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                          <div>
                            <p className="text-gray-500">Date of birth</p>

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
            )} */}


            {activeTab === "players" && (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">Team Players</h2>
                    <p className="text-sm text-gray-500">
                      {selectedTeam?.name} • {activePlayers.length} active players
                    </p>
                  </div>

                  <Button onClick={openNewPlayer} className="flex gap-2">
                    <Plus className="w-4 h-4" />
                    Register Player
                  </Button>
                </div>

                {/* Empty state */}
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
                    {activePlayers.map((player) => {
                      const fullName = [
                        player.firstName,
                        player.middleName,
                        player.lastName,
                      ]
                        .filter(Boolean)
                        .join(" ");

                      const profilePhoto =
                        photoUrls[player.id] ||
                        player.photoUrl ||
                        player.photoURL ||
                        player.photo_url ||
                        "";

                      const fallbackPhoto =
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          fullName || "Player"
                        )}&background=2563eb&color=fff&size=256`;

                      return (
                        <Card key={player.id} className="overflow-hidden">
                          {/* Player profile heading */}
                          <div className="bg-gradient-to-r from-blue-900 to-blue-600 p-5 text-white">
                            <div className="flex items-center gap-4">
                              <img
                                src={profilePhoto || fallbackPhoto}
                                alt={`${fullName || "Player"} profile`}
                                onError={(event) => {
                                  event.currentTarget.onerror = null;
                                  event.currentTarget.src = fallbackPhoto;
                                }}
                                className="h-24 w-24 shrink-0 rounded-full border-4 border-white/80 bg-white object-cover shadow-md"
                              />

                              <div className="min-w-0 flex-1">
                                <h3 className="break-words text-lg font-bold">
                                  {fullName || "Unnamed Player"}
                                </h3>

                                <p className="mt-1 text-sm text-blue-100">
                                  {player.position || "Position not set"}
                                </p>

                                {player.jerseyNumber != null && (
                                  <span className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
                                    Jersey #{player.jerseyNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Player details */}
                          <div className="p-5">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                              <div>
                                <p className="text-gray-500">First name</p>
                                <p className="font-medium text-gray-900">
                                  {player.firstName || "-"}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Last name</p>
                                <p className="font-medium text-gray-900">
                                  {player.lastName || "-"}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Date of birth</p>
                                <p className="font-medium text-gray-900">
                                  {player.dateOfBirth || "-"}
                                </p>
                              </div>

                              <div>
                                <p className="text-gray-500">Registration</p>
                                <p className="font-medium capitalize text-gray-900">
                                  {player.registrationStatus || "Registered"}
                                </p>
                              </div>
                            </div>

                            {!profilePhoto && (
                              <p className="mt-4 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                                No saved profile photograph. Edit this player to add one.
                              </p>
                            )}

                            {/* Actions */}
                            <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditPlayer(player)}
                                className="flex-1"
                              >
                                <Edit2 className="mr-1 h-4 w-4" />
                                Edit
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  // Open a detailed player profile.
                                  setSelectedPlayer(player);
                                  setActiveTab("player-profile");
                                }}
                                className="flex-1"
                              >
                                <Users className="mr-1 h-4 w-4" />
                                View Profile
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removePlayer(player)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
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
                      const isHome = managedTeamIds.has(
                        appointment.homeTeamId
                      );

                      return (
                        <Card key={appointment.id} className="p-5">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap gap-2 mb-2">
                                <Badge
                                  variant={isHome ? "blue" : "emerald"}
                                >
                                  {isHome ? "HOME" : "AWAY"}
                                </Badge>

                                <Badge variant="gray">
                                  {appointment.status || "scheduled"}
                                </Badge>
                              </div>

                              <h3 className="text-xl font-bold">
                                {appointment.homeTeam || "Home team"} vs{" "}
                                {appointment.awayTeam || "Away team"}
                              </h3>

                              <p className="text-sm text-gray-600 mt-1">
                                {appointment.matchDate || "Date TBC"} •{" "}
                                {appointment.matchTime || "Time TBC"} •{" "}
                                {appointment.venue || "Venue TBC"}
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
                <h2 className="text-2xl font-bold mb-5">
                  Team Manager Profile
                </h2>

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

        {/* PLAYER REGISTRATION / EDIT FORM */}
        {showPlayerForm && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => {
              if (!saving) {
                setShowPlayerForm(false);
              }
            }}
          >
            <Card
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
              onClick={(event) => event.stopPropagation()}
            >
              {/* FORM HEADER */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold">
                    {selectedPlayer ? "Edit Player" : "Register Player"}
                  </h2>

                  <p className="text-sm text-gray-500">
                    {teams.find(
                      (team) =>
                        team.id ===
                        (selectedPlayer?.teamId || selectedTeamId)
                    )?.name || "Selected team"}
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

              {/* PLAYER PHOTOGRAPH */}

              <div className="mb-5 flex flex-col sm:flex-row items-start gap-4">
                {/* Player Photograph: Preview, Save or Discard */}
                <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                  <h3 className="mb-3 font-semibold text-gray-800">
                    Player photograph
                  </h3>

                  {/* Photo preview */}
                  <div className="flex flex-col items-center">
                    {photoPreview ? (
                      <>
                        <div className="relative w-full max-w-sm overflow-hidden rounded-xl border bg-gray-50">
                          <img
                            src={photoPreview}
                            alt="Preview of player photograph"
                            className="h-64 w-full object-contain"
                          />

                          <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                            Photo preview
                          </span>
                        </div>

                        {photoFile && (
                          <div className="mt-3 w-full max-w-sm text-center">
                            <p className="break-all text-sm font-medium text-gray-700">
                              {photoFile.name}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {(photoFile.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        )}

                        {/* Save or discard the selected photo */}
                        <div className="mt-4 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => {
                              if (!photoFile) {
                                alert(
                                  "This is the current player photo. Choose a new photo to replace it."
                                );
                                return;
                              }

                              // Keep the selected photo for submission with the player form.
                              alert(
                                "Photo accepted. Submit the player form to save it to RefCentral."
                              );
                            }}
                            disabled={!photoFile}
                            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            ✓ Use this photo
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPhotoFile(null);

                              setPhotoPreview((previousPreview) => {
                                if (previousPreview?.startsWith("blob:")) {
                                  URL.revokeObjectURL(previousPreview);
                                }

                                return "";
                              });

                              const fileInput = document.getElementById("player-photo");
                              if (fileInput) fileInput.value = "";

                              if (cameraInputRef.current) {
                                cameraInputRef.current.value = "";
                              }
                            }}
                            className="flex-1 rounded-lg border border-red-200 px-4 py-3 font-semibold text-red-600 hover:bg-red-50"
                          >
                            ✕ Discard photo
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-48 w-full max-w-sm flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 text-center">
                        <span className="text-4xl">📷</span>

                        <p className="mt-2 font-medium text-gray-700">
                          No new photo selected
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          Upload a photo or take one with your camera.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Upload a photograph */}
                  <div className="mt-5">
                    <label
                      htmlFor="player-photo"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Choose a photo from your device
                    </label>

                    <input
                      id="player-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        if (!file) return;

                        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                          alert("Please choose a JPEG, PNG or WebP image.");
                          event.target.value = "";
                          return;
                        }

                        if (file.size > 5 * 1024 * 1024) {
                          alert("Player photo must not exceed 5 MB.");
                          event.target.value = "";
                          return;
                        }

                        setPhotoPreview((previousPreview) => {
                          if (previousPreview?.startsWith("blob:")) {
                            URL.revokeObjectURL(previousPreview);
                          }

                          return URL.createObjectURL(file);
                        });

                        setPhotoFile(file);
                      }}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                    />

                    <p className="mt-1 text-xs text-gray-500">
                      JPEG, PNG or WebP. Maximum 5 MB.
                    </p>
                  </div>

                  {/* Camera capture */}
                  <div className="mt-3">
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        if (!file) return;

                        if (!file.type.startsWith("image/")) {
                          alert("Please capture a valid image.");
                          event.target.value = "";
                          return;
                        }

                        if (file.size > 5 * 1024 * 1024) {
                          alert("Player photo must not exceed 5 MB.");
                          event.target.value = "";
                          return;
                        }

                        setPhotoPreview((previousPreview) => {
                          if (previousPreview?.startsWith("blob:")) {
                            URL.revokeObjectURL(previousPreview);
                          }

                          return URL.createObjectURL(file);
                        });

                        setPhotoFile(file);
                        event.target.value = "";
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
                    >
                      📷 Take a photo with camera
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-gray-500">
                    Review the preview before accepting the photograph. Discarding a new
                    photo removes it from the pending changes; it does not delete an
                    existing photograph already saved to the player's record.
                  </p>
                </div>
              </div>

              {/* PLAYER DETAILS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  value={playerForm.firstName}
                  onChange={(event) =>
                    setPlayerForm({
                      ...playerForm,
                      firstName: event.target.value,
                    })
                  }
                  placeholder="First name *"
                  aria-label="First name"
                  className="border rounded-lg px-4 py-2"
                />

                <input
                  value={playerForm.middleName}
                  onChange={(event) =>
                    setPlayerForm({
                      ...playerForm,
                      middleName: event.target.value,
                    })
                  }
                  placeholder="Middle name"
                  aria-label="Middle name"
                  className="border rounded-lg px-4 py-2"
                />

                <input
                  value={playerForm.lastName}
                  onChange={(event) =>
                    setPlayerForm({
                      ...playerForm,
                      lastName: event.target.value,
                    })
                  }
                  placeholder="Surname *"
                  aria-label="Surname"
                  className="border rounded-lg px-4 py-2"
                />

                <input
                  type="date"
                  value={playerForm.dateOfBirth}
                  onChange={(event) =>
                    setPlayerForm({
                      ...playerForm,
                      dateOfBirth: event.target.value,
                    })
                  }
                  aria-label="Date of birth"
                  className="border rounded-lg px-4 py-2"
                />

                <select
                  value={playerForm.gender}
                  onChange={(event) =>
                    setPlayerForm({
                      ...playerForm,
                      gender: event.target.value,
                    })
                  }
                  aria-label="Gender"
                  className="border rounded-lg px-4 py-2 bg-white"
                >
                  <option value="">Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>

                <input
                  value={playerForm.position}
                  onChange={(event) =>
                    setPlayerForm({
                      ...playerForm,
                      position: event.target.value,
                    })
                  }
                  placeholder="Playing position"
                  aria-label="Playing position"
                  className="border rounded-lg px-4 py-2"
                />

                <input
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  value={playerForm.jerseyNumber}
                  onChange={(event) =>
                    setPlayerForm({
                      ...playerForm,
                      jerseyNumber: event.target.value,
                    })
                  }
                  placeholder="Jersey number"
                  aria-label="Jersey number"
                  className="border rounded-lg px-4 py-2"
                />
              </div>

              {/* SECURITY INFORMATION */}
              <div className="mt-6 p-4 rounded-lg bg-blue-50 text-sm text-blue-800">
                Player records and photographs are saved through the
                authenticated RefCentral API. The backend must verify your
                active Team Manager membership before allowing changes.
              </div>

              {/* FORM ACTIONS */}
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