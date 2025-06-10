const fetch = require('node-fetch');

async function generateImage(prompt) {
  const base = process.env.CUSTOM_AI_ENDPOINT.replace(/\/$/, "");
  const url = `${base}/api/GenerateImage?code=${process.env.CUSTOM_AI_AUTH}`;
  const body = {
    group: "imageguess",
    type: "raw",
    size: "1536x1024",
    details: prompt,
  };

  console.log("Generating image for prompt:", prompt);
  console.log("Request URL:", url);
  console.log("Request body:", JSON.stringify(body, null, 2));

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const imageUrl = `${base}/${data.imageUrl}?code=${process.env.CUSTOM_AI_AUTH}`;
        console.log("Image generated:", imageUrl);
        return imageUrl;
      }

      if (res.status === 500 && attempt < 3) {
        const wait = 10000 * Math.pow(2, attempt);
        console.log(`Image generation failed, retrying in ${wait}ms...`);
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }

      const errorText = await res.text();
      throw new Error(`Image generation failed (${res.status}): ${errorText}`);
    } catch (error) {
      if (attempt === 3) throw error;
      console.error(`Attempt ${attempt + 1} failed:`, error.message);
    }
  }
}

module.exports = { generateImage };
