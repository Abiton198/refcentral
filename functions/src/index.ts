import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

export const sendAppointmentPush = onDocumentCreated(
    "appointments/{appointmentId}",
    async (event) => {

        const snap = event.data;
        if (!snap) {
            console.log("No snapshot data");
            return;
        }

        const appointment = snap.data();
        const appointmentId = event.params.appointmentId;

        if (!appointment?.refereeUid) {
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

            const tokens: string[] = refereeDoc.data()?.fcmTokens || [];

            if (tokens.length === 0) {
                console.log("No FCM tokens for referee");
                return;
            }

            let matchDate = "";

            if (appointment.matchDate?.toDate) {
                matchDate = appointment.matchDate.toDate().toLocaleString("en-ZA");
            } else {
                matchDate = new Date(appointment.matchDate).toLocaleString("en-ZA");
            }

            const message: admin.messaging.MulticastMessage = {

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

            console.log(
                `Push sent: ${response.successCount} success / ${response.failureCount} failed`
            );

            const failedTokens: string[] = [];

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

        } catch (error) {
            console.error("Error sending push:", error);
        }

    }
);