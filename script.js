/* =========================================================
   SPEECH TRACKER
   Complete replacement script.js

   FEATURES
   ---------------------------------------------------------
   • Live speech recognition
   • Fast interim filler detection
   • UM / UMM / UMMM / UMMMM detection
   • UH / UHH / UHHH / UHHHH detection
   • Duplicate filler protection
   • Vibration
   • Browser / PWA notifications
   • OpenAI final transcription
   • OpenAI speech analysis
   • Saved speeches
   • Custom tracked words
   • Dark / light theme
   • Recording timer
   ========================================================= */


/* =========================================================
   ELEMENTS
   ========================================================= */

const $ = id =>
    document.getElementById(id);

const listenButton =
    $("listenButton");

const stopButton =
    $("stopButton");

const statusDot =
    $("statusDot");

const statusText =
    $("status");

const heard =
    $("heard");

const finalTranscriptElement =
    $("finalTranscript");

const fillerCountElement =
    $("fillerCount");

const wordCountElement =
    $("wordCount");

const recordingTimer =
    $("recordingTimer");

const customWordInput =
    $("customWordInput");

const addWordButton =
    $("addWordButton");

const resetWordsButton =
    $("resetWordsButton");

const wordList =
    $("wordList");

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
   DEFAULT TRACKED WORDS
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
   STORAGE
   ========================================================= */

const WORD_STORAGE_KEY =
    "speechTrackerWords";

const SPEECH_STORAGE_KEY =
    "speechTrackerSavedSpeeches";

const THEME_STORAGE_KEY =
    "speechTrackerTheme";


/* =========================================================
   STATE
   ========================================================= */

let trackedWords = [];

let mediaRecorder = null;

let audioChunks = [];

let recognition = null;

let recognitionSupported =
    false;

let recognitionShouldRun =
    false;

let isRecording =
    false;

let isStopping =
    false;

let recordingStartTime =
    null;

let timerInterval =
    null;

let liveTranscript =
    "";

let finalTranscript =
    "";

let currentAnalysis =
    null;

let currentSessionFillerCount =
    0;

let currentSessionWordCount =
    0;

let currentSpeechId =
    null;


/* =========================================================
   FILLER DETECTION STATE
   ========================================================= */

/*
    SpeechRecognition changes interim results constantly.

    Example:

        "I was um"
        "I was umm"
        "I was ummm"

    Those are NOT three fillers.

    We therefore keep a set of occurrences that have
    already triggered.
*/

const detectedFillerOccurrences =
    new Set();


/*
    Tracks the most recent notification.

    This is only a secondary debounce.

    The occurrence Set above is the primary protection.
*/

let lastFillerNotificationTime =
    0;

let lastFillerNotificationFamily =
    "";


/*
    Service Worker registration.
*/

let notificationRegistration =
    null;


/*
    Prevent duplicate event listeners if initialization
    happens more than once.
*/

let initialized =
    false;


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
                        .map(word =>
                            normalizeWord(word)
                        )
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


