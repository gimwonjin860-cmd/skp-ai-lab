export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { image, apiKey } = req.body;
  if (!image || !apiKey) return res.status(400).json({ error: 'image와 apiKey 필요' });

  try {
    const cr = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b',
        input: { image, scale: 4, face_enhance: false },
      }),
    });

    if (!cr.ok) {
      const err = await cr.text();
      return res.status(cr.status).json({ error: err });
    }

    const pred = await cr.json();

    // 폴링 (최대 2분)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pr = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const pd = await pr.json();
      if (pd.status === 'succeeded') return res.status(200).json({ url: pd.output });
      if (pd.status === 'failed') return res.status(500).json({ error: pd.error });
    }

    return res.status(504).json({ error: '타임아웃' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
