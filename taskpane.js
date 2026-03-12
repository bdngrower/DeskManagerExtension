/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global document, Office */

Office.onReady((info) => {
  if (info.host === Office.HostType.Outlook) {
    document.getElementById("btn-open-ticket").onclick = openTicket;
    loadEmailData();
  }
});

function loadEmailData() {
  const item = Office.context.mailbox.item;
  if (item) {
    document.getElementById("sender").innerText = item.from.displayName + " <" + item.from.emailAddress + ">";
    document.getElementById("subject").innerText = item.subject;
    document.getElementById("email-data").style.display = "block";
    document.getElementById("status-message").innerText = "Dados capturados com sucesso.";
  }
}

async function openTicket() {
  const item = Office.context.mailbox.item;
  
  // Captura o corpo do e-mail de forma assíncrona
  item.body.getAsync(Office.CoercionType.Html, async (result) => {
    if (result.status === Office.AsyncResultStatus.Succeeded) {
      const emailBody = result.value;
      
      const data = {
        sender: item.from.displayName,
        email: item.from.emailAddress,
        subject: item.subject,
        body: emailBody,
        dateTime: item.dateTimeCreated.toISOString(),
        id: item.itemId
      };

      // Simulação de envio via POST para a página auxiliar
      // Para o PoC, podemos usar um formulário oculto ou fetch se houver um backend
      console.log("Dados salvos e prontos para transferência:", data);
      
      // Recomendação: Salvar em SessionStorage e abrir a página auxiliar
      // Ou fazer o POST para um servidor intermediário
      sessionStorage.setItem("pendingTicket", JSON.stringify(data));
      
      // Abre a página auxiliar (que implementaremos na Fase 2)
      // window.open("https://localhost:3001/helper.html", "_blank");
      
      document.getElementById("status-message").innerText = "Preparando transferência...";
      
      // Como não temos a página auxiliar ainda, apenas alertamos
      alert("Fase 1 PoC: Dados capturados! Verifique o console do navegador.");
    }
  });
}
