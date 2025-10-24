import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";

interface RefereeProfile {
  uid: string;
  firstName?: string;
  surname?: string;
  preferredName?: string;
  gender?: string;
  dob?: string;
  idNumber?: string;
  nationality?: string;
  race?: string;
  languages?: string;
  residentialAddress?: string;
  postalAddress?: string;
  city?: string;
  mobileNumber?: string;
  altContact?: string;
  email?: string;

  // Qualification
  yearJoined?: string;
  experienceLevel?: string;
  licenseNumber?: string;
  boksmartNumber?: string;
  boksmartExpiry?: string;

  // Kit sizes
  shortSize?: string;
  golfShirtSize?: string;
  tshirtSize?: string;
  jacketSize?: string;
  refJerseySize?: string;
  tracksuitTopSize?: string;
  tracksuitBottomSize?: string;
  preferredFit?: string;

  // Banking
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branchCode?: string;
  accountType?: string;

  // System
  approved?: boolean;
  status?: string;
  createdAt?: any;
}

export const RefereeProfiles: React.FC = () => {
  const [pendingRefs, setPendingRefs] = useState<RefereeProfile[]>([]);
  const [approvedRefs, setApprovedRefs] = useState<RefereeProfile[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchReferees();
  }, []);

  const fetchReferees = async () => {
    try {
      const pendingSnap = await getDocs(
        query(collection(db, "referees"), where("approved", "==", false))
      );
      const approvedSnap = await getDocs(
        query(collection(db, "referees"), where("approved", "==", true))
      );

      setPendingRefs(
        pendingSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as RefereeProfile[]
      );
      setApprovedRefs(
        approvedSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as RefereeProfile[]
      );
    } catch (err) {
      console.error("Error fetching referees:", err);
    }
  };

  const handleApproval = async (uid: string, approve: boolean) => {
    try {
      await updateDoc(doc(db, "referees", uid), { approved: approve });
      await updateDoc(doc(db, "users", uid), { approved: approve });
      await fetchReferees();
    } catch (err) {
      console.error("Error updating referee approval:", err);
    }
  };

  const toggleExpand = (uid: string) => {
    setExpandedId(expandedId === uid ? null : uid);
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <h2 className="text-3xl font-bold mb-8 text-gray-800">
        🧾 Referee Profiles & Approvals
      </h2>

      {/* Pending */}
      <ProfileSection
        title="Pending Referees"
        color="amber"
        refs={pendingRefs}
        expandedId={expandedId}
        toggleExpand={toggleExpand}
        onApprove={handleApproval}
      />

      {/* Approved */}
      <ProfileSection
        title="Approved Referees"
        color="emerald"
        refs={approvedRefs}
        expandedId={expandedId}
        toggleExpand={toggleExpand}
      />
    </div>
  );
};

