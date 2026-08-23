/* ============================================================
   SPEECH TRACKER
   Complete replacement script.js
   ============================================================ */


/* ============================================================
   DEFAULT WORDS
   ============================================================ */

const DEFAULT_TRACKED_WORDS = [
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


const WORD_STORAGE_KEY =
    "speechTrackerWords";

const SPEECH_STORAGE_KEY =
    "speechTrackerSavedSpeeches";

const THEME_STORAGE_KEY =
    "speechTrackerTheme";


/* ============================================================
   ELEMENTS
   ============================================================ */

const listenButton =
    document.getElementById("listenButton");

const stopButton =
    document.getElementById("stopButton");

const heardElement =
    document.getElementById("heard");

const statusElement =
    document.getElementById("status");

const statusDot =
    document.getElementById("statusDot");

const fillerCountElement =
    document.getElementById("fillerCount");

const wordCountElement =
    document.getElementById("wordCount");

const customWordInput =
    document.getElementById("customWordInput");

const addWordButton =
    document.getElementById("addWordButton");

const resetWordsButton =
    document.getElementById("resetWordsButton");

const wordList =
    document.getElementById("wordList");

const enableNotificationsButton =
    document.getElementById(
        "enableNotifications"
    );

const notificationStatus =
    document.getElementById(
        "notificationStatus"
    );

const finalTranscriptElement =
    document.getElementById(
        "finalTranscript"
    );

const analyzeButton =
    document.getElementById(
        "analyzeButton"
    );

const analysisLoading =
    document.getElementById(
        "analysisLoading"
    );

const analysisElement =
    document.getElementById(
        "analysis"
    );

const saveSpeechCard =
    document.getElementById(
        "saveSpeechCard"
    );

const saveSpeechButton =
    document.getElementById(
        "saveSpeechButton"
    );

const discardSpeechButton =
    document.getElementById(
        "discardSpeechButton"
    );

const savedSpeechesElement =
    document.getElementById(
        "savedSpeeches"
    );

const savedSpeechCount =
    document.getElementById(
        "savedSpeechCount"
    );

const recordingTimerElement =
    document.getElementById(
        "recordingTimer"
    );

const themeToggle =
    document.getElementById(
        "themeToggle"
    );

const themeToggleText =
    document.getElementById(
        "themeToggleText"
    );

const fastFillerAlert =
    document.getElementById(
        "fastFillerAlert"
    );


/* ============================================================
   STATE
   ============================================================ */

let trackedWords = [];

let recognition = null;

let recognitionSupported = false;

let isListening = false;

let recognitionRestarting = false;

let liveFinalTranscript = "";

let liveInterimTranscript = "";

let currentSpeechTranscript = "";

let fillerCount = 0;

let totalWords = 0;

let mediaRecorder = null;

let audioChunks = [];

let recordingStream = null;

let recordingStartTime = null;

let timerInterval = null;

let pendingSpeech = null;

let lastDetectedLiveWord = "";

let lastDetectedLiveTime = 0;

let lastProcessedTranscript = "";

let notificationPermissionRequested = false;


/*
   Small cooldown prevents the SAME interim result from
   repeatedly firing notifications while the browser is
   still updating it.

   This is intentionally short because we want very fast
   feedback.
*/

const LIVE_NOTIFICATION_COOLDOWN = 450;


/* ============================================================
   TRACKED WORD STORAGE
   ============================================================ */

function loadTrackedWords() {

    try {

        const stored =
            JSON.parse(
                localStorage.getItem(
                    WORD_STORAGE_KEY
                )
            );

        if (
            Array.isArray(stored) &&
            stored.length > 0
        ) {

            trackedWords =
                stored
                    .map(word =>
                        String(word)
                            .toLowerCase()
                            .trim()
                    )
                    .filter(Boolean);

            return;
        }

    } catch (error) {

        console.warn(
            "Could not load tracked words:",
            error
        );
    }


    trackedWords =
        [...DEFAULT_TRACKED_WORDS];

    saveTrackedWords();
}


function saveTrackedWords() {

    localStorage.setItem(
        WORD_STORAGE_KEY,
        JSON.stringify(
            trackedWords
        )
    );
}


/* ============================================================
   WORD LIST UI
   ============================================================ */

function renderWordList() {

    if (!wordList) return;

    wordList.innerHTML = "";

    trackedWords.forEach(word => {

        const tag =
            document.createElement(
                "span"
            );

        tag.className =
            "word-tag";


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

        removeButton.type =
            "button";

        removeButton.textContent =
            "×";

        removeButton.setAttribute(
            "aria-label",
            `Remove ${word}`
        );


        removeButton.addEventListener(
            "click",
            () => {

                trackedWords =
                    trackedWords.filter(
                        item =>
                            item !== word
                    );

                saveTrackedWords();

                renderWordList();
            }
        );


        tag.appendChild(text);

        tag.appendChild(
            removeButton
        );

        wordList.appendChild(tag);
    });
}


/* ============================================================
   ADD CUSTOM WORD
   ============================================================ */

function addTrackedWord() {

    if (!customWordInput) return;

    const value =
        customWordInput.value
            .toLowerCase()
            .trim();


    if (!value) {
        return;
    }


    if (
        trackedWords.includes(
            value
        )
    ) {

        customWordInput.value =
            "";

        return;
    }


    trackedWords.push(value);

    saveTrackedWords();

    renderWordList();

    customWordInput.value = "";

    customWordInput.focus();
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

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                addTrackedWord();
            }
        }
    );
}


