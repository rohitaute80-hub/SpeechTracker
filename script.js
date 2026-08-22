/* ============================================================
   SPEECH TRACKER
   Complete replacement script.js

   Main improvements:
   - Detects UM / UMM / UMMM / UMMMM live
   - Detects UH / UHH / UHHH / UHHHH live
   - Checks interim speech-recognition results
   - Avoids waiting for final transcription
   - Prevents duplicate notifications for the same utterance
   - Highlights tracked words
   - Tracks custom words
   - Handles notifications
   - Handles vibration
   - Sends final transcript to AI analysis
   - Safely handles invalid AI JSON
   ============================================================ */


/* ============================================================
   CONFIGURATION
   ============================================================ */

const DEFAULT_WORDS = [
    "um",
    "uh",
    "umm",
    "uhh",
    "like",
    "you know",
    "basically",
    "literally",
    "actually"
];

const STORAGE_KEY = "speechTrackerWords";

const ANALYSIS_ENDPOINT = "/api/analyze";

const NOTIFICATION_COOLDOWN = 350;

const LIVE_DETECTION_ENABLED = true;


/* ============================================================
   STATE
   ============================================================ */

let recognition = null;

let isListening = false;

let finalTranscript = "";

let interimTranscript = "";

let currentSessionText = "";

let trackedWords = [];

let detectedWords = [];

let totalWordCount = 0;

let notificationPermission = false;

let lastDetectedPhrase = "";

let lastDetectionTime = 0;

let detectionQueue = Promise.resolve();

let recognitionRestartTimer = null;

let manualStop = false;

let recognitionSupported = false;

let analysisInProgress = false;


/*
   Keeps track of words already detected inside the
   current interim result.

   This is important because browser speech recognition
   repeatedly sends:

       "I was um"
       "I was umm"
       "I was ummm"

   as the speaker continues.

   Without this state, the same "um" could trigger
   several times.
*/
let liveDetectedOccurrences = new Set();


/*
   Tracks the last interim text.

   This lets us detect newly-added speech rather than
   repeatedly analyzing the exact same recognition result.
*/
let previousInterimText = "";


/*
   Stores the most recent chunks of speech so that
   stretched filler words can be detected.
*/
let recentSpeechChunks = [];


/* ============================================================
   DOM HELPERS
   ============================================================ */

function getElement(id) {
    return document.getElementById(id);
}


/* ============================================================
   DOM ELEMENTS
   ============================================================ */

const listenButton = getElement("listenButton");

const stopButton = getElement("stopButton");

const heardElement = getElement("heard");

const statusElement = getElement("status");

const statusDot = getElement("statusDot");

const fillerCountElement = getElement("fillerCount");

const wordCountElement = getElement("wordCount");

const customWordInput = getElement("customWordInput");

const addWordButton = getElement("addWordButton");

const wordListElement = getElement("wordList");

const resetWordsButton = getElement("resetWordsButton");

const enableNotificationsButton =
    getElement("enableNotifications");

const notificationStatusElement =
    getElement("notificationStatus");

const analyzeButton =
    getElement("analyzeButton");

const analysisLoading =
    getElement("analysisLoading");

const analysisElement =
    getElement("analysis");


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    loadTrackedWords();

    renderWordList();

    initializeSpeechRecognition();

    updateStats();

    setupEventListeners();

    updateNotificationUI();

});


/* ============================================================
   EVENT LISTENERS
   ============================================================ */

function setupEventListeners() {

    if (listenButton) {

        listenButton.addEventListener(
            "click",
            startListening
        );

    }


    if (stopButton) {

        stopButton.addEventListener(
            "click",
            stopListening
        );

    }


    if (addWordButton) {

        addWordButton.addEventListener(
            "click",
            addCustomWord
        );

    }


    if (customWordInput) {

        customWordInput.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    addCustomWord();

                }

            }
        );

    }


    if (resetWordsButton) {

        resetWordsButton.addEventListener(
            "click",
            resetTrackedWords
        );

    }


    if (enableNotificationsButton) {

        enableNotificationsButton.addEventListener(
            "click",
            enableNotifications
        );

    }


    if (analyzeButton) {

        analyzeButton.addEventListener(
            "click",
            analyzeSpeech
        );

    }

}


/* ============================================================
   TRACKED WORD STORAGE
   ============================================================ */