// ---------------------------
// 📦 Section Wrapper
// ---------------------------
interface ProfileSectionProps {
  title: string;
  color: string;
  refs: RefereeProfile[];
  expandedId: string | null;
  toggleExpand: (uid: string) => void;
  onApprove?: (uid: string, approve: boolean) => void;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({
  title,
  color,
  refs,
  expandedId,
  toggleExpand,
  onApprove,
}) => (
  <section className="mb-10">
    <h3 className={`text-2xl font-semibold text-${color}-700 mb-4`}>{title}</h3>
    {refs.length === 0 ? (
      <p className="text-gray-500">No {title.toLowerCase()} found.</p>
    ) : (
      <div className="space-y-4">
        {refs.map((ref) => (
          <RefereeCard
            key={ref.uid}
            referee={ref}
            expanded={expandedId === ref.uid}
            onToggle={() => toggleExpand(ref.uid)}
            onApprove={() => onApprove?.(ref.uid, true)}
            onReject={() => onApprove?.(ref.uid, false)}
          />
        ))}
      </div>
    )}
  </section>
);

// ---------------------------
// 🧱 Card Component
// ---------------------------
interface RefereeCardProps {
  referee: RefereeProfile;
  expanded: boolean;
  onToggle: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

const RefereeCard: React.FC<RefereeCardProps> = ({
  referee,
  expanded,
  onToggle,
  onApprove,
  onReject,
}) => {
  return (
    <motion.div
      layout
      className={`rounded-xl border ${
        referee.approved ? "border-emerald-400" : "border-amber-400"
      } bg-white shadow-sm overflow-hidden`}
    >
      <div
        onClick={onToggle}
        className="flex justify-between items-center cursor-pointer p-5 hover:bg-gray-50"
      >
        <div>
          <h4 className="text-lg font-semibold text-gray-900">
            {referee.firstName || "Unknown"} {referee.surname || ""}
          </h4>
          <p className="text-sm text-gray-500">
            {referee.email || "N/A"} • {referee.mobileNumber || "N/A"}
          </p>
        </div>
        <span
          className={`text-sm ${
            referee.approved ? "text-emerald-700" : "text-amber-600"
          }`}
        >
          {expanded ? "▲ Collapse" : "▼ Expand"}
        </span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t p-5 text-left space-y-4 bg-gray-50"
          >
            <Section title="Personal Information">
              <Field label="Preferred Name" value={referee.preferredName} />
              <Field label="Gender" value={referee.gender} />
              <Field label="Date of Birth" value={referee.dob} />
              <Field label="ID / Passport" value={referee.idNumber} />
              <Field label="Nationality" value={referee.nationality} />
              <Field label="Race / Ethnic Group" value={referee.race} />
              <Field label="Languages" value={referee.languages} />
            </Section>

            <Section title="Contact Details">
              <Field label="Residential Address" value={referee.residentialAddress} />
              <Field label="Postal Address" value={referee.postalAddress} />
              <Field label="City / Town" value={referee.city} />
              <Field label="Mobile Number" value={referee.mobileNumber} />
              <Field label="Alternative Contact" value={referee.altContact} />
              <Field label="Email Address" value={referee.email} />
            </Section>

            <Section title="Qualification & Accreditation">
              <Field label="Year Joined" value={referee.yearJoined} />
              <Field label="Experience Level" value={referee.experienceLevel} />
              <Field label="License Number" value={referee.licenseNumber} />
              <Field label="BokSmart Number" value={referee.boksmartNumber} />
              <Field label="BokSmart Expiry" value={referee.boksmartExpiry} />
            </Section>

            <Section title="Kit & Uniform Sizes">
              <Field label="Short Size" value={referee.shortSize} />
              <Field label="Golf Shirt" value={referee.golfShirtSize} />
              <Field label="T-Shirt" value={referee.tshirtSize} />
              <Field label="Ref Jersey" value={referee.refJerseySize} />
              <Field label="Tracksuit Top" value={referee.tracksuitTopSize} />
              <Field label="Tracksuit Bottom" value={referee.tracksuitBottomSize} />
              <Field label="Jacket" value={referee.jacketSize} />
              <Field label="Preferred Fit" value={referee.preferredFit} />
            </Section>

            <Section title="Banking Details">
              <Field label="Bank Name" value={referee.bankName} />
              <Field label="Account Holder" value={referee.accountHolder} />
              <Field label="Account Number" value={referee.accountNumber} />
              <Field label="Branch Code" value={referee.branchCode} />
              <Field label="Account Type" value={referee.accountType} />
            </Section>

            <Section title="System Info">
              <Field label="Status" value={referee.status || "N/A"} />
              <Field
                label="Approved"
                value={referee.approved ? "✅ Yes" : "⏳ Pending"}
              />
            </Section>

            {!referee.approved && (
              <div className="flex gap-3 pt-3">
                <button
                  onClick={onApprove}
                  className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
                >
                  ✅ Approve
                </button>
                <button
                  onClick={onReject}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  ❌ Reject
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ---------------------------
// 🧩 Reusable Components
// ---------------------------
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div>
    <h5 className="font-semibold text-emerald-700 mb-2">{title}</h5>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
      {children}
    </div>
  </div>
);

const Field: React.FC<{ label: string; value?: string }> = ({
  label,
  value,
}) => (
  <p>
    <strong>{label}:</strong> {value || "-"}
  </p>
);
