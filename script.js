/* ============================================================
   SPEECH TRACKER
   Complete replacement script.js
   ============================================================ */

"use strict";

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

const STORAGE_KEYS = {
    words: "speechTrackerWords",
    speeches: "speechTrackerSavedSpeeches",
    theme: "speechTrackerTheme"
};


/* ============================================================
   STATE
   ============================================================ */

let trackedWords = loadTrackedWords();

let savedSpeeches = loadSavedSpeeches();

let recognition = null;

let mediaRecorder = null;
let audioChunks = [];

let isListening = false;
let isStopping = false;
let isTranscribing = false;
let isAnalyzing = false;

let liveTranscript = "";
let finalTranscript = "";

let currentSpeechId = null;

let speechStartedAt = null;
let speechTimerInterval = null;

let fillerCount = 0;
let totalWordCount = 0;

let notifiedWords = new Set();

let lastLiveDetectionText = "";

let currentAnalysis = null;


/* ============================================================
   DOM HELPERS
   ============================================================ */

function $(id) {
    return document.getElementById(id);
}

function firstExisting(...ids) {
    for (const id of ids) {
        const element = $(id);
        if (element) return element;
    }

    return null;
}


/* ============================================================
   DOM ELEMENTS
   ============================================================ */

const listenButton = firstExisting(
    "listenButton",
    "startButton"
);

const stopButton = firstExisting(
    "stopButton"
);

const analyzeButton = firstExisting(
    "analyzeButton"
);

const heardElement = firstExisting(
    "heard",
    "liveTranscript"
);

const finalTranscriptElement = firstExisting(
    "finalTranscript",
    "finalTranscriptElement"
);

const analysisElement = firstExisting(
    "analysis"
);

const analysisLoading = firstExisting(
    "analysisLoading"
);

const fillerCountElement = firstExisting(
    "fillerCount"
);

const wordCountElement = firstExisting(
    "wordCount"
);

const statusElement = firstExisting(
    "status",
    "statusText"
);

const statusDot = firstExisting(
    "statusDot"
);

const customWordInput = firstExisting(
    "customWordInput"
);

const addWordButton = firstExisting(
    "addWordButton"
);

const wordList = firstExisting(
    "wordList"
);

const resetWordsButton = firstExisting(
    "resetWordsButton"
);

const enableNotificationsButton = firstExisting(
    "enableNotifications",
    "enableNotificationsButton"
);

const notificationStatus = firstExisting(
    "notificationStatus"
);

const recordingTimer = firstExisting(
    "recordingTimer"
);

const savedSpeechesElement = firstExisting(
    "savedSpeeches",
    "savedSpeechList",
    "speechHistory"
);

const saveSpeechButton = firstExisting(
    "saveSpeechButton"
);

const deleteSavedSpeechesButton = firstExisting(
    "deleteSavedSpeechesButton"
);

const themeToggle = firstExisting(
    "themeToggle",
    "themeButton",
    "modeToggle"
);

const scrollPrompt = firstExisting(
    "scrollPrompt",
    "scrollArrow"
);


/* ============================================================
   LOCAL STORAGE
   ============================================================ */

function loadTrackedWords() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.words);

        if (!saved) {
            return [...DEFAULT_WORDS];
        }

        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed) || parsed.length === 0) {
            return [...DEFAULT_WORDS];
        }

        return parsed
            .filter(word => typeof word === "string")
            .map(word => word.trim().toLowerCase())
            .filter(Boolean);

    } catch (error) {
        console.error("Could not load tracked words:", error);
        return [...DEFAULT_WORDS];
    }
}


function saveTrackedWords() {
    try {
        localStorage.setItem(
            STORAGE_KEYS.words,
            JSON.stringify(trackedWords)
        );
    } catch (error) {
        console.error("Could not save tracked words:", error);
    }
}


