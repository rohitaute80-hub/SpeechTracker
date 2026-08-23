/* =========================================================
   SPEECH TRACKER
   Complete replacement script.js

   Features:
   - Live transcription
   - Fast filler detection
   - UM/UMM/UMMMM family detection
   - UH/UHH/UHHH family detection
   - One notification per actual occurrence
   - Vibration on filler detection
   - Accurate final transcription
   - Filler rate
   - Speaking pace
   - Word count
   - AI speech analysis
   - Saved speeches
   - Custom tracked words
   - Light/dark theme
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
   DEFAULT WORDS
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
   STORAGE
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
let audioChunks = [];

let recognition = null;
let recognitionSupported = false;
let recognitionShouldRun = false;

let isRecording = false;
let isStopping = false;

let recordingStartTime = null;
let timerInterval = null;

let liveTranscript = "";
let finalTranscript = "";

let currentAnalysis = null;

let currentSessionFillerCount = 0;
let currentSessionWordCount = 0;

let currentSpeechId = null;


/* =========================================================
   LIVE FILLER DETECTION STATE

   We keep track of the actual words that have already
   triggered.

   This is more reliable than simply checking the entire
   transcript over and over.

   Example:

       "I um think"

   The "um" gets one occurrence.

   If SpeechRecognition changes:

       "I um th..."

   into:

       "I um think..."

   it does NOT trigger again.
   ========================================================= */

const firedFillerOccurrences =
    new Set();


/*
   Prevents extremely fast duplicate browser events.
*/

const recentNotificationKeys =
    new Map();


/*
   Last transcript we scanned.
*/

let lastScannedTranscript = "";


/*
   Number of final words already processed.
*/

let processedFinalWordCount = 0;


/* =========================================================
   WORD STORAGE
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
                parsed.length
            ) {

                trackedWords =
                    parsed;

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


function saveTrackedWords() {

    localStorage.setItem(
        WORD_STORAGE_KEY,
        JSON.stringify(
            trackedWords
        )
    );

}


/* =========================================================
   NORMALIZATION
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

    if (
        /^um+$/.test(normalized)
    ) {

        return "UM";

    }

    if (
        /^uh+$/.test(normalized)
    ) {

        return "UH";

    }

    return normalized;

}


/* =========================================================
   REGEX ESCAPE
   ========================================================= */

function escapeRegex(text) {

    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}


/* =========================================================
   BUILD FILLER REGEX
   ========================================================= */

