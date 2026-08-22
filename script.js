// ============================================================
// SPEECH TRACKER
// ============================================================
// Live Browser Transcription
// + OpenAI Final Transcription
// + Filler Detection
// + Single Vibration / Notification
// + AI Analysis
// + Dark / Light Mode
// + Friendly UI
// ============================================================


// ============================================================
// ELEMENTS
// ============================================================

const statusText = document.getElementById("status");
const statusDot = document.getElementById("statusDot");

const heardText = document.getElementById("heard");

const listenButton = document.getElementById("listenButton");
const stopButton = document.getElementById("stopButton");

const customWordInput =
    document.getElementById("customWordInput");

const addWordButton =
    document.getElementById("addWordButton");

const wordList =
    document.getElementById("wordList");

const resetWordsButton =
    document.getElementById("resetWordsButton");

const fillerCountElement =
    document.getElementById("fillerCount");

const wordCountElement =
    document.getElementById("wordCount");

const analyzeButton =
    document.getElementById("analyzeButton");

const analysisElement =
    document.getElementById("analysis");

const analysisLoading =
    document.getElementById("analysisLoading");


// ============================================================
// DEFAULT FILLER WORDS
// ============================================================

const DEFAULT_WORDS = [
    "um",
    "uh",
    "umm",
    "uhh",
    "erm",
    "er",
    "like",
    "you know",
    "basically",
    "literally",
    "actually"
];


// ============================================================
// SPECIAL LIVE-SPEECH VARIANTS
// ============================================================
// Speech recognition sometimes turns:
//
// "umm" -> "um"
// "uhhh" -> "uh"
// "ummm" -> "um"
//
// We therefore treat these forms as fillers too.
//
// These are only used for LIVE detection.
// ============================================================

const LIVE_FILLER_PATTERNS = [
    {
        name: "um",
        regex: /\bumm{0,6}\b/gi
    },
    {
        name: "uh",
        regex: /\buhh{0,6}\b/gi
    },
    {
        name: "er",
        regex: /\berr{0,4}\b/gi
    }
];


// ============================================================
// TRACKED WORDS
// ============================================================

let trackedWords = [];

try {
    const saved =
        localStorage.getItem("speechTrackerWords");

    if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
            trackedWords = parsed;
        }
    }
} catch (error) {
    console.error(
        "Could not load saved words:",
        error
    );
}

if (trackedWords.length === 0) {
    trackedWords = [...DEFAULT_WORDS];
}


// ============================================================
// RECORDING STATE
// ============================================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];

let isRecording = false;


// ============================================================
// LIVE RECOGNITION STATE
// ============================================================

let recognition = null;

let liveRecognitionSupported = false;

let recognitionShouldRun = false;

let liveFinalText = "";

let liveInterimText = "";


// ============================================================
// IMPORTANT:
//
// These counts prevent duplicate notifications.
//
// Example:
//
// Live transcript:
// "I um..."
//
// Browser revises it:
// "I um..."
//
// Browser revises it again:
// "I um..."
//
// The count stays 1.
//
// We only notify when the highest count increases:
//
// 0 -> 1 = notify
// 1 -> 1 = nothing
// 1 -> 1 = nothing
// 1 -> 2 = notify
// ============================================================

let peakLiveFillerCounts = {};


// ============================================================
// FINAL TRANSCRIPT
// ============================================================

let finalTranscript = "";

let fillerCount = 0;

let totalWords = 0;


// ============================================================
// THEME
// ============================================================

function initializeTheme() {

    const savedTheme =
        localStorage.getItem("speechTrackerTheme");

    const prefersDark =
        window.matchMedia &&
        window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches;

    const theme =
        savedTheme ||
        (prefersDark ? "dark" : "light");

    applyTheme(theme);

    createThemeButton();
}


function applyTheme(theme) {

    document.documentElement.setAttribute(
        "data-theme",
        theme
    );

    document.body.classList.toggle(
        "dark-mode",
        theme === "dark"
    );

    document.body.classList.toggle(
        "light-mode",
        theme === "light"
    );

    localStorage.setItem(
        "speechTrackerTheme",
        theme
    );

    updateThemeButton();
}


function toggleTheme() {

    const current =
        document.documentElement.getAttribute(
            "data-theme"
        ) || "light";

    const next =
        current === "dark"
            ? "light"
            : "dark";

    applyTheme(next);
}


