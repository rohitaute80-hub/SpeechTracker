/* =========================================================
   SPEECH TRACKER
   Complete replacement script.js
   Fast live filler detection + transcription + AI analysis
   ========================================================= */


/* =========================================================
   ELEMENTS
   ========================================================= */

const $ = (id) => document.getElementById(id);

const listenButton = $("listenButton");
const stopButton = $("stopButton");

const statusDot = $("statusDot");
const statusText = $("status");

const heard = $("heard");
const finalTranscriptElement = $("finalTranscript");

const fillerCountElement = $("fillerCount");
const wordCountElement = $("wordCount");

const recordingTimer = $("recordingTimer");

const customWordInput = $("customWordInput");
const addWordButton = $("addWordButton");
const resetWordsButton = $("resetWordsButton");
const wordList = $("wordList");

const enableNotificationsButton =
    $("enableNotifications");

const notificationStatus =
    $("notificationStatus");

const analyzeButton =
    $("analyzeButton");

const analysisLoading =
    $("analysisLoading");

const analysisElement =
    $("analysis");

const savedSpeechesElement =
    $("savedSpeeches");

const savedSpeechCount =
    $("savedSpeechCount");

const savePrompt =
    $("savePrompt");

const saveSpeechButton =
    $("saveSpeechButton");

const discardSpeechButton =
    $("discardSpeechButton");

const saveModal =
    $("saveModal");

const speechNameInput =
    $("speechNameInput");

const cancelSaveButton =
    $("cancelSaveButton");

const confirmSaveButton =
    $("confirmSaveButton");

const themeToggle =
    $("themeToggle");

const themeColor =
    $("themeColor");

const scrollIndicator =
    $("scrollIndicator");


/* =========================================================
   DEFAULT TRACKED WORDS
   ========================================================= */

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


/* =========================================================
   STORAGE KEYS
   ========================================================= */

const WORD_STORAGE_KEY =
    "speechTrackerWords";

const SPEECH_STORAGE_KEY =
    "speechTrackerSavedSpeeches";

const THEME_STORAGE_KEY =
    "speechTrackerTheme";


/* =========================================================
   STATE
   ========================================================= */

let trackedWords = [];

let mediaRecorder = null;
let activeStream = null;
let audioChunks = [];

let recognition = null;
let recognitionSupported = false;
let recognitionShouldRun = false;
let recognitionStarting = false;

let isRecording = false;
let isStopping = false;

let recordingStartTime = null;
let timerInterval = null;

let liveTranscript = "";
let finalTranscript = "";

let currentAnalysis = null;
let currentSpeechId = null;

let lastRecognitionText = "";
let lastDetectedTranscript = "";

let currentSessionFillerCount = 0;
let currentSessionWordCount = 0;


/*
    Each detected filler occurrence gets a fingerprint.

    We do NOT simply use the word itself because:

        "um ... um"

    must trigger twice.

    But we also don't want:

        "um"
        "umm"
        "ummm"

    during interim updates to trigger three times.
*/

const firedOccurrences =
    new Set();


/*
    Prevents accidental duplicate browser
    notifications from extremely fast
    SpeechRecognition events.
*/

const recentNotificationTimes =
    new Map();


/*
    Used when the browser repeatedly changes
    an interim transcript.
*/

const processedTextVersions =
    new Set();


/* =========================================================
   SAFE ELEMENT HELPERS
   ========================================================= */

function setText(element, value) {

    if (element) {
        element.textContent = value;
    }

}


function setHidden(element, hidden) {

    if (element) {
        element.hidden = hidden;
    }

}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   WORD NORMALIZATION
   ========================================================= */

