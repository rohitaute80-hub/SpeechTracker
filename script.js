/* ============================================================
   SPEECH TRACKER
   COMPLETE REPLACEMENT SCRIPT.JS

   - Fast live filler-word detection
   - Detects interim SpeechRecognition results
   - Detects um / umm / ummm / ummmm...
   - Detects uh / uhh / uhhh / uhhhh...
   - Fast notifications
   - Fast vibration when supported
   - Live transcript
   - Final OpenAI transcription
   - AI speech analysis
   - Custom tracked words
   - Dark/light mode
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

const STORAGE_KEY = "speechTrackerWords";
const THEME_KEY = "speechTrackerTheme";

let trackedWords = loadTrackedWords();

let recognition = null;
let recognitionRunning = false;

let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];

let finalTranscript = "";
let liveTranscript = "";

let isRecording = false;
let recordingStartTime = null;
let recordingTimer = null;

let notificationPermission = false;

/*
   Keeps track of words already detected in the current
   recognition result so we don't fire the same notification
   repeatedly while the browser keeps updating interim text.
*/
let detectedLiveTokens = new Set();

let lastDetectedWord = "";
let lastDetectedTime = 0;


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

const customWordInput =
    document.getElementById("customWordInput");

const addWordButton =
    document.getElementById("addWordButton");

const wordList =
    document.getElementById("wordList");

const resetWordsButton =
    document.getElementById("resetWordsButton");

const enableNotificationsButton =
    document.getElementById("enableNotifications") ||
    document.getElementById("enableNotificationsButton");

const notificationStatus =
    document.getElementById("notificationStatus");

const analyzeButton =
    document.getElementById("analyzeButton");

const analysisLoading =
    document.getElementById("analysisLoading");

const analysisElement =
    document.getElementById("analysis");


/* ============================================================
   STATE
   ============================================================ */

let fillerCount = 0;
let wordCount = 0;


/* ============================================================
   TRACKED WORD STORAGE
   ============================================================ */

function loadTrackedWords() {
    try {
        const saved =
            localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return [...DEFAULT_WORDS];
        }

        const parsed =
            JSON.parse(saved);

        if (!Array.isArray(parsed) || parsed.length === 0) {
            return [...DEFAULT_WORDS];
        }

        return parsed;
    } catch (error) {
        console.error(
            "Could not load tracked words:",
            error
        );

        return [...DEFAULT_WORDS];
    }
}


function saveTrackedWords() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(trackedWords)
    );
}


/* ============================================================
   WORD LIST UI
   ============================================================ */

