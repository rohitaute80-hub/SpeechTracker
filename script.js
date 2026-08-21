// ============================================================
// SPEECH TRACKER
// ============================================================
// Live Speech Recognition
// + FAST Live Filler Detection
// + UM / UMM / UH / UHH detection
// + Prominent Filler Alerts
// + Notifications
// + Vibration
// + OpenAI Final Transcription
// + Detailed, SPECIFIC AI Speech Analysis
// ============================================================


// ============================================================
// ELEMENTS
// ============================================================

const statusText = document.getElementById("status");
const statusDot = document.getElementById("statusDot");
const heardText = document.getElementById("heard");

const listenButton =
    document.getElementById("listenButton");

const stopButton =
    document.getElementById("stopButton");

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

const analyzeButton =
    document.getElementById("analyzeButton");

const analysisLoading =
    document.getElementById("analysisLoading");

const analysisElement =
    document.getElementById("analysis");

const transcriptSection =
    document.getElementById("transcriptSection");

const finalTranscriptElement =
    document.getElementById("finalTranscript");

const scrollPrompt =
    document.getElementById("scrollPrompt");

const enableNotificationsButton =
    document.getElementById("enableNotifications");

const notificationStatus =
    document.getElementById("notificationStatus");

const recordingTimer =
    document.getElementById("recordingTimer");


// ============================================================
// DEFAULT TRACKED WORDS
// ============================================================

const DEFAULT_WORDS = [
    "um",
    "uh",
    "umm",
    "uhh",
    "ummm",
    "uhhh",
    "like",
    "you know",
    "basically",
    "literally",
    "actually"
];


// ============================================================
// LOAD TRACKED WORDS
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

        if (
            Array.isArray(parsed) &&
            parsed.length > 0
        ) {
            trackedWords =
                parsed
                    .map(word =>
                        String(word)
                            .trim()
                            .toLowerCase()
                    )
                    .filter(Boolean);
        }
    }
} catch (error) {
    console.log(
        "Could not load saved words:",
        error
    );
}

