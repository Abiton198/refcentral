import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserRole } from "../types";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { motion } from "framer-motion";

export const RoleSelector: React.FC = () => {
  const [selected, setSelected] = useState<UserRole | null>(null);
  const navigate = useNavigate();

  const roles = [
    { role: "executive" as UserRole, title: "Executive", desc: "Manage appointments, oversee operations", icon: "⚖️" },
    { role: "referee" as UserRole, title: "Referee", desc: "View assignments, submit match reports", icon: "🎽" },
    { role: "coach" as UserRole, title: "Coach", desc: "Submit match results and provide feedback", icon: "📋" },
  ];

  const handleSelect = (role: UserRole) => setSelected(role);

  const goTo = (path: "register" | "login") => {
    if (!selected) return alert("Please select a role first.");
    navigate(`/${path}?role=${selected}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 text-center">
      <h2 className="text-3xl font-bold mb-8 text-gray-900">Select Your Role</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {roles.map(({ role, title, desc, icon }) => (
          <motion.div key={role} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Card
              onClick={() => handleSelect(role)}
              className={`text-center cursor-pointer border-2 rounded-xl transition-all duration-200 hover:shadow-md p-6 ${
                selected === role
                  ? "border-emerald-600 shadow-lg bg-emerald-50"
                  : "border-gray-200 hover:border-emerald-400"
              }`}
            >
              <div className="text-6xl mb-4">{icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-600">{desc}</p>
              {selected === role && (
                <p className="mt-3 text-sm font-medium text-emerald-600">Selected ✓</p>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      {selected && (
        <motion.div
          className="flex flex-col md:flex-row justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button
            onClick={() => goTo("register")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg"
          >
            📝 Register as {selected.charAt(0).toUpperCase() + selected.slice(1)}
          </Button>
          <Button
            onClick={() => goTo("login")}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-lg"
          >
            🔑 Sign in as {selected.charAt(0).toUpperCase() + selected.slice(1)}
          </Button>
        </motion.div>
      )}
    </div>
  );
};
