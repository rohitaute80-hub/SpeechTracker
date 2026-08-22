// ============================================================
// SPEECH TRACKER
//
// Live Browser Transcription
// + OpenAI Final Transcription
// + Filler Detection
// + Highlighting
// + Vibration
// + Notifications
// + AI Analysis
// + Dark / Light Mode
// ============================================================


// ============================================================
// ELEMENTS
// ============================================================

const statusText =
    document.getElementById("status");

const statusDot =
    document.getElementById("statusDot");

const heardText =
    document.getElementById("heard");

const listenButton =
    document.getElementById("listenButton");

const stopButton =
    document.getElementById("stopButton");

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
// THEME BUTTON
// ============================================================

const themeToggle =
    document.getElementById("themeToggle") ||
    document.getElementById("themeButton") ||
    document.querySelector(".theme-toggle");


// ============================================================
// NOTIFICATION BUTTON
// ============================================================

const enableNotificationsButton =
    document.getElementById("enableNotifications") ||
    document.getElementById("enableNotificationsButton");


// ============================================================
// DEFAULT FILLER WORDS
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
        localStorage.getItem(
            "speechTrackerWords"
        );

    if (saved) {
        const parsed =
            JSON.parse(saved);

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
    trackedWords = [
        ...DEFAULT_WORDS
    ];
}


// ============================================================
// RECORDING VARIABLES
// ============================================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let isRecording = false;


// ============================================================
// LIVE RECOGNITION VARIABLES
// ============================================================

let recognition = null;

let liveRecognitionSupported = false;

let liveFinalText = "";

let liveInterimText = "";

let recognitionShouldRun = false;

let recognitionRestartTimer = null;


// ============================================================
// FILLER DETECTION STATE
//
// IMPORTANT:
//
// We do NOT simply compare the entire transcript every time.
//
// Browser speech recognition constantly rewrites interim text.
// Comparing the entire transcript can cause:
//
// "um"
// "um um"
// "um um um"
//
// to look like multiple new fillers.
//
// Instead we maintain a committed count of fillers.
// ============================================================

let notifiedFillerCounts = {};

let liveDetectionText = "";


// ============================================================
// FINAL TRANSCRIPT
// ============================================================

let finalTranscript = "";

let fillerCount = 0;

let totalWords = 0;


// ============================================================
// THEME
// ============================================================

function applyTheme(theme) {

    document.documentElement.setAttribute(
        "data-theme",
        theme
    );

    if (themeToggle) {

        if (theme === "dark") {

            themeToggle.textContent = "☀";

            themeToggle.setAttribute(
                "aria-label",
                "Switch to light mode"
            );

            themeToggle.setAttribute(
                "title",
                "Switch to light mode"
            );

        } else {

            themeToggle.textContent = "☾";

            themeToggle.setAttribute(
                "aria-label",
                "Switch to dark mode"
            );

            themeToggle.setAttribute(
                "title",
                "Switch to dark mode"
            );
        }
    }

    try {
        localStorage.setItem(
            "speechTrackerTheme",
            theme
        );
    } catch (error) {
        console.error(
            "Could not save theme:",
            error
        );
    }
}


function initializeTheme() {

    let savedTheme = null;

    try {
        savedTheme =
            localStorage.getItem(
                "speechTrackerTheme"
            );
    } catch (error) {
        console.error(
            "Could not load theme:",
            error
        );
    }

    if (
        savedTheme === "dark" ||
        savedTheme === "light"
    ) {
        applyTheme(savedTheme);
        return;
    }

    const prefersDark =
        window.matchMedia &&
        window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches;

    applyTheme(
        prefersDark
            ? "dark"
            : "light"
    );
}


if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        () => {

            const currentTheme =
                document.documentElement.getAttribute(
                    "data-theme"
                );

            applyTheme(
                currentTheme === "dark"
                    ? "light"
                    : "dark"
            );
        }
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
// NORMALIZE FILLER WORDS
//
// This is especially important for:
//
// um
// umm
// ummm
// ummmm
//
// uh
// uhh
// uhhh
// uhhhh
//
// The browser may transcribe stretched fillers differently.
// ============================================================

function normalizeFillerWord(word) {

    const cleaned =
        word
            .toLowerCase()
            .trim();

    if (/^u+m+$/.test(cleaned)) {
        return "um";
    }

    if (/^u+h+$/.test(cleaned)) {
        return "uh";
    }

    return cleaned;
}