function loadTrackedWords() {

    try {

        const saved =
            localStorage.getItem(STORAGE_KEY);

        if (!saved) {

            trackedWords =
                [...DEFAULT_WORDS];

            return;

        }

        const parsed =
            JSON.parse(saved);

        if (
            Array.isArray(parsed) &&
            parsed.length > 0
        ) {

            trackedWords =
                parsed
                    .map(word =>
                        normalizeWord(word)
                    )
                    .filter(Boolean);

        } else {

            trackedWords =
                [...DEFAULT_WORDS];

        }

    } catch (error) {

        console.error(
            "Could not load tracked words:",
            error
        );

        trackedWords =
            [...DEFAULT_WORDS];

    }

}


/* ============================================================
   SAVE TRACKED WORDS
   ============================================================ */

function saveTrackedWords() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(trackedWords)
        );

    } catch (error) {

        console.error(
            "Could not save tracked words:",
            error
        );

    }

}


/* ============================================================
   NORMALIZE WORD
   ============================================================ */

function normalizeWord(word) {

    return String(word || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

}


/* ============================================================
   ADD CUSTOM WORD
   ============================================================ */

function addCustomWord() {

    if (!customWordInput) {
        return;
    }

    const word =
        normalizeWord(
            customWordInput.value
        );

    if (!word) {
        return;
    }

    if (
        !trackedWords.some(
            existing =>
                existing === word
        )
    ) {

        trackedWords.push(word);

        saveTrackedWords();

        renderWordList();

    }

    customWordInput.value = "";

    customWordInput.focus();

}


/* ============================================================
   REMOVE CUSTOM WORD
   ============================================================ */

function removeTrackedWord(word) {

    trackedWords =
        trackedWords.filter(
            existing =>
                existing !== word
        );

    saveTrackedWords();

    renderWordList();

}


/* ============================================================
   RESET WORDS
   ============================================================ */

function resetTrackedWords() {

    trackedWords =
        [...DEFAULT_WORDS];

    saveTrackedWords();

    renderWordList();

}


/* ============================================================
   RENDER WORD LIST
   ============================================================ */

function renderWordList() {

    if (!wordListElement) {
        return;
    }

    wordListElement.innerHTML = "";

    trackedWords.forEach(word => {

        const tag =
            document.createElement("span");

        tag.className =
            "word-tag";

        const text =
            document.createElement("span");

        text.textContent =
            word;

        const removeButton =
            document.createElement("button");

        removeButton.type =
            "button";

        removeButton.textContent =
            "×";

        removeButton.setAttribute(
            "aria-label",
            `Remove ${word}`
        );

        removeButton.addEventListener(
            "click",
            () => removeTrackedWord(word)
        );

        tag.appendChild(text);

        tag.appendChild(removeButton);

        wordListElement.appendChild(tag);

    });

}


/* ============================================================
   SPEECH RECOGNITION INITIALIZATION
   ============================================================ */

function initializeSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        recognitionSupported =
            false;

        setStatus(
            "Speech recognition is not supported",
            "error"
        );

        if (listenButton) {

            listenButton.disabled =
                true;

        }

        return;

    }

    recognitionSupported =
        true;

    recognition =
        new SpeechRecognition();

    /*
       Continuous recognition means the browser keeps
       sending speech instead of stopping after one phrase.
    */
    recognition.continuous =
        true;

    /*
       Interim results are CRITICAL.

       This allows us to see:

           "I think uhh"

       before the browser decides that the phrase is final.
    */
    recognition.interimResults =
        true;

    /*
       English can be changed if needed.
    */
    recognition.lang =
        "en-US";

    /*
       This is intentionally kept at 1 because we need
       the newest result as quickly as possible.
    */
    recognition.maxAlternatives =
        1;


    recognition.onstart = () => {

        isListening =
            true;

        setStatus(
            "Listening",
            "listening"
        );

        updateButtonState();

    };


    recognition.onresult =
        handleRecognitionResult;


    recognition.onerror =
        handleRecognitionError;


    recognition.onend =
        handleRecognitionEnd;

}


/* ============================================================
   START LISTENING
   ============================================================ */

