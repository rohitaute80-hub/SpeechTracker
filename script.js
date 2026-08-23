/* ============================================================
   SPEECH TRACKER — COMPLETE REPLACEMENT script.js

   Fixes:
   - Faster live filler detection
   - Detects um / umm / ummmm
   - Detects uh / uhh / uhhhh
   - Detects fillers in interim speech results
   - Prevents duplicate notifications for one filler
   - Accurate final filler highlighting
   - Independent saved-speech snapshots
   - Name saved speeches
   - Show saved-speech dates
   - Delete saved speeches
   - Open old speeches without overwriting current speech
   - Analyze button only activates after a real speech
   - Light/dark mode
   - Notifications
   - Vibration
   - Custom tracked words
   ============================================================ */


/* ============================================================
   CONFIGURATION
   ============================================================ */

const DEFAULT_WORDS = [
    "um",
    "uh",
    "like",
    "you know",
    "basically",
    "literally",
    "actually"
];

const STORAGE_WORDS = "speechTrackerWords";
const STORAGE_SPEECHES = "speechTrackerSavedSpeeches";
const STORAGE_THEME = "speechTrackerTheme";

let trackedWords = loadTrackedWords();
let savedSpeeches = loadSavedSpeeches();

let recognition = null;
let recognitionSupported = false;

let mediaRecorder = null;
let audioChunks = [];

let isRecording = false;
let recordingStarted = false;

let finalTranscript = "";
let liveTranscript = "";

let currentSpeechId = null;
let currentSpeechStartedAt = null;

let fillerCount = 0;
let wordCount = 0;

/*
   Keeps track of fillers that have already produced a
   notification during the current live recognition stream.

   This prevents:
      "umm"
      "umm"
      "umm"

   from repeatedly triggering notifications while the
   browser keeps sending the same interim result.
*/
let notifiedFillerOccurrences = new Set();

let notificationPermission = false;


/* ============================================================
   DOM HELPERS
   ============================================================ */

function $(id) {
    return document.getElementById(id);
}

function getElement(...ids) {
    for (const id of ids) {
        const element = $(id);
        if (element) return element;
    }

    return null;
}


/* ============================================================
   DOM ELEMENTS
   ============================================================ */

const listenButton = getElement(
    "listenButton",
    "startButton"
);

const stopButton = getElement(
    "stopButton"
);

const heardElement = getElement(
    "heard",
    "liveTranscript"
);

const finalTranscriptElement = getElement(
    "finalTranscript",
    "transcript",
    "transcription"
);

const fillerCountElement = getElement(
    "fillerCount"
);

const wordCountElement = getElement(
    "wordCount"
);

const statusElement = getElement(
    "status",
    "statusText"
);

const statusDot = getElement(
    "statusDot"
);

const analyzeButton = getElement(
    "analyzeButton"
);

const analysisElement = getElement(
    "analysis"
);

const analysisLoading = getElement(
    "analysisLoading"
);

const customWordInput = getElement(
    "customWordInput"
);

const addWordButton = getElement(
    "addWordButton"
);

const resetWordsButton = getElement(
    "resetWordsButton"
);

const wordList = getElement(
    "wordList"
);

const enableNotificationsButton = getElement(
    "enableNotifications",
    "enableNotificationsButton"
);

const notificationStatus = getElement(
    "notificationStatus"
);

const savedSpeechesElement = getElement(
    "savedSpeeches",
    "speechHistory",
    "savedSpeechList"
);

const saveSpeechButton = getElement(
    "saveSpeechButton",
    "saveButton"
);

const speechNameInput = getElement(
    "speechNameInput",
    "speechTitleInput"
);

const themeToggle = getElement(
    "themeToggle",
    "themeButton"
);


/* ============================================================
   STORAGE
   ============================================================ */

function loadTrackedWords() {
    try {
        const stored = localStorage.getItem(STORAGE_WORDS);

        if (!stored) {
            return [...DEFAULT_WORDS];
        }

        const parsed = JSON.parse(stored);

        if (!Array.isArray(parsed)) {
            return [...DEFAULT_WORDS];
        }

        return parsed
            .map(word => String(word).trim())
            .filter(Boolean);

    } catch (error) {
        console.error(
            "Could not load tracked words:",
            error
        );

        return [...DEFAULT_WORDS];
    }
}


function saveTrackedWords() {
    localStorage.setItem(
        STORAGE_WORDS,
        JSON.stringify(trackedWords)
    );
}


function loadSavedSpeeches() {
    try {
        const stored = localStorage.getItem(
            STORAGE_SPEECHES
        );

        if (!stored) {
            return [];
        }

        const parsed = JSON.parse(stored);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed;

    } catch (error) {
        console.error(
            "Could not load saved speeches:",
            error
        );

        return [];
    }
}


function persistSavedSpeeches() {
    localStorage.setItem(
        STORAGE_SPEECHES,
        JSON.stringify(savedSpeeches)
    );
}


/* ============================================================
   THEME
   ============================================================ */

function initializeTheme() {

    const storedTheme =
        localStorage.getItem(STORAGE_THEME);

    const theme =
        storedTheme === "dark"
            ? "dark"
            : "light";

    document.documentElement.dataset.theme =
        theme;

    updateThemeButton(theme);
}


function toggleTheme() {

    const current =
        document.documentElement.dataset.theme ||
        "light";

    const next =
        current === "dark"
            ? "light"
            : "dark";

    document.documentElement.dataset.theme =
        next;

    localStorage.setItem(
        STORAGE_THEME,
        next
    );

    updateThemeButton(next);
}


function updateThemeButton(theme) {

    if (!themeToggle) return;

    themeToggle.textContent =
        theme === "dark"
            ? "Light"
            : "Dark";

    themeToggle.setAttribute(
        "aria-label",
        theme === "dark"
            ? "Switch to light mode"
            : "Switch to dark mode"
    );
}


if (themeToggle) {
    themeToggle.addEventListener(
        "click",
        toggleTheme
    );
}

initializeTheme();


/* ============================================================
   STATUS
   ============================================================ */

function setStatus(text, type = "ready") {

    if (statusElement) {
        statusElement.textContent = text;
    }

    if (statusDot) {

        statusDot.classList.remove(
            "ready",
            "listening",
            "error"
        );

        statusDot.classList.add(type);
    }
}


/* ============================================================
   WORD NORMALIZATION
   ============================================================ */

/*
   Important:

   We do NOT simply search for "um".

   That would cause:

      um
      umm
      ummm
      yummy

   to behave incorrectly.

   Instead we recognize natural filler variants.
*/

function normalizeText(text) {

    return String(text || "")
        .toLowerCase()
        .replace(/[“”‘’]/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}


function escapeRegex(text) {

    return String(text)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


function createFillerPattern(word) {

    const normalized =
        normalizeText(word);

    /*
       Special handling for um / uh.

       This catches:
       um
       umm
       ummm
       uhm
       uh
       uhh
       uhhh
    */

    if (normalized === "um") {
        return "\\bumm*\\b";
    }

    if (normalized === "uh") {
        return "\\buhh*\\b";
    }

    /*
       Regular tracked words.

       Multi-word phrases such as:
       "you know"

       are handled safely.
    */

    return `\\b${escapeRegex(normalized)}\\b`;
}


function getFillerMatches(text) {

    const matches = [];

    const normalized =
        normalizeText(text);

    for (const word of trackedWords) {

        const pattern =
            createFillerPattern(word);

        let regex;

        try {
            regex = new RegExp(
                pattern,
                "gi"
            );
        } catch (error) {
            continue;
        }

        let match;

        while ((match = regex.exec(normalized)) !== null) {

            matches.push({
                word,
                detected: match[0],
                index: match.index,
                length: match[0].length
            });

            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
        }
    }

    /*
       Sort by location so the transcript highlighting
       appears naturally.
    */

    matches.sort(
        (a, b) => a.index - b.index
    );

    /*
       Remove overlapping matches.

       Example:
       "uh" should not also be counted inside "uhh".
    */

    const filtered = [];

    for (const match of matches) {

        const previous =
            filtered[filtered.length - 1];

        if (
            previous &&
            match.index <
                previous.index +
                previous.length
        ) {
            continue;
        }

        filtered.push(match);
    }

    return filtered;
}


/* ============================================================
   HIGHLIGHT TRANSCRIPT
   ============================================================ */

function highlightTranscript(text) {

    const safeText =
        String(text || "");

    if (!safeText) {
        return "";
    }

    const matches =
        getFillerMatches(safeText);

    if (!matches.length) {
        return escapeHtml(safeText);
    }

    let output = "";
    let cursor = 0;

    for (const match of matches) {

        output += escapeHtml(
            safeText.slice(
                cursor,
                match.index
            )
        );

        output +=
            `<span class="highlight">${escapeHtml(
                safeText.slice(
                    match.index,
                    match.index +
                    match.length
                )
            )}</span>`;

        cursor =
            match.index +
            match.length;
    }

    output += escapeHtml(
        safeText.slice(cursor)
    );

    return output;
}


function escapeHtml(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ============================================================
   WORD COUNTER
   ============================================================ */

function countWords(text) {

    const cleaned =
        normalizeText(text);

    if (!cleaned) {
        return 0;
    }

    return cleaned
        .split(/\s+/)
        .filter(Boolean)
        .length;
}


function updateStats(text) {

    const matches =
        getFillerMatches(text);

    fillerCount =
        matches.length;

    wordCount =
        countWords(text);

    if (fillerCountElement) {
        fillerCountElement.textContent =
            fillerCount;
    }

    if (wordCountElement) {
        wordCountElement.textContent =
            wordCount;
    }
}


/* ============================================================
   LIVE FILLER DETECTION
   ============================================================ */

function detectLiveFillers(text) {

    if (!isRecording) {
        return;
    }

    const matches =
        getFillerMatches(text);

    /*
       We create an occurrence key using:

       filler + surrounding transcript position

       This is important because interim recognition
       constantly repeats the same words.

       Example interim results:

       "I"
       "I um"
       "I um I"
       "I um I think"

       We don't want four notifications for the
       same "um".
    */

    for (const match of matches) {

        const before =
            normalizeText(
                text.slice(
                    Math.max(
                        0,
                        match.index - 30
                    ),
                    match.index
                )
            );

        const key =
            `${match.word}|${before}`;

        if (
            notifiedFillerOccurrences.has(key)
        ) {
            continue;
        }

        /*
           Avoid duplicate notification if the exact
           detected phrase was already notified very
           recently.
        */

        const now =
            Date.now();

        const recentKey =
            `${match.word}|recent`;

        if (
            window._recentFiller &&
            window._recentFiller.word ===
                match.word &&
            now -
                window._recentFiller.time <
                650
        ) {
            continue;
        }

        window._recentFiller = {
            word: match.word,
            time: now
        };

        notifiedFillerOccurrences.add(
            key
        );

        triggerFillerAlert(
            match.detected
        );
    }
}


/* ============================================================
   FILLER ALERT
   ============================================================ */

function triggerFillerAlert(word) {

    /*
       Vibration is attempted immediately.
    */

    try {

        if (
            "vibrate" in navigator
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


    /*
       Browser notification.
    */

    if (
        "Notification" in window &&
        Notification.permission ===
            "granted"
    ) {

        try {

            new Notification(
                "Speech Tracker",
                {
                    body:
                        `Filler word detected: "${word}"`,
                    tag:
                        `filler-${Date.now()}`,
                    renotify: false
                }
            );

        } catch (error) {

            console.warn(
                "Notification failed:",
                error
            );
        }
    }


    /*
       In-app visual feedback.
    */

    showFillerOverlay(word);
}


function showFillerOverlay(word) {

    const existing =
        document.querySelector(
            ".filler-alert"
        );

    if (existing) {
        existing.remove();
    }

    const alert =
        document.createElement("div");

    alert.className =
        "filler-alert";

    alert.innerHTML =
        `<strong>Filler detected</strong>
         <span>"${escapeHtml(word)}"</span>`;

    document.body.appendChild(alert);

    requestAnimationFrame(() => {
        alert.classList.add("show");
    });

    setTimeout(() => {

        alert.classList.remove("show");

        setTimeout(() => {
            alert.remove();
        }, 250);

    }, 900);
}


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

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

        notificationPermission =
            permission === "granted";

        updateNotificationStatus();

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );
    }
}


function updateNotificationStatus() {

    if (!notificationStatus) {
        return;
    }

    if (
        !("Notification" in window)
    ) {

        notificationStatus.textContent =
            "Notifications are not supported.";

        return;
    }

    const permission =
        Notification.permission;

    if (permission === "granted") {

        notificationStatus.textContent =
            "Notifications are enabled.";

    } else if (permission === "denied") {

        notificationStatus.textContent =
            "Notifications are blocked. Enable them in your browser settings.";

    } else {

        notificationStatus.textContent =
            "Notifications are not enabled.";
    }
}


if (enableNotificationsButton) {

    enableNotificationsButton.addEventListener(
        "click",
        enableNotifications
    );
}

updateNotificationStatus();


/* ============================================================
   CUSTOM WORDS
   ============================================================ */

function renderWordList() {

    if (!wordList) {
        return;
    }

    wordList.innerHTML = "";

    trackedWords.forEach(
        (word, index) => {

            const tag =
                document.createElement("span");

            tag.className =
                "word-tag";

            const text =
                document.createElement("span");

            text.textContent =
                word;

            const remove =
                document.createElement("button");

            remove.type =
                "button";

            remove.textContent =
                "×";

            remove.setAttribute(
                "aria-label",
                `Remove ${word}`
            );

            remove.addEventListener(
                "click",
                () => {

                    trackedWords.splice(
                        index,
                        1
                    );

                    saveTrackedWords();
                    renderWordList();
                }
            );

            tag.appendChild(text);
            tag.appendChild(remove);

            wordList.appendChild(tag);
        }
    );
}


function addTrackedWord() {

    if (!customWordInput) {
        return;
    }

    const word =
        customWordInput.value.trim();

    if (!word) {
        return;
    }

    const exists =
        trackedWords.some(
            existing =>
                normalizeText(existing) ===
                normalizeText(word)
        );

    if (exists) {

        customWordInput.value = "";

        return;
    }

    trackedWords.push(word);

    saveTrackedWords();

    renderWordList();

    customWordInput.value = "";

    customWordInput.focus();
}


function resetTrackedWords() {

    trackedWords =
        [...DEFAULT_WORDS];

    saveTrackedWords();

    renderWordList();
}


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

            if (event.key === "Enter") {
                event.preventDefault();
                addTrackedWord();
            }
        }
    );
}


if (resetWordsButton) {

    resetWordsButton.addEventListener(
        "click",
        resetTrackedWords
    );
}

renderWordList();


/* ============================================================
   SPEECH RECOGNITION
   ============================================================ */

function initializeRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        recognitionSupported =
            false;

        console.warn(
            "SpeechRecognition is not supported."
        );

        return;
    }

    recognitionSupported =
        true;

    recognition =
        new SpeechRecognition();

    recognition.continuous =
        true;

    /*
       Interim results are CRITICAL.

       This is what lets us detect:

          um
          umm
          uhhh

       before the final transcription exists.
    */

    recognition.interimResults =
        true;

    recognition.maxAlternatives =
        1;

    /*
       en-US is generally reliable for this use case.
    */

    recognition.lang =
        "en-US";


    recognition.onstart = () => {

        setStatus(
            "Listening",
            "listening"
        );

        isRecording =
            true;
    };


    recognition.onresult = event => {

        let interim = "";
        let finalized = "";

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

                finalized +=
                    transcript + " ";

            } else {

                interim +=
                    transcript + " ";
            }
        }


        /*
           Keep our own final browser transcript.
        */

        if (finalized) {

            liveTranscript +=
                finalized;

        }


        const displayTranscript =
            (
                liveTranscript +
                interim
            ).trim();


        /*
           Update screen immediately.
        */

        if (heardElement) {

            heardElement.innerHTML =
                displayTranscript
                    ? highlightTranscript(
                        displayTranscript
                    )
                    : "Listening...";
        }


        /*
           THIS is the important part.

           We run filler detection against
           INTERIM results immediately.

           It does not wait for OpenAI.
        */

        if (interim) {

            detectLiveFillers(
                liveTranscript +
                interim
            );
        }


        /*
           Also check finalized browser results.
        */

        if (finalized) {

            detectLiveFillers(
                liveTranscript
            );
        }


        updateStats(
            displayTranscript
        );
    };


    recognition.onerror = event => {

        console.warn(
            "Speech recognition error:",
            event.error
        );

        /*
           "no-speech" is not a real failure.
        */

        if (
            event.error ===
            "no-speech"
        ) {
            return;
        }

        if (
            event.error ===
            "aborted"
        ) {
            return;
        }

        setStatus(
            "Recognition error",
            "error"
        );
    };


    recognition.onend = () => {

        /*
           Chrome can automatically end recognition
           even when continuous=true.

           Restart it while the user is still recording.
        */

        if (isRecording) {

            try {

                recognition.start();

            } catch (error) {
                console.warn(
                    "Could not restart recognition:",
                    error
                );
            }

            return;
        }

        setStatus(
            "Ready",
            "ready"
        );
    };
}


initializeRecognition();


/* ============================================================
   MEDIA RECORDER
   ============================================================ */

async function startMediaRecorder(
    stream
) {

    audioChunks = [];

    let mimeType = "";

    if (
        MediaRecorder.isTypeSupported(
            "audio/webm;codecs=opus"
        )
    ) {

        mimeType =
            "audio/webm;codecs=opus";

    } else if (
        MediaRecorder.isTypeSupported(
            "audio/webm"
        )
    ) {

        mimeType =
            "audio/webm";

    } else if (
        MediaRecorder.isTypeSupported(
            "audio/mp4"
        )
    ) {

        mimeType =
            "audio/mp4";
    }


    try {

        mediaRecorder =
            mimeType
                ? new MediaRecorder(
                    stream,
                    { mimeType }
                )
                : new MediaRecorder(
                    stream
                );

    } catch (error) {

        console.error(
            "MediaRecorder creation failed:",
            error
        );

        mediaRecorder = null;

        return;
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


    mediaRecorder.start(
        250
    );
}


/* ============================================================
   START RECORDING
   ============================================================ */

async function startRecording() {

    if (isRecording) {
        return;
    }

    /*
       Reset EVERYTHING for the new speech.
    */

    finalTranscript = "";
    liveTranscript = "";

    fillerCount = 0;
    wordCount = 0;

    currentSpeechId =
        crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;

    currentSpeechStartedAt =
        new Date().toISOString();

    notifiedFillerOccurrences =
        new Set();

    window._recentFiller =
        null;

    recordingStarted =
        false;


    if (analysisElement) {
        analysisElement.innerHTML = "";
    }

    if (analysisLoading) {
        analysisLoading.hidden = true;
    }


    if (analyzeButton) {

        analyzeButton.disabled =
            true;
    }


    /*
       Get microphone immediately.
    */

    let stream;

    try {

        stream =
            await navigator.mediaDevices.getUserMedia(
                {
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                }
            );

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

        setStatus(
            "Microphone unavailable",
            "error"
        );

        return;
    }


    isRecording =
        true;

    recordingStarted =
        true;


    if (listenButton) {
        listenButton.disabled =
            true;
    }

    if (stopButton) {
        stopButton.disabled =
            false;
    }


    if (heardElement) {

        heardElement.innerHTML =
            "Listening...";
    }


    setStatus(
        "Listening",
        "listening"
    );


    /*
       Start browser recognition FIRST.

       This gives us the fastest possible
       live filler detection.
    */

    if (
        recognitionSupported &&
        recognition
    ) {

        try {

            recognition.start();

        } catch (error) {

            console.warn(
                "Recognition start error:",
                error
            );
        }
    }


    /*
       Start recording independently.
    */

    await startMediaRecorder(
        stream
    );


    /*
       Save stream so stopRecording can
       stop microphone tracks.
    */

    window._speechStream =
        stream;
}


/* ============================================================
   STOP RECORDING
   ============================================================ */

async function stopRecording() {

    if (!isRecording) {
        return;
    }

    isRecording =
        false;


    if (stopButton) {
        stopButton.disabled =
            true;
    }


    setStatus(
        "Processing...",
        "ready"
    );


    /*
       Stop recognition.
    */

    if (recognition) {

        try {
            recognition.stop();
        } catch (error) {
            console.warn(
                "Recognition stop error:",
                error
            );
        }
    }


    /*
       Stop media recorder.
    */

    let audioBlob = null;

    if (mediaRecorder) {

        audioBlob =
            await new Promise(
                resolve => {

                    mediaRecorder.onstop =
                        () => {

                            if (
                                audioChunks.length
                            ) {

                                resolve(
                                    new Blob(
                                        audioChunks,
                                        {
                                            type:
                                                mediaRecorder.mimeType ||
                                                "audio/webm"
                                        }
                                    )
                                );

                            } else {

                                resolve(null);
                            }
                        };


                    try {
                        mediaRecorder.stop();
                    } catch (error) {
                        resolve(null);
                    }
                }
            );
    }


    /*
       Release microphone.
    */

    if (window._speechStream) {

        window._speechStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

        window._speechStream =
            null;
    }


    /*
       Use browser recognition transcript
       immediately while OpenAI processes
       the final audio.
    */

    const browserTranscript =
        liveTranscript.trim();


    if (browserTranscript) {

        finalTranscript =
            browserTranscript;

        displayTranscript(
            finalTranscript
        );
    }


    updateStats(
        finalTranscript
    );


    /*
       Analyze is now available because an
       actual recording has finished.
    */

    if (
        analyzeButton &&
        finalTranscript.trim()
    ) {

        analyzeButton.disabled =
            false;
    }


    /*
       If audio exists, get the more accurate
       final transcription from the backend.

       This happens AFTER the browser has
       already detected fillers.
    */

    if (audioBlob) {

        try {

            await transcribeAudio(
                audioBlob
            );

        } catch (error) {

            console.error(
                "Final transcription failed:",
                error
            );

            /*
               Keep browser transcript instead
               of losing the speech.
            */

            displayTranscript(
                finalTranscript
            );
        }
    }


    setStatus(
        "Speech finished",
        "ready"
    );


    /*
       Render the save option after the speech
       is actually finished.
    */

    showSavePrompt();
}


/* ============================================================
   FINAL TRANSCRIPTION
   ============================================================ */

async function transcribeAudio(
    audioBlob
) {

    setStatus(
        "Creating final transcript...",
        "ready"
    );


    const base64 =
        await blobToBase64(
            audioBlob
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
                body: JSON.stringify({
                    audio: base64
                })
            }
        );


    const text =
        await response.text();


    if (!response.ok) {

        throw new Error(
            `Transcription failed: ${text}`
        );
    }


    let data;

    try {

        data =
            JSON.parse(text);

    } catch (error) {

        throw new Error(
            "Transcription API returned invalid JSON."
        );
    }


    const transcript =
        data.transcript ||
        data.text ||
        data.result ||
        "";


    if (
        typeof transcript !==
        "string" ||
        !transcript.trim()
    ) {

        throw new Error(
            "No transcript returned."
        );
    }


    finalTranscript =
        transcript.trim();


    displayTranscript(
        finalTranscript
    );


    updateStats(
        finalTranscript
    );


    if (analyzeButton) {
        analyzeButton.disabled =
            false;
    }
}


function blobToBase64(blob) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onloadend =
                () => {

                    const result =
                        reader.result;

                    const comma =
                        result.indexOf(",");

                    resolve(
                        comma >= 0
                            ? result.slice(
                                comma + 1
                            )
                            : result
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


/* ============================================================
   DISPLAY TRANSCRIPT
   ============================================================ */

function displayTranscript(
    transcript
) {

    const highlighted =
        highlightTranscript(
            transcript
        );


    if (finalTranscriptElement) {

        finalTranscriptElement.innerHTML =
            highlighted;
    }


    /*
       Some versions of the UI only have #heard.
    */

    if (
        heardElement &&
        !isRecording
    ) {

        heardElement.innerHTML =
            highlighted ||
            "No speech recorded yet.";
    }


    updateStats(
        transcript
    );
}


/* ============================================================
   BUTTON EVENTS
   ============================================================ */

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


/* ============================================================
   ANALYZE SPEECH
   ============================================================ */

async function analyzeSpeech() {

    /*
       Never analyze before a speech exists.
    */

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {

        return;
    }


    if (isRecording) {
        return;
    }


    if (analyzeButton) {
        analyzeButton.disabled =
            true;
    }


    if (analysisLoading) {

        analysisLoading.hidden =
            false;

        analysisLoading.textContent =
            "Analyzing your speech...";
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
                    body: JSON.stringify({
                        transcript:
                            finalTranscript
                    })
                }
            );


        const responseText =
            await response.text();


        if (!response.ok) {

            throw new Error(
                `Analysis failed: ${responseText}`
            );
        }


        let data;

        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (error) {

            throw new Error(
                "The analysis API returned invalid JSON."
            );
        }


        /*
           Your API may return either:

              analysis
           or
              analysisData
        */

        if (
            data.analysisData
        ) {

            renderStructuredAnalysis(
                data.analysisData
            );

        } else if (
            typeof data.analysis ===
            "string"
        ) {

            renderAnalysisText(
                data.analysis
            );

        } else {

            throw new Error(
                "No analysis was returned."
            );
        }


    } catch (error) {

        console.error(
            "AI analysis error:",
            error
        );

        if (analysisElement) {

            analysisElement.innerHTML =
                `<div class="analysis-error">
                    <strong>Analysis failed</strong>
                    <p>${escapeHtml(
                        error.message ||
                        "Could not analyze the speech."
                    )}</p>
                </div>`;
        }

    } finally {

        if (analysisLoading) {
            analysisLoading.hidden =
                true;
        }

        if (analyzeButton) {

            /*
               Leave it enabled so the user can
               analyze again.
            */

            analyzeButton.disabled =
                !finalTranscript.trim();
        }
    }
}


function renderStructuredAnalysis(
    data
) {

    if (!analysisElement) {
        return;
    }


    const sections = [
        [
            "Overall",
            data.overall
        ],
        [
            "Filler Words",
            data.fillerWords
        ],
        [
            "Clarity",
            data.clarity
        ],
        [
            "Strength",
            data.strength
        ],
        [
            "Improvement",
            data.improvement
        ],
        [
            "Tip",
            data.tip
        ],
        [
            "Speech Sections",
            data.sections
        ],
        [
            "Delivery",
            data.delivery
        ],
        [
            "Conciseness",
            data.conciseness
        ],
        [
            "Transitions",
            data.transitions
        ],
        [
            "Next Steps",
            data.nextSteps
        ]
    ];


    const html =
        sections
            .filter(
                ([, value]) =>
                    value !== undefined &&
                    value !== null &&
                    String(value).trim()
            )
            .map(
                ([title, value]) => {

                    return `
                        <div class="analysis-section">
                            <h3>${escapeHtml(
                                title
                            )}</h3>
                            <p>${escapeHtml(
                                String(value)
                            )}</p>
                        </div>
                    `;
                }
            )
            .join("");


    analysisElement.innerHTML =
        html ||
        `<p>No analysis was returned.</p>`;
}


function renderAnalysisText(
    text
) {

    if (!analysisElement) {
        return;
    }


    /*
       Keep paragraphs separated instead of
       displaying one giant clump of text.
    */

    const paragraphs =
        String(text)
            .split(/\n\s*\n/)
            .map(
                paragraph =>
                    paragraph.trim()
            )
            .filter(Boolean);


    analysisElement.innerHTML =
        paragraphs
            .map(
                paragraph => `
                    <div class="analysis-section">
                        <p>${escapeHtml(
                            paragraph
                        )}</p>
                    </div>
                `
            )
            .join("");
}


if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );
}


/* ============================================================
   SAVED SPEECHES
   ============================================================ */

/*
   IMPORTANT FIX:

   Every saved speech gets its own COMPLETE snapshot.

   We never store references to:
      finalTranscript
      analysisElement
      current speech

   Instead we store plain strings/data.

   This fixes the problem where opening an old speech
   displayed the current speech.
*/


function createSpeechSnapshot(
    name
) {

    const analysis =
        analysisElement
            ? analysisElement.innerHTML
            : "";


    return {
        id:
            currentSpeechId ||
            `${Date.now()}-${Math.random()}`,

        name:
            name ||
            "Untitled Speech",

        date:
            new Date().toISOString(),

        transcript:
            String(finalTranscript || ""),

        fillerCount:
            getFillerMatches(
                finalTranscript
            ).length,

        wordCount:
            countWords(
                finalTranscript
            ),

        analysis:
            String(analysis || "")
    };
}


/* ============================================================
   SAVE PROMPT
   ============================================================ */

function showSavePrompt() {

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {
        return;
    }


    /*
       If the current UI already has a save
       section, reveal it.
    */

    const saveArea =
        getElement(
            "saveSpeechArea",
            "savePrompt"
        );


    if (saveArea) {

        saveArea.hidden =
            false;

        saveArea.classList.add(
            "visible"
        );

        return;
    }


    /*
       Otherwise create a clean save prompt.
    */

    const existing =
        document.querySelector(
            ".generated-save-prompt"
        );

    if (existing) {
        existing.remove();
    }


    const prompt =
        document.createElement("section");

    prompt.className =
        "card generated-save-prompt";


    prompt.innerHTML = `
        <div class="save-prompt-content">
            <div>
                <h2>Save Speech?</h2>
                <p class="info">
                    Keep this speech in your speech history.
                </p>
            </div>

            <div class="save-actions">

                <button
                    type="button"
                    class="button primary"
                    id="generatedSaveSpeechButton"
                >
                    ✓ Save Speech
                </button>

                <button
                    type="button"
                    class="button secondary"
                    id="generatedDismissSaveButton"
                >
                    × Don't Save
                </button>

            </div>
        </div>
    `;


    /*
       Put the prompt directly before saved speeches,
       if that section exists.
    */

    if (savedSpeechesElement) {

        savedSpeechesElement.parentElement
            ?.before(prompt);

    } else {

        document
            .querySelector("main")
            ?.appendChild(prompt);
    }


    document
        .getElementById(
            "generatedSaveSpeechButton"
        )
        ?.addEventListener(
            "click",
            () => {

                saveCurrentSpeech();

                prompt.remove();
            }
        );


    document
        .getElementById(
            "generatedDismissSaveButton"
        )
        ?.addEventListener(
            "click",
            () => {

                prompt.remove();
            }
        );
}


/* ============================================================
   SAVE CURRENT SPEECH
   ============================================================ */

function saveCurrentSpeech() {

    if (
        !finalTranscript ||
        !finalTranscript.trim()
    ) {
        return;
    }


    let name =
        speechNameInput?.value?.trim() ||
        "";


    if (!name) {

        name =
            window.prompt(
                "Name this speech:",
                `Speech ${savedSpeeches.length + 1}`
            ) ||
            `Speech ${savedSpeeches.length + 1}`;
    }


    const snapshot =
        createSpeechSnapshot(
            name
        );


    /*
       Prevent duplicate save of the exact same
       speech ID.
    */

    const existingIndex =
        savedSpeeches.findIndex(
            speech =>
                speech.id ===
                snapshot.id
        );


    if (existingIndex >= 0) {

        savedSpeeches[
            existingIndex
        ] = snapshot;

    } else {

        savedSpeeches.unshift(
            snapshot
        );
    }


    persistSavedSpeeches();

    renderSavedSpeeches();


    if (speechNameInput) {
        speechNameInput.value = "";
    }
}


/* ============================================================
   RENDER SAVED SPEECHES
   ============================================================ */

function renderSavedSpeeches() {

    if (!savedSpeechesElement) {
        return;
    }


    savedSpeechesElement.innerHTML = "";


    if (!savedSpeeches.length) {

        savedSpeechesElement.innerHTML =
            `<p class="info">
                No saved speeches yet.
            </p>`;

        return;
    }


    savedSpeeches.forEach(
        speech => {

            const item =
                document.createElement("div");

            item.className =
                "saved-speech-item";


            const date =
                formatSpeechDate(
                    speech.date
                );


            item.innerHTML = `
                <div class="saved-speech-info">

                    <strong>
                        ${escapeHtml(
                            speech.name ||
                            "Untitled Speech"
                        )}
                    </strong>

                    <span>
                        ${escapeHtml(date)}
                    </span>

                </div>

                <div class="saved-speech-actions">

                    <button
                        type="button"
                        class="button secondary saved-open"
                    >
                        Open
                    </button>

                    <button
                        type="button"
                        class="button secondary saved-delete"
                    >
                        Delete
                    </button>

                </div>
            `;


            const openButton =
                item.querySelector(
                    ".saved-open"
                );


            const deleteButton =
                item.querySelector(
                    ".saved-delete"
                );


            openButton?.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    openSavedSpeech(
                        speech.id
                    );
                }
            );


            deleteButton?.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    deleteSavedSpeech(
                        speech.id
                    );
                }
            );


            /*
               Clicking the card itself also opens it.
            */

            item.addEventListener(
                "click",
                event => {

                    if (
                        event.target.closest(
                            "button"
                        )
                    ) {
                        return;
                    }

                    openSavedSpeech(
                        speech.id
                    );
                }
            );


            savedSpeechesElement.appendChild(
                item
            );
        }
    );
}


function formatSpeechDate(
    date
) {

    try {

        return new Date(
            date
        ).toLocaleString(
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

        return "Unknown date";
    }
}


/* ============================================================
   OPEN SAVED SPEECH
   ============================================================ */

/*
   IMPORTANT:

   Opening an old speech does NOT modify:

      finalTranscript
      liveTranscript
      currentSpeechId

   It creates a separate viewer.

   Therefore starting a new speech afterward cannot
   overwrite the saved speech.
*/

function openSavedSpeech(
    speechId
) {

    const speech =
        savedSpeeches.find(
            item =>
                item.id === speechId
        );


    if (!speech) {
        return;
    }


    const viewer =
        document.querySelector(
            ".saved-speech-viewer"
        );


    if (viewer) {
        viewer.remove();
    }


    const modal =
        document.createElement("div");

    modal.className =
        "saved-speech-viewer";


    modal.innerHTML = `
        <div class="saved-speech-modal">

            <div class="saved-speech-modal-header">

                <div>
                    <span class="saved-speech-date">
                        ${escapeHtml(
                            formatSpeechDate(
                                speech.date
                            )
                        )}
                    </span>

                    <h2>
                        ${escapeHtml(
                            speech.name ||
                            "Untitled Speech"
                        )}
                    </h2>
                </div>

                <button
                    type="button"
                    class="button secondary saved-close"
                >
                    ×
                </button>

            </div>


            <div class="saved-speech-stat-row">

                <div>
                    <strong>
                        ${speech.fillerCount ?? 0}
                    </strong>
                    <span>
                        Tracked Words
                    </span>
                </div>

                <div>
                    <strong>
                        ${speech.wordCount ?? 0}
                    </strong>
                    <span>
                        Total Words
                    </span>
                </div>

            </div>


            <section class="saved-speech-transcript">

                <h3>
                    Transcript
                </h3>

                <div class="transcript">
                    ${highlightTranscript(
                        speech.transcript || ""
                    )}
                </div>

            </section>


            ${
                speech.analysis
                    ? `
                        <section class="saved-speech-analysis">

                            <h3>
                                AI Analysis
                            </h3>

                            <div class="analysis">
                                ${speech.analysis}
                            </div>

                        </section>
                    `
                    : ""
            }

        </div>
    `;


    document.body.appendChild(
        modal
    );


    const close =
        modal.querySelector(
            ".saved-close"
        );


    close?.addEventListener(
        "click",
        () => modal.remove()
    );


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {
                modal.remove();
            }
        }
    );
}


/* ============================================================
   DELETE SAVED SPEECH
   ============================================================ */

function deleteSavedSpeech(
    speechId
) {

    const speech =
        savedSpeeches.find(
            item =>
                item.id === speechId
        );


    if (!speech) {
        return;
    }


    const confirmed =
        window.confirm(
            `Delete "${speech.name || "Untitled Speech"}"?`
        );


    if (!confirmed) {
        return;
    }


    savedSpeeches =
        savedSpeeches.filter(
            item =>
                item.id !== speechId
        );


    persistSavedSpeeches();

    renderSavedSpeeches();
}


/* ============================================================
   EXISTING SAVE BUTTON
   ============================================================ */

if (saveSpeechButton) {

    saveSpeechButton.addEventListener(
        "click",
        saveCurrentSpeech
    );
}


renderSavedSpeeches();


/* ============================================================
   AUTO-SAVE ANALYSIS TO CURRENT SAVED SPEECH
   ============================================================ */

/*
   If the user:

   1. records speech
   2. saves it
   3. runs AI analysis

   update the saved snapshot with the analysis.

   This does NOT replace the transcript with
   the current speech.
*/

function updateCurrentSavedAnalysis() {

    if (!currentSpeechId) {
        return;
    }


    const index =
        savedSpeeches.findIndex(
            speech =>
                speech.id ===
                currentSpeechId
        );


    if (index < 0) {
        return;
    }


    savedSpeeches[
        index
    ].analysis =
        analysisElement?.innerHTML ||
        "";


    persistSavedSpeeches();

    renderSavedSpeeches();
}


/*
   Watch for changes to the analysis container.

   This allows an analysis generated after saving
   to be stored in the corresponding speech.
*/

if (analysisElement) {

    const observer =
        new MutationObserver(
            () => {

                if (
                    currentSpeechId &&
                    !isRecording
                ) {

                    updateCurrentSavedAnalysis();
                }
            }
        );


    observer.observe(
        analysisElement,
        {
            childList: true,
            subtree: true,
            characterData: true
        }
    );
}


/* ============================================================
   SAVE SPEECH NAME FIELD
   ============================================================ */

if (speechNameInput) {

    speechNameInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                saveCurrentSpeech();
            }
        }
    );
}


/* ============================================================
   PAGE VISIBILITY
   ============================================================ */

document.addEventListener(
    "visibilitychange",
    () => {

        /*
           Don't allow recognition to continue
           invisibly forever.
        */

        if (
            document.hidden &&
            isRecording
        ) {

            console.log(
                "Page hidden while recording."
            );
        }
    }
);


/* ============================================================
   INITIAL UI STATE
   ============================================================ */

function initializeUI() {

    if (stopButton) {
        stopButton.disabled =
            true;
    }

    if (analyzeButton) {
        analyzeButton.disabled =
            true;
    }

    if (heardElement) {

        heardElement.innerHTML =
            "Tap <b>Listen</b> and start speaking.";
    }

    setStatus(
        "Ready",
        "ready"
    );

    updateStats("");

    renderWordList();

    renderSavedSpeeches();
}


initializeUI();


/* ============================================================
   DEBUGGING HELPERS
   ============================================================ */

window.SpeechTracker = {

    getTranscript() {
        return finalTranscript;
    },

    getLiveTranscript() {
        return liveTranscript;
    },

    getTrackedWords() {
        return [...trackedWords];
    },

    getSavedSpeeches() {
        return [...savedSpeeches];
    },

    detect(text) {
        return getFillerMatches(text);
    },

    clearSavedSpeeches() {

        savedSpeeches = [];

        persistSavedSpeeches();

        renderSavedSpeeches();
    }
};


console.log(
    "Speech Tracker initialized."
);

console.log(
    "Tracked words:",
    trackedWords
);

console.log(
    "Live speech recognition supported:",
    recognitionSupported
);