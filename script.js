/* =========================================================
   SPEECH TRACKER
   COMPLETE REPLACEMENT script.js
   =========================================================

   FEATURES
   ---------------------------------------------------------
   • Live browser speech recognition
   • Interim transcription
   • Automatic recognition restart
   • Filler word detection
   • Custom tracked words
   • Filler highlighting
   • Vibration
   • Browser notifications
   • MediaRecorder audio recording
   • OpenAI final transcription
   • OpenAI speech analysis
   • Recording timer
   • Word count
   • Filler count
   • Overall speech grade
   • Saved speeches
   • Save modal
   • Light / dark mode
   • LocalStorage persistence
========================================================= */


/* =========================================================
   1. ELEMENTS
========================================================= */

const heardElement =
    document.getElementById("heard");

const statusElement =
    document.getElementById("status");

const statusDot =
    document.getElementById("statusDot");

const recordingTimerElement =
    document.getElementById("recordingTimer");

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

const wordListElement =
    document.getElementById("wordList");

const resetWordsButton =
    document.getElementById("resetWordsButton");

const enableNotificationsButton =
    document.getElementById("enableNotifications");

const notificationStatusElement =
    document.getElementById("notificationStatus");

const analyzeButton =
    document.getElementById("analyzeButton");

const analysisLoadingElement =
    document.getElementById("analysisLoading");

const analysisElement =
    document.getElementById("analysis");

const savePrompt =
    document.getElementById("savePrompt");

const saveSpeechButton =
    document.getElementById("saveSpeechButton");

const discardSpeechButton =
    document.getElementById("discardSpeechButton");

const saveModal =
    document.getElementById("saveModal");

const speechNameInput =
    document.getElementById("speechNameInput");

const cancelSaveButton =
    document.getElementById("cancelSaveButton");

const confirmSaveButton =
    document.getElementById("confirmSaveButton");

const savedSpeechCountElement =
    document.getElementById("savedSpeechCount");

const savedSpeechesElement =
    document.getElementById("savedSpeeches");

const finalTranscriptElement =
    document.getElementById("finalTranscript");

const themeToggle =
    document.getElementById("themeToggle");

const themeColorMeta =
    document.getElementById("themeColor");

const scrollIndicator =
    document.getElementById("scrollIndicator");


/* =========================================================
   2. DEFAULT WORDS
========================================================= */

const DEFAULT_WORDS = [
    "um",
    "umm",
    "ummm",
    "ummmm",

    "uh",
    "uhh",
    "uhhh",
    "uhhhh",

    "like",
    "you know",
    "basically",
    "literally",
    "actually"
];


/* =========================================================
   3. STATE
========================================================= */

let customWords = [];

let trackedWords = [];

let recognition = null;

let recognitionSupported = false;

let recognitionRunning = false;

let shouldKeepRecognizing = false;

let mediaRecorder = null;

let mediaStream = null;

let audioChunks = [];

let isRecording = false;

let recordingStartTime = null;

let timerInterval = null;

let fillerCount = 0;

let wordCount = 0;

let currentFinalTranscript = "";

let currentInterimTranscript = "";

let lastRecognizedText = "";

let recognitionSessionId = 0;

let finalAudioBlob = null;

let savedSpeeches = [];

let notificationPermission = "default";

let pendingSpeechToSave = null;

let isStopping = false;


/* =========================================================
   4. STORAGE KEYS
========================================================= */

const STORAGE_KEYS = {
    words: "speechTrackerCustomWords",
    savedSpeeches: "speechTrackerSavedSpeeches",
    theme: "speechTrackerTheme"
};


/* =========================================================
   5. INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);


function initializeApp() {

    loadCustomWords();

    loadSavedSpeeches();

    initializeTheme();

    initializeSpeechRecognition();

    initializeEventListeners();

    updateStats();

    updateWordList();

    renderSavedSpeeches();

    updateNotificationStatus();

    updateOverallGrade();

    updateStatus("Ready");

    updateScrollIndicator();

    window.addEventListener(
        "scroll",
        updateScrollIndicator,
        { passive: true }
    );
}


/* =========================================================
   6. EVENT LISTENERS
========================================================= */

function initializeEventListeners() {

    if (listenButton) {
        listenButton.addEventListener(
            "click",
            startListening
        );
    }


    if (stopButton) {
        stopButton.addEventListener(
            "click",
            stopListening
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
            function(event) {

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
            requestNotifications
        );
    }


    if (analyzeButton) {

        analyzeButton.addEventListener(
            "click",
            analyzeSpeech
        );
    }


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
            function(event) {

                if (event.key === "Enter") {

                    event.preventDefault();

                    confirmSaveSpeech();
                }

                if (event.key === "Escape") {

                    event.preventDefault();

                    closeSaveModal();
                }
            }
        );
    }


    if (themeToggle) {

        themeToggle.addEventListener(
            "click",
            toggleTheme
        );
    }
}


/* =========================================================
   7. THEME
========================================================= */

function initializeTheme() {

    let savedTheme = null;

    try {
        savedTheme =
            localStorage.getItem(
                STORAGE_KEYS.theme
            );
    } catch (error) {
        console.warn(
            "Could not read saved theme.",
            error
        );
    }


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


function applyTheme(theme) {

    const isDark =
        theme === "dark";


    document.documentElement.setAttribute(
        "data-theme",
        isDark ? "dark" : "light"
    );


    document.body.classList.toggle(
        "dark",
        isDark
    );


    if (themeToggle) {

        themeToggle.textContent =
            isDark
                ? "Light"
                : "Dark";

        themeToggle.setAttribute(
            "aria-label",
            isDark
                ? "Switch to light mode"
                : "Switch to dark mode"
        );
    }


    if (themeColorMeta) {

        themeColorMeta.setAttribute(
            "content",
            isDark
                ? "#151614"
                : "#f5f3ed"
        );
    }


    try {

        localStorage.setItem(
            STORAGE_KEYS.theme,
            isDark
                ? "dark"
                : "light"
        );

    } catch (error) {

        console.warn(
            "Could not save theme.",
            error
        );
    }
}


function toggleTheme() {

    const currentTheme =
        document.documentElement.getAttribute(
            "data-theme"
        );


    const newTheme =
        currentTheme === "dark"
            ? "light"
            : "dark";


    applyTheme(newTheme);
}


/* =========================================================
   8. SPEECH RECOGNITION SETUP
========================================================= */

function initializeSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        recognitionSupported = false;

        console.warn(
            "Speech recognition is not supported in this browser."
        );

        return;
    }


    recognitionSupported = true;


    recognition =
        new SpeechRecognition();


    recognition.continuous = true;

    recognition.interimResults = true;

    recognition.lang = "en-US";


    /*
       Some browsers behave better when these
       are explicitly disabled.
    */

    recognition.maxAlternatives = 1;


    recognition.onstart = function() {

        recognitionRunning = true;

        updateStatus(
            "Listening",
            "active"
        );
    };


    recognition.onresult =
        handleRecognitionResult;


    recognition.onerror =
        handleRecognitionError;


    recognition.onend =
        handleRecognitionEnd;
}


