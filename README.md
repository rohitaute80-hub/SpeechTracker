This is Speech Tracker, an AI powered speech assistant developed to stop people from saying filler words, includes speech analytics like pacing, filler word rate, and grammar. 
It also includes an AI powered assistant which provides comprehensive tips and tricks regarding the issues the user faces.

How it works:

Speech Tracker uses the device microphone to capture the user's
speech. While the user is speaking, the app uses browser-based
speech recognition to create a live transcript.

The live transcript is continuously checked for tracked filler
words. The default tracked words include "um", "uh", "umm", "uhh",
"like", "you know", "basically", "literally", and "actually".

Speech Tracker also recognizes extended versions of filler sounds,
such as "ummm", "ummmm", "uhhh", and "uhhhh". These are grouped
into the same filler families so that a single occurrence does
not trigger multiple alerts as the speech-recognition transcript
changes.

When a tracked filler word is detected, Speech Tracker can
immediately vibrate the device and send a notification telling
the user which filler word was detected.

The application uses an occurrence-tracking system to prevent
duplicate notifications. Speech recognition frequently changes
its interim transcript while a person is speaking. Without
duplicate protection, the same "umm" could be detected several
times. Speech Tracker keeps track of previously detected
occurrences so that each actual filler is only alerted once.

After the recording is finished, the recorded audio is sent to
the Speech Tracker backend for a more accurate transcription.
The API communicates with OpenAI's transcription service and
returns the improved transcript to the application.

The application then highlights tracked filler words directly
inside the transcript. This allows the user to see exactly where
they used words they are trying to eliminate.

AI Analysis:

Speech Tracker also includes an AI-powered speech coach. When
the user selects "Analyze My Speech", the transcript is sent to
the backend, where it is analyzed by an OpenAI language model.

The AI is instructed to analyze the actual speech instead of
giving generic public-speaking advice.

The analysis can include:

- Overall speech quality
- Filler-word usage
- Filler-word rate
- Pacing
- Grammar
- Clarity
- Organization
- Repeated words
- Unnecessary phrases
- Rambling
- Sentence structure
- Transitions
- Strengths
- Areas for improvement
- Specific recommendations

The AI also breaks the speech into meaningful sections when
possible. For example, it may identify an introduction, argument,
example, explanation, or conclusion if those sections actually
exist in the speech.

For each section, the AI explains what the speaker was trying to
communicate, what worked well, what could be clearer, and what
could be improved.

The goal is to make the feedback specific to the user's actual
speech. For example, instead of simply saying "use fewer filler
words", the AI can identify where a filler was repeatedly used
and recommend replacing that pause with a moment of silence.

Filler Rate:

Filler rate measures how frequently the speaker uses tracked
filler words compared with the total number of words spoken.

It is calculated approximately as:

Filler Rate =
(number of filler words / total words) × 100

This gives the user a simple way to measure improvement between
different speeches.

Pacing:

Pacing measures how quickly the speaker is speaking, generally
represented in words per minute (WPM).

The goal is not necessarily to speak as quickly as possible.
Instead, Speech Tracker uses pacing as another measurement that
can help identify whether a speaker may be speaking too quickly,
too slowly, or at a generally comfortable rate.

Grammar:

The AI evaluates grammar based on the actual transcript. It can
identify issues such as incomplete sentences, awkward phrasing,
incorrect word usage, repeated words, and other grammatical
problems.

The grammar score is intended as a coaching metric rather than
a perfect measurement of language ability.

Saved Speeches:

Speech Tracker allows users to save completed speeches. Saved
speeches contain the transcript, statistics, date, and AI
analysis when available.

Users can return to previous speeches and compare their
performance over time.

The saved speeches are stored locally in the browser using
localStorage. This means the application can maintain speech
history without requiring a traditional database for the MVP.

Technology:

Speech Tracker is built as a web application using HTML, CSS,
and JavaScript.

The frontend handles:

- Recording
- Live transcription
- Filler detection
- Filler highlighting
- Notifications
- Vibration
- Statistics
- Saved speeches
- Theme switching
- AI analysis display

The backend uses serverless API routes to communicate with
OpenAI. API keys are stored as environment variables rather than
being placed in the frontend.

The application is designed to be deployed using Vercel.

Security:

The OpenAI API key must never be placed directly inside
script.js, index.html, CSS files, or other frontend code.

The API key is stored as an environment variable named:

OPENAI_API_KEY

The browser communicates with the application's backend API
routes, and the backend communicates with OpenAI.

This prevents the secret API key from being exposed to users or
committed to the public GitHub repository.

Project Goal:

The goal of Speech Tracker is to give people a practical way to
improve their speaking habits while they are actually speaking.

Instead of only reviewing a speech after it is finished,
Speech Tracker provides immediate feedback when a tracked filler
word is detected.

The longer-term goal is to combine real-time feedback with
detailed AI analysis so users can identify patterns in their
speech and gradually become clearer, more concise, and more
confident speakers.

Thanks,
Ayan M. and Rohit A.