function startListening() {

    if (!recognitionSupported) {

        setStatus(
            "Speech recognition unavailable",
            "error"
        );

        return;

    }

    if (isListening) {
        return;
    }

    manualStop =
        false;

    finalTranscript =
        "";

    interimTranscript =
        "";

    currentSessionText =
        "";

    detectedWords =
        [];

    totalWordCount =
        0;

    lastDetectedPhrase =
        "";

    lastDetectionTime =
        0;

    previousInterimText =
        "";

    recentSpeechChunks =
        [];

    liveDetectedOccurrences =
        new Set();


    if (heardElement) {

        heardElement.innerHTML =
            "Listening...";

    }


    if (analysisElement) {

        analysisElement.innerHTML =
            "";

    }


    if (analyzeButton) {

        analyzeButton.disabled =
            true;

    }


    updateStats();

    setStatus(
        "Starting...",
        "listening"
    );

    updateButtonState();


    try {

        recognition.start();

    } catch (error) {

        console.warn(
            "Recognition start error:",
            error
        );

        /*
           Some browsers throw if start() is called
           immediately after a previous session.

           Retry shortly instead of failing completely.
        */

        clearTimeout(
            recognitionRestartTimer
        );

        recognitionRestartTimer =
            setTimeout(() => {

                if (
                    !manualStop &&
                    !isListening
                ) {

                    try {

                        recognition.start();

                    } catch (retryError) {

                        console.error(
                            "Recognition retry failed:",
                            retryError
                        );

                    }

                }

            }, 150);

    }

}


/* ============================================================
   STOP LISTENING
   ============================================================ */

function stopListening() {

    manualStop =
        true;

    clearTimeout(
        recognitionRestartTimer
    );

    if (
        recognition &&
        isListening
    ) {

        try {

            recognition.stop();

        } catch (error) {

            console.warn(
                "Recognition stop error:",
                error
            );

        }

    }

    isListening =
        false;

    setStatus(
        "Stopped",
        "ready"
    );

    updateButtonState();


    /*
       Make sure the final transcript includes the
       latest interim text.
    */

    const combined =
        `${finalTranscript} ${interimTranscript}`
            .replace(/\s+/g, " ")
            .trim();

    if (combined) {

        currentSessionText =
            combined;

    }


    if (analyzeButton) {

        analyzeButton.disabled =
            !currentSessionText.trim();

    }

}


/* ============================================================
   HANDLE SPEECH RESULT
   ============================================================ */

function handleRecognitionResult(event) {

    let newFinalText = "";

    let newInterimText = "";

    /*
       SpeechRecognition returns all results from
       resultIndex onward.

       We process both FINAL and INTERIM results.
    */

    for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
    ) {

        const result =
            event.results[i];

        if (
            !result ||
            !result[0]
        ) {

            continue;

        }

        const text =
            result[0].transcript || "";

        if (result.isFinal) {

            newFinalText +=
                ` ${text}`;

        } else {

            newInterimText +=
                ` ${text}`;

        }

    }


    newFinalText =
        newFinalText
            .replace(/\s+/g, " ")
            .trim();


    newInterimText =
        newInterimText
            .replace(/\s+/g, " ")
            .trim();


    /*
       ========================================================
       FINAL TEXT
       ========================================================
    */

    if (newFinalText) {

        finalTranscript =
            `${finalTranscript} ${newFinalText}`
                .replace(/\s+/g, " ")
                .trim();

        /*
           Final words are checked too.

           This catches words that the browser only
           decides are words after finalization.
        */
        processDetectedWords(
            newFinalText,
            true
        );

    }


    /*
       ========================================================
       INTERIM TEXT
       ========================================================
    */

    interimTranscript =
        newInterimText;


    /*
       MOST IMPORTANT PART:

       Analyze interim speech immediately.

       This is what makes:

           "umm"
           "uhhh"

       detectable before final transcription.
    */

    if (
        LIVE_DETECTION_ENABLED &&
        newInterimText
    ) {

        processLiveSpeech(
            newInterimText
        );

    }


    /*
       ========================================================
       DISPLAY
       ========================================================
    */

    const displayText =
        `${finalTranscript} ${interimTranscript}`
            .replace(/\s+/g, " ")
            .trim();


    currentSessionText =
        displayText;


    updateTranscriptDisplay(
        displayText
    );


    updateStats();


    if (analyzeButton) {

        analyzeButton.disabled =
            !displayText;

    }

}


/* ============================================================
   LIVE SPEECH PROCESSOR
   ============================================================ */

