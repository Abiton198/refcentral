import React, { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { toast } from "@/components/ui/use-toast";

interface RefereeRegistrationFormProps {
  user: any;
  onComplete: () => void;
}

export const RefereeRegistrationForm: React.FC<RefereeRegistrationFormProps> = ({
  user,
  onComplete,
}) => {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [nationality, setNationality] = useState("South African");
  const [otherNationality, setOtherNationality] = useState("");
  const [bankName, setBankName] = useState("");
  const [otherBank, setOtherBank] = useState("");

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
      const userRef = doc(db, "users", user.uid);
      const refereeRef = doc(db, "referees", user.uid);

      const [userSnap, refereeSnap] = await Promise.all([
        getDoc(userRef),
        getDoc(refereeRef),
      ]);

      const pick = (d: any) =>
        d ? { role: d.role, approved: d.approved, status: d.status } : null;
      existing = {
        users: pick(userSnap.exists() ? userSnap.data() : null),
        referees: pick(refereeSnap.exists() ? refereeSnap.data() : null),
      };

      // Roles can only be set once. Don't touch another role's account.
      const existingRole = userSnap.exists() ? userSnap.data().role : null;
      if (existingRole && existingRole !== "referee") {
        toast({
          title: "Account already registered",
          description: `This Google account is already registered as ${existingRole}. Use a different account.`,
          variant: "destructive",
        });
        return;
      }

      const finalNationality =
        nationality === "Other" ? otherNationality : nationality;
      const finalBank = bankName === "Other" ? otherBank : bankName;

      // Profile fields: safe to write on create or update.
      // Firestore rejects undefined values, so drop them.
      const profile = Object.fromEntries(
        Object.entries({
          ...formData,
          nationality: finalNationality,
          bankName: finalBank,
          email: user.email,
          displayName:
            user.displayName || `${formData.firstName} ${formData.surname}`,
          lastEdited: serverTimestamp(),
        }).filter(([, v]) => v !== undefined)
      );

      // Protected fields: sent only when a doc is first created, because the
      // security rules block changing them afterwards.
      const protectedFields = {
        uid: user.uid,
        role: "referee",
        approved: false,
        status: "pending",
        createdAt: serverTimestamp(),
      };

      const usersPayload = !userSnap.exists()
        ? { ...profile, ...protectedFields }
        : existingRole
          ? profile // already has a role: profile fields only
          : { ...profile, role: "referee" }; // legacy doc with no role yet

      const refereesPayload = refereeSnap.exists()
        ? profile
        : { ...profile, ...protectedFields };

      // One atomic commit: either both documents are saved or neither is.
      const batch = writeBatch(db);
      batch.set(userRef, usersPayload, { merge: true });
      batch.set(refereeRef, refereesPayload, { merge: true });
      await batch.commit();

      toast({
        title: "✅ Registration Submitted",
        description: "Awaiting executive approval.",
      });
      onComplete();
    } catch (error: any) {
      console.error(
        "Referee registration failed:",
        error?.code,
        error?.message,
        "Existing docs (role/approved/status):",
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

  // Common options
  const sizeOptions = ["Small", "Medium", "Large", "X-Large"];
  const banks = [
    "ABSA",
    "Capitec",
    "FNB",
    "Nedbank",
    "Standard Bank",
    "TymeBank",
    "African Bank",
    "Investec",
    "Bidvest Bank",
    "Bidvest Alliance Bank",
    "Other",
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto mt-8 p-6 border rounded-lg shadow space-y-4 bg-white"
    >
      <h3 className="text-2xl font-bold text-center text-gray-800 mb-4">
        🏉 EPRRS Referee Registration
      </h3>

      {/* PERSONAL INFORMATION */}
      <h4 className="text-lg font-semibold text-emerald-700 mt-4">
        Personal Information
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          name="surname"
          placeholder="Surname"
          onChange={handleChange}
          className="input"
          required
        />
        <input
          name="firstName"
          placeholder="First Name(s)"
          onChange={handleChange}
          className="input"
          required
        />
        <input
          name="preferredName"
          placeholder="Preferred Name / Nickname"
          onChange={handleChange}
          className="input"
        />
        <select name="gender" onChange={handleChange} className="input" required>
          <option value="">Select Gender</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
        </select>
        <input
          name="race"
          placeholder="Race / Ethnic Group"
          onChange={handleChange}
          className="input"
        />
        <input
          name="dob"
          type="date"
          placeholder="Date of Birth"
          onChange={handleChange}
          className="input"
        />
        <input
          name="idNumber"
          placeholder="ID / Passport Number"
          onChange={handleChange}
          className="input"
        />

        {/* Nationality dropdown + conditional input */}
        <div>
          <select
            name="nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            className="input"
          >
            <option>South African</option>
            <option>Other</option>
          </select>
          {nationality === "Other" && (
            <input
              name="otherNationality"
              placeholder="Please specify nationality"
              value={otherNationality}
              onChange={(e) => setOtherNationality(e.target.value)}
              className="input mt-2"
              required
            />
          )}
        </div>

        <input
          name="languages"
          placeholder="Language(s) Spoken"
          onChange={handleChange}
          className="input"
        />

        {/* BokSmart Section */}
        <input
          name="boksmartNumber"
          placeholder="BokSmart Number"
          onChange={handleChange}
          className="input"
          required
        />
        <input
          name="boksmartExpiry"
          type="date"
          placeholder="BokSmart Expiry Date"
          onChange={handleChange}
          className="input"
          required
        />
      </div>

      {/* CONTACT DETAILS */}
      <h4 className="text-lg font-semibold text-emerald-700 mt-6">
        Contact Details
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          name="residentialAddress"
          placeholder="Residential Address"
          onChange={handleChange}
          className="input"
        />
        <input
          name="postalAddress"
          placeholder="Postal Address"
          onChange={handleChange}
          className="input"
        />
        <input
          name="city"
          placeholder="City / Town"
          onChange={handleChange}
          className="input"
        />
        <input
          name="mobileNumber"
          placeholder="Mobile Number"
          onChange={handleChange}
          className="input"
        />
        <input
          name="altContact"
          placeholder="Alternative Contact Number"
          onChange={handleChange}
          className="input"
        />
        <input
          name="email"
          placeholder="Email Address"
          defaultValue={user?.email}
          className="input"
          readOnly
        />
      </div>

      {/* QUALIFICATION DETAILS */}
      <h4 className="text-lg font-semibold text-emerald-700 mt-6">
        Qualification Details
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          name="yearJoined"
          placeholder="Year Joined"
          onChange={handleChange}
          className="input"
          required
        />
        <input
          name="licenseNumber"
          placeholder="Referee License Number"
          onChange={handleChange}
          className="input"
        />
        <select
          name="experienceLevel"
          onChange={handleChange}
          className="input"
        >
          <option value="">Experience Level</option>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>
      </div>

      {/* KIT & UNIFORM */}
      <h4 className="text-lg font-semibold text-emerald-700 mt-6">
        Kit & Uniform Details
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          "shortSize",
          "golfShirtSize",
          "tshirtSize",
          "tracksuitTopSize",
          "tracksuitBottomSize",
          "refJerseySize",
          "jacketSize",
        ].map((field) => (
          <select
            key={field}
            name={field}
            onChange={handleChange}
            className="input"
          >
            <option value="">{field.replace(/([A-Z])/g, " $1")}</option>
            {sizeOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        ))}
        <select name="preferredFit" onChange={handleChange} className="input">
          <option value="">Preferred Fit</option>
          <option>Slim</option>
          <option>Regular</option>
          <option>Loose</option>
        </select>
      </div>

      {/* BANKING DETAILS */}
      <h4 className="text-lg font-semibold text-emerald-700 mt-6">
        Banking Details (for Match Fees)
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <select
            name="bankName"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="input"
            required
          >
            <option value="">Select Bank</option>
            {banks.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          {bankName === "Other" && (
            <input
              name="otherBank"
              placeholder="Enter Bank Name"
              value={otherBank}
              onChange={(e) => setOtherBank(e.target.value)}
              className="input mt-2"
              required
            />
          )}
        </div>

        <input
          name="accountHolder"
          placeholder="Account Holder Name"
          onChange={handleChange}
          className="input"
          required
        />
        <input
          name="accountNumber"
          placeholder="Account Number"
          onChange={handleChange}
          className="input"
          required
        />
        <input
          name="branchCode"
          placeholder="Branch Code"
          onChange={handleChange}
          className="input"
        />
        <select name="accountType" onChange={handleChange} className="input">
          <option value="">Account Type</option>
          <option>Current</option>
          <option>Savings</option>
          <option>Transmission</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700"
      >
        {loading ? "Submitting..." : "Submit Registration"}
      </button>
    </form>
  );
};