/* ============================================================
   SPEECH TRACKER
   Complete replacement script.js

   Features:
   - Live speech recognition
   - Fast filler-word detection
   - Ummm / uhhh detection
   - Notifications
   - Vibration where supported
   - Final OpenAI transcription
   - Structured AI analysis
   - Detailed section analysis
   - Saved speeches
   - Save Speech ✓ / × prompt
   - Light / dark mode
   - Custom tracked words
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

const STORAGE_WORDS = "speechTrackerWords";
const STORAGE_SPEECHES = "speechTrackerSavedSpeeches";
const STORAGE_THEME = "speechTrackerTheme";


/* ============================================================
   DOM ELEMENTS
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

const recordingTimerElement =
    document.getElementById("recordingTimer");

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

const saveSpeechPrompt =
    document.getElementById("saveSpeechPrompt");

const saveSpeechYes =
    document.getElementById("saveSpeechYes");

const saveSpeechNo =
    document.getElementById("saveSpeechNo");

const themeToggle =
    document.getElementById("themeToggle");


/* ============================================================
   STATE
   ============================================================ */

let trackedWords = loadTrackedWords();

let recognition = null;

let isListening = false;

let recognitionSupported = false;

let finalTranscript = "";

let liveTranscript = "";

let currentSpeechTranscript = "";

let currentAnalysis = null;

let recordingStartTime = null;

let recordingTimerInterval = null;

let notificationPermissionGranted = false;

let lastDetectedText = "";

let detectedWordHistory = [];

let lastNotificationTime = 0;

let pendingSpeechToSave = null;

let mediaRecorder = null;

let audioChunks = [];

let microphoneStream = null;


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    initialize
);


function initialize() {

    initializeTheme();

    initializeRecognition();

    renderTrackedWords();

    renderSavedSpeeches();

    updateNotificationStatus();

    updateStats();

    setupEventListeners();

}


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
            addTrackedWord
        );
    }

    if (customWordInput) {
        customWordInput.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {
                    event.preventDefault();
                    addTrackedWord();
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
            requestNotifications
        );
    }

    if (analyzeButton) {
        analyzeButton.addEventListener(
            "click",
            analyzeSpeech
        );
    }

    if (saveSpeechYes) {
        saveSpeechYes.addEventListener(
            "click",
            confirmSaveSpeech
        );
    }

    if (saveSpeechNo) {
        saveSpeechNo.addEventListener(
            "click",
            rejectSaveSpeech
        );
    }

    if (themeToggle) {
        themeToggle.addEventListener(
            "click",
            toggleTheme
        );
    }

}


/* ============================================================
   THEME
   ============================================================ */

