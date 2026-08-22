// ============================================================
// SPEECH TRACKER
// Live Browser Transcription
// +
// OpenAI Final Transcription
// +
// Filler Detection / Highlighting / Vibration / Notifications
// +
// AI Analysis
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
// DEFAULT WORDS
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
// TRACKED WORDS
// ============================================================

let trackedWords = [];

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
// RECORDING VARIABLES
// ============================================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];

let isRecording = false;


// ============================================================
// LIVE TRANSCRIPTION VARIABLES
// ============================================================

let recognition = null;

let liveRecognitionSupported = false;

let liveFinalText = "";

let liveInterimText = "";

let recognitionShouldRun = false;

let processedLiveText = "";


// ============================================================
// FINAL TRANSCRIPT
// ============================================================

let finalTranscript = "";

let fillerCount = 0;
let totalWords = 0;


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

    if (!heardText) {
        return;
    }

    heardText.textContent =
        message;
}


// ============================================================
// SAVE WORDS
// ============================================================

function saveWords() {

    try {

        localStorage.setItem(
            "speechTrackerWords",
            JSON.stringify(
                trackedWords
            )
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

    div.textContent =
        text;

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


if (addWordButton) {

    addWordButton.addEventListener(
        "click",
        addCustomWord
    );
}


if (customWordInput) {

    customWordInput.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                event.preventDefault();

                addCustomWord();
            }
        }
    );
}


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
        word => {

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

                    word:
                        word,

                    index:
                        match.index
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
// COUNT WORDS
// ============================================================

function countTrackedWords(text) {

    let count = 0;

    trackedWords.forEach(
        word => {

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
// HIGHLIGHT
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
        word => {

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
// DISPLAY TEXT
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


    if (analyzeButton) {

        analyzeButton.disabled =
            !finalTranscript.trim();
    }
}


// ============================================================
// DISPLAY LIVE TRANSCRIPTION
// ============================================================

function displayLiveTranscript() {

    const complete =
        liveFinalText || "";

    const interim =
        liveInterimText || "";


    const combined =
        (
            complete +
            " " +
            interim
        ).trim();


    if (!combined) {
        return;
    }


    const fillerMatches =
        findTrackedWords(
            combined
        );


    fillerCount =
        countTrackedWords(
            combined
        );


    totalWords =
        countTotalWords(
            combined
        );


    if (heardText) {

        heardText.innerHTML =
            highlightTrackedWords(
                combined
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


    return fillerMatches;
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
            "Vibration not supported."
        );

        return;
    }


    try {

        navigator.vibrate([
            150
        ]);

    } catch (error) {

        console.error(
            "Vibration error:",
            error
        );
    }
}


// ============================================================
// NOTIFICATION
// ============================================================

async function notifyFiller(word) {

    console.log(
        "FILLER DETECTED:",
        word
    );


    if (
        typeof Notification ===
        "undefined"
    ) {

        return;
    }


    try {

        let permission =
            Notification.permission;


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
            "Notification error:",
            error
        );
    }
}


// ============================================================
// HANDLE NEW FILLER
// ============================================================

async function handleNewFiller(word) {

    console.log(
        "NEW FILLER:",
        word
    );


    vibrate();


    await notifyFiller(
        word
    );
}


// ============================================================
// PROCESS ONLY NEW LIVE WORDS
// ============================================================

async function processLiveFillers(text) {

    const matches =
        findTrackedWords(text);


    if (matches.length === 0) {
        return;
    }


    // We only want to notify for
    // newly appearing filler words.

    const oldMatches =
        findTrackedWords(
            processedLiveText
        );


    const oldCount = {};


    oldMatches.forEach(
        match => {

            oldCount[match.word] =
                (oldCount[match.word] || 0) +
                1;
        }
    );


    const newCount = {};


    matches.forEach(
        match => {

            newCount[match.word] =
                (newCount[match.word] || 0) +
                1;
        }
    );


    for (
        const word of trackedWords
    ) {

        const before =
            oldCount[word] || 0;

        const after =
            newCount[word] || 0;


        if (after > before) {

            const difference =
                after - before;


            for (
                let i = 0;
                i < difference;
                i++
            ) {

                await handleNewFiller(
                    word
                );
            }
        }
    }


    processedLiveText =
        text;
}


// ============================================================
// LIVE SPEECH RECOGNITION
// ============================================================

function setupLiveRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        console.log(
            "Live speech recognition is not supported."
        );

        liveRecognitionSupported =
            false;

        return;
    }


    liveRecognitionSupported =
        true;


    recognition =
        new SpeechRecognition();


    recognition.continuous =
        true;


    recognition.interimResults =
        true;


    recognition.lang =
        "en-US";


    recognition.maxAlternatives =
        1;


    recognition.onstart =
        () => {

            console.log(
                "LIVE RECOGNITION STARTED"
            );
        };


    recognition.onresult =
        event => {

            let newFinalText =
                "";

            let newInterimText =
                "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const result =
                    event.results[i];


                const text =
                    result[0].transcript;


                if (result.isFinal) {

                    newFinalText +=
                        text + " ";

                } else {

                    newInterimText +=
                        text;
                }
            }


            if (newFinalText) {

                liveFinalText +=
                    newFinalText;
            }


            liveInterimText =
                newInterimText;


            const combined =
                (
                    liveFinalText +
                    " " +
                    liveInterimText
                ).trim();


            displayLiveTranscript();


            processLiveFillers(
                combined
            );
        };


    recognition.onerror =
        event => {

            console.error(
                "LIVE RECOGNITION ERROR:",
                event.error
            );


            // Don't show an error if
            // the user intentionally stopped.

            if (
                recognitionShouldRun
            ) {

                if (
                    event.error ===
                    "not-allowed"
                ) {

                    console.log(
                        "Microphone/speech recognition permission denied."
                    );

                } else if (
                    event.error ===
                    "no-speech"
                ) {

                    console.log(
                        "No speech detected."
                    );

                } else {

                    console.log(
                        "Speech recognition error:",
                        event.error
                    );
                }
            }
        };


    recognition.onend =
        () => {

            console.log(
                "LIVE RECOGNITION ENDED"
            );


            // Safari/iOS sometimes stops
            // recognition automatically.
            //
            // Restart it while recording.

            if (
                recognitionShouldRun &&
                isRecording
            ) {

                setTimeout(
                    () => {

                        if (
                            recognitionShouldRun &&
                            isRecording
                        ) {

                            try {

                                recognition.start();

                            } catch (error) {

                                console.log(
                                    "Recognition restart skipped."
                                );
                            }
                        }

                    },
                    150
                );
            }
        };
}