/* =========================================================
   9. START LISTENING
========================================================= */

async function startListening() {

    if (isRecording) {
        return;
    }


    isStopping = false;

    shouldKeepRecognizing = true;

    recognitionSessionId++;


    /*
       Clear previous session
    */

    currentFinalTranscript = "";

    currentInterimTranscript = "";

    lastRecognizedText = "";

    fillerCount = 0;

    wordCount = 0;

    finalAudioBlob = null;

    audioChunks = [];


    updateStats();

    updateOverallGrade();


    if (finalTranscriptElement) {

        finalTranscriptElement.textContent =
            "Your completed speech will appear here.";
    }


    if (analysisElement) {

        analysisElement.innerHTML = "";
    }


    if (analyzeButton) {

        analyzeButton.disabled = true;
    }


    if (savePrompt) {

        savePrompt.hidden = true;
    }


    /*
       Start timer
    */

    startTimer();


    /*
       Start microphone recording
    */

    try {

        await startMediaRecorder();

    } catch (error) {

        console.warn(
            "MediaRecorder could not start:",
            error
        );
    }


    /*
       Start browser speech recognition
    */

    startRecognition();


    isRecording = true;

    updateRecordingButtons();

    updateStatus(
        "Listening",
        "active"
    );


    if (heardElement) {

        heardElement.innerHTML =
            '<span class="empty-state">Listening...</span>';
    }
}


/* =========================================================
   10. START RECOGNITION
========================================================= */

function startRecognition() {

    if (!recognitionSupported) {

        if (heardElement) {

            heardElement.innerHTML =
                '<span class="empty-state">' +
                "Live transcription is not supported " +
                "in this browser." +
                "</span>";
        }

        return;
    }


    if (!recognition) {
        initializeSpeechRecognition();
    }


    if (!recognition) {
        return;
    }


    if (recognitionRunning) {
        return;
    }


    try {

        recognition.start();

    } catch (error) {

        /*
           InvalidStateError usually means recognition
           is already starting. Don't crash the app.
        */

        console.warn(
            "Recognition start:",
            error
        );
    }
}


/* =========================================================
   11. RECOGNITION RESULT
========================================================= */

function handleRecognitionResult(event) {

    if (!isRecording) {
        return;
    }


    let interimText = "";

    let newlyFinalText = "";


    for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
    ) {

        const result =
            event.results[i];


        const transcript =
            result[0].transcript;


        if (result.isFinal) {

            newlyFinalText +=
                transcript + " ";

        } else {

            interimText +=
                transcript;
        }
    }


    if (newlyFinalText.trim()) {

        const cleanText =
            newlyFinalText.trim();


        /*
           Prevent duplicate chunks.
        */

        if (
            normalizeText(cleanText) !==
            normalizeText(lastRecognizedText)
        ) {

            currentFinalTranscript +=
                cleanText + " ";

            lastRecognizedText =
                cleanText;


            processSpeechText(
                cleanText
            );
        }
    }


    currentInterimTranscript =
        interimText;


    renderLiveTranscript();
}


/* =========================================================
   12. PROCESS SPEECH TEXT
========================================================= */

function processSpeechText(text) {

    if (!text) {
        return;
    }


    const normalized =
        normalizeText(text);


    /*
       Count words
    */

    const words =
        normalized
            .split(/\s+/)
            .filter(Boolean);


    wordCount +=
        words.length;


    /*
       Detect fillers
    */

    const detectedFillers =
        detectTrackedWords(text);


    if (detectedFillers.length > 0) {

        fillerCount +=
            detectedFillers.length;


        triggerFillerFeedback(
            detectedFillers
        );
    }


    updateStats();

    updateOverallGrade();
}


/* =========================================================
   13. DETECT TRACKED WORDS
========================================================= */

function detectTrackedWords(text) {

    const detected = [];

    const lowerText =
        text.toLowerCase();


    for (
        const word of trackedWords
    ) {

        if (!word) {
            continue;
        }


        const escaped =
            escapeRegExp(word);


        /*
           Word boundary detection.
           This prevents "um" from being
           detected inside unrelated words.
        */

        const regex =
            new RegExp(
                "(^|\\s|[^a-zA-Z])" +
                escaped +
                "(?=$|\\s|[^a-zA-Z])",
                "gi"
            );


        const matches =
            lowerText.match(regex);


        if (matches) {

            for (
                let i = 0;
                i < matches.length;
                i++
            ) {

                detected.push(word);
            }
        }
    }


    return detected;
}


/* =========================================================
   14. LIVE TRANSCRIPT RENDERING
========================================================= */

function renderLiveTranscript() {

    if (!heardElement) {
        return;
    }


    const finalText =
        currentFinalTranscript.trim();


    const interimText =
        currentInterimTranscript.trim();


    if (
        !finalText &&
        !interimText
    ) {

        heardElement.innerHTML =
            '<span class="empty-state">' +
            "Listening..." +
            "</span>";

        return;
    }


    let html = "";


    if (finalText) {

        html +=
            highlightTrackedWords(
                escapeHTML(finalText)
            );
    }


    if (interimText) {

        if (finalText) {
            html += " ";
        }


        html +=
            '<span class="interim-text">' +
            highlightTrackedWords(
                escapeHTML(interimText)
            ) +
            "</span>";
    }


    heardElement.innerHTML =
        html;
}


