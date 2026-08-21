// ============================================================
// SPEECH TRACKER
// Live Speech Recognition
// + Audio Recording
// + OpenAI Final Transcription
// + Filler Word Detection
// + Highlighting
// + AI Analysis
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

    trackedWords =
        [...DEFAULT_WORDS];
}


// ============================================================
// RECORDING VARIABLES
// ============================================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];

let isRecording = false;

let finalTranscript = "";

let liveTranscript = "";

let fillerCount = 0;
let totalWords = 0;


// ============================================================
// SPEECH RECOGNITION VARIABLES
// ============================================================

let recognition = null;

let speechRecognitionSupported = false;

let recognitionShouldContinue = false;

let lastDetectedLiveText = "";


// ============================================================
// FILLER DETECTION MEMORY
// ============================================================

// Prevent the same word from triggering repeatedly
// because SpeechRecognition can return the same
// interim result multiple times.

let detectedLiveMatches = new Set();


// ============================================================
// STATUS
// ============================================================

function setStatus(message, state = "ready") {

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
            JSON.stringify(trackedWords)
        );

    } catch (error) {

        console.error(
            "Could not save tracked words:",
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
        String(text);

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
// ADD WORD BUTTON
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

            trackedWords =
                [...DEFAULT_WORDS];

            saveWords();

            renderWords();
        }
    );
}