function renderWordList() {

    if (!wordList) {
        return;
    }

    wordList.innerHTML = "";

    trackedWords.forEach((word, index) => {

        const tag =
            document.createElement("span");

        tag.className = "word-tag";

        const text =
            document.createElement("span");

        text.textContent = word;

        const remove =
            document.createElement("button");

        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute(
            "aria-label",
            `Remove ${word}`
        );

        remove.addEventListener(
            "click",
            () => {

                trackedWords.splice(index, 1);

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

    renderWordList();

    customWordInput.value = "";

    customWordInput.focus();
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
        () => {

            trackedWords =
                [...DEFAULT_WORDS];

            saveTrackedWords();

            renderWordList();
        }
    );
}


/* ============================================================
   FILLER NORMALIZATION
   ============================================================ */

/*
   Speech recognition can return:

   um
   umm
   ummm
   ummmm

   and:

   uh
   uhh
   uhhh
   uhhhh

   Instead of treating every spelling separately,
   normalize them to "um" or "uh".
*/

function normalizeFillerWord(word) {

    const clean =
        word
            .toLowerCase()
            .replace(/[^a-z]/g, "");

    /*
       Any sequence beginning with u + m's
       becomes "um".
    */

    if (/^umm+$/.test(clean)) {
        return "um";
    }

    /*
       Any sequence beginning with u + h's
       becomes "uh".
    */

    if (/^uhh+$/.test(clean)) {
        return "uh";
    }

    return clean;
}


/* ============================================================
   DETECTION REGEX
   ============================================================ */

function buildWordRegex(word) {

    const escaped =
        word.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

    /*
       Special handling for UM / UHH variants.
    */

    if (
        word === "um" ||
        word === "umm" ||
        /^um+$/.test(word)
    ) {

        return /\bumm*\b/gi;
    }

    if (
        word === "uh" ||
        word === "uhh" ||
        /^uh+$/.test(word)
    ) {

        return /\buhh*\b/gi;
    }

    return new RegExp(
        `\\b${escaped}\\b`,
        "gi"
    );
}


/* ============================================================
   FIND TRACKED WORDS
   ============================================================ */

function findTrackedWords(text) {

    const detections = [];

    if (!text) {
        return detections;
    }

    for (const trackedWord of trackedWords) {

        const regex =
            buildWordRegex(
                trackedWord.toLowerCase()
            );

        let match;

        while (
            (match = regex.exec(text)) !== null
        ) {

            detections.push({
                word: match[0],
                normalized:
                    normalizeFillerWord(match[0]),
                index: match.index,
                end:
                    match.index +
                    match[0].length
            });

            /*
               Prevent infinite loops.
            */

            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
        }
    }

    detections.sort(
        (a, b) =>
            a.index - b.index
    );

    return detections;
}


/* ============================================================
   FAST LIVE DETECTION
   ============================================================ */

function processLiveSpeech(text, isFinal = false) {

    if (!text) {
        return;
    }

    /*
       Look at the CURRENT recognition result, including
       interim results.

       This is the important part that fixes the delay.
    */

    const detections =
        findTrackedWords(text);

    if (detections.length === 0) {
        return;
    }

    detections.forEach(
        detection => {

            /*
               Create a token based on the location of the
               detected word.

               This stops the same interim result from
               vibrating over and over as Chrome updates it.
            */

            const token =
                `${detection.normalized}-${detection.index}`;

            if (detectedLiveTokens.has(token)) {
                return;
            }

            detectedLiveTokens.add(token);

            triggerTrackedWord(
                detection.word
            );
        }
    );

    /*
       Final results are now complete, so clear the tokens.
       The next recognition phrase can be detected normally.
    */

    if (isFinal) {
        detectedLiveTokens.clear();
    }
}


/* ============================================================
   TRACKED WORD EVENT
   ============================================================ */

function triggerTrackedWord(word) {

    const now =
        Date.now();

    /*
       Very short duplicate protection.

       This prevents the browser from accidentally sending
       two notifications for the same word within ~350 ms.
    */

    if (
        word.toLowerCase() ===
        lastDetectedWord.toLowerCase() &&
        now - lastDetectedTime < 350
    ) {

        return;
    }

    lastDetectedWord = word;
    lastDetectedTime = now;

    fillerCount++;

    updateStats();

    /*
       VIBRATE FIRST.

       This happens before notification code so that if
       vibration is supported, it reacts as quickly as possible.
    */

    vibrateImmediately();

    /*
       Browser notification.
    */

    sendFastNotification(word);

    /*
       Visual feedback.
    */

    showLiveDetection(word);
}


/* ============================================================
   VIBRATION
   ============================================================ */

function vibrateImmediately() {

    try {

        if (
            "vibrate" in navigator &&
            typeof navigator.vibrate === "function"
        ) {

            /*
               Very short vibration for low latency.
            */

            navigator.vibrate(100);
        }

    } catch (error) {

        console.warn(
            "Vibration unavailable:",
            error
        );
    }
}


/* ============================================================
   FAST NOTIFICATION
   ============================================================ */

function sendFastNotification(word) {

    if (
        typeof Notification === "undefined"
    ) {
        return;
    }

    if (
        Notification.permission !== "granted"
    ) {
        return;
    }

    try {

        const notification =
            new Notification(
                "Speech Tracker",
                {
                    body:
                        `Tracked word detected: "${word}"`,
                    tag:
                        `speech-${Date.now()}`,
                    renotify: true,
                    silent: false
                }
            );

        setTimeout(
            () => {

                try {
                    notification.close();
                } catch (_) {}

            },
            1800
        );

    } catch (error) {

        console.warn(
            "Could not create notification:",
            error
        );
    }
}


/* ============================================================
   VISUAL LIVE DETECTION
   ============================================================ */

function showLiveDetection(word) {

    if (!heardElement) {
        return;
    }

    heardElement.classList.remove(
        "detected-now"
    );

    /*
       Force browser to restart animation.
    */

    void heardElement.offsetWidth;

    heardElement.classList.add(
        "detected-now"
    );

    /*
       Do NOT replace the actual transcript permanently.
       Just briefly show the detection status.
    */

    const previous =
        heardElement.dataset.previousText ||
        heardElement.textContent;

    heardElement.dataset.previousText =
        previous;

    const original =
        heardElement.innerHTML;

    heardElement.innerHTML =
        `${escapeHTML(original)}
         <span class="live-detection">
            Detected "${escapeHTML(word)}"
         </span>`;

    setTimeout(
        () => {

            /*
               Only restore if we're still showing
               this temporary detection.
            */

            if (
                heardElement.classList.contains(
                    "detected-now"
                )
            ) {

                heardElement.classList.remove(
                    "detected-now"
                );

                if (liveTranscript) {

                    heardElement.innerHTML =
                        highlightTranscript(
                            liveTranscript
                        );

                }
            }

        },
        650
    );
}


/* ============================================================
   HTML ESCAPING
   ============================================================ */

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ============================================================
   HIGHLIGHT TRANSCRIPT
   ============================================================ */

function highlightTranscript(text) {

    let output =
        escapeHTML(text);

    /*
       Highlight longer phrases first.
    */

    const sortedWords =
        [...trackedWords]
            .sort(
                (a, b) =>
                    b.length - a.length
            );

    sortedWords.forEach(word => {

        const escaped =
            word.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        let regex;

        if (
            word === "um" ||
            word === "umm" ||
            /^um+$/.test(word)
        ) {

            regex =
                /\bumm*\b/gi;

        } else if (
            word === "uh" ||
            word === "uhh" ||
            /^uh+$/.test(word)
        ) {

            regex =
                /\buhh*\b/gi;

        } else {

            regex =
                new RegExp(
                    `\\b${escaped}\\b`,
                    "gi"
                );
        }

        output =
            output.replace(
                regex,
                match =>
                    `<span class="highlight">${escapeHTML(match)}</span>`
            );
    });

    return output;
}


/* ============================================================
   SPEECH RECOGNITION
   ============================================================ */

function createRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        console.warn(
            "SpeechRecognition is not supported."
        );

        return null;
    }

    const recognizer =
        new SpeechRecognition();

    /*
       IMPORTANT:

       interimResults MUST be true.

       Without this, the browser waits for a final phrase
       before giving us text, which is why "umm" and "uhhh"
       were showing in the transcript but not triggering live.
    */

    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = "en-US";
    recognizer.maxAlternatives = 1;

    recognizer.onstart = () => {

        recognitionRunning = true;

        setStatus(
            "Listening",
            "listening"
        );
    };


    recognizer.onresult = event => {

        let interim = "";
        let newlyFinal = "";

        /*
           Only process results that arrived in this event.

           This gives us the earliest possible detection.
        */

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

        /*
           Process INTERIM text immediately.
        */

        if (interim.trim()) {

            processLiveSpeech(
                interim.trim(),
                false
            );
        }

        /*
           Process final text too.
        */

        if (newlyFinal.trim()) {

            processLiveSpeech(
                newlyFinal.trim(),
                true
            );

            finalTranscript +=
                newlyFinal + " ";
        }

        /*
           Build the visible transcript.
        */

        liveTranscript =
            `${finalTranscript} ${interim}`
                .replace(/\s+/g, " ")
                .trim();

        if (heardElement) {

            heardElement.innerHTML =
                highlightTranscript(
                    liveTranscript ||
                    "Listening..."
                );
        }

        updateWordCount(
            liveTranscript
        );
    };


    recognizer.onerror = event => {

        console.warn(
            "Speech recognition error:",
            event.error
        );

        /*
           Don't immediately show an error for common
           temporary browser recognition issues.
        */

        if (
            event.error === "no-speech" ||
            event.error === "aborted"
        ) {
            return;
        }

        setStatus(
            "Recognition error",
            "error"
        );
    };


    recognizer.onend = () => {

        recognitionRunning = false;

        /*
           Chrome can automatically end recognition after
           a pause even when we are still recording.

           Restart it automatically.
        */

        if (isRecording) {

            setTimeout(
                () => {

                    if (
                        isRecording &&
                        !recognitionRunning
                    ) {

                        try {
                            recognizer.start();
                        } catch (_) {}
                    }

                },
                100
            );

        } else {

            setStatus(
                "Ready",
                "ready"
            );
        }
    };


    return recognizer;
}


/* ============================================================
   START SPEECH RECOGNITION
   ============================================================ */

function startRecognition() {

    if (!recognition) {

        recognition =
            createRecognition();
    }

    if (!recognition) {

        console.warn(
            "Live speech recognition unavailable."
        );

        return;
    }

    try {

        detectedLiveTokens.clear();

        recognition.start();

    } catch (error) {

        /*
           Browser throws if start() is called while already
           running. That's okay.
        */

        console.log(
            "Recognition start:",
            error.message
        );
    }
}


/* ============================================================
   STOP SPEECH RECOGNITION
   ============================================================ */

function stopRecognition() {

    if (!recognition) {
        return;
    }

    try {
        recognition.stop();
    } catch (_) {}

    recognitionRunning = false;
}


/* ============================================================
   STATUS
   ============================================================ */

function setStatus(text, state = "ready") {

    if (statusElement) {
        statusElement.textContent = text;
    }

    if (statusDot) {

        statusDot.className =
            `dot ${state}`;
    }
}


/* ============================================================
   STATS
   ============================================================ */

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


/* ============================================================
   MEDIA RECORDER
   ============================================================ */

async function startMediaRecorder() {

    try {

        mediaStream =
            await navigator.mediaDevices.getUserMedia(
                {
                    audio: true
                }
            );

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

        setStatus(
            "Microphone unavailable",
            "error"
        );

        throw error;
    }

    audioChunks = [];

    let mimeType = "";

    const possibleTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus"
    ];

    for (
        const type of possibleTypes
    ) {

        if (
            MediaRecorder.isTypeSupported(
                type
            )
        ) {

            mimeType = type;

            break;
        }
    }

    mediaRecorder =
        mimeType
            ? new MediaRecorder(
                mediaStream,
                { mimeType }
            )
            : new MediaRecorder(
                mediaStream
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

    mediaRecorder.start(250);
}


/* ============================================================
   STOP MEDIA RECORDER
   ============================================================ */

function stopMediaRecorder() {

    return new Promise(
        resolve => {

            if (!mediaRecorder) {

                resolve(null);

                return;
            }

            mediaRecorder.onstop =
                () => {

                    const blob =
                        new Blob(
                            audioChunks,
                            {
                                type:
                                    mediaRecorder.mimeType ||
                                    "audio/webm"
                            }
                        );

                    if (mediaStream) {

                        mediaStream
                            .getTracks()
                            .forEach(
                                track =>
                                    track.stop()
                            );
                    }

                    mediaStream = null;

                    mediaRecorder = null;

                    resolve(blob);
                };

            try {

                mediaRecorder.stop();

            } catch (error) {

                console.error(
                    "Recorder stop error:",
                    error
                );

                resolve(null);
            }
        }
    );
}


/* ============================================================
   START RECORDING
   ============================================================ */

async function startRecording() {

    if (isRecording) {
        return;
    }

    isRecording = true;

    finalTranscript = "";
    liveTranscript = "";

    fillerCount = 0;
    wordCount = 0;

    detectedLiveTokens.clear();

    lastDetectedWord = "";
    lastDetectedTime = 0;

    updateStats();

    if (analyzeButton) {

        analyzeButton.disabled = true;
    }

    if (analysisElement) {

        analysisElement.innerHTML = "";
    }

    if (heardElement) {

        heardElement.innerHTML =
            "Listening...";
    }

    if (listenButton) {

        listenButton.disabled = true;
    }

    if (stopButton) {

        stopButton.disabled = false;
    }

    setStatus(
        "Starting...",
        "listening"
    );

    startRecordingTimer();

    /*
       Start BOTH systems.

       SpeechRecognition gives us fast live detection.

       MediaRecorder provides the audio for final OpenAI
       transcription.
    */

    try {

        await startMediaRecorder();

    } catch (error) {

        isRecording = false;

        if (listenButton) {
            listenButton.disabled = false;
        }

        if (stopButton) {
            stopButton.disabled = true;
        }

        stopRecordingTimer();

        return;
    }

    startRecognition();

    setStatus(
        "Listening",
        "listening"
    );
}


/* ============================================================
   STOP RECORDING
   ============================================================ */

async function stopRecording() {

    if (!isRecording) {
        return;
    }

    isRecording = false;

    setStatus(
        "Processing...",
        "ready"
    );

    if (listenButton) {

        listenButton.disabled = false;
    }

    if (stopButton) {

        stopButton.disabled = true;
    }

    stopRecordingTimer();

    stopRecognition();

    const audioBlob =
        await stopMediaRecorder();

    /*
       Give the final recognition result a tiny amount of time
       to arrive before finishing the transcript.
    */

    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                150
            )
    );

    finalTranscript =
        finalTranscript.trim();

    liveTranscript =
        liveTranscript.trim();

    if (audioBlob) {

        await transcribeAudio(
            audioBlob
        );
    }

    if (heardElement) {

        heardElement.innerHTML =
            highlightTranscript(
                finalTranscript ||
                liveTranscript ||
                "No speech detected."
            );
    }

    if (finalTranscript.trim()) {

        if (analyzeButton) {

            analyzeButton.disabled = false;
        }
    }

    setStatus(
        "Ready",
        "ready"
    );
}


