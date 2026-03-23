import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MapPin, Clock, CheckCircle2,
    AlertTriangle, Droplets, Zap, BookOpen,
    Navigation, Flag, Timer, Smile
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/textarea';
import { db } from "../../lib/firebase";
import { doc, updateDoc, collection, query, where, limit, onSnapshot } from "firebase/firestore";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

interface Appointment {
    id: string;
    homeTeam: string;
    awayTeam: string;
    venue: string;
    time: string;
    date: string;
}

const MatchAppointmentModal: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [user, setUser] = useState<User | null>(null);
    const [pendingAppointment, setPendingAppointment] = useState<Appointment | null>(null);
    const [view, setView] = useState<'offer' | 'reject' | 'reminder'>('offer');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- 1. AUTH LISTENER ---
    useEffect(() => {
        const auth = getAuth();
        const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubAuth();
    }, []);


    useEffect(() => {
        if (!user?.uid) return;

        // We query the collection but filter the logic in the snapshot 
        // to handle both Referee and AR roles easily.
        const q = query(
            collection(db, "appointments"),
            where("status", "==", "pending")
        );

        const unsubSnap = onSnapshot(q, (snap) => {
            const myPendingMatch = snap.docs.find(doc => {
                const data = doc.data();
                // Show if I am the Referee OR the AR
                return data.refereeId === user.uid || data.arId === user.uid;
            });

            if (myPendingMatch) {
                setPendingAppointment({ id: myPendingMatch.id, ...myPendingMatch.data() } as Appointment);
                setView('offer');
            } else {
                setPendingAppointment(null);
            }
        });

        return () => unsubSnap();
    }, [user?.uid]);

    // --- 3. ACTIONS ---
    const handleAccept = async () => {
        if (!pendingAppointment) return;
        setIsSubmitting(true);
        try {
            const ref = doc(db, "appointments", pendingAppointment.id);
            await updateDoc(ref, {
                status: "accepted",
                acceptedAt: new Date()
            });
            // onSnapshot will automatically close the modal
        } catch (error) {
            console.error("Accept Error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!pendingAppointment || !reason) return;
        setIsSubmitting(true);
        try {
            const ref = doc(db, "appointments", pendingAppointment.id);
            await updateDoc(ref, {
                status: "rejected",
                rejectionReason: reason,
                rejectedAt: new Date()
            });
            setReason('');
        } catch (error) {
            console.error("Reject Error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const reminders = [
        { icon: <Clock size={16} />, text: "Arrive at least 1hr before kick-off" },
        { icon: <Droplets size={16} />, text: "Carry sufficient hydration liquids" },
        { icon: <Zap size={16} />, text: "Proper warm-up routine" },
        { icon: <BookOpen size={16} />, text: "Review Laws of the Game" },
        { icon: <Navigation size={16} />, text: "Plan travel route early" },
        { icon: <CheckCircle2 size={16} />, text: "Upload results immediately after" },
    ];

    // --- RENDER ---
    return (
        <AnimatePresence>
            {pendingAppointment && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border-4 border-slate-900"
                    >
                        {/* HEADER */}
                        <div className="bg-slate-900 p-6 text-white text-center">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2">
                                New Appointment Assigned
                            </p>
                            <div className="flex items-center justify-center gap-4 flex-wrap">
                                <span className="font-black uppercase text-sm">{pendingAppointment.homeTeam}</span>
                                <span className="italic text-slate-500 font-bold">VS</span>
                                <span className="font-black uppercase text-sm">{pendingAppointment.awayTeam}</span>
                            </div>
                            <div className="flex flex-wrap justify-center gap-4 mt-4 opacity-70">
                                <div className="flex items-center gap-1 text-[10px] font-bold uppercase">
                                    <MapPin size={12} /> {pendingAppointment.venue}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] font-bold uppercase">
                                    <Clock size={12} /> {pendingAppointment.date} @ {pendingAppointment.time}
                                </div>
                            </div>
                        </div>

                        <div className="p-8">
                            {/* OFFER VIEW */}
                            {view === 'offer' && (
                                <div className="text-center space-y-6">
                                    <div className="space-y-2">
                                        <h2 className="text-xl font-black italic uppercase text-slate-800">Confirm Availability</h2>
                                        <p className="text-xs text-slate-500 font-medium leading-relaxed px-4">
                                            Do you accept this appointment as the Match Official?
                                        </p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button
                                            onClick={() => setView('reject')}
                                            variant="outline"
                                            className="flex-1 h-14 rounded-2xl border-2 font-bold"
                                        >
                                            REJECT
                                        </Button>
                                        <Button
                                            onClick={() => setView('reminder')}
                                            className="flex-1 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black italic uppercase"
                                        >
                                            ACCEPT MATCH
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* REJECTION VIEW */}
                            {view === 'reject' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-red-500 mb-2">
                                        <AlertTriangle size={18} />
                                        <span className="text-[10px] font-black uppercase">Reason for Rejection</span>
                                    </div>
                                    <Textarea
                                        placeholder="e.g. Injury, Travel issues..."
                                        className="w-full min-h-[120px] rounded-2xl bg-slate-50 border-none"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Button variant="ghost" onClick={() => setView('offer')}>Back</Button>
                                        <Button
                                            disabled={!reason || isSubmitting}
                                            onClick={handleReject}
                                            className="flex-1 bg-red-600 text-white font-black rounded-xl h-12"
                                        >
                                            {isSubmitting ? "Submitting..." : "SUBMIT REJECTION"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* REMINDERS VIEW */}
                            {view === 'reminder' && (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <div className="bg-emerald-100 text-emerald-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Smile size={24} />
                                        </div>
                                        <h2 className="text-lg font-black text-slate-800 uppercase italic">Match Day Reminders</h2>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                        {reminders.map((r, i) => (
                                            <div key={i} className="flex items-center gap-3 text-slate-600">
                                                <div className="text-emerald-500">{r.icon}</div>
                                                <span className="text-[10px] font-bold uppercase">{r.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        disabled={isSubmitting}
                                        onClick={handleAccept}
                                        className="w-full h-14 bg-slate-900 text-white font-black rounded-2xl"
                                    >
                                        {isSubmitting ? "Confirming..." : "I UNDERSTAND & CONFIRM"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default MatchAppointmentModal;