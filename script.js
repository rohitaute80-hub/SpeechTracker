// ==========================================
// SPEECH TRACKER
// LIVE OPENAI TRANSCRIPTION
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
// LOAD WORDS
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
// STATE
// ==========================================

let isRecording = false;
let isStopping = false;

let liveTranscript = "";
let finalTranscript = "";

let fillerCount = 0;
let totalWords = 0;

let mediaStream = null;
let audioContext = null;
let audioSource = null;
let processor = null;

let realtimeSocket = null;

let previousDetectedText = "";

let analysisInProgress = false;


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
// DISPLAY MESSAGE
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
// WORD LIST
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


// ==========================================
// ADD WORD
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
// HIGHLIGHT WORDS
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
// COUNT WORDS
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


// ==========================================
// UPDATE TRANSCRIPT
// ==========================================

function updateTranscript(text) {

    liveTranscript =
        text.trim();


    if (heardText) {

        heardText.innerHTML =
            highlightTrackedWords(
                liveTranscript
            );
    }


    fillerCount =
        countTrackedWords(
            liveTranscript
        );


    totalWords =
        countTotalWords(
            liveTranscript
        );


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
            !liveTranscript.trim();
    }
}


// ==========================================
// FIND NEW FILLER WORD
// ==========================================

function detectNewFillerWords(text) {

    if (!text) {
        return;
    }


    const oldText =
        previousDetectedText;


    const newPart =
        text.startsWith(oldText)
            ? text.substring(
                oldText.length
            )
            : text;


    if (newPart.trim()) {

        trackedWords.forEach(
            (word) => {

                const regex =
                    new RegExp(
                        "\\b" +
                        escapeRegex(word) +
                        "\\b",
                        "gi"
                    );


                if (
                    regex.test(
                        newPart
                    )
                ) {

                    triggerFillerAlert(
                        word
                    );
                }
            }
        );
    }


    previousDetectedText =
        text;
}


// ==========================================
// FILLER ALERT
// ==========================================

function triggerFillerAlert(word) {

    // --------------------------------------
    // VIBRATION
    // --------------------------------------

    if (
        typeof navigator.vibrate ===
        "function"
    ) {

        try {

            navigator.vibrate(
                180
            );

        } catch (error) {

            console.log(
                "Vibration failed."
            );
        }
    }


    // --------------------------------------
    // IN-APP ALERT
    // --------------------------------------

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


        Object.assign(
            alert.style,
            {
                position: "fixed",
                left: "16px",
                right: "16px",
                bottom: "24px",
                zIndex: "99999",
                padding: "16px",
                borderRadius: "16px",
                background: "#111827",
                color: "white",
                fontWeight: "700",
                fontSize: "17px",
                textAlign: "center",
                boxShadow:
                    "0 8px 30px rgba(0,0,0,.25)"
            }
        );


        document.body.appendChild(
            alert
        );
    }


    alert.textContent =
        `⚠️ You said "${word}"`;


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
            1000
        );
}


// ==========================================
// CREATE REALTIME SESSION
// ==========================================

async function createRealtimeSession() {

    const response =
        await fetch(
            "/api/realtime-token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.error ||
            "Could not create realtime session."
        );
    }


    if (!data.client_secret) {

        throw new Error(
            "No realtime client secret was returned."
        );
    }


    return data.client_secret;
}


// ==========================================
// START REALTIME SOCKET
// ==========================================

async function startRealtime() {

    const clientSecret =
        await createRealtimeSession();


    return new Promise(
        (resolve, reject) => {

            realtimeSocket =
                new WebSocket(
                    "wss://api.openai.com/v1/realtime?intent=transcription",
                    [
                        "realtime",
                        "openai-insecure-api-key." +
                        clientSecret
                    ]
                );


            realtimeSocket.onopen =
                () => {

                    console.log(
                        "Realtime connection opened."
                    );


                    realtimeSocket.send(
                        JSON.stringify({

                            type:
                                "transcription_session.update",

                            session: {

                                type:
                                    "transcription",

                                audio: {

                                    input: {

                                        format: {
                                            type:
                                                "audio/pcm",
                                            rate:
                                                24000
                                        },

                                        transcription: {

                                            model:
                                                "gpt-live-transcribe",

                                            language:
                                                "en",

                                            prompt:
                                                "Transcribe exactly what the speaker says. Preserve filler words such as um, uh, umm, uhh, like, you know, basically, literally, and actually. Never remove filler words."
                                        },

                                        turn_detection: {

                                            type:
                                                "server_vad",

                                            threshold:
                                                0.5,

                                            silence_duration_ms:
                                                500
                                        },

                                        noise_reduction: {

                                            type:
                                                "near_field"
                                        }
                                    }
                                }
                            }
                        })
                    );


                    resolve();
                };


            realtimeSocket.onmessage =
                (event) => {

                    try {

                        const data =
                            JSON.parse(
                                event.data
                            );


                        handleRealtimeEvent(
                            data
                        );

                    } catch (error) {

                        console.log(
                            "Realtime message error:",
                            error
                        );
                    }
                };


            realtimeSocket.onerror =
                (error) => {

                    console.error(
                        "Realtime socket error:",
                        error
                    );

                    reject(
                        new Error(
                            "Realtime connection failed."
                        )
                    );
                };


            realtimeSocket.onclose =
                (event) => {

                    console.log(
                        "Realtime socket closed:",
                        event.code,
                        event.reason
                    );
                };
        }
    );
}


// ==========================================
// REALTIME EVENTS
// ==========================================

function handleRealtimeEvent(data) {

    console.log(
        "Realtime event:",
        data.type
    );


    // --------------------------------------
    // LIVE DELTA
    // --------------------------------------

    if (
        data.type ===
        "conversation.item.input_audio_transcription.delta"
    ) {

        const delta =
            data.delta || "";


        liveTranscript +=
            delta;


        updateTranscript(
            liveTranscript
        );


        detectNewFillerWords(
            liveTranscript
        );
    }


    // --------------------------------------
    // COMPLETED SEGMENT
    // --------------------------------------

    if (
        data.type ===
        "conversation.item.input_audio_transcription.completed"
    ) {

        const transcript =
            data.transcript || "";


        if (transcript) {

            // If the server gives us
            // a complete segment, use it
            // without destroying earlier text.

            if (
                !liveTranscript
            ) {

                liveTranscript =
                    transcript;

            } else if (
                !liveTranscript
                    .toLowerCase()
                    .endsWith(
                        transcript
                            .trim()
                            .toLowerCase()
                    )
            ) {

                liveTranscript +=
                    " " +
                    transcript;
            }


            updateTranscript(
                liveTranscript
            );


            detectNewFillerWords(
                liveTranscript
            );
        }
    }


    // --------------------------------------
    // ERRORS
    // --------------------------------------

    if (
        data.type ===
        "error"
    ) {

        console.error(
            "OpenAI realtime error:",
            data
        );


        showMessage(
            "Realtime transcription error: " +
            (
                data.error?.message ||
                "Unknown error"
            )
        );
    }
}


// ==========================================
// MICROPHONE → PCM
// ==========================================

async function startMicrophoneStreaming() {

    mediaStream =
        await navigator
            .mediaDevices
            .getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });


    audioContext =
        new AudioContext({
            sampleRate: 24000
        });


    await audioContext.resume();


    audioSource =
        audioContext
            .createMediaStreamSource(
                mediaStream
            );


    // ScriptProcessor is intentionally used
    // here for browser compatibility.
    // It keeps the MVP simple.

    processor =
        audioContext.createScriptProcessor(
            4096,
            1,
            1
        );


    processor.onaudioprocess =
        (event) => {

            if (
                !isRecording ||
                !realtimeSocket ||
                realtimeSocket.readyState !==
                    WebSocket.OPEN
            ) {

                return;
            }


            const input =
                event.inputBuffer
                    .getChannelData(0);


            const pcm16 =
                float32ToPCM16(
                    input
                );


            const base64 =
                arrayBufferToBase64(
                    pcm16.buffer
                );


            realtimeSocket.send(
                JSON.stringify({

                    type:
                        "input_audio_buffer.append",

                    audio:
                        base64
                })
            );
        };


    audioSource.connect(
        processor
    );


    processor.connect(
        audioContext.destination
    );
}


// ==========================================
// FLOAT32 → PCM16
// ==========================================

function float32ToPCM16(float32Array) {

    const buffer =
        new Int16Array(
            float32Array.length
        );


    for (
        let i = 0;
        i < float32Array.length;
        i++
    ) {

        let sample =
            Math.max(
                -1,
                Math.min(
                    1,
                    float32Array[i]
                )
            );


        buffer[i] =
            sample < 0
                ? sample * 0x8000
                : sample * 0x7fff;
    }


    return buffer;
}


