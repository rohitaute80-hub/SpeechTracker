// ==========================================
// SPEECH TRACKER
// Live Speech Recognition
// OpenAI Transcription
// Filler Detection
// Notifications
// AI Analysis
// ==========================================


// ==========================================
// ELEMENTS
// ==========================================

const statusText =
    document.getElementById("status");

const statusDot =
    document.getElementById("statusDot");

const heardText =
    document.getElementById("heard");

const listenButton =
    document.getElementById("listenButton");

const stopButton =
    document.getElementById("stopButton");

const notificationButton =
    document.getElementById("notificationButton");

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

let finalTranscript = "";

let liveTranscript = "";

let fillerCount = 0;

let totalWords = 0;

let recognition = null;

let recognitionSupported = false;

let recognitionRunning = false;

let notifiedWordCounts = {};


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
        document.createElement(
            "div"
        );

    div.textContent =
        text;

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

    trackedWords.forEach(
        function(word, index) {

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
                function() {

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
        function(event) {

            if (
                event.key === "Enter"
            ) {

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
        function() {

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
            function(a, b) {

                return (
                    b.length -
                    a.length
                );

            }
        );


    sortedWords.forEach(
        function(word) {

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


// ==========================================
// COUNT TRACKED WORDS
// ==========================================

function countTrackedWords(text) {

    let count = 0;


    trackedWords.forEach(
        function(word) {

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

    finalTranscript =
        text;


    fillerCount =
        countTrackedWords(text);


    totalWords =
        countTotalWords(text);


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


    updateAnalyzeButton();

}


// ==========================================
// ANALYZE BUTTON STATE
// ==========================================

function updateAnalyzeButton() {

    if (!analyzeButton) {

        return;

    }


    analyzeButton.disabled =
        !finalTranscript.trim();

}


// ==========================================
// VIBRATION
// ==========================================

function vibrate() {

    if (
        typeof navigator.vibrate ===
        "function"
    ) {

        navigator.vibrate(
            150
        );

        return true;

    }


    return false;

}


// ==========================================
// NOTIFICATION PERMISSION
// ==========================================

async function requestNotifications() {

    if (
        !("Notification" in window)
    ) {

        alert(
            "Notifications are not supported by this browser."
        );

        return;

    }


    try {

        const permission =
            await Notification.requestPermission();


        if (
            permission === "granted"
        ) {

            notificationButton.textContent =
                "🔔 Notifications Enabled";

            notificationButton.disabled =
                true;

        }
        else {

            notificationButton.textContent =
                "🔔 Notifications Blocked";

        }

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );

    }

}


// ==========================================
// NOTIFICATION BUTTON
// ==========================================

if (notificationButton) {

    notificationButton.addEventListener(
        "click",
        requestNotifications
    );

}


// ==========================================
// SHOW WORD NOTIFICATION
// ==========================================

async function notifyTrackedWord(word) {

    vibrate();


    if (
        !("Notification" in window)
    ) {

        return;

    }


    if (
        Notification.permission !==
        "granted"
    ) {

        return;

    }


    const title =
        "Tracked word detected";


    const body =
        `You said "${word}"`;


    try {

        if (
            "serviceWorker" in navigator
        ) {

            const registration =
                await navigator
                    .serviceWorker
                    .getRegistration();


            if (
                registration &&
                registration.showNotification
            ) {

                await registration.showNotification(
                    title,
                    {
                        body: body,
                        tag:
                            "speech-" +
                            Date.now(),
                        renotify: true
                    }
                );

                return;

            }

        }


        new Notification(
            title,
            {
                body: body
            }
        );

    } catch (error) {

        console.log(
            "Could not show notification:",
            error
        );

    }

}


// ==========================================
// DETECT NEW TRACKED WORDS
// ==========================================

function detectNewTrackedWords(text) {

    const currentCounts = {};


    trackedWords.forEach(
        function(word) {

            const regex =
                new RegExp(
                    "\\b" +
                    escapeRegex(word) +
                    "\\b",
                    "gi"
                );


            const matches =
                text.match(regex);


            currentCounts[word] =
                matches
                    ? matches.length
                    : 0;

        }
    );


    for (
        const word of trackedWords
    ) {

        const current =
            currentCounts[word] || 0;


        const previous =
            notifiedWordCounts[word] || 0;


        if (
            current > previous
        ) {

            const newOccurrences =
                current -
                previous;


            for (
                let i = 0;
                i < newOccurrences;
                i++
            ) {

                notifyTrackedWord(word);

            }

        }

    }


    notifiedWordCounts =
        currentCounts;

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
            "Live speech recognition is not supported."
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


    recognition.onstart =
        function() {

            recognitionRunning =
                true;

        };


    recognition.onresult =
        function(event) {

            let interimText =
                "";


            for (
                let i =
                    event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const transcript =
                    event.results[i][0].transcript;


                if (
                    event.results[i].isFinal
                ) {

                    liveTranscript +=
                        transcript + " ";

                }
                else {

                    interimText +=
                        transcript;

                }

            }


            const combinedText =
                (
                    liveTranscript +
                    interimText
                ).trim();


            displayTranscript(
                combinedText
            );


            detectNewTrackedWords(
                combinedText
            );

        };


    recognition.onerror =
        function(event) {

            console.log(
                "Speech recognition error:",
                event.error
            );

        };


    recognition.onend =
        function() {

            recognitionRunning =
                false;


            if (isRecording) {

                try {

                    recognition.start();

                } catch (error) {

                    console.log(
                        "Could not restart recognition."
                    );

                }

            }

        };

}


// ==========================================
// START LIVE RECOGNITION
// ==========================================

function startLiveRecognition() {

    if (!recognitionSupported) {

        return;

    }


    liveTranscript =
        "";


    notifiedWordCounts =
        {};


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

    if (
        !recognition
    ) {

        return;

    }


    try {

        recognition.stop();

    } catch (error) {

        console.log(
            "Recognition stop error."
        );

    }


    recognitionRunning =
        false;

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
// START RECORDING
// ==========================================

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


        audioChunks =
            [];


        finalTranscript =
            "";

        liveTranscript =
            "";


        notifiedWordCounts =
            {};


        displayTranscript("");


        let mimeType = "";


        if (
            MediaRecorder.isTypeSupported(
                "audio/webm;codecs=opus"
            )
        ) {

            mimeType =
                "audio/webm;codecs=opus";

        }
        else if (
            MediaRecorder.isTypeSupported(
                "audio/webm"
            )
        ) {

            mimeType =
                "audio/webm";

        }
        else if (
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

        }
        else {

            mediaRecorder =
                new MediaRecorder(
                    audioStream
                );

        }


        mediaRecorder.addEventListener(
            "dataavailable",
            function(event) {

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
            async function() {

                await sendRecording();

            }
        );


        mediaRecorder.start(250);


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


        if (recognitionSupported) {

            startLiveRecognition();

            showMessage(
                "🎤 Listening... Live transcription is active."
            );

        }
        else {

            showMessage(
                "🎤 Listening... Live transcription is not supported in this browser."
            );

        }

    }
    catch (error) {

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
            error.name +
            " — " +
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


    stopLiveRecognition();


    mediaRecorder.stop();


    isRecording =
        false;


    if (audioStream) {

        audioStream
            .getTracks()
            .forEach(
                function(track) {

                    track.stop();

                }
            );

    }


    listenButton.disabled =
        false;


    stopButton.disabled =
        true;


    setStatus(
        "Transcribing...",
        "listening"
    );


    showMessage(
        "🤖 AI is creating the final transcript..."
    );

}


// ==========================================
// BUTTON EVENTS
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
                        mediaRecorder.mimeType ||
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


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Transcription failed."
            );

        }


        const transcript =
            data.transcript || "";


        if (!transcript) {

            throw new Error(
                "The AI returned an empty transcript."
            );

        }


        displayTranscript(
            transcript
        );


        setStatus(
            "Finished",
            "ready"
        );


        showMessage(
            "Your speech has been transcribed."
        );


    }
    catch (error) {

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
// AI SPEECH ANALYSIS
// ==========================================

async function analyzeSpeech() {

    if (
        !finalTranscript.trim()
    ) {

        return;

    }


    analyzeButton.disabled =
        true;


    analysisLoading.hidden =
        false;


    analysisElement.innerHTML =
        "";


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


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Analysis failed."
            );

        }


        analysisElement.innerHTML =
            formatAnalysis(
                data.analysis
            );

    }
    catch (error) {

        console.error(
            "ANALYSIS ERROR:",
            error
        );


        analysisElement.innerHTML =
            `<p class="info">
                Analysis failed:
                ${escapeHTML(error.message)}
            </p>`;

    }
    finally {

        analysisLoading.hidden =
            true;

        analyzeButton.disabled =
            false;

    }

}


// ==========================================
// FORMAT AI ANALYSIS
// ==========================================

function formatAnalysis(text) {

    if (!text) {

        return "";

    }


    const escaped =
        escapeHTML(text);


    return escaped
        .replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
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


// ==========================================
// ANALYZE BUTTON
// ==========================================

if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );

}


// ==========================================
// SERVICE WORKER
// ==========================================

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        function() {

            navigator
                .serviceWorker
                .register("/sw.js")
                .then(
                    function() {

                        console.log(
                            "Service worker registered."
                        );

                    }
                )
                .catch(
                    function(error) {

                        console.log(
                            "Service worker registration failed:",
                            error
                        );

                    }
                );

        }
    );

}


// ==========================================
// STARTUP
// ==========================================

setupSpeechRecognition();

renderWords();

setStatus(
    "Ready",
    "ready"
);

showMessage(
    "Tap Listen and start speaking."
);


if (
    notificationButton &&
    "Notification" in window &&
    Notification.permission === "granted"
) {

    notificationButton.textContent =
        "🔔 Notifications Enabled";

    notificationButton.disabled =
        true;

}


console.log(
    "Speech Tracker loaded."
);

console.log(
    "HTTPS:",
    location.protocol
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