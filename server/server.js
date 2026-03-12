const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const https = require('https');
const devCerts = require('office-addin-dev-certs');

async function startServer() {
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Armazenamento em memória com TTL
    const drafts = new Map();
    const TTL_MS = 30 * 60 * 1000; // 30 minutos

    app.use(cors());
    app.use(bodyParser.json({ limit: '10mb' }));

    // Servir arquivos estáticos (Add-in e Helper)
    app.use('/src', express.static(path.join(__dirname, '../src')));
    app.use('/helper', express.static(path.join(__dirname, '../helper')));
    app.use('/assets', express.static(path.join(__dirname, '../assets')));

    // Endpoint para criar um draft
    app.post('/api/draft', (req, res) => {
        const { sender, email, subject, bodyHtml, bodyText, dateTime, internetMessageId } = req.body;
        if (!email || !subject) return res.status(400).json({ error: 'Dados insuficientes' });

        const draftId = uuidv4();
        drafts.set(draftId, { sender, email, subject, bodyHtml, bodyText, dateTime, internetMessageId, createdAt: Date.now() });
        console.log(`[Server] Draft criado: ${draftId} | De: ${email}`);

        setTimeout(() => drafts.delete(draftId), TTL_MS);
        res.json({ draftId });
    });

    // Endpoint para buscar um draft
    app.get('/api/draft/:id', (req, res) => {
        const data = drafts.get(req.params.id);
        if (!data) return res.status(404).json({ error: 'Draft não encontrado' });
        res.json(data);
    });

    // Configuração de HTTPS Local (para Office Add-ins)
    try {
        const options = await devCerts.getHttpsServerOptions();
        https.createServer(options, app).listen(PORT, () => {
            console.log(`================================================`);
            console.log(`Servidor SEGURO (HTTPS) rodando em:`);
            console.log(`https://localhost:${PORT}`);
            console.log(`================================================`);
            console.log(`DICA: Se for a primeira vez, pode ser solicitado`);
            console.log(`para instalar o certificado de desenvolvedor.`);
        });
    } catch (err) {
        console.error("Erro ao iniciar servidor HTTPS:", err);
        // Fallback para HTTP (não recomendado para Office)
        app.listen(PORT, () => console.log(`Rodando em HTTP (Atenção: Office exige HTTPS)`));
    }
}

startServer();
