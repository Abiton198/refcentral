import React, { useState, useEffect } from "react";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { RefereeRegistrationForm } from "./executive/RefereeRegistrationForm";
import { UserRole } from "../types";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

export const RoleBasedAuth: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [action, setAction] = useState<"register" | "login" | null>(null);
  const [executiveRole, setExecutiveRole] = useState<string>("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [redirecting, setRedirecting] = useState(false);
  const navigate = useNavigate();

  // 🧭 Detect role and action from URL
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const roleParam = queryParams.get("role") as UserRole | null;
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
    if (!role || !action)
      return alert("Please select a role and choose Register or Sign in.");

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const signedUser = result.user;
      setUser(signedUser);

      const userRef = doc(db, "users", signedUser.uid);
      const userSnap = await getDoc(userRef);

      if (action === "login") {
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

      // Registration flow
      if (!userSnap.exists()) {
        setIsNewUser(true);
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

  // 📝 Form Submission (safe for Firestore)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !role) return;

    try {
      // 🧠 Ensure executive position uniqueness
      if (role === "executive" && executiveRole !== "Committee Member") {
        const q = query(
          collection(db, "executives"),
          where("position", "==", executiveRole)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setToast({
            type: "error",
            message: `❌ The position "${executiveRole}" is already registered.`,
          });
          return;
        }
      }

      const roleCollection =
        role === "referee"
          ? "referees"
          : role === "coach"
          ? "coaches"
          : "executives";

      const isExecutive = role === "executive";
      const baseData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role,
        createdAt: serverTimestamp(),
        ...formData,
        approved: isExecutive,
      };

      const position = isExecutive
        ? executiveRole || formData.position || ""
        : formData.position || "";

      const finalData = { ...baseData, position };

      // ✅ Step 1: Create user profile first
      await setDoc(doc(db, "users", user.uid), finalData, { merge: true });
      console.log("✅ User profile created");

      // ✅ Step 2: Create role-specific record
      await setDoc(doc(db, roleCollection, user.uid), finalData, { merge: true });
      console.log("✅ Role record created");

      const successMsg = isExecutive
        ? "✅ Executive registration successful! Redirecting..."
        : "✅ Registration submitted! Awaiting approval.";

      setToast({ type: "success", message: successMsg });
      setStatusMessage(successMsg);
      setIsNewUser(false);

      if (isExecutive) {
        setRedirecting(true);
        setTimeout(() => navigate("/dashboard/executive"), 1800);
      }
    } catch (err: any) {
      console.error("🔥 Firestore write error:", err);
      setToast({
        type: "error",
        message: `❌ ${err.message || "Permission error."}`,
      });
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
    setExecutiveRole("");
  };

  // 🧾 Render Registration Form
  const renderFormFields = () => {
    if (role === "referee") {
      return (
        <RefereeRegistrationForm
          user={user}
          onComplete={() => {
            setIsNewUser(false);
            setToast({
              type: "success",
              message: "✅ Referee registration submitted successfully!",
            });
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

        {/* 👑 Executive Dropdown */}
        {role === "executive" && (
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1 text-gray-700">
              Executive Role
            </label>
            <select
              required
              className="input border rounded-md p-2"
              value={executiveRole}
              onChange={(e) => setExecutiveRole(e.target.value)}
            >
              <option value="">Select Role</option>
              <option value="Chairman">Chairman</option>
              <option value="Referee Manager">Referee Manager</option>
              <option value="Appointing Officer">Appointing Officer</option>
              <option value="Treasurer">Treasurer</option>
              <option value="Vice-Chairman">Vice-Chairman</option>
              <option value="Committee Member">Committee Member</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Each executive post can only be registered once except Committee Member.
            </p>
          </div>
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

  // 🌟 Toast Auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 🎬 Render UI
  return (
    <motion.div
      className="max-w-5xl mx-auto py-12 px-4 text-center relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: redirecting ? 0 : 1 }}
      transition={{ duration: 1 }}
    >
      {/* 🪄 Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 px-5 py-3 rounded-lg shadow-lg text-white z-50 ${
              toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main UI */}
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
            {statusMessage && (
              <p className="mt-4 text-sm text-gray-700">{statusMessage}</p>
            )}
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
    </motion.div>
  );
};
