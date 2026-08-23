/* =========================================================
   SPEECH TRACKER
   Complete replacement script.js
   ========================================================= */


/* =========================================================
   ELEMENTS
   ========================================================= */

const $ = (id) => document.getElementById(id);

const listenButton = $("listenButton");
const stopButton = $("stopButton");

const statusDot = $("statusDot");
const statusText = $("status");

const heard = $("heard");
const finalTranscriptElement = $("finalTranscript");

const fillerCountElement = $("fillerCount");
const wordCountElement = $("wordCount");

const recordingTimer = $("recordingTimer");

const customWordInput = $("customWordInput");
const addWordButton = $("addWordButton");
const resetWordsButton = $("resetWordsButton");
const wordList = $("wordList");

const enableNotificationsButton =
    $("enableNotifications");

const notificationStatus =
    $("notificationStatus");

const analyzeButton =
    $("analyzeButton");

const analysisLoading =
    $("analysisLoading");

const analysisElement =
    $("analysis");

const savedSpeechesElement =
    $("savedSpeeches");

const savedSpeechCount =
    $("savedSpeechCount");

const savePrompt =
    $("savePrompt");

const saveSpeechButton =
    $("saveSpeechButton");

const discardSpeechButton =
    $("discardSpeechButton");

const saveModal =
    $("saveModal");

const speechNameInput =
    $("speechNameInput");

const cancelSaveButton =
    $("cancelSaveButton");

const confirmSaveButton =
    $("confirmSaveButton");

const themeToggle =
    $("themeToggle");

const themeColor =
    $("themeColor");

const scrollIndicator =
    $("scrollIndicator");


/* =========================================================
   DEFAULT WORDS
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


/* =========================================================
   STATE
   ========================================================= */

let trackedWords = [];

let mediaRecorder = null;
let audioChunks = [];

let recognition = null;
let recognitionSupported = false;
let recognitionShouldRun = false;

let isRecording = false;
let isStopping = false;

let recordingStartTime = null;
let timerInterval = null;

let liveTranscript = "";
let finalTranscript = "";

let currentAnalysis = null;

let currentSessionFillerCount = 0;
let currentSessionWordCount = 0;

let currentSpeechId = null;


/*
    Every actual filler occurrence gets one detection ID.

    We DO NOT simply use the complete transcript as the key,
    because SpeechRecognition continuously changes interim
    results.

    Example:

        "I um"

        "I umm"

        "I ummmm"

    should all be ONE occurrence.
*/

const firedFillerOccurrences = new Set();


/*
    Used to prevent an interim result from immediately
    generating another notification.

    This is intentionally short because we want the
    notification to happen as soon as possible.
*/

const recentNotificationKeys = new Map();


/*
    Used to give each recording a clean detection session.
*/

let detectionSessionId = 0;


/*
    The last transcript that was scanned.

    We use this to focus detection on newly appearing
    interim speech instead of repeatedly processing the
    entire transcript.
*/

let lastDetectedTranscript = "";


/* =========================================================
   STORAGE
   ========================================================= */

const WORD_STORAGE_KEY =
    "speechTrackerWords";

const SPEECH_STORAGE_KEY =
    "speechTrackerSavedSpeeches";

const THEME_STORAGE_KEY =
    "speechTrackerTheme";


/* =========================================================
   WORD STORAGE
   ========================================================= */

function loadTrackedWords() {

    try {

        const saved =
            localStorage.getItem(
                WORD_STORAGE_KEY
            );

        if (saved) {

            const parsed =
                JSON.parse(saved);

            if (
                Array.isArray(parsed) &&
                parsed.length
            ) {

                trackedWords =
                    parsed;

                return;
            }
        }

    } catch (error) {

        console.error(
            "Could not load tracked words:",
            error
        );

    }

    trackedWords =
        [...DEFAULT_WORDS];

}


function saveTrackedWords() {

    try {

        localStorage.setItem(
            WORD_STORAGE_KEY,
            JSON.stringify(trackedWords)
        );

    } catch (error) {

        console.error(
            "Could not save tracked words:",
            error
        );

    }

}


/* =========================================================
   WORD NORMALIZATION
   ========================================================= */

