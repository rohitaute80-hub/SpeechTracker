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

let recognitionRestartTimer = null;


/*
    These sets are deliberately separate.

    firedFillerOccurrences:
    prevents the same spoken filler from triggering twice.

    detectedFillerTexts:
    keeps track of fillers already counted in the
    current transcript.
*/

const firedFillerOccurrences = new Set();

const detectedFillerTexts = new Set();


/*
    Notification cooldown.

    This is only a backup safety mechanism.
    The occurrence system above is the primary
    duplicate protection.
*/

const recentNotificationKeys = new Map();


let currentSpeechId = null;


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
                    parsed
                        .map(normalizeWord)
                        .filter(Boolean);

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
            JSON.stringify(
                trackedWords
            )
        );

    } catch (error) {

        console.error(
            "Could not save tracked words:",
            error
        );

    }

}


/* =========================================================
   NORMALIZE WORD
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

/*
    This intentionally groups:

    um
    umm
    ummm
    ummmm
    etc.

    together.

    Same thing for:

    uh
    uhh
    uhhh
    uhhhh
*/

function fillerFamily(word) {

    const normalized =
        normalizeWord(word);

    if (
        /^um+$/.test(normalized)
    ) {

        return "UM";

    }

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

    const words =
        [...trackedWords]
            .map(normalizeWord)
            .filter(Boolean)
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    /*
        Do NOT escape these two.

        They intentionally use + so that:

        um
        umm
        ummm
        ummmm
        uhhhh
        uhhhhh

        are all detected.
    */

    const regularWords =
        words
            .filter(
                word =>
                    !/^um+$/.test(word) &&
                    !/^uh+$/.test(word)
            )
            .map(
                escapeRegex
            );


    /*
        Add unlimited variants.
    */

    regularWords.push(
        "um+",
        "uh+"
    );


    const unique =
        [...new Set(
            regularWords
        )];


    /*
        Boundary behavior:

        We use a lookahead instead of a trailing
        \b because repeated letters such as

        "ummmm"

        can behave strangely with traditional
        word boundaries.
    */

    return new RegExp(
        `(^|\\s|[.,!?;:])(${unique.join("|")})(?=$|\\s|[.,!?;:])`,
        "gi"
    );

}


/* =========================================================
   MATCH FILLERS
   ========================================================= */

function getFillerMatches(text) {

    if (!text) {
        return [];
    }

    const regex =
        getFillerRegex();

    const matches = [];

    let match;

    while (
        (match = regex.exec(text)) !== null
    ) {

        /*
            Group 2 is the actual filler.

            Group 1 is the surrounding character.
        */

        const filler =
            match[2] || match[0];

        const actualStart =
            match.index +
            (
                match[1]
                    ? match[1].length
                    : 0
            );


        matches.push({
            word: filler,
            index: actualStart,
            end:
                actualStart +
                filler.length
        });

    }

    return matches;

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


    const matches =
        getFillerMatches(text);


    if (!matches.length) {

        return escapeHTML(text);

    }


    let result = "";
    let lastIndex = 0;


    matches.forEach(
        match => {

            result +=
                escapeHTML(
                    text.slice(
                        lastIndex,
                        match.index
                    )
                );


            result +=
                `<span class="filler-highlight">` +
                escapeHTML(match.word) +
                `</span>`;


            lastIndex =
                match.end;

        }
    );


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

    return getFillerMatches(text).length;

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
   RENDER LIVE TRANSCRIPT
   ========================================================= */

function renderLiveTranscript() {

    if (!heard) {
        return;
    }


    heard.innerHTML =
        highlightTranscript(
            liveTranscript
        );


    /*
        Keep stats accurate based on the actual
        transcript rather than notification count.
    */

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


            const span =
                document.createElement(
                    "span"
                );

            span.textContent =
                word;


            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.textContent =
                "×";

            button.dataset.index =
                index;

            button.setAttribute(
                "aria-label",
                `Remove ${word}`
            );


            tag.appendChild(
                span
            );

            tag.appendChild(
                button
            );


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

    if (!customWordInput) {
        return;
    }


    const word =
        normalizeWord(
            customWordInput.value
        );


    if (!word) {
        return;
    }


    const alreadyExists =
        trackedWords.some(
            existing =>
                normalizeWord(existing) ===
                word
        );


    if (alreadyExists) {

        customWordInput.value =
            "";

        return;

    }


    trackedWords.push(
        word
    );


    saveTrackedWords();

    renderWordList();


    customWordInput.value =
        "";

}


/* =========================================================
   REMOVE WORD
   ========================================================= */

if (wordList) {

    wordList.addEventListener(
        "click",
        event => {

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

}


/* =========================================================
   DEFAULT RESET
   ========================================================= */

if (resetWordsButton) {

    resetWordsButton.addEventListener(
        "click",
        () => {

            trackedWords =
                [...DEFAULT_WORDS];


            saveTrackedWords();

            renderWordList();

        }
    );

}


/* =========================================================
   WORD INPUT
   ========================================================= */

if (addWordButton) {

    addWordButton.addEventListener(
        "click",
        addTrackedWord
    );

}


if (customWordInput) {

    customWordInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                addTrackedWord();

            }

        }
    );

}


