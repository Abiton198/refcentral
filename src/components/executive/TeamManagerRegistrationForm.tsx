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

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://refcentral.abitonp.workers.dev"
).replace(/\/$/, "");

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (loading) return;

  if (!user) {
    toast({
      title: "Not signed in",
      description: "Please sign in again.",
      variant: "destructive",
    });
    return;
  }

  setLoading(true);

  try {
    const token = await user.getIdToken();

    const response = await fetch(
      `${API_BASE_URL}/api/team-registrations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          team: {
            name: formData.teamName?.trim() || "",
            clubName: formData.clubName?.trim() || "",
            teamType: formData.teamType || "",
            ageGroup: formData.ageGroup || "",
            division: formData.division?.trim() || "",
            homeGround: formData.homeGround?.trim() || "",
            city: formData.city?.trim() || "",
            colours: formData.colours?.trim() || "",
          },
          manager: {
            displayName: user.displayName || "",
            mobileNumber:
              formData.mobileNumber?.trim() || "",
            altContact:
              formData.altContact?.trim() || "",
          },
        }),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.detail || `HTTP ${response.status}`
      );
    }

    toast({
      title: "Registration submitted",
      description:
        "Your team is awaiting Executive approval.",
    });

    onComplete();
  } catch (error: any) {
    toast({
      title: "Registration failed",
      description:
        error.message || "Please try again.",
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