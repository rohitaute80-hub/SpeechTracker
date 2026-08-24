/* =========================================================
   SPEECH TRACKER
   Complete replacement script.js

   FEATURES
   ---------------------------------------------------------
   • Live speech recognition
   • Fast interim filler detection
   • UM / UMM / UMMM / UMMMM detection
   • UH / UHH / UHHH / UHHHH detection
   • Duplicate filler protection
   • Custom tracked words
   • Vibration
   • Browser notifications
   • OpenAI final transcription
   • OpenAI speech analysis
   • Word count
   • Filler count
   • Filler percentage
   • Recording timer
   • Live transcript
   • Final transcript
   • Persistent custom words
   • Mobile-friendly
   ========================================================= */


/* =========================================================
   CONFIG
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

const STORAGE_KEY = "speechTrackerCustomWords";

const TRANSCRIBE_ENDPOINT = "/api/transcribe";
const ANALYZE_ENDPOINT = "/api/analyze";


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

const heardText = document.getElementById("heardText");

const listenButton = document.getElementById("listenButton");
const stopButton = document.getElementById("stopButton");

const fillerCountElement = document.getElementById("fillerCount");
const wordCountElement = document.getElementById("wordCount");

const customWordInput = document.getElementById("customWordInput");
const addWordButton = document.getElementById("addWordButton");

const wordList = document.getElementById("wordList");
const resetWordsButton = document.getElementById("resetWordsButton");

const analyzeButton = document.getElementById("analyzeButton");
const analysisLoading = document.getElementById("analysisLoading");
const analysisElement = document.getElementById("analysis");

const transcriptSection = document.getElementById("transcriptSection");
const finalTranscriptElement = document.getElementById("finalTranscript");

const scrollPrompt = document.getElementById("scrollPrompt");

const enableNotificationsButton =
    document.getElementById("enableNotificationsButton");

const notificationStatus =
    document.getElementById("notificationStatus");

const recordingTimer =
    document.getElementById("recordingTimer");


/* =========================================================
   STATE
   ========================================================= */

let isRecording = false;

let recognition = null;
let mediaRecorder = null;

let audioChunks = [];

let recordingStartTime = null;
let timerInterval = null;

let fillerCount = 0;
let wordCount = 0;

let liveTranscript = "";
let finalTranscript = "";

let customWords = [];

let trackedWords = [...DEFAULT_WORDS];

let detectedRecently = new Map();

let recognitionSupported = false;

let microphoneStream = null;


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", initialize);

if (document.readyState !== "loading") {
    initialize();
}


function initialize() {
    loadWords();
    renderWordList();
    setupSpeechRecognition();
    setupEventListeners();
    updateStats();
    updateNotificationStatus();
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEventListeners() {

    if (listenButton) {
        listenButton.addEventListener("click", startRecording);
    }

    if (stopButton) {
        stopButton.addEventListener("click", stopRecording);
    }

    if (addWordButton) {
        addWordButton.addEventListener("click", addCustomWord);
    }

    if (customWordInput) {
        customWordInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                addCustomWord();
            }
        });
    }

    if (resetWordsButton) {
        resetWordsButton.addEventListener("click", resetWords);
    }

    if (analyzeButton) {
        analyzeButton.addEventListener("click", analyzeSpeech);
    }

    if (enableNotificationsButton) {
        enableNotificationsButton.addEventListener(
            "click",
            requestNotificationPermission
        );
    }
}


/* =========================================================
   WORD STORAGE
   ========================================================= */

function loadWords() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            const parsed = JSON.parse(saved);

            if (Array.isArray(parsed)) {
                customWords = parsed
                    .map(word => String(word).trim().toLowerCase())
                    .filter(Boolean);
            }
        }
    } catch (error) {
        console.warn("Could not load saved words:", error);
        customWords = [];
    }

    trackedWords = [
        ...DEFAULT_WORDS,
        ...customWords
    ];
}


function saveWords() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(customWords)
        );
    } catch (error) {
        console.warn("Could not save words:", error);
    }
}