function initializeTheme() {

    const savedTheme =
        localStorage.getItem(
            STORAGE_THEME
        );

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


function applyTheme(theme) {

    document.documentElement.dataset.theme =
        theme;

    localStorage.setItem(
        STORAGE_THEME,
        theme
    );

    if (!themeToggle) {
        return;
    }

    if (theme === "dark") {

        themeToggle.textContent = "☀️";

        themeToggle.setAttribute(
            "aria-label",
            "Switch to light mode"
        );

        themeToggle.setAttribute(
            "title",
            "Switch to light mode"
        );

    } else {

        themeToggle.textContent = "🌙";

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


function toggleTheme() {

    const currentTheme =
        document.documentElement.dataset.theme ||
        "light";

    const newTheme =
        currentTheme === "dark"
            ? "light"
            : "dark";

    applyTheme(newTheme);
}


/* ============================================================
   TRACKED WORDS
   ============================================================ */

function loadTrackedWords() {

    try {

        const stored =
            localStorage.getItem(
                STORAGE_WORDS
            );

        if (!stored) {
            return [...DEFAULT_WORDS];
        }

        const parsed =
            JSON.parse(stored);

        if (
            !Array.isArray(parsed) ||
            parsed.length === 0
        ) {
            return [...DEFAULT_WORDS];
        }

        return parsed
            .filter(
                word =>
                    typeof word === "string" &&
                    word.trim()
            )
            .map(
                word =>
                    word.trim().toLowerCase()
            );

    } catch {

        return [...DEFAULT_WORDS];

    }
}


function saveTrackedWords() {

    localStorage.setItem(
        STORAGE_WORDS,
        JSON.stringify(trackedWords)
    );
}


function renderTrackedWords() {

    if (!wordList) {
        return;
    }

    wordList.innerHTML = "";

    trackedWords.forEach(
        word => {

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
                () => removeTrackedWord(word)
            );

            tag.appendChild(text);

            tag.appendChild(remove);

            wordList.appendChild(tag);

        }
    );
}


function addTrackedWord() {

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

    if (trackedWords.includes(word)) {

        customWordInput.value = "";

        return;
    }

    trackedWords.push(word);

    saveTrackedWords();

    renderTrackedWords();

    customWordInput.value = "";

}


function removeTrackedWord(word) {

    trackedWords =
        trackedWords.filter(
            item => item !== word
        );

    saveTrackedWords();

    renderTrackedWords();
}


function resetTrackedWords() {

    trackedWords =
        [...DEFAULT_WORDS];

    saveTrackedWords();

    renderTrackedWords();

}


/* ============================================================
   SPEECH RECOGNITION
   ============================================================ */

function initializeRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        recognitionSupported = false;

        updateStatus(
            "Live recognition unavailable",
            "error"
        );

        return;
    }

    recognitionSupported = true;

    recognition =
        new SpeechRecognition();

    recognition.continuous = true;

    recognition.interimResults = true;

    /*
       Keep English here for consistent recognition.

       The browser handles the actual speech processing.
    */

    recognition.lang = "en-US";

    recognition.maxAlternatives = 1;


    recognition.onstart = () => {

        isListening = true;

        updateStatus(
            "Listening",
            "listening"
        );

        if (listenButton) {
            listenButton.disabled = true;
        }

        if (stopButton) {
            stopButton.disabled = false;
        }

    };


    recognition.onresult = event => {

        processRecognitionResult(event);

    };


    recognition.onerror = event => {

        console.error(
            "Speech recognition error:",
            event.error
        );

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {

            updateStatus(
                "Microphone permission denied",
                "error"
            );

            isListening = false;

            updateButtons();

            return;
        }

        /*
           Do not immediately show an error for temporary
           recognition problems.
        */

        if (isListening) {

            updateStatus(
                "Listening...",
                "listening"
            );
        }

    };


    recognition.onend = () => {

        /*
           Chrome can occasionally stop the recognition service
           even though continuous=true.

           Restart it while the user is still listening.
        */

        if (isListening) {

            setTimeout(
                () => {

                    if (!isListening) {
                        return;
                    }

                    try {
                        recognition.start();
                    } catch {
                        // Already running.
                    }

                },
                100
            );

            return;
        }

        updateButtons();

    };

}


/* ============================================================
   START LISTENING
   ============================================================ */

async function startListening() {

    if (!recognitionSupported) {

        alert(
            "Live speech recognition is not supported in this browser. Try Chrome or another supported browser."
        );

        return;
    }

    if (isListening) {
        return;
    }


    /*
       Reset session state.
    */

    finalTranscript = "";

    liveTranscript = "";

    currentSpeechTranscript = "";

    currentAnalysis = null;

    detectedWordHistory = [];

    lastDetectedText = "";

    pendingSpeechToSave = null;


    if (analysisElement) {
        analysisElement.innerHTML = "";
    }

    if (analyzeButton) {
        analyzeButton.disabled = true;
    }


    hideSavePrompt();


    if (heardElement) {

        heardElement.innerHTML =
            '<span class="heard-placeholder">Listening for speech...</span>';

    }


    if (finalTranscriptElement) {

        finalTranscriptElement.textContent =
            "Listening...";

    }


    fillerCountElement.textContent =
        "0";

    wordCountElement.textContent =
        "0";


    startRecordingTimer();


    try {

        /*
           Request microphone permission before starting
           recognition.
        */

        microphoneStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });


        /*
           We do not send this recording anywhere here.
           The browser recognition API handles the live
           transcript.

           Keeping the stream alive ensures the browser has
           microphone access while recognition is running.
        */


        recognition.start();

    } catch (error) {

        console.error(
            "Could not access microphone:",
            error
        );

        isListening = false;

        stopRecordingTimer();

        updateStatus(
            "Microphone unavailable",
            "error"
        );

        updateButtons();

    }

}


