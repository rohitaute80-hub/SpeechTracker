// ============================================================
// SPEECH TRACKER
// Complete replacement script.js
//
// Includes:
// - Live browser speech recognition
// - OpenAI final transcription
// - Filler-word detection
// - One notification per newly detected filler
// - Vibration
// - Custom filler words
// - AI speech analysis
// - Light / dark theme toggle
// - Persistent theme preference
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
// DEFAULT TRACKED WORDS
// ============================================================

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
// RECORDING VARIABLES
// ============================================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let isRecording = false;


// ============================================================
// LIVE TRANSCRIPTION VARIABLES
// ============================================================

let recognition = null;
let liveRecognitionSupported = false;

let liveFinalText = "";
let liveInterimText = "";

let recognitionShouldRun = false;


// ============================================================
// IMPORTANT FILLER DETECTION STATE
//
// We keep track of the exact number of fillers that have
// already triggered a notification.
//
// This prevents:
// - duplicate notifications
// - duplicate vibrations
// - the same filler being detected repeatedly
// ============================================================

let notifiedFillerCounts = {};


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
}


// ============================================================
// APPLY THEME
// ============================================================

function applyTheme(theme) {

    const isDark =
        theme === "dark";

    document.documentElement.setAttribute(
        "data-theme",
        isDark ? "dark" : "light"
    );

    document.body.classList.toggle(
        "dark-mode",
        isDark
    );

    document.body.classList.toggle(
        "light-mode",
        !isDark
    );

    localStorage.setItem(
        "speechTrackerTheme",
        isDark ? "dark" : "light"
    );

    updateThemeButton(isDark);
}


// ============================================================
// THEME BUTTON
// ============================================================

function updateThemeButton(isDark) {

    const buttons = [
        document.getElementById("themeToggle"),
        document.getElementById("themeButton"),
        document.getElementById("darkModeToggle"),
        document.getElementById("modeToggle")
    ];

    const button =
        buttons.find(Boolean);

    if (!button) {
        return;
    }

    button.setAttribute(
        "aria-label",
        isDark
            ? "Switch to light mode"
            : "Switch to dark mode"
    );

    button.title =
        isDark
            ? "Switch to light mode"
            : "Switch to dark mode";

    // If the button contains a separate label,
    // update that too.
    const label =
        button.querySelector(
            ".theme-label"
        );

    if (label) {
        label.textContent =
            isDark
                ? "Light Mode"
                : "Dark Mode";
    }

    // Only replace the contents if the button
    // is currently empty or has the expected
    // theme icon structure.
    const icon =
        button.querySelector(
            ".theme-icon"
        );

    if (icon) {
        icon.textContent =
            isDark
                ? "☀️"
                : "🌙";
    }
}


// ============================================================
// TOGGLE THEME
// ============================================================

function toggleTheme() {

    const currentTheme =
        document.documentElement.getAttribute(
            "data-theme"
        );

    const newTheme =
        currentTheme === "dark"
            ? "light"
            : "dark";

    applyTheme(newTheme);
}


// ============================================================
// CONNECT THEME BUTTON
// ============================================================

