const state = {
  apiUrl: localStorage.getItem('isi_api_url') || '',
  apiKey: localStorage.getItem('isi_api_key') || '',
  obras: [],
  selectedItem: null,
  itens: [],
  analiseItens: [],
  composicoesAnalise: [],
  timer: null
};

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  bindEvents();

  $('apiUrl').value = state.apiUrl;
  $('apiKey').value = state.apiKey;

  if (state.apiUrl) testApi(true);
});

function setupNavigation() {
  document.querySelectorAll('.nav').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav').forEach((x) => x.classList.remove('active'));
      button.classList.add('active');

      document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
      $(button.dataset.screen).classList.remove('hidden');

      const titles = {
        dashboard: ['Dashboard', 'Resumo do sistema e conexão com a API.'],
        bases: ['Bases CSV', 'Importe orçamento por obra e banco geral.'],
        nova: ['Nova Solicitação', 'Crie uma solicitação com vários insumos.'],
        analise: ['Análise', 'Alocação de novos insumos e aprovação/recusa em lote.'],
        solicitacoes: ['Solicitações', 'Consulte os IDs criados.'],
        config: ['Configuração', 'Conecte o frontend ao Apps Script.']
      };

      $('pageTitle').textContent = titles[button.dataset.screen][0];
      $('pageSubtitle').textContent = titles[button.dataset.screen][1];
    });
  });
}

function bindEvents() {
  $('btnSaveConfig').onclick = saveConfig;
  $('btnTestApi').onclick = () => testApi(false);
  $('btnSetupDb').onclick = setupDb;
  if ($('btnLimparCache')) $('btnLimparCache').onclick = limparCache;

  $('btnImportBanco').onclick = importBanco;
  $('btnImportOrcamento').onclick = importOrcamento;

  $('termoBusca').oninput = () => {
    clearTimeout(state.timer);
    state.timer = setTimeout(searchInsumos, 700);
  };

  $('obraSolicitacao').onchange = () => {
    $('termoBusca').value = '';
    $('searchResults').innerHTML = '';
    state.selectedItem = null;
    renderSelected();
  };

  $('btnAddItem').onclick = addItem;
  $('btnCriarSolicitacao').onclick = criarSolicitacao;
  $('btnLoadSolicitacoes').onclick = loadSolicitacoes;
  $('btnLoadAnalise').onclick = loadAnalise;
  $('btnProcessarAnalise').onclick = processarAnaliseBloco;
}

function saveConfig() {
  state.apiUrl = $('apiUrl').value.trim();
  state.apiKey = $('apiKey').value.trim();

  localStorage.setItem('isi_api_url', state.apiUrl);
  localStorage.setItem('isi_api_key', state.apiKey);

  toast('Configuração salva.', 'success');
}

async function testApi(silent) {
  try {
    ensure();

    const response = await api('inicializarApp', {});
    const data = response.data || {};

    state.obras = data.obras || [];
    populateObras();
    renderDashboardData(data.dashboard || {});

    $('connectionStatus').textContent = JSON.stringify(data, null, 2);

    if (!silent) toast('Conexão funcionando.', 'success');
  } catch (e) {
    $('connectionStatus').textContent = e.message;
    if (!silent) toast(e.message, 'error');
  }
}


