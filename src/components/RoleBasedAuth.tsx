// src/components/auth/RoleBasedAuth.tsx

import React, { useState, useEffect } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";

import { RefereeRegistrationForm } from "./executive/RefereeRegistrationForm";
import { CoachRegistrationForm } from "./coach/CoachRegistrationForm";

import { UserRole } from "../types";

import { Card } from "./ui/Card";
import { Button } from "./ui/Button";

import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";

import sha256 from "crypto-js/sha256";
import { TeamManagerRegistrationForm } from "./executive/TeamManagerRegistrationForm";

/* -------------------------------------------------
   SVG ICONS
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
   TEAM MANAGER ICON
   ------------------------------------------------- */

const IconTeamManager = () => (
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
      d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8zm6 2a3 3 0 100-6 3 3 0 000 6z"
    />
  </svg>
);

/* -------------------------------------------------
   ROLE LABEL HELPER
   Converts:
     team_manager → Team Manager
   ------------------------------------------------- */

const getRoleLabel = (role: UserRole | string | null) => {
  if (!role) return "";

  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const roleCollectionFor = (r?: string) =>
  r === "referee" ? "referees"
  : r === "coach" ? "coaches"
  : r === "team_manager" ? "team_managers"
  : r === "executive" ? "executives"
  : "users";

const needsRegistration = async (uid: string, userData?: any) => {
  if (!userData) return true; // no users doc yet
  const profile = await getDoc(doc(db, roleCollectionFor(userData.role), uid));
  return !profile.exists(); // users doc exists but role profile was never saved
};

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

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [redirecting, setRedirecting] = useState(false);

  const [showPasswordLogin, setShowPasswordLogin] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginError, setLoginError] = useState<string | null>(null);

  const navigate = useNavigate();

  /* -------------------------------------------------
     BACK HOME
     ------------------------------------------------- */

  const BackHomeButton = () => (
    <button
      onClick={() => navigate("/")}
      className="block mx-auto mt-6 text-sm text-gray-500 underline hover:text-emerald-600 transition"
    >
      ← Back to Home
    </button>
  );

  /* -------------------------------------------------
     DETECT ROLE + ACTION FROM URL
     ------------------------------------------------- */

const VALID_ROLES = ["executive", "referee", "team_manager", "coach"];
const location = useLocation();

useEffect(() => {
  const params = new URLSearchParams(location.search);
  const raw = params.get("role") || sessionStorage.getItem("pendingRole");
  const roleParam = raw && VALID_ROLES.includes(raw) ? (raw as UserRole) : null;

  const actionParam = location.pathname.includes("register")
    ? "register"
    : location.pathname.includes("login")
      ? "login"
      : null;

  if (roleParam) setRole(roleParam);
  if (actionParam) setAction(actionParam);
}, [location.pathname, location.search]);

  /* -------------------------------------------------
     AUTH LISTENER
     ------------------------------------------------- */