function normalizeWord(word) {

    return String(word || "")
        .trim()
        .toLowerCase()
        .replace(/[^\w\s']/g, "")
        .replace(/\s+/g, " ");

}


/* =========================================================
   FILLER FAMILY
   ========================================================= */

function fillerFamily(word) {

    const normalized =
        normalizeWord(word);

    if (/^um+$/.test(normalized)) {
        return "UM";
    }

    if (/^uh+$/.test(normalized)) {
        return "UH";
    }

    return normalized;

}


/* =========================================================
   REGEX ESCAPE
   ========================================================= */

function escapeRegex(text) {

    return String(text)
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

}


/* =========================================================
   GET FILLER REGEX
   ========================================================= */

function getFillerRegex() {

    const words = trackedWords
        .map(normalizeWord)
        .filter(Boolean)
        .sort(
            (a, b) =>
                b.length - a.length
        );

    /*
        The generic variants are intentionally
        included for fast detection.

        This catches:

        um
        umm
        ummm
        ummmm
        uh
        uhh
        uhhh
        uhhhh
    */

    words.push("um+");
    words.push("uh+");

    const unique =
        [...new Set(words)];

    if (!unique.length) {
        return /$a/;
    }

    return new RegExp(
        `\\b(${unique
            .map(escapeRegex)
            .join("|")})\\b`,
        "gi"
    );

}


/* =========================================================
   HIGHLIGHT TRANSCRIPT
   ========================================================= */

function highlightTranscript(text) {

    if (!text) {

        return `
            <span class="empty-state">
                Start speaking and your live transcript
                will appear here.
            </span>
        `;

    }

    const regex =
        getFillerRegex();

    let result = "";
    let lastIndex = 0;
    let match;

    while (
        (match = regex.exec(text)) !== null
    ) {

        result +=
            escapeHTML(
                text.slice(
                    lastIndex,
                    match.index
                )
            );

        result +=
            `<span class="filler-highlight">` +
            escapeHTML(match[0]) +
            `</span>`;

        lastIndex =
            regex.lastIndex;

    }

    result +=
        escapeHTML(
            text.slice(lastIndex)
        );

    return result;

}


/* =========================================================
   COUNT WORDS
   ========================================================= */

function countWords(text) {

    const cleaned =
        String(text || "").trim();

    if (!cleaned) {
        return 0;
    }

    return cleaned
        .split(/\s+/)
        .filter(Boolean)
        .length;

}


/* =========================================================
   COUNT FILLERS
   ========================================================= */

function countFillers(text) {

    if (!text) {
        return 0;
    }

    const regex =
        getFillerRegex();

    return (
        text.match(regex) || []
    ).length;

}


/* =========================================================
   UPDATE STATS
   ========================================================= */

function updateStats(text) {

    currentSessionWordCount =
        countWords(text);

    currentSessionFillerCount =
        countFillers(text);

    setText(
        wordCountElement,
        currentSessionWordCount
    );

    setText(
        fillerCountElement,
        currentSessionFillerCount
    );

}


/* =========================================================
   RENDER LIVE TRANSCRIPT
   ========================================================= */

function renderLiveTranscript() {

    if (!heard) {
        return;
    }

    heard.innerHTML =
        highlightTranscript(
            liveTranscript
        );

    /*
        Stats are calculated from the transcript.

        Detection itself never increments the count,
        which prevents double counting.
    */

    updateStats(
        liveTranscript
    );

}


/* =========================================================
   RENDER FINAL TRANSCRIPT
   ========================================================= */

function renderFinalTranscript() {

    if (!finalTranscript) {

        if (finalTranscriptElement) {

            finalTranscriptElement.innerHTML = `
                <span class="empty-state">
                    Your completed speech will appear here.
                </span>
            `;

        }

        return;

    }

    finalTranscriptElement.innerHTML =
        highlightTranscript(
            finalTranscript
        );

}


/* =========================================================
   LOAD TRACKED WORDS
   ========================================================= */

function loadTrackedWords() {

    try {

        const saved =
            localStorage.getItem(
                WORD_STORAGE_KEY
            );

        if (saved) {

            const parsed =
                JSON.parse(saved);

            if (
                Array.isArray(parsed) &&
                parsed.length > 0
            ) {

                trackedWords =
                    parsed
                        .map(normalizeWord)
                        .filter(Boolean);

                return;

            }

        }

    } catch (error) {

        console.error(
            "Could not load tracked words:",
            error
        );

    }

    trackedWords =
        [...DEFAULT_WORDS];

}


/* =========================================================
   SAVE TRACKED WORDS
   ========================================================= */

function saveTrackedWords() {

    try {

        localStorage.setItem(
            WORD_STORAGE_KEY,
            JSON.stringify(
                trackedWords
            )
        );

    } catch (error) {

        console.error(
            "Could not save tracked words:",
            error
        );

    }

}


/* =========================================================
   RENDER WORD LIST
   ========================================================= */

function renderWordList() {

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

            tag.innerHTML = `
                <span>
                    ${escapeHTML(word)}
                </span>

                <button
                    type="button"
                    aria-label="Remove ${escapeHTML(word)}"
                    data-index="${index}"
                >
                    ×
                </button>
            `;

            wordList.appendChild(tag);

        }
    );

}


/* =========================================================
   ADD TRACKED WORD
   ========================================================= */

function addTrackedWord() {

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

    const exists =
        trackedWords.some(
            existing =>
                normalizeWord(existing) === word
        );

    if (exists) {

        customWordInput.value = "";

        return;

    }

    trackedWords.push(word);

    saveTrackedWords();

    renderWordList();

    customWordInput.value = "";

}


/* =========================================================
   REMOVE WORD
   ========================================================= */

if (wordList) {

    wordList.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "button[data-index]"
                );

            if (!button) {
                return;
            }

            const index =
                Number(
                    button.dataset.index
                );

            if (
                Number.isNaN(index)
            ) {
                return;
            }

            trackedWords.splice(
                index,
                1
            );

            saveTrackedWords();

            renderWordList();

        }
    );

}


/* =========================================================
   RESET WORDS
   ========================================================= */

if (resetWordsButton) {

    resetWordsButton.addEventListener(
        "click",
        () => {

            trackedWords =
                [...DEFAULT_WORDS];

            saveTrackedWords();

            renderWordList();

        }
    );

}


/* =========================================================
   WORD INPUT
   ========================================================= */

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


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