function normalizeWord(word) {

    return String(word || "")
        .trim()
        .toLowerCase()
        .replace(/[^\w\s']/g, "")
        .replace(/\s+/g, " ");

}


/* =========================================================
   FILLER FAMILY
   ========================================================= */

function fillerFamily(word) {

    const normalized =
        normalizeWord(word);

    /*
        Treat every length of "um" as one family.

        um
        umm
        ummm
        ummmm
        ummmmm
        etc.
    */

    if (
        /^um+$/.test(normalized)
    ) {

        return "UM";

    }


    /*
        Same for "uh".

        uh
        uhh
        uhhh
        uhhhh
        etc.
    */

    if (
        /^uh+$/.test(normalized)
    ) {

        return "UH";

    }


    return normalized;

}


/* =========================================================
   REGEX ESCAPE
   ========================================================= */

function escapeRegex(text) {

    return String(text).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}


/* =========================================================
   BUILD FILLER REGEX
   ========================================================= */

function getFillerRegex() {

    const normalWords =
        [...trackedWords]
            .map(normalizeWord)
            .filter(Boolean)
            .filter(
                word =>
                    !/^um+$/.test(word) &&
                    !/^uh+$/.test(word)
            )
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    /*
        IMPORTANT:

        Do NOT escape the + in these two patterns.

        This allows:

        um
        umm
        ummm
        ummmm

        and:

        uh
        uhh
        uhhh
        uhhhh

        to all match.
    */

    const patterns = [
        "um+",
        "uh+",
        ...normalWords.map(
            escapeRegex
        )
    ];


    const unique =
        [...new Set(patterns)];


    return new RegExp(
        `\\b(${unique.join("|")})\\b`,
        "gi"
    );

}


/* =========================================================
   HIGHLIGHT TRANSCRIPT
   ========================================================= */

function highlightTranscript(text) {

    if (!text) {

        return `
            <span class="empty-state">
                Start speaking and your live transcript
                will appear here.
            </span>
        `;

    }


    const regex =
        getFillerRegex();

    let result = "";
    let lastIndex = 0;

    let match;


    while (
        (match = regex.exec(text)) !== null
    ) {

        result +=
            escapeHTML(
                text.slice(
                    lastIndex,
                    match.index
                )
            );


        result +=
            `<span class="filler-highlight">` +
            escapeHTML(match[0]) +
            `</span>`;


        lastIndex =
            regex.lastIndex;

    }


    result +=
        escapeHTML(
            text.slice(lastIndex)
        );


    return result;

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   COUNT WORDS
   ========================================================= */

function countWords(text) {

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


/* =========================================================
   COUNT FILLERS
   ========================================================= */

function countFillers(text) {

    if (!text) {
        return 0;
    }

    const regex =
        getFillerRegex();

    return (
        text.match(regex) || []
    ).length;

}


/* =========================================================
   UPDATE STATS
   ========================================================= */

function updateStats(text) {

    const fillerCount =
        countFillers(text);

    const wordCount =
        countWords(text);


    currentSessionFillerCount =
        fillerCount;

    currentSessionWordCount =
        wordCount;


    fillerCountElement.textContent =
        fillerCount;

    wordCountElement.textContent =
        wordCount;

}


/* =========================================================
   RENDER LIVE TRANSCRIPT
   ========================================================= */

function renderLiveTranscript() {

    heard.innerHTML =
        highlightTranscript(
            liveTranscript
        );


    updateStats(
        liveTranscript
    );

}


/* =========================================================
   RENDER FINAL TRANSCRIPT
   ========================================================= */

function renderFinalTranscript() {

    if (!finalTranscript) {

        finalTranscriptElement.textContent =
            "Your completed speech will appear here.";

        return;

    }


    finalTranscriptElement.innerHTML =
        highlightTranscript(
            finalTranscript
        );

}


/* =========================================================
   TRACKED WORD UI
   ========================================================= */

function renderWordList() {

    wordList.innerHTML = "";


    trackedWords.forEach(
        (word, index) => {

            const tag =
                document.createElement(
                    "div"
                );


            tag.className =
                "word-tag";


            tag.innerHTML = `
                <span>${escapeHTML(word)}</span>

                <button
                    type="button"
                    aria-label="Remove ${escapeHTML(word)}"
                    data-index="${index}"
                >
                    ×
                </button>
            `;


            wordList.appendChild(
                tag
            );

        }
    );

}


/* =========================================================
   ADD WORD
   ========================================================= */

function addTrackedWord() {

    const word =
        normalizeWord(
            customWordInput.value
        );


    if (!word) {
        return;
    }


    if (
        trackedWords.some(
            existing =>
                normalizeWord(existing) === word
        )
    ) {

        customWordInput.value = "";

        return;

    }


    trackedWords.push(word);

    saveTrackedWords();

    renderWordList();

    customWordInput.value = "";

}


/* =========================================================
   REMOVE WORD
   ========================================================= */

wordList.addEventListener(
    "click",
    (event) => {

        const button =
            event.target.closest(
                "button[data-index]"
            );


        if (!button) {
            return;
        }


        const index =
            Number(
                button.dataset.index
            );


        if (
            Number.isNaN(index)
        ) {
            return;
        }


        trackedWords.splice(
            index,
            1
        );


        saveTrackedWords();

        renderWordList();

    }
);


/* =========================================================
   DEFAULT RESET
   ========================================================= */

resetWordsButton.addEventListener(
    "click",
    () => {

        trackedWords =
            [...DEFAULT_WORDS];


        saveTrackedWords();

        renderWordList();


        /*
            Reset live detection too so changing
            tracked words doesn't leave stale IDs.
        */

        firedFillerOccurrences.clear();

        recentNotificationKeys.clear();

    }
);


/* =========================================================
   WORD INPUT
   ========================================================= */

addWordButton.addEventListener(
    "click",
    addTrackedWord
);


customWordInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            event.preventDefault();

            addTrackedWord();

        }

    }
);


/* =========================================================
   NOTIFICATION PERMISSION
   ========================================================= */

async function enableNotifications() {

    if (
        !("Notification" in window)
    ) {

        notificationStatus.textContent =
            "Notifications are not supported in this browser.";

        return;

    }


    try {

        const permission =
            await Notification.requestPermission();


        if (
            permission === "granted"
        ) {

            notificationStatus.textContent =
                "Notifications are enabled.";

            notificationStatus.classList.add(
                "enabled"
            );


            enableNotificationsButton.textContent =
                "Notifications Enabled";


            enableNotificationsButton.disabled =
                true;

        } else {

            notificationStatus.textContent =
                "Notification permission was not granted.";

        }

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

    }

}


enableNotificationsButton.addEventListener(
    "click",
    enableNotifications
);


/* =========================================================
   NOTIFICATION
   ========================================================= */

function sendFillerNotification(
    word,
    occurrenceKey
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


    const normalized =
        normalizeWord(word);


    const family =
        fillerFamily(normalized);


    const now =
        Date.now();


    /*
        This is only a FINAL safety net.

        The occurrence system above is what prevents
        actual duplicates.

        We use a very small window so notifications
        stay fast.
    */

    const notificationKey =
        `${detectionSessionId}:${occurrenceKey}:${family}`;


    const previousTime =
        recentNotificationKeys.get(
            notificationKey
        );


    if (
        previousTime &&
        now - previousTime < 300
    ) {

        return;

    }


    recentNotificationKeys.set(
        notificationKey,
        now
    );


    /*
        Clean old notification keys periodically.
    */

    for (
        const [key, timestamp]
        of recentNotificationKeys
    ) {

        if (
            now - timestamp > 10000
        ) {

            recentNotificationKeys.delete(
                key
            );

        }

    }


    try {

        /*
            One stable tag prevents the browser from
            generating a pile of duplicate notifications
            for the same live detector.

            The actual occurrence key is what determines
            whether we are allowed to call this function.
        */

        const notification =
            new Notification(
                "Speech Tracker",
                {
                    body:
                        `You said "${word}"`,

                    icon:
                        "/icon.svg",

                    badge:
                        "/icon.svg",

                    tag:
                        `speech-tracker-${detectionSessionId}-${occurrenceKey}`,

                    renotify:
                        false,

                    silent:
                        false
                }
            );


        /*
            Close it quickly so old filler notifications
            don't sit around forever.
        */

        setTimeout(
            () => {

                try {

                    notification.close();

                } catch (_) {}

            },
            1400
        );


    } catch (error) {

        console.error(
            "Could not send notification:",
            error
        );

    }

}


/* =========================================================
   VIBRATION
   ========================================================= */

function vibrateForFiller() {

    try {

        if (
            typeof navigator.vibrate ===
            "function"
        ) {

            navigator.vibrate(
                [45, 25, 45]
            );

        }

    } catch (_) {}

}


/* =========================================================
   GET FILLER OCCURRENCE KEY
   ========================================================= */

/*
    This is the most important part of the new detection
    system.

    SpeechRecognition may change:

        "I um"

    into:

        "I umm"

    and then:

        "I ummmm"

    while the person is still speaking.

    We therefore identify the occurrence by:

        - the filler family
        - the nearby words before it

    rather than by the exact spelling.

    That means one spoken "ummmm" should only trigger once.
*/

function getOccurrenceKey(
    text,
    match
) {

    const before =
        text
            .slice(
                0,
                match.index
            )
            .trim();


    const wordsBefore =
        before
            ? before
                .split(/\s+/)
                .filter(Boolean)
            : [];


    /*
        Keep a small context window.

        Example:

        "I think um"

        becomes something like:

        "think|UM"
    */

    const context =
        wordsBefore
            .slice(-5)
            .map(
                word =>
                    normalizeWord(word)
            )
            .join("|");


    const family =
        fillerFamily(
            match[0]
        );


    return (
        `${context}|${family}`
    );

}


/* =========================================================
   DETECT FILLERS IN LIVE TEXT
   ========================================================= */

function detectLiveFillers(text) {

    if (
        !text ||
        !isRecording
    ) {

        return;

    }


    const regex =
        getFillerRegex();


    let match;


    while (
        (match = regex.exec(text)) !== null
    ) {

        const word =
            match[0];


        const occurrenceKey =
            getOccurrenceKey(
                text,
                match
            );


        /*
            Already detected during this recording.

            This catches:

                um -> umm -> ummmm

            as one occurrence.
        */

        if (
            firedFillerOccurrences.has(
                occurrenceKey
            )
        ) {

            continue;

        }


        /*
            Mark it BEFORE vibrating or notifying.

            This is important because if the browser
            immediately fires another interim result,
            the second result sees the occurrence as
            already handled.
        */

        firedFillerOccurrences.add(
            occurrenceKey
        );


        /*
            Keep the displayed count synchronized
            with the actual transcript.

            Don't blindly increment the count forever.
        */

        const actualCount =
            countFillers(text);


        currentSessionFillerCount =
            Math.max(
                currentSessionFillerCount,
                actualCount
            );


        fillerCountElement.textContent =
            currentSessionFillerCount;


        /*
            Immediate feedback.
        */

        vibrateForFiller();


        sendFillerNotification(
            word,
            occurrenceKey
        );

    }


    lastDetectedTranscript =
        text;

}


/* =========================================================
   SPEECH RECOGNITION
   ========================================================= */

function setupSpeechRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        recognitionSupported =
            false;

        return;

    }


    recognitionSupported =
        true;


    recognition =
        new SpeechRecognition();


    recognition.lang =
        "en-US";


    recognition.continuous =
        true;


    /*
        TRUE is critical.

        This lets us see interim speech before the
        browser finalizes the result.
    */

    recognition.interimResults =
        true;


    recognition.maxAlternatives =
        1;


    recognition.onstart = () => {

        if (!isRecording) {
            return;
        }


        statusText.textContent =
            "Listening";


        statusDot.className =
            "status-dot listening";

    };


    recognition.onresult =
        handleRecognitionResult;


    recognition.onerror =
        event => {

            console.warn(
                "Speech recognition error:",
                event.error
            );


            if (
                event.error ===
                    "not-allowed" ||
                event.error ===
                    "service-not-allowed"
            ) {

                statusText.textContent =
                    "Microphone permission needed";


                statusDot.className =
                    "status-dot error";


                return;

            }


            /*
                Do not kill the recording for temporary
                recognition errors.
            */

            if (
                isRecording
            ) {

                statusText.textContent =
                    "Listening";

                statusDot.className =
                    "status-dot listening";

            }

        };


    recognition.onend = () => {

        if (
            recognitionShouldRun &&
            isRecording
        ) {

            /*
                Restart quickly.

                SpeechRecognition sometimes ends
                unexpectedly even with continuous=true.
            */

            setTimeout(
                () => {

                    if (
                        recognitionShouldRun &&
                        isRecording
                    ) {

                        try {

                            recognition.start();

                        } catch (_) {}

                    }

                },
                40
            );

        }

    };

}


