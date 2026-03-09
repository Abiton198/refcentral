"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAppointmentPush = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();
exports.sendAppointmentPush = (0, firestore_1.onDocumentCreated)("appointments/{appointmentId}", async (event) => {
    var _a, _b;
    const snap = event.data;
    if (!snap) {
        console.log("No snapshot data");
        return;
    }
    const appointment = snap.data();
    const appointmentId = event.params.appointmentId;
    if (!(appointment === null || appointment === void 0 ? void 0 : appointment.refereeUid)) {
        console.log("No referee UID assigned");
        return;
    }
    try {
        const refereeDoc = await admin
            .firestore()
            .collection("users")
            .doc(appointment.refereeUid)
            .get();
        if (!refereeDoc.exists) {
            console.log("Referee not found");
            return;
        }
        const tokens = ((_a = refereeDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens) || [];
        if (tokens.length === 0) {
            console.log("No FCM tokens for referee");
            return;
        }
        let matchDate = "";
        if ((_b = appointment.matchDate) === null || _b === void 0 ? void 0 : _b.toDate) {
            matchDate = appointment.matchDate.toDate().toLocaleString("en-ZA");
        }
        else {
            matchDate = new Date(appointment.matchDate).toLocaleString("en-ZA");
        }
        const message = {
            notification: {
                title: "🏉 New Referee Appointment",
                body: `${appointment.homeTeam} vs ${appointment.awayTeam} • ${appointment.venue} • ${matchDate}`,
            },
            data: {
                appointmentId: String(appointmentId),
                type: "appointment",
                homeTeam: String(appointment.homeTeam || ""),
                awayTeam: String(appointment.awayTeam || ""),
                venue: String(appointment.venue || ""),
            },
            tokens,
        };
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Push sent: ${response.successCount} success / ${response.failureCount} failed`);
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                failedTokens.push(tokens[idx]);
            }
        });
        if (failedTokens.length > 0) {
            await admin.firestore()
                .collection("users")
                .doc(appointment.refereeUid)
                .update({
                fcmTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
            });
            console.log("Removed invalid tokens:", failedTokens.length);
        }
    }
    catch (error) {
        console.error("Error sending push:", error);
    }
});
//# sourceMappingURL=index.js.map