function setupThemeToggle() {

    const buttons = [
        document.getElementById("themeToggle"),
        document.getElementById("themeButton"),
        document.getElementById("darkModeToggle"),
        document.getElementById("modeToggle")
    ];

    const button =
        buttons.find(Boolean);

    if (!button) {
        console.log(
            "No theme toggle button found."
        );
        return;
    }

    button.addEventListener(
        "click",
        toggleTheme
    );
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

    if (!text) {
        return matches;
    }

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

    if (!text) {
        return 0;
    }

    trackedWords.forEach(
        word => {

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
                count +=
                    matches.length;
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
// STRONG SINGLE VIBRATION
// ============================================================

function vibrate() {

    if (
        typeof navigator.vibrate !==
        "function"
    ) {
        console.log(
            "Vibration not supported."
        );

        return;
    }

    try {

        // ONE strong vibration.
        // No double buzz.
        navigator.vibrate(220);

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
        "FILLER NOTIFICATION:",
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

        if (permission === "default") {

            permission =
                await Notification.requestPermission();
        }

        if (permission !== "granted") {

            console.log(
                "Notification permission:",
                permission
            );

            return;
        }

        // Use the same notification tag for the
        // same current filler event so the browser
        // does not accidentally stack duplicates.

        new Notification(
            "⚠️ Filler Word",
            {
                body:
                    `You said "${word}"`,
                tag:
                    "speech-tracker-filler",
                renotify: true
            }
        );

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );
    }
}


// ============================================================
// HANDLE NEW FILLER
// ============================================================

async function handleNewFiller(word) {

    console.log(
        "NEW FILLER:",
        word
    );

    // Exactly ONE vibration.
    vibrate();

    // Exactly ONE notification.
    await notifyFiller(word);
}


// ============================================================
// COUNT FILLERS BY WORD
// ============================================================

function getFillerCounts(text) {

    const counts = {};

    trackedWords.forEach(
        word => {
            counts[word] = 0;
        }
    );

    if (!text) {
        return counts;
    }

    const matches =
        findTrackedWords(text);

    matches.forEach(
        match => {

            counts[match.word] =
                (counts[match.word] || 0) + 1;
        }
    );

    return counts;
}


// ============================================================
// PROCESS LIVE FILLERS
//
// IMPORTANT:
// This version does NOT compare the entire transcript
// every time a recognition result changes.
//
// Instead, it compares the count of each filler against
// the number that has already triggered a notification.
//
// This prevents repeated buzzing when Chrome/Web Speech
// revises an interim transcript.
//
// It also allows "um", "uh", "umm", and "uhh" to trigger
// individually.
//
// Example:
//
// "I think um..."
//
// interim:
// "I think um"
//
// -> ONE notification
//
// recognition revises it:
//
// "I think umm"
//
// -> does NOT send multiple notifications for the
// same already-processed event unless a genuinely new
// filler occurrence appears.
// ============================================================

async function processLiveFillers(text) {

    if (!text) {
        return;
    }

    const currentCounts =
        getFillerCounts(text);

    for (
        const word of trackedWords
    ) {

        const currentCount =
            currentCounts[word] || 0;

        const alreadyNotified =
            notifiedFillerCounts[word] || 0;

        if (
            currentCount >
            alreadyNotified
        ) {

            const difference =
                currentCount -
                alreadyNotified;

            // Mark them BEFORE sending the notification.
            // This is important because notification
            // permission requests are asynchronous.
            notifiedFillerCounts[word] =
                currentCount;

            // Only send ONE notification per newly
            // appearing filler occurrence.
            for (
                let i = 0;
                i < difference;
                i++
            ) {

                await handleNewFiller(
                    word
                );
            }
        }
    }
}


// ============================================================
// RESET FILLER NOTIFICATION STATE
// ============================================================

function resetFillerNotificationState() {

    notifiedFillerCounts = {};

    trackedWords.forEach(
        word => {
            notifiedFillerCounts[word] = 0;
        }
    );
}


// ============================================================
// LIVE SPEECH RECOGNITION
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
                "LIVE RECOGNITION STARTED"
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

                if (result.isFinal) {

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


            // Replace current interim speech.
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


            // Detect fillers immediately from
            // the live browser transcript.
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
                recognitionShouldRun
            ) {

                if (
                    event.error ===
                    "not-allowed"
                ) {

                    console.log(
                        "Microphone/speech recognition permission denied."
                    );

                } else if (
                    event.error ===
                    "no-speech"
                ) {

                    console.log(
                        "No speech detected."
                    );

                } else {

                    console.log(
                        "Speech recognition error:",
                        event.error
                    );
                }
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

            if (
                recognitionShouldRun &&
                isRecording
            ) {

                setTimeout(
                    () => {

                        if (
                            recognitionShouldRun &&
                            isRecording
                        ) {

                            try {

                                recognition.start();

                            } catch (error) {

                                console.log(
                                    "Recognition restart skipped."
                                );
                            }
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

    resetFillerNotificationState();

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
// AUDIO FORMAT
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

        audioStream =
            await navigator
                .mediaDevices
                .getUserMedia({
                    audio: true
                });

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


        // Small timeslice gives us audio chunks
        // regularly without affecting live recognition.
        mediaRecorder.start(250);

        isRecording =
            true;


        // Start live transcription immediately.
        startLiveRecognition();


        if (listenButton) {
            listenButton.disabled =
                true;
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
        "STOP PRESSED"
    );


    // Stop live recognition first.
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
    }

    if (stopButton) {
        stopButton.disabled =
            true;
    }


    setStatus(
        "Transcribing...",
        "listening"
    );


    // Keep live transcript visible
    // while OpenAI processes final audio.

    if (
        liveFinalText ||
        liveInterimText
    ) {

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
    }


    showMessage(
        "🤖 Finalizing your transcription..."
    );
}


// ============================================================
// LISTEN BUTTON
// ============================================================

if (listenButton) {

    listenButton.addEventListener(
        "click",
        startRecording
    );
}


// ============================================================
// STOP BUTTON
// ============================================================

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


        // Replace live transcript with
        // more accurate final transcript.
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


        if (
            !liveFinalText.trim() &&
            !liveInterimText.trim()
        ) {

            showMessage(
                "Transcription failed: " +
                error.message
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
                "OpenAI returned an empty analysis."
            );
        }


        // The API may return either:
        //
        // analysis: "text"
        //
        // OR
        //
        // analysis: {
        //   overall: "...",
        //   fillerWords: "...",
        //   ...
        // }
        //
        // Handle both.

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
                `<strong>Analysis failed.</strong><br><br>` +
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
// FORMAT AI ANALYSIS OBJECT
// ============================================================

function formatAnalysisObject(analysis) {

    if (
        !analysis ||
        typeof analysis !==
            "object"
    ) {
        return "";
    }


    const sections = [];


    if (analysis.overall) {

        sections.push(
            "Overall\n" +
            analysis.overall
        );
    }


    if (analysis.fillerWords) {

        sections.push(
            "Filler Words\n" +
            analysis.fillerWords
        );
    }


    if (analysis.clarity) {

        sections.push(
            "Clarity\n" +
            analysis.clarity
        );
    }


    if (analysis.strength) {

        sections.push(
            "What You Did Well\n" +
            analysis.strength
        );
    }


    if (analysis.improvement) {

        sections.push(
            "Specific Improvement\n" +
            analysis.improvement
        );
    }


    if (analysis.tip) {

        sections.push(
            "Speaking Tip\n" +
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
// NOTIFICATION PERMISSION
// ============================================================

const enableNotificationsButton =
    document.getElementById(
        "enableNotifications"
    ) ||
    document.getElementById(
        "enableNotificationsButton"
    );


async function requestNotificationPermission() {

    if (
        typeof Notification ===
        "undefined"
    ) {

        alert(
            "Notifications are not supported on this browser."
        );

        return;
    }


    try {

        const permission =
            await Notification.requestPermission();


        console.log(
            "Notification permission:",
            permission
        );


        if (
            permission ===
            "granted"
        ) {

            if (
                enableNotificationsButton
            ) {

                enableNotificationsButton.textContent =
                    "✅ Notifications Enabled";
            }


            new Notification(
                "Speech Tracker",
                {
                    body:
                        "Notifications are working!"
                }
            );


        } else {

            if (
                enableNotificationsButton
            ) {

                enableNotificationsButton.textContent =
                    "⚠️ Notifications Not Allowed";
            }
        }


    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );
    }
}


if (enableNotificationsButton) {

    enableNotificationsButton.addEventListener(
        "click",
        requestNotificationPermission
    );
}


// ============================================================
// INITIALIZE
// ============================================================

initializeTheme();

setupThemeToggle();

setupLiveRecognition();

renderWords();

resetFillerNotificationState();


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


// ============================================================
// DEBUG INFORMATION
// ============================================================

console.log(
    "======================================"
);

console.log(
    "Speech Tracker loaded"
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
    "Theme:",
    document.documentElement.getAttribute(
        "data-theme"
    )
);

console.log(
    "Tracked words:",
    trackedWords
);

console.log(
    "======================================"
);