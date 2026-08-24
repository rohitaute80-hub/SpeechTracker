/* =========================================================
   SPEECH TRACKER
   COMPLETE script.js
   Matches the provided index.html exactly.

   FEATURES
   ---------------------------------------------------------
   • Live speech recognition
   • Live transcription
   • Final transcription
   • UM / UMM / UMMM / UMMMM detection
   • UH / UHH / UHHH / UHHHH detection
   • Custom tracked words
   • Duplicate filler protection
   • Vibration
   • Browser notifications
   • Recording timer
   • Word count
   • Filler count
   • OpenAI transcription
   • OpenAI AI analysis
   • Theme toggle
   • Saved speeches
   • Save speech modal
   • Delete saved speeches
   • Persistent localStorage
   ========================================================= */


/* =========================================================
   CONFIG
========================================================= */

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

const WORD_STORAGE_KEY = "speechTrackerCustomWords";
const SPEECH_STORAGE_KEY = "speechTrackerSavedSpeeches";
const THEME_STORAGE_KEY = "speechTrackerTheme";

const TRANSCRIBE_ENDPOINT = "/api/transcribe";
const ANALYZE_ENDPOINT = "/api/analyze";


/* =========================================================
   DOM ELEMENTS
========================================================= */

const statusDot =
    document.getElementById("statusDot");

const statusElement =
    document.getElementById("status");

const recordingTimer =
    document.getElementById("recordingTimer");

const heardElement =
    document.getElementById("heard");

const listenButton =
    document.getElementById("listenButton");

const stopButton =
    document.getElementById("stopButton");

const fillerCountElement =
    document.getElementById("fillerCount");

const wordCountElement =
    document.getElementById("wordCount");

const customWordInput =
    document.getElementById("customWordInput");

const addWordButton =
    document.getElementById("addWordButton");

const wordList =
    document.getElementById("wordList");

const resetWordsButton =
    document.getElementById("resetWordsButton");

const enableNotificationsButton =
    document.getElementById("enableNotifications");

const notificationStatus =
    document.getElementById("notificationStatus");

const analyzeButton =
    document.getElementById("analyzeButton");

const analysisLoading =
    document.getElementById("analysisLoading");

const analysisElement =
    document.getElementById("analysis");

const finalTranscriptElement =
    document.getElementById("finalTranscript");

const scrollIndicator =
    document.getElementById("scrollIndicator");

const themeToggle =
    document.getElementById("themeToggle");

const themeColorMeta =
    document.getElementById("themeColor");


/* Save prompt */

const savePrompt =
    document.getElementById("savePrompt");

const saveSpeechButton =
    document.getElementById("saveSpeechButton");

const discardSpeechButton =
    document.getElementById("discardSpeechButton");


/* Save modal */

const saveModal =
    document.getElementById("saveModal");

const speechNameInput =
    document.getElementById("speechNameInput");

const cancelSaveButton =
    document.getElementById("cancelSaveButton");

const confirmSaveButton =
    document.getElementById("confirmSaveButton");


/* Saved speeches */

const savedSpeechCount =
    document.getElementById("savedSpeechCount");

const savedSpeechesElement =
    document.getElementById("savedSpeeches");


/* =========================================================
   STATE
========================================================= */

let recognition = null;

let recognitionSupported = false;

let microphoneStream = null;

let mediaRecorder = null;

let audioChunks = [];

let isRecording = false;

let isStopping = false;

let recordingStartTime = null;

let timerInterval = null;

let liveTranscript = "";

let finalTranscript = "";

let fillerCount = 0;

let wordCount = 0;

let customWords = [];

let trackedWords = [...DEFAULT_WORDS];

let savedSpeeches = [];

let currentSpeech = null;

let detectedFillers = new Map();

let recognitionRestartTimeout = null;

let currentInterimTranscript = "";


/* =========================================================
   INITIALIZATION
========================================================= */

function initialize() {

    loadCustomWords();

    loadSavedSpeeches();

    loadTheme();

    renderWordList();

    renderSavedSpeeches();

    setupThemeToggle();

    setupButtons();

    setupSpeechRecognition();

    updateStats();

    updateNotificationStatus();

    updateButtonStates();

    updateAnalyzeButton();

    setupScrollIndicator();
}


/*
 * DOMContentLoaded is normally needed.
 * This script is at the bottom of the HTML,
 * but this also makes it safe if moved later.
 */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initialize
    );

} else {

    initialize();
}


/* =========================================================
   BUTTON SETUP
========================================================= */

function setupButtons() {

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


    if (addWordButton) {

        addWordButton.addEventListener(
            "click",
            addCustomWord
        );
    }


    if (customWordInput) {

        customWordInput.addEventListener(
            "keydown",
            function (event) {

                if (event.key === "Enter") {

                    event.preventDefault();

                    addCustomWord();
                }
            }
        );
    }


    if (resetWordsButton) {

        resetWordsButton.addEventListener(
            "click",
            resetCustomWords
        );
    }


    if (enableNotificationsButton) {

        enableNotificationsButton.addEventListener(
            "click",
            requestNotificationPermission
        );
    }


    if (analyzeButton) {

        analyzeButton.addEventListener(
            "click",
            analyzeSpeech
        );
    }


    /* Save prompt */

    if (saveSpeechButton) {

        saveSpeechButton.addEventListener(
            "click",
            openSaveModal
        );
    }


    if (discardSpeechButton) {

        discardSpeechButton.addEventListener(
            "click",
            discardCurrentSpeech
        );
    }


    /* Save modal */

    if (cancelSaveButton) {

        cancelSaveButton.addEventListener(
            "click",
            closeSaveModal
        );
    }


    if (confirmSaveButton) {

        confirmSaveButton.addEventListener(
            "click",
            confirmSaveSpeech
        );
    }


    if (speechNameInput) {

        speechNameInput.addEventListener(
            "keydown",
            function (event) {

                if (event.key === "Enter") {

                    event.preventDefault();

                    confirmSaveSpeech();
                }

                if (event.key === "Escape") {

                    closeSaveModal();
                }
            }
        );
    }
}