/* =========================================================
   HANDLE SPEECH RESULT
   ========================================================= */

function handleRecognitionResult(
    event
) {

    let combinedFinal =
        "";

    let combinedInterim =
        "";


    /*
        Only process the results belonging to this
        recognition event.

        SpeechRecognition provides both final and
        interim results.
    */

    for (
        let i = 0;
        i < event.results.length;
        i++
    ) {

        const result =
            event.results[i];


        const transcript =
            result[0]?.transcript || "";


        if (
            result.isFinal
        ) {

            combinedFinal +=
                transcript + " ";

        } else {

            combinedInterim +=
                transcript + " ";

        }

    }


    const cleanFinal =
        combinedFinal.trim();


    const cleanInterim =
        combinedInterim.trim();


    liveTranscript =
        [
            cleanFinal,
            cleanInterim
        ]
            .filter(Boolean)
            .join(" ")
            .trim();


    renderLiveTranscript();


    /*
        IMPORTANT:

        Scan immediately.

        We don't wait for the final transcription.
    */

    detectLiveFillers(
        liveTranscript
    );

}


/* =========================================================
   START RECOGNITION
   ========================================================= */

function startRecognition() {

    if (
        !recognitionSupported ||
        !recognition
    ) {

        return;

    }


    recognitionShouldRun =
        true;


    try {

        recognition.start();

    } catch (error) {

        /*
            Browser throws if recognition is already running.
            This is harmless.
        */

        console.debug(
            "Recognition start:",
            error
        );

    }

}