function loadSavedSpeeches() {
    try {
        const saved = localStorage.getItem(
            STORAGE_KEYS.speeches
        );

        if (!saved) {
            return [];
        }

        const parsed = JSON.parse(saved);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {
        console.error("Could not load saved speeches:", error);
        return [];
    }
}


function saveSpeechesToStorage() {
    try {
        localStorage.setItem(
            STORAGE_KEYS.speeches,
            JSON.stringify(savedSpeeches)
        );
    } catch (error) {
        console.error("Could not save speeches:", error);
    }
}


/* ============================================================
   THEME
   ============================================================ */

function initializeTheme() {
    const savedTheme =
        localStorage.getItem(STORAGE_KEYS.theme);

    const theme =
        savedTheme === "dark"
            ? "dark"
            : "light";

    document.documentElement.dataset.theme = theme;

    updateThemeButton(theme);
}


function updateThemeButton(theme) {
    if (!themeToggle) return;

    themeToggle.textContent =
        theme === "dark"
            ? "Light"
            : "Dark";

    themeToggle.setAttribute(
        "aria-label",
        theme === "dark"
            ? "Switch to light mode"
            : "Switch to dark mode"
    );
}


function toggleTheme() {
    const current =
        document.documentElement.dataset.theme === "dark"
            ? "dark"
            : "light";

    const next =
        current === "dark"
            ? "light"
            : "dark";

    document.documentElement.dataset.theme = next;

    localStorage.setItem(
        STORAGE_KEYS.theme,
        next
    );

    updateThemeButton(next);
}


if (themeToggle) {
    themeToggle.addEventListener(
        "click",
        toggleTheme
    );
}


/* ============================================================
   STATUS
   ============================================================ */

function setStatus(text, state = "ready") {
    if (statusElement) {
        statusElement.textContent = text;
    }

    if (statusDot) {
        statusDot.classList.remove(
            "ready",
            "listening",
            "error"
        );

        statusDot.classList.add(state);
    }
}


/* ============================================================
   BUTTON STATE
   ============================================================ */

function updateButtonStates() {
    if (listenButton) {
        listenButton.disabled =
            isListening ||
            isStopping ||
            isTranscribing;
    }

    if (stopButton) {
        stopButton.disabled =
            !isListening ||
            isStopping;
    }

    /*
       IMPORTANT:

       Analyze is ONLY enabled after a completed
       transcription exists.

       This prevents the old bug where Analyze starts
       loading before the speech has actually finished.
    */

    if (analyzeButton) {
        analyzeButton.disabled =
            isListening ||
            isStopping ||
            isTranscribing ||
            isAnalyzing ||
            !finalTranscript.trim();
    }
}


/* ============================================================
   RESET CURRENT SPEECH
   ============================================================ */

function resetCurrentSpeech() {
    liveTranscript = "";
    finalTranscript = "";

    currentSpeechId = null;

    fillerCount = 0;
    totalWordCount = 0;

    notifiedWords.clear();

    lastLiveDetectionText = "";

    currentAnalysis = null;

    if (heardElement) {
        heardElement.innerHTML =
            'Tap <b>Listen</b> and start speaking.';
    }

    if (finalTranscriptElement) {
        finalTranscriptElement.innerHTML = "";
    }

    if (analysisElement) {
        analysisElement.innerHTML = "";
    }

    if (analysisLoading) {
        analysisLoading.hidden = true;
        analysisLoading.textContent =
            "Analyzing your speech...";
    }

    updateStats();

    updateButtonStates();
}


/* ============================================================
   STATS
   ============================================================ */

function countWords(text) {
    if (!text || !text.trim()) {
        return 0;
    }

    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}


function escapeHTML(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function createWordRegex(word) {
    const escaped = word
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "\\s+");

    return new RegExp(
        `(^|[^a-zA-Z0-9])(${escaped})(?=$|[^a-zA-Z0-9])`,
        "gi"
    );
}


function countTrackedWords(text) {
    let count = 0;

    for (const word of trackedWords) {
        if (!word.trim()) continue;

        const regex = createWordRegex(word);
        const matches = text.match(regex);

        if (matches) {
            count += matches.length;
        }
    }

    return count;
}


function updateStats() {
    if (fillerCountElement) {
        fillerCountElement.textContent =
            String(fillerCount);
    }

    if (wordCountElement) {
        wordCountElement.textContent =
            String(totalWordCount);
    }
}


/* ============================================================
   HIGHLIGHT TRANSCRIPT
   ============================================================ */

function highlightTranscript(text) {
    if (!text) {
        return "";
    }

    let result = escapeHTML(text);

    /*
       Longest words first prevents smaller tracked words
       from interfering with phrases such as "you know".
    */

    const words = [...trackedWords]
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);

    for (const word of words) {
        const escaped = escapeHTML(word)
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\s+/g, "\\s+");

        const regex = new RegExp(
            `(^|[^a-zA-Z0-9])(${escaped})(?=$|[^a-zA-Z0-9])`,
            "gi"
        );

        result = result.replace(
            regex,
            '$1<span class="highlight">$2</span>'
        );
    }

    return result;
}


function renderLiveTranscript() {
    if (!heardElement) return;

    if (!liveTranscript.trim()) {
        heardElement.innerHTML =
            '<span class="transcript-placeholder">Listening...</span>';

        return;
    }

    heardElement.innerHTML =
        highlightTranscript(liveTranscript);
}


function renderFinalTranscript() {
    if (!finalTranscriptElement) return;

    finalTranscriptElement.innerHTML =
        highlightTranscript(finalTranscript);
}


/* ============================================================
   FAST LIVE FILLER DETECTION
   ============================================================ */

/*
   Browser speech recognition often recognizes "umm" and "uhhh"
   differently from the final transcription.

   Instead of only checking exact words, normalize repeated
   vowels/consonants so:

       um
       umm
       ummmm

   can all be recognized.

   Same for:

       uh
       uhh
       uhhhh
*/