/* =========================================================
   THEME TOGGLE
========================================================= */

function setupThemeToggle() {

    if (!themeToggle) return;

    themeToggle.addEventListener(
        "click",
        toggleTheme
    );
}


function loadTheme() {

    let savedTheme = null;

    try {

        savedTheme =
            localStorage.getItem(
                THEME_STORAGE_KEY
            );

    } catch (error) {

        console.warn(
            "Could not load theme:",
            error
        );
    }


    /*
     * If the user has never selected a theme,
     * use the system preference.
     */

    if (
        savedTheme !== "dark" &&
        savedTheme !== "light"
    ) {

        savedTheme =
            window.matchMedia &&
            window.matchMedia(
                "(prefers-color-scheme: dark)"
            ).matches
                ? "dark"
                : "light";
    }


    applyTheme(savedTheme);
}


function toggleTheme() {

    const currentTheme =
        document.documentElement.getAttribute(
            "data-theme"
        ) || "light";


    const nextTheme =
        currentTheme === "dark"
            ? "light"
            : "dark";


    applyTheme(nextTheme);


    try {

        localStorage.setItem(
            THEME_STORAGE_KEY,
            nextTheme
        );

    } catch (error) {

        console.warn(
            "Could not save theme:",
            error
        );
    }
}


function applyTheme(theme) {

    if (theme !== "dark") {
        theme = "light";
    }


    document.documentElement.setAttribute(
        "data-theme",
        theme
    );


    /*
     * Some CSS files use .dark instead of
     * data-theme, so support that too.
     */

    document.body.classList.toggle(
        "dark",
        theme === "dark"
    );


    document.body.classList.toggle(
        "light",
        theme === "light"
    );


    if (themeToggle) {

        themeToggle.textContent =
            theme === "dark"
                ? "Light"
                : "Dark";

        themeToggle.setAttribute(
            "aria-label",
            theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
        );
    }


    if (themeColorMeta) {

        themeColorMeta.setAttribute(
            "content",
            theme === "dark"
                ? "#09090B"
                : "#ffffff"
        );
    }
}


/* =========================================================
   CUSTOM WORDS
========================================================= */

function loadCustomWords() {

    try {

        const saved =
            localStorage.getItem(
                WORD_STORAGE_KEY
            );


        if (saved) {

            const parsed =
                JSON.parse(saved);


            if (Array.isArray(parsed)) {

                customWords =
                    parsed
                        .map(
                            word =>
                                String(word)
                                    .trim()
                                    .toLowerCase()
                        )
                        .filter(Boolean);
            }
        }

    } catch (error) {

        console.warn(
            "Could not load custom words:",
            error
        );

        customWords = [];
    }


    rebuildTrackedWords();
}


function rebuildTrackedWords() {

    trackedWords = [
        ...DEFAULT_WORDS,
        ...customWords.filter(
            word =>
                !DEFAULT_WORDS.includes(word)
        )
    ];
}


function saveCustomWords() {

    try {

        localStorage.setItem(
            WORD_STORAGE_KEY,
            JSON.stringify(customWords)
        );

    } catch (error) {

        console.warn(
            "Could not save custom words:",
            error
        );
    }
}


function addCustomWord() {

    if (!customWordInput) return;


    const word =
        customWordInput.value
            .trim()
            .toLowerCase();


    if (!word) return;


    if (
        trackedWords.some(
            existing =>
                existing.toLowerCase() === word
        )
    ) {

        customWordInput.value = "";

        return;
    }


    customWords.push(word);

    rebuildTrackedWords();

    saveCustomWords();

    renderWordList();

    customWordInput.value = "";
}


function removeCustomWord(word) {

    customWords =
        customWords.filter(
            item => item !== word
        );

    rebuildTrackedWords();

    saveCustomWords();

    renderWordList();
}


function resetCustomWords() {

    customWords = [];

    rebuildTrackedWords();

    saveCustomWords();

    renderWordList();
}


function renderWordList() {

    if (!wordList) return;

    wordList.innerHTML = "";


    trackedWords.forEach(
        word => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "word-item";


            const wordText =
                document.createElement(
                    "span"
                );

            wordText.textContent =
                word;


            item.appendChild(
                wordText
            );


            /*
             * Only custom words get
             * a delete button.
             */

            if (
                customWords.includes(word)
            ) {

                const removeButton =
                    document.createElement(
                        "button"
                    );

                removeButton.type =
                    "button";

                removeButton.textContent =
                    "×";

                removeButton.className =
                    "remove-word";

                removeButton.setAttribute(
                    "aria-label",
                    `Remove ${word}`
                );


                removeButton.addEventListener(
                    "click",
                    function () {

                        removeCustomWord(
                            word
                        );
                    }
                );


                item.appendChild(
                    removeButton
                );
            }


            wordList.appendChild(
                item
            );
        }
    );
}


/* =========================================================
   SPEECH RECOGNITION SETUP
========================================================= */

function setupSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        recognitionSupported = false;

        console.warn(
            "SpeechRecognition is not supported."
        );

        setStatus(
            "Live transcription isn't supported in this browser.",
            false
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


    recognition.onstart =
        function () {

            if (!isRecording) return;

            setStatus(
                "Listening",
                true
            );
        };


    recognition.onresult =
        function (event) {

            if (!isRecording) return;


            let interim = "";

            let newFinalText = "";


            /*
             * IMPORTANT:
             * Process EVERY result from resultIndex.
             */

            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const result =
                    event.results[i];


                const transcript =
                    result[0]?.transcript ||
                    "";


                if (result.isFinal) {

                    newFinalText +=
                        transcript + " ";

                } else {

                    interim +=
                        transcript;
                }
            }


            /*
             * Add newly finalized speech.
             */

            if (newFinalText) {

                liveTranscript +=
                    newFinalText;

                liveTranscript =
                    liveTranscript
                        .replace(/\s+/g, " ")
                        .trim() + " ";


                detectFillers(
                    newFinalText
                );
            }


            currentInterimTranscript =
                interim;


            /*
             * THIS is the live transcription.
             *
             * It immediately shows:
             *
             * final speech + interim speech
             */

            const displayText =
                (
                    liveTranscript +
                    currentInterimTranscript
                ).trim();


            updateLiveTranscript(
                displayText
            );


            updateWordCount(
                displayText
            );
        };


    recognition.onerror =
        function (event) {

            console.warn(
                "Speech recognition error:",
                event.error
            );


            if (!isRecording) {
                return;
            }


            if (
                event.error ===
                "not-allowed"
            ) {

                setStatus(
                    "Microphone permission denied",
                    false
                );

                return;
            }


            if (
                event.error ===
                "service-not-allowed"
            ) {

                setStatus(
                    "Speech recognition unavailable",
                    false
                );

                return;
            }


            if (
                event.error ===
                "no-speech"
            ) {

                /*
                 * This is normal.
                 * Do not stop recording.
                 */

                return;
            }


            if (
                event.error ===
                "aborted"
            ) {

                return;
            }


            setStatus(
                "Listening",
                true
            );
        };


    recognition.onend =
        function () {

            /*
             * Chrome can randomly end recognition
             * even though recording is still active.
             *
             * Restart it.
             */

            if (
                isRecording &&
                !isStopping
            ) {

                clearTimeout(
                    recognitionRestartTimeout
                );


                recognitionRestartTimeout =
                    setTimeout(
                        function () {

                            if (
                                !isRecording
                            ) {
                                return;
                            }


                            try {

                                recognition.start();

                            } catch (error) {

                                /*
                                 * If it is already
                                 * running, ignore it.
                                 */

                                console.warn(
                                    "Recognition restart:",
                                    error
                                );
                            }

                        },
                        150
                    );
            }
        };
}


/* =========================================================
   START RECORDING
========================================================= */

async function startRecording() {

    if (isRecording) return;


    /*
     * Reset the current session.
     */

    resetCurrentSession();


    isRecording = true;

    isStopping = false;


    updateButtonStates();


    setStatus(
        "Starting",
        true
    );


    startTimer();


    /*
     * Ask for microphone permission.
     */

    try {

        microphoneStream =
            await navigator.mediaDevices.getUserMedia(
                {
                    audio: true
                }
            );

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );


        isRecording = false;

        stopTimer();

        updateButtonStates();


        setStatus(
            "Couldn't access microphone",
            false
        );


        return;
    }


    /*
     * Start MediaRecorder for the
     * final OpenAI transcription.
     */

    startMediaRecorder();


    /*
     * Start browser live recognition.
     */

    if (
        recognitionSupported &&
        recognition
    ) {

        try {

            recognition.start();

        } catch (error) {

            console.warn(
                "Could not start recognition:",
                error
            );
        }
    }


    setStatus(
        "Listening",
        true
    );


    /*
     * Hide previous save prompt.
     */

    hideSavePrompt();


    /*
     * Scroll down to the recording area
     * if appropriate.
     */

    if (
        scrollIndicator
    ) {

        scrollIndicator.style.display =
            "none";
    }
}


/* =========================================================
   MEDIA RECORDER
========================================================= */

function startMediaRecorder() {

    if (
        !window.MediaRecorder ||
        !microphoneStream
    ) {
        return;
    }


    try {

        const supportedTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4",
            "audio/ogg"
        ];


        let mimeType = "";


        for (
            const type of supportedTypes
        ) {

            if (
                MediaRecorder.isTypeSupported(
                    type
                )
            ) {

                mimeType = type;

                break;
            }
        }


        mediaRecorder =
            mimeType
                ? new MediaRecorder(
                    microphoneStream,
                    {
                        mimeType
                    }
                )
                : new MediaRecorder(
                    microphoneStream
                );


        audioChunks = [];


        mediaRecorder.ondataavailable =
            function (event) {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    audioChunks.push(
                        event.data
                    );
                }
            };


        mediaRecorder.onerror =
            function (event) {

                console.warn(
                    "MediaRecorder error:",
                    event
                );
            };


        mediaRecorder.start(
            1000
        );

    } catch (error) {

        console.warn(
            "MediaRecorder couldn't start:",
            error
        );

        mediaRecorder = null;
    }
}


/* =========================================================
   STOP RECORDING
========================================================= */

async function stopRecording() {

    if (
        !isRecording ||
        isStopping
    ) {
        return;
    }


    isStopping = true;

    isRecording = false;


    setStatus(
        "Processing",
        false
    );


    stopTimer();


    updateButtonStates();


    /*
     * Stop live recognition.
     */

    if (recognition) {

        try {

            recognition.stop();

        } catch (error) {

            console.warn(
                "Recognition stop:",
                error
            );
        }
    }


    clearTimeout(
        recognitionRestartTimeout
    );


    /*
     * Stop recorder and get audio.
     */

    const audioBlob =
        await stopMediaRecorder();


    /*
     * Stop microphone tracks.
     */

    if (microphoneStream) {

        microphoneStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        microphoneStream = null;
    }


    /*
     * Use live transcript immediately.
     */

    finalTranscript =
        liveTranscript.trim();


    updateLiveTranscript(
        finalTranscript
    );


    showFinalTranscript(
        finalTranscript
    );


    updateWordCount(
        finalTranscript
    );


    /*
     * If we have audio, send it to
     * OpenAI for a better final transcript.
     */

    if (audioBlob) {

        try {

            setStatus(
                "Transcribing",
                false
            );


            const aiTranscript =
                await transcribeAudio(
                    audioBlob
                );


            if (
                aiTranscript &&
                aiTranscript.trim()
            ) {

                finalTranscript =
                    aiTranscript.trim();


                showFinalTranscript(
                    finalTranscript
                );


                updateWordCount(
                    finalTranscript
                );


                /*
                 * Recalculate the final
                 * filler count using the
                 * more accurate transcript.
                 */

                recalculateFillerCount(
                    finalTranscript
                );
            }

        } catch (error) {

            console.error(
                "Final transcription failed:",
                error
            );


            /*
             * IMPORTANT:
             * We DON'T erase the live transcript
             * if OpenAI fails.
             */

            finalTranscript =
                liveTranscript.trim();


            showFinalTranscript(
                finalTranscript
            );


            updateWordCount(
                finalTranscript
            );
        }
    }


    /*
     * Enable AI analysis.
     */

    updateAnalyzeButton();


    /*
     * Show save prompt.
     */

    showSavePrompt();


    setStatus(
        "Finished",
        false
    );


    isStopping = false;

    updateButtonStates();
}