/* ============================================================
   RECORDING TIMER
   ============================================================ */

function startRecordingTimer() {

    recordingStartTime =
        Date.now();

    clearInterval(
        recordingTimer
    );

    recordingTimer =
        setInterval(
            updateRecordingTimer,
            250
        );
}


function stopRecordingTimer() {

    clearInterval(
        recordingTimer
    );

    recordingTimer = null;
}


function updateRecordingTimer() {

    const timer =
        document.getElementById(
            "recordingTimer"
        );

    if (!timer || !recordingStartTime) {
        return;
    }

    const elapsed =
        Math.floor(
            (Date.now() -
                recordingStartTime) /
            1000
        );

    const minutes =
        Math.floor(
            elapsed / 60
        );

    const seconds =
        elapsed % 60;

    timer.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


/* ============================================================
   CONVERT BLOB TO BASE64
   ============================================================ */

function blobToBase64(blob) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onloadend =
                () => {

                    const result =
                        reader.result;

                    const base64 =
                        result.split(",")[1];

                    resolve(base64);
                };

            reader.onerror =
                reject;

            reader.readAsDataURL(
                blob
            );
        }
    );
}


/* ============================================================
   FINAL OPENAI TRANSCRIPTION
   ============================================================ */

async function transcribeAudio(blob) {

    try {

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
                            mimeType:
                                blob.type
                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data?.error ||
                "Transcription failed"
            );
        }

        const transcript =
            data?.transcript ||
            data?.text ||
            "";

        if (transcript.trim()) {

            finalTranscript =
                transcript.trim();

            liveTranscript =
                finalTranscript;

            updateWordCount(
                finalTranscript
            );

            if (heardElement) {

                heardElement.innerHTML =
                    highlightTranscript(
                        finalTranscript
                    );
            }

            /*
               Also count any filler words found by the final
               transcription, in case the live browser engine
               missed one.
            */

            updateFillerCountFromTranscript(
                finalTranscript
            );

            if (analyzeButton) {

                analyzeButton.disabled = false;
            }
        }

    } catch (error) {

        console.error(
            "Final transcription error:",
            error
        );

        /*
           Don't destroy the live transcript if OpenAI
           transcription fails.
        */

        if (
            !finalTranscript &&
            liveTranscript
        ) {

            finalTranscript =
                liveTranscript;
        }

        if (heardElement) {

            heardElement.innerHTML =
                highlightTranscript(
                    finalTranscript ||
                    liveTranscript ||
                    "Transcription failed."
                );
        }

        if (finalTranscript.trim()) {

            if (analyzeButton) {
                analyzeButton.disabled = false;
            }
        }
    }
}