/* =========================================================
   NOTIFICATION PERMISSION
   ========================================================= */

async function enableNotifications() {

    if (
        !("Notification" in window)
    ) {

        if (notificationStatus) {

            notificationStatus.textContent =
                "Notifications are not supported in this browser.";

        }

        return;

    }


    try {

        const permission =
            await Notification.requestPermission();


        if (
            permission ===
            "granted"
        ) {

            if (notificationStatus) {

                notificationStatus.textContent =
                    "Notifications are enabled.";

                notificationStatus.classList.add(
                    "enabled"
                );

            }


            if (enableNotificationsButton) {

                enableNotificationsButton.textContent =
                    "Notifications Enabled";

                enableNotificationsButton.disabled =
                    true;

            }

        } else {

            if (notificationStatus) {

                notificationStatus.textContent =
                    "Notification permission was not granted.";

            }

        }

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

    }

}


if (enableNotificationsButton) {

    enableNotificationsButton.addEventListener(
        "click",
        enableNotifications
    );

}


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


    /*
        The occurrence key is now part of the
        notification key.

        This means:

        "um" occurrence #1
        "um" occurrence #2

        can both notify,

        while the same occurrence being re-sent
        by interim SpeechRecognition cannot.
    */

    const key =
        occurrenceKey ||
        `${fillerFamily(word)}:${word}`;


    const now =
        Date.now();


    const previousTime =
        recentNotificationKeys.get(
            key
        );


    /*
        Very short emergency debounce.

        This is intentionally only 150ms.

        The old code used a much larger effective
        cooldown and could make notifications feel
        delayed.
    */

    if (
        previousTime &&
        now - previousTime < 150
    ) {

        return;

    }


    recentNotificationKeys.set(
        key,
        now
    );


    /*
        Clean old notification keys.
    */

    if (
        recentNotificationKeys.size > 100
    ) {

        const cutoff =
            now - 10000;


        for (
            const [
                savedKey,
                savedTime
            ]
            of recentNotificationKeys
        ) {

            if (
                savedTime < cutoff
            ) {

                recentNotificationKeys.delete(
                    savedKey
                );

            }

        }

    }


    try {

        /*
            A unique tag is used for each occurrence.

            This is important.

            Using one fixed tag causes the browser
            to replace previous notifications instead
            of showing a new alert for each filler.

            The old behavior could also look like
            duplicate notification summaries on iOS.
        */

        const tag =
            `speech-tracker-filler-${key}`;


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
                        tag,
                    renotify:
                        true,
                    silent:
                        false
                }
            );


        /*
            Close quickly so the phone doesn't build
            up a giant stack of old Speech Tracker
            notifications.
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
   CREATE OCCURRENCE KEY
   ========================================================= */

