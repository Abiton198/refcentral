import React, { useState, useEffect } from "react";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { RefereeRegistrationForm } from "./executive/RefereeRegistrationForm";
import { UserRole } from "../types";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export const RoleBasedAuth: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [action, setAction] = useState<"register" | "login" | null>(null);
  const navigate = useNavigate();

  // 🧭 Detect role and action from URL
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const roleParam = query.get("role") as UserRole | null;
    const path = window.location.pathname;
    const actionParam = path.includes("register")
      ? "register"
      : path.includes("login")
      ? "login"
      : null;

    if (roleParam) setRole(roleParam);
    if (actionParam) setAction(actionParam);
  }, []);

  // 🔄 Auth listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setIsNewUser(false);
        return;
      }

      setUser(currentUser);

      // Only check for approval if not registering a new user
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.approved) {
          navigate(`/dashboard/${data.role}`);
        } else {
          setStatusMessage("✅ Registration received. Waiting for executive approval...");
        }
      }
    });
    return () => unsub();
  }, [navigate]);

  // 🟢 Google Auth
  const handleGoogleAuth = async () => {
    if (!role || !action) return alert("Please select a role and choose Register or Sign in.");

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const signedUser = result.user;
      setUser(signedUser);

      const userRef = doc(db, "users", signedUser.uid);
      const userSnap = await getDoc(userRef);

      if (action === "login") {
        // Login flow
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.approved) navigate(`/dashboard/${data.role}`);
          else setStatusMessage("✅ Waiting for executive approval...");
        } else {
          alert("No registration found. Please register first.");
          await signOut(auth);
        }
        return;
      }

      // Registration flow → show form first
      if (!userSnap.exists()) {
        setIsNewUser(true); // show form
        setStatusMessage(`Complete your ${role} registration below.`);
      } else {
        const data = userSnap.data();
        if (!data.approved)
          setStatusMessage("✅ Registration received. Waiting for executive approval...");
        else navigate(`/dashboard/${data.role}`);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("Authentication failed. Please try again.");
    }
  };

  // 📝 Form Submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !role) return;

    try {
      const roleCollection =
        role === "referee" ? "referees" : role === "coach" ? "coaches" : "executives";

      // Save in users collection
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role,
          ...formData,
          approved: role === "executive", // auto approve executives
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Save in specific role collection
      await setDoc(
        doc(db, roleCollection, user.uid),
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

      setStatusMessage("✅ Registration submitted! Awaiting approval.");
      setIsNewUser(false);

      if (role === "executive") navigate("/dashboard/executive");
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Error submitting registration. Try again.");
    }
  };

  // 🔙 Sign Out
  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    setIsNewUser(false);
    setStatusMessage("");
    setAction(null);
    setRole(null);
  };

  // 🧾 Render Form
  const renderFormFields = () => {
    if (role === "referee") {
      return (
        <RefereeRegistrationForm
          user={user}
          onComplete={() => {
            setIsNewUser(false);
            setStatusMessage("✅ Registration submitted! Awaiting approval.");
          }}
        />
      );
    }

    return (
      <form
        onSubmit={handleFormSubmit}
        className="max-w-lg mx-auto mt-8 p-6 border rounded-lg shadow-sm space-y-3 bg-white"
      >
        <h3 className="text-xl font-semibold mb-4 text-center capitalize">
          {role} Registration
        </h3>
        <input
          className="input"
          placeholder="Name"
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Surname"
          onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Contact"
          onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
          required
        />
        {role === "executive" && (
          <input
            className="input"
            placeholder="Position"
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            required
          />
        )}
        {role === "coach" && (
          <input
            className="input"
            placeholder="Club"
            onChange={(e) => setFormData({ ...formData, club: e.target.value })}
            required
          />
        )}
        <button
          type="submit"
          className="w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700"
        >
          Submit Registration
        </button>
      </form>
    );
  };

  // 🏠 Back Button
  const BackHomeButton = () => (
    <button
      onClick={() => navigate("/")}
      className="mt-8 text-gray-500 underline hover:text-emerald-600 transition"
    >
      ← Back to Home
    </button>
  );

  // 🧩 Main UI
  return (
    <div className="max-w-5xl mx-auto py-12 px-4 text-center">
      {!role && !user && (
        <>
          <h2 className="text-3xl font-bold mb-8 text-gray-900">Select Your Role</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { role: "executive", icon: "⚖️", desc: "Manage appointments, oversee operations" },
              { role: "referee", icon: "🎽", desc: "View assignments, submit reports" },
              { role: "coach", icon: "📋", desc: "Submit match reports and feedback" },
            ].map((r) => (
              <motion.div key={r.role} whileHover={{ scale: 1.03 }}>
                <Card
                  onClick={() => setRole(r.role as UserRole)}
                  className="cursor-pointer p-6 border-2 rounded-xl hover:border-emerald-400 transition"
                >
                  <div className="text-6xl mb-4">{r.icon}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 capitalize">
                    {r.role}
                  </h3>
                  <p className="text-gray-600">{r.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
          <BackHomeButton />
        </>
      )}

      {role && !action && !user && (
        <>
          <div className="flex flex-col md:flex-row justify-center gap-4 mt-8">
            <Button
              onClick={() => setAction("register")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg"
            >
              📝 Register as {role}
            </Button>
            <Button
              onClick={() => setAction("login")}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-lg"
            >
              🔑 Sign in as {role}
            </Button>
          </div>
          <BackHomeButton />
        </>
      )}

      {action && !user && (
        <>
          <div className="mt-10">
            <h3 className="text-xl font-semibold mb-4">
              {action === "register" ? "Register" : "Sign in"} as{" "}
              <span className="text-emerald-600 capitalize">{role}</span>
            </h3>
            <button
              onClick={handleGoogleAuth}
              className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700"
            >
              Continue with Google
            </button>
            {statusMessage && <p className="mt-4 text-sm text-gray-700">{statusMessage}</p>}
          </div>
          <BackHomeButton />
        </>
      )}

      {user && isNewUser && renderFormFields()}

      {user && !isNewUser && (
        <div className="text-center mt-6">
          <p className="text-gray-600 mb-2">{statusMessage}</p>
          <button onClick={handleSignOut} className="text-gray-500 underline">
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};
