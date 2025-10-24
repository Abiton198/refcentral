import React, { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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
    if (!user) return;
    setLoading(true);

    try {
      const finalNationality =
        nationality === "Other" ? otherNationality : nationality;
      const finalBank = bankName === "Other" ? otherBank : bankName;

      const finalData = {
        ...formData,
        nationality: finalNationality,
        bankName: finalBank,
        approved: false,
        status: "pending",
        role: "referee",
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || `${formData.firstName} ${formData.surname}`,
        createdAt: serverTimestamp(),
        lastEdited: serverTimestamp(),
      };

      // Save under both users & referees collections
      await setDoc(doc(db, "users", user.uid), finalData, { merge: true });
      await setDoc(doc(db, "referees", user.uid), finalData, { merge: true });

      toast({
        title: "✅ Registration Submitted",
        description: "Awaiting executive approval.",
      });
      onComplete();
    } catch (error) {
      console.error("Error submitting referee registration:", error);
      toast({
        title: "Error",
        description: "Failed to submit registration.",
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