// ============================================================
// HIGHLIGHT TRACKED WORDS
// ============================================================

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

            if (!word.trim()) {
                return;
            }


            const escapedWord =
                escapeRegex(
                    escapeHTML(word)
                );


            const regex =
                new RegExp(
                    `(^|\\s)(${escapedWord})(?=\\s|[.,!?;:]|$)`,
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
// COUNT TRACKED WORDS
// ============================================================

function countTrackedWords(text) {

    if (!text) {
        return 0;
    }

    let count = 0;


    trackedWords.forEach(
        (word) => {

            if (!word.trim()) {
                return;
            }


            const regex =
                new RegExp(
                    `\\b${escapeRegex(word)}\\b`,
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
// DISPLAY TRANSCRIPT
// ============================================================

function displayTranscript(text) {

    if (
        !text ||
        typeof text !== "string"
    ) {

        console.error(
            "Invalid transcript:",
            text
        );

        return;
    }


    finalTranscript =
        text.trim();


    fillerCount =
        countTrackedWords(
            finalTranscript
        );


    totalWords =
        countTotalWords(
            finalTranscript
        );


    console.log(
        "FINAL TRANSCRIPT:",
        finalTranscript
    );


    console.log(
        "FILLER COUNT:",
        fillerCount
    );


    console.log(
        "TOTAL WORDS:",
        totalWords
    );


    if (heardText) {

        try {

            heardText.innerHTML =
                highlightTrackedWords(
                    finalTranscript
                );

        } catch (error) {

            console.error(
                "Highlighting failed:",
                error
            );

            heardText.textContent =
                finalTranscript;
        }
    }


    if (fillerCountElement) {

        fillerCountElement.textContent =
            String(fillerCount);
    }


    if (wordCountElement) {

        wordCountElement.textContent =
            String(totalWords);
    }


    if (analyzeButton) {

        analyzeButton.disabled =
            finalTranscript.length === 0;
    }
}


// ============================================================
// DISPLAY LIVE TRANSCRIPT
// ============================================================

function displayLiveTranscript(text) {

    if (!heardText) {
        return;
    }

    if (!text || !text.trim()) {
        return;
    }


    liveTranscript =
        text.trim();


    const liveFillerCount =
        countTrackedWords(
            liveTranscript
        );


    const liveWordCount =
        countTotalWords(
            liveTranscript
        );


    heardText.innerHTML =
        highlightTrackedWords(
            liveTranscript
        );


    if (fillerCountElement) {

        fillerCountElement.textContent =
            String(liveFillerCount);
    }


    if (wordCountElement) {

        wordCountElement.textContent =
            String(liveWordCount);
    }
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
        (word) => {

            if (!word.trim()) {
                return;
            }


            const regex =
                new RegExp(
                    `\\b${escapeRegex(word)}\\b`,
                    "gi"
                );


            let match;


            while (
                (match =
                    regex.exec(text)) !== null
            ) {

                matches.push({

                    word: word,

                    index:
                        match.index,

                    end:
                        match.index +
                        match[0].length
                });


                // Prevent infinite loops
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
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
// SHOW FILLER ALERT
// ============================================================

function showFillerAlert(word) {

    console.log(
        "TRACKED WORD DETECTED:",
        word
    );


    // Browser notification, if permission
    // has already been granted.

    if (
        "Notification" in window &&
        Notification.permission === "granted"
    ) {

        try {

            new Notification(
                "Tracked word detected",
                {
                    body:
                        `"${word}" was detected in your speech.`
                }
            );

        } catch (error) {

            console.log(
                "System notification unavailable:",
                error
            );
        }
    }


    // In-app visual alert

    const existing =
        document.getElementById(
            "speechTrackerAlert"
        );


    if (existing) {
        existing.remove();
    }


    const alert =
        document.createElement("div");

    alert.id =
        "speechTrackerAlert";


    alert.textContent =
        `⚠️ Tracked word: "${word}"`;


    alert.style.position =
        "fixed";

    alert.style.left =
        "50%";

    alert.style.bottom =
        "25px";

    alert.style.transform =
        "translateX(-50%)";

    alert.style.zIndex =
        "9999";

    alert.style.padding =
        "14px 18px";

    alert.style.borderRadius =
        "14px";

    alert.style.background =
        "#111827";

    alert.style.color =
        "white";

    alert.style.fontWeight =
        "700";

    alert.style.boxShadow =
        "0 8px 30px rgba(0,0,0,0.2)";


    document.body.appendChild(alert);


    setTimeout(
        () => {

            if (alert.parentNode) {
                alert.remove();
            }

        },
        1800
    );


    // Try vibration where supported.

    vibrate();
}


// ============================================================
// CHECK FOR NEW LIVE FILLER WORDS
// ============================================================

function detectLiveTrackedWords(text) {

    if (!text) {
        return;
    }


    const matches =
        findTrackedWords(text);


    for (const match of matches) {

        const key =
            `${match.word}-${match.index}`;


        if (
            detectedLiveMatches.has(key)
        ) {

            continue;
        }


        detectedLiveMatches.add(key);


        showFillerAlert(
            match.word
        );
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
            "Browser vibration is unavailable."
        );

        return false;
    }


    try {

        navigator.vibrate(
            [150]
        );

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
// NOTIFICATION PERMISSION
// ============================================================

async function requestNotificationPermission() {

    if (
        !("Notification" in window)
    ) {

        console.log(
            "Notifications are not supported by this browser."
        );

        return false;
    }


    try {

        const permission =
            await Notification.requestPermission();


        console.log(
            "Notification permission:",
            permission
        );


        return permission === "granted";

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

        return false;
    }
}


// ============================================================
// MICROPHONE SUPPORT
// ============================================================

function checkMicrophoneSupport() {

    return !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia &&
        window.MediaRecorder
    );
}


// ============================================================
// SPEECH RECOGNITION SETUP
// ============================================================

function setupSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        console.warn(
            "Speech Recognition is not supported."
        );

        speechRecognitionSupported =
            false;

        return;
    }


    speechRecognitionSupported =
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
                "Live speech recognition started."
            );
        };


    recognition.onresult =
        (event) => {

            let combinedText =
                "";


            for (
                let i = 0;
                i < event.results.length;
                i++
            ) {

                combinedText +=
                    event.results[i][0].transcript +
                    " ";
            }


            combinedText =
                combinedText.trim();


            if (!combinedText) {
                return;
            }


            lastDetectedLiveText =
                combinedText;


            displayLiveTranscript(
                combinedText
            );


            detectLiveTrackedWords(
                combinedText
            );
        };


    recognition.onerror =
        (event) => {

            console.error(
                "Speech recognition error:",
                event.error
            );


            if (
                event.error ===
                "not-allowed"
            ) {

                console.warn(
                    "Microphone permission was denied."
                );
            }
        };


    recognition.onend =
        () => {

            console.log(
                "Speech recognition ended."
            );


            // Chrome sometimes stops recognition
            // even though continuous=true.

            if (
                recognitionShouldContinue &&
                isRecording
            ) {

                try {

                    recognition.start();

                } catch (error) {

                    console.log(
                        "Recognition restart skipped:",
                        error
                    );
                }
            }
        };
}


// ============================================================
// START LIVE RECOGNITION
// ============================================================

function startLiveRecognition() {

    if (
        !speechRecognitionSupported ||
        !recognition
    ) {

        console.log(
            "Live transcription is unavailable in this browser."
        );

        return;
    }


    recognitionShouldContinue =
        true;


    try {

        recognition.start();

    } catch (error) {

        console.log(
            "Recognition was already running:",
            error
        );
    }
}


// ============================================================
// STOP LIVE RECOGNITION
// ============================================================

function stopLiveRecognition() {

    recognitionShouldContinue =
        false;


    if (!recognition) {
        return;
    }


    try {

        recognition.stop();

    } catch (error) {

        console.log(
            "Recognition stop error:",
            error
        );
    }
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
            await navigator.mediaDevices.getUserMedia(
                {
                    audio: true
                }
            );


        console.log(
            "Microphone permission granted."
        );


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
            async () => {

                console.log(
                    "MediaRecorder stopped."
                );


                await sendRecording();
            };


        mediaRecorder.start(
            250
        );


        isRecording =
            true;


        finalTranscript =
            "";

        liveTranscript =
            "";


        detectedLiveMatches =
            new Set();


        if (analyzeButton) {

            analyzeButton.disabled =
                true;
        }


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


        // Start live transcription.

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
                    track =>
                        track.stop()
                );

            audioStream =
                null;
        }


        isRecording =
            false;


        if (listenButton) {

            listenButton.disabled =
                false;
        }


        if (stopButton) {

            stopButton.disabled =
                true;
        }


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

    if (
        !mediaRecorder ||
        !isRecording
    ) {

        return;
    }


    console.log(
        "Stopping recording..."
    );


    isRecording =
        false;


    recognitionShouldContinue =
        false;


    // Stop browser speech recognition.

    stopLiveRecognition();


    // Stop MediaRecorder.

    try {

        if (
            mediaRecorder.state !==
            "inactive"
        ) {

            mediaRecorder.stop();
        }

    } catch (error) {

        console.error(
            "MediaRecorder stop error:",
            error
        );
    }


    // Stop microphone tracks.

    if (audioStream) {

        audioStream
            .getTracks()
            .forEach(
                (track) => {

                    try {
                        track.stop();
                    } catch (error) {
                        console.log(
                            "Track stop error:",
                            error
                        );
                    }
                }
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


    showMessage(
        "🤖 Transcribing your speech..."
    );
}


// ============================================================
// LISTEN BUTTON
// ============================================================

if (listenButton) {

    listenButton.addEventListener(
        "click",
        () => {

            startRecording();
        }
    );
}


// ============================================================
// STOP BUTTON
// ============================================================

if (stopButton) {

    stopButton.addEventListener(
        "click",
        () => {

            stopRecording();
        }
    );
}


// ============================================================
// SEND RECORDING TO VERCEL
// ============================================================

async function sendRecording() {

    try {

        if (
            !audioChunks ||
            audioChunks.length === 0
        ) {

            throw new Error(
                "No audio was recorded."
            );
        }


        const audioType =
            mediaRecorder?.mimeType ||
            "audio/webm";


        const audioBlob =
            new Blob(
                audioChunks,
                {
                    type:
                        audioType
                }
            );


        console.log(
            "Audio size:",
            audioBlob.size,
            "bytes"
        );


        if (audioBlob.size === 0) {

            throw new Error(
                "The recording was empty."
            );
        }


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
            "Sending recording to /api/transcribe..."
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
            "Transcription HTTP status:",
            response.status
        );


        console.log(
            "Transcription response:",
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
                "The transcription server returned invalid JSON."
            );
        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                data.details ||
                "Transcription failed."
            );
        }


        const transcript =
            typeof data.transcript ===
            "string"
                ? data.transcript.trim()
                : "";


        if (!transcript) {

            console.error(
                "Empty transcription response:",
                data
            );


            throw new Error(
                "OpenAI returned an empty transcript."
            );
        }


        console.log(
            "FINAL TRANSCRIPT:",
            transcript
        );


        // IMPORTANT:
        // Display the actual transcript.

        displayTranscript(
            transcript
        );


        setStatus(
            "Finished",
            "ready"
        );


        console.log(
            "Transcript displayed successfully."
        );


        showMessage(
            transcript
        );


        // Analyze button should now work.

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


        if (analyzeButton) {

            analyzeButton.disabled =
                true;
        }
    }
}


// ============================================================
// ANALYZE SPEECH
// ============================================================

async function analyzeSpeech() {

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {

        alert(
            "Please record and transcribe a speech first."
        );

        return;
    }


    if (analysisLoading) {

        analysisLoading.hidden =
            false;
    }


    if (analyzeButton) {

        analyzeButton.disabled =
            true;

        analyzeButton.textContent =
            "🤖 Analyzing...";
    }


    if (analysisElement) {

        analysisElement.innerHTML =
            "";
    }


    try {

        console.log(
            "Sending transcript for AI analysis..."
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
            "Analysis HTTP status:",
            response.status
        );


        console.log(
            "Analysis response:",
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
            typeof data.analysis ===
            "string"
                ? data.analysis.trim()
                : "";


        if (!analysis) {

            throw new Error(
                "OpenAI returned an empty analysis."
            );
        }


        console.log(
            "AI analysis received."
        );


        displayAnalysis(
            analysis
        );


    } catch (error) {

        console.error(
            "ANALYSIS ERROR:",
            error
        );


        if (analysisElement) {

            analysisElement.innerHTML =
                `
                <div class="analysis-error">
                    <strong>Analysis failed</strong>
                    <p>${escapeHTML(error.message)}</p>
                </div>
                `;
        }

    } finally {

        if (analysisLoading) {

            analysisLoading.hidden =
                true;
        }


        if (analyzeButton) {

            analyzeButton.disabled =
                !finalTranscript;

            analyzeButton.textContent =
                "🤖 Analyze My Speech";
        }
    }
}


// ============================================================
// DISPLAY AI ANALYSIS
// ============================================================

function displayAnalysis(text) {

    if (!analysisElement) {
        return;
    }


    // Convert the AI response into readable HTML.

    const escaped =
        escapeHTML(text);


    const formatted =
        escaped
            .replace(
                /^OVERALL SCORE$/gim,
                "<h3>Overall Score</h3>"
            )
            .replace(
                /^WHAT YOU DID WELL$/gim,
                "<h3>What You Did Well</h3>"
            )
            .replace(
                /^FILLER WORDS$/gim,
                "<h3>Filler Words</h3>"
            )
            .replace(
                /^CLARITY$/gim,
                "<h3>Clarity</h3>"
            )
            .replace(
                /^HOW TO IMPROVE$/gim,
                "<h3>How to Improve</h3>"
            )
            .replace(
                /^NEXT CHALLENGE$/gim,
                "<h3>Next Challenge</h3>"
            )
            .replace(
                /\n/g,
                "<br>"
            );


    analysisElement.innerHTML =
        formatted;
}


// ============================================================
// ANALYZE BUTTON
// ============================================================

if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        () => {

            analyzeSpeech();
        }
    );
}


// ============================================================
// INITIALIZE SPEECH RECOGNITION
// ============================================================

setupSpeechRecognition();


// ============================================================
// INITIALIZE UI
// ============================================================

renderWords();


setStatus(
    "Ready",
    "ready"
);


if (heardText) {

    heardText.innerHTML =
        "Tap <b>Listen</b> and start speaking.";
}


if (analyzeButton) {

    analyzeButton.disabled =
        true;
}


// ============================================================
// DEBUG INFORMATION
// ============================================================

console.log(
    "================================"
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
    "MediaRecorder:",
    !!window.MediaRecorder
);

console.log(
    "Speech Recognition:",
    speechRecognitionSupported
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
    "Tracked words:",
    trackedWords
);

console.log(
    "================================"
);