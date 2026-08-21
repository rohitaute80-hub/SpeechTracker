// ==========================================
// SPEECH TRACKER
// Live Speech Recognition + OpenAI Transcription
// ==========================================

const statusText = document.getElementById("status");
const statusDot = document.getElementById("statusDot");
const heardText = document.getElementById("heard");

const listenButton = document.getElementById("listenButton");
const stopButton = document.getElementById("stopButton");

const customWordInput = document.getElementById("customWordInput");
const addWordButton = document.getElementById("addWordButton");
const wordList = document.getElementById("wordList");
const resetWordsButton = document.getElementById("resetWordsButton");

const fillerCountElement = document.getElementById("fillerCount");
const wordCountElement = document.getElementById("wordCount");

const analyzeButton = document.getElementById("analyzeButton");
const analysisLoading = document.getElementById("analysisLoading");
const analysisElement = document.getElementById("analysis");

// ==========================================
// DEFAULT WORDS
// ==========================================

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

// ==========================================
// TRACKED WORDS
// ==========================================

let trackedWords = [];

try {
    const saved = localStorage.getItem("speechTrackerWords");

    if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
            trackedWords = parsed;
        }
    }
} catch (error) {
    console.log("Could not load saved words.");
}

if (trackedWords.length === 0) {
    trackedWords = [...DEFAULT_WORDS];
}

// ==========================================
// VARIABLES
// ==========================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];

let recognition = null;
let recognitionRunning = false;

let isRecording = false;

let finalTranscript = "";
let liveTranscript = "";

let fillerCount = 0;
let totalWords = 0;

let lastDetectedText = "";

let notificationTimeout = null;

// ==========================================
// STATUS
// ==========================================

function setStatus(message, state = "ready") {

    if (statusText) {
        statusText.textContent = message;
    }

    if (statusDot) {
        statusDot.className = "dot " + state;
    }
}

// ==========================================
// MESSAGE
// ==========================================

function showMessage(message) {

    if (heardText) {
        heardText.textContent = message;
    }
}

// ==========================================
// SAVE WORDS
// ==========================================

function saveWords() {

    try {
        localStorage.setItem(
            "speechTrackerWords",
            JSON.stringify(trackedWords)
        );
    } catch (error) {
        console.log("Could not save words.");
    }
}

// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}

// ==========================================
// ESCAPE REGEX
// ==========================================

