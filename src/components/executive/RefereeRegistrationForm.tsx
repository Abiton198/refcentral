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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // Save under both users & referees collection
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: "referee",
          ...formData,
          approved: false,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "referees", user.uid),
        {
          ...formData,
          uid: user.uid,
          email: user.email,
          role: "referee",
          approved: false,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast({ title: "Registration Submitted", description: "Awaiting executive approval." });
      onComplete();
    } catch (error) {
      console.error("Error submitting referee registration:", error);
      toast({ title: "Error", description: "Failed to submit registration.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto mt-8 p-6 border rounded-lg shadow space-y-4 bg-white"
    >
      <h3 className="text-2xl font-bold text-center text-gray-800 mb-4">
        🏉 EPRRS Referee Registration
      </h3>

      <h4 className="text-lg font-semibold text-emerald-700 mt-4">Personal Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input name="surname" placeholder="Surname" onChange={handleChange} className="input" required />
        <input name="firstName" placeholder="First Name(s)" onChange={handleChange} className="input" required />
        <input name="preferredName" placeholder="Preferred Name / Nickname" onChange={handleChange} className="input" />
        <select name="gender" onChange={handleChange} className="input" required>
          <option value="">Select Gender</option>
          <option>Male</option>
          <option>Female</option>
        </select>
        <input name="race" placeholder="Race / Ethnic Group" onChange={handleChange} className="input" />
        <input name="dob" type="date" placeholder="Date of Birth" onChange={handleChange} className="input" />
        <input name="idNumber" placeholder="ID / Passport Number" onChange={handleChange} className="input" />
        <input name="nationality" placeholder="Nationality" onChange={handleChange} className="input" />
        <input name="languages" placeholder="Language(s) Spoken" onChange={handleChange} className="input" />
      </div>

      <h4 className="text-lg font-semibold text-emerald-700 mt-6">Contact Details</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input name="residentialAddress" placeholder="Residential Address" onChange={handleChange} className="input" />
        <input name="postalAddress" placeholder="Postal Address" onChange={handleChange} className="input" />
        <input name="city" placeholder="City / Town" onChange={handleChange} className="input" />
        <input name="mobileNumber" placeholder="Mobile Number" onChange={handleChange} className="input" />
        <input name="altContact" placeholder="Alternative Contact Number" onChange={handleChange} className="input" />
        <input name="email" placeholder="Email Address" defaultValue={user?.email} className="input" readOnly />
      </div>

      <h4 className="text-lg font-semibold text-emerald-700 mt-6">Kit & Uniform Details</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input name="shortSize" placeholder="Short Size" onChange={handleChange} className="input" />
        <input name="golfShirtSize" placeholder="Golf Shirt Size" onChange={handleChange} className="input" />
        <input name="tshirtSize" placeholder="T-Shirt Size" onChange={handleChange} className="input" />
        <input name="tracksuitTopSize" placeholder="Tracksuit Top Size" onChange={handleChange} className="input" />
        <input name="tracksuitBottomSize" placeholder="Tracksuit Bottom Size" onChange={handleChange} className="input" />
        <input name="refJerseySize" placeholder="Referee Jersey Size" onChange={handleChange} className="input" />
        <input name="jacketSize" placeholder="Jacket Size" onChange={handleChange} className="input" />
        <select name="preferredFit" onChange={handleChange} className="input">
          <option value="">Preferred Fit</option>
          <option>Slim</option>
          <option>Regular</option>
          <option>Loose</option>
        </select>
      </div>

      <h4 className="text-lg font-semibold text-emerald-700 mt-6">Banking Details (for Match Fees)</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input name="bankName" placeholder="Bank Name" onChange={handleChange} className="input" />
        <input name="accountHolder" placeholder="Account Holder Name" onChange={handleChange} className="input" />
        <input name="accountNumber" placeholder="Account Number" onChange={handleChange} className="input" />
        <input name="branchCode" placeholder="Branch Code" onChange={handleChange} className="input" />
        <select name="accountType" onChange={handleChange} className="input">
          <option value="">Account Type</option>
          <option>Cheque</option>
          <option>Savings</option>
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