function getFillerRegex() {

    const words =
        [...trackedWords]
            .map(normalizeWord)
            .filter(Boolean)
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    /*
       Add unlimited UM and UH forms.

       This catches:

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
       uhhhhh
    */

    const patterns =
        words.map(
            word =>
                escapeRegex(word)
        );


    patterns.push(
        "um+",
        "uh+"
    );


    const unique =
        [...new Set(patterns)];


    return new RegExp(
        `\\b(${unique.join("|")})\\b`,
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
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   COUNT WORDS
   ========================================================= */

function countWords(text) {

    const cleaned =
        String(text || "")
            .trim();


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
   FILLER RATE
   =========================================================

   Formula:

       filler words / total words × 100
   ========================================================= */

function calculateFillerRate(
    text
) {

    const words =
        countWords(text);

    const fillers =
        countFillers(text);


    if (!words) {
        return 0;
    }


    return (
        fillers / words
    ) * 100;

}


/* =========================================================
   SPEAKING PACE
   =========================================================

   Formula:

       words / minutes
   ========================================================= */

function calculatePacing(
    text,
    durationSeconds
) {

    const words =
        countWords(text);


    if (
        !words ||
        !durationSeconds ||
        durationSeconds <= 0
    ) {

        return 0;

    }


    return (
        words /
        (durationSeconds / 60)
    );

}


/* =========================================================
   GET CURRENT DURATION
   ========================================================= */

function getCurrentDurationSeconds() {

    if (!recordingStartTime) {
        return 0;
    }


    return Math.max(
        0,
        (Date.now() - recordingStartTime) /
        1000
    );

}


/* =========================================================
   UPDATE STATS
   ========================================================= */

function updateStats(text) {

    const fillerCount =
        countFillers(text);

    const wordCount =
        countWords(text);


    currentSessionFillerCount =
        fillerCount;

    currentSessionWordCount =
        wordCount;


    fillerCountElement.textContent =
        fillerCount;

    wordCountElement.textContent =
        wordCount;

}


/* =========================================================
   RENDER LIVE TRANSCRIPT
   ========================================================= */

function renderLiveTranscript() {

    heard.innerHTML =
        highlightTranscript(
            liveTranscript
        );


    updateStats(
        liveTranscript
    );

}


/* =========================================================
   RENDER FINAL TRANSCRIPT
   ========================================================= */

function renderFinalTranscript() {

    if (!finalTranscript) {

        finalTranscriptElement.textContent =
            "Your completed speech will appear here.";

        return;

    }


    finalTranscriptElement.innerHTML =
        highlightTranscript(
            finalTranscript
        );

}


/* =========================================================
   WORD LIST
   ========================================================= */

function renderWordList() {

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
   ADD WORD
   ========================================================= */

function addTrackedWord() {

    const word =
        normalizeWord(
            customWordInput.value
        );


    if (!word) {
        return;
    }


    if (
        trackedWords.some(
            existing =>
                normalizeWord(existing) ===
                word
        )
    ) {

        customWordInput.value = "";

        return;

    }


    trackedWords.push(
        word
    );


    saveTrackedWords();

    renderWordList();

    customWordInput.value = "";

}


/* =========================================================
   REMOVE WORD
   ========================================================= */

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


        trackedWords.splice(
            index,
            1
        );


        saveTrackedWords();

        renderWordList();

    }
);


/* =========================================================
   RESET WORDS
   ========================================================= */

resetWordsButton.addEventListener(
    "click",
    () => {

        trackedWords =
            [...DEFAULT_WORDS];


        saveTrackedWords();

        renderWordList();

    }
);


/* =========================================================
   WORD INPUT
   ========================================================= */

addWordButton.addEventListener(
    "click",
    addTrackedWord
);


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


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

async function enableNotifications() {

    if (
        !("Notification" in window)
    ) {

        notificationStatus.textContent =
            "Notifications are not supported in this browser.";

        return;

    }


    try {

        const permission =
            await Notification.requestPermission();


        if (
            permission === "granted"
        ) {

            notificationStatus.textContent =
                "Notifications are enabled.";

            notificationStatus.classList.add(
                "enabled"
            );

            enableNotificationsButton.textContent =
                "Notifications Enabled";

            enableNotificationsButton.disabled =
                true;

        } else {

            notificationStatus.textContent =
                "Notification permission was not granted.";

        }

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

    }

}


enableNotificationsButton.addEventListener(
    "click",
    enableNotifications
);


/* =========================================================
   SEND FILLER NOTIFICATION
   ========================================================= */

function sendFillerNotification(
    word,
    occurrenceKey
) {

    if (
        !("Notification" in window)
    ) {
        return;
    }


    if (
        Notification.permission !==
        "granted"
    ) {

        return;

    }


    const family =
        fillerFamily(word);


    const now =
        Date.now();


    /*
       The occurrence key is the primary
       duplicate protection.
    */

    const notificationKey =
        `${occurrenceKey}:${family}`;


    if (
        recentNotificationKeys.has(
            notificationKey
        )
    ) {

        return;

    }


    recentNotificationKeys.set(
        notificationKey,
        now
    );


    /*
       Clean old entries periodically.
    */

    for (
        const [
            key,
            timestamp
        ]
        of recentNotificationKeys
    ) {

        if (
            now - timestamp > 5000
        ) {

            recentNotificationKeys.delete(
                key
            );

        }

    }


    try {

        /*
           Do NOT use one global notification tag.

           Each actual occurrence gets its own tag.

           This prevents different filler words from
           replacing each other while still preventing
           duplicate notifications for the same event.
        */

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
                        `speech-tracker-${notificationKey}`,
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

                } catch (_) {}

            },
            1200
        );

    } catch (error) {

        console.error(
            "Could not send notification:",
            error
        );

    }

}


/* =========================================================
   VIBRATION
   ========================================================= */

function vibrateForFiller() {

    try {

        if (
            typeof navigator.vibrate ===
            "function"
        ) {

            navigator.vibrate(
                [45, 25, 45]
            );

        }

    } catch (_) {}

}


/* =========================================================
   DETECT FILLERS IN LIVE TEXT
   ========================================================= */

