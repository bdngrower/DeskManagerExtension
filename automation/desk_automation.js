// ==UserScript==
// @name         DeskManager Extension Automation
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Auto-fill DeskManager tickets via secure handshake
// @author       Antigravity
// @match        https://brasinfo.desk.ms/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const API_BASE_URL = "https://desk-manager-extension.vercel.app";
    const HELPER_ORIGIN = "https://desk-manager-extension.vercel.app";
    const SESSION_DRAFT_KEY = 'desk_auto_draft_id';
    const SAVE_PENDING_KEY = 'desk_save_pending';

    console.log("[DeskAuto] Módulo carregado. Modo: Handshake.");

    // Iniciar
    init();

    async function init() {
        // 1. Tentar capturar o draftId do SessionStorage primeiro
        let draftId = sessionStorage.getItem(SESSION_DRAFT_KEY);

        if (!draftId) {
            console.log("[DeskAuto] Aguardando dados da Helper Page...");
            
            // Tentar avisar a página de origem que estamos prontos para receber o ID
            if (window.opener) {
                window.opener.postMessage("DESK_AUTO_READY", HELPER_ORIGIN);
            }

            // Escutar a resposta com o ID
            window.addEventListener("message", (event) => {
                if (event.origin !== HELPER_ORIGIN) return;
                if (event.data && event.data.type === "SET_DRAFT_ID") {
                    console.log("[DeskAuto] DraftID recebido via Handshake:", event.data.draftId);
                    sessionStorage.setItem(SESSION_DRAFT_KEY, event.data.draftId);
                    location.reload(); // Recarregar para processar com o ID salvo
                }
            });
            return;
        }

        console.log("[DeskAuto] Processando DraftID:", draftId);
        showStatusIndicator("Buscando dados na nuvem...");

        // 2. Buscar dados da API
        try {
            const response = await fetch(`${API_BASE_URL}/api/draft?id=${draftId}`);
            if (!response.ok) throw new Error("Draft não encontrado.");
            
            const data = await response.json();
            showStatusIndicator(`Dados carregados: ${data.subject.substring(0, 15)}...`);
            
            // 3. Iniciar automação
            startAutomation(data);

        } catch (e) {
            console.error("[DeskAuto] Erro na API:", e);
            showStatusIndicator("Erro de conexão.", true);
        }
    }

    function startAutomation(data) {
        // Monitorar redirecionamento indesejado para Home
        autoNavigate();

        // Monitorar abertura do modal
        const obs = new MutationObserver(() => {
            const hasForm = document.querySelector("textarea[name='descricao']") || document.querySelector(".cke_wysiwyg_frame");
            if (hasForm) fillForm(data);
        });
        obs.observe(document.body, { childList: true, subtree: true });

        // Tentar clicar no "+" a cada 3 segundos
        setInterval(() => {
            if (window.location.hash.includes("ChamadosSuporte")) {
                const btn = document.querySelector(".btn-novo-chamado") || 
                            document.querySelector(".floating-button") || 
                            document.querySelector("button i.fa-plus")?.closest("button");
                if (btn && !document.querySelector("textarea[name='descricao']")) {
                    console.log("[DeskAuto] Abrindo formulário...");
                    btn.click();
                }
            }
        }, 3000);
    }

    function autoNavigate() {
        setInterval(() => {
            if (window.location.hash.includes("Home")) {
                console.log("[DeskAuto] Redirecionando para Chamados...");
                const menu = Array.from(document.querySelectorAll("a, span, li")).find(el => el.innerText.trim() === "Lista de Chamados");
                if (menu) menu.click();
            }
        }, 5000);
    }

    async function fillForm(data) {
        if (window.lastFill && Date.now() - window.lastFill < 3000) return;
        window.lastFill = Date.now();

        console.log("[DeskAuto] Preenchendo campos...");
        try {
            // Assunto
            const sub = document.querySelector("input[name='assunto']") || document.querySelector("#assunto");
            if (sub) {
                sub.value = data.subject;
                sub.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Descrição (HTML ou Texto)
            const tarea = document.querySelector("textarea[name='descricao']") || document.querySelector("#descricao");
            if (tarea) {
                tarea.value = data.description;
                tarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
            const iframe = document.querySelector('iframe.cke_wysiwyg_frame');
            if (iframe && iframe.contentDocument) {
                iframe.contentDocument.body.innerHTML = (data.bodyHtml || data.description).replace(/\n/g, '<br>');
            }

            // Solicitante
            const req = document.querySelector("input[name='solicitante']") || document.querySelector(".select2-search__field");
            if (req) {
                req.value = data.email;
                req.dispatchEvent(new Event('input', { bubbles: true }));
            }

            showStatusIndicator("✓ Preenchido! Verifique e Salve.");
            
            // Monitorar botão salvar para limpar tudo
            document.querySelectorAll("button").forEach(b => {
                if (b.innerText.includes("Salvar")) {
                    b.addEventListener("click", () => {
                        sessionStorage.setItem(SAVE_PENDING_KEY, 'true');
                    });
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
            el.style = "position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:999999; padding:10px 25px; border-radius:30px; font-family:sans-serif; font-size:13px; font-weight:bold; box-shadow:0 4px 15px rgba(0,0,0,0.3);";
            document.body.appendChild(el);
        }
        el.innerText = "🤖 " + text;
        el.style.background = isError ? "#f44336" : "#2196F3";
        el.style.color = "white";
        if (text.includes("✓")) setTimeout(() => el.style.opacity = "0", 6000);
    }

    // Detecção de salvamento
    if (sessionStorage.getItem(SAVE_PENDING_KEY) && document.body.innerText.includes("sucesso")) {
        sessionStorage.removeItem(SAVE_PENDING_KEY);
        sessionStorage.removeItem(SESSION_DRAFT_KEY);
        alert("Chamado Criado!");
    }
})();