async function enableNotifications() {

    if (
        !("Notification" in window)
    ) {

        setText(
            notificationStatus,
            "Notifications are not supported in this browser."
        );

        return;

    }

    try {

        const permission =
            await Notification.requestPermission();

        if (
            permission === "granted"
        ) {

            setText(
                notificationStatus,
                "Notifications are enabled."
            );

            notificationStatus?.classList.add(
                "enabled"
            );

            if (enableNotificationsButton) {

                enableNotificationsButton.textContent =
                    "Notifications Enabled";

                enableNotificationsButton.disabled =
                    true;

            }

        } else {

            setText(
                notificationStatus,
                "Notification permission was not granted."
            );

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
        enableNotifications
    );

}


/* =========================================================
   SEND FAST NOTIFICATION
   ========================================================= */

function sendFillerNotification(word) {

    if (
        !("Notification" in window)
    ) {
        return;
    }

    if (
        Notification.permission !== "granted"
    ) {
        return;
    }

    const family =
        fillerFamily(word);

    const now =
        performance.now();

    const previous =
        recentNotificationTimes.get(
            family
        );

    /*
        Extremely small debounce.

        This is intentionally much shorter than
        the previous 500ms delay.

        It only protects against duplicate browser
        events.
    */

    if (
        previous !== undefined &&
        now - previous < 180
    ) {

        return;

    }

    recentNotificationTimes.set(
        family,
        now
    );

    try {

        const notification =
            new Notification(
                "Speech Tracker",
                {
                    body:
                        `You said "${word}"`,
                    icon:
                        "/icon.svg",
                    badge:
                        "/icon.svg",
                    tag:
                        `speech-tracker-${Date.now()}`,
                    renotify:
                        true,
                    silent:
                        false
                }
            );

        /*
            Close quickly so the browser doesn't
            accumulate old notifications.
        */

        setTimeout(
            () => {

                try {
                    notification.close();
                } catch (_) {}

            },
            1200
        );

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );

    }

}


/* =========================================================
   FAST VIBRATION
   ========================================================= */

function vibrateForFiller() {

    try {

        if (
            typeof navigator.vibrate ===
            "function"
        ) {

            /*
                Shorter pattern = immediate feedback.
            */

            navigator.vibrate(
                [45, 25, 45]
            );

        }

    } catch (_) {}

}


/* =========================================================
   CREATE DETECTION FINGERPRINT
   ========================================================= */

function createOccurrenceKey(
    text,
    matchIndex,
    word
) {

    const before =
        text
            .slice(
                0,
                matchIndex
            )
            .trim();

    const wordIndex =
        before
            ? before.split(/\s+/).length
            : 0;

    const family =
        fillerFamily(word);

    /*
        Include approximate location.

        This allows:

        "um ... um"

        to trigger twice, while an interim revision
        from "um" to "umm" remains the same event.
    */

    return (
        `${wordIndex}:${family}`
    );

}


/* =========================================================
   DETECT NEW FILLERS
   ========================================================= */

function detectLiveFillers(text) {

    if (
        !text ||
        !isRecording
    ) {
        return;
    }

    const regex =
        getFillerRegex();

    let match;

    while (
        (match = regex.exec(text)) !== null
    ) {

        const word =
            match[0];

        const occurrenceKey =
            createOccurrenceKey(
                text,
                match.index,
                word
            );

        if (
            firedOccurrences.has(
                occurrenceKey
            )
        ) {

            continue;

        }

        firedOccurrences.add(
            occurrenceKey
        );

        /*
            THIS IS THE IMPORTANT PART:

            Trigger feedback immediately.

            Do not wait for final transcription.
        */

        vibrateForFiller();

        sendFillerNotification(
            word
        );

    }

}


/* =========================================================
   SPEECH RECOGNITION SETUP
   ========================================================= */

function setupSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        recognitionSupported =
            false;

        return;

    }

    recognitionSupported =
        true;

    recognition =
        new SpeechRecognition();

    recognition.lang =
        "en-US";

    recognition.continuous =
        true;

    recognition.interimResults =
        true;

    recognition.maxAlternatives =
        1;


    recognition.onstart = () => {

        recognitionStarting =
            false;

        setText(
            statusText,
            "Listening"
        );

        statusDot?.classList.remove(
            "error"
        );

        statusDot?.classList.add(
            "listening"
        );

    };


    recognition.onresult =
        handleRecognitionResult;


    recognition.onerror =
        event => {

            console.warn(
                "Speech recognition error:",
                event.error
            );

            recognitionStarting =
                false;

            if (
                event.error ===
                    "not-allowed" ||
                event.error ===
                    "service-not-allowed"
            ) {

                setText(
                    statusText,
                    "Microphone permission needed"
                );

                statusDot?.classList.remove(
                    "listening"
                );

                statusDot?.classList.add(
                    "error"
                );

                recognitionShouldRun =
                    false;

            }

        };


    recognition.onend = () => {

        recognitionStarting =
            false;

        /*
            Chrome can stop SpeechRecognition
            by itself even when the recording is
            still active.

            Restart almost immediately.
        */

        if (
            recognitionShouldRun &&
            isRecording
        ) {

            setTimeout(
                () => {

                    if (
                        !recognitionShouldRun ||
                        !isRecording ||
                        recognitionStarting
                    ) {
                        return;
                    }

                    try {

                        recognitionStarting =
                            true;

                        recognition.start();

                    } catch (_) {

                        recognitionStarting =
                            false;

                    }

                },
                20
            );

        }

    };

}


/* =========================================================
   HANDLE RECOGNITION RESULT
   ========================================================= */