function detectLiveFillers(text) {

    if (!text) {
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


        /*
           Determine the approximate word
           position in the transcript.
        */

        const before =
            text
                .slice(
                    0,
                    match.index
                )
                .trim();


        const wordIndex =
            before
                ? before
                    .split(/\s+/)
                    .filter(Boolean)
                    .length
                : 0;


        const family =
            fillerFamily(word);


        /*
           This identifies the actual occurrence.

           Example:

           5:UM

           means the UM-family filler at word
           position 5.
        */

        const occurrenceKey =
            `${wordIndex}:${family}`;


        if (
            firedFillerOccurrences.has(
                occurrenceKey
            )
        ) {

            continue;

        }


        /*
           Mark BEFORE notification.

           This is important because multiple browser
           events can arrive almost simultaneously.
        */

        firedFillerOccurrences.add(
            occurrenceKey
        );


        currentSessionFillerCount++;


        fillerCountElement.textContent =
            currentSessionFillerCount;


        vibrateForFiller();


        sendFillerNotification(
            word,
            occurrenceKey
        );

    }


    lastScannedTranscript =
        text;

}


/* =========================================================
   SPEECH RECOGNITION
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


    recognition.onstart =
        () => {

            statusText.textContent =
                "Listening";

            statusDot.className =
                "status-dot listening";

        };


    recognition.onresult =
        handleRecognitionResult;


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

                statusText.textContent =
                    "Microphone permission needed";

                statusDot.className =
                    "status-dot error";

            }

        };


    recognition.onend =
        () => {

            if (
                recognitionShouldRun &&
                isRecording
            ) {

                try {

                    recognition.start();

                } catch (_) {}

            }

        };

}


/* =========================================================
   HANDLE SPEECH RESULT
   ========================================================= */

function handleRecognitionResult(
    event
) {

    let combinedFinal = "";
    let combinedInterim = "";


    /*
       IMPORTANT:

       SpeechRecognition's event.results collection
       can contain results from the current recognition
       session.

       We rebuild the transcript from those results.
    */

    for (
        let i = 0;
        i < event.results.length;
        i++
    ) {

        const result =
            event.results[i];


        const transcript =
            result[0]?.transcript ||
            "";


        if (
            result.isFinal
        ) {

            combinedFinal +=
                transcript + " ";

        } else {

            combinedInterim +=
                transcript + " ";

        }

    }


    const cleanFinal =
        combinedFinal.trim();


    const cleanInterim =
        combinedInterim.trim();


    liveTranscript =
        [
            cleanFinal,
            cleanInterim
        ]
            .filter(Boolean)
            .join(" ")
            .trim();


    renderLiveTranscript();


    /*
       Run filler detection immediately.

       This is intentionally done on BOTH final
       and interim results.

       That makes "umm" and "uhhh" detectable
       before SpeechRecognition finishes the sentence.
    */

    detectLiveFillers(
        liveTranscript
    );

}


/* =========================================================
   START RECOGNITION
   ========================================================= */

function startRecognition() {

    if (
        !recognitionSupported ||
        !recognition
    ) {

        return;

    }


    recognitionShouldRun =
        true;


    try {

        recognition.start();

    } catch (error) {

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


    if (!recognition) {
        return;
    }


    try {

        recognition.stop();

    } catch (_) {}

}


/* =========================================================
   MEDIA RECORDER MIME TYPE
   ========================================================= */

function getRecordingMimeType() {

    const options = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg"
    ];


    for (
        const type of options
    ) {

        if (
            window.MediaRecorder &&
            MediaRecorder.isTypeSupported &&
            MediaRecorder.isTypeSupported(type)
        ) {

            return type;

        }

    }


    return "";

}


/* =========================================================
   START RECORDING
   ========================================================= */