/* ============================================================
   PROCESS LIVE RECOGNITION
   ============================================================ */

function processRecognitionResult(event) {

    let interim = "";

    let newlyFinal = "";

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

            newlyFinal +=
                text + " ";

        } else {

            interim +=
                text + " ";

        }

    }


    if (newlyFinal.trim()) {

        finalTranscript +=
            newlyFinal;

        /*
           Detect FINAL words immediately.
        */

        detectTrackedWords(
            newlyFinal
        );

    }


    liveTranscript =
        finalTranscript +
        interim;


    currentSpeechTranscript =
        liveTranscript.trim();


    updateLiveTranscript(
        currentSpeechTranscript
    );

    updateStatsFromTranscript(
        currentSpeechTranscript
    );

}


/* ============================================================
   LIVE TRANSCRIPT DISPLAY
   ============================================================ */

function updateLiveTranscript(text) {

    if (!heardElement) {
        return;
    }

    if (!text.trim()) {

        heardElement.innerHTML =
            '<span class="heard-placeholder">Listening for speech...</span>';

        return;
    }

    heardElement.innerHTML =
        highlightTrackedWords(text);

}


/* ============================================================
   HIGHLIGHT TRACKED WORDS
   ============================================================ */

function highlightTrackedWords(text) {

    if (!text) {
        return "";
    }

    /*
       Escape HTML first.
    */

    let escaped =
        escapeHTML(text);


    /*
       Sort longest first so phrases like
       "you know" are detected before "you".
    */

    const sortedWords =
        [...trackedWords]
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
                escapeRegExp(
                    escapeHTML(word)
                );

            /*
               Handles:
               um
               umm
               uhhh
               etc.

               This is particularly important for
               stretched filler words.
            */

            const pattern =
                new RegExp(
                    `(^|\\s)(${escapedWord}+)(?=\\s|$|[.,!?;:])`,
                    "gi"
                );

            escaped =
                escaped.replace(
                    pattern,
                    "$1<span class=\"highlight\">$2</span>"
                );

        }
    );


    return escaped;
}


/* ============================================================
   FAST FILLER DETECTION
   ============================================================ */

function detectTrackedWords(text) {

    if (!text) {
        return;
    }

    const normalized =
        text
            .toLowerCase()
            .replace(/[.,!?;:]/g, " ");


    trackedWords.forEach(
        word => {

            const normalizedWord =
                word
                    .trim()
                    .toLowerCase();

            if (!normalizedWord) {
                return;
            }


            /*
               Special handling for:
               um
               uh
               umm
               uhh

               Speech recognition may produce:

               um
               umm
               ummm
               uh
               uhh
               uhhh

               so we intentionally allow repeated
               m's and h's.
            */

            let pattern;


            if (
                normalizedWord === "um" ||
                normalizedWord === "umm"
            ) {

                pattern =
                    /\bum+\b/gi;

            } else if (
                normalizedWord === "uh" ||
                normalizedWord === "uhh"
            ) {

                pattern =
                    /\buh+\b/gi;

            } else {

                pattern =
                    new RegExp(
                        `\\b${escapeRegExp(normalizedWord)}\\b`,
                        "gi"
                    );

            }


            const matches =
                normalized.match(pattern);


            if (!matches) {
                return;
            }


            matches.forEach(
                match => {

                    registerDetectedWord(
                        match
                    );

                }
            );

        }
    );

}


/* ============================================================
   DETECTED WORD REGISTRATION
   ============================================================ */

function registerDetectedWord(word) {

    const now =
        Date.now();


    /*
       Prevent the same recognition result from triggering
       multiple notifications.

       A word can appear in several interim recognition
       results as Chrome revises its transcript.
    */

    const duplicate =
        detectedWordHistory.some(
            item =>
                item.word === word &&
                now - item.time < 900
        );


    if (duplicate) {
        return;
    }


    detectedWordHistory.push({
        word,
        time: now
    });


    /*
       Keep history small.
    */

    if (
        detectedWordHistory.length > 100
    ) {

        detectedWordHistory =
            detectedWordHistory.slice(-50);

    }


    incrementFillerCount();


    triggerFastAlert(
        word
    );

}


/* ============================================================
   FAST ALERT
   ============================================================ */

