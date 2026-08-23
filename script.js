/* ============================================================
   SPEECH TRACKER
   Complete replacement script.js
   ============================================================ */


/* ============================================================
   DEFAULT WORDS
   ============================================================ */

const DEFAULT_TRACKED_WORDS = [
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

const WORD_STORAGE_KEY =
    "speechTrackerWords";

const SPEECH_STORAGE_KEY =
    "speechTrackerSavedSpeeches";

const THEME_STORAGE_KEY =
    "speechTrackerTheme";


/* ============================================================
   ELEMENTS
   ============================================================ */

const listenButton =
    document.getElementById("listenButton");

const stopButton =
    document.getElementById("stopButton");

const heardElement =
    document.getElementById("heard");

const statusElement =
    document.getElementById("status");

const statusDot =
    document.getElementById("statusDot");

const fillerCountElement =
    document.getElementById("fillerCount");

const wordCountElement =
    document.getElementById("wordCount");

const customWordInput =
    document.getElementById("customWordInput");

const addWordButton =
    document.getElementById("addWordButton");

const resetWordsButton =
    document.getElementById("resetWordsButton");

const wordList =
    document.getElementById("wordList");

const enableNotificationsButton =
    document.getElementById("enableNotifications");

const notificationStatus =
    document.getElementById("notificationStatus");

const finalTranscriptElement =
    document.getElementById("finalTranscript");

const analyzeButton =
    document.getElementById("analyzeButton");

const analysisLoading =
    document.getElementById("analysisLoading");

const analysisElement =
    document.getElementById("analysis");

const saveSpeechCard =
    document.getElementById("saveSpeechCard");

const saveSpeechButton =
    document.getElementById("saveSpeechButton");

const discardSpeechButton =
    document.getElementById("discardSpeechButton");

const savedSpeechesElement =
    document.getElementById("savedSpeeches");

const savedSpeechCount =
    document.getElementById("savedSpeechCount");

const recordingTimerElement =
    document.getElementById("recordingTimer");

const themeToggle =
    document.getElementById("themeToggle");

const themeToggleText =
    document.getElementById("themeToggleText");

const fastFillerAlert =
    document.getElementById("fastFillerAlert");

const scrollIndicator =
    document.getElementById("scrollIndicator");


/* ============================================================
   STATE
   ============================================================ */

let trackedWords = [];

let recognition = null;

let recognitionSupported = false;

let isListening = false;

let recognitionRestarting = false;

let liveFinalTranscript = "";

let liveInterimTranscript = "";

let currentSpeechTranscript = "";

let fillerCount = 0;

let totalWords = 0;

let mediaRecorder = null;

let audioChunks = [];

let recordingStream = null;

let recordingStartTime = null;

let timerInterval = null;

let notificationPermissionRequested = false;

let fillerOverlayTimer = null;


/*
    Saved AI analysis for the CURRENT speech.

    This is important because when the speech is saved,
    its AI analysis is saved with it.
*/
let currentAnalysisData = null;


/*
    If the user clicks "View" on a saved speech,
    this contains that speech's ID.

    It prevents the app from accidentally confusing
    an old speech with the current recording.
*/
let viewingSavedSpeechId = null;


/*
    Prevent duplicate live notifications.

    This is intentionally short because we want
    feedback as quickly as possible.
*/
const LIVE_NOTIFICATION_COOLDOWN = 350;

let lastDetectedLiveWord = "";

let lastDetectedLiveTime = 0;


/* ============================================================
   TRACKED WORD STORAGE
   ============================================================ */

function loadTrackedWords() {

    try {

        const stored =
            JSON.parse(
                localStorage.getItem(
                    WORD_STORAGE_KEY
                )
            );

        if (
            Array.isArray(stored) &&
            stored.length > 0
        ) {

            trackedWords =
                stored
                    .map(word =>
                        String(word)
                            .toLowerCase()
                            .trim()
                    )
                    .filter(Boolean);

            return;
        }

    } catch (error) {

        console.warn(
            "Could not load tracked words:",
            error
        );
    }


    trackedWords =
        [...DEFAULT_TRACKED_WORDS];

    saveTrackedWords();
}


function saveTrackedWords() {

    localStorage.setItem(
        WORD_STORAGE_KEY,
        JSON.stringify(
            trackedWords
        )
    );
}


/* ============================================================
   WORD LIST
   ============================================================ */

function renderWordList() {

    if (!wordList) {
        return;
    }

    wordList.innerHTML = "";

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
            () => {

                trackedWords =
                    trackedWords.filter(
                        item =>
                            item !== word
                    );

                saveTrackedWords();

                renderWordList();
            }
        );


        tag.appendChild(text);

        tag.appendChild(
            removeButton
        );

        wordList.appendChild(tag);
    });
}


/* ============================================================
   ADD WORD
   ============================================================ */

function addTrackedWord() {

    if (!customWordInput) {
        return;
    }

    const value =
        customWordInput.value
            .toLowerCase()
            .trim();


    if (!value) {
        return;
    }


    if (
        trackedWords.includes(value)
    ) {

        customWordInput.value = "";

        return;
    }


    trackedWords.push(value);

    saveTrackedWords();

    renderWordList();

    customWordInput.value = "";

    customWordInput.focus();
}


if (addWordButton) {

    addWordButton.addEventListener(
        "click",
        addTrackedWord
    );
}


if (customWordInput) {

    customWordInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                addTrackedWord();
            }
        }
    );
}