if (resetWordsButton) {

    resetWordsButton.addEventListener(
        "click",
        () => {

            trackedWords =
                [...DEFAULT_TRACKED_WORDS];

            saveTrackedWords();

            renderWordList();
        }
    );
}


/* ============================================================
   THEME
   ============================================================ */

function updateThemeButton() {

    if (!themeToggleText) {
        return;
    }


    const currentTheme =
        document.documentElement
            .getAttribute(
                "data-theme"
            );


    if (
        currentTheme === "dark"
    ) {

        themeToggleText.textContent =
            "Light";

    } else {

        themeToggleText.textContent =
            "Dark";
    }
}


function setTheme(theme) {

    if (theme === "dark") {

        document.documentElement
            .setAttribute(
                "data-theme",
                "dark"
            );

        localStorage.setItem(
            THEME_STORAGE_KEY,
            "dark"
        );

    } else {

        document.documentElement
            .removeAttribute(
                "data-theme"
            );

        localStorage.setItem(
            THEME_STORAGE_KEY,
            "light"
        );
    }


    updateThemeButton();
}


function initializeTheme() {

    const savedTheme =
        localStorage.getItem(
            THEME_STORAGE_KEY
        );


    if (
        savedTheme === "dark"
    ) {

        setTheme("dark");

    } else {

        setTheme("light");
    }
}


if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        () => {

            const currentTheme =
                document.documentElement
                    .getAttribute(
                        "data-theme"
                    );


            if (
                currentTheme === "dark"
            ) {

                setTheme("light");

            } else {

                setTheme("dark");
            }
        }
    );
}


initializeTheme();


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

