import React, { useEffect, useState } from "react";
import { useNavigate, Routes, Route } from "react-router-dom";
import { Hero } from "./Hero";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Features } from "./Features";
import { Stats } from "./Stats";
import { Testimonials } from "./Testimonials";
import { AboutSection } from "./AboutSection";
import { RoleBasedAuth } from "./RoleBasedAuth";
import { ExecutiveDashboard } from "./executive/ExecutiveDashboard";
import { RefereeDashboard } from "./referee/RefereeDashboard";
import { CoachDashboard } from "./coach/CoachDashboard";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, requestPushPermissionAndSaveToken } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getRedirectResult } from "firebase/auth";

const AppLayout: React.FC = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();


  /* ------------------------------------------------
     Authentication + Push Notifications
  ------------------------------------------------ */

  useEffect(() => {

    const unsub = onAuthStateChanged(auth, async (user) => {

      if (user) {

        try {

          // 🔹 Get user profile
          const userRef = doc(db, "users", user.uid);
          const snap = await getDoc(userRef);

          if (snap.exists()) {

            const data = snap.data();

            setUserRole(data.role);
            setIsApproved(data.approved);

            // 🔔 Request push notifications AFTER login
            await requestPushPermissionAndSaveToken(user.uid);

            // Redirect approved users
            if (data.approved) {
              navigate(`/dashboard/${data.role}`);
            }

          }

        } catch (err) {
          console.error("Auth check failed:", err);
        }

      } else {

        setUserRole(null);
        setIsApproved(false);

      }

      setCheckingAuth(false);

    });

    return () => unsub();

  }, [navigate]);

  // 🔹 Handle redirect result
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          // User is signed in!
          console.log("User:", result.user);
        }
      })
      .catch((error) => {
        console.error("Redirect Error:", error.code);
      });
  }, []);

  // 🔹 Handle Logout
  const handleLogout = () => {
    auth.signOut();
    setUserRole(null);
    setIsApproved(false);
    navigate("/");
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600">
        Checking authentication...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header role={userRole as any} onLogout={handleLogout} />

      <main className="flex-1 w-full">
        <Routes>
          {/* Landing Page */}
          <Route
            path="/"
            element={
              <>
                <Hero onGetStarted={() => navigate("/auth")} />
                <Stats />
                <AboutSection />
                <Features />
                <Testimonials />
              </>
            }
          />

          {/* Auth Flow (Role select + Google Sign-in + Registration) */}
          <Route path="/auth" element={<RoleBasedAuth />} />

          {/* Dashboards for each role */}
          <Route path="/dashboard/executive" element={<ExecutiveDashboard />} />
          <Route path="/dashboard/referee" element={<RefereeDashboard />} />
          <Route path="/dashboard/coach" element={<CoachDashboard />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
};

export default AppLayout;