function normalizeForLiveDetection(text) {
    return text
        .toLowerCase()
        .replace(/[.,!?;:"'()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function getLiveFillerPattern(word) {
    const normalized = word
        .toLowerCase()
        .trim();

    if (
        normalized === "um" ||
        /^um+$/.test(normalized)
    ) {
        return /\bum+\b/gi;
    }

    if (
        normalized === "uh" ||
        /^uh+$/.test(normalized)
    ) {
        return /\buh+\b/gi;
    }

    return createWordRegex(normalized);
}


function detectNewLiveFillers(text) {
    const normalized =
        normalizeForLiveDetection(text);

    if (!normalized) return;

    /*
       Only inspect the newest recognition text.

       This prevents the same "um" from triggering
       repeatedly every time SpeechRecognition updates
       the interim result.
    */

    if (normalized === lastLiveDetectionText) {
        return;
    }

    lastLiveDetectionText = normalized;

    for (const word of trackedWords) {
        if (!word.trim()) continue;

        const pattern =
            getLiveFillerPattern(word);

        const matches =
            normalized.match(pattern);

        if (!matches) continue;

        /*
           Notify once per detected update.

           The recognition result can be updated many times
           while the user is still saying the same word.
        */

        const newestMatch =
            matches[matches.length - 1]
                ?.toLowerCase();

        if (!newestMatch) continue;

        const notificationKey =
            `${word}:${normalized.slice(-80)}`;

        if (
            notifiedWords.has(notificationKey)
        ) {
            continue;
        }

        notifiedWords.add(notificationKey);

        triggerFillerAlert(word);
    }
}


/* ============================================================
   FILLER ALERT
   ============================================================ */

function triggerFillerAlert(word) {
    console.log(
        "Tracked word detected:",
        word
    );

    /*
       Vibration is attempted immediately.

       This is intentionally NOT delayed until the
       final transcription API call.
    */

    try {
        if (
            "vibrate" in navigator &&
            typeof navigator.vibrate === "function"
        ) {
            navigator.vibrate([
                80,
                35,
                80
            ]);
        }
    } catch (error) {
        console.warn(
            "Vibration unavailable:",
            error
        );
    }

    /*
       Browser notification.

       This is also triggered directly from live
       recognition instead of waiting for OpenAI.
    */

    sendBrowserNotification(
        `Tracked word: "${word}"`
    );

    /*
       Optional visual feedback.
    */

    showFillerFlash(word);
}


function showFillerFlash(word) {
    const existing =
        document.querySelector(
            ".filler-alert"
        );

    if (existing) {
        existing.remove();
    }

    const alert = document.createElement("div");

    alert.className =
        "filler-alert";

    alert.textContent =
        `Tracked word: "${word}"`;

    document.body.appendChild(alert);

    requestAnimationFrame(() => {
        alert.classList.add("show");
    });

    setTimeout(() => {
        alert.classList.remove("show");

        setTimeout(() => {
            alert.remove();
        }, 200);
    }, 1100);
}


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

async function enableNotifications() {
    if (!("Notification" in window)) {
        if (notificationStatus) {
            notificationStatus.textContent =
                "Notifications are not supported in this browser.";
        }

        return;
    }

    try {
        const permission =
            await Notification.requestPermission();

        if (permission === "granted") {
            if (notificationStatus) {
                notificationStatus.textContent =
                    "Notifications are enabled.";
            }

            if (enableNotificationsButton) {
                enableNotificationsButton.textContent =
                    "✓ Notifications Enabled";

                enableNotificationsButton.classList.add(
                    "enabled"
                );
            }

        } else {
            if (notificationStatus) {
                notificationStatus.textContent =
                    "Notifications are not enabled.";
            }
        }

    } catch (error) {
        console.error(
            "Notification permission error:",
            error
        );
    }
}


function sendBrowserNotification(message) {
    if (
        !("Notification" in window) ||
        Notification.permission !== "granted"
    ) {
        return;
    }

    try {
        new Notification(
            "Speech Tracker",
            {
                body: message,
                silent: false
            }
        );
    } catch (error) {
        console.warn(
            "Could not create notification:",
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


/* ============================================================
   LIVE SPEECH RECOGNITION
   ============================================================ */

function initializeSpeechRecognition() {
    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        console.warn(
            "SpeechRecognition is not supported."
        );

        return false;
    }

    recognition =
        new SpeechRecognition();

    recognition.continuous = true;

    /*
       Interim results are CRITICAL for fast filler
       detection.

       Without interimResults, the browser waits until
       the phrase is finished before giving us text.
    */

    recognition.interimResults = true;

    recognition.lang = "en-US";

    recognition.maxAlternatives = 1;


    recognition.onstart = () => {
        console.log(
            "Live speech recognition started."
        );
    };


    recognition.onresult = event => {
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
           Keep the completed portion separately.
        */

        if (completed.trim()) {
            liveTranscript +=
                completed;

            /*
               Also check final recognition results
               immediately.
            */

            detectNewLiveFillers(
                completed
            );
        }

        /*
           Check interim text immediately.

           This is what makes "umm" and "uhhh"
           detectable before Stop.
        */

        if (interim.trim()) {
            detectNewLiveFillers(
                interim
            );
        }

        const displayText =
            `${liveTranscript} ${interim}`
                .trim();

        if (displayText) {
            renderLiveText(
                displayText
            );
        }

        fillerCount =
            countTrackedWords(
                liveTranscript + " " + interim
            );

        totalWordCount =
            countWords(
                liveTranscript + " " + interim
            );

        updateStats();
    };


    recognition.onerror = event => {
        console.warn(
            "Speech recognition error:",
            event.error
        );

        /*
           "no-speech" is normal when someone pauses.
           Do not show it as a major error.
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

        setStatus(
            "Live detection unavailable",
            "error"
        );
    };


    recognition.onend = () => {
        console.log(
            "Speech recognition ended."
        );

        /*
           Chrome can automatically stop recognition
           during a long recording.

           Restart it while the app is still listening.
        */

        if (
            isListening &&
            !isStopping
        ) {
            try {
                recognition.start();
            } catch (error) {
                console.warn(
                    "Could not restart recognition:",
                    error
                );
            }
        }
    };

    return true;
}


function renderLiveText(text) {
    if (!heardElement) return;

    heardElement.innerHTML =
        highlightTranscript(text);
}


/* ============================================================
   START RECOGNITION
   ============================================================ */

function startLiveRecognition() {
    if (!recognition) {
        initializeSpeechRecognition();
    }

    if (!recognition) {
        return;
    }

    try {
        recognition.start();
    } catch (error) {
        /*
           Recognition can throw if start() is called
           while it is already running.
        */

        console.warn(
            "Recognition start warning:",
            error
        );
    }
}


/* ============================================================
   STOP RECOGNITION
   ============================================================ */

function stopLiveRecognition() {
    if (!recognition) return;

    try {
        recognition.stop();
    } catch (error) {
        console.warn(
            "Recognition stop warning:",
            error
        );
    }
}


/* ============================================================
   MEDIA RECORDER
   ============================================================ */

function getSupportedMimeType() {
    const types = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus"
    ];

    for (const type of types) {
        if (
            MediaRecorder.isTypeSupported &&
            MediaRecorder.isTypeSupported(type)
        ) {
            return type;
        }
    }

    return "";
}


async function startRecorder() {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
            "Microphone access is not supported by this browser."
        );
    }

    const stream =
        await navigator.mediaDevices.getUserMedia({
            audio: true
        });

    audioChunks = [];

    const mimeType =
        getSupportedMimeType();

    mediaRecorder =
        mimeType
            ? new MediaRecorder(
                stream,
                { mimeType }
            )
            : new MediaRecorder(stream);

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
        250
    );

    return stream;
}


