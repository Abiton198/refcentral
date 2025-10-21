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

  // ✅ Auth Listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (!data.approved) {
            setStatusMessage("Your account is pending executive approval.");
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

  // ✅ Google Sign-In
  const handleGoogleAuth = async () => {
    if (!role) {
      alert("Please select a role first.");
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // 🆕 New user — create basic profile
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role,
          approved: role === "executive", // only executives auto-approved
          createdAt: serverTimestamp(),
        });

        // ✅ Show role-specific registration form
        if (role === "referee" || role === "coach" || role === "executive") {
          setIsNewUser(true);
          setStatusMessage(`Complete your ${role} registration below.`);
        }
      } else {
        const data = userSnap.data();
        if (!data.approved) {
          setStatusMessage("Your account is pending executive approval.");
        } else {
          navigate(`/dashboard/${data.role}`);
        }
      }
    } catch (error) {
      console.error(error);
      setStatusMessage("Authentication failed. Please try again.");
    }
  };

  // ✅ Registration Form Submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !role) return;

    try {
      const collectionName =
        role === "referee"
          ? "referees"
          : role === "coach"
          ? "coaches"
          : "executives";

      await setDoc(doc(db, collectionName, user.uid), {
        ...formData,
        uid: user.uid,
        email: user.email,
        role,
        approved: role === "executive" ? true : false,
        createdAt: serverTimestamp(),
      });

      // ✅ Update global user document with details
      await setDoc(
        doc(db, "users", user.uid),
        {
          ...formData,
          approved: role === "executive" ? true : false,
        },
        { merge: true }
      );

      if (role === "executive") {
        navigate("/dashboard/executive"); // 🚀 immediate redirect
      } else {
        setStatusMessage(
          `Registration submitted! Please wait for executive approval before accessing the dashboard.`
        );
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

  // ✅ Role-based registration fields
  const renderFormFields = () => {
    if (role === "referee") {
      return (
        <>
          <input placeholder="Name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" required />
          <input placeholder="Surname" onChange={(e) => setFormData({ ...formData, surname: e.target.value })} className="input" required />
          <input placeholder="Age" type="number" onChange={(e) => setFormData({ ...formData, age: e.target.value })} className="input" required />
          <input placeholder="Area of Residence" onChange={(e) => setFormData({ ...formData, area: e.target.value })} className="input" required />
          <input placeholder="Year Joined Society" onChange={(e) => setFormData({ ...formData, yearJoined: e.target.value })} className="input" required />
          <select onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className="input" required>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <input placeholder="Contact Number" onChange={(e) => setFormData({ ...formData, contact: e.target.value })} className="input" required />
        </>
      );
    }

    if (role === "coach") {
      return (
        <>
          <input placeholder="Name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" required />
          <input placeholder="Surname" onChange={(e) => setFormData({ ...formData, surname: e.target.value })} className="input" required />
          <input placeholder="Club" onChange={(e) => setFormData({ ...formData, club: e.target.value })} className="input" required />
          <input placeholder="Contact Details" onChange={(e) => setFormData({ ...formData, contact: e.target.value })} className="input" required />
          <input placeholder="Role in Club" onChange={(e) => setFormData({ ...formData, clubRole: e.target.value })} className="input" required />
        </>
      );
    }

    if (role === "executive") {
      return (
        <>
          <input placeholder="Name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" required />
          <input placeholder="Surname" onChange={(e) => setFormData({ ...formData, surname: e.target.value })} className="input" required />
          <input placeholder="Position" onChange={(e) => setFormData({ ...formData, position: e.target.value })} className="input" required />
          <input placeholder="Contact Number" onChange={(e) => setFormData({ ...formData, contact: e.target.value })} className="input" required />
          <select onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className="input" required>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </>
      );
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      {!role && <RoleSelector onSelectRole={setRole} />}

      {role && !isNewUser && (
        <div className="text-center mt-10">
          <h2 className="text-2xl font-semibold mb-4">
            Sign in or register as{" "}
            <span className="text-emerald-600 capitalize">{role}</span>
          </h2>
          <button
            onClick={handleGoogleAuth}
            className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition"
          >
            Continue with Google
          </button>

          {statusMessage && (
            <p className="mt-4 text-sm text-gray-700">{statusMessage}</p>
          )}

          <button
            onClick={handleSignOut}
            className="block mx-auto mt-6 text-gray-500 underline"
          >
            Sign Out
          </button>
        </div>
      )}

      {isNewUser && (
        <form
          onSubmit={handleFormSubmit}
          className="max-w-lg mx-auto mt-8 p-6 border rounded-lg shadow-sm space-y-3"
        >
          <h3 className="text-xl font-semibold mb-4 text-center capitalize">
            {role} Registration
          </h3>

          {renderFormFields()}

          <button
            type="submit"
            className="w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700"
          >
            Submit Registration
          </button>

          {statusMessage && (
            <p className="mt-3 text-sm text-gray-700">{statusMessage}</p>
          )}
        </form>
      )}
    </div>
  );
};
