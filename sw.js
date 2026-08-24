/* =========================================================
   SPEECH TRACKER SERVICE WORKER
   ========================================================= */


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener(
    "install",
    event => {

        /*
            Activate immediately instead of waiting
            for old tabs to close.
        */

        self.skipWaiting();

    }
);


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(
            self.clients.claim()
        );

    }
);


/* =========================================================
   NOTIFICATION CLICK
   ========================================================= */

self.addEventListener(
    "notificationclick",
    event => {

        /*
            Close the notification immediately.
        */

        event.notification.close();


        const targetURL =
            event.notification
                ?.data
                ?.url ||
            "/";


        event.waitUntil(

            self.clients
                .matchAll(
                    {
                        type:
                            "window",

                        includeUncontrolled:
                            true
                    }
                )
                .then(
                    clients => {

                        /*
                            If Speech Tracker is already
                            open, focus that tab/window.
                        */

                        for (
                            const client of clients
                        ) {

                            if (
                                "focus" in
                                client
                            ) {

                                return client.focus();

                            }

                        }


                        /*
                            Otherwise open Speech Tracker.
                        */

                        if (
                            self.clients
                                .openWindow
                        ) {

                            return self.clients
                                .openWindow(
                                    targetURL
                                );

                        }

                    }
                )

        );

    }
);


/* =========================================================
   NOTIFICATION CLOSE
   ========================================================= */

self.addEventListener(
    "notificationclose",
    event => {

        /*
            Nothing needs to happen here.

            This listener simply exists so notification
            close events can be handled later if needed.
        */

        console.log(
            "Speech Tracker notification closed."
        );

    }
);