/* ============================================================
   START SPEECH
   ============================================================ */

async function startSpeech() {
    if (
        isListening ||
        isStopping ||
        isTranscribing
    ) {
        return;
    }

    /*
       IMPORTANT:

       Starting a new speech completely clears
       the previous speech.

       This prevents the Analyze button from
       accidentally using old transcript data.
    */

    resetCurrentSpeech();

    isListening = true;
    isStopping = false;
    isTranscribing = false;

    speechStartedAt =
        Date.now();

    notifiedWords.clear();

    setStatus(
        "Listening",
        "listening"
    );

    updateButtonStates();

    startTimer();

    if (heardElement) {
        heardElement.innerHTML =
            '<span class="transcript-placeholder">Listening...</span>';
    }

    try {
        await startRecorder();

        startLiveRecognition();

    } catch (error) {
        console.error(
            "Could not start microphone:",
            error
        );

        isListening = false;

        stopTimer();

        setStatus(
            "Microphone error",
            "error"
        );

        if (heardElement) {
            heardElement.textContent =
                error.message ||
                "Could not access the microphone.";
        }

        updateButtonStates();
    }
}


/* ============================================================
   STOP SPEECH
   ============================================================ */

async function stopSpeech() {
    if (
        !isListening ||
        isStopping
    ) {
        return;
    }

    isStopping = true;

    setStatus(
        "Finishing speech...",
        "ready"
    );

    updateButtonStates();

    stopTimer();

    /*
       Stop live recognition FIRST.

       We don't want recognition from the old speech
       leaking into the next speech.
    */

    stopLiveRecognition();

    /*
       Give the browser a moment to deliver its final
       recognition result.

       This is deliberately short.
    */

    await new Promise(resolve =>
        setTimeout(resolve, 150)
    );

    isListening = false;

    /*
       Finish the MediaRecorder.
    */

    let audioBlob = null;

    try {
        audioBlob =
            await stopRecorder();

    } catch (error) {
        console.error(
            "Could not stop recorder:",
            error
        );
    }

    /*
       Save the live transcript while it is still
       available.

       This means the UI does not have to wait for
       OpenAI before showing the live transcript.
    */

    const liveFinal =
        liveTranscript.trim();

    if (liveFinal) {
        finalTranscript =
            liveFinal;
    }

    renderFinalTranscript();

    /*
       If there is no audio or transcript, don't try
       to analyze anything.
    */

    if (
        !audioBlob &&
        !finalTranscript.trim()
    ) {
        isStopping = false;
        setStatus(
            "No speech detected",
            "error"
        );

        updateButtonStates();

        return;
    }

    /*
       If we have an audio recording, send it to
       the transcription endpoint.

       The Analyze button remains disabled until
       this finishes.
    */

    if (audioBlob) {
        isTranscribing = true;

        setStatus(
            "Creating final transcript...",
            "ready"
        );

        updateButtonStates();

        try {
            const transcription =
                await transcribeAudio(
                    audioBlob
                );

            if (
                transcription &&
                transcription.trim()
            ) {
                finalTranscript =
                    transcription.trim();
            }

        } catch (error) {
            console.error(
                "Final transcription failed:",
                error
            );

            /*
               Keep the live transcript as a fallback.

               This is important because the user can
               still analyze what the browser heard.
            */
        }
    }

    isTranscribing = false;
    isStopping = false;

    /*
       Recalculate stats using the FINAL transcript.
    */

    fillerCount =
        countTrackedWords(
            finalTranscript
        );

    totalWordCount =
        countWords(
            finalTranscript
        );

    updateStats();

    renderFinalTranscript();

    /*
       THIS IS THE IMPORTANT FIX.

       Analyze is now enabled ONLY because a real
       final transcript exists.
    */

    if (finalTranscript.trim()) {
        setStatus(
            "Speech complete",
            "ready"
        );
    } else {
        setStatus(
            "Transcript unavailable",
            "error"
        );
    }

    updateButtonStates();

    console.log(
        "Final transcript ready:",
        finalTranscript
    );
}


