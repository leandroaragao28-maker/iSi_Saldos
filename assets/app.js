const state = {
  apiUrl: localStorage.getItem('isi_api_url') || '',
  apiKey: localStorage.getItem('isi_api_key') || '',
  obras: [],
  selectedItem: null,
  itens: [],
  analiseItens: [],
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
        analise: ['Análise', 'Aprove, recuse, marque inclusão e compra por item.'],
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
    const health = await api('health', {});
    const obrasResponse = await api('getObras', {});

    state.obras = obrasResponse.data || [];
    populateObras();
    await dashboard();

    $('connectionStatus').textContent = JSON.stringify({ api: health, obras: state.obras }, null, 2);

    if (!silent) toast('Conexão funcionando.', 'success');
  } catch (e) {
    $('connectionStatus').textContent = e.message;
    if (!silent) toast(e.message, 'error');
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
  const data = response.data || {};

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
    await loadSolicitacoes();
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

    const response = await api('listarItensAnalise', payload);
    state.analiseItens = response.data || [];
    renderAnalise();
  } catch (e) {
    $('analiseCards').innerHTML = `<div class="empty-line">${esc(e.message)}</div>`;
  }
}

function renderAnalise() {
  const box = $('analiseCards');

  if (!state.analiseItens.length) {
    box.innerHTML = '<div class="empty-line">Nenhum item encontrado para os filtros selecionados.</div>';
    return;
  }

  box.innerHTML = state.analiseItens.map((item, index) => {
    const approvedDefault = item.qtdAprovada > 0 ? item.qtdAprovada : item.qtdSolicitadaInclusao;

    return `
      <div class="analysis-card" data-card="${index}">
        <div class="analysis-top">
          <div class="analysis-title">
            <strong>${esc(item.codigoInsumo)} — ${esc(item.descricaoInsumo)}</strong>
            <small>
              Solicitação: ${esc(item.idSolicitacao)} · Item: ${esc(item.idItem)}<br>
              ${esc(item.nomeObra)} · Solicitante: ${esc(item.solicitanteNome || '-')}
            </small>
          </div>
          ${statusPill(item.statusItem)}
        </div>

        <div class="analysis-meta">
          <div class="meta-box"><span>Origem</span><strong>${esc(item.origemInsumo || '-')}</strong></div>
          <div class="meta-box"><span>EAP / Item</span><strong>${esc(item.eap || '-')} · ${esc(item.itemOrcamentario || '-')}</strong></div>
          <div class="meta-box"><span>Saldo atual</span><strong>${fmt(item.saldoAtual)} ${esc(item.unidade || '')}</strong></div>
          <div class="meta-box"><span>Qtd. solicitada</span><strong>${fmt(item.qtdSolicitadaInclusao)} ${esc(item.unidade || '')}</strong></div>
          <div class="meta-box"><span>Qtd. orçada</span><strong>${fmt(item.qtdOrcadaAtual)}</strong></div>
          <div class="meta-box"><span>Qtd. já solicitada</span><strong>${fmt(item.qtdSolicitadaAtual)}</strong></div>
          <div class="meta-box"><span>Classificação</span><strong>${esc(item.classificacao || '-')}</strong></div>
          <div class="meta-box"><span>Motivo</span><strong>${esc(item.motivoItem || '-')}</strong></div>
        </div>

        <div class="selected">
          <strong>Observação do solicitante</strong><br>
          ${esc(item.observacaoSolicitante || '-')}
        </div>

        <div class="analysis-actions">
          <div class="field">
            <label>Qtd. aprovada / incluída</label>
            <input id="qtdAprovada_${index}" type="number" min="0" step="0.0001" value="${Number(approvedDefault || 0)}" />
          </div>
          <div class="field">
            <label>Observação da análise</label>
            <input id="obsAnalise_${index}" value="${esc(item.observacaoAnalise || '')}" placeholder="Justificativa, ajuste ou recusa" />
          </div>
        </div>

        <div class="analysis-actions">
          <div class="field">
            <label>Nº solicitação compra</label>
            <input id="numCompra_${index}" value="${esc(item.numeroSolicitacaoCompra || '')}" placeholder="Opcional" />
          </div>
          <div class="analysis-buttons">
            <button class="btn-primary" onclick="aprovarAnalise(${index})">Aprovar</button>
            <button class="btn-danger" onclick="recusarAnalise(${index})">Recusar</button>
            <button class="btn-blue" onclick="incluirInformakon(${index})">Marcar incluído no Informakon</button>
            <button class="btn-secondary" onclick="marcarCompra(${index})">Compra solicitada</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
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

async function aprovarAnalise(index) {
  const item = state.analiseItens[index];
  const qtd = Number($(`qtdAprovada_${index}`).value || 0);
  const obs = $(`obsAnalise_${index}`).value;

  if (qtd <= 0) return toast('Informe a quantidade aprovada.', 'error');

  await api('aprovarItem', {
    idItem: item.idItem,
    qtdAprovada: qtd,
    observacaoAnalise: obs
  });

  await loadAnalise();
  await dashboard();
}

async function recusarAnalise(index) {
  const item = state.analiseItens[index];
  const obs = $(`obsAnalise_${index}`).value || 'Recusado na análise.';

  await api('recusarItem', {
    idItem: item.idItem,
    observacaoAnalise: obs
  });

  await loadAnalise();
  await dashboard();
}

async function incluirInformakon(index) {
  const item = state.analiseItens[index];
  const qtd = Number($(`qtdAprovada_${index}`).value || 0);
  const obs = $(`obsAnalise_${index}`).value;

  if (qtd <= 0) return toast('Informe a quantidade incluída.', 'error');

  await api('marcarIncluidoInformakon', {
    idItem: item.idItem,
    qtdIncluida: qtd,
    observacao: obs
  });

  await loadAnalise();
  await dashboard();
}

async function marcarCompra(index) {
  const item = state.analiseItens[index];
  const numero = $(`numCompra_${index}`).value;

  await api('marcarCompraSolicitada', {
    idItem: item.idItem,
    numeroSolicitacaoCompra: numero
  });

  await loadAnalise();
  await dashboard();
}

function ensure() {
  if (!state.apiUrl) throw new Error('Configure a URL da API Apps Script.');
}

async function api(action, payload) {
  ensure();

  const jsonpActions = [
    'health',
    'getObras',
    'getDashboardData',
    'buscarInsumos',
    'listarSolicitacoesResumo',
    'listarSolicitacaoDetalhada',
    'listarItensAnalise',
    'diagnosticarBusca',
    'setupDatabase'
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
    getObras: 'Carregando obras...',
    getDashboardData: 'Atualizando dashboard...',
    setupDatabase: 'Configurando banco de dados...',
    importarBancoGeralInsumos: 'Importando banco geral de insumos...',
    importarOrcamentoInformakon: 'Importando orçamento da obra...',
    buscarInsumos: 'Consultando insumos no banco de dados...',
    criarSolicitacao: 'Enviando solicitação...',
    listarSolicitacoesResumo: 'Carregando solicitações...',
    listarItensAnalise: 'Carregando itens para análise...',
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
    setupDatabase: 'Banco configurado.',
    importarBancoGeralInsumos: 'Banco geral importado.',
    importarOrcamentoInformakon: 'Orçamento importado.',
    criarSolicitacao: 'Solicitação enviada.',
    listarSolicitacoesResumo: 'Solicitações carregadas.',
    listarItensAnalise: 'Itens carregados.',
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