function handleRecognitionResult(event) {

    if (!isRecording) {
        return;
    }

    let finalPart = "";
    let interimPart = "";

    /*
        Only process the results from the browser's
        current event.

        This is considerably faster than waiting
        for a complete recording.
    */

    for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
    ) {

        const result =
            event.results[i];

        const transcript =
            result?.[0]?.transcript || "";

        if (
            result.isFinal
        ) {

            finalPart +=
                transcript + " ";

        } else {

            interimPart +=
                transcript + " ";

        }

    }


    /*
        Some browsers provide resultIndex chunks
        rather than the complete transcript.

        Build a stable transcript from the browser's
        result array.
    */

    let completeFinal = "";
    let completeInterim = "";

    for (
        let i = 0;
        i < event.results.length;
        i++
    ) {

        const result =
            event.results[i];

        const transcript =
            result?.[0]?.transcript || "";

        if (
            result.isFinal
        ) {

            completeFinal +=
                transcript + " ";

        } else {

            completeInterim +=
                transcript + " ";

        }

    }


    const cleanFinal =
        completeFinal.trim();

    const cleanInterim =
        completeInterim.trim();


    const combined =
        [
            cleanFinal,
            cleanInterim
        ]
            .filter(Boolean)
            .join(" ")
            .trim();


    if (!combined) {
        return;
    }


    /*
        Update transcript immediately.
    */

    liveTranscript =
        combined;

    renderLiveTranscript();


    /*
        Detect immediately.

        This runs BEFORE waiting for the final
        OpenAI transcription.
    */

    detectLiveFillers(
        combined
    );


    lastRecognitionText =
        combined;

}


/* =========================================================
   START RECOGNITION
   ========================================================= */

function startRecognition() {

    if (
        !recognitionSupported ||
        !recognition ||
        recognitionStarting
    ) {

        return;

    }

    recognitionShouldRun =
        true;

    try {

        recognitionStarting =
            true;

        recognition.start();

    } catch (error) {

        recognitionStarting =
            false;

        console.debug(
            "Recognition start:",
            error
        );

    }

}


/* =========================================================
   STOP RECOGNITION
   ========================================================= */

function stopRecognition() {

    recognitionShouldRun =
        false;

    recognitionStarting =
        false;

    if (!recognition) {
        return;
    }

    try {

        recognition.stop();

    } catch (_) {}

}


/* =========================================================
   MIME TYPE
   ========================================================= */

function getRecordingMimeType() {

    if (
        !window.MediaRecorder ||
        !MediaRecorder.isTypeSupported
    ) {

        return "";

    }

    const types = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg"
    ];

    for (
        const type of types
    ) {

        try {

            if (
                MediaRecorder.isTypeSupported(
                    type
                )
            ) {

                return type;

            }

        } catch (_) {}

    }

    return "";

}


/* =========================================================
   START RECORDING
   ========================================================= */

async function startRecording() {

    if (
        isRecording ||
        isStopping
    ) {

        return;

    }

    try {

        activeStream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });


        audioChunks = [];

        liveTranscript = "";
        finalTranscript = "";

        currentAnalysis = null;
        currentSpeechId = null;

        currentSessionFillerCount = 0;
        currentSessionWordCount = 0;

        lastRecognitionText = "";
        lastDetectedTranscript = "";

        firedOccurrences.clear();
        recentNotificationTimes.clear();
        processedTextVersions.clear();

        /*
            IMPORTANT:

            Always hide this at the beginning of a
            recording.

            This fixes the save menu appearing at startup.
        */

        setHidden(
            savePrompt,
            true
        );

        setHidden(
            analysisLoading,
            true
        );

        if (analysisElement) {
            analysisElement.innerHTML = "";
        }

        if (heard) {
            heard.innerHTML = `
                <span class="empty-state">
                    Listening...
                </span>
            `;
        }

        if (finalTranscriptElement) {
            finalTranscriptElement.innerHTML = `
                <span class="empty-state">
                    Your completed speech will appear here.
                </span>
            `;
        }

        setText(
            fillerCountElement,
            "0"
        );

        setText(
            wordCountElement,
            "0"
        );


        const mimeType =
            getRecordingMimeType();


        if (mimeType) {

            mediaRecorder =
                new MediaRecorder(
                    activeStream,
                    {
                        mimeType
                    }
                );

        } else {

            mediaRecorder =
                new MediaRecorder(
                    activeStream
                );

        }


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


        mediaRecorder.onstop =
            () => {

                if (activeStream) {

                    activeStream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                }

                activeStream =
                    null;

                finishRecording();

            };


        mediaRecorder.start(
            200
        );


        isRecording =
            true;

        isStopping =
            false;

        recordingStartTime =
            Date.now();


        startTimer();


        if (listenButton) {
            listenButton.disabled =
                true;
        }

        if (stopButton) {
            stopButton.disabled =
                false;
        }


        setText(
            statusText,
            "Listening"
        );

        statusDot?.classList.remove(
            "error"
        );

        statusDot?.classList.add(
            "listening"
        );


        /*
            Start browser recognition immediately.
        */

        startRecognition();


    } catch (error) {

        console.error(
            "Could not start recording:",
            error
        );

        isRecording =
            false;

        isStopping =
            false;

        setText(
            statusText,
            "Microphone unavailable"
        );

        statusDot?.classList.remove(
            "listening"
        );

        statusDot?.classList.add(
            "error"
        );

        if (listenButton) {
            listenButton.disabled =
                false;
        }

        if (stopButton) {
            stopButton.disabled =
                true;
        }

        alert(
            "Could not access the microphone. Please allow microphone access and try again."
        );

    }

}


