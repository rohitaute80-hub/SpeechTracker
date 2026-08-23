/* =========================================================
   SPEECH TRACKER
   COMPLETE REPLACEMENT SCRIPT
   ========================================================= */


/* =========================================================
   ELEMENTS
   ========================================================= */

const $ = id => document.getElementById(id);

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
let recognitionRunning = false;

let isRecording = false;
let isStopping = false;

let recordingStartTime = null;
let timerInterval = null;

let liveTranscript = "";
let finalTranscript = "";

let currentAnalysis = null;
let currentSpeechId = null;

let currentSessionFillerCount = 0;
let currentSessionWordCount = 0;


/*
   Tracks actual filler occurrences.

   The old implementation used word indexes.
   That caused duplicate/missed notifications when
   interim speech changed.

   We now use a normalized transcript prefix.
*/

const firedFillerOccurrences = new Set();


/*
   Notification debounce.
*/

let lastNotificationTime = 0;


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
   NORMALIZE WORD
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
   FILLER REGEX
   ========================================================= */

function getFillerRegex() {

    const words =
        trackedWords
            .map(normalizeWord)
            .filter(Boolean)
            .sort(
                (a, b) =>
                    b.length - a.length
            );

    /*
       Unlimited UM / UH variants.

       Matches:

       um
       umm
       ummm
       ummmm

       uh
       uhh
       uhhh
       uhhhh
    */

    words.push(
        "um+",
        "uh+"
    );

    const unique =
        [...new Set(words)];

    if (!unique.length) {

        return /(?!)/gi;

    }

    return new RegExp(
        `\\b(${unique.map(escapeRegex).join("|")})\\b`,
        "gi"
    );

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

    let output = "";
    let lastIndex = 0;

    let match;

    while (
        (match = regex.exec(text)) !== null
    ) {

        output +=
            escapeHTML(
                text.slice(
                    lastIndex,
                    match.index
                )
            );

        output +=
            `<span class="filler-highlight">` +
            escapeHTML(match[0]) +
            `</span>`;

        lastIndex =
            regex.lastIndex;

    }

    output +=
        escapeHTML(
            text.slice(lastIndex)
        );

    return output;

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
   UPDATE STATS
   ========================================================= */

function updateStats(text) {

    currentSessionFillerCount =
        countFillers(text);

    currentSessionWordCount =
        countWords(text);

    fillerCountElement.textContent =
        currentSessionFillerCount;

    wordCountElement.textContent =
        currentSessionWordCount;

}


/* =========================================================
   RENDER LIVE TRANSCRIPT
   ========================================================= */

function renderLiveTranscript() {

    heard.innerHTML =
        highlightTranscript(
            liveTranscript
        );

    /*
       Do not overwrite the live filler count
       during interim recognition.

       The old code did this, which caused:

       filler detected
       -> count becomes 1
       -> render
       -> count recalculates
       -> count jumps back
    */

    const calculatedCount =
        countFillers(
            liveTranscript
        );

    currentSessionFillerCount =
        Math.max(
            currentSessionFillerCount,
            calculatedCount
        );

    currentSessionWordCount =
        countWords(
            liveTranscript
        );

    fillerCountElement.textContent =
        currentSessionFillerCount;

    wordCountElement.textContent =
        currentSessionWordCount;

}


/* =========================================================
   FINAL TRANSCRIPT
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
   WORD UI
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

            const label =
                document.createElement(
                    "span"
                );

            label.textContent =
                word;

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.textContent =
                "×";

            button.dataset.index =
                index;

            button.setAttribute(
                "aria-label",
                `Remove ${word}`
            );

            tag.appendChild(label);
            tag.appendChild(button);

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
   WORD EVENTS
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

        if (
            Number.isInteger(index) &&
            index >= 0 &&
            index < trackedWords.length
        ) {

            trackedWords.splice(
                index,
                1
            );

            saveTrackedWords();

            renderWordList();

        }

    }
);


addWordButton.addEventListener(
    "click",
    addTrackedWord
);


customWordInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            event.preventDefault();

            addTrackedWord();

        }

    }
);


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

        updateNotificationUI(
            permission
        );

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

    }

}


function updateNotificationUI(permission) {

    if (permission === "granted") {

        notificationStatus.textContent =
            "Notifications are enabled.";

        notificationStatus.classList.add(
            "enabled"
        );

        enableNotificationsButton.textContent =
            "Notifications Enabled";

        enableNotificationsButton.disabled =
            true;

    } else if (permission === "denied") {

        notificationStatus.textContent =
            "Notifications are blocked in browser settings.";

        notificationStatus.classList.remove(
            "enabled"
        );

    } else {

        notificationStatus.textContent =
            "Enable notifications for filler-word alerts.";

        notificationStatus.classList.remove(
            "enabled"
        );

    }

}


enableNotificationsButton.addEventListener(
    "click",
    enableNotifications
);


/* =========================================================
   FAST FILLER NOTIFICATION
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

    /*
       Extremely small debounce.

       We intentionally keep this tiny so alerts
       happen as close as possible to speech.
    */

    const now =
        performance.now();

    if (
        now - lastNotificationTime < 180
    ) {

        return;

    }

    lastNotificationTime =
        now;


    try {

        const notification =
            new Notification(
                "Filler word detected",
                {
                    body:
                        `You said "${word}"`,
                    tag:
                        `speech-tracker-${Date.now()}`,
                    renotify:
                        true,
                    requireInteraction:
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

        console.warn(
            "Notification failed:",
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

            /*
               Shorter vibration means the feedback
               feels immediate rather than delayed.
            */

            navigator.vibrate(
                45
            );

        }

    } catch (_) {}

}


/* =========================================================
   FILLER OCCURRENCE KEY
   ========================================================= */

function createOccurrenceKey(
    text,
    match
) {

    const before =
        text
            .slice(
                0,
                match.index
            )
            .trim();

    /*
       Use a normalized chunk before the filler.

       This is much more stable when interim results
       are updated.
    */

    const context =
        before
            .split(/\s+/)
            .slice(-8)
            .join(" ")
            .toLowerCase();

    return (
        `${context}|${fillerFamily(match[0])}`
    );

}


/* =========================================================
   DETECT LIVE FILLERS
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

        const key =
            createOccurrenceKey(
                text,
                match
            );

        if (
            firedFillerOccurrences.has(key)
        ) {

            continue;

        }

        firedFillerOccurrences.add(
            key
        );

        currentSessionFillerCount++;

        fillerCountElement.textContent =
            currentSessionFillerCount;

        /*
           Trigger feedback immediately.
        */

        vibrateForFiller();

        sendFillerNotification(
            match[0]
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

        recognitionRunning =
            true;

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

            recognitionRunning =
                false;

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

                return;

            }

            /*
               Ignore temporary network/interim errors.
            */

            if (
                isRecording &&
                recognitionShouldRun
            ) {

                statusText.textContent =
                    "Listening";

            }

        };


    recognition.onend = () => {

        recognitionRunning =
            false;

        /*
           Restart quickly when Chrome ends an
           otherwise healthy continuous session.
        */

        if (
            recognitionShouldRun &&
            isRecording
        ) {

            setTimeout(
                () => {

                    if (
                        recognitionShouldRun &&
                        isRecording &&
                        !recognitionRunning
                    ) {

                        try {

                            recognition.start();

                        } catch (_) {}

                    }

                },
                30
            );

        }

    };

}