/* =========================================================
   15. HIGHLIGHT TRACKED WORDS
========================================================= */

function highlightTrackedWords(htmlText) {

    if (!htmlText) {
        return "";
    }


    let output =
        htmlText;


    /*
       Long phrases first.
       Example:
       "you know" before "you".
    */

    const sortedWords =
        [...trackedWords]
            .filter(Boolean)
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    for (
        const word of sortedWords
    ) {

        const escaped =
            escapeRegExp(
                escapeHTML(word)
            );


        const regex =
            new RegExp(
                "(^|\\s|[^a-zA-Z])" +
                "(" +
                escaped +
                ")" +
                "(?=$|\\s|[^a-zA-Z])",
                "gi"
            );


        output =
            output.replace(
                regex,
                function(
                    match,
                    prefix,
                    actualWord
                ) {

                    return (
                        prefix +
                        '<span class="filler-highlight">' +
                        actualWord +
                        "</span>"
                    );
                }
            );
    }


    return output;
}


/* =========================================================
   16. RECOGNITION ERROR
========================================================= */

function handleRecognitionError(event) {

    console.warn(
        "Speech recognition error:",
        event.error
    );


    recognitionRunning = false;


    /*
       These errors do not necessarily mean
       the entire session should stop.
    */

    const recoverableErrors = [
        "no-speech",
        "aborted",
        "audio-capture"
    ];


    if (
        isRecording &&
        shouldKeepRecognizing &&
        recoverableErrors.includes(
            event.error
        )
    ) {

        updateStatus(
            "Listening",
            "active"
        );


        setTimeout(
            function() {

                if (
                    isRecording &&
                    shouldKeepRecognizing
                ) {

                    startRecognition();
                }

            },
            350
        );

        return;
    }


    if (
        event.error ===
        "not-allowed"
    ) {

        updateStatus(
            "Microphone blocked",
            "error"
        );

        shouldKeepRecognizing = false;

        return;
    }


    updateStatus(
        "Listening",
        "active"
    );
}


/* =========================================================
   17. RECOGNITION END
========================================================= */

function handleRecognitionEnd() {

    recognitionRunning = false;


    /*
       Chrome and Safari can randomly end
       continuous recognition.
       Automatically restart it while recording.
    */

    if (
        isRecording &&
        shouldKeepRecognizing &&
        !isStopping
    ) {

        setTimeout(
            function() {

                if (
                    isRecording &&
                    shouldKeepRecognizing &&
                    !recognitionRunning
                ) {

                    startRecognition();
                }

            },
            250
        );

    } else {

        updateStatus(
            isRecording
                ? "Listening"
                : "Ready"
        );
    }
}


/* =========================================================
   18. STOP LISTENING
========================================================= */

async function stopListening() {

    if (!isRecording) {
        return;
    }


    isStopping = true;

    shouldKeepRecognizing = false;

    isRecording = false;


    /*
       Stop recognition
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


    recognitionRunning = false;


    /*
       Stop timer
    */

    stopTimer();


    /*
       Stop audio recording
    */

    try {

        finalAudioBlob =
            await stopMediaRecorder();

    } catch (error) {

        console.warn(
            "Could not stop MediaRecorder:",
            error
        );
    }


    updateRecordingButtons();

    updateStatus(
        "Processing",
        "active"
    );


    /*
       Give the browser a moment to deliver
       the final recognition result.
    */

    await wait(300);


    /*
       If we have audio, send it to the
       transcription API.
    */

    if (finalAudioBlob) {

        try {

            const apiTranscript =
                await transcribeAudio(
                    finalAudioBlob
                );


            if (
                apiTranscript &&
                apiTranscript.trim()
            ) {

                currentFinalTranscript =
                    apiTranscript.trim();


                /*
                   Recalculate statistics
                   from the final transcript.
                */

                recalculateStatsFromTranscript(
                    currentFinalTranscript
                );
            }

        } catch (error) {

            console.warn(
                "Final transcription failed:",
                error
            );

            /*
               Keep browser transcription
               instead of deleting it.
            */
        }
    }


    /*
       Display final transcript
    */

    renderFinalTranscript();


    updateStats();

    updateOverallGrade();


    if (
        currentFinalTranscript.trim()
    ) {

        if (analyzeButton) {

            analyzeButton.disabled =
                false;
        }


        if (savePrompt) {

            savePrompt.hidden =
                false;
        }

    } else {

        if (analyzeButton) {

            analyzeButton.disabled =
                true;
        }
    }


    updateStatus(
        "Ready"
    );


    isStopping = false;
}


/* =========================================================
   19. MEDIA RECORDER
========================================================= */