if (trackedWords.length === 0) {
    trackedWords = [...DEFAULT_WORDS];
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
        console.log(
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
        String(text ?? "");

    return div.innerHTML;
}


// ============================================================
// ESCAPE REGEX
// ============================================================

function escapeRegex(text) {
    return String(text).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
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

    heardText.innerHTML = `
        <span class="placeholder">
            ${escapeHTML(message)}
        </span>
    `;
}


// ============================================================
// WORD LIST
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


// ============================================================
// RESET WORDS
// ============================================================

if (resetWordsButton) {

    resetWordsButton.addEventListener(
        "click",
        () => {

            trackedWords =
                [...DEFAULT_WORDS];

            saveWords();
            renderWords();
        }
    );
}


// ============================================================
// WORD PATTERN
// ============================================================

function getWordPattern(word) {

    const normalized =
        word
            .trim()
            .toLowerCase();

    // --------------------------------------------------------
    // UM FAMILY
    // Matches:
    // um
    // umm
    // ummm
    // ummmm
    // --------------------------------------------------------

    if (
        normalized === "um" ||
        /^um+$/.test(normalized)
    ) {
        return "\\bum+\\b";
    }

    // --------------------------------------------------------
    // UH FAMILY
    // Matches:
    // uh
    // uhh
    // uhhh
    // uhhhh
    // --------------------------------------------------------

    if (
        normalized === "uh" ||
        /^uh+$/.test(normalized)
    ) {
        return "\\buh+\\b";
    }

    return (
        "\\b" +
        escapeRegex(normalized) +
        "\\b"
    );
}


// ============================================================
// FIND TRACKED WORDS
// ============================================================

function findTrackedWords(text) {

    const matches = [];

    if (
        !text ||
        !text.trim()
    ) {
        return matches;
    }

    trackedWords.forEach(word => {

        if (
            !word ||
            !word.trim()
        ) {
            return;
        }

        const regex =
            new RegExp(
                getWordPattern(word),
                "gi"
            );

        let match;

        while (
            (match = regex.exec(text)) !== null
        ) {

            matches.push({
                word: match[0],
                trackedWord: word,
                index: match.index,
                end:
                    match.index +
                    match[0].length
            });
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

    if (
        !text ||
        !text.trim()
    ) {
        return 0;
    }

    let count = 0;

    trackedWords.forEach(word => {

        const regex =
            new RegExp(
                getWordPattern(word),
                "gi"
            );

        const matches =
            text.match(regex);

        if (matches) {
            count += matches.length;
        }
    });

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

        if (
            !word ||
            !word.trim()
        ) {
            return;
        }

        const normalized =
            word
                .trim()
                .toLowerCase();

        let pattern;

        if (
            normalized === "um" ||
            /^um+$/.test(normalized)
        ) {

            pattern =
                "(^|\\s)(um+)(?=\\s|[.,!?;:]|$)";

        } else if (
            normalized === "uh" ||
            /^uh+$/.test(normalized)
        ) {

            pattern =
                "(^|\\s)(uh+)(?=\\s|[.,!?;:]|$)";

        } else {

            pattern =
                "(^|\\s)(" +
                escapeRegex(
                    escapeHTML(word)
                ) +
                ")(?=\\s|[.,!?;:]|$)";
        }

        const regex =
            new RegExp(
                pattern,
                "gi"
            );

        result =
            result.replace(
                regex,
                '$1<span class="highlight">$2</span>'
            );
    });

    return result;
}


// ============================================================
// NOTIFICATION STATUS
// ============================================================

function updateNotificationStatus() {

    if (!notificationStatus) {
        return;
    }

    if (
        !("Notification" in window)
    ) {

        notificationStatus.textContent =
            "Notifications are not supported here.";

        return;
    }

    if (
        Notification.permission ===
        "granted"
    ) {

        notificationStatus.textContent =
            "✅ Notifications are enabled.";

    } else if (
        Notification.permission ===
        "denied"
    ) {

        notificationStatus.textContent =
            "⚠️ Notifications are blocked. Check browser/iPhone settings.";

    } else {

        notificationStatus.textContent =
            "Notifications are not enabled.";
    }
}


// ============================================================
// REQUEST NOTIFICATION PERMISSION
// ============================================================

async function requestNotificationPermission() {

    if (
        !("Notification" in window)
    ) {

        if (notificationStatus) {
            notificationStatus.textContent =
                "Notifications are not supported on this device.";
        }

        return;
    }

    try {

        const permission =
            await Notification.requestPermission();

        updateNotificationStatus();

        if (
            permission === "granted"
        ) {

            sendNotification(
                "Speech Tracker",
                "Notifications are enabled."
            );
        }

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );
    }
}


// ============================================================
// SEND NOTIFICATION
// ============================================================

function sendNotification(
    title,
    body
) {

    if (
        !("Notification" in window)
    ) {
        return false;
    }

    if (
        Notification.permission !==
        "granted"
    ) {
        return false;
    }

    try {

        const notification =
            new Notification(
                title,
                {
                    body,
                    icon:
                        "/icon-192.png",
                    badge:
                        "/icon-192.png",
                    tag:
                        "speech-tracker-" +
                        Date.now(),
                    renotify:
                        true,
                    requireInteraction:
                        false
                }
            );

        setTimeout(() => {
            try {
                notification.close();
            } catch {}
        }, 1800);

        return true;

    } catch (error) {

        console.log(
            "Notification failed:",
            error
        );

        return false;
    }
}


// ============================================================
// VIBRATION
// ============================================================

function vibrateStrongly() {

    if (
        typeof navigator.vibrate !==
        "function"
    ) {
        return false;
    }

    try {

        // Immediate vibration.
        navigator.vibrate(
            [
                180,
                60,
                180
            ]
        );

        return true;

    } catch (error) {

        console.log(
            "Vibration failed:",
            error
        );

        return false;
    }
}


// ============================================================
// PROMINENT FILLER ALERT
// ============================================================

let fillerAlertElement = null;
let fillerAlertTimeout = null;


function createFillerAlert() {

    if (fillerAlertElement) {
        return fillerAlertElement;
    }

    fillerAlertElement =
        document.createElement("div");

    fillerAlertElement.id =
        "speechTrackerFillerAlert";

    fillerAlertElement.innerHTML = `
        <div
            id="speechTrackerFillerAlertCard"
            role="alert"
            aria-live="assertive"
        >

            <div id="speechTrackerFillerEmoji">
                🚨
            </div>

            <div id="speechTrackerFillerTitle">
                FILLER WORD
            </div>

            <div id="speechTrackerFillerWord">
            </div>

            <div id="speechTrackerFillerAdvice">
                Pause instead.
            </div>

        </div>
    `;

    Object.assign(
        fillerAlertElement.style,
        {
            position: "fixed",
            inset: "0",
            zIndex: "999999",
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background:
                "rgba(0,0,0,0.55)",
            backdropFilter:
                "blur(5px)",
            WebkitBackdropFilter:
                "blur(5px)"
        }
    );

    const card =
        fillerAlertElement.querySelector(
            "#speechTrackerFillerAlertCard"
        );

    Object.assign(
        card.style,
        {
            width:
                "min(90vw, 420px)",
            padding:
                "30px 24px",
            borderRadius:
                "28px",
            background:
                "#ffffff",
            color:
                "#111827",
            textAlign:
                "center",
            boxShadow:
                "0 25px 70px rgba(0,0,0,.35)",
            transform:
                "scale(.85)",
            transition:
                "transform .08s ease"
        }
    );

    const emoji =
        fillerAlertElement.querySelector(
            "#speechTrackerFillerEmoji"
        );

    Object.assign(
        emoji.style,
        {
            fontSize:
                "64px",
            marginBottom:
                "8px"
        }
    );

    const title =
        fillerAlertElement.querySelector(
            "#speechTrackerFillerTitle"
        );

    Object.assign(
        title.style,
        {
            fontSize:
                "25px",
            fontWeight:
                "900",
            letterSpacing:
                "1px"
        }
    );

    const word =
        fillerAlertElement.querySelector(
            "#speechTrackerFillerWord"
        );

    Object.assign(
        word.style,
        {
            fontSize:
                "40px",
            fontWeight:
                "900",
            margin:
                "10px 0",
            color:
                "#dc2626"
        }
    );

    const advice =
        fillerAlertElement.querySelector(
            "#speechTrackerFillerAdvice"
        );

    Object.assign(
        advice.style,
        {
            fontSize:
                "17px",
            color:
                "#6b7280",
            fontWeight:
                "600"
        }
    );

    document.body.appendChild(
        fillerAlertElement
    );

    return fillerAlertElement;
}


// ============================================================
// SHOW FILLER ALERT
// ============================================================

function showFillerAlert(word) {

    const overlay =
        createFillerAlert();

    const wordElement =
        overlay.querySelector(
            "#speechTrackerFillerWord"
        );

    wordElement.textContent =
        `"${word}"`;

    overlay.style.display =
        "flex";

    const card =
        overlay.querySelector(
            "#speechTrackerFillerAlertCard"
        );

    // Make it appear immediately.
    card.style.transform =
        "scale(1)";

    clearTimeout(
        fillerAlertTimeout
    );

    fillerAlertTimeout =
        setTimeout(
            () => {

                card.style.transform =
                    "scale(.85)";

                setTimeout(
                    () => {
                        overlay.style.display =
                            "none";
                    },
                    80
                );

            },
            900
        );
}


// ============================================================
// LIVE ALERT TRACKING
// ============================================================
//
// IMPORTANT:
//
// We DO NOT use a long cooldown here.
//
// SpeechRecognition interim results frequently repeat
// the same text. We track the exact occurrence instead.
//
// This means:
// "uh"
// "uh I"
// "uh I think"
// won't trigger three times.
//
// But:
//
// "uh I think ... um"
//
// CAN trigger both fillers.
// ============================================================

let lastAlertedOccurrence = "";
let lastAlertedOccurrenceTime = 0;


// ============================================================
// SHOULD ALERT
// ============================================================

function shouldAlertFiller(
    match,
    text
) {

    const occurrence =
        (
            match.trackedWord +
            "|" +
            match.index +
            "|" +
            match.end +
            "|" +
            text.slice(
                Math.max(
                    0,
                    match.index - 12
                ),
                Math.min(
                    text.length,
                    match.end + 12
                )
            )
        ).toLowerCase();

    const now =
        performance.now();

    // Only block EXACT same occurrence.
    if (
        occurrence ===
            lastAlertedOccurrence &&
        now -
            lastAlertedOccurrenceTime <
            1500
    ) {
        return false;
    }

    lastAlertedOccurrence =
        occurrence;

    lastAlertedOccurrenceTime =
        now;

    return true;
}


// ============================================================
// TRIGGER FILLER ALERT
// ============================================================

function triggerFillerAlert(
    word,
    match,
    sourceText
) {

    if (
        !shouldAlertFiller(
            match,
            sourceText
        )
    ) {
        return;
    }

    console.log(
        "🚨 FAST FILLER DETECTED:",
        word
    );

    // Do these immediately.
    showFillerAlert(word);
    vibrateStrongly();

    sendNotification(
        "🚨 Filler Word Detected",
        `You said "${word}". Pause instead.`
    );
}


// ============================================================
// FAST LIVE FILLER DETECTION
// ============================================================
//
// This is intentionally run on BOTH:
//
// 1. FINAL speech results
// 2. INTERIM speech results
//
// Interim results are what give us the fastest possible
// browser-based warning.
// ============================================================

function processLiveFillers(
    text,
    onlyCheckRecent = true
) {

    if (
        !text ||
        !text.trim()
    ) {
        return;
    }

    const matches =
        findTrackedWords(text);

    if (!matches.length) {
        return;
    }

    matches.forEach(match => {

        const distanceFromEnd =
            text.length -
            match.end;

        // For interim results, only inspect
        // the very newest portion of speech.
        //
        // This prevents old "um"s from firing
        // again every time the browser updates
        // the transcript.

        if (
            onlyCheckRecent &&
            distanceFromEnd > 18
        ) {
            return;
        }

        triggerFillerAlert(
            match.word,
            match,
            text
        );
    });
}


// ============================================================
// DISPLAY LIVE TRANSCRIPT
// ============================================================

function displayLiveTranscript() {

    if (!heardText) {
        return;
    }

    const combined =
        (
            liveFinalText +
            " " +
            liveInterimText
        ).trim();

    if (!combined) {

        heardText.innerHTML = `
            <span class="placeholder">
                Listening...
            </span>
        `;

        return;
    }

    heardText.innerHTML =
        highlightTrackedWords(
            combined
        );

    const count =
        countTrackedWords(
            combined
        );

    const words =
        countTotalWords(
            combined
        );

    if (fillerCountElement) {
        fillerCountElement.textContent =
            count;
    }

    if (wordCountElement) {
        wordCountElement.textContent =
            words;
    }
}


// ============================================================
// SPEECH RECOGNITION
// ============================================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition = null;

const speechRecognitionSupported =
    !!SpeechRecognition;

let liveFinalText = "";
let liveInterimText = "";

let recognitionShouldContinue =
    false;

let recognitionStarting =
    false;


// ============================================================
// CREATE RECOGNITION
// ============================================================

if (speechRecognitionSupported) {

    recognition =
        new SpeechRecognition();

    recognition.continuous =
        true;

    // CRITICAL:
    // We want interim results because they are
    // the fastest results the browser gives us.
    recognition.interimResults =
        true;

    recognition.lang =
        "en-US";

    recognition.maxAlternatives =
        1;


    recognition.onstart =
        () => {

            recognitionStarting =
                false;

            console.log(
                "Live recognition started."
            );
        };


    recognition.onresult =
        event => {

            let interimText = "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const result =
                    event.results[i];

                const text =
                    result[0].transcript;


                // ====================================================
                // FINAL RESULT
                // ====================================================

                if (result.isFinal) {

                    liveFinalText +=
                        text + " ";

                    // Check final result immediately.
                    processLiveFillers(
                        text.trim(),
                        false
                    );

                }


                // ====================================================
                // INTERIM RESULT
                // ====================================================

                else {

                    interimText +=
                        text;

                    // THIS IS THE FAST PATH.
                    //
                    // We inspect only the newest interim text,
                    // rather than repeatedly scanning the entire
                    // transcript.
                    processLiveFillers(
                        interimText.trim(),
                        true
                    );
                }
            }


            liveInterimText =
                interimText;


            displayLiveTranscript();
        };


    recognition.onerror =
        event => {

            console.error(
                "Speech recognition error:",
                event.error
            );

            if (
                event.error ===
                "aborted"
            ) {
                return;
            }

            if (
                event.error ===
                "no-speech"
            ) {
                return;
            }

            if (
                event.error ===
                "not-allowed"
            ) {

                setStatus(
                    "Microphone permission denied",
                    "error"
                );

                return;
            }

            console.log(
                "Recognition error:",
                event.error
            );
        };


    recognition.onend =
        () => {

            console.log(
                "Recognition ended."
            );

            recognitionStarting =
                false;


            // Automatically restart.
            if (
                recognitionShouldContinue &&
                isRecording
            ) {

                setTimeout(
                    () => {

                        if (
                            !recognitionShouldContinue ||
                            !isRecording
                        ) {
                            return;
                        }

                        try {

                            recognitionStarting =
                                true;

                            recognition.start();

                        } catch (error) {

                            recognitionStarting =
                                false;

                            console.log(
                                "Recognition restart:",
                                error
                            );
                        }

                    },
                    50
                );
            }
        };
}