function escapeRegex(text) {

    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ==========================================
// WORD REGEX
// ==========================================

function getWordRegex(word) {

    return new RegExp(
        "(^|\\s)(" +
        escapeRegex(word) +
        ")(?=\\s|[.,!?;:]|$)",
        "gi"
    );
}

// ==========================================
// RENDER WORDS
// ==========================================

function renderWords() {

    if (!wordList) {
        return;
    }

    wordList.innerHTML = "";

    trackedWords.forEach((word, index) => {

        const tag = document.createElement("div");

        tag.className = "word-tag";

        const text = document.createElement("span");

        text.textContent = word;

        const remove = document.createElement("button");

        remove.type = "button";

        remove.textContent = "×";

        remove.addEventListener("click", () => {

            trackedWords.splice(index, 1);

            saveWords();

            renderWords();
        });

        tag.appendChild(text);

        tag.appendChild(remove);

        wordList.appendChild(tag);
    });
}

// ==========================================
// ADD WORD
// ==========================================

function addCustomWord() {

    if (!customWordInput) {
        return;
    }

    const word = customWordInput.value
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

// ==========================================
// CUSTOM WORD EVENTS
// ==========================================

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

// ==========================================
// RESET WORDS
// ==========================================

if (resetWordsButton) {

    resetWordsButton.addEventListener(
        "click",
        () => {

            trackedWords = [...DEFAULT_WORDS];

            saveWords();

            renderWords();
        }
    );
}

// ==========================================
// HIGHLIGHT WORDS
// ==========================================

function highlightTrackedWords(text) {

    let result = escapeHTML(text);

    const sortedWords = [...trackedWords].sort(
        (a, b) => b.length - a.length
    );

    sortedWords.forEach(word => {

        if (!word.trim()) {
            return;
        }

        const regex = getWordRegex(
            escapeHTML(word)
        );

        result = result.replace(
            regex,
            '$1<span class="highlight">$2</span>'
        );
    });

    return result;
}

// ==========================================
// COUNT TRACKED WORDS
// ==========================================

function countTrackedWords(text) {

    let count = 0;

    trackedWords.forEach(word => {

        if (!word.trim()) {
            return;
        }

        const regex = getWordRegex(word);

        const matches = text.match(regex);

        if (matches) {
            count += matches.length;
        }
    });

    return count;
}

// ==========================================
// COUNT WORDS
// ==========================================

function countTotalWords(text) {

    if (!text.trim()) {
        return 0;
    }

    return text
        .trim()
        .split(/\s+/)
        .length;
}

// ==========================================
// DISPLAY TRANSCRIPT
// ==========================================

function displayTranscript(text) {

    finalTranscript = text;

    fillerCount = countTrackedWords(text);

    totalWords = countTotalWords(text);

    if (heardText) {

        heardText.innerHTML =
            highlightTrackedWords(text);
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
            !text.trim();
    }
}

// ==========================================
// LIVE DISPLAY
// ==========================================

function displayLiveTranscript(
    finalText,
    interimText
) {

    const combined =
        (finalText + " " + interimText).trim();

    if (!combined) {
        return;
    }

    liveTranscript = combined;

    if (heardText) {

        heardText.innerHTML =
            highlightTrackedWords(combined);
    }

    if (fillerCountElement) {

        fillerCountElement.textContent =
            countTrackedWords(combined);
    }

    if (wordCountElement) {

        wordCountElement.textContent =
            countTotalWords(combined);
    }

    detectNewTrackedWords(combined);
}

// ==========================================
// DETECT NEW WORDS
// ==========================================

function detectNewTrackedWords(text) {

    const normalized = text
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized) {
        return;
    }

    // Only look at the newest section.
    // This prevents the same word from triggering
    // repeatedly every time interim results update.

    const previous = lastDetectedText;

    if (normalized === previous) {
        return;
    }

    let newText = normalized;

    if (
        previous &&
        normalized.startsWith(previous)
    ) {

        newText = normalized
            .slice(previous.length)
            .trim();
    }

    lastDetectedText = normalized;

    if (!newText) {
        return;
    }

    const matches = findTrackedWords(newText);

    if (matches.length > 0) {

        // Trigger once for the newest detected word.
        notifyTrackedWord(matches[0].word);
    }
}

// ==========================================
// FIND TRACKED WORDS
// ==========================================

function findTrackedWords(text) {

    const matches = [];

    trackedWords.forEach(word => {

        if (!word.trim()) {
            return;
        }

        const regex = getWordRegex(word);

        let match;

        while ((match = regex.exec(text)) !== null) {

            matches.push({
                word,
                index: match.index
            });
        }
    });

    matches.sort(
        (a, b) => a.index - b.index
    );

    return matches;
}

// ==========================================
// IN-APP NOTIFICATION
// ==========================================

function notifyTrackedWord(word) {

    console.log(
        "Tracked word detected:",
        word
    );

    // Create notification element if necessary.

    let notification =
        document.getElementById(
            "trackedWordNotification"
        );

    if (!notification) {

        notification =
            document.createElement("div");

        notification.id =
            "trackedWordNotification";

        notification.style.position =
            "fixed";

        notification.style.left =
            "16px";

        notification.style.right =
            "16px";

        notification.style.top =
            "18px";

        notification.style.zIndex =
            "99999";

        notification.style.padding =
            "16px";

        notification.style.borderRadius =
            "16px";

        notification.style.background =
            "#111827";

        notification.style.color =
            "white";

        notification.style.fontWeight =
            "700";

        notification.style.textAlign =
            "center";

        notification.style.boxShadow =
            "0 10px 30px rgba(0,0,0,.25)";

        notification.style.transform =
            "translateY(-120px)";

        notification.style.opacity =
            "0";

        notification.style.transition =
            "transform .2s ease, opacity .2s ease";

        document.body.appendChild(
            notification
        );
    }

    notification.textContent =
        `⚠️ Tracked word: "${word}"`;

    requestAnimationFrame(() => {

        notification.style.transform =
            "translateY(0)";

        notification.style.opacity =
            "1";
    });

    clearTimeout(notificationTimeout);

    notificationTimeout =
        setTimeout(() => {

            notification.style.transform =
                "translateY(-120px)";

            notification.style.opacity =
                "0";

        }, 1300);

    // Try vibration on browsers that support it.

    if (
        typeof navigator.vibrate ===
        "function"
    ) {

        try {
            navigator.vibrate(120);
        } catch (error) {
            console.log(
                "Vibration unavailable."
            );
        }
    }

    // Update app badge if supported.

    if (
        "setAppBadge" in navigator
    ) {

        navigator.setAppBadge(
            fillerCount + 1
        ).catch(() => {});
    }
}

// ==========================================
// SPEECH RECOGNITION SUPPORT
// ==========================================

function createSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        console.log(
            "Browser speech recognition is unavailable."
        );

        return null;
    }

    const recognition =
        new SpeechRecognition();

    recognition.continuous = true;

    recognition.interimResults = true;

    recognition.lang = "en-US";

    recognition.maxAlternatives = 1;

    recognition.onstart = () => {

        recognitionRunning = true;

        console.log(
            "Live speech recognition started."
        );
    };

    recognition.onresult = event => {

        let interimText = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            const transcript =
                event.results[i][0].transcript;

            if (event.results[i].isFinal) {

                finalTranscript +=
                    transcript + " ";

            } else {

                interimText += transcript;
            }
        }

        displayLiveTranscript(
            finalTranscript,
            interimText
        );
    };

    recognition.onerror = event => {

        console.log(
            "Speech recognition error:",
            event.error
        );

        // Do not stop the recording just because
        // the live recognition engine has an issue.

        if (
            event.error === "not-allowed"
        ) {

            console.log(
                "Microphone permission denied for speech recognition."
            );
        }
    };

    recognition.onend = () => {

        recognitionRunning = false;

        // If we are still recording,
        // restart recognition automatically.

        if (isRecording) {

            setTimeout(() => {

                if (!isRecording) {
                    return;
                }

                try {

                    recognition.start();

                } catch (error) {

                    console.log(
                        "Recognition restart skipped."
                    );
                }

            }, 200);
        }
    };

    return recognition;
}