async function startMediaRecorder() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        throw new Error(
            "Microphone API is not available."
        );
    }


    mediaStream =
        await navigator.mediaDevices.getUserMedia({
            audio: true
        });


    audioChunks = [];


    let mimeType = "";


    const possibleTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus"
    ];


    if (
        window.MediaRecorder &&
        MediaRecorder.isTypeSupported
    ) {

        for (
            const type of possibleTypes
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
    }


    if (mimeType) {

        mediaRecorder =
            new MediaRecorder(
                mediaStream,
                { mimeType }
            );

    } else {

        mediaRecorder =
            new MediaRecorder(
                mediaStream
            );
    }


    mediaRecorder.ondataavailable =
        function(event) {

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
        function(event) {

            console.warn(
                "MediaRecorder error:",
                event
            );
        };


    mediaRecorder.start(
        250
    );
}


/* =========================================================
   20. STOP MEDIA RECORDER
========================================================= */

function stopMediaRecorder() {

    return new Promise(
        function(resolve) {

            if (!mediaRecorder) {

                cleanupMediaStream();

                resolve(null);

                return;
            }


            if (
                mediaRecorder.state ===
                "inactive"
            ) {

                const blob =
                    createAudioBlob();


                cleanupMediaStream();

                resolve(blob);

                return;
            }


            mediaRecorder.onstop =
                function() {

                    const blob =
                        createAudioBlob();


                    cleanupMediaStream();

                    resolve(blob);
                };


            try {

                mediaRecorder.stop();

            } catch (error) {

                console.warn(
                    "MediaRecorder stop error:",
                    error
                );


                const blob =
                    createAudioBlob();


                cleanupMediaStream();

                resolve(blob);
            }
        }
    );
}


/* =========================================================
   21. CREATE AUDIO BLOB
========================================================= */

function createAudioBlob() {

    if (
        !audioChunks ||
        audioChunks.length === 0
    ) {

        return null;
    }


    const mimeType =
        mediaRecorder &&
        mediaRecorder.mimeType
            ? mediaRecorder.mimeType
            : "audio/webm";


    return new Blob(
        audioChunks,
        {
            type: mimeType
        }
    );
}


/* =========================================================
   22. CLEAN UP MICROPHONE
========================================================= */

function cleanupMediaStream() {

    if (mediaStream) {

        mediaStream
            .getTracks()
            .forEach(
                function(track) {

                    track.stop();
                }
            );
    }


    mediaStream = null;

    mediaRecorder = null;
}


/* =========================================================
   23. FINAL OPENAI TRANSCRIPTION
========================================================= */

async function transcribeAudio(
    audioBlob
) {

    if (!audioBlob) {
        return "";
    }


    const formData =
        new FormData();


    const extension =
        audioBlob.type.includes("mp4")
            ? "speech.mp4"
            : "speech.webm";


    formData.append(
        "file",
        audioBlob,
        extension
    );


    const response =
        await fetch(
            "/api/transcribe",
            {
                method: "POST",
                body: formData
            }
        );


    if (!response.ok) {

        const errorText =
            await response.text();


        throw new Error(
            "Transcription API error " +
            response.status +
            ": " +
            errorText
        );
    }


    const data =
        await response.json();


    /*
       Support several possible response
       formats from the API.
    */

    return (
        data.text ||
        data.transcript ||
        data.result ||
        data.output ||
        ""
    );
}


/* =========================================================
   24. RECALCULATE STATS
========================================================= */

function recalculateStatsFromTranscript(
    transcript
) {

    const cleanTranscript =
        transcript.trim();


    if (!cleanTranscript) {

        fillerCount = 0;

        wordCount = 0;

        return;
    }


    const words =
        cleanTranscript
            .split(/\s+/)
            .filter(Boolean);


    wordCount =
        words.length;


    fillerCount =
        countTrackedWords(
            cleanTranscript
        );
}


/* =========================================================
   25. COUNT TRACKED WORDS
========================================================= */

function countTrackedWords(
    text
) {

    let count = 0;


    for (
        const word of trackedWords
    ) {

        if (!word) {
            continue;
        }


        const regex =
            new RegExp(
                "(^|\\s|[^a-zA-Z])" +
                escapeRegExp(word) +
                "(?=$|\\s|[^a-zA-Z])",
                "gi"
            );


        const matches =
            text.match(regex);


        if (matches) {

            count +=
                matches.length;
        }
    }


    return count;
}


/* =========================================================
   26. FINAL TRANSCRIPT DISPLAY
========================================================= */

function renderFinalTranscript() {

    if (!finalTranscriptElement) {
        return;
    }


    const transcript =
        currentFinalTranscript.trim();


    if (!transcript) {

        finalTranscriptElement.textContent =
            "No speech was detected.";

        return;
    }


    finalTranscriptElement.innerHTML =
        highlightTrackedWords(
            escapeHTML(transcript)
        );
}


/* =========================================================
   27. TIMER
========================================================= */

function startTimer() {

    stopTimer();


    recordingStartTime =
        Date.now();


    updateTimer();


    timerInterval =
        setInterval(
            updateTimer,
            250
        );
}


function updateTimer() {

    if (!recordingStartTime) {
        return;
    }


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


    if (recordingTimerElement) {

        recordingTimerElement.textContent =
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0");
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
   28. BUTTON STATES
========================================================= */

function updateRecordingButtons() {

    if (listenButton) {

        listenButton.disabled =
            isRecording;
    }


    if (stopButton) {

        stopButton.disabled =
            !isRecording;
    }
}


/* =========================================================
   29. STATUS
========================================================= */

function updateStatus(
    message,
    state = "ready"
) {

    if (statusElement) {

        statusElement.textContent =
            message;
    }


    if (statusDot) {

        statusDot.classList.remove(
            "ready",
            "active",
            "recording",
            "error"
        );


        if (state === "active") {

            statusDot.classList.add(
                "active"
            );

        } else if (state === "error") {

            statusDot.classList.add(
                "error"
            );

        } else {

            statusDot.classList.add(
                "ready"
            );
        }
    }
}


/* =========================================================
   30. STATS
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


    updateOverallGrade();
}


/* =========================================================
   31. OVERALL GRADE
========================================================= */

function calculateOverallGrade() {

    if (wordCount <= 0) {
        return null;
    }


    const fillerRate =
        (fillerCount / wordCount) * 100;


    let grade;


    if (fillerRate <= 1) {

        grade = "A+";

    } else if (fillerRate <= 2) {

        grade = "A";

    } else if (fillerRate <= 3) {

        grade = "A-";

    } else if (fillerRate <= 4) {

        grade = "B+";

    } else if (fillerRate <= 5) {

        grade = "B";

    } else if (fillerRate <= 7) {

        grade = "B-";

    } else if (fillerRate <= 9) {

        grade = "C+";

    } else if (fillerRate <= 11) {

        grade = "C";

    } else if (fillerRate <= 14) {

        grade = "C-";

    } else if (fillerRate <= 18) {

        grade = "D";

    } else {

        grade = "F";
    }


    return {
        grade,
        fillerRate
    };
}


function updateOverallGrade() {

    const gradeElement =
        document.getElementById(
            "overallGrade"
        );

    const descriptionElement =
        document.getElementById(
            "gradeDescription"
        );

    const fillerRateElement =
        document.getElementById(
            "gradeFillerRate"
        );

    const trackedElement =
        document.getElementById(
            "gradeTrackedWords"
        );

    const totalElement =
        document.getElementById(
            "gradeTotalWords"
        );


    if (!gradeElement) {
        return;
    }


    const result =
        calculateOverallGrade();


    if (!result) {

        gradeElement.textContent =
            "—";


        if (descriptionElement) {

            descriptionElement.textContent =
                "Complete a speech to receive your grade.";
        }


        if (fillerRateElement) {

            fillerRateElement.textContent =
                "—";
        }


        if (trackedElement) {

            trackedElement.textContent =
                "0";
        }


        if (totalElement) {

            totalElement.textContent =
                "0";
        }


        return;
    }


    gradeElement.textContent =
        result.grade;


    if (fillerRateElement) {

        fillerRateElement.textContent =
            result.fillerRate.toFixed(1) +
            "%";
    }


    if (trackedElement) {

        trackedElement.textContent =
            fillerCount;
    }


    if (totalElement) {

        totalElement.textContent =
            wordCount;
    }


    if (!descriptionElement) {
        return;
    }


    if (
        result.grade === "A+" ||
        result.grade === "A"
    ) {

        descriptionElement.textContent =
            "Excellent control of filler words. Your speech sounds confident and deliberate.";

    } else if (
        result.grade === "A-" ||
        result.grade === "B+"
    ) {

        descriptionElement.textContent =
            "Strong speech habits. A little more control could make your delivery even cleaner.";

    } else if (
        result.grade === "B" ||
        result.grade === "B-"
    ) {

        descriptionElement.textContent =
            "Good foundation. Focus on replacing filler words with intentional pauses.";

    } else if (
        result.grade === "C+" ||
        result.grade === "C" ||
        result.grade === "C-"
    ) {

        descriptionElement.textContent =
            "There is room to improve. Try slowing down and becoming more aware of your filler words.";

    } else {

        descriptionElement.textContent =
            "Your speech has a high filler-word rate. Practice short responses and intentional pauses.";
    }
}


/* =========================================================
   32. CUSTOM WORDS — LOAD
========================================================= */

function loadCustomWords() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEYS.words
            );


        if (saved) {

            const parsed =
                JSON.parse(saved);


            if (Array.isArray(parsed)) {

                customWords =
                    parsed
                        .filter(
                            word =>
                                typeof word ===
                                "string"
                        )
                        .map(
                            word =>
                                word.trim()
                        )
                        .filter(Boolean);
            }
        }

    } catch (error) {

        console.warn(
            "Could not load custom words.",
            error
        );

        customWords = [];
    }


    rebuildTrackedWords();
}


