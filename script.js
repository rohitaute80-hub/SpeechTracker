// ==========================================
// SPEECH TRACKER
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

let recognition = null;

let isListening = false;

let recognitionRunning = false;

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
// DISPLAY WORDS
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
// ADD WORD
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
        !trackedWords.includes(
            word
        )
    ) {

        trackedWords.push(
            word
        );

        saveWords();

        renderWords();

    }


    customWordInput.value =
        "";

    customWordInput.focus();

}


addWordButton.addEventListener(
    "click",
    addCustomWord
);


customWordInput.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key ===
            "Enter"
        ) {

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
                    escapeHTML(
                        word
                    )
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
// COUNT WORDS
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
// UPDATE TRANSCRIPT
// ==========================================

function updateTranscript(
    interim = ""
) {

    const combined =
        (
            finalTranscript +
            " " +
            interim
        ).trim();


    if (!combined) {

        heardText.textContent =
            isListening
                ? "Listening..."
                : "Your speech will appear here.";

    } else {

        heardText.innerHTML =
            highlightTrackedWords(
                combined
            );

    }


    totalWords =
        combined
            ? combined
                .split(/\s+/)
                .filter(Boolean)
                .length
            : 0;


    wordCountElement.textContent =
        totalWords;


    fillerCountElement.textContent =
        fillerCount;

}


// ==========================================
// BROWSER SPEECH RECOGNITION
// ==========================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


if (SpeechRecognition) {

    recognition =
        new SpeechRecognition();


    recognition.lang =
        "en-US";


    recognition.continuous =
        true;


    recognition.interimResults =
        true;


    recognition.maxAlternatives =
        1;


    // --------------------------------------
    // START
    // --------------------------------------

    recognition.onstart =
        function() {

            recognitionRunning =
                true;

            isListening =
                true;


            setStatus(
                "Listening...",
                "listening"
            );


            listenButton.disabled =
                true;

            stopButton.disabled =
                false;


            updateTranscript();

        };


    // --------------------------------------
    // RESULTS
    // --------------------------------------

    recognition.onresult =
        function(event) {

            let interim =
                "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const result =
                    event.results[i];


                const text =
                    result[0]
                        .transcript;


                if (
                    result.isFinal
                ) {

                    finalTranscript +=
                        text + " ";


                    const detected =
                        countTrackedWords(
                            text
                        );


                    fillerCount +=
                        detected;


                    // Vibrate on supported phones
                    if (
                        detected > 0 &&
                        navigator.vibrate
                    ) {

                        navigator.vibrate(
                            150
                        );

                    }

                } else {

                    interim +=
                        text;

                }

            }


            updateTranscript(
                interim
            );

        };


    // --------------------------------------
    // ERROR
    // --------------------------------------

    recognition.onerror =
        function(event) {

            console.error(
                "Speech recognition error:",
                event.error
            );


            if (
                event.error ===
                "not-allowed"
            ) {

                isListening =
                    false;


                setStatus(
                    "Microphone blocked",
                    "error"
                );


                heardText.textContent =
                    "Allow microphone access and try again.";


                listenButton.disabled =
                    false;


                stopButton.disabled =
                    true;


                return;

            }


            if (
                event.error ===
                "audio-capture"
            ) {

                isListening =
                    false;


                setStatus(
                    "Microphone unavailable",
                    "error"
                );


                heardText.textContent =
                    "Your microphone could not be accessed.";


                listenButton.disabled =
                    false;


                stopButton.disabled =
                    true;


                return;

            }


            if (
                event.error ===
                "no-speech"
            ) {

                return;

            }


            setStatus(
                "Speech error",
                "error"
            );

        };


    // --------------------------------------
    // END
    // --------------------------------------

    recognition.onend =
        function() {

            recognitionRunning =
                false;


            if (
                isListening
            ) {

                setTimeout(
                    function() {

                        if (
                            !isListening ||
                            recognitionRunning
                        ) {

                            return;

                        }


                        try {

                            recognition.start();

                        } catch {

                            // Ignore restart errors

                        }

                    },
                    250
                );

            }

        };

}


// ==========================================
// START
// ==========================================

listenButton.addEventListener(
    "click",
    function() {

        if (!recognition) {

            setStatus(
                "Speech unavailable",
                "error"
            );


            heardText.textContent =
                "Use Chrome or Edge for speech recognition.";

            return;

        }


        if (
            isListening ||
            recognitionRunning
        ) {

            return;

        }


        finalTranscript =
            "";

        fillerCount =
            0;

        totalWords =
            0;


        analysisElement.innerHTML =
            `<p class="info">
                Finish speaking to analyze your speech.
            </p>`;


        analyzeButton.disabled =
            true;


        isListening =
            true;


        updateTranscript();


        try {

            recognition.start();

        } catch {

            // Recognition may already be starting

        }

    }
);


// ==========================================
// STOP
// ==========================================

stopButton.addEventListener(
    "click",
    function() {

        isListening =
            false;


        recognitionRunning =
            false;


        if (recognition) {

            try {

                recognition.stop();

            } catch {}

        }


        setStatus(
            "Finished",
            "ready"
        );


        listenButton.disabled =
            false;


        stopButton.disabled =
            true;


        updateTranscript();


        // Enable AI analysis
        if (
            finalTranscript.trim()
        ) {

            analyzeButton.disabled =
                false;

        }

    }
);


// ==========================================
// AI ANALYSIS
// ==========================================

analyzeButton.addEventListener(
    "click",
    analyzeSpeech
);


async function analyzeSpeech() {

    const transcript =
        finalTranscript.trim();


    if (!transcript) {

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
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        transcript:
                            transcript,

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
                "AI analysis request failed."
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


        analysisElement.innerHTML =
            `<p class="info">
                AI analysis could not be completed.
                Make sure the /api/analyze endpoint
                is configured.
            </p>`;

    }


    analysisLoading.hidden =
        true;


    analyzeButton.disabled =
        false;

}


// ==========================================
// DISPLAY AI ANALYSIS
// ==========================================

function displayAnalysis(
    data
) {

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

            <h3>What You Did Well</h3>

            <p>
                ${escapeHTML(
                    data.strengths || ""
                )}
            </p>

        </div>


        <div class="analysis-section">

            <h3>What To Improve</h3>

            <p>
                ${escapeHTML(
                    data.improvements || ""
                )}
            </p>

        </div>


        <div class="analysis-section">

            <h3>Next Practice Goal</h3>

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