function triggerFastAlert(word) {

    const now =
        Date.now();


    /*
       Very short global cooldown so notifications don't
       get spammed by recognition corrections.

       This still allows different filler words to trigger
       very quickly.
    */

    if (
        now - lastNotificationTime < 350
    ) {

        /*
           Vibration can still happen.
        */

        triggerVibration();

    } else {

        lastNotificationTime =
            now;

        triggerVibration();

        showBrowserNotification(
            word
        );

    }


    showInPageAlert(
        word
    );

}


/* ============================================================
   VIBRATION
   ============================================================ */

function triggerVibration() {

    try {

        if (
            "vibrate" in navigator
        ) {

            navigator.vibrate(
                [80, 40, 80]
            );

        }

    } catch {
        // Ignore unsupported vibration.
    }

}


/* ============================================================
   IN-PAGE ALERT
   ============================================================ */

function showInPageAlert(word) {

    const existing =
        document.querySelector(
            ".filler-alert"
        );

    if (existing) {
        existing.remove();
    }


    const alertElement =
        document.createElement("div");

    alertElement.className =
        "filler-alert";


    alertElement.innerHTML =
        `
            <span class="filler-alert-icon">!</span>
            <span>
                <strong>${escapeHTML(word)}</strong>
                detected
            </span>
        `;


    document.body.appendChild(
        alertElement
    );


    setTimeout(
        () => {

            alertElement.classList.add(
                "show"
            );

        },
        10
    );


    setTimeout(
        () => {

            alertElement.classList.remove(
                "show"
            );

            setTimeout(
                () => {
                    alertElement.remove();
                },
                250
            );

        },
        1300
    );

}


/* ============================================================
   BROWSER NOTIFICATIONS
   ============================================================ */

async function requestNotifications() {

    if (
        !("Notification" in window)
    ) {

        updateNotificationStatus(
            "Browser notifications are not supported."
        );

        return;
    }


    try {

        const permission =
            await Notification.requestPermission();


        if (
            permission === "granted"
        ) {

            notificationPermissionGranted =
                true;

            updateNotificationStatus(
                "Notifications are enabled."
            );

            enableNotificationsButton.textContent =
                "✓ Notifications Enabled";

            enableNotificationsButton.classList.add(
                "enabled"
            );

        } else {

            notificationPermissionGranted =
                false;

            updateNotificationStatus(
                "Notifications were not enabled."
            );

        }

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

    }

}


function updateNotificationStatus(
    customMessage = null
) {

    if (!notificationStatus) {
        return;
    }


    if (customMessage) {

        notificationStatus.textContent =
            customMessage;

        return;
    }


    if (
        !("Notification" in window)
    ) {

        notificationStatus.textContent =
            "Notifications are not supported in this browser.";

        return;
    }


    if (
        Notification.permission === "granted"
    ) {

        notificationPermissionGranted =
            true;

        notificationStatus.textContent =
            "Notifications are enabled.";

        if (enableNotificationsButton) {

            enableNotificationsButton.textContent =
                "✓ Notifications Enabled";

            enableNotificationsButton.classList.add(
                "enabled"
            );

        }

    } else {

        notificationPermissionGranted =
            false;

        notificationStatus.textContent =
            "Notifications are not enabled.";

    }

}


function showBrowserNotification(word) {

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


    try {

        new Notification(
            "Speech Tracker",
            {
                body:
                    `"${word}" detected`,
                tag:
                    "speech-tracker-filler"
            }
        );

    } catch (error) {

        console.error(
            "Could not create notification:",
            error
        );

    }

}


/* ============================================================
   STATS
   ============================================================ */

function incrementFillerCount() {

    const current =
        parseInt(
            fillerCountElement.textContent,
            10
        ) || 0;

    fillerCountElement.textContent =
        String(current + 1);

}


function updateStats() {

    updateStatsFromTranscript(
        currentSpeechTranscript
    );

}


function updateStatsFromTranscript(text) {

    if (!text) {

        wordCountElement.textContent =
            "0";

        return;
    }


    const words =
        text
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    wordCountElement.textContent =
        String(words.length);

}


/* ============================================================
   TIMER
   ============================================================ */