let themeButton = null;


function createThemeButton() {

    // Don't create another one if HTML already contains it.
    themeButton =
        document.getElementById(
            "themeToggle"
        );

    if (!themeButton) {

        themeButton =
            document.createElement("button");

        themeButton.id =
            "themeToggle";

        themeButton.type =
            "button";

        themeButton.setAttribute(
            "aria-label",
            "Toggle dark mode"
        );

        themeButton.style.position =
            "fixed";

        themeButton.style.top =
            "18px";

        themeButton.style.right =
            "18px";

        themeButton.style.zIndex =
            "9999";

        themeButton.style.width =
            "44px";

        themeButton.style.height =
            "44px";

        themeButton.style.borderRadius =
            "12px";

        themeButton.style.border =
            "1px solid var(--border, #E4E4E7)";

        themeButton.style.background =
            "var(--surface, #F4F4F5)";

        themeButton.style.color =
            "var(--text, #09090B)";

        themeButton.style.cursor =
            "pointer";

        themeButton.style.fontSize =
            "20px";

        themeButton.style.display =
            "flex";

        themeButton.style.alignItems =
            "center";

        themeButton.style.justifyContent =
            "center";

        themeButton.style.transition =
            "all 0.2s ease";

        document.body.appendChild(
            themeButton
        );
    }

    themeButton.onclick =
        toggleTheme;

    updateThemeButton();
}


function updateThemeButton() {

    if (!themeButton) {
        return;
    }

    const theme =
        document.documentElement.getAttribute(
            "data-theme"
        );

    themeButton.textContent =
        theme === "dark"
            ? "☀️"
            : "🌙";

    themeButton.title =
        theme === "dark"
            ? "Switch to light mode"
            : "Switch to dark mode";
}


// ============================================================
// STATUS
// ============================================================

function setStatus(
    message,
    state = "ready"
) {

    if (statusText) {
        statusText.textContent =
            message;
    }

    if (statusDot) {
        statusDot.className =
            "dot " + state;
    }
}


// ============================================================
// MESSAGE
// ============================================================

function showMessage(message) {

    if (!heardText) {
        return;
    }

    heardText.textContent =
        message;
}


// ============================================================
// SAVE WORDS
// ============================================================

function saveWords() {

    try {

        localStorage.setItem(
            "speechTrackerWords",
            JSON.stringify(
                trackedWords
            )
        );

    } catch (error) {

        console.error(
            "Could not save words:",
            error
        );
    }
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text;

    return div.innerHTML;
}


// ============================================================
// ESCAPE REGEX
// ============================================================

function escapeRegex(text) {

    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}


// ============================================================
// RENDER WORDS
// ============================================================

function renderWords() {

    if (!wordList) {
        return;
    }

    wordList.innerHTML = "";

    trackedWords.forEach(
        (word, index) => {

            const tag =
                document.createElement(
                    "div"
                );

            tag.className =
                "word-tag";

            const text =
                document.createElement(
                    "span"
                );

            text.textContent =
                word;

            const remove =
                document.createElement(
                    "button"
                );

            remove.type =
                "button";

            remove.textContent =
                "×";

            remove.setAttribute(
                "aria-label",
                `Remove ${word}`
            );

            remove.addEventListener(
                "click",
                () => {

                    trackedWords.splice(
                        index,
                        1
                    );

                    saveWords();

                    renderWords();
                }
            );

            tag.appendChild(text);

            tag.appendChild(remove);

            wordList.appendChild(tag);
        }
    );
}


// ============================================================
// ADD CUSTOM WORD
// ============================================================

function addCustomWord() {

    if (!customWordInput) {
        return;
    }

    const word =
        customWordInput.value
            .trim()
            .toLowerCase();

    if (!word) {
        return;
    }

    if (!trackedWords.includes(word)) {

        trackedWords.push(word);

        saveWords();

        renderWords();
    }

    customWordInput.value = "";
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
        () => {

            trackedWords =
                [...DEFAULT_WORDS];

            saveWords();

            renderWords();
        }
    );
}


// ============================================================
// FIND TRACKED WORDS
// ============================================================