// ============================================================
// MEDIA RECORDER
// ============================================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];


// ============================================================
// RECORDING STATE
// ============================================================

let isRecording = false;

let recordingStartTime =
    null;

let timerInterval = null;
let stopTimeout = null;


// ============================================================
// FINAL TRANSCRIPT
// ============================================================

let finalTranscript = "";


// ============================================================
// TIMER
// ============================================================

function startTimer() {

    recordingStartTime =
        Date.now();

    if (recordingTimer) {
        recordingTimer.textContent =
            "00:00";
    }

    clearInterval(
        timerInterval
    );

    timerInterval =
        setInterval(
            () => {

                if (
                    !recordingStartTime
                ) {
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
                    );

                const seconds =
                    elapsed % 60;

                if (recordingTimer) {

                    recordingTimer.textContent =
                        String(minutes)
                            .padStart(2, "0") +
                        ":" +
                        String(seconds)
                            .padStart(2, "0");
                }

            },
            250
        );
}


function stopTimer() {

    clearInterval(
        timerInterval
    );

    timerInterval =
        null;
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

        showMessage(
            "Your browser does not support microphone access."
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

        mediaRecorder = null;


        // ========================================================
        // MEDIA RECORDER
        // ========================================================

        if (
            typeof MediaRecorder !==
            "undefined"
        ) {

            let mimeType = "";


            if (
                MediaRecorder.isTypeSupported(
                    "audio/webm;codecs=opus"
                )
            ) {

                mimeType =
                    "audio/webm;codecs=opus";

            } else if (
                MediaRecorder.isTypeSupported(
                    "audio/webm"
                )
            ) {

                mimeType =
                    "audio/webm";

            } else if (
                MediaRecorder.isTypeSupported(
                    "audio/mp4"
                )
            ) {

                mimeType =
                    "audio/mp4";
            }


            try {

                mediaRecorder =
                    mimeType
                        ? new MediaRecorder(
                            audioStream,
                            {
                                mimeType
                            }
                        )
                        : new MediaRecorder(
                            audioStream
                        );

            } catch (error) {

                console.log(
                    "MediaRecorder unavailable:",
                    error
                );

                mediaRecorder = null;
            }


            if (mediaRecorder) {

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
            }
        }


        // ========================================================
        // RESET EVERYTHING
        // ========================================================

        liveFinalText = "";
        liveInterimText = "";

        finalTranscript = "";

        lastAlertedOccurrence = "";
        lastAlertedOccurrenceTime = 0;


        if (transcriptSection) {
            transcriptSection.classList.add(
                "hidden"
            );
        }


        if (finalTranscriptElement) {
            finalTranscriptElement.innerHTML =
                "";
        }


        if (analysisElement) {
            analysisElement.innerHTML =
                "";
        }


        if (analyzeButton) {
            analyzeButton.disabled =
                true;
        }


        displayLiveTranscript();


        isRecording = true;

        recognitionShouldContinue =
            true;


        if (listenButton) {

            listenButton.disabled =
                true;

            listenButton.textContent =
                "🎤 Listening...";
        }


        if (stopButton) {
            stopButton.disabled =
                false;
        }


        setStatus(
            "Listening...",
            "listening"
        );


        showMessage(
            "🎤 Listening... Speak normally."
        );


        startTimer();


        // ========================================================
        // START RECORDER
        // ========================================================

        if (mediaRecorder) {

            // Small chunks make sure audio is
            // continuously available.
            mediaRecorder.start(100);
        }


        // ========================================================
        // START LIVE RECOGNITION
        // ========================================================

        if (
            recognition &&
            !recognitionStarting
        ) {

            try {

                recognitionStarting =
                    true;

                recognition.start();

            } catch (error) {

                recognitionStarting =
                    false;

                console.log(
                    "Recognition start:",
                    error
                );
            }
        }

    } catch (error) {

        console.error(
            "MICROPHONE ERROR:",
            error
        );

        isRecording = false;

        recognitionShouldContinue =
            false;

        stopTimer();

        setStatus(
            "Microphone error",
            "error"
        );

        showMessage(
            "Microphone error: " +
            error.message
        );
    }
}