/* =========================================================
   STOP RECORDING
   ========================================================= */

function stopRecording() {

    if (
        !isRecording ||
        isStopping
    ) {

        return;

    }

    isStopping =
        true;

    recognitionShouldRun =
        false;

    stopRecognition();

    stopTimer();


    if (
        mediaRecorder &&
        mediaRecorder.state !== "inactive"
    ) {

        mediaRecorder.stop();

    } else {

        finishRecording();

    }

}


/* =========================================================
   FINISH RECORDING
   ========================================================= */

async function finishRecording() {

    isRecording =
        false;

    isStopping =
        false;

    if (listenButton) {
        listenButton.disabled =
            false;
    }

    if (stopButton) {
        stopButton.disabled =
            true;
    }


    setText(
        statusText,
        "Processing"
    );

    statusDot?.classList.remove(
        "listening"
    );


    /*
        Preserve the live transcript immediately.

        The user should never have to wait for the
        server before seeing their speech.
    */

    finalTranscript =
        liveTranscript.trim();

    renderFinalTranscript();

    updateStats(
        finalTranscript
    );


    analyzeButton.disabled =
        !finalTranscript;


    /*
        Only show Save after a real speech exists.

        This is the startup-menu fix.
    */

    if (
        finalTranscript
    ) {

        setHidden(
            savePrompt,
            false
        );

    } else {

        setHidden(
            savePrompt,
            true
        );

    }


    setText(
        statusText,
        "Finished"
    );


    /*
        Ask OpenAI for the cleaner final transcript.

        This runs AFTER the live experience and
        doesn't block it.
    */

    if (
        audioChunks.length > 0
    ) {

        try {

            const improvedTranscript =
                await requestFinalTranscription();

            if (
                improvedTranscript &&
                improvedTranscript.trim()
            ) {

                finalTranscript =
                    improvedTranscript.trim();

                liveTranscript =
                    finalTranscript;

                renderFinalTranscript();

                updateStats(
                    finalTranscript
                );

                analyzeButton.disabled =
                    false;

            }

        } catch (error) {

            console.warn(
                "Final transcription failed. Keeping live transcript.",
                error
            );

        }

    }

}


/* =========================================================
   FINAL TRANSCRIPTION API
   ========================================================= */

async function requestFinalTranscription() {

    if (!audioChunks.length) {
        return "";
    }

    const mimeType =
        mediaRecorder?.mimeType ||
        "audio/webm";


    const blob =
        new Blob(
            audioChunks,
            {
                type: mimeType
            }
        );


    const base64 =
        await blobToBase64(
            blob
        );


    const response =
        await fetch(
            "/api/transcribe",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        audio:
                            base64,
                        mimeType
                    })
            }
        );


    const data =
        await response
            .json()
            .catch(
                () => ({})
            );


    if (!response.ok) {

        throw new Error(
            data.error ||
            "Transcription failed"
        );

    }


    return (
        data.transcript ||
        data.text ||
        ""
    );

}


/* =========================================================
   BLOB TO BASE64
   ========================================================= */

function blobToBase64(blob) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onloadend =
                () => {

                    resolve(
                        reader.result
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


/* =========================================================
   TIMER
   ========================================================= */

function startTimer() {

    stopTimer();

    recordingStartTime =
        Date.now();

    timerInterval =
        setInterval(
            () => {

                if (
                    !recordingStartTime
                ) {
                    return;
                }

                const elapsed =
                    Math.floor(
                        (
                            Date.now() -
                            recordingStartTime
                        ) / 1000
                    );

                setText(
                    recordingTimer,
                    formatTime(elapsed)
                );

            },
            200
        );

}


function stopTimer() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;

    }

}


function formatTime(seconds) {

    const minutes =
        Math.floor(
            seconds / 60
        );

    const remaining =
        seconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remaining).padStart(2, "0")
    );

}


/* =========================================================
   AI ANALYSIS
   ========================================================= */

async function analyzeSpeech() {

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {

        return;

    }


    analyzeButton.disabled =
        true;

    setHidden(
        analysisLoading,
        false
    );

    if (analysisElement) {
        analysisElement.innerHTML = "";
    }


    try {

        const response =
            await fetch(
                "/api/analyze",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            transcript:
                                finalTranscript
                        })
                }
            );


        const data =
            await response
                .json()
                .catch(
                    () => ({})
                );


        if (!response.ok) {

            throw new Error(
                data.error ||
                "AI analysis failed"
            );

        }


        currentAnalysis =
            data.analysisData ??
            data.analysis ??
            data;


        /*
            Handle APIs that return:

            {
                analysis: "{\"foo\":\"bar\"}"
            }

            rather than an actual object.
        */

        if (
            typeof currentAnalysis ===
                "string"
        ) {

            const trimmed =
                currentAnalysis.trim();

            if (
                (
                    trimmed.startsWith("{") &&
                    trimmed.endsWith("}")
                ) ||
                (
                    trimmed.startsWith("[") &&
                    trimmed.endsWith("]")
                )
            ) {

                try {

                    currentAnalysis =
                        JSON.parse(
                            trimmed
                        );

                } catch (_) {}

            }

        }


        renderAnalysis(
            currentAnalysis
        );


    } catch (error) {

        console.error(
            "AI analysis error:",
            error
        );

        if (analysisElement) {

            analysisElement.innerHTML = `
                <div class="analysis-section error-analysis">
                    <div class="analysis-section-title">
                        Analysis Error
                    </div>

                    <div class="analysis-section-text">
                        ${escapeHTML(
                            error.message ||
                            "The AI analysis could not be completed."
                        )}
                    </div>
                </div>
            `;

        }

    } finally {

        setHidden(
            analysisLoading,
            true
        );

        analyzeButton.disabled =
            !finalTranscript;

    }

}