async function limparCache() {
  try {
    const result = await api('limparCacheISI', {});
    $('connectionStatus').textContent = JSON.stringify(result, null, 2);
    toast('Cache limpo.', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function setupDb() {
  try {
    const result = await api('setupDatabase', {});
    $('connectionStatus').textContent = JSON.stringify(result, null, 2);
    await testApi(true);
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function dashboard() {
  const response = await api('getDashboardData', {});
  renderDashboardData(response.data || {});
}

function renderDashboardData(data) {
  $('statObras').textContent = data.obras ?? '-';
  $('statOrcamento').textContent = data.orcamentoAtivo ?? '-';
  $('statBanco').textContent = data.bancoGeral ?? '-';
  $('statSolicitacoes').textContent = data.solicitacoes ?? '-';
}

function populateObras() {
  const options = state.obras
    .map((o) => `<option value="${esc(o.idObra)}">${esc(o.nomeObra)} (${esc(o.idObra)})</option>`)
    .join('');

  ['obraImport', 'obraSolicitacao', 'obraAnalise'].forEach((id) => {
    const el = $(id);
    if (el) el.innerHTML = `<option value="">Todas</option>${options}`;
  });

  // Em telas onde obra é obrigatória, seleciona a primeira.
  if ($('obraImport') && state.obras[0]) $('obraImport').value = state.obras[0].idObra;
  if ($('obraSolicitacao') && state.obras[0]) $('obraSolicitacao').value = state.obras[0].idObra;
}

async function importBanco() {
  try {
    const file = $('bancoCsv').files[0];
    if (!file) throw new Error('Selecione o CSV do banco geral.');

    const csvContent = await readFile(file);
    const result = await api('importarBancoGeralInsumos', {
      nomeArquivo: file.name,
      csvContent
    });

    $('importLog').textContent = JSON.stringify(result, null, 2);
    await dashboard();
  } catch (e) {
    $('importLog').textContent = e.message;
    toast(e.message, 'error');
  }
}

async function importOrcamento() {
  try {
    const file = $('orcamentoCsv').files[0];
    const idObra = $('obraImport').value;

    if (!idObra) throw new Error('Selecione a obra.');
    if (!file) throw new Error('Selecione o CSV do orçamento.');

    const csvContent = await readFile(file);
    const result = await api('importarOrcamentoInformakon', {
      idObra,
      nomeArquivo: file.name,
      csvContent,
      manterAjustesLocais: $('manterAjustes').checked
    });

    $('importLog').textContent = JSON.stringify(result, null, 2);
    await dashboard();
  } catch (e) {
    $('importLog').textContent = e.message;
    toast(e.message, 'error');
  }
}

async function searchInsumos() {
  const termo = $('termoBusca').value.trim();
  const idObra = $('obraSolicitacao').value;

  if (termo.length < 3) {
    $('searchResults').innerHTML = '<div class="hint">Digite ao menos 3 caracteres.</div>';
    return;
  }

  try {
    $('searchResults').innerHTML = '<div class="hint">Buscando...</div>';

    const response = await api('buscarInsumos', { idObra, termo, limit: 30 });
    const results = response.data || [];

    if (!results.length) {
      $('searchResults').innerHTML = `
        <div class="result" data-new="1">
          <strong><span class="tag new">NOVO CADASTRO</span>${esc(termo.toUpperCase())}</strong>
          <span>Nenhum resultado encontrado.</span>
        </div>`;

      document.querySelector('[data-new]').onclick = () => {
        state.selectedItem = {
          origemInsumo: 'Novo Cadastro',
          idOrcamento: '',
          chaveOrcamento: '',
          codigoInsumo: 'NOVO CADASTRO',
          descricaoInsumo: termo.toUpperCase(),
          unidade: '',
          classificacao: 'A classificar',
          eap: '',
          itemOrcamentario: '',
          qtdOrcadaAtual: 0,
          qtdSolicitadaAtual: 0,
          saldoAtual: 0
        };
        renderSelected();
      };

      return;
    }

    $('searchResults').innerHTML = results.map((item, index) => {
      const fromBudget = item.origemInsumo === 'Orçamento da Obra';
      const tag = fromBudget ? 'budget' : 'bank';
      const detail = fromBudget
        ? `${item.eap || '-'} · ${item.itemOrcamentario || '-'} · Saldo: ${fmt(item.saldoAtual)} ${item.unidade || ''}`
        : `${item.classificacao || '-'} · Não previsto no orçamento`;

      return `
        <div class="result" data-index="${index}">
          <strong><span class="tag ${tag}">${esc(item.origemInsumo)}</span>${esc(item.codigoInsumo)} — ${esc(item.descricaoInsumo)}</strong>
          <span>${esc(detail)}</span>
        </div>`;
    }).join('');

    document.querySelectorAll('[data-index]').forEach((el) => {
      el.onclick = () => {
        state.selectedItem = results[Number(el.dataset.index)];
        renderSelected();
      };
    });
  } catch (e) {
    $('searchResults').innerHTML = `<div class="hint">${esc(e.message)}</div>`;
  }
}

function renderSelected() {
  if (!state.selectedItem) {
    $('selectedItemBox').className = 'selected empty';
    $('selectedItemBox').textContent = 'Nenhum item selecionado.';
    return;
  }

  const item = state.selectedItem;
  $('selectedItemBox').className = 'selected';
  $('selectedItemBox').innerHTML = `
    <strong>${esc(item.codigoInsumo)} — ${esc(item.descricaoInsumo)}</strong><br>
    Origem: ${esc(item.origemInsumo)}<br>
    Unidade: ${esc(item.unidade || '-')}<br>
    Classificação: ${esc(item.classificacao || '-')}<br>
    EAP/Item: ${esc(item.eap || '-')} · ${esc(item.itemOrcamentario || '-')}<br>
    Saldo atual: ${fmt(item.saldoAtual)} ${esc(item.unidade || '')}`;
}

function addItem() {
  if (!state.selectedItem) return toast('Selecione um insumo.', 'error');

  const quantity = Number($('qtdItem').value || 0);
  if (quantity <= 0) return toast('Informe a quantidade.', 'error');

  state.itens.push({
    ...state.selectedItem,
    qtdSolicitadaInclusao: quantity,
    motivoItem: $('motivoItem').value,
    observacaoSolicitante: $('obsItem').value
  });

  $('qtdItem').value = '';
  $('obsItem').value = '';

  state.selectedItem = null;
  renderSelected();
  renderItens();

  toast('Item adicionado.', 'success');
}

function renderItens() {
  const tbody = $('itensSolicitacao');

  if (!state.itens.length) {
    tbody.innerHTML = '<tr><td colspan="8">Nenhum item adicionado.</td></tr>';
    return;
  }

  tbody.innerHTML = state.itens.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${esc(item.origemInsumo)}</td>
      <td><strong>${esc(item.codigoInsumo)}</strong></td>
      <td>${esc(item.descricaoInsumo)}</td>
      <td>${esc(item.unidade || '')}</td>
      <td>${fmt(item.qtdSolicitadaInclusao)}</td>
      <td>${fmt(item.saldoAtual)}</td>
      <td><button class="btn-light" data-remove="${index}">Remover</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('[data-remove]').forEach((button) => {
    button.onclick = () => {
      state.itens.splice(Number(button.dataset.remove), 1);
      renderItens();
    };
  });
}

async function criarSolicitacao() {
  try {
    if (!state.itens.length) throw new Error('Adicione pelo menos um item.');

    const response = await api('criarSolicitacao', {
      idObra: $('obraSolicitacao').value,
      solicitanteNome: $('solicitanteNome').value,
      solicitanteEmail: $('solicitanteEmail').value,
      prioridade: $('prioridade').value,
      gestaoCiente: $('gestaoCiente').value,
      justificativaGeral: $('justificativaGeral').value,
      itens: state.itens
    });

    toast('Solicitação criada: ' + response.data.idSolicitacao, 'success');

    state.itens = [];
    renderItens();
    $('justificativaGeral').value = '';

    await dashboard();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function loadSolicitacoes() {
  try {
    const response = await api('listarSolicitacoesResumo', {});
    const rows = response.data || [];
    const tbody = $('solicitacoesTable');

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhuma solicitação.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td><strong>${esc(row.idSolicitacao)}</strong></td>
        <td>${esc(String(row.dataSolicitacao || ''))}</td>
        <td>${esc(row.idObra || '')}</td>
        <td>${esc(row.solicitanteNome || '')}</td>
        <td>${row.itens}</td>
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

    const response = await api('getDadosAnalise', payload);
    const data = response.data || {};

    state.analiseItens = data.itens || [];
    state.composicoesAnalise = data.composicoes || [];

    renderAnalise();
  } catch (e) {
    $('analiseTableGroups').innerHTML = `<div class="empty-line">${esc(e.message)}</div>`;
  }
}

function renderAnalise() {
  const box = $('analiseTableGroups');

  if (!state.analiseItens.length) {
    box.innerHTML = '<div class="empty-line">Nenhum item encontrado para os filtros selecionados.</div>';
    return;
  }

  const groups = groupAnalysisItems(state.analiseItens);
  const composicoesInfo = `<div class="composition-info">${state.composicoesAnalise.length} composição(ões) disponível(is) para alocação.</div>`;

  box.innerHTML = composicoesInfo + groups.map((group) => `
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
          <thead>
            <tr>
              <th>Decisão</th>
              <th>Orig.</th>
              <th>Código</th>
              <th>Insumo</th>
              <th>Alocação</th>
              <th>Unid.</th>
              <th>Qtd. orçada</th>
              <th>Qtd. solicitada</th>
              <th>Nova qtd. orçada</th>
              <th>Status</th>
              <th>Obs. análise</th>
            </tr>
          </thead>
          <tbody>
            ${group.items.map((item) => renderAnalysisRow(item)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');
}

function groupAnalysisItems(items) {
  const map = new Map();

  items.forEach((item, index) => {
    item.__index = index;

    const key = [
      item.idSolicitacao || '',
      item.eap || '',
      item.itemOrcamentario || 'Sem composição definida'
    ].join('|');

    if (!map.has(key)) {
      map.set(key, {
        key,
        idSolicitacao: item.idSolicitacao,
        idObra: item.idObra,
        nomeObra: item.nomeObra,
        solicitanteNome: item.solicitanteNome,
        eap: item.eap,
        itemOrcamentario: item.itemOrcamentario,
        items: []
      });
    }

    map.get(key).items.push(item);
  });

  return Array.from(map.values()).sort((a, b) => {
    const sol = String(a.idSolicitacao || '').localeCompare(String(b.idSolicitacao || ''));
    if (sol !== 0) return sol;
    return String(a.eap || '').localeCompare(String(b.eap || ''), 'pt-BR', { numeric: true });
  });
}

function renderAnalysisRow(item) {
  const idx = item.__index;
  const origem = origemAbrev(item.origemInsumo);
  const origemClass = origem === 'OO' ? 'origin-oo' : origem === 'BD' ? 'origin-bd' : 'origin-in';
  const qtdOrcada = Number(item.qtdOrcadaAtual || 0);
  const qtdSolicitada = Number(item.qtdSolicitadaInclusao || 0);
  const novaQtd = qtdOrcada + qtdSolicitada;
  const isFinal = ['Incluído no Informakon', 'Recusado', 'Compra solicitada'].includes(item.statusItem);
  const disabled = isFinal ? 'disabled' : '';

  return `
    <tr data-analysis-row="${idx}" class="${isFinal ? 'row-finalizada' : ''}">
      <td>
        <select id="decisao_${idx}" class="decision-select" ${disabled}>
          <option value="">-</option>
          <option value="aprovar">Aprovar</option>
          <option value="recusar">Recusar</option>
        </select>
      </td>
      <td><span class="origin ${origemClass}" title="${esc(item.origemInsumo || '')}">${origem}</span></td>
      <td><strong>${esc(item.codigoInsumo || '')}</strong></td>
      <td>
        ${esc(item.descricaoInsumo || '')}
        <small class="line-note">${esc(item.motivoItem || '')}${item.observacaoSolicitante ? ' · ' + esc(item.observacaoSolicitante) : ''}</small>
      </td>
      <td>${renderAlocacaoCell(item, idx, disabled)}</td>
      <td>${esc(item.unidade || '')}</td>
      <td>${fmt(qtdOrcada)}</td>
      <td><strong>${fmt(qtdSolicitada)}</strong></td>
      <td><strong>${fmt(novaQtd)}</strong></td>
      <td>${statusPill(item.statusItem)}</td>
      <td>
        <input id="obsAnalise_${idx}" class="analysis-obs" value="${esc(item.observacaoAnalise || '')}" placeholder="Obs." ${disabled} />
      </td>
    </tr>
  `;
}

function renderAlocacaoCell(item, idx, disabled) {
  const origem = origemAbrev(item.origemInsumo);

  if (origem === 'OO') {
    return `
      <div class="allocation-fixed">
        <strong>${esc(item.eap || '-')}</strong>
        <small>${esc(item.itemOrcamentario || 'Composição não informada')}</small>
        <input type="hidden" id="alocEap_${idx}" value="${esc(item.eap || '')}">
        <input type="hidden" id="alocItem_${idx}" value="${esc(item.itemOrcamentario || '')}">
      </div>
    `;
  }

  const compsDisponiveis = state.composicoesAnalise.filter((comp) => {
    return !item.idObra || !comp.idObra || String(comp.idObra) === String(item.idObra);
  });

  const compsParaSelect = compsDisponiveis.length ? compsDisponiveis : state.composicoesAnalise;

  const options = compsParaSelect.map((comp, compIndex) => {
    const realIndex = state.composicoesAnalise.indexOf(comp);
    const obraPrefix = comp.idObra && !item.idObra ? `[${esc(comp.idObra)}] ` : '';
    return `<option value="${realIndex}">${obraPrefix}${esc(comp.eap || '-')} - ${esc(comp.itemOrcamentario || '')}</option>`;
  }).join('');

  return `
    <div class="allocation-cell">
      <select id="alocSelect_${idx}" class="allocation-select" onchange="onAlocacaoChange(${idx})" ${disabled}>
        ${options ? '<option value="">Selecionar composição...</option>' : '<option value="">Nenhuma composição carregada</option>'}
        ${options}
        <option value="__nova__">+ Nova composição</option>
      </select>

      <div id="alocInputs_${idx}" class="allocation-inputs hidden">
        <input id="alocEap_${idx}" placeholder="EAP" ${disabled}>
        <input id="alocItem_${idx}" placeholder="Nome da composição" ${disabled}>
      </div>

      <small class="line-note">Obrigatório para aprovar BD/IN.</small>
    </div>
  `;
}

function onAlocacaoChange(idx) {
  const select = $(`alocSelect_${idx}`);
  const inputs = $(`alocInputs_${idx}`);
  const eapInput = $(`alocEap_${idx}`);
  const itemInput = $(`alocItem_${idx}`);

  if (!select || !inputs || !eapInput || !itemInput) return;

  if (select.value === '__nova__') {
    inputs.classList.remove('hidden');
    eapInput.value = '';
    itemInput.value = '';
    eapInput.focus();
    return;
  }

  if (select.value === '') {
    inputs.classList.add('hidden');
    eapInput.value = '';
    itemInput.value = '';
    return;
  }

  const comp = state.composicoesAnalise[Number(select.value)];

  if (comp) {
    eapInput.value = comp.eap || '';
    itemInput.value = comp.itemOrcamentario || '';
    inputs.classList.add('hidden');
  }
}
window.onAlocacaoChange = onAlocacaoChange;

function origemAbrev(origem) {
  const o = String(origem || '').toLowerCase();

  if (o.includes('orçamento') || o.includes('orcamento')) return 'OO';
  if (o.includes('banco')) return 'BD';
  if (o.includes('novo')) return 'IN';

  return '-';
}

function statusPill(status) {
  const s = status || 'Novo';
  let cls = 'status-novo';

  if (s === 'Aprovado') cls = 'status-aprovado';
  else if (s === 'Incluído no Informakon') cls = 'status-incluido';
  else if (s === 'Compra solicitada') cls = 'status-compra';
  else if (s === 'Recusado') cls = 'status-recusado';

  return `<span class="status-pill ${cls}">${esc(s)}</span>`;
}

async function processarAnaliseBloco() {
  if (!state.analiseItens.length) {
    return toast('Carregue os itens antes de confirmar decisões.', 'error');
  }

  const decisoes = [];

  for (const item of state.analiseItens) {
    const idx = item.__index;
    const select = $(`decisao_${idx}`);
    if (!select || !select.value) continue;

    const obs = $(`obsAnalise_${idx}`)?.value || '';
    const origem = origemAbrev(item.origemInsumo);
    const eapAlocado = $(`alocEap_${idx}`)?.value?.trim() || '';
    const itemOrcamentarioAlocado = $(`alocItem_${idx}`)?.value?.trim() || '';

    if (select.value === 'recusar' && !obs.trim()) {
      return toast('Informe observação para os itens recusados.', 'error');
    }

    if (select.value === 'aprovar' && origem !== 'OO') {
      if (!eapAlocado || !itemOrcamentarioAlocado) {
        return toast(`Informe a alocação em composição para o item ${item.codigoInsumo}.`, 'error');
      }
    }

    decisoes.push({
      idItem: item.idItem,
      decisao: select.value,
      qtdIncluida: Number(item.qtdSolicitadaInclusao || 0),
      observacaoAnalise: obs,
      eapAlocado,
      itemOrcamentarioAlocado
    });
  }

  if (!decisoes.length) {
    return toast('Nenhuma decisão marcada.', 'error');
  }

  const aprovar = decisoes.filter((d) => d.decisao === 'aprovar').length;
  const recusar = decisoes.filter((d) => d.decisao === 'recusar').length;

  const confirmar = confirm(`Confirmar análise em bloco?\n\nAprovar/Incluir: ${aprovar}\nRecusar: ${recusar}\n\nA aprovação atualizará o saldo local da obra. Itens BD/IN aprovados serão alocados nas composições informadas.`);
  if (!confirmar) return;

  const response = await api('processarAnaliseBloco', { decisoes });
  const data = response.data || {};

  aplicarResultadoAnaliseLocal(decisoes, data.resultados || []);

  toast(`Análise processada: ${data.aprovados || 0} aprovado(s), ${data.recusados || 0} recusado(s).`, 'success');
}

function aplicarResultadoAnaliseLocal(decisoes, resultados) {
  const sucessoPorId = {};
  (resultados || []).forEach((r) => {
    if (r.ok) sucessoPorId[r.idItem] = r;
  });

  decisoes.forEach((decisao) => {
    if (!sucessoPorId[decisao.idItem]) return;

    const item = state.analiseItens.find((i) => i.idItem === decisao.idItem);
    if (!item) return;

    if (decisao.decisao === 'aprovar') {
      item.statusItem = 'Incluído no Informakon';
      item.eap = decisao.eapAlocado || item.eap;
      item.itemOrcamentario = decisao.itemOrcamentarioAlocado || item.itemOrcamentario;
      item.observacaoAnalise = decisao.observacaoAnalise || item.observacaoAnalise;
    }

    if (decisao.decisao === 'recusar') {
      item.statusItem = 'Recusado';
      item.observacaoAnalise = decisao.observacaoAnalise || item.observacaoAnalise;
    }
  });

  renderAnalise();
}

function ensure() {
  if (!state.apiUrl) throw new Error('Configure a URL da API Apps Script.');
}

async function api(action, payload) {
  ensure();

  const jsonpActions = [
    'health',
    'inicializarApp',
    'getObras',
    'getDashboardData',
    'buscarInsumos',
    'listarSolicitacoesResumo',
    'listarSolicitacaoDetalhada',
    'listarItensAnalise',
    'getDadosAnalise',
    'listarComposicoesObra',
    'diagnosticarComposicoesObra',
    'diagnosticarBusca',
    'setupDatabase',
    'limparCacheISI'
  ];

  const message = loadingMessage(action);
  showLoading(message);

  try {
    const result = jsonpActions.includes(action)
      ? await apiJsonp(action, payload)
      : await apiPost(action, payload);

    hideLoading(successMessage(action));
    return result;
  } catch (e) {
    hideLoading(null, true, e.message);
    throw e;
  }
}

function apiJsonp(action, payload) {
  const callback = 'isi_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const url = new URL(state.apiUrl);

  url.searchParams.set('action', action);
  url.searchParams.set('apiKey', state.apiKey);
  url.searchParams.set('payload', JSON.stringify(payload || {}));
  url.searchParams.set('callback', callback);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo limite excedido ao chamar a API via JSONP. Verifique URL /exec, implantação e permissões.'));
    }, 60000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
    }

    window[callback] = (response) => {
      cleanup();

      if (!response || response.ok === false) {
        return reject(new Error(response?.error || 'Erro desconhecido na API.'));
      }

      resolve(response);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Falha ao carregar resposta da API. Confira a URL /exec e a implantação.'));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function apiPost(action, payload) {
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const iframeName = 'iframe_' + requestId;

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.style.display = 'none';

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = state.apiUrl;
    form.target = iframeName;
    form.style.display = 'none';

    const fields = {
      requestId,
      action,
      apiKey: state.apiKey,
      payload: JSON.stringify(payload || {})
    };

    Object.entries(fields).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo limite excedido ao chamar a API. Se isso ocorreu em importação, confira se o arquivo é muito grande ou se a implantação está pública.'));
    }, 120000);

    function cleanup() {
      window.removeEventListener('message', onMessage);
      iframe.remove();
      form.remove();
      clearTimeout(timer);
    }

    function onMessage(event) {
      const data = event.data || {};

      if (data.source !== 'ISI_APPS_SCRIPT_API' || data.requestId !== requestId) return;

      cleanup();

      const response = data.result;

      if (!response || response.ok === false) {
        return reject(new Error(response?.error || 'Erro desconhecido na API.'));
      }

      resolve(response);
    }

    window.addEventListener('message', onMessage);
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));

    reader.readAsText(file, 'ISO-8859-1');
  });
}

function loadingMessage(action) {
  const map = {
    health: 'Testando conexão com a API...',
    inicializarApp: 'Carregando dados iniciais...',
    getObras: 'Carregando obras...',
    getDashboardData: 'Atualizando dashboard...',
    setupDatabase: 'Configurando banco de dados...',
    limparCacheISI: 'Limpando cache...',
    importarBancoGeralInsumos: 'Importando banco geral de insumos...',
    importarOrcamentoInformakon: 'Importando orçamento da obra...',
    buscarInsumos: 'Consultando insumos no banco de dados...',
    criarSolicitacao: 'Enviando solicitação...',
    listarSolicitacoesResumo: 'Carregando solicitações...',
    listarItensAnalise: 'Carregando itens para análise...',
    getDadosAnalise: 'Carregando análise e composições...',
    listarSolicitacaoDetalhada: 'Carregando detalhes da solicitação...',
    diagnosticarBusca: 'Executando diagnóstico...',
    aprovarItem: 'Aprovando item...',
    recusarItem: 'Recusando item...',
    marcarIncluidoInformakon: 'Atualizando saldo local...',
    marcarCompraSolicitada: 'Registrando compra solicitada...'
  };

  return map[action] || 'Consultando banco de dados...';
}

function successMessage(action) {
  const map = {
    health: 'Conexão com API confirmada.',
    inicializarApp: 'Dados iniciais carregados.',
    setupDatabase: 'Banco configurado.',
    limparCacheISI: 'Cache limpo.',
    importarBancoGeralInsumos: 'Banco geral importado.',
    importarOrcamentoInformakon: 'Orçamento importado.',
    criarSolicitacao: 'Solicitação enviada.',
    listarSolicitacoesResumo: 'Solicitações carregadas.',
    listarItensAnalise: 'Itens carregados.',
    getDadosAnalise: 'Análise carregada.',
    aprovarItem: 'Item aprovado.',
    recusarItem: 'Item recusado.',
    marcarIncluidoInformakon: 'Item incluído no Informakon.',
    marcarCompraSolicitada: 'Compra registrada.'
  };

  return map[action] || '';
}

function showLoading(message) {
  window.__loadingCount = (window.__loadingCount || 0) + 1;

  const overlay = $('loadingOverlay');
  const title = $('loadingTitle');
  const subtitle = $('loadingSubtitle');

  if (title) title.textContent = message;
  if (subtitle) subtitle.textContent = 'Comando enviado. Aguardando resposta do Apps Script.';
  if (overlay) overlay.classList.remove('hidden');

  document.body.classList.add('busy');

  const el = $('toast');

  if (el) {
    el.className = '';
    el.textContent = message;
    el.classList.add('show', 'loading');
    clearTimeout(window.__toastTimer);
  }
}

function hideLoading(success, isError, errorMessage) {
  window.__loadingCount = Math.max(0, (window.__loadingCount || 0) - 1);

  if (window.__loadingCount === 0) {
    const overlay = $('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
    document.body.classList.remove('busy');
  }

  if (isError) {
    toast(errorMessage || 'Erro ao executar comando.', 'error');
  } else if (success) {
    toast(success, 'success');
  } else {
    const el = $('toast');
    if (el && el.classList.contains('loading')) {
      el.classList.remove('show', 'loading');
    }
  }
}

function fmt(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(message, type) {
  const el = $('toast');
  if (!el) return;

  el.className = '';
  el.textContent = message;
  el.classList.add('show');

  if (type) el.classList.add(type);

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.classList.remove('show', 'loading', 'success', 'error');
  }, 3600);
}