async function startRecording() {

    if (isRecording) {
        return;
    }


    try {

        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });


        audioChunks = [];


        liveTranscript = "";

        finalTranscript = "";


        currentAnalysis =
            null;


        currentSessionFillerCount =
            0;


        currentSessionWordCount =
            0;


        currentSpeechId =
            null;


        firedFillerOccurrences.clear();

        recentNotificationKeys.clear();


        lastScannedTranscript =
            "";


        processedFinalWordCount =
            0;


        analysisElement.innerHTML =
            "";


        finalTranscriptElement.textContent =
            "Your completed speech will appear here.";


        fillerCountElement.textContent =
            "0";


        wordCountElement.textContent =
            "0";


        analyzeButton.disabled =
            true;


        /*
           IMPORTANT:

           The save menu is hidden when starting
           a new recording.

           It should NEVER appear at page load.
        */

        savePrompt.hidden =
            true;


        const mimeType =
            getRecordingMimeType();


        if (mimeType) {

            mediaRecorder =
                new MediaRecorder(
                    stream,
                    {
                        mimeType
                    }
                );

        } else {

            mediaRecorder =
                new MediaRecorder(
                    stream
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

                stream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );


                finishRecording();

            };


        mediaRecorder.start(
            250
        );


        isRecording =
            true;


        isStopping =
            false;


        recordingStartTime =
            Date.now();


        startTimer();


        listenButton.disabled =
            true;


        stopButton.disabled =
            false;


        statusText.textContent =
            "Listening";


        statusDot.className =
            "status-dot listening";


        startRecognition();


    } catch (error) {

        console.error(
            "Could not start recording:",
            error
        );


        statusText.textContent =
            "Microphone unavailable";


        statusDot.className =
            "status-dot error";


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
        mediaRecorder.state !==
            "inactive"
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


    listenButton.disabled =
        false;


    stopButton.disabled =
        true;


    statusText.textContent =
        "Processing";


    statusDot.className =
        "status-dot";


    await wait(300);


    /*
       Use live transcript immediately.

       This makes the interface responsive instead
       of waiting for the OpenAI transcription request.
    */

    finalTranscript =
        liveTranscript.trim();


    renderFinalTranscript();


    updateStats(
        finalTranscript
    );


    analyzeButton.disabled =
        !finalTranscript;


    statusText.textContent =
        "Finished";


    /*
       Only show the save prompt after an actual
       speech has been completed.
    */

    if (finalTranscript) {

        savePrompt.hidden =
            false;

    }


    /*
       Request the more accurate server transcription.
    */

    if (
        audioChunks.length
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
                "Final transcription failed. Using live transcript.",
                error
            );

        }

    }

}


/* =========================================================
   FINAL TRANSCRIPTION API
   ========================================================= */

