export default async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });
    }


    try {

        const apiKey =
            process.env.OPENAI_API_KEY;


        if (!apiKey) {

            return res.status(500).json({

                error:
                    "OPENAI_API_KEY is missing from Vercel."
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
You are an expert public speaking coach.

Analyze the following speech transcript.

TRACKED WORDS:
${words}

TRANSCRIPT:
${transcript}

Give concise but useful feedback.

Use exactly these sections:

1. Filler Word Usage
Explain how the tracked words were used.

2. Clarity
Evaluate how clear the speech was.

3. Repetition
Point out unnecessary repetition.

4. What You Did Well
Give 2 specific positive observations.

5. How To Improve
Give exactly 3 practical suggestions.

Keep the feedback appropriate for a student.

Do not rewrite the entire speech.

Focus on speaking performance.
`;


        const response =
            await fetch(
                "https://api.openai.com/v1/responses",
                {

                    method: "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${apiKey}`,

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            model:
                                "gpt-5.6-luna",

                            input:
                                prompt
                        })
                }
            );


        const responseText =
            await response.text();


        console.log(
            "Analysis status:",
            response.status
        );


        console.log(
            "Analysis raw response:",
            responseText
        );


        if (!response.ok) {

            return res.status(
                response.status
            ).json({

                error:
                    "OpenAI analysis request failed.",

                details:
                    responseText
            });
        }


        const result =
            JSON.parse(
                responseText
            );


        // OpenAI's Responses API normally
        // provides output_text.

        let analysis =
            result.output_text || "";


        // Extra fallback in case the response
        // contains output blocks but output_text
        // isn't populated.

        if (
            !analysis.trim() &&
            Array.isArray(result.output)
        ) {

            const pieces = [];


            for (
                const item of result.output
            ) {

                if (
                    item.type !==
                    "message"
                ) {
                    continue;
                }


                if (
                    !Array.isArray(
                        item.content
                    )
                ) {
                    continue;
                }


                for (
                    const content
                    of item.content
                ) {

                    if (
                        content.type ===
                        "output_text" &&
                        content.text
                    ) {

                        pieces.push(
                            content.text
                        );
                    }
                }
            }


            analysis =
                pieces.join("\n");
        }


        if (
            !analysis.trim()
        ) {

            console.error(
                "EMPTY OPENAI ANALYSIS:",
                JSON.stringify(
                    result,
                    null,
                    2
                )
            );


            return res.status(502).json({

                error:
                    "OpenAI returned an empty analysis.",

                details:
                    "The request succeeded, but no text was returned."
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