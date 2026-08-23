/* ============================================================
   SPEECH TRACKER
   COMPLETE REPLACEMENT SCRIPT
   ============================================================ */

"use strict";


/* ============================================================
   DEFAULT WORDS
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


let trackedWords = [];


/* ============================================================
   STATE
   ============================================================ */

let recognition = null;

let isListening = false;

let finalTranscript = "";

let interimTranscript = "";

let speechStarted = false;

let currentSpeechStartTime = null;

let lastFinalText = "";

let notificationEnabled = false;

let lastDetectedFiller = "";

let lastDetectedTime = 0;

let savedSpeeches = [];

let pendingSpeechToSave = null;


/* ============================================================
   ELEMENTS
   ============================================================ */

const listenButton =
    document.getElementById("listenButton");

const stopButton =
    document.getElementById("stopButton");

const heardElement =
    document.getElementById("heard");

const finalTranscriptElement =
    document.getElementById("finalTranscript");

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

const analysisElement =
    document.getElementById("analysis");

const analysisLoading =
    document.getElementById("analysisLoading");

const savedSpeechesElement =
    document.getElementById("savedSpeeches");

const noSavedSpeechesElement =
    document.getElementById("noSavedSpeeches");

const themeToggle =
    document.getElementById("themeToggle");

const saveSpeechModal =
    document.getElementById("saveSpeechModal");

const speechNameInput =
    document.getElementById("speechNameInput");

const confirmSaveButton =
    document.getElementById("confirmSaveButton");

const cancelSaveButton =
    document.getElementById("cancelSaveButton");

const speechViewer =
    document.getElementById("speechViewer");

const viewerTitle =
    document.getElementById("viewerTitle");

const viewerDate =
    document.getElementById("viewerDate");

const viewerTranscript =
    document.getElementById("viewerTranscript");

const closeViewerButton =
    document.getElementById("closeViewerButton");


/* ============================================================
   LOCAL STORAGE
   ============================================================ */

function loadData() {

    try {

        const storedWords =
            localStorage.getItem(
                "speechTrackerWords"
            );

        if (storedWords) {

            const parsed =
                JSON.parse(storedWords);

            if (Array.isArray(parsed)) {
                trackedWords = parsed;
            }

        }

    } catch (error) {

        console.error(
            "Could not load tracked words:",
            error
        );

    }


    if (!trackedWords.length) {
        trackedWords = [...DEFAULT_WORDS];
    }


    try {

        const storedSpeeches =
            localStorage.getItem(
                "speechTrackerSavedSpeeches"
            );

        if (storedSpeeches) {

            const parsed =
                JSON.parse(storedSpeeches);

            if (Array.isArray(parsed)) {
                savedSpeeches = parsed;
            }

        }

    } catch (error) {

        console.error(
            "Could not load saved speeches:",
            error
        );

    }
}


function saveWords() {

    localStorage.setItem(
        "speechTrackerWords",
        JSON.stringify(trackedWords)
    );
}


function saveSpeeches() {

    localStorage.setItem(
        "speechTrackerSavedSpeeches",
        JSON.stringify(savedSpeeches)
    );
}


/* ============================================================
   THEME
   ============================================================ */

function loadTheme() {

    const savedTheme =
        localStorage.getItem(
            "speechTrackerTheme"
        );

    if (savedTheme === "dark") {

        document.documentElement
            .setAttribute(
                "data-theme",
                "dark"
            );

        themeToggle.textContent = "Light";

    } else {

        document.documentElement
            .removeAttribute("data-theme");

        themeToggle.textContent = "Dark";
    }
}


function toggleTheme() {

    const isDark =
        document.documentElement
            .getAttribute("data-theme") === "dark";

    if (isDark) {

        document.documentElement
            .removeAttribute("data-theme");

        localStorage.setItem(
            "speechTrackerTheme",
            "light"
        );

        themeToggle.textContent = "Dark";

    } else {

        document.documentElement
            .setAttribute(
                "data-theme",
                "dark"
            );

        localStorage.setItem(
            "speechTrackerTheme",
            "dark"
        );

        themeToggle.textContent = "Light";
    }
}


themeToggle.addEventListener(
    "click",
    toggleTheme
);


/* ============================================================
   WORD LIST
   ============================================================ */

