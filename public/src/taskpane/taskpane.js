/**
 * Lógica do Add-in Taskpane (Fase 1.5)
 * Captura dados do e-mail e envia para o backend local via POST.
 */

/* global Office */

const BACKEND_URL = ""; // Relative path in production

Office.onReady((info) => {
    if (info.host === Office.HostType.Outlook) {
        document.getElementById("btn-open-ticket").onclick = handleOpenTicket;
        initializeUI();
    }
});

function initializeUI() {
    const item = Office.context.mailbox.item;
    if (item) {
        document.getElementById("sender-info").innerText = `${item.from.displayName} (${item.from.emailAddress})`;
        document.getElementById("subject-info").innerText = item.subject;
        document.getElementById("status-msg").innerText = "Pronto para capturar.";
    }
}

async function handleOpenTicket() {
    const item = Office.context.mailbox.item;
    updateStatus("Capturando dados...", "blue");

    try {
        // Capturando corpo em HTML e Texto de forma paralela
        const [bodyHtml, bodyText] = await Promise.all([
            getAsyncBody(Office.CoercionType.Html),
            getAsyncBody(Office.CoercionType.Text)
        ]);

        const payload = {
            sender: item.from.displayName,
            email: item.from.emailAddress,
            subject: item.subject,
            bodyHtml: bodyHtml,
            bodyText: bodyText,
            dateTime: item.dateTimeCreated.toISOString(),
            internetMessageId: item.internetMessageId || ""
        };

        // Enviar via POST para o backend
        const response = await fetch(`${BACKEND_URL}/api/draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Erro ao criar draft no servidor");

        const { draftId } = await response.json();
        
        updateStatus("Sucesso! Abrindo helper...", "green");

        // Abrir helper page em nova aba/janela
        // A helper page deve estar no mesmo domínio (localhost:3000) para evitar problemas de CORS no fetch
        const helperUrl = `${BACKEND_URL}/helper/helper.html?draft=${draftId}`;
        window.open(helperUrl, "_blank");

    } catch (error) {
        console.error("Erro na captura/envio:", error);
        updateStatus("Erro: " + error.message, "red");
    }
}

/**
 * Helper para transformar item.body.getAsync em Promise
 */
function getAsyncBody(coercionType) {
    return new Promise((resolve, reject) => {
        Office.context.mailbox.item.body.getAsync(coercionType, (result) => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
                resolve(result.value);
            } else {
                reject(result.error);
            }
        });
    });
}

function updateStatus(msg, color) {
    const el = document.getElementById("status-msg");
    el.innerText = msg;
    el.style.color = color;
}
