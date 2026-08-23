/* =========================================================
   SPEECH TRACKER
   Complete replacement script.js
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const DEFAULT_WORDS = [
    "um",
    "uh",
    "umm",
    "uhh",
    "ummm",
    "uhhh",
    "like",
    "you know",
    "basically",
    "literally",
    "actually"
];

const WORD_STORAGE_KEY = "speechTrackerWords";
const SPEECH_STORAGE_KEY = "speechTrackerSavedSpeeches";
const THEME_STORAGE_KEY = "speechTrackerTheme";


/* =========================================================
   STATE
   ========================================================= */

let trackedWords = loadTrackedWords();
let savedSpeeches = loadSavedSpeeches();

let recognition = null;
let recognitionAvailable = false;

let isListening = false;
let isStopping = false;

let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];

let liveTranscript = "";
let finalTranscript = "";

let currentSpeechStartedAt = null;
let speechTimerInterval = null;

let notificationEnabled = false;

let currentAnalysisData = null;


/*
   This keeps track of filler detections that have already
   been notified.

   The important part is that this is based on the actual
   recognition text rather than repeatedly scanning the
   entire transcript and notifying for the same word.
*/
let notifiedDetectionKeys = new Set();

let lastLiveText = "";


/* =========================================================
   DOM
   ========================================================= */

const statusDot =
    document.getElementById("statusDot");

const statusText =
    document.getElementById("status");

const heardElement =
    document.getElementById("heard");

const listenButton =
    document.getElementById("listenButton");

const stopButton =
    document.getElementById("stopButton");

const fillerCountElement =
    document.getElementById("fillerCount");

const wordCountElement =
    document.getElementById("wordCount");

const speechTimeElement =
    document.getElementById("speechTime");

const finalTranscriptElement =
    document.getElementById("finalTranscript");

const customWordInput =
    document.getElementById("customWordInput");

const addWordButton =
    document.getElementById("addWordButton");

const wordList =
    document.getElementById("wordList");

const resetWordsButton =
    document.getElementById("resetWordsButton");

const enableNotificationsButton =
    document.getElementById("enableNotifications");

const notificationStatus =
    document.getElementById("notificationStatus");

const analyzeButton =
    document.getElementById("analyzeButton");

const analysisLoading =
    document.getElementById("analysisLoading");

const analysisElement =
    document.getElementById("analysis");

const savedSpeechesElement =
    document.getElementById("savedSpeeches");

const savedSpeechCountElement =
    document.getElementById("savedSpeechCount");

const savePrompt =
    document.getElementById("savePrompt");

const saveSpeechButton =
    document.getElementById("saveSpeechButton");

const discardSpeechButton =
    document.getElementById("discardSpeechButton");

const speechNameArea =
    document.getElementById("speechNameArea");

const speechNameInput =
    document.getElementById("speechNameInput");

const confirmSaveButton =
    document.getElementById("confirmSaveButton");

const themeToggle =
    document.getElementById("themeToggle");

const themeIcon =
    document.getElementById("themeIcon");

const themeText =
    document.getElementById("themeText");

const scrollIndicator =
    document.getElementById("scrollIndicator");


/* =========================================================
   INITIALIZATION
   ========================================================= */

initialize();


function initialize() {

    renderTrackedWords();

    renderSavedSpeeches();

    initializeTheme();

    initializeNotifications();

    initializeSpeechRecognition();

    updateStats();

    renderEmptyAnalysis();

    updateAnalyzeButton();

    updateScrollIndicator();

    window.addEventListener(
        "scroll",
        updateScrollIndicator,
        { passive: true }
    );
}


/* =========================================================
   STORAGE
   ========================================================= */

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
            return stored;
        }

    } catch (error) {
        console.warn(
            "Could not load tracked words:",
            error
        );
    }

    return [...DEFAULT_WORDS];
}


function saveTrackedWords() {

    localStorage.setItem(
        WORD_STORAGE_KEY,
        JSON.stringify(trackedWords)
    );
}


function loadSavedSpeeches() {

    try {

        const stored =
            JSON.parse(
                localStorage.getItem(
                    SPEECH_STORAGE_KEY
                )
            );

        if (Array.isArray(stored)) {
            return stored;
        }

    } catch (error) {

        console.warn(
            "Could not load saved speeches:",
            error
        );

    }

    return [];
}


function saveSavedSpeeches() {

    localStorage.setItem(
        SPEECH_STORAGE_KEY,
        JSON.stringify(savedSpeeches)
    );
}


/* =========================================================
   THEME
   ========================================================= */

function initializeTheme() {

    let theme =
        localStorage.getItem(
            THEME_STORAGE_KEY
        );

    if (
        theme !== "light" &&
        theme !== "dark"
    ) {
        theme = "light";
    }

    applyTheme(theme);
}


