// ==========================================
// SPEECH TRACKER
// Stable MVP version
// Microphone → Live Browser Transcript
// → Final OpenAI Transcript
// → Filler Detection → Vibration
// ==========================================


// ==========================================
// ELEMENTS
// ==========================================

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
// LOAD WORDS
// ==========================================

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

let isRecording = false;
let isProcessing = false;

let finalTranscript = "";
let liveTranscript = "";

let fillerCount = 0;
let totalWords = 0;

let recognition = null;
let recognitionSupported = false;

let alreadyVibratedIndexes = new Set();


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
// RENDER WORDS
// ==========================================

function renderWords() {

    if (!wordList) {
        return;
    }

    wordList.innerHTML = "";

    trackedWords.forEach((word, index) => {

        const tag =
            document.createElement("div");

        tag.className = "word-tag";

        const text =
            document.createElement("span");

        text.textContent = word;

        const remove =
            document.createElement("button");

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

    if (!trackedWords.includes(word)) {

        trackedWords.push(word);

        saveWords();

        renderWords();
    }

    customWordInput.value = "";
}


// ==========================================
// CUSTOM WORD BUTTON
// ==========================================

if (addWordButton) {

    addWordButton.addEventListener(
        "click",
        addCustomWord
    );
}


// ==========================================
// ENTER TO ADD WORD
// ==========================================

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


// ==========================================
// RESET WORDS
// ==========================================

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
// HIGHLIGHT WORDS
// ==========================================

function highlightTrackedWords(text) {

    let result =
        escapeHTML(text);

    const sortedWords =
        [...trackedWords].sort(
            (a, b) => b.length - a.length
        );

    sortedWords.forEach((word) => {

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
    });

    return result;
}


// ==========================================
// COUNT TRACKED WORDS
// ==========================================

function countTrackedWords(text) {

    let count = 0;

    trackedWords.forEach((word) => {

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
            count += matches.length;
        }
    });

    return count;
}


// ==========================================
// COUNT TOTAL WORDS
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

    finalTranscript = text || "";

    fillerCount =
        countTrackedWords(finalTranscript);

    totalWords =
        countTotalWords(finalTranscript);

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


// ==========================================
// LIVE TRANSCRIPT DISPLAY
// ==========================================

function displayLiveTranscript(text) {

    liveTranscript = text || "";

    if (!heardText) {
        return;
    }

    heardText.innerHTML =
        highlightTrackedWords(
            liveTranscript
        );

    const count =
        countTrackedWords(liveTranscript);

    const words =
        countTotalWords(liveTranscript);

    if (fillerCountElement) {
        fillerCountElement.textContent = count;
    }

    if (wordCountElement) {
        wordCountElement.textContent = words;
    }
}


// ==========================================
// VIBRATION
// ==========================================

function vibrate() {

    if (
        typeof navigator.vibrate !==
        "function"
    ) {
        return;
    }

    try {
        navigator.vibrate(150);
    } catch (error) {
        console.log("Vibration unavailable.");
    }
}


// ==========================================
// FIND TRACKED WORDS
// ==========================================

function findTrackedWords(text) {

    const matches = [];

    trackedWords.forEach((word) => {

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
    });

    matches.sort(
        (a, b) =>
            a.index - b.index
    );

    return matches;
}


// ==========================================
// VIBRATE ONLY FOR NEW WORDS
// ==========================================

function checkForNewTrackedWords(text) {

    const matches =
        findTrackedWords(text);

    for (const match of matches) {

        const key =
            match.word +
            ":" +
            match.index;

        if (
            alreadyVibratedIndexes.has(key)
        ) {
            continue;
        }

        alreadyVibratedIndexes.add(key);

        vibrate();
    }
}


// ==========================================
// MICROPHONE SUPPORT
// ==========================================

function checkMicrophoneSupport() {

    return !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
    );
}


// ==========================================
// LIVE SPEECH RECOGNITION
// ==========================================

function setupSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        recognitionSupported = false;

        console.log(
            "Live speech recognition unavailable."
        );

        return;
    }

    recognitionSupported = true;

    recognition =
        new SpeechRecognition();

    recognition.continuous = true;

    recognition.interimResults = true;

    recognition.lang = "en-US";

    recognition.maxAlternatives = 1;


    recognition.onresult = (event) => {

        let transcript = "";

        for (
            let i = 0;
            i < event.results.length;
            i++
        ) {

            transcript +=
                event.results[i][0].transcript +
                " ";
        }

        transcript =
            transcript.trim();

        displayLiveTranscript(
            transcript
        );

        checkForNewTrackedWords(
            transcript
        );
    };


    recognition.onerror = (event) => {

        console.log(
            "Speech recognition:",
            event.error
        );

        // Don't kill the recording
        // because browser speech recognition
        // is only being used for live display.
    };


    recognition.onend = () => {

        // Automatically restart if
        // microphone recording is still active.

        if (isRecording) {

            try {
                recognition.start();
            } catch (error) {
                // Already running.
            }
        }
    };
}


// ==========================================
// START LIVE TRANSCRIPTION
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
            "Recognition already running."
        );
    }
}


// ==========================================
// STOP LIVE TRANSCRIPTION
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
// START RECORDING
// ==========================================