if (resetWordsButton) {

    resetWordsButton.addEventListener(
        "click",
        () => {

            trackedWords =
                [...DEFAULT_TRACKED_WORDS];

            saveTrackedWords();

            renderWordList();
        }
    );
}


/* ============================================================
   THEME
   ============================================================ */

function updateThemeButton() {

    if (!themeToggleText) {
        return;
    }

    const currentTheme =
        document.documentElement
            .getAttribute("data-theme");


    if (
        currentTheme === "dark"
    ) {

        themeToggleText.textContent =
            "Light";

        themeToggle.setAttribute(
            "aria-label",
            "Switch to light mode"
        );

    } else {

        themeToggleText.textContent =
            "Dark";

        themeToggle.setAttribute(
            "aria-label",
            "Switch to dark mode"
        );
    }
}


function setTheme(theme) {

    if (theme === "dark") {

        document.documentElement
            .setAttribute(
                "data-theme",
                "dark"
            );

        localStorage.setItem(
            THEME_STORAGE_KEY,
            "dark"
        );

    } else {

        document.documentElement
            .removeAttribute(
                "data-theme"
            );

        localStorage.setItem(
            THEME_STORAGE_KEY,
            "light"
        );
    }

    updateThemeButton();
}


function initializeTheme() {

    const savedTheme =
        localStorage.getItem(
            THEME_STORAGE_KEY
        );


    if (
        savedTheme === "dark"
    ) {

        setTheme("dark");

    } else {

        setTheme("light");
    }
}


if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        () => {

            const currentTheme =
                document.documentElement
                    .getAttribute(
                        "data-theme"
                    );


            if (
                currentTheme === "dark"
            ) {

                setTheme("light");

            } else {

                setTheme("dark");
            }
        }
    );
}


initializeTheme();


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

function updateNotificationStatus() {

    if (!notificationStatus) {
        return;
    }


    if (
        !("Notification" in window)
    ) {

        notificationStatus.textContent =
            "Browser notifications are not supported.";

        return;
    }


    if (
        Notification.permission ===
        "granted"
    ) {

        notificationStatus.textContent =
            "Notifications are enabled.";

        if (
            enableNotificationsButton
        ) {

            enableNotificationsButton.textContent =
                "✓ Notifications Enabled";

            enableNotificationsButton.classList.add(
                "enabled"
            );
        }

    } else if (
        Notification.permission ===
        "denied"
    ) {

        notificationStatus.textContent =
            "Notifications are blocked. Enable them in your browser settings.";

    } else {

        notificationStatus.textContent =
            "Notifications are not enabled.";
    }
}


async function requestNotifications() {

    if (
        !("Notification" in window)
    ) {

        updateNotificationStatus();

        return;
    }


    if (
        notificationPermissionRequested
    ) {

        return;
    }


    notificationPermissionRequested =
        true;


    try {

        await Notification.requestPermission();

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

    } finally {

        notificationPermissionRequested =
            false;

        updateNotificationStatus();
    }
}


if (
    enableNotificationsButton
) {

    enableNotificationsButton.addEventListener(
        "click",
        requestNotifications
    );
}


updateNotificationStatus();


/* ============================================================
   TEXT HELPERS
   ============================================================ */

