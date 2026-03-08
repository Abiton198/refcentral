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
  serverTimestamp,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";
import { toast } from "../ui/use-toast";
import { CheckCircle2, MapPin, ShieldCheck, XCircle } from "lucide-react";

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
   <div className="max-w-7xl mx-auto py-10 px-4 space-y-12">
      <div>
        <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-emerald-600" /> 
          Referee Management
        </h2>
        <p className="text-gray-500 mt-2">Manage approvals and monitor live availability.</p>
      </div>

      <ProfileSection
        title="Approved & Active"
        color="emerald"
        refs={approvedRefs}
        expandedId={expandedId}
        toggleExpand={toggleExpand}
      />

      <ProfileSection
        title="Pending Applications"
        color="amber"
        refs={pendingRefs}
        expandedId={expandedId}
        toggleExpand={toggleExpand}
      />
    </div>
  );
};

interface ProfileSectionProps {
  title: string;
  color: string;
  refs: RefereeProfile[];
  expandedId: string | null;
  toggleExpand: (uid: string) => void;
}

// ---------------------------
// 📦 Profile Section
// ---------------------------
const ProfileSection: React.FC<ProfileSectionProps> = ({ title, color, refs, expandedId, toggleExpand }) => (
  <section>
    <div className="flex items-center gap-4 mb-6">
      <h3 className={`text-xl font-bold text-gray-800`}>{title}</h3>
     <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
  color === 'emerald' 
    ? 'bg-emerald-100 text-emerald-700' 
    : 'bg-amber-100 text-amber-700'
}`}>
  {refs.length} Total
</span>
    </div>
    {refs.length === 0 ? (
      <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-400">
        No {title.toLowerCase()} found.
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-4">
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
// 🧱 Referee Card (Exec View) - UPDATED WITH LIVE TOGGLE LOGIC
// ---------------------------
const RefereeCard: React.FC<{
  referee: RefereeProfile;
  expanded: boolean;
  onToggle: () => void;
}> = ({ referee, expanded, onToggle }) => {
  
  const isAvailable = referee.availabilityStatus === "Available";

  const handleStatusUpdate = async (field: string, value: any) => {
    try {
      const updateData = { [field]: value, updatedAt: serverTimestamp() };
      await updateDoc(doc(db, "referees", referee.uid), updateData);
      await updateDoc(doc(db, "users", referee.uid), updateData);
      
      toast({
        title: "Status Updated",
        description: `${referee.firstName}'s ${field} is now ${value}`,
      });
    } catch (err) {
      console.error("Update error:", err);
      toast({ variant: "destructive", title: "Update Failed" });
    }
  };

  return (
    <motion.div
      layout
      className={`rounded-2xl border-2 transition-all ${
        expanded ? "shadow-lg border-emerald-500" : "border-gray-100 hover:border-gray-200"
      } bg-white overflow-hidden`}
    >
      <div
        onClick={onToggle}
        className="flex flex-wrap justify-between items-center cursor-pointer p-5 gap-4"
      >
        <div className="flex items-center gap-4">
          {/* LIVE STATUS INDICATOR */}
          <div className="relative">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-400">
              {referee.firstName?.[0]}{referee.surname?.[0]}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white animate-pulse ${isAvailable ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>

          <div>
            <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight">
              {referee.firstName} {referee.surname}
            </h4>
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-gray-400">
              <span className={isAvailable ? "text-emerald-600" : "text-red-500"}>
                {isAvailable ? "● Live & Available" : "○ Unavailable"}
              </span>
              <span>•</span>
              <span>{referee.experienceLevel || "Level TBD"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
           {referee.currentLocation?.address && (
              <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                <MapPin size={10} /> {referee.currentLocation.address.split(',')[0]}
              </div>
            )}
            <Button variant="ghost" size="sm" className="font-bold text-gray-400">
              {expanded ? "Collapse" : "Manage"}
            </Button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t bg-gray-50/50 p-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact & Compliance</p>
                <p><strong>Email:</strong> {referee.email}</p>
                <p><strong>BokSmart:</strong> {referee.boksmartNumber || "Missing"}</p>
                <p><strong>Expiry:</strong> {referee.boksmartExpiry || "N/A"}</p>
              </div>
              
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sizing & Kit</p>
                <p><strong>Jersey:</strong> {referee.refJerseySize || "—"}</p>
                <p><strong>Shorts:</strong> {referee.shortSize || "—"}</p>
                <p><strong>Fit:</strong> {referee.preferredFit || "Standard"}</p>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Executive Actions</p>
                <div className="flex flex-col gap-2">
                  {!referee.approved ? (
                    <Button 
                      className="bg-emerald-600 w-full rounded-xl font-bold" 
                      onClick={() => handleStatusUpdate("approved", true)}
                    >
                      <CheckCircle2 className="mr-2 w-4 h-4" /> Approve Official
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="text-red-600 border-red-100 hover:bg-red-50 w-full rounded-xl font-bold"
                      onClick={() => handleStatusUpdate("approved", false)}
                    >
                      <XCircle className="mr-2 w-4 h-4" /> Suspend Account
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};