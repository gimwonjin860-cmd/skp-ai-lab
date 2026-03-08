export const maxDuration = 120;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, input } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API key required' });

  try {
    const createResp = await fetch('https://api.replicate.com/v1/models/philz1337x/clarity-upscaler/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({ input })
    });

    if (!createResp.ok) {
      const err = await createResp.json();
      return res.status(createResp.status).json({ error: err.detail || 'Replicate error' });
    }

    let prediction = await createResp.json();

    let attempts = 0;
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempts < 60) {
      await new Promise(r => setTimeout(r, 2000));
      const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      prediction = await pollResp.json();
      attempts++;
    }

    if (prediction.status === 'failed') {
      return res.status(500).json({ error: prediction.error || 'Prediction failed' });
    }

    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    return res.status(200).json({ output });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