// ============================================================
// STOP RECORDING
// ============================================================

function stopRecording() {

    if (!isRecording) {
        return;
    }


    console.log(
        "Stopping recording..."
    );


    isRecording = false;

    recognitionShouldContinue =
        false;


    stopTimer();


    clearTimeout(
        stopTimeout
    );


    // ========================================================
    // STOP SPEECH RECOGNITION
    // ========================================================

    if (recognition) {

        try {

            recognition.stop();

        } catch (error) {

            console.log(
                "Recognition stop:",
                error
            );
        }
    }


    recognitionStarting =
        false;


    // ========================================================
    // STOP RECORDER
    // ========================================================

    if (
        mediaRecorder &&
        mediaRecorder.state !==
        "inactive"
    ) {

        try {

            mediaRecorder.stop();

        } catch (error) {

            console.log(
                "MediaRecorder stop:",
                error
            );
        }
    }


    // ========================================================
    // STOP MICROPHONE
    // ========================================================

    if (audioStream) {

        audioStream
            .getTracks()
            .forEach(
                track => {
                    track.stop();
                }
            );
    }


    if (listenButton) {

        listenButton.disabled =
            false;

        listenButton.textContent =
            "🎤 Start Speaking";
    }


    if (stopButton) {
        stopButton.disabled =
            true;
    }


    setStatus(
        "Creating transcript...",
        "listening"
    );


    showMessage(
        "🤖 Creating your final transcription..."
    );


    // Give MediaRecorder time to push
    // the last audio chunk.

    stopTimeout =
        setTimeout(
            () => {
                sendRecording();
            },
            250
        );
}


