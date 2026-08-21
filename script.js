// ==========================================
// SPEECH TRACKER
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
// LOAD WORDS
// ==========================================

let savedWords =
    localStorage.getItem("speechTrackerWords");

let trackedWords;

try {

    trackedWords =
        savedWords
            ? JSON.parse(savedWords)
            : [...DEFAULT_WORDS];

    if (!Array.isArray(trackedWords)) {
        trackedWords = [...DEFAULT_WORDS];
    }

} catch (error) {

    trackedWords = [...DEFAULT_WORDS];

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

function setStatus(message, state) {

    statusText.textContent = message;

    statusDot.className =
        "dot " + (state || "ready");

}


// ==========================================
// SAVE WORDS
// ==========================================

function saveWords() {

    localStorage.setItem(
        "speechTrackerWords",
        JSON.stringify(trackedWords)
    );

}


// ==========================================
// RENDER WORDS
// ==========================================

function renderWords() {

    wordList.innerHTML = "";

    trackedWords.forEach(function(word, index) {

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

        remove.title =
            "Remove " + word;


        remove.addEventListener(
            "click",
            function() {

                trackedWords.splice(index, 1);

                saveWords();

                renderWords();

            }
        );


        tag.appendChild(text);

        tag.appendChild(remove);

        wordList.appendChild(tag);

    });

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


    if (!trackedWords.includes(word)) {

        trackedWords.push(word);

        saveWords();

        renderWords();

    }


    customWordInput.value = "";

    customWordInput.focus();

}


// ==========================================
// ADD BUTTON
// ==========================================

addWordButton.addEventListener(
    "click",
    addCustomWord
);


// ==========================================
// ENTER KEY
// ==========================================

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

    const element =
        document.createElement("div");

    element.textContent = text;

    return element.innerHTML;

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

function highlightTrackedWords(text) {

    let result =
        escapeHTML(text);


    const words =
        [...trackedWords].sort(
            function(a, b) {

                return b.length - a.length;

            }
        );


    words.forEach(function(word) {

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

    });


    return result;

}


// ==========================================
// COUNT TRACKED WORDS
// ==========================================

function countTrackedWords(text) {

    let count = 0;


    trackedWords.forEach(function(word) {

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
// UPDATE DISPLAY
// ==========================================

function updateTranscript(interim = "") {

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
            highlightTrackedWords(combined);

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
// SPEECH RECOGNITION
// ==========================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


// ==========================================
// BROWSER SUPPORT
// ==========================================

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


    // ======================================
    // START
    // ======================================

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


    // ======================================
    // RESULTS
    // ======================================

    recognition.onresult =
        function(event) {

            let interim = "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const result =
                    event.results[i];


                const text =
                    result[0].transcript;


                if (result.isFinal) {

                    finalTranscript +=
                        text + " ";


                    fillerCount +=
                        countTrackedWords(text);

                }

                else {

                    interim += text;

                }

            }


            updateTranscript(interim);

        };


    // ======================================
    // ERROR
    // ======================================

    recognition.onerror =
        function(event) {

            console.error(
                "Speech recognition error:",
                event.error
            );


            recognitionRunning =
                false;


            if (
                event.error ===
                "not-allowed"
            ) {

                isListening = false;

                setStatus(
                    "Microphone blocked",
                    "error"
                );


                heardText.textContent =
                    "Microphone access was blocked. Click the lock icon in your browser's address bar and allow the microphone.";

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

                isListening = false;

                setStatus(
                    "Microphone unavailable",
                    "error"
                );


                heardText.textContent =
                    "Your computer's microphone could not be accessed.";

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

                // Don't completely kill the session.
                return;

            }


            setStatus(
                "Speech error",
                "error"
            );


            heardText.textContent =
                "Speech recognition error: " +
                event.error;

        };


    // ======================================
    // END
    // ======================================

    recognition.onend =
        function() {

            recognitionRunning =
                false;


            // Restart automatically if the user
            // hasn't pressed Stop.
            if (isListening) {

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

                        }

                        catch(error) {

                            console.log(
                                "Could not restart recognition:",
                                error
                            );

                        }

                    },
                    250
                );

            }

            else {

                setStatus(
                    "Ready",
                    "ready"
                );

            }

        };

}


// ==========================================
// START BUTTON
// ==========================================

listenButton.addEventListener(
    "click",
    function() {

        // Browser doesn't support it
        if (!recognition) {

            setStatus(
                "Speech unavailable",
                "error"
            );


            heardText.textContent =
                "Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.";

            return;

        }


        // Already listening
        if (
            isListening ||
            recognitionRunning
        ) {

            return;

        }


        finalTranscript = "";

        fillerCount = 0;

        totalWords = 0;


        isListening = true;


        updateTranscript();


        try {

            recognition.start();

        }

        catch(error) {

            console.error(
                "Could not start recognition:",
                error
            );

        }

    }
);


// ==========================================
// STOP BUTTON
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

            }

            catch(error) {

                console.log(
                    "Recognition was not running."
                );

            }

        }


        setStatus(
            "Ready",
            "ready"
        );


        listenButton.disabled =
            false;


        stopButton.disabled =
            true;


        updateTranscript();

    }
);


// ==========================================
// INITIALIZE
// ==========================================

renderWords();

setStatus(
    "Ready",
    "ready"
);

updateTranscript();