function normalizeSpeech(text) {

    return String(text || "")
        .toLowerCase()
        .replace(
            /[.,!?;:()[\]{}"']/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


function escapeHTML(text) {

    return String(text || "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function escapeRegExp(text) {

    return String(text)
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
}


/* ============================================================
   FIND TRACKED WORDS
   ============================================================ */

function findTrackedMatches(text) {

    const normalized =
        normalizeSpeech(text);

    if (!normalized) {
        return [];
    }


    const matches = [];


    const sortedWords =
        [...trackedWords].sort(
            (a, b) =>
                b.length - a.length
        );


    for (
        const trackedWord
        of sortedWords
    ) {

        const escaped =
            escapeRegExp(
                trackedWord
            );


        const pattern =
            new RegExp(
                `(^|\\s)${escaped}(?=\\s|$)`,
                "gi"
            );


        let match;


        while (
            (match =
                pattern.exec(
                    normalized
                )) !== null
        ) {

            matches.push({
                word: trackedWord,
                index: match.index
            });
        }
    }


    return matches;
}


/* ============================================================
   SPECIAL FAST DETECTION
   ============================================================ */

/*
    The browser can recognize:

        um
        umm
        ummmm
        uh
        uhh
        uhhhh

    differently depending on timing.

    This catches ALL natural elongated versions.

    This is specifically designed to improve the
    "umm/uhhh appears in final transcript but not live"
    problem.
*/

function findNaturalFiller(text) {

    const normalized =
        normalizeSpeech(text);

    if (!normalized) {
        return [];
    }


    const results = [];


    const fillerRegex =
        /(^|\s)(u+m+|u+h+)(?=\s|$)/gi;


    let match;


    while (
        (match =
            fillerRegex.exec(
                normalized
            )) !== null
    ) {

        results.push({
            word: match[2].toLowerCase(),
            index: match.index
        });
    }


    return results;
}


/* ============================================================
   HIGHLIGHT
   ============================================================ */

function highlightTrackedWords(
    escapedText
) {

    let result =
        escapedText;


    const sortedWords =
        [...trackedWords].sort(
            (a, b) =>
                b.length - a.length
        );


    for (
        const word
        of sortedWords
    ) {

        const escapedWord =
            escapeRegExp(
                escapeHTML(word)
            );


        const pattern =
            new RegExp(
                `(^|\\s)(${escapedWord})(?=\\s|$)`,
                "gi"
            );


        result =
            result.replace(
                pattern,
                `$1<span class="highlight">$2</span>`
            );
    }


    /*
        Also highlight elongated um/uh forms.
    */

    result =
        result.replace(
            /(^|\s)(u+m+|u+h+)(?=\s|$)/gi,
            `$1<span class="highlight">$2</span>`
        );


    return result;
}


/* ============================================================
   FAST LIVE FILLER DETECTION
   ============================================================ */

function detectLiveFillers(text) {

    if (!text) {
        return;
    }


    const naturalFillers =
        findNaturalFiller(text);


    const trackedMatches =
        findTrackedMatches(text);


    const matches = [
        ...naturalFillers
    ];


    trackedMatches.forEach(
        match => {

            /*
                Don't duplicate um/umm/uh/uhh.
            */

            if (
                /^u+m+$/i.test(
                    match.word
                ) ||
                /^u+h+$/i.test(
                    match.word
                )
            ) {

                return;
            }


            matches.push({
                word:
                    match.word,
                index:
                    match.index
            });
        }
    );


    if (
        matches.length === 0
    ) {

        return;
    }


    /*
        Sort chronologically.
    */

    matches.sort(
        (a, b) =>
            a.index - b.index
    );


    /*
        Trigger the most recent match.

        This prevents an old word in the
        same interim result from firing again.
    */

    const match =
        matches[matches.length - 1];


    const word =
        String(match.word)
            .toLowerCase()
            .trim();


    if (!word) {
        return;
    }


    const now =
        Date.now();


    if (
        word ===
            lastDetectedLiveWord &&
        now -
            lastDetectedLiveTime <
            LIVE_NOTIFICATION_COOLDOWN
    ) {

        return;
    }


    lastDetectedLiveWord =
        word;

    lastDetectedLiveTime =
        now;


    triggerFastFillerAlert(
        word
    );
}


/* ============================================================
   FAST ALERT
   ============================================================ */

function triggerFastFillerAlert(
    word
) {

    console.log(
        "FAST LIVE FILLER:",
        word
    );


    /*
        Vibration is synchronous and therefore
        happens before the browser notification.
    */

    if (
        "vibrate" in navigator
    ) {

        try {

            navigator.vibrate(
                [60, 30, 60]
            );

        } catch (error) {

            console.warn(
                "Vibration failed:",
                error
            );
        }
    }


    /*
        On-screen alert happens immediately.

        This is the fastest visual feedback
        available to the web app.
    */

    showFastFillerOverlay(
        word
    );


    /*
        Browser notification.

        No await.
        Nothing blocks this call.
    */

    if (
        "Notification" in window &&
        Notification.permission ===
            "granted"
    ) {

        try {

            new Notification(
                "Speech Tracker",
                {
                    body:
                        `You said "${word}"`,

                    tag:
                        `filler-${Date.now()}`,

                    renotify:
                        true,

                    silent:
                        false
                }
            );

        } catch (error) {

            console.warn(
                "Notification failed:",
                error
            );
        }
    }
}


/* ============================================================
   ON-SCREEN ALERT
   ============================================================ */

function showFastFillerOverlay(
    word
) {

    if (!fastFillerAlert) {
        return;
    }


    fastFillerAlert.textContent =
        `⚠ "${word}"`;


    fastFillerAlert.classList.remove(
        "show"
    );


    void fastFillerAlert.offsetWidth;


    fastFillerAlert.classList.add(
        "show"
    );


    clearTimeout(
        fillerOverlayTimer
    );


    fillerOverlayTimer =
        setTimeout(
            () => {

                fastFillerAlert.classList.remove(
                    "show"
                );

            },
            800
        );
}


/* ============================================================
   SPEECH RECOGNITION
   ============================================================ */

function initializeRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        recognitionSupported =
            false;

        console.warn(
            "Speech Recognition is not supported."
        );

        return;
    }


    recognitionSupported =
        true;


    recognition =
        new SpeechRecognition();


    /*
        INTERIM RESULTS ARE CRITICAL.

        They allow us to detect um/uh/umm/uhh
        before the browser finalizes the sentence.
    */

    recognition.interimResults =
        true;


    recognition.continuous =
        true;


    recognition.lang =
        "en-US";


    recognition.maxAlternatives =
        1;


    recognition.onstart =
        () => {

            recognitionRestarting =
                false;

            console.log(
                "Speech recognition started."
            );
        };


    recognition.onresult =
        event => {

            let interimTranscript =
                "";

            let finalTranscript =
                "";


            /*
                Process every changed result.

                We intentionally detect fillers BEFORE
                waiting for isFinal.
            */

            for (
                let i =
                    event.resultIndex;

                i <
                    event.results.length;

                i++
            ) {

                const result =
                    event.results[i];


                const text =
                    result[0]
                        .transcript;


                /*
                    FAST DETECTION FIRST.
                */

                detectLiveFillers(
                    text
                );


                if (
                    result.isFinal
                ) {

                    finalTranscript +=
                        text + " ";

                } else {

                    interimTranscript +=
                        text;
                }
            }


            liveFinalTranscript +=
                finalTranscript;


            liveInterimTranscript =
                interimTranscript;


            const combined =
                (
                    liveFinalTranscript +
                    " " +
                    liveInterimTranscript
                ).trim();


            updateLiveTranscript(
                combined
            );


            updateStats(
                combined
            );
        };


    recognition.onerror =
        event => {

            console.warn(
                "Speech recognition error:",
                event.error
            );


            if (
                event.error ===
                    "not-allowed" ||
                event.error ===
                    "service-not-allowed"
            ) {

                setStatus(
                    "Microphone permission denied",
                    "error"
                );

                stopListeningUI();

                return;
            }


            if (
                event.error ===
                    "no-speech"
            ) {

                return;
            }


            if (
                event.error ===
                    "aborted"
            ) {

                return;
            }


            setStatus(
                "Recognition error",
                "error"
            );
        };


    recognition.onend =
        () => {

            console.log(
                "Speech recognition ended."
            );


            if (
                isListening &&
                !recognitionRestarting
            ) {

                try {

                    recognitionRestarting =
                        true;

                    recognition.start();

                } catch (error) {

                    recognitionRestarting =
                        false;

                    console.warn(
                        "Recognition restart failed:",
                        error
                    );
                }
            }
        };
}


initializeRecognition();


/* ============================================================
   LIVE TRANSCRIPT
   ============================================================ */

function updateLiveTranscript(
    text
) {

    if (!heardElement) {
        return;
    }


    if (!text) {

        heardElement.innerHTML =
            `
            <span class="heard-placeholder">
                Listening...
            </span>
            `;

        return;
    }


    heardElement.innerHTML =
        highlightTrackedWords(
            escapeHTML(text)
        );
}


/* ============================================================
   STATS
   ============================================================ */

function updateStats(
    text
) {

    const normalized =
        normalizeSpeech(text);


    const words =
        normalized
            .split(" ")
            .filter(Boolean);


    totalWords =
        words.length;


    let detectedCount =
        0;


    /*
        Count normal tracked words.
    */

    for (
        const trackedWord
        of trackedWords
    ) {

        const escaped =
            escapeRegExp(
                trackedWord
            );


        const regex =
            new RegExp(
                `(^|\\s)${escaped}(?=\\s|$)`,
                "gi"
            );


        const matches =
            normalized.match(
                regex
            );


        if (matches) {

            detectedCount +=
                matches.length;
        }
    }


    /*
        Count elongated um/uh forms.

        We count them separately so that:

            um
            umm
            ummmm

        are all detected.
    */

    const naturalFillers =
        normalized.match(
            /(^|\s)(u+m+|u+h+)(?=\s|$)/gi
        );


    if (naturalFillers) {

        /*
            Remove normal um/uh counts that
            were already counted above.

            The default tracked list contains
            um/uh/umm/uhh, so we avoid double
            counting the same occurrence.
        */

        const normalUms =
            normalized.match(
                /(^|\s)(um|uh|umm|uhh)(?=\s|$)/gi
            );


        if (normalUms) {

            detectedCount -=
                normalUms.length;
        }


        detectedCount +=
            naturalFillers.length;
    }


    fillerCount =
        Math.max(
            0,
            detectedCount
        );


    if (
        fillerCountElement
    ) {

        fillerCountElement.textContent =
            fillerCount;
    }


    if (
        wordCountElement
    ) {

        wordCountElement.textContent =
            totalWords;
    }
}


/* ============================================================
   STATUS
   ============================================================ */

function setStatus(
    text,
    type = "ready"
) {

    if (statusElement) {

        statusElement.textContent =
            text;
    }


    if (statusDot) {

        statusDot.className =
            `dot ${type}`;
    }
}


/* ============================================================
   TIMER
   ============================================================ */

function formatTime(
    seconds
) {

    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainingSeconds =
        seconds % 60;


    return (
        String(minutes)
            .padStart(2, "0") +
        ":" +
        String(
            remainingSeconds
        ).padStart(2, "0")
    );
}


function startTimer() {

    recordingStartTime =
        Date.now();


    if (
        recordingTimerElement
    ) {

        recordingTimerElement.textContent =
            "00:00";
    }


    clearInterval(
        timerInterval
    );


    timerInterval =
        setInterval(
            () => {

                const elapsed =
                    Math.floor(
                        (
                            Date.now() -
                            recordingStartTime
                        ) / 1000
                    );


                if (
                    recordingTimerElement
                ) {

                    recordingTimerElement.textContent =
                        formatTime(
                            elapsed
                        );
                }

            },
            500
        );
}


function stopTimer() {

    clearInterval(
        timerInterval
    );

    timerInterval =
        null;
}


/* ============================================================
   AUDIO RECORDING
   ============================================================ */

async function startAudioRecording() {

    try {

        recordingStream =
            await navigator
                .mediaDevices
                .getUserMedia({
                    audio: true
                });


        audioChunks =
            [];


        let mimeType =
            "";


        const possibleTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4",
            "audio/ogg;codecs=opus"
        ];


        for (
            const type
            of possibleTypes
        ) {

            if (
                MediaRecorder.isTypeSupported(
                    type
                )
            ) {

                mimeType =
                    type;

                break;
            }
        }


        mediaRecorder =
            mimeType
                ? new MediaRecorder(
                    recordingStream,
                    {
                        mimeType
                    }
                )
                : new MediaRecorder(
                    recordingStream
                );


        mediaRecorder.ondataavailable =
            event => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    audioChunks.push(
                        event.data
                    );
                }
            };


        mediaRecorder.start(
            200
        );

    } catch (error) {

        console.error(
            "Could not access microphone:",
            error
        );

        throw error;
    }
}