function applyTheme(theme) {

    document.documentElement.dataset.theme =
        theme;

    localStorage.setItem(
        THEME_STORAGE_KEY,
        theme
    );

    if (theme === "dark") {

        themeIcon.textContent = "☾";
        themeText.textContent = "Dark";

        document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute(
                "content",
                "#09090b"
            );

    } else {

        themeIcon.textContent = "☀";
        themeText.textContent = "Light";

        document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute(
                "content",
                "#ffffff"
            );
    }
}


themeToggle.addEventListener(
    "click",
    () => {

        const current =
            document.documentElement
                .dataset
                .theme || "light";

        applyTheme(
            current === "dark"
                ? "light"
                : "dark"
        );
    }
);


/* =========================================================
   SPEECH RECOGNITION
   ========================================================= */

function initializeSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        recognitionAvailable = false;

        setStatus(
            "Live detection unavailable",
            "error"
        );

        return;
    }

    recognitionAvailable = true;

    recognition =
        new SpeechRecognition();

    /*
       Continuous recognition prevents the browser from
       waiting for a complete speech session.
    */
    recognition.continuous = true;

    /*
       Interim results are essential here.

       Without interimResults=true, the browser waits until
       a phrase has been completed before returning text.
    */
    recognition.interimResults = true;

    recognition.lang = "en-US";

    /*
       A low confidence threshold lets us react to words such
       as "uh", "umm", "uhhh" before the browser rewrites them.
    */
    recognition.maxAlternatives = 3;


    recognition.onstart = () => {

        if (!isListening) {
            return;
        }

        setStatus(
            "Listening",
            "listening"
        );
    };


    recognition.onresult =
        handleRecognitionResult;


    recognition.onerror =
        handleRecognitionError;


    recognition.onend = () => {

        /*
           Chrome can occasionally stop SpeechRecognition
           automatically. Restart it while the user is still
           speaking.
        */
        if (
            isListening &&
            !isStopping
        ) {

            try {

                recognition.start();

            } catch (error) {

                console.warn(
                    "Recognition restart failed:",
                    error
                );

            }
        }
    };
}


/* =========================================================
   LIVE RECOGNITION
   ========================================================= */

function handleRecognitionResult(event) {

    let interim = "";
    let completed = "";

    for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
    ) {

        const result =
            event.results[i];

        const text =
            result[0]?.transcript || "";

        if (result.isFinal) {
            completed += text + " ";
        } else {
            interim += text;
        }
    }


    /*
       Add completed recognition results to our transcript.
    */
    if (completed.trim()) {

        liveTranscript =
            `${liveTranscript} ${completed}`
                .replace(/\s+/g, " ")
                .trim();
    }


    /*
       The interim transcript is what makes filler detection
       happen before the final transcript exists.
    */
    const displayTranscript =
        `${liveTranscript} ${interim}`
            .replace(/\s+/g, " ")
            .trim();


    /*
       Only scan newly changed text.
    */
    if (
        displayTranscript &&
        displayTranscript !== lastLiveText
    ) {

        detectLiveFillers(
            displayTranscript
        );

        lastLiveText =
            displayTranscript;
    }


    renderTranscript(
        heardElement,
        displayTranscript,
        true
    );

    updateStats(
        displayTranscript
    );
}


/* =========================================================
   LIVE FILLER DETECTION
   ========================================================= */

function detectLiveFillers(text) {

    if (!text) {
        return;
    }


    const normalized =
        normalizeSpeechText(text);


    for (
        const word of trackedWords
    ) {

        const normalizedWord =
            normalizeSpeechText(word);

        if (!normalizedWord) {
            continue;
        }


        /*
           Find every occurrence.

           Word boundaries are used for single words so
           "uh" doesn't accidentally match part of another word.
        */
        const escaped =
            escapeRegex(normalizedWord);

        const pattern =
            normalizedWord.includes(" ")
                ? new RegExp(
                    `(?:^|\\s)${escaped}(?=\\s|$)`,
                    "gi"
                )
                : new RegExp(
                    `\\b${escaped}\\b`,
                    "gi"
                );


        const matches =
            normalized.match(pattern);

        if (!matches) {
            continue;
        }


        /*
           Count all current occurrences so the stat updates
           immediately.
        */
    }


    /*
       Detection is performed against the most recent
       recognition window.

       This avoids repeatedly notifying for the same old
       filler word on every interim result.
    */
    const recentText =
        getRecentRecognitionWindow(text);

    const recentNormalized =
        normalizeSpeechText(recentText);


    for (
        const word of trackedWords
    ) {

        const normalizedWord =
            normalizeSpeechText(word);

        if (!normalizedWord) {
            continue;
        }

        const escaped =
            escapeRegex(normalizedWord);

        const regex =
            normalizedWord.includes(" ")
                ? new RegExp(
                    `(?:^|\\s)${escaped}(?=\\s|$)`,
                    "gi"
                )
                : new RegExp(
                    `\\b${escaped}\\b`,
                    "gi"
                );


        let match;

        while (
            (match = regex.exec(recentNormalized))
            !== null
        ) {

            const key =
                `${normalizedWord}:${recentNormalized.slice(
                    Math.max(
                        0,
                        match.index - 20
                    ),
                    match.index + normalizedWord.length + 20
                )}`;


            if (
                notifiedDetectionKeys.has(key)
            ) {
                continue;
            }


            notifiedDetectionKeys.add(key);

            triggerFillerAlert(
                word
            );
        }
    }
}


