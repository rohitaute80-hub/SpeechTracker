/* =========================================================
   SPEECH TRACKER
   api/analyze.js

   AI speech analysis endpoint.

   IMPORTANT:
   - NEVER put the API key in this file.
   - OPENAI_API_KEY must be stored in Vercel Environment
     Variables.
   ========================================================= */

export default async function handler(req, res) {

    /* =====================================================
       METHOD
       ===================================================== */

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });

    }


    try {

        /* =================================================
           API KEY
           ================================================= */

        const apiKey =
            process.env.OPENAI_API_KEY;


        if (!apiKey) {

            return res.status(500).json({
                error:
                    "OPENAI_API_KEY is missing from Vercel."
            });

        }


        /* =================================================
           REQUEST BODY
           ================================================= */

        const {
            transcript,
            metrics
        } = req.body || {};


        if (
            !transcript ||
            typeof transcript !== "string" ||
            !transcript.trim()
        ) {

            return res.status(400).json({
                error:
                    "No transcript was provided."
            });

        }


        /* =================================================
           METRICS
           ================================================= */

        const wordCount =
            Number(
                metrics?.wordCount || 0
            );


        const fillerCount =
            Number(
                metrics?.fillerCount || 0
            );


        const fillerRate =
            Number(
                metrics?.fillerRate || 0
            );


        const durationSeconds =
            Number(
                metrics?.durationSeconds || 0
            );


        const pacing =
            Number(
                metrics?.pacing || 0
            );


        /* =================================================
           SYSTEM PROMPT
           ================================================= */

        const systemPrompt = `
You are an expert public-speaking coach analyzing a real speech transcript.

Your job is to provide highly specific, useful feedback based ONLY on the speech the user actually gave.

Do NOT give generic public-speaking advice when the transcript provides enough information to be specific.

Analyze:

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
- grammar
- transitions
- organization
- conciseness
- clarity
- strengths
- areas for improvement

IMPORTANT FILLER RULE:

Only discuss filler words that actually appear in the transcript.

If "um", "umm", "uh", or "uhh" appear, specifically discuss them.

Do not invent filler words.

IMPORTANT METRICS RULE:

The application has already calculated:

- word count
- filler count
- filler rate
- speech duration
- speaking pace

Use these values exactly.

Do NOT invent different values.

Filler rate means:

filler words / total words × 100

Speaking pace means:

words per minute

The AI should explain what these numbers mean and whether they appear reasonable for the speech.

GRAMMAR:

Analyze the actual grammar in the transcript.

Identify concrete issues such as:

- incomplete sentences
- awkward phrasing
- incorrect word usage
- repetitive sentence structures
- unclear pronouns
- overly complicated sentences
- grammar mistakes

Do not claim grammar mistakes exist if the transcript does not support that conclusion.

SPEECH SECTIONS:

Break the speech into its actual logical sections.

For example, if the speech contains:

1. Introduction
2. Main argument
3. Example
4. Explanation
5. Conclusion

analyze those sections individually.

Do NOT invent sections that are not reasonably present.

For every section explain:

- what the speaker was trying to communicate
- what worked
- what could be clearer
- what could be improved

OVERALL FEEDBACK:

Give a concise but specific overview of the speech.

The improvement section should identify the most important thing the speaker should work on.

TIPS:

Provide several practical tips specifically connected to this speech.

Avoid generic advice.

For example, instead of:

"Try to reduce filler words."

say:

"You repeatedly use 'umm' before introducing your second point. Replace that hesitation with a short silent pause before starting the sentence."

Return ONLY valid JSON matching the requested structure.
`;


        /* =================================================
           USER PROMPT
           ================================================= */

        const userPrompt = `
Analyze this speech.

TRANSCRIPT:
${transcript}

CALCULATED METRICS:

Word count:
${wordCount}

Filler count:
${fillerCount}

Filler rate:
${fillerRate}%

Duration:
${durationSeconds} seconds

Speaking pace:
${pacing} words per minute
`;


        /* =================================================
           JSON SCHEMA
           ================================================= */

        const schema = {

            type: "object",

            additionalProperties: false,

            properties: {

                overall: {
                    type: "string"
                },


                metrics: {

                    type: "object",

                    additionalProperties: false,

                    properties: {

                        wordCount: {
                            type: "integer"
                        },

                        fillerCount: {
                            type: "integer"
                        },

                        fillerRate: {
                            type: "string"
                        },

                        pacing: {
                            type: "string"
                        },

                        duration: {
                            type: "string"
                        },

                        interpretation: {
                            type: "string"
                        }

                    },

                    required: [
                        "wordCount",
                        "fillerCount",
                        "fillerRate",
                        "pacing",
                        "duration",
                        "interpretation"
                    ]

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

                        rate: {
                            type: "string"
                        },

                        feedback: {
                            type: "string"
                        }

                    },

                    required: [
                        "summary",
                        "detected",
                        "count",
                        "rate",
                        "feedback"
                    ]

                },


                pacing: {

                    type: "object",

                    additionalProperties: false,

                    properties: {

                        wordsPerMinute: {
                            type: "number"
                        },

                        assessment: {
                            type: "string"
                        },

                        feedback: {
                            type: "string"
                        }

                    },

                    required: [
                        "wordsPerMinute",
                        "assessment",
                        "feedback"
                    ]

                },


                grammar: {

                    type: "object",

                    additionalProperties: false,

                    properties: {

                        assessment: {
                            type: "string"
                        },

                        issues: {

                            type: "array",

                            items: {
                                type: "string"
                            }

                        },

                        feedback: {
                            type: "string"
                        }

                    },

                    required: [
                        "assessment",
                        "issues",
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
                "metrics",
                "fillerWords",
                "pacing",
                "grammar",
                "speechSections",
                "clarity",
                "strength",
                "improvement",
                "tips",
                "tip"
            ]

        };


        /* =================================================
           OPENAI REQUEST
           ================================================= */

        const response =
            await fetch(
                "https://api.openai.com/v1/responses",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${apiKey}`

                    },

                    body:
                        JSON.stringify({

                            model:
                                "gpt-4o-mini",

                            input: [

                                {
                                    role: "system",

                                    content: [
                                        {
                                            type:
                                                "input_text",

                                            text:
                                                systemPrompt
                                        }
                                    ]
                                },

                                {
                                    role: "user",

                                    content: [
                                        {
                                            type:
                                                "input_text",

                                            text:
                                                userPrompt
                                        }
                                    ]
                                }

                            ],

                            text: {

                                format: {

                                    type:
                                        "json_schema",

                                    name:
                                        "speech_analysis",

                                    strict:
                                        true,

                                    schema

                                }

                            }

                        })

                }
            );


        /* =================================================
           READ RESPONSE
           ================================================= */

        const responseText =
            await response.text();


        console.log(
            "OpenAI analysis status:",
            response.status
        );


        if (!response.ok) {

            console.error(
                "OpenAI analysis error:",
                responseText
            );


            return res.status(
                response.status
            ).json({

                error:
                    "OpenAI analysis failed.",

                details:
                    responseText

            });

        }


        /* =================================================
           PARSE RESPONSE
           ================================================= */

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
                    "OpenAI returned invalid JSON.",

                details:
                    responseText

            });

        }


        /* =================================================
           GET OUTPUT TEXT
           ================================================= */

        let content =
            data?.output_text;


        /*
           Some Responses API responses can expose
           the generated text through the output array.
        */

        if (
            !content &&
            Array.isArray(data?.output)
        ) {

            for (
                const item
                of data.output
            ) {

                if (
                    item?.type ===
                        "message" &&
                    Array.isArray(
                        item.content
                    )
                ) {

                    for (
                        const part
                        of item.content
                    ) {

                        if (
                            part?.type ===
                                "output_text" &&
                            typeof part.text ===
                                "string"
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

            return res.status(500).json({

                error:
                    "OpenAI returned no analysis content.",

                details:
                    JSON.stringify(data)

            });

        }


        /* =================================================
           PARSE STRUCTURED JSON
           ================================================= */

        let analysis;


        try {

            analysis =
                typeof content ===
                    "string"

                    ? JSON.parse(
                        content
                    )

                    : content;

        } catch (error) {

            console.error(
                "Could not parse structured analysis:",
                error
            );


            return res.status(500).json({

                error:
                    "The AI analysis JSON was invalid.",

                details:
                    content

            });

        }


        /* =================================================
           VALIDATE
           ================================================= */

        if (
            !analysis ||
            typeof analysis !== "object"
        ) {

            return res.status(500).json({

                error:
                    "OpenAI returned an invalid analysis object."

            });

        }


        /* =================================================
           NORMALIZE METRICS
           ================================================= */

        const normalizedMetrics = {

            wordCount:
                wordCount,

            fillerCount:
                fillerCount,

            fillerRate:
                `${fillerRate.toFixed(2)}%`,

            pacing:
                `${pacing.toFixed(1)} words/min`,

            duration:
                `${durationSeconds.toFixed(1)} seconds`,

            interpretation:
                analysis?.metrics
                    ?.interpretation ||
                ""

        };


        /* =================================================
           NORMALIZE ANALYSIS
           ================================================= */

        const analysisData = {

            overall:
                typeof analysis.overall ===
                    "string"
                    ? analysis.overall
                    : "",


            metrics:
                normalizedMetrics,


            fillerWords:
                analysis.fillerWords &&
                typeof analysis.fillerWords ===
                    "object"

                    ? {

                        ...analysis.fillerWords,

                        count:
                            fillerCount,

                        rate:
                            `${fillerRate.toFixed(2)}%`

                    }

                    : {

                        summary: "",

                        detected: [],

                        count:
                            fillerCount,

                        rate:
                            `${fillerRate.toFixed(2)}%`,

                        feedback: ""

                    },


            pacing:
                analysis.pacing &&
                typeof analysis.pacing ===
                    "object"

                    ? {

                        ...analysis.pacing,

                        wordsPerMinute:
                            Number(
                                pacing.toFixed(1)
                            )

                    }

                    : {

                        wordsPerMinute:
                            Number(
                                pacing.toFixed(1)
                            ),

                        assessment: "",

                        feedback: ""

                    },


            grammar:
                analysis.grammar &&
                typeof analysis.grammar ===
                    "object"

                    ? analysis.grammar

                    : {

                        assessment: "",

                        issues: [],

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


        /* =================================================
           RETURN
           ================================================= */

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