function processLiveSpeech(text) {

    const normalized =
        normalizeSpeechForDetection(text);

    if (!normalized) {
        return;
    }


    /*
       Keep a tiny history.

       This helps when browsers send:

           "I was u"
           "I was um"
           "I was umm"

       as separate interim updates.
    */

    recentSpeechChunks.push(
        normalized
    );

    if (
        recentSpeechChunks.length > 5
    ) {

        recentSpeechChunks.shift();

    }


    /*
       First check the complete current interim phrase.
    */

    detectTrackedWordsInText(
        normalized,
        false
    );


    /*
       Then specifically check stretched filler
       patterns.

       This is intentionally separate from the normal
       word matching because browser transcription may
       produce:

           ummmm
           uhhhh
           ummmmmm

       rather than exactly "um" or "umm".
    */

    detectStretchedFillers(
        normalized
    );

}


/* ============================================================
   NORMALIZE SPEECH FOR DETECTION
   ============================================================ */

function normalizeSpeechForDetection(text) {

    return String(text || "")
        .toLowerCase()
        .replace(/[.,!?;:()[\]{}"']/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


/* ============================================================
   DETECT STRETCHED FILLERS
   ============================================================ */

function detectStretchedFillers(text) {

    /*
       Match:

           um
           umm
           ummm
           ummmm
           ummmmm

       and:

           uh
           uhh
           uhhh
           uhhhh
           uhhhhhh
    */

    const fillerRegex =
        /\b(?:u+m+|u+h+)\b/gi;

    let match;

    while (
        (match =
            fillerRegex.exec(text)) !== null
    ) {

        const matched =
            match[0].toLowerCase();

        const canonical =
            matched.startsWith("um")
                ? "um"
                : "uh";

        /*
           Only trigger if the user actually tracks
           the corresponding filler.
        */

        const tracksCanonical =
            trackedWords.some(
                word =>
                    normalizeWord(word) ===
                    canonical
            );

        const tracksOriginal =
            trackedWords.some(
                word =>
                    normalizeWord(word) ===
                    matched
            );

        if (
            !tracksCanonical &&
            !tracksOriginal
        ) {

            continue;

        }


        /*
           Create an occurrence key based on the
           surrounding text.

           This prevents:

             "umm"
             "umm"
             "umm"

           from generating repeated alerts while the
           browser is repeatedly updating the same
           interim result.
        */

        const before =
            text
                .slice(
                    Math.max(
                        0,
                        match.index - 20
                    ),
                    match.index
                );

        const occurrenceKey =
            `${canonical}|${before}`;


        if (
            liveDetectedOccurrences.has(
                occurrenceKey
            )
        ) {

            continue;

        }


        liveDetectedOccurrences.add(
            occurrenceKey
        );


        triggerTrackedWord(
            canonical,
            matched,
            true
        );

    }

}


/* ============================================================
   NORMAL TRACKED WORD DETECTION
   ============================================================ */

function detectTrackedWordsInText(
    text,
    isFinal
) {

    const words =
        [...trackedWords]
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    for (const trackedWord of words) {

        if (!trackedWord) {
            continue;
        }

        /*
           Escape special regex characters.
        */

        const escaped =
            trackedWord.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );


        /*
           Word boundaries work well for normal words.

           For phrases such as "you know", this also
           works correctly.
        */

        const regex =
            new RegExp(
                `(?:^|\\s)(${escaped})(?=\\s|$|[.,!?;:])`,
                "gi"
            );


        let match;

        while (
            (match =
                regex.exec(text)) !== null
        ) {

            const matchedText =
                match[1] ||
                trackedWord;

            /*
               Filler words are handled by the special
               stretched-filler detector too.

               We don't want two notifications for:

                   umm

               from both systems.
            */

            if (
                isStretchedFiller(
                    matchedText
                )
            ) {

                continue;

            }


            const occurrenceKey =
                `${normalizeWord(trackedWord)}|${text.slice(
                    Math.max(
                        0,
                        match.index - 20
                    ),
                    match.index
                )}`;


            if (
                !isFinal &&
                liveDetectedOccurrences.has(
                    occurrenceKey
                )
            ) {

                continue;

            }


            if (!isFinal) {

                liveDetectedOccurrences.add(
                    occurrenceKey
                );

            }


            triggerTrackedWord(
                trackedWord,
                matchedText,
                !isFinal
            );

        }

    }

}


/* ============================================================
   CHECK IF WORD IS STRETCHED FILLER
   ============================================================ */

function isStretchedFiller(word) {

    const normalized =
        normalizeWord(word);

    return (
        /^u+m+$/.test(normalized) ||
        /^u+h+$/.test(normalized)
    );

}


/* ============================================================
   PROCESS DETECTED WORDS
   ============================================================ */

function processDetectedWords(
    text,
    isFinal
) {

    const normalized =
        normalizeSpeechForDetection(
            text
        );

    if (!normalized) {
        return;
    }

    /*
       Check stretched fillers first.
    */

    detectStretchedFillers(
        normalized
    );


    /*
       Then normal tracked words.
    */

    detectTrackedWordsInText(
        normalized,
        isFinal
    );

}


/* ============================================================
   TRIGGER TRACKED WORD
   ============================================================ */

function triggerTrackedWord(
    trackedWord,
    spokenWord,
    isLive
) {

    const now =
        Date.now();


    /*
       Very short cooldown.

       This is NOT a delay before notification.

       It only prevents the exact same word from
       producing several alerts in rapid succession.
    */

    if (
        normalizeWord(spokenWord) ===
        normalizeWord(lastDetectedPhrase) &&
        now - lastDetectionTime <
        NOTIFICATION_COOLDOWN
    ) {

        return;

    }


    lastDetectedPhrase =
        spokenWord;

    lastDetectionTime =
        now;


    detectedWords.push({
        word: trackedWord,
        spoken: spokenWord,
        time: now,
        live: isLive
    });


    updateStats();


    /*
       IMPORTANT:

       Do not await this.

       The live speech-recognition handler should
       continue immediately.
    */

    triggerAlert(
        spokenWord
    );

}


/* ============================================================
   ALERT
   ============================================================ */

function triggerAlert(word) {

    /*
       VIBRATION FIRST.

       navigator.vibrate is synchronous and extremely
       fast when supported.
    */

    try {

        if (
            "vibrate" in navigator
        ) {

            navigator.vibrate(
                [70]
            );

        }

    } catch (error) {

        console.warn(
            "Vibration unavailable:",
            error
        );

    }


    /*
       Notification is intentionally asynchronous
       and is NOT awaited.
    */

    sendNotification(
        word
    ).catch(error => {

        console.warn(
            "Notification error:",
            error
        );

    });


    /*
       Small visual flash.
    */

    flashScreen();


    /*
       Optional browser audio cue.

       We intentionally don't create an audio cue
       unless one is already allowed by the browser.
    */

}


/* ============================================================
   VISUAL ALERT
   ============================================================ */

function flashScreen() {

    document.body.classList.add(
        "speech-alert"
    );

    setTimeout(() => {

        document.body.classList.remove(
            "speech-alert"
        );

    }, 180);

}


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

async function enableNotifications() {

    if (
        !("Notification" in window)
    ) {

        setNotificationStatus(
            "Browser notifications are not supported."
        );

        return;

    }


    try {

        const permission =
            await Notification.requestPermission();

        notificationPermission =
            permission === "granted";


        updateNotificationUI();


    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

        setNotificationStatus(
            "Could not enable notifications."
        );

    }

}


/* ============================================================
   SEND NOTIFICATION
   ============================================================ */

async function sendNotification(word) {

    if (
        !("Notification" in window)
    ) {

        return;

    }


    /*
       Don't request permission from inside live
       detection.

       The user must press the Enable Notifications
       button first.
    */

    if (
        Notification.permission !==
        "granted"
    ) {

        return;

    }


    /*
       Creating the notification is intentionally
       immediate.
    */

    try {

        new Notification(
            "Tracked word detected",
            {
                body:
                    `You said "${word}"`,
                tag:
                    `speech-tracker-${Date.now()}`,
                silent:
                    false
            }
        );

    } catch (error) {

        console.warn(
            "Could not create notification:",
            error
        );

    }

}


/* ============================================================
   UPDATE NOTIFICATION UI
   ============================================================ */

function updateNotificationUI() {

    if (
        !enableNotificationsButton
    ) {

        return;

    }


    if (
        !("Notification" in window)
    ) {

        enableNotificationsButton.disabled =
            true;

        setNotificationStatus(
            "Notifications are not supported by this browser."
        );

        return;

    }


    const permission =
        Notification.permission;


    if (
        permission === "granted"
    ) {

        notificationPermission =
            true;

        enableNotificationsButton.textContent =
            "✓ Notifications Enabled";

        enableNotificationsButton.classList.add(
            "enabled"
        );

        setNotificationStatus(
            "You will be notified when a tracked word is detected."
        );

        return;

    }


    if (
        permission === "denied"
    ) {

        notificationPermission =
            false;

        enableNotificationsButton.textContent =
            "Notifications Blocked";

        setNotificationStatus(
            "Notifications are blocked. Enable them in your browser settings."
        );

        return;

    }


    notificationPermission =
        false;

    enableNotificationsButton.textContent =
        "🔔 Enable Notifications";

    setNotificationStatus(
        "Notifications are not enabled."
    );

}


/* ============================================================
   NOTIFICATION STATUS
   ============================================================ */

function setNotificationStatus(message) {

    if (
        notificationStatusElement
    ) {

        notificationStatusElement.textContent =
            message;

    }

}


/* ============================================================
   STATUS
   ============================================================ */

function setStatus(
    message,
    type = "ready"
) {

    if (statusElement) {

        statusElement.textContent =
            message;

    }


    if (statusDot) {

        statusDot.className =
            `dot ${type}`;

    }

}


/* ============================================================
   BUTTON STATE
   ============================================================ */

function updateButtonState() {

    if (listenButton) {

        listenButton.disabled =
            isListening;

    }


    if (stopButton) {

        stopButton.disabled =
            !isListening;

    }

}


/* ============================================================
   RECOGNITION ERROR
   ============================================================ */

function handleRecognitionError(event) {

    console.error(
        "Speech recognition error:",
        event.error
    );


    /*
       "no-speech" is not a fatal error.

       If we're still supposed to be listening,
       restart quickly.
    */

    if (
        event.error ===
        "no-speech"
    ) {

        setStatus(
            "Listening...",
            "listening"
        );

        return;

    }


    if (
        event.error ===
        "aborted"
    ) {

        return;

    }


    if (
        event.error ===
        "not-allowed" ||
        event.error ===
        "service-not-allowed"
    ) {

        isListening =
            false;

        setStatus(
            "Microphone permission required",
            "error"
        );

        updateButtonState();

        return;

    }


    setStatus(
        `Speech error: ${event.error}`,
        "error"
    );

}


/* ============================================================
   RECOGNITION END
   ============================================================ */

function handleRecognitionEnd() {

    /*
       Chrome can stop recognition unexpectedly even
       with continuous=true.

       Automatically restart unless the user pressed
       Stop.
    */

    if (
        !manualStop &&
        isListening
    ) {

        clearTimeout(
            recognitionRestartTimer
        );


        recognitionRestartTimer =
            setTimeout(() => {

                if (
                    !manualStop &&
                    isListening
                ) {

                    try {

                        recognition.start();

                    } catch (error) {

                        console.warn(
                            "Automatic recognition restart failed:",
                            error
                        );

                    }

                }

            }, 50);

        return;

    }


    isListening =
        false;

    updateButtonState();

}


/* ============================================================
   TRANSCRIPT DISPLAY
   ============================================================ */

function updateTranscriptDisplay(
    text
) {

    if (!heardElement) {
        return;
    }


    if (!text) {

        heardElement.textContent =
            "Tap Listen and start speaking.";

        return;

    }


    /*
       Highlight tracked words safely.

       We build DOM nodes rather than injecting raw
       transcript HTML. This prevents transcript text
       from becoming executable HTML.
    */

    heardElement.innerHTML = "";


    const tokens =
        text.split(
            /(\s+)/
        );


    for (const token of tokens) {

        if (
            /^\s+$/.test(token)
        ) {

            heardElement.appendChild(
                document.createTextNode(
                    token
                )
            );

            continue;

        }


        const clean =
            token
                .toLowerCase()
                .replace(
                    /^[.,!?;:"'()[\]{}]+|[.,!?;:"'()[\]{}]+$/g,
                    ""
                );


        /*
           Check both normal tracked words and
           stretched fillers.
        */

        const matchedTrackedWord =
            findMatchingTrackedWord(
                clean
            );


        if (
            matchedTrackedWord
        ) {

            const span =
                document.createElement(
                    "span"
                );

            span.className =
                "highlight";

            span.textContent =
                token;

            heardElement.appendChild(
                span
            );

        } else {

            heardElement.appendChild(
                document.createTextNode(
                    token
                )
            );

        }

    }

}


/* ============================================================
   FIND MATCHING TRACKED WORD
   ============================================================ */

function findMatchingTrackedWord(
    word
) {

    const normalized =
        normalizeWord(word);


    /*
       Exact custom/default word.
    */

    if (
        trackedWords.some(
            tracked =>
                normalizeWord(tracked) ===
                normalized
        )
    ) {

        return normalized;

    }


    /*
       Stretched UM / UH.

       If "um" is tracked, then:

           um
           umm
           ummm
           ummmm

       should all highlight.
    */

    if (
        /^u+m+$/.test(normalized) &&
        trackedWords.some(
            tracked =>
                normalizeWord(tracked) ===
                "um"
        )
    ) {

        return "um";

    }


    if (
        /^u+h+$/.test(normalized) &&
        trackedWords.some(
            tracked =>
                normalizeWord(tracked) ===
                "uh"
        )
    ) {

        return "uh";

    }


    return null;

}


/* ============================================================
   STATS
   ============================================================ */

function updateStats() {

    const transcript =
        currentSessionText ||
        `${finalTranscript} ${interimTranscript}`
            .replace(/\s+/g, " ")
            .trim();


    totalWordCount =
        countWords(
            transcript
        );


    if (wordCountElement) {

        wordCountElement.textContent =
            totalWordCount;

    }


    if (fillerCountElement) {

        fillerCountElement.textContent =
            detectedWords.length;

    }

}


/* ============================================================
   COUNT WORDS
   ============================================================ */

function countWords(text) {

    const normalized =
        String(text || "")
            .trim();


    if (!normalized) {
        return 0;
    }


    return normalized
        .split(/\s+/)
        .filter(Boolean)
        .length;

}


/* ============================================================
   ANALYZE SPEECH
   ============================================================ */

async function analyzeSpeech() {

    if (analysisInProgress) {
        return;
    }


    const transcript =
        currentSessionText
            .trim();


    if (!transcript) {

        if (analysisElement) {

            analysisElement.textContent =
                "There is no speech to analyze yet.";

        }

        return;

    }


    analysisInProgress =
        true;


    if (analyzeButton) {

        analyzeButton.disabled =
            true;

    }


    if (analysisLoading) {

        analysisLoading.hidden =
            false;

        analysisLoading.textContent =
            "Analyzing your speech...";

    }


    if (analysisElement) {

        analysisElement.innerHTML =
            "";

    }


    try {

        const response =
            await fetch(
                ANALYSIS_ENDPOINT,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            transcript
                        })
                }
            );


        const responseText =
            await response.text();


        console.log(
            "Analysis HTTP status:",
            response.status
        );

        console.log(
            "Analysis raw response:",
            responseText
        );


        if (!response.ok) {

            let errorMessage =
                "AI analysis failed.";

            try {

                const errorData =
                    JSON.parse(
                        responseText
                    );

                if (
                    errorData?.error
                ) {

                    errorMessage =
                        errorData.error;

                }

                if (
                    errorData?.details
                ) {

                    console.error(
                        "Analysis details:",
                        errorData.details
                    );

                }

            } catch {

                /*
                   Response wasn't JSON.
                   Keep generic error message.
                */

            }


            throw new Error(
                errorMessage
            );

        }


        let data;


        /*
           The API normally returns JSON.

           However, this deliberately handles malformed
           responses instead of immediately showing:

               "JSON was invalid"

           to the user.
        */

        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (parseError) {

            console.error(
                "Frontend could not parse API JSON:",
                parseError,
                responseText
            );

            throw new Error(
                "The AI server returned an invalid response."
            );

        }


        /*
           Your API returns:

               {
                   analysis: "...",
                   analysisData: {...}
               }
        */

        if (
            data &&
            data.analysisData
        ) {

            renderStructuredAnalysis(
                data.analysisData
            );

        } else if (
            data &&
            typeof data.analysis ===
            "string"
        ) {

            renderTextAnalysis(
                data.analysis
            );

        } else {

            throw new Error(
                "The AI returned no analysis."
            );

        }

    } catch (error) {

        console.error(
            "Speech analysis error:",
            error
        );


        if (analysisElement) {

            const errorBox =
                document.createElement(
                    "div"
                );

            errorBox.className =
                "analysis-error";

            errorBox.textContent =
                error?.message ||
                "Something went wrong while analyzing your speech.";

            analysisElement.appendChild(
                errorBox
            );

        }

    } finally {

        analysisInProgress =
            false;


        if (analysisLoading) {

            analysisLoading.hidden =
                true;

        }


        if (analyzeButton) {

            analyzeButton.disabled =
                !currentSessionText.trim();

        }

    }

}


