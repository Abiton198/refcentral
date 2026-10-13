/* public/firebase-messaging-sw.js */

/* Firebase compat libraries for service workers */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");


/* ------------------------------------------------
   Firebase configuration
   (Values injected from Vite .env during build)
------------------------------------------------ */

const p = new URL(self.location.href).searchParams;

firebase.initializeApp({
    apiKey: p.get("apiKey"),
    authDomain: p.get("authDomain"),
    projectId: p.get("projectId"),
    storageBucket: p.get("storageBucket"),
    messagingSenderId: p.get("messagingSenderId"),
    appId: p.get("appId"),
});


/* ------------------------------------------------
   Initialize Firebase Messaging
------------------------------------------------ */

const messaging = firebase.messaging();


/* ------------------------------------------------
   Handle background push notifications
------------------------------------------------ */

messaging.onBackgroundMessage((payload) => {

    console.log("[firebase-messaging-sw] Background message received:", payload);

    const title =
        payload?.notification?.title ||
        "New Referee Appointment";

    const options = {

        body:
            payload?.notification?.body ||
            "You have received a new appointment.",

        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",

        vibrate: [200, 100, 200],

        tag: "referee-appointment",
        renotify: true,

        data: {
            appointmentId: payload?.data?.appointmentId || null,
            url: payload?.data?.appointmentId
                ? `/appointments/${payload.data.appointmentId}`
                : "/appointments"
        }

    };

    self.registration.showNotification(title, options);

});


/* ------------------------------------------------
   Notification click handling
------------------------------------------------ */

self.addEventListener("notificationclick", (event) => {

    event.notification.close();

    const targetUrl = event.notification?.data?.url || "/";

    event.waitUntil(

        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then((clientList) => {

            for (const client of clientList) {

                if (client.url.includes(targetUrl) && "focus" in client) {
                    return client.focus();
                }

            }

            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }

        })

    );

});