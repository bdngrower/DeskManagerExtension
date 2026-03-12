// ==UserScript==
// @name         DeskManager Extension Automation
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Auto-fill DeskManager tickets from Outlook Add-in (brasinfo.desk.ms)
// @author       Antigravity
// @match        https://brasinfo.desk.ms/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const API_BASE_URL = "https://desk-manager-extension.vercel.app";
    const SAVE_PENDING_KEY = 'desk_save_pending';

    console.log("[DeskAuto] Módulo de automação carregado.");

    // 1. Verificar sucesso de salvamento anterior
    checkIfTicketWasSaved();

    // 2. Iniciar monitoramento de dados
    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('&')[1] || window.location.hash.replace('#', '?'));
        const draftId = urlParams.get('draftId') || hashParams.get('draftId');

        if (!draftId) {
            console.log("[DeskAuto] Nenhum draftId encontrado na URL. Automação inativa.");
            return;
        }

        console.log(`[DeskAuto] draftId detectado: ${draftId}. Buscando dados...`);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/draft?id=${draftId}`);
            if (!response.ok) throw new Error("Falha ao buscar draft da API.");
            
            const data = await response.json();
            console.log("[DeskAuto] Dados do chamado recuperados com sucesso!");

            // Iniciar fluxo de preenchimento
            startAutomationFlow(data);

        } catch (e) {
            console.error("[DeskAuto] Erro ao carregar dados:", e);
        }
    }

    function startAutomationFlow(data) {
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

        // Tentar clicar no botão "+" sozinho a cada 2 segundos se estivermos na página correta
        setInterval(() => {
            if (window.location.hash.includes("ChamadosSuporte")) {
                autoClickPlus();
            }
        }, 2000);
    }

    function autoNavigateToTickets() {
        const checkNavigation = setInterval(() => {
            if (window.location.hash.includes("Home") || !window.location.hash.includes("ChamadosSuporte")) {
                console.log("[DeskAuto] Fora da página de Chamados. Tentando navegar...");
                
                const menuItems = Array.from(document.querySelectorAll("a, span, li"));
                const targetMenu = menuItems.find(el => el.innerText.trim() === "Lista de Chamados" || 
                                                     el.innerText.trim() === "Chamados");
                
                if (targetMenu) {
                    console.log("[DeskAuto] Menu 'Lista de Chamados' encontrado. Clicando...");
                    targetMenu.click();
                } else {
                    const link = document.querySelector("a[href*='ChamadosSuporte']");
                    if (link) link.click();
                }
            } else {
                console.log("[DeskAuto] Página de Chamados confirmada.");
                clearInterval(checkNavigation);
            }
        }, 5000);
    }

    function autoClickPlus() {
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
        if (window.lastFilledAt && Date.now() - window.lastFilledAt < 3000) return;
        window.lastFilledAt = Date.now();

        console.log("[DeskAuto] Preenchendo campos do modal...");
        
        try {
            // 1. Assunto
            const subject = document.querySelector("input[name='assunto']") || 
                          document.querySelector("#assunto");
            if (subject) {
                subject.value = data.subject || "";
                subject.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // 2. Descrição
            await fillDescription(data.description);

            // 3. Solicitante / Cliente
            const requester = document.querySelector("input[name='solicitante']") || 
                             document.querySelector("#solicitante") ||
                             document.querySelector(".select2-search__field");
            if (requester) {
                requester.value = data.email || "";
                requester.dispatchEvent(new Event('input', { bubbles: true }));
                requester.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // 4. Mapeamento de Categoria
            const catSelect = document.querySelector("select[name='categoria']") || document.querySelector("select[name='solicitacao']");
            if (catSelect && data.category) {
                catSelect.value = data.category;
                catSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            console.log("[DeskAuto] Preenchimento disparado.");
            observeSaveButtons();

        } catch (e) {
            console.error("[DeskAuto] Erro no preenchimento:", e);
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
            localStorage.removeItem(SAVE_PENDING_KEY);
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
        d.style = "position:fixed; bottom:100px; right:20px; z-index:999999; background:white; padding:15px; border-radius:10px; box-shadow:0 5px 20px rgba(0,0,0,0.4); border:2px solid #0078d4; font-family: sans-serif;";
        
        const title = num ? "🚀 Chamado Criado!" : "⚠️ Salvo!";
        const body = num ? `Número: <strong>${num}</strong>` : "Não capturei o número.";
        const msg = `Seu chamado foi registrado com sucesso sob o número ${num}.`;

        d.innerHTML = `
            <div style="font-weight:bold; color:#0078d4;">${title}</div>
            <div style="margin:10px 0;">${body}</div>
            ${num ? `<button id="copy-btn-desk" style="width:100%; cursor:pointer;">Copiar Mensagem</button>` : ''}
            <button onclick="document.getElementById('desk-auto-final').remove()" style="margin-top:10px; width:100%; border:none; background:none; font-size:10px; cursor:pointer; color:#999;">Fechar</button>
        `;
        document.body.appendChild(d);
        if(num) document.getElementById("copy-btn-desk").onclick = () => {
            navigator.clipboard.writeText(msg);
            alert("Copiado!");
        };
    }

    init();
})();