// ============================================================
// BUTTON EVENTS
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
// SEND RECORDING TO OPENAI
// ============================================================

async function sendRecording() {

    try {

        if (
            !audioChunks.length
        ) {

            if (
                liveFinalText.trim()
            ) {

                finishWithTranscript(
                    liveFinalText.trim()
                );

                return;
            }

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
            "Audio size:",
            audioBlob.size
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


        const data =
            await response.json();


        console.log(
            "Transcription response:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Transcription failed."
            );
        }


        const transcript =
            data.transcript?.trim();


        if (!transcript) {

            throw new Error(
                "OpenAI returned an empty transcript."
            );
        }


        finishWithTranscript(
            transcript
        );

    } catch (error) {

        console.error(
            "TRANSCRIPTION ERROR:",
            error
        );


        // Browser fallback.

        if (
            liveFinalText.trim()
        ) {

            finishWithTranscript(
                liveFinalText.trim()
            );

            setStatus(
                "Using live transcript",
                "ready"
            );

        } else {

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
}


// ============================================================
// FINAL TRANSCRIPT
// ============================================================

function finishWithTranscript(
    transcript
) {

    finalTranscript =
        transcript.trim();


    const fillerCount =
        countTrackedWords(
            finalTranscript
        );


    const totalWords =
        countTotalWords(
            finalTranscript
        );


    if (fillerCountElement) {

        fillerCountElement.textContent =
            fillerCount;
    }


    if (wordCountElement) {

        wordCountElement.textContent =
            totalWords;
    }


    if (finalTranscriptElement) {

        finalTranscriptElement.innerHTML =
            highlightTrackedWords(
                finalTranscript
            );
    }


    if (transcriptSection) {

        transcriptSection.classList.remove(
            "hidden"
        );
    }


    if (analyzeButton) {

        analyzeButton.disabled =
            false;
    }


    if (heardText) {

        heardText.innerHTML =
            highlightTrackedWords(
                finalTranscript
            );
    }


    setStatus(
        "Transcription complete",
        "ready"
    );


    if (scrollPrompt) {

        scrollPrompt.textContent =
            "↓ Scroll down for your personalized AI analysis";
    }


    if (finalTranscriptElement) {

        finalTranscriptElement.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }


    console.log(
        "Final transcript:",
        finalTranscript
    );
}


// ============================================================
// ANALYSIS RESPONSE PARSER
// ============================================================

function parseAnalysisResponse(data) {

    if (
        data &&
        typeof data.analysis ===
            "object" &&
        data.analysis !== null
    ) {
        return data.analysis;
    }


    if (
        data &&
        typeof data.analysis ===
            "string"
    ) {

        let raw =
            data.analysis.trim();


        raw =
            raw
                .replace(
                    /^```json\s*/i,
                    ""
                )
                .replace(
                    /^```\s*/i,
                    ""
                )
                .replace(
                    /\s*```$/i,
                    ""
                )
                .trim();


        try {

            return JSON.parse(
                raw
            );

        } catch (error) {

            return {
                overall:
                    raw,

                isPlainText:
                    true
            };
        }
    }


    if (
        data &&
        typeof data === "object"
    ) {
        return data;
    }


    throw new Error(
        "The analysis response could not be understood."
    );
}


// ============================================================
// ANALYZE SPEECH
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

        analyzeButton.textContent =
            "🤖 Analyzing...";
    }


    if (analysisLoading) {

        analysisLoading.classList.remove(
            "hidden"
        );
    }


    if (analysisElement) {

        analysisElement.innerHTML = `
            <div class="analysis-block">

                <h3>
                    🧠 Analyzing your speech...
                </h3>

                <p>
                    Looking at your actual wording,
                    filler usage, clarity,
                    structure, and specific ideas.
                </p>

            </div>
        `;
    }


    try {

        // ========================================================
        // IMPORTANT:
        //
        // Send the COMPLETE transcript and explicitly tell the
        // backend that the feedback must be evidence-based.
        //
        // Your /api/analyze route should use these instructions.
        // ========================================================

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
                                trackedWords,

                            fillerCount:
                                countTrackedWords(
                                    finalTranscript
                                ),

                            totalWords:
                                countTotalWords(
                                    finalTranscript
                                ),

                            analysisInstructions: `
Give highly specific coaching based ONLY on the actual transcript.

DO NOT give generic advice.

Every major criticism must point to something that actually happened
in the transcript.

Look for:
- exact filler words the speaker used
- repeated phrases
- vague wording
- unnecessary words
- sentence fragments
- unclear explanations
- weak transitions
- repetition of ideas
- unnecessary introductions
- places where the speaker rambled
- places where the speaker was concise
- strong examples
- missing examples
- weak reasoning
- unclear references
- changes in thought
- awkward phrasing
- overuse of certain words
- whether the conclusion was effective

Be especially specific about the SUBJECT MATTER the person discussed.

Do not say:
"Try to be more confident."
"Practice more."
"Speak clearly."
"Use fewer filler words."
unless you explain EXACTLY why that applies to this transcript.

Instead, identify the actual problem and explain how to fix THAT problem.

Include short quotes from the transcript when useful.

Give different feedback each time based on what is actually present.

If something is already good, do not criticize it just to create feedback.

Prioritize the 2-4 most important improvements rather than filling space with generic advice.
`
                        })
                }
            );


        const responseText =
            await response.text();


        console.log(
            "Raw analysis response:",
            responseText
        );


        let data;


        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (parseError) {

            throw new Error(
                "The analysis server returned invalid JSON."
            );
        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                data.details ||
                "AI analysis failed."
            );
        }


        const analysis =
            parseAnalysisResponse(
                data
            );


        if (!analysis) {

            throw new Error(
                "The AI returned an empty analysis."
            );
        }


        displayAnalysis(
            analysis
        );

    } catch (error) {

        console.error(
            "ANALYSIS ERROR:",
            error
        );


        if (analysisElement) {

            analysisElement.innerHTML = `

                <div class="analysis-block">

                    <h3>
                        ⚠️ Analysis failed
                    </h3>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                    <p>
                        Your transcript is still saved above.
                        Try analyzing again.
                    </p>

                </div>
            `;
        }

    } finally {

        if (analysisLoading) {

            analysisLoading.classList.add(
                "hidden"
            );
        }


        if (analyzeButton) {

            analyzeButton.disabled =
                false;

            analyzeButton.textContent =
                "✨ Analyze My Speech";
        }
    }
}


// ============================================================
// DISPLAY ANALYSIS
// ============================================================

function displayAnalysis(
    analysis
) {

    if (!analysisElement) {
        return;
    }


    // ========================================================
    // PLAIN TEXT FALLBACK
    // ========================================================

    if (
        analysis.isPlainText
    ) {

        analysisElement.innerHTML = `

            <div class="analysis-block">

                <h3>
                    🎯 AI Coach Feedback
                </h3>

                <p>
                    ${escapeHTML(
                        analysis.overall
                    )}
                </p>

            </div>
        `;

        return;
    }


    // ========================================================
    // GET FIELDS
    // ========================================================

    const overall =
        analysis.overall ||
        analysis.summary ||
        "No overall feedback was provided.";


    const topic =
        analysis.topic ||
        analysis.subject ||
        "";


    const score =
        analysis.score ??
        analysis.overallScore ??
        "";


    const fillerWords =
        analysis.fillerWords ||
        analysis.fillerFeedback ||
        "No filler-word feedback was provided.";


    const clarity =
        analysis.clarity ||
        analysis.clarityFeedback ||
        "No clarity feedback was provided.";


    const organization =
        analysis.organization ||
        analysis.structure ||
        "";


    const strength =
        analysis.strength ||
        analysis.strengths ||
        "No specific strength was provided.";


    const improvement =
        analysis.improvement ||
        analysis.improvements ||
        "No improvement suggestion was provided.";


    const tip =
        analysis.tip ||
        analysis.coachingTip ||
        "Focus on the most important improvement above.";


    const specificFeedback =
        analysis.specificFeedback ||
        analysis.specificFeedbackOnContent ||
        "";


    const examples =
        analysis.examples ||
        analysis.example ||
        "";


    const practice =
        analysis.practice ||
        analysis.practicePlan ||
        "";


    const nextSteps =
        analysis.nextSteps ||
        analysis.actionItems ||
        "";


    let html = "";


    // ========================================================
    // SNAPSHOT
    // ========================================================

    if (
        topic ||
        score
    ) {

        html += `

            <div class="analysis-block">

                <h3>
                    🎯 Speech Snapshot
                </h3>
        `;


        if (topic) {

            html += `

                <p>

                    <strong>
                        Topic:
                    </strong>

                    ${escapeHTML(topic)}

                </p>
            `;
        }


        if (score !== "") {

            html += `

                <p>

                    <strong>
                        Overall score:
                    </strong>

                    ${escapeHTML(score)}
                    / 100

                </p>
            `;
        }


        html += `
            </div>
        `;
    }


    // ========================================================
    // OVERALL
    // ========================================================

    html += `

        <div class="analysis-block">

            <h3>
                🧠 Overall
            </h3>

            <p>
                ${escapeHTML(overall)}
            </p>

        </div>
    `;


    // ========================================================
    // FILLERS
    // ========================================================

    html += `

        <div class="analysis-block">

            <h3>
                🗣️ Filler Words
            </h3>

            <p>
                ${escapeHTML(fillerWords)}
            </p>

        </div>
    `;


    // ========================================================
    // CLARITY
    // ========================================================

    html += `

        <div class="analysis-block">

            <h3>
                💬 Clarity
            </h3>

            <p>
                ${escapeHTML(clarity)}
            </p>

        </div>
    `;


    // ========================================================
    // ORGANIZATION
    // ========================================================

    if (organization) {

        html += `

            <div class="analysis-block">

                <h3>
                    🧩 Organization
                </h3>

                <p>
                    ${escapeHTML(
                        organization
                    )}
                </p>

            </div>
        `;
    }


    // ========================================================
    // SPECIFIC FEEDBACK
    // ========================================================

    if (specificFeedback) {

        html += `

            <div class="analysis-block">

                <h3>
                    🔎 Specific To Your Speech
                </h3>

                <p>
                    ${escapeHTML(
                        specificFeedback
                    )}
                </p>

            </div>
        `;
    }


    // ========================================================
    // EXAMPLES
    // ========================================================

    if (examples) {

        html += `

            <div class="analysis-block">

                <h3>
                    ✍️ Specific Examples
                </h3>

                <p>
                    ${escapeHTML(
                        examples
                    )}
                </p>

            </div>
        `;
    }


    // ========================================================
    // STRENGTH
    // ========================================================

    html += `

        <div class="analysis-block">

            <h3>
                ⭐ What You Did Well
            </h3>

            <p>
                ${escapeHTML(strength)}
            </p>

        </div>
    `;


    // ========================================================
    // IMPROVEMENT
    // ========================================================

    html += `

        <div class="analysis-block">

            <h3>
                🚀 What To Improve
            </h3>

            <p>
                ${escapeHTML(improvement)}
            </p>

        </div>
    `;


    // ========================================================
    // PRACTICE
    // ========================================================

    if (practice) {

        html += `

            <div class="analysis-block">

                <h3>
                    🏋️ Practice Drill
                </h3>

                <p>
                    ${escapeHTML(
                        practice
                    )}
                </p>

            </div>
        `;
    }


    // ========================================================
    // NEXT STEPS
    // ========================================================

    if (nextSteps) {

        html += `

            <div class="analysis-block">

                <h3>
                    ✅ Your Next Steps
                </h3>

                <p>
                    ${escapeHTML(
                        nextSteps
                    )}
                </p>

            </div>
        `;
    }


    // ========================================================
    // TIP
    // ========================================================

    html += `

        <div class="analysis-block">

            <h3>
                💡 Coach's Tip
            </h3>

            <p>
                ${escapeHTML(tip)}
            </p>

        </div>
    `;


    analysisElement.innerHTML =
        html;


    setTimeout(
        () => {

            analysisElement.scrollIntoView({
                behavior:
                    "smooth",

                block:
                    "start"
            });

        },
        250
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
// NOTIFICATION BUTTON
// ============================================================

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

renderWords();

updateNotificationStatus();

setStatus(
    "Ready",
    "ready"
);

showMessage(
    "Tap Start Speaking and begin talking."
);


// ============================================================
// DEBUG
// ============================================================

console.log(
    "Speech Tracker loaded."
);

console.log(
    "HTTPS:",
    location.protocol
);

console.log(
    "Speech Recognition:",
    speechRecognitionSupported
);

console.log(
    "Microphone API:",
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
    "Notification" in window
);

console.log(
    "FAST FILLER DETECTION: ENABLED"
);

console.log(
    "UM / UMM / UMMM detection: ENABLED"
);

console.log(
    "UH / UHH / UHHH detection: ENABLED"
);