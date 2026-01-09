import fetch from "node-fetch";
import Busboy from "busboy";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: "Missing OCR_SPACE_API_KEY" };
  }

  const bb = Busboy({ headers: event.headers });
  let fileBuffer = null;

  await new Promise((resolve, reject) => {
    bb.on("file", (_, file) => {
      const chunks = [];
      file.on("data", d => chunks.push(d));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });
    bb.on("finish", resolve);
    bb.on("error", reject);
    bb.end(Buffer.from(event.body, "base64"));
  });

  if (!fileBuffer) {
    return { statusCode: 400, body: "No file uploaded" };
  }

  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("language", "eng");
  form.append("isOverlayRequired", "false");
  form.append("file", fileBuffer, "plate.jpg");

  const r = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    body: form
  });

  const j = await r.json();

  const raw = j?.ParsedResults?.[0]?.ParsedText || "";
  const tokens = raw
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const candidates = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const m = t.match(/^([A-Z])(\d{1,5})$/);
    if (m) {
      candidates.push({
        text: `${m[1]} ${m[2]}`,
        confidence: 80
      });
    }
    if (/^\d{1,5}$/.test(t)) {
      candidates.push({
        text: t,
        confidence: 60
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      raw,
      candidates
    })
  };
};