/*
   We only examine the last few words of the changing
   recognition result.

   This is what prevents a single "um" near the beginning
   of a long speech from generating a notification every
   time the browser sends another interim result.
*/
function getRecentRecognitionWindow(text) {

    const words =
        text
            .trim()
            .split(/\s+/);

    return words
        .slice(-12)
        .join(" ");
}


/* =========================================================
   FILLER ALERT
   ========================================================= */

function triggerFillerAlert(word) {

    /*
       Update the visible counter immediately.
    */
    updateStats(
        `${liveTranscript} ${lastLiveText}`
    );


    /*
       Browser vibration.
    */
    if (
        "vibrate" in navigator
    ) {

        try {

            navigator.vibrate(
                [80, 40, 80]
            );

        } catch (error) {
            console.warn(
                "Vibration failed:",
                error
            );
        }
    }


    /*
       Browser notification.

       This is fired directly from the live recognition
       result instead of waiting for final transcription.
    */
    if (
        notificationEnabled &&
        "Notification" in window &&
        Notification.permission === "granted"
    ) {

        try {

            new Notification(
                "Speech Tracker",
                {
                    body:
                        `You said "${word}"`,
                    tag:
                        `filler-${Date.now()}`
                }
            );

        } catch (error) {

            console.warn(
                "Notification failed:",
                error
            );

        }
    }


    /*
       Small visual flash on the status area.
    */
    flashStatus();
}


function flashStatus() {

    if (!statusText) {
        return;
    }

    const oldText =
        statusText.textContent;

    statusText.textContent =
        "Filler detected";

    setTimeout(() => {

        if (isListening) {

            statusText.textContent =
                "Listening";

        } else {

            statusText.textContent =
                oldText;

        }

    }, 500);
}


/* =========================================================
   NORMALIZATION
   ========================================================= */

