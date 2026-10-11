import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserRole } from "../types";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { motion } from "framer-motion";

export const RoleSelector: React.FC = () => {
  const [selected, setSelected] = useState<UserRole | null>(null);
  const navigate = useNavigate();

  /*
   * RefCentral user roles
   *
   * Executive:
   *   Creates fixtures, assigns referees and oversees
   *   rugby operations.
   *
   * Referee:
   *   Views assigned matches and performs matchday
   *   player/team verification.
   *
   * Team Manager:
   *   Manages the team's player register, player
   *   documents, photos and teamsheets.
   *
   * Coach:
   *   Works with the team's squad and match preparation.
   *
   * IMPORTANT:
   * The role selected here is only used by the frontend
   * to determine the registration/login flow.
   *
   * The backend must still verify the user's actual
   * permissions using Firebase Authentication and
   * Firestore.
   */
  const roles = [
    {
      role: "executive" as UserRole,
      title: "Executive",
      desc: "Manage fixtures, referees and overall rugby operations",
      icon: "⚖️",
    },

    {
      role: "referee" as UserRole,
      title: "Referee",
      desc: "View appointments, verify teams and manage match reports",
      icon: "🎽",
    },

    {
      role: "team_manager" as UserRole,
      title: "Team Manager",
      desc: "Manage players, team documents, teamsheets and team administration",
      icon: "👔",
    },

    {
      role: "coach" as UserRole,
      title: "Coach",
      desc: "Manage squad selection, team preparation and match information",
      icon: "📋",
    },
  ];

  const handleSelect = (role: UserRole) => {
    setSelected(role);
  };

  const getRoleTitle = (role: UserRole) => {
    return role
      .split("_")
      .map(
        (word) =>
          word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join(" ");
  };

  const goTo = (path: "register" | "login") => {
    if (!selected) {
      alert("Please select a role first.");
      return;
    }

    navigate(`/${path}?role=${selected}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 text-center">

      {/* Page heading */}
      <h2 className="text-3xl font-bold mb-3 text-gray-900">
        Select Your Role
      </h2>

      <p className="text-gray-600 mb-8">
        Choose the role you will use on RefCentral.
      </p>

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">

        {roles.map(
          ({
            role,
            title,
            desc,
            icon,
          }) => (
            <motion.div
              key={role}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Card
                onClick={() => handleSelect(role)}
                className={`
                  text-center
                  cursor-pointer
                  border-2
                  rounded-xl
                  transition-all
                  duration-200
                  hover:shadow-md
                  p-6
                  h-full
                  flex
                  flex-col
                  justify-between
                  ${selected === role
                    ? "border-emerald-600 shadow-lg bg-emerald-50"
                    : "border-gray-200 hover:border-emerald-400"
                  }
                `}
              >

                {/* Role icon */}
                <div>
                  <div className="text-6xl mb-4">
                    {icon}
                  </div>

                  {/* Role name */}
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {title}
                  </h3>

                  {/* Role description */}
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {desc}
                  </p>
                </div>

                {/* Selected indicator */}
                {selected === role && (
                  <p className="mt-5 text-sm font-semibold text-emerald-600">
                    Selected ✓
                  </p>
                )}
              </Card>
            </motion.div>
          )
        )}

      </div>

      {/* Action buttons */}
      {selected && (
        <motion.div
          className="flex flex-col md:flex-row justify-center gap-4"
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >

          <Button
            onClick={() => goTo("register")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg"
          >
            📝 Register as {getRoleTitle(selected)}
          </Button>

          <Button
            onClick={() => goTo("login")}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-lg"
          >
            🔑 Sign in as {getRoleTitle(selected)}
          </Button>

        </motion.div>
      )}
    </div>
  );
};