/* =========================================================
   STOP MEDIA RECORDER
========================================================= */

function stopMediaRecorder() {

    return new Promise(
        function (resolve) {

            if (!mediaRecorder) {

                resolve(null);

                return;
            }


            const recorder =
                mediaRecorder;


            recorder.onstop =
                function () {

                    try {

                        const blob =
                            new Blob(
                                audioChunks,
                                {
                                    type:
                                        recorder.mimeType ||
                                        "audio/webm"
                                }
                            );


                        mediaRecorder =
                            null;


                        resolve(blob);

                    } catch (error) {

                        console.error(
                            "Could not create audio blob:",
                            error
                        );


                        mediaRecorder =
                            null;


                        resolve(null);
                    }
                };


            try {

                if (
                    recorder.state !==
                    "inactive"
                ) {

                    recorder.stop();

                } else {

                    resolve(
                        new Blob(
                            audioChunks,
                            {
                                type:
                                    recorder.mimeType ||
                                    "audio/webm"
                            }
                        )
                    );

                    mediaRecorder =
                        null;
                }

            } catch (error) {

                console.warn(
                    "Recorder stop error:",
                    error
                );


                mediaRecorder =
                    null;


                resolve(null);
            }
        }
    );
}


/* =========================================================
   OPENAI TRANSCRIPTION
========================================================= */

async function transcribeAudio(
    audioBlob
) {

    if (!audioBlob) {
        return "";
    }


    let extension = "webm";


    if (
        audioBlob.type.includes(
            "mp4"
        )
    ) {

        extension = "mp4";

    } else if (
        audioBlob.type.includes(
            "ogg"
        )
    ) {

        extension = "ogg";
    }


    const audioFile =
        new File(
            [audioBlob],
            `speech.${extension}`,
            {
                type:
                    audioBlob.type ||
                    "audio/webm"
            }
        );


    const formData =
        new FormData();


    formData.append(
        "file",
        audioFile
    );


    const response =
        await fetch(
            TRANSCRIBE_ENDPOINT,
            {
                method: "POST",
                body: formData
            }
        );


    if (!response.ok) {

        const text =
            await response.text();


        throw new Error(
            `Transcription failed (${response.status}): ${text}`
        );
    }


    const data =
        await response.json();


    const transcript =
        data.text ||
        data.transcript ||
        data.result?.text ||
        data.result?.transcript ||
        "";


    if (!transcript) {

        throw new Error(
            "No transcript returned."
        );
    }


    return transcript.trim();
}


/* =========================================================
   LIVE TRANSCRIPTION DISPLAY
========================================================= */

function updateLiveTranscript(
    text
) {

    if (!heardElement) return;


    const cleaned =
        String(text || "").trim();


    if (!cleaned) {

        heardElement.innerHTML = `
            <span class="empty-state">
                Listening...
            </span>
        `;

        return;
    }


    /*
     * Escape HTML so spoken text cannot
     * inject markup into the page.
     */

    heardElement.innerHTML =
        highlightFillers(
            cleaned
        );
}


/* =========================================================
   HIGHLIGHT FILLERS
========================================================= */

function highlightFillers(text) {

    let result =
        escapeHTML(text);


    /*
     * Longest phrases first.
     */

    const sortedWords =
        [...trackedWords]
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    for (
        const word of sortedWords
    ) {

        if (!word.trim()) continue;


        /*
         * Special UM/UH patterns.
         */

        if (
            word === "um"
        ) {

            result =
                result.replace(
                    /\bum+\b/gi,
                    match =>
                        `<span class="filler-highlight">${escapeHTML(match)}</span>`
                );

            continue;
        }


        if (
            word === "uh"
        ) {

            result =
                result.replace(
                    /\buh+\b/gi,
                    match =>
                        `<span class="filler-highlight">${escapeHTML(match)}</span>`
                );

            continue;
        }


        const regex =
            new RegExp(
                `\\b${escapeRegex(word)}\\b`,
                "gi"
            );


        result =
            result.replace(
                regex,
                match =>
                    `<span class="filler-highlight">${escapeHTML(match)}</span>`
            );
    }


    return result;
}


/* =========================================================
   FILLER DETECTION
========================================================= */

function detectFillers(
    text
) {

    if (!text) return;


    const normalized =
        normalizeText(text);


    /*
     * Special UM/UH detection.
     */

    detectVariableFillers(
        normalized,
        "um"
    );


    detectVariableFillers(
        normalized,
        "uh"
    );


    /*
     * Normal tracked words.
     */

    const normalWords =
        trackedWords.filter(
            word =>
                word !== "um" &&
                word !== "uh"
        );


    for (
        const word of normalWords
    ) {

        const regex =
            new RegExp(
                `\\b${escapeRegex(word)}\\b`,
                "gi"
            );


        let match;


        while (
            (match = regex.exec(normalized))
            !== null
        ) {

            registerFiller(
                match[0]
            );
        }
    }
}