/* ============================================================
   COUNT FILLERS FROM FINAL TRANSCRIPT
   ============================================================ */

function updateFillerCountFromTranscript(
    transcript
) {

    let total = 0;

    const seenPositions = [];

    trackedWords.forEach(
        word => {

            const regex =
                buildWordRegex(
                    word
                );

            let match;

            while (
                (match =
                    regex.exec(
                        transcript
                    )) !== null
            ) {

                const position =
                    `${match.index}-${match[0].length}`;

                if (
                    !seenPositions.includes(
                        position
                    )
                ) {

                    seenPositions.push(
                        position
                    );

                    total++;
                }

                if (
                    match.index ===
                    regex.lastIndex
                ) {

                    regex.lastIndex++;
                }
            }
        }
    );

    fillerCount =
        total;

    updateStats();
}


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

async function enableNotifications() {

    if (
        typeof Notification ===
        "undefined"
    ) {

        if (notificationStatus) {

            notificationStatus.textContent =
                "Notifications are not supported in this browser.";
        }

        return;
    }

    try {

        const permission =
            await Notification.requestPermission();

        notificationPermission =
            permission === "granted";

        if (notificationStatus) {

            if (
                permission === "granted"
            ) {

                notificationStatus.textContent =
                    "Notifications are enabled.";

            } else {

                notificationStatus.textContent =
                    "Notifications were not enabled.";
            }
        }

        if (
            enableNotificationsButton
        ) {

            if (
                permission === "granted"
            ) {

                enableNotificationsButton.textContent =
                    "✓ Notifications Enabled";

                enableNotificationsButton.classList.add(
                    "enabled"
                );

            } else {

                enableNotificationsButton.textContent =
                    "🔔 Enable Notifications";
            }
        }

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );
    }
}


