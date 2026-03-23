import { motion, AnimatePresence } from "framer-motion";

export default function AppointmentAlert({ appointment, onOpen }) {

    return (
        <AnimatePresence>
            {appointment && (
                <motion.div
                    initial={{ y: -80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -80, opacity: 0 }}
                    className="fixed top-4 left-4 right-4 bg-white shadow-xl border rounded-xl p-4 z-[9999]"
                >
                    <h3 className="font-bold text-sm">
                        🏉 New Appointment Assigned
                    </h3>

                    <p className="text-xs text-gray-500">
                        {appointment.homeTeam} vs {appointment.awayTeam}
                    </p>

                    <button
                        onClick={() => {
                            console.log("VIEW MATCH CLICKED");

                            if (onOpen) {
                                onOpen();
                            } else {
                                console.warn("onOpen not passed!");
                            }
                        }}
                        className="text-emerald-600 text-sm font-bold mt-2 py-2"
                    >
                        VIEW MATCH
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}