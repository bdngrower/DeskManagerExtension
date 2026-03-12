// ==UserScript==
// @name         DeskManager Extension Automation
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Auto-fill DeskManager tickets via Cloud Fetch (No URL params needed)
// @author       Antigravity
// @match        https://brasinfo.desk.ms/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const API_URL_LATEST = "https://desk-manager-extension.vercel.app/api/latest";
    const SESSION_DONE_KEY = 'desk_auto_filled_id'; // Para não preencher 2x o mesmo
    const SAVE_PENDING_KEY = 'desk_save_pending';

    console.log("[DeskAuto] Módulo v1.4 Ativo. Buscando chamado pendente na nuvem...");

    // Iniciar
    init();

    async function init() {
        showStatusIndicator("Buscando chamado recente...");

        try {
            // Busca o último chamado criado no Vercel/Redis
            const response = await fetch(API_URL_LATEST);
            
            if (response.status === 404 || response.status === 410) {
                console.log("[DeskAuto] Nenhum chamado recente pendente para automação.");
                hideStatusIndicator();
                return;
            }

            if (!response.ok) throw new Error("Erro na API.");

            const data = await response.json();
            
            // Verificar se já preenchemos este chamado nesta sessão (evitar loop)
            if (sessionStorage.getItem(SESSION_DONE_KEY) === data.draftId) {
                console.log("[DeskAuto] Chamado já processado.");
                hideStatusIndicator();
                return;
            }

            console.log("[DeskAuto] Chamado detectado:", data.subject);
            showStatusIndicator(`Chamado Detectado: ${data.subject.substring(0, 15)}...`);

            // Iniciar automação
            startAutomationFlow(data);

        } catch (e) {
            console.error("[DeskAuto] Falha ao sincronizar:", e);
            showStatusIndicator("Erro de Sincronia ❌", true);
        }
    }

    function startAutomationFlow(data) {
        // 1. Garantir que estamos na página de Chamados
        autoNavigate();

        // 2. Vigiar o Modal
        const observer = new MutationObserver(() => {
            const hasForm = document.querySelector("textarea[name='descricao']") || 
                            document.querySelector(".cke_wysiwyg_frame") ||
                            document.querySelector("#descricao");
            if (hasForm) fillForm(data);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // 3. Tentar abrir o modal automaticamente
        setInterval(() => {
            if (window.location.hash.includes("ChamadosSuporte") || window.location.hash.includes("Ticket")) {
                const btnPlus = document.querySelector(".btn-novo-chamado") || 
                               document.querySelector(".floating-button") || 
                               document.querySelector("button i.fa-plus")?.closest("button");
                
                if (btnPlus && !document.querySelector("textarea[name='descricao']")) {
                    console.log("[DeskAuto] Clicando no '+'...");
                    btnPlus.click();
                }
            }
        }, 3000);
    }

    function autoNavigate() {
        setInterval(() => {
            if (window.location.hash.includes("Home") || window.location.hash === "" || window.location.hash === "#") {
                console.log("[DeskAuto] Saindo da Home...");
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
            const req = document.querySelector("input[name='solicitante']") || document.querySelector(".select2-search__field") || document.querySelector("#solicitante");
            if (req) {
                req.value = data.email;
                req.dispatchEvent(new Event('input', { bubbles: true }));
                req.dispatchEvent(new Event('change', { bubbles: true }));
            }

            showStatusIndicator("✓ Preenchido!");
            sessionStorage.setItem(SESSION_DONE_KEY, data.draftId);
            
            // Monitorar salvamento
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
            el.style = "position:fixed; top:15px; left:50%; transform:translateX(-50%); z-index:999999; padding:10px 30px; border-radius:30px; font-family:sans-serif; font-size:14px; font-weight:bold; box-shadow:0 10px 30px rgba(0,0,0,0.4); pointer-events:none; transition: all 0.5s;";
            document.body.appendChild(el);
        }
        el.innerText = "🤖 " + text;
        el.style.background = isError ? "#f44336" : "#2196F3";
        el.style.color = "white";
        el.style.opacity = "1";
    }

    function hideStatusIndicator() {
        const el = document.getElementById("desk-auto-status");
        if (el) el.style.opacity = "0";
    }

    // Detecção de salvamento
    if (sessionStorage.getItem(SAVE_PENDING_KEY) && document.body.innerText.includes("sucesso")) {
        sessionStorage.removeItem(SAVE_PENDING_KEY);
        alert("Chamado Criado com Sucesso! ✅");
    }
})();