function addCustomWord() {
    if (!customWordInput) return;

    const word = customWordInput.value
        .trim()
        .toLowerCase();

    if (!word) return;

    if (
        trackedWords.some(
            existing => existing.toLowerCase() === word
        )
    ) {
        customWordInput.value = "";
        return;
    }

    customWords.push(word);

    trackedWords = [
        ...DEFAULT_WORDS,
        ...customWords
    ];

    saveWords();
    renderWordList();

    customWordInput.value = "";
}


function removeCustomWord(word) {
    customWords = customWords.filter(
        item => item !== word
    );

    trackedWords = [
        ...DEFAULT_WORDS,
        ...customWords
    ];

    saveWords();
    renderWordList();
}


function resetWords() {
    customWords = [];

    trackedWords = [
        ...DEFAULT_WORDS
    ];

    saveWords();
    renderWordList();
}


function renderWordList() {
    if (!wordList) return;

    wordList.innerHTML = "";

    trackedWords.forEach(word => {

        const item = document.createElement("div");
        item.className = "word-item";

        const text = document.createElement("span");
        text.textContent = word;

        item.appendChild(text);

        if (customWords.includes(word)) {

            const removeButton =
                document.createElement("button");

            removeButton.type = "button";
            removeButton.textContent = "×";
            removeButton.setAttribute(
                "aria-label",
                `Remove ${word}`
            );

            removeButton.addEventListener(
                "click",
                () => removeCustomWord(word)
            );

            item.appendChild(removeButton);
        }

        wordList.appendChild(item);
    });
}


/* =========================================================
   SPEECH RECOGNITION
   ========================================================= */

function setupSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        recognitionSupported = false;

        setStatus(
            "Live speech recognition is not supported in this browser.",
            false
        );

        return;
    }

    recognitionSupported = true;

    recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;


    recognition.onstart = () => {

        if (!isRecording) return;

        setStatus(
            "Listening...",
            true
        );
    };


    recognition.onresult = (event) => {

        if (!isRecording) return;

        let interim = "";
        let newlyFinal = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            const result = event.results[i];

            const transcript =
                result[0]?.transcript || "";

            if (result.isFinal) {
                newlyFinal += transcript + " ";
            } else {
                interim += transcript;
            }
        }

        if (newlyFinal) {

            liveTranscript +=
                newlyFinal;

            detectFillers(
                newlyFinal,
                true
            );
        }

        const displayText =
            liveTranscript + interim;

        updateLiveTranscript(displayText);

        updateWordCount(displayText);
    };


    recognition.onerror = (event) => {

        console.warn(
            "Speech recognition error:",
            event.error
        );

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {

            setStatus(
                "Microphone permission was denied.",
                false
            );

            return;
        }

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
            "Speech recognition error. Try again.",
            false
        );
    };


    recognition.onend = () => {

        /*
         * Chrome sometimes automatically stops
         * recognition even while the user is still
         * recording. Restart it automatically.
         */

        if (isRecording) {

            try {
                recognition.start();
            } catch (error) {
                // Already running — ignore.
            }
        }
    };
}


/* =========================================================
   START RECORDING
   ========================================================= */

async function startRecording() {

    if (isRecording) return;

    resetSession();

    isRecording = true;

    setStatus(
        "Starting...",
        true
    );

    updateButtons();

    startTimer();

    try {

        microphoneStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

        isRecording = false;

        stopTimer();

        updateButtons();

        setStatus(
            "Couldn't access microphone.",
            false
        );

        return;
    }


    /* -----------------------------------------
       MediaRecorder
       ----------------------------------------- */

    try {

        const mimeTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4",
            "audio/ogg"
        ];

        let selectedMimeType = "";

        for (const type of mimeTypes) {

            if (
                window.MediaRecorder &&
                MediaRecorder.isTypeSupported(type)
            ) {
                selectedMimeType = type;
                break;
            }
        }

        if (selectedMimeType) {

            mediaRecorder =
                new MediaRecorder(
                    microphoneStream,
                    {
                        mimeType: selectedMimeType
                    }
                );

        } else {

            mediaRecorder =
                new MediaRecorder(
                    microphoneStream
                );
        }


        audioChunks = [];


        mediaRecorder.ondataavailable =
            (event) => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {
                    audioChunks.push(
                        event.data
                    );
                }
            };


        mediaRecorder.start();

    } catch (error) {

        console.warn(
            "MediaRecorder unavailable:",
            error
        );
    }


    /* -----------------------------------------
       SpeechRecognition
       ----------------------------------------- */

    if (
        recognitionSupported &&
        recognition
    ) {

        try {

            recognition.start();

        } catch (error) {

            console.warn(
                "Recognition start error:",
                error
            );
        }
    }


    setStatus(
        "Listening...",
        true
    );
}


