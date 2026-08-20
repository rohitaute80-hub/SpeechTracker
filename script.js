// ===============================
// SpeechRing
// Simple phone vibration prototype
// ===============================


// Get elements from the HTML
const statusText = document.getElementById("status");
const statusDot = document.getElementById("statusDot");
const heardText = document.getElementById("heard");

const listenButton = document.getElementById("listenButton");
const commandInput = document.getElementById("commandInput");
const sendButton = document.getElementById("sendButton");


// ===============================
// VIBRATION PATTERNS
// ===============================

const vibrationPatterns = {
    short: [150],
    double: [150, 100, 150],
    long: [600],
    alert: [150, 100, 150, 100, 500]
};


// ===============================
// STATUS
// ===============================

function setStatus(message, state = "ready") {

    statusText.textContent = message;

    statusDot.className = "dot " + state;
}


// ===============================
// DISPLAY TEXT
// ===============================

function showMessage(message) {

    heardText.textContent = message;
}


// ===============================
// VIBRATE
// ===============================

function vibrate(pattern) {

    // Check browser support
    if (!navigator.vibrate) {

        setStatus(
            "Vibration not supported",
            "error"
        );

        showMessage(
            "Your phone/browser does not support vibration."
        );

        return;
    }


    // Stop previous vibration
    navigator.vibrate(0);


    // Start vibration
    navigator.vibrate(pattern);


    setStatus(
        "Vibrating...",
        "listening"
    );


    // Return to ready
    setTimeout(function () {

        setStatus(
            "Ready",
            "ready"
        );

    }, 1000);
}


// ===============================
// RUN PATTERN
// ===============================

function runPattern(name) {

    if (!vibrationPatterns[name]) {
        return;
    }


    showMessage(
        "Vibration: " + name
    );


    vibrate(
        vibrationPatterns[name]
    );
}


// ===============================
// BUTTONS
// ===============================

const patternButtons =
    document.querySelectorAll(
        "[data-pattern]"
    );


patternButtons.forEach(function (button) {

    button.addEventListener(
        "click",
        function () {

            const pattern =
                button.dataset.pattern;

            runPattern(pattern);

        }
    );

});


// ===============================
// TEXT COMMANDS
// ===============================

function processCommand(text) {

    const command =
        text.toLowerCase().trim();


    if (command === "") {

        showMessage(
            "Please enter a command."
        );

        return;
    }


    showMessage(
        "Command: " + text
    );


    // STOP
    if (
        command === "stop" ||
        command.includes("stop vibrating")
    ) {

        navigator.vibrate(0);

        setStatus(
            "Stopped",
            "ready"
        );

        showMessage(
            "Vibration stopped."
        );

        return;
    }


    // DOUBLE
    if (
        command.includes("double")
    ) {

        runPattern("double");

        return;
    }


    // LONG
    if (
        command.includes("long")
    ) {

        runPattern("long");

        return;
    }


    // ALERT
    if (
        command.includes("alert")
    ) {

        runPattern("alert");

        return;
    }


    // NORMAL VIBRATION
    if (
        command.includes("vibrate") ||
        command.includes("buzz") ||
        command.includes("ring")
    ) {

        runPattern("short");

        return;
    }


    // UNKNOWN
    setStatus(
        "Unknown command",
        "error"
    );

}


// ===============================
// SEND BUTTON
// ===============================

sendButton.addEventListener(
    "click",
    function () {

        processCommand(
            commandInput.value
        );

    }
);


// ===============================
// ENTER KEY
// ===============================

commandInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {

            processCommand(
                commandInput.value
            );

        }

    }
);


// ===============================
// SPEECH RECOGNITION
// ===============================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


// Check whether browser supports speech
if (SpeechRecognition) {

    const recognition =
        new SpeechRecognition();


    recognition.lang =
        "en-US";


    recognition.continuous =
        false;


    recognition.interimResults =
        false;


    recognition.maxAlternatives =
        1;


    // Listen button
    listenButton.addEventListener(
        "click",
        function () {

            setStatus(
                "Listening...",
                "listening"
            );


            showMessage(
                "Say a command..."
            );


            try {

                recognition.start();

            }

            catch (error) {

                console.log(
                    "Speech recognition already running."
                );

            }

        }
    );


    // Speech result
    recognition.addEventListener(
        "result",
        function (event) {

            const result =
                event.results[0][0];


            const text =
                result.transcript;


            processCommand(text);

        }
    );


    // Speech error
    recognition.addEventListener(
        "error",
        function (event) {

            console.log(
                "Speech error:",
                event.error
            );


            setStatus(
                "Speech error",
                "error"
            );


            showMessage(
                "Could not understand speech."
            );

        }
    );


    // Speech finished
    recognition.addEventListener(
        "end",
        function () {

            if (
                statusText.textContent ===
                "Listening..."
            ) {

                setStatus(
                    "Ready",
                    "ready"
                );

            }

        }
    );

}


// Speech isn't supported
else {

    listenButton.addEventListener(
        "click",
        function () {

            setStatus(
                "Speech unavailable",
                "error"
            );


            showMessage(
                "Speech recognition is not supported by this browser."
            );

        }
    );

}


// ===============================
// STARTUP
// ===============================

setStatus(
    "Ready",
    "ready"
);

showMessage(
    "Tap Listen or choose a vibration pattern."
);