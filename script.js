// ==========================================
// SPEECH TRACKER
// ==========================================


// ==========================================
// GET HTML ELEMENTS
// ==========================================

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

const customWordInput =
  document.getElementById("customWordInput");

const addWordButton =
  document.getElementById("addWordButton");

const wordList =
  document.getElementById("wordList");

const resetWordsButton =
  document.getElementById("resetWordsButton");

const fillerCountElement =
  document.getElementById("fillerCount");

const wordCountElement =
  document.getElementById("wordCount");


// ==========================================
// DEFAULT WORDS
// ==========================================

const DEFAULT_WORDS = [

  "um",
  "uh",
  "umm",
  "uhh",
  "like",
  "you know",
  "basically",
  "literally",
  "actually",
  "so"

];


// ==========================================
// LOAD CUSTOM WORDS
// ==========================================

let trackedWords =
  JSON.parse(
    localStorage.getItem(
      "speechTrackerWords"
    )
  );


if (
  !Array.isArray(trackedWords)
) {

  trackedWords =
    [...DEFAULT_WORDS];

}


// ==========================================
// TRACKING VARIABLES
// ==========================================

let recognition = null;

let isListening = false;

let finalTranscript = "";

let fillerCount = 0;

let totalWords = 0;


// ==========================================
// STATUS
// ==========================================

function setStatus(
  message,
  state = "ready"
) {

  statusText.textContent =
    message;

  statusDot.className =
    "dot " + state;

}


// ==========================================
// SAVE CUSTOM WORDS
// ==========================================

function saveWords() {

  localStorage.setItem(
    "speechTrackerWords",
    JSON.stringify(
      trackedWords
    )
  );

}


// ==========================================
// DISPLAY CUSTOM WORDS
// ==========================================

function renderWords() {

  wordList.innerHTML = "";


  trackedWords.forEach(
    function(word, index) {

      const tag =
        document.createElement(
          "div"
        );

      tag.className =
        "word-tag";


      const wordText =
        document.createElement(
          "span"
        );

      wordText.textContent =
        word;


      const removeButton =
        document.createElement(
          "button"
        );

      removeButton.textContent =
        "×";

      removeButton.setAttribute(
        "aria-label",
        "Remove " + word
      );


      removeButton.addEventListener(
        "click",
        function() {

          trackedWords.splice(
            index,
            1
          );

          saveWords();

          renderWords();

        }
      );


      tag.appendChild(
        wordText
      );

      tag.appendChild(
        removeButton
      );


      wordList.appendChild(
        tag
      );

    }
  );

}


// ==========================================
// ADD CUSTOM WORD
// ==========================================

function addCustomWord() {

  const word =
    customWordInput.value
      .trim()
      .toLowerCase();


  if (
    word === ""
  ) {

    return;

  }


  if (
    !trackedWords.includes(
      word
    )
  ) {

    trackedWords.push(
      word
    );

    saveWords();

    renderWords();

  }


  customWordInput.value =
    "";

  customWordInput.focus();

}


// ==========================================
// ADD WORD BUTTON
// ==========================================

addWordButton.addEventListener(
  "click",
  addCustomWord
);


// ==========================================
// ENTER TO ADD WORD
// ==========================================

customWordInput.addEventListener(
  "keydown",
  function(event) {

    if (
      event.key === "Enter"
    ) {

      addCustomWord();

    }

  }
);


// ==========================================
// RESET WORDS
// ==========================================

resetWordsButton.addEventListener(
  "click",
  function() {

    trackedWords =
      [...DEFAULT_WORDS];

    saveWords();

    renderWords();

  }
);


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(
  text
) {

  const div =
    document.createElement(
      "div"
    );

  div.textContent =
    text;

  return div.innerHTML;

}


// ==========================================
// ESCAPE REGEX
// ==========================================

function escapeRegex(
  text
) {

  return text.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

}


// ==========================================
// HIGHLIGHT TRACKED WORDS
// ==========================================

function highlightTrackedWords(
  text
) {

  let html =
    escapeHTML(text);


  // Longer phrases first.
  const words =
    [...trackedWords].sort(
      function(a, b) {

        return (
          b.length -
          a.length
        );

      }
    );


  words.forEach(
    function(word) {

      const escaped =
        escapeRegex(
          escapeHTML(word)
        );


      const regex =
        new RegExp(
          "(^|\\s)(" +
          escaped +
          ")(?=\\s|[.,!?;:]|$)",
          "gi"
        );


      html =
        html.replace(
          regex,
          '$1<span class="highlight">$2</span>'
        );

    }
  );


  return html;

}


// ==========================================
// COUNT TRACKED WORDS
// ==========================================