/* =========================================================
   STOP RECORDING
   ========================================================= */

async function stopRecording() {

    if (!isRecording) return;

    isRecording = false;

    setStatus(
        "Processing...",
        false
    );

    stopTimer();

    updateButtons();


    /* -----------------------------------------
       Stop speech recognition
       ----------------------------------------- */

    if (recognition) {

        try {
            recognition.stop();
        } catch (error) {
            // Ignore if already stopped.
        }
    }


    /* -----------------------------------------
       Stop MediaRecorder
       ----------------------------------------- */

    let audioBlob = null;

    if (mediaRecorder) {

        audioBlob =
            await stopMediaRecorder();

    }


    /* -----------------------------------------
       Stop microphone
       ----------------------------------------- */

    if (microphoneStream) {

        microphoneStream
            .getTracks()
            .forEach(track => track.stop());

        microphoneStream = null;
    }


    /* -----------------------------------------
       Final transcription
       ----------------------------------------- */

    if (audioBlob) {

        try {

            await transcribeAudio(
                audioBlob
            );

        } catch (error) {

            console.error(
                "Transcription error:",
                error
            );

            /*
             * If transcription fails,
             * keep the live transcript.
             */

            if (!finalTranscript) {
                finalTranscript =
                    liveTranscript;
            }

            showFinalTranscript(
                finalTranscript
            );
        }

    } else {

        finalTranscript =
            liveTranscript;

        showFinalTranscript(
            finalTranscript
        );
    }


    updateWordCount(
        finalTranscript ||
        liveTranscript
    );

    setStatus(
        "Finished",
        false
    );

    updateButtons();
}


/* =========================================================
   STOP MEDIA RECORDER
   ========================================================= */

function stopMediaRecorder() {

    return new Promise((resolve) => {

        if (!mediaRecorder) {
            resolve(null);
            return;
        }

        const recorder =
            mediaRecorder;

        recorder.onstop = () => {

            try {

                const blob =
                    new Blob(
                        audioChunks,
                        {
                            type:
                                recorder.mimeType ||
                                "audio/webm"
                        }
                    );

                resolve(blob);

            } catch (error) {

                console.error(
                    "Could not create audio blob:",
                    error
                );

                resolve(null);
            }

            mediaRecorder = null;
        };


        try {

            recorder.stop();

        } catch (error) {

            console.warn(
                "MediaRecorder stop error:",
                error
            );

            resolve(null);
        }
    });
}


/* =========================================================
   OPENAI TRANSCRIPTION
   ========================================================= */

async function transcribeAudio(audioBlob) {

    if (!audioBlob) {
        return;
    }

    setStatus(
        "Transcribing...",
        false
    );


    const formData =
        new FormData();


    /*
     * Most browsers produce WebM.
     * Your Vercel API can send this to OpenAI.
     */

    let extension = "webm";

    if (
        audioBlob.type.includes("mp4")
    ) {
        extension = "mp4";
    }

    if (
        audioBlob.type.includes("ogg")
    ) {
        extension = "ogg";
    }


    const audioFile =
        new File(
            [audioBlob],
            `speech.${extension}`,
            {
                type:
                    audioBlob.type ||
                    "audio/webm"
            }
        );


    formData.append(
        "file",
        audioFile
    );


    const response =
        await fetch(
            TRANSCRIBE_ENDPOINT,
            {
                method: "POST",
                body: formData
            }
        );


    if (!response.ok) {

        const errorText =
            await response.text();

        throw new Error(
            `Transcription failed (${response.status}): ${errorText}`
        );
    }


    const data =
        await response.json();


    /*
     * Support several common response formats.
     */

    const transcript =
        data.text ||
        data.transcript ||
        data.result?.text ||
        data.result?.transcript ||
        "";


    if (!transcript) {

        throw new Error(
            "Transcription API returned no transcript."
        );
    }


    finalTranscript =
        transcript.trim();


    showFinalTranscript(
        finalTranscript
    );


    /*
     * Recalculate fillers from the final,
     * more accurate OpenAI transcript.
     */

    recalculateStats(
        finalTranscript
    );


    return finalTranscript;
}