function findTrackedWords(text) {

    const matches = [];

    trackedWords.forEach(
        word => {

            if (!word.trim()) {
                return;
            }

            const regex =
                new RegExp(
                    "\\b" +
                    escapeRegex(word) +
                    "\\b",
                    "gi"
                );

            let match;

            while (
                (match = regex.exec(text)) !== null
            ) {

                matches.push({
                    word: word,
                    index: match.index
                });
            }
        }
    );

    matches.sort(
        (a, b) =>
            a.index - b.index
    );

    return matches;
}


// ============================================================
// COUNT TRACKED WORDS
// ============================================================

function countTrackedWords(text) {

    let count = 0;

    trackedWords.forEach(
        word => {

            if (!word.trim()) {
                return;
            }

            const regex =
                new RegExp(
                    "\\b" +
                    escapeRegex(word) +
                    "\\b",
                    "gi"
                );

            const matches =
                text.match(regex);

            if (matches) {
                count += matches.length;
            }
        }
    );

    return count;
}


// ============================================================
// COUNT TOTAL WORDS
// ============================================================

function countTotalWords(text) {

    if (!text || !text.trim()) {
        return 0;
    }

    return text
        .trim()
        .split(/\s+/)
        .length;
}


// ============================================================
// HIGHLIGHT TRACKED WORDS
// ============================================================

function highlightTrackedWords(text) {

    let result =
        escapeHTML(text);

    const sortedWords =
        [...trackedWords].sort(
            (a, b) =>
                b.length - a.length
        );

    sortedWords.forEach(
        word => {

            if (!word.trim()) {
                return;
            }

            const escapedWord =
                escapeRegex(
                    escapeHTML(word)
                );

            const regex =
                new RegExp(
                    "(^|\\s)(" +
                    escapedWord +
                    ")(?=\\s|[.,!?;:]|$)",
                    "gi"
                );

            result =
                result.replace(
                    regex,
                    '$1<span class="highlight">$2</span>'
                );
        }
    );

    return result;
}


// ============================================================
// DISPLAY FINAL TRANSCRIPT
// ============================================================

function displayTranscript(text) {

    finalTranscript =
        text || "";

    fillerCount =
        countTrackedWords(
            finalTranscript
        );

    totalWords =
        countTotalWords(
            finalTranscript
        );

    if (heardText) {

        heardText.innerHTML =
            highlightTrackedWords(
                finalTranscript
            );
    }

    if (fillerCountElement) {

        fillerCountElement.textContent =
            fillerCount;
    }

    if (wordCountElement) {

        wordCountElement.textContent =
            totalWords;
    }

    if (analyzeButton) {

        analyzeButton.disabled =
            !finalTranscript.trim();
    }
}


// ============================================================
// DISPLAY LIVE TRANSCRIPT
// ============================================================

function displayLiveTranscript() {

    const complete =
        liveFinalText || "";

    const interim =
        liveInterimText || "";

    const combined =
        (
            complete +
            " " +
            interim
        ).trim();

    if (!combined) {
        return;
    }

    fillerCount =
        countTrackedWords(
            combined
        );

    totalWords =
        countTotalWords(
            combined
        );

    if (heardText) {

        heardText.innerHTML =
            highlightTrackedWords(
                combined
            );
    }

    if (fillerCountElement) {

        fillerCountElement.textContent =
            fillerCount;
    }

    if (wordCountElement) {

        wordCountElement.textContent =
            totalWords;
    }
}


// ============================================================
// LIVE FILLER COUNTING
// ============================================================

