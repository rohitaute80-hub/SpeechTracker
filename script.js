// ============================================================
// SPEECH TRACKER
// Complete script.js
//
// Features:
// - Live browser speech recognition
// - OpenAI final transcription
// - Live filler-word detection
// - Supports um / umm / ummm / uh / uhh / uhhh
// - One notification per filler occurrence
// - One strong vibration per filler occurrence
// - Custom tracked words
// - AI speech analysis
// - Light / dark mode
// - Theme preference saved in localStorage
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
// RECORDING VARIABLES
// ============================================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let isRecording = false;


// ============================================================
// LIVE RECOGNITION VARIABLES
// ============================================================

let recognition = null;
let liveRecognitionSupported = false;

let liveFinalText = "";
let liveInterimText = "";

let recognitionShouldRun = false;


// ============================================================
// LIVE FILLER TRACKING
//
// IMPORTANT:
//
// The browser's interim transcript constantly changes.
//
// Example:
//
// "I um"
// "I umm"
// "I umm so"
// "I umm so I"
//
// If we simply compare the text every time,
// the same filler can trigger multiple times.
//
// We therefore remember the highest number of
// occurrences we've already alerted for.
//
// This gives us:
//
// "um"     -> one alert
// "um um"  -> two alerts
// "um um um" -> three alerts
//
// but NOT repeated alerts for the same interim result.
// ============================================================

let liveNotifiedCounts = {};


// ============================================================
// FINAL TRANSCRIPT
// ============================================================

let finalTranscript = "";

let fillerCount = 0;
let totalWords = 0;


// ============================================================
// THEME
// ============================================================

const THEME_STORAGE_KEY =
    "speechTrackerTheme";


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

    heardText.textContent = message;
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
// NORMALIZE WORD
// ============================================================

function normalizeWord(word) {
    return word
        .trim()
        .toLowerCase();
}


// ============================================================
// SPECIAL FILLER REGEX
//
// This catches:
//
// um
// umm
// ummm
// ummmm
//
// uh
// uhh
// uhhh
// uhhhh
//
// It also catches capitalization differences.
// ============================================================

function getFillerRegex(word) {
    const normalized =
        normalizeWord(word);

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

    return new RegExp(
        "\\b" +
        escapeRegex(normalized) +
        "\\b",
        "gi"
    );
}


// ============================================================
// GET ALL FILLER MATCHES
// ============================================================

function findTrackedWords(text) {
    const matches = [];

    if (!text) {
        return matches;
    }

    trackedWords.forEach(word => {
        if (!word || !word.trim()) {
            return;
        }

        const regex =
            getFillerRegex(word);

        let match;

        while (
            (match = regex.exec(text)) !== null
        ) {
            matches.push({
                word: normalizeWord(word),
                detectedText: match[0],
                index: match.index
            });

            // Safety against unusual regex behavior.
            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
        }
    });

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
    if (!text) {
        return 0;
    }

    const matches =
        findTrackedWords(text);

    return matches.length;
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

    sortedWords.forEach(word => {
        if (!word || !word.trim()) {
            return;
        }

        const normalized =
            normalizeWord(word);

        let regex;

        if (
            normalized === "um" ||
            /^um+$/.test(normalized)
        ) {
            regex =
                /\b(um+)\b/gi;
        } else if (
            normalized === "uh" ||
            /^uh+$/.test(normalized)
        ) {
            regex =
                /\b(uh+)\b/gi;
        } else {
            const escaped =
                escapeRegex(
                    escapeHTML(normalized)
                );

            regex = new RegExp(
                "(^|\\s)(" +
                escaped +
                ")(?=\\s|[.,!?;:]|$)",
                "gi"
            );
        }

        result =
            result.replace(
                regex,
                (match, group1, group2) => {
                    if (group2 === undefined) {
                        return (
                            '<span class="highlight">' +
                            match +
                            "</span>"
                        );
                    }

                    return (
                        group1 +
                        '<span class="highlight">' +
                        group2 +
                        "</span>"
                    );
                }
            );
    });

    return result;
}


// ============================================================
// DISPLAY FINAL TRANSCRIPT
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
        countTrackedWords(combined);

    totalWords =
        countTotalWords(combined);

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
}


// ============================================================
// STRONG VIBRATION
//
// One vibration pattern per filler.
//
// The browser/device ultimately decides how strong
// the vibration can be, but this gives it a much more
// noticeable pattern than a tiny single pulse.
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
            350
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

        const notification =
            new Notification(
                "Speech Tracker",
                {
                    body:
                        `Filler word detected: "${word}"`,
                    tag:
                        "speech-tracker-filler",
                    renotify: true,
                    requireInteraction: false
                }
            );

        setTimeout(() => {
            try {
                notification.close();
            } catch (error) {}
        }, 1200);

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
        "NEW FILLER DETECTED:",
        word
    );

    // One vibration.
    vibrate();

    // One notification.
    await notifyFiller(word);
}


// ============================================================
// COUNT MATCHES BY CANONICAL WORD
// ============================================================

function getMatchCounts(matches) {
    const counts = {};

    matches.forEach(match => {
        const word =
            normalizeWord(match.word);

        counts[word] =
            (counts[word] || 0) + 1;
    });

    return counts;
}


// ============================================================
// PROCESS LIVE FILLERS
//
// This is the important anti-double-notification system.
//
// We compare the current transcript with the maximum
// number of fillers we've already alerted for.
//
// Example:
//
// Current transcript:
// "I um"
//
// um count = 1
// notification = YES
//
// Browser changes interim transcript:
// "I umm"
//
// um count = 1
// notification = NO
//
// Transcript becomes:
// "I umm so um"
//
// um count = 2
// notification = YES, only for the new one.
// ============================================================

