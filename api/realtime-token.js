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


        const response =
            await fetch(
                "https://api.openai.com/v1/realtime/transcription_sessions",
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

                            session: {

                                type:
                                    "transcription",

                                audio: {

                                    input: {

                                        format: {
                                            type:
                                                "audio/pcm",
                                            rate:
                                                24000
                                        },

                                        transcription: {

                                            model:
                                                "gpt-live-transcribe",

                                            language:
                                                "en",

                                            prompt:
                                                "Transcribe exactly what the speaker says. Preserve filler words such as um, uh, umm, uhh, like, you know, basically, literally, and actually. Never remove filler words."
                                        },

                                        turn_detection: {

                                            type:
                                                "server_vad",

                                            threshold:
                                                0.5,

                                            silence_duration_ms:
                                                500
                                        },

                                        noise_reduction: {

                                            type:
                                                "near_field"
                                        }
                                    }
                                }
                            }
                        })
                }
            );


        const text =
            await response.text();


        console.log(
            "Realtime token status:",
            response.status
        );


        if (!response.ok) {

            console.error(
                "Realtime token error:",
                text
            );


            return res.status(
                response.status
            ).json({

                error:
                    "Could not create realtime transcription session.",

                details:
                    text
            });
        }


        const data =
            JSON.parse(text);


        const clientSecret =
            data.client_secret?.value;


        if (!clientSecret) {

            return res.status(500).json({

                error:
                    "OpenAI did not return a realtime client secret."
            });
        }


        return res.status(200).json({

            client_secret:
                clientSecret
        });


    } catch (error) {

        console.error(
            "REALTIME TOKEN ERROR:",
            error
        );


        return res.status(500).json({

            error:
                error.message ||
                "Unknown server error"
        });
    }
}