/* =========================================================
   STOP RECOGNITION
   ========================================================= */

function stopRecognition() {

    recognitionShouldRun =
        false;


    if (!recognition) {
        return;
    }


    try {

        recognition.stop();

    } catch (_) {}

}


/* =========================================================
   MEDIA RECORDER
   ========================================================= */

function getRecordingMimeType() {

    const options = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg"
    ];


    for (
        const type of options
    ) {

        if (
            window.MediaRecorder &&
            MediaRecorder.isTypeSupported &&
            MediaRecorder.isTypeSupported(type)
        ) {

            return type;

        }

    }


    return "";

}


/* =========================================================
   START RECORDING
   ========================================================= */

async function startRecording() {

    if (isRecording) {
        return;
    }


    try {

        const stream =
            await navigator.mediaDevices.getUserMedia(
                {
                    audio: true
                }
            );


        audioChunks = [];


        liveTranscript = "";

        finalTranscript = "";


        currentAnalysis =
            null;


        currentSessionFillerCount =
            0;


        currentSessionWordCount =
            0;


        currentSpeechId =
            null;


        /*
            NEW DETECTION SESSION

            Everything from a previous recording is
            forgotten.
        */

        detectionSessionId++;


        firedFillerOccurrences.clear();

        recentNotificationKeys.clear();


        lastDetectedTranscript =
            "";


        analysisElement.innerHTML =
            "";


        finalTranscriptElement.textContent =
            "Your completed speech will appear here.";


        fillerCountElement.textContent =
            "0";


        wordCountElement.textContent =
            "0";


        /*
            IMPORTANT:

            The save prompt starts hidden.

            It is only shown after a real recording
            finishes.
        */

        savePrompt.hidden =
            true;


        const mimeType =
            getRecordingMimeType();


        if (mimeType) {

            mediaRecorder =
                new MediaRecorder(
                    stream,
                    {
                        mimeType
                    }
                );

        } else {

            mediaRecorder =
                new MediaRecorder(
                    stream
                );

        }


        mediaRecorder.ondataavailable =
            event => {

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
            () => {

                stream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );


                finishRecording();

            };


        /*
            Short timeslice means audio data becomes
            available quickly.
        */

        mediaRecorder.start(
            200
        );


        isRecording =
            true;


        isStopping =
            false;


        recordingStartTime =
            Date.now();


        startTimer();


        listenButton.disabled =
            true;


        stopButton.disabled =
            false;


        statusText.textContent =
            "Listening";


        statusDot.className =
            "status-dot listening";


        startRecognition();


    } catch (error) {

        console.error(
            "Could not start recording:",
            error
        );


        statusText.textContent =
            "Microphone unavailable";


        statusDot.className =
            "status-dot error";


        alert(
            "Could not access the microphone. Please allow microphone access and try again."
        );

    }

}