if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );

}


/* =========================================================
   ANALYSIS RENDERER
   ========================================================= */

function renderAnalysis(data) {

    if (!analysisElement) {
        return;
    }

    analysisElement.innerHTML = "";


    if (
        data === null ||
        data === undefined ||
        data === ""
    ) {

        analysisElement.innerHTML = `
            <div class="analysis-empty">
                No analysis was returned.
            </div>
        `;

        return;

    }


    if (
        typeof data === "string"
    ) {

        analysisElement.appendChild(
            createAnalysisSection(
                "AI Feedback",
                data
            )
        );

        return;

    }


    if (
        Array.isArray(data)
    ) {

        const section =
            document.createElement(
                "div"
            );

        section.className =
            "analysis-section";

        renderAnalysisValue(
            data,
            section
        );

        analysisElement.appendChild(
            section
        );

        return;

    }


    if (
        typeof data === "object"
    ) {

        Object.entries(data)
            .forEach(
                ([key, value]) => {

                    if (
                        value === null ||
                        value === undefined ||
                        value === ""
                    ) {
                        return;
                    }

                    const section =
                        document.createElement(
                            "div"
                        );

                    section.className =
                        "analysis-section";


                    const title =
                        document.createElement(
                            "div"
                        );

                    title.className =
                        "analysis-section-title";

                    title.textContent =
                        prettifyKey(key);


                    section.appendChild(
                        title
                    );


                    renderAnalysisValue(
                        value,
                        section
                    );


                    analysisElement.appendChild(
                        section
                    );

                }
            );

    }


    if (
        !analysisElement.children.length
    ) {

        analysisElement.innerHTML = `
            <div class="analysis-empty">
                No useful analysis was returned.
            </div>
        `;

    }

}


/* =========================================================
   RENDER ANALYSIS VALUE
   ========================================================= */

function renderAnalysisValue(
    value,
    parent
) {

    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {

        const text =
            document.createElement(
                "div"
            );

        text.className =
            "analysis-section-text";

        text.textContent =
            String(value);

        parent.appendChild(
            text
        );

        return;

    }


    if (
        Array.isArray(value)
    ) {

        const list =
            document.createElement(
                "ul"
            );

        list.className =
            "analysis-list";


        value.forEach(
            item => {

                const li =
                    document.createElement(
                        "li"
                    );

                li.className =
                    "analysis-list-item";


                if (
                    item &&
                    typeof item === "object"
                ) {

                    renderObjectInside(
                        item,
                        li
                    );

                } else {

                    li.textContent =
                        String(item);

                }


                list.appendChild(
                    li
                );

            }
        );


        parent.appendChild(
            list
        );

        return;

    }


    if (
        typeof value === "object" &&
        value !== null
    ) {

        renderObjectInside(
            value,
            parent
        );

    }

}


/* =========================================================
   RENDER OBJECT
   ========================================================= */

function renderObjectInside(
    object,
    parent
) {

    Object.entries(object)
        .forEach(
            ([key, value]) => {

                if (
                    value === null ||
                    value === undefined ||
                    value === ""
                ) {
                    return;
                }

                const subsection =
                    document.createElement(
                        "div"
                    );

                subsection.className =
                    "analysis-subsection";


                const title =
                    document.createElement(
                        "div"
                    );

                title.className =
                    "analysis-subtitle";

                title.textContent =
                    prettifyKey(key);


                subsection.appendChild(
                    title
                );


                renderAnalysisValue(
                    value,
                    subsection
                );


                parent.appendChild(
                    subsection
                );

            }
        );

}


/* =========================================================
   CREATE ANALYSIS SECTION
   ========================================================= */

function createAnalysisSection(
    titleText,
    content
) {

    const section =
        document.createElement(
            "div"
        );

    section.className =
        "analysis-section";


    const title =
        document.createElement(
            "div"
        );

    title.className =
        "analysis-section-title";

    title.textContent =
        titleText;


    const text =
        document.createElement(
            "div"
        );

    text.className =
        "analysis-section-text";

    text.textContent =
        content;


    section.appendChild(
        title
    );

    section.appendChild(
        text
    );


    return section;

}


/* =========================================================
   PRETTIFY KEY
   ========================================================= */

function prettifyKey(key) {

    return String(key)
        .replace(
            /([a-z])([A-Z])/g,
            "$1 $2"
        )
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\b\w/g,
            char =>
                char.toUpperCase()
        );

}


