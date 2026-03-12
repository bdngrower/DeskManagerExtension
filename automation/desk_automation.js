// ==UserScript==
// @name         DeskManager Extension Automation
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Auto-fill DeskManager tickets with cross-page persistence
// @author       Antigravity
// @match        https://brasinfo.desk.ms/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const API_BASE_URL = "https://desk-manager-extension.vercel.app";
    const SESSION_DRAFT_KEY = 'desk_auto_draft_id';
    const SAVE_PENDING_KEY = 'desk_save_pending';

    console.log("[DeskAuto] Módulo carregado com sucesso!");

    // Iniciar
    init();

    async function init() {
        // 1. Tentar capturar o draftId da URL ou do SessionStorage (para persistir entre redirecionamentos)
        const urlParams = new URLSearchParams(window.location.search);
        const hashPart = window.location.hash.includes('&') ? window.location.hash.split('&')[1] : window.location.hash.replace('#', '?');
        const hashParams = new URLSearchParams(hashPart);
        
        let draftId = urlParams.get('draftId') || hashParams.get('draftId');

        if (draftId) {
            console.log("[DeskAuto] DraftID encontrado na URL:", draftId);
            sessionStorage.setItem(SESSION_DRAFT_KEY, draftId);
        } else {
            draftId = sessionStorage.getItem(SESSION_DRAFT_KEY);
        }

        if (!draftId) {
            console.log("[DeskAuto] Nenhum draftId pendente.");
            return;
        }

        // Mostrar indicador visual de que a automação está AGUARDANDO
        showStatusIndicator("Buscando dados...");

        try {
            const response = await fetch(`${API_BASE_URL}/api/draft?id=${draftId}`);
            if (!response.ok) throw new Error("Draft expirado ou inválido.");
            
            const data = await response.json();
            showStatusIndicator(`Dados carregados: ${data.subject.substring(0, 20)}...`);

            // Iniciar fluxo
            startAutomation(data);

        } catch (e) {
            console.error("[DeskAuto] Erro:", e);
            showStatusIndicator("Erro ao carregar dados.", true);
        }
    }

    function startAutomation(data) {
        // 1. Navegação automática se necessário
        autoNavigate();

        // 2. Observer para o modal
        const obs = new MutationObserver(() => {
            const modal = document.querySelector(".modal-content") || document.querySelector(".panel-modal");
            const hasDesc = document.querySelector("textarea[name='descricao']") || document.querySelector(".cke_wysiwyg_frame");

            if (modal && hasDesc) {
                fillForm(data);
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });

        // 3. Clique automático no "+"
        setInterval(() => {
            if (window.location.hash.includes("ChamadosSuporte")) {
                const btn = document.querySelector(".btn-novo-chamado") || 
                            document.querySelector(".floating-button") || 
                            document.querySelector("button i.fa-plus")?.closest("button");
                if (btn && !document.querySelector("textarea[name='descricao']")) {
                    btn.click();
                }
            }
        }, 2000);
    }

    function autoNavigate() {
        setInterval(() => {
            if (window.location.hash.includes("Home") || !window.location.hash.includes("ChamadosSuporte")) {
                const menu = Array.from(document.querySelectorAll("a, span")).find(el => el.innerText.trim() === "Lista de Chamados");
                if (menu) menu.click();
            }
        }, 5000);
    }

    async function fillForm(data) {
        if (window.lastFill && Date.now() - window.lastFill < 3000) return;
        window.lastFill = Date.now();

        console.log("[DeskAuto] Preenchendo...");
        try {
            // Assunto
            const sub = document.querySelector("input[name='assunto']") || document.querySelector("#assunto");
            if (sub) {
                sub.value = data.subject;
                sub.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Descrição
            const tarea = document.querySelector("textarea[name='descricao']") || document.querySelector("#descricao");
            if (tarea) {
                tarea.value = data.description;
                tarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
            const iframe = document.querySelector('iframe.cke_wysiwyg_frame');
            if (iframe && iframe.contentDocument) {
                iframe.contentDocument.body.innerHTML = data.description.replace(/\n/g, '<br>');
            }

            // Solicitante
            const req = document.querySelector("input[name='solicitante']") || document.querySelector(".select2-search__field");
            if (req) {
                req.value = data.email;
                req.dispatchEvent(new Event('input', { bubbles: true }));
            }

            showStatusIndicator("✓ Pronto para Salvar!");
            
            // Monitorar botão salvar
            document.querySelectorAll("button").forEach(b => {
                if (b.innerText.includes("Salvar")) {
                    b.addEventListener("click", () => sessionStorage.setItem(SAVE_PENDING_KEY, 'true'));
                }
            });

        } catch (e) {
            console.error(e);
        }
    }

    function showStatusIndicator(text, isError = false) {
        let el = document.getElementById("desk-auto-status");
        if (!el) {
            el = document.createElement("div");
            el.id = "desk-auto-status";
            el.style = "position:fixed; top:10px; left:50%; transform:translateX(-50%); z-index:99999; padding:8px 20px; border-radius:30px; font-size:12px; font-weight:bold; box-shadow:0 2px 10px rgba(0,0,0,0.2); transition: all 0.3s;";
            document.body.appendChild(el);
        }
        el.innerText = "🤖 " + text;
        el.style.background = isError ? "#ff4d4d" : "#0078d4";
        el.style.color = "white";
        if (text.includes("✓")) {
            setTimeout(() => el.style.opacity = "0", 5000);
        }
    }

    function checkIfTicketWasSaved() {
        if (localStorage.getItem(SAVE_PENDING_KEY) || sessionStorage.getItem(SAVE_PENDING_KEY)) {
            if (document.body.innerText.includes("sucesso")) {
                 sessionStorage.removeItem(SAVE_PENDING_KEY);
                 sessionStorage.removeItem(SESSION_DRAFT_KEY);
                 alert("Chamado Criado com Sucesso!");
            }
        }
    }
})();