useEffect(() => {
  const unsub = auth.onAuthStateChanged(async (currentUser) => {
    if (!currentUser) {
      setUser(null);
      setIsNewUser(false);
      setStatusMessage("");
      return;
    }

    setUser(currentUser);

    try {
      const snap = await getDoc(doc(db, "users", currentUser.uid));

      if (!snap.exists()) {
        setIsNewUser(true);
        setStatusMessage("Please complete your registration to continue.");
        return;
      }

      const data = snap.data();

      if (data.approved === true) {
        if (data.role) {
          navigate(`/dashboard/${data.role}`);
        } else {
          setStatusMessage("Account approved but no role assigned. Contact support.");
        }
        return;
      }

      // Not approved yet: either half-registered or genuinely pending
      if (await needsRegistration(currentUser.uid, data)) {
        if (data.role) setRole(data.role as UserRole);
        setIsNewUser(true);
        setStatusMessage("Your registration is incomplete. Please finish it below.");
      } else {
        setStatusMessage("Registration received. Waiting for executive approval...");
      }
    } catch (err) {
      console.error("Auth listener error:", err);
      setStatusMessage("Could not load your account. Please try again.");
    }
  });

  return () => unsub();
}, [navigate]);

  /* -------------------------------------------------
     GOOGLE AUTHENTICATION
     ------------------------------------------------- */

  const handleGoogleAuth = async () => {
    if (!role || !action) {
      alert("Please select a role and choose Register or Sign in.");
      return;
    }

    try {
      await signOut(auth);

      const provider = new GoogleAuthProvider();

      provider.setCustomParameters({
        prompt: "select_account",
      });

      const result = await signInWithPopup(auth, provider);

      const signedUser = result.user;

      setUser(signedUser);

      const userRef = doc(db, "users", signedUser.uid);

      const snap = await getDoc(userRef);

      /* -------------------------------------------------
         LOGIN
         ------------------------------------------------- */

   if (action === "register") {
  const data = snap.exists() ? snap.data() : null;

  if (await needsRegistration(signedUser.uid, data)) {
    if (data?.role) setRole(data.role as UserRole);
    setIsNewUser(true);
    setStatusMessage(
      `Complete your ${getRoleLabel(data?.role ?? role)} registration below.`
    );
  } else if (!data?.approved) {
    setStatusMessage("Registration received. Waiting for executive approval...");
  } else {
    navigate(`/dashboard/${data.role}`);
  }
}

      /* -------------------------------------------------
         REGISTRATION
         ------------------------------------------------- */

      if (action === "register") {
        if (!snap.exists()) {
          setIsNewUser(true);

          setStatusMessage(
            `Complete your ${getRoleLabel(role)} registration below.`
          );
        } else {
          const data = snap.data();

          if (!data.approved) {
            setStatusMessage(
              "Registration received. Waiting for executive approval..."
            );
          } else {
            navigate(`/dashboard/${data.role}`);
          }
        }
      }
    } catch (err: any) {
      console.error("Google Auth Error:", err);

      setToast({
        type: "error",
        message: err.message || "Authentication failed.",
      });
    }
  };

  /* -------------------------------------------------
     EMAIL / PASSWORD LOGIN
     ------------------------------------------------- */

  const handleEmailLogin = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setLoginError(null);

    if (!email || !password) {
      setLoginError(
        "Please enter both email and password."
      );

      return;
    }

    try {
      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const signedUser = userCredential.user;

      setUser(signedUser);

      const userRef = doc(db, "users", signedUser.uid);

      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data();

        if (data.approved === true) {
          navigate(`/dashboard/${data.role}`);
        } else {
          setStatusMessage(
            "Account found but awaiting executive approval..."
          );
        }
      } else {
        setLoginError(
          "No account found with this email. Please register first."
        );

        await signOut(auth);
      }
    } catch (err: any) {
      console.error("Email login error:", err);

      let message = "Login failed. Please try again.";

      if (err.code === "auth/user-not-found") {
        message = "No user found with this email.";
      }

      if (err.code === "auth/wrong-password") {
        message = "Incorrect password.";
      }

      if (err.code === "auth/invalid-email") {
        message = "Invalid email format.";
      }

      setLoginError(message);
    }
  };

  /* -------------------------------------------------
     REGISTRATION SUBMISSION
     
     Executive:
       - approved immediately

     Team Manager:
       - pending executive approval
       - actual team membership must later be
         created by an Executive

     Coach:
       - pending executive approval
       - actual team membership must later be
         created by an Executive

     Referee:
       - handled through RefereeRegistrationForm
  ------------------------------------------------- */

  const handleFormSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!user || !role) return;

    try {
      /* ---------------------------------------------
         PREVENT DUPLICATE EMAIL REGISTRATION
         --------------------------------------------- */

      if (!user.email) {
        throw new Error(
          "Your authenticated account does not contain an email address."
        );
      }

      const emailHash = sha256(
        user.email.toLowerCase().trim()
      ).toString();

      const emailRef = doc(db, "emails", emailHash);

      const emailSnap = await getDoc(emailRef);

      if (emailSnap.exists()) {
        setToast({
          type: "error",
          message: "This email is already registered.",
        });

        await signOut(auth);

        return;
      }

      await setDoc(emailRef, {
        uid: user.uid,
        createdAt: serverTimestamp(),
      });

      /* ---------------------------------------------
         DETERMINE ROLE COLLECTION
         --------------------------------------------- */

      let roleCollection = "users";

      if (role === "referee") {
        roleCollection = "referees";
      }

      if (role === "coach") {
        roleCollection = "coaches";
      }

      /*
       * Team managers are deliberately NOT stored
       * as team memberships here.
       *
       * Their team membership is created separately
       * by an Executive in:
       *
       * team_memberships/{membershipId}
       *
       * with:
       *
       * role = "team_manager"
       */

      if (role === "team_manager") {
        roleCollection = "team_managers";
      }

      if (role === "executive") {
        roleCollection = "executives";
      }

      /* ---------------------------------------------
         APPROVAL RULE
         --------------------------------------------- */

      const isExecutive = role === "executive";

      const approved = isExecutive;

      /* ---------------------------------------------
         COMMON USER DATA
         --------------------------------------------- */

      const baseData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "",
        role,

        /*
         * Executives are approved immediately.
         *
         * Team managers, coaches and referees
         * remain pending until approved.
         */
        approved,

        status: approved ? "active" : "pending",

        createdAt: serverTimestamp(),
      };

      /* ---------------------------------------------
         USERS COLLECTION
         --------------------------------------------- */

      await setDoc(
        doc(db, "users", user.uid),
        baseData,
        { merge: true }
      );

      /* ---------------------------------------------
         ROLE-SPECIFIC COLLECTION
         --------------------------------------------- */

      await setDoc(
        doc(db, roleCollection, user.uid),
        baseData,
        { merge: true }
      );

      /* ---------------------------------------------
         SUCCESS MESSAGE
         --------------------------------------------- */

      const msg = isExecutive
        ? "Executive registered! Redirecting..."
        : `${getRoleLabel(
          role
        )} registration submitted! Awaiting executive approval.`;

      setToast({
        type: "success",
        message: msg,
      });

      setStatusMessage(msg);

      setIsNewUser(false);

      /* ---------------------------------------------
         EXECUTIVE REDIRECT
         --------------------------------------------- */

      if (isExecutive) {
        setRedirecting(true);

        setTimeout(() => {
          navigate("/dashboard/executive");
        }, 1800);
      }
    } catch (err: any) {
      console.error("Firestore error:", err);

      setToast({
        type: "error",
        message:
          err.message || "Submission failed.",
      });
    }
  };

  /* -------------------------------------------------
     SIGN OUT
     ------------------------------------------------- */

  const handleSignOut = async () => {
    await signOut(auth);

    setUser(null);
    setIsNewUser(false);
    setAction(null);
    setRole(null);

    setExecutiveRole("");

    setShowPasswordLogin(false);

    setEmail("");
    setPassword("");

    setLoginError(null);
  };

  /* -------------------------------------------------
     REGISTRATION FORM
     ------------------------------------------------- */

  const renderFormFields = () => {
    /* ---------------------------------------------
       REFEREE
       --------------------------------------------- */

    if (role === "referee") {
      return (
        <div className="max-w-2xl mx-auto">
          <RefereeRegistrationForm
            user={user}
            onComplete={() => {
              setIsNewUser(false);

              setToast({
                type: "success",
                message:
                  "Referee registration submitted!",
              });
            }}
          />

          <BackHomeButton />
        </div>
      );
    }

    /* ---------------------------------------------
       COACH
       --------------------------------------------- */

    if (role === "coach") {
      return (
        <div className="max-w-2xl mx-auto">
          <CoachRegistrationForm
            user={user}
            onComplete={() => {
              setIsNewUser(false);

              setToast({
                type: "success",
                message:
                  "Coach registration submitted! Awaiting approval.",
              });
            }}
          />

          <BackHomeButton />
        </div>
      );
    }

    /* ---------------------------------------------
       TEAM MANAGER
       
       A Team Manager does not select a team here.
       
       Executive assigns the manager to a team later
       through team_memberships.
       --------------------------------------------- */
if (role === "team_manager") {
  return (
    <div className="max-w-2xl mx-auto">
      <TeamManagerRegistrationForm
        user={user}
        onComplete={() => {
          setIsNewUser(false);
          setStatusMessage(
            "Team manager registration submitted. Waiting for executive approval..."
          );
          sessionStorage.removeItem("pendingRole");
          setToast({
            type: "success",
            message: "Team manager registration submitted!",
          });
        }}
      />
      <BackHomeButton />
    </div>
  );
}
   

    /* ---------------------------------------------
       EXECUTIVE
       --------------------------------------------- */

    return (
      <div className="max-w-lg mx-auto">
        <form
          onSubmit={handleFormSubmit}
          className="p-6 border rounded-lg shadow-sm space-y-3 bg-white"
        >
          <h3 className="text-xl font-semibold mb-4 text-center">
            Executive Registration
          </h3>

          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1 text-gray-700">
              Executive Role
            </label>

            <select
              required
              className="input border rounded-md p-2"
              value={executiveRole}
              onChange={(e) =>
                setExecutiveRole(e.target.value)
              }
            >
              <option value="">
                Select Role
              </option>

              <option>Chairman</option>
              <option>Referee Manager</option>
              <option>Appointing Officer</option>
              <option>Treasurer</option>
              <option>Vice-Chairman</option>
              <option>Committee Member</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700"
          >
            Submit Registration
          </button>
        </form>

        <BackHomeButton />
      </div>
    );
  };

  /* -------------------------------------------------
     TOAST AUTO DISMISS
     ------------------------------------------------- */

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(
        () => setToast(null),
        4000
      );

      return () => clearTimeout(timer);
    }
  }, [toast]);

  /* -------------------------------------------------
     RENDER
     ------------------------------------------------- */

  return (
    <motion.div
      className="max-w-6xl mx-auto py-12 px-4 text-center relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: redirecting ? 0 : 1 }}
      transition={{ duration: 1 }}
    >
      {/* -------------------------------------------
          TOAST
          ------------------------------------------- */}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{
              opacity: 0,
              y: -20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -20,
            }}
            className={`fixed top-5 right-5 px-5 py-3 rounded-lg shadow-lg text-white z-50 ${toast.type === "success"
                ? "bg-emerald-600"
                : "bg-red-600"
              }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------
          ROLE SELECTOR
          ------------------------------------------- */}

      {!role && !user && (
        <>
          <h2 className="text-3xl font-bold mb-8 text-gray-900">
            Select Your Role
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">

            {/* EXECUTIVE */}

            <motion.div
              whileHover={{ scale: 1.03 }}
            >
              <Card
                onClick={() =>
                  setRole("executive" as UserRole)
                }
                className="cursor-pointer p-6 border-2 rounded-xl hover:border-emerald-400 transition h-full"
              >
                <IconBalance />

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Executive
                </h3>

                <p className="mt-2 text-gray-600">
                  Manage fixtures, referees and overall
                  rugby operations
                </p>
              </Card>
            </motion.div>

            {/* REFEREE */}

            <motion.div
              whileHover={{ scale: 1.03 }}
            >
              <Card
                onClick={() =>
                  setRole("referee" as UserRole)
                }
                className="cursor-pointer p-6 border-2 rounded-xl hover:border-emerald-400 transition h-full"
              >
                <IconJersey />

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Referee
                </h3>

                <p className="mt-2 text-gray-600">
                  View appointments, verify teams and
                  manage match reports
                </p>
              </Card>
            </motion.div>

            {/* TEAM MANAGER */}

            <motion.div
              whileHover={{ scale: 1.03 }}
            >
              <Card
                onClick={() =>
                  setRole("team_manager" as UserRole)
                }
                className="cursor-pointer p-6 border-2 rounded-xl hover:border-emerald-400 transition h-full"
              >
                <IconTeamManager />

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Team Manager
                </h3>

                <p className="mt-2 text-gray-600">
                  Manage players, documents, teamsheets
                  and team administration
                </p>
              </Card>
            </motion.div>

            {/* COACH */}

            <motion.div
              whileHover={{ scale: 1.03 }}
            >
              <Card
                onClick={() =>
                  setRole("coach" as UserRole)
                }
                className="cursor-pointer p-6 border-2 rounded-xl hover:border-emerald-400 transition h-full"
              >
                <IconClipboard />

                <h3 className="mt-4 text-xl font-bold text-gray-900">
                  Coach
                </h3>

                <p className="mt-2 text-gray-600">
                  Manage squad selection, team preparation
                  and match information
                </p>
              </Card>
            </motion.div>

          </div>

          <BackHomeButton />
        </>
      )}

      {/* -------------------------------------------
          CHOOSE ACTION
          ------------------------------------------- */}

      {role && !action && !user && (
        <>
          <h3 className="text-xl font-semibold text-gray-800 mt-8">
            {getRoleLabel(role)}
          </h3>

          <div className="flex flex-col md:flex-row justify-center gap-4 mt-8">

            <Button
              onClick={() =>
                setAction("register")
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg"
            >
              📝 Register as {getRoleLabel(role)}
            </Button>

            <Button
              onClick={() =>
                setAction("login")
              }
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-lg"
            >
              🔑 Sign in as {getRoleLabel(role)}
            </Button>

          </div>

          <BackHomeButton />
        </>
      )}

      {/* -------------------------------------------
          GOOGLE AUTH + PASSWORD LOGIN
          ------------------------------------------- */}

      {action && !user && (
        <>
          <div className="mt-10">

            <h3 className="text-xl font-semibold mb-4">
              {action === "register"
                ? "Register"
                : "Sign in"}{" "}
              as{" "}
              <span className="text-emerald-600">
                {getRoleLabel(role)}
              </span>
            </h3>

            <button
              onClick={handleGoogleAuth}
              className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 w-full max-w-xs mx-auto block"
            >
              Continue with Google
            </button>

            {/* PASSWORD LOGIN */}

            {action === "login" && (
              <button
                onClick={() =>
                  setShowPasswordLogin(
                    !showPasswordLogin
                  )
                }
                className="mt-4 text-xs uppercase tracking-wide text-emerald-600 underline hover:text-emerald-800 transition"
              >
                {showPasswordLogin
                  ? "Hide "
                  : "Login with "}
                Password
              </button>
            )}

            {statusMessage && (
              <p className="mt-4 text-sm text-gray-700">
                {statusMessage}
              </p>
            )}
          </div>

          {/* -----------------------------------------
              EMAIL / PASSWORD FORM
              ----------------------------------------- */}

          <AnimatePresence>
            {action === "login" &&
              showPasswordLogin && (
                <motion.div
                  initial={{
                    opacity: 0,
                    height: 0,
                  }}
                  animate={{
                    opacity: 1,
                    height: "auto",
                  }}
                  exit={{
                    opacity: 0,
                    height: 0,
                  }}
                  transition={{
                    duration: 0.3,
                  }}
                  className="mt-6 overflow-hidden"
                >
                  <form
                    onSubmit={handleEmailLogin}
                    className="max-w-xs mx-auto space-y-4"
                  >
                    <div>
                      <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) =>
                          setEmail(e.target.value)
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) =>
                          setPassword(e.target.value)
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {loginError && (
                      <p className="text-red-600 text-sm">
                        {loginError}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg"
                    >
                      Sign in with Email
                    </Button>
                  </form>
                </motion.div>
              )}
          </AnimatePresence>

          <BackHomeButton />
        </>
      )}

      {/* -------------------------------------------
          REGISTRATION FORM
          ------------------------------------------- */}

      {user &&
        isNewUser &&
        renderFormFields()}

      {/* -------------------------------------------
          PENDING APPROVAL
          ------------------------------------------- */}

      {user && !isNewUser && (
        <div className="text-center mt-6">

          <p className="text-gray-600 mb-2">
            {statusMessage}
          </p>

          <button
            onClick={handleSignOut}
            className="text-gray-500 underline"
          >
            Sign Out
          </button>

          <BackHomeButton />

        </div>
      )}
    </motion.div>
  );
};