function getLiveFillerCounts(text) {

    const counts = {};

    trackedWords.forEach(
        word => {
            counts[word] = 0;
        }
    );


    // --------------------------------------------------------
    // Normal tracked words
    // --------------------------------------------------------

    trackedWords.forEach(
        word => {

            if (!word.trim()) {
                return;
            }

            const regex =
                new RegExp(
                    "\\b" +
                    escapeRegex(word) +
                    "\\b",
                    "gi"
                );

            const matches =
                text.match(regex);

            if (matches) {

                counts[word] =
                    matches.length;
            }
        }
    );


    // --------------------------------------------------------
    // Extra handling for stretched "um"/"uh"
    // --------------------------------------------------------

    const umMatches =
        text.match(
            /\bumm{0,8}\b/gi
        );

    const uhMatches =
        text.match(
            /\buhh{0,8}\b/gi
        );

    const erMatches =
        text.match(
            /\berr{0,5}\b/gi
        );


    if (
        umMatches &&
        trackedWords.some(
            word =>
                ["um", "umm"].includes(word)
        )
    ) {

        const amount =
            umMatches.length;

        if (trackedWords.includes("um")) {
            counts.um =
                Math.max(
                    counts.um || 0,
                    amount
                );
        }

        if (trackedWords.includes("umm")) {
            counts.umm =
                Math.max(
                    counts.umm || 0,
                    amount
                );
        }
    }


    if (
        uhMatches &&
        trackedWords.some(
            word =>
                ["uh", "uhh"].includes(word)
        )
    ) {

        const amount =
            uhMatches.length;

        if (trackedWords.includes("uh")) {
            counts.uh =
                Math.max(
                    counts.uh || 0,
                    amount
                );
        }

        if (trackedWords.includes("uhh")) {
            counts.uhh =
                Math.max(
                    counts.uhh || 0,
                    amount
                );
        }
    }


    if (
        erMatches &&
        trackedWords.some(
            word =>
                ["er", "erm"].includes(word)
        )
    ) {

        const amount =
            erMatches.length;

        if (trackedWords.includes("er")) {
            counts.er =
                Math.max(
                    counts.er || 0,
                    amount
                );
        }

        if (trackedWords.includes("erm")) {
            counts.erm =
                Math.max(
                    counts.erm || 0,
                    amount
                );
        }
    }


    return counts;
}


// ============================================================
// VIBRATION
// ============================================================
//
// ONE long vibration.
// No double vibration pattern.
// ============================================================

function vibrate() {

    if (
        typeof navigator.vibrate !==
        "function"
    ) {

        console.log(
            "Vibration is not supported."
        );

        return;
    }

    try {

        // One strong, long vibration.
        navigator.vibrate(500);

    } catch (error) {

        console.error(
            "Vibration error:",
            error
        );
    }
}


// ============================================================
// NOTIFICATION
// ============================================================

async function notifyFiller(word) {

    console.log(
        "🚨 FILLER DETECTED:",
        word
    );


    if (
        typeof Notification ===
        "undefined"
    ) {

        return;
    }


    try {

        let permission =
            Notification.permission;


        if (
            permission === "default"
        ) {

            // Usually permission will already
            // have been requested when Listen
            // was pressed.
            permission =
                await Notification.requestPermission();
        }


        if (
            permission !== "granted"
        ) {

            console.log(
                "Notifications not granted:",
                permission
            );

            return;
        }


        const notification =
            new Notification(
                "Speech Tracker",
                {
                    body:
                        `Filler word detected: "${word}"`,
                    tag:
                        "speech-tracker-filler",
                    renotify:
                        false,
                    silent:
                        false
                }
            );


        setTimeout(
            () => {

                try {
                    notification.close();
                } catch (error) {}

            },
            2500
        );

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );
    }
}


// ============================================================
// HANDLE ONE NEW FILLER
// ============================================================

function handleNewFiller(word) {

    console.log(
        "⚡ NEW FILLER:",
        word
    );


    // ONE vibration.
    vibrate();


    // ONE notification.
    notifyFiller(word);


    // Small visual feedback.
    flashFillerFeedback(word);
}


// ============================================================
// VISUAL FILLER FEEDBACK
// ============================================================

function flashFillerFeedback(word) {

    document.body.classList.remove(
        "filler-detected"
    );

    // Force browser to recognize
    // the class being removed/re-added.
    void document.body.offsetWidth;

    document.body.classList.add(
        "filler-detected"
    );


    setTimeout(
        () => {

            document.body.classList.remove(
                "filler-detected"
            );

        },
        450
    );


    if (statusText) {

        const oldStatus =
            statusText.textContent;

        statusText.textContent =
            `⚠️ "${word}" detected`;

        setTimeout(
            () => {

                if (isRecording) {

                    statusText.textContent =
                        "Recording...";
                }

            },
            700
        );
    }
}


// ============================================================
// PROCESS LIVE FILLERS
// ============================================================
//
// THIS IS THE IMPORTANT PART.
//
// We do NOT compare the current transcript against
// the previous transcript directly.
//
// Instead, we remember the highest number of
// each filler that has ever appeared.
//
// This prevents:
//
// "um"
// "um"
// "um"
// "um"
//
// from causing four notifications.
//
// But:
//
// "um"
// "um ..."
// "um ... uh"
//
// correctly causes:
//
// notification -> um
// notification -> uh
// ============================================================

