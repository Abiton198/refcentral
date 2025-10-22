import React from "react";
import { RoleBasedAuth } from "@/components/RoleBasedAuth";
import { Card } from "@/components/ui/Card";

/**
 * Unified Authentication Page
 * - Uses RoleBasedAuth for Google sign-in, role selection, and registration.
 * - Redirects based on approved user role.
 */
const Auth: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="max-w-5xl w-full bg-white p-10 shadow-xl rounded-xl">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to RefCentral
          </h1>
          <p className="text-gray-600 mt-2">
            Sign in or register based on your role to access the system.
          </p>
        </div>

        {/* 🔹 Role-based authentication system */}
        <RoleBasedAuth />
      </Card>
    </div>
  );
};

export default Auth;
