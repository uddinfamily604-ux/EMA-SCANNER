export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.REACT_APP_ANTHROPIC_KEY;
  if (!key) return res.status(500).json({ error: "API key not configured" });

  try {
    const https = await import("https");
    const body = JSON.stringify(req.body);

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "x-api-key": key,
          "anthropic-version": "2023-06-01"
        }
      };
      const request = https.default.request(options, (response) => {
        let raw = "";
        response.on("data", chunk => raw += chunk);
        response.on("end", () => {
          try { resolve({ status: response.statusCode, body: JSON.parse(raw) }); }
          catch (e) { reject(e); }
        });
      });
      request.on("error", reject);
      request.write(body);
      request.end();
    });

    return res.status(data.status).json(data.body);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