function processLiveFillers(text) {

    if (!text || !text.trim()) {
        return;
    }


    const currentCounts =
        getLiveFillerCounts(text);


    for (
        const word of trackedWords
    ) {

        const current =
            currentCounts[word] || 0;

        const previousPeak =
            peakLiveFillerCounts[word] || 0;


        // Only fire when the total number
        // of occurrences has increased.
        if (
            current >
            previousPeak
        ) {

            const difference =
                current -
                previousPeak;


            // If two NEW filler occurrences
            // somehow arrive in one update,
            // notify once for each actual occurrence.
            //
            // This still NEVER repeats the same
            // occurrence from interim revisions.

            for (
                let i = 0;
                i < difference;
                i++
            ) {

                handleNewFiller(
                    word
                );
            }


            peakLiveFillerCounts[word] =
                current;
        }
    }
}


// ============================================================
// RESET LIVE FILLER TRACKING
// ============================================================

function resetLiveFillerTracking() {

    peakLiveFillerCounts = {};

    trackedWords.forEach(
        word => {
            peakLiveFillerCounts[word] =
                0;
        }
    );
}


// ============================================================
// LIVE SPEECH RECOGNITION SETUP
// ============================================================

function setupLiveRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        console.log(
            "Live speech recognition is not supported."
        );

        liveRecognitionSupported =
            false;

        return;
    }


    liveRecognitionSupported =
        true;


    recognition =
        new SpeechRecognition();


    recognition.continuous =
        true;


    recognition.interimResults =
        true;


    recognition.lang =
        "en-US";


    recognition.maxAlternatives =
        1;


    // --------------------------------------------------------
    // START
    // --------------------------------------------------------

    recognition.onstart =
        () => {

            console.log(
                "🎤 LIVE RECOGNITION STARTED"
            );
        };


    // --------------------------------------------------------
    // RESULT
    // --------------------------------------------------------

    recognition.onresult =
        event => {

            let newFinalText =
                "";

            let newInterimText =
                "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const result =
                    event.results[i];

                const text =
                    result[0].transcript;


                if (
                    result.isFinal
                ) {

                    newFinalText +=
                        text + " ";

                } else {

                    newInterimText +=
                        text;
                }
            }


            // Add newly finalized speech.
            if (newFinalText) {

                liveFinalText +=
                    newFinalText;
            }


            // Current changing interim speech.
            liveInterimText =
                newInterimText;


            const combined =
                (
                    liveFinalText +
                    " " +
                    liveInterimText
                ).trim();


            // Update UI immediately.
            displayLiveTranscript();


            // MOST IMPORTANT:
            // Process the current live transcript,
            // including INTERIM results.
            processLiveFillers(
                combined
            );
        };


    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

    recognition.onerror =
        event => {

            console.error(
                "LIVE RECOGNITION ERROR:",
                event.error
            );


            if (
                !recognitionShouldRun
            ) {
                return;
            }


            if (
                event.error ===
                "not-allowed"
            ) {

                setStatus(
                    "Microphone permission needed",
                    "error"
                );

            } else if (
                event.error ===
                "audio-capture"
            ) {

                setStatus(
                    "Microphone unavailable",
                    "error"
                );

            } else if (
                event.error ===
                "network"
            ) {

                console.log(
                    "Speech recognition network error."
                );

            } else if (
                event.error ===
                "no-speech"
            ) {

                console.log(
                    "No speech detected."
                );
            }
        };


    // --------------------------------------------------------
    // END
    // --------------------------------------------------------

    recognition.onend =
        () => {

            console.log(
                "LIVE RECOGNITION ENDED"
            );


            // Restart automatically while
            // the user is still recording.
            if (
                recognitionShouldRun &&
                isRecording
            ) {

                setTimeout(
                    () => {

                        if (
                            !recognitionShouldRun ||
                            !isRecording
                        ) {
                            return;
                        }


                        try {

                            recognition.start();

                        } catch (error) {

                            console.log(
                                "Recognition restart skipped."
                            );
                        }

                    },
                    100
                );
            }
        };
}


// ============================================================
// START LIVE RECOGNITION
// ============================================================

function startLiveRecognition() {

    if (
        !recognition ||
        !liveRecognitionSupported
    ) {

        console.log(
            "Live recognition unavailable."
        );

        return;
    }


    liveFinalText =
        "";

    liveInterimText =
        "";


    resetLiveFillerTracking();


    recognitionShouldRun =
        true;


    try {

        recognition.start();

    } catch (error) {

        console.log(
            "Recognition already running."
        );
    }
}


