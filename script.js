// ==========================================
// SPEECH TRACKER
// ==========================================

const statusText = document.getElementById("status");
const statusDot = document.getElementById("statusDot");
const heardText = document.getElementById("heard");

const listenButton =
    document.getElementById("listenButton");

const stopButton =
    document.getElementById("stopButton");

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

const analysisLoading =
    document.getElementById("analysisLoading");

const analysisElement =
    document.getElementById("analysis");


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
    console.log(
        "Could not load saved words."
    );
}

if (trackedWords.length === 0) {
    trackedWords =
        [...DEFAULT_WORDS];
}


// ==========================================
// VARIABLES
// ==========================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];

let isRecording = false;
let isProcessing = false;

let finalTranscript = "";
let liveTranscript = "";

let recognition = null;
let recognitionSupported = false;

let vibratedOccurrences = new Set();


// ==========================================
// STATUS
// ==========================================

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


// ==========================================
// MESSAGE
// ==========================================

function showMessage(message) {
    if (heardText) {
        heardText.textContent =
            message;
    }
}


// ==========================================
// SAVE WORDS
// ==========================================

function saveWords() {
    try {
        localStorage.setItem(
            "speechTrackerWords",
            JSON.stringify(
                trackedWords
            )
        );
    } catch (error) {
        console.log(
            "Could not save words."
        );
    }
}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(text) {
    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


// ==========================================
// ESCAPE REGEX
// ==========================================

function escapeRegex(text) {
    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}


// ==========================================
// RENDER WORD LIST
// ==========================================

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

            remove.type = "button";
            remove.textContent = "×";

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


// ==========================================
// ADD CUSTOM WORD
// ==========================================

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
        !trackedWords.includes(word)
    ) {

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
        (event) => {

            if (
                event.key === "Enter"
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
        }
    );
}


// ==========================================
// HIGHLIGHT TRACKED WORDS
// ==========================================