function updateNotificationStatus() {

    if (
        !notificationStatus
    ) {
        return;
    }


    if (
        !("Notification" in window)
    ) {

        notificationStatus.textContent =
            "Browser notifications are not supported.";

        return;
    }


    if (
        Notification.permission ===
        "granted"
    ) {

        notificationStatus.textContent =
            "Notifications are enabled.";

        if (
            enableNotificationsButton
        ) {

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

        notificationStatus.textContent =
            "Notifications are blocked. Enable them in your browser settings.";

    } else {

        notificationStatus.textContent =
            "Notifications are not enabled.";
    }
}


async function requestNotifications() {

    if (
        !("Notification" in window)
    ) {

        updateNotificationStatus();

        return;
    }


    if (
        notificationPermissionRequested
    ) {
        return;
    }


    notificationPermissionRequested =
        true;


    try {

        await Notification.requestPermission();

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

    } finally {

        notificationPermissionRequested =
            false;

        updateNotificationStatus();
    }
}


if (
    enableNotificationsButton
) {

    enableNotificationsButton.addEventListener(
        "click",
        requestNotifications
    );
}


updateNotificationStatus();


/* ============================================================
   TEXT NORMALIZATION
   ============================================================ */

function normalizeSpeech(text) {

    return String(text || "")
        .toLowerCase()
        .replace(
            /[.,!?;:()[\]{}"']/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


/* ============================================================
   ESCAPE REGEX
   ============================================================ */

function escapeRegExp(text) {

    return text.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}


/* ============================================================
   FIND TRACKED WORD
   ============================================================ */

function findTrackedWord(text) {

    const normalized =
        normalizeSpeech(text);


    if (!normalized) {
        return null;
    }


    /*
       Longer phrases first.

       This makes "you know" get checked
       before individual words.
    */

    const sortedWords =
        [...trackedWords].sort(
            (a, b) =>
                b.length - a.length
        );


    for (
        const trackedWord
        of sortedWords
    ) {

        const escaped =
            escapeRegExp(
                trackedWord
            );


        const pattern =
            new RegExp(
                `(^|\\s)${escaped}(?=\\s|$)`,
                "i"
            );


        if (
            pattern.test(
                normalized
            )
        ) {

            return trackedWord;
        }
    }


    return null;
}


/* ============================================================
   FAST LIVE FILLER DETECTION
   ============================================================ */

function detectLiveFiller(text) {

    if (!text) {
        return;
    }


    const detectedWord =
        findTrackedWord(text);


    if (!detectedWord) {
        return;
    }


    const now =
        Date.now();


    /*
       Prevent duplicate notifications when
       interim recognition results repeat.
    */

    if (
        lastDetectedLiveWord ===
            detectedWord &&
        now -
            lastDetectedLiveTime <
            LIVE_NOTIFICATION_COOLDOWN
    ) {

        return;
    }


    lastDetectedLiveWord =
        detectedWord;

    lastDetectedLiveTime =
        now;


    triggerFastFillerAlert(
        detectedWord
    );
}


/* ============================================================
   FAST FILLER ALERT
   ============================================================ */

function triggerFastFillerAlert(
    word
) {

    console.log(
        "FAST FILLER DETECTED:",
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
                [70, 35, 70]
            );

        } catch (error) {

            console.warn(
                "Vibration failed:",
                error
            );
        }
    }


    /*
       BROWSER NOTIFICATION
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
                        `You said "${word}"`,

                    tag:
                        `filler-${Date.now()}`,

                    silent:
                        false
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
       ON-SCREEN ALERT
    */

    showFastFillerOverlay(
        word
    );
}


/* ============================================================
   ON-SCREEN FILLER ALERT
   ============================================================ */

let fillerOverlayTimer = null;


function showFastFillerOverlay(
    word
) {

    if (!fastFillerAlert) {
        return;
    }


    fastFillerAlert.textContent =
        `⚠ "${word}"`;


    fastFillerAlert.classList.remove(
        "show"
    );


    /*
       Force a browser layout pass so
       the animation restarts immediately.
    */

    void fastFillerAlert.offsetWidth;


    fastFillerAlert.classList.add(
        "show"
    );


    clearTimeout(
        fillerOverlayTimer
    );


    fillerOverlayTimer =
        setTimeout(
            () => {

                fastFillerAlert.classList.remove(
                    "show"
                );

            },
            900
        );
}


/* ============================================================
   SPEECH RECOGNITION SETUP
   ============================================================ */

function initializeRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        recognitionSupported =
            false;

        console.warn(
            "Speech Recognition is not supported."
        );

        return;
    }


    recognitionSupported =
        true;


    recognition =
        new SpeechRecognition();


    /*
       CRITICAL FOR SPEED:

       Interim results let us detect
       "um", "uh", "umm", etc. BEFORE
       the browser finalizes the result.
    */

    recognition.interimResults =
        true;


    recognition.continuous =
        true;


    recognition.lang =
        "en-US";


    recognition.maxAlternatives =
        1;


    recognition.onstart =
        () => {

            recognitionRestarting =
                false;

            console.log(
                "Speech recognition started."
            );
        };


    recognition.onresult =
        event => {

            let interimTranscript =
                "";

            let finalTranscript =
                "";


            for (
                let i =
                    event.resultIndex;
                i <
                    event.results.length;
                i++
            ) {

                const result =
                    event.results[i];


                const text =
                    result[0]
                        .transcript;


                /*
                   IMPORTANT:

                   Detect the word immediately,
                   regardless of whether the result
                   is final.

                   This is what removes the extra
                   waiting period.
                */

                detectLiveFiller(
                    text
                );


                if (
                    result.isFinal
                ) {

                    finalTranscript +=
                        text + " ";

                } else {

                    interimTranscript +=
                        text;
                }
            }


            liveFinalTranscript +=
                finalTranscript;


            liveInterimTranscript =
                interimTranscript;


            const combined =
                (
                    liveFinalTranscript +
                    " " +
                    liveInterimTranscript
                ).trim();


            updateLiveTranscript(
                combined
            );


            updateStats(
                combined
            );
        };


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

                setStatus(
                    "Microphone permission denied",
                    "error"
                );

                stopListeningUI();

                return;
            }


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


    recognition.onend =
        () => {

            console.log(
                "Speech recognition ended."
            );


            if (
                isListening &&
                !recognitionRestarting
            ) {

                /*
                   Some browsers automatically
                   stop recognition.

                   Restart it while the user
                   is still recording.
                */

                try {

                    recognitionRestarting =
                        true;

                    recognition.start();

                } catch (error) {

                    recognitionRestarting =
                        false;

                    console.warn(
                        "Recognition restart failed:",
                        error
                    );
                }
            }
        };
}


