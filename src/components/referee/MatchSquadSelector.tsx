import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/use-toast";
import CameraCapture from "./CameraCapture";
import {
    ApiError,
    MatchRoster,
    RosterPlayer,
    getMatchRoster,
    issueCard,
    manualCheck,
    verifyPlayer,
} from "../../lib/playerIdentityApi";

/*
 * Referee squad selection for ONE team of ONE match.
 *
 *  - Only the registered players of that team are listed (loaded through the
 *    backend roster endpoint, which checks that this referee is appointed).
 *  - Each player is verified with the camera: the live photo is compared with
 *    the photo enrolled at registration. A strong match verifies the player.
 *  - Below the match threshold the referee can retake the photo or confirm
 *    manually with a reason. Every check is logged by the backend.
 *  - Verified players are added to the squad; suspended players cannot be.
 */

export interface SquadPlayer {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    position: string | null;
    jerseyNumber: number | null;
    teamId: string;
    teamName: string;
    verification: { result: string; score: number | null; method: string };
}

type Checkin = NonNullable<RosterPlayer["checkin"]>;

const isVerified = (p: RosterPlayer) =>
    p.checkin?.result === "verified" || p.checkin?.result === "manual";

const fullName = (p: RosterPlayer) =>
    [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");

const toSquadPlayer = (
    p: RosterPlayer,
    teamName: string,
    checkin: Checkin
): SquadPlayer => ({
    id: p.id,
    firstName: p.firstName,
    middleName: p.middleName || null,
    lastName: p.lastName,
    position: p.position ?? null,
    jerseyNumber: p.jerseyNumber ?? null,
    teamId: p.teamId,
    teamName,
    verification: {
        result: checkin.result,
        score: checkin.score ?? null,
        method: checkin.method,
    },
});

const Avatar: React.FC<{ player: RosterPlayer; size?: string }> = ({
    player,
    size = "w-11 h-11",
}) =>
    player.photoUrl ? (
        <img
            src={player.photoUrl}
            alt={fullName(player)}
            className={`${size} rounded-full object-cover bg-gray-200`}
        />
    ) : (
        <div
            className={`${size} rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-black`}
        >
            {player.firstName?.[0] || "?"}
        </div>
    );

/* ────────────────────────── verification sheet ────────────────────────── */

interface SheetProps {
    matchId: string;
    player: RosterPlayer;
    onVerified: (checkin: Checkin) => void;
    onClose: () => void;
}

const PlayerVerifySheet: React.FC<SheetProps> = ({
    matchId,
    player,
    onVerified,
    onClose,
}) => {
    const [stage, setStage] = useState<"capture" | "checking" | "result">("capture");
    const [live, setLive] = useState<string | null>(null);
    const [result, setResult] = useState<{ result: string; score: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [manualOpen, setManualOpen] = useState(!player.hasPhoto);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    const retake = () => {
        setLive(null);
        setResult(null);
        setError(null);
        setStage("capture");
    };

    const handleCapture = async (blob: Blob, url: string) => {
        setLive(url);
        setStage("checking");
        setError(null);
        try {
            const res = await verifyPlayer(matchId, player.id, blob);
            setResult({ result: res.result, score: res.score });
            setStage("result");
            if (res.result === "verified") {
                onVerified({ result: "verified", score: res.score, method: "face" });
            } else {
                setManualOpen(true);
            }
        } catch (e) {
            setError(e instanceof ApiError ? e.message : "Verification failed. Please try again.");
            setLive(null);
            setStage("capture");
        }
    };

    const confirmManually = async () => {
        if (reason.trim().length < 3) {
            setError("Give a short reason for confirming this player manually.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await manualCheck(matchId, player.id, reason.trim());
            onVerified({ result: "manual", score: null, method: "manual" });
            onClose();
        } catch (e) {
            setError(e instanceof ApiError ? e.message : "Could not record the confirmation.");
        } finally {
            setBusy(false);
        }
    };

    const giveCard = async (type: "yellow" | "red") => {
        const entered = window.prompt(
            `${type === "red" ? "Red" : "Yellow"} card for ${fullName(player)}. Reason:`
        );
        if (entered === null) return;
        if (entered.trim().length < 3) {
            toast({ variant: "destructive", title: "Add a short reason for the card" });
            return;
        }
        if (
            type === "red" &&
            !window.confirm(
                `Issue a RED card to ${fullName(player)}? A 14-day suspension will start.`
            )
        ) {
            return;
        }
        try {
            const res = await issueCard(matchId, player.id, type, entered.trim());
            toast({
                title: type === "red" ? "Red card recorded" : "Yellow card recorded",
                description:
                    type === "red" && res.suspension
                        ? `${fullName(player)} is suspended until ${res.suspension.endDate}.`
                        : fullName(player),
            });
        } catch (e) {
            toast({
                variant: "destructive",
                title: "Could not record the card",
                description: e instanceof ApiError ? e.message : undefined,
            });
        }
    };

    const verified = result?.result === "verified";

    return (
        <div className="fixed inset-0 z-[260] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center">
            <div className="bg-white w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <Avatar player={player} size="w-14 h-14" />
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-900 truncate">{fullName(player)}</p>
                        <p className="text-xs text-gray-500">
                            {player.jerseyNumber ? `#${player.jerseyNumber} • ` : ""}
                            {player.position || "Position not set"}
                            {player.dateOfBirth ? ` • DOB ${player.dateOfBirth}` : ""}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 text-xl px-2" aria-label="Close">
                        ✕
                    </button>
                </div>

                {error && (
                    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                        {error}
                    </p>
                )}

                {/* Camera step */}
                {player.hasPhoto && stage === "capture" && (
                    <CameraCapture
                        facing="environment"
                        onCapture={handleCapture}
                        hint="Photograph the player's face, then the app compares it with their registered photo."
                    />
                )}

                {!player.hasPhoto && (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        This player has no registered photo, so they can only be confirmed
                        manually. Ask the team manager to complete their registration.
                    </p>
                )}

                {stage === "checking" && (
                    <div className="text-center py-6 space-y-3">
                        {live && <img src={live} alt="Live" className="w-40 mx-auto rounded-2xl" />}
                        <p className="text-sm text-gray-500">Comparing with the registered photo…</p>
                    </div>
                )}

                {/* Result */}
                {stage === "result" && result && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-center">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Registered</p>
                                {player.photoUrl && (
                                    <img src={player.photoUrl} alt="Registered" className="w-full rounded-2xl object-cover aspect-[3/4]" />
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Live photo</p>
                                {live && (
                                    <img src={live} alt="Live" className="w-full rounded-2xl object-cover aspect-[3/4]" />
                                )}
                            </div>
                        </div>

                        <p
                            className={`text-center font-black ${verified ? "text-emerald-600" : result.result === "uncertain" ? "text-amber-600" : "text-red-600"
                                }`}
                        >
                            {verified
                                ? `✓ Identity confirmed (${result.score}% match)`
                                : result.result === "uncertain"
                                    ? `Not certain (${result.score}% match)`
                                    : `Does not match (${result.score}% match)`}
                        </p>

                        {verified ? (
                            <Button className="w-full bg-emerald-600 h-12 rounded-xl font-bold" onClick={onClose}>
                                Done
                            </Button>
                        ) : (
                            <Button variant="outline" className="w-full rounded-xl font-bold" onClick={retake}>
                                Retake photo
                            </Button>
                        )}
                    </div>
                )}

                {/* Manual confirmation, offered when the match is below threshold */}
                {!verified && manualOpen && (
                    <div className="space-y-2 border-t pt-4">
                        <p className="text-xs font-black text-gray-500 uppercase">Confirm manually</p>
                        <p className="text-xs text-gray-500">
                            Only confirm if you are sure this is the registered player. The reason is
                            recorded against your name.
                        </p>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={2}
                            placeholder="e.g. Checked school ID card, photo is old"
                            className="w-full border rounded-xl p-3 text-sm"
                        />
                        <Button
                            className="w-full bg-slate-900 h-12 rounded-xl font-bold"
                            onClick={confirmManually}
                            disabled={busy}
                        >
                            {busy ? "Saving…" : "Confirm player manually"}
                        </Button>
                    </div>
                )}

                {!verified && !manualOpen && player.hasPhoto && stage === "capture" && (
                    <button
                        onClick={() => setManualOpen(true)}
                        className="w-full text-xs text-gray-500 underline"
                    >
                        Camera not working? Confirm manually
                    </button>
                )}

                {/* Cards */}
                <div className="border-t pt-4">
                    <p className="text-xs font-black text-gray-500 uppercase mb-2">Discipline</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => giveCard("yellow")}
                            className="flex-1 py-2 rounded-xl bg-yellow-400 text-yellow-950 text-sm font-black"
                        >
                            Yellow card
                        </button>
                        <button
                            onClick={() => giveCard("red")}
                            className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-black"
                        >
                            Red card
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ────────────────────────── squad selector ────────────────────────────── */

interface Props {
    matchId: string;
    side: "home" | "away";
    selected: SquadPlayer[];
    onToggle: (player: SquadPlayer) => void;
    onClose: () => void;
}

export const MatchSquadSelector: React.FC<Props> = ({
    matchId,
    side,
    selected,
    onToggle,
    onClose,
}) => {
    const [roster, setRoster] = useState<MatchRoster | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [active, setActive] = useState<RosterPlayer | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setRoster(await getMatchRoster(matchId));
        } catch (e) {
            setError(e instanceof ApiError ? e.message : "Could not load the players.");
        } finally {
            setLoading(false);
        }
    }, [matchId]);

    useEffect(() => {
        load();
    }, [load]);

    const teamId = side === "home" ? roster?.homeTeamId : roster?.awayTeamId;
    const teamName = (side === "home" ? roster?.homeTeam : roster?.awayTeam) || "Team";

    const players = useMemo(
        () =>
            (roster?.players ?? [])
                .filter((p) => p.teamId === teamId)
                .sort(
                    (a, b) =>
                        (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) ||
                        a.lastName.localeCompare(b.lastName)
                ),
        [roster, teamId]
    );

    const isSelected = (id: string) => selected.some((s) => s.id === id);
    const verifiedCount = players.filter(isVerified).length;

    const handleVerified = (player: RosterPlayer, checkin: Checkin) => {
        setRoster((prev) =>
            prev
                ? {
                    ...prev,
                    players: prev.players.map((p) =>
                        p.id === player.id ? { ...p, checkin } : p
                    ),
                }
                : prev
        );
        // A verified player goes straight into the squad
        if (!isSelected(player.id)) onToggle(toSquadPlayer(player, teamName, checkin));
    };

    const checkinBadge = (p: RosterPlayer) => {
        const c = p.checkin;
        if (!c) return <span className="text-gray-400">Not verified</span>;
        if (c.result === "verified")
            return <span className="text-emerald-600">✓ Verified {c.score ? `${c.score}%` : ""}</span>;
        if (c.result === "manual") return <span className="text-blue-600">✓ Confirmed manually</span>;
        if (c.result === "uncertain") return <span className="text-amber-600">Uncertain {c.score}%</span>;
        return <span className="text-red-600">Mismatch {c.score}%</span>;
    };

    return (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-end justify-center">
            <div className="bg-white w-full max-w-lg h-[85vh] rounded-t-[2.5rem] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
                    <div>
                        <h3 className="font-black uppercase">{teamName}</h3>
                        <p className="text-[10px] text-gray-400">
                            {selected.length} in squad • {verifiedCount}/{players.length} verified
                        </p>
                    </div>
                    <Button variant="ghost" className="text-white" onClick={onClose}>
                        ✕
                    </Button>
                </div>

                <div className="px-6 pt-4 text-xs text-gray-500">
                    Verify each player with the camera before adding them to the squad.
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-3 space-y-2">
                    {loading && <p className="text-sm text-gray-500 text-center py-8">Loading players…</p>}

                    {error && (
                        <div className="text-center py-8 space-y-3">
                            <p className="text-sm text-red-700">{error}</p>
                            <Button variant="outline" onClick={load}>
                                Try again
                            </Button>
                        </div>
                    )}

                    {!loading && !error && players.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-8">
                            No registered players for this team yet. The team manager must register
                            players before they can be verified.
                        </p>
                    )}

                    {players.map((p) => {
                        const banned = p.suspension.active;
                        const verified = isVerified(p);
                        const selectedNow = isSelected(p.id);

                        return (
                            <div
                                key={p.id}
                                className={`p-3 rounded-2xl border-2 flex items-center gap-3 ${banned
                                    ? "bg-red-50 border-red-300"
                                    : selectedNow
                                        ? "bg-emerald-50 border-emerald-500"
                                        : "bg-gray-50 border-transparent"
                                    }`}
                            >
                                <Avatar player={p} />

                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-gray-900 truncate">
                                        {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}
                                        {fullName(p)}
                                    </p>
                                    <p className="text-[11px] text-gray-500 truncate">
                                        {p.position || "Position not set"}
                                    </p>
                                    {banned ? (
                                        <p className="text-[11px] font-black text-red-700">
                                            SUSPENDED until {p.suspension.endDate} — cannot play
                                        </p>
                                    ) : (
                                        <p className="text-[11px] font-bold">
                                            {checkinBadge(p)}
                                            {!p.hasPhoto && (
                                                <span className="text-amber-600"> • no registered photo</span>
                                            )}
                                        </p>
                                    )}
                                </div>

                                {!banned && (
                                    <div className="flex flex-col items-end gap-1">
                                        {verified ? (
                                            <>
                                                <button
                                                    onClick={() =>
                                                        onToggle(toSquadPlayer(p, teamName, p.checkin as Checkin))
                                                    }
                                                    className={`px-3 py-1 rounded-full text-xs font-black ${selectedNow
                                                        ? "bg-emerald-600 text-white"
                                                        : "bg-white border border-gray-300 text-gray-700"
                                                        }`}
                                                >
                                                    {selectedNow ? "In squad" : "Add"}
                                                </button>
                                                <button
                                                    onClick={() => setActive(p)}
                                                    className="text-[10px] text-gray-500 underline"
                                                >
                                                    Details
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setActive(p)}
                                                className="px-3 py-1.5 rounded-full text-xs font-black bg-blue-600 text-white"
                                            >
                                                {p.hasPhoto ? "Verify" : "Confirm"}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-6 flex gap-3">
                    <Button variant="outline" className="rounded-xl font-bold" onClick={load} disabled={loading}>
                        Refresh
                    </Button>
                    <Button className="flex-1 bg-emerald-600 h-12 rounded-xl font-bold" onClick={onClose}>
                        Confirm Selection
                    </Button>
                </div>
            </div>

            {active && (
                <PlayerVerifySheet
                    matchId={matchId}
                    player={active}
                    onVerified={(checkin) => handleVerified(active, checkin)}
                    onClose={() => setActive(null)}
                />
            )}
        </div>
    );
};

export default MatchSquadSelector;