function startRecordingTimer() {

    recordingStartTime =
        Date.now();


    if (recordingTimerInterval) {

        clearInterval(
            recordingTimerInterval
        );

    }


    updateRecordingTimer();


    recordingTimerInterval =
        setInterval(
            updateRecordingTimer,
            1000
        );

}


function updateRecordingTimer() {

    if (!recordingStartTime) {
        return;
    }


    const elapsed =
        Math.floor(
            (
                Date.now() -
                recordingStartTime
            ) / 1000
        );


    const minutes =
        Math.floor(
            elapsed / 60
        )
            .toString()
            .padStart(2, "0");


    const seconds =
        (
            elapsed % 60
        )
            .toString()
            .padStart(2, "0");


    if (recordingTimerElement) {

        recordingTimerElement.textContent =
            `${minutes}:${seconds}`;

    }

}


function stopRecordingTimer() {

    if (recordingTimerInterval) {

        clearInterval(
            recordingTimerInterval
        );

        recordingTimerInterval =
            null;

    }

}


/* ============================================================
   STOP LISTENING
   ============================================================ */

async function stopListening() {

    if (!isListening) {
        return;
    }


    isListening = false;


    stopRecordingTimer();


    if (recognition) {

        try {
            recognition.stop();
        } catch {
            // Already stopped.
        }

    }


    if (microphoneStream) {

        microphoneStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        microphoneStream =
            null;

    }


    updateStatus(
        "Processing",
        "ready"
    );


    updateButtons();


    const completedTranscript =
        finalTranscript.trim();


    currentSpeechTranscript =
        completedTranscript;


    if (completedTranscript) {

        finalTranscriptElement.innerHTML =
            highlightTrackedWords(
                completedTranscript
            );

    } else {

        finalTranscriptElement.textContent =
            "No speech was detected.";

    }


    /*
       Enable AI analysis immediately if we have speech.
    */

    if (
        completedTranscript &&
        analyzeButton
    ) {

        analyzeButton.disabled =
            false;

    }


    /*
       Create the Save Speech prompt.
    */

    if (completedTranscript) {

        pendingSpeechToSave = {
            transcript:
                completedTranscript,

            timestamp:
                Date.now(),

            duration:
                recordingStartTime
                    ? Date.now() -
                      recordingStartTime
                    : 0,

            fillerCount:
                parseInt(
                    fillerCountElement.textContent,
                    10
                ) || 0,

            wordCount:
                parseInt(
                    wordCountElement.textContent,
                    10
                ) || 0,

            analysis:
                null
        };


        showSavePrompt();

    }


    updateStatus(
        "Ready",
        "ready"
    );

}


/* ============================================================
   BUTTON STATE
   ============================================================ */

function updateButtons() {

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
   STATUS
   ============================================================ */

function updateStatus(
    text,
    state
) {

    if (statusElement) {

        statusElement.textContent =
            text;

    }


    if (statusDot) {

        statusDot.className =
            `dot ${state || "ready"}`;

    }

}


/* ============================================================
   AI ANALYSIS
   ============================================================ */

async function analyzeSpeech() {

    const transcript =
        currentSpeechTranscript.trim();


    if (!transcript) {

        alert(
            "Finish a speech before analyzing it."
        );

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


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data?.error ||
                "AI analysis failed"
            );

        }


        currentAnalysis =
            data.analysisData ||
            null;


        /*
           Prefer structured data so the new AI analysis
           looks much better.
        */

        if (
            data.analysisData
        ) {

            renderStructuredAnalysis(
                data.analysisData
            );

        } else if (
            data.analysis
        ) {

            renderPlainAnalysis(
                data.analysis
            );

        } else {

            throw new Error(
                "No analysis was returned."
            );

        }


        /*
           Add the analysis to the pending saved speech
           so it can be saved with the session.
        */

        if (pendingSpeechToSave) {

            pendingSpeechToSave.analysis =
                data.analysisData ||
                data.analysis ||
                null;

        }


    } catch (error) {

        console.error(
            "AI analysis error:",
            error
        );


        if (analysisElement) {

            analysisElement.innerHTML =
                `
                    <div class="analysis-error">
                        <strong>
                            Analysis failed
                        </strong>

                        <p>
                            ${escapeHTML(
                                error.message ||
                                "Something went wrong."
                            )}
                        </p>
                    </div>
                `;

        }

    } finally {

        if (analysisLoading) {

            analysisLoading.hidden =
                true;

        }


        if (analyzeButton) {

            analyzeButton.disabled =
                false;

        }

    }

}