/* =========================================================
   33. REBUILD TRACKED WORDS
========================================================= */

function rebuildTrackedWords() {

    trackedWords = [
        ...DEFAULT_WORDS,
        ...customWords
    ]
        .map(
            word =>
                word.trim().toLowerCase()
        )
        .filter(Boolean);


    trackedWords =
        [...new Set(trackedWords)];
}


/* =========================================================
   34. SAVE CUSTOM WORDS
========================================================= */

function saveCustomWords() {

    try {

        localStorage.setItem(
            STORAGE_KEYS.words,
            JSON.stringify(
                customWords
            )
        );

    } catch (error) {

        console.warn(
            "Could not save custom words.",
            error
        );
    }
}


/* =========================================================
   35. ADD CUSTOM WORD
========================================================= */

function addCustomWord() {

    if (!customWordInput) {
        return;
    }


    const value =
        customWordInput.value
            .trim()
            .toLowerCase();


    if (!value) {
        return;
    }


    if (
        trackedWords.includes(
            value
        )
    ) {

        customWordInput.value = "";

        return;
    }


    customWords.push(value);


    saveCustomWords();

    rebuildTrackedWords();

    updateWordList();


    customWordInput.value = "";

    customWordInput.focus();
}


/* =========================================================
   36. REMOVE CUSTOM WORD
========================================================= */

function removeCustomWord(
    word
) {

    customWords =
        customWords.filter(
            item =>
                item !== word
        );


    saveCustomWords();

    rebuildTrackedWords();

    updateWordList();
}


/* =========================================================
   37. RESET CUSTOM WORDS
========================================================= */

function resetCustomWords() {

    customWords = [];

    saveCustomWords();

    rebuildTrackedWords();

    updateWordList();
}


/* =========================================================
   38. WORD LIST
========================================================= */

function updateWordList() {

    if (!wordListElement) {
        return;
    }


    wordListElement.innerHTML = "";


    if (
        customWords.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "empty-history";


        empty.textContent =
            "No custom words added yet.";


        wordListElement.appendChild(
            empty
        );


        return;
    }


    customWords.forEach(
        function(word) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "word-item";


            const text =
                document.createElement(
                    "span"
                );


            text.textContent =
                word;


            const removeButton =
                document.createElement(
                    "button"
                );


            removeButton.className =
                "remove-word";


            removeButton.type =
                "button";


            removeButton.textContent =
                "×";


            removeButton.setAttribute(
                "aria-label",
                "Remove " + word
            );


            removeButton.addEventListener(
                "click",
                function() {

                    removeCustomWord(
                        word
                    );
                }
            );


            item.appendChild(
                text
            );


            item.appendChild(
                removeButton
            );


            wordListElement.appendChild(
                item
            );
        }
    );
}


/* =========================================================
   39. NOTIFICATIONS
========================================================= */

async function requestNotifications() {

    if (
        !("Notification" in window)
    ) {

        if (
            notificationStatusElement
        ) {

            notificationStatusElement.textContent =
                "Notifications are not supported in this browser.";
        }

        return;
    }


    try {

        const permission =
            await Notification.requestPermission();


        notificationPermission =
            permission;


        updateNotificationStatus();


    } catch (error) {

        console.warn(
            "Notification permission error:",
            error
        );
    }
}


