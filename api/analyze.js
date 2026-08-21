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

        const {
            transcript,
            trackedWords
        } = req.body || {};

        if (
            !transcript ||
            !transcript.trim()
        ) {

            return res.status(400).json({
                error: "No transcript was provided."
            });
        }

        const words =
            Array.isArray(trackedWords)
                ? trackedWords
                : [];

        const fillerList =
            words.join(", ");

        const prompt = `
You are an expert public speaking coach.

Analyze this person's speech transcript.

Tracked words:
${fillerList || "None"}

Transcript:
"""
${transcript}
"""

Give useful, encouraging feedback.

Include exactly these sections:

1. Overall Score
Give a score from 1-10.

2. What You Did Well
Mention 2-3 specific strengths.

3. Filler Words
Explain how often the tracked words appeared and which ones appeared most.

4. Clarity
Comment on how clear and easy to follow the speech was.

5. How to Improve
Give 3 specific things the speaker can practice.

6. Quick Challenge
Give one short exercise they can do next.

Do not invent facts that aren't supported by the transcript.
Keep the feedback concise and practical.
`;

        const response =
            await client.responses.create({
                model: "gpt-5.6",
                input: prompt
            });

        const analysis =
            response.output_text?.trim();

        console.log(
            "Analysis response:",
            analysis
        );

        if (!analysis) {

            return res.status(502).json({
                error:
                    "OpenAI returned an empty analysis."
            });
        }

        return res.status(200).json({
            analysis
        });

    } catch (error) {

        console.error(
            "ANALYSIS API ERROR:",
            error
        );

        return res.status(500).json({
            error:
                error.message ||
                "Speech analysis failed."
        });
    }
}