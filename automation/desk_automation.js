/**
 * Script de Automação para DeskManager (Fase 4 - Completa)
 * Funções: Preenchimento automático, detecção de salvamento e captura de número.
 */

(function() {
    const STORAGE_KEY = 'deskmanager_auto_data';
    const SUCCESS_INDICATOR_STORAGE = 'deskmanager_last_ticket';

    console.log("[DeskAuto] Iniciando módulo de automação...");

    // 1. Verificar se acabamos de salvar um chamado (para mostrar o resultado)
    checkIfTicketWasSaved();

    // 2. Tentar preencher o formulário (se houver dados pendentes)
    async function startFilling() {
        const rawData = localStorage.getItem(STORAGE_KEY);
        if (!rawData) return;

        const data = JSON.parse(rawData);
        console.log("[DeskAuto] Dados encontrados. Iniciando preenchimento...");

        try {
            await fillField("#assunto", data.subject); // TODO: Adaptar seletor
            await fillDescription(data.description);
            await fillAutocomplete("#cliente_nome", data.client); // TODO: Adaptar seletor
            await fillSelect("#categoria", data.category); // TODO: Adaptar seletor

            console.log("[DeskAuto] Preenchimento inicial concluído.");
            
            // Iniciar observação para o botão de salvar
            observeSaveAction();
            
        } catch (e) {
            console.error("[DeskAuto] Erro durante preenchimento:", e);
        }
    }

    /**
     * Tenta detectar quando o usuário clica em salvar para monitorar a próxima página
     */
    function observeSaveAction() {
        // TODO: Adaptar o seletor do botão de salvar real (ex: .btn-save, #enviar)
        const btnSave = document.querySelector("#btn_salvar_chamado") || document.querySelector("button[type='submit']");
        if (btnSave) {
            btnSave.addEventListener("click", () => {
                console.log("[DeskAuto] Salvamento detectado. Preparando captura...");
                // Marcamos que um salvamento está em curso
                localStorage.setItem('desk_save_pending', 'true');
            });
        }
    }

    /**
     * Verifica se a página atual é a de sucesso ou detalhe do chamado
     */
    async function checkIfTicketWasSaved() {
        const isPending = localStorage.getItem('desk_save_pending');
        
        // Critério de detecção: Pode ser uma mensagem de sucesso ou a URL mudou
        // TODO: Adaptar lógica de detecção de sucesso (ex: conferir se existe div.alert-success)
        const successMessage = document.querySelector(".alert-success") || document.body.innerText.includes("sucesso");
        
        if (isPending && successMessage) {
            console.log("[DeskAuto] Chamado salvo com sucesso detectado!");
            localStorage.removeItem('desk_save_pending');
            localStorage.removeItem(STORAGE_KEY); // Limpa o rastro do preenchimento

            try {
                // TODO: Adaptar o seletor onde o número do chamado aparece (ex: .ticket-id, h1.title)
                const ticketNumber = await captureTicketNumber();
                showResultUI(ticketNumber);
            } catch (e) {
                console.error("[DeskAuto] Falha ao capturar número:", e);
                showResultUI(null);
            }
        }
    }

    async function captureTicketNumber() {
        // Tenta capturar de vários lugares comuns
        // TODO: Personalizar conforme o DeskManager real
        const selectors = [".ticket-number", "#chamado_id", "h2 span", ".breadcrumb .active"];
        for (let sel of selectors) {
            const el = document.querySelector(sel);
            if (el && /\d+/.test(el.innerText)) {
                return el.innerText.match(/\d+/)[0];
            }
        }
        throw new Error("Número do chamado não encontrado no DOM");
    }

    /**
     * Renderiza uma pequena UI flutuante com o resultado
     */
    function showResultUI(number) {
        const div = document.createElement("div");
        div.style = `
            position: fixed; top: 20px; right: 20px; z-index: 99999;
            background: white; padding: 20px; border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 2px solid #0078d4;
            width: 300px; font-family: 'Segoe UI', sans-serif;
        `;

        if (!number) {
            div.innerHTML = `
                <h3 style="margin-top:0; color: #d83b01;">Atenção</h3>
                <p>Chamado salvo, mas não consegui capturar o número automaticamente.</p>
                <button onclick="this.parentElement.remove()" style="width:100%; padding:10px;">Fechar</button>
            `;
        } else {
            const msg = `Seu chamado foi registrado com sucesso sob o número ${number}.`;
            div.innerHTML = `
                <h3 style="margin-top:0; color: #0078d4;">Chamado Registrado!</h3>
                <p style="font-size: 1.2rem; font-weight: bold; text-align: center;">#${number}</p>
                <div style="display:flex; gap: 5px; margin-bottom: 10px;">
                    <button id="copy-num" style="flex:1; padding:8px; cursor:pointer;">Copiar Nº</button>
                    <button id="copy-msg" style="flex:2; padding:8px; cursor:pointer;">Copiar Mensagem</button>
                </div>
                <button onclick="this.parentElement.remove()" style="width:100%; padding:5px; background:none; border:none; color:#666; cursor:pointer;">Fechar</button>
            `;

            setTimeout(() => {
                div.querySelector("#copy-num").onclick = () => copyToClipboard(number, "Número copiado!");
                div.querySelector("#copy-msg").onclick = () => copyToClipboard(msg, "Mensagem pronta copiada!");
            }, 100);
        }

        document.body.appendChild(div);
    }

    function copyToClipboard(text, successMsg) {
        navigator.clipboard.writeText(text).then(() => {
            alert(successMsg);
        });
    }

    // --- Helpers de Preenchimento (da Fase 3) ---

    async function fillField(sel, val) {
        const el = document.querySelector(sel);
        if (el) { el.value = val; el.dispatchEvent(new Event('input', {bubbles:true})); }
    }

    async function fillDescription(text) {
        const el = document.querySelector("#descricao") || document.querySelector("[name='descricao']");
        if (el) el.value = text;
        // iFrame fallback
        const iframe = document.querySelector('iframe.cke_wysiwyg_frame');
        if (iframe) iframe.contentDocument.body.innerHTML = text.replace(/\n/g, '<br>');
    }

    async function fillAutocomplete(sel, val) {
        const el = document.querySelector(sel);
        if (el) { el.value = val; el.focus(); el.dispatchEvent(new Event('input', {bubbles:true})); }
    }

    async function fillSelect(sel, val) {
        const el = document.querySelector(sel);
        if (el) { el.value = val; el.dispatchEvent(new Event('change', {bubbles:true})); }
    }

    // Execução
    if (document.readyState === 'complete') {
        startFilling();
    } else {
        window.addEventListener('load', startFilling);
    }
})();
