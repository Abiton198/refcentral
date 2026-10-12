import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { toast } from "@/components/ui/use-toast";

/*
 * Executive view of team manager onboarding.
 *
 * Approving a manager is one atomic batch that activates:
 *   users/{uid}, team_managers/{uid} and teams/{teamId}
 * and (optionally) creates a team_memberships record.
 */

// Set to false if approval should NOT create a team_memberships record.
// NOTE: the membership field names below (userId, teamId, role...) are an
// assumption. Adjust them to match your existing team_memberships documents.
const CREATE_MEMBERSHIP_ON_APPROVE = true;

type Status = "pending" | "active" | "rejected" | "suspended";
type Filter = Status | "all";

interface TeamManager {
  uid: string;
  displayName?: string;
  email?: string;
  mobileNumber?: string;
  altContact?: string;
  approved?: boolean;
  status?: string;
  teamId?: string;
  teamName?: string;
  rejectionReason?: string;
  createdAt?: any;
}

interface Team {
  id: string;
  name?: string;
  clubName?: string;
  teamType?: string;
  ageGroup?: string;
  division?: string;
  homeGround?: string;
  city?: string;
  colours?: string;
  status?: string;
}

const statusOf = (m: TeamManager): Status =>
  (m.status as Status) ?? (m.approved ? "active" : "pending");

const BADGE: Record<Status, string> = {
  pending: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  suspended: "bg-gray-200 text-gray-700",
};

const fmtDate = (ts: any) =>
  ts?.toDate ? ts.toDate().toLocaleDateString() : "";

/** Live count of pending team managers, for a badge on the dashboard tab. */
export const usePendingTeamManagerCount = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const q = query(
      collection(db, "team_managers"),
      where("status", "==", "pending")
    );
    return onSnapshot(
      q,
      (snap) => setCount(snap.size),
      () => setCount(0)
    );
  }, []);
  return count;
};