/*
    This is the important part of the duplicate fix.

    SpeechRecognition repeatedly changes its interim
    transcript.

    Example:

        "I um"
        "I um I"
        "I um I think"

    We need to recognize that the first "um" is still
    the SAME spoken occurrence.

    We therefore create the key from:

        filler family
        approximate word position
        small amount of text before it

    rather than simply using the entire transcript.
*/

function createOccurrenceKey(
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


    const wordIndex =
        wordsBefore.length;


    const family =
        fillerFamily(
            match.word
        );


    /*
        Include a small context window.

        This makes two separate fillers at the
        same approximate position much less likely
        to collide.
    */

    const context =
        wordsBefore
            .slice(-4)
            .join(" ")
            .toLowerCase();


    return [
        family,
        wordIndex,
        context
    ].join("|");

}


/* =========================================================
   DETECT LIVE FILLERS
   ========================================================= */

function detectLiveFillers(text) {

    if (!text) {
        return;
    }


    const matches =
        getFillerMatches(text);


    if (!matches.length) {
        return;
    }


    /*
        Only process matches we haven't seen.

        This runs on EVERY interim result.
    */

    for (
        const match
        of matches
    ) {

        const occurrenceKey =
            createOccurrenceKey(
                text,
                match
            );


        if (
            firedFillerOccurrences.has(
                occurrenceKey
            )
        ) {

            continue;

        }


        /*
            Mark immediately BEFORE notifying.

            If notification creation or vibration
            somehow causes another recognition event,
            the same occurrence is still protected.
        */

        firedFillerOccurrences.add(
            occurrenceKey
        );


        /*
            Notification and vibration happen
            immediately.

            There is intentionally no artificial
            timeout here.
        */

        vibrateForFiller();


        sendFillerNotification(
            match.word,
            occurrenceKey
        );

    }

}