/* ============================================================
   STOP AUDIO RECORDING
   ============================================================ */

function stopAudioRecording() {

    return new Promise(
        resolve => {

            if (
                !mediaRecorder ||
                mediaRecorder.state ===
                    "inactive"
            ) {

                resolve(null);

                return;
            }


            mediaRecorder.onstop =
                () => {

                    const blob =
                        new Blob(
                            audioChunks,
                            {
                                type:
                                    mediaRecorder.mimeType ||
                                    "audio/webm"
                            }
                        );


                    if (
                        recordingStream
                    ) {

                        recordingStream
                            .getTracks()
                            .forEach(
                                track =>
                                    track.stop()
                            );
                    }


                    recordingStream =
                        null;


                    resolve(
                        blob
                    );
                };


            mediaRecorder.stop();
        }
    );
}


/* ============================================================
   START LISTENING
   ============================================================ */

async function startListening() {

    if (isListening) {
        return;
    }


    /*
        This is now a NEW speech.
    */

    viewingSavedSpeechId =
        null;


    liveFinalTranscript =
        "";

    liveInterimTranscript =
        "";

    currentSpeechTranscript =
        "";

    currentAnalysisData =
        null;

    fillerCount =
        0;

    totalWords =
        0;

    lastDetectedLiveWord =
        "";

    lastDetectedLiveTime =
        0;


    updateStats("");


    if (heardElement) {

        heardElement.innerHTML =
            `
            <span class="heard-placeholder">
                Listening...
            </span>
            `;
    }


    if (
        finalTranscriptElement
    ) {

        finalTranscriptElement.textContent =
            "Your final transcript will appear here after you finish speaking.";
    }


    if (
        analysisElement
    ) {

        analysisElement.innerHTML =
            "";
    }


    if (
        analyzeButton
    ) {

        analyzeButton.disabled =
            true;
    }


    if (
        saveSpeechCard
    ) {

        saveSpeechCard.classList.add(
            "hidden"
        );
    }


    try {

        await startAudioRecording();


        isListening =
            true;


        listenButton.disabled =
            true;


        stopButton.disabled =
            false;


        setStatus(
            "Listening",
            "listening"
        );


        startTimer();


        if (
            recognitionSupported
        ) {

            try {

                recognition.start();

            } catch (error) {

                console.warn(
                    "Recognition start:",
                    error
                );
            }

        } else {

            setStatus(
                "Recording",
                "listening"
            );
        }

    } catch (error) {

        isListening =
            false;


        listenButton.disabled =
            false;


        stopButton.disabled =
            true;


        setStatus(
            "Microphone unavailable",
            "error"
        );
    }
}