/* =========================================================
   LIVE FILLER DETECTION
   ========================================================= */

function detectFillers(text, allowDuplicateProtection = true) {

    if (!text) return;

    const normalized =
        normalizeText(text);


    /*
     * First detect multi-word phrases.
     * Example:
     * "you know"
     */

    const multiWordWords =
        trackedWords
            .filter(word => word.includes(" "))
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    for (const phrase of multiWordWords) {

        const escaped =
            escapeRegex(phrase);

        const regex =
            new RegExp(
                `\\b${escaped}\\b`,
                "gi"
            );

        let match;

        while (
            (match = regex.exec(normalized))
            !== null
        ) {

            registerFiller(
                phrase,
                allowDuplicateProtection
            );
        }
    }


    /*
     * Detect single words.
     */

    const singleWords =
        trackedWords
            .filter(word => !word.includes(" "))
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    for (const word of singleWords) {

        /*
         * Special handling for:
         *
         * um
         * umm
         * ummm
         * ummmm
         *
         * uh
         * uhh
         * uhhh
         * uhhhh
         */

        if (
            word === "um" ||
            word === "uh" ||
            /^um+$/.test(word) ||
            /^uh+$/.test(word)
        ) {

            detectUMUH(
                normalized,
                word,
                allowDuplicateProtection
            );

            continue;
        }


        const escaped =
            escapeRegex(word);

        const regex =
            new RegExp(
                `\\b${escaped}\\b`,
                "gi"
            );

        let match;

        while (
            (match = regex.exec(normalized))
            !== null
        ) {

            registerFiller(
                word,
                allowDuplicateProtection
            );
        }
    }
}


/* =========================================================
   SPECIAL UM / UH DETECTION
   ========================================================= */

function detectUMUH(
    text,
    configuredWord,
    allowDuplicateProtection
) {

    let pattern = null;

    if (
        configuredWord === "um" ||
        configuredWord.startsWith("um")
    ) {

        pattern = /\bum+\b/gi;
    }

    if (
        configuredWord === "uh" ||
        configuredWord.startsWith("uh")
    ) {

        pattern = /\buh+\b/gi;
    }

    if (!pattern) return;


    let match;

    while (
        (match = pattern.exec(text))
        !== null
    ) {

        const detected =
            match[0].toLowerCase();


        /*
         * Only count if the detected form
         * is one of the tracked forms or if
         * the base form is tracked.
         */

        const shouldTrack =
            trackedWords.some(word => {

                if (
                    word === "um" &&
                    /^um+$/.test(detected)
                ) {
                    return true;
                }

                if (
                    word === "uh" &&
                    /^uh+$/.test(detected)
                ) {
                    return true;
                }

                return word === detected;
            });


        if (shouldTrack) {

            registerFiller(
                detected,
                allowDuplicateProtection
            );
        }
    }
}


/* =========================================================
   REGISTER FILLER
   ========================================================= */

function registerFiller(
    word,
    allowDuplicateProtection = true
) {

    const now =
        Date.now();


    /*
     * Prevent the same recognition result
     * from being counted multiple times.
     */

    if (allowDuplicateProtection) {

        const lastTime =
            detectedRecently.get(word) || 0;


        /*
         * A filler cannot be counted again
         * within 700ms.
         */

        if (
            now - lastTime < 700
        ) {
            return;
        }


        detectedRecently.set(
            word,
            now
        );
    }


    fillerCount++;

    updateStats();

    showFillerFeedback(word);

    vibrate();

    sendNotification(word);
}


/* =========================================================
   FINAL STAT RE-CALCULATION
   ========================================================= */

