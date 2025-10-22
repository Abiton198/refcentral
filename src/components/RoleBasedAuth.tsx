import React, { useState, useEffect } from "react";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { RoleSelector } from "./RoleSelector";
import { UserRole } from "../types";
import { useNavigate } from "react-router-dom";

export const RoleBasedAuth: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const navigate = useNavigate();

  // 🔄 Auth listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (!data.approved) {
            setStatusMessage("✅ Registration received. Waiting for executive approval...");
          } else {
            navigate(`/dashboard/${data.role}`);
          }
        }
      } else {
        setUser(null);
      }
    });
    return () => unsub();
  }, [navigate]);

  // 🟢 Google Sign-In
  const handleGoogleAuth = async () => {
    if (!role) return alert("Please select a role first.");

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role,
          approved: role === "executive",
          createdAt: serverTimestamp(),
        });
        setIsNewUser(true);
        setStatusMessage(`Complete your ${role} registration below.`);
      } else {
        const data = userSnap.data();
        if (!data.approved) {
          setStatusMessage("✅ Waiting for executive approval...");
        } else {
          navigate(`/dashboard/${data.role}`);
        }
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("Authentication failed. Please try again.");
    }
  };

  // 📝 Registration submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !role) return;

    try {
      const collectionName =
        role === "referee" ? "referees" : role === "coach" ? "coaches" : "executives";

      // 1️⃣ Create user base doc first
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,
          role,
          ...formData,
          approved: role === "executive",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2️⃣ Role-specific collection
      await setDoc(
        doc(db, collectionName, user.uid),
        {
          ...formData,
          uid: user.uid,
          email: user.email,
          role,
          approved: role === "executive",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (role === "executive") {
        navigate("/dashboard/executive");
      } else {
        setStatusMessage("✅ Registration submitted! Awaiting approval.");
        setIsNewUser(false);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("Error saving registration. Try again.");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    setRole(null);
    setIsNewUser(false);
    setStatusMessage("");
  };

  const renderFormFields = () => {
    switch (role) {
      case "referee":
        return (
          <>
            <input className="input" placeholder="Name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            <input className="input" placeholder="Surname" onChange={(e) => setFormData({ ...formData, surname: e.target.value })} required />
            <input className="input" type="number" placeholder="Age" onChange={(e) => setFormData({ ...formData, age: e.target.value })} required />
            <input className="input" placeholder="Area of Residence" onChange={(e) => setFormData({ ...formData, area: e.target.value })} required />
            <input className="input" placeholder="Year Joined Society" onChange={(e) => setFormData({ ...formData, yearJoined: e.target.value })} required />
            <select className="input" onChange={(e) => setFormData({ ...formData, gender: e.target.value })} required>
              <option value="">Select Gender</option>
              <option>Male</option><option>Female</option>
            </select>
            <input className="input" placeholder="Contact Number" onChange={(e) => setFormData({ ...formData, contact: e.target.value })} required />
          </>
        );
      case "coach":
        return (
          <>
            <input className="input" placeholder="Name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            <input className="input" placeholder="Surname" onChange={(e) => setFormData({ ...formData, surname: e.target.value })} required />
            <input className="input" placeholder="Club" onChange={(e) => setFormData({ ...formData, club: e.target.value })} required />
            <input className="input" placeholder="Contact Details" onChange={(e) => setFormData({ ...formData, contact: e.target.value })} required />
            <input className="input" placeholder="Role in Club" onChange={(e) => setFormData({ ...formData, clubRole: e.target.value })} required />
          </>
        );
      case "executive":
        return (
          <>
            <input className="input" placeholder="Name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            <input className="input" placeholder="Surname" onChange={(e) => setFormData({ ...formData, surname: e.target.value })} required />
            <input className="input" placeholder="Position" onChange={(e) => setFormData({ ...formData, position: e.target.value })} required />
            <input className="input" placeholder="Contact Number" onChange={(e) => setFormData({ ...formData, contact: e.target.value })} required />
            <select className="input" onChange={(e) => setFormData({ ...formData, gender: e.target.value })} required>
              <option value="">Select Gender</option>
              <option>Male</option><option>Female</option>
            </select>
          </>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      {!role && <RoleSelector onSelectRole={setRole} />}

      {role && !isNewUser && (
        <div className="text-center mt-10">
          <h2 className="text-2xl font-semibold mb-4">
            Sign in or register as <span className="text-emerald-600 capitalize">{role}</span>
          </h2>
          <button onClick={handleGoogleAuth} className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700">
            Continue with Google
          </button>

          {statusMessage && <p className="mt-4 text-sm text-gray-700">{statusMessage}</p>}
          <button onClick={handleSignOut} className="block mx-auto mt-6 text-gray-500 underline">
            Sign Out
          </button>
        </div>
      )}

      {isNewUser && (
        <form onSubmit={handleFormSubmit} className="max-w-lg mx-auto mt-8 p-6 border rounded-lg shadow-sm space-y-3">
          <h3 className="text-xl font-semibold mb-4 text-center capitalize">{role} Registration</h3>
          {renderFormFields()}
          <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700">
            Submit Registration
          </button>
          {statusMessage && <p className="mt-3 text-sm text-gray-700">{statusMessage}</p>}
        </form>
      )}
    </div>
  );
};