function updateNotificationStatus() {

    if (
        !notificationStatusElement
    ) {
        return;
    }


    if (
        !("Notification" in window)
    ) {

        notificationStatusElement.textContent =
            "Notifications are not supported in this browser.";

        return;
    }


    notificationPermission =
        Notification.permission;


    if (
        notificationPermission ===
        "granted"
    ) {

        notificationStatusElement.textContent =
            "Notifications are enabled.";

        if (enableNotificationsButton) {

            enableNotificationsButton.textContent =
                "Notifications Enabled";

            enableNotificationsButton.disabled =
                true;
        }

    } else if (
        notificationPermission ===
        "denied"
    ) {

        notificationStatusElement.textContent =
            "Notifications are blocked. Enable them in your browser settings.";

    } else {

        notificationStatusElement.textContent =
            "Notifications are not enabled.";
    }
}


/* =========================================================
   40. FILLER FEEDBACK
========================================================= */

function triggerFillerFeedback(
    detectedFillers
) {

    /*
       Vibration
    */

    vibrate();


    /*
       Visual flash
    */

    if (heardElement) {

        heardElement.classList.remove(
            "filler-detected"
        );


        void heardElement.offsetWidth;


        heardElement.classList.add(
            "filler-detected"
        );
    }


    /*
       Notification
    */

    if (
        notificationPermission ===
        "granted"
    ) {

        const unique =
            [...new Set(
                detectedFillers
            )];


        const message =
            unique.length === 1
                ? `"${unique[0]}" detected`
                : "Filler words detected";


        try {

            new Notification(
                "Speech Tracker",
                {
                    body: message,
                    silent: true
                }
            );

        } catch (error) {

            console.warn(
                "Could not create notification.",
                error
            );
        }
    }
}


/* =========================================================
   41. VIBRATION
========================================================= */

function vibrate() {

    try {

        if (
            "vibrate" in navigator
        ) {

            navigator.vibrate(
                80
            );
        }

    } catch (error) {

        console.warn(
            "Vibration unavailable.",
            error
        );
    }
}


/* =========================================================
   42. AI ANALYSIS
========================================================= */

async function analyzeSpeech() {

    const transcript =
        currentFinalTranscript.trim();


    if (!transcript) {
        return;
    }


    if (analyzeButton) {

        analyzeButton.disabled =
            true;
    }


    if (analysisLoadingElement) {

        analysisLoadingElement.hidden =
            false;
    }


    if (analysisElement) {

        analysisElement.innerHTML = "";
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
                            transcript,
                            fillerCount,
                            wordCount,
                            fillerRate:
                                wordCount > 0
                                    ? (
                                        fillerCount /
                                        wordCount *
                                        100
                                    )
                                    : 0
                        })
                }
            );


        if (!response.ok) {

            const errorText =
                await response.text();


            throw new Error(
                "Analysis API error " +
                response.status +
                ": " +
                errorText
            );
        }


        const data =
            await response.json();


        displayAnalysis(
            data
        );

    } catch (error) {

        console.error(
            "Speech analysis failed:",
            error
        );


        if (analysisElement) {

            analysisElement.innerHTML =
                `
                <div class="analysis-error">
                    We couldn't analyze this speech right now.
                    Please try again.
                </div>
                `;
        }

    } finally {

        if (analysisLoadingElement) {

            analysisLoadingElement.hidden =
                true;
        }


        if (analyzeButton) {

            analyzeButton.disabled =
                false;
        }
    }
}


/* =========================================================
   43. DISPLAY AI ANALYSIS
========================================================= */

function displayAnalysis(
    data
) {

    if (!analysisElement) {
        return;
    }


    /*
       Try to find a text response from
       several common API formats.
    */

    let analysisText =
        data.analysis ||
        data.text ||
        data.result ||
        data.output ||
        data.response ||
        "";


    /*
       If the API returns an object,
       format it nicely.
    */

    if (
        typeof analysisText !==
        "string"
    ) {

        analysisText =
            JSON.stringify(
                analysisText,
                null,
                2
            );
    }


    if (!analysisText) {

        /*
           Try formatting the whole
           response object.
        */

        analysisText =
            formatAnalysisObject(
                data
            );
    }


    if (!analysisText) {

        analysisElement.innerHTML =
            `
            <div class="analysis-error">
                The AI returned no analysis.
            </div>
            `;

        return;
    }


    /*
       If it looks like Markdown,
       render basic Markdown.
    */

    analysisElement.innerHTML =
        markdownToHTML(
            analysisText
        );
}


/* =========================================================
   44. FORMAT ANALYSIS OBJECT
========================================================= */

function formatAnalysisObject(
    data
) {

    if (!data) {
        return "";
    }


    const ignoredKeys = [
        "success",
        "status",
        "usage"
    ];


    const parts = [];


    Object.keys(data).forEach(
        function(key) {

            if (
                ignoredKeys.includes(
                    key
                )
            ) {
                return;
            }


            const value =
                data[key];


            if (
                value === null ||
                value === undefined
            ) {
                return;
            }


            const title =
                key
                    .replace(
                        /([A-Z])/g,
                        " $1"
                    )
                    .replace(
                        /^./,
                        char =>
                            char.toUpperCase()
                    );


            if (
                typeof value ===
                "object"
            ) {

                parts.push(
                    `### ${title}\n\n` +
                    "```json\n" +
                    JSON.stringify(
                        value,
                        null,
                        2
                    ) +
                    "\n```"
                );

            } else {

                parts.push(
                    `### ${title}\n\n${value}`
                );
            }
        }
    );


    return parts.join(
        "\n\n"
    );
}


/* =========================================================
   45. SIMPLE MARKDOWN
========================================================= */