initializeRecognition();


/* ============================================================
   LIVE TRANSCRIPT UI
   ============================================================ */

function updateLiveTranscript(
    text
) {

    if (!heardElement) {
        return;
    }


    if (!text) {

        heardElement.innerHTML =
            `<span class="heard-placeholder">
                Listening...
            </span>`;

        return;
    }


    heardElement.innerHTML =
        highlightTrackedWords(
            escapeHTML(text)
        );
}


/* ============================================================
   ESCAPE HTML
   ============================================================ */

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
   HIGHLIGHT TRACKED WORDS
   ============================================================ */

function highlightTrackedWords(
    escapedText
) {

    let result =
        escapedText;


    const sortedWords =
        [...trackedWords].sort(
            (a, b) =>
                b.length - a.length
        );


    for (
        const word
        of sortedWords
    ) {

        const escapedWord =
            escapeRegExp(
                escapeHTML(word)
            );


        const pattern =
            new RegExp(
                `(^|\\s)(${escapedWord})(?=\\s|$)`,
                "gi"
            );


        result =
            result.replace(
                pattern,
                `$1<span class="highlight">$2</span>`
            );
    }


    return result;
}


/* ============================================================
   STATS
   ============================================================ */

function updateStats(text) {

    const words =
        normalizeSpeech(
            text
        )
            .split(" ")
            .filter(Boolean);


    totalWords =
        words.length;


    let detectedCount =
        0;


    for (
        const word
        of trackedWords
    ) {

        const escaped =
            escapeRegExp(
                word
            );


        const regex =
            new RegExp(
                `(^|\\s)${escaped}(?=\\s|$)`,
                "gi"
            );


        const matches =
            normalizeSpeech(
                text
            ).match(regex);


        if (matches) {

            detectedCount +=
                matches.length;
        }
    }


    fillerCount =
        detectedCount;


    if (
        fillerCountElement
    ) {

        fillerCountElement.textContent =
            fillerCount;
    }


    if (
        wordCountElement
    ) {

        wordCountElement.textContent =
            totalWords;
    }
}


/* ============================================================
   STATUS
   ============================================================ */

function setStatus(
    text,
    type = "ready"
) {

    if (statusElement) {

        statusElement.textContent =
            text;
    }


    if (statusDot) {

        statusDot.className =
            `dot ${type}`;
    }
}


/* ============================================================
   TIMER
   ============================================================ */