// ============================================================
// STOP LIVE RECOGNITION
// ============================================================

function stopLiveRecognition() {

    recognitionShouldRun =
        false;


    if (!recognition) {
        return;
    }


    try {

        recognition.stop();

    } catch (error) {

        console.log(
            "Recognition already stopped."
        );
    }
}


// ============================================================
// MICROPHONE SUPPORT
// ============================================================

function checkMicrophoneSupport() {

    return !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
    );
}


// ============================================================
// AUDIO MIME TYPE
// ============================================================

function getRecordingMimeType() {

    if (
        typeof MediaRecorder ===
        "undefined"
    ) {

        return "";
    }


    const formats = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4"
    ];


    for (
        const format of formats
    ) {

        try {

            if (
                MediaRecorder.isTypeSupported(
                    format
                )
            ) {

                return format;
            }

        } catch (error) {}
    }


    return "";
}


// ============================================================
// REQUEST NOTIFICATION PERMISSION
// ============================================================

async function requestNotificationPermission() {

    if (
        typeof Notification ===
        "undefined"
    ) {

        return false;
    }


    try {

        if (
            Notification.permission ===
            "granted"
        ) {

            return true;
        }


        if (
            Notification.permission ===
            "denied"
        ) {

            return false;
        }


        const permission =
            await Notification.requestPermission();


        console.log(
            "Notification permission:",
            permission
        );


        return (
            permission ===
            "granted"
        );

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

        return false;
    }
}


// ============================================================
// START RECORDING
// ============================================================

async function startRecording() {

    if (isRecording) {
        return;
    }


    if (!checkMicrophoneSupport()) {

        setStatus(
            "Microphone unavailable",
            "error"
        );

        showMessage(
            "Your browser does not allow microphone access."
        );

        return;
    }


    try {

        // Request notifications during the
        // user's button click.
        //
        // This is much better than waiting
        // until the first "um".
        requestNotificationPermission();


        // Ask for microphone.
        audioStream =
            await navigator.mediaDevices.getUserMedia(
                {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                }
            );


        audioChunks = [];


        const mimeType =
            getRecordingMimeType();


        if (mimeType) {

            mediaRecorder =
                new MediaRecorder(
                    audioStream,
                    {
                        mimeType:
                            mimeType
                    }
                );

        } else {

            mediaRecorder =
                new MediaRecorder(
                    audioStream
                );
        }


        // ----------------------------------------------------
        // AUDIO DATA
        // ----------------------------------------------------

        mediaRecorder.addEventListener(
            "dataavailable",
            event => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    audioChunks.push(
                        event.data
                    );
                }
            }
        );


        // ----------------------------------------------------
        // RECORDING STOPPED
        // ----------------------------------------------------

        mediaRecorder.addEventListener(
            "stop",
            async () => {

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            100
                        )
                );


                await sendRecording();
            },
            {
                once: true
            }
        );


        // Smaller timeslice gives us
        // audio chunks sooner.
        mediaRecorder.start(250);


        isRecording =
            true;


        resetLiveFillerTracking();


        // Start live transcription.
        startLiveRecognition();


        if (listenButton) {

            listenButton.disabled =
                true;

            listenButton.classList.add(
                "recording"
            );
        }


        if (stopButton) {

            stopButton.disabled =
                false;
        }


        setStatus(
            "Recording...",
            "listening"
        );


        showMessage(
            "🎤 Listening... start speaking."
        );


        console.log(
            "================================"
        );

        console.log(
            "RECORDING STARTED"
        );

        console.log(
            "Live recognition:",
            liveRecognitionSupported
        );

        console.log(
            "================================"
        );


    } catch (error) {

        console.error(
            "MICROPHONE ERROR:",
            error
        );


        isRecording =
            false;


        stopLiveRecognition();


        if (audioStream) {

            audioStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            audioStream =
                null;
        }


        setStatus(
            "Microphone error",
            "error"
        );


        showMessage(
            "Microphone error: " +
            error.name +
            " — " +
            error.message
        );
    }
}


// ============================================================
// STOP RECORDING
// ============================================================