/* =========================================================
   HANDLE RECOGNITION RESULT
   ========================================================= */

function handleRecognitionResult(event) {

    let interim = "";
    let finals = "";

    /*
       IMPORTANT:

       Only process the new results from this event
       instead of repeatedly rebuilding the entire
       transcript and firing duplicate alerts.
    */

    for (
        let i = 0;
        i < event.results.length;
        i++
    ) {

        const result =
            event.results[i];

        const transcript =
            result[0]?.transcript || "";

        if (result.isFinal) {

            finals +=
                transcript + " ";

        } else {

            interim +=
                transcript + " ";

        }

    }

    const cleanFinal =
        finals.trim();

    const cleanInterim =
        interim.trim();

    liveTranscript =
        [cleanFinal, cleanInterim]
            .filter(Boolean)
            .join(" ")
            .trim();

    renderLiveTranscript();

    /*
       Run detection immediately.
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

    } catch (_) {}

}


/* =========================================================
   STOP RECOGNITION
   ========================================================= */

function stopRecognition() {

    recognitionShouldRun =
        false;

    recognitionRunning =
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

    const options = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg"
    ];

    if (
        !window.MediaRecorder
    ) {

        return "";

    }

    for (
        const type of options
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

    if (isRecording) {
        return;
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        alert(
            "Your browser does not support microphone recording."
        );

        return;

    }

    try {

        activeStream =
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

        liveTranscript = "";
        finalTranscript = "";

        currentAnalysis = null;
        currentSpeechId = null;

        currentSessionFillerCount = 0;
        currentSessionWordCount = 0;

        firedFillerOccurrences.clear();

        lastNotificationTime = 0;


        heard.innerHTML =
            `<span class="empty-state">Listening...</span>`;

        finalTranscriptElement.textContent =
            "Your completed speech will appear here.";

        fillerCountElement.textContent =
            "0";

        wordCountElement.textContent =
            "0";

        analysisElement.innerHTML =
            "";

        savePrompt.hidden =
            true;


        const mimeType =
            getRecordingMimeType();


        mediaRecorder =
            mimeType
                ? new MediaRecorder(
                    activeStream,
                    { mimeType }
                )
                : new MediaRecorder(
                    activeStream
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


        mediaRecorder.onstop =
            () => {

                if (activeStream) {

                    activeStream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );

                    activeStream =
                        null;

                }

                finishRecording();

            };


        mediaRecorder.start(
            250
        );


        isRecording =
            true;

        isStopping =
            false;

        listenButton.disabled =
            true;

        stopButton.disabled =
            false;

        statusText.textContent =
            "Listening";

        statusDot.className =
            "status-dot listening";


        startTimer();

        startRecognition();

    } catch (error) {

        console.error(
            "Could not start recording:",
            error
        );

        if (activeStream) {

            activeStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            activeStream =
                null;

        }

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


    /*
       Keep the live transcript immediately.
    */

    finalTranscript =
        liveTranscript.trim();

    renderFinalTranscript();

    currentSessionWordCount =
        countWords(
            finalTranscript
        );

    /*
       Do NOT reset the filler count here.
    */

    fillerCountElement.textContent =
        currentSessionFillerCount;

    wordCountElement.textContent =
        currentSessionWordCount;


    analyzeButton.disabled =
        !finalTranscript;


    /*
       Save prompt only appears AFTER a speech.
       It is never shown when the page first loads.
    */

    if (finalTranscript) {

        savePrompt.hidden =
            false;

    }


    statusText.textContent =
        "Finished";


    /*
       Request the more accurate server transcription.
    */

    if (audioChunks.length) {

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

                currentSessionWordCount =
                    countWords(
                        finalTranscript
                    );

                currentSessionFillerCount =
                    countFillers(
                        finalTranscript
                    );

                fillerCountElement.textContent =
                    currentSessionFillerCount;

                wordCountElement.textContent =
                    currentSessionWordCount;

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
                    JSON.stringify(
                        {
                            audio: base64,
                            mimeType
                        }
                    )
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
   BLOB → BASE64
   ========================================================= */

function blobToBase64(blob) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onloadend =
                () => resolve(
                    reader.result
                );

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

    recordingTimer.textContent =
        "00:00";

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
                        JSON.stringify(
                            {
                                transcript:
                                    finalTranscript
                            }
                        )
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
   AI RENDERING
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


    section.appendChild(title);
    section.appendChild(text);

    return section;

}


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


    if (Array.isArray(value)) {

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
        value &&
        typeof value === "object"
    ) {

        renderObjectInside(
            value,
            parent
        );

    }

}


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

    if (!finalTranscript) {
        return;
    }

    speechNameInput.value =
        "";

    saveModal.hidden =
        false;

    setTimeout(
        () => speechNameInput.focus(),
        50
    );

}


function closeSaveModal() {

    saveModal.hidden =
        true;

}


function saveCurrentSpeech(name) {

    if (
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

        if (event.key === "Enter") {

            event.preventDefault();

            saveCurrentSpeech(
                speechNameInput.value
            );

        }

        if (event.key === "Escape") {

            closeSaveModal();

        }

    }
);


/* =========================================================
   SAVED SPEECH EVENTS
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


function openSavedSpeech(id) {

    const speech =
        getSavedSpeeches()
            .find(
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

    savePrompt.hidden =
        true;


    document
        .querySelector(".transcript-card")
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
   SCROLL
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

listenButton.addEventListener(
    "click",
    startRecording
);

stopButton.addEventListener(
    "click",
    stopRecording
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initialize() {

    /*
       Make absolutely sure the save prompt
       is hidden on initial page load.
    */

    if (savePrompt) {
        savePrompt.hidden = true;
    }

    if (saveModal) {
        saveModal.hidden = true;
    }

    if (analysisLoading) {
        analysisLoading.hidden = true;
    }


    stopButton.disabled =
        true;

    analyzeButton.disabled =
        true;


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
        "Notification" in window
    ) {

        updateNotificationUI(
            Notification.permission
        );

    }

}


initialize();