/* =========================================================
   SAVED SPEECHES
   ========================================================= */

function getSavedSpeeches() {

    try {

        const raw =
            localStorage.getItem(
                SPEECH_STORAGE_KEY
            );

        if (!raw) {
            return [];
        }

        const parsed =
            JSON.parse(raw);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(
            "Could not load saved speeches:",
            error
        );

        return [];

    }

}


function setSavedSpeeches(
    speeches
) {

    try {

        localStorage.setItem(
            SPEECH_STORAGE_KEY,
            JSON.stringify(
                speeches
            )
        );

    } catch (error) {

        console.error(
            "Could not save speeches:",
            error
        );

    }

}


/* =========================================================
   RENDER SAVED SPEECHES
   ========================================================= */

function renderSavedSpeeches() {

    if (!savedSpeechesElement) {
        return;
    }

    const speeches =
        getSavedSpeeches();


    setText(
        savedSpeechCount,
        speeches.length
    );


    if (!speeches.length) {

        savedSpeechesElement.innerHTML = `
            <div class="empty-history">
                No saved speeches yet.
            </div>
        `;

        return;

    }


    savedSpeechesElement.innerHTML =
        speeches
            .map(
                speech => {

                    const date =
                        new Date(
                            speech.date
                        );

                    const dateText =
                        Number.isNaN(
                            date.getTime()
                        )
                            ? "Unknown date"
                            : date.toLocaleString(
                                undefined,
                                {
                                    dateStyle:
                                        "medium",
                                    timeStyle:
                                        "short"
                                }
                            );


                    return `
                        <div
                            class="saved-speech"
                            data-id="${escapeHTML(
                                speech.id
                            )}"
                        >

                            <div
                                class="saved-speech-main"
                                data-open-speech="${escapeHTML(
                                    speech.id
                                )}"
                            >

                                <div class="saved-speech-name">
                                    ${escapeHTML(
                                        speech.name ||
                                        "Untitled Speech"
                                    )}
                                </div>

                                <div class="saved-speech-date">
                                    ${escapeHTML(
                                        dateText
                                    )}
                                </div>

                                <div class="saved-speech-stats">
                                    ${speech.wordCount || 0}
                                    words
                                    •
                                    ${speech.fillerCount || 0}
                                    tracked fillers
                                </div>

                            </div>

                            <button
                                class="delete-speech"
                                type="button"
                                data-delete-speech="${escapeHTML(
                                    speech.id
                                )}"
                                aria-label="Delete speech"
                            >
                                ×
                            </button>

                        </div>
                    `;

                }
            )
            .join("");

}


/* =========================================================
   SAVE MODAL
   ========================================================= */

function openSaveModal() {

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {

        return;

    }

    if (!saveModal) {
        return;
    }

    if (speechNameInput) {
        speechNameInput.value = "";
    }

    saveModal.hidden =
        false;

    document.body.classList.add(
        "modal-open"
    );

    setTimeout(
        () => {

            speechNameInput?.focus();

        },
        50
    );

}


function closeSaveModal() {

    if (saveModal) {
        saveModal.hidden =
            true;
    }

    document.body.classList.remove(
        "modal-open"
    );

}


/* =========================================================
   SAVE CURRENT SPEECH
   ========================================================= */

function saveCurrentSpeech(name) {

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {

        return;

    }


    const speeches =
        getSavedSpeeches();


    const speech = {

        id:
            `speech_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 9)}`,

        name:
            String(name || "").trim() ||
            `Speech ${new Date()
                .toLocaleDateString()}`,

        date:
            new Date().toISOString(),

        transcript:
            finalTranscript,

        fillerCount:
            countFillers(
                finalTranscript
            ),

        wordCount:
            countWords(
                finalTranscript
            ),

        analysis:
            currentAnalysis || null

    };


    speeches.unshift(
        speech
    );


    setSavedSpeeches(
        speeches
    );


    currentSpeechId =
        speech.id;


    renderSavedSpeeches();

    closeSaveModal();

    setHidden(
        savePrompt,
        true
    );

}


/* =========================================================
   SAVE BUTTONS
   ========================================================= */

if (saveSpeechButton) {

    saveSpeechButton.addEventListener(
        "click",
        openSaveModal
    );

}


if (discardSpeechButton) {

    discardSpeechButton.addEventListener(
        "click",
        () => {

            setHidden(
                savePrompt,
                true
            );

        }
    );

}


if (cancelSaveButton) {

    cancelSaveButton.addEventListener(
        "click",
        closeSaveModal
    );

}


if (confirmSaveButton) {

    confirmSaveButton.addEventListener(
        "click",
        () => {

            saveCurrentSpeech(
                speechNameInput?.value || ""
            );

        }
    );

}


if (speechNameInput) {

    speechNameInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                saveCurrentSpeech(
                    speechNameInput.value
                );

            }

            if (
                event.key === "Escape"
            ) {

                closeSaveModal();

            }

        }
    );

}


/* =========================================================
   SAVED SPEECH CLICK
   ========================================================= */