/* ============================================================
   STOP LISTENING
   ============================================================ */

async function stopListening() {

    if (!isListening) {
        return;
    }


    isListening =
        false;


    listenButton.disabled =
        false;


    stopButton.disabled =
        true;


    stopTimer();


    setStatus(
        "Processing",
        "ready"
    );


    if (
        recognitionSupported &&
        recognition
    ) {

        try {

            recognition.stop();

        } catch (error) {

            console.warn(
                "Recognition stop:",
                error
            );
        }
    }


    /*
        Give the browser a very short amount
        of time to deliver the last recognition
        event.
    */

    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                80
            )
    );


    const recognitionTranscript =
        (
            liveFinalTranscript +
            " " +
            liveInterimTranscript
        ).trim();


    let audioBlob =
        null;


    try {

        audioBlob =
            await stopAudioRecording();

    } catch (error) {

        console.error(
            "Audio recording stop error:",
            error
        );
    }


    currentSpeechTranscript =
        recognitionTranscript;


    /*
        Immediately show the browser recognition
        transcript so the user doesn't stare
        at a blank screen.
    */

    if (
        recognitionTranscript
    ) {

        finalTranscriptElement.innerHTML =
            highlightTrackedWords(
                escapeHTML(
                    recognitionTranscript
                )
            );

    } else {

        finalTranscriptElement.textContent =
            "Creating final transcript...";
    }


    /*
        Send audio to OpenAI for the final
        higher-quality transcript.
    */

    if (audioBlob) {

        await createFinalTranscription(
            audioBlob
        );

    } else {

        finishSpeech(
            currentSpeechTranscript
        );
    }
}


/* ============================================================
   FINAL TRANSCRIPTION
   ============================================================ */

async function createFinalTranscription(
    audioBlob
) {

    try {

        setStatus(
            "Creating transcript",
            "ready"
        );


        const base64 =
            await blobToBase64(
                audioBlob
            );


        const response =
            await fetch(
                "/api/transcribe",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            audio:
                                base64
                        })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok
        ) {

            throw new Error(
                data?.error ||
                "Transcription failed"
            );
        }


        const transcript =
            data?.transcript ||
            data?.text ||
            currentSpeechTranscript;


        finishSpeech(
            transcript
        );

    } catch (error) {

        console.error(
            "Final transcription error:",
            error
        );


        /*
            Don't lose the speech if OpenAI
            final transcription fails.
        */

        finishSpeech(
            currentSpeechTranscript
        );
    }
}


/* ============================================================
   BLOB TO BASE64
   ============================================================ */

function blobToBase64(
    blob
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const reader =
                new FileReader();


            reader.onloadend =
                () => {

                    const result =
                        reader.result;


                    if (
                        typeof result !==
                        "string"
                    ) {

                        reject(
                            new Error(
                                "Could not read audio."
                            )
                        );

                        return;
                    }


                    const base64 =
                        result.split(
                            ","
                        )[1];


                    resolve(
                        base64
                    );
                };


            reader.onerror =
                reject;


            reader.readAsDataURL(
                blob
            );
        }
    );
}


/* ============================================================
   FINISH SPEECH
   ============================================================ */