async function startRecording() {

    if (
        isRecording ||
        isProcessing
    ) {
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

        console.log(
            "Requesting microphone..."
        );

        audioStream =
            await navigator
                .mediaDevices
                .getUserMedia({
                    audio: true
                });


        audioChunks = [];

        alreadyVibratedIndexes =
            new Set();


        // ==================================
        // CHOOSE RECORDING FORMAT
        // ==================================

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


        // ==================================
        // CREATE RECORDER
        // ==================================

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


        // ==================================
        // AUDIO CHUNKS
        // ==================================

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


        // ==================================
        // RECORDER STOP
        // ==================================

        mediaRecorder.onstop =
            () => {

                console.log(
                    "MediaRecorder stopped."
                );

                // Don't block the UI.
                // Let sendRecording run separately.

                setTimeout(
                    () => {
                        sendRecording();
                    },
                    50
                );
            };


        // ==================================
        // START
        // ==================================

        mediaRecorder.start(1000);

        isRecording = true;

        listenButton.disabled = true;

        stopButton.disabled = false;

        setStatus(
            "Listening...",
            "listening"
        );

        showMessage(
            "🎤 Listening... start speaking."
        );


        // ==================================
        // START LIVE RECOGNITION
        // ==================================

        startLiveRecognition();


    } catch (error) {

        console.error(
            "MICROPHONE ERROR:",
            error
        );

        if (audioStream) {

            audioStream
                .getTracks()
                .forEach(
                    track => track.stop()
                );
        }

        audioStream = null;

        isRecording = false;

        listenButton.disabled = false;

        stopButton.disabled = true;

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

    // IMPORTANT:
    // Update the UI immediately.
    // This makes the button feel instant.

    if (!isRecording) {
        return;
    }

    console.log(
        "STOP BUTTON PRESSED"
    );


    isRecording = false;

    isProcessing = true;


    // ==================================
    // IMMEDIATELY UPDATE BUTTONS
    // ==================================

    listenButton.disabled = true;

    stopButton.disabled = true;


    setStatus(
        "Stopping...",
        "listening"
    );

    showMessage(
        "⏹ Stopping recording..."
    );


    // ==================================
    // STOP LIVE RECOGNITION
    // ==================================

    stopLiveRecognition();


    // ==================================
    // STOP RECORDER
    // ==================================

    if (
        mediaRecorder &&
        mediaRecorder.state !== "inactive"
    ) {

        try {

            mediaRecorder.stop();

        } catch (error) {

            console.error(
                "Recorder stop error:",
                error
            );
        }

    } else {

        // Safety fallback

        sendRecording();
    }


    // ==================================
    // STOP MICROPHONE
    // ==================================

    if (audioStream) {

        audioStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

        audioStream = null;
    }
}


// ==========================================
// LISTEN BUTTON
// ==========================================

if (listenButton) {

    listenButton.addEventListener(
        "click",
        startRecording
    );
}


// ==========================================
// STOP BUTTON
// ==========================================

if (stopButton) {

    stopButton.addEventListener(
        "click",
        stopRecording
    );
}


// ==========================================
// SEND RECORDING
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


        // ==================================
        // CREATE BLOB
        // ==================================

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
            Math.round(
                audioBlob.size / 1024
            ),
            "KB"
        );


        // ==================================
        // RELEASE CHUNKS
        // ==================================

        audioChunks = [];


        setStatus(
            "Transcribing...",
            "listening"
        );

        showMessage(
            "🤖 AI is transcribing your speech..."
        );


        // ==================================
        // CONVERT TO BASE64 WITHOUT
        // GIANT STRING OPERATIONS
        // ==================================

        const base64Audio =
            await blobToBase64(
                audioBlob
            );


        // ==================================
        // SEND TO VERCEL
        // ==================================

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


        if (!data.transcript) {

            throw new Error(
                "The AI returned an empty transcript."
            );
        }


        console.log(
            "Final transcript:",
            data.transcript
        );


        // ==================================
        // DISPLAY FINAL TRANSCRIPT
        // ==================================

        displayTranscript(
            data.transcript
        );


        // ==================================
        // FINISHED
        // ==================================

        setStatus(
            "Finished",
            "ready"
        );


        showMessage(
            data.transcript
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

        isProcessing = false;

        listenButton.disabled = false;

        stopButton.disabled = true;
    }
}


// ==========================================
// BLOB → BASE64
// ==========================================

function blobToBase64(blob) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onloadend = () => {

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


                // Remove:
                // data:audio/webm;base64,

                const commaIndex =
                    result.indexOf(",");

                if (
                    commaIndex === -1
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
                        commaIndex + 1
                    )
                );
            };


            reader.onerror = () => {

                reject(
                    new Error(
                        "Could not read audio."
                    )
                );
            };


            reader.readAsDataURL(blob);
        }
    );
}


// ==========================================
// ANALYZE SPEECH
// ==========================================

if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );
}


async function analyzeSpeech() {

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {

        return;
    }


    analyzeButton.disabled = true;


    if (analysisLoading) {
        analysisLoading.hidden = false;
    }


    if (analysisElement) {
        analysisElement.textContent = "";
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
                "Analysis failed."
            );
        }


        if (analysisElement) {

            analysisElement.textContent =
                data.analysis ||
                "No analysis was returned.";
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
            analysisLoading.hidden = true;
        }

        analyzeButton.disabled = false;
    }
}


// ==========================================
// INITIALIZE
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


// ==========================================
// DEBUG
// ==========================================

console.log(
    "Speech Tracker loaded."
);

console.log(
    "HTTPS:",
    location.protocol
);

console.log(
    "Microphone:",
    !!navigator.mediaDevices
);

console.log(
    "Vibration:",
    typeof navigator.vibrate ===
    "function"
);

console.log(
    "Live speech recognition:",
    recognitionSupported
);