/* =========================================================
   STOP RECORDING
   ========================================================= */

function stopRecording() {

    if (
        !isRecording ||
        isStopping
    ) {

        return;

    }


    isStopping =
        true;


    recognitionShouldRun =
        false;


    stopRecognition();

    stopTimer();


    if (
        mediaRecorder &&
        mediaRecorder.state !==
            "inactive"
    ) {

        mediaRecorder.stop();

    } else {

        finishRecording();

    }

}


/* =========================================================
   FINISH RECORDING
   ========================================================= */

async function finishRecording() {

    isRecording =
        false;


    isStopping =
        false;


    listenButton.disabled =
        false;


    stopButton.disabled =
        true;


    statusText.textContent =
        "Processing";


    statusDot.className =
        "status-dot";


    /*
        Give SpeechRecognition a brief moment to
        provide the last result.
    */

    await wait(200);


    finalTranscript =
        liveTranscript.trim();


    renderFinalTranscript();


    updateStats(
        finalTranscript
    );


    analyzeButton.disabled =
        !finalTranscript;


    statusText.textContent =
        "Finished";


    /*
        Only show the save prompt after an actual
        recording exists.
    */

    if (finalTranscript) {

        savePrompt.hidden =
            false;

    }


    /*
        Get the more accurate final transcription
        from the existing API.
    */

    if (
        audioChunks.length
    ) {

        try {

            const improvedTranscript =
                await requestFinalTranscription();


            if (
                improvedTranscript &&
                improvedTranscript.trim()
            ) {

                finalTranscript =
                    improvedTranscript.trim();


                liveTranscript =
                    finalTranscript;


                renderFinalTranscript();


                updateStats(
                    finalTranscript
                );


                analyzeButton.disabled =
                    false;

            }

        } catch (error) {

            console.warn(
                "Final transcription failed. Using live transcript.",
                error
            );

        }

    }

}


/* =========================================================
   FINAL TRANSCRIPTION API
   ========================================================= */

async function requestFinalTranscription() {

    const mimeType =
        mediaRecorder?.mimeType ||
        "audio/webm";


    const blob =
        new Blob(
            audioChunks,
            {
                type: mimeType
            }
        );


    const base64 =
        await blobToBase64(
            blob
        );


    const response =
        await fetch(
            "/api/transcribe",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        {
                            audio: base64,
                            mimeType
                        }
                    )
            }
        );


    const data =
        await response.json()
            .catch(
                () => ({})
            );


    if (!response.ok) {

        throw new Error(
            data.error ||
            "Transcription failed"
        );

    }


    return (
        data.transcript ||
        data.text ||
        ""
    );

}


/* =========================================================
   BLOB TO BASE64
   ========================================================= */

function blobToBase64(blob) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onloadend =
                () => {

                    resolve(
                        reader.result
                    );

                };


            reader.onerror =
                reject;


            reader.readAsDataURL(
                blob
            );

        }
    );

}


