// src/components/auth/RoleBasedAuth.tsx
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
import { CoachRegistrationForm } from "./coach/CoachRegistrationForm";
import { UserRole } from "../types";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import sha256 from "crypto-js/sha256";

/* -------------------------------------------------
   SVG ICONS – Inline so they never fail to load
   ------------------------------------------------- */
const IconBalance = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-16 h-16 mx-auto text-emerald-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
    />
  </svg>
);

const IconJersey = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-16 h-16 mx-auto text-emerald-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M18 8h1a4 4 0 010 8h-1M5 8h14M5 8a4 4 0 110 8H5a4 4 0 010-8zm14 0a4 4 0 110 8h-1a4 4 0 010-8h1zM5 16h14M5 16v4a2 2 0 002 2h10a2 2 0 002-2v-4M5 16l2-8m12 8l-2-8"
    />
  </svg>
);

const IconClipboard = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-16 h-16 mx-auto text-emerald-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

/* -------------------------------------------------
   MAIN COMPONENT
   ------------------------------------------------- */
export const RoleBasedAuth: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [action, setAction] = useState<"register" | "login" | null>(null);
  const [executiveRole, setExecutiveRole] = useState<string>("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const navigate = useNavigate();

  // Detect role & action from URL
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

  // Back to Home – always visible
  const BackHomeButton = () => (
    <button
      onClick={() => navigate("/")}
      className="block mx-auto mt-6 text-sm text-gray-500 underline hover:text-emerald-600 transition"
    >
      ← Back to Home
    </button>
  );

  // Auth listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setIsNewUser(false);
        return;
      }

      setUser(currentUser);
      const userRef = doc(db, "users", currentUser.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data();
        if (data.approved === true) {
          navigate(`/dashboard/${data.role}`);
        } else {
          setStatusMessage("Registration received. Waiting for executive approval...");
        }
      }
    });
    return () => unsub();
  }, [navigate]);

  // Google Sign-In
  const handleGoogleAuth = async () => {
    if (!role || !action) {
      alert("Please select a role and choose Register or Sign in.");
      return;
    }

    try {
      await signOut(auth);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const result = await signInWithPopup(auth, provider);
      const signedUser = result.user;
      setUser(signedUser);

      const userRef = doc(db, "users", signedUser.uid);
      const snap = await getDoc(userRef);

      if (action === "login") {
        if (snap.exists()) {
          const data = snap.data();
          if (data.approved === true) navigate(`/dashboard/${data.role}`);
          else setStatusMessage("Waiting for executive approval...");
        } else {
          alert("No registration found. Please register first.");
          await signOut(auth);
        }
        return;
      }

      if (action === "register") {
        if (!snap.exists()) {
          setIsNewUser(true);
          setStatusMessage(`Complete your ${role} registration below.`);
        } else {
          const data = snap.data();
          if (!data.approved) {
            setStatusMessage("Registration received. Waiting for executive approval...");
          } else {
            navigate(`/dashboard/${data.role}`);
          }
        }
      }
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setToast({ type: "error", message: err.message || "Authentication failed." });
    }
  };

  // Form submission (executive only)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !role) return;

    try {
      const emailHash = sha256(user.email.toLowerCase().trim()).toString();
      const emailRef = doc(db, "emails", emailHash);
      const emailSnap = await getDoc(emailRef);
      if (emailSnap.exists()) {
        setToast({ type: "error", message: "This email is already registered." });
        await signOut(auth);
        return;
      }

      await setDoc(emailRef, { uid: user.uid, createdAt: serverTimestamp() });

      const roleCollection =
        role === "referee" ? "referees" :
        role === "coach" ? "coaches" :
        "executives";

      const isExecutive = role === "executive";
      const approved = isExecutive ? true : false;

      const baseData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role,
        approved,
        status: approved ? "active" : "pending",
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", user.uid), baseData, { merge: true });
      await setDoc(doc(db, roleCollection, user.uid), baseData, { merge: true });

      const msg = isExecutive
        ? "Executive registered! Redirecting..."
        : "Registration submitted! Awaiting approval.";

      setToast({ type: "success", message: msg });
      setStatusMessage(msg);
      setIsNewUser(false);

      if (isExecutive) {
        setRedirecting(true);
        setTimeout(() => navigate("/dashboard/executive"), 1800);
      }
    } catch (err: any) {
      console.error("Firestore error:", err);
      setToast({ type: "error", message: err.message || "Submission failed." });
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    setIsNewUser(false);
    setStatusMessage("");
    setAction(null);
    setRole(null);
    setExecutiveRole("");
  };

  // Render registration form
  const renderFormFields = () => {
    if (role === "referee") {
      return (
        <div className="max-w-2xl mx-auto">
          <RefereeRegistrationForm
            user={user}
            onComplete={() => {
              setIsNewUser(false);
              setToast({ type: "success", message: "Referee registration submitted!" });
            }}
          />
          <BackHomeButton />
        </div>
      );
    }

    if (role === "coach") {
      return (
        <div className="max-w-2xl mx-auto">
          <CoachRegistrationForm
            user={user}
            onComplete={() => {
              setIsNewUser(false);
              setToast({ type: "success", message: "Coach registration submitted! Awaiting approval." });
            }}
          />
          <BackHomeButton />
        </div>
      );
    }

    // Executive
    return (
      <div className="max-w-lg mx-auto">
        <form onSubmit={handleFormSubmit} className="p-6 border rounded-lg shadow-sm space-y-3 bg-white">
          <h3 className="text-xl font-semibold mb-4 text-center">Executive Registration</h3>
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1 text-gray-700">Executive Role</label>
            <select
              required
              className="input border rounded-md p-2"
              value={executiveRole}
              onChange={(e) => setExecutiveRole(e.target.value)}
            >
              <option value="">Select Role</option>
              <option>Chairman</option>
              <option>Referee Manager</option>
              <option>Appointing Officer</option>
              <option>Treasurer</option>
              <option>Vice-Chairman</option>
              <option>Committee Member</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700">
            Submit Registration
          </button>
        </form>
        <BackHomeButton />
      </div>
    );
  };

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <motion.div
      className="max-w-5xl mx-auto py-12 px-4 text-center relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: redirecting ? 0 : 1 }}
      transition={{ duration: 1 }}
    >
      {/* Toast */}
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

      {/* SELECT ROLE – REAL SVG ICONS */}
      {!role && !user && (
        <>
          <h2 className="text-3xl font-bold mb-8 text-gray-900">Select Your Role</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { role: "executive", Icon: IconBalance, desc: "Manage appointments, oversee operations" },
              { role: "referee", Icon: IconJersey, desc: "View assignments, submit reports" },
              { role: "coach", Icon: IconClipboard, desc: "Submit match reports and feedback" },
            ].map((r) => (
              <motion.div key={r.role} whileHover={{ scale: 1.03 }}>
                <Card
                  onClick={() => setRole(r.role as UserRole)}
                  className="cursor-pointer p-6 border-2 rounded-xl hover:border-emerald-400 transition"
                >
                  <r.Icon />
                  <h3 className="mt-4 text-xl font-bold text-gray-900 capitalize">{r.role}</h3>
                  <p className="mt-2 text-gray-600">{r.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
          <BackHomeButton />
        </>
      )}

      {/* CHOOSE ACTION */}
      {role && !action && !user && (
        <>
          <div className="flex flex-col md:flex-row justify-center gap-4 mt-8">
            <Button
              onClick={() => setAction("register")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg"
            >
              Register as {role}
            </Button>
            <Button
              onClick={() => setAction("login")}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-lg"
            >
              Sign in as {role}
            </Button>
          </div>
          <BackHomeButton />
        </>
      )}

      {/* GOOGLE AUTH */}
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

      {/* REGISTRATION FORM */}
      {user && isNewUser && renderFormFields()}

      {/* PENDING APPROVAL */}
      {user && !isNewUser && (
        <div className="text-center mt-6">
          <p className="text-gray-600 mb-2">{statusMessage}</p>
          <button onClick={handleSignOut} className="text-gray-500 underline">
            Sign Out
          </button>
          <BackHomeButton />
        </div>
      )}
    </motion.div>
  );
};