/* =========================================================
   VARIABLE UM / UH DETECTION
========================================================= */

function detectVariableFillers(
    text,
    base
) {

    /*
     * Only detect the variable versions
     * if the base or one of its variants
     * is being tracked.
     */

    const tracking =
        trackedWords.some(
            word =>
                word === base ||
                (
                    word.startsWith(base) &&
                    /^u[hm]+$/i.test(word)
                )
        );


    if (!tracking) return;


    const regex =
        base === "um"
            ? /\bum+\b/gi
            : /\buh+\b/gi;


    let match;


    while (
        (match = regex.exec(text))
        !== null
    ) {

        registerFiller(
            match[0]
        );
    }
}


/* =========================================================
   REGISTER FILLER
========================================================= */

function registerFiller(
    word
) {

    const normalized =
        String(word)
            .toLowerCase()
            .trim();


    const now =
        Date.now();


    const previous =
        detectedFillers.get(
            normalized
        ) || 0;


    /*
     * Prevent duplicate recognition events.
     */

    if (
        now - previous < 800
    ) {

        return;
    }


    detectedFillers.set(
        normalized,
        now
    );


    fillerCount++;


    updateStats();


    vibrate();


    sendNotification(
        normalized
    );


    showFillerFeedback();
}


/* =========================================================
   FINAL FILLER RECALCULATION
========================================================= */

function recalculateFillerCount(
    text
) {

    fillerCount = 0;


    if (!text) {

        updateStats();

        return;
    }


    const normalized =
        normalizeText(text);


    /*
     * UM
     */

    if (
        trackedWords.includes("um")
    ) {

        const matches =
            normalized.match(
                /\bum+\b/gi
            );


        if (matches) {

            fillerCount +=
                matches.length;
        }
    }


    /*
     * UH
     */

    if (
        trackedWords.includes("uh")
    ) {

        const matches =
            normalized.match(
                /\buh+\b/gi
            );


        if (matches) {

            fillerCount +=
                matches.length;
        }
    }


    /*
     * Other tracked words.
     */

    trackedWords
        .filter(
            word =>
                word !== "um" &&
                word !== "uh"
        )
        .forEach(
            word => {

                const regex =
                    new RegExp(
                        `\\b${escapeRegex(word)}\\b`,
                        "gi"
                    );


                const matches =
                    normalized.match(
                        regex
                    );


                if (matches) {

                    fillerCount +=
                        matches.length;
                }
            }
        );


    updateStats();
}


/* =========================================================
   WORD COUNT
========================================================= */

function updateWordCount(
    text
) {

    const cleaned =
        String(text || "")
            .trim();


    if (!cleaned) {

        wordCount = 0;

        updateStats();

        return;
    }


    wordCount =
        cleaned
            .split(/\s+/)
            .filter(Boolean)
            .length;


    updateStats();
}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

    if (fillerCountElement) {

        fillerCountElement.textContent =
            fillerCount;
    }


    if (wordCountElement) {

        wordCountElement.textContent =
            wordCount;
    }
}


/* =========================================================
   STATUS
========================================================= */

function setStatus(
    message,
    active
) {

    if (statusElement) {

        statusElement.textContent =
            message;
    }


    if (statusDot) {

        statusDot.classList.toggle(
            "ready",
            !active
        );


        statusDot.classList.toggle(
            "active",
            Boolean(active)
        );


        statusDot.classList.toggle(
            "recording",
            Boolean(active)
        );
    }
}


/* =========================================================
   BUTTON STATES
========================================================= */

function updateButtonStates() {

    if (listenButton) {

        listenButton.disabled =
            isRecording;
    }


    if (stopButton) {

        stopButton.disabled =
            !isRecording;
    }
}


function updateAnalyzeButton() {

    if (!analyzeButton) return;


    const hasTranscript =
        Boolean(
            finalTranscript &&
            finalTranscript.trim()
        );


    analyzeButton.disabled =
        !hasTranscript;
}


/* =========================================================
   RESET SESSION
========================================================= */

function resetCurrentSession() {

    fillerCount = 0;

    wordCount = 0;

    liveTranscript = "";

    finalTranscript = "";

    currentInterimTranscript = "";

    audioChunks = [];

    currentSpeech = null;

    detectedFillers.clear();


    if (heardElement) {

        heardElement.innerHTML = `
            <span class="empty-state">
                Listening...
            </span>
        `;
    }


    if (finalTranscriptElement) {

        finalTranscriptElement.textContent =
            "Your completed speech will appear here.";
    }


    if (analysisElement) {

        analysisElement.innerHTML = "";
    }


    if (analysisLoading) {

        analysisLoading.hidden = true;
    }


    hideSavePrompt();


    updateStats();

    updateAnalyzeButton();
}


/* =========================================================
   TIMER
========================================================= */

function startTimer() {

    recordingStartTime =
        Date.now();


    stopTimer();


    updateTimer();


    timerInterval =
        setInterval(
            updateTimer,
            250
        );
}


function updateTimer() {

    if (!recordingStartTime) return;


    const elapsed =
        Date.now() -
        recordingStartTime;


    const totalSeconds =
        Math.floor(
            elapsed / 1000
        );


    const minutes =
        Math.floor(
            totalSeconds / 60
        );


    const seconds =
        totalSeconds % 60;


    const formatted =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;


    if (recordingTimer) {

        recordingTimer.textContent =
            formatted;
    }
}


function stopTimer() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval = null;
    }
}


/* =========================================================
   VIBRATION
========================================================= */

