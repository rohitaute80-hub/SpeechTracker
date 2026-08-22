// ============================================================
// SPEECH TRACKER
// Complete replacement script.js
//
// Includes:
// - Live browser speech recognition
// - OpenAI final transcription
// - Filler detection
// - UM / UMM / UH / UHH detection
// - One notification per newly detected filler
// - One vibration per newly detected filler
// - Notification permission handling
// - Custom filler words
// - Filler highlighting
// - AI speech analysis
// - Light / dark mode
// - Persistent theme preference
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
// DEFAULT FILLER WORDS
// ============================================================

const DEFAULT_WORDS = [
    "um",
    "umm",
    "uh",
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
        localStorage.getItem("speechTrackerWords");

    if (saved) {
        const parsed = JSON.parse(saved);

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
    trackedWords = [...DEFAULT_WORDS];
}


// ============================================================
// RECORDING STATE
// ============================================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];

let isRecording = false;


// ============================================================
// LIVE RECOGNITION STATE
// ============================================================

let recognition = null;
let liveRecognitionSupported = false;

let liveFinalText = "";
let liveInterimText = "";

let recognitionShouldRun = false;


// ============================================================
// FILLER DETECTION STATE
//
// IMPORTANT:
//
// We do NOT compare the entire transcript every time.
// Instead we keep track of which exact filler occurrences
// have already triggered a notification.
//
// This prevents:
//
// "um"
// "um um"
// "um um um"
//
// from repeatedly buzzing for the same "um."
// ============================================================

let notifiedFillerKeys = new Set();


// ============================================================
// FINAL TRANSCRIPT
// ============================================================

let finalTranscript = "";

let fillerCount = 0;
let totalWords = 0;


// ============================================================
// THEME SWITCHER
// ============================================================

function createThemeToggle() {

    // Prevent duplicate buttons
    if (document.getElementById("themeToggle")) {
        return;
    }

    const button =
        document.createElement("button");

    button.id = "themeToggle";
    button.type = "button";

    button.setAttribute(
        "aria-label",
        "Switch theme"
    );

    button.setAttribute(
        "title",
        "Switch theme"
    );

    button.innerHTML = "🌙";

    document.body.appendChild(button);


    // Restore saved theme
    const savedTheme =
        localStorage.getItem(
            "speechTrackerTheme"
        );

    if (savedTheme === "dark") {
        document.documentElement.classList.add(
            "dark"
        );
    } else {
        document.documentElement.classList.remove(
            "dark"
        );
    }


    updateThemeButton();


    button.addEventListener(
        "click",
        () => {

            const isDark =
                document.documentElement.classList.toggle(
                    "dark"
                );

            localStorage.setItem(
                "speechTrackerTheme",
                isDark
                    ? "dark"
                    : "light"
            );

            updateThemeButton();
        }
    );


    function updateThemeButton() {

        const isDark =
            document.documentElement.classList.contains(
                "dark"
            );

        button.innerHTML =
            isDark
                ? "☀️"
                : "🌙";

        button.setAttribute(
            "aria-label",
            isDark
                ? "Switch to light mode"
                : "Switch to dark mode"
        );

        button.setAttribute(
            "title",
            isDark
                ? "Switch to light mode"
                : "Switch to dark mode"
        );
    }
}


// Create theme button after DOM exists
if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        createThemeToggle
    );

} else {

    createThemeToggle();
}


// ============================================================
// STATUS
// ============================================================