function normalizeSpeechText(text) {

    return String(text || "")
        .toLowerCase()

        /*
           Normalize common punctuation.
        */
        .replace(/[.,!?;:()[\]{}"'“”‘’]/g, " ")

        /*
           Normalize elongated filler spellings.

           uhhhh -> uhh
           uhhhhh -> uhhh
           ummmm -> umm
        */
        .replace(/\buh{2,}\b/gi, match => {
            return match
                .toLowerCase()
                .replace(/h{3,}/, "hh");
        })

        .replace(/\bum{3,}\b/gi, match => {
            return match
                .toLowerCase()
                .replace(/m{3,}/, "mm");
        })

        .replace(/\s+/g, " ")

        .trim();
}


function escapeRegex(text) {

    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}


/* =========================================================
   START LISTENING
   ========================================================= */

listenButton.addEventListener(
    "click",
    startListening
);


async function startListening() {

    if (isListening) {
        return;
    }


    if (!recognitionAvailable) {

        alert(
            "Live speech recognition is not supported in this browser. Try Chrome or Edge."
        );

        return;
    }


    /*
       Reset current session.
    */
    liveTranscript = "";
    finalTranscript = "";

    lastLiveText = "";

    notifiedDetectionKeys =
        new Set();

    currentAnalysisData = null;


    clearAnalysis();

    finalTranscriptElement.innerHTML =
        "Your completed transcription will appear here after you stop.";


    renderTranscript(
        heardElement,
        "",
        true
    );


    fillerCountElement.textContent =
        "0";

    wordCountElement.textContent =
        "0";


    currentSpeechStartedAt =
        Date.now();

    startSpeechTimer();


    isListening = true;
    isStopping = false;


    listenButton.disabled = true;
    stopButton.disabled = false;

    analyzeButton.disabled = true;


    setStatus(
        "Listening",
        "listening"
    );


    try {

        recognition.start();

    } catch (error) {

        /*
           If recognition was already running, don't crash.
        */
        console.warn(
            "Recognition start:",
            error
        );
    }
}


/* =========================================================
   STOP
   ========================================================= */

stopButton.addEventListener(
    "click",
    stopListening
);


async function stopListening() {

    if (
        !isListening ||
        isStopping
    ) {
        return;
    }


    isStopping = true;
    isListening = false;


    stopSpeechTimer();


    listenButton.disabled = false;
    stopButton.disabled = true;


    setStatus(
        "Finishing...",
        "ready"
    );


    try {

        recognition.stop();

    } catch (error) {

        console.warn(
            "Recognition stop:",
            error
        );
    }


    /*
       Give the recognition API a moment to deliver its
       final result before sending the audio for transcription.
    */
    await new Promise(
        resolve => setTimeout(
            resolve,
            250
        )
    );


    const speechToTranscribe =
        liveTranscript.trim();


    if (!speechToTranscribe) {

        setStatus(
            "No speech detected",
            "error"
        );

        isStopping = false;

        return;
    }


    /*
       Use the live browser transcript immediately.
       This prevents the app from appearing empty while
       /api/transcribe is processing.
    */
    finalTranscript =
        speechToTranscribe;


    renderTranscript(
        finalTranscriptElement,
        finalTranscript,
        true
    );


    updateStats(
        finalTranscript
    );


    updateAnalyzeButton();


    /*
       Show the save prompt immediately.
    */
    showSavePrompt();


    /*
       Try the server transcription as a second pass.
       If it fails, we keep the live transcript rather
       than wiping it out.
    */
    try {

        const serverTranscript =
            await requestFinalTranscription();

        if (
            serverTranscript &&
            serverTranscript.trim()
        ) {

            finalTranscript =
                serverTranscript.trim();

            renderTranscript(
                finalTranscriptElement,
                finalTranscript,
                true
            );

            updateStats(
                finalTranscript
            );

            updateAnalyzeButton();
        }

    } catch (error) {

        console.warn(
            "Final transcription unavailable. Using live transcript.",
            error
        );
    }


    setStatus(
        "Speech complete",
        "ready"
    );


    isStopping = false;
}


/* =========================================================
   SERVER TRANSCRIPTION
   ========================================================= */

async function requestFinalTranscription() {

    /*
       This endpoint is the existing /api/transcribe route.

       We intentionally do not make the entire UI depend on it.
       Live transcription already exists in the browser.
    */

    if (
        !audioChunks.length
    ) {
        return finalTranscript;
    }


    const blob =
        new Blob(
            audioChunks,
            {
                type:
                    mediaRecorder?.mimeType ||
                    "audio/webm"
            }
        );


    if (!blob.size) {
        return finalTranscript;
    }


    const formData =
        new FormData();

    formData.append(
        "file",
        blob,
        "speech.webm"
    );


    const response =
        await fetch(
            "/api/transcribe",
            {
                method: "POST",
                body: formData
            }
        );


    if (!response.ok) {

        throw new Error(
            `Transcription request failed: ${response.status}`
        );
    }


    const data =
        await response.json();


    return extractTranscript(
        data
    );
}


function extractTranscript(data) {

    if (!data) {
        return "";
    }


    if (
        typeof data === "string"
    ) {
        return data;
    }


    const possibleFields = [
        data.transcript,
        data.text,
        data.transcription,
        data?.result?.text,
        data?.data?.text
    ];


    for (
        const value of possibleFields
    ) {

        if (
            typeof value === "string" &&
            value.trim()
        ) {
            return value;
        }
    }


    return "";
}


/* =========================================================
   MEDIA RECORDER
   ========================================================= */

async function initializeMediaRecorder() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        return false;
    }


    try {

        mediaStream =
            await navigator.mediaDevices.getUserMedia(
                {
                    audio: true
                }
            );


        let mimeType = "";

        const possibleTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4",
            "audio/ogg"
        ];


        for (
            const type of possibleTypes
        ) {

            if (
                MediaRecorder.isTypeSupported &&
                MediaRecorder.isTypeSupported(type)
            ) {

                mimeType = type;
                break;
            }
        }


        mediaRecorder =
            new MediaRecorder(
                mediaStream,
                mimeType
                    ? { mimeType }
                    : undefined
            );


        audioChunks = [];


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

                if (mediaStream) {

                    mediaStream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );
                }
            };


        mediaRecorder.start(
            250
        );


        return true;

    } catch (error) {

        console.warn(
            "Microphone recorder unavailable:",
            error
        );

        return false;
    }
}


/*
   Ask for the microphone at the same time as starting
   recognition, but don't make live recognition wait on
   the final transcription system.
*/
const originalStartListening =
    startListening;


/* =========================================================
   TIMER
   ========================================================= */

function startSpeechTimer() {

    stopSpeechTimer();

    speechTimerInterval =
        setInterval(
            updateSpeechTimer,
            500
        );

    updateSpeechTimer();
}


function stopSpeechTimer() {

    if (
        speechTimerInterval
    ) {

        clearInterval(
            speechTimerInterval
        );

        speechTimerInterval =
            null;
    }
}


function updateSpeechTimer() {

    if (
        !currentSpeechStartedAt
    ) {
        return;
    }


    const elapsed =
        Date.now() -
        currentSpeechStartedAt;


    const totalSeconds =
        Math.floor(
            elapsed / 1000
        );


    const minutes =
        Math.floor(
            totalSeconds / 60
        );

    const seconds =
        totalSeconds % 60;


    speechTimeElement.textContent =
        `${minutes}:${String(seconds).padStart(2, "0")}`;
}


/* =========================================================
   STATS
   ========================================================= */

function updateStats(text = null) {

    const source =
        text !== null
            ? text
            : finalTranscript || liveTranscript;


    const words =
        getWordCount(source);


    const fillers =
        countTrackedWords(source);


    wordCountElement.textContent =
        String(words);

    fillerCountElement.textContent =
        String(fillers);
}


