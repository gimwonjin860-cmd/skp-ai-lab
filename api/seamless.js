export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { image, apiKey } = req.body;
  if (!image || !apiKey) return res.status(400).json({ error: 'image, apiKey 필요' });

  try {
    // 1. prediction 생성
    const cr = await fetch('https://api.replicate.com/v1/models/replicate/seamless-texture/predictions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { image } })
    });
    if (!cr.ok) return res.status(cr.status).json({ error: await cr.text() });
    const pred = await cr.json();

    // 2. 폴링 (최대 90초)
    for (let i = 0; i < 45; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pr = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      const pd = await pr.json();
      if (pd.status === 'succeeded') {
        const url = Array.isArray(pd.output) ? pd.output[0] : pd.output;
        return res.status(200).json({ url });
      }
      if (pd.status === 'failed') return res.status(500).json({ error: pd.error });
    }
    return res.status(504).json({ error: '타임아웃' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
