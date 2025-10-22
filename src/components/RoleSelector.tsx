import React, { useState } from "react";
import { UserRole } from "../types";
import { Card } from "./ui/Card";
import { motion } from "framer-motion";

interface RoleSelectorProps {
  onSelectRole: (role: UserRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelectRole }) => {
  const [selected, setSelected] = useState<UserRole | null>(null);

  const roles = [
    {
      role: "executive" as UserRole,
      title: "Executive",
      desc: "Manage appointments, oversee operations",
      icon: "⚖️",
    },
    {
      role: "referee" as UserRole,
      title: "Referee",
      desc: "View assignments, submit reports",
      icon: "🎽",
    },
    {
      role: "coach" as UserRole,
      title: "Coach",
      desc: "Submit match reports and feedback",
      icon: "📋",
    },
  ];

  const handleSelect = (role: UserRole) => {
    setSelected(role);
    onSelectRole(role);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
        Select Your Role
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {roles.map(({ role, title, desc, icon }) => (
          <motion.div
            key={role}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Card
              onClick={() => handleSelect(role)}
              className={`text-center cursor-pointer border-2 rounded-xl transition-all duration-200 hover:shadow-md ${
                selected === role
                  ? "border-emerald-600 shadow-lg bg-emerald-50"
                  : "border-transparent hover:border-emerald-600"
              }`}
            >
              <div className="text-6xl mb-4">{icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-600">{desc}</p>
              {selected === role && (
                <p className="mt-2 text-sm font-medium text-emerald-600">
                  Selected ✓
                </p>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