function recalculateStats(text) {

    fillerCount = 0;

    detectedRecently.clear();

    if (!text) {
        updateStats();
        return;
    }


    const normalized =
        normalizeText(text);


    /*
     * Count multi-word fillers.
     */

    const multiWordWords =
        trackedWords
            .filter(word => word.includes(" "))
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    for (const phrase of multiWordWords) {

        const regex =
            new RegExp(
                `\\b${escapeRegex(phrase)}\\b`,
                "gi"
            );

        const matches =
            normalized.match(regex);

        if (matches) {
            fillerCount +=
                matches.length;
        }
    }


    /*
     * Count single-word fillers.
     */

    const singleWords =
        trackedWords
            .filter(word => !word.includes(" "));


    for (const word of singleWords) {

        if (
            word === "um" ||
            word === "uh"
        ) {

            const pattern =
                word === "um"
                    ? /\bum+\b/gi
                    : /\buh+\b/gi;

            const matches =
                normalized.match(pattern);

            if (matches) {

                fillerCount +=
                    matches.filter(
                        detected =>
                            /^um+$/.test(
                                detected
                            ) ||
                            /^uh+$/.test(
                                detected
                            )
                    ).length;
            }

            continue;
        }


        const regex =
            new RegExp(
                `\\b${escapeRegex(word)}\\b`,
                "gi"
            );

        const matches =
            normalized.match(regex);

        if (matches) {
            fillerCount +=
                matches.length;
        }
    }


    updateWordCount(text);
    updateStats();
}


/* =========================================================
   TRANSCRIPT DISPLAY
   ========================================================= */

function updateLiveTranscript(text) {

    if (!heardText) return;

    heardText.textContent =
        text || "Listening...";
}


function showFinalTranscript(text) {

    if (
        transcriptSection &&
        text
    ) {
        transcriptSection.style.display =
            "";
    }

    if (finalTranscriptElement) {

        finalTranscriptElement.textContent =
            text ||
            "No transcript available.";
    }


    if (scrollPrompt) {

        scrollPrompt.style.display =
            text ? "" : "none";
    }
}


/* =========================================================
   WORD COUNT
   ========================================================= */

function updateWordCount(text) {

    if (!text) {

        wordCount = 0;

        updateStats();

        return;
    }


    const words =
        text
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    wordCount =
        words.length;


    updateStats();
}


/* =========================================================
   STATS UI
   ========================================================= */

function updateStats() {

    if (fillerCountElement) {

        fillerCountElement.textContent =
            fillerCount;
    }


    if (wordCountElement) {

        wordCountElement.textContent =
            wordCount;
    }
}


/* =========================================================
   STATUS
   ========================================================= */

function setStatus(
    message,
    active = false
) {

    if (statusText) {

        statusText.textContent =
            message;
    }


    if (statusDot) {

        statusDot.classList.toggle(
            "active",
            active
        );
    }
}


/* =========================================================
   BUTTON STATE
   ========================================================= */

function updateButtons() {

    if (listenButton) {

        listenButton.disabled =
            isRecording;
    }


    if (stopButton) {

        stopButton.disabled =
            !isRecording;
    }
}


/* =========================================================
   RESET SESSION
   ========================================================= */

function resetSession() {

    fillerCount = 0;
    wordCount = 0;

    liveTranscript = "";
    finalTranscript = "";

    audioChunks = [];

    detectedRecently.clear();

    if (heardText) {
        heardText.textContent =
            "Listening...";
    }

    if (finalTranscriptElement) {
        finalTranscriptElement.textContent =
            "";
    }

    if (analysisElement) {
        analysisElement.innerHTML =
            "";
    }

    if (analysisLoading) {
        analysisLoading.style.display =
            "none";
    }

    updateStats();
}


/* =========================================================
   TIMER
   ========================================================= */

function startTimer() {

    recordingStartTime =
        Date.now();


    if (timerInterval) {
        clearInterval(timerInterval);
    }


    updateTimer();


    timerInterval =
        setInterval(
            updateTimer,
            250
        );
}


function updateTimer() {

    if (!recordingStartTime) return;

    const elapsed =
        Date.now() -
        recordingStartTime;


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


    const formatted =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;


    if (recordingTimer) {

        recordingTimer.textContent =
            formatted;
    }
}


function stopTimer() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval = null;
    }
}