function renderWordList() {

    wordList.innerHTML = "";

    trackedWords.forEach(
        (word, index) => {

            const tag =
                document.createElement("div");

            tag.className = "word-tag";

            tag.innerHTML = `
                <span>${escapeHTML(word)}</span>
                <button
                    type="button"
                    aria-label="Remove ${escapeHTML(word)}"
                >
                    ×
                </button>
            `;

            const removeButton =
                tag.querySelector("button");

            removeButton.addEventListener(
                "click",
                () => {

                    trackedWords.splice(
                        index,
                        1
                    );

                    saveWords();
                    renderWordList();

                }
            );

            wordList.appendChild(tag);
        }
    );
}


function addTrackedWord() {

    const value =
        customWordInput.value
            .trim()
            .toLowerCase();

    if (!value) return;


    if (
        trackedWords.some(
            word =>
                word.toLowerCase() === value
        )
    ) {

        customWordInput.value = "";

        return;
    }


    trackedWords.push(value);

    saveWords();

    renderWordList();

    customWordInput.value = "";

    customWordInput.focus();
}


addWordButton.addEventListener(
    "click",
    addTrackedWord
);


customWordInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            addTrackedWord();
        }

    }
);


resetWordsButton.addEventListener(
    "click",
    () => {

        trackedWords =
            [...DEFAULT_WORDS];

        saveWords();

        renderWordList();

    }
);


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ============================================================
   FILLER REGEX
   ============================================================ */

function buildFillerRegex() {

    if (!trackedWords.length) {
        return null;
    }


    const sorted =
        [...trackedWords]
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    const escaped =
        sorted.map(
            word =>
                word
                    .replace(
                        /[.*+?^${}()|[\]\\]/g,
                        "\\$&"
                    )
        );


    return new RegExp(
        `\\b(${escaped.join("|")})\\b`,
        "gi"
    );
}


/* ============================================================
   HIGHLIGHT
   ============================================================ */

function highlightFillers(text) {

    if (!text) return "";

    const regex =
        buildFillerRegex();

    if (!regex) {
        return escapeHTML(text);
    }


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


        result += `
            <span class="highlight">
                ${escapeHTML(match[0])}
            </span>
        `;


        lastIndex =
            match.index +
            match[0].length;
    }


    result +=
        escapeHTML(
            text.slice(lastIndex)
        );


    return result;
}


/* ============================================================
   FILLER COUNT
   ============================================================ */

function countFillers(text) {

    if (!text) return 0;


    const regex =
        buildFillerRegex();

    if (!regex) return 0;


    const matches =
        text.match(regex);


    return matches
        ? matches.length
        : 0;
}


/* ============================================================
   WORD COUNT
   ============================================================ */

function countWords(text) {

    if (!text.trim()) {
        return 0;
    }


    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}


/* ============================================================
   UPDATE STATS
   ============================================================ */

function updateStats(text) {

    fillerCountElement.textContent =
        countFillers(text);

    wordCountElement.textContent =
        countWords(text);
}


/* ============================================================
   DISPLAY TRANSCRIPT
   ============================================================ */

function updateLiveTranscript() {

    const combined =
        `${finalTranscript} ${interimTranscript}`
            .trim();


    if (!combined) {

        heardElement.innerHTML =
            "Listening...";

        updateStats("");

        return;
    }


    heardElement.innerHTML =
        highlightFillers(combined);


    updateStats(combined);
}


/* ============================================================
   FAST LIVE FILLER DETECTION
   ============================================================ */

function detectLiveFillers(text) {

    if (!text || !isListening) {
        return;
    }


    const lower =
        text.toLowerCase();


    /*
       Sort longest first.

       This prevents "um" from being
       detected before "umm".
    */

    const sorted =
        [...trackedWords]
            .sort(
                (a, b) =>
                    b.length - a.length
            );


    for (const word of sorted) {

        const escaped =
            word.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );


        const regex =
            new RegExp(
                `(^|\\s)${escaped}(?=\\s|$|[.,!?])`,
                "i"
            );


        if (!regex.test(lower)) {
            continue;
        }


        const now =
            Date.now();


        /*
           Prevent duplicate alerts caused by
           SpeechRecognition repeating the same
           interim transcript.
        */

        const isSameRecentWord =
            lastDetectedFiller === word &&
            now - lastDetectedTime < 900;


        if (isSameRecentWord) {
            return;
        }


        lastDetectedFiller = word;

        lastDetectedTime = now;


        triggerFillerAlert(word);


        return;
    }
}