/* ============================================================
   STRUCTURED AI DISPLAY
   ============================================================ */

function renderStructuredAnalysis(
    data
) {

    if (!analysisElement) {
        return;
    }


    analysisElement.innerHTML =
        "";


    /*
       Overall
    */

    if (data.overall) {

        analysisElement.appendChild(
            createAnalysisBlock(
                "Overall",
                data.overall,
                "overall"
            )
        );

    }


    /*
       Speech sections
    */

    if (
        Array.isArray(data.sections) &&
        data.sections.length > 0
    ) {

        const heading =
            document.createElement("h3");

        heading.textContent =
            "Speech Breakdown";

        heading.className =
            "analysis-main-heading";

        analysisElement.appendChild(
            heading
        );


        data.sections.forEach(
            (section, index) => {

                const card =
                    document.createElement("div");

                card.className =
                    "analysis-section";


                const title =
                    document.createElement("h4");

                title.textContent =
                    `${index + 1}. ${section.sectionName || "Section"}`;


                card.appendChild(
                    title
                );


                if (section.summary) {

                    card.appendChild(
                        createAnalysisSubsection(
                            "What you said",
                            section.summary
                        )
                    );

                }


                if (section.whatWorked) {

                    card.appendChild(
                        createAnalysisSubsection(
                            "What worked",
                            section.whatWorked
                        )
                    );

                }


                if (section.whatToImprove) {

                    card.appendChild(
                        createAnalysisSubsection(
                            "What to improve",
                            section.whatToImprove
                        )
                    );

                }


                if (section.specificExample) {

                    card.appendChild(
                        createAnalysisSubsection(
                            "Specific example",
                            section.specificExample
                        )
                    );

                }


                analysisElement.appendChild(
                    card
                );

            }
        );

    }


    /*
       Filler words
    */

    if (data.fillerWords) {

        const filler =
            data.fillerWords;


        let content =
            filler.summary || "";


        if (
            filler.wordsFound &&
            filler.wordsFound.length
        ) {

            content +=
                `\nWords found: ${filler.wordsFound.join(", ")}`;

        }


        if (filler.advice) {

            content +=
                `\n\n${filler.advice}`;

        }


        if (content.trim()) {

            analysisElement.appendChild(
                createAnalysisBlock(
                    "Filler Words",
                    content,
                    "filler"
                )
            );

        }

    }


    /*
       Clarity
    */

    if (data.clarity) {

        analysisElement.appendChild(
            createAnalysisBlock(
                "Clarity",
                data.clarity
            )
        );

    }


    /*
       Structure
    */

    if (data.structure) {

        analysisElement.appendChild(
            createAnalysisBlock(
                "Structure",
                data.structure
            )
        );

    }


    /*
       Delivery
    */

    if (data.delivery) {

        analysisElement.appendChild(
            createAnalysisBlock(
                "Delivery",
                data.delivery
            )
        );

    }


    /*
       Strengths
    */

    if (
        Array.isArray(data.strengths) &&
        data.strengths.length
    ) {

        analysisElement.appendChild(
            createAnalysisListBlock(
                "What You Did Well",
                data.strengths
            )
        );

    }


    /*
       Improvements
    */

    if (
        Array.isArray(data.improvements) &&
        data.improvements.length
    ) {

        analysisElement.appendChild(
            createAnalysisListBlock(
                "Priority Improvements",
                data.improvements
            )
        );

    }


    /*
       Tips
    */

    if (
        Array.isArray(data.tips) &&
        data.tips.length
    ) {

        analysisElement.appendChild(
            createAnalysisListBlock(
                "AI Tips for Your Next Speech",
                data.tips
            )
        );

    }

}


/* ============================================================
   ANALYSIS HELPERS
   ============================================================ */

function createAnalysisBlock(
    title,
    content,
    className = ""
) {

    const block =
        document.createElement("div");

    block.className =
        `analysis-block ${className}`;


    const heading =
        document.createElement("h3");

    heading.textContent =
        title;


    const paragraph =
        document.createElement("p");

    paragraph.textContent =
        content;


    block.appendChild(
        heading
    );

    block.appendChild(
        paragraph
    );


    return block;
}


