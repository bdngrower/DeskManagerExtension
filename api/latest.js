import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Buscar o ID do último draft salvo
    // Durante o POST em /api/draft, vamos salvar esse ID na chave 'latest_draft_id'
    const latestId = await redis.get('latest_draft_id');
    
    if (!latestId) {
      return res.status(404).json({ error: "Nenhum chamado recente encontrado." });
    }

    const draft = await redis.get(`draft:${latestId}`);
    
    if (!draft) {
      return res.status(404).json({ error: "Chamado expirado." });
    }

    // Verificar se o chamado é "fresco" (criado há menos de 5 minutos)
    const now = Date.now();
    const ageSeconds = (now - draft.createdAt) / 1000;
    
    if (ageSeconds > 300) { // 5 minutos
       return res.status(410).json({ error: "Chamado muito antigo para automação." });
    }

    return res.status(200).json(draft);

  } catch (error) {
    console.error("Erro na API Latest:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
}