function setStatus(
    message,
    state = "ready"
) {

    if (statusText) {
        statusText.textContent =
            message;
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

    // Don't destroy transcript
    // if there is already transcript content.
    console.log(
        "MESSAGE:",
        message
    );
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
        document.createElement(
            "div"
        );

    div.textContent =
        text || "";

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
// RENDER FILLER WORDS
// ============================================================

function renderWords() {

    if (!wordList) {
        return;
    }

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


            tag.appendChild(
                text
            );

            tag.appendChild(
                remove
            );

            wordList.appendChild(
                tag
            );
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

    if (
        !trackedWords.includes(
            word
        )
    ) {

        trackedWords.push(
            word
        );

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

            if (
                event.key ===
                "Enter"
            ) {

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

            trackedWords =
                [...DEFAULT_WORDS];

            saveWords();

            renderWords();

            // Reset notification history
            notifiedFillerKeys.clear();
        }
    );
}


// ============================================================
// FIND TRACKED WORDS
// ============================================================

function findTrackedWords(text) {

    const matches = [];

    if (!text) {
        return matches;
    }


    trackedWords.forEach(
        word => {

            if (!word.trim()) {
                return;
            }

            const escaped =
                escapeRegex(
                    word.trim()
                );

            const regex =
                new RegExp(
                    `(?:^|\\s)(${escaped})(?=\\s|[.,!?;:]|$)`,
                    "gi"
                );


            let match;

            while (
                (match =
                    regex.exec(text)) !== null
            ) {

                matches.push({

                    word:
                        match[1],

                    normalized:
                        word.toLowerCase(),

                    index:
                        match.index +
                        (
                            match[0].length -
                            match[1].length
                        )
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

    findTrackedWords(
        text
    ).forEach(
        () => {
            count++;
        }
    );

    return count;
}


// ============================================================
// COUNT TOTAL WORDS
// ============================================================

function countTotalWords(text) {

    if (
        !text ||
        !text.trim()
    ) {
        return 0;
    }

    return text
        .trim()
        .split(/\s+/)
        .length;
}


// ============================================================
// HIGHLIGHT FILLER WORDS
// ============================================================

function highlightTrackedWords(
    text
) {

    let result =
        escapeHTML(
            text
        );


    const sortedWords =
        [...trackedWords].sort(
            (a, b) =>
                b.length -
                a.length
        );


    sortedWords.forEach(
        word => {

            if (!word.trim()) {
                return;
            }


            const escaped =
                escapeRegex(
                    escapeHTML(
                        word
                    )
                );


            const regex =
                new RegExp(
                    `(^|\\s)(${escaped})(?=\\s|[.,!?;:]|$)`,
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
// DISPLAY FINAL TRANSCRIPT
// ============================================================

function displayTranscript(
    text
) {

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
// DISPLAY LIVE TRANSCRIPT
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


    return findTrackedWords(
        combined
    );
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

        // One strong vibration.
        // We intentionally do NOT use
        // multiple vibration pulses.

        navigator.vibrate(
            300
        );

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

async function notifyFiller(
    word
) {

    console.log(
        "FILLER NOTIFICATION:",
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


        if (
            permission ===
            "default"
        ) {

            permission =
                await Notification.requestPermission();
        }


        if (
            permission !==
            "granted"
        ) {

            console.log(
                "Notification permission:",
                permission
            );

            return;
        }


        // Stronger, clearer notification
        new Notification(
            "⚠️ Filler Word Detected",
            {

                body:
                    `You said "${word}". Pause instead of using a filler word.`,

                tag:
                    "speech-tracker-filler-" +
                    word +
                    "-" +
                    Date.now(),

                requireInteraction:
                    false
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

async function handleNewFiller(
    word
) {

    console.log(
        "NEW FILLER DETECTED:",
        word
    );


    // Exactly ONE vibration
    vibrate();


    // Exactly ONE notification
    await notifyFiller(
        word
    );
}


// ============================================================
// PROCESS LIVE FILLERS
//
// This is the important part for:
// UM
// UMM
// UH
// UHH
//
// We track the exact occurrence positions.
// That prevents duplicate notifications when
// interim speech recognition repeatedly updates
// the same sentence.
// ============================================================

async function processLiveFillers(
    text
) {

    if (!text) {
        return;
    }


    const matches =
        findTrackedWords(
            text
        );


    if (
        matches.length ===
        0
    ) {

        return;
    }


    const currentKeys =
        new Set();


    matches.forEach(
        match => {

            const key =
                `${match.normalized}:${match.index}`;

            currentKeys.add(
                key
            );


            // This occurrence has
            // already triggered a notification.
            if (
                notifiedFillerKeys.has(
                    key
                )
            ) {

                return;
            }


            // Mark it immediately BEFORE
            // the async notification.
            //
            // This is extremely important.
            // Otherwise two recognition events
            // can trigger two notifications
            // before the first one finishes.

            notifiedFillerKeys.add(
                key
            );


            handleNewFiller(
                match.word
            );
        }
    );


    // Clean out old keys that are no longer
    // present in the current transcript.
    //
    // We DON'T immediately delete everything,
    // because interim recognition can temporarily
    // change the transcript.

    if (
        notifiedFillerKeys.size >
        100
    ) {

        const recentKeys =
            Array.from(
                currentKeys
            );

        notifiedFillerKeys =
            new Set(
                recentKeys
            );
    }
}


// ============================================================
// LIVE SPEECH RECOGNITION SETUP
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
                let i =
                    event.resultIndex;

                i <
                event.results.length;

                i++
            ) {

                const result =
                    event.results[i];


                const text =
                    result[0].transcript;


                if (
                    result.isFinal
                ) {

                    newFinalText +=
                        text +
                        " ";

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


            // Update UI immediately
            displayLiveTranscript();


            // Detect fillers immediately
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

                    // Very short restart delay
                    50
                );
            }
        };
}


// ============================================================
// START LIVE RECOGNITION
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


    // Clear old filler notification history
    notifiedFillerKeys.clear();


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
// STOP LIVE RECOGNITION
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
// RECORDING MIME TYPE
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


    if (
        !checkMicrophoneSupport()
    ) {

        setStatus(
            "Microphone unavailable",
            "error"
        );

        return;
    }


    try {

        audioStream =
            await navigator.mediaDevices.getUserMedia(
                {
                    audio: true
                }
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


        mediaRecorder.addEventListener(
            "dataavailable",
            event => {

                if (
                    event.data &&
                    event.data.size >
                    0
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


        // Small chunks allow the recorder
        // to keep supplying data smoothly.

        mediaRecorder.start(
            250
        );


        isRecording =
            true;


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


        console.log(
            "RECORDING STARTED"
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

            audioStream =
                null;
        }


        setStatus(
            "Microphone error",
            "error"
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
}


// ============================================================
// BUTTONS
// ============================================================

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


// ============================================================
// SEND AUDIO TO OPENAI
// ============================================================

async function sendRecording() {

    try {

        if (
            audioChunks.length ===
            0
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
                        i +
                        chunkSize,
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
                        JSON.stringify(
                            {
                                audio:
                                    base64Audio
                            }
                        )
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


        displayTranscript(
            data.transcript
        );


        finalTranscript =
            data.transcript;


        setStatus(
            "Finished",
            "ready"
        );


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


        // Keep live transcript if API failed.
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
                        JSON.stringify(
                            {
                                transcript:
                                    finalTranscript,

                                trackedWords:
                                    trackedWords
                            }
                        )
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


        if (!data.analysis) {

            throw new Error(
                "OpenAI returned an empty analysis."
            );
        }


        // Support either a string or
        // structured JSON analysis.

        if (
            typeof data.analysis ===
            "object"
        ) {

            const analysis =
                data.analysis;


            const formatted = [

                analysis.overall
                    ? `Overall\n${analysis.overall}`
                    : "",

                analysis.fillerWords
                    ? `Filler Words\n${analysis.fillerWords}`
                    : "",

                analysis.clarity
                    ? `Clarity\n${analysis.clarity}`
                    : "",

                analysis.strength
                    ? `Strength\n${analysis.strength}`
                    : "",

                analysis.improvement
                    ? `Improvement\n${analysis.improvement}`
                    : "",

                analysis.tip
                    ? `Tip\n${analysis.tip}`
                    : ""

            ]
                .filter(Boolean)
                .join("\n\n");


            displayAnalysis(
                formatted
            );

        } else {

            displayAnalysis(
                data.analysis
            );
        }


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

function displayAnalysis(
    text
) {

    if (!analysisElement) {
        return;
    }


    analysisElement.innerHTML =
        escapeHTML(
            text
        )
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
// NOTIFICATION PERMISSION BUTTON
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


if (
    enableNotificationsButton
) {

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


if (analyzeButton) {

    analyzeButton.disabled =
        true;
}


// ============================================================
// DEBUG INFORMATION
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
    "Tracked filler words:",
    trackedWords
);

console.log(
    "======================================"
);