function getWordCount(text) {

    if (!text || !text.trim()) {
        return 0;
    }

    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}


function countTrackedWords(text) {

    if (!text) {
        return 0;
    }


    const normalized =
        normalizeSpeechText(text);


    let total = 0;


    for (
        const word of trackedWords
    ) {

        const normalizedWord =
            normalizeSpeechText(word);

        if (!normalizedWord) {
            continue;
        }


        const escaped =
            escapeRegex(normalizedWord);


        const regex =
            normalizedWord.includes(" ")
                ? new RegExp(
                    `(?:^|\\s)${escaped}(?=\\s|$)`,
                    "gi"
                )
                : new RegExp(
                    `\\b${escaped}\\b`,
                    "gi"
                );


        const matches =
            normalized.match(regex);


        if (matches) {
            total += matches.length;
        }
    }


    return total;
}


/* =========================================================
   TRANSCRIPT RENDERING
   ========================================================= */

function renderTranscript(
    element,
    text,
    highlightFillers
) {

    if (!element) {
        return;
    }


    if (!text || !text.trim()) {

        element.innerHTML =
            `<span class="transcript-placeholder">
                Your live transcription will appear here.
            </span>`;

        return;
    }


    let safeText =
        escapeHtml(text);


    if (highlightFillers) {

        safeText =
            highlightTrackedWords(
                safeText
            );
    }


    element.innerHTML =
        safeText;
}


function highlightTrackedWords(text) {

    const sorted =
        [...trackedWords]
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    for (
        const word of sorted
    ) {

        const escapedWord =
            escapeRegex(
                escapeHtml(word)
            );


        if (!escapedWord) {
            continue;
        }


        const pattern =
            word.includes(" ")
                ? new RegExp(
                    `(?<![\\w])${escapedWord}(?![\\w])`,
                    "gi"
                )
                : new RegExp(
                    `(?<![\\w])${escapedWord}(?![\\w])`,
                    "gi"
                );


        text =
            text.replace(
                pattern,
                match =>
                    `<span class="filler-highlight">${match}</span>`
            );
    }


    return text;
}


function escapeHtml(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   WORD LIST
   ========================================================= */

function renderTrackedWords() {

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

            remove.className =
                "word-tag-remove";

            remove.type =
                "button";

            remove.textContent =
                "×";

            remove.title =
                `Remove ${word}`;


            remove.addEventListener(
                "click",
                () => {

                    trackedWords.splice(
                        index,
                        1
                    );

                    saveTrackedWords();

                    renderTrackedWords();

                    updateStats();
                }
            );


            tag.appendChild(text);
            tag.appendChild(remove);

            wordList.appendChild(tag);
        }
    );
}


/* =========================================================
   ADD WORD
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


function addTrackedWord() {

    const word =
        customWordInput.value
            .trim()
            .toLowerCase();


    if (!word) {
        return;
    }


    if (
        trackedWords.some(
            existing =>
                normalizeSpeechText(existing) ===
                normalizeSpeechText(word)
        )
    ) {

        customWordInput.select();

        return;
    }


    trackedWords.push(word);

    saveTrackedWords();

    renderTrackedWords();

    customWordInput.value = "";

    updateStats();
}


/* =========================================================
   RESET WORDS
   ========================================================= */

resetWordsButton.addEventListener(
    "click",
    () => {

        trackedWords =
            [...DEFAULT_WORDS];

        saveTrackedWords();

        renderTrackedWords();

        updateStats();
    }
);


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

function initializeNotifications() {

    if (
        !("Notification" in window)
    ) {

        notificationStatus.textContent =
            "This browser does not support notifications.";

        enableNotificationsButton.disabled =
            true;

        return;
    }


    if (
        Notification.permission === "granted"
    ) {

        notificationEnabled = true;

        enableNotificationsButton.textContent =
            "Notifications Enabled";

        notificationStatus.textContent =
            "Notifications are enabled.";

    } else if (
        Notification.permission === "denied"
    ) {

        notificationStatus.textContent =
            "Notifications are blocked in browser settings.";

    }
}


enableNotificationsButton.addEventListener(
    "click",
    async () => {

        if (
            !("Notification" in window)
        ) {
            return;
        }


        try {

            const permission =
                await Notification.requestPermission();


            if (
                permission === "granted"
            ) {

                notificationEnabled =
                    true;

                enableNotificationsButton.textContent =
                    "Notifications Enabled";

                notificationStatus.textContent =
                    "Notifications are enabled.";

            } else {

                notificationEnabled =
                    false;

                notificationStatus.textContent =
                    "Notifications were not enabled.";
            }

        } catch (error) {

            console.error(
                "Notification permission error:",
                error
            );

        }
    }
);


/* =========================================================
   ANALYSIS BUTTON
   ========================================================= */

