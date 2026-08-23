export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        /* =====================================================
           API KEY
           ===================================================== */

        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                error: "OPENAI_API_KEY is missing from Vercel."
            });
        }


        /* =====================================================
           TRANSCRIPT
           ===================================================== */

        const { transcript } = req.body || {};

        if (
            typeof transcript !== "string" ||
            !transcript.trim()
        ) {
            return res.status(400).json({
                error: "No transcript was provided."
            });
        }


        const cleanTranscript =
            transcript.trim().slice(0, 30000);


        /* =====================================================
           STRUCTURED OUTPUT SCHEMA
           ===================================================== */

        const schema = {
            type: "object",
            additionalProperties: false,

            properties: {

                overall: {
                    type: "string"
                },

                fillerWords: {
                    type: "object",
                    additionalProperties: false,

                    properties: {

                        summary: {
                            type: "string"
                        },

                        detected: {
                            type: "array",
                            items: {
                                type: "string"
                            }
                        },

                        count: {
                            type: "integer"
                        },

                        feedback: {
                            type: "string"
                        }

                    },

                    required: [
                        "summary",
                        "detected",
                        "count",
                        "feedback"
                    ]
                },


                speechSections: {
                    type: "array",

                    items: {
                        type: "object",
                        additionalProperties: false,

                        properties: {

                            section: {
                                type: "string"
                            },

                            summary: {
                                type: "string"
                            },

                            strengths: {
                                type: "string"
                            },

                            improvements: {
                                type: "string"
                            }

                        },

                        required: [
                            "section",
                            "summary",
                            "strengths",
                            "improvements"
                        ]
                    }
                },


                clarity: {
                    type: "string"
                },

                strength: {
                    type: "string"
                },

                improvement: {
                    type: "string"
                },

                tips: {
                    type: "array",
                    items: {
                        type: "string"
                    }
                },

                tip: {
                    type: "string"
                }

            },

            required: [
                "overall",
                "fillerWords",
                "speechSections",
                "clarity",
                "strength",
                "improvement",
                "tips",
                "tip"
            ]
        };


        /* =====================================================
           OPENAI REQUEST
           ===================================================== */

        const response = await fetch(
            "https://api.openai.com/v1/responses",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },

                body: JSON.stringify({

                    model: "gpt-5.6-luna",

                    input: [

                        {
                            role: "system",

                            content: [
                                {
                                    type: "input_text",

                                    text: `
You are Speech Tracker's expert public-speaking coach.

Analyze ONLY the speech transcript provided by the user.

Your feedback must be specific to what the speaker actually said.

Do NOT give generic public-speaking advice when the transcript
provides enough information to be specific.

Pay especially close attention to:

- um
- umm
- ummmm
- uh
- uhh
- uhhhh
- like
- you know
- basically
- literally
- actually
- repeated words
- repeated ideas
- unnecessary phrases
- rambling
- sentence structure
- unclear wording
- vague claims
- weak transitions
- organization
- conciseness
- strengths
- specific opportunities for improvement

IMPORTANT FILLER RULE:

Only report filler words that actually appear in the transcript.

Do not invent filler words.

If the transcript contains "umm", "ummm", "uhh", or similar
variants, explicitly mention those variants.

For example, if the speaker repeatedly says "umm" before
explaining points, explain that specifically.

Do not simply say:

"Reduce filler words."

Instead say something specific such as:

"You use 'umm' several times before introducing new ideas.
Try replacing those moments with a short silent pause."

Analyze the actual structure of the speech.

If the transcript has recognizable sections such as:

- introduction
- claim
- argument
- example
- explanation
- conclusion

analyze those sections individually.

Do NOT invent sections that are not reasonably present.

For each section explain:

1. What the speaker was trying to communicate.
2. What worked.
3. What could be clearer.
4. What could be improved.

The overall feedback should identify the most important thing
the speaker should work on.

The tips should be practical and specific to THIS speech.

Return ONLY the requested structured output.
`
                                }
                            ]
                        },

                        {
                            role: "user",

                            content: [
                                {
                                    type: "input_text",

                                    text:
                                        `Analyze this speech transcript:\n\n${cleanTranscript}`
                                }
                            ]
                        }

                    ],

                    text: {
                        format: {
                            type: "json_schema",

                            name: "speech_analysis",

                            strict: true,

                            schema
                        }
                    }
                })
            }
        );


        /* =====================================================
           READ OPENAI RESPONSE
           ===================================================== */

        const responseText =
            await response.text();

        console.log(
            "OpenAI analysis status:",
            response.status
        );

        console.log(
            "OpenAI raw response:",
            responseText
        );


        /* =====================================================
           OPENAI ERROR
           ===================================================== */

        if (!response.ok) {

            let errorDetails =
                responseText;

            try {

                const errorJSON =
                    JSON.parse(responseText);

                errorDetails =
                    errorJSON?.error?.message ||
                    errorJSON?.error ||
                    responseText;

            } catch (_) {
                // Keep original response text.
            }


            return res.status(
                response.status
            ).json({

                error:
                    "OpenAI analysis failed.",

                details:
                    String(errorDetails)

            });

        }


        /* =====================================================
           PARSE RESPONSE
           ===================================================== */

        let data;

        try {

            data =
                JSON.parse(responseText);

        } catch (error) {

            console.error(
                "Could not parse OpenAI response:",
                error
            );

            return res.status(500).json({

                error:
                    "OpenAI returned invalid JSON.",

                details:
                    responseText.slice(0, 3000)

            });

        }


        /* =====================================================
           GET OUTPUT TEXT
           ===================================================== */

        let content =
            data?.output_text;


        /*
            Some Responses API responses may not expose
            output_text in the exact form expected, so also
            search the output structure.
        */

        if (!content && Array.isArray(data?.output)) {

            for (
                const item of data.output
            ) {

                if (
                    item?.type === "message" &&
                    Array.isArray(item.content)
                ) {

                    for (
                        const part of item.content
                    ) {

                        if (
                            part?.type === "output_text" &&
                            typeof part.text === "string"
                        ) {

                            content =
                                part.text;

                            break;

                        }

                    }

                }

                if (content) {
                    break;
                }

            }

        }


        if (!content) {

            console.error(
                "OpenAI returned no output text:",
                JSON.stringify(data)
            );

            return res.status(500).json({

                error:
                    "OpenAI returned no analysis content.",

                details:
                    JSON.stringify(data).slice(0, 5000)

            });

        }


        /* =====================================================
           PARSE STRUCTURED JSON
           ===================================================== */

        let analysis;

        try {

            analysis =
                typeof content === "string"
                    ? JSON.parse(content)
                    : content;

        } catch (error) {

            console.error(
                "Could not parse AI analysis:",
                error
            );

            return res.status(500).json({

                error:
                    "The AI analysis JSON was invalid.",

                details:
                    String(content).slice(0, 5000)

            });

        }


        /* =====================================================
           VALIDATE
           ===================================================== */

        if (
            !analysis ||
            typeof analysis !== "object" ||
            Array.isArray(analysis)
        ) {

            return res.status(500).json({

                error:
                    "OpenAI returned an invalid analysis object."

            });

        }


        /* =====================================================
           NORMALIZE
           ===================================================== */

        const analysisData = {

            overall:
                typeof analysis.overall === "string"
                    ? analysis.overall
                    : "",


            fillerWords:
                analysis.fillerWords &&
                typeof analysis.fillerWords === "object"

                    ? {

                        summary:
                            typeof analysis.fillerWords.summary === "string"
                                ? analysis.fillerWords.summary
                                : "",

                        detected:
                            Array.isArray(
                                analysis.fillerWords.detected
                            )
                                ? analysis.fillerWords.detected
                                : [],

                        count:
                            Number.isInteger(
                                analysis.fillerWords.count
                            )
                                ? analysis.fillerWords.count
                                : 0,

                        feedback:
                            typeof analysis.fillerWords.feedback === "string"
                                ? analysis.fillerWords.feedback
                                : ""

                    }

                    : {

                        summary: "",
                        detected: [],
                        count: 0,
                        feedback: ""

                    },


            speechSections:
                Array.isArray(
                    analysis.speechSections
                )
                    ? analysis.speechSections
                    : [],


            clarity:
                typeof analysis.clarity === "string"
                    ? analysis.clarity
                    : "",


            strength:
                typeof analysis.strength === "string"
                    ? analysis.strength
                    : "",


            improvement:
                typeof analysis.improvement === "string"
                    ? analysis.improvement
                    : "",


            tips:
                Array.isArray(analysis.tips)
                    ? analysis.tips
                    : [],


            tip:
                typeof analysis.tip === "string"
                    ? analysis.tip
                    : ""

        };


        /* =====================================================
           RETURN
           ===================================================== */

        return res.status(200).json({
            analysisData
        });


    } catch (error) {

        console.error(
            "ANALYSIS SERVER ERROR:",
            error
        );

        return res.status(500).json({

            error:
                error?.message ||
                "Unknown analysis error."

        });

    }
}