function vibrate() {

    try {

        if (
            navigator &&
            typeof navigator.vibrate ===
                "function"
        ) {

            navigator.vibrate(
                [80, 40, 80]
            );
        }

    } catch (error) {

        console.warn(
            "Vibration unavailable:",
            error
        );
    }
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

async function requestNotificationPermission() {

    if (
        !("Notification" in window)
    ) {

        updateNotificationStatus(
            "Notifications aren't supported in this browser."
        );

        return;
    }


    try {

        const permission =
            await Notification.requestPermission();


        updateNotificationStatus();


        if (
            permission === "granted"
        ) {

            showNotification(
                "Speech Tracker",
                "Notifications are enabled."
            );
        }

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );
    }
}


function updateNotificationStatus(
    customMessage = null
) {

    if (!notificationStatus) return;


    if (customMessage) {

        notificationStatus.textContent =
            customMessage;

        return;
    }


    if (
        !("Notification" in window)
    ) {

        notificationStatus.textContent =
            "Notifications are not supported in this browser.";

        return;
    }


    const permission =
        Notification.permission;


    if (
        permission === "granted"
    ) {

        notificationStatus.textContent =
            "Notifications are enabled.";

    } else if (
        permission === "denied"
    ) {

        notificationStatus.textContent =
            "Notifications are blocked by your browser.";

    } else {

        notificationStatus.textContent =
            "Notifications are not enabled.";
    }
}


function sendNotification(
    word
) {

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


    showNotification(
        "Filler word detected",
        `"${word}"`
    );
}


function showNotification(
    title,
    body
) {

    try {

        new Notification(
            title,
            {
                body,
                tag:
                    "speech-tracker-" +
                    Date.now()
            }
        );

    } catch (error) {

        console.warn(
            "Could not show notification:",
            error
        );
    }
}


/* =========================================================
   FILLER VISUAL FEEDBACK
========================================================= */

function showFillerFeedback() {

    if (!heardElement) return;


    heardElement.classList.remove(
        "filler-detected"
    );


    /*
     * Force animation restart.
     */

    void heardElement.offsetWidth;


    heardElement.classList.add(
        "filler-detected"
    );


    setTimeout(
        function () {

            heardElement.classList.remove(
                "filler-detected"
            );

        },
        450
    );
}


/* =========================================================
   SAVE PROMPT
========================================================= */

function showSavePrompt() {

    if (!savePrompt) return;

    savePrompt.hidden = false;
}


function hideSavePrompt() {

    if (!savePrompt) return;

    savePrompt.hidden = true;
}


/* =========================================================
   SAVE MODAL
========================================================= */

function openSaveModal() {

    if (!finalTranscript.trim()) {
        return;
    }


    if (!saveModal) return;


    saveModal.hidden = false;


    if (speechNameInput) {

        speechNameInput.value = "";

        setTimeout(
            function () {

                speechNameInput.focus();

            },
            50
        );
    }
}


function closeSaveModal() {

    if (!saveModal) return;

    saveModal.hidden = true;
}


function confirmSaveSpeech() {

    if (!finalTranscript.trim()) {

        closeSaveModal();

        return;
    }


    let name =
        speechNameInput
            ? speechNameInput.value.trim()
            : "";


    if (!name) {

        name =
            "Speech " +
            new Date().toLocaleDateString();
    }


    const speech = {

        id:
            Date.now().toString(),

        name,

        transcript:
            finalTranscript.trim(),

        fillerCount,

        wordCount,

        duration:
            recordingStartTime
                ? Date.now() -
                  recordingStartTime
                : 0,

        date:
            new Date().toISOString()
    };


    savedSpeeches.unshift(
        speech
    );


    saveSavedSpeeches();

    renderSavedSpeeches();

    closeSaveModal();

    hideSavePrompt();
}


/* =========================================================
   DISCARD CURRENT SPEECH
========================================================= */

function discardCurrentSpeech() {

    currentSpeech = null;

    hideSavePrompt();

    finalTranscript = "";

    if (finalTranscriptElement) {

        finalTranscriptElement.textContent =
            "Your completed speech will appear here.";
    }


    updateAnalyzeButton();
}


/* =========================================================
   SAVED SPEECH STORAGE
========================================================= */

function loadSavedSpeeches() {

    try {

        const saved =
            localStorage.getItem(
                SPEECH_STORAGE_KEY
            );


        if (saved) {

            const parsed =
                JSON.parse(saved);


            if (Array.isArray(parsed)) {

                savedSpeeches =
                    parsed;
            }
        }

    } catch (error) {

        console.warn(
            "Could not load saved speeches:",
            error
        );

        savedSpeeches = [];
    }
}


function saveSavedSpeeches() {

    try {

        localStorage.setItem(
            SPEECH_STORAGE_KEY,
            JSON.stringify(
                savedSpeeches
            )
        );

    } catch (error) {

        console.warn(
            "Could not save speeches:",
            error
        );
    }
}


/* =========================================================
   RENDER SAVED SPEECHES
========================================================= */

function renderSavedSpeeches() {

    if (!savedSpeechesElement) {
        return;
    }


    if (savedSpeechCount) {

        savedSpeechCount.textContent =
            savedSpeeches.length;
    }


    if (
        savedSpeeches.length === 0
    ) {

        savedSpeechesElement.innerHTML = `
            <div class="empty-history">
                No saved speeches yet.
            </div>
        `;

        return;
    }


    savedSpeechesElement.innerHTML =
        "";


    savedSpeeches.forEach(
        speech => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "saved-speech";


            const date =
                formatDate(
                    speech.date
                );


            item.innerHTML = `
                <div class="saved-speech-content">

                    <div class="saved-speech-name">
                        ${escapeHTML(
                            speech.name
                        )}
                    </div>

                    <div class="saved-speech-date">
                        ${escapeHTML(date)}
                    </div>

                    <div class="saved-speech-stats">
                        ${speech.fillerCount || 0} tracked words
                        •
                        ${speech.wordCount || 0} total words
                    </div>

                </div>

                <div class="saved-speech-actions">

                    <button
                        type="button"
                        class="saved-speech-open"
                        data-id="${escapeHTML(
                            speech.id
                        )}"
                    >
                        Open
                    </button>

                    <button
                        type="button"
                        class="saved-speech-delete"
                        data-id="${escapeHTML(
                            speech.id
                        )}"
                    >
                        ×
                    </button>

                </div>
            `;


            savedSpeechesElement.appendChild(
                item
            );
        }
    );


    /*
     * Add event listeners after rendering.
     */

    savedSpeechesElement
        .querySelectorAll(
            ".saved-speech-open"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        openSavedSpeech(
                            button.dataset.id
                        );
                    }
                );
            }
        );


    savedSpeechesElement
        .querySelectorAll(
            ".saved-speech-delete"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        deleteSavedSpeech(
                            button.dataset.id
                        );
                    }
                );
            }
        );
}


