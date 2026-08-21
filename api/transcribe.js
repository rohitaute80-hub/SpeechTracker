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


        const { audio } = req.body;


        if (!audio) {

            return res.status(400).json({
                error:
                    "No audio was received"
            });
        }


        const audioBuffer =
            Buffer.from(
                audio,
                "base64"
            );


        const formData =
            new FormData();


        const audioBlob =
            new Blob(
                [audioBuffer],
                {
                    type:
                        "audio/webm"
                }
            );


        formData.append(
            "file",
            audioBlob,
            "speech.webm"
        );


        formData.append(
            "model",
            "gpt-4o-mini-transcribe"
        );


        formData.append(
            "prompt",
            "Transcribe the speech exactly as spoken. Preserve filler words including um, uh, umm, uhh, like, you know, basically, literally, and actually. Preserve repeated words. Do not clean up or rewrite the speech."
        );


        const openAIResponse =
            await fetch(
                "https://api.openai.com/v1/audio/transcriptions",
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Bearer ${process.env.OPENAI_API_KEY}`
                    },

                    body: formData
                }
            );


        const responseText =
            await openAIResponse.text();


        console.log(
            "OpenAI status:",
            openAIResponse.status
        );


        if (!openAIResponse.ok) {

            console.error(
                "OpenAI error:",
                responseText
            );

            return res
                .status(
                    openAIResponse.status
                )
                .json({
                    error:
                        "OpenAI transcription failed",

                    details:
                        responseText
                });
        }


        const result =
            JSON.parse(
                responseText
            );


        return res.status(200).json({
            transcript:
                result.text || ""
        });


    } catch (error) {

        console.error(
            "SERVER ERROR:",
            error
        );


        return res.status(500).json({
            error:
                error.message ||
                "Unknown server error"
        });
    }
}