function createAnalysisSubsection(
    title,
    content
) {

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "analysis-subsection";


    const heading =
        document.createElement("strong");

    heading.textContent =
        title;


    const paragraph =
        document.createElement("p");

    paragraph.textContent =
        content;


    wrapper.appendChild(
        heading
    );

    wrapper.appendChild(
        paragraph
    );


    return wrapper;
}


function createAnalysisListBlock(
    title,
    items
) {

    const block =
        document.createElement("div");

    block.className =
        "analysis-block";


    const heading =
        document.createElement("h3");

    heading.textContent =
        title;


    const list =
        document.createElement("ol");


    items.forEach(
        item => {

            const li =
                document.createElement("li");

            li.textContent =
                item;

            list.appendChild(
                li
            );

        }
    );


    block.appendChild(
        heading
    );

    block.appendChild(
        list
    );


    return block;
}


function renderPlainAnalysis(
    text
) {

    if (!analysisElement) {
        return;
    }


    analysisElement.innerHTML =
        "";


    const block =
        document.createElement("div");

    block.className =
        "analysis-block";


    const paragraph =
        document.createElement("p");

    paragraph.textContent =
        text;


    block.appendChild(
        paragraph
    );


    analysisElement.appendChild(
        block
    );

}


/* ============================================================
   SAVE SPEECH PROMPT
   ============================================================ */

function showSavePrompt() {

    if (!saveSpeechPrompt) {
        return;
    }

    saveSpeechPrompt.hidden =
        false;


    requestAnimationFrame(
        () => {

            saveSpeechPrompt.classList.add(
                "visible"
            );

        }
    );

}


function hideSavePrompt() {

    if (!saveSpeechPrompt) {
        return;
    }

    saveSpeechPrompt.classList.remove(
        "visible"
    );


    setTimeout(
        () => {

            saveSpeechPrompt.hidden =
                true;

        },
        200
    );

}


/* ============================================================
   SAVE SPEECH
   ============================================================ */

function confirmSaveSpeech() {

    if (!pendingSpeechToSave) {

        hideSavePrompt();

        return;

    }


    const speeches =
        loadSavedSpeeches();


    const speech = {
        ...pendingSpeechToSave,

        id:
            Date.now().toString(),

        title:
            createSpeechTitle(
                pendingSpeechToSave.timestamp
            )
    };


    speeches.unshift(
        speech
    );


    /*
       Keep the most recent 30 speeches.
    */

    const limited =
        speeches.slice(
            0,
            30
        );


    localStorage.setItem(
        STORAGE_SPEECHES,
        JSON.stringify(limited)
    );


    pendingSpeechToSave =
        null;


    hideSavePrompt();

    renderSavedSpeeches();

}


/* ============================================================
   REJECT SAVE
   ============================================================ */

function rejectSaveSpeech() {

    pendingSpeechToSave =
        null;

    hideSavePrompt();

}


/* ============================================================
   SAVED SPEECHES
   ============================================================ */

