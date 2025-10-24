import React, { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { RoleBasedAuth } from "./components/RoleBasedAuth"; // ✅ Add this import

// 🔹 Dashboards
import { ExecutiveDashboard } from "./components/executive/ExecutiveDashboard";
import { RefereeDashboard } from "./components/referee/RefereeDashboard";
import { CoachDashboard } from "./components/coach/CoachDashboard";

// 🔹 Firebase
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// 🔹 Query Client
const queryClient = new QueryClient();

const App = () => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔄 Auth + role listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const userData = snap.data();
          setUser(userData);
          setRole(userData.role);
        } else {
          setUser(currentUser);
          setRole("guest");
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ⏳ Loading screen
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-700 font-medium">
        Loading RefCentral...
      </div>
    );
  }

  // 🔐 Role-based route protection
  const ProtectedRoute = ({
    children,
    allowedRole,
  }: {
    children: React.ReactNode;
    allowedRole: string;
  }) => {
    if (!user) return <Navigate to="/auth" replace />;
    if (role !== allowedRole) return <Navigate to="/" replace />;
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome {user?.name || user?.displayName || "User"}{" "}
            <span className="text-emerald-600 text-base font-semibold">
              [{role?.toUpperCase()}]
            </span>
          </h1>
          <p className="text-gray-500">
            Manage your activities and reports via your personalized dashboard.
          </p>
        </div>
        {children}
      </div>
    );
  };

  return (
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* 🏠 Public landing page */}
              <Route path="/" element={<Index />} />

              {/* 🔐 Authentication (old version, optional) */}
              <Route path="/auth" element={<Auth />} />

              {/* 🧾 New Role-based Registration & Login */}
              <Route path="/register" element={<RoleBasedAuth />} />
              <Route path="/login" element={<RoleBasedAuth />} />

              {/* 🧭 Role-based Dashboards */}
              <Route
                path="/dashboard/executive"
                element={
                  <ProtectedRoute allowedRole="executive">
                    <ExecutiveDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/referee"
                element={
                  <ProtectedRoute allowedRole="referee">
                    <RefereeDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/coach"
                element={
                  <ProtectedRoute allowedRole="coach">
                    <CoachDashboard />
                  </ProtectedRoute>
                }
              />

              {/* ❌ 404 Page */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