function finishSpeech(
    transcript
) {

    currentSpeechTranscript =
        String(
            transcript || ""
        ).trim();


    updateStats(
        currentSpeechTranscript
    );


    currentAnalysisData =
        null;


    if (
        finalTranscriptElement
    ) {

        if (
            currentSpeechTranscript
        ) {

            finalTranscriptElement.innerHTML =
                highlightTrackedWords(
                    escapeHTML(
                        currentSpeechTranscript
                    )
                );

        } else {

            finalTranscriptElement.textContent =
                "No speech was detected.";
        }
    }


    setStatus(
        "Finished",
        "ready"
    );


    if (
        analyzeButton
    ) {

        analyzeButton.disabled =
            !currentSpeechTranscript;
    }


    /*
        Show Save Speech prompt.
    */

    if (
        currentSpeechTranscript &&
        saveSpeechCard
    ) {

        saveSpeechCard.classList.remove(
            "hidden"
        );


        saveSpeechCard.scrollIntoView({
            behavior:
                "smooth",

            block:
                "center"
        });
    }
}


/* ============================================================
   STOP UI
   ============================================================ */

function stopListeningUI() {

    isListening =
        false;


    stopTimer();


    if (
        listenButton
    ) {

        listenButton.disabled =
            false;
    }


    if (
        stopButton
    ) {

        stopButton.disabled =
            true;
    }
}


/* ============================================================
   BUTTON EVENTS
   ============================================================ */

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


/* ============================================================
   AI ANALYSIS
   ============================================================ */

async function analyzeSpeech() {

    if (
        !currentSpeechTranscript
    ) {

        return;
    }


    if (
        !analyzeButton
    ) {

        return;
    }


    analyzeButton.disabled =
        true;


    if (
        analysisLoading
    ) {

        analysisLoading.hidden =
            false;
    }


    if (
        analysisElement
    ) {

        analysisElement.innerHTML =
            "";
    }


    try {

        const response =
            await fetch(
                "/api/analyze",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            transcript:
                                currentSpeechTranscript
                        })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok
        ) {

            throw new Error(
                data?.error ||
                "AI analysis failed"
            );
        }


        /*
            Prefer the structured JSON response.

            This is important because the UI can
            display each section separately.
        */

        if (
            data?.analysisData
        ) {

            currentAnalysisData =
                JSON.parse(
                    JSON.stringify(
                        data.analysisData
                    )
                );


            displayStructuredAnalysis(
                currentAnalysisData
            );

        } else if (
            data?.analysis
        ) {

            /*
                Backwards compatibility in case
                the API still returns the formatted
                analysis string.
            */

            currentAnalysisData =
                null;


            analysisElement.textContent =
                data.analysis;

        } else {

            throw new Error(
                "AI returned no analysis."
            );
        }


        /*
            If this is an existing saved speech,
            update its stored AI analysis too.
        */

        if (
            viewingSavedSpeechId !==
            null
        ) {

            updateSavedSpeechAnalysis(
                viewingSavedSpeechId,
                currentAnalysisData
            );
        }


        analysisElement.scrollIntoView({
            behavior:
                "smooth",

            block:
                "center"
        });


    } catch (error) {

        console.error(
            "AI analysis error:",
            error
        );


        analysisElement.innerHTML =
            `
            <div class="analysis-error">
                <strong>
                    Analysis couldn't be completed.
                </strong>

                <p>
                    ${escapeHTML(
                        error?.message ||
                        "Please try again."
                    )}
                </p>
            </div>
            `;

    } finally {

        if (
            analysisLoading
        ) {

            analysisLoading.hidden =
                true;
        }


        analyzeButton.disabled =
            !currentSpeechTranscript;
    }
}


/* ============================================================
   STRUCTURED AI DISPLAY
   ============================================================ */

function displayStructuredAnalysis(
    data
) {

    if (
        !analysisElement
    ) {

        return;
    }


    const sections = [

        {
            title:
                "Overall Assessment",

            key:
                "overall",

            icon:
                "◉"
        },

        {
            title:
                "Filler Words",

            key:
                "fillerWords",

            icon:
                "!"
        },

        {
            title:
                "Clarity & Wording",

            key:
                "clarity",

            icon:
                "↗"
        },

        {
            title:
                "What You Did Well",

            key:
                "strength",

            icon:
                "✓"
        },

        {
            title:
                "What To Improve",

            key:
                "improvement",

            icon:
                "→"
        },

        {
            title:
                "Next-Speech Tip",

            key:
                "tip",

            icon:
                "★"
        }
    ];


    analysisElement.innerHTML =
        "";


    sections.forEach(
        sectionData => {

            const value =
                data?.[
                    sectionData.key
                ];


            if (
                !value ||
                typeof value !==
                    "string"
            ) {

                return;
            }


            const section =
                document.createElement(
                    "article"
                );


            section.className =
                "analysis-section";


            const heading =
                document.createElement(
                    "div"
                );


            heading.className =
                "analysis-section-heading";


            const icon =
                document.createElement(
                    "span"
                );


            icon.className =
                "analysis-section-icon";


            icon.textContent =
                sectionData.icon;


            const title =
                document.createElement(
                    "h3"
                );


            title.textContent =
                sectionData.title;


            heading.appendChild(
                icon
            );

            heading.appendChild(
                title
            );


            const paragraph =
                document.createElement(
                    "p"
                );


            paragraph.textContent =
                value;


            section.appendChild(
                heading
            );


            section.appendChild(
                paragraph
            );


            analysisElement.appendChild(
                section
            );
        }
    );
}