if (savedSpeechesElement) {

    savedSpeechesElement.addEventListener(
        "click",
        event => {

            const deleteButton =
                event.target.closest(
                    "[data-delete-speech]"
                );


            if (deleteButton) {

                event.stopPropagation();

                deleteSpeech(
                    deleteButton.dataset
                        .deleteSpeech
                );

                return;

            }


            const speechElement =
                event.target.closest(
                    "[data-open-speech]"
                );


            if (speechElement) {

                openSavedSpeech(
                    speechElement.dataset
                        .openSpeech
                );

            }

        }
    );

}


/* =========================================================
   DELETE SPEECH
   ========================================================= */

function deleteSpeech(id) {

    const speeches =
        getSavedSpeeches();

    const filtered =
        speeches.filter(
            speech =>
                speech.id !== id
        );

    setSavedSpeeches(
        filtered
    );

    renderSavedSpeeches();

}


/* =========================================================
   OPEN SAVED SPEECH
   ========================================================= */

function openSavedSpeech(id) {

    const speeches =
        getSavedSpeeches();

    const speech =
        speeches.find(
            item =>
                item.id === id
        );


    if (!speech) {
        return;
    }


    currentSpeechId =
        speech.id;

    finalTranscript =
        speech.transcript || "";

    liveTranscript =
        finalTranscript;

    currentAnalysis =
        speech.analysis || null;


    renderFinalTranscript();

    updateStats(
        finalTranscript
    );


    if (currentAnalysis) {

        renderAnalysis(
            currentAnalysis
        );

    } else {

        analysisElement.innerHTML = `
            <div class="analysis-empty">
                This speech does not have an AI analysis yet.
            </div>
        `;

    }


    analyzeButton.disabled =
        !finalTranscript;


    setHidden(
        savePrompt,
        true
    );


    document
        .querySelector(
            ".transcript-card"
        )
        ?.scrollIntoView({
            behavior:
                "smooth",
            block:
                "start"
        });

}


/* =========================================================
   THEME
   ========================================================= */

function getPreferredTheme() {

    const saved =
        localStorage.getItem(
            THEME_STORAGE_KEY
        );

    if (
        saved === "dark" ||
        saved === "light"
    ) {

        return saved;

    }

    return window.matchMedia(
        "(prefers-color-scheme: dark)"
    ).matches
        ? "dark"
        : "light";

}


function applyTheme(theme) {

    document.documentElement
        .setAttribute(
            "data-theme",
            theme
        );


    localStorage.setItem(
        THEME_STORAGE_KEY,
        theme
    );


    if (
        theme === "dark"
    ) {

        setText(
            themeToggle,
            "Light"
        );

        if (themeColor) {
            themeColor.content =
                "#09090b";
        }

    } else {

        setText(
            themeToggle,
            "Dark"
        );

        if (themeColor) {
            themeColor.content =
                "#ffffff";
        }

    }

}


if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        () => {

            const current =
                document.documentElement
                    .getAttribute(
                        "data-theme"
                    );

            applyTheme(
                current === "dark"
                    ? "light"
                    : "dark"
            );

        }
    );

}


/* =========================================================
   SCROLL INDICATOR
   ========================================================= */

window.addEventListener(
    "scroll",
    () => {

        if (!scrollIndicator) {
            return;
        }

        scrollIndicator.style.opacity =
            window.scrollY > 80
                ? "0"
                : "1";

    },
    {
        passive: true
    }
);


/* =========================================================
   RECORD BUTTONS
   ========================================================= */

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


/* =========================================================
   MODAL BACKDROP
   ========================================================= */

if (saveModal) {

    saveModal.addEventListener(
        "click",
        event => {

            if (
                event.target === saveModal
            ) {

                closeSaveModal();

            }

        }
    );

}


/* =========================================================
   ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape" &&
            saveModal &&
            !saveModal.hidden
        ) {

            closeSaveModal();

        }

    }
);


/* =========================================================
   CLEANUP
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        try {

            recognitionShouldRun =
                false;

            recognition?.stop();

        } catch (_) {}

        try {

            mediaRecorder?.stop();

        } catch (_) {}

        if (activeStream) {

            activeStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }

    }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initialize() {

    /*
        CRITICAL:

        The save prompt is hidden immediately,
        before anything else happens.

        This prevents the weird save menu from
        appearing on initial page load.
    */

    setHidden(
        savePrompt,
        true
    );


    setHidden(
        saveModal,
        true
    );


    setHidden(
        analysisLoading,
        true
    );


    if (stopButton) {
        stopButton.disabled =
            true;
    }


    if (analyzeButton) {
        analyzeButton.disabled =
            true;
    }


    loadTrackedWords();

    renderWordList();

    renderSavedSpeeches();

    applyTheme(
        getPreferredTheme()
    );

    setupSpeechRecognition();


    if (
        !recognitionSupported
    ) {

        console.warn(
            "SpeechRecognition is not supported in this browser."
        );

        setText(
            statusText,
            "Live detection unavailable"
        );

    }


    /*
        Restore notification UI if permission
        was already granted.
    */

    if (
        "Notification" in window &&
        Notification.permission ===
            "granted"
    ) {

        setText(
            notificationStatus,
            "Notifications are enabled."
        );

        notificationStatus?.classList.add(
            "enabled"
        );

        if (enableNotificationsButton) {

            enableNotificationsButton.textContent =
                "Notifications Enabled";

            enableNotificationsButton.disabled =
                true;

        }

    }

}


initialize();