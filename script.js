// ============================================================
// SPEECH TRACKER
// Complete replacement script.js
//
// Live browser transcription
// OpenAI final transcription
// Live filler detection
// Filler notifications
// Vibration
// AI analysis
// Dark/light theme
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

const enableNotificationsButton =
    document.getElementById("enableNotifications") ||
    document.getElementById("enableNotificationsButton");


// ============================================================
// THEME
// ============================================================

function setupTheme() {
    let themeButton =
        document.getElementById("themeToggle");

    // If the HTML doesn't already contain the button,
    // create it automatically.
    if (!themeButton) {
        themeButton = document.createElement("button");

        themeButton.id = "themeToggle";
        themeButton.type = "button";
        themeButton.className = "theme-toggle";
        themeButton.setAttribute(
            "aria-label",
            "Switch theme"
        );

        document.body.appendChild(themeButton);
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute(
            "data-theme",
            theme
        );

        localStorage.setItem(
            "speechTrackerTheme",
            theme
        );

        if (theme === "dark") {
            themeButton.innerHTML = "☀️";
            themeButton.setAttribute(
                "aria-label",
                "Switch to light mode"
            );
            themeButton.title =
                "Switch to light mode";
        } else {
            themeButton.innerHTML = "🌙";
            themeButton.setAttribute(
                "aria-label",
                "Switch to dark mode"
            );
            themeButton.title =
                "Switch to dark mode";
        }
    }

    const savedTheme =
        localStorage.getItem(
            "speechTrackerTheme"
        );

    const preferredTheme =
        savedTheme ||
        (
            window.matchMedia &&
            window.matchMedia(
                "(prefers-color-scheme: dark)"
            ).matches
                ? "dark"
                : "light"
        );

    applyTheme(preferredTheme);

    themeButton.addEventListener(
        "click",
        () => {
            const current =
                document.documentElement.getAttribute(
                    "data-theme"
                ) || "light";

            applyTheme(
                current === "dark"
                    ? "light"
                    : "dark"
            );
        }
    );
}


// ============================================================
// DEFAULT WORDS
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
// RECORDING
// ============================================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let isRecording = false;


// ============================================================
// LIVE RECOGNITION
// ============================================================

let recognition = null;
let liveRecognitionSupported = false;
let recognitionShouldRun = false;

let liveFinalText = "";
let liveInterimText = "";


// ============================================================
// IMPORTANT LIVE FILLER STATE
//
// We track fillers per SpeechRecognition result.
//
// This prevents:
//
// "umm" -> notification
// "ummm" -> SECOND notification
// final "ummm" -> THIRD notification
//
// Instead it becomes:
//
// "ummm" -> ONE notification
// ============================================================

const resultFillerState = new Map();


// Prevents accidental duplicate notifications
// when the browser fires nearly identical events.
const recentNotificationKeys = new Map();


// ============================================================
// FINAL TRANSCRIPT
// ============================================================

let finalTranscript = "";
let fillerCount = 0;
let totalWords = 0;


// ============================================================
// STATUS
// ============================================================

function setStatus(message, state = "ready") {
    if (statusText) {
        statusText.textContent = message;
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

    // Only use textContent here because this is
    // a status message, not transcript HTML.
    heardText.textContent = message;
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
// NORMALIZE SPEECH
// ============================================================

function normalizeSpeech(text) {
    return (text || "")
        .replace(/\s+/g, " ")
        .trim();
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
                document.createElement("div");

            tag.className =
                "word-tag";

            const text =
                document.createElement("span");

            text.textContent =
                word;

            const remove =
                document.createElement("button");

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
            trackedWords = [
                ...DEFAULT_WORDS
            ];

            saveWords();
            renderWords();
        }
    );
}


// ============================================================
// SPECIAL LIVE "UM / UHH" DETECTOR
//
// Browser speech recognition can produce:
// um
// umm
// ummm
// uh
// uhh
// uhhh
//
// This regex intentionally catches elongated versions.
// ============================================================