// ==========================================
// ARRAY BUFFER → BASE64
// ==========================================

function arrayBufferToBase64(buffer) {

    const bytes =
        new Uint8Array(
            buffer
        );


    let binary = "";


    const chunkSize =
        0x8000;


    for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
    ) {

        binary +=
            String.fromCharCode(
                ...bytes.subarray(
                    i,
                    Math.min(
                        i + chunkSize,
                        bytes.length
                    )
                )
            );
    }


    return btoa(binary);
}


// ==========================================
// STOP MICROPHONE
// ==========================================

function stopMicrophoneStreaming() {

    if (processor) {

        processor.disconnect();

        processor.onaudioprocess =
            null;

        processor = null;
    }


    if (audioSource) {

        audioSource.disconnect();

        audioSource = null;
    }


    if (audioContext) {

        audioContext.close();

        audioContext = null;
    }


    if (mediaStream) {

        mediaStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        mediaStream = null;
    }
}


// ==========================================
// START LISTENING
// ==========================================

async function startRecording() {

    if (
        isRecording ||
        isStopping
    ) {
        return;
    }


    try {

        isStopping =
            false;


        liveTranscript =
            "";

        finalTranscript =
            "";

        previousDetectedText =
            "";


        if (heardText) {

            heardText.innerHTML =
                "";
        }


        if (fillerCountElement) {

            fillerCountElement.textContent =
                "0";
        }


        if (wordCountElement) {

            wordCountElement.textContent =
                "0";
        }


        if (analyzeButton) {

            analyzeButton.disabled =
                true;
        }


        setStatus(
            "Connecting...",
            "listening"
        );


        showMessage(
            "🎤 Connecting to live transcription..."
        );


        await startRealtime();


        await startMicrophoneStreaming();


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
            "🎤 Listening... speak normally."
        );


    } catch (error) {

        console.error(
            "START ERROR:",
            error
        );


        stopMicrophoneStreaming();


        if (realtimeSocket) {

            try {
                realtimeSocket.close();
            } catch (e) {}
        }


        realtimeSocket =
            null;


        isRecording =
            false;


        listenButton.disabled =
            false;

        stopButton.disabled =
            true;


        setStatus(
            "Error",
            "error"
        );


        showMessage(
            error.message
        );
    }
}


// ==========================================
// STOP LISTENING
// ==========================================

async function stopRecording() {

    if (
        !isRecording ||
        isStopping
    ) {
        return;
    }


    isStopping =
        true;

    isRecording =
        false;


    listenButton.disabled =
        true;

    stopButton.disabled =
        true;


    setStatus(
        "Finishing...",
        "listening"
    );


    showMessage(
        "⏳ Finishing transcription..."
    );


    stopMicrophoneStreaming();


    // Give OpenAI a moment to send the
    // last transcription event.

    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                700
            )
    );


    if (realtimeSocket) {

        try {

            realtimeSocket.close();

        } catch (error) {

            console.log(
                "Socket close error."
            );
        }
    }


    realtimeSocket =
        null;


    finalTranscript =
        liveTranscript.trim();


    if (finalTranscript) {

        updateTranscript(
            finalTranscript
        );


        setStatus(
            "Finished",
            "ready"
        );


        showMessage(
            "✅ Transcription complete."
        );


        if (analyzeButton) {

            analyzeButton.disabled =
                false;
        }

    } else {

        setStatus(
            "No speech detected",
            "error"
        );


        showMessage(
            "I couldn't detect any speech."
        );
    }


    listenButton.disabled =
        false;


    isStopping =
        false;
}


// ==========================================
// ANALYZE SPEECH
// ==========================================

async function analyzeSpeech() {

    if (
        analysisInProgress ||
        !finalTranscript.trim()
    ) {
        return;
    }


    analysisInProgress =
        true;


    analyzeButton.disabled =
        true;


    if (analysisLoading) {

        analysisLoading.hidden =
            false;
    }


    if (analysisElement) {

        analysisElement.textContent =
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


        const data =
            await response.json();


        console.log(
            "Analysis response:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Analysis failed."
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
                `
                <strong>Analysis failed.</strong>
                <br><br>
                ${escapeHTML(error.message)}
                `;
        }

    } finally {

        analysisInProgress =
            false;


        analyzeButton.disabled =
            !finalTranscript.trim();


        if (analysisLoading) {

            analysisLoading.hidden =
                true;
        }
    }
}


// ==========================================
// FORMAT ANALYSIS
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
// STARTUP
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