const TeamManagerManagement: React.FC = () => {
  const [managers, setManagers] = useState<TeamManager[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubManagers = onSnapshot(
      collection(db, "team_managers"),
      (snap) => {
        setManagers(
          snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }))
        );
        setLoading(false);
      },
      (err) => {
        console.error("team_managers listener failed:", err.code, err.message);
        setError(`${err.code}: ${err.message}`);
        setLoading(false);
      }
    );

    const unsubTeams = onSnapshot(
      collection(db, "teams"),
      (snap) => {
        const map: Record<string, Team> = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as any) };
        });
        setTeams(map);
      },
      (err) => console.error("teams listener failed:", err.code, err.message)
    );

    return () => {
      unsubManagers();
      unsubTeams();
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: managers.length,
      pending: 0,
      active: 0,
      rejected: 0,
      suspended: 0,
    };
    managers.forEach((m) => {
      c[statusOf(m)] += 1;
    });
    return c;
  }, [managers]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return managers
      .filter((m) => filter === "all" || statusOf(m) === filter)
      .filter((m) => {
        if (!term) return true;
        const t = m.teamId ? teams[m.teamId] : undefined;
        return [
          m.displayName,
          m.email,
          m.teamName,
          t?.name,
          t?.clubName,
          t?.city,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      })
      .sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
      );
  }, [managers, teams, filter, search]);

  const setManagerStatus = async (
    m: TeamManager,
    next: Status,
    reason?: string
  ) => {
    setBusyUid(m.uid);
    try {
      const reviewer = auth.currentUser?.uid ?? null;
      const changes: Record<string, unknown> = {
        approved: next === "active",
        status: next,
        reviewedBy: reviewer,
        reviewedAt: serverTimestamp(),
      };
      if (next === "rejected") changes.rejectionReason = reason ?? "";

      const batch = writeBatch(db);
      batch.update(doc(db, "users", m.uid), changes);
      batch.update(doc(db, "team_managers", m.uid), changes);

      // Activate or reject the team together with its manager.
      // Suspending a manager does not suspend the team itself.
      if (
        (next === "active" || next === "rejected") &&
        m.teamId &&
        teams[m.teamId]
      ) {
        batch.update(doc(db, "teams", m.teamId), {
          approved: next === "active",
          status: next,
          reviewedBy: reviewer,
          reviewedAt: serverTimestamp(),
        });
      }

      if (next === "active" && CREATE_MEMBERSHIP_ON_APPROVE && m.teamId) {
        batch.set(
          doc(db, "team_memberships", `${m.uid}_${m.teamId}`),
          {
            userId: m.uid,
            teamId: m.teamId,
            teamName: m.teamName ?? teams[m.teamId]?.name ?? "",
            role: "team_manager",
            status: "active",
            createdBy: reviewer,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();

      toast({
        title:
          next === "active"
            ? "✅ Team manager approved"
            : next === "rejected"
              ? "Registration rejected"
              : "Access suspended",
        description: m.displayName || m.email || m.uid,
      });
    } catch (err: any) {
      console.error("Status change failed:", err.code, err.message, err);
      toast({
        title: "Could not update team manager",
        description: `${err.code || "error"}: ${err.message}`,
        variant: "destructive",
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleApprove = (m: TeamManager) => {
    const team = m.teamName || (m.teamId && teams[m.teamId]?.name) || "no team on file";
    if (
      window.confirm(
        `Approve ${m.displayName || m.email} as manager of "${team}"?`
      )
    ) {
      setManagerStatus(m, "active");
    }
  };

  const handleReject = (m: TeamManager) => {
    const reason = window.prompt(
      "Reason for rejecting (shown to the applicant):"
    );
    if (reason === null) return; // cancelled
    setManagerStatus(m, "rejected", reason.trim());
  };

  const handleSuspend = (m: TeamManager) => {
    if (window.confirm(`Suspend access for ${m.displayName || m.email}?`)) {
      setManagerStatus(m, "suspended");
    }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "active", label: "Active" },
    { key: "rejected", label: "Rejected" },
    { key: "suspended", label: "Suspended" },
    { key: "all", label: "All" },
  ];

  const detail = (label: string, value?: string) =>
    value ? (
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-900 text-right">{value}</span>
      </div>
    ) : null;

  return (
    <div className="text-left">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Team Manager Onboarding
        </h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, team, club or city"
          className="border rounded-lg px-3 py-2 text-sm w-full md:w-80"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              filter === key
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400"
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-4">
          Could not load team managers ({error}). Check that your executive
          account has the executive role and that the latest Firestore rules are
          published.
        </p>
      )}

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      {!loading && !error && visible.length === 0 && (
        <p className="text-gray-500 text-sm">
          No team managers in this view.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visible.map((m) => {
          const status = statusOf(m);
          const team = m.teamId ? teams[m.teamId] : undefined;
          const busy = busyUid === m.uid;

          return (
            <div key={m.uid} className="border rounded-xl p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {m.displayName || "Unnamed manager"}
                  </p>
                  <p className="text-xs text-gray-500">{m.email}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${BADGE[status]}`}
                >
                  {status}
                </span>
              </div>

              <div className="space-y-1 mb-3">
                {detail("Mobile", m.mobileNumber)}
                {detail("Alt. contact", m.altContact)}
                {detail("Registered", fmtDate(m.createdAt))}
              </div>

              <div className="rounded-lg bg-gray-50 p-3 mb-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Team represented
                </p>
                {team || m.teamName ? (
                  <>
                    {detail("Team", team?.name || m.teamName)}
                    {detail("Club / school", team?.clubName)}
                    {detail("Type", team?.teamType)}
                    {detail("Age group", team?.ageGroup)}
                    {detail("Division", team?.division)}
                    {detail("Home ground", team?.homeGround)}
                    {detail("City", team?.city)}
                    {detail("Colours", team?.colours)}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    No team on file for this manager.
                  </p>
                )}
              </div>

              {status === "rejected" && m.rejectionReason && (
                <p className="text-sm text-red-700 mb-3">
                  Rejected: {m.rejectionReason}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {(status === "pending" ||
                  status === "rejected" ||
                  status === "suspended") && (
                  <button
                    onClick={() => handleApprove(m)}
                    disabled={busy}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {status === "pending" ? "Approve" : "Reinstate"}
                  </button>
                )}
                {status === "pending" && (
                  <button
                    onClick={() => handleReject(m)}
                    disabled={busy}
                    className="px-4 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm hover:bg-red-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
                {status === "active" && (
                  <button
                    onClick={() => handleSuspend(m)}
                    disabled={busy}
                    className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 border border-gray-300 text-sm hover:bg-gray-200 disabled:opacity-50"
                  >
                    Suspend access
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamManagerManagement;