// ==========================================
// SPEECH TRACKER
// AI TRANSCRIPTION + FILLER DETECTION
// + PHONE VIBRATION
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
// DEFAULT TRACKED WORDS
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
// LOAD CUSTOM WORDS
// ==========================================

let savedWords =
    localStorage.getItem(
        "speechTrackerWords"
    );

let trackedWords;

try {

    trackedWords =
        savedWords
            ? JSON.parse(savedWords)
            : [...DEFAULT_WORDS];

    if (!Array.isArray(trackedWords)) {

        trackedWords =
            [...DEFAULT_WORDS];

    }

} catch {

    trackedWords =
        [...DEFAULT_WORDS];

}


// ==========================================
// VARIABLES
// ==========================================

let mediaRecorder = null;

let audioChunks = [];

let audioStream = null;

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

    statusText.textContent =
        message;

    statusDot.className =
        "dot " + state;

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
// RENDER WORD LIST
// ==========================================

function renderWords() {

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

    const word =
        customWordInput.value
            .trim()
            .toLowerCase();


    if (!word) {

        customWordInput.focus();

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

    customWordInput.focus();

}


addWordButton.addEventListener(
    "click",
    addCustomWord
);


customWordInput.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Enter") {

            event.preventDefault();

            addCustomWord();

        }

    }
);


// ==========================================
// RESET WORDS
// ==========================================

resetWordsButton.addEventListener(
    "click",
    function() {

        trackedWords =
            [...DEFAULT_WORDS];

        saveWords();

        renderWords();

    }
);


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
// HIGHLIGHT TRACKED WORDS
// ==========================================

function highlightTrackedWords(
    text
) {

    let result =
        escapeHTML(text);


    const words =
        [...trackedWords].sort(
            function(a, b) {

                return (
                    b.length -
                    a.length
                );

            }
        );


    words.forEach(
        function(word) {

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
// UPDATE TRANSCRIPT
// ==========================================

function updateTranscript() {

    if (!finalTranscript) {

        heardText.textContent =
            "Your speech will appear here.";

        return;

    }


    heardText.innerHTML =
        highlightTrackedWords(
            finalTranscript
        );


    fillerCount =
        countTrackedWords(
            finalTranscript
        );


    totalWords =
        countTotalWords(
            finalTranscript
        );


    fillerCountElement.textContent =
        fillerCount;


    wordCountElement.textContent =
        totalWords;

}


// ==========================================
// VIBRATE
// ==========================================

function vibrate() {

    if (
        "vibrate" in navigator
    ) {

        navigator.vibrate(
            180
        );

        return true;

    }

    console.log(
        "This device/browser does not support vibration."
    );

    return false;

}


// ==========================================
// VIBRATE FOR EVERY DETECTED WORD
// ==========================================

async function vibrateForDetectedWords(
    text
) {

    const words =
        [];


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

                words.push({
                    word: word,
                    index: match.index
                });

            }

        }
    );


    words.sort(
        function(a, b) {

            return a.index - b.index;

        }
    );


    for (
        const item of words
    ) {

        vibrate();


        await new Promise(
            function(resolve) {

                setTimeout(
                    resolve,
                    350
                );

            }
        );

    }

}


// ==========================================
// START RECORDING
// ==========================================

listenButton.addEventListener(
    "click",
    async function() {

        if (isRecording) {

            return;

        }


        try {

            audioStream =
                await navigator.mediaDevices
                    .getUserMedia({
                        audio: true
                    });


            audioChunks = [];


            mediaRecorder =
                new MediaRecorder(
                    audioStream
                );


            mediaRecorder.ondataavailable =
                function(event) {

                    if (
                        event.data.size > 0
                    ) {

                        audioChunks.push(
                            event.data
                        );

                    }

                };


            mediaRecorder.onstop =
                async function() {

                    await processRecording();

                };


            mediaRecorder.start();

            isRecording = true;


            listenButton.disabled =
                true;


            stopButton.disabled =
                false;


            setStatus(
                "Recording...",
                "listening"
            );


            heardText.textContent =
                "Listening to your speech...";


            fillerCount = 0;

            totalWords = 0;


            fillerCountElement.textContent =
                "0";


            wordCountElement.textContent =
                "0";


        } catch (error) {

            console.error(
                error
            );


            setStatus(
                "Microphone error",
                "error"
            );


            heardText.textContent =
                "Could not access your microphone. Please allow microphone access.";

        }

    }
);


// ==========================================
// STOP RECORDING
// ==========================================

stopButton.addEventListener(
    "click",
    function() {

        if (
            !mediaRecorder ||
            !isRecording
        ) {

            return;

        }


        mediaRecorder.stop();

        isRecording = false;


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


        heardText.textContent =
            "🤖 AI is transcribing your speech...";

    }
);


// ==========================================
// SEND RECORDING TO AI
// ==========================================

async function processRecording() {

    try {

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
            0x8000;


        for (
            let i = 0;
            i < bytes.length;
            i += chunkSize
        ) {

            binary += String.fromCharCode(
                ...bytes.subarray(
                    i,
                    Math.min(
                        i + chunkSize,
                        bytes.length
                    )
                )
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


        if (!response.ok) {

            const error =
                await response.text();

            console.error(
                error
            );

            throw new Error(
                "Transcription failed"
            );

        }


        const data =
            await response.json();


        finalTranscript =
            data.transcript || "";


        updateTranscript();


        if (!finalTranscript) {

            setStatus(
                "No speech detected",
                "error"
            );


            heardText.textContent =
                "No speech was detected.";

            return;

        }


        setStatus(
            "Finished",
            "ready"
        );


        // Vibrate for every tracked word
        await vibrateForDetectedWords(
            finalTranscript
        );


        // Enable AI analysis
        if (analyzeButton) {

            analyzeButton.disabled =
                false;

        }


    } catch (error) {

        console.error(
            "Transcription error:",
            error
        );


        setStatus(
            "Transcription error",
            "error"
        );


        heardText.textContent =
            "Could not transcribe your speech. Check your API setup and try again.";

    }

}


// ==========================================
// AI SPEECH ANALYSIS
// ==========================================

if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );

}


async function analyzeSpeech() {

    if (!finalTranscript) {

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

                    body: JSON.stringify({

                        transcript:
                            finalTranscript,

                        trackedWords:
                            trackedWords,

                        fillerCount:
                            fillerCount,

                        wordCount:
                            totalWords

                    })

                }
            );


        if (!response.ok) {

            throw new Error(
                "Analysis failed"
            );

        }


        const data =
            await response.json();


        displayAnalysis(
            data
        );


    } catch (error) {

        console.error(
            error
        );


        if (analysisElement) {

            analysisElement.innerHTML =
                `<p>
                    AI analysis failed.
                    Check your API setup.
                </p>`;

        }

    }


    if (analysisLoading) {

        analysisLoading.hidden =
            true;

    }


    analyzeButton.disabled =
        false;

}


// ==========================================
// DISPLAY ANALYSIS
// ==========================================

function displayAnalysis(
    data
) {

    if (!analysisElement) {

        return;

    }


    analysisElement.innerHTML = `

        <div class="analysis-section">

            <h3>Overall</h3>

            <p>
                ${escapeHTML(
                    data.overall || ""
                )}
            </p>

        </div>


        <div class="analysis-section">

            <h3>Filler Words</h3>

            <p>
                ${escapeHTML(
                    data.fillerFeedback || ""
                )}
            </p>

        </div>


        <div class="analysis-section">

            <h3>Clarity</h3>

            <p>
                ${escapeHTML(
                    data.clarity || ""
                )}
            </p>

        </div>


        <div class="analysis-section">

            <h3>Pacing</h3>

            <p>
                ${escapeHTML(
                    data.pacing || ""
                )}
            </p>

        </div>


        <div class="analysis-section">

            <h3>Strengths</h3>

            <p>
                ${escapeHTML(
                    data.strengths || ""
                )}
            </p>

        </div>


        <div class="analysis-section">

            <h3>Improve</h3>

            <p>
                ${escapeHTML(
                    data.improvements || ""
                )}
            </p>

        </div>


        <div class="analysis-section">

            <h3>Next Goal</h3>

            <p>
                ${escapeHTML(
                    data.nextGoal || ""
                )}
            </p>

        </div>

    `;

}


// ==========================================
// STARTUP
// ==========================================

renderWords();

setStatus(
    "Ready",
    "ready"
);

updateTranscript();