/* =========================================================
   OPEN SAVED SPEECH
========================================================= */

function openSavedSpeech(
    id
) {

    const speech =
        savedSpeeches.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!speech) return;


    finalTranscript =
        speech.transcript || "";


    fillerCount =
        speech.fillerCount || 0;


    wordCount =
        speech.wordCount ||
        countWords(
            finalTranscript
        );


    showFinalTranscript(
        finalTranscript
    );


    updateStats();

    updateAnalyzeButton();


    /*
     * Scroll to transcript.
     */

    if (finalTranscriptElement) {

        finalTranscriptElement.scrollIntoView(
            {
                behavior: "smooth",
                block: "center"
            }
        );
    }
}


/* =========================================================
   DELETE SAVED SPEECH
========================================================= */

function deleteSavedSpeech(
    id
) {

    savedSpeeches =
        savedSpeeches.filter(
            speech =>
                String(speech.id) !==
                String(id)
        );


    saveSavedSpeeches();

    renderSavedSpeeches();
}


/* =========================================================
   AI ANALYSIS
========================================================= */

async function analyzeSpeech() {

    const transcript =
        finalTranscript.trim();


    if (!transcript) {

        return;
    }


    if (analysisLoading) {

        analysisLoading.hidden =
            false;
    }


    if (analyzeButton) {

        analyzeButton.disabled =
            true;
    }


    if (analysisElement) {

        analysisElement.innerHTML =
            "";
    }


    try {

        const response =
            await fetch(
                ANALYZE_ENDPOINT,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            transcript,
                            fillerCount,
                            wordCount,
                            trackedWords
                        })
                }
            );


        if (!response.ok) {

            const errorText =
                await response.text();


            throw new Error(
                `Analysis failed (${response.status}): ${errorText}`
            );
        }


        const data =
            await response.json();


        const analysis =
            extractAnalysis(
                data
            );


        if (!analysis) {

            throw new Error(
                "No analysis was returned."
            );
        }


        renderAnalysis(
            analysis
        );

    } catch (error) {

        console.error(
            "Analysis error:",
            error
        );


        if (analysisElement) {

            analysisElement.innerHTML = `
                <div class="analysis-error">
                    <strong>
                        Couldn't analyze your speech.
                    </strong>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>
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
                false;
        }
    }
}


/* =========================================================
   EXTRACT AI ANALYSIS
========================================================= */

function extractAnalysis(
    data
) {

    if (!data) {
        return null;
    }


    if (
        data.analysis !== undefined
    ) {

        if (
            typeof data.analysis ===
            "string"
        ) {

            return parseAnalysisString(
                data.analysis
            );
        }


        return data.analysis;
    }


    if (
        data.result !== undefined
    ) {

        if (
            typeof data.result ===
            "string"
        ) {

            return parseAnalysisString(
                data.result
            );
        }


        return data.result;
    }


    if (
        data.text !== undefined
    ) {

        if (
            typeof data.text ===
            "string"
        ) {

            return parseAnalysisString(
                data.text
            );
        }
    }


    /*
     * Some APIs return the JSON object
     * directly.
     */

    if (
        data.summary ||
        data.overview ||
        data.strengths ||
        data.improvements
    ) {

        return data;
    }


    return null;
}


/* =========================================================
   PARSE AI STRING
========================================================= */

function parseAnalysisString(
    text
) {

    if (!text) {
        return null;
    }


    let cleaned =
        String(text).trim();


    /*
     * Remove markdown code fences.
     */

    cleaned =
        cleaned
            .replace(
                /^```json\s*/i,
                ""
            )
            .replace(
                /^```\s*/i,
                ""
            )
            .replace(
                /\s*```$/i,
                ""
            )
            .trim();


    /*
     * Try direct JSON.
     */

    try {

        return JSON.parse(
            cleaned
        );

    } catch (error) {

        // Continue.
    }


    /*
     * Try extracting JSON from surrounding
     * text.
     */

    const firstBrace =
        cleaned.indexOf("{");


    const lastBrace =
        cleaned.lastIndexOf("}");


    if (
        firstBrace !== -1 &&
        lastBrace !== -1 &&
        lastBrace > firstBrace
    ) {

        const possibleJSON =
            cleaned.slice(
                firstBrace,
                lastBrace + 1
            );


        try {

            return JSON.parse(
                possibleJSON
            );

        } catch (error) {

            console.warn(
                "Could not parse AI JSON:",
                error
            );
        }
    }


    /*
     * If the AI returned normal prose,
     * display it instead of throwing an
     * invalid JSON error.
     */

    return {
        summary: cleaned
    };
}


/* =========================================================
   RENDER AI ANALYSIS
========================================================= */

