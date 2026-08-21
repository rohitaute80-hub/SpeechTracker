// ============================================================
// SPEECH TRACKER
// Microphone → Transcription → Filler Detection
// → Highlighting → Vibration → Notification → AI Analysis
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


// ============================================================
// DEFAULT TRACKED WORDS
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
// VARIABLES
// ============================================================

let trackedWords = [];

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];

let isRecording = false;

let finalTranscript = "";

let fillerCount = 0;
let totalWords = 0;


// ============================================================
// LOAD SAVED WORDS
// ============================================================

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

    if (heardText) {

        heardText.textContent =
            message;
    }
}


// ============================================================
// SAVE WORDS
// ============================================================

function saveWords() {

    try {

        localStorage.setItem(
            "speechTrackerWords",
            JSON.stringify(trackedWords)
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

    div.textContent = text;

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


// ============================================================
// CUSTOM WORD BUTTON
// ============================================================

if (addWordButton) {

    addWordButton.addEventListener(
        "click",
        addCustomWord
    );
}


// ============================================================
// ENTER TO ADD WORD
// ============================================================

if (customWordInput) {

    customWordInput.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Enter") {

                event.preventDefault();

                addCustomWord();
            }
        }
    );
}


// ============================================================
// RESET WORDS
// ============================================================

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
// FIND TRACKED WORDS
// ============================================================