/* ============================================================
   RENDER STRUCTURED ANALYSIS
   ============================================================ */

function renderStructuredAnalysis(
    analysis
) {

    if (!analysisElement) {
        return;
    }


    analysisElement.innerHTML =
        "";


    const sections = [
        {
            title: "Overall",
            value:
                analysis?.overall
        },
        {
            title: "Filler Words",
            value:
                analysis?.fillerWords
        },
        {
            title: "Clarity",
            value:
                analysis?.clarity
        },
        {
            title: "Strength",
            value:
                analysis?.strength
        },
        {
            title: "Improvement",
            value:
                analysis?.improvement
        },
        {
            title: "Tip",
            value:
                analysis?.tip
        }
    ];


    let rendered =
        false;


    for (
        const section of sections
    ) {

        if (
            typeof section.value !==
                "string" ||
            !section.value.trim()
        ) {

            continue;

        }


        rendered =
            true;


        const box =
            document.createElement(
                "div"
            );

        box.className =
            "analysis-section";


        const heading =
            document.createElement(
                "h3"
            );

        heading.textContent =
            section.title;


        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            section.value;


        box.appendChild(
            heading
        );

        box.appendChild(
            paragraph
        );

        analysisElement.appendChild(
            box
        );

    }


    if (!rendered) {

        analysisElement.textContent =
            "The AI returned an empty analysis.";

    }

}


