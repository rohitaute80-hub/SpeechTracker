import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: "OPENAI_API_KEY is missing"
            });
        }

        const body = req.body || {};

        const transcript =
            typeof body.transcript === "string"
                ? body.transcript.trim()
                : "";

        const trackedWords =
            Array.isArray(body.trackedWords)
                ? body.trackedWords
                : [];

        if (!transcript) {
            return res.status(400).json({
                error: "Transcript is empty"
            });
        }

        const fillerWords =
            trackedWords.join(", ");

        const prompt = `
You are a public speaking coach.

Analyze the following speech transcript.

Tracked words:
${fillerWords}

Speech transcript:
${transcript}

Give concise, useful feedback.

Use these sections:

OVERALL SCORE
Give a score from 1 to 10.

WHAT YOU DID WELL
Give 2 specific strengths.

FILLER WORDS
Identify the tracked filler words that appeared and comment on them.

CLARITY
Comment on how clear and easy to follow the speech was.

HOW TO IMPROVE
Give 3 practical suggestions.

NEXT CHALLENGE
Give one short speaking exercise.

Only use information supported by the transcript.
`;

        console.log("Sending analysis request...");

        const response = await client.responses.create({
            model: "gpt-5.6",
            input: prompt
        });

        console.log(
            "OpenAI response received."
        );

        const analysis =
            response.output_text
                ? response.output_text.trim()
                : "";

        console.log(
            "Analysis length:",
            analysis.length
        );

        if (!analysis) {
            return res.status(502).json({
                error:
                    "OpenAI returned an empty analysis."
            });
        }

        return res.status(200).json({
            analysis: analysis
        });

    } catch (error) {

        console.error(
            "ANALYSIS ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error?.message ||
                "Analysis request failed."
        });
    }
}