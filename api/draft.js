import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'POST') {
        const { sender, email, subject, bodyHtml, bodyText, dateTime, internetMessageId } = req.body;
        
        if (!email || !subject) return res.status(400).json({ error: 'Dados insuficientes' });

        const draftId = uuidv4();
        const data = {
            draftId,
            sender,
            email,
            subject,
            bodyHtml,
            bodyText,
            dateTime,
            internetMessageId,
            createdAt: Date.now()
        };

        // Salvar com prefixo draft: para organização
        await redis.set(`draft:${draftId}`, data, { ex: 1800 });
        
        // Registrar como o mais recente para o robô v1.4+
        await redis.set('latest_draft_id', draftId, { ex: 300 });

        return res.json({ draftId });
    }

    if (req.method === 'GET') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'ID não informado' });

        // Tentar com e sem prefixo para compatibilidade
        let data = await redis.get(`draft:${id}`);
        if (!data) data = await redis.get(id);

        if (!data) return res.status(404).json({ error: 'Expirado' });
        return res.json(data);
    }

    res.status(405).json({ error: 'Método não permitido' });
}