function updateAnalyzeButton() {

    /*
       IMPORTANT:

       The analyze button is ONLY enabled after a completed
       speech exists.

       This fixes the previous bug where the button/loading
       state could appear before the speech started.
    */
    analyzeButton.disabled =
        !finalTranscript ||
        !finalTranscript.trim();
}


analyzeButton.addEventListener(
    "click",
    analyzeSpeech
);


async function analyzeSpeech() {

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {

        alert(
            "Finish a speech before analyzing it."
        );

        return;
    }


    analyzeButton.disabled = true;

    analysisLoading.hidden = false;

    analysisElement.innerHTML = "";


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


        const rawText =
            await response.text();


        if (!response.ok) {

            let errorMessage =
                "AI analysis failed.";

            try {

                const errorData =
                    JSON.parse(rawText);

                errorMessage =
                    errorData.error ||
                    errorData.details ||
                    errorMessage;

            } catch {
                if (rawText) {
                    errorMessage =
                        rawText;
                }
            }


            throw new Error(
                errorMessage
            );
        }


        let data;

        try {

            data =
                JSON.parse(rawText);

        } catch (error) {

            throw new Error(
                "The analysis server returned invalid JSON."
            );
        }


        /*
           Your API returns:

           {
             analysis: "...",
             analysisData: {...}
           }

           Prefer analysisData because it preserves the
           structured sections.
        */
        let analysisData =
            data.analysisData;


        /*
           Handle APIs that return the structured object
           directly as analysis.
        */
        if (
            !analysisData &&
            data.analysis &&
            typeof data.analysis === "object"
        ) {

            analysisData =
                data.analysis;
        }


        /*
           If the API only returned a formatted string,
           show it safely instead of displaying
           "[object Object]".
        */
        if (
            !analysisData &&
            typeof data.analysis === "string"
        ) {

            renderPlainAnalysis(
                data.analysis
            );

            return;
        }


        if (
            !analysisData ||
            typeof analysisData !== "object"
        ) {

            throw new Error(
                "The AI returned an empty analysis."
            );
        }


        currentAnalysisData =
            analysisData;


        renderAnalysis(
            analysisData
        );


    } catch (error) {

        console.error(
            "Analysis error:",
            error
        );


        analysisElement.innerHTML = `
            <div class="analysis-section">
                <div class="analysis-section-title">
                    Analysis Error
                </div>

                <div class="analysis-section-text">
                    ${escapeHtml(
                        error?.message ||
                        "Unable to analyze this speech."
                    )}
                </div>
            </div>
        `;

    } finally {

        analysisLoading.hidden = true;

        updateAnalyzeButton();
    }
}


/* =========================================================
   STRUCTURED AI RENDERING
   ========================================================= */

function renderAnalysis(data) {

    analysisElement.innerHTML = "";


    const sections = [
        {
            key: "overall",
            title: "Overall Assessment"
        },

        {
            key: "speechSections",
            title: "Speech Breakdown"
        },

        {
            key: "fillerWords",
            title: "Filler Words"
        },

        {
            key: "clarity",
            title: "Clarity & Wording"
        },

        {
            key: "strength",
            title: "What You Did Well"
        },

        {
            key: "improvement",
            title: "Most Important Improvement"
        },

        {
            key: "tip",
            title: "Practical Tip"
        }
    ];


    let renderedAny =
        false;


    for (
        const section of sections
    ) {

        const value =
            data[section.key];


        if (
            value === undefined ||
            value === null
        ) {
            continue;
        }


        if (
            typeof value === "string" &&
            !value.trim()
        ) {
            continue;
        }


        const sectionElement =
            document.createElement(
                "div"
            );

        sectionElement.className =
            "analysis-section";


        const title =
            document.createElement(
                "div"
            );

        title.className =
            "analysis-section-title";

        title.textContent =
            section.title;


        const content =
            document.createElement(
                "div"
            );

        content.className =
            "analysis-section-text";


        content.innerHTML =
            formatAnalysisValue(
                value
            );


        sectionElement.appendChild(
            title
        );

        sectionElement.appendChild(
            content
        );

        analysisElement.appendChild(
            sectionElement
        );


        renderedAny = true;
    }


    /*
       Render additional structured fields that may be added
       by a newer analyze.js without breaking this frontend.
    */
    for (
        const [key, value]
        of Object.entries(data)
    ) {

        if (
            sections.some(
                section =>
                    section.key === key
            )
        ) {
            continue;
        }


        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            continue;
        }


        const sectionElement =
            document.createElement(
                "div"
            );

        sectionElement.className =
            "analysis-section";


        const title =
            document.createElement(
                "div"
            );

        title.className =
            "analysis-section-title";

        title.textContent =
            prettifyKey(key);


        const content =
            document.createElement(
                "div"
            );

        content.className =
            "analysis-section-text";

        content.innerHTML =
            formatAnalysisValue(
                value
            );


        sectionElement.appendChild(
            title
        );

        sectionElement.appendChild(
            content
        );

        analysisElement.appendChild(
            sectionElement
        );


        renderedAny = true;
    }


    if (!renderedAny) {

        renderEmptyAnalysis();
    }
}