/* ============================================================
   SAVED SPEECHES
   ============================================================ */

function loadSavedSpeeches() {

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(
                    SPEECH_STORAGE_KEY
                )
            );


        if (
            Array.isArray(saved)
        ) {

            return saved;
        }

    } catch (error) {

        console.warn(
            "Could not load saved speeches:",
            error
        );
    }


    return [];
}


function saveSavedSpeeches(
    speeches
) {

    localStorage.setItem(
        SPEECH_STORAGE_KEY,
        JSON.stringify(
            speeches
        )
    );
}


/* ============================================================
   RENDER SAVED SPEECHES
   ============================================================ */

function renderSavedSpeeches() {

    if (
        !savedSpeechesElement
    ) {

        return;
    }


    const speeches =
        loadSavedSpeeches();


    if (
        savedSpeechCount
    ) {

        savedSpeechCount.textContent =
            speeches.length;
    }


    if (
        speeches.length === 0
    ) {

        savedSpeechesElement.innerHTML =
            `
            <div class="empty-state">

                <div class="empty-icon">
                    ◌
                </div>

                <p>
                    No saved speeches yet.
                </p>

            </div>
            `;

        return;
    }


    savedSpeechesElement.innerHTML =
        "";


    speeches.forEach(
        speech => {

            const item =
                document.createElement(
                    "article"
                );


            item.className =
                "saved-speech";


            const header =
                document.createElement(
                    "div"
                );


            header.className =
                "saved-speech-header";


            const title =
                document.createElement(
                    "div"
                );


            title.className =
                "saved-speech-title";


            title.textContent =
                speech.title ||
                "Speech";


            const date =
                document.createElement(
                    "div"
                );


            date.className =
                "saved-speech-date";


            date.textContent =
                formatSavedDate(
                    speech.date
                );


            header.appendChild(
                title
            );


            header.appendChild(
                date
            );


            const preview =
                document.createElement(
                    "div"
                );


            preview.className =
                "saved-speech-preview";


            preview.textContent =
                speech.transcript ||
                "No transcript available.";


            const meta =
                document.createElement(
                    "div"
                );


            meta.className =
                "saved-speech-meta";


            const words =
                document.createElement(
                    "span"
                );


            words.textContent =
                `${speech.wordCount || 0} words`;


            const fillers =
                document.createElement(
                    "span"
                );


            fillers.textContent =
                `${speech.fillerCount || 0} tracked`;


            meta.appendChild(
                words
            );


            meta.appendChild(
                fillers
            );


            const actions =
                document.createElement(
                    "div"
                );


            actions.className =
                "saved-speech-actions";


            const viewButton =
                document.createElement(
                    "button"
                );


            viewButton.type =
                "button";


            viewButton.className =
                "button secondary";


            viewButton.textContent =
                "View";


            viewButton.addEventListener(
                "click",
                () => {

                    viewSavedSpeech(
                        speech.id
                    );
                }
            );


            const deleteButton =
                document.createElement(
                    "button"
                );


            deleteButton.type =
                "button";


            deleteButton.className =
                "button secondary danger-button";


            deleteButton.textContent =
                "Delete";


            deleteButton.addEventListener(
                "click",
                () => {

                    deleteSavedSpeech(
                        speech.id
                    );
                }
            );


            actions.appendChild(
                viewButton
            );


            actions.appendChild(
                deleteButton
            );


            item.appendChild(
                header
            );


            item.appendChild(
                preview
            );


            item.appendChild(
                meta
            );


            item.appendChild(
                actions
            );


            savedSpeechesElement.appendChild(
                item
            );
        }
    );
}


/* ============================================================
   VIEW SAVED SPEECH
   ============================================================ */

function viewSavedSpeech(
    speechId
) {

    const speeches =
        loadSavedSpeeches();


    const speech =
        speeches.find(
            item =>
                String(item.id) ===
                String(speechId)
        );


    if (!speech) {

        console.warn(
            "Saved speech not found:",
            speechId
        );

        return;
    }


    /*
        Mark exactly which speech is being viewed.
    */

    viewingSavedSpeechId =
        speech.id;


    /*
        Load THIS speech into the UI.
        Nothing is taken from the current recording.
    */

    currentSpeechTranscript =
        speech.transcript ||
        "";


    fillerCount =
        Number(
            speech.fillerCount || 0
        );


    totalWords =
        Number(
            speech.wordCount || 0
        );


    currentAnalysisData =
        speech.analysisData
            ? JSON.parse(
                JSON.stringify(
                    speech.analysisData
                )
            )
            : null;


    /*
        Update stats.
    */

    if (
        fillerCountElement
    ) {

        fillerCountElement.textContent =
            fillerCount;
    }


    if (
        wordCountElement
    ) {

        wordCountElement.textContent =
            totalWords;
    }


    /*
        Load the specific transcript.
    */

    if (
        finalTranscriptElement
    ) {

        if (
            currentSpeechTranscript
        ) {

            finalTranscriptElement.innerHTML =
                highlightTrackedWords(
                    escapeHTML(
                        currentSpeechTranscript
                    )
                );

        } else {

            finalTranscriptElement.textContent =
                "No transcript available.";
        }
    }


    /*
        Load THIS speech's AI analysis.

        This is the major fix for the bug.
    */

    if (
        analysisElement
    ) {

        if (
            currentAnalysisData
        ) {

            displayStructuredAnalysis(
                currentAnalysisData
            );

        } else {

            analysisElement.innerHTML =
                `
                <div class="analysis-empty">

                    <strong>
                        No AI analysis saved
                    </strong>

                    <p>
                        Analyze this speech to create feedback.
                    </p>

                </div>
                `;
        }
    }


    /*
        Enable analysis for this saved speech.
    */

    if (
        analyzeButton
    ) {

        analyzeButton.disabled =
            !currentSpeechTranscript;
    }


    /*
        Hide the save prompt because this
        speech is already saved.
    */

    if (
        saveSpeechCard
    ) {

        saveSpeechCard.classList.add(
            "hidden"
        );
    }


    setStatus(
        "Viewing saved speech",
        "ready"
    );


    /*
        Scroll to the transcript.
    */

    if (
        document.getElementById(
            "transcriptSection"
        )
    ) {

        document.getElementById(
            "transcriptSection"
        ).scrollIntoView({
            behavior:
                "smooth",

            block:
                "start"
        });
    }
}