async function processLiveFillers(text) {
    if (!text) {
        return;
    }

    const matches =
        findTrackedWords(text);

    if (matches.length === 0) {
        return;
    }

    const currentCounts =
        getMatchCounts(matches);

    for (
        const word of Object.keys(
            currentCounts
        )
    ) {
        const currentCount =
            currentCounts[word] || 0;

        const alreadyNotified =
            liveNotifiedCounts[word] || 0;

        if (
            currentCount >
            alreadyNotified
        ) {
            const difference =
                currentCount -
                alreadyNotified;

            // Update FIRST.
            //
            // This prevents two recognition events
            // from simultaneously triggering the same
            // notification.
            liveNotifiedCounts[word] =
                currentCount;

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


    // --------------------------------------------------------
    // START
    // --------------------------------------------------------

    recognition.onstart = () => {
        console.log(
            "LIVE RECOGNITION STARTED"
        );
    };


    // --------------------------------------------------------
    // RESULTS
    // --------------------------------------------------------

    recognition.onresult =
        event => {
            let newFinalText = "";
            let newInterimText = "";

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

            // Update the UI immediately.
            displayLiveTranscript();

            // Detect fillers immediately.
            processLiveFillers(
                combined
            );
        };


    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // END
    // --------------------------------------------------------

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
                    100
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

    liveFinalText = "";
    liveInterimText = "";

    // IMPORTANT:
    // Reset notification history for the new recording.
    liveNotifiedCounts = {};

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
            await navigator.mediaDevices.getUserMedia({
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
                        mimeType
                    }
                );
        } else {
            mediaRecorder =
                new MediaRecorder(
                    audioStream
                );
        }


        // ----------------------------------------------------
        // AUDIO DATA
        // ----------------------------------------------------

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


        // ----------------------------------------------------
        // RECORDING STOPPED
        // ----------------------------------------------------

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


        // ----------------------------------------------------
        // START RECORDER
        // ----------------------------------------------------

        mediaRecorder.start(250);

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

        audioStream = null;
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


    // Keep live transcript visible.
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
                    method: "POST",

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
            !data.analysis
        ) {
            throw new Error(
                "OpenAI returned an empty analysis."
            );
        }


        // The API can return either:
        //
        // analysis: "text"
        //
        // OR
        //
        // analysis: {
        //    overall: "...",
        //    ...
        // }
        //
        // Support both.

        if (
            typeof data.analysis ===
            "object"
        ) {
            const analysis =
                data.analysis;

            const formatted = [
                analysis.overall
                    ? `Overall: ${analysis.overall}`
                    : "",

                analysis.fillerWords
                    ? `Filler Words: ${analysis.fillerWords}`
                    : "",

                analysis.clarity
                    ? `Clarity: ${analysis.clarity}`
                    : "",

                analysis.strength
                    ? `Strength: ${analysis.strength}`
                    : "",

                analysis.improvement
                    ? `Improvement: ${analysis.improvement}`
                    : "",

                analysis.tip
                    ? `Tip: ${analysis.tip}`
                    : ""
            ]
                .filter(Boolean)
                .join("\n\n");

            displayAnalysis(
                formatted
            );
        } else {
            displayAnalysis(
                String(data.analysis)
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
// THEME SWITCHER
//
// Creates a top-right button automatically.
//
// Sun = currently light mode
// Moon = currently dark mode
// ============================================================

function setupThemeSwitcher() {
    let themeButton =
        document.getElementById(
            "themeToggle"
        );

    // If the HTML doesn't already contain
    // the button, create it.
    if (!themeButton) {
        themeButton =
            document.createElement(
                "button"
            );

        themeButton.id =
            "themeToggle";

        themeButton.type =
            "button";

        themeButton.className =
            "theme-toggle";

        themeButton.setAttribute(
            "aria-label",
            "Toggle dark mode"
        );

        themeButton.setAttribute(
            "title",
            "Toggle dark mode"
        );

        document.body.appendChild(
            themeButton
        );
    }


    function applyTheme(theme) {
        document.documentElement.setAttribute(
            "data-theme",
            theme
        );

        localStorage.setItem(
            THEME_STORAGE_KEY,
            theme
        );

        if (theme === "dark") {
            themeButton.innerHTML =
                "☀️";

            themeButton.setAttribute(
                "aria-label",
                "Switch to light mode"
            );

            themeButton.setAttribute(
                "title",
                "Switch to light mode"
            );
        } else {
            themeButton.innerHTML =
                "🌙";

            themeButton.setAttribute(
                "aria-label",
                "Switch to dark mode"
            );

            themeButton.setAttribute(
                "title",
                "Switch to dark mode"
            );
        }
    }


    // --------------------------------------------------------
    // LOAD SAVED THEME
    // --------------------------------------------------------

    let savedTheme =
        localStorage.getItem(
            THEME_STORAGE_KEY
        );

    if (
        savedTheme !== "dark" &&
        savedTheme !== "light"
    ) {
        savedTheme = "light";
    }

    applyTheme(
        savedTheme
    );


    // --------------------------------------------------------
    // TOGGLE
    // --------------------------------------------------------

    themeButton.addEventListener(
        "click",
        () => {
            const current =
                document.documentElement.getAttribute(
                    "data-theme"
                ) || "light";

            const next =
                current === "dark"
                    ? "light"
                    : "dark";

            applyTheme(next);
        }
    );
}


// ============================================================
// INITIALIZE
// ============================================================

setupLiveRecognition();

renderWords();

setupThemeSwitcher();

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