// ============================================================
// START LIVE TRANSCRIPTION
// ============================================================

function startLiveRecognition() {

    if (
        !recognition ||
        !liveRecognitionSupported
    ) {

        console.log(
            "Live recognition unavailable."
        );

        return;
    }


    liveFinalText =
        "";

    liveInterimText =
        "";

    processedLiveText =
        "";


    recognitionShouldRun =
        true;


    try {

        recognition.start();

    } catch (error) {

        console.log(
            "Recognition already running."
        );
    }
}


// ============================================================
// STOP LIVE TRANSCRIPTION
// ============================================================

function stopLiveRecognition() {

    recognitionShouldRun =
        false;


    if (!recognition) {
        return;
    }


    try {

        recognition.stop();

    } catch (error) {

        console.log(
            "Recognition already stopped."
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
// AUDIO FORMAT
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

        } catch (error) {}
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
            "Your browser does not allow microphone access."
        );

        return;
    }


    try {

        audioStream =
            await navigator
                .mediaDevices
                .getUserMedia({
                    audio: true
                });


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


        mediaRecorder.addEventListener(
            "dataavailable",
            event => {

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


        mediaRecorder.addEventListener(
            "stop",
            async () => {

                // Allow final audio chunk.

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


        // Start live transcription.

        startLiveRecognition();


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
            "🎤 Listening... start speaking."
        );


    } catch (error) {

        console.error(
            "MICROPHONE ERROR:",
            error
        );


        isRecording =
            false;


        stopLiveRecognition();


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

    if (
        !mediaRecorder ||
        !isRecording
    ) {

        return;
    }


    console.log(
        "STOP PRESSED"
    );


    // Stop live transcription first.

    stopLiveRecognition();


    isRecording =
        false;


    try {

        mediaRecorder.stop();

    } catch (error) {

        console.error(
            "Recorder stop error:",
            error
        );
    }


    if (audioStream) {

        audioStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        audioStream =
            null;
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


    // Keep the live transcript visible
    // while OpenAI processes the final recording.

    if (
        liveFinalText ||
        liveInterimText
    ) {

        const liveText =
            (
                liveFinalText +
                " " +
                liveInterimText
            ).trim();


        if (liveText) {

            displayTranscript(
                liveText
            );
        }
    }


    showMessage(
        "🤖 Finalizing your transcription..."
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
// SEND AUDIO TO OPENAI
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


        const arrayBuffer =
            await audioBlob.arrayBuffer();


        const bytes =
            new Uint8Array(
                arrayBuffer
            );


        let binary =
            "";


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
                "OpenAI returned an empty transcript."
            );
        }


        console.log(
            "FINAL OPENAI TRANSCRIPT:",
            data.transcript
        );


        // Replace live transcript with
        // the more accurate OpenAI transcript.

        displayTranscript(
            data.transcript
        );


        finalTranscript =
            data.transcript;


        setStatus(
            "Finished",
            "ready"
        );


        showMessage(
            "Transcription complete."
        );


    } catch (error) {

        console.error(
            "TRANSCRIPTION ERROR:",
            error
        );


        setStatus(
            "Transcription error",
            "error"
        );


        // Don't erase a valid live transcript
        // if the final API fails.

        if (
            !liveFinalText.trim() &&
            !liveInterimText.trim()
        ) {

            showMessage(
                "Transcription failed: " +
                error.message
            );
        }
    }
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


        const responseText =
            await response.text();


        console.log(
            "RAW ANALYSIS RESPONSE:",
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
                "Analysis server returned invalid JSON."
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
// DISPLAY ANALYSIS
// ============================================================

function displayAnalysis(text) {

    if (!analysisElement) {
        return;
    }


    analysisElement.innerHTML =
        escapeHTML(text)
            .replace(
                /\n\n+/g,
                "<br><br>"
            )
            .replace(
                /\n/g,
                "<br>"
            );
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
// NOTIFICATION PERMISSION
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
            "Notifications are not supported on this browser."
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
// INITIALIZE
// ============================================================

setupLiveRecognition();

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
// DEBUG
// ============================================================

console.log(
    "======================================"
);

console.log(
    "Speech Tracker loaded"
);

console.log(
    "Live recognition supported:",
    liveRecognitionSupported
);

console.log(
    "Microphone:",
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
    "======================================"
);