function highlightTrackedWords(text) {

    if (!text) {
        return "";
    }

    let result =
        escapeHTML(text);

    const sortedWords =
        [...trackedWords].sort(
            (a, b) =>
                b.length - a.length
        );

    sortedWords.forEach(
        (word) => {

            const escaped =
                escapeRegex(
                    escapeHTML(word)
                );

            const regex =
                new RegExp(
                    "(^|\\s)(" +
                    escaped +
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


// ==========================================
// COUNT TRACKED WORDS
// ==========================================

function countTrackedWords(text) {

    let count = 0;

    trackedWords.forEach(
        (word) => {

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


// ==========================================
// COUNT TOTAL WORDS
// ==========================================

function countTotalWords(text) {

    if (!text || !text.trim()) {
        return 0;
    }

    return text
        .trim()
        .split(/\s+/)
        .length;
}


// ==========================================
// UPDATE LIVE UI
// ==========================================

function updateTranscriptUI(text) {

    if (!text) {
        return;
    }

    liveTranscript =
        text.trim();

    if (heardText) {

        heardText.innerHTML =
            highlightTrackedWords(
                liveTranscript
            );
    }

    if (fillerCountElement) {

        fillerCountElement.textContent =
            countTrackedWords(
                liveTranscript
            );
    }

    if (wordCountElement) {

        wordCountElement.textContent =
            countTotalWords(
                liveTranscript
            );
    }
}


// ==========================================
// FINAL TRANSCRIPT UI
// ==========================================

function displayTranscript(text) {

    finalTranscript =
        text || "";

    liveTranscript =
        finalTranscript;

    updateTranscriptUI(
        finalTranscript
    );

    if (analyzeButton) {

        analyzeButton.disabled =
            !finalTranscript.trim();
    }
}


// ==========================================
// NOTIFICATION
// ==========================================

function showFillerNotification(word) {

    // ==================================
    // 1. IN-APP ALERT
    // ==================================

    let alert =
        document.getElementById(
            "fillerAlert"
        );

    if (!alert) {

        alert =
            document.createElement(
                "div"
            );

        alert.id =
            "fillerAlert";

        alert.style.position =
            "fixed";

        alert.style.left = "16px";
        alert.style.right = "16px";
        alert.style.bottom = "24px";

        alert.style.zIndex = "99999";

        alert.style.padding =
            "16px 18px";

        alert.style.borderRadius =
            "16px";

        alert.style.background =
            "#111827";

        alert.style.color =
            "white";

        alert.style.fontWeight =
            "700";

        alert.style.fontSize =
            "16px";

        alert.style.textAlign =
            "center";

        alert.style.boxShadow =
            "0 8px 30px rgba(0,0,0,.25)";

        document.body.appendChild(
            alert
        );
    }

    alert.textContent =
        "⚠️ Tracked word: " + word;

    alert.style.display =
        "block";


    clearTimeout(
        window.fillerAlertTimeout
    );

    window.fillerAlertTimeout =
        setTimeout(
            () => {

                alert.style.display =
                    "none";

            },
            1200
        );


    // ==================================
    // 2. VIBRATION
    // ==================================

    if (
        typeof navigator.vibrate ===
        "function"
    ) {

        try {
            navigator.vibrate(
                [150]
            );
        } catch (error) {
            console.log(
                "Vibration unavailable."
            );
        }
    }


    // ==================================
    // 3. BROWSER NOTIFICATION
    // ==================================

    if (
        "Notification" in window &&
        Notification.permission ===
            "granted"
    ) {

        try {

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

            console.log(
                "Browser notification unavailable."
            );
        }
    }
}


// ==========================================
// REQUEST NOTIFICATION PERMISSION
// ==========================================

async function requestNotificationPermission() {

    if (
        !("Notification" in window)
    ) {
        return;
    }

    if (
        Notification.permission ===
        "default"
    ) {

        try {

            await Notification.requestPermission();

        } catch (error) {

            console.log(
                "Notification permission unavailable."
            );
        }
    }
}


// ==========================================
// FIND NEW FILLER WORDS
// ==========================================

function checkForTrackedWords(text) {

    const matches = [];

    trackedWords.forEach(
        (word) => {

            const regex =
                new RegExp(
                    "\\b" +
                    escapeRegex(word) +
                    "\\b",
                    "gi"
                );

            let match;

            while (
                (match =
                    regex.exec(text)) !==
                null
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


    for (
        const match of matches
    ) {

        const key =
            match.word +
            ":" +
            match.index;

        if (
            vibratedOccurrences.has(
                key
            )
        ) {
            continue;
        }

        vibratedOccurrences.add(
            key
        );

        showFillerNotification(
            match.word
        );
    }
}


// ==========================================
// SPEECH RECOGNITION
// ==========================================

function setupSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        console.log(
            "Speech recognition is not supported."
        );

        recognitionSupported =
            false;

        return;
    }


    recognitionSupported =
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


    recognition.onresult =
        (event) => {

            let transcript = "";

            // Rebuild the entire current
            // transcript every time.

            for (
                let i = 0;
                i < event.results.length;
                i++
            ) {

                transcript +=
                    event.results[i][0]
                        .transcript +
                    " ";
            }


            transcript =
                transcript.trim();


            // SHOW LIVE TEXT
            updateTranscriptUI(
                transcript
            );


            // DETECT WORDS IMMEDIATELY
            checkForTrackedWords(
                transcript
            );
        };


    recognition.onerror =
        (event) => {

            console.log(
                "Speech recognition error:",
                event.error
            );
        };


    recognition.onend =
        () => {

            if (isRecording) {

                try {

                    recognition.start();

                } catch (error) {

                    // Recognition was
                    // already running.
                }
            }
        };
}


// ==========================================
// START LIVE RECOGNITION
// ==========================================

function startLiveRecognition() {

    if (
        !recognitionSupported ||
        !recognition
    ) {
        return;
    }

    try {

        recognition.start();

    } catch (error) {

        console.log(
            "Recognition already started."
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
}


// ==========================================
// MICROPHONE SUPPORT
// ==========================================

function microphoneSupported() {

    return !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
    );
}


// ==========================================
// START RECORDING
// ==========================================

async function startRecording() {

    if (
        isRecording ||
        isProcessing
    ) {
        return;
    }


    if (!microphoneSupported()) {

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

        // Ask for notification permission
        // while the user has just tapped
        // Listen.

        await requestNotificationPermission();


        audioStream =
            await navigator
                .mediaDevices
                .getUserMedia({
                    audio: true
                });


        audioChunks = [];


        vibratedOccurrences =
            new Set();


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


        mediaRecorder.onstop =
            () => {

                // Let the UI update before
                // processing the recording.

                setTimeout(
                    () => {
                        sendRecording();
                    },
                    50
                );
            };


        mediaRecorder.start(
            1000
        );


        isRecording =
            true;


        listenButton.disabled =
            true;

        stopButton.disabled =
            false;


        setStatus(
            "Listening...",
            "listening"
        );


        showMessage(
            "🎤 Listening... start speaking."
        );


        startLiveRecognition();


    } catch (error) {

        console.error(
            "START ERROR:",
            error
        );


        if (audioStream) {

            audioStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }


        audioStream = null;

        isRecording = false;

        listenButton.disabled =
            false;

        stopButton.disabled =
            true;


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

    if (!isRecording) {
        return;
    }


    // IMPORTANT:
    // Change UI FIRST.

    isRecording =
        false;

    isProcessing =
        true;


    stopLiveRecognition();


    listenButton.disabled =
        true;

    stopButton.disabled =
        true;


    setStatus(
        "Stopping...",
        "listening"
    );


    showMessage(
        "⏹ Stopping recording..."
    );


    if (
        mediaRecorder &&
        mediaRecorder.state !==
            "inactive"
    ) {

        try {

            mediaRecorder.stop();

        } catch (error) {

            console.error(
                "Stop error:",
                error
            );
        }

    } else {

        sendRecording();
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
// BLOB → BASE64
// ==========================================

function blobToBase64(blob) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onloadend =
                () => {

                    const result =
                        reader.result;


                    if (
                        typeof result !==
                        "string"
                    ) {

                        reject(
                            new Error(
                                "Could not convert audio."
                            )
                        );

                        return;
                    }


                    const comma =
                        result.indexOf(",");


                    if (
                        comma === -1
                    ) {

                        reject(
                            new Error(
                                "Invalid audio data."
                            )
                        );

                        return;
                    }


                    resolve(
                        result.substring(
                            comma + 1
                        )
                    );
                };


            reader.onerror =
                () => {

                    reject(
                        new Error(
                            "Could not read audio."
                        )
                    );
                };


            reader.readAsDataURL(
                blob
            );
        }
    );
}


// ==========================================
// SEND RECORDING TO OPENAI
// ==========================================

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


        audioChunks = [];


        setStatus(
            "Transcribing...",
            "listening"
        );


        showMessage(
            "🤖 AI is transcribing your speech..."
        );


        const base64Audio =
            await blobToBase64(
                audioBlob
            );


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


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Transcription failed."
            );
        }


        if (
            !data.transcript
        ) {

            throw new Error(
                "OpenAI returned an empty transcript."
            );
        }


        displayTranscript(
            data.transcript
        );


        setStatus(
            "Finished",
            "ready"
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


        showMessage(
            "Transcription failed: " +
            error.message
        );


    } finally {

        isProcessing =
            false;

        listenButton.disabled =
            false;

        stopButton.disabled =
            true;
    }
}


// ==========================================
// ANALYZE SPEECH
// ==========================================

async function analyzeSpeech() {

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {
        return;
    }


    analyzeButton.disabled =
        true;


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


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "ANALYSIS API ERROR:",
                data
            );

            throw new Error(
                data.error ||
                "Analysis failed."
            );
        }


        if (
            !data.analysis
        ) {

            throw new Error(
                "The AI returned no analysis."
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

            analysisElement.textContent =
                "Analysis failed: " +
                error.message;
        }


    } finally {

        if (analysisLoading) {
            analysisLoading.hidden =
                true;
        }

        analyzeButton.disabled =
            false;
    }
}


// ==========================================
// FORMAT AI ANALYSIS
// ==========================================

function formatAnalysis(text) {

    return escapeHTML(text)
        .replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
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
// STARTUP
// ==========================================

renderWords();

setupSpeechRecognition();

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
    "Live recognition:",
    recognitionSupported
);

console.log(
    "Vibration:",
    typeof navigator.vibrate ===
        "function"
);