// ============================================================
// IS FILLER WORD
// ============================================================

function isFillerWord(word) {

    const normalized =
        normalizeFillerWord(word);

    return (
        trackedWords.some(
            tracked =>
                normalizeFillerWord(
                    tracked
                ) === normalized
        )
    );
}


// ============================================================
// GET CANONICAL FILLER NAME
// ============================================================

function getCanonicalFiller(word) {

    const normalized =
        normalizeFillerWord(word);

    const match =
        trackedWords.find(
            tracked =>
                normalizeFillerWord(
                    tracked
                ) === normalized
        );

    return match || word;
}


// ============================================================
// RENDER TRACKED WORDS
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

            trackedWords = [
                ...DEFAULT_WORDS
            ];

            saveWords();

            renderWords();
        }
    );
}


// ============================================================
// TOKENIZE SPEECH
//
// This is more reliable for live filler detection than
// searching the entire string repeatedly.
// ============================================================

function tokenize(text) {

    if (!text) {
        return [];
    }

    return text
        .toLowerCase()
        .replace(/[.,!?;:()[\]{}"']/g, " ")
        .split(/\s+/)
        .filter(Boolean);
}


// ============================================================
// FIND TRACKED WORDS
// ============================================================

function findTrackedWords(text) {

    const matches = [];

    if (!text) {
        return matches;
    }

    const tokens =
        tokenize(text);

    tokens.forEach(
        (token, index) => {

            if (isFillerWord(token)) {

                matches.push({
                    word:
                        getCanonicalFiller(
                            token
                        ),

                    tokenIndex:
                        index
                });
            }
        }
    );

    return matches;
}


// ============================================================
// COUNT TRACKED WORDS
// ============================================================

function countTrackedWords(text) {

    return findTrackedWords(text).length;
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
// HIGHLIGHT FILLERS
//
// Handles stretched forms such as:
//
// um
// umm
// ummm
// uh
// uhh
// uhhh
// ============================================================

function highlightTrackedWords(text) {

    let result =
        escapeHTML(text);

    // First handle the special spoken fillers.
    result =
        result.replace(
            /(^|[\s.,!?;:])((?:u+m+|u+h+))(?=$|[\s.,!?;:])/gi,
            '$1<span class="highlight">$2</span>'
        );

    // Then handle custom tracked words.
    const sortedWords =
        [...trackedWords]
            .filter(
                word =>
                    !/^[u]+[mh]+$/i.test(
                        word
                    )
            )
            .sort(
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
// STRONG VIBRATION
//
// One vibration event per filler.
//
// We deliberately do NOT call navigator.vibrate multiple
// times for the same filler.
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

        navigator.vibrate(
            250
        );

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

        if (
            permission ===
            "default"
        ) {

            permission =
                await Notification.requestPermission();
        }

        if (
            permission !==
            "granted"
        ) {

            console.log(
                "Notification permission:",
                permission
            );

            return;
        }

        const notification =
            new Notification(
                "Filler Word Detected",
                {
                    body:
                        `You said "${word}"`,
                    tag:
                        "speech-tracker-filler",
                    renotify:
                        true
                }
            );

        setTimeout(
            () => {
                try {
                    notification.close();
                } catch (error) {}
            },
            1800
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

async function handleNewFiller(word) {

    console.log(
        "NEW FILLER DETECTED:",
        word
    );

    // ONE vibration.
    vibrate();

    // ONE notification.
    await notifyFiller(word);
}


// ============================================================
// COUNT FILLERS BY TYPE
// ============================================================

function getFillerCounts(text) {

    const counts = {};

    const matches =
        findTrackedWords(text);

    matches.forEach(
        match => {

            const word =
                match.word;

            counts[word] =
                (counts[word] || 0) + 1;
        }
    );

    return counts;
}


// ============================================================
// PROCESS LIVE FILLERS
//
// This fixes the duplicate-notification problem.
//
// Browser interim recognition constantly changes.
//
// Example:
//
// First:
// "I um"
//
// Then:
// "I umm"
//
// Then:
// "I umm I"
//
// We don't treat those as 3 fillers.
//
// We only notify when the number of committed fillers
// increases.
// ============================================================

async function processLiveFillers(text) {

    if (!text) {
        return;
    }

    const currentCounts =
        getFillerCounts(text);

    const wordsToNotify = [];

    Object.keys(currentCounts).forEach(
        word => {

            const current =
                currentCounts[word] || 0;

            const previous =
                notifiedFillerCounts[word] || 0;

            if (current > previous) {

                const difference =
                    current - previous;

                // Queue exactly one notification
                // for each genuinely new occurrence.
                for (
                    let i = 0;
                    i < difference;
                    i++
                ) {

                    wordsToNotify.push(
                        word
                    );
                }
            }
        }
    );

    // Update state BEFORE notifications.
    //
    // This is important because the browser can fire
    // another recognition event while the notification
    // is being processed.
    notifiedFillerCounts =
        {
            ...currentCounts
        };

    for (
        const word of wordsToNotify
    ) {

        await handleNewFiller(
            word
        );
    }

    liveDetectionText =
        text;
}


// ============================================================
// RESET FILLER DETECTION
// ============================================================

function resetFillerDetection() {

    notifiedFillerCounts = {};

    liveDetectionText = "";
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


    // ========================================================
    // ON START
    // ========================================================

    recognition.onstart =
        () => {

            console.log(
                "LIVE RECOGNITION STARTED"
            );

            if (isRecording) {

                setStatus(
                    "Listening...",
                    "listening"
                );
            }
        };


    // ========================================================
    // ON RESULT
    // ========================================================

    recognition.onresult =
        event => {

            let newFinalText =
                "";

            let newInterimText =
                "";


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


            // Add only newly finalized speech.
            if (newFinalText) {

                liveFinalText +=
                    newFinalText;
            }


            liveInterimText =
                newInterimText;


            const combined =
                (
                    liveFinalText +
                    " " +
                    liveInterimText
                ).trim();


            // Immediately update UI.
            displayLiveTranscript();


            // Immediately check fillers.
            //
            // This happens BEFORE waiting for
            // the final OpenAI transcription.
            processLiveFillers(
                combined
            );
        };


    // ========================================================
    // ON ERROR
    // ========================================================

    recognition.onerror =
        event => {

            console.error(
                "LIVE RECOGNITION ERROR:",
                event.error
            );

            if (!recognitionShouldRun) {
                return;
            }

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

            } else if (
                event.error ===
                "aborted"
            ) {

                console.log(
                    "Speech recognition aborted."
                );

            } else {

                console.log(
                    "Speech recognition error:",
                    event.error
                );
            }
        };


    // ========================================================
    // ON END
    // ========================================================

    recognition.onend =
        () => {

            console.log(
                "LIVE RECOGNITION ENDED"
            );

            if (
                recognitionShouldRun &&
                isRecording
            ) {

                clearTimeout(
                    recognitionRestartTimer
                );

                recognitionRestartTimer =
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
                                        "Recognition restart skipped:",
                                        error
                                    );
                                }
                            }

                        },
                        50
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

    resetFillerDetection();

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

    clearTimeout(
        recognitionRestartTimer
    );

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


        // ====================================================
        // AUDIO DATA
        // ====================================================

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


        // ====================================================
        // RECORDING STOPPED
        // ====================================================

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


        // Small chunks.
        mediaRecorder.start(
            250
        );


        isRecording =
            true;


        // Start live recognition immediately.
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
            "Listening...",
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
        "STOP PRESSED"
    );


    // Stop recognition first.
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


    // Keep the live transcript visible
    // while OpenAI processes it.

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
            audioChunks.length ===
            0
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


        // Replace the less accurate live
        // transcript with OpenAI's final one.
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


        // Keep live transcript if API fails.
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


        // Your API may return either:
        //
        // analysis: "text"
        //
        // OR
        //
        // analysis: {
        //    overall: "...",
        //    fillerWords: "...",
        //    ...
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
// FORMAT AI ANALYSIS OBJECT
// ============================================================

function formatAnalysisObject(
    analysis
) {

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
            "Strength\n" +
            analysis.strength
        );
    }


    if (analysis.improvement) {

        sections.push(
            "Improvement\n" +
            analysis.improvement
        );
    }


    if (analysis.tip) {

        sections.push(
            "Practical Tip\n" +
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
        escapeHTML(
            text
        )
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
// REQUEST NOTIFICATION PERMISSION
// ============================================================

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


            const notification =
                new Notification(
                    "Speech Tracker",
                    {
                        body:
                            "Notifications are working!"
                    }
                );


            setTimeout(
                () => {
                    try {
                        notification.close();
                    } catch (error) {}
                },
                1500
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

setupLiveRecognition();

renderWords();

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
    "Tracked words:",
    trackedWords
);

console.log(
    "======================================"
);