// ==========================================
// START LIVE RECOGNITION
// ==========================================

function startLiveRecognition() {

    if (!recognition) {

        recognition =
            createSpeechRecognition();
    }

    if (!recognition) {

        console.log(
            "Live transcription is not available in this browser."
        );

        return;
    }

    finalTranscript = "";

    liveTranscript = "";

    lastDetectedText = "";

    try {

        recognition.start();

    } catch (error) {

        console.log(
            "Recognition already running."
        );
    }
}

// ==========================================
// STOP LIVE RECOGNITION
// ==========================================

function stopLiveRecognition() {

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

    recognitionRunning = false;
}

// ==========================================
// MICROPHONE CHECK
// ==========================================

function checkMicrophoneSupport() {

    return !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
    );
}

// ==========================================
// START RECORDING
// ==========================================

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

            mimeType = "audio/webm";

        } else if (
            MediaRecorder.isTypeSupported(
                "audio/mp4"
            )
        ) {

            mimeType = "audio/mp4";
        }

        mediaRecorder =
            mimeType
                ? new MediaRecorder(
                    audioStream,
                    { mimeType }
                )
                : new MediaRecorder(
                    audioStream
                );

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
            sendRecording,
            { once: true }
        );

        mediaRecorder.start(1000);

        isRecording = true;

        if (listenButton) {
            listenButton.disabled = true;
        }

        if (stopButton) {
            stopButton.disabled = false;
        }

        setStatus(
            "Listening...",
            "listening"
        );

        showMessage(
            "🎤 Listening... start speaking."
        );

        // Start browser live transcription.

        startLiveRecognition();

    } catch (error) {

        console.error(
            "MICROPHONE ERROR:",
            error
        );

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

// ==========================================
// STOP RECORDING
// ==========================================

function stopRecording() {

    if (
        !mediaRecorder ||
        !isRecording
    ) {
        return;
    }

    isRecording = false;

    stopLiveRecognition();

    setStatus(
        "Transcribing...",
        "listening"
    );

    showMessage(
        "🤖 OpenAI is transcribing your recording..."
    );

    if (listenButton) {
        listenButton.disabled = false;
    }

    if (stopButton) {
        stopButton.disabled = true;
    }

    try {

        mediaRecorder.stop();

    } catch (error) {

        console.error(
            "Could not stop recorder:",
            error
        );
    }

    if (audioStream) {

        audioStream
            .getTracks()
            .forEach(track => {
                track.stop();
            });

        audioStream = null;
    }
}

// ==========================================
// BUTTONS
// ==========================================

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

// ==========================================
// SEND RECORDING TO OPENAI
// ==========================================

async function sendRecording() {

    try {

        if (audioChunks.length === 0) {

            throw new Error(
                "No audio was recorded."
            );
        }

        const mime =
            mediaRecorder?.mimeType ||
            "audio/webm";

        const audioBlob =
            new Blob(
                audioChunks,
                { type: mime }
            );

        const arrayBuffer =
            await audioBlob.arrayBuffer();

        const bytes =
            new Uint8Array(arrayBuffer);

        let binary = "";

        const chunkSize = 8192;

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

            binary += String.fromCharCode(
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

                    body: JSON.stringify({
                        audio:
                            base64Audio
                    })
                }
            );

        const data =
            await response.json();

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

        // Use the accurate OpenAI transcript
        // as the final transcript.

        displayTranscript(
            transcript
        );

        setStatus(
            "Finished",
            "ready"
        );

        showMessage(
            "Transcription complete."
        );

        // Reset live detection state.

        lastDetectedText = transcript
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

        // Analysis can now be used.

        if (analyzeButton) {

            analyzeButton.disabled = false;
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

// ==========================================
// ANALYSIS
// ==========================================

async function analyzeSpeech() {

    if (!finalTranscript.trim()) {

        showMessage(
            "Speak first, then analyze your speech."
        );

        return;
    }

    if (analysisLoading) {
        analysisLoading.hidden = false;
    }

    if (analyzeButton) {
        analyzeButton.disabled = true;
    }

    if (analysisElement) {
        analysisElement.innerHTML = "";
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

                    body: JSON.stringify({
                        transcript:
                            finalTranscript,

                        trackedWords:
                            trackedWords
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Speech analysis failed."
            );
        }

        if (
            !data.analysis ||
            !data.analysis.trim()
        ) {

            throw new Error(
                "OpenAI returned an empty analysis."
            );
        }

        if (analysisElement) {

            analysisElement.innerHTML =
                formatAnalysis(
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
                `<p style="color:#dc2626;">
                    Analysis failed: ${escapeHTML(
                        error.message
                    )}
                </p>`;
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

// ==========================================
// FORMAT ANALYSIS
// ==========================================

function formatAnalysis(text) {

    const escaped =
        escapeHTML(text);

    return escaped
        .replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        )
        .replace(
            /^### (.*)$/gm,
            "<h3>$1</h3>"
        )
        .replace(
            /^## (.*)$/gm,
            "<h3>$1</h3>"
        )
        .replace(
            /^# (.*)$/gm,
            "<h3>$1</h3>"
        )
        .replace(
            /\n\n/g,
            "<br><br>"
        )
        .replace(
            /\n/g,
            "<br>"
        );
}

if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );
}

// ==========================================
// INITIALIZE
// ==========================================

renderWords();

setStatus(
    "Ready",
    "ready"
);

showMessage(
    "Tap Listen and start speaking."
);

console.log(
    "Speech Tracker loaded."
);

console.log(
    "Live Speech Recognition:",
    !!(
        window.SpeechRecognition ||
        window.webkitSpeechRecognition
    )
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