export default async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });
    }


    try {

        if (!process.env.OPENAI_API_KEY) {

            return res.status(500).json({
                error:
                    "OPENAI_API_KEY is missing from Vercel"
            });
        }


        const {
            transcript,
            trackedWords
        } = req.body || {};


        if (
            !transcript ||
            !transcript.trim()
        ) {

            return res.status(400).json({
                error:
                    "No transcript was provided."
            });
        }


        const words =
            Array.isArray(trackedWords)
                ? trackedWords.join(", ")
                : "None";


        const prompt = `
You are an expert public-speaking coach.

Analyze this speech transcript.

Tracked words:
${words}

Transcript:
${transcript}

Give helpful, concise feedback.

Use these sections:

1. Filler Word Usage

Explain how many tracked filler words were used
and whether they affected the speech.

2. Clarity

Evaluate how clear the speech was.

3. Repetition

Identify unnecessary repeated words or ideas.

4. Conciseness

Explain whether any parts could be more direct.

5. What You Did Well

Give 1-3 specific positive observations.

6. How To Improve

Give exactly 3 practical suggestions.

Keep the feedback appropriate for a student.

Do not rewrite the entire speech.

Focus only on speaking performance.
`;


        const openAIResponse =
            await fetch(
                "https://api.openai.com/v1/responses",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${process.env.OPENAI_API_KEY}`
                    },

                    body: JSON.stringify({

                        model:
                            "gpt-5.6-luna",

                        input:
                            prompt
                    })
                }
            );


        const responseText =
            await openAIResponse.text();


        console.log(
            "OpenAI analysis status:",
            openAIResponse.status
        );


        console.log(
            "OpenAI analysis response:",
            responseText
        );


        if (
            !openAIResponse.ok
        ) {

            return res.status(
                openAIResponse.status
            ).json({

                error:
                    "OpenAI analysis failed",

                details:
                    responseText
            });
        }


        const result =
            JSON.parse(
                responseText
            );


        const analysis =
            result.output_text || "";


        if (
            !analysis.trim()
        ) {

            return res.status(500).json({

                error:
                    "OpenAI returned an empty analysis."
            });
        }


        return res.status(200).json({

            analysis:
                analysis
        });


    } catch (error) {

        console.error(
            "ANALYSIS SERVER ERROR:",
            error
        );


        return res.status(500).json({

            error:
                error.message ||
                "Unknown server error"
        });
    }
}