function stopRecording() {

    if (
        !mediaRecorder ||
        !isRecording
    ) {

        return;
    }


    console.log(
        "🛑 STOP PRESSED"
    );


    stopLiveRecognition();


    isRecording =
        false;


    try {

        mediaRecorder.stop();

    } catch (error) {

        console.error(
            "Recorder stop error:",
            error
        );
    }


    if (audioStream) {

        audioStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        audioStream =
            null;
    }


    if (listenButton) {

        listenButton.disabled =
            false;

        listenButton.classList.remove(
            "recording"
        );
    }


    if (stopButton) {

        stopButton.disabled =
            true;
    }


    setStatus(
        "Transcribing...",
        "listening"
    );


    const liveText =
        (
            liveFinalText +
            " " +
            liveInterimText
        ).trim();


    if (liveText) {

        displayTranscript(
            liveText
        );
    }


    showMessage(
        "🤖 Finalizing your transcription..."
    );
}


// ============================================================
// BUTTONS
// ============================================================

if (listenButton) {

    listenButton.addEventListener(
        "click",
        startRecording
    );
}


if (stopButton) {

    stopButton.addEventListener(
        "click",
        stopRecording
    );
}


// ============================================================
// SEND AUDIO TO OPENAI
// ============================================================

async function sendRecording() {

    try {

        if (
            audioChunks.length === 0
        ) {

            throw new Error(
                "No audio was recorded."
            );
        }


        const audioBlob =
            new Blob(
                audioChunks,
                {
                    type:
                        mediaRecorder?.mimeType ||
                        "audio/webm"
                }
            );


        const arrayBuffer =
            await audioBlob.arrayBuffer();


        const bytes =
            new Uint8Array(
                arrayBuffer
            );


        let binary =
            "";


        const chunkSize =
            8192;


        for (
            let i = 0;
            i < bytes.length;
            i += chunkSize
        ) {

            const chunk =
                bytes.subarray(
                    i,
                    Math.min(
                        i + chunkSize,
                        bytes.length
                    )
                );


            binary +=
                String.fromCharCode(
                    ...chunk
                );
        }


        const base64Audio =
            btoa(binary);


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
                                base64Audio
                        })
                }
            );


        const responseText =
            await response.text();


        console.log(
            "RAW TRANSCRIPTION RESPONSE:",
            responseText
        );


        let data;


        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (error) {

            throw new Error(
                "Transcription server returned invalid JSON."
            );
        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Transcription failed."
            );
        }


        if (
            !data.transcript ||
            typeof data.transcript !==
            "string"
        ) {

            throw new Error(
                "OpenAI returned an empty transcript."
            );
        }


        console.log(
            "FINAL OPENAI TRANSCRIPT:",
            data.transcript
        );


        // Replace browser transcript
        // with the more accurate OpenAI result.
        displayTranscript(
            data.transcript
        );


        finalTranscript =
            data.transcript;


        setStatus(
            "Finished",
            "ready"
        );


        showMessage(
            "Transcription complete."
        );


    } catch (error) {

        console.error(
            "TRANSCRIPTION ERROR:",
            error
        );


        setStatus(
            "Transcription error",
            "error"
        );


        // Keep live transcript if
        // final API fails.
        if (
            !liveFinalText.trim() &&
            !liveInterimText.trim()
        ) {

            showMessage(
                "Transcription failed: " +
                error.message
            );

        } else {

            showMessage(
                "Final transcription failed. Live transcript is still available."
            );
        }
    }
}


// ============================================================
// AI ANALYSIS
// ============================================================

async function analyzeSpeech() {

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {

        return;
    }


    if (analyzeButton) {

        analyzeButton.disabled =
            true;
    }


    if (analysisLoading) {

        analysisLoading.hidden =
            false;
    }


    if (analysisElement) {

        analysisElement.innerHTML =
            "Analyzing your speech...";
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
                                finalTranscript,

                            trackedWords:
                                trackedWords
                        })
                }
            );


        const responseText =
            await response.text();


        console.log(
            "RAW ANALYSIS RESPONSE:",
            responseText
        );


        let data;


        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (error) {

            throw new Error(
                "Analysis server returned invalid JSON."
            );
        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                data.details ||
                "AI analysis failed."
            );
        }


        if (!data.analysis) {

            throw new Error(
                "The AI returned an empty analysis."
            );
        }


        // The API may return an object
        // or a string depending on your endpoint.

        if (
            typeof data.analysis ===
            "string"
        ) {

            displayAnalysis(
                data.analysis
            );

        } else {

            displayAnalysis(
                formatAnalysisObject(
                    data.analysis
                )
            );
        }


    } catch (error) {

        console.error(
            "ANALYSIS ERROR:",
            error
        );


        if (analysisElement) {

            analysisElement.innerHTML =
                "<strong>Analysis failed.</strong><br><br>" +
                escapeHTML(
                    error.message
                );
        }

    } finally {

        if (analysisLoading) {

            analysisLoading.hidden =
                true;
        }


        if (analyzeButton) {

            analyzeButton.disabled =
                !finalTranscript.trim();
        }
    }
}