if (
    enableNotificationsButton
) {

    enableNotificationsButton.addEventListener(
        "click",
        enableNotifications
    );
}


/* ============================================================
   AI ANALYSIS
   ============================================================ */

async function analyzeSpeech() {

    const transcript =
        finalTranscript.trim();

    if (!transcript) {

        return;
    }

    if (analysisLoading) {

        analysisLoading.hidden = false;
    }

    if (analyzeButton) {

        analyzeButton.disabled = true;
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

        /*
           The API returns both:
             analysis
             analysisData

           Prefer the structured data when available.
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

            renderTextAnalysis(
                data.analysis
            );

        } else {

            throw new Error(
                "No analysis was returned."
            );
        }

    } catch (error) {

        console.error(
            "AI analysis error:",
            error
        );

        if (analysisElement) {

            analysisElement.innerHTML =
                `<div class="analysis-error">
                    <strong>Analysis failed</strong>
                    <p>${escapeHTML(error.message)}</p>
                </div>`;
        }

    } finally {

        if (analysisLoading) {

            analysisLoading.hidden = true;
        }

        if (analyzeButton) {

            analyzeButton.disabled = false;
        }
    }
}


/* ============================================================
   STRUCTURED AI ANALYSIS
   ============================================================ */

function renderStructuredAnalysis(
    analysis
) {

    if (!analysisElement) {
        return;
    }

    const sections = [
        ["Overall Assessment", analysis.overall],
        ["Filler Words", analysis.fillerWords],
        ["Clarity & Wording", analysis.clarity],
        ["Strength", analysis.strength],
        ["Improvement", analysis.improvement],
        ["Practical Tip", analysis.tip]
    ];

    analysisElement.innerHTML =
        sections
            .filter(
                ([, value]) =>
                    typeof value ===
                    "string" &&
                    value.trim()
            )
            .map(
                ([title, value]) =>
                    `<div class="analysis-section">
                        <h3>${escapeHTML(title)}</h3>
                        <p>${escapeHTML(value)}</p>
                    </div>`
            )
            .join("");
}


/* ============================================================
   TEXT AI ANALYSIS FALLBACK
   ============================================================ */

function renderTextAnalysis(
    text
) {

    if (!analysisElement) {
        return;
    }

    analysisElement.innerHTML =
        `<div class="analysis-section">
            <p>${escapeHTML(text).replace(/\n/g, "<br>")}</p>
        </div>`;
}


/* ============================================================
   LISTEN / STOP BUTTONS
   ============================================================ */

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


if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );
}