function countTrackedWords(
  text
) {

  let count = 0;


  trackedWords.forEach(
    function(word) {

      const regex =
        new RegExp(
          "\\b" +
          escapeRegex(word) +
          "\\b",
          "gi"
        );


      const matches =
        text.match(
          regex
        );


      if (matches) {

        count +=
          matches.length;

      }

    }
  );


  return count;

}


// ==========================================
// UPDATE TRANSCRIPT
// ==========================================

function updateTranscript(
  interimText = ""
) {

  const combined =
    (
      finalTranscript +
      " " +
      interimText
    ).trim();


  if (
    combined === ""
  ) {

    heardText.textContent =
      "Listening...";

  }

  else {

    heardText.innerHTML =
      highlightTrackedWords(
        combined
      );

  }


  totalWords =
    combined === ""
      ? 0
      : combined
          .split(/\s+/)
          .filter(Boolean)
          .length;


  wordCountElement.textContent =
    totalWords;


  fillerCountElement.textContent =
    fillerCount;

}


// ==========================================
// SPEECH RECOGNITION
// ==========================================

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;


// ==========================================
// CHECK SUPPORT
// ==========================================

if (
  SpeechRecognition
) {

  recognition =
    new SpeechRecognition();


  // Language
  recognition.lang =
    "en-US";


  // Keep listening
  recognition.continuous =
    true;


  // IMPORTANT:
  // Show words while they are being spoken.
  recognition.interimResults =
    true;


  recognition.maxAlternatives =
    1;


  // ========================================
  // RECOGNITION START
  // ========================================

  recognition.addEventListener(
    "start",
    function() {

      isListening =
        true;


      setStatus(
        "Listening...",
        "listening"
      );


      listenButton.disabled =
        true;


      stopButton.disabled =
        false;

    }
  );


  // ========================================
  // SPEECH RESULTS
  // ========================================

  recognition.addEventListener(
    "result",
    function(event) {

      let interimText =
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


        const transcript =
          result[0]
            .transcript;


        // FINAL RESULT
        if (
          result.isFinal
        ) {

          finalTranscript +=
            transcript + " ";


          // Count only finalized text.
          fillerCount +=
            countTrackedWords(
              transcript
            );

        }


        // LIVE / INTERIM RESULT
        else {

          interimText +=
            transcript;

        }

      }


      updateTranscript(
        interimText
      );

    }
  );


  // ========================================
  // SPEECH ERROR
  // ========================================

  recognition.addEventListener(
    "error",
    function(event) {

      console.error(
        "Speech recognition error:",
        event.error
      );


      if (
        event.error ===
        "not-allowed"
      ) {

        setStatus(
          "Microphone permission denied",
          "error"
        );


        heardText.textContent =
          "Allow microphone access in your browser and try again.";

      }


      else if (
        event.error ===
        "no-speech"
      ) {

        setStatus(
          "No speech detected",
          "error"
        );


        heardText.textContent =
          "I didn't hear anything. Try speaking again.";

      }


      else if (
        event.error ===
        "audio-capture"
      ) {

        setStatus(
          "Microphone unavailable",
          "error"
        );


        heardText.textContent =
          "Your microphone could not be accessed.";

      }


      else {

        setStatus(
          "Speech error",
          "error"
        );


        heardText.textContent =
          "Speech recognition error: " +
          event.error;

      }

    }
  );


  // ========================================
  // RECOGNITION ENDED
  // ========================================

  recognition.addEventListener(
    "end",
    function() {

      if (
        !isListening
      ) {

        return;

      }


      // Chrome sometimes stops continuous
      // recognition by itself.
      try {

        recognition.start();

      }

      catch(error) {

        console.log(
          "Recognition restart skipped."
        );

      }

    }
  );

}


// ==========================================
// START LISTENING
// ==========================================

listenButton.addEventListener(
  "click",
  function() {

    if (
      !recognition
    ) {

      setStatus(
        "Speech unavailable",
        "error"
      );


      heardText.textContent =
        "Speech recognition is not supported in this browser. Try Chrome or Edge.";

      return;

    }


    finalTranscript =
      "";

    fillerCount =
      0;

    totalWords =
      0;


    updateTranscript();


    isListening =
      true;


    try {

      recognition.start();

    }

    catch(error) {

      console.log(
        "Recognition is already running."
      );

    }

  }
);


// ==========================================
// STOP LISTENING
// ==========================================

stopButton.addEventListener(
  "click",
  function() {

    isListening =
      false;


    if (
      recognition
    ) {

      recognition.stop();

    }


    setStatus(
      "Ready",
      "ready"
    );


    listenButton.disabled =
      false;


    stopButton.disabled =
      true;


    updateTranscript();

  }
);


// ==========================================
// STARTUP
// ==========================================

renderWords();

setStatus(
  "Ready",
  "ready"
);

updateTranscript();