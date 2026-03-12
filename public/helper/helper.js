/**
 * Lógica da Página Auxiliar (Helper)
 * Busca os dados do draft no backend e preenche a interface.
 */

const BACKEND_URL = "";

async function loadDraft() {
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('draft');

    if (!draftId) {
        showError("ID do draft não fornecido na URL.");
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/draft?id=${draftId}`);
        if (!response.ok) throw new Error("Draft expirado ou não encontrado.");

        const data = await response.json();
        renderDraft(data);

    } catch (error) {
        showError(error.message);
    }
}

function renderDraft(data) {
    document.getElementById("loading").style.display = "none";
    document.getElementById("content").style.display = "block";

    // Sugestão de Cliente baseada no domínio
    const domain = data.email.split('@')[1];
    document.getElementById("client").value = suggestClient(domain, data.sender);

    // Sugestão de Categoria baseada em palavras-chave no assunto
    document.getElementById("category").value = suggestCategory(data.subject);

    // Assunto original
    document.getElementById("subject").value = `[Suporte] ${data.subject}`;

    // Descrição Limpa (Remoção básica de tags HTML)
    const cleanBody = cleanHtml(data.bodyHtml || data.bodyText);
    
    const preparedDescription = `--- DADOS DO E-MAIL ---
Remetente: ${data.sender}
E-mail: ${data.email}
Data: ${new Date(data.dateTime).toLocaleString('pt-BR')}
Assunto Original: ${data.subject}

--- CONTEÚDO ---
${cleanBody}
`;

    document.getElementById("description").value = preparedDescription;

    // Configura o botão de prosseguir
    const btnProsseguir = document.querySelector(".btn-primary");
    btnProsseguir.onclick = saveAndOpenDeskManager;
}

function saveAndOpenDeskManager() {
    const data = {
        client: document.getElementById("client").value,
        category: document.getElementById("category").value,
        categoryText: document.getElementById("category").options[document.getElementById("category").selectedIndex].text,
        subject: document.getElementById("subject").value,
        description: document.getElementById("description").value,
        timestamp: Date.now()
    };

    // Salva no localStorage para que a aba do DeskManager possa ler
    localStorage.setItem('deskmanager_auto_data', JSON.stringify(data));

    console.log("Dados salvos no localStorage:", data);

    // TODO: Substituir pela URL real da tela de novo chamado do seu DeskManager
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('draft');
    const DESKMANAGER_NEW_TICKET_URL = `https://brasinfo.desk.ms/?Ticket#ChamadosSuporte`; 
    
    console.log("[Helper] Abrindo DeskManager e aguardando sinal de prontidão...");
    const win = window.open(DESKMANAGER_NEW_TICKET_URL, "_blank");
    
    // Sistema de Handshake: Espera o script no DeskManager dizer que carregou
    const handshakeListener = (event) => {
        if (event.origin !== "https://brasinfo.desk.ms") return;
        if (event.data === "DESK_AUTO_READY") {
            console.log("[Helper] Script detectado no DeskManager. Enviando DraftID...");
            win.postMessage({ type: "SET_DRAFT_ID", draftId: draftId }, event.origin);
            // window.removeEventListener("message", handshakeListener); // Opcional
        }
    };
    window.addEventListener("message", handshakeListener);

    if (win) win.focus();
}

function suggestClient(domain, sender) {
    const mapping = {
        'gmail.com': 'Cliente Final (Gmail)',
        'outlook.com': 'Cliente Final (Outlook)',
        'deskmanager.com.br': 'DeskManager Interno'
    };
    return mapping[domain] || `Novo Cliente (${domain})`;
}

function suggestCategory(subject) {
    const s = subject.toLowerCase();
    if (s.includes('imprimir') || s.includes('impressora')) return 'hardware';
    if (s.includes('senha') || s.includes('email') || s.includes('acesso')) return 'contas';
    if (s.includes('excel') || s.includes('word') || s.includes('office')) return 'aplicativos';
    return 'outros';
}

function cleanHtml(html) {
    if (!html) return "";
    // Remove tags HTML de forma simples para o PoC
    let doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}

function showError(msg) {
    document.getElementById("loading").innerText = "Erro: " + msg;
    document.getElementById("loading").style.color = "red";
}

// Iniciar carregamento
loadDraft();