/* ============================================================
   THEME / MODE SWITCHER
   ============================================================ */

function getCurrentTheme() {

    return (
        document.documentElement
            .getAttribute("data-theme") ||
        "light"
    );
}


function applyTheme(theme) {

    document.documentElement
        .setAttribute(
            "data-theme",
            theme
        );

    localStorage.setItem(
        THEME_KEY,
        theme
    );

    updateThemeButton(
        theme
    );
}


function updateThemeButton(theme) {

    let button =
        document.getElementById(
            "themeToggle"
        );

    /*
       If the old button doesn't exist,
       create a nicer one automatically.
    */

    if (!button) {

        button =
            document.createElement(
                "button"
            );

        button.id =
            "themeToggle";

        button.className =
            "theme-toggle";

        button.type =
            "button";

        document.body.appendChild(
            button
        );

        button.addEventListener(
            "click",
            toggleTheme
        );
    }

    if (theme === "dark") {

        button.innerHTML =
            "☀️";

        button.setAttribute(
            "aria-label",
            "Switch to light mode"
        );

        button.title =
            "Switch to light mode";

    } else {

        button.innerHTML =
            "🌙";

        button.setAttribute(
            "aria-label",
            "Switch to dark mode"
        );

        button.title =
            "Switch to dark mode";
    }
}


function toggleTheme() {

    const current =
        getCurrentTheme();

    applyTheme(
        current === "dark"
            ? "light"
            : "dark"
    );
}


function initializeTheme() {

    const saved =
        localStorage.getItem(
            THEME_KEY
        );

    if (saved === "dark" || saved === "light") {

        applyTheme(saved);

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


/* ============================================================
   INITIALIZATION
   ============================================================ */

renderWordList();

initializeTheme();

if (
    typeof Notification !==
    "undefined"
) {

    notificationPermission =
        Notification.permission ===
        "granted";

    if (
        notificationPermission &&
        notificationStatus
    ) {

        notificationStatus.textContent =
            "Notifications are enabled.";
    }
}

updateStats();


/* ============================================================
   DEBUGGING HELPER
   ============================================================ */

/*
   Open the browser console while testing.

   If you say "umm", you should see this function
   trigger from INTERIM recognition results.

   The important detection path is:

       SpeechRecognition
             ↓
       interimResults
             ↓
       processLiveSpeech()
             ↓
       triggerTrackedWord()
             ↓
       vibrateImmediately()
             ↓
       sendFastNotification()

   This avoids waiting for the final OpenAI transcription.
*/

console.log(
    "Speech Tracker initialized."
);

console.log(
    "Tracked words:",
    trackedWords
);

console.log(
    "Live interim detection:",
    true
);

/* ============================================================
   THEME SYSTEM
============================================================ */

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

function applyTheme(theme) {

    document.documentElement.setAttribute(
        "data-theme",
        theme
    );

    localStorage.setItem(
        "speechTrackerTheme",
        theme
    );

    if (themeIcon) {
        themeIcon.textContent =
            theme === "dark"
                ? "🌙"
                : "☀️";
    }
}


function initializeTheme() {

    const savedTheme =
        localStorage.getItem("speechTrackerTheme");

    if (savedTheme) {
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


initializeTheme();


if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        () => {

            const current =
                document.documentElement
                    .getAttribute("data-theme");

            applyTheme(
                current === "dark"
                    ? "light"
                    : "dark"
            );
        }
    );
}


/* ============================================================
   AUTH SYSTEM
   MVP / LOCAL BROWSER VERSION
============================================================ */

const authModal =
    document.getElementById("authModal");

const closeAuth =
    document.getElementById("closeAuth");

const accountButton =
    document.getElementById("accountButton");

const accountButtonText =
    document.getElementById("accountButtonText");

const accountAvatar =
    document.getElementById("accountAvatar");

const authTitle =
    document.getElementById("authTitle");

const authSubtitle =
    document.getElementById("authSubtitle");

const authSwitch =
    document.getElementById("authSwitch");

const loginForm =
    document.getElementById("loginForm");

const signupForm =
    document.getElementById("signupForm");

const loginError =
    document.getElementById("loginError");

const signupError =
    document.getElementById("signupError");

const accountMenu =
    document.getElementById("accountMenu");

const logoutButton =
    document.getElementById("logoutButton");

const menuName =
    document.getElementById("menuName");

const menuEmail =
    document.getElementById("menuEmail");

const menuAvatar =
    document.getElementById("menuAvatar");


let authMode = "login";


function getUsers() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "speechTrackerUsers"
            )
        ) || [];

    } catch {

        return [];
    }
}