function markdownToHTML(
    markdown
) {

    let text =
        escapeHTML(
            markdown
        );


    /*
       Code blocks
    */

    text =
        text.replace(
            /```([\s\S]*?)```/g,
            function(
                match,
                code
            ) {

                return (
                    "<pre>" +
                    code +
                    "</pre>"
                );
            }
        );


    /*
       Headings
    */

    text =
        text.replace(
            /^### (.*)$/gm,
            '<div class="analysis-section">' +
            "<h3>$1</h3>"
        );


    text =
        text.replace(
            /^## (.*)$/gm,
            '<div class="analysis-section">' +
            "<h3>$1</h3>"
        );


    text =
        text.replace(
            /^# (.*)$/gm,
            '<div class="analysis-section">' +
            "<h3>$1</h3>"
        );


    /*
       Bold
    */

    text =
        text.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    /*
       Italic
    */

    text =
        text.replace(
            /\*(.*?)\*/g,
            "<em>$1</em>"
        );


    /*
       Bullet points
    */

    text =
        text.replace(
            /^\s*[-•] (.*)$/gm,
            "<li>$1</li>"
        );


    /*
       Wrap consecutive list items.
    */

    text =
        text.replace(
            /(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs,
            "<ul>$1</ul>"
        );


    /*
       Paragraph breaks
    */

    text =
        text.replace(
            /\n{2,}/g,
            "</p><p>"
        );


    /*
       Single line breaks
    */

    text =
        text.replace(
            /\n/g,
            "<br>"
        );


    return (
        "<div class=\"analysis-content\">" +
        text +
        "</div>"
    );
}


/* =========================================================
   46. SAVE MODAL
========================================================= */

function openSaveModal() {

    if (
        !currentFinalTranscript.trim()
    ) {
        return;
    }


    pendingSpeechToSave = {
        transcript:
            currentFinalTranscript.trim(),

        fillerCount,

        wordCount,

        fillerRate:
            wordCount > 0
                ? (
                    fillerCount /
                    wordCount *
                    100
                )
                : 0,

        grade:
            calculateOverallGrade()
                ?.grade || "—"
    };


    if (speechNameInput) {

        speechNameInput.value = "";

        setTimeout(
            function() {

                speechNameInput.focus();

            },
            50
        );
    }


    if (saveModal) {

        saveModal.hidden =
            false;
    }
}


function closeSaveModal() {

    pendingSpeechToSave =
        null;


    if (saveModal) {

        saveModal.hidden =
            true;
    }
}


/* =========================================================
   47. CONFIRM SAVE
========================================================= */

function confirmSaveSpeech() {

    if (
        !pendingSpeechToSave
    ) {
        return;
    }


    let name =
        speechNameInput
            ? speechNameInput.value.trim()
            : "";


    if (!name) {

        name =
            "Speech " +
            (
                savedSpeeches.length + 1
            );
    }


    const speech = {

        id:
            Date.now().toString(),

        name,

        transcript:
            pendingSpeechToSave.transcript,

        fillerCount:
            pendingSpeechToSave.fillerCount,

        wordCount:
            pendingSpeechToSave.wordCount,

        fillerRate:
            pendingSpeechToSave.fillerRate,

        grade:
            pendingSpeechToSave.grade,

        createdAt:
            new Date().toISOString()
    };


    savedSpeeches.unshift(
        speech
    );


    saveSavedSpeeches();

    renderSavedSpeeches();

    closeSaveModal();


    if (savePrompt) {

        savePrompt.hidden =
            true;
    }
}


/* =========================================================
   48. DISCARD CURRENT SPEECH
========================================================= */

function discardCurrentSpeech() {

    currentFinalTranscript = "";

    currentInterimTranscript = "";

    fillerCount = 0;

    wordCount = 0;

    finalAudioBlob = null;

    lastRecognizedText = "";


    updateStats();

    updateOverallGrade();


    if (finalTranscriptElement) {

        finalTranscriptElement.textContent =
            "Your completed speech will appear here.";
    }


    if (heardElement) {

        heardElement.innerHTML =
            '<span class="empty-state">' +
            "Tap Listen and start speaking." +
            "</span>";
    }


    if (analysisElement) {

        analysisElement.innerHTML =
            "";
    }


    if (analyzeButton) {

        analyzeButton.disabled =
            true;
    }


    if (savePrompt) {

        savePrompt.hidden =
            true;
    }
}


/* =========================================================
   49. LOAD SAVED SPEECHES
========================================================= */

function loadSavedSpeeches() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEYS.savedSpeeches
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
            "Could not load saved speeches.",
            error
        );

        savedSpeeches = [];
    }
}


/* =========================================================
   50. SAVE SAVED SPEECHES
========================================================= */

function saveSavedSpeeches() {

    try {

        localStorage.setItem(
            STORAGE_KEYS.savedSpeeches,
            JSON.stringify(
                savedSpeeches
            )
        );

    } catch (error) {

        console.warn(
            "Could not save speeches.",
            error
        );
    }
}


/* =========================================================
   51. RENDER SAVED SPEECHES
========================================================= */

function renderSavedSpeeches() {

    if (!savedSpeechesElement) {
        return;
    }


    if (savedSpeechCountElement) {

        savedSpeechCountElement.textContent =
            savedSpeeches.length;
    }


    savedSpeechesElement.innerHTML = "";


    if (
        savedSpeeches.length === 0
    ) {

        savedSpeechesElement.innerHTML =
            `
            <div class="empty-history">
                No saved speeches yet.
            </div>
            `;

        return;
    }


    savedSpeeches.forEach(
        function(speech) {

            const container =
                document.createElement(
                    "div"
                );


            container.className =
                "saved-speech";


            const content =
                document.createElement(
                    "div"
                );


            content.className =
                "saved-speech-content";


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "saved-speech-name";


            name.textContent =
                speech.name ||
                "Untitled Speech";


            const date =
                document.createElement(
                    "div"
                );


            date.className =
                "saved-speech-date";


            date.textContent =
                formatDate(
                    speech.createdAt
                );


            const stats =
                document.createElement(
                    "div"
                );


            stats.className =
                "saved-speech-stats";


            stats.textContent =
                (
                    speech.grade ||
                    "—"
                ) +
                "  •  " +
                (
                    speech.fillerRate !==
                    undefined
                        ? Number(
                            speech.fillerRate
                        ).toFixed(1) +
                          "% filler"
                        : "—"
                ) +
                "  •  " +
                (
                    speech.wordCount ||
                    0
                ) +
                " words";


            content.appendChild(
                name
            );


            content.appendChild(
                date
            );


            content.appendChild(
                stats
            );


            const actions =
                document.createElement(
                    "div"
                );


            actions.className =
                "saved-speech-actions";


            const openButton =
                document.createElement(
                    "button"
                );


            openButton.type =
                "button";


            openButton.className =
                "saved-speech-open";


            openButton.textContent =
                "Open";


            openButton.addEventListener(
                "click",
                function() {

                    openSavedSpeech(
                        speech.id
                    );
                }
            );


            const deleteButton =
                document.createElement(
                    "button"
                );


            deleteButton.type =
                "button";


            deleteButton.className =
                "saved-speech-delete";


            deleteButton.textContent =
                "Delete";


            deleteButton.addEventListener(
                "click",
                function() {

                    deleteSavedSpeech(
                        speech.id
                    );
                }
            );


            actions.appendChild(
                openButton
            );


            actions.appendChild(
                deleteButton
            );


            container.appendChild(
                content
            );


            container.appendChild(
                actions
            );


            savedSpeechesElement.appendChild(
                container
            );
        }
    );
}


