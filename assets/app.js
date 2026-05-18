diff --git a/assets/app.js b/assets/app.js
index 7e321dc3d5783ca9ca78b336b195768a1bd27d0d..157bb03e9f6b2dc45f27816314e780eef99e7143 100644
--- a/assets/app.js
+++ b/assets/app.js
@@ -365,63 +365,107 @@ async function loadSolicitacoes() {
         <td>${esc(row.statusGeral || '')}</td>
         <td>${(row.resumoItens || []).map(esc).join('<br>')}</td>
       </tr>
     `).join('');
   } catch (e) {
     $('solicitacoesTable').innerHTML = `<tr><td colspan="7">${esc(e.message)}</td></tr>`;
   }
 }
 
 async function loadAnalise() {
   try {
     const idObra = $('obraAnalise').value;
     const status = $('statusAnalise').value;
     const payload = {};
 
     if (idObra) payload.idObra = idObra;
 
     if (status === 'pendentes') {
       payload.modo = 'pendentes';
     } else if (status) {
       payload.statusItem = status;
     }
 
     if (idObra) {
       const compsResponse = await api('listarComposicoesObra', { idObra });
-      state.composicoesAnalise = compsResponse.data || [];
+      state.composicoesAnalise = (compsResponse.data || [])
+        .map(normalizeComposicao)
+        .filter(Boolean);
     } else {
       state.composicoesAnalise = [];
     }
 
     const response = await api('listarItensAnalise', payload);
     state.analiseItens = response.data || [];
+
+    if (idObra && !state.composicoesAnalise.length) {
+      state.composicoesAnalise = composicoesFromItensOO(state.analiseItens);
+    }
+
     renderAnalise();
   } catch (e) {
     $('analiseTableGroups').innerHTML = `<div class="empty-line">${esc(e.message)}</div>`;
   }
 }
 
+
+function normalizeComposicao(comp) {
+  if (!comp || typeof comp !== 'object') return null;
+
+  const eap = String(comp.eap ?? comp.EAP ?? '').trim();
+  const itemOrcamentario = String(comp.itemOrcamentario ?? comp.ITEM_ORCAMENTARIO ?? comp.item_orcamentario ?? '').trim();
+
+  if (!eap && !itemOrcamentario) return null;
+
+  return {
+    eap,
+    itemOrcamentario
+  };
+}
+
+function composicoesFromItensOO(items) {
+  const map = new Map();
+
+  (items || []).forEach((item) => {
+    if (origemAbrev(item.origemInsumo) !== 'OO') return;
+
+    const eap = String(item.eap || '').trim();
+    const itemOrcamentario = String(item.itemOrcamentario || '').trim();
+
+    if (!eap && !itemOrcamentario) return;
+
+    const key = `${eap}|${itemOrcamentario}`;
+    if (!map.has(key)) {
+      map.set(key, { eap, itemOrcamentario });
+    }
+  });
+
+  return Array.from(map.values()).sort((a, b) =>
+    String(a.eap || '').localeCompare(String(b.eap || ''), 'pt-BR', { numeric: true })
+  );
+}
+
 function renderAnalise() {
   const box = $('analiseTableGroups');
 
   if (!state.analiseItens.length) {
     box.innerHTML = '<div class="empty-line">Nenhum item encontrado para os filtros selecionados.</div>';
     return;
   }
 
   const groups = groupAnalysisItems(state.analiseItens);
 
   box.innerHTML = groups.map((group) => `
     <div class="composition-block">
       <div class="composition-header">
         <div>
           <strong>${esc(group.eap || '-')} · ${esc(group.itemOrcamentario || 'Sem composição definida')}</strong>
           <small>
             Solicitação: ${esc(group.idSolicitacao)} · Obra: ${esc(group.nomeObra || group.idObra || '-')} ·
             Solicitante: ${esc(group.solicitanteNome || '-')}
           </small>
         </div>
         <span class="composition-count">${group.items.length} ${group.items.length === 1 ? 'item' : 'itens'}</span>
       </div>
 
       <div class="table-wrap">
         <table class="analysis-table">