/* ============================================================
   STOP RECORDER
   ============================================================ */

function stopRecorder() {
    return new Promise(resolve => {
        if (!mediaRecorder) {
            resolve(null);
            return;
        }

        const recorder =
            mediaRecorder;

        const stream =
            recorder.stream;

        recorder.onstop = () => {
            const mimeType =
                recorder.mimeType ||
                "audio/webm";

            const blob =
                audioChunks.length
                    ? new Blob(
                        audioChunks,
                        {
                            type: mimeType
                        }
                    )
                    : null;

            audioChunks = [];

            /*
               Release microphone.
            */

            try {
                stream
                    ?.getTracks()
                    ?.forEach(track =>
                        track.stop()
                    );
            } catch (error) {
                console.warn(
                    "Could not stop microphone tracks:",
                    error
                );
            }

            mediaRecorder = null;

            resolve(blob);
        };

        try {
            recorder.stop();
        } catch (error) {
            console.warn(
                "Recorder stop error:",
                error
            );

            resolve(null);
        }
    });
}


/* ============================================================
   TRANSCRIPTION API
   ============================================================ */

async function transcribeAudio(blob) {
    if (!blob) {
        return "";
    }

    const formData =
        new FormData();

    formData.append(
        "audio",
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

    const responseText =
        await response.text();

    if (!response.ok) {
        throw new Error(
            `Transcription failed: ${response.status} ${responseText}`
        );
    }

    let data;

    try {
        data =
            JSON.parse(responseText);
    } catch (error) {
        throw new Error(
            "Transcription API returned invalid JSON."
        );
    }

    /*
       Support several possible response shapes
       so this works with the versions we've used.
    */

    const text =
        data?.text ||
        data?.transcript ||
        data?.transcription ||
        data?.data?.text ||
        "";

    return String(text).trim();
}


/* ============================================================
   TIMER
   ============================================================ */

function startTimer() {
    if (!recordingTimer) return;

    recordingTimer.textContent =
        "00:00";

    clearInterval(
        speechTimerInterval
    );

    speechTimerInterval =
        setInterval(() => {
            if (!speechStartedAt) {
                return;
            }

            const elapsed =
                Math.floor(
                    (Date.now() -
                        speechStartedAt) /
                    1000
                );

            const minutes =
                Math.floor(
                    elapsed / 60
                );

            const seconds =
                elapsed % 60;

            recordingTimer.textContent =
                `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

        }, 250);
}


function stopTimer() {
    clearInterval(
        speechTimerInterval
    );

    speechTimerInterval = null;
}


/* ============================================================
   ANALYZE SPEECH
   ============================================================ */

async function analyzeSpeech() {
    /*
       HARD GUARD:

       Never allow analysis before the speech is
       completely finished.
    */

    if (
        isListening ||
        isStopping ||
        isTranscribing
    ) {
        console.warn(
            "Analysis blocked because speech is still being processed."
        );

        return;
    }

    /*
       HARD GUARD:

       Never send an empty transcript.
    */

    const transcript =
        finalTranscript.trim();

    if (!transcript) {
        console.warn(
            "Analysis blocked because there is no transcript."
        );

        if (analysisElement) {
            analysisElement.innerHTML =
                "<p>Please finish a speech before analyzing it.</p>";
        }

        return;
    }

    if (isAnalyzing) {
        return;
    }

    isAnalyzing = true;

    /*
       Only NOW should the loading state begin.
    */

    if (analysisLoading) {
        analysisLoading.hidden = false;

        analysisLoading.textContent =
            "Analyzing your speech...";
    }

    if (analysisElement) {
        analysisElement.innerHTML = "";
    }

    if (analyzeButton) {
        analyzeButton.disabled = true;

        analyzeButton.textContent =
            "Analyzing...";
    }

    setStatus(
        "Analyzing speech...",
        "ready"
    );

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
                    body: JSON.stringify({
                        transcript
                    })
                }
            );

        const responseText =
            await response.text();

        console.log(
            "Analyze API status:",
            response.status
        );

        console.log(
            "Analyze API response:",
            responseText
        );

        if (!response.ok) {
            throw new Error(
                `Analysis failed (${response.status}): ${responseText}`
            );
        }

        let data;

        try {
            data =
                JSON.parse(responseText);
        } catch (error) {
            throw new Error(
                "The analysis API returned invalid JSON."
            );
        }

        /*
           Prefer the structured analysisData
           returned by the new API.
        */

        const analysisData =
            data?.analysisData ||
            data?.analysis ||
            null;

        if (!analysisData) {
            throw new Error(
                "The AI returned no analysis."
            );
        }

        currentAnalysis =
            analysisData;

        renderAnalysis(
            analysisData
        );

        setStatus(
            "Analysis complete",
            "ready"
        );

    } catch (error) {
        console.error(
            "Speech analysis error:",
            error
        );

        if (analysisElement) {
            analysisElement.innerHTML = `
                <div class="analysis-error">
                    <strong>Analysis couldn't be completed.</strong>
                    <p>${escapeHTML(
                        error.message ||
                        "Unknown analysis error."
                    )}</p>
                    <p>Please try again.</p>
                </div>
            `;
        }

        setStatus(
            "Analysis failed",
            "error"
        );

    } finally {
        /*
           THIS IS ANOTHER IMPORTANT FIX.

           The loading state is ALWAYS removed,
           even if OpenAI returns an error.
        */

        isAnalyzing = false;

        if (analysisLoading) {
            analysisLoading.hidden = true;
        }

        if (analyzeButton) {
            analyzeButton.disabled =
                !finalTranscript.trim();

            analyzeButton.textContent =
                "🤖 Analyze My Speech";
        }

        updateButtonStates();
    }
}


/* ============================================================
   RENDER AI ANALYSIS
   ============================================================ */

function renderAnalysis(data) {
    if (!analysisElement) return;

    /*
       If the API returns the old formatted string,
       still display it safely.
    */

    if (typeof data === "string") {
        analysisElement.innerHTML = `
            <div class="analysis-section">
                ${escapeHTML(data)
                    .replace(/\n/g, "<br>")}
            </div>
        `;

        return;
    }

    const sections = [
        {
            key: "overall",
            title: "Overall",
            icon: "◎"
        },
        {
            key: "speechSections",
            title: "Speech Breakdown",
            icon: "▤"
        },
        {
            key: "fillerWords",
            title: "Filler Words",
            icon: "!"
        },
        {
            key: "clarity",
            title: "Clarity",
            icon: "◌"
        },
        {
            key: "strength",
            title: "What You Did Well",
            icon: "✓"
        },
        {
            key: "improvement",
            title: "Main Improvement",
            icon: "↗"
        },
        {
            key: "tips",
            title: "AI Tips",
            icon: "★"
        },
        {
            key: "tip",
            title: "Quick Tip",
            icon: "→"
        }
    ];

    let html = "";

    for (const section of sections) {
        const value =
            data[section.key];

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            continue;
        }

        html += `
            <div class="analysis-section">
                <div class="analysis-section-title">
                    <span class="analysis-icon">
                        ${section.icon}
                    </span>

                    <span>
                        ${escapeHTML(section.title)}
                    </span>
                </div>

                <div class="analysis-section-content">
                    ${formatAnalysisValue(value)}
                </div>
            </div>
        `;
    }

    /*
       If none of the expected fields exist,
       display the returned object rather than
       showing a blank analysis.
    */

    if (!html) {
        html = `
            <div class="analysis-section">
                <div class="analysis-section-content">
                    ${escapeHTML(
                        JSON.stringify(
                            data,
                            null,
                            2
                        )
                    )}
                </div>
            </div>
        `;
    }

    analysisElement.innerHTML =
        html;
}


function formatAnalysisValue(value) {
    if (Array.isArray(value)) {
        return `
            <div class="analysis-list">
                ${value.map(item => `
                    <div class="analysis-list-item">
                        <span>•</span>
                        <div>
                            ${formatAnalysisValue(item)}
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    }

    if (
        typeof value === "object" &&
        value !== null
    ) {
        return Object.entries(value)
            .map(([key, val]) => `
                <div class="analysis-subsection">
                    <strong>
                        ${escapeHTML(
                            formatKey(key)
                        )}
                    </strong>

                    <div>
                        ${formatAnalysisValue(val)}
                    </div>
                </div>
            `)
            .join("");
    }

    return escapeHTML(
        String(value)
    ).replace(
        /\n/g,
        "<br>"
    );
}


function formatKey(key) {
    return String(key)
        .replace(
            /([A-Z])/g,
            " $1"
        )
        .replace(
            /^./,
            char => char.toUpperCase()
        );
}


/* ============================================================
   ANALYZE BUTTON
   ============================================================ */

if (analyzeButton) {
    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );
}


/* ============================================================
   LISTEN / STOP BUTTONS
   ============================================================ */

if (listenButton) {
    listenButton.addEventListener(
        "click",
        startSpeech
    );
}

if (stopButton) {
    stopButton.addEventListener(
        "click",
        stopSpeech
    );
}


/* ============================================================
   CUSTOM WORDS
   ============================================================ */

function renderWordList() {
    if (!wordList) return;

    wordList.innerHTML = "";

    trackedWords.forEach((word, index) => {
        const tag =
            document.createElement("span");

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

                saveTrackedWords();

                renderWordList();
            }
        );

        tag.appendChild(text);
        tag.appendChild(remove);

        wordList.appendChild(tag);
    });
}


function addTrackedWord() {
    if (!customWordInput) return;

    const word =
        customWordInput.value
            .trim()
            .toLowerCase();

    if (!word) {
        return;
    }

    if (
        trackedWords.includes(word)
    ) {
        customWordInput.value = "";

        return;
    }

    trackedWords.push(word);

    saveTrackedWords();

    customWordInput.value = "";

    renderWordList();
}


function resetTrackedWords() {
    trackedWords =
        [...DEFAULT_WORDS];

    saveTrackedWords();

    renderWordList();
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


/* ============================================================
   SAVED SPEECHES
   ============================================================ */

/*
   IMPORTANT:

   Every saved speech gets its own complete snapshot.

   We NEVER store references to the current speech object.

   This fixes the bug where opening an older speech
   displayed the current speech.
*/

function createSpeechSnapshot() {
    return {
        id:
            crypto?.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,

        createdAt:
            new Date().toISOString(),

        transcript:
            String(finalTranscript),

        fillerCount:
            Number(fillerCount),

        wordCount:
            Number(totalWordCount),

        trackedWords:
            [...trackedWords],

        analysis:
            currentAnalysis
                ? structuredCloneSafe(
                    currentAnalysis
                )
                : null
    };
}


function structuredCloneSafe(value) {
    try {
        return JSON.parse(
            JSON.stringify(value)
        );
    } catch {
        return value;
    }
}


function saveCurrentSpeech() {
    if (!finalTranscript.trim()) {
        return;
    }

    const speech =
        createSpeechSnapshot();

    savedSpeeches.unshift(
        speech
    );

    /*
       Keep the list manageable.
    */

    if (savedSpeeches.length > 50) {
        savedSpeeches =
            savedSpeeches.slice(0, 50);
    }

    saveSpeechesToStorage();

    currentSpeechId =
        speech.id;

    renderSavedSpeeches();

    showFillerFlash(
        "Speech saved"
    );
}


function renderSavedSpeeches() {
    if (!savedSpeechesElement) {
        return;
    }

    if (!savedSpeeches.length) {
        savedSpeechesElement.innerHTML = `
            <div class="saved-empty">
                No saved speeches yet.
            </div>
        `;

        return;
    }

    savedSpeechesElement.innerHTML =
        savedSpeeches.map(
            speech => {
                const date =
                    new Date(
                        speech.createdAt
                    );

                const preview =
                    speech.transcript
                        .slice(0, 100);

                return `
                    <button
                        type="button"
                        class="saved-speech"
                        data-speech-id="${escapeHTML(
                            speech.id
                        )}"
                    >
                        <span class="saved-speech-main">
                            <strong>
                                ${escapeHTML(
                                    date.toLocaleString()
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    preview
                                )}${speech.transcript.length > 100 ? "..." : ""}
                            </span>
                        </span>

                        <span class="saved-speech-arrow">
                            →
                        </span>
                    </button>
                `;
            }
        )
        .join("");

    savedSpeechesElement
        .querySelectorAll(
            ".saved-speech"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const id =
                        button.dataset.speechId;

                    openSavedSpeech(id);
                }
            );
        });
}


function openSavedSpeech(id) {
    const speech =
        savedSpeeches.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!speech) {
        console.warn(
            "Saved speech not found:",
            id
        );

        return;
    }

    /*
       IMPORTANT:

       Copy the saved data into the current
       display state.

       Do NOT point currentSpeech at the saved
       object itself.
    */

    currentSpeechId =
        speech.id;

    finalTranscript =
        String(
            speech.transcript || ""
        );

    liveTranscript =
        finalTranscript;

    fillerCount =
        Number(
            speech.fillerCount || 0
        );

    totalWordCount =
        Number(
            speech.wordCount || 0
        );

    currentAnalysis =
        structuredCloneSafe(
            speech.analysis
        );

    renderFinalTranscript();

    if (heardElement) {
        heardElement.innerHTML =
            highlightTranscript(
                finalTranscript
            );
    }

    updateStats();

    if (currentAnalysis) {
        renderAnalysis(
            currentAnalysis
        );
    } else if (analysisElement) {
        analysisElement.innerHTML = "";
    }

    updateButtonStates();

    setStatus(
        "Saved speech opened",
        "ready"
    );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function deleteSavedSpeech(id) {
    savedSpeeches =
        savedSpeeches.filter(
            speech =>
                String(speech.id) !==
                String(id)
        );

    saveSpeechesToStorage();

    renderSavedSpeeches();
}


/* ============================================================
   SAVE SPEECH BUTTON
   ============================================================ */

if (saveSpeechButton) {
    saveSpeechButton.addEventListener(
        "click",
        saveCurrentSpeech
    );
}


/* ============================================================
   OPTIONAL SAVE PROMPT
   ============================================================ */

function showSavePrompt() {
    /*
       If the new UI has a save prompt container,
       activate it.

       Otherwise do nothing.
    */

    const savePrompt =
        firstExisting(
            "saveSpeechPrompt",
            "savePrompt"
        );

    if (!savePrompt) {
        return;
    }

    savePrompt.hidden = false;
    savePrompt.classList.add(
        "visible"
    );
}


function hideSavePrompt() {
    const savePrompt =
        firstExisting(
            "saveSpeechPrompt",
            "savePrompt"
        );

    if (!savePrompt) {
        return;
    }

    savePrompt.hidden = true;
    savePrompt.classList.remove(
        "visible"
    );
}


const saveYesButton =
    firstExisting(
        "saveYes",
        "saveSpeechYes",
        "confirmSaveSpeech"
    );

const saveNoButton =
    firstExisting(
        "saveNo",
        "saveSpeechNo",
        "cancelSaveSpeech"
    );


if (saveYesButton) {
    saveYesButton.addEventListener(
        "click",
        () => {
            saveCurrentSpeech();
            hideSavePrompt();
        }
    );
}


if (saveNoButton) {
    saveNoButton.addEventListener(
        "click",
        hideSavePrompt
    );
}


/* ============================================================
   OPTIONAL DELETE ALL SAVED SPEECHES
   ============================================================ */

if (deleteSavedSpeechesButton) {
    deleteSavedSpeechesButton.addEventListener(
        "click",
        () => {
            if (!savedSpeeches.length) {
                return;
            }

            const confirmed =
                window.confirm(
                    "Delete all saved speeches?"
                );

            if (!confirmed) {
                return;
            }

            savedSpeeches = [];

            saveSpeechesToStorage();

            renderSavedSpeeches();
        }
    );
}


/* ============================================================
   CHECKMARK / X SAVE PROMPT AFTER SPEECH
   ============================================================ */

function showFinishedSpeechPrompt() {
    const prompt =
        firstExisting(
            "saveSpeechPrompt",
            "savePrompt",
            "speechFinishedPrompt"
        );

    if (!prompt) {
        return;
    }

    prompt.hidden = false;

    requestAnimationFrame(() => {
        prompt.classList.add(
            "visible"
        );
    });
}


/* ============================================================
   SCROLL PROMPT
   ============================================================ */

if (scrollPrompt) {
    scrollPrompt.addEventListener(
        "click",
        () => {
            window.scrollBy({
                top: window.innerHeight * 0.75,
                behavior: "smooth"
            });
        }
    );
}


/* ============================================================
   INITIALIZATION
   ============================================================ */

function initialize() {
    initializeTheme();

    renderWordList();

    renderSavedSpeeches();

    initializeSpeechRecognition();

    updateStats();

    updateButtonStates();

    setStatus(
        "Ready",
        "ready"
    );

    /*
       Make sure analysis is hidden on initial load.
    */

    if (analysisLoading) {
        analysisLoading.hidden = true;
    }

    /*
       Analyze MUST start disabled.

       It becomes enabled only after Stop has produced
       finalTranscript.
    */

    if (analyzeButton) {
        analyzeButton.disabled = true;
    }

    console.log(
        "Speech Tracker initialized."
    );
}


if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initialize
    );
} else {
    initialize();
}


/* ============================================================
   PAGE VISIBILITY
   ============================================================ */

document.addEventListener(
    "visibilitychange",
    () => {
        /*
           Don't let the browser accidentally keep
           recording if the page becomes hidden.
        */

        if (
            document.hidden &&
            isListening
        ) {
            console.log(
                "Page hidden while recording."
            );
        }
    }
);


/* ============================================================
   DEBUG HELPERS
   ============================================================ */

window.speechTrackerDebug = {
    getState() {
        return {
            isListening,
            isStopping,
            isTranscribing,
            isAnalyzing,
            liveTranscript,
            finalTranscript,
            fillerCount,
            totalWordCount,
            trackedWords,
            savedSpeeches
        };
    },

    getTranscript() {
        return finalTranscript;
    },

    reset() {
        resetCurrentSpeech();
    }
};