/* =========================================================
   ANALYSIS VALUE FORMATTER
   ========================================================= */

function formatAnalysisValue(value) {

    /*
       String
    */
    if (
        typeof value === "string"
    ) {

        return formatAnalysisText(
            value
        );
    }


    /*
       Array

       This fixes [object Object] for arrays of structured
       speech sections, tips, observations, etc.
    */
    if (
        Array.isArray(value)
    ) {

        return `
            <div style="
                display:flex;
                flex-direction:column;
                gap:12px;
            ">
                ${value
                    .map(
                        item =>
                            `<div>
                                ${formatAnalysisValue(item)}
                            </div>`
                    )
                    .join("")
                }
            </div>
        `;
    }


    /*
       Object

       This is the other important fix for the previous
       "[object Object]" problem.
    */
    if (
        typeof value === "object"
    ) {

        return `
            <div style="
                display:flex;
                flex-direction:column;
                gap:10px;
            ">
                ${Object.entries(value)
                    .map(
                        ([key, item]) =>
                            `
                            <div>
                                <strong>
                                    ${escapeHtml(
                                        prettifyKey(key)
                                    )}
                                </strong>

                                <div style="
                                    margin-top:3px;
                                ">
                                    ${formatAnalysisValue(item)}
                                </div>
                            </div>
                            `
                    )
                    .join("")
                }
            </div>
        `;
    }


    return escapeHtml(
        String(value)
    );
}


function formatAnalysisText(text) {

    const escaped =
        escapeHtml(text);


    /*
       Preserve paragraph spacing.
    */
    return escaped
        .split(/\n\s*\n/)
        .map(
            paragraph =>
                `<p style="
                    margin:0 0 12px;
                ">
                    ${paragraph
                        .replace(
                            /\n/g,
                            "<br>"
                        )}
                </p>`
        )
        .join("");
}


function prettifyKey(key) {

    return String(key)
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, char =>
            char.toUpperCase()
        )
        .trim();
}


function renderPlainAnalysis(text) {

    analysisElement.innerHTML = `
        <div class="analysis-section">
            <div class="analysis-section-title">
                AI Feedback
            </div>

            <div class="analysis-section-text">
                ${formatAnalysisText(text)}
            </div>
        </div>
    `;
}


function renderEmptyAnalysis() {

    analysisElement.innerHTML = `
        <div class="analysis-empty">
            Finish a speech, then analyze it to see
            detailed AI feedback.
        </div>
    `;
}


function clearAnalysis() {

    currentAnalysisData = null;

    renderEmptyAnalysis();
}


/* =========================================================
   SAVE SPEECH
   ========================================================= */

function showSavePrompt() {

    savePrompt.hidden = false;

    speechNameArea.hidden = true;

    speechNameInput.value = "";

    /*
       Focus is deliberately not forced here so the user can
       immediately interact with the page.
    */
}


function hideSavePrompt() {

    savePrompt.hidden = true;

    speechNameArea.hidden = true;
}


saveSpeechButton.addEventListener(
    "click",
    () => {

        savePrompt.hidden = true;

        speechNameArea.hidden = false;

        speechNameInput.focus();
    }
);


discardSpeechButton.addEventListener(
    "click",
    () => {

        hideSavePrompt();
    }
);


confirmSaveButton.addEventListener(
    "click",
    saveCurrentSpeech
);


speechNameInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();

            saveCurrentSpeech();
        }
    }
);