/* ============================================================
   FILLER ALERT
   ============================================================ */

function triggerFillerAlert(word) {

    /*
       Vibrate immediately when supported.
    */

    if (
        navigator.vibrate &&
        typeof navigator.vibrate === "function"
    ) {

        try {
            navigator.vibrate(
                [60, 35, 60]
            );
        } catch (error) {
            console.warn(
                "Vibration failed:",
                error
            );
        }
    }


    /*
       Browser notification.
    */

    if (
        notificationEnabled &&
        "Notification" in window &&
        Notification.permission === "granted"
    ) {

        try {

            new Notification(
                "Filler word detected",
                {
                    body:
                        `You said "${word}"`,
                    tag:
                        `speech-filler-${Date.now()}`
                }
            );

        } catch (error) {

            console.warn(
                "Notification failed:",
                error
            );

        }
    }
}


/* ============================================================
   SPEECH RECOGNITION
   ============================================================ */

function setupRecognition() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        heardElement.innerHTML =
            `
            Live transcription is not supported
            by this browser.
            `;

        return;
    }


    recognition =
        new SpeechRecognition();


    recognition.continuous = true;

    recognition.interimResults = true;

    recognition.lang = "en-US";


    /*
       Some browsers restart recognition
       automatically after a short pause.
    */

    recognition.onstart = () => {

        isListening = true;

        setStatus(
            "Listening",
            "listening"
        );
    };


    recognition.onresult =
        event => {

            let newFinal = "";

            let newInterim = "";


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

                    newFinal +=
                        text + " ";

                } else {

                    newInterim +=
                        text + " ";
                }
            }


            /*
               Only append newly finalized text.
            */

            if (newFinal.trim()) {

                const cleaned =
                    newFinal.trim();


                if (
                    !finalTranscript
                        .toLowerCase()
                        .endsWith(
                            cleaned.toLowerCase()
                        )
                ) {

                    finalTranscript +=
                        (
                            finalTranscript
                                ? " "
                                : ""
                        ) +
                        cleaned;
                }
            }


            interimTranscript =
                newInterim.trim();


            const liveText =
                `${finalTranscript} ${interimTranscript}`
                    .trim();


            /*
               Detect fillers immediately from
               the live/interim transcript.
            */

            detectLiveFillers(
                interimTranscript
            );


            detectLiveFillers(
                finalTranscript
            );


            updateLiveTranscript();
        };


    recognition.onerror =
        event => {

            console.error(
                "Speech recognition error:",
                event.error
            );


            if (
                event.error ===
                "not-allowed"
            ) {

                setStatus(
                    "Microphone blocked",
                    "error"
                );

                isListening = false;

                return;
            }


            if (
                event.error ===
                "no-speech"
            ) {
                return;
            }
        };


    recognition.onend = () => {

        /*
           Chrome sometimes ends recognition
           even though continuous=true.

           Restart while the user is still
           actively recording.
        */

        if (isListening) {

            try {
                recognition.start();
            } catch (error) {
                console.warn(
                    "Recognition restart:",
                    error
                );
            }

        } else {

            setStatus(
                "Ready",
                "ready"
            );
        }
    };
}


/* ============================================================
   STATUS
   ============================================================ */

function setStatus(
    text,
    type
) {

    statusElement.textContent =
        text;


    statusDot.className =
        `dot ${type}`;
}


/* ============================================================
   START LISTENING
   ============================================================ */

function startListening() {

    if (!recognition) {
        setupRecognition();
    }


    if (!recognition) {
        return;
    }


    finalTranscript = "";

    interimTranscript = "";

    lastFinalText = "";

    lastDetectedFiller = "";

    lastDetectedTime = 0;

    speechStarted = true;

    currentSpeechStartTime =
        Date.now();


    heardElement.innerHTML =
        "Listening...";


    finalTranscriptElement.innerHTML =
        "Your final transcription will appear here after you stop speaking.";


    analysisElement.innerHTML =
        "";


    analyzeButton.disabled =
        true;


    try {

        recognition.start();

        isListening = true;

        listenButton.disabled =
            true;

        stopButton.disabled =
            false;

        setStatus(
            "Listening",
            "listening"
        );

    } catch (error) {

        console.warn(
            "Recognition start:",
            error
        );
    }
}


/* ============================================================
   STOP LISTENING
   ============================================================ */