function renderAnalysis(
    analysis
) {

    if (!analysisElement) {
        return;
    }


    if (
        typeof analysis ===
        "string"
    ) {

        analysisElement.innerHTML =
            formatPlainText(
                analysis
            );

        return;
    }


    let html = "";


    const summary =
        analysis.summary ||
        analysis.overview ||
        analysis.general_feedback;


    if (summary) {

        html += `
            <div class="analysis-section">

                <h3>
                    Overall
                </h3>

                <p>
                    ${escapeHTML(
                        String(summary)
                    )}
                </p>

            </div>
        `;
    }


    const sections = [

        {
            title: "What You Did Well",
            value:
                analysis.strengths ||
                analysis.positive ||
                analysis.what_you_did_well
        },

        {
            title: "Filler Words",
            value:
                analysis.filler_words ||
                analysis.fillerWords ||
                analysis.fillers
        },

        {
            title: "Clarity",
            value:
                analysis.clarity
        },

        {
            title: "Pacing",
            value:
                analysis.pacing
        },

        {
            title: "Delivery",
            value:
                analysis.delivery
        },

        {
            title: "Structure",
            value:
                analysis.structure ||
                analysis.organization
        },

        {
            title: "What to Improve",
            value:
                analysis.improvements ||
                analysis.areas_to_improve ||
                analysis.weaknesses ||
                analysis.suggestions
        },

        {
            title: "Next Steps",
            value:
                analysis.action_plan ||
                analysis.actionPlan ||
                analysis.next_steps
        }
    ];


    sections.forEach(
        section => {

            if (
                section.value ===
                undefined ||
                section.value ===
                null ||
                section.value === ""
            ) {
                return;
            }


            html += `
                <div class="analysis-section">

                    <h3>
                        ${escapeHTML(
                            section.title
                        )}
                    </h3>

                    ${renderAnalysisValue(
                        section.value
                    )}

                </div>
            `;
        }
    );


    /*
     * If the AI used completely different
     * keys, show all remaining data.
     */

    if (!html) {

        html =
            renderGenericObject(
                analysis
            );
    }


    analysisElement.innerHTML =
        html;
}


/* =========================================================
   RENDER ANALYSIS VALUE
========================================================= */

function renderAnalysisValue(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    if (
        Array.isArray(value)
    ) {

        return `
            <ul>
                ${value
                    .map(
                        item =>
                            `<li>${escapeHTML(
                                typeof item ===
                                    "object"
                                    ? JSON.stringify(
                                        item
                                    )
                                    : String(
                                        item
                                    )
                            )}</li>`
                    )
                    .join("")}
            </ul>
        `;
    }


    if (
        typeof value ===
        "object"
    ) {

        return renderGenericObject(
            value
        );
    }


    return `
        <p>
            ${escapeHTML(
                String(value)
            )}
        </p>
    `;
}


/* =========================================================
   GENERIC ANALYSIS OBJECT
========================================================= */

function renderGenericObject(
    object
) {

    if (
        !object ||
        typeof object !==
            "object"
    ) {

        return "";
    }


    let html = "";


    Object.entries(
        object
    ).forEach(
        ([key, value]) => {

            const title =
                key
                    .replace(
                        /_/g,
                        " "
                    )
                    .replace(
                        /\b\w/g,
                        letter =>
                            letter.toUpperCase()
                    );


            html += `
                <div class="analysis-subsection">

                    <h4>
                        ${escapeHTML(
                            title
                        )}
                    </h4>

                    ${renderAnalysisValue(
                        value
                    )}

                </div>
            `;
        }
    );


    return html;
}


/* =========================================================
   SCROLL INDICATOR
========================================================= */

function setupScrollIndicator() {

    if (!scrollIndicator) {
        return;
    }


    window.addEventListener(
        "scroll",
        function () {

            if (
                window.scrollY > 100
            ) {

                scrollIndicator.style.opacity =
                    "0";

            } else {

                scrollIndicator.style.opacity =
                    "1";
            }
        },
        {
            passive: true
        }
    );


    scrollIndicator.addEventListener(
        "click",
        function () {

            const recordingCard =
                document.querySelector(
                    ".recording-card"
                );


            if (recordingCard) {

                recordingCard.scrollIntoView(
                    {
                        behavior:
                            "smooth",
                        block:
                            "center"
                    }
                );
            }
        }
    );
}


/* =========================================================
   UTILITY FUNCTIONS
========================================================= */

function normalizeText(
    text
) {

    return String(text)
        .toLowerCase()
        .replace(
            /[“”]/g,
            '"'
        )
        .replace(
            /[‘’]/g,
            "'"
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


function escapeRegex(
    string
) {

    return String(string)
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
}


function escapeHTML(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function countWords(
    text
) {

    const cleaned =
        String(text || "")
            .trim();


    if (!cleaned) {
        return 0;
    }


    return cleaned
        .split(/\s+/)
        .filter(Boolean)
        .length;
}


function formatDate(
    dateString
) {

    try {

        const date =
            new Date(
                dateString
            );


        return date.toLocaleString(
            undefined,
            {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }
        );

    } catch (error) {

        return "";
    }
}


function formatPlainText(
    text
) {

    return String(text)
        .split(/\n+/)
        .filter(Boolean)
        .map(
            paragraph =>
                `<p>${escapeHTML(
                    paragraph.trim()
                )}</p>`
        )
        .join("");
}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    function () {

        clearTimeout(
            recognitionRestartTimeout
        );


        stopTimer();


        if (recognition) {

            try {

                recognition.stop();

            } catch (error) {

                // Ignore.
            }
        }


        if (microphoneStream) {

            microphoneStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }
    }
);


/* =========================================================
   PAGE VISIBILITY
========================================================= */

document.addEventListener(
    "visibilitychange",
    function () {

        /*
         * If Chrome/iOS temporarily ends recognition
         * while the page is hidden, restart it when
         * the user comes back.
         */

        if (
            document.visibilityState ===
                "visible" &&
            isRecording &&
            recognition &&
            !isStopping
        ) {

            try {

                recognition.start();

            } catch (error) {

                // Already running.
            }
        }
    }
);