/* =========================================================
   TIMER
   ========================================================= */

function startTimer() {

    stopTimer();


    recordingStartTime =
        Date.now();


    timerInterval =
        setInterval(
            () => {

                const elapsed =
                    Math.floor(
                        (
                            Date.now() -
                            recordingStartTime
                        ) / 1000
                    );


                recordingTimer.textContent =
                    formatTime(
                        elapsed
                    );

            },
            200
        );

}


function stopTimer() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );


        timerInterval =
            null;

    }

}


function formatTime(seconds) {

    const minutes =
        Math.floor(
            seconds / 60
        );


    const remaining =
        seconds % 60;


    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remaining).padStart(2, "0")
    );

}


/* =========================================================
   AI ANALYSIS
   ========================================================= */

async function analyzeSpeech() {

    if (
        !finalTranscript ||
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
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            {
                                transcript:
                                    finalTranscript
                            }
                        )
                }
            );


        const data =
            await response.json()
                .catch(
                    () => ({})
                );


        if (!response.ok) {

            throw new Error(
                data.error ||
                "AI analysis failed"
            );

        }


        currentAnalysis =
            data.analysisData ||
            data.analysis ||
            data;


        renderAnalysis(
            currentAnalysis
        );


    } catch (error) {

        console.error(
            "AI analysis error:",
            error
        );


        analysisElement.innerHTML = `
            <div class="analysis-section">

                <div class="analysis-section-title">
                    Analysis Error
                </div>

                <div class="analysis-section-text">
                    ${escapeHTML(
                        error.message ||
                        "The AI analysis could not be completed."
                    )}
                </div>

            </div>
        `;


    } finally {

        analysisLoading.hidden =
            true;


        analyzeButton.disabled =
            !finalTranscript;

    }

}


analyzeButton.addEventListener(
    "click",
    analyzeSpeech
);


/* =========================================================
   AI OBJECT RENDERER
   ========================================================= */

function renderAnalysis(data) {

    analysisElement.innerHTML =
        "";


    if (!data) {

        analysisElement.innerHTML = `
            <div class="analysis-empty">
                No analysis was returned.
            </div>
        `;

        return;

    }


    if (
        typeof data === "string"
    ) {

        const section =
            createAnalysisSection(
                "AI Feedback",
                data
            );


        analysisElement.appendChild(
            section
        );


        return;

    }


    Object.entries(data)
        .forEach(
            ([key, value]) => {

                if (
                    value === null ||
                    value === undefined ||
                    value === ""
                ) {

                    return;

                }


                const section =
                    document.createElement(
                        "div"
                    );


                section.className =
                    "analysis-section";


                const title =
                    document.createElement(
                        "div"
                    );


                title.className =
                    "analysis-section-title";


                title.textContent =
                    prettifyKey(key);


                section.appendChild(
                    title
                );


                renderAnalysisValue(
                    value,
                    section
                );


                analysisElement.appendChild(
                    section
                );

            }
        );


    if (
        !analysisElement.children.length
    ) {

        analysisElement.innerHTML = `
            <div class="analysis-empty">
                No useful analysis was returned.
            </div>
        `;

    }

}


/* =========================================================
   RENDER NESTED AI VALUES
   ========================================================= */

function renderAnalysisValue(
    value,
    parent
) {

    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {

        const text =
            document.createElement(
                "div"
            );


        text.className =
            "analysis-section-text";


        text.textContent =
            String(value);


        parent.appendChild(
            text
        );


        return;

    }


    if (
        Array.isArray(value)
    ) {

        const list =
            document.createElement(
                "ul"
            );


        list.className =
            "analysis-list";


        value.forEach(
            item => {

                const li =
                    document.createElement(
                        "li"
                    );


                li.className =
                    "analysis-list-item";


                if (
                    typeof item === "object" &&
                    item !== null
                ) {

                    renderObjectInside(
                        item,
                        li
                    );

                } else {

                    li.textContent =
                        String(item);

                }


                list.appendChild(
                    li
                );

            }
        );


        parent.appendChild(
            list
        );


        return;

    }


    if (
        typeof value === "object" &&
        value !== null
    ) {

        renderObjectInside(
            value,
            parent
        );

    }

}


/* =========================================================
   RENDER OBJECT
   ========================================================= */

function renderObjectInside(
    object,
    parent
) {

    Object.entries(object)
        .forEach(
            ([key, value]) => {

                if (
                    value === null ||
                    value === undefined ||
                    value === ""
                ) {

                    return;

                }


                const subsection =
                    document.createElement(
                        "div"
                    );


                subsection.className =
                    "analysis-subsection";


                const title =
                    document.createElement(
                        "div"
                    );


                title.className =
                    "analysis-subtitle";


                title.textContent =
                    prettifyKey(key);


                subsection.appendChild(
                    title
                );


                renderAnalysisValue(
                    value,
                    subsection
                );


                parent.appendChild(
                    subsection
                );

            }
        );

}