/* ============================================================
   UPDATE SAVED SPEECH ANALYSIS
   ============================================================ */

function updateSavedSpeechAnalysis(
    speechId,
    analysisData
) {

    if (
        !speechId ||
        !analysisData
    ) {

        return;
    }


    const speeches =
        loadSavedSpeeches();


    const index =
        speeches.findIndex(
            speech =>
                String(speech.id) ===
                String(speechId)
        );


    if (
        index === -1
    ) {

        return;
    }


    speeches[index].analysisData =
        JSON.parse(
            JSON.stringify(
                analysisData
            )
        );


    speeches[index].analysisUpdatedAt =
        new Date().toISOString();


    saveSavedSpeeches(
        speeches
    );


    renderSavedSpeeches();
}


/* ============================================================
   DELETE SAVED SPEECH
   ============================================================ */

function deleteSavedSpeech(
    speechId
) {

    const speeches =
        loadSavedSpeeches();


    const updated =
        speeches.filter(
            speech =>
                String(speech.id) !==
                String(speechId)
        );


    saveSavedSpeeches(
        updated
    );


    if (
        String(viewingSavedSpeechId) ===
        String(speechId)
    ) {

        viewingSavedSpeechId =
            null;
    }


    renderSavedSpeeches();
}


/* ============================================================
   SAVED DATE
   ============================================================ */

function formatSavedDate(
    date
) {

    if (!date) {
        return "";
    }


    try {

        return new Date(
            date
        ).toLocaleString();

    } catch {

        return "";
    }
}


/* ============================================================
   SAVE CURRENT SPEECH
   ============================================================ */

function saveCurrentSpeech() {

    if (
        !currentSpeechTranscript
    ) {

        return;
    }


    const speeches =
        loadSavedSpeeches();


    /*
        Save a COMPLETE SNAPSHOT.

        This means each speech gets:
        - its own transcript
        - its own stats
        - its own AI analysis
    */

    const speech = {

        id:
            Date.now(),

        title:
            `Speech ${speeches.length + 1}`,

        date:
            new Date().toISOString(),

        transcript:
            String(
                currentSpeechTranscript
            ),

        fillerCount:
            Number(
                fillerCount
            ),

        wordCount:
            Number(
                totalWords
            ),

        analysisData:
            currentAnalysisData
                ? JSON.parse(
                    JSON.stringify(
                        currentAnalysisData
                    )
                )
                : null
    };


    speeches.unshift(
        speech
    );


    /*
        Keep newest 50.
    */

    const trimmed =
        speeches.slice(
            0,
            50
        );


    saveSavedSpeeches(
        trimmed
    );


    renderSavedSpeeches();


    viewingSavedSpeechId =
        speech.id;


    if (
        saveSpeechCard
    ) {

        saveSpeechCard.classList.add(
            "hidden"
        );
    }


    if (
        saveSpeechButton
    ) {

        saveSpeechButton.textContent =
            "✓ Saved";


        setTimeout(
            () => {

                saveSpeechButton.textContent =
                    "✓ Save Speech";

            },
            1200
        );
    }
}


if (
    saveSpeechButton
) {

    saveSpeechButton.addEventListener(
        "click",
        saveCurrentSpeech
    );
}


/* ============================================================
   DISCARD
   ============================================================ */

if (
    discardSpeechButton
) {

    discardSpeechButton.addEventListener(
        "click",
        () => {

            if (
                saveSpeechCard
            ) {

                saveSpeechCard.classList.add(
                    "hidden"
                );
            }
        }
    );
}


/* ============================================================
   SCROLL INDICATOR
   ============================================================ */

if (
    scrollIndicator
) {

    let indicatorHidden =
        false;


    window.addEventListener(
        "scroll",
        () => {

            if (
                indicatorHidden
            ) {

                return;
            }


            if (
                window.scrollY > 80
            ) {

                indicatorHidden =
                    true;


                scrollIndicator.classList.add(
                    "hidden"
                );


                setTimeout(
                    () => {

                        if (
                            scrollIndicator
                        ) {

                            scrollIndicator.remove();
                        }

                    },
                    300
                );
            }

        },
        {
            passive:
                true
        }
    );
}


/* ============================================================
   PAGE VISIBILITY
   ============================================================ */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
                "visible" &&
            isListening &&
            recognitionSupported
        ) {

            try {

                recognition.start();

            } catch {
                /*
                    Recognition is probably
                    already running.
                */
            }
        }
    }
);


/* ============================================================
   INITIALIZE
   ============================================================ */

loadTrackedWords();

renderWordList();

renderSavedSpeeches();

updateNotificationStatus();