// ============================================================
// FORMAT AI ANALYSIS
// ============================================================

function formatAnalysisObject(
    analysis
) {

    if (
        !analysis ||
        typeof analysis !==
        "object"
    ) {

        return String(
            analysis || ""
        );
    }


    const sections = [];


    if (analysis.overall) {

        sections.push(
            "OVERALL\n" +
            analysis.overall
        );
    }


    if (analysis.fillerWords) {

        sections.push(
            "FILLER WORDS\n" +
            analysis.fillerWords
        );
    }


    if (analysis.clarity) {

        sections.push(
            "CLARITY\n" +
            analysis.clarity
        );
    }


    if (analysis.strength) {

        sections.push(
            "STRENGTH\n" +
            analysis.strength
        );
    }


    if (analysis.improvement) {

        sections.push(
            "IMPROVEMENT\n" +
            analysis.improvement
        );
    }


    if (analysis.tip) {

        sections.push(
            "TIP\n" +
            analysis.tip
        );
    }


    return sections.join(
        "\n\n"
    );
}


// ============================================================
// DISPLAY ANALYSIS
// ============================================================

function displayAnalysis(text) {

    if (!analysisElement) {
        return;
    }


    analysisElement.innerHTML =
        escapeHTML(text)
            .replace(
                /\n\n+/g,
                "<br><br>"
            )
            .replace(
                /\n/g,
                "<br>"
            );
}


// ============================================================
// ANALYZE BUTTON
// ============================================================

if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );
}


// ============================================================
// NOTIFICATION BUTTON
// ============================================================

const enableNotificationsButton =
    document.getElementById(
        "enableNotifications"
    ) ||
    document.getElementById(
        "enableNotificationsButton"
    );


async function enableNotifications() {

    if (
        typeof Notification ===
        "undefined"
    ) {

        alert(
            "Notifications are not supported on this browser."
        );

        return;
    }


    const granted =
        await requestNotificationPermission();


    if (granted) {

        if (
            enableNotificationsButton
        ) {

            enableNotificationsButton.textContent =
                "✅ Notifications Enabled";
        }


        // Test notification.
        try {

            new Notification(
                "Speech Tracker",
                {
                    body:
                        "Notifications are working!"
                }
            );

        } catch (error) {

            console.error(
                "Test notification failed:",
                error
            );
        }

    } else {

        if (
            enableNotificationsButton
        ) {

            enableNotificationsButton.textContent =
                "⚠️ Notifications Not Allowed";
        }
    }
}


if (
    enableNotificationsButton
) {

    enableNotificationsButton.addEventListener(
        "click",
        enableNotifications
    );
}


// ============================================================
// INITIALIZE
// ============================================================

initializeTheme();

setupLiveRecognition();

renderWords();

resetLiveFillerTracking();


setStatus(
    "Ready",
    "ready"
);


showMessage(
    "Tap Listen and start speaking."
);


if (analyzeButton) {

    analyzeButton.disabled =
        true;
}


if (stopButton) {

    stopButton.disabled =
        true;
}


// ============================================================
// DEBUG INFORMATION
// ============================================================

console.log(
    "======================================"
);

console.log(
    "🎤 SPEECH TRACKER LOADED"
);

console.log(
    "======================================"
);

console.log(
    "Live recognition supported:",
    liveRecognitionSupported
);

console.log(
    "Microphone:",
    !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
    )
);

console.log(
    "Vibration:",
    typeof navigator.vibrate ===
    "function"
);

console.log(
    "Notifications:",
    typeof Notification !==
    "undefined"
);

if (
    typeof Notification !==
    "undefined"
) {

    console.log(
        "Notification permission:",
        Notification.permission
    );
}

console.log(
    "Tracked words:",
    trackedWords
);

console.log(
    "======================================"
);