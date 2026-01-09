export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const apiKey = process.env.OCR_SPACE_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: "Missing OCR_SPACE_API_KEY" };
    }

    const { imageUrl } = JSON.parse(event.body || "{}");
    if (!imageUrl) {
      return { statusCode: 400, body: "Missing imageUrl" };
    }

    const params = new URLSearchParams();
    params.set("apikey", apiKey);
    params.set("language", "eng");
    params.set("isOverlayRequired", "false");
    params.set("OCREngine", "2");
    params.set("scale", "true");
    params.set("url", imageUrl);

    const resp = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await resp.json();

    const raw = (data?.ParsedResults?.[0]?.ParsedText || "").toString();

    // return raw + a few candidates (very simple)
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        raw,
        provider: "ocr.space",
        // keep full response for debugging if needed:
        debug: { OCRError: data?.ErrorMessage || null }
      }),
    };
  } catch (e) {
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