/* =========================================================
   52. OPEN SAVED SPEECH
========================================================= */

function openSavedSpeech(
    id
) {

    const speech =
        savedSpeeches.find(
            item =>
                item.id === id
        );


    if (!speech) {
        return;
    }


    currentFinalTranscript =
        speech.transcript || "";


    fillerCount =
        Number(
            speech.fillerCount || 0
        );


    wordCount =
        Number(
            speech.wordCount || 0
        );


    currentInterimTranscript = "";

    lastRecognizedText = "";


    renderFinalTranscript();

    updateStats();

    updateOverallGrade();


    if (analysisElement) {

        analysisElement.innerHTML =
            "";
    }


    if (analyzeButton) {

        analyzeButton.disabled =
            !currentFinalTranscript.trim();
    }


    /*
       Scroll to current speech.
    */

    if (
        finalTranscriptElement
    ) {

        finalTranscriptElement.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
}


/* =========================================================
   53. DELETE SAVED SPEECH
========================================================= */

function deleteSavedSpeech(
    id
) {

    savedSpeeches =
        savedSpeeches.filter(
            speech =>
                speech.id !== id
        );


    saveSavedSpeeches();

    renderSavedSpeeches();
}


/* =========================================================
   54. FORMAT DATE
========================================================= */

function formatDate(
    value
) {

    if (!value) {
        return "";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "";
    }


    return date.toLocaleDateString(
        undefined,
        {
            month: "short",
            day: "numeric",
            year: "numeric"
        }
    );
}


/* =========================================================
   55. SCROLL INDICATOR
========================================================= */

function updateScrollIndicator() {

    if (!scrollIndicator) {
        return;
    }


    if (
        window.scrollY > 100
    ) {

        scrollIndicator.style.opacity =
            "0";

    } else {

        scrollIndicator.style.opacity =
            "1";
    }
}


/* =========================================================
   56. UTILITY — ESCAPE HTML
========================================================= */

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


/* =========================================================
   57. UTILITY — ESCAPE REGEX
========================================================= */

function escapeRegExp(
    value
) {

    return String(value).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}


/* =========================================================
   58. UTILITY — NORMALIZE TEXT
========================================================= */

function normalizeText(
    text
) {

    return String(text)
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


/* =========================================================
   59. UTILITY — WAIT
========================================================= */

function wait(
    milliseconds
) {

    return new Promise(
        function(resolve) {

            setTimeout(
                resolve,
                milliseconds
            );
        }
    );
}


/* =========================================================
   60. VISIBILITY / PAGE EXIT SAFETY
========================================================= */

window.addEventListener(
    "beforeunload",
    function() {

        shouldKeepRecognizing =
            false;


        if (recognition) {

            try {

                recognition.stop();

            } catch (error) {
                // Ignore
            }
        }


        if (mediaRecorder) {

            try {

                if (
                    mediaRecorder.state !==
                    "inactive"
                ) {

                    mediaRecorder.stop();
                }

            } catch (error) {
                // Ignore
            }
        }


        cleanupMediaStream();

        stopTimer();
    }
);


/* =========================================================
   61. VISIBILITY CHANGE
========================================================= */

document.addEventListener(
    "visibilitychange",
    function() {

        /*
           Do not stop recognition just because
           the page becomes temporarily hidden.
           This helps with installed PWAs and
           mobile browsers.
        */

        if (
            document.visibilityState ===
            "visible" &&
            isRecording &&
            shouldKeepRecognizing &&
            !recognitionRunning
        ) {

            setTimeout(
                function() {

                    if (
                        isRecording &&
                        shouldKeepRecognizing &&
                        !recognitionRunning
                    ) {

                        startRecognition();
                    }

                },
                300
            );
        }
    }
);


/* =========================================================
   62. MICROPHONE PERMISSION HELPER
========================================================= */

async function checkMicrophonePermission() {

    if (
        !navigator.permissions ||
        !navigator.permissions.query
    ) {

        return null;
    }


    try {

        const permission =
            await navigator.permissions.query({
                name: "microphone"
            });


        return permission.state;

    } catch (error) {

        return null;
    }
}


/* =========================================================
   63. DEBUG INFORMATION
========================================================= */

window.SpeechTracker =
    {
        getState: function() {

            return {
                isRecording,
                recognitionSupported,
                recognitionRunning,
                fillerCount,
                wordCount,
                transcript:
                    currentFinalTranscript,
                trackedWords: [
                    ...trackedWords
                ],
                savedSpeeches:
                    savedSpeeches.length
            };
        },

        start: startListening,

        stop: stopListening,

        analyze: analyzeSpeech
    };


/* =========================================================
   64. FINAL INITIAL STATE
========================================================= */
 
updateRecordingButtons();

updateStats();

updateOverallGrade();

updateWordList();

renderSavedSpeeches();

updateNotificationStatus();