async function requestFinalTranscription() {

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
                        audio: base64,
                        mimeType
                    })
            }
        );


    const data =
        await response.json()
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

                const elapsed =
                    Math.floor(
                        (
                            Date.now() -
                            recordingStartTime
                        ) / 1000
                    );


                recordingTimer.textContent =
                    formatTime(
                        elapsed
                    );

            },
            250
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
        String(minutes)
            .padStart(2, "0") +
        ":" +
        String(remaining)
            .padStart(2, "0")
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


    analysisLoading.hidden =
        false;


    analysisElement.innerHTML =
        "";


    const durationSeconds =
        getCurrentDurationSeconds();


    const fillerCount =
        countFillers(
            finalTranscript
        );


    const wordCount =
        countWords(
            finalTranscript
        );


    /*
       If recordingStartTime is no longer useful
       because the recording has ended, calculate
       duration from the timer display instead.
    */

    let duration =
        durationSeconds;


    if (
        !duration ||
        duration < 1
    ) {

        const timerValue =
            recordingTimer.textContent ||
            "00:00";


        const parts =
            timerValue.split(":");


        if (
            parts.length === 2
        ) {

            duration =
                Number(parts[0]) * 60 +
                Number(parts[1]);

        }

    }


    const fillerRate =
        wordCount
            ? (
                fillerCount /
                wordCount
            ) * 100
            : 0;


    const pacing =
        duration > 0
            ? wordCount /
                (duration / 60)
            : 0;


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
                                finalTranscript,

                            metrics: {
                                wordCount,
                                fillerCount,
                                fillerRate:
                                    Number(
                                        fillerRate
                                            .toFixed(2)
                                    ),
                                durationSeconds:
                                    Number(
                                        duration
                                            .toFixed(2)
                                    ),
                                pacing:
                                    Number(
                                        pacing
                                            .toFixed(1)
                                    )
                            }
                        })
                }
            );


        const data =
            await response.json()
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
            data.analysisData ||
            data.analysis ||
            data;


        renderAnalysis(
            currentAnalysis
        );


    } catch (error) {

        console.error(
            "AI analysis error:",
            error
        );


        analysisElement.innerHTML = `
            <div class="analysis-section">

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

    } finally {

        analysisLoading.hidden =
            true;


        analyzeButton.disabled =
            !finalTranscript;

    }

}


analyzeButton.addEventListener(
    "click",
    analyzeSpeech
);


/* =========================================================
   AI RENDERER
   ========================================================= */

function renderAnalysis(data) {

    analysisElement.innerHTML =
        "";


    if (!data) {

        analysisElement.innerHTML = `
            <div class="analysis-empty">
                No analysis was returned.
            </div>
        `;

        return;

    }


    /*
       Metrics section.
    */

    if (
        data.metrics
    ) {

        const metricsSection =
            document.createElement(
                "div"
            );


        metricsSection.className =
            "analysis-section";


        const title =
            document.createElement(
                "div"
            );


        title.className =
            "analysis-section-title";


        title.textContent =
            "Speech Metrics";


        metricsSection.appendChild(
            title
        );


        renderAnalysisValue(
            data.metrics,
            metricsSection
        );


        analysisElement.appendChild(
            metricsSection
        );

    }


    /*
       Normal structured analysis.
    */

    Object.entries(data)
        .forEach(
            ([key, value]) => {

                if (
                    key === "metrics" ||
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
   RENDER NESTED AI VALUES
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
                    typeof item ===
                        "object" &&
                    item !== null
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

        const data =
            localStorage.getItem(
                SPEECH_STORAGE_KEY
            );


        if (!data) {
            return [];
        }


        const parsed =
            JSON.parse(data);


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

    localStorage.setItem(
        SPEECH_STORAGE_KEY,
        JSON.stringify(
            speeches
        )
    );

}


/* =========================================================
   RENDER SAVED SPEECHES
   ========================================================= */

function renderSavedSpeeches() {

    const speeches =
        getSavedSpeeches();


    savedSpeechCount.textContent =
        speeches.length;


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
                        isNaN(
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

    speechNameInput.value =
        "";


    saveModal.hidden =
        false;


    setTimeout(
        () => {

            speechNameInput.focus();

        },
        50
    );

}


function closeSaveModal() {

    saveModal.hidden =
        true;

}


/* =========================================================
   SAVE SPEECH
   ========================================================= */

function saveCurrentSpeech(
    name
) {

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
            name.trim() ||
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

        fillerRate:
            Number(
                calculateFillerRate(
                    finalTranscript
                ).toFixed(2)
            ),

        analysis:
            currentAnalysis ||
            null

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


    savePrompt.hidden =
        true;

}


/* =========================================================
   SAVE EVENTS
   ========================================================= */

saveSpeechButton.addEventListener(
    "click",
    openSaveModal
);


discardSpeechButton.addEventListener(
    "click",
    () => {

        savePrompt.hidden =
            true;

    }
);


cancelSaveButton.addEventListener(
    "click",
    closeSaveModal
);


confirmSaveButton.addEventListener(
    "click",
    () => {

        saveCurrentSpeech(
            speechNameInput.value
        );

    }
);


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


/* =========================================================
   SAVED SPEECH CLICK HANDLER
   ========================================================= */

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
        speech.transcript ||
        "";


    currentAnalysis =
        speech.analysis ||
        null;


    liveTranscript =
        finalTranscript;


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


    savePrompt.hidden =
        true;


    document
        .querySelector(
            ".transcript-card"
        )
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
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


    if (theme === "dark") {

        themeToggle.textContent =
            "Light";


        themeColor.content =
            "#09090b";

    } else {

        themeToggle.textContent =
            "Dark";


        themeColor.content =
            "#ffffff";

    }

}


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


/* =========================================================
   SCROLL INDICATOR
   ========================================================= */

if (scrollIndicator) {

    window.addEventListener(
        "scroll",
        () => {

            scrollIndicator.style.opacity =
                window.scrollY > 80
                    ? "0"
                    : "1";

        },
        {
            passive: true
        }
    );

}


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

listenButton.addEventListener(
    "click",
    startRecording
);


stopButton.addEventListener(
    "click",
    stopRecording
);


/* =========================================================
   UTILITY
   ========================================================= */

function wait(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initialize() {

    /*
       IMPORTANT:

       Always hide the save prompt when the page loads.

       It should only appear after recording a speech.
    */

    if (savePrompt) {

        savePrompt.hidden =
            true;

    }


    if (saveModal) {

        saveModal.hidden =
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

    }


    if (
        "Notification" in window &&
        Notification.permission ===
            "granted"
    ) {

        notificationStatus.textContent =
            "Notifications are enabled.";


        notificationStatus.classList.add(
            "enabled"
        );


        enableNotificationsButton.textContent =
            "Notifications Enabled";


        enableNotificationsButton.disabled =
            true;

    }

}


initialize();