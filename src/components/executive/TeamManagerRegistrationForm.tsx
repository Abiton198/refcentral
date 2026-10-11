import React, { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { toast } from "@/components/ui/use-toast";

interface TeamManagerRegistrationFormProps {
  user: any;
  onComplete: () => void;
}

const TEAM_TYPES = ["Club", "School", "University / College", "Other"];

const AGE_GROUPS = [
  "Senior Men",
  "Senior Women",
  "Under 21",
  "Under 19",
  "Under 18",
  "Under 16",
  "Under 15",
  "Under 14",
  "Under 13",
  "Other",
];

// "Despatch RFC 1st XV" + "Senior Men" -> "despatch-rfc-1st-xv-senior-men"
const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const TeamManagerRegistrationForm: React.FC<
  TeamManagerRegistrationFormProps
> = ({ user, onComplete }) => {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!user) {
      toast({
        title: "Not signed in",
        description: "Your session was lost. Please sign in again and retry.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Kept outside the try so the catch block can log what was already on file.
    let existing: Record<string, unknown> = {};

    try {
      const teamName = (formData.teamName || "").trim();
      const ageGroup = formData.ageGroup || "";
      const teamId = slugify(`${teamName} ${ageGroup}`);

      if (!teamId) {
        toast({
          title: "Team name required",
          description: "Enter the name of the team you represent.",
          variant: "destructive",
        });
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const managerRef = doc(db, "team_managers", user.uid);
      const teamRef = doc(db, "teams", teamId);

      const [userSnap, managerSnap, teamSnap] = await Promise.all([
        getDoc(userRef),
        getDoc(managerRef),
        getDoc(teamRef),
      ]);

      const pick = (d: any) =>
        d ? { role: d.role, approved: d.approved, status: d.status } : null;
      existing = {
        users: pick(userSnap.exists() ? userSnap.data() : null),
        team_managers: pick(managerSnap.exists() ? managerSnap.data() : null),
        team: teamSnap.exists()
          ? { managerUid: teamSnap.data().managerUid, status: teamSnap.data().status }
          : null,
      };

      // Roles can only be set once. Don't touch another role's account.
      const existingRole = userSnap.exists() ? userSnap.data().role : null;
      if (existingRole && existingRole !== "team_manager") {
        toast({
          title: "Account already registered",
          description: `This Google account is already registered as ${existingRole}. Use a different account.`,
          variant: "destructive",
        });
        return;
      }

      // Someone else already registered this team.
      const teamIsMine =
        teamSnap.exists() && teamSnap.data().managerUid === user.uid;
      if (teamSnap.exists() && !teamIsMine) {
        toast({
          title: "Team already registered",
          description:
            "A team with this name and age group already exists. Ask an Executive to link you to it as manager.",
          variant: "destructive",
        });
        return;
      }

      const managerName =
        user.displayName || `${formData.firstName || ""} ${formData.surname || ""}`.trim();

      // ---- TEAM document ----
      // Team-level details only. The manager's personal contact numbers
      // stay on the team_managers document, because teams are readable by
      // every signed-in user.
      const teamProfile = {
        name: teamName,
        nameLower: teamName.toLowerCase(),
        clubName: (formData.clubName || "").trim(),
        teamType: formData.teamType || "",
        ageGroup,
        division: (formData.division || "").trim(),
        homeGround: (formData.homeGround || "").trim(),
        city: (formData.city || "").trim(),
        colours: (formData.colours || "").trim(),
        managerName,
        lastEdited: serverTimestamp(),
      };

      const teamProtected = {
        managerUid: user.uid,
        createdBy: user.uid,
        approved: false,
        status: "pending", // an Executive activates the team on approval
        createdAt: serverTimestamp(),
      };

      // ---- TEAM MANAGER profile ----
      const managerProfile = {
        email: user.email,
        displayName: managerName,
        mobileNumber: (formData.mobileNumber || "").trim(),
        altContact: (formData.altContact || "").trim(),
        lastEdited: serverTimestamp(),
      };

      const managerProtected = {
        uid: user.uid,
        role: "team_manager",
        approved: false,
        status: "pending",
        teamId,
        teamName,
        createdAt: serverTimestamp(),
      };

      // ---- USERS document (kept light) ----
      const userProfile = {
        email: user.email,
        displayName: managerName,
        lastEdited: serverTimestamp(),
      };

      const userProtected = {
        uid: user.uid,
        role: "team_manager",
        approved: false,
        status: "pending",
        createdAt: serverTimestamp(),
      };

      const usersPayload = !userSnap.exists()
        ? { ...userProfile, ...userProtected }
        : existingRole
          ? userProfile // already has a role: profile fields only
          : { ...userProfile, role: "team_manager" }; // legacy doc, no role yet

      const managerPayload = managerSnap.exists()
        ? managerProfile
        : { ...managerProfile, ...managerProtected };

      const teamPayload = teamSnap.exists()
        ? teamProfile
        : { ...teamProfile, ...teamProtected };

      // One atomic commit: user, manager profile and team are saved together
      // or not at all.
      const batch = writeBatch(db);
      batch.set(userRef, usersPayload, { merge: true });
      batch.set(managerRef, managerPayload, { merge: true });
      batch.set(teamRef, teamPayload, { merge: true });
      await batch.commit();

      toast({
        title: "✅ Registration Submitted",
        description: "Your team and account are awaiting executive approval.",
      });
      onComplete();
    } catch (error: any) {
      console.error(
        "Team manager registration failed:",
        error?.code,
        error?.message,
        "Existing docs:",
        existing
      );
      toast({
        title: "Registration failed",
        description: `${error?.code || "error"}: ${error?.message || "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto mt-8 p-6 border rounded-lg shadow space-y-4 bg-white text-left"
    >
      <h3 className="text-2xl font-bold text-center text-gray-800 mb-1">
        Team Manager Registration
      </h3>
      <p className="text-gray-600 text-sm text-center mb-4">
        Register yourself and the team you represent. An Executive reviews both
        before your account is activated.
      </p>

      {/* TEAM DETAILS */}
      <h4 className="text-lg font-semibold text-emerald-700 mt-4">
        Team Details
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          name="teamName"
          placeholder="Team name (e.g. Despatch RFC 1st XV)"
          onChange={handleChange}
          className="input"
          required
        />
        <input
          name="clubName"
          placeholder="Club / School / Institution"
          onChange={handleChange}
          className="input"
          required
        />
        <select name="teamType" onChange={handleChange} className="input" required>
          <option value="">Team type</option>
          {TEAM_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select name="ageGroup" onChange={handleChange} className="input" required>
          <option value="">Age group / section</option>
          {AGE_GROUPS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <input
          name="division"
          placeholder="League / division (optional)"
          onChange={handleChange}
          className="input"
        />
        <input
          name="colours"
          placeholder="Team colours (optional)"
          onChange={handleChange}
          className="input"
        />
        <input
          name="homeGround"
          placeholder="Home ground / venue"
          onChange={handleChange}
          className="input"
          required
        />
        <input
          name="city"
          placeholder="City / Town"
          onChange={handleChange}
          className="input"
          required
        />
      </div>

      {/* MANAGER DETAILS */}
      <h4 className="text-lg font-semibold text-emerald-700 mt-6">
        Your Details
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          value={user?.displayName || ""}
          placeholder="Name"
          className="input"
          readOnly
        />
        <input
          value={user?.email || ""}
          placeholder="Email"
          className="input"
          readOnly
        />
        <input
          name="mobileNumber"
          placeholder="Mobile number"
          onChange={handleChange}
          className="input"
          required
        />
        <input
          name="altContact"
          placeholder="Alternative contact number (optional)"
          onChange={handleChange}
          className="input"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "Submitting..." : "Submit Team Manager Registration"}
      </button>
    </form>
  );
};