/* =========================================================
   CREATE SIMPLE AI SECTION
   ========================================================= */

function createAnalysisSection(
    titleText,
    content
) {

    const section =
        document.createElement(
            "div"
        );


    section.className =
        "analysis-section";


    const title =
        document.createElement(
            "div"
        );


    title.className =
        "analysis-section-title";


    title.textContent =
        titleText;


    const text =
        document.createElement(
            "div"
        );


    text.className =
        "analysis-section-text";


    text.textContent =
        content;


    section.appendChild(
        title
    );


    section.appendChild(
        text
    );


    return section;

}


/* =========================================================
   PRETTIFY AI KEY
   ========================================================= */

function prettifyKey(key) {

    return String(key)
        .replace(
            /([a-z])([A-Z])/g,
            "$1 $2"
        )
        .replace(
            /[_-]+/g,
            " "
        )
        .replace(
            /\b\w/g,
            char =>
                char.toUpperCase()
        );

}


/* =========================================================
   SAVED SPEECHES STORAGE
   ========================================================= */

function getSavedSpeeches() {

    try {

        const data =
            localStorage.getItem(
                SPEECH_STORAGE_KEY
            );


        if (!data) {
            return [];
        }


        const parsed =
            JSON.parse(data);


        return Array.isArray(parsed)
            ? parsed
            : [];


    } catch (error) {

        console.error(
            "Could not load saved speeches:",
            error
        );


        return [];

    }

}


function setSavedSpeeches(
    speeches
) {

    try {

        localStorage.setItem(
            SPEECH_STORAGE_KEY,
            JSON.stringify(
                speeches
            )
        );

    } catch (error) {

        console.error(
            "Could not save speeches:",
            error
        );

    }

}


/* =========================================================
   RENDER SAVED SPEECHES
   ========================================================= */

function renderSavedSpeeches() {

    const speeches =
        getSavedSpeeches();


    savedSpeechCount.textContent =
        speeches.length;


    if (!speeches.length) {

        savedSpeechesElement.innerHTML = `
            <div class="empty-history">
                No saved speeches yet.
            </div>
        `;


        return;

    }


    savedSpeechesElement.innerHTML =
        speeches
            .map(
                speech => {

                    const date =
                        new Date(
                            speech.date
                        );


                    const dateText =
                        isNaN(
                            date.getTime()
                        )
                            ? "Unknown date"
                            : date.toLocaleString(
                                undefined,
                                {
                                    dateStyle:
                                        "medium",

                                    timeStyle:
                                        "short"
                                }
                            );


                    return `
                        <div
                            class="saved-speech"
                            data-id="${escapeHTML(
                                speech.id
                            )}"
                        >

                            <div
                                class="saved-speech-main"
                                data-open-speech="${escapeHTML(
                                    speech.id
                                )}"
                            >

                                <div class="saved-speech-name">
                                    ${escapeHTML(
                                        speech.name ||
                                        "Untitled Speech"
                                    )}
                                </div>

                                <div class="saved-speech-date">
                                    ${escapeHTML(
                                        dateText
                                    )}
                                </div>

                                <div class="saved-speech-stats">
                                    ${speech.wordCount || 0} words
                                    •
                                    ${speech.fillerCount || 0} tracked fillers
                                </div>

                            </div>


                            <button
                                class="delete-speech"
                                type="button"
                                data-delete-speech="${escapeHTML(
                                    speech.id
                                )}"
                                aria-label="Delete speech"
                            >
                                ×
                            </button>

                        </div>
                    `;

                }
            )
            .join("");

}


/* =========================================================
   SAVE SPEECH MODAL
   ========================================================= */

function openSaveModal() {

    speechNameInput.value =
        "";


    saveModal.hidden =
        false;


    setTimeout(
        () => {

            speechNameInput.focus();

        },
        50
    );

}


function closeSaveModal() {

    saveModal.hidden =
        true;

}


/* =========================================================
   SAVE SPEECH
   ========================================================= */

function saveCurrentSpeech(
    name
) {

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {

        return;

    }


    const speeches =
        getSavedSpeeches();


    const speech = {

        id:
            `speech_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 9)}`,

        name:
            name.trim() ||
            `Speech ${new Date()
                .toLocaleDateString()}`,

        date:
            new Date().toISOString(),

        transcript:
            finalTranscript,

        fillerCount:
            countFillers(
                finalTranscript
            ),

        wordCount:
            countWords(
                finalTranscript
            ),

        analysis:
            currentAnalysis || null

    };


    speeches.unshift(
        speech
    );


    setSavedSpeeches(
        speeches
    );


    currentSpeechId =
        speech.id;


    renderSavedSpeeches();

    closeSaveModal();


    savePrompt.hidden =
        true;

}


/* =========================================================
   SAVE PROMPT
   ========================================================= */

saveSpeechButton.addEventListener(
    "click",
    openSaveModal
);