function loadSavedSpeeches() {

    try {

        const stored =
            localStorage.getItem(
                STORAGE_SPEECHES
            );


        if (!stored) {
            return [];
        }


        const parsed =
            JSON.parse(stored);


        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch {

        return [];

    }

}


function renderSavedSpeeches() {

    if (!savedSpeechesElement) {
        return;
    }


    const speeches =
        loadSavedSpeeches();


    savedSpeechesElement.innerHTML =
        "";


    if (speeches.length === 0) {

        const empty =
            document.createElement("div");

        empty.className =
            "empty-speeches";

        empty.textContent =
            "No saved speeches yet.";

        savedSpeechesElement.appendChild(
            empty
        );

        return;

    }


    speeches.forEach(
        speech => {

            const card =
                document.createElement("div");

            card.className =
                "saved-speech";


            const header =
                document.createElement("div");

            header.className =
                "saved-speech-header";


            const title =
                document.createElement("strong");

            title.textContent =
                speech.title ||
                "Saved Speech";


            const date =
                document.createElement("span");

            date.textContent =
                formatSpeechDate(
                    speech.timestamp
                );


            header.appendChild(
                title
            );

            header.appendChild(
                date
            );


            const stats =
                document.createElement("div");

            stats.className =
                "saved-speech-stats";


            stats.innerHTML =
                `
                    <span>
                        ${speech.wordCount || 0} words
                    </span>

                    <span>
                        ${speech.fillerCount || 0} tracked
                    </span>
                `;


            const actions =
                document.createElement("div");

            actions.className =
                "saved-speech-actions";


            const viewButton =
                document.createElement("button");

            viewButton.type =
                "button";

            viewButton.className =
                "button secondary";

            viewButton.textContent =
                "View";


            viewButton.addEventListener(
                "click",
                () => viewSavedSpeech(speech.id)
            );


            const deleteButton =
                document.createElement("button");

            deleteButton.type =
                "button";

            deleteButton.className =
                "button danger-button";

            deleteButton.textContent =
                "Delete";


            deleteButton.addEventListener(
                "click",
                () => deleteSavedSpeech(speech.id)
            );


            actions.appendChild(
                viewButton
            );

            actions.appendChild(
                deleteButton
            );


            card.appendChild(
                header
            );

            card.appendChild(
                stats
            );

            card.appendChild(
                actions
            );


            savedSpeechesElement.appendChild(
                card
            );

        }
    );

}


/* ============================================================
   CREATE SPEECH TITLE
   ============================================================ */

function createSpeechTitle(
    timestamp
) {

    const date =
        new Date(timestamp);


    return `Speech — ${
        date.toLocaleDateString(
            undefined,
            {
                month: "short",
                day: "numeric",
                year: "numeric"
            }
        )
    }`;

}


/* ============================================================
   FORMAT DATE
   ============================================================ */

function formatSpeechDate(
    timestamp
) {

    if (!timestamp) {
        return "";
    }


    return new Date(timestamp)
        .toLocaleTimeString(
            undefined,
            {
                hour: "numeric",
                minute: "2-digit"
            }
        );

}


/* ============================================================
   VIEW SAVED SPEECH
   ============================================================ */

function viewSavedSpeech(
    id
) {

    const speeches =
        loadSavedSpeeches();


    const speech =
        speeches.find(
            item =>
                item.id === id
        );


    if (!speech) {
        return;
    }


    currentSpeechTranscript =
        speech.transcript || "";


    finalTranscript =
        currentSpeechTranscript;


    if (finalTranscriptElement) {

        finalTranscriptElement.innerHTML =
            highlightTrackedWords(
                currentSpeechTranscript
            );

    }


    if (heardElement) {

        heardElement.innerHTML =
            highlightTrackedWords(
                currentSpeechTranscript
            );

    }


    if (fillerCountElement) {

        fillerCountElement.textContent =
            String(
                speech.fillerCount || 0
            );

    }


    if (wordCountElement) {

        wordCountElement.textContent =
            String(
                speech.wordCount || 0
            );

    }


    if (speech.analysis) {

        currentAnalysis =
            speech.analysis;


        if (
            typeof speech.analysis === "object"
        ) {

            renderStructuredAnalysis(
                speech.analysis
            );

        } else {

            renderPlainAnalysis(
                speech.analysis
            );

        }

    }


    if (analyzeButton) {

        analyzeButton.disabled =
            !currentSpeechTranscript;

    }


    document
        .querySelector(".ai-card")
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

}


/* ============================================================
   DELETE SAVED SPEECH
   ============================================================ */

function deleteSavedSpeech(
    id
) {

    const speeches =
        loadSavedSpeeches();


    const updated =
        speeches.filter(
            speech =>
                speech.id !== id
        );


    localStorage.setItem(
        STORAGE_SPEECHES,
        JSON.stringify(updated)
    );


    renderSavedSpeeches();

}


/* ============================================================
   UTILITIES
   ============================================================ */

function escapeHTML(
    value
) {

    return String(value)
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


function escapeRegExp(
    value
) {

    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}


/* ============================================================
   PAGE CLEANUP
   ============================================================ */

window.addEventListener(
    "beforeunload",
    () => {

        isListening =
            false;

        stopRecordingTimer();

        if (recognition) {

            try {
                recognition.stop();
            } catch {
                // Ignore.
            }

        }

        if (microphoneStream) {

            microphoneStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }

    }
);