function saveUsers(users) {

    localStorage.setItem(
        "speechTrackerUsers",
        JSON.stringify(users)
    );
}


function getCurrentUser() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "speechTrackerCurrentUser"
            )
        );

    } catch {

        return null;
    }
}


function setCurrentUser(user) {

    if (user) {

        localStorage.setItem(
            "speechTrackerCurrentUser",
            JSON.stringify(user)
        );

    } else {

        localStorage.removeItem(
            "speechTrackerCurrentUser"
        );
    }
}


function openAuth() {

    authModal.hidden = false;

    accountMenu.hidden = true;

    document.body.style.overflow =
        "hidden";
}


function closeAuthModal() {

    authModal.hidden = true;

    document.body.style.overflow =
        "";

    loginError.textContent = "";
    signupError.textContent = "";
}


function showLogin() {

    authMode = "login";

    loginForm.hidden = false;
    signupForm.hidden = true;

    authTitle.textContent =
        "Welcome back";

    authSubtitle.textContent =
        "Log in to save and review your speeches.";

    authSwitch.textContent =
        "Don't have an account? Sign up";

    loginError.textContent = "";
    signupError.textContent = "";
}


function showSignup() {

    authMode = "signup";

    loginForm.hidden = true;
    signupForm.hidden = false;

    authTitle.textContent =
        "Create your account";

    authSubtitle.textContent =
        "Start saving and reviewing your speaking practice.";

    authSwitch.textContent =
        "Already have an account? Log in";

    loginError.textContent = "";
    signupError.textContent = "";
}


function updateAccountUI() {

    const user =
        getCurrentUser();

    if (!user) {

        accountButtonText.textContent =
            "Log in";

        accountAvatar.textContent =
            "?";

        return;
    }


    const firstLetter =
        (
            user.name ||
            user.email ||
            "U"
        )
        .trim()
        .charAt(0)
        .toUpperCase();


    accountButtonText.textContent =
        user.name || "Account";

    accountAvatar.textContent =
        firstLetter;

    menuName.textContent =
        user.name || "User";

    menuEmail.textContent =
        user.email;

    menuAvatar.textContent =
        firstLetter;
}


updateAccountUI();


accountButton.addEventListener(
    "click",
    () => {

        const user =
            getCurrentUser();

        if (!user) {

            openAuth();

            showLogin();

        } else {

            accountMenu.hidden =
                !accountMenu.hidden;
        }
    }
);


closeAuth.addEventListener(
    "click",
    closeAuthModal
);


authModal.addEventListener(
    "click",
    (event) => {

        if (
            event.target ===
            authModal
        ) {
            closeAuthModal();
        }
    }
);


authSwitch.addEventListener(
    "click",
    () => {

        if (authMode === "login") {

            showSignup();

        } else {

            showLogin();
        }
    }
);


/* =========================
   SIGN UP
========================= */

signupForm.addEventListener(
    "submit",
    (event) => {

        event.preventDefault();

        signupError.textContent = "";

        const name =
            document
                .getElementById("signupName")
                .value
                .trim();

        const email =
            document
                .getElementById("signupEmail")
                .value
                .trim()
                .toLowerCase();

        const password =
            document
                .getElementById("signupPassword")
                .value;


        const users =
            getUsers();


        const existingUser =
            users.find(
                user =>
                    user.email === email
            );


        if (existingUser) {

            signupError.textContent =
                "An account with this email already exists.";

            return;
        }


        const newUser = {

            id:
                Date.now().toString(),

            name,

            email,

            password
        };


        users.push(newUser);

        saveUsers(users);

        setCurrentUser({
            id: newUser.id,
            name: newUser.name,
            email: newUser.email
        });


        signupForm.reset();

        closeAuthModal();

        updateAccountUI();

        loadSavedSpeeches();
    }
);


/* =========================
   LOGIN
========================= */

loginForm.addEventListener(
    "submit",
    (event) => {

        event.preventDefault();

        loginError.textContent = "";

        const email =
            document
                .getElementById("loginEmail")
                .value
                .trim()
                .toLowerCase();

        const password =
            document
                .getElementById("loginPassword")
                .value;


        const users =
            getUsers();


        const user =
            users.find(
                item =>
                    item.email === email &&
                    item.password === password
            );


        if (!user) {

            loginError.textContent =
                "Incorrect email or password.";

            return;
        }


        setCurrentUser({

            id: user.id,

            name: user.name,

            email: user.email

        });


        loginForm.reset();

        closeAuthModal();

        updateAccountUI();

        loadSavedSpeeches();
    }
);


/* =========================
   LOG OUT
========================= */

logoutButton.addEventListener(
    "click",
    () => {

        setCurrentUser(null);

        accountMenu.hidden = true;

        updateAccountUI();

        loadSavedSpeeches();
    }
);


/* ============================================================
   SAVED SPEECHES
============================================================ */