function findNaturalFillers(text) {
    const matches = [];

    if (!text) {
        return matches;
    }

    const regex =
        /(^|[\s.,!?;:()[\]{}"'])((?:u+m+|u+h+))(?=$|[\s.,!?;:()[\]{}"'])/gi;

    let match;

    while (
        (match = regex.exec(text)) !== null
    ) {
        matches.push({
            word: match[2].toLowerCase(),
            index: match.index +
                match[1].length
        });
    }

    return matches;
}


// ============================================================
// FIND CUSTOM/TRACKED WORDS
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

            // Special handling for the spoken
            // "um"/"uh" family.
            if (
                /^(u+m+|u+h+)$/i.test(word)
            ) {
                const naturalMatches =
                    findNaturalFillers(text);

                naturalMatches.forEach(
                    match => {
                        matches.push({
                            word: word,
                            detectedWord:
                                match.word,
                            index:
                                match.index
                        });
                    }
                );

                return;
            }

            const regex =
                new RegExp(
                    "(^|\\s)" +
                    escapeRegex(word) +
                    "(?=\\s|[.,!?;:]|$)",
                    "gi"
                );

            let match;

            while (
                (match = regex.exec(text)) !== null
            ) {
                matches.push({
                    word: word,
                    detectedWord:
                        match[0].trim(),
                    index:
                        match.index
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
    if (!text) {
        return 0;
    }

    let count = 0;

    // Natural fillers are counted once based
    // on what was actually spoken.
    const naturalMatches =
        findNaturalFillers(text);

    count += naturalMatches.length;

    trackedWords.forEach(
        word => {
            if (!word.trim()) {
                return;
            }

            // Skip natural filler words here
            // because we already counted them.
            if (
                /^(u+m+|u+h+)$/i.test(word)
            ) {
                return;
            }

            const regex =
                new RegExp(
                    "(^|\\s)" +
                    escapeRegex(word) +
                    "(?=\\s|[.,!?;:]|$)",
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
// HIGHLIGHT
// ============================================================

function highlightTrackedWords(text) {
    let result =
        escapeHTML(text);

    // First highlight natural fillers.
    result =
        result.replace(
            /(^|[\s.,!?;:()[\]{}"'])((?:u+m+|u+h+))(?=$|[\s.,!?;:()[\]{}"'])/gi,
            '$1<span class="highlight">$2</span>'
        );

    const sortedWords =
        [...trackedWords]
            .filter(
                word =>
                    !/^(u+m+|u+h+)$/i.test(word)
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
        normalizeSpeech(
            complete +
            " " +
            interim
        );

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
// VIBRATION
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
        // One strong vibration.
        // It is intentionally NOT multiple buzzes.
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

        const notification =
            new Notification(
                "Speech Tracker",
                {
                    body:
                        `You said "${word}"`,
                    tag:
                        "speech-tracker-filler",
                    renotify: true,
                    silent: false
                }
            );

        notification.onclick =
            () => {
                window.focus();
                notification.close();
            };

    } catch (error) {
        console.error(
            "Notification error:",
            error
        );
    }
}


// ============================================================
// HANDLE FILLER
// ============================================================

async function handleNewFiller(word) {
    console.log(
        "NEW LIVE FILLER:",
        word
    );

    // Vibration happens immediately.
    vibrate();

    // Notification happens immediately after.
    await notifyFiller(word);
}


// ============================================================
// DUPLICATE PROTECTION
// ============================================================

function notificationWasRecentlySent(
    key
) {
    const now =
        Date.now();

    // Remove old entries.
    for (
        const [
            oldKey,
            timestamp
        ] of recentNotificationKeys
    ) {
        if (
            now - timestamp >
            1200
        ) {
            recentNotificationKeys.delete(
                oldKey
            );
        }
    }

    if (
        recentNotificationKeys.has(key)
    ) {
        return true;
    }

    recentNotificationKeys.set(
        key,
        now
    );

    return false;
}


// ============================================================
// PROCESS ONE SPEECH RECOGNITION RESULT
//
// THIS IS THE IMPORTANT FIX.
//
// Instead of repeatedly comparing the entire transcript,
// we inspect the individual SpeechRecognition result.
//
// That means a filler can trigger while it is still interim.
// ============================================================

function processRecognitionResult(
    result,
    resultIndex,
    isFinal
) {
    if (!result || !result[0]) {
        return;
    }

    const text =
        normalizeSpeech(
            result[0].transcript
        );

    if (!text) {
        return;
    }

    const fillers =
        findNaturalFillers(
            text
        );

    // Also check custom tracked words.
    const trackedMatches =
        findTrackedWords(
            text
        );

    const allMatches = [];

    fillers.forEach(
        match => {
            allMatches.push({
                detectedWord:
                    match.word,
                index:
                    match.index
            });
        }
    );

    trackedMatches.forEach(
        match => {
            // Avoid adding natural fillers twice.
            if (
                /^(u+m+|u+h+)$/i.test(
                    match.word
                )
            ) {
                return;
            }

            allMatches.push({
                detectedWord:
                    match.detectedWord ||
                    match.word,
                index:
                    match.index
            });
        }
    );

    if (allMatches.length === 0) {
        return;
    }

    if (
        !resultFillerState.has(
            resultIndex
        )
    ) {
        resultFillerState.set(
            resultIndex,
            new Set()
        );
    }

    const alreadyDetected =
        resultFillerState.get(
            resultIndex
        );

    allMatches.forEach(
        match => {
            let normalized =
                String(
                    match.detectedWord ||
                    ""
                )
                    .toLowerCase()
                    .trim();

            if (!normalized) {
                return;
            }

            // Treat um/umm/ummm as the same
            // filler occurrence.
            let fillerFamily =
                normalized;

            if (
                /^u+m+$/.test(normalized)
            ) {
                fillerFamily =
                    "um-family";
            } else if (
                /^u+h+$/.test(normalized)
            ) {
                fillerFamily =
                    "uh-family";
            }

            // We need the surrounding text so two
            // different "um"s later in speech aren't
            // treated as the same occurrence.
            const start =
                Math.max(
                    0,
                    match.index - 20
                );

            const context =
                text
                    .slice(
                        start,
                        match.index
                    )
                    .toLowerCase()
                    .trim();

            const occurrenceKey =
                fillerFamily +
                "|" +
                context;

            // Already detected in this exact
            // SpeechRecognition result.
            if (
                alreadyDetected.has(
                    occurrenceKey
                )
            ) {
                return;
            }

            alreadyDetected.add(
                occurrenceKey
            );

            // Extra global duplicate protection.
            const globalKey =
                resultIndex +
                "|" +
                occurrenceKey;

            if (
                notificationWasRecentlySent(
                    globalKey
                )
            ) {
                return;
            }

            // Trigger immediately.
            handleNewFiller(
                normalized
            );
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
                "LIVE RECOGNITION STARTED"
            );

            setStatus(
                "Listening...",
                "listening"
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

            // Process ONLY the newly delivered
            // results immediately.
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

                // IMPORTANT:
                // Detect fillers BEFORE waiting
                // for the result to become final.
                processRecognitionResult(
                    result,
                    i,
                    result.isFinal
                );

                if (result.isFinal) {
                    newFinalText +=
                        text + " ";

                    // Once final, don't throw away
                    // its detection state.
                    // This prevents the final result
                    // from buzzing again.
                } else {
                    newInterimText +=
                        text;
                }
            }

            if (newFinalText) {
                liveFinalText +=
                    newFinalText;
            }

            liveInterimText =
                newInterimText;

            displayLiveTranscript();
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

            if (!recognitionShouldRun) {
                return;
            }

            if (
                event.error ===
                "not-allowed"
            ) {
                console.log(
                    "Speech recognition permission denied."
                );

                setStatus(
                    "Microphone permission needed",
                    "error"
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
                // Restart quickly.
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

                            console.log(
                                "LIVE RECOGNITION RESTARTED"
                            );
                        } catch (error) {
                            console.log(
                                "Recognition restart skipped:",
                                error.message
                            );
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

    resultFillerState.clear();
    recentNotificationKeys.clear();

    recognitionShouldRun =
        true;

    try {
        recognition.start();
    } catch (error) {
        console.log(
            "Recognition start skipped:",
            error.message
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
// RECORDING MIME TYPE
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
        } catch (error) {
            // Continue checking formats.
        }
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
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
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


        // ----------------------------------------------------
        // AUDIO CHUNKS
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
        // RECORDER STOP
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


        // ----------------------------------------------------
        // START RECORDER
        // ----------------------------------------------------

        mediaRecorder.start(250);

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

    const liveText =
        normalizeSpeech(
            liveFinalText +
            " " +
            liveInterimText
        );

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

        const liveText =
            normalizeSpeech(
                liveFinalText +
                " " +
                liveInterimText
            );

        if (!liveText) {
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


        if (
            !data.analysis
        ) {
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
        // analysis: { overall, fillerWords, ... }
        //
        // Support both.

        if (
            typeof data.analysis ===
            "string"
        ) {
            displayAnalysis(
                data.analysis
            );
        } else {
            displayAnalysis(
                JSON.stringify(
                    data.analysis,
                    null,
                    2
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

                enableNotificationsButton.classList.add(
                    "enabled"
                );
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

setupTheme();
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


// ============================================================
// DEBUG
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
    "======================================"
);