function stopListening() {

    if (!isListening) {
        return;
    }


    isListening = false;


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


    /*
       Give the browser a moment to commit
       the final recognition result.
    */

    setTimeout(
        finishSpeech,
        350
    );
}


/* ============================================================
   FINISH SPEECH
   ============================================================ */

function finishSpeech() {

    interimTranscript = "";


    const transcript =
        finalTranscript.trim();


    listenButton.disabled =
        false;

    stopButton.disabled =
        true;


    setStatus(
        "Finished",
        "ready"
    );


    if (!transcript) {

        heardElement.innerHTML =
            "No speech was detected.";

        finalTranscriptElement.innerHTML =
            "No transcript was created.";

        analyzeButton.disabled =
            true;

        return;
    }


    finalTranscriptElement.innerHTML =
        highlightFillers(transcript);


    heardElement.innerHTML =
        highlightFillers(transcript);


    updateStats(transcript);


    analyzeButton.disabled =
        false;


    /*
       Prompt for save only AFTER
       a real speech has finished.
    */

    pendingSpeechToSave = {
        transcript: transcript,
        date: new Date().toISOString(),
        fillerCount:
            countFillers(transcript),
        wordCount:
            countWords(transcript)
    };


    openSaveModal();
}


/* ============================================================
   BUTTON EVENTS
   ============================================================ */

listenButton.addEventListener(
    "click",
    startListening
);


stopButton.addEventListener(
    "click",
    stopListening
);


/* ============================================================
   NOTIFICATIONS
   ============================================================ */

enableNotificationsButton.addEventListener(
    "click",
    async () => {

        if (!("Notification" in window)) {

            notificationStatus.textContent =
                "This browser does not support notifications.";

            return;
        }


        try {

            const permission =
                await Notification.requestPermission();


            if (
                permission === "granted"
            ) {

                notificationEnabled =
                    true;

                notificationStatus.textContent =
                    "Notifications are enabled.";

                enableNotificationsButton.textContent =
                    "Notifications Enabled";

                enableNotificationsButton.classList.add(
                    "enabled"
                );

            } else {

                notificationEnabled =
                    false;

                notificationStatus.textContent =
                    "Notifications were not enabled.";
            }

        } catch (error) {

            console.error(
                "Notification permission error:",
                error
            );

        }
    }
);


/* ============================================================
   SAVE MODAL
   ============================================================ */

function openSaveModal() {

    saveSpeechModal.hidden =
        false;


    speechNameInput.value =
        "";


    setTimeout(
        () => {
            speechNameInput.focus();
        },
        50
    );
}


function closeSaveModal() {

    saveSpeechModal.hidden =
        true;
}


cancelSaveButton.addEventListener(
    "click",
    () => {

        closeSaveModal();

        pendingSpeechToSave = null;

    }
);


confirmSaveButton.addEventListener(
    "click",
    savePendingSpeech
);


speechNameInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            savePendingSpeech();
        }


        if (event.key === "Escape") {
            closeSaveModal();
        }

    }
);


/* ============================================================
   SAVE SPEECH
   ============================================================ */

function savePendingSpeech() {

    if (!pendingSpeechToSave) {
        closeSaveModal();
        return;
    }


    let name =
        speechNameInput.value.trim();


    if (!name) {

        name =
            `Speech ${
                savedSpeeches.length + 1
            }`;
    }


    const speech = {

        id:
            `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`,

        name,

        transcript:
            pendingSpeechToSave.transcript,

        date:
            pendingSpeechToSave.date,

        fillerCount:
            pendingSpeechToSave.fillerCount,

        wordCount:
            pendingSpeechToSave.wordCount
    };


    savedSpeeches.unshift(
        speech
    );


    saveSpeeches();

    renderSavedSpeeches();

    closeSaveModal();

    pendingSpeechToSave = null;
}


/* ============================================================
   RENDER SAVED SPEECHES
   ============================================================ */