/* ============================================================
   RENDER TEXT ANALYSIS
   ============================================================ */

function renderTextAnalysis(
    text
) {

    if (!analysisElement) {
        return;
    }


    analysisElement.innerHTML =
        "";


    /*
       Preserve the line structure of the server's
       formatted analysis without using innerHTML.
    */

    const lines =
        String(text)
            .split("\n");


    for (const line of lines) {

        const trimmed =
            line.trim();


        if (!trimmed) {

            const spacer =
                document.createElement(
                    "div"
                );

            spacer.style.height =
                "8px";

            analysisElement.appendChild(
                spacer
            );

            continue;

        }


        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            trimmed;

        analysisElement.appendChild(
            paragraph
        );

    }

}


/* ============================================================
   OPTIONAL THEME SUPPORT
   ============================================================ */

function initializeTheme() {

    const savedTheme =
        localStorage.getItem(
            "speechTrackerTheme"
        );


    if (
        savedTheme === "dark" ||
        savedTheme === "light"
    ) {

        document.documentElement
            .setAttribute(
                "data-theme",
                savedTheme
            );

    }

}


initializeTheme();


/* ============================================================
   OPTIONAL THEME TOGGLE SUPPORT
   ============================================================ */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                ".theme-toggle"
            );


        if (!button) {
            return;
        }


        const current =
            document.documentElement
                .getAttribute(
                    "data-theme"
                );


        const next =
            current === "dark"
                ? "light"
                : "dark";


        document.documentElement
            .setAttribute(
                "data-theme",
                next
            );


        localStorage.setItem(
            "speechTrackerTheme",
            next
        );


        button.textContent =
            next === "dark"
                ? "☀️"
                : "🌙";

    }
);