function saveCurrentSpeech() {

    const transcript =
        finalTranscript.trim();


    if (!transcript) {

        hideSavePrompt();

        return;
    }


    let name =
        speechNameInput.value.trim();


    if (!name) {

        name =
            `Speech ${savedSpeeches.length + 1}`;
    }


    /*
       IMPORTANT:

       Make a completely independent object containing the
       actual transcript and analysis.

       This prevents saved speeches from pointing to the
       current speech state.
    */
    const speech = {

        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`,

        name,

        date:
            new Date().toISOString(),

        transcript,

        fillerCount:
            countTrackedWords(transcript),

        wordCount:
            getWordCount(transcript),

        duration:
            speechTimeElement.textContent,

        analysis:
            currentAnalysisData
                ? deepClone(currentAnalysisData)
                : null
    };


    savedSpeeches.unshift(
        speech
    );


    saveSavedSpeeches();

    renderSavedSpeeches();

    hideSavePrompt();
}


/* =========================================================
   SAVED SPEECHES RENDERING
   ========================================================= */

function renderSavedSpeeches() {

    savedSpeechesElement.innerHTML = "";

    savedSpeechCountElement.textContent =
        String(savedSpeeches.length);


    if (
        savedSpeeches.length === 0
    ) {

        savedSpeechesElement.innerHTML = `
            <div class="empty-history">
                No saved speeches yet.
            </div>
        `;

        return;
    }


    savedSpeeches.forEach(
        speech => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "saved-speech";


            const main =
                document.createElement(
                    "div"
                );

            main.className =
                "saved-speech-main";


            const name =
                document.createElement(
                    "div"
                );

            name.className =
                "saved-speech-name";

            name.textContent =
                speech.name;


            const date =
                document.createElement(
                    "div"
                );

            date.className =
                "saved-speech-date";

            date.textContent =
                formatDate(
                    speech.date
                );


            main.appendChild(name);
            main.appendChild(date);


            const actions =
                document.createElement(
                    "div"
                );

            actions.className =
                "saved-speech-actions";


            const openButton =
                document.createElement(
                    "button"
                );

            openButton.type =
                "button";

            openButton.className =
                "saved-speech-open";

            openButton.textContent =
                "Open";


            /*
               Closure captures THIS speech object.

               This fixes the bug where opening an older speech
               accidentally displayed the current speech.
            */
            openButton.addEventListener(
                "click",
                () => {

                    openSavedSpeech(
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
                "saved-speech-delete";

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
                openButton
            );

            actions.appendChild(
                deleteButton
            );


            item.appendChild(main);
            item.appendChild(actions);

            savedSpeechesElement.appendChild(
                item
            );
        }
    );
}


/* =========================================================
   OPEN SAVED SPEECH
   ========================================================= */

function openSavedSpeech(id) {

    const speech =
        savedSpeeches.find(
            item =>
                item.id === id
        );


    if (!speech) {
        return;
    }


    /*
       Copy the saved data into the current view.

       It does NOT replace the saved object.
    */
    finalTranscript =
        speech.transcript || "";


    currentAnalysisData =
        speech.analysis
            ? deepClone(
                speech.analysis
            )
            : null;


    renderTranscript(
        finalTranscriptElement,
        finalTranscript,
        true
    );


    updateStats(
        finalTranscript
    );


    if (
        currentAnalysisData
    ) {

        renderAnalysis(
            currentAnalysisData
        );

    } else {

        renderEmptyAnalysis();
    }


    updateAnalyzeButton();


    /*
       Scroll to the transcript so the user can immediately
       see the speech they selected.
    */
    finalTranscriptElement.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });


    setStatus(
        `Viewing "${speech.name}"`,
        "ready"
    );
}


/* =========================================================
   DELETE SAVED SPEECH
   ========================================================= */

function deleteSavedSpeech(id) {

    const speech =
        savedSpeeches.find(
            item =>
                item.id === id
        );


    if (!speech) {
        return;
    }


    const confirmed =
        confirm(
            `Delete "${speech.name}"?`
        );


    if (!confirmed) {
        return;
    }


    savedSpeeches =
        savedSpeeches.filter(
            item =>
                item.id !== id
        );


    saveSavedSpeeches();

    renderSavedSpeeches();
}


/* =========================================================
   DATE
   ========================================================= */

function formatDate(dateString) {

    const date =
        new Date(dateString);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "Unknown date";
    }


    return date.toLocaleString(
        undefined,
        {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    );
}


/* =========================================================
   DEEP CLONE
   ========================================================= */

function deepClone(value) {

    try {

        return JSON.parse(
            JSON.stringify(value)
        );

    } catch {

        return value;
    }
}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(
    message,
    state = "ready"
) {

    statusText.textContent =
        message;


    statusDot.className =
        "status-dot";


    if (
        state === "listening"
    ) {

        statusDot.classList.add(
            "listening"
        );

    } else if (
        state === "error"
    ) {

        statusDot.classList.add(
            "error"
        );
    }
}


/* =========================================================
   RECOGNITION ERRORS
   ========================================================= */

function handleRecognitionError(
    event
) {

    console.warn(
        "Speech recognition error:",
        event.error
    );


    /*
       Do not stop the entire application for transient
       recognition errors.
    */
    if (
        event.error === "no-speech"
    ) {

        return;
    }


    if (
        event.error === "aborted"
    ) {

        return;
    }


    if (
        event.error === "not-allowed"
    ) {

        setStatus(
            "Microphone permission denied",
            "error"
        );

        isListening = false;

        listenButton.disabled = false;
        stopButton.disabled = true;

        stopSpeechTimer();

        return;
    }


    if (
        isListening
    ) {

        setStatus(
            "Listening",
            "listening"
        );
    }
}


/* =========================================================
   SCROLL INDICATOR
   ========================================================= */

function updateScrollIndicator() {

    if (!scrollIndicator) {
        return;
    }


    const scrollPosition =
        window.scrollY +
        window.innerHeight;


    const pageHeight =
        document.documentElement.scrollHeight;


    /*
       Hide it when the user has reached the bottom.
    */
    if (
        scrollPosition >=
        pageHeight - 80
    ) {

        scrollIndicator.classList.add(
            "hidden"
        );

    } else {

        scrollIndicator.classList.remove(
            "hidden"
        );
    }
}


/* =========================================================
   CLEANUP
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        stopSpeechTimer();

        if (mediaStream) {

            mediaStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }
    }
);