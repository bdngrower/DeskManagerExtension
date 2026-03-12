/**
 * Script de Automação para DeskManager (brasinfo.desk.ms)
 * Otimizado para navegação automática e abertura de chamados via modal no botão "+"
 */

(function() {
    const STORAGE_KEY = 'deskmanager_auto_data';
    const SAVE_PENDING_KEY = 'desk_save_pending';

    console.log("[DeskAuto] Iniciando módulo de automação...");

    // 1. Verificar sucesso de salvamento anterior
    checkIfTicketWasSaved();

    // 2. Iniciar monitoramento de dados
    function init() {
        const rawData = localStorage.getItem(STORAGE_KEY);
        if (!rawData) {
            console.log("[DeskAuto] Nenhum dado pendente para preenchimento.");
            return;
        }

        const data = JSON.parse(rawData);
        console.log("[DeskAuto] Dados prontos para preenchimento no DeskManager.");

        // Monitorar a URL/Hash para garantir que estamos na página de Chamados
        autoNavigateToTickets();

        // Observer para detectar o Modal de Criação de Chamado
        const observer = new MutationObserver(() => {
            const modal = document.querySelector(".modal-content") || document.querySelector(".panel-modal");
            const hasDescription = document.querySelector("textarea[name='descricao']") || 
                                 document.querySelector(".cke_wysiwyg_frame") || 
                                 document.querySelector("#descricao");

            if (modal && hasDescription) {
                console.log("[DeskAuto] Modal 'Criar Chamado' detectado!");
                fillForm(data);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Tentar clicar no botão "+" sozinho se ele estiver visível e estivermos na página correta
        setInterval(() => {
            if (window.location.hash.includes("ChamadosSuporte")) {
                autoClickPlus();
            }
        }, 2000);
    }

    /**
     * Se o DeskManager redirecionar para #Home, tentamos clicar em "Lista de Chamados"
     */
    function autoNavigateToTickets() {
        const checkNavigation = setInterval(() => {
            if (window.location.hash.includes("Home") || !window.location.hash.includes("ChamadosSuporte")) {
                console.log("[DeskAuto] Fora da página de Chamados. Tentando navegar...");
                
                // Procurar pelo item de menu "Lista de Chamados"
                const menuItems = Array.from(document.querySelectorAll("a, span, li"));
                const targetMenu = menuItems.find(el => el.innerText.trim() === "Lista de Chamados" || 
                                                     el.innerText.trim() === "Chamados");
                
                if (targetMenu) {
                    console.log("[DeskAuto] Menu 'Lista de Chamados' encontrado. Clicando...");
                    targetMenu.click();
                } else {
                    // Tentar seletor por link direto
                    const link = document.querySelector("a[href*='ChamadosSuporte']");
                    if (link) link.click();
                }
            } else {
                console.log("[DeskAuto] Página de Chamados confirmada.");
                clearInterval(checkNavigation);
            }
        }, 3000);
    }

    function autoClickPlus() {
        // Se o modal já estiver aberto, não clicamos de novo
        if (document.querySelector("textarea[name='descricao']")) return;

        const btnPlus = document.querySelector(".btn-novo-chamado") || 
                       document.querySelector(".floating-button") || 
                       document.querySelector("button i.fa-plus")?.closest("button") ||
                       document.querySelector(".plus-button");

        if (btnPlus) {
            console.log("[DeskAuto] Clicando no botão '+'...");
            btnPlus.click();
        }
    }

    async function fillForm(data) {
        // Evitar preencher várias vezes o mesmo modal
        if (window.lastFilledAt && Date.now() - window.lastFilledAt < 2000) return;
        window.lastFilledAt = Date.now();

        console.log("[DeskAuto] Preenchendo campos do modal...");
        
        try {
            // 1. Assunto
            const subject = document.querySelector("input[name='assunto']") || 
                          document.querySelector("#assunto") ||
                          document.querySelector("[name*='assunto']");
            if (subject) {
                subject.value = data.subject;
                subject.dispatchEvent(new Event('input', { bubbles: true }));
                subject.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // 2. Descrição
            await fillDescription(data.description);

            // 3. Solicitante
            const requester = document.querySelector("select[name='solicitante']") || 
                             document.querySelector("input[name='solicitante']") ||
                             document.querySelector("#solicitante");
            
            if (requester) {
                requester.value = data.email;
                requester.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // 4. Categoria / Solicitação
            const categorySelect = document.querySelector("select[name='categoria']") || 
                                 document.querySelector("select[name='solicitacao']");
            if (categorySelect && data.category) {
                categorySelect.value = data.category;
                categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            console.log("[DeskAuto] Preenchimento disparado.");
            observeSaveButtons();

        } catch (e) {
            console.error("[DeskAuto] Falha no preenchimento:", e);
        }
    }

    async function fillDescription(text) {
        const tarea = document.querySelector("textarea[name='descricao']") || document.querySelector("#descricao");
        if (tarea) {
            tarea.value = text;
            tarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const iframe = document.querySelector('iframe.cke_wysiwyg_frame');
        if (iframe && iframe.contentDocument) {
            iframe.contentDocument.body.innerHTML = text.replace(/\n/g, '<br>');
        }
    }

    function observeSaveButtons() {
        const btns = document.querySelectorAll("button.btn-success, button.btn-primary");
        btns.forEach(btn => {
            if (btn.innerText.includes("Salvar") || btn.innerText.includes("Abrir")) {
                btn.addEventListener("click", () => {
                    localStorage.setItem(SAVE_PENDING_KEY, 'true');
                    console.log("[DeskAuto] Salvamento iniciado.");
                });
            }
        });
    }

    async function checkIfTicketWasSaved() {
        const pending = localStorage.getItem(SAVE_PENDING_KEY);
        if (!pending) return;

        const successNotice = document.querySelector(".toast-success") || 
                             document.querySelector(".alert-success") ||
                             document.body.innerText.includes("salvo com sucesso");

        if (successNotice) {
            console.log("[DeskAuto] Chamado salvo!");
            localStorage.removeItem(SAVE_PENDING_KEY);
            localStorage.removeItem(STORAGE_KEY);
            
            const num = await captureNumber();
            showPopup(num);
        }
    }

    async function captureNumber() {
        const el = document.querySelector(".toast-message") || 
                   document.querySelector(".breadcrumb .active") ||
                   document.querySelector("h1, h2");
        if (el) {
            const m = el.innerText.match(/\d+-\d+/) || el.innerText.match(/\d+/);
            return m ? m[0] : null;
        }
        return null;
    }

    function showPopup(num) {
        const d = document.createElement("div");
        d.id = "desk-auto-final";
        d.style = "position:fixed; bottom:100px; right:20px; z-index:999999; background:white; padding:15px; border-radius:10px; box-shadow:0 5px 20px rgba(0,0,0,0.4); border:2px solid #0078d4;";
        
        const title = num ? "🚀 Chamado Criado!" : "⚠️ Salvo!";
        const body = num ? `Número: <strong>${num}</strong>` : "Não consegui capturar o número.";
        const msg = `Seu chamado foi registrado com sucesso sob o número ${num}.`;

        d.innerHTML = `
            <div style="font-weight:bold; color:#0078d4;">${title}</div>
            <div style="margin:10px 0;">${body}</div>
            ${num ? `<button id="copy-btn-desk" style="width:100%; cursor:pointer;">Copiar Mensagem</button>` : ''}
            <button onclick="document.getElementById('desk-auto-final').remove()" style="margin-top:10px; width:100%; border:none; background:none; font-size:10px; cursor:pointer;">Fechar</button>
        `;
        document.body.appendChild(d);
        if(num) document.getElementById("copy-btn-desk").onclick = () => {
            navigator.clipboard.writeText(msg);
            alert("Mensagem copiada para retorno!");
        };
    }

    init();
})();
