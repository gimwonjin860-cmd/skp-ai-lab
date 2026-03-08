export const maxDuration = 60; // Vercel Pro 최대 60초

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { image, mask, apiKey } = req.body;
  if (!image || !apiKey) return res.status(400).json({ error: 'image, apiKey 필요' });

  try {
    // Prefer: wait=55 → Replicate이 55초 내로 완료되면 바로 응답
    const cr = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-fill-pro/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=55'
      },
      body: JSON.stringify({
        input: {
          image,
          mask,
          prompt: "seamless tileable texture, natural material surface, continuous pattern, no seams",
          steps: 20,
          guidance: 30,
          output_format: "png"
        }
      })
    });

    if (!cr.ok) {
      const errText = await cr.text();
      return res.status(cr.status).json({ error: errText });
    }

    const pred = await cr.json();

    if (pred.status === 'succeeded' && pred.output) {
      const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
      return res.status(200).json({ url });
    }

    if (pred.status === 'failed') {
      return res.status(500).json({ error: pred.error || 'failed' });
    }

    // 아직 processing 중이면 짧게 폴링 (최대 30초 추가)
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pr = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      const pd = await pr.json();
      if (pd.status === 'succeeded') {
        const url = Array.isArray(pd.output) ? pd.output[0] : pd.output;
        return res.status(200).json({ url });
      }
      if (pd.status === 'failed') return res.status(500).json({ error: pd.error || 'failed' });
    }

    return res.status(504).json({ error: '타임아웃' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