/* ============================================================
   PAGE VISIBILITY
   ============================================================ */

document.addEventListener(
    "visibilitychange",
    () => {

        /*
           We intentionally do NOT stop recognition
           automatically when the page becomes hidden.

           This gives the browser a chance to continue
           the recognition session where supported.
        */

        if (
            document.visibilityState ===
            "visible" &&
            isListening
        ) {

            setStatus(
                "Listening",
                "listening"
            );

        }

    }
);


/* ============================================================
   BEFORE UNLOAD
   ============================================================ */

window.addEventListener(
    "beforeunload",
    () => {

        manualStop =
            true;

        if (
            recognition &&
            isListening
        ) {

            try {

                recognition.stop();

            } catch {

                // Nothing else to do.

            }

        }

    }
);


/* ============================================================
   DEBUG HELPERS
   ============================================================ */

window.speechTrackerDebug = {

    getTranscript() {

        return currentSessionText;

    },


    getTrackedWords() {

        return [
            ...trackedWords
        ];

    },


    getDetectedWords() {

        return [
            ...detectedWords
        ];

    },


    isListening() {

        return isListening;

    },


    testVibration() {

        if (
            "vibrate" in navigator
        ) {

            navigator.vibrate(
                [70]
            );

            return true;

        }

        return false;

    },


    testNotification() {

        return sendNotification(
            "test"
        );

    }

};


/* ============================================================
   FINAL INITIAL STATE
   ============================================================ */

updateButtonState();

updateStats();