/* =========================================================
   VIBRATION
   ========================================================= */

function vibrate() {

    /*
     * navigator.vibrate is supported on
     * many Android browsers but not iOS Safari.
     */

    try {

        if (
            "vibrate" in navigator
        ) {

            navigator.vibrate(
                [80, 40, 80]
            );
        }

    } catch (error) {

        console.warn(
            "Vibration unavailable:",
            error
        );
    }
}


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

async function requestNotificationPermission() {

    if (
        !("Notification" in window)
    ) {

        updateNotificationStatus(
            "Notifications aren't supported."
        );

        return;
    }


    try {

        const permission =
            await Notification.requestPermission();

        updateNotificationStatus(
            permission
        );

    } catch (error) {

        console.warn(
            "Notification permission error:",
            error
        );
    }
}


function updateNotificationStatus(
    permissionOverride = null
) {

    if (!notificationStatus) {
        return;
    }


    if (
        !("Notification" in window)
    ) {

        notificationStatus.textContent =
            "Notifications unavailable";

        return;
    }


    const permission =
        permissionOverride ||
        Notification.permission;


    if (permission === "granted") {

        notificationStatus.textContent =
            "Notifications enabled";

    } else if (
        permission === "denied"
    ) {

        notificationStatus.textContent =
            "Notifications blocked";

    } else {

        notificationStatus.textContent =
            "Notifications not enabled";
    }
}


function sendNotification(word) {

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


    try {

        new Notification(
            "Filler word detected",
            {
                body:
                    `"${word}"`,
                tag:
                    "speech-tracker-filler",
                renotify:
                    true
            }
        );

    } catch (error) {

        console.warn(
            "Could not create notification:",
            error
        );
    }
}


/* =========================================================
   FILLER FEEDBACK
   ========================================================= */

function showFillerFeedback(word) {

    if (!heardText) return;


    /*
     * Brief visual feedback.
     */

    heardText.classList.remove(
        "filler-detected"
    );


    /*
     * Force browser to restart animation.
     */

    void heardText.offsetWidth;


    heardText.classList.add(
        "filler-detected"
    );


    setTimeout(() => {

        heardText.classList.remove(
            "filler-detected"
        );

    }, 500);
}


/* =========================================================
   AI SPEECH ANALYSIS
   ========================================================= */

async function analyzeSpeech() {

    const transcript =
        finalTranscript ||
        liveTranscript ||
        finalTranscriptElement?.textContent ||
        "";


    if (!transcript.trim()) {

        if (analysisElement) {

            analysisElement.textContent =
                "Record some speech first so I can analyze it.";
        }

        return;
    }


    if (analysisLoading) {

        analysisLoading.style.display =
            "";
    }


    if (analyzeButton) {

        analyzeButton.disabled =
            true;
    }


    if (analysisElement) {

        analysisElement.innerHTML =
            "";
    }


    try {

        const response =
            await fetch(
                ANALYZE_ENDPOINT,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        transcript,
                        fillerCount,
                        wordCount,
                        trackedWords
                    })
                }
            );


        if (!response.ok) {

            const errorText =
                await response.text();

            throw new Error(
                `Analysis failed (${response.status}): ${errorText}`
            );
        }


        const data =
            await response.json();


        const analysis =
            extractAnalysis(data);


        if (!analysis) {

            throw new Error(
                "The analysis API returned an empty response."
            );
        }


        renderAnalysis(
            analysis
        );


    } catch (error) {

        console.error(
            "Speech analysis error:",
            error
        );


        if (analysisElement) {

            analysisElement.innerHTML = `
                <div class="analysis-error">
                    <strong>Couldn't analyze your speech.</strong>
                    <p>${escapeHTML(error.message)}</p>
                </div>
            `;
        }

    } finally {

        if (analysisLoading) {

            analysisLoading.style.display =
                "none";
        }

        if (analyzeButton) {

            analyzeButton.disabled =
                false;
        }
    }
}


/* =========================================================
   EXTRACT ANALYSIS
   ========================================================= */