function findTrackedWords(text) {

    const matches = [];

    trackedWords.forEach(
        (word) => {

            if (!word.trim()) {
                return;
            }

            const regex =
                new RegExp(
                    "\\b" +
                    escapeRegex(word) +
                    "\\b",
                    "gi"
                );

            let match;

            while (
                (match = regex.exec(text)) !== null
            ) {

                matches.push({
                    word: word,
                    index: match.index
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

    let count = 0;

    trackedWords.forEach(
        (word) => {

            if (!word.trim()) {
                return;
            }

            const regex =
                new RegExp(
                    "\\b" +
                    escapeRegex(word) +
                    "\\b",
                    "gi"
                );

            const matches =
                text.match(regex);

            if (matches) {

                count +=
                    matches.length;
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
// HIGHLIGHT TRACKED WORDS
// ============================================================

function highlightTrackedWords(text) {

    let result =
        escapeHTML(text);


    const sortedWords =
        [...trackedWords].sort(
            (a, b) =>
                b.length - a.length
        );


    sortedWords.forEach(
        (word) => {

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
// DISPLAY TRANSCRIPT
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


    // Enable analysis only when we actually
    // have a transcript.

    if (analyzeButton) {

        analyzeButton.disabled =
            !finalTranscript.trim();
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
            "Vibration is not supported."
        );

        return false;
    }


    try {

        navigator.vibrate([
            150
        ]);

        return true;

    } catch (error) {

        console.error(
            "Vibration failed:",
            error
        );

        return false;
    }
}


// ============================================================
// NOTIFICATION
// ============================================================

async function showFillerNotification(word) {

    console.log(
        "Filler detected:",
        word
    );


    // If Notifications are unavailable,
    // the in-app warning still works.

    if (
        typeof Notification ===
        "undefined"
    ) {

        console.log(
            "Notifications are not supported."
        );

        return;
    }


    try {

        let permission =
            Notification.permission;


        // Ask for permission if needed.

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


        // Show notification while the
        // web app is active.

        new Notification(
            "Speech Tracker",
            {
                body:
                    `You said "${word}"`,
                tag:
                    "speech-tracker-" +
                    Date.now()
            }
        );


    } catch (error) {

        console.error(
            "Notification failed:",
            error
        );
    }
}


// ============================================================
// IN-APP FILLER WARNING
// ============================================================

function showFillerWarning(word) {

    if (!heardText) {
        return;
    }


    const original =
        heardText.innerHTML;


    heardText.innerHTML =
        `<strong>⚠️ You said "${escapeHTML(word)}"</strong><br><br>` +
        original;
}


// ============================================================
// HANDLE DETECTED FILLER
// ============================================================

async function handleFillerWord(word) {

    console.log(
        "Handling filler word:",
        word
    );


    // Phone vibration

    vibrate();


    // In-app warning

    showFillerWarning(word);


    // Notification

    await showFillerNotification(
        word
    );
}


// ============================================================
// VIBRATE / NOTIFY FOR ALL WORDS
// ============================================================

async function processTrackedWords(text) {

    const matches =
        findTrackedWords(text);


    console.log(
        "Tracked words:",
        matches
    );


    for (
        const match of matches
    ) {

        await handleFillerWord(
            match.word
        );


        // Small delay between
        // multiple notifications.

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    500
                )
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
// CHOOSE AUDIO FORMAT
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

            console.log(
                "Format check failed:",
                format
            );
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
            "Your browser does not support microphone recording."
        );

        return;
    }


    try {

        console.log(
            "Requesting microphone..."
        );


        audioStream =
            await navigator
                .mediaDevices
                .getUserMedia({
                    audio: true
                });


        console.log(
            "Microphone permission granted."
        );


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


        // Audio data

        mediaRecorder.addEventListener(
            "dataavailable",
            (event) => {

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


        // Recording finished

        mediaRecorder.addEventListener(
            "stop",
            async () => {

                console.log(
                    "MediaRecorder stopped."
                );


                // Give the final dataavailable
                // event time to finish.

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


        mediaRecorder.start(
            250
        );


        isRecording =
            true;


        if (listenButton) {

            listenButton.disabled =
                true;
        }


        if (stopButton) {

            stopButton.disabled =
                false;
        }


        setStatus(
            "Recording...",
            "listening"
        );


        showMessage(
            "🎤 Listening... Press Stop when you're finished."
        );


    } catch (error) {

        console.error(
            "MICROPHONE ERROR:",
            error
        );


        isRecording =
            false;


        if (audioStream) {

            audioStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
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

    console.log(
        "Stop button pressed."
    );


    if (
        !mediaRecorder ||
        !isRecording
    ) {

        console.log(
            "Nothing is currently recording."
        );

        return;
    }


    try {

        mediaRecorder.stop();

    } catch (error) {

        console.error(
            "Could not stop recorder:",
            error
        );
    }


    isRecording =
        false;


    if (audioStream) {

        audioStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );
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


    showMessage(
        "🤖 AI is transcribing your speech..."
    );
}


// ============================================================
// LISTEN BUTTON
// ============================================================

if (listenButton) {

    listenButton.addEventListener(
        "click",
        startRecording
    );
}


// ============================================================
// STOP BUTTON
// ============================================================

if (stopButton) {

    stopButton.addEventListener(
        "click",
        stopRecording
    );
}


// ============================================================
// SEND RECORDING TO VERCEL
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


        console.log(
            "Audio recorded:",
            audioBlob.size,
            "bytes"
        );


        const arrayBuffer =
            await audioBlob.arrayBuffer();


        const bytes =
            new Uint8Array(
                arrayBuffer
            );


        let binary = "";


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


        console.log(
            "Sending audio to /api/transcribe..."
        );


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
                "The AI returned an empty transcript."
            );
        }


        console.log(
            "TRANSCRIPT:",
            data.transcript
        );


        // IMPORTANT:
        // Display transcript BEFORE
        // doing filler notifications.

        displayTranscript(
            data.transcript
        );


        setStatus(
            "Finished",
            "ready"
        );


        // Notify about fillers.

        await processTrackedWords(
            data.transcript
        );


        // Make sure analysis button
        // is available.

        if (analyzeButton) {

            analyzeButton.disabled =
                false;
        }


    } catch (error) {

        console.error(
            "TRANSCRIPTION ERROR:",
            error
        );


        setStatus(
            "Transcription error",
            "error"
        );


        showMessage(
            "Transcription failed: " +
            error.message
        );
    }
}


// ============================================================
// DISPLAY AI ANALYSIS
// ============================================================

function displayAnalysis(text) {

    if (!analysisElement) {
        return;
    }


    // Convert the plain AI response
    // into readable HTML safely.

    const safe =
        escapeHTML(text);


    const formatted =
        safe
            .replace(
                /\n\n+/g,
                "<br><br>"
            )
            .replace(
                /\n/g,
                "<br>"
            );


    analysisElement.innerHTML =
        formatted;
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

        console.log(
            "Sending speech for AI analysis..."
        );


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


        // DO NOT immediately call
        // response.json().
        //
        // First read the raw response.
        // This prevents the "invalid JSON"
        // error from hiding the actual
        // server response.

        const responseText =
            await response.text();


        console.log(
            "RAW ANALYSIS SERVER RESPONSE:",
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
                "Analysis server returned invalid JSON. Raw response: " +
                responseText.substring(
                    0,
                    500
                )
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
            !data.analysis ||
            typeof data.analysis !==
                "string"
        ) {

            throw new Error(
                "OpenAI returned an empty analysis."
            );
        }


        console.log(
            "AI ANALYSIS:",
            data.analysis
        );


        displayAnalysis(
            data.analysis
        );


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
// ANALYZE BUTTON
// ============================================================

if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );
}


// ============================================================
// NOTIFICATION PERMISSION BUTTON
// ============================================================
//
// This supports an existing button if your
// HTML has one with one of these IDs:
//
// enableNotifications
// enableNotificationsButton
//
// ============================================================

const enableNotificationsButton =
    document.getElementById(
        "enableNotifications"
    ) ||
    document.getElementById(
        "enableNotificationsButton"
    );


async function requestNotificationPermission() {

    if (
        typeof Notification ===
        "undefined"
    ) {

        alert(
            "Notifications are not supported by this browser."
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
            }


            // Test notification.

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
// STARTUP
// ============================================================

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
// DEBUG INFORMATION
// ============================================================

console.log(
    "===================================="
);

console.log(
    "Speech Tracker loaded."
);

console.log(
    "HTTPS:",
    location.protocol
);

console.log(
    "Microphone API:",
    !!navigator.mediaDevices
);

console.log(
    "getUserMedia:",
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
    "===================================="
);