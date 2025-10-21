import React from "react";
import { UserRole } from "../types";
import { Card } from "./ui/Card";

interface RoleSelectorProps {
  onSelectRole: (role: UserRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelectRole }) => {
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
        Select Your Role
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {roles.map(({ role, title, desc, icon }) => (
          <Card
            key={role}
            onClick={() => onSelectRole(role)}
            className="text-center cursor-pointer hover:border-emerald-600 border-2 border-transparent rounded-xl transition-all duration-200 hover:shadow-md"
          >
            <div className="text-6xl mb-4">{icon}</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600">{desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};
