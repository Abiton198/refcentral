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

// Collections that hold team manager records. They are queried side by side and
// merged by user id, because Firestore cannot query two collections at once.
// When a manager exists in several, the FIRST listed wins for display, and an
// approval updates every copy. Remove an entry if you only use one.
const MANAGER_SOURCES = [
  "team_registrations",
  "team_manager_profiles",
  "team_managers",
];

// Document ID is the user's uid in team_managers; other collections may store
// it as a field instead.
const uidOf = (docId: string, data: any): string =>
  data?.uid ?? data?.userId ?? docId;

type Status = "pending" | "active" | "rejected" | "suspended";
type Filter = Status | "all";

interface TeamManager {
  uid: string;
  /** Every document this manager exists in, so approvals update all copies */
  refs: { source: string; id: string }[];
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
  const [uidsBySource, setUidsBySource] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const unsubs = MANAGER_SOURCES.map((source) =>
      onSnapshot(
        query(collection(db, source), where("status", "==", "pending")),
        (snap) =>
          setUidsBySource((prev) => ({
            ...prev,
            [source]: snap.docs.map((d) => uidOf(d.id, d.data())),
          })),
        (err) => {
          console.error(`${source} pending listener failed:`, err.code);
          setUidsBySource((prev) => ({ ...prev, [source]: [] }));
        }
      )
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  // The same manager in both collections counts once
  return new Set(Object.values(uidsBySource).flat()).size;
};

const TeamManagerManagement: React.FC = () => {
  const [docsBySource, setDocsBySource] = useState<
    Record<string, { id: string; data: any }[]>
  >({});
  const [loadedSources, setLoadedSources] = useState<Set<string>>(new Set());
  const [sourceErrors, setSourceErrors] = useState<Record<string, string>>({});
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const loading = loadedSources.size < MANAGER_SOURCES.length;
  const error = Object.keys(sourceErrors).length
    ? Object.entries(sourceErrors)
      .map(([source, code]) => `${source}: ${code}`)
      .join(" • ")
    : null;

  // Merge the per-collection documents into one record per manager
  const managers = useMemo<TeamManager[]>(() => {
    const byUid = new Map<string, TeamManager>();
    MANAGER_SOURCES.forEach((source) => {
      (docsBySource[source] ?? []).forEach(({ id, data }) => {
        const uid = uidOf(id, data);
        const existing = byUid.get(uid);
        if (!existing) {
          byUid.set(uid, { ...data, uid, refs: [{ source, id }] });
        } else {
          // Earlier collections win; later ones only fill in missing fields
          byUid.set(uid, {
            ...data,
            ...existing,
            uid,
            refs: [...existing.refs, { source, id }],
          });
        }
      });
    });
    return Array.from(byUid.values());
  }, [docsBySource]);

  useEffect(() => {
    const unsubManagers = MANAGER_SOURCES.map((source) =>
      onSnapshot(
        collection(db, source),
        (snap) => {
          setDocsBySource((prev) => ({
            ...prev,
            [source]: snap.docs.map((d) => ({ id: d.id, data: d.data() })),
          }));
          setSourceErrors((prev) => {
            const { [source]: _cleared, ...rest } = prev;
            return rest;
          });
          setLoadedSources((prev) => new Set(prev).add(source));
        },
        (err) => {
          console.error(`${source} listener failed:`, err.code, err.message);
          setSourceErrors((prev) => ({ ...prev, [source]: err.code }));
          setLoadedSources((prev) => new Set(prev).add(source));
        }
      )
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
      unsubManagers.forEach((u) => u());
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
      m.refs.forEach(({ source, id }) => {
        batch.update(doc(db, source, id), changes);
      });

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
            className={`px-3 py-1.5 rounded-full text-sm border transition ${filter === key
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
          Could not load some team manager records ({error}). Check that your
          executive account has the executive role and that the latest Firestore
          rules are published for each collection.
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
                {detail("Mobile", m.mobileNumber || m.mobile || "-")}
                {detail("Alt. contact", m.altContact || m.alternativeContact || "-")}
                {detail("Registered", fmtDate(m.createdAt))}
              </div>

              {/* Team represented */}
              <div className="rounded-lg bg-gray-50 p-3 mb-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Team represented
                </p>

                {(() => {
                  const teamData = team || {};

                  const fields = [
                    {
                      label: "Team",
                      value:
                        teamData.name ||
                        teamData.teamName ||
                        m.teamName ||
                        "",
                    },

                    {
                      label: "Team type",
                      value: teamData.teamType || teamData.type || "",
                    },
                    {
                      label: "Age group",
                      value: teamData.ageGroup || teamData.age_group || "",
                    },

                    {
                      label: "League",
                      value: teamData.league || "",
                    },
                    {
                      label: "Home ground",
                      value: teamData.homeGround || teamData.home_ground || "",
                    },
                    {
                      label: "City",
                      value: teamData.city || "",
                    },
                    {
                      label: "Colours",
                      value: teamData.colours || teamData.colors || "",
                    },
                  ];

                  const hasTeamDetails = fields.some(
                    ({ value }) =>
                      value !== undefined &&
                      value !== null &&
                      String(value).trim() !== ""
                  );

                  if (!hasTeamDetails) {
                    return (
                      <p className="text-sm text-gray-500">
                        No team details available. Check that this member is linked to a
                        team and that the team record has been loaded.
                      </p>
                    );
                  }

                  return fields.map(({ label, value }) => (
                    <React.Fragment key={label}>
                      {value !== undefined &&
                        value !== null &&
                        String(value).trim() !== "" &&
                        detail(label, value)}
                    </React.Fragment>
                  ));
                })()}
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