function renderSavedSpeeches() {

    savedSpeechesElement.innerHTML =
        "";


    if (!savedSpeeches.length) {

        noSavedSpeechesElement.hidden =
            false;

        return;
    }


    noSavedSpeechesElement.hidden =
        true;


    savedSpeeches.forEach(
        speech => {

            const item =
                document.createElement("div");

            item.className =
                "saved-speech";


            const main =
                document.createElement("div");

            main.className =
                "saved-speech-main";


            main.innerHTML = `
                <div class="saved-speech-title">
                    ${escapeHTML(speech.name)}
                </div>

                <div class="saved-speech-date">
                    ${formatDate(speech.date)}
                    •
                    ${speech.wordCount || 0} words
                    •
                    ${speech.fillerCount || 0} fillers
                </div>
            `;


            main.addEventListener(
                "click",
                () => {
                    openSavedSpeech(speech.id);
                }
            );


            const actions =
                document.createElement("div");

            actions.className =
                "saved-speech-actions";


            const openButton =
                document.createElement("button");

            openButton.className =
                "saved-speech-open";

            openButton.type =
                "button";

            openButton.textContent =
                "↗";

            openButton.title =
                "Open speech";


            openButton.addEventListener(
                "click",
                () => {
                    openSavedSpeech(speech.id);
                }
            );


            const deleteButton =
                document.createElement("button");

            deleteButton.className =
                "saved-speech-delete";

            deleteButton.type =
                "button";

            deleteButton.textContent =
                "×";

            deleteButton.title =
                "Delete speech";


            deleteButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    deleteSpeech(
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


            item.appendChild(main);

            item.appendChild(actions);


            savedSpeechesElement.appendChild(
                item
            );
        }
    );
}


/* ============================================================
   DATE
   ============================================================ */

function formatDate(dateString) {

    const date =
        new Date(dateString);


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
}


/* ============================================================
   OPEN SAVED SPEECH
   ============================================================ */

function openSavedSpeech(id) {

    const speech =
        savedSpeeches.find(
            item =>
                item.id === id
        );


    if (!speech) {
        return;
    }


    /*
       IMPORTANT:

       This uses the selected speech's own
       transcript instead of the current
       speech's transcript.
    */

    viewerTitle.textContent =
        speech.name;


    viewerDate.textContent =
        formatDate(speech.date);


    viewerTranscript.innerHTML =
        highlightFillers(
            speech.transcript
        );


    speechViewer.hidden =
        false;
}


closeViewerButton.addEventListener(
    "click",
    () => {
        speechViewer.hidden =
            true;
    }
);


speechViewer.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            speechViewer
        ) {

            speechViewer.hidden =
                true;
        }

    }
);


/* ============================================================
   DELETE SPEECH
   ============================================================ */

function deleteSpeech(id) {

    const speech =
        savedSpeeches.find(
            item =>
                item.id === id
        );


    if (!speech) {
        return;
    }


    const confirmed =
        window.confirm(
            `Delete "${speech.name}"?`
        );


    if (!confirmed) {
        return;
    }


    savedSpeeches =
        savedSpeeches.filter(
            item =>
                item.id !== id
        );


    saveSpeeches();

    renderSavedSpeeches();
}


/* ============================================================
   AI ANALYSIS
   ============================================================ */

analyzeButton.addEventListener(
    "click",
    analyzeSpeech
);


async function analyzeSpeech() {

    const transcript =
        finalTranscript.trim();


    /*
       Do NOT start analysis unless there
       is an actual completed speech.
    */

    if (!transcript) {

        analysisElement.innerHTML = `
            <div class="analysis-error">
                <strong>
                    No completed speech
                </strong>

                <p>
                    Finish a speech before analyzing it.
                </p>
            </div>
        `;

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
                        JSON.stringify({
                            transcript
                        })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data?.error ||
                "Analysis failed"
            );
        }


        renderAIAnalysis(data);


    } catch (error) {

        console.error(
            "AI analysis error:",
            error
        );


        analysisElement.innerHTML = `
            <div class="analysis-error">

                <strong>
                    Analysis failed
                </strong>

                <p>
                    ${escapeHTML(
                        error.message ||
                        "Something went wrong."
                    )}
                </p>

            </div>
        `;

    } finally {

        analysisLoading.hidden =
            true;

        analyzeButton.disabled =
            false;
    }
}


/* ============================================================
   AI ANALYSIS RENDERER
   ============================================================ */

