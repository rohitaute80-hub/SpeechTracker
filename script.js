// ==========================================
// SPEECH TRACKER
// Microphone → AI Transcription → Filler Words
// → Red Highlighting → Phone Vibration
// ==========================================


// ==========================================
// ELEMENTS
// ==========================================

const statusText = document.getElementById("status");
const statusDot = document.getElementById("statusDot");
const heardText = document.getElementById("heard");

const listenButton = document.getElementById("listenButton");


// These elements are optional.
// The code will still work if your current HTML
// doesn't have them yet.

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


// ==========================================
// DEFAULT FILLER WORDS
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
// LOAD SAVED WORDS
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

let fillerCount = 0;

let totalWords = 0;


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

function showMessage(
    message
) {

    if (heardText) {

        heardText.textContent =
            message;

    }

}


// ==========================================
// SAVE WORDS
// ==========================================

function saveWords() {

    localStorage.setItem(
        "speechTrackerWords",
        JSON.stringify(
            trackedWords
        )
    );

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(
    text
) {

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

function escapeRegex(
    text
) {

    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}


// ==========================================
// RENDER CUSTOM WORDS
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

        trackedWords.push(
            word
        );

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
// CUSTOM WORD ENTER KEY
// ==========================================

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
// HIGHLIGHT TRACKED WORDS
// ==========================================

function highlightTrackedWords(
    text
) {

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
// COUNT FILLER WORDS
// ==========================================

function countTrackedWords(
    text
) {

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
                text.match(
                    regex
                );


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

function countTotalWords(
    text
) {

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

function displayTranscript(
    text
) {

    finalTranscript =
        text;


    fillerCount =
        countTrackedWords(
            text
        );


    totalWords =
        countTotalWords(
            text
        );


    if (heardText) {

        heardText.innerHTML =
            highlightTrackedWords(
                text
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


// ==========================================
// VIBRATION
// ==========================================

function vibrate() {

    if (
        typeof navigator.vibrate !==
        "function"
    ) {

        console.log(
            "Vibration is not supported."
        );

        return false;

    }


    navigator.vibrate(
        [150]
    );


    return true;

}


// ==========================================
// FIND FILLER WORDS
// ==========================================

function findTrackedWords(
    text
) {

    const matches = [];


    trackedWords.forEach(
        function(word) {

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
                    regex.exec(text))
                !== null
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
        function(a, b) {

            return (
                a.index -
                b.index
            );

        }
    );


    return matches;

}


// ==========================================
// VIBRATE FOR DETECTED WORDS
// ==========================================

async function vibrateForTrackedWords(
    text
) {

    const matches =
        findTrackedWords(
            text
        );


    console.log(
        "Tracked words:",
        matches
    );


    for (
        const match of matches
    ) {

        vibrate();


        await new Promise(
            function(resolve) {

                setTimeout(
                    resolve,
                    400
                );

            }
        );

    }

}


// ==========================================
// MICROPHONE SUPPORT CHECK
// ==========================================

function checkMicrophoneSupport() {

    if (
        !navigator.mediaDevices
    ) {

        return false;

    }


    if (
        !navigator.mediaDevices
            .getUserMedia
    ) {

        return false;

    }


    return true;

}


// ==========================================
// START RECORDING
// ==========================================

async function startRecording() {

    if (isRecording) {

        return;

    }


    // Check microphone support

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


        // Choose a supported recording format

        let mimeType =
            "";


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


        mediaRecorder.start(
            250
        );


        isRecording =
            true;


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
            "🎤 Listening... Press Stop when you're finished."
        );


    }

    catch (error) {

        console.error(
            "MICROPHONE ERROR:",
            error.name,
            error.message
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
        "🤖 AI is transcribing your speech..."
    );

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
// SEND RECORDING TO VERCEL API
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


        console.log(
            "Audio recorded:",
            audioBlob.size,
            "bytes"
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


        console.log(
            "Sending audio to AI..."
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
                        JSON.stringify({
                            audio:
                                base64Audio
                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            console.error(
                "API ERROR:",
                data
            );


            throw new Error(
                data.error ||
                "Transcription failed."
            );

        }


        console.log(
            "AI transcription:",
            data.transcript
        );


        if (
            !data.transcript
        ) {

            throw new Error(
                "The AI returned an empty transcript."
            );

        }


        displayTranscript(
            data.transcript
        );


        setStatus(
            "Finished",
            "ready"
        );


        await vibrateForTrackedWords(
            data.transcript
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


// ==========================================
// DEBUG INFORMATION
// ==========================================

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
    "Vibration:",
    typeof navigator.vibrate ===
    "function"
);