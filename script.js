// ============================================================
// SPEECH TRACKER
// ============================================================
// Live Speech Recognition
// + OpenAI Final Transcription
// + Filler Word Detection
// + Notifications
// + Vibration
// + AI Speech Analysis
// ============================================================


// ============================================================
// ELEMENTS
// ============================================================

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

const analyzeButton =
    document.getElementById("analyzeButton");

const analysisLoading =
    document.getElementById("analysisLoading");

const analysisElement =
    document.getElementById("analysis");

const transcriptSection =
    document.getElementById("transcriptSection");

const finalTranscriptElement =
    document.getElementById("finalTranscript");

const scrollPrompt =
    document.getElementById("scrollPrompt");

const enableNotificationsButton =
    document.getElementById(
        "enableNotifications"
    );

const notificationStatus =
    document.getElementById(
        "notificationStatus"
    );

const recordingTimer =
    document.getElementById(
        "recordingTimer"
    );


// ============================================================
// DEFAULT WORDS
// ============================================================

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


// ============================================================
// TRACKED WORDS
// ============================================================

let trackedWords = [];

try {

    const saved =
        localStorage.getItem(
            "speechTrackerWords"
        );

    if (saved) {

        const parsed =
            JSON.parse(saved);

        if (
            Array.isArray(parsed) &&
            parsed.length > 0
        ) {

            trackedWords =
                parsed
                    .map(word =>
                        String(word)
                            .trim()
                            .toLowerCase()
                    )
                    .filter(Boolean);

        }

    }

} catch (error) {

    console.log(
        "Could not load saved words:",
        error
    );

}


if (trackedWords.length === 0) {

    trackedWords =
        [...DEFAULT_WORDS];

}


// ============================================================
// SAVE WORDS
// ============================================================

function saveWords() {

    try {

        localStorage.setItem(
            "speechTrackerWords",
            JSON.stringify(
                trackedWords
            )
        );

    } catch (error) {

        console.log(
            "Could not save words:",
            error
        );

    }

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(text ?? "");

    return div.innerHTML;

}


// ============================================================
// ESCAPE REGEX
// ============================================================

function escapeRegex(text) {

    return String(text)
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

}


// ============================================================
// STATUS
// ============================================================

function setStatus(
    message,
    state = "ready"
) {

    if (statusText) {

        statusText.textContent =
            message;

    }

    if (statusDot) {

        statusDot.className =
            "dot " + state;

    }

}


// ============================================================
// MESSAGE
// ============================================================

function showMessage(message) {

    if (!heardText) {
        return;
    }

    heardText.innerHTML = `
        <span class="placeholder">
            ${escapeHTML(message)}
        </span>
    `;

}


// ============================================================
// RENDER WORDS
// ============================================================

function renderWords() {

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


// ============================================================
// ADD CUSTOM WORD
// ============================================================

function addCustomWord() {

    if (!customWordInput) {
        return;
    }


    const word =
        customWordInput.value
            .trim()
            .toLowerCase();


    if (!word) {
        return;
    }


    if (
        !trackedWords.includes(word)
    ) {

        trackedWords.push(
            word
        );

        saveWords();

        renderWords();

    }


    customWordInput.value =
        "";

}


// ============================================================
// CUSTOM WORD BUTTON
// ============================================================

if (addWordButton) {

    addWordButton.addEventListener(
        "click",
        addCustomWord
    );

}


// ============================================================
// ENTER TO ADD WORD
// ============================================================

if (customWordInput) {

    customWordInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                addCustomWord();

            }

        }
    );

}


// ============================================================
// RESET WORDS
// ============================================================

if (resetWordsButton) {

    resetWordsButton.addEventListener(
        "click",
        () => {

            trackedWords =
                [...DEFAULT_WORDS];

            saveWords();

            renderWords();

        }
    );

}


// ============================================================
// SPECIAL FILLER PATTERN
// ============================================================

function getWordPattern(word) {

    const normalized =
        word
            .trim()
            .toLowerCase();


    // Detect:
    //
    // um
    // umm
    // ummm
    // ummmm

    if (
        normalized === "um" ||
        /^um+$/.test(normalized)
    ) {

        return "\\bum+\\b";

    }


    // Detect:
    //
    // uh
    // uhh
    // uhhh
    // uhhhh

    if (
        normalized === "uh" ||
        /^uh+$/.test(normalized)
    ) {

        return "\\buh+\\b";

    }


    return (
        "\\b" +
        escapeRegex(normalized) +
        "\\b"
    );

}