/* =========================================================
   SAVE TRACKED WORDS
   ========================================================= */

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
        .replace(
            /[^\w\s']/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        );

}


/* =========================================================
   FILLER FAMILY
   ========================================================= */

function fillerFamily(word) {

    const normalized =
        normalizeWord(word);


    /*
        Every UM variation belongs to UM.

        um
        umm
        ummm
        ummmm
        ummmmm
    */

    if (
        /^um+$/.test(
            normalized
        )
    ) {

        return "UM";

    }


    /*
        Every UH variation belongs to UH.

        uh
        uhh
        uhhh
        uhhhh
        uhhhhh
    */

    if (
        /^uh+$/.test(
            normalized
        )
    ) {

        return "UH";

    }


    return normalized;

}


/* =========================================================
   ESCAPE REGEX
   ========================================================= */

function escapeRegex(text) {

    return String(text)
        .replace(
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
                    b.length -
                    a.length
            );


    /*
        IMPORTANT:

        These are raw regex expressions.

        um+ catches:

            um
            umm
            ummm
            ummmm
            etc.

        uh+ catches:

            uh
            uhh
            uhhh
            uhhhh
            etc.
    */

    words.push("um+");

    words.push("uh+");


    const unique =
        [...new Set(words)];


    const patterns =
        unique.map(
            word => {

                if (
                    word === "um+" ||
                    word === "uh+"
                ) {

                    return word;

                }

                return escapeRegex(
                    word
                );

            }
        );


    /*
        Do NOT use \b at the end for the
        natural UM/UH family because browser
        speech recognition can sometimes
        attach punctuation oddly.

        Whitespace / punctuation boundaries
        are handled explicitly instead.
    */

    return new RegExp(
        `(^|[\\s.,!?;:()[\\]{}"'\\-])(${patterns.join("|")})(?=$|[\\s.,!?;:()[\\]{}"'\\-])`,
        "gi"
    );

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
   GET FILLER MATCHES
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
        (match =
            regex.exec(text)) !==
        null
    ) {

        matches.push({

            word:
                match[2],

            index:
                match.index +
                match[1].length,

            end:
                match.index +
                match[1].length +
                match[2].length

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

        return escapeHTML(
            text
        );

    }


    let result =
        "";

    let lastIndex =
        0;


    for (
        const match of matches
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
            escapeHTML(
                match.word
            ) +
            `</span>`;


        lastIndex =
            match.end;

    }


    result +=
        escapeHTML(
            text.slice(
                lastIndex
            )
        );


    return result;

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


    return getFillerMatches(
        text
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


    updateStats(
        liveTranscript
    );

}


/* =========================================================
   RENDER FINAL TRANSCRIPT
   ========================================================= */

function renderFinalTranscript() {

    if (!finalTranscriptElement) {

        return;

    }


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


    wordList.innerHTML =
        "";


    trackedWords.forEach(
        (word, index) => {

            const tag =
                document.createElement(
                    "div"
                );


            tag.className =
                "word-tag";


            tag.innerHTML = `
                <span>
                    ${escapeHTML(word)}
                </span>

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
   ADD TRACKED WORD
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


    const exists =
        trackedWords.some(
            existing =>
                normalizeWord(
                    existing
                ) === word
        );


    if (exists) {

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
   REMOVE TRACKED WORD
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
                Number.isInteger(index) &&
                index >= 0 &&
                index < trackedWords.length
            ) {

                trackedWords.splice(
                    index,
                    1
                );


                saveTrackedWords();

                renderWordList();

            }

        }
    );

}


/* =========================================================
   RESET TRACKED WORDS
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
   ADD WORD BUTTON
   ========================================================= */

if (addWordButton) {

    addWordButton.addEventListener(
        "click",
        addTrackedWord
    );

}


/* =========================================================
   ENTER TO ADD WORD
   ========================================================= */

if (customWordInput) {

    customWordInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                addTrackedWord();

            }

        }
    );

}


/* =========================================================
   NOTIFICATION SUPPORT
   ========================================================= */

function notificationsSupported() {

    return (
        "Notification" in window
    );

}


/* =========================================================
   SETUP SERVICE WORKER
   ========================================================= */

async function setupNotifications() {

    if (
        !notificationsSupported()
    ) {

        return null;

    }


    if (
        !("serviceWorker" in navigator)
    ) {

        console.warn(
            "Service Workers are not supported."
        );

        return null;

    }


    try {

        notificationRegistration =
            await navigator.serviceWorker.register(
                "/sw.js",
                {
                    scope: "/"
                }
            );


        await navigator.serviceWorker.ready;


        console.log(
            "Speech Tracker notification service worker ready."
        );


        return notificationRegistration;

    } catch (error) {

        console.error(
            "Could not register notification service worker:",
            error
        );


        return null;

    }

}


/* =========================================================
   NOTIFICATION UI
   ========================================================= */

function updateNotificationUI(
    permission
) {

    if (
        !notificationStatus ||
        !enableNotificationsButton
    ) {

        return;

    }


    if (
        permission ===
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

        return;

    }


    if (
        permission ===
        "denied"
    ) {

        notificationStatus.textContent =
            "Notifications are blocked in your browser.";

        notificationStatus.classList.remove(
            "enabled"
        );

        enableNotificationsButton.textContent =
            "Notifications Blocked";

        enableNotificationsButton.disabled =
            false;

        return;

    }


    notificationStatus.textContent =
        "Enable notifications to get filler alerts.";

    notificationStatus.classList.remove(
        "enabled"
    );

}


/* =========================================================
   REQUEST NOTIFICATION PERMISSION
   ========================================================= */

async function enableNotifications() {

    if (
        !notificationsSupported()
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


        updateNotificationUI(
            permission
        );


        if (
            permission ===
            "granted"
        ) {

            await setupNotifications();


            /*
                Send one test notification so we know
                the permission actually works.
            */

            try {

                if (
                    notificationRegistration &&
                    notificationRegistration.showNotification
                ) {

                    await notificationRegistration.showNotification(
                        "Speech Tracker",
                        {
                            body:
                                "Notifications are working!",

                            icon:
                                "/icon.svg",

                            badge:
                                "/icon.svg",

                            tag:
                                "speech-tracker-test",

                            renotify:
                                false
                        }
                    );

                } else {

                    new Notification(
                        "Speech Tracker",
                        {
                            body:
                                "Notifications are working!"
                        }
                    );

                }

            } catch (error) {

                console.warn(
                    "Test notification failed:",
                    error
                );

            }

        }

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

    }

}


/* =========================================================
   NOTIFICATION BUTTON
   ========================================================= */

if (
    enableNotificationsButton
) {

    enableNotificationsButton.addEventListener(
        "click",
        enableNotifications
    );

}


/* =========================================================
   SEND FILLER NOTIFICATION
   ========================================================= */

function sendFillerNotification(
    word
) {

    if (
        !notificationsSupported()
    ) {

        return;

    }


    if (
        Notification.permission !==
        "granted"
    ) {

        return;

    }


    const now =
        Date.now();


    const family =
        fillerFamily(
            word
        );


    /*
        Tiny debounce.

        This is NOT the primary duplicate protection.

        It only protects against browsers firing
        two events within a few milliseconds.
    */

    if (
        family ===
            lastFillerNotificationFamily &&
        now -
            lastFillerNotificationTime <
            120
    ) {

        return;

    }


    lastFillerNotificationFamily =
        family;

    lastFillerNotificationTime =
        now;


    const options = {

        body:
            `You said "${word}"`,

        icon:
            "/icon.svg",

        badge:
            "/icon.svg",

        /*
            Same tag prevents a pile of old filler
            notifications.

            The content gets replaced by the newest
            filler notification.
        */

        tag:
            "speech-tracker-filler",

        renotify:
            true,

        vibrate:
            [70, 25, 70],

        data:
            {
                url:
                    window.location.href
            }

    };


    /*
        Service Worker notification.
    */

    if (
        notificationRegistration &&
        typeof
            notificationRegistration.showNotification ===
            "function"
    ) {

        notificationRegistration
            .showNotification(
                "Speech Tracker",
                options
            )
            .catch(
                error => {

                    console.error(
                        "Service Worker notification failed:",
                        error
                    );

                }
            );


        return;

    }


    /*
        Desktop fallback.
    */

    try {

        const notification =
            new Notification(
                "Speech Tracker",
                options
            );


        notification.onclick =
            () => {

                try {

                    window.focus();

                } catch (_) {}


                notification.close();

            };


        setTimeout(
            () => {

                try {

                    notification.close();

                } catch (_) {}

            },
            1200
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

            /*
                Very fast vibration.

                Notification happens separately.
            */

            navigator.vibrate(
                [
                    45,
                    20,
                    45
                ]
            );

        }

    } catch (_) {}

}


/* =========================================================
   RESET FILLER DETECTION
   ========================================================= */

function resetLiveDetectionState() {

    detectedFillerOccurrences.clear();


    lastFillerNotificationTime =
        0;


    lastFillerNotificationFamily =
        "";

}


/* =========================================================
   GET FILLER OCCURRENCE ID
   ========================================================= */

function getFillerOccurrenceId(
    text,
    match
) {

    /*
        We use the words immediately before the filler
        as context.

        This means:

            "I was um"

        and the evolving interim versions:

            "I was um"
            "I was umm"
            "I was ummm"

        are treated as ONE occurrence.

        But:

            "I was um ... and then um"

        creates two different occurrences because
        their surrounding context differs.
    */

    const before =
        text
            .slice(
                0,
                match.index
            )
            .toLowerCase()
            .replace(
                /[^a-z0-9'\s]/g,
                ""
            )
            .split(/\s+/)
            .filter(Boolean)
            .slice(-7)
            .join(" ");


    const family =
        fillerFamily(
            match.word
        );


    return (
        family +
        "|" +
        before
    );

}


/* =========================================================
   DETECT NEW FILLERS
   ========================================================= */

function detectNewFillers(
    text
) {

    if (
        !text ||
        !isRecording
    ) {

        return;

    }


    const matches =
        getFillerMatches(
            text
        );


    for (
        const match of matches
    ) {

        const occurrenceId =
            getFillerOccurrenceId(
                text,
                match
            );


        /*
            Already detected?

            DO NOT notify again.
        */

        if (
            detectedFillerOccurrences.has(
                occurrenceId
            )
        ) {

            continue;

        }


        detectedFillerOccurrences.add(
            occurrenceId
        );


        /*
            IMPORTANT:

            VIBRATION FIRST.

            Notification does not block this.
        */

        vibrateForFiller();


        /*
            Notification immediately after vibration.
        */

        sendFillerNotification(
            match.word
        );

    }

}


/* =========================================================
   DETECT INTERIM FILLERS
   ========================================================= */

function detectInterimFillers(
    interimText
) {

    if (!interimText) {

        return;

    }


    /*
        Scan immediately.

        We don't wait for isFinal.
    */

    detectNewFillers(
        interimText
    );

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
        CRITICAL:

        true lets us see interim speech.

        Without this, UM/UH detection is delayed until
        the browser finishes the phrase.
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


            if (statusText) {

                statusText.textContent =
                    "Listening";

            }


            if (statusDot) {

                statusDot.className =
                    "status-dot listening";

            }

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

                if (statusText) {

                    statusText.textContent =
                        "Microphone permission needed";

                }


                if (statusDot) {

                    statusDot.className =
                        "status-dot error";

                }


                recognitionShouldRun =
                    false;

            }

        };


    recognition.onend =
        () => {

            if (
                recognitionShouldRun &&
                isRecording
            ) {

                /*
                    Restart quickly.

                    20ms prevents InvalidStateError
                    in some browsers.
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
                    20
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

    if (!isRecording) {

        return;

    }


    let allFinal = [];

    let allInterim = [];


    /*
        Reconstruct the complete recognition state.

        This is important because SpeechRecognition
        retains previous results.
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

            allFinal.push(
                transcript
            );

        } else {

            allInterim.push(
                transcript
            );

        }

    }


    const cleanFinal =
        allFinal
            .join(" ")
            .trim();


    const cleanInterim =
        allInterim
            .join(" ")
            .trim();


    /*
        MAIN SPEED IMPROVEMENT:

        Check interim speech immediately.

        This is what gives us the best chance of catching:

            ummmm
            uhhhh
    */

    if (
        cleanInterim
    ) {

        detectInterimFillers(
            cleanInterim
        );

    }


    /*
        Also check final speech.
    */

    if (
        cleanFinal
    ) {

        detectNewFillers(
            cleanFinal
        );

    }


    /*
        Update visible transcript.
    */

    liveTranscript =
        [
            cleanFinal,
            cleanInterim
        ]
            .filter(Boolean)
            .join(" ")
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    renderLiveTranscript();

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
        const type of options
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
        NEVER show save UI at startup.
    */

    if (savePrompt) {

        savePrompt.hidden =
            true;

    }


    try {

        const stream =
            await navigator.mediaDevices
                .getUserMedia(
                    {
                        audio: {
                            echoCancellation:
                                true,

                            noiseSuppression:
                                true,

                            autoGainControl:
                                true
                        }
                    }
                );


        audioChunks =
            [];


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


        resetLiveDetectionState();


        if (analysisElement) {

            analysisElement.innerHTML =
                "";

        }


        if (analysisLoading) {

            analysisLoading.hidden =
                true;

        }


        if (
            finalTranscriptElement
        ) {

            finalTranscriptElement.textContent =
                "Your completed speech will appear here.";

        }


        if (
            fillerCountElement
        ) {

            fillerCountElement.textContent =
                "0";

        }


        if (
            wordCountElement
        ) {

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
            Small chunks allow the browser to collect
            audio efficiently.
        */

        mediaRecorder.start(
            250
        );


        isRecording =
            true;


        isStopping =
            false;


        recordingStartTime =
            Date.now();


        startTimer();


        if (listenButton) {

            listenButton.disabled =
                true;

        }


        if (stopButton) {

            stopButton.disabled =
                false;

        }


        if (statusText) {

            statusText.textContent =
                "Listening";

        }


        if (statusDot) {

            statusDot.className =
                "status-dot listening";

        }


        /*
            Recognition starts after recording is active.
        */

        startRecognition();


    } catch (error) {

        console.error(
            "Could not start recording:",
            error
        );


        if (statusText) {

            statusText.textContent =
                "Microphone unavailable";

        }


        if (statusDot) {

            statusDot.className =
                "status-dot error";

        }


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


    if (listenButton) {

        listenButton.disabled =
            false;

    }


    if (stopButton) {

        stopButton.disabled =
            true;

    }


    if (statusText) {

        statusText.textContent =
            "Processing";

    }


    if (statusDot) {

        statusDot.className =
            "status-dot";

    }


    /*
        Give the final recognition result a moment.
    */

    await wait(
        250
    );


    finalTranscript =
        liveTranscript.trim();


    renderFinalTranscript();


    updateStats(
        finalTranscript
    );


    if (analyzeButton) {

        analyzeButton.disabled =
            !finalTranscript;

    }


    if (statusText) {

        statusText.textContent =
            "Finished";

    }


    /*
        SAVE PROMPT ONLY APPEARS AFTER A SPEECH.

        It does NOT appear on startup.
    */

    if (
        finalTranscript &&
        savePrompt
    ) {

        savePrompt.hidden =
            false;

    }


    /*
        Request the higher-quality final transcription.
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


                if (analyzeButton) {

                    analyzeButton.disabled =
                        false;

                }

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
                type:
                    mimeType
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
                method:
                    "POST",

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
                        ) /
                        1000
                    );


                if (
                    recordingTimer
                ) {

                    recordingTimer.textContent =
                        formatTime(
                            elapsed
                        );

                }

            },
            250
        );

}


/* =========================================================
   STOP TIMER
   ========================================================= */

function stopTimer() {

    if (
        timerInterval
    ) {

        clearInterval(
            timerInterval
        );


        timerInterval =
            null;

    }

}


/* =========================================================
   FORMAT TIME
   ========================================================= */

function formatTime(
    seconds
) {

    const minutes =
        Math.floor(
            seconds /
            60
        );


    const remaining =
        seconds %
        60;


    return (
        String(
            minutes
        ).padStart(
            2,
            "0"
        ) +
        ":" +
        String(
            remaining
        ).padStart(
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


    if (analyzeButton) {

        analyzeButton.disabled =
            true;

    }


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
                    method:
                        "POST",

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
                data.details ||
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


        if (analysisElement) {

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

        }

    } finally {

        if (analysisLoading) {

            analysisLoading.hidden =
                true;

        }


        if (analyzeButton) {

            analyzeButton.disabled =
                !finalTranscript;

        }

    }

}


/* =========================================================
   ANALYZE BUTTON
   ========================================================= */

if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );

}


/* =========================================================
   RENDER AI ANALYSIS
   ========================================================= */

function renderAnalysis(
    data
) {

    if (!analysisElement) {

        return;

    }


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


    /*
        Handle plain string responses.
    */

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


    /*
        Handle APIs that return:

        {
            analysis: {
                ...
            }
        }
    */

    if (
        data.analysis &&
        typeof data.analysis ===
            "object" &&
        !Array.isArray(
            data.analysis
        )
    ) {

        data =
            data.analysis;

    }


    Object.entries(
        data
    ).forEach(
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
   RENDER AI VALUE
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

    Object.entries(
        object
    ).forEach(
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
   SIMPLE AI SECTION
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
            JSON.parse(
                data
            );


        return Array.isArray(
            parsed
        )
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


/* =========================================================
   SET SAVED SPEECHES
   ========================================================= */

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

    if (
        !savedSpeechesElement ||
        !savedSpeechCount
    ) {

        return;

    }


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


    setTimeout(
        () => {

            speechNameInput.focus();

        },
        50
    );

}


/* =========================================================
   CLOSE SAVE MODAL
   ========================================================= */

function closeSaveModal() {

    if (!saveModal) {

        return;

    }


    saveModal.hidden =
        true;

}


/* =========================================================
   SAVE CURRENT SPEECH
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

    }

}


/* =========================================================
   SAVE SPEECH BUTTON
   ========================================================= */

if (saveSpeechButton) {

    saveSpeechButton.addEventListener(
        "click",
        openSaveModal
    );

}


/* =========================================================
   DISCARD SPEECH
   ========================================================= */

if (discardSpeechButton) {

    discardSpeechButton.addEventListener(
        "click",
        () => {

            if (savePrompt) {

                savePrompt.hidden =
                    true;

            }

        }
    );

}


/* =========================================================
   CANCEL SAVE
   ========================================================= */

if (cancelSaveButton) {

    cancelSaveButton.addEventListener(
        "click",
        closeSaveModal
    );

}


/* =========================================================
   CONFIRM SAVE
   ========================================================= */

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


/* =========================================================
   SAVE MODAL KEYBOARD
   ========================================================= */

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


    if (
        currentAnalysis
    ) {

        renderAnalysis(
            currentAnalysis
        );

    } else if (
        analysisElement
    ) {

        analysisElement.innerHTML = `
            <div class="analysis-empty">
                This speech does not have an AI analysis yet.
            </div>
        `;

    }


    if (analyzeButton) {

        analyzeButton.disabled =
            !finalTranscript;

    }


    if (savePrompt) {

        savePrompt.hidden =
            true;

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


/* =========================================================
   APPLY THEME
   ========================================================= */

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


/* =========================================================
   THEME BUTTON
   ========================================================= */

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
                current ===
                    "dark"
                    ? "light"
                    : "dark"
            );

        }
    );

}


/* =========================================================
   SCROLL INDICATOR
   ========================================================= */

window.addEventListener(
    "scroll",
    () => {

        if (!scrollIndicator) {

            return;

        }


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


/* =========================================================
   RECORD BUTTONS
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
   SAVE MODAL BACKDROP
   ========================================================= */

if (saveModal) {

    saveModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                saveModal
            ) {

                closeSaveModal();

            }

        }
    );

}


/* =========================================================
   ESCAPE KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
                "Escape" &&
            saveModal &&
            !saveModal.hidden
        ) {

            closeSaveModal();

        }

    }
);


/* =========================================================
   UTILITY
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

async function initialize() {

    if (initialized) {

        return;

    }


    initialized =
        true;


    /*
        IMPORTANT:

        Never show the save menu on page load.
    */

    if (savePrompt) {

        savePrompt.hidden =
            true;

    }


    if (saveModal) {

        saveModal.hidden =
            true;

    }


    if (analysisLoading) {

        analysisLoading.hidden =
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
            "SpeechRecognition is not supported in this browser."
        );

    }


    /*
        Register the service worker.

        This does NOT ask for notification permission.
    */

    await setupNotifications();


    /*
        Update notification UI based on existing permission.
    */

    if (
        notificationsSupported()
    ) {

        updateNotificationUI(
            Notification.permission
        );

    }

}


/* =========================================================
   START APP
   ========================================================= */

initialize();