discardSpeechButton.addEventListener(
    "click",
    () => {

        savePrompt.hidden =
            true;

    }
);


cancelSaveButton.addEventListener(
    "click",
    closeSaveModal
);


confirmSaveButton.addEventListener(
    "click",
    () => {

        saveCurrentSpeech(
            speechNameInput.value
        );

    }
);


speechNameInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();


            saveCurrentSpeech(
                speechNameInput.value
            );

        }


        if (
            event.key === "Escape"
        ) {

            closeSaveModal();

        }

    }
);


/* =========================================================
   SAVED SPEECH CLICK HANDLER
   ========================================================= */

savedSpeechesElement.addEventListener(
    "click",
    event => {

        const deleteButton =
            event.target.closest(
                "[data-delete-speech]"
            );


        if (deleteButton) {

            event.stopPropagation();


            const id =
                deleteButton.dataset
                    .deleteSpeech;


            deleteSpeech(
                id
            );


            return;

        }


        const speechElement =
            event.target.closest(
                "[data-open-speech]"
            );


        if (speechElement) {

            const id =
                speechElement.dataset
                    .openSpeech;


            openSavedSpeech(
                id
            );

        }

    }
);


/* =========================================================
   DELETE SPEECH
   ========================================================= */

function deleteSpeech(id) {

    const speeches =
        getSavedSpeeches();


    const filtered =
        speeches.filter(
            speech =>
                speech.id !== id
        );


    setSavedSpeeches(
        filtered
    );


    renderSavedSpeeches();

}


/* =========================================================
   OPEN SAVED SPEECH
   ========================================================= */

function openSavedSpeech(id) {

    const speeches =
        getSavedSpeeches();


    const speech =
        speeches.find(
            item =>
                item.id === id
        );


    if (!speech) {
        return;
    }


    currentSpeechId =
        speech.id;


    finalTranscript =
        speech.transcript || "";


    currentAnalysis =
        speech.analysis || null;


    liveTranscript =
        finalTranscript;


    renderFinalTranscript();


    updateStats(
        finalTranscript
    );


    if (currentAnalysis) {

        renderAnalysis(
            currentAnalysis
        );

    } else {

        analysisElement.innerHTML = `
            <div class="analysis-empty">
                This speech does not have an AI analysis yet.
            </div>
        `;

    }


    analyzeButton.disabled =
        !finalTranscript;


    savePrompt.hidden =
        true;


    document
        .querySelector(".transcript-card")
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

}


/* =========================================================
   THEME
   ========================================================= */

function getPreferredTheme() {

    const saved =
        localStorage.getItem(
            THEME_STORAGE_KEY
        );


    if (
        saved === "dark" ||
        saved === "light"
    ) {

        return saved;

    }


    return window.matchMedia(
        "(prefers-color-scheme: dark)"
    ).matches
        ? "dark"
        : "light";

}


function applyTheme(
    theme
) {

    document.documentElement
        .setAttribute(
            "data-theme",
            theme
        );


    localStorage.setItem(
        THEME_STORAGE_KEY,
        theme
    );


    if (theme === "dark") {

        themeToggle.textContent =
            "Light";


        if (themeColor) {

            themeColor.content =
                "#09090b";

        }

    } else {

        themeToggle.textContent =
            "Dark";


        if (themeColor) {

            themeColor.content =
                "#ffffff";

        }

    }

}


themeToggle.addEventListener(
    "click",
    () => {

        const current =
            document.documentElement
                .getAttribute(
                    "data-theme"
                );


        applyTheme(
            current === "dark"
                ? "light"
                : "dark"
        );

    }
);


/* =========================================================
   SCROLL INDICATOR
   ========================================================= */

if (scrollIndicator) {

    window.addEventListener(
        "scroll",
        () => {

            if (
                window.scrollY > 80
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

}


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

listenButton.addEventListener(
    "click",
    startRecording
);


stopButton.addEventListener(
    "click",
    stopRecording
);


/* =========================================================
   UTIL
   ========================================================= */

function wait(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initialize() {

    /*
        Make absolutely sure the save prompt does NOT
        appear when the page first loads.

        It only appears after recording.
    */

    if (savePrompt) {

        savePrompt.hidden =
            true;

    }


    loadTrackedWords();


    renderWordList();


    renderSavedSpeeches();


    applyTheme(
        getPreferredTheme()
    );


    setupSpeechRecognition();


    if (
        !recognitionSupported
    ) {

        console.warn(
            "SpeechRecognition is not supported in this browser. Live transcription/filler detection may be unavailable."
        );

    }


    if (
        "Notification" in window &&
        Notification.permission ===
            "granted"
    ) {

        notificationStatus.textContent =
            "Notifications are enabled.";


        notificationStatus.classList.add(
            "enabled"
        );


        enableNotificationsButton.textContent =
            "Notifications Enabled";


        enableNotificationsButton.disabled =
            true;

    }

}


initialize();