function renderAIAnalysis(data) {

    const analysis =
        data?.analysisData ||
        data?.analysis ||
        data;


    if (
        !analysis ||
        typeof analysis !== "object"
    ) {

        analysisElement.innerHTML = `
            <div class="analysis-error">
                <strong>
                    Analysis unavailable
                </strong>

                <p>
                    The AI returned an unexpected response.
                </p>
            </div>
        `;

        return;
    }


    const sections = [

        {
            key: "overall",
            title: "Overall Summary",
            icon: "◎"
        },

        {
            key: "fillerWords",
            title: "Filler Words",
            icon: "⚠"
        },

        {
            key: "speechSections",
            title: "Speech Breakdown",
            icon: "▤"
        },

        {
            key: "clarity",
            title: "Clarity",
            icon: "◈"
        },

        {
            key: "strength",
            title: "What You Did Well",
            icon: "✓"
        },

        {
            key: "improvement",
            title: "What To Improve",
            icon: "↗"
        },

        {
            key: "tips",
            title: "AI Tips",
            icon: "✦"
        },

        {
            key: "tip",
            title: "Main Tip",
            icon: "→"
        }
    ];


    let html = "";


    sections.forEach(
        section => {

            const value =
                analysis[section.key];


            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                return;
            }


            html += `
                <div class="analysis-section">

                    <div class="analysis-section-header">

                        <span class="analysis-icon">
                            ${section.icon}
                        </span>

                        <h3>
                            ${escapeHTML(
                                section.title
                            )}
                        </h3>

                    </div>

                    <div class="analysis-section-content">
                        ${formatAIValue(value)}
                    </div>

                </div>
            `;
        }
    );


    /*
       Fallback for unexpected schema.
    */

    if (!html) {

        html =
            Object.entries(analysis)
                .map(
                    ([key, value]) => {

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


                        return `
                            <div class="analysis-section">

                                <div class="analysis-section-header">

                                    <span class="analysis-icon">
                                        •
                                    </span>

                                    <h3>
                                        ${escapeHTML(title)}
                                    </h3>

                                </div>

                                <div class="analysis-section-content">
                                    ${formatAIValue(value)}
                                </div>

                            </div>
                        `;
                    }
                )
                .join("");
    }


    analysisElement.innerHTML =
        html;
}


/* ============================================================
   FORMAT AI VALUES
   ============================================================ */

function formatAIValue(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    if (typeof value === "string") {

        return formatText(
            value
        );
    }


    if (
        typeof value === "number" ||
        typeof value === "boolean"
    ) {

        return escapeHTML(
            value
        );
    }


    if (Array.isArray(value)) {

        /*
           Array of strings
        */

        if (
            value.every(
                item =>
                    typeof item !== "object"
            )
        ) {

            return `
                <ul>
                    ${value
                        .map(
                            item =>
                                `
                                <li>
                                    ${escapeHTML(item)}
                                </li>
                                `
                        )
                        .join("")}
                </ul>
            `;
        }


        /*
           Array of objects
        */

        return value
            .map(
                item => {

                    if (
                        typeof item ===
                        "object"
                    ) {

                        return `
                            <div class="analysis-subsection">
                                ${formatObject(item)}
                            </div>
                        `;
                    }

                    return `
                        <p>
                            ${escapeHTML(item)}
                        </p>
                    `;
                }
            )
            .join("");
    }


    if (
        typeof value === "object"
    ) {

        return formatObject(
            value
        );
    }


    return escapeHTML(value);
}


/* ============================================================
   FORMAT OBJECT
   ============================================================ */

function formatObject(object) {

    return Object.entries(object)
        .map(
            ([key, value]) => {

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
                    Array.isArray(value)
                ) {

                    return `
                        <div class="analysis-subsection">

                            <h4>
                                ${escapeHTML(title)}
                            </h4>

                            ${formatAIValue(value)}

                        </div>
                    `;
                }


                if (
                    typeof value ===
                    "object" &&
                    value !== null
                ) {

                    return `
                        <div class="analysis-subsection">

                            <h4>
                                ${escapeHTML(title)}
                            </h4>

                            ${formatObject(value)}

                        </div>
                    `;
                }


                return `
                    <div class="analysis-detail">

                        <strong>
                            ${escapeHTML(title)}
                        </strong>

                        <p>
                            ${formatText(value)}
                        </p>

                    </div>
                `;
            }
        )
        .join("");
}


/* ============================================================
   FORMAT TEXT
   ============================================================ */

function formatText(value) {

    return escapeHTML(value)
        .replace(
            /\n\n+/g,
            "</p><p>"
        )
        .replace(
            /\n/g,
            "<br>"
        );
}


/* ============================================================
   INITIALIZE
   ============================================================ */

loadData();

loadTheme();

renderWordList();

renderSavedSpeeches();

setupRecognition();

updateStats("");

setStatus(
    "Ready",
    "ready"
);