function formatTime(
    seconds
) {

    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainingSeconds =
        seconds % 60;


    return (
        String(minutes)
            .padStart(2, "0") +
        ":" +
        String(
            remainingSeconds
        ).padStart(2, "0")
    );
}


function startTimer() {

    recordingStartTime =
        Date.now();


    if (
        recordingTimerElement
    ) {

        recordingTimerElement.textContent =
            "00:00";
    }


    clearInterval(
        timerInterval
    );


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


                if (
                    recordingTimerElement
                ) {

                    recordingTimerElement.textContent =
                        formatTime(
                            elapsed
                        );
                }

            },
            500
        );
}


function stopTimer() {

    clearInterval(
        timerInterval
    );

    timerInterval =
        null;
}


/* ============================================================
   RECORDING AUDIO
   ============================================================ */

async function startAudioRecording() {

    try {

        recordingStream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });


        audioChunks =
            [];


        let mimeType =
            "";


        const possibleTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4",
            "audio/ogg;codecs=opus"
        ];


        for (
            const type
            of possibleTypes
        ) {

            if (
                MediaRecorder.isTypeSupported(
                    type
                )
            ) {

                mimeType =
                    type;

                break;
            }
        }


        mediaRecorder =
            mimeType
                ? new MediaRecorder(
                    recordingStream,
                    {
                        mimeType
                    }
                )
                : new MediaRecorder(
                    recordingStream
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


    } catch (error) {

        console.error(
            "Could not access microphone:",
            error
        );

        throw error;
    }
}


/* ============================================================
   STOP AUDIO RECORDING
   ============================================================ */

function stopAudioRecording() {

    return new Promise(
        resolve => {

            if (
                !mediaRecorder ||
                mediaRecorder.state ===
                    "inactive"
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


                    if (
                        recordingStream
                    ) {

                        recordingStream
                            .getTracks()
                            .forEach(
                                track =>
                                    track.stop()
                            );
                    }


                    recordingStream =
                        null;


                    resolve(blob);
                };


            mediaRecorder.stop();
        }
    );
}


/* ============================================================
   START LISTENING
   ============================================================ */

async function startListening() {

    if (isListening) {
        return;
    }


    /*
       Reset speech state.
    */

    liveFinalTranscript =
        "";

    liveInterimTranscript =
        "";

    currentSpeechTranscript =
        "";

    fillerCount =
        0;

    totalWords =
        0;

    lastDetectedLiveWord =
        "";

    lastDetectedLiveTime =
        0;


    updateStats("");


    if (finalTranscriptElement) {

        finalTranscriptElement.textContent =
            "Your final transcript will appear here after you finish speaking.";
    }


    if (analysisElement) {

        analysisElement.innerHTML =
            "";
    }


    if (saveSpeechCard) {

        saveSpeechCard.classList.add(
            "hidden"
        );
    }


    try {

        /*
           Ask for microphone permission FIRST.
        */

        await startAudioRecording();


        isListening =
            true;


        listenButton.disabled =
            true;

        stopButton.disabled =
            false;


        setStatus(
            "Listening",
            "listening"
        );


        startTimer();


        /*
           Start browser recognition.
        */

        if (
            recognitionSupported
        ) {

            try {

                recognition.start();

            } catch (error) {

                console.warn(
                    "Recognition start:",
                    error
                );
            }

        } else {

            setStatus(
                "Recording",
                "listening"
            );
        }


        updateLiveTranscript(
            ""
        );


    } catch (error) {

        isListening =
            false;

        listenButton.disabled =
            false;

        stopButton.disabled =
            true;

        setStatus(
            "Microphone unavailable",
            "error"
        );
    }
}


/* ============================================================
   STOP LISTENING
   ============================================================ */