/* =========================================================
   SPEECH RECOGNITION SETUP
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
        REQUIRED FOR FAST FILLER DETECTION.

        Interim results are the reason we can detect
        fillers before the browser finishes the sentence.
    */

    recognition.interimResults =
        true;


    recognition.maxAlternatives =
        1;


    recognition.onstart =
        () => {

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
                These errors can be temporary.
            */

            if (
                event.error ===
                    "no-speech" ||
                event.error ===
                    "network" ||
                event.error ===
                    "aborted"
            ) {

                return;

            }

        };


    recognition.onend =
        () => {

            if (
                recognitionShouldRun &&
                isRecording
            ) {

                /*
                    Restart almost immediately.

                    The tiny delay prevents some browsers
                    from throwing InvalidStateError while
                    still transitioning states.
                */

                clearTimeout(
                    recognitionRestartTimer
                );


                recognitionRestartTimer =
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
                        30
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
        IMPORTANT:

        Only process the results contained in this
        event rather than waiting for recording to
        finish.
    */

    for (
        let i = 0;
        i < event.results.length;
        i++
    ) {

        const result =
            event.results[i];


        const transcript =
            result[0]?.transcript ||
            "";


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
        THIS RUNS IMMEDIATELY.

        We don't wait for final transcription.
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


    clearTimeout(
        recognitionRestartTimer
    );


    if (!recognition) {
        return;
    }


    try {

        recognition.stop();

    } catch (_) {}

}


/* =========================================================
   MEDIA RECORDER MIME TYPE
   ========================================================= */

function getRecordingMimeType() {

    const options = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg"
    ];


    for (
        const type
        of options
    ) {

        if (
            window.MediaRecorder &&
            MediaRecorder.isTypeSupported &&
            MediaRecorder.isTypeSupported(
                type
            )
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


    /*
        Hide the save menu immediately.

        This prevents it from ever appearing at the
        beginning of a new recording.
    */

    if (savePrompt) {

        savePrompt.hidden =
            true;

        savePrompt.style.display =
            "none";

    }


    try {

        const stream =
            await navigator.mediaDevices.getUserMedia(
                {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                }
            );


        audioChunks = [];


        liveTranscript =
            "";

        finalTranscript =
            "";


        currentAnalysis =
            null;


        currentSessionFillerCount =
            0;


        currentSessionWordCount =
            0;


        currentSpeechId =
            null;


        /*
            Completely reset occurrence tracking
            for the new speech.
        */

        firedFillerOccurrences.clear();

        detectedFillerTexts.clear();

        recentNotificationKeys.clear();


        if (analysisElement) {

            analysisElement.innerHTML =
                "";

        }


        if (finalTranscriptElement) {

            finalTranscriptElement.textContent =
                "Your completed speech will appear here.";

        }


        if (fillerCountElement) {

            fillerCountElement.textContent =
                "0";

        }


        if (wordCountElement) {

            wordCountElement.textContent =
                "0";

        }


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
            Small chunks allow the recording pipeline
            to stay responsive.
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
        Let the last recognition event arrive.
    */

    await wait(150);


    /*
        First use the instant live transcript.
    */

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
        DO NOT show the save menu unless there is
        actually a completed speech.

        It also remains hidden until recording ends.
    */

    if (
        savePrompt
    ) {

        if (
            finalTranscript
        ) {

            savePrompt.hidden =
                false;

            savePrompt.style.display =
                "";

        } else {

            savePrompt.hidden =
                true;

            savePrompt.style.display =
                "none";

        }

    }


    /*
        Ask OpenAI for the more accurate transcript.
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
                            audio:
                                base64,
                            mimeType:
                                mimeType
                        }
                    )
            }
        );


    const data =
        await response
            .json()
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

function blobToBase64(
    blob
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

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
            250
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


function formatTime(
    seconds
) {

    const minutes =
        Math.floor(
            seconds / 60
        );


    const remaining =
        seconds % 60;


    return (
        String(minutes)
            .padStart(
                2,
                "0"
            ) +
        ":" +
        String(remaining)
            .padStart(
                2,
                "0"
            )
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
            await response
                .json()
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


if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );

}


/* =========================================================
   AI OBJECT RENDERER
   ========================================================= */

function renderAnalysis(
    data
) {

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
        typeof data ===
        "string"
    ) {

        analysisElement.appendChild(
            createAnalysisSection(
                "AI Feedback",
                data
            )
        );


        return;

    }


    Object.entries(data)
        .forEach(
            (
                [
                    key,
                    value
                ]
            ) => {

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
                    prettifyKey(
                        key
                    );


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
        typeof value ===
            "string" ||
        typeof value ===
            "number" ||
        typeof value ===
            "boolean"
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
                    typeof item ===
                        "object" &&
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
        typeof value ===
            "object" &&
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
            (
                [
                    key,
                    value
                ]
            ) => {

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
                    prettifyKey(
                        key
                    );


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

function prettifyKey(
    key
) {

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
   SAVED SPEECHES
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

    if (!savedSpeechesElement) {
        return;
    }


    const speeches =
        getSavedSpeeches();


    if (savedSpeechCount) {

        savedSpeechCount.textContent =
            speeches.length;

    }


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
                                    ${speech.wordCount || 0}
                                    words
                                    •
                                    ${speech.fillerCount || 0}
                                    tracked fillers
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
   SAVE MODAL
   ========================================================= */

function openSaveModal() {

    if (!saveModal) {
        return;
    }


    speechNameInput.value =
        "";


    saveModal.hidden =
        false;


    saveModal.style.display =
        "";


    setTimeout(
        () => {

            speechNameInput?.focus();

        },
        50
    );

}


function closeSaveModal() {

    if (!saveModal) {
        return;
    }


    saveModal.hidden =
        true;


    saveModal.style.display =
        "none";

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
            currentAnalysis ||
            null

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


    if (savePrompt) {

        savePrompt.hidden =
            true;

        savePrompt.style.display =
            "none";

    }

}


/* =========================================================
   SAVE PROMPT EVENTS
   ========================================================= */

if (saveSpeechButton) {

    saveSpeechButton.addEventListener(
        "click",
        openSaveModal
    );

}


if (discardSpeechButton) {

    discardSpeechButton.addEventListener(
        "click",
        () => {

            if (savePrompt) {

                savePrompt.hidden =
                    true;

                savePrompt.style.display =
                    "none";

            }

        }
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
        () => {

            saveCurrentSpeech(
                speechNameInput.value
            );

        }
    );

}


if (speechNameInput) {

    speechNameInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();


                saveCurrentSpeech(
                    speechNameInput.value
                );

            }


            if (
                event.key ===
                "Escape"
            ) {

                closeSaveModal();

            }

        }
    );

}


/* =========================================================
   SAVED SPEECH CLICK HANDLER
   ========================================================= */

if (savedSpeechesElement) {

    savedSpeechesElement.addEventListener(
        "click",
        event => {

            const deleteButton =
                event.target.closest(
                    "[data-delete-speech]"
                );


            if (deleteButton) {

                event.stopPropagation();


                deleteSpeech(
                    deleteButton.dataset
                        .deleteSpeech
                );


                return;

            }


            const speechElement =
                event.target.closest(
                    "[data-open-speech]"
                );


            if (speechElement) {

                openSavedSpeech(
                    speechElement.dataset
                        .openSpeech
                );

            }

        }
    );

}


/* =========================================================
   DELETE SPEECH
   ========================================================= */

function deleteSpeech(
    id
) {

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

function openSavedSpeech(
    id
) {

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
        speech.transcript ||
        "";


    currentAnalysis =
        speech.analysis ||
        null;


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


    if (savePrompt) {

        savePrompt.hidden =
            true;

        savePrompt.style.display =
            "none";

    }


    document
        .querySelector(
            ".transcript-card"
        )
        ?.scrollIntoView(
            {
                behavior:
                    "smooth",
                block:
                    "start"
            }
        );

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


    if (
        theme ===
        "dark"
    ) {

        if (themeToggle) {

            themeToggle.textContent =
                "Light";

        }


        if (themeColor) {

            themeColor.content =
                "#09090b";

        }

    } else {

        if (themeToggle) {

            themeToggle.textContent =
                "Dark";

        }


        if (themeColor) {

            themeColor.content =
                "#ffffff";

        }

    }

}


if (themeToggle) {

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

}


/* =========================================================
   SCROLL INDICATOR
   ========================================================= */

if (scrollIndicator) {

    window.addEventListener(
        "scroll",
        () => {

            scrollIndicator.style.opacity =
                window.scrollY > 80
                    ? "0"
                    : "1";

        },
        {
            passive:
                true
        }
    );

}


/* =========================================================
   RECORDING BUTTONS
   ========================================================= */

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


/* =========================================================
   UTILITY
   ========================================================= */

function wait(
    ms
) {

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
        Force the save prompt to be hidden on initial
        page load.

        This fixes the "weird speech menu at the start"
        even if the HTML/CSS accidentally leaves it
        visible.
    */

    if (savePrompt) {

        savePrompt.hidden =
            true;

        savePrompt.style.display =
            "none";

    }


    /*
        The save modal should also never appear
        automatically.
    */

    if (saveModal) {

        saveModal.hidden =
            true;

        saveModal.style.display =
            "none";

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

        if (notificationStatus) {

            notificationStatus.textContent =
                "Notifications are enabled.";

            notificationStatus.classList.add(
                "enabled"
            );

        }


        if (enableNotificationsButton) {

            enableNotificationsButton.textContent =
                "Notifications Enabled";

            enableNotificationsButton.disabled =
                true;

        }

    }

}


initialize();