function extractAnalysis(data) {

    if (!data) {
        return null;
    }


    /*
     * Already structured JSON.
     */

    if (
        typeof data.analysis === "object" &&
        data.analysis !== null
    ) {

        return data.analysis;
    }


    /*
     * Analysis returned as a string.
     */

    if (
        typeof data.analysis === "string"
    ) {

        return parseAnalysisString(
            data.analysis
        );
    }


    if (
        typeof data.result === "object" &&
        data.result !== null
    ) {

        return data.result;
    }


    if (
        typeof data.result === "string"
    ) {

        return parseAnalysisString(
            data.result
        );
    }


    /*
     * Some APIs return the actual fields
     * directly.
     */

    if (
        data.summary ||
        data.overview ||
        data.strengths ||
        data.improvements
    ) {

        return data;
    }


    /*
     * Last resort: if OpenAI returned a
     * JSON string in "text".
     */

    if (
        typeof data.text === "string"
    ) {

        return parseAnalysisString(
            data.text
        );
    }


    return null;
}


/* =========================================================
   PARSE ANALYSIS STRING
   ========================================================= */

function parseAnalysisString(text) {

    if (!text) {
        return null;
    }


    let cleaned =
        text.trim();


    /*
     * Remove Markdown code fences.
     *
     * Handles:
     *
     * ```json
     * {...}
     * ```
     */

    cleaned =
        cleaned
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();


    /*
     * Direct JSON parse.
     */

    try {

        return JSON.parse(
            cleaned
        );

    } catch (error) {
        // Continue below.
    }


    /*
     * Sometimes the model puts extra text
     * before/after the JSON.
     *
     * Find the first { and last }.
     */

    const firstBrace =
        cleaned.indexOf("{");

    const lastBrace =
        cleaned.lastIndexOf("}");


    if (
        firstBrace !== -1 &&
        lastBrace !== -1 &&
        lastBrace > firstBrace
    ) {

        const possibleJSON =
            cleaned.slice(
                firstBrace,
                lastBrace + 1
            );


        try {

            return JSON.parse(
                possibleJSON
            );

        } catch (error) {

            console.warn(
                "Could not parse extracted JSON:",
                error
            );
        }
    }


    /*
     * If it isn't JSON, display it as
     * normal analysis text instead of
     * showing "invalid JSON".
     */

    return {
        summary: cleaned
    };
}


/* =========================================================
   RENDER ANALYSIS
   ========================================================= */

function renderAnalysis(analysis) {

    if (!analysisElement) {
        return;
    }


    /*
     * If the API returns plain text.
     */

    if (
        typeof analysis === "string"
    ) {

        analysisElement.innerHTML =
            formatPlainText(
                analysis
            );

        return;
    }


    let html = "";


    /* -----------------------------------------
       SUMMARY
       ----------------------------------------- */

    const summary =
        analysis.summary ||
        analysis.overview ||
        analysis.general_feedback;


    if (summary) {

        html += `
            <div class="analysis-section">
                <h3>Overall</h3>
                <p>${escapeHTML(
                    String(summary)
                )}</p>
            </div>
        `;
    }


    /* -----------------------------------------
       FILLER WORDS
       ----------------------------------------- */

    const fillerFeedback =
        analysis.filler_words ||
        analysis.fillerWords ||
        analysis.fillers;


    if (fillerFeedback) {

        html += `
            <div class="analysis-section">
                <h3>Filler Words</h3>
                ${renderValue(
                    fillerFeedback
                )}
            </div>
        `;
    }


    /* -----------------------------------------
       STRENGTHS
       ----------------------------------------- */

    const strengths =
        analysis.strengths ||
        analysis.positive ||
        analysis.what_you_did_well;


    if (strengths) {

        html += `
            <div class="analysis-section">
                <h3>What You Did Well</h3>
                ${renderValue(
                    strengths
                )}
            </div>
        `;
    }


    /* -----------------------------------------
       IMPROVEMENTS
       ----------------------------------------- */

    const improvements =
        analysis.improvements ||
        analysis.areas_to_improve ||
        analysis.weaknesses ||
        analysis.suggestions;


    if (improvements) {

        html += `
            <div class="analysis-section">
                <h3>What to Improve</h3>
                ${renderValue(
                    improvements
                )}
            </div>
        `;
    }


    /* -----------------------------------------
       DELIVERY
       ----------------------------------------- */

    const delivery =
        analysis.delivery ||
        analysis.pacing ||
        analysis.clarity;


    if (delivery) {

        html += `
            <div class="analysis-section">
                <h3>Delivery</h3>
                ${renderValue(
                    delivery
                )}
            </div>
        `;
    }


    /* -----------------------------------------
       STRUCTURE
       ----------------------------------------- */

    const structure =
        analysis.structure ||
        analysis.organization;


    if (structure) {

        html += `
            <div class="analysis-section">
                <h3>Structure</h3>
                ${renderValue(
                    structure
                )}
            </div>
        `;
    }


    /* -----------------------------------------
       ACTION PLAN
       ----------------------------------------- */

    const actionPlan =
        analysis.action_plan ||
        analysis.actionPlan ||
        analysis.next_steps;


    if (actionPlan) {

        html += `
            <div class="analysis-section">
                <h3>Next Steps</h3>
                ${renderValue(
                    actionPlan
                )}
            </div>
        `;
    }


    /*
     * If we don't recognize the JSON fields,
     * render everything rather than showing
     * nothing.
     */

    if (!html) {

        html =
            renderGenericObject(
                analysis
            );
    }


    analysisElement.innerHTML =
        html;
}


