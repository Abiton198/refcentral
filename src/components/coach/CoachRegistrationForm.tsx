import React, { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "@/components/ui/use-toast";

interface CoachRegistrationFormProps {
  user: any;
  onComplete: () => void;
}

export const CoachRegistrationForm: React.FC<CoachRegistrationFormProps> = ({
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
        approved: false,           // Requires executive approval
        status: "pending",         // Pending review
        role: "coach",
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || `${formData.firstName} ${formData.surname}`,
        createdAt: serverTimestamp(),
        lastEdited: serverTimestamp(),
      };

      // Save in both users and coaches collections
      await setDoc(doc(db, "users", user.uid), finalData, { merge: true });
      await setDoc(doc(db, "coaches", user.uid), finalData, { merge: true });

      toast({
        title: "Registration Submitted",
        description: "Your profile is pending executive approval. You'll get access once approved.",
      });
      onComplete();
    } catch (error: any) {
      console.error("Coach registration error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit registration.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
    "Other",
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto mt-8 p-6 border rounded-lg shadow-lg space-y-6 bg-white"
    >
      <h3 className="text-2xl font-bold text-center text-emerald-700 mb-6">
        Coach Registration
      </h3>

      {/* PERSONAL INFORMATION */}
      <section>
        <h4 className="text-lg font-semibold text-emerald-600 mb-3">
          Personal Information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="surname"
            placeholder="Surname"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            required
          />
          <input
            name="firstName"
            placeholder="First Name(s)"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            required
          />
          <input
            name="preferredName"
            placeholder="Preferred Name / Nickname"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <select
            name="gender"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            required
          >
            <option value="">Select Gender</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>

          {/* Nationality */}
          <div>
            <select
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option>South African</option>
              <option>Other</option>
            </select>
            {nationality === "Other" && (
              <input
                placeholder="Specify Nationality"
                value={otherNationality}
                onChange={(e) => setOtherNationality(e.target.value)}
                className="w-full mt-2 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            )}
          </div>

          <input
            name="dob"
            type="date"
            placeholder="Date of Birth"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            required
          />
          <input
            name="idNumber"
            placeholder="ID / Passport Number"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            required
          />
          <input
            name="languages"
            placeholder="Languages Spoken"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </section>

      {/* CONTACT DETAILS */}
      <section>
        <h4 className="text-lg font-semibold text-emerald-600 mb-3">
          Contact Details
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="mobileNumber"
            placeholder="Mobile Number"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            required
          />
          <input
            name="altContact"
            placeholder="Alternative Contact"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <input
            name="email"
            placeholder="Email Address"
            defaultValue={user?.email}
            className="w-full px-4 py-2 border rounded-lg bg-gray-50"
            readOnly
          />
          <input
            name="residentialAddress"
            placeholder="Residential Address"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <input
            name="city"
            placeholder="City / Town"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </section>

      {/* BANK DETAILS */}
      <section>
        <h4 className="text-lg font-semibold text-emerald-600 mb-3">
          Bank Details (for Payments)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            >
              <option value="">Select Bank</option>
              {banks.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            {bankName === "Other" && (
              <input
                placeholder="Enter Bank Name"
                value={otherBank}
                onChange={(e) => setOtherBank(e.target.value)}
                className="w-full mt-2 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                required
              />
            )}
          </div>

          <input
            name="accountHolder"
            placeholder="Account Holder Name"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            required
          />
          <input
            name="accountNumber"
            placeholder="Account Number"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            required
          />
          <input
            name="branchCode"
            placeholder="Branch Code"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <select
            name="accountType"
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">Account Type</option>
            <option>Current</option>
            <option>Savings</option>
            <option>Transmission</option>
          </select>
        </div>
      </section>

      {/* SUBMIT */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? "Submitting..." : "Submit for Approval"}
      </button>

      <p className="text-center text-sm text-gray-600 mt-4">
        Your registration will be reviewed by the executive team. You'll receive access once approved.
      </p>
    </form>
  );
};