const saveSpeechButton =
    document.getElementById(
        "saveSpeechButton"
    );

const speechTitle =
    document.getElementById(
        "speechTitle"
    );

const saveStatus =
    document.getElementById(
        "saveStatus"
    );

const pastSpeeches =
    document.getElementById(
        "pastSpeeches"
    );

const speechCount =
    document.getElementById(
        "speechCount"
    );


function getSavedSpeeches() {

    const user =
        getCurrentUser();

    if (!user) {
        return [];
    }


    try {

        const all =
            JSON.parse(
                localStorage.getItem(
                    "speechTrackerSpeeches"
                )
            ) || {};


        return all[user.id] || [];

    } catch {

        return [];
    }
}


function saveSpeechData(speech) {

    const user =
        getCurrentUser();

    if (!user) {
        return false;
    }


    let all = {};

    try {

        all =
            JSON.parse(
                localStorage.getItem(
                    "speechTrackerSpeeches"
                )
            ) || {};

    } catch {

        all = {};
    }


    if (!all[user.id]) {
        all[user.id] = [];
    }


    all[user.id].unshift(
        speech
    );


    localStorage.setItem(
        "speechTrackerSpeeches",
        JSON.stringify(all)
    );


    return true;
}


function loadSavedSpeeches() {

    if (!pastSpeeches) {
        return;
    }


    const user =
        getCurrentUser();


    if (!user) {

        pastSpeeches.innerHTML = `
            <div class="empty-history">
                Log in and save a speech to see it here.
            </div>
        `;

        if (speechCount) {
            speechCount.textContent = "0";
        }

        return;
    }


    const speeches =
        getSavedSpeeches();


    if (speechCount) {
        speechCount.textContent =
            speeches.length;
    }


    if (speeches.length === 0) {

        pastSpeeches.innerHTML = `
            <div class="empty-history">
                You haven't saved any speeches yet.
            </div>
        `;

        return;
    }


    pastSpeeches.innerHTML =
        speeches
            .map(
                speech => `

                <div class="speech-item">

                    <div>

                        <div class="speech-item-title">
                            ${escapeHTML(
                                speech.title
                            )}
                        </div>

                        <div class="speech-item-date">
                            ${new Date(
                                speech.date
                            ).toLocaleString()}
                        </div>

                    </div>

                    <button
                        type="button"
                        data-speech-id="${speech.id}"
                        class="view-speech"
                    >
                        View
                    </button>

                </div>
            `
            )
            .join("");


    document
        .querySelectorAll(
            ".view-speech"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        viewSavedSpeech(
                            button.dataset.speechId
                        );
                    }
                );
            }
        );
}


function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function viewSavedSpeech(id) {

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


    const transcript =
        document.getElementById(
            "transcriptSection"
        );


    const analysis =
        document.getElementById(
            "analysis"
        );


    if (transcript) {

        transcript.innerHTML =
            escapeHTML(
                speech.transcript ||
                "No transcript saved."
            );
    }


    if (analysis) {

        analysis.textContent =
            speech.analysis ||
            "No analysis saved.";
    }


    window.scrollTo({
        top:
            transcript
                ? transcript.offsetTop - 100
                : 0,

        behavior:
            "smooth"
    });
}


if (saveSpeechButton) {

    saveSpeechButton.addEventListener(
        "click",
        () => {

            saveStatus.textContent = "";

            const user =
                getCurrentUser();


            if (!user) {

                openAuth();

                showLogin();

                saveStatus.textContent =
                    "Log in first to save speeches.";

                return;
            }


            const transcriptElement =
                document.getElementById(
                    "transcriptSection"
                );

            const analysisElement =
                document.getElementById(
                    "analysis"
                );


            const transcript =
                transcriptElement
                    ? transcriptElement.innerText.trim()
                    : "";


            const analysis =
                analysisElement
                    ? analysisElement.innerText.trim()
                    : "";


            if (
                !transcript ||
                transcript ===
                    "Your transcript will appear here."
            ) {

                saveStatus.textContent =
                    "Record a speech before saving it.";

                return;
            }


            const title =
                speechTitle.value.trim() ||
                `Speech — ${new Date().toLocaleDateString()}`;


            const saved =
                saveSpeechData({

                    id:
                        Date.now().toString(),

                    title,

                    transcript,

                    analysis,

                    date:
                        new Date().toISOString()

                });


            if (!saved) {

                openAuth();

                showLogin();

                return;
            }


            speechTitle.value = "";

            saveStatus.textContent =
                "✓ Speech saved successfully.";

            loadSavedSpeeches();
        }
    );
}


loadSavedSpeeches();


/* ============================================================
   CLOSE ACCOUNT MENU WHEN CLICKING OUTSIDE
============================================================ */

document.addEventListener(
    "click",
    event => {

        if (
            !accountMenu.hidden &&
            !accountMenu.contains(event.target) &&
            !accountButton.contains(event.target)
        ) {

            accountMenu.hidden = true;
        }
    }
);