async function stopListening() {

    if (!isListening) {
        return;
    }


    isListening =
        false;


    listenButton.disabled =
        false;

    stopButton.disabled =
        true;


    stopTimer();


    setStatus(
        "Processing",
        "ready"
    );


    /*
       Stop speech recognition.
    */

    if (
        recognitionSupported &&
        recognition
    ) {

        try {

            recognition.stop();

        } catch (error) {

            console.warn(
                "Recognition stop:",
                error
            );
        }
    }


    /*
       Give the recognition engine a tiny
       amount of time to deliver its last
       result before using the transcript.
    */

    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                100
            )
    );


    const recognitionTranscript =
        (
            liveFinalTranscript +
            " " +
            liveInterimTranscript
        ).trim();


    /*
       Stop the audio recorder.
    */

    let audioBlob =
        null;


    try {

        audioBlob =
            await stopAudioRecording();

    } catch (error) {

        console.error(
            "Audio recording stop error:",
            error
        );
    }


    currentSpeechTranscript =
        recognitionTranscript;


    /*
       Show the recognition transcript
       immediately while the server creates
       the higher-quality final transcript.
    */

    if (
        recognitionTranscript
    ) {

        finalTranscriptElement.innerHTML =
            highlightTrackedWords(
                escapeHTML(
                    recognitionTranscript
                )
            );

    } else {

        finalTranscriptElement.textContent =
            "Creating final transcript...";
    }


    /*
       Send recorded audio to OpenAI.
    */

    if (audioBlob) {

        await createFinalTranscription(
            audioBlob
        );

    } else {

        finishSpeech(
            currentSpeechTranscript
        );
    }
}


/* ============================================================
   FINAL TRANSCRIPTION
   ============================================================ */

async function createFinalTranscription(
    audioBlob
) {

    try {

        setStatus(
            "Creating transcript",
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
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            audio:
                                base64
                        })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok
        ) {

            throw new Error(
                data?.error ||
                "Transcription failed"
            );
        }


        const transcript =
            data?.transcript ||
            data?.text ||
            currentSpeechTranscript;


        finishSpeech(
            transcript
        );


    } catch (error) {

        console.error(
            "Final transcription error:",
            error
        );


        /*
           Don't lose the speech just because
           the final server transcription failed.
        */

        finishSpeech(
            currentSpeechTranscript
        );
    }
}


/* ============================================================
   BLOB TO BASE64
   ============================================================ */

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

                    const result =
                        reader.result;


                    if (
                        typeof result !==
                        "string"
                    ) {

                        reject(
                            new Error(
                                "Could not read audio."
                            )
                        );

                        return;
                    }


                    const base64 =
                        result.split(
                            ","
                        )[1];


                    resolve(
                        base64
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
   FINISH SPEECH
   ============================================================ */

function finishSpeech(
    transcript
) {

    currentSpeechTranscript =
        String(
            transcript || ""
        ).trim();


    updateStats(
        currentSpeechTranscript
    );


    if (
        finalTranscriptElement
    ) {

        if (
            currentSpeechTranscript
        ) {

            finalTranscriptElement.innerHTML =
                highlightTrackedWords(
                    escapeHTML(
                        currentSpeechTranscript
                    )
                );

        } else {

            finalTranscriptElement.textContent =
                "No speech was detected.";
        }
    }


    setStatus(
        "Finished",
        "ready"
    );


    /*
       Enable AI analysis.
    */

    if (
        analyzeButton
    ) {

        analyzeButton.disabled =
            !currentSpeechTranscript;
    }


    /*
       Show Save Speech prompt.
    */

    if (
        currentSpeechTranscript &&
        saveSpeechCard
    ) {

        saveSpeechCard.classList.remove(
            "hidden"
        );

        saveSpeechCard.scrollIntoView({
            behavior:
                "smooth",
            block:
                "center"
        });
    }
}


/* ============================================================
   STOP LISTENING UI
   ============================================================ */

function stopListeningUI() {

    isListening =
        false;

    stopTimer();


    if (listenButton) {

        listenButton.disabled =
            false;
    }


    if (stopButton) {

        stopButton.disabled =
            true;
    }
}


/* ============================================================
   BUTTON EVENTS
   ============================================================ */

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


/* ============================================================
   AI ANALYSIS
   ============================================================ */

async function analyzeSpeech() {

    if (
        !currentSpeechTranscript
    ) {

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
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            transcript:
                                currentSpeechTranscript
                        })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok
        ) {

            throw new Error(
                data?.error ||
                "AI analysis failed"
            );
        }


        /*
           Your API returns both:

           data.analysis
           data.analysisData
        */

        if (
            data?.analysis
        ) {

            analysisElement.textContent =
                data.analysis;

        } else if (
            data?.analysisData
        ) {

            displayStructuredAnalysis(
                data.analysisData
            );

        } else {

            throw new Error(
                "AI returned no analysis."
            );
        }


        analysisElement.scrollIntoView({
            behavior:
                "smooth",
            block:
                "center"
        });


    } catch (error) {

        console.error(
            "AI analysis error:",
            error
        );


        analysisElement.textContent =
            "Could not analyze this speech. Please try again.";

    } finally {

        if (analysisLoading) {

            analysisLoading.hidden =
                true;
        }


        analyzeButton.disabled =
            false;
    }
}