/* =========================================================
   RENDER ANALYSIS VALUES
   ========================================================= */

function renderValue(value) {

    if (value === null ||
        value === undefined) {
        return "";
    }


    if (Array.isArray(value)) {

        return `
            <ul>
                ${value.map(item => `
                    <li>
                        ${escapeHTML(
                            typeof item === "object"
                                ? JSON.stringify(item)
                                : String(item)
                        )}
                    </li>
                `).join("")}
            </ul>
        `;
    }


    if (
        typeof value === "object"
    ) {

        return renderGenericObject(
            value
        );
    }


    return `
        <p>
            ${escapeHTML(
                String(value)
            )}
        </p>
    `;
}


/* =========================================================
   GENERIC OBJECT RENDERER
   ========================================================= */

function renderGenericObject(object) {

    if (
        !object ||
        typeof object !== "object"
    ) {
        return "";
    }


    let html = "<div>";


    for (
        const [key, value]
        of Object.entries(object)
    ) {

        const title =
            key
                .replace(/_/g, " ")
                .replace(
                    /\b\w/g,
                    letter =>
                        letter.toUpperCase()
                );


        html += `
            <div class="analysis-subsection">
                <h4>${escapeHTML(title)}</h4>
                ${renderValue(value)}
            </div>
        `;
    }


    html += "</div>";

    return html;
}


/* =========================================================
   PLAIN TEXT FORMATTER
   ========================================================= */

function formatPlainText(text) {

    return String(text)
        .split(/\n+/)
        .filter(Boolean)
        .map(paragraph => {

            return `
                <p>
                    ${escapeHTML(
                        paragraph.trim()
                    )}
                </p>
            `;

        })
        .join("");
}


/* =========================================================
   TEXT NORMALIZATION
   ========================================================= */

function normalizeText(text) {

    return String(text)
        .toLowerCase()
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}


/* =========================================================
   REGEX ESCAPE
   ========================================================= */

function escapeRegex(string) {

    return String(string)
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
}


/* =========================================================
   HTML ESCAPE
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
   PAGE VISIBILITY
   ========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        /*
         * Don't stop recording just because
         * the user switches tabs.
         *
         * The browser may suspend recognition
         * anyway, and onend will attempt to
         * restart it.
         */

        if (
            document.visibilityState === "visible" &&
            isRecording &&
            recognition
        ) {

            try {
                recognition.start();
            } catch (error) {
                // Already running.
            }
        }
    }
);


/* =========================================================
   BEFORE UNLOAD
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (microphoneStream) {

            microphoneStream
                .getTracks()
                .forEach(track => track.stop());
        }

        if (recognition) {

            try {
                recognition.stop();
            } catch (error) {
                // Ignore.
            }
        }
    }
);


/* =========================================================
   INITIAL BUTTON STATE
   ========================================================= */

updateButtons();
updateStats();
updateNotificationStatus();