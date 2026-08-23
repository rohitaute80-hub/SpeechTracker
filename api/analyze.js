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

        if (!process.env.OPENAI_API_KEY) {

            return res.status(500).json({
                error:
                    "OPENAI_API_KEY is missing from Vercel"
            });
        }


        /* =====================================================
           TRANSCRIPT
           ===================================================== */

        const {
            transcript
        } = req.body || {};


        if (
            !transcript ||
            !transcript.trim()
        ) {

            return res.status(400).json({
                error:
                    "No transcript was provided"
            });
        }


        /* =====================================================
           OPENAI REQUEST
           ===================================================== */

        const response =
            await fetch(
                "https://api.openai.com/v1/chat/completions",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${process.env.OPENAI_API_KEY}`
                    },

                    body:
                        JSON.stringify({

                            model:
                                "gpt-4o-mini",

                            temperature:
                                0.5,

                            response_format: {
                                type:
                                    "json_schema",

                                json_schema: {

                                    name:
                                        "speech_analysis",

                                    strict:
                                        true,

                                    schema: {

                                        type:
                                            "object",

                                        additionalProperties:
                                            false,

                                        properties: {

                                            overall: {
                                                type:
                                                    "string"
                                            },

                                            fillerWords: {

                                                type:
                                                    "object",

                                                additionalProperties:
                                                    false,

                                                properties: {

                                                    summary: {
                                                        type:
                                                            "string"
                                                    },

                                                    detected: {

                                                        type:
                                                            "array",

                                                        items: {
                                                            type:
                                                                "string"
                                                        }
                                                    },

                                                    count: {
                                                        type:
                                                            "integer"
                                                    },

                                                    feedback: {
                                                        type:
                                                            "string"
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

                                                type:
                                                    "array",

                                                items: {

                                                    type:
                                                        "object",

                                                    additionalProperties:
                                                        false,

                                                    properties: {

                                                        section: {
                                                            type:
                                                                "string"
                                                        },

                                                        summary: {
                                                            type:
                                                                "string"
                                                        },

                                                        strengths: {
                                                            type:
                                                                "string"
                                                        },

                                                        improvements: {
                                                            type:
                                                                "string"
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
                                                type:
                                                    "string"
                                            },

                                            strength: {
                                                type:
                                                    "string"
                                            },

                                            improvement: {
                                                type:
                                                    "string"
                                            },


                                            tips: {

                                                type:
                                                    "array",

                                                items: {
                                                    type:
                                                        "string"
                                                }
                                            },


                                            tip: {
                                                type:
                                                    "string"
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
                                    }
                                }
                            },


                            messages: [

                                {
                                    role:
                                        "system",

                                    content: `

You are an expert public speaking coach.

Analyze the user's actual speech transcript.

Your feedback must be specific to what the
speaker actually said.

Never give generic advice when the transcript
provides enough information to give specific
feedback.

Pay close attention to:

- filler words
- repeated words
- "um"
- "umm"
- "uh"
- "uhh"
- "like"
- "you know"
- unnecessary phrases
- rambling
- sentence length
- unclear wording
- vague statements
- transitions
- organization
- conciseness
- strengths
- areas for improvement

IMPORTANT:

Break the speech into its actual sections.

For example, if the speech contains:

1. Introduction
2. Main argument
3. Example
4. Explanation
5. Conclusion

analyze those sections individually.

Do NOT invent sections that are not reasonably
present in the transcript.

For every section, explain:

- what the speaker was trying to communicate
- what worked
- what could be clearer
- what could be improved

For filler words:

Only mention filler words that actually appear
in the transcript.

If "umm", "uhh", "um", or "uh" occur,
specifically discuss them.

Give concrete advice.

Instead of:

"Try to reduce filler words."

say something like:

"You repeatedly use 'umm' before explaining your
second point. Pause silently for a moment instead
of filling that gap."

The overall assessment should discuss the speech
as a whole.

The improvement section should identify the most
important change the speaker should make.

Provide several practical AI tips that are
specific to this speech.

Return ONLY the requested JSON structure.
`
                                },


                                {
                                    role:
                                        "user",

                                    content:
                                        `Analyze this speech transcript:

${transcript}`
                                }
                            ]
                        })
                }
            );


        /* =====================================================
           READ RESPONSE
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

            return res.status(
                response.status
            ).json({

                error:
                    "OpenAI analysis failed",

                details:
                    responseText

            });
        }


        /* =====================================================
           PARSE OPENAI RESPONSE
           ===================================================== */

        let data;


        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (error) {

            console.error(
                "Could not parse OpenAI response:",
                error
            );

            return res.status(500).json({

                error:
                    "OpenAI returned invalid JSON",

                details:
                    responseText

            });
        }


        /* =====================================================
           GET MODEL CONTENT
           ===================================================== */

        const content =
            data
                ?.choices
                ?.[0]
                ?.message
                ?.content;


        if (!content) {

            return res.status(500).json({

                error:
                    "OpenAI returned no analysis content",

                details:
                    JSON.stringify(data)

            });
        }


        /* =====================================================
           PARSE STRUCTURED CONTENT
           ===================================================== */

        let analysis;


        try {

            analysis =
                typeof content === "string"
                    ? JSON.parse(content)
                    : content;

        } catch (error) {

            console.error(
                "Could not parse structured analysis:",
                error
            );


            return res.status(500).json({

                error:
                    "The AI analysis JSON was invalid",

                details:
                    content

            });
        }


        /* =====================================================
           VALIDATE
           ===================================================== */

        if (
            !analysis ||
            typeof analysis !== "object"
        ) {

            return res.status(500).json({

                error:
                    "OpenAI returned an invalid analysis object"

            });
        }


        /* =====================================================
           NORMALIZE
           ===================================================== */

        const analysisData = {

            overall:
                typeof analysis.overall ===
                "string"
                    ? analysis.overall
                    : "",


            fillerWords:
                analysis.fillerWords &&
                typeof analysis.fillerWords ===
                "object"

                    ? analysis.fillerWords

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
                typeof analysis.clarity ===
                "string"
                    ? analysis.clarity
                    : "",


            strength:
                typeof analysis.strength ===
                "string"
                    ? analysis.strength
                    : "",


            improvement:
                typeof analysis.improvement ===
                "string"
                    ? analysis.improvement
                    : "",


            tips:
                Array.isArray(
                    analysis.tips
                )
                    ? analysis.tips
                    : [],


            tip:
                typeof analysis.tip ===
                "string"
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
                "Unknown analysis error"

        });
    }
}