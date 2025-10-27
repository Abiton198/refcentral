import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  updateDoc,
  setDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";
import { toast } from "../ui/use-toast";

interface RefereeProfile {
  uid: string;
  firstName?: string;
  preferredName?: string;
  surname?: string;
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
  yearJoined?: string;
  experienceLevel?: string;
  licenseNumber?: string;
  boksmartNumber?: string;
  boksmartExpiry?: string;
  shortSize?: string;
  golfShirtSize?: string;
  tshirtSize?: string;
  jacketSize?: string;
  refJerseySize?: string;
  tracksuitTopSize?: string;
  tracksuitBottomSize?: string;
  preferredFit?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  branchCode?: string;
  accountType?: string;
  availabilityStatus?: string;
  suspensionReason?: string;
  approved?: boolean;
  status?: string;
  createdAt?: any;
  updatedAt?: any;
  currentLocation?: {
    lat?: number;
    lng?: number;
    address?: string;
    updatedAt?: any;
  };
}

interface RefereeProfilesProps {
  currentRefereeId?: string;
  editable?: boolean;
}

export const RefereeProfiles: React.FC<RefereeProfilesProps> = ({
  currentRefereeId,
  editable = false,
}) => {
  const [pendingRefs, setPendingRefs] = useState<RefereeProfile[]>([]);
  const [approvedRefs, setApprovedRefs] = useState<RefereeProfile[]>([]);
  const [myProfile, setMyProfile] = useState<RefereeProfile | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(false);

  // 🔹 Real-time listeners
  useEffect(() => {
    let unsub: (() => void) | undefined;

    if (currentRefereeId) {
      // 🎯 Single referee view
      const refDoc = doc(db, "referees", currentRefereeId);
      unsub = onSnapshot(refDoc, (snap) => {
        if (snap.exists()) {
          setMyProfile({ uid: snap.id, ...snap.data() } as RefereeProfile);
        }
      });
    } else {
      // 🧾 Executive dashboard view
      const qPending = query(collection(db, "referees"), where("approved", "==", false));
      const qApproved = query(collection(db, "referees"), where("approved", "==", true));

      const unsubPending = onSnapshot(qPending, (snapshot) => {
        setPendingRefs(
          snapshot.docs.map((d) => ({ uid: d.id, ...d.data() })) as RefereeProfile[]
        );
      });

      const unsubApproved = onSnapshot(qApproved, (snapshot) => {
        setApprovedRefs(
          snapshot.docs.map((d) => ({ uid: d.id, ...d.data() })) as RefereeProfile[]
        );
      });

      unsub = () => {
        unsubPending();
        unsubApproved();
      };
    }

    return () => unsub?.();
  }, [currentRefereeId]);

  // ✅ Save Profile (syncs both collections)
  const handleSave = async () => {
    if (!myProfile?.uid) return;
    setSaving(true);
    try {
      const updated = { ...myProfile, updatedAt: new Date() };
      await setDoc(doc(db, "referees", myProfile.uid), updated, { merge: true });
      await setDoc(doc(db, "users", myProfile.uid), updated, { merge: true });

      toast({
        title: "✅ Profile Updated",
        description: "Changes saved and synced across collections.",
      });
    } catch (err) {
      console.error("Save error:", err);
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleChange = (field: keyof RefereeProfile, value: string) => {
    setMyProfile((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Unsupported",
        description: "Your browser does not support location services.",
        variant: "destructive",
      });
      return;
    }

    setLoadingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyProfile((prev) =>
          prev
            ? {
                ...prev,
                currentLocation: {
                  lat: latitude,
                  lng: longitude,
                  address: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
                  updatedAt: new Date(),
                },
              }
            : prev
        );
        setLoadingLoc(false);
        toast({ title: "📍 Location Captured", description: "Ready to save!" });
      },
      (err) => {
        setLoadingLoc(false);
        toast({
          title: "Location Error",
          description: err.message,
          variant: "destructive",
        });
      }
    );
  };

  const toggleExpand = (uid: string) => {
    setExpandedId(expandedId === uid ? null : uid);
  };

  // 🏷️ Label mapping
  const fieldLabels: Record<keyof RefereeProfile, string> = {
    uid: "UID",
    firstName: "First Name",
    preferredName: "Preferred Name",
    surname: "Surname",
    gender: "Gender",
    dob: "Date of Birth",
    idNumber: "ID Number",
    nationality: "Nationality",
    race: "Race",
    languages: "Languages",
    residentialAddress: "Residential Address",
    postalAddress: "Postal Address",
    city: "City / Town",
    mobileNumber: "Mobile Number",
    altContact: "Alternative Contact",
    email: "Email",
    yearJoined: "Year Joined",
    experienceLevel: "Experience Level",
    licenseNumber: "License Number",
    boksmartNumber: "BokSmart Number",
    boksmartExpiry: "BokSmart Expiry",
    shortSize: "Short Size",
    golfShirtSize: "Golf Shirt Size",
    tshirtSize: "T-Shirt Size",
    jacketSize: "Jacket Size",
    refJerseySize: "Referee Jersey Size",
    tracksuitTopSize: "Tracksuit Top Size",
    tracksuitBottomSize: "Tracksuit Bottom Size",
    preferredFit: "Preferred Fit",
    bankName: "Bank Name",
    accountHolder: "Account Holder",
    accountNumber: "Account Number",
    branchCode: "Branch Code",
    accountType: "Account Type",
    availabilityStatus: "Availability",
    suspensionReason: "Suspension Reason",
    approved: "Approved",
    status: "Status",
    createdAt: "Created At",
    updatedAt: "Updated At",
    currentLocation: "Current Location",
  };

  // 🧍 Referee Self-View
  if (currentRefereeId && myProfile) {
    return (
      <div className="max-w-5xl mx-auto bg-white shadow-md rounded-xl p-6 space-y-6">
        <h2 className="text-2xl font-bold text-emerald-700 mb-4">👤 Profile</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          {Object.entries(fieldLabels).map(([key, label]) => {
            if (key === "currentLocation") {
              return (
                <div key={key} className="col-span-2">
                  <label className="block text-gray-600 font-medium">{label}</label>
                  {editable ? (
                    <div className="flex flex-col sm:flex-row gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="Enter location or detect"
                        value={myProfile.currentLocation?.address || ""}
                        onChange={(e) =>
                          setMyProfile((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  currentLocation: {
                                    ...prev.currentLocation,
                                    address: e.target.value,
                                  },
                                }
                              : prev
                          )
                        }
                        className="w-full border rounded-md px-2 py-1 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <Button size="sm" onClick={handleGetLocation} disabled={loadingLoc}>
                        {loadingLoc ? "Locating..." : "📍 Detect"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-gray-800 mt-1">
                      {myProfile.currentLocation?.address || "—"}
                    </p>
                  )}
                </div>
              );
            }

            if (["approved", "createdAt", "updatedAt"].includes(key))
              return null; // skip metadata

            return (
              <div key={key}>
                <label className="block text-gray-600 font-medium">{label}</label>
                {editable ? (
                  <input
                    type="text"
                    value={(myProfile as any)[key] || ""}
                    onChange={(e) => handleChange(key as keyof RefereeProfile, e.target.value)}
                    className="mt-1 w-full border rounded-md px-2 py-1 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                ) : (
                  <p className="text-gray-800 mt-1">{(myProfile as any)[key] || "—"}</p>
                )}
              </div>
            );
          })}
        </div>

        {editable && (
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "💾 Save Changes"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // 🧾 Executive Dashboard
  return (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <h2 className="text-3xl font-bold mb-8 text-gray-800">🧾 Referee Profiles</h2>
      <ProfileSection
        title="Approved Referees"
        color="emerald"
        refs={approvedRefs}
        expandedId={expandedId}
        toggleExpand={toggleExpand}
      />
      <ProfileSection
        title="Pending Referees"
        color="amber"
        refs={pendingRefs}
        expandedId={expandedId}
        toggleExpand={toggleExpand}
      />
    </div>
  );
};

// ---------------------------
// 📦 Profile Section
// ---------------------------
interface ProfileSectionProps {
  title: string;
  color: string;
  refs: RefereeProfile[];
  expandedId: string | null;
  toggleExpand: (uid: string) => void;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({
  title,
  color,
  refs,
  expandedId,
  toggleExpand,
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
          />
        ))}
      </div>
    )}
  </section>
);

// ---------------------------
// 🧱 Referee Card (Exec View)
// ---------------------------
const RefereeCard: React.FC<{
  referee: RefereeProfile;
  expanded: boolean;
  onToggle: () => void;
}> = ({ referee, expanded, onToggle }) => {
  const handleApproval = async (approve: boolean) => {
    try {
      await updateDoc(doc(db, "referees", referee.uid), { approved: approve });
      await updateDoc(doc(db, "users", referee.uid), { approved: approve });
      toast({
        title: approve ? "✅ Approved" : "❌ Rejected",
        description: `${referee.firstName} ${referee.surname}`,
      });
    } catch (err) {
      console.error("Error updating referee approval:", err);
    }
  };

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
          {referee.currentLocation?.address && (
            <p className="text-xs text-emerald-700 mt-1">
              📍 {referee.currentLocation.address}
            </p>
          )}
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
            className="border-t p-5 bg-gray-50 space-y-2 text-sm text-gray-700"
          >
            <p><strong>BokSmart:</strong> {referee.boksmartNumber || "—"} (Exp: {referee.boksmartExpiry || "N/A"})</p>
            <p><strong>Experience:</strong> {referee.experienceLevel || "—"}</p>
            <p><strong>Availability:</strong> {referee.availabilityStatus || "—"}</p>
            <p><strong>Bank:</strong> {referee.bankName || "—"} • {referee.accountType || "—"}</p>
            <p><strong>Location:</strong> {referee.currentLocation?.address || "—"}</p>

            {!referee.approved && (
              <div className="flex gap-3 pt-3">
                <button
                  onClick={() => handleApproval(true)}
                  className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
                >
                  ✅ Approve
                </button>
                <button
                  onClick={() => handleApproval(false)}
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