// ============================================================
// FIND TRACKED WORDS
// ============================================================

function findTrackedWords(text) {

    const matches = [];


    if (
        !text ||
        !text.trim()
    ) {

        return matches;

    }


    trackedWords.forEach(
        word => {

            if (
                !word ||
                !word.trim()
            ) {

                return;

            }


            const regex =
                new RegExp(
                    getWordPattern(word),
                    "gi"
                );


            let match;


            while (
                (match =
                    regex.exec(text)) !== null
            ) {

                matches.push({

                    word:
                        match[0],

                    trackedWord:
                        word,

                    index:
                        match.index

                });

            }

        }
    );


    matches.sort(
        (a, b) =>
            a.index - b.index
    );


    return matches;

}


// ============================================================
// COUNT TRACKED WORDS
// ============================================================

function countTrackedWords(text) {

    if (
        !text ||
        !text.trim()
    ) {

        return 0;

    }


    let count = 0;


    trackedWords.forEach(
        word => {

            const regex =
                new RegExp(
                    getWordPattern(word),
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


// ============================================================
// COUNT TOTAL WORDS
// ============================================================

function countTotalWords(text) {

    if (
        !text ||
        !text.trim()
    ) {

        return 0;

    }


    return text
        .trim()
        .split(/\s+/)
        .length;

}


// ============================================================
// HIGHLIGHT TRACKED WORDS
// ============================================================

function highlightTrackedWords(text) {

    let result =
        escapeHTML(text);


    const sortedWords =
        [...trackedWords].sort(
            (a, b) =>
                b.length - a.length
        );


    sortedWords.forEach(
        word => {

            if (
                !word ||
                !word.trim()
            ) {

                return;

            }


            const normalized =
                word
                    .trim()
                    .toLowerCase();


            let pattern;


            if (
                normalized === "um" ||
                /^um+$/.test(normalized)
            ) {

                pattern =
                    "(^|\\s)(um+)(?=\\s|[.,!?;:]|$)";

            }

            else if (
                normalized === "uh" ||
                /^uh+$/.test(normalized)
            ) {

                pattern =
                    "(^|\\s)(uh+)(?=\\s|[.,!?;:]|$)";

            }

            else {

                pattern =
                    "(^|\\s)(" +
                    escapeRegex(
                        escapeHTML(word)
                    ) +
                    ")(?=\\s|[.,!?;:]|$)";

            }


            const regex =
                new RegExp(
                    pattern,
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


// ============================================================
// NOTIFICATION SUPPORT
// ============================================================

function updateNotificationStatus() {

    if (!notificationStatus) {
        return;
    }


    if (
        !("Notification" in window)
    ) {

        notificationStatus.textContent =
            "Notifications are not supported by this browser.";

        return;

    }


    if (
        Notification.permission ===
        "granted"
    ) {

        notificationStatus.textContent =
            "✅ Notifications are enabled.";

    }

    else if (
        Notification.permission ===
        "denied"
    ) {

        notificationStatus.textContent =
            "⚠️ Notifications are blocked. Check your device settings.";

    }

    else {

        notificationStatus.textContent =
            "Notifications are not enabled.";

    }

}


// ============================================================
// REQUEST NOTIFICATIONS
// ============================================================

async function requestNotificationPermission() {

    if (
        !("Notification" in window)
    ) {

        if (notificationStatus) {

            notificationStatus.textContent =
                "Notifications are not supported on this browser.";

        }

        return;

    }


    try {

        const permission =
            await Notification.requestPermission();


        updateNotificationStatus();


        if (
            permission === "granted"
        ) {

            sendNotification(
                "Speech Tracker",
                "Notifications are now enabled."
            );

        }

    } catch (error) {

        console.error(
            "Notification permission error:",
            error
        );

    }

}


// ============================================================
// SEND NOTIFICATION
// ============================================================

function sendNotification(
    title,
    body
) {

    if (
        !("Notification" in window)
    ) {

        return false;

    }


    if (
        Notification.permission !==
        "granted"
    ) {

        return false;

    }


    try {

        new Notification(
            title,
            {
                body:
                    body,

                icon:
                    "/icon-192.png",

                badge:
                    "/icon-192.png"
            }
        );


        return true;

    } catch (error) {

        console.log(
            "Notification failed:",
            error
        );

        return false;

    }

}


// ============================================================
// VIBRATION
// ============================================================

function vibrate() {

    if (
        typeof navigator.vibrate !==
        "function"
    ) {

        return false;

    }


    try {

        navigator.vibrate(
            150
        );

        return true;

    } catch (error) {

        return false;

    }

}


// ============================================================
// PREVENT DUPLICATE FILLER ALERTS
// ============================================================

let alertedFillerPositions =
    new Set();


// ============================================================
// PROCESS LIVE FILLERS
// ============================================================

function processLiveFillers(text) {

    const matches =
        findTrackedWords(text);


    if (!matches.length) {
        return;
    }


    matches.forEach(
        match => {

            const key =
                `${match.index}-${match.word.toLowerCase()}`;


            if (
                alertedFillerPositions.has(
                    key
                )
            ) {

                return;

            }


            alertedFillerPositions.add(
                key
            );


            console.log(
                "Detected tracked word:",
                match.word
            );


            vibrate();


            sendNotification(
                "Speech Tracker",
                `You said "${match.word}"`
            );

        }
    );

}


// ============================================================
// DISPLAY LIVE TRANSCRIPT
// ============================================================

function displayLiveTranscript() {

    if (!heardText) {
        return;
    }


    const combined =
        (
            liveFinalText +
            " " +
            liveInterimText
        ).trim();


    if (!combined) {

        heardText.innerHTML = `
            <span class="placeholder">
                Listening...
            </span>
        `;

        return;

    }


    heardText.innerHTML =
        highlightTrackedWords(
            combined
        );


    const count =
        countTrackedWords(
            combined
        );


    const words =
        countTotalWords(
            combined
        );


    if (fillerCountElement) {

        fillerCountElement.textContent =
            count;

    }


    if (wordCountElement) {

        wordCountElement.textContent =
            words;

    }

}


// ============================================================
// SPEECH RECOGNITION
// ============================================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


let recognition = null;

let speechRecognitionSupported =
    !!SpeechRecognition;


let liveFinalText = "";

let liveInterimText = "";

let recognitionShouldContinue =
    false;


if (speechRecognitionSupported) {

    recognition =
        new SpeechRecognition();


    recognition.continuous =
        true;


    recognition.interimResults =
        true;


    recognition.lang =
        "en-US";


    recognition.maxAlternatives =
        1;


    recognition.onstart =
        () => {

            console.log(
                "Speech recognition started."
            );

        };


    recognition.onresult =
        event => {

            let interimText =
                "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const result =
                    event.results[i];


                const text =
                    result[0].transcript;


                if (
                    result.isFinal
                ) {

                    liveFinalText +=
                        text + " ";


                    processLiveFillers(
                        liveFinalText
                    );

                }

                else {

                    interimText +=
                        text;

                }

            }


            liveInterimText =
                interimText;


            displayLiveTranscript();

        };


    recognition.onerror =
        event => {

            console.error(
                "Speech recognition error:",
                event.error
            );


            // Ignore normal browser interruption.

            if (
                event.error ===
                "aborted"
            ) {

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
                "not-allowed"
            ) {

                setStatus(
                    "Microphone permission denied",
                    "error"
                );

                return;

            }


            console.log(
                "Speech recognition error:",
                event.error
            );

        };


    recognition.onend =
        () => {

            console.log(
                "Speech recognition ended."
            );


            /*
             * Safari and Chrome sometimes stop
             * continuous recognition automatically.
             *
             * Restart while the user is still recording.
             */

            if (
                recognitionShouldContinue
            ) {

                setTimeout(
                    () => {

                        if (
                            recognitionShouldContinue
                        ) {

                            try {

                                recognition.start();

                            } catch (error) {

                                console.log(
                                    "Recognition restart:",
                                    error
                                );

                            }

                        }

                    },
                    250
                );

            }

        };

}


// ============================================================
// MEDIA RECORDER
// ============================================================

let mediaRecorder = null;

let audioStream = null;

let audioChunks = [];


// ============================================================
// RECORDING STATE
// ============================================================

let isRecording =
    false;

let recordingStartTime =
    null;

let timerInterval =
    null;


// ============================================================
// START TIMER
// ============================================================

function startTimer() {

    recordingStartTime =
        Date.now();


    if (recordingTimer) {

        recordingTimer.textContent =
            "00:00";

    }


    clearInterval(
        timerInterval
    );


    timerInterval =
        setInterval(
            () => {

                if (
                    !recordingStartTime
                ) {

                    return;

                }


                const elapsed =
                    Math.floor(
                        (
                            Date.now() -
                            recordingStartTime
                        ) / 1000
                    );


                const minutes =
                    Math.floor(
                        elapsed / 60
                    );


                const seconds =
                    elapsed % 60;


                if (recordingTimer) {

                    recordingTimer.textContent =
                        String(minutes)
                            .padStart(2, "0") +
                        ":" +
                        String(seconds)
                            .padStart(2, "0");

                }

            },
            250
        );

}


// ============================================================
// STOP TIMER
// ============================================================

function stopTimer() {

    clearInterval(
        timerInterval
    );

    timerInterval =
        null;

}


// ============================================================
// MICROPHONE SUPPORT
// ============================================================

function checkMicrophoneSupport() {

    return !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
    );

}


// ============================================================
// START RECORDING
// ============================================================

async function startRecording() {

    if (isRecording) {
        return;
    }


    if (
        !checkMicrophoneSupport()
    ) {

        setStatus(
            "Microphone unavailable",
            "error"
        );

        showMessage(
            "Your browser does not support microphone access."
        );

        return;

    }


    try {

        console.log(
            "Requesting microphone..."
        );


        audioStream =
            await navigator
                .mediaDevices
                .getUserMedia({
                    audio: true
                });


        console.log(
            "Microphone permission granted."
        );


        audioChunks = [];


        let mimeType =
            "";


        if (
            typeof MediaRecorder !==
            "undefined"
        ) {

            if (
                MediaRecorder.isTypeSupported(
                    "audio/webm;codecs=opus"
                )
            ) {

                mimeType =
                    "audio/webm;codecs=opus";

            }

            else if (
                MediaRecorder.isTypeSupported(
                    "audio/webm"
                )
            ) {

                mimeType =
                    "audio/webm";

            }

            else if (
                MediaRecorder.isTypeSupported(
                    "audio/mp4"
                )
            ) {

                mimeType =
                    "audio/mp4";

            }


            if (mimeType) {

                mediaRecorder =
                    new MediaRecorder(
                        audioStream,
                        {
                            mimeType
                        }
                    );

            }

            else {

                mediaRecorder =
                    new MediaRecorder(
                        audioStream
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

        }


        // Reset speech state.

        liveFinalText =
            "";

        liveInterimText =
            "";

        alertedFillerPositions =
            new Set();


        // Reset UI.

        if (transcriptSection) {

            transcriptSection.classList.add(
                "hidden"
            );

        }


        if (finalTranscriptElement) {

            finalTranscriptElement.innerHTML =
                "";

        }


        if (analysisElement) {

            analysisElement.innerHTML =
                "";

        }


        if (analysisIntro) {

            analysisIntro.textContent =
                "Finish speaking to unlock your personalized feedback.";

        }


        if (analyzeButton) {

            analyzeButton.disabled =
                true;

        }


        displayLiveTranscript();


        isRecording =
            true;


        recognitionShouldContinue =
            true;


        if (listenButton) {

            listenButton.disabled =
                true;

            listenButton.textContent =
                "🎤 Listening...";

        }


        if (stopButton) {

            stopButton.disabled =
                false;

        }


        setStatus(
            "Listening...",
            "listening"
        );


        startTimer();


        // Start media recording.

        if (mediaRecorder) {

            mediaRecorder.start(
                250
            );

        }


        // Start live speech recognition.

        if (recognition) {

            try {

                recognition.start();

            } catch (error) {

                console.log(
                    "Recognition start:",
                    error
                );

            }

        }


    } catch (error) {

        console.error(
            "MICROPHONE ERROR:",
            error
        );


        isRecording =
            false;


        recognitionShouldContinue =
            false;


        setStatus(
            "Microphone error",
            "error"
        );


        showMessage(
            "Microphone error: " +
            error.message
        );

    }

}


// ============================================================
// STOP RECORDING
// ============================================================

function stopRecording() {

    if (!isRecording) {
        return;
    }


    isRecording =
        false;


    recognitionShouldContinue =
        false;


    stopTimer();


    // Stop live recognition.

    if (recognition) {

        try {

            recognition.stop();

        } catch (error) {

            console.log(
                "Recognition stop:",
                error
            );

        }

    }


    // Stop media recorder.

    if (
        mediaRecorder &&
        mediaRecorder.state !==
        "inactive"
    ) {

        try {

            mediaRecorder.stop();

        } catch (error) {

            console.log(
                "MediaRecorder stop:",
                error
            );

        }

    }


    // Stop microphone.

    if (audioStream) {

        audioStream
            .getTracks()
            .forEach(
                track => {
                    track.stop();
                }
            );

    }


    if (listenButton) {

        listenButton.disabled =
            false;

        listenButton.textContent =
            "🎤 Start Speaking";

    }


    if (stopButton) {

        stopButton.disabled =
            true;

    }


    setStatus(
        "Creating transcript...",
        "listening"
    );


    showMessage(
        "🤖 Creating your final transcription..."
    );


    // Give browser speech recognition
    // a moment to deliver its last result.

    setTimeout(
        () => {

            sendRecording();

        },
        400
    );

}


// ============================================================
// LISTEN BUTTON
// ============================================================

if (listenButton) {

    listenButton.addEventListener(
        "click",
        startRecording
    );

}


// ============================================================
// STOP BUTTON
// ============================================================

if (stopButton) {

    stopButton.addEventListener(
        "click",
        stopRecording
    );

}


// ============================================================
// SEND RECORDING TO OPENAI
// ============================================================

async function sendRecording() {

    try {

        if (
            !audioChunks.length
        ) {

            /*
             * If MediaRecorder failed but we have
             * browser live transcription, still
             * display it.
             */

            if (
                liveFinalText.trim()
            ) {

                finishWithTranscript(
                    liveFinalText.trim()
                );

                return;

            }


            throw new Error(
                "No audio was recorded."
            );

        }


        const audioBlob =
            new Blob(
                audioChunks,
                {
                    type:
                        mediaRecorder?.mimeType ||
                        "audio/webm"
                }
            );


        console.log(
            "Audio size:",
            audioBlob.size
        );


        const arrayBuffer =
            await audioBlob.arrayBuffer();


        const bytes =
            new Uint8Array(
                arrayBuffer
            );


        let binary =
            "";


        const chunkSize =
            8192;


        for (
            let i = 0;
            i < bytes.length;
            i += chunkSize
        ) {

            const chunk =
                bytes.subarray(
                    i,
                    Math.min(
                        i + chunkSize,
                        bytes.length
                    )
                );


            binary +=
                String.fromCharCode(
                    ...chunk
                );

        }


        const base64Audio =
            btoa(binary);


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
                                base64Audio
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Transcription failed."
            );

        }


        const transcript =
            data.transcript?.trim();


        if (!transcript) {

            throw new Error(
                "OpenAI returned an empty transcript."
            );

        }


        console.log(
            "Final transcript:",
            transcript
        );


        finishWithTranscript(
            transcript
        );


    } catch (error) {

        console.error(
            "TRANSCRIPTION ERROR:",
            error
        );


        /*
         * Fall back to browser transcript
         * if OpenAI fails.
         */

        if (
            liveFinalText.trim()
        ) {

            finishWithTranscript(
                liveFinalText.trim()
            );


            setStatus(
                "Using live transcript",
                "ready"
            );

        } else {

            setStatus(
                "Transcription error",
                "error"
            );


            showMessage(
                "Transcription failed: " +
                error.message
            );

        }

    }

}


// ============================================================
// FINAL TRANSCRIPT
// ============================================================

function finishWithTranscript(
    transcript
) {

    finalTranscript =
        transcript.trim();


    const fillerCount =
        countTrackedWords(
            finalTranscript
        );


    const totalWords =
        countTotalWords(
            finalTranscript
        );


    if (fillerCountElement) {

        fillerCountElement.textContent =
            fillerCount;

    }


    if (wordCountElement) {

        wordCountElement.textContent =
            totalWords;

    }


    // Display final transcript.

    if (finalTranscriptElement) {

        finalTranscriptElement.innerHTML =
            highlightTrackedWords(
                finalTranscript
            );

    }


    // Show transcript section.

    if (transcriptSection) {

        transcriptSection.classList.remove(
            "hidden"
        );

    }


    // Enable analysis.

    if (analyzeButton) {

        analyzeButton.disabled =
            false;

    }


    // Update status.

    setStatus(
        "Transcription complete",
        "ready"
    );


    // Update live area.

    if (heardText) {

        heardText.innerHTML =
            highlightTrackedWords(
                finalTranscript
            );

    }


    /*
     * Tell user to scroll down.
     */

    if (scrollPrompt) {

        scrollPrompt.textContent =
            "↓ Scroll down for your AI analysis";

    }


    /*
     * Don't automatically scroll the page.
     * The user remains where they stopped speaking.
     */


    console.log(
        "Final transcript displayed."
    );

}


// ============================================================
// AI ANALYSIS
// ============================================================

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

        analyzeButton.textContent =
            "Analyzing...";

    }


    if (analysisLoading) {

        analysisLoading.classList.remove(
            "hidden"
        );

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
                                finalTranscript
                        })
                }
            );


        const data =
            await response.json();


        console.log(
            "Analysis response:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.error ||
                "AI analysis failed."
            );

        }


        if (
            !data.analysis
        ) {

            throw new Error(
                "OpenAI returned an empty analysis."
            );

        }


        displayAnalysis(
            data.analysis
        );


    } catch (error) {

        console.error(
            "ANALYSIS ERROR:",
            error
        );


        if (analysisElement) {

            analysisElement.innerHTML = `

                <div class="analysis-block">

                    <h3>
                        ⚠️ Analysis failed
                    </h3>

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

            analysisLoading.classList.add(
                "hidden"
            );

        }


        if (analyzeButton) {

            analyzeButton.disabled =
                false;

            analyzeButton.textContent =
                "✨ Analyze My Speech";

        }

    }

}


// ============================================================
// DISPLAY AI ANALYSIS
// ============================================================

function displayAnalysis(
    analysis
) {

    if (!analysisElement) {
        return;
    }


    const overall =
        analysis.overall ||
        "No overall feedback was provided.";


    const fillerWords =
        analysis.fillerWords ||
        "No filler-word feedback was provided.";


    const clarity =
        analysis.clarity ||
        "No clarity feedback was provided.";


    const strength =
        analysis.strength ||
        "No strength was provided.";


    const improvement =
        analysis.improvement ||
        "No improvement suggestion was provided.";


    const tip =
        analysis.tip ||
        "Keep practicing!";


    analysisElement.innerHTML = `

        <div class="analysis-block">

            <h3>
                🎯 Overall
            </h3>

            <p>
                ${escapeHTML(overall)}
            </p>

        </div>


        <div class="analysis-block">

            <h3>
                🗣️ Filler Words
            </h3>

            <p>
                ${escapeHTML(fillerWords)}
            </p>

        </div>


        <div class="analysis-block">

            <h3>
                💬 Clarity
            </h3>

            <p>
                ${escapeHTML(clarity)}
            </p>

        </div>


        <div class="analysis-block">

            <h3>
                ⭐ What You Did Well
            </h3>

            <p>
                ${escapeHTML(strength)}
            </p>

        </div>


        <div class="analysis-block">

            <h3>
                🚀 What To Improve
            </h3>

            <p>
                ${escapeHTML(improvement)}
            </p>

        </div>


        <div class="analysis-block">

            <h3>
                💡 Coach's Tip
            </h3>

            <p>
                ${escapeHTML(tip)}
            </p>

        </div>

    `;

}


// ============================================================
// ANALYZE BUTTON
// ============================================================

if (analyzeButton) {

    analyzeButton.addEventListener(
        "click",
        analyzeSpeech
    );

}


// ============================================================
// NOTIFICATION BUTTON
// ============================================================

if (
    enableNotificationsButton
) {

    enableNotificationsButton.addEventListener(
        "click",
        requestNotificationPermission
    );

}


// ============================================================
// INITIALIZE
// ============================================================

renderWords();

updateNotificationStatus();

setStatus(
    "Ready",
    "ready"
);

showMessage(
    "Tap Start Speaking and begin talking."
);


// ============================================================
// DEBUG
// ============================================================

console.log(
    "Speech Tracker loaded."
);

console.log(
    "HTTPS:",
    location.protocol
);

console.log(
    "Speech Recognition:",
    speechRecognitionSupported
);

console.log(
    "Microphone API:",
    !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
    )
);

console.log(
    "Vibration:",
    typeof navigator.vibrate ===
    "function"
);

console.log(
    "Notifications:",
    "Notification" in window
);