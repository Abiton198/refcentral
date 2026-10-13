import { auth } from "@/lib/firebase";

// Match whatever env var your other API calls use. Example: https://your-api.onrender.com
const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) ?? "";

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new ApiError("You are signed out. Please sign in again.", 401);

    const res = await fetch(`${API_BASE}/api${path}`, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new ApiError(
            data.reason || data.error || `Request failed (${res.status})`,
            res.status
        );
    }
    return data as T;
}

const json = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
});

const photo = (blob: Blob, extra: Record<string, string> = {}): RequestInit => {
    const form = new FormData();
    form.append("image", blob, "photo.jpg");
    Object.entries(extra).forEach(([k, v]) => form.append(k, v));
    return { method: "POST", body: form };
};

export type IdentityStatus = "none" | "selfie" | "complete" | "needs_review";
export type DocumentType = "sa_id" | "passport" | "birth_certificate" | "other";

// ── Team manager: registration ───────────────────────────────────────────────

export const uploadSelfie = (playerId: string, blob: Blob) =>
    call<{ ok: boolean; identityStatus: IdentityStatus }>(
        `/players/${playerId}/selfie`,
        photo(blob)
    );

export interface IdDocumentResult {
    ok: boolean;
    identityStatus: IdentityStatus;
    idNumber: string | null;
    dateOfBirth: string | null;
    gender: "male" | "female" | null;
}

export const uploadIdDocument = (
    playerId: string,
    blob: Blob,
    documentType: DocumentType
) =>
    call<IdDocumentResult>(
        `/players/${playerId}/id-document`,
        photo(blob, { documentType })
    );

export const saveIdentity = (
    playerId: string,
    body: { idNumber: string; documentType: DocumentType; dateOfBirth: string }
) =>
    call<{ ok: boolean; dobMatchesId: boolean | null }>(`/players/${playerId}/identity`, {
        ...json(body),
        method: "PUT",
    });

export const getTeamPlayerPhotos = (teamId: string) =>
    call<{ urls: Record<string, string> }>(`/teams/${teamId}/player-photos`);

// ── Referee: match day ───────────────────────────────────────────────────────

export interface RosterPlayer {
    id: string;
    teamId: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth?: string;
    position?: string;
    jerseyNumber?: number;
    identityStatus: IdentityStatus;
    hasPhoto: boolean;
    photoUrl: string | null;
    suspension: { active: boolean; endDate?: string; cardType?: string };
    checkin: { result: string; score: number | null; method: string } | null;
}

export interface MatchRoster {
    matchId: string;
    matchDate: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeam: string;
    awayTeam: string;
    players: RosterPlayer[];
}

export const getMatchRoster = (matchId: string) =>
    call<MatchRoster>(`/matches/${matchId}/roster`);

export const verifyPlayer = (matchId: string, playerId: string, blob: Blob) =>
    call<{ ok: boolean; result: "verified" | "uncertain" | "mismatch"; score: number }>(
        `/matches/${matchId}/players/${playerId}/verify`,
        photo(blob)
    );

export const manualCheck = (matchId: string, playerId: string, reason: string) =>
    call<{ ok: boolean }>(
        `/matches/${matchId}/players/${playerId}/manual-check`,
        json({ reason })
    );

export const issueCard = (
    matchId: string,
    playerId: string,
    cardType: "yellow" | "red",
    reason: string
) =>
    call<{ ok: boolean; suspension: { endDate: string } | null }>(
        `/matches/${matchId}/players/${playerId}/card`,
        json({ cardType, reason })
    );