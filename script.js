/* ============================================================
   SPEECH TRACKER
   COMPLETE REPLACEMENT SCRIPT.JS
   ============================================================ */

"use strict";

/* ============================================================
   CONFIGURATION
   ============================================================ */

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

const STORAGE_WORDS = "speechTrackerWords";
const STORAGE_THEME = "speechTrackerTheme";
const STORAGE_SPEECHES = "speechTrackerSavedSpeeches";

let trackedWords = [];
let recognition = null;
let mediaRecorder = null;
let audioChunks = [];

let isListening = false;
let isStopping = false;

let finalTranscript = "";
let liveTranscript = "";

let speechStartTime = null;
let timerInterval = null;

let notificationPermission = false;

/*
   Keeps track of what has already triggered a live alert.
   This prevents the same interim result from repeatedly
   sending notifications while the browser updates it.
*/
let detectedLiveOccurrences = new Set();

/*
   Used to prevent a notification from firing dozens of times
   if the browser sends nearly identical recognition results.
*/
let lastNotificationText = "";
let lastNotificationTime = 0;


/* ============================================================
   DOM ELEMENTS
   ============================================================ */

const statusDot =
    document.getElementById("statusDot");

const statusElement =
    document.getElementById("status") ||
    document.getElementById("statusText");

const heardElement =
    document.getElementById("heard") ||
    document.getElementById("heardText");

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
    document.getElementById("enableNotifications") ||
    document.getElementById("enableNotificationsButton");

const notificationStatus =
    document.getElementById("notificationStatus");

const analyzeButton =
    document.getElementById("analyzeButton");

const analysisLoading =
    document.getElementById("analysisLoading");

const analysisElement =
    document.getElementById("analysis");

const recordingTimer =
    document.getElementById("recordingTimer");


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    loadTrackedWords();

    initializeTheme();

    createThemeButton();

    initializeRecognition();

    initializeButtons();

    initializeNotificationState();

    renderWordList();

    updateStats("");

    renderSavedSpeechesSection();

});


/* ============================================================
   THEME
   ============================================================ */

function initializeTheme() {

    const savedTheme =
        localStorage.getItem(STORAGE_THEME);

    /*
       If the user has already chosen a theme,
       use it.

       Otherwise use the browser preference.
    */
    let theme = savedTheme;

    if (!theme) {

        const prefersDark =
            window.matchMedia &&
            window.matchMedia(
                "(prefers-color-scheme: dark)"
            ).matches;

        theme = prefersDark
            ? "dark"
            : "light";
    }

    applyTheme(theme);
}


/* ------------------------------------------------------------
   APPLY THEME
   ------------------------------------------------------------ */

function applyTheme(theme) {

    /*
       This is the important part.

       Your CSS uses:

       :root[data-theme="dark"]

       so we put the attribute directly on <html>.
    */

    document.documentElement.setAttribute(
        "data-theme",
        theme
    );

    localStorage.setItem(
        STORAGE_THEME,
        theme
    );

    updateThemeButton(theme);

    /*
       Update browser UI color as well.
    */

    const themeColor =
        document.querySelector(
            'meta[name="theme-color"]'
        );

    if (themeColor) {

        themeColor.setAttribute(
            "content",
            theme === "dark"
                ? "#09090B"
                : "#FFFFFF"
        );
    }
}


/* ------------------------------------------------------------
   CREATE THEME BUTTON
   ------------------------------------------------------------ */

function createThemeButton() {

    let button =
        document.getElementById("themeToggle");

    /*
       If your HTML already has a theme button,
       use it.

       Otherwise create one automatically.
    */

    if (!button) {

        button =
            document.createElement("button");

        button.id = "themeToggle";

        button.className =
            "theme-toggle";

        button.type =
            "button";

        button.setAttribute(
            "aria-label",
            "Switch between light and dark mode"
        );

        document.body.appendChild(button);
    }

    button.onclick = () => {

        const currentTheme =
            document.documentElement.getAttribute(
                "data-theme"
            ) || "light";

        const newTheme =
            currentTheme === "dark"
                ? "light"
                : "dark";

        applyTheme(newTheme);
    };

    updateThemeButton(
        document.documentElement.getAttribute(
            "data-theme"
        ) || "light"
    );
}


/* ------------------------------------------------------------
   UPDATE THEME ICON
   ------------------------------------------------------------ */

function updateThemeButton(theme) {

    const button =
        document.getElementById("themeToggle");

    if (!button) return;

    if (theme === "dark") {

        button.innerHTML = "☀️";

        button.title =
            "Switch to light mode";

    } else {

        button.innerHTML = "🌙";

        button.title =
            "Switch to dark mode";
    }
}


/* ============================================================
   BUTTON INITIALIZATION
   ============================================================ */

function initializeButtons() {

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
            event => {

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
            resetTrackedWords
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
}


/* ============================================================
   TRACKED WORDS
   ============================================================ */

function loadTrackedWords() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_WORDS
            );

        if (saved) {

            const parsed =
                JSON.parse(saved);

            if (
                Array.isArray(parsed) &&
                parsed.length > 0
            ) {

                trackedWords =
                    parsed.map(word =>
                        String(word)
                            .trim()
                            .toLowerCase()
                    );

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


/* ------------------------------------------------------------
   SAVE TRACKED WORDS
   ------------------------------------------------------------ */

function saveTrackedWords() {

    localStorage.setItem(
        STORAGE_WORDS,
        JSON.stringify(trackedWords)
    );
}


/* ------------------------------------------------------------
   ADD CUSTOM WORD
   ------------------------------------------------------------ */

function addCustomWord() {

    if (!customWordInput) return;

    const word =
        customWordInput.value
            .trim()
            .toLowerCase();

    if (!word) return;

    if (trackedWords.includes(word)) {

        customWordInput.value = "";

        return;
    }

    trackedWords.push(word);

    saveTrackedWords();

    renderWordList();

    customWordInput.value = "";

    /*
       Immediately update the live detector.
    */

    detectedLiveOccurrences.clear();
}


/* ------------------------------------------------------------
   RESET WORDS
   ------------------------------------------------------------ */

function resetTrackedWords() {

    trackedWords =
        [...DEFAULT_WORDS];

    saveTrackedWords();

    renderWordList();

    detectedLiveOccurrences.clear();
}


/* ------------------------------------------------------------
   RENDER WORD LIST
   ------------------------------------------------------------ */

function renderWordList() {

    if (!wordList) return;

    wordList.innerHTML = "";

    trackedWords.forEach(word => {

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

                trackedWords =
                    trackedWords.filter(
                        item =>
                            item !== word
                    );

                saveTrackedWords();

                renderWordList();

                detectedLiveOccurrences.clear();
            }
        );

        tag.appendChild(text);

        tag.appendChild(remove);

        wordList.appendChild(tag);
    });
}


/* ============================================================
   SPEECH RECOGNITION
   ============================================================ */

function initializeRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        console.warn(
            "Speech Recognition is not supported."
        );

        if (heardElement) {

            heardElement.innerHTML =
                "Live transcription is not supported in this browser.";
        }

        return;
    }

    recognition =
        new SpeechRecognition();

    /*
       Continuous means recognition keeps listening.
    */

    recognition.continuous =
        true;

    /*
       IMPORTANT:

       interimResults allows us to inspect speech BEFORE
       the browser finalizes the sentence.

       This is what makes live filler detection possible.
    */

    recognition.interimResults =
        true;

    recognition.lang =
        "en-US";

    /*
       Some browsers stop recognition after a period
       of silence. We restart it automatically.
    */

    recognition.onstart = () => {

        console.log(
            "Speech recognition started."
        );
    };


    recognition.onresult =
        handleRecognitionResult;


    recognition.onerror =
        handleRecognitionError;


    recognition.onend = () => {

        console.log(
            "Speech recognition ended."
        );

        if (
            isListening &&
            !isStopping
        ) {

            try {

                recognition.start();

            } catch (error) {

                console.log(
                    "Recognition restart skipped:",
                    error
                );
            }
        }
    };
}


/* ============================================================
   RECOGNITION RESULT
   ============================================================ */

function handleRecognitionResult(event) {

    let completeTranscript = "";

    let currentInterim = "";

    /*
       Go through every result currently available.
    */

    for (
        let i = 0;
        i < event.results.length;
        i++
    ) {

        const result =
            event.results[i];

        const text =
            result[0]?.transcript || "";

        if (result.isFinal) {

            completeTranscript +=
                text + " ";

        } else {

            currentInterim +=
                text + " ";
        }
    }


    /*
       Keep our finalized transcript.
    */

    finalTranscript =
        completeTranscript.trim();


    liveTranscript =
        currentInterim.trim();


    /*
       THIS IS THE IMPORTANT PART:

       Analyze the interim speech immediately.

       The previous implementation probably waited for
       finalized recognition results, which is why "umm"
       and "uhhh" could appear in the final transcript
       without triggering a live notification.
    */

    const textToDetect =
        (
            finalTranscript +
            " " +
            liveTranscript
        ).trim();

    detectFillersLive(
        textToDetect
    );


    /*
       Display the transcript immediately.
    */

    renderTranscript(
        textToDetect
    );


    updateStats(
        textToDetect
    );
}


/* ============================================================
   LIVE FILLER DETECTION
   ============================================================ */

function detectFillersLive(text) {

    if (!text) return;

    /*
       Normalize the speech.

       This is deliberately aggressive with:
       um
       umm
       ummm
       uhhh
       uh
       uhhhh
       etc.
    */

    const normalized =
        text
            .toLowerCase()
            .replace(/[.,!?;:()[\]{}"']/g, " ");


    for (
        const word of trackedWords
    ) {

        const normalizedWord =
            word
                .toLowerCase()
                .trim();

        if (!normalizedWord) continue;


        /*
           Special handling for "um" and "uh".

           This catches:

           um
           umm
           ummm
           ummmm

           and:

           uh
           uhh
           uhhh
           uhhhh
        */

        let regex;

        if (
            normalizedWord === "um" ||
            /^um+$/.test(normalizedWord)
        ) {

            regex =
                /\bum+\b/gi;

        } else if (
            normalizedWord === "uh" ||
            /^uh+$/.test(normalizedWord)
        ) {

            regex =
                /\buh+\b/gi;

        } else {

            const escaped =
                escapeRegex(
                    normalizedWord
                );

            regex =
                new RegExp(
                    `\\b${escaped}\\b`,
                    "gi"
                );
        }


        let match;

        while (
            (match = regex.exec(normalized)) !== null
        ) {

            /*
               Create a unique identifier for this occurrence.
            */

            const occurrenceKey =
                `${normalizedWord}:${match.index}:${match[0]}`;


            /*
               Don't notify for the same occurrence twice.
            */

            if (
                detectedLiveOccurrences.has(
                    occurrenceKey
                )
            ) {

                continue;
            }


            detectedLiveOccurrences.add(
                occurrenceKey
            );


            /*
               Immediately notify.
            */

            triggerFillerAlert(
                match[0]
            );
        }
    }


    /*
       Prevent the Set from growing forever.
    */

    if (
        detectedLiveOccurrences.size > 100
    ) {

        const values =
            Array.from(
                detectedLiveOccurrences
            );

        detectedLiveOccurrences =
            new Set(
                values.slice(-50)
            );
    }
}


/* ============================================================
   FILLER ALERT
   ============================================================ */

function triggerFillerAlert(word) {

    const now =
        Date.now();


    /*
       Extra safety against browsers repeatedly
       sending essentially identical interim results.
    */

    if (
        lastNotificationText === word &&
        now - lastNotificationTime < 500
    ) {

        return;
    }


    lastNotificationText =
        word;

    lastNotificationTime =
        now;


    console.log(
        "Tracked word detected:",
        word
    );


    /*
       VIBRATION
    */

    if (
        "vibrate" in navigator
    ) {

        try {

            navigator.vibrate(
                [70, 40, 70]
            );

        } catch (error) {

            console.log(
                "Vibration unavailable:",
                error
            );
        }
    }


    /*
       BROWSER NOTIFICATION
    */

    if (
        "Notification" in window &&
        Notification.permission === "granted"
    ) {

        try {

            new Notification(
                "Speech Tracker",
                {
                    body:
                        `You said "${word}"`,
                    silent: true
                }
            );

        } catch (error) {

            console.log(
                "Notification failed:",
                error
            );
        }
    }


    /*
       On-screen alert.

       This makes the detection obvious even if
       browser notifications are delayed.
    */

    showLiveFillerIndicator(
        word
    );
}


/* ============================================================
   ON-SCREEN FILLER ALERT
   ============================================================ */

function showLiveFillerIndicator(word) {

    let indicator =
        document.getElementById(
            "liveFillerIndicator"
        );


    if (!indicator) {

        indicator =
            document.createElement("div");

        indicator.id =
            "liveFillerIndicator";

        document.body.appendChild(
            indicator
        );

        Object.assign(
            indicator.style,
            {
                position: "fixed",
                top: "76px",
                left: "50%",
                transform:
                    "translateX(-50%) translateY(-10px)",
                zIndex: "9999",
                padding:
                    "10px 16px",
                borderRadius:
                    "999px",
                background:
                    "#18181B",
                color:
                    "#FFFFFF",
                fontSize:
                    "14px",
                fontWeight:
                    "700",
                boxShadow:
                    "0 8px 30px rgba(0,0,0,.2)",
                opacity: "0",
                pointerEvents:
                    "none",
                transition:
                    "opacity .15s ease, transform .15s ease"
            }
        );
    }


    indicator.textContent =
        `⚠️ Tracked word: "${word}"`;


    indicator.style.opacity =
        "1";

    indicator.style.transform =
        "translateX(-50%) translateY(0)";


    clearTimeout(
        indicator._hideTimer
    );


    indicator._hideTimer =
        setTimeout(() => {

            indicator.style.opacity =
                "0";

            indicator.style.transform =
                "translateX(-50%) translateY(-10px)";

        }, 900);
}


/* ============================================================
   RENDER TRANSCRIPT
   ============================================================ */

function renderTranscript(text) {

    if (!heardElement) return;

    if (!text) {

        heardElement.textContent =
            "Listening...";

        return;
    }


    /*
       Escape HTML first.
    */

    let safe =
        escapeHTML(text);


    /*
       Highlight tracked words.

       Sort longest first so "ummm" is checked before "um".
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

        let pattern;

        if (
            word === "um" ||
            /^um+$/.test(word)
        ) {

            pattern =
                /\b(um+)\b/gi;

        } else if (
            word === "uh" ||
            /^uh+$/.test(word)
        ) {

            pattern =
                /\b(uh+)\b/gi;

        } else {

            pattern =
                new RegExp(
                    `\\b(${escapeRegex(word)})\\b`,
                    "gi"
                );
        }


        safe =
            safe.replace(
                pattern,
                '<span class="highlight">$1</span>'
            );
    }


    heardElement.innerHTML =
        safe;
}


/* ============================================================
   STATS
   ============================================================ */

function updateStats(text) {

    if (!text) {

        if (fillerCountElement) {

            fillerCountElement.textContent =
                "0";
        }

        if (wordCountElement) {

            wordCountElement.textContent =
                "0";
        }

        return;
    }


    const words =
        text
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (wordCountElement) {

        wordCountElement.textContent =
            words.length;
    }


    let fillerCount =
        0;


    for (
        const word of trackedWords
    ) {

        const normalizedWord =
            word.toLowerCase().trim();

        if (
            normalizedWord === "um" ||
            /^um+$/.test(normalizedWord)
        ) {

            const matches =
                text.match(
                    /\bum+\b/gi
                );

            fillerCount +=
                matches
                    ? matches.length
                    : 0;

        } else if (
            normalizedWord === "uh" ||
            /^uh+$/.test(normalizedWord)
        ) {

            const matches =
                text.match(
                    /\buh+\b/gi
                );

            fillerCount +=
                matches
                    ? matches.length
                    : 0;

        } else {

            const matches =
                text.match(
                    new RegExp(
                        `\\b${escapeRegex(normalizedWord)}\\b`,
                        "gi"
                    )
                );

            fillerCount +=
                matches
                    ? matches.length
                    : 0;
        }
    }


    if (fillerCountElement) {

        fillerCountElement.textContent =
            fillerCount;
    }
}


/* ============================================================
   START LISTENING
   ============================================================ */

async function startListening() {

    if (isListening) return;


    if (!recognition) {

        alert(
            "Live speech recognition is not supported in this browser. Try Chrome or Safari."
        );

        return;
    }


    isListening =
        true;

    isStopping =
        false;

    finalTranscript =
        "";

    liveTranscript =
        "";

    audioChunks =
        [];

    detectedLiveOccurrences.clear();


    /*
       Reset AI analysis.
    */

    if (analysisElement) {

        analysisElement.innerHTML =
            "";
    }

    if (analyzeButton) {

        analyzeButton.disabled =
            true;
    }


    /*
       Start timer.
    */

    speechStartTime =
        Date.now();

    startTimer();


    /*
       Update UI.
    */

    setStatus(
        "Listening",
        "listening"
    );


    if (listenButton) {

        listenButton.disabled =
            true;
    }

    if (stopButton) {

        stopButton.disabled =
            false;
    }


    if (heardElement) {

        heardElement.textContent =
            "Listening...";
    }


    /*
       Start browser speech recognition.
    */

    try {

        recognition.start();

    } catch (error) {

        console.log(
            "Recognition already running:",
            error
        );
    }


    /*
       Start audio recording too.

       This is used for the final OpenAI transcription.
    */

    try {

        await startAudioRecording();

    } catch (error) {

        console.error(
            "Audio recording could not start:",
            error
        );
    }
}


/* ============================================================
   AUDIO RECORDING
   ============================================================ */

async function startAudioRecording() {

    if (!navigator.mediaDevices?.getUserMedia) {

        console.warn(
            "getUserMedia is not available."
        );

        return;
    }


    const stream =
        await navigator.mediaDevices.getUserMedia(
            {
                audio: true
            }
        );


    let mimeType =
        "";


    const possibleTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg"
    ];


    for (
        const type of possibleTypes
    ) {

        if (
            window.MediaRecorder &&
            MediaRecorder.isTypeSupported(type)
        ) {

            mimeType =
                type;

            break;
        }
    }


    mediaRecorder =
        mimeType
            ? new MediaRecorder(
                stream,
                {
                    mimeType
                }
            )
            : new MediaRecorder(
                stream
            );


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
   STOP LISTENING
   ============================================================ */

async function stopListening() {

    if (!isListening) return;


    isStopping =
        true;

    isListening =
        false;


    stopTimer();


    setStatus(
        "Processing",
        "ready"
    );


    if (listenButton) {

        listenButton.disabled =
            true;
    }

    if (stopButton) {

        stopButton.disabled =
            true;
    }


    /*
       Stop browser recognition.
    */

    try {

        recognition?.stop();

    } catch (error) {

        console.log(
            "Recognition stop error:",
            error
        );
    }


    /*
       Stop audio recorder.
    */

    let audioBlob =
        null;


    if (
        mediaRecorder &&
        mediaRecorder.state !== "inactive"
    ) {

        audioBlob =
            await stopAudioRecording();
    }


    /*
       If we have an audio recording,
       send it to OpenAI for the final transcription.
    */

    let aiTranscript =
        "";


    if (audioBlob) {

        aiTranscript =
            await transcribeAudio(
                audioBlob
            );
    }


    /*
       If final OpenAI transcription failed,
       use browser transcript.
    */

    if (
        !aiTranscript ||
        !aiTranscript.trim()
    ) {

        aiTranscript =
            finalTranscript.trim();
    }


    finalTranscript =
        aiTranscript.trim();


    /*
       Display final transcript.
    */

    renderTranscript(
        finalTranscript
    );

    updateStats(
        finalTranscript
    );


    /*
       Enable AI analysis.
    */

    if (
        analyzeButton &&
        finalTranscript
    ) {

        analyzeButton.disabled =
            false;
    }


    setStatus(
        "Finished",
        "ready"
    );


    if (listenButton) {

        listenButton.disabled =
            false;
    }


    isStopping =
        false;


    /*
       Ask whether the user wants to save it.
    */

    if (
        finalTranscript
    ) {

        showSaveSpeechPrompt();
    }
}


/* ============================================================
   STOP AUDIO RECORDING
   ============================================================ */

function stopAudioRecording() {

    return new Promise(resolve => {

        if (
            !mediaRecorder ||
            mediaRecorder.state === "inactive"
        ) {

            resolve(null);

            return;
        }


        mediaRecorder.onstop =
            () => {

                const blob =
                    new Blob(
                        audioChunks,
                        {
                            type:
                                mediaRecorder.mimeType ||
                                "audio/webm"
                        }
                    );


                /*
                   Stop microphone tracks.
                */

                try {

                    mediaRecorder.stream
                        ?.getTracks()
                        .forEach(track =>
                            track.stop()
                        );

                } catch (error) {

                    console.log(
                        "Could not stop microphone tracks:",
                        error
                    );
                }


                resolve(blob);
            };


        mediaRecorder.stop();
    });
}


/* ============================================================
   OPENAI TRANSCRIPTION
   ============================================================ */

async function transcribeAudio(blob) {

    try {

        setStatus(
            "Creating transcript",
            "ready"
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

                    body: JSON.stringify({
                        audio: base64
                    })
                }
            );


        if (!response.ok) {

            console.error(
                "Transcription request failed:",
                response.status
            );

            return "";
        }


        const data =
            await response.json();


        /*
           Support several possible response formats.
        */

        return (
            data.transcript ||
            data.text ||
            data.transcription ||
            ""
        );

    } catch (error) {

        console.error(
            "Transcription error:",
            error
        );

        return "";
    }
}


/* ============================================================
   BLOB TO BASE64
   ============================================================ */

function blobToBase64(blob) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onloadend =
                () => {

                    const result =
                        reader.result;

                    const base64 =
                        String(result)
                            .split(",")[1];

                    resolve(base64);
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
   AI ANALYSIS
   ============================================================ */

async function analyzeSpeech() {

    if (
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

        analysisLoading.textContent =
            "Analyzing your speech...";
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
                            finalTranscript
                    })
                }
            );


        const responseText =
            await response.text();


        if (!response.ok) {

            console.error(
                "Analysis server error:",
                responseText
            );

            throw new Error(
                `Analysis failed (${response.status})`
            );
        }


        let data;

        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (error) {

            console.error(
                "Analysis response was not JSON:",
                responseText
            );

            throw new Error(
                "The server returned invalid JSON."
            );
        }


        /*
           Your API currently returns:

           {
               analysis: "...",
               analysisData: {...}
           }

           So support both.
        */

        const structured =
            data.analysisData;


        if (
            structured &&
            typeof structured === "object"
        ) {

            renderStructuredAnalysis(
                structured
            );

        } else if (
            data.analysis
        ) {

            renderPlainAnalysis(
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
                `
                <div class="analysis-error">
                    <strong>Analysis couldn't be completed.</strong>
                    <p>${escapeHTML(
                        error.message ||
                        "Please try again."
                    )}</p>
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


/* ============================================================
   STRUCTURED ANALYSIS RENDERER
   ============================================================ */

function renderStructuredAnalysis(data) {

    if (!analysisElement) return;


    let html = "";


    if (data.overall) {

        html += createAnalysisCard(
            "Overall",
            data.overall
        );
    }


    /*
       Speech sections.
    */

    if (
        Array.isArray(data.sections) &&
        data.sections.length
    ) {

        html += `
            <div class="analysis-group">
                <h3>Speech Breakdown</h3>
        `;


        data.sections.forEach(
            section => {

                if (!section) return;

                const name =
                    section.name ||
                    "Section";

                const feedback =
                    section.feedback ||
                    section.analysis ||
                    "";


                if (!feedback) return;


                html += `
                    <div class="analysis-subcard">
                        <strong>
                            ${escapeHTML(name)}
                        </strong>

                        <p>
                            ${escapeHTML(feedback)}
                        </p>
                    </div>
                `;
            }
        );


        html += `
            </div>
        `;
    }


    if (data.fillerWords) {

        html += createAnalysisCard(
            "Filler Words",
            data.fillerWords
        );
    }


    if (data.clarity) {

        html += createAnalysisCard(
            "Clarity",
            data.clarity
        );
    }


    if (data.structure) {

        html += createAnalysisCard(
            "Structure",
            data.structure
        );
    }


    if (data.repetition) {

        html += createAnalysisCard(
            "Repetition",
            data.repetition
        );
    }


    /*
       Strengths.
    */

    if (
        Array.isArray(data.strengths) &&
        data.strengths.length
    ) {

        html += createListCard(
            "What You Did Well",
            data.strengths
        );
    }


    /*
       Improvements.
    */

    if (
        Array.isArray(data.improvements) &&
        data.improvements.length
    ) {

        html += createListCard(
            "What To Improve",
            data.improvements
        );
    }


    /*
       Multiple practical tips.
    */

    if (
        Array.isArray(data.tips) &&
        data.tips.length
    ) {

        html += createListCard(
            "Personalized Tips",
            data.tips
        );
    }


    /*
       Example rewrite.
    */

    if (data.exampleRewrite) {

        html += `
            <div class="analysis-subcard">
                <h3>
                    Example Improvement
                </h3>

                <p>
                    ${escapeHTML(
                        data.exampleRewrite
                    )}
                </p>
            </div>
        `;
    }


    /*
       Backwards compatibility with the old
       six-field API.
    */

    const oldFields = [
        ["Filler Words", data.fillerWords],
        ["Clarity", data.clarity],
        ["Strength", data.strength],
        ["Improvement", data.improvement],
        ["Tip", data.tip]
    ];


    /*
       Only render these if they weren't already
       represented by newer structures.
    */

    if (
        data.strength &&
        !Array.isArray(data.strengths)
    ) {

        html += createAnalysisCard(
            "Strength",
            data.strength
        );
    }


    if (
        data.improvement &&
        !Array.isArray(data.improvements)
    ) {

        html += createAnalysisCard(
            "Main Improvement",
            data.improvement
        );
    }


    if (
        data.tip &&
        !Array.isArray(data.tips)
    ) {

        html += createAnalysisCard(
            "Tip",
            data.tip
        );
    }


    if (!html) {

        html =
            "<p>No analysis was returned.</p>";
    }


    analysisElement.innerHTML =
        html;
}


/* ============================================================
   ANALYSIS CARD
   ============================================================ */

function createAnalysisCard(
    title,
    content
) {

    return `
        <div class="analysis-subcard">
            <h3>
                ${escapeHTML(title)}
            </h3>

            <p>
                ${escapeHTML(content)}
            </p>
        </div>
    `;
}


/* ============================================================
   ANALYSIS LIST CARD
   ============================================================ */

function createListCard(
    title,
    items
) {

    let list =
        "<ul>";


    items.forEach(item => {

        if (!item) return;

        list += `
            <li>
                ${escapeHTML(
                    String(item)
                )}
            </li>
        `;
    });


    list +=
        "</ul>";


    return `
        <div class="analysis-subcard">
            <h3>
                ${escapeHTML(title)}
            </h3>

            ${list}
        </div>
    `;
}


/* ============================================================
   PLAIN ANALYSIS
   ============================================================ */

function renderPlainAnalysis(text) {

    if (!analysisElement) return;


    /*
       Preserve line breaks.
    */

    analysisElement.innerHTML =
        escapeHTML(
            String(text)
        ).replace(
            /\n/g,
            "<br>"
        );
}


/* ============================================================
   SAVE SPEECH PROMPT
   ============================================================ */

function showSaveSpeechPrompt() {

    /*
       Remove an existing prompt first.
    */

    const existing =
        document.getElementById(
            "saveSpeechPrompt"
        );

    if (existing) {

        existing.remove();
    }


    const overlay =
        document.createElement("div");

    overlay.id =
        "saveSpeechPrompt";


    Object.assign(
        overlay.style,
        {
            position: "fixed",
            inset: "0",
            zIndex: "10000",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px",
            paddingTop: "80px",
            background:
                "rgba(0,0,0,.18)",
            backdropFilter:
                "blur(4px)"
        }
    );


    const box =
        document.createElement("div");


    Object.assign(
        box.style,
        {
            width: "min(420px, 100%)",
            padding: "20px",
            borderRadius: "18px",
            background:
                "var(--surface-strong, #FFFFFF)",
            color:
                "var(--text, #09090B)",
            border:
                "1px solid var(--border, #E4E4E7)",
            boxShadow:
                "0 20px 60px rgba(0,0,0,.18)"
        }
    );


    box.innerHTML = `
        <div style="
            display:flex;
            align-items:center;
            gap:12px;
            margin-bottom:6px;
        ">
            <div style="
                width:40px;
                height:40px;
                border-radius:12px;
                display:flex;
                align-items:center;
                justify-content:center;
                background:rgba(16,185,129,.12);
                font-size:20px;
            ">
                ✓
            </div>

            <div>
                <div style="
                    font-size:17px;
                    font-weight:750;
                ">
                    Speech finished
                </div>

                <div style="
                    font-size:13px;
                    color:var(--text-secondary,#71717A);
                ">
                    Would you like to save this speech?
                </div>
            </div>
        </div>

        <div style="
            display:flex;
            gap:12px;
            margin-top:18px;
        ">

            <button
                id="confirmSaveSpeech"
                type="button"
                style="
                    flex:1;
                    min-height:46px;
                    border:0;
                    border-radius:12px;
                    background:#18181B;
                    color:#FFFFFF;
                    font-weight:700;
                    cursor:pointer;
                    font-size:15px;
                "
            >
                ✓ Save Speech
            </button>

            <button
                id="declineSaveSpeech"
                type="button"
                style="
                    width:54px;
                    min-height:46px;
                    border:1px solid var(--border,#E4E4E7);
                    border-radius:12px;
                    background:var(--surface,#F4F4F5);
                    color:var(--text,#09090B);
                    font-size:20px;
                    cursor:pointer;
                "
                aria-label="Don't save speech"
                title="Don't save"
            >
                ×
            </button>

        </div>
    `;


    overlay.appendChild(box);

    document.body.appendChild(
        overlay
    );


    document
        .getElementById(
            "confirmSaveSpeech"
        )
        ?.addEventListener(
            "click",
            () => {

                saveCurrentSpeech();

                overlay.remove();
            }
        );


    document
        .getElementById(
            "declineSaveSpeech"
        )
        ?.addEventListener(
            "click",
            () => {

                overlay.remove();
            }
        );
}


/* ============================================================
   SAVED SPEECHES
   ============================================================ */

function getSavedSpeeches() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_SPEECHES
            );

        if (!saved) return [];

        const parsed =
            JSON.parse(saved);

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


/* ------------------------------------------------------------
   SAVE CURRENT SPEECH
   ------------------------------------------------------------ */

function saveCurrentSpeech() {

    if (!finalTranscript.trim()) {

        return;
    }


    const speeches =
        getSavedSpeeches();


    const speech = {

        id:
            Date.now(),

        date:
            new Date().toISOString(),

        transcript:
            finalTranscript,

        wordCount:
            countWords(
                finalTranscript
            ),

        fillerCount:
            countFillers(
                finalTranscript
            ),

        analysis:
            analysisElement
                ? analysisElement.innerText
                : ""
    };


    speeches.unshift(
        speech
    );


    /*
       Keep the most recent 50 speeches.
    */

    const limited =
        speeches.slice(
            0,
            50
        );


    localStorage.setItem(
        STORAGE_SPEECHES,
        JSON.stringify(limited)
    );


    renderSavedSpeechesSection();


    showSmallToast(
        "Speech saved ✓"
    );
}


/* ============================================================
   SAVED SPEECHES UI
   ============================================================ */

function renderSavedSpeechesSection() {

    let section =
        document.getElementById(
            "savedSpeechesSection"
        );


    if (!section) {

        section =
            document.createElement("section");

        section.id =
            "savedSpeechesSection";

        section.className =
            "card";


        /*
           Put it before the footer if possible.
        */

        const footer =
            document.querySelector("footer");


        if (footer) {

            footer.parentNode.insertBefore(
                section,
                footer
            );

        } else {

            document.body.appendChild(
                section
            );
        }
    }


    const speeches =
        getSavedSpeeches();


    let html = `

        <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:16px;
            margin-bottom:16px;
        ">

            <div>

                <h2 style="margin-bottom:4px;">
                    Saved Speeches
                </h2>

                <p class="info" style="margin:0;">
                    Your previous practice sessions are stored
                    on this device.
                </p>

            </div>

            ${
                speeches.length
                    ? `
                    <button
                        id="clearSavedSpeeches"
                        type="button"
                        class="button secondary"
                    >
                        Clear All
                    </button>
                    `
                    : ""
            }

        </div>
    `;


    if (!speeches.length) {

        html += `
            <div style="
                padding:24px;
                text-align:center;
                border:1px dashed var(--border,#E4E4E7);
                border-radius:14px;
                color:var(--text-secondary,#71717A);
            ">
                No saved speeches yet.
                <br>
                Finish a speech and choose
                <strong>Save Speech</strong>.
            </div>
        `;

    } else {

        speeches.forEach(
            speech => {

                const date =
                    new Date(
                        speech.date
                    );


                const preview =
                    speech.transcript
                        .slice(0, 180);


                html += `
                    <div
                        class="saved-speech-card"
                        data-speech-id="${speech.id}"
                        style="
                            padding:16px;
                            margin-top:12px;
                            border:1px solid var(--border,#E4E4E7);
                            border-radius:14px;
                            background:var(--surface-strong,#FFFFFF);
                        "
                    >

                        <div style="
                            display:flex;
                            align-items:flex-start;
                            justify-content:space-between;
                            gap:12px;
                        ">

                            <div>

                                <strong>
                                    ${escapeHTML(
                                        date.toLocaleDateString()
                                    )}
                                </strong>

                                <div style="
                                    margin-top:3px;
                                    color:var(--text-secondary,#71717A);
                                    font-size:13px;
                                ">
                                    ${escapeHTML(
                                        date.toLocaleTimeString(
                                            [],
                                            {
                                                hour:
                                                    "numeric",
                                                minute:
                                                    "2-digit"
                                            }
                                        )
                                    )}
                                </div>

                            </div>

                            <button
                                class="delete-speech-button"
                                data-id="${speech.id}"
                                type="button"
                                title="Delete speech"
                                style="
                                    width:34px;
                                    height:34px;
                                    min-height:34px;
                                    padding:0;
                                    border:1px solid var(--border,#E4E4E7);
                                    border-radius:9px;
                                    background:transparent;
                                    cursor:pointer;
                                    color:var(--text-secondary,#71717A);
                                    font-size:17px;
                                "
                            >
                                ×
                            </button>

                        </div>


                        <div style="
                            display:flex;
                            gap:8px;
                            flex-wrap:wrap;
                            margin:12px 0;
                        ">

                            <span class="word-tag">
                                ${speech.wordCount}
                                words
                            </span>

                            <span class="word-tag">
                                ${speech.fillerCount}
                                tracked words
                            </span>

                        </div>


                        <p style="
                            margin:0;
                            color:var(--text-secondary,#71717A);
                            line-height:1.6;
                        ">
                            ${escapeHTML(
                                preview
                            )}${
                                speech.transcript.length > 180
                                    ? "..."
                                    : ""
                            }
                        </p>


                        <button
                            class="view-speech-button"
                            data-id="${speech.id}"
                            type="button"
                            style="
                                width:100%;
                                margin-top:14px;
                                min-height:42px;
                                border:1px solid var(--border,#E4E4E7);
                                border-radius:10px;
                                background:var(--surface,#F4F4F5);
                                color:var(--text,#09090B);
                                cursor:pointer;
                                font-weight:650;
                            "
                        >
                            View Speech
                        </button>

                    </div>
                `;
            }
        );
    }


    section.innerHTML =
        html;


    /*
       Delete buttons.
    */

    section
        .querySelectorAll(
            ".delete-speech-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    deleteSavedSpeech(
                        Number(
                            button.dataset.id
                        )
                    );
                }
            );
        });


    /*
       View buttons.
    */

    section
        .querySelectorAll(
            ".view-speech-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    viewSavedSpeech(
                        Number(
                            button.dataset.id
                        )
                    );
                }
            );
        });


    /*
       Clear all.
    */

    document
        .getElementById(
            "clearSavedSpeeches"
        )
        ?.addEventListener(
            "click",
            clearSavedSpeeches
        );
}


/* ============================================================
   VIEW SAVED SPEECH
   ============================================================ */

function viewSavedSpeech(id) {

    const speech =
        getSavedSpeeches()
            .find(
                item =>
                    Number(item.id) ===
                    Number(id)
            );


    if (!speech) return;


    /*
       Put the transcript back into the main
       transcript area.
    */

    finalTranscript =
        speech.transcript;


    renderTranscript(
        finalTranscript
    );


    updateStats(
        finalTranscript
    );


    if (analyzeButton) {

        analyzeButton.disabled =
            false;
    }


    /*
       If saved AI analysis exists, display it.
    */

    if (
        analysisElement &&
        speech.analysis
    ) {

        analysisElement.innerHTML =
            escapeHTML(
                speech.analysis
            ).replace(
                /\n/g,
                "<br>"
            );
    }


    /*
       Scroll to transcript.
    */

    if (heardElement) {

        heardElement.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }


    showSmallToast(
        "Speech loaded"
    );
}


/* ============================================================
   DELETE SPEECH
   ============================================================ */

function deleteSavedSpeech(id) {

    const speeches =
        getSavedSpeeches();


    const updated =
        speeches.filter(
            speech =>
                Number(speech.id) !==
                Number(id)
        );


    localStorage.setItem(
        STORAGE_SPEECHES,
        JSON.stringify(updated)
    );


    renderSavedSpeechesSection();

    showSmallToast(
        "Speech deleted"
    );
}


/* ============================================================
   CLEAR SAVED SPEECHES
   ============================================================ */

function clearSavedSpeeches() {

    const confirmed =
        window.confirm(
            "Delete all saved speeches?"
        );


    if (!confirmed) return;


    localStorage.removeItem(
        STORAGE_SPEECHES
    );


    renderSavedSpeechesSection();

    showSmallToast(
        "Saved speeches cleared"
    );
}


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

function initializeNotificationState() {

    if (
        !("Notification" in window)
    ) {

        if (notificationStatus) {

            notificationStatus.textContent =
                "Browser notifications are not supported.";
        }

        return;
    }


    if (
        Notification.permission ===
        "granted"
    ) {

        notificationPermission =
            true;

        if (notificationStatus) {

            notificationStatus.textContent =
                "Notifications are enabled ✓";
        }

        if (enableNotificationsButton) {

            enableNotificationsButton.textContent =
                "✓ Notifications Enabled";

            enableNotificationsButton.classList.add(
                "enabled"
            );
        }

    } else if (
        Notification.permission ===
        "denied"
    ) {

        if (notificationStatus) {

            notificationStatus.textContent =
                "Notifications are blocked. Check your browser settings.";
        }
    }
}


/* ------------------------------------------------------------
   REQUEST NOTIFICATIONS
   ------------------------------------------------------------ */

async function requestNotifications() {

    if (
        !("Notification" in window)
    ) {

        return;
    }


    try {

        const permission =
            await Notification.requestPermission();


        if (
            permission === "granted"
        ) {

            notificationPermission =
                true;


            if (notificationStatus) {

                notificationStatus.textContent =
                    "Notifications are enabled ✓";
            }


            if (
                enableNotificationsButton
            ) {

                enableNotificationsButton.textContent =
                    "✓ Notifications Enabled";

                enableNotificationsButton.classList.add(
                    "enabled"
                );
            }


            /*
               Test notification.
            */

            try {

                new Notification(
                    "Speech Tracker",
                    {
                        body:
                            "Notifications are now enabled!"
                    }
                );

            } catch (error) {

                console.log(
                    "Test notification failed:",
                    error
                );
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


/* ============================================================
   STATUS
   ============================================================ */

function setStatus(
    text,
    state
) {

    if (statusElement) {

        statusElement.textContent =
            text;
    }


    if (statusDot) {

        statusDot.classList.remove(
            "ready",
            "listening",
            "error"
        );


        statusDot.classList.add(
            state || "ready"
        );
    }
}


/* ============================================================
   TIMER
   ============================================================ */

function startTimer() {

    if (!recordingTimer) return;


    clearInterval(
        timerInterval
    );


    timerInterval =
        setInterval(
            () => {

                const elapsed =
                    Date.now() -
                    speechStartTime;


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


                recordingTimer.textContent =
                    `${minutes}:${String(
                        seconds
                    ).padStart(2, "0")}`;

            },
            250
        );
}


/* ------------------------------------------------------------
   STOP TIMER
   ------------------------------------------------------------ */

function stopTimer() {

    clearInterval(
        timerInterval
    );

    timerInterval =
        null;
}


/* ============================================================
   COUNT WORDS
   ============================================================ */

function countWords(text) {

    if (!text?.trim()) {

        return 0;
    }


    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}


/* ============================================================
   COUNT FILLERS
   ============================================================ */

function countFillers(text) {

    if (!text) return 0;


    let count = 0;


    for (
        const word of trackedWords
    ) {

        const normalized =
            word
                .trim()
                .toLowerCase();


        let regex;


        if (
            normalized === "um" ||
            /^um+$/.test(normalized)
        ) {

            regex =
                /\bum+\b/gi;

        } else if (
            normalized === "uh" ||
            /^uh+$/.test(normalized)
        ) {

            regex =
                /\buh+\b/gi;

        } else {

            regex =
                new RegExp(
                    `\\b${escapeRegex(normalized)}\\b`,
                    "gi"
                );
        }


        const matches =
            text.match(regex);


        if (matches) {

            count +=
                matches.length;
        }
    }


    return count;
}


/* ============================================================
   TOAST
   ============================================================ */

function showSmallToast(message) {

    let toast =
        document.getElementById(
            "speechTrackerToast"
        );


    if (!toast) {

        toast =
            document.createElement("div");

        toast.id =
            "speechTrackerToast";


        Object.assign(
            toast.style,
            {
                position: "fixed",
                bottom: "24px",
                left: "50%",
                transform:
                    "translateX(-50%) translateY(10px)",
                zIndex: "10001",
                padding:
                    "10px 16px",
                borderRadius:
                    "999px",
                background:
                    "#18181B",
                color:
                    "#FFFFFF",
                fontSize:
                    "14px",
                fontWeight:
                    "650",
                boxShadow:
                    "0 10px 30px rgba(0,0,0,.2)",
                opacity:
                    "0",
                transition:
                    "opacity .2s ease, transform .2s ease",
                pointerEvents:
                    "none"
            }
        );


        document.body.appendChild(
            toast
        );
    }


    toast.textContent =
        message;


    toast.style.opacity =
        "1";

    toast.style.transform =
        "translateX(-50%) translateY(0)";


    clearTimeout(
        toast._timer
    );


    toast._timer =
        setTimeout(
            () => {

                toast.style.opacity =
                    "0";

                toast.style.transform =
                    "translateX(-50%) translateY(10px)";

            },
            1800
        );
}


/* ============================================================
   HELPERS
   ============================================================ */

function escapeRegex(text) {

    return String(text)
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
}


function escapeHTML(text) {

    return String(text)
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


/* ============================================================
   PAGE VISIBILITY
   ============================================================ */

document.addEventListener(
    "visibilitychange",
    () => {

        /*
           Don't stop speech recognition just because
           the page temporarily loses focus.

           Some mobile browsers may still stop it themselves;
           onend handles restarting when possible.
        */

        if (
            document.visibilityState ===
            "visible" &&
            isListening &&
            recognition
        ) {

            try {

                recognition.start();

            } catch (error) {

                /*
                   Already running is harmless.
                */
            }
        }
    }
);


/* ============================================================
   PREVENT ACCIDENTAL PAGE LEAVE
   ============================================================ */

window.addEventListener(
    "beforeunload",
    event => {

        if (!isListening) return;

        event.preventDefault();

        event.returnValue =
            "";
    }
);


/* ============================================================
   INITIAL STATUS
   ============================================================ */

setTimeout(
    () => {

        if (
            !isListening &&
            statusElement
        ) {

            setStatus(
                "Ready",
                "ready"
            );
        }

    },
    100
);