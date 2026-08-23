/* =========================================================
   SPEECH TRACKER
   Complete replacement script.js
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

const enableNotificationsButton = $("enableNotifications");
const notificationStatus = $("notificationStatus");

const analyzeButton = $("analyzeButton");
const analysisLoading = $("analysisLoading");
const analysisElement = $("analysis");

const savedSpeechesElement = $("savedSpeeches");
const savedSpeechCount = $("savedSpeechCount");

const savePrompt = $("savePrompt");
const saveSpeechButton = $("saveSpeechButton");
const discardSpeechButton = $("discardSpeechButton");

const saveModal = $("saveModal");
const speechNameInput = $("speechNameInput");
const cancelSaveButton = $("cancelSaveButton");
const confirmSaveButton = $("confirmSaveButton");

const themeToggle = $("themeToggle");
const themeColor = $("themeColor");

const scrollIndicator = $("scrollIndicator");


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

const WORD_STORAGE_KEY = "speechTrackerWords";
const SPEECH_STORAGE_KEY = "speechTrackerSavedSpeeches";
const THEME_STORAGE_KEY = "speechTrackerTheme";


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
   ========================================================= */

/*
    We keep track of the portion of speech that has already
    been examined.

    SpeechRecognition continuously changes its interim result.
    If we simply scan the entire transcript every time,
    "umm" can look like:

        um
        umm
        ummm

    and trigger three notifications.

    Instead, we compare newly spoken text against what we've
    already processed.
*/

let processedFinalText = "";
let lastInterimText = "";

let detectedFillerOccurrences = new Set();

let lastFillerNotificationTime = 0;
let lastFillerNotificationFamily = "";

let notificationObject = null;


/* =========================================================
   INITIALIZATION GUARD
   ========================================================= */

let initialized = false;


/* =========================================================
   WORD STORAGE
   ========================================================= */

function loadTrackedWords() {
    try {
        const saved = localStorage.getItem(WORD_STORAGE_KEY);

        if (saved) {
            const parsed = JSON.parse(saved);

            if (Array.isArray(parsed) && parsed.length) {
                trackedWords = parsed;
                return;
            }
        }
    } catch (error) {
        console.error(
            "Could not load tracked words:",
            error
        );
    }

    trackedWords = [...DEFAULT_WORDS];
}


function saveTrackedWords() {
    try {
        localStorage.setItem(
            WORD_STORAGE_KEY,
            JSON.stringify(trackedWords)
        );
    } catch (error) {
        console.error(
            "Could not save tracked words:",
            error
        );
    }
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
    const normalized = normalizeWord(word);

    /*
        Any number of m's after "u" is considered the
        same UM family.

        um
        umm
        ummm
        ummmmm
    */

    if (/^um+$/.test(normalized)) {
        return "UM";
    }

    /*
        Any number of h's after "u" is considered the
        same UH family.

        uh
        uhh
        uhhh
        uhhhhh
    */

    if (/^uh+$/.test(normalized)) {
        return "UH";
    }

    return normalized;
}


/* =========================================================
   REGEX ESCAPE
   ========================================================= */

function escapeRegex(text) {
    return String(text).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}


/* =========================================================
   BUILD FILLER REGEX
   ========================================================= */

function getFillerRegex() {
    const words = [...trackedWords]
        .map(normalizeWord)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);

    /*
        Add unlimited UM / UH variants.

        These MUST be added as raw regex patterns.
    */

    words.push("um+");
    words.push("uh+");

    const unique = [...new Set(words)];

    /*
        Longer phrases first.
    */

    return new RegExp(
        `\\b(${unique
            .map((word) => {
                if (word === "um+" || word === "uh+") {
                    return word;
                }

                return escapeRegex(word);
            })
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

    const regex = getFillerRegex();

    let result = "";
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        result += escapeHTML(
            text.slice(lastIndex, match.index)
        );

        result +=
            `<span class="filler-highlight">` +
            escapeHTML(match[0]) +
            `</span>`;

        lastIndex = regex.lastIndex;
    }

    result += escapeHTML(
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
    const cleaned = String(text || "").trim();

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

    const regex = getFillerRegex();

    return (text.match(regex) || []).length;
}


/* =========================================================
   UPDATE STATS
   ========================================================= */

function updateStats(text) {
    const fillerCount = countFillers(text);
    const wordCount = countWords(text);

    currentSessionFillerCount = fillerCount;
    currentSessionWordCount = wordCount;

    if (fillerCountElement) {
        fillerCountElement.textContent = fillerCount;
    }

    if (wordCountElement) {
        wordCountElement.textContent = wordCount;
    }
}


/* =========================================================
   RENDER LIVE TRANSCRIPT
   ========================================================= */

function renderLiveTranscript() {
    if (!heard) {
        return;
    }

    heard.innerHTML = highlightTranscript(
        liveTranscript
    );

    updateStats(liveTranscript);
}


/* =========================================================
   RENDER FINAL TRANSCRIPT
   ========================================================= */

function renderFinalTranscript() {
    if (!finalTranscriptElement) {
        return;
    }

    if (!finalTranscript) {
        finalTranscriptElement.textContent =
            "Your completed speech will appear here.";

        return;
    }

    finalTranscriptElement.innerHTML =
        highlightTranscript(finalTranscript);
}


/* =========================================================
   TRACKED WORD UI
   ========================================================= */

function renderWordList() {
    if (!wordList) {
        return;
    }

    wordList.innerHTML = "";

    trackedWords.forEach((word, index) => {
        const tag = document.createElement("div");

        tag.className = "word-tag";

        tag.innerHTML = `
            <span>${escapeHTML(word)}</span>

            <button
                type="button"
                aria-label="Remove ${escapeHTML(word)}"
                data-index="${index}"
            >
                ×
            </button>
        `;

        wordList.appendChild(tag);
    });
}


/* =========================================================
   ADD WORD
   ========================================================= */

function addTrackedWord() {
    if (!customWordInput) {
        return;
    }

    const word = normalizeWord(
        customWordInput.value
    );

    if (!word) {
        return;
    }

    const exists = trackedWords.some(
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
                Number(button.dataset.index);

            if (
                Number.isInteger(index) &&
                index >= 0 &&
                index < trackedWords.length
            ) {
                trackedWords.splice(index, 1);

                saveTrackedWords();
                renderWordList();
            }
        }
    );
}


if (resetWordsButton) {
    resetWordsButton.addEventListener(
        "click",
        () => {
            trackedWords = [...DEFAULT_WORDS];

            saveTrackedWords();
            renderWordList();
        }
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


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

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

        updateNotificationUI(permission);

    } catch (error) {
        console.error(
            "Notification permission error:",
            error
        );
    }
}


function updateNotificationUI(permission) {
    if (!notificationStatus ||
        !enableNotificationsButton) {
        return;
    }

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

        return;
    }

    if (permission === "denied") {
        notificationStatus.textContent =
            "Notifications are blocked in your browser.";

        notificationStatus.classList.remove(
            "enabled"
        );

        return;
    }

    notificationStatus.textContent =
        "Enable notifications to get filler alerts.";
}


if (enableNotificationsButton) {
    enableNotificationsButton.addEventListener(
        "click",
        enableNotifications
    );
}


/* =========================================================
   FAST NOTIFICATION
   ========================================================= */

function sendFillerNotification(word) {
    if (!("Notification" in window)) {
        return;
    }

    if (Notification.permission !== "granted") {
        return;
    }

    const now = Date.now();
    const family = fillerFamily(word);

    /*
        Extremely short safety debounce.

        This is intentionally short because we want the
        notification to happen immediately.

        The occurrence ID is the primary duplicate
        protection.
    */

    if (
        family === lastFillerNotificationFamily &&
        now - lastFillerNotificationTime < 180
    ) {
        return;
    }

    lastFillerNotificationFamily = family;
    lastFillerNotificationTime = now;

    try {
        /*
            Close the previous notification before making
            a new one. This keeps the browser from building
            a giant notification stack.
        */

        if (notificationObject) {
            try {
                notificationObject.close();
            } catch (_) {}
        }

        notificationObject =
            new Notification(
                "Speech Tracker",
                {
                    body: `You said "${word}"`,
                    icon: "/icon.svg",
                    badge: "/icon.svg",
                    tag:
                        `speech-tracker-${Date.now()}`,
                    renotify: true,
                    silent: false
                }
            );

        setTimeout(() => {
            try {
                notificationObject?.close();
            } catch (_) {}
        }, 1400);

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
            navigator.vibrate([
                45,
                25,
                45
            ]);
        }
    } catch (_) {}
}


/* =========================================================
   RESET LIVE DETECTION
   ========================================================= */

function resetLiveDetectionState() {
    processedFinalText = "";
    lastInterimText = "";

    detectedFillerOccurrences.clear();

    lastFillerNotificationTime = 0;
    lastFillerNotificationFamily = "";

    if (notificationObject) {
        try {
            notificationObject.close();
        } catch (_) {}

        notificationObject = null;
    }
}


/* =========================================================
   GET FILLERS FROM TEXT
   ========================================================= */

function getFillerMatches(text) {
    if (!text) {
        return [];
    }

    const regex = getFillerRegex();
    const matches = [];

    let match;

    while ((match = regex.exec(text)) !== null) {
        matches.push({
            word: match[0],
            index: match.index
        });
    }

    return matches;
}


/* =========================================================
   GET OCCURRENCE ID
   ========================================================= */

function getFillerOccurrenceId(
    text,
    match
) {
    const before =
        text
            .slice(0, match.index)
            .trim();

    const wordIndex =
        before
            ? before.split(/\s+/).length
            : 0;

    const family =
        fillerFamily(match.word);

    return `${wordIndex}:${family}`;
}


/* =========================================================
   DETECT NEW FILLERS
   ========================================================= */

/*
    This is the most important part of the new version.

    SpeechRecognition interim results are unstable.

    Example:

        "I was um"

        might temporarily become:

        "I was u"

        then:

        "I was um"

        then:

        "I was umm"

        then:

        "I was ummm"

    We DO NOT want four alerts.

    We identify the filler by its word position + family.

    Therefore:

        um
        umm
        ummm

    all become the same occurrence:

        3:UM
*/

function detectNewFillers(text) {
    if (!text || !isRecording) {
        return;
    }

    const matches =
        getFillerMatches(text);

    for (const match of matches) {
        const occurrenceId =
            getFillerOccurrenceId(
                text,
                match
            );

        if (
            detectedFillerOccurrences.has(
                occurrenceId
            )
        ) {
            continue;
        }

        detectedFillerOccurrences.add(
            occurrenceId
        );

        /*
            Do not wait for the final transcript.

            The instant SpeechRecognition gives us the
            filler in an interim result, alert the user.
        */

        vibrateForFiller();

        sendFillerNotification(
            match.word
        );
    }
}


/* =========================================================
   DETECT FILLERS IN NEW INTERIM SPEECH
   ========================================================= */

function detectInterimFillers(interimText) {
    if (!interimText) {
        return;
    }

    /*
        Interim text usually represents the newest
        unfinished portion of speech.

        We scan it immediately.

        Because occurrence IDs are stored globally,
        changing:

            um -> umm -> ummm

        will not produce duplicate alerts.
    */

    detectNewFillers(interimText);
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
        return;
    }

    recognitionSupported = true;

    recognition =
        new SpeechRecognition();

    recognition.lang = "en-US";

    recognition.continuous = true;

    /*
        CRITICAL:

        true allows us to receive speech BEFORE it
        becomes final.

        This is what allows faster filler detection.
    */

    recognition.interimResults = true;

    recognition.maxAlternatives = 1;


    recognition.onstart = () => {
        if (!isRecording) {
            return;
        }

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
                event.error === "not-allowed" ||
                event.error === "service-not-allowed"
            ) {
                statusText.textContent =
                    "Microphone permission needed";

                statusDot.className =
                    "status-dot error";

                recognitionShouldRun = false;
            }

            /*
                "no-speech" and some temporary browser
                errors should NOT destroy the recording.
            */
        };


    recognition.onend = () => {
        if (
            recognitionShouldRun &&
            isRecording
        ) {
            /*
                Restart immediately.

                The tiny timeout prevents certain Chromium
                builds from throwing InvalidStateError when
                restart happens synchronously.
            */

            setTimeout(() => {
                if (
                    recognitionShouldRun &&
                    isRecording
                ) {
                    try {
                        recognition.start();
                    } catch (_) {}
                }
            }, 20);
        }
    };
}


/* =========================================================
   HANDLE SPEECH RESULT
   ========================================================= */

function handleRecognitionResult(event) {
    if (!isRecording) {
        return;
    }

    let finalParts = [];
    let interimParts = [];

    for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
    ) {
        const result =
            event.results[i];

        const transcript =
            result[0]?.transcript || "";

        if (result.isFinal) {
            finalParts.push(transcript);
        } else {
            interimParts.push(transcript);
        }
    }


    /*
        We need to reconstruct the browser's current
        transcript.

        Some browsers retain previous results, so build
        the complete transcript from the recognition
        object instead of only the newest event.
    */

    let allFinal = [];
    let allInterim = [];

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
            allFinal.push(transcript);
        } else {
            allInterim.push(transcript);
        }
    }

    const cleanFinal =
        allFinal
            .join(" ")
            .trim();

    const cleanInterim =
        allInterim
            .join(" ")
            .trim();


    /*
        Detect NEW final text.

        We don't need to alert again if the same final
        word was already detected during interim speech.
    */

    if (cleanFinal) {
        detectNewFillers(
            cleanFinal
        );
    }


    /*
        Detect interim speech immediately.

        This is the main speed improvement.
    */

    if (cleanInterim) {
        detectInterimFillers(
            cleanInterim
        );
    }


    /*
        Reconstruct visible transcript.
    */

    liveTranscript =
        [
            cleanFinal,
            cleanInterim
        ]
            .filter(Boolean)
            .join(" ")
            .trim();


    /*
        Prevent obvious duplicate spaces.
    */

    liveTranscript =
        liveTranscript.replace(
            /\s+/g,
            " "
        );


    renderLiveTranscript();

    lastInterimText =
        cleanInterim;

    processedFinalText =
        cleanFinal;
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

    recognitionShouldRun = true;

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
    recognitionShouldRun = false;

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

    for (const type of options) {
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

    /*
        Make sure the save prompt is NEVER shown at startup.
    */

    if (savePrompt) {
        savePrompt.hidden = true;
    }

    try {
        const stream =
            await navigator.mediaDevices.getUserMedia({
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

        currentSessionFillerCount = 0;
        currentSessionWordCount = 0;

        currentSpeechId = null;

        resetLiveDetectionState();


        if (analysisElement) {
            analysisElement.innerHTML = "";
        }

        if (analysisLoading) {
            analysisLoading.hidden = true;
        }

        if (finalTranscriptElement) {
            finalTranscriptElement.textContent =
                "Your completed speech will appear here.";
        }

        if (fillerCountElement) {
            fillerCountElement.textContent = "0";
        }

        if (wordCountElement) {
            wordCountElement.textContent = "0";
        }


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
                new MediaRecorder(stream);
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


        /*
            Small chunks make sure the browser doesn't
            wait until the entire recording is finished
            before collecting audio.
        */

        mediaRecorder.start(250);


        isRecording = true;
        isStopping = false;

        recordingStartTime = Date.now();

        startTimer();


        listenButton.disabled = true;
        stopButton.disabled = false;


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

    isStopping = true;

    recognitionShouldRun = false;

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
    isRecording = false;
    isStopping = false;

    listenButton.disabled = false;
    stopButton.disabled = true;

    statusText.textContent =
        "Processing";

    statusDot.className =
        "status-dot";


    /*
        Allow the final browser recognition event to arrive.
    */

    await wait(200);


    finalTranscript =
        liveTranscript.trim();


    renderFinalTranscript();

    updateStats(finalTranscript);


    analyzeButton.disabled =
        !finalTranscript;


    statusText.textContent =
        "Finished";


    /*
        ONLY NOW show the save prompt.

        It will not appear when the page first loads.
    */

    if (
        finalTranscript &&
        savePrompt
    ) {
        savePrompt.hidden = false;
    }


    /*
        Get the higher-quality final transcription.
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

                updateStats(
                    finalTranscript
                );

                analyzeButton.disabled = false;
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
        await blobToBase64(blob);


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
        await response
            .json()
            .catch(() => ({}));


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
                () => resolve(
                    reader.result
                );

            reader.onerror =
                reject;

            reader.readAsDataURL(blob);
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

                if (recordingTimer) {
                    recordingTimer.textContent =
                        formatTime(elapsed);
                }
            },
            250
        );
}


function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}


function formatTime(seconds) {
    const minutes =
        Math.floor(seconds / 60);

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


        const data =
            await response
                .json()
                .catch(() => ({}));


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
        analysisLoading.hidden = true;

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
   AI OBJECT RENDERER
   ========================================================= */

function renderAnalysis(data) {
    analysisElement.innerHTML = "";

    if (!data) {
        analysisElement.innerHTML = `
            <div class="analysis-empty">
                No analysis was returned.
            </div>
        `;

        return;
    }


    if (typeof data === "string") {
        analysisElement.appendChild(
            createAnalysisSection(
                "AI Feedback",
                data
            )
        );

        return;
    }


    /*
        Sometimes APIs return:

        {
            analysis: {
                ...
            }
        }

        Unwrap that when appropriate.
    */

    if (
        data.analysis &&
        typeof data.analysis === "object" &&
        !Array.isArray(data.analysis)
    ) {
        data = data.analysis;
    }


    Object.entries(data)
        .forEach(([key, value]) => {
            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                return;
            }

            const section =
                document.createElement("div");

            section.className =
                "analysis-section";


            const title =
                document.createElement("div");

            title.className =
                "analysis-section-title";

            title.textContent =
                prettifyKey(key);


            section.appendChild(title);


            renderAnalysisValue(
                value,
                section
            );


            analysisElement.appendChild(
                section
            );
        });


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
            document.createElement("div");

        text.className =
            "analysis-section-text";

        text.textContent =
            String(value);

        parent.appendChild(text);

        return;
    }


    if (Array.isArray(value)) {
        const list =
            document.createElement("ul");

        list.className =
            "analysis-list";


        value.forEach(item => {
            const li =
                document.createElement("li");

            li.className =
                "analysis-list-item";


            if (
                typeof item === "object" &&
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


            list.appendChild(li);
        });


        parent.appendChild(list);

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
        .forEach(([key, value]) => {
            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                return;
            }


            const subsection =
                document.createElement("div");

            subsection.className =
                "analysis-subsection";


            const title =
                document.createElement("div");

            title.className =
                "analysis-subtitle";

            title.textContent =
                prettifyKey(key);


            subsection.appendChild(title);


            renderAnalysisValue(
                value,
                subsection
            );


            parent.appendChild(
                subsection
            );
        });
}


/* =========================================================
   CREATE SIMPLE AI SECTION
   ========================================================= */

function createAnalysisSection(
    titleText,
    content
) {
    const section =
        document.createElement("div");

    section.className =
        "analysis-section";


    const title =
        document.createElement("div");

    title.className =
        "analysis-section-title";

    title.textContent =
        titleText;


    const text =
        document.createElement("div");

    text.className =
        "analysis-section-text";

    text.textContent =
        content;


    section.appendChild(title);
    section.appendChild(text);

    return section;
}


/* =========================================================
   PRETTIFY AI KEY
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
            char => char.toUpperCase()
        );
}


/* =========================================================
   SAVED SPEECHES STORAGE
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


function setSavedSpeeches(speeches) {
    try {
        localStorage.setItem(
            SPEECH_STORAGE_KEY,
            JSON.stringify(speeches)
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
    if (
        !savedSpeechesElement ||
        !savedSpeechCount
    ) {
        return;
    }

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
            .map(speech => {
                const date =
                    new Date(
                        speech.date
                    );

                const dateText =
                    isNaN(date.getTime())
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
            })
            .join("");
}


/* =========================================================
   SAVE SPEECH MODAL
   ========================================================= */

function openSaveModal() {
    if (!saveModal) {
        return;
    }

    speechNameInput.value = "";

    saveModal.hidden = false;

    setTimeout(() => {
        speechNameInput.focus();
    }, 50);
}


function closeSaveModal() {
    if (!saveModal) {
        return;
    }

    saveModal.hidden = true;
}


/* =========================================================
   SAVE SPEECH
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


    speeches.unshift(speech);

    setSavedSpeeches(speeches);

    currentSpeechId =
        speech.id;

    renderSavedSpeeches();

    closeSaveModal();

    if (savePrompt) {
        savePrompt.hidden = true;
    }
}


/* =========================================================
   SAVE PROMPT EVENTS
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
            savePrompt.hidden = true;
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
                speechNameInput.value
            );
        }
    );
}


if (speechNameInput) {
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
}


/* =========================================================
   SAVED SPEECH CLICK HANDLER
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

    setSavedSpeeches(filtered);

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

    currentAnalysis =
        speech.analysis || null;

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


    if (savePrompt) {
        savePrompt.hidden = true;
    }


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
        if (themeToggle) {
            themeToggle.textContent =
                "Light";
        }

        if (themeColor) {
            themeColor.content =
                "#09090b";
        }
    } else {
        if (themeToggle) {
            themeToggle.textContent =
                "Dark";
        }

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
   UTIL
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
    if (initialized) {
        return;
    }

    initialized = true;


    /*
        IMPORTANT:
        The save prompt is explicitly hidden on startup.
    */

    if (savePrompt) {
        savePrompt.hidden = true;
    }

    /*
        The save modal is also explicitly hidden.
    */

    if (saveModal) {
        saveModal.hidden = true;
    }

    if (analysisLoading) {
        analysisLoading.hidden = true;
    }


    loadTrackedWords();

    renderWordList();

    renderSavedSpeeches();

    applyTheme(
        getPreferredTheme()
    );

    setupSpeechRecognition();


    if (!recognitionSupported) {
        console.warn(
            "SpeechRecognition is not supported in this browser. Live transcription/filler detection may be unavailable."
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