function displayStructuredAnalysis(
    data
) {

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
        ]
    ];


    analysisElement.innerHTML =
        "";


    sections.forEach(
        ([title, value]) => {

            if (!value) {
                return;
            }


            const section =
                document.createElement(
                    "div"
                );


            section.style.marginBottom =
                "18px";


            const heading =
                document.createElement(
                    "strong"
                );


            heading.textContent =
                title;


            const paragraph =
                document.createElement(
                    "p"
                );


            paragraph.textContent =
                value;


            paragraph.style.margin =
                "5px 0 0";


            paragraph.style.color =
                "var(--text-secondary)";


            section.appendChild(
                heading
            );

            section.appendChild(
                paragraph
            );

            analysisElement.appendChild(
                section
            );
        }
    );
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

function loadSavedSpeeches() {

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(
                    SPEECH_STORAGE_KEY
                )
            );


        if (
            Array.isArray(saved)
        ) {

            return saved;
        }

    } catch (error) {

        console.warn(
            "Could not load saved speeches:",
            error
        );
    }


    return [];
}


function saveSavedSpeeches(
    speeches
) {

    localStorage.setItem(
        SPEECH_STORAGE_KEY,
        JSON.stringify(
            speeches
        )
    );
}


function renderSavedSpeeches() {

    if (
        !savedSpeechesElement
    ) {

        return;
    }


    const speeches =
        loadSavedSpeeches();


    if (
        savedSpeechCount
    ) {

        savedSpeechCount.textContent =
            speeches.length;
    }


    if (
        speeches.length === 0
    ) {

        savedSpeechesElement.innerHTML =
            `
            <div class="empty-state">
                <div class="empty-icon">
                    ◌
                </div>

                <p>
                    No saved speeches yet.
                </p>
            </div>
            `;

        return;
    }


    savedSpeechesElement.innerHTML =
        "";


    speeches.forEach(
        speech => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "saved-speech";


            const header =
                document.createElement(
                    "div"
                );

            header.className =
                "saved-speech-header";


            const title =
                document.createElement(
                    "div"
                );

            title.className =
                "saved-speech-title";

            title.textContent =
                speech.title ||
                "Speech";


            const date =
                document.createElement(
                    "div"
                );

            date.className =
                "saved-speech-date";

            date.textContent =
                formatSavedDate(
                    speech.date
                );


            header.appendChild(
                title
            );

            header.appendChild(
                date
            );


            const preview =
                document.createElement(
                    "div"
                );

            preview.className =
                "saved-speech-preview";

            preview.textContent =
                speech.transcript;


            const actions =
                document.createElement(
                    "div"
                );

            actions.className =
                "saved-speech-actions";


            const viewButton =
                document.createElement(
                    "button"
                );

            viewButton.type =
                "button";

            viewButton.className =
                "button secondary";

            viewButton.textContent =
                "View";


            viewButton.addEventListener(
                "click",
                () => {

                    currentSpeechTranscript =
                        speech.transcript;


                    if (
                        finalTranscriptElement
                    ) {

                        finalTranscriptElement.innerHTML =
                            highlightTrackedWords(
                                escapeHTML(
                                    speech.transcript
                                )
                            );
                    }


                    if (
                        analyzeButton
                    ) {

                        analyzeButton.disabled =
                            false;
                    }


                    window.scrollTo({
                        top:
                            document.querySelector(
                                ".recording-card"
                            )?.offsetTop || 0,

                        behavior:
                            "smooth"
                    });
                }
            );


            const deleteButton =
                document.createElement(
                    "button"
                );

            deleteButton.type =
                "button";

            deleteButton.className =
                "button secondary";

            deleteButton.textContent =
                "Delete";


            deleteButton.addEventListener(
                "click",
                () => {

                    const updated =
                        loadSavedSpeeches()
                            .filter(
                                saved =>
                                    saved.id !==
                                    speech.id
                            );


                    saveSavedSpeeches(
                        updated
                    );

                    renderSavedSpeeches();
                }
            );


            actions.appendChild(
                viewButton
            );

            actions.appendChild(
                deleteButton
            );


            item.appendChild(
                header
            );

            item.appendChild(
                preview
            );

            item.appendChild(
                actions
            );


            savedSpeechesElement.appendChild(
                item
            );
        }
    );
}


function formatSavedDate(
    date
) {

    if (!date) {
        return "";
    }


    try {

        return new Date(
            date
        ).toLocaleString();

    } catch {

        return "";
    }
}


/* ============================================================
   SAVE CURRENT SPEECH
   ============================================================ */

function saveCurrentSpeech() {

    if (
        !currentSpeechTranscript
    ) {

        return;
    }


    const speeches =
        loadSavedSpeeches();


    const speech = {

        id:
            Date.now(),

        title:
            `Speech ${speeches.length + 1}`,

        date:
            new Date().toISOString(),

        transcript:
            currentSpeechTranscript,

        fillerCount:
            fillerCount,

        wordCount:
            totalWords
    };


    speeches.unshift(
        speech
    );


    /*
       Keep the newest 50 speeches.
    */

    const trimmed =
        speeches.slice(
            0,
            50
        );


    saveSavedSpeeches(
        trimmed
    );


    renderSavedSpeeches();


    if (
        saveSpeechCard
    ) {

        saveSpeechCard.classList.add(
            "hidden"
        );
    }


    /*
       Give the user immediate feedback.
    */

    if (
        saveSpeechButton
    ) {

        saveSpeechButton.textContent =
            "✓ Saved";

        setTimeout(
            () => {

                saveSpeechButton.textContent =
                    "✓ Save Speech";

            },
            1200
        );
    }
}


if (saveSpeechButton) {

    saveSpeechButton.addEventListener(
        "click",
        saveCurrentSpeech
    );
}


/* ============================================================
   DISCARD CURRENT SPEECH
   ============================================================ */

if (
    discardSpeechButton
) {

    discardSpeechButton.addEventListener(
        "click",
        () => {

            pendingSpeech =
                null;


            if (
                saveSpeechCard
            ) {

                saveSpeechCard.classList.add(
                    "hidden"
                );
            }
        }
    );
}


/* ============================================================
   INITIALIZE
   ============================================================ */

loadTrackedWords();

renderWordList();

renderSavedSpeeches();

updateNotificationStatus();


/* ============================================================
   SCROLL INDICATOR
   Hide it after the user begins scrolling.
   ============================================================ */

const scrollIndicator =
    document.getElementById(
        "scrollIndicator"
    );


if (scrollIndicator) {

    let indicatorHidden =
        false;


    window.addEventListener(
        "scroll",
        () => {

            if (
                indicatorHidden
            ) {

                return;
            }


            if (
                window.scrollY > 80
            ) {

                indicatorHidden =
                    true;

                scrollIndicator.style.opacity =
                    "0";

                scrollIndicator.style.pointerEvents =
                    "none";

                setTimeout(
                    () => {

                        scrollIndicator.remove();

                    },
                    250
                );
            }

        },
        {
            passive:
                true
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
           Don't automatically stop recording if
           the user temporarily switches tabs.
           The browser may suspend recognition itself;
           the recognition onend handler handles restart.
        */

        if (
            document.visibilityState ===
            "visible" &&
            isListening &&
            recognitionSupported
        ) {

            try {

                recognition.start();

            } catch {
                /*
                   Already running.
                */
            }
        }
    }
);