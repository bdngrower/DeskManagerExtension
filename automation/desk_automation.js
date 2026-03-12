/**
 * Script de Automação para DeskManager (brasinfo.desk.ms)
 * Funções: Preenchimento automático em MODAL, detecção de salvamento e captura de número.
 */

(function() {
    const STORAGE_KEY = 'deskmanager_auto_data';
    const SAVE_PENDING_KEY = 'desk_save_pending';

    console.log("[DeskAuto] Iniciando módulo de automação para brasinfo.desk.ms...");

    // 1. Verificar se acabamos de salvar um chamado (para mostrar o resultado)
    checkIfTicketWasSaved();

    // 2. Tentar preencher o formulário
    function init() {
        const rawData = localStorage.getItem(STORAGE_KEY);
        if (!rawData) return;

        console.log("[DeskAuto] Dados aguardando preenchimento...");

        // Usar um Observer para detectar quando o formulário de criação aparece (pois é um modal)
        const observer = new MutationObserver((mutations, obs) => {
            // Procurar por campos do modal
            const descriptionField = document.querySelector("textarea[name='descricao']") || 
                                   document.querySelector(".cke_wysiwyg_frame") ||
                                   document.querySelector("#descricao");

            if (descriptionField) {
                console.log("[DeskAuto] Modal de chamado detectado. Preenchendo...");
                const data = JSON.parse(rawData);
                fillForm(data);
                // obs.disconnect(); // Mantemos o observer caso ele queira abrir outro? Não, melhor desconectar após preencher uma vez.
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Tentar clicar no botão "+" automaticamente se ele existir e o modal não estiver aberto
        setTimeout(() => {
            const btnPlus = document.querySelector(".btn-novo-chamado") || 
                           document.querySelector(".floating-button") || 
                           document.querySelector("button i.fa-plus")?.parentElement;
            
            if (btnPlus && !document.querySelector("textarea[name='descricao']")) {
                console.log("[DeskAuto] Clicando no botão '+' para abrir o formulário...");
                btnPlus.click();
            }
        }, 2000);
    }

    async function fillForm(data) {
        try {
            // Preencher Assunto
            const subjectField = document.querySelector("input[name='assunto']") || 
                               document.querySelector("#assunto") ||
                               document.querySelector(".select2-search__field");
            if (subjectField) {
                subjectField.value = data.subject;
                subjectField.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Preencher Descrição
            await fillDescription(data.description);

            // Preencher Solicitante (Geralmente Select2 ou similar)
            const requesterField = document.querySelector("input[name='solicitante']") || 
                                 document.querySelector("#solicitante");
            if (requesterField) {
                requesterField.value = data.email;
                requesterField.dispatchEvent(new Event('input', { bubbles: true }));
            }

            console.log("[DeskAuto] Formulário preenchido com sucesso.");
            
            // Monitorar clique no botão de salvar
            observeSaveAction();

        } catch (e) {
            console.error("[DeskAuto] Erro ao preencher form:", e);
        }
    }

    async function fillDescription(text) {
        // Tentar textarea simples
        const textarea = document.querySelector("textarea[name='descricao']") || document.querySelector("#descricao");
        if (textarea) {
            textarea.value = text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Tentar CKEditor (comum no DeskManager)
        const iframe = document.querySelector('iframe.cke_wysiwyg_frame');
        if (iframe && iframe.contentDocument) {
            iframe.contentDocument.body.innerHTML = text.replace(/\n/g, '<br>');
        }
    }

    function observeSaveAction() {
        // Procurar botão de salvar (geralmente .btn-success ou .btn-primary dentro do modal)
        const saveButtons = document.querySelectorAll("button.btn-success, button.btn-primary, #btn-salvar");
        saveButtons.forEach(btn => {
            if (btn.innerText.toLowerCase().includes("salvar") || btn.innerText.toLowerCase().includes("abrir")) {
                btn.addEventListener("click", () => {
                    console.log("[DeskAuto] Botão salvar clicado.");
                    localStorage.setItem(SAVE_PENDING_KEY, 'true');
                });
            }
        });
    }

    async function checkIfTicketWasSaved() {
        const isPending = localStorage.getItem(SAVE_PENDING_KEY);
        if (!isPending) return;

        // Verificar se apareceu mensagem de sucesso (toast/alert)
        const successNotify = document.querySelector(".toast-success") || 
                            document.querySelector(".alert-success") ||
                            document.body.innerText.includes("sucesso");

        if (successNotify) {
            console.log("[DeskAuto] Sucesso detectado pós-salvamento.");
            localStorage.removeItem(SAVE_PENDING_KEY);
            localStorage.removeItem(STORAGE_KEY);

            const number = await captureTicketNumber();
            showResultUI(number);
        }
    }

    async function captureTicketNumber() {
        // Tentar pegar do toast ou do detalhe do chamado que abre depois
        const selectors = [".toast-message", ".ticket-id", "h1", "h2", ".breadcrumb"];
        for (let sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                const match = el.innerText.match(/\d+-\d+/) || el.innerText.match(/\d+/);
                if (match) return match[0];
            }
        }
        return null;
    }

    function showResultUI(number) {
        const div = document.createElement("div");
        div.id = "desk-auto-result";
        div.style = `
            position: fixed; bottom: 80px; right: 20px; z-index: 999999;
            background: white; padding: 15px; border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); border-left: 5px solid #0078d4;
            max-width: 300px; font-family: sans-serif;
        `;

        const title = number ? "Chamado Criado!" : "Atenção";
        const body = number ? `Número: <strong>${number}</strong>` : "Chamado salvo, mas não capturei o número.";
        const msg = `Seu chamado foi registrado com sucesso sob o número ${number}.`;

        div.innerHTML = `
            <div style="font-weight:bold; color:#0078d4; margin-bottom:5px;">${title}</div>
            <div style="margin-bottom:10px;">${body}</div>
            ${number ? `
            <div style="display:flex; gap:5px;">
                <button id="desk-copy-num" style="flex:1; cursor:pointer; padding:5px;">Copiar Nº</button>
                <button id="desk-copy-msg" style="flex:1; cursor:pointer; padding:5px;">Mensagem</button>
            </div>` : ''}
            <button onclick="document.getElementById('desk-auto-result').remove()" style="margin-top:10px; width:100%; border:none; background:none; color:#999; cursor:pointer; font-size:11px;">Fechar</button>
        `;

        document.body.appendChild(div);

        if (number) {
            document.getElementById("desk-copy-num").onclick = () => {
                navigator.clipboard.writeText(number);
                alert("Número copiado!");
            };
            document.getElementById("desk-copy-msg").onclick = () => {
                navigator.clipboard.writeText(msg);
                alert("Mensagem copiada!");
            };
        }
    }

    // Iniciar
    init();
})();
