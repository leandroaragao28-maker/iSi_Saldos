/* =================================================================
   ISI · Frontend integrado ao Apps Script
   Base visual adaptada do protótipo Cloud.
   ================================================================= */

(function () {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORE = {
    apiUrl: 'isi_api_url',
    apiKey: 'isi_api_key'
  };

  const state = {
    screen: 'analise',
    apiUrl: localStorage.getItem(STORE.apiUrl) || '',
    apiKey: localStorage.getItem(STORE.apiKey) || '',

    obras: [],
    dashboard: {},
    solicitacoes: [],
    itensAnalise: [],
    composicoes: [],
    buscaResultados: [],

    obraFiltro: '',
    statusFiltro: 'pendentes',
    composicaoFiltro: '',
    decisoes: {},
    expandidos: {},

    selecionado: null,
    carrinho: [],
    termoBusca: '',
    obraSolicitacao: '',
    solicitanteNome: '',
    solicitanteEmail: '',
    prioridade: 'Normal',
    gestaoCiente: 'Sim',
    justificativaGeral: '',

    busy: false,
    timerBusca: null
  };

  const NAV = [
    { id: 'dashboard',     ic: 'dashboard', label: 'Dashboard' },
    { id: 'bases',         ic: 'database',  label: 'Bases CSV' },
    { id: 'nova',          ic: 'plus',      label: 'Nova Solicitação' },
    { id: 'analise',       ic: 'search',    label: 'Análise' },
    { id: 'solicitacoes',  ic: 'list',      label: 'Solicitações' },
    { id: 'config',        ic: 'settings',  label: 'Configuração' }
  ];

  // ===============================================================
  // Helpers
  // ===============================================================
  const esc = v => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const fmtNum = (n, casas = 0) => {
    if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '–';
    const v = Number(n);
    return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: Math.max(casas, 2) });
  };

  const fmtDate = value => {
    if (!value) return '–';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  };

  const fmtDateTime = value => {
    if (!value) return '–';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const origemCode = origem => {
    const o = String(origem || '').toLowerCase();
    if (o.includes('orçamento') || o.includes('orcamento')) return 'oo';
    if (o.includes('banco')) return 'bd';
    return 'in';
  };

  const origemLabel = origem => {
    const code = origemCode(origem);
    if (code === 'oo') return 'Orçamento da Obra';
    if (code === 'bd') return 'Banco Geral';
    return 'Insumo Novo';
  };

  const obraById = id => state.obras.find(o => o.idObra === id) || {};
  const obraLabel = id => obraById(id).nomeObra || id || '–';
  const obraShort = id => (obraLabel(id).split('—')[0] || id || '').trim();

  function setBusy(on, title = 'Processando...', body = 'Comando enviado ao Apps Script.') {
    state.busy = on;
    document.body.classList.toggle('is-busy', on);

    if (on) {
      toast({ kind: 'info', title, body, ttl: 1200 });
    }
  }

  function updateFooter() {
    const conn = $('#connStatus');
    if (conn) {
      conn.textContent = state.apiUrl ? 'Online' : 'Offline';
      conn.classList.toggle('offline', !state.apiUrl);
    }

    const obra = $('#obraStatus');
    if (obra) {
      const id = state.obraFiltro || state.obraSolicitacao || state.obras[0]?.idObra || '';
      obra.textContent = id ? `${id} · ${obraShort(id)}` : 'Sem obra selecionada';
    }
  }

  // ===============================================================
  // API transport — Apps Script via form + iframe + postMessage
  // ===============================================================
  function ensureApi() {
    if (!state.apiUrl) throw new Error('Configure a URL /exec da API na tela Configuração.');
  }

  async function api(action, payload = {}, opts = {}) {
    ensureApi();

    const title = opts.title || loadingTitle(action);
    setBusy(true, title);

    try {
      const result = await apiPost(action, payload, opts.timeout || 180000);
      if (!result || result.ok === false) throw new Error(result?.error || 'Erro desconhecido na API.');
      return result;
    } catch (err) {
      toast({ kind: 'error', title: 'Erro na API', body: err.message, ttl: 7000 });
      throw err;
    } finally {
      setBusy(false);
    }
  }

  function loadingTitle(action) {
    const map = {
      inicializarApp: 'Carregando dados iniciais...',
      getDashboardData: 'Atualizando dashboard...',
      getDadosAnalise: 'Carregando análise...',
      processarAnaliseBloco: 'Registrando decisões...',
      buscarInsumos: 'Buscando insumos...',
      criarSolicitacao: 'Enviando solicitação...',
      listarSolicitacoesResumo: 'Carregando solicitações...',
      importarBancoGeralInsumos: 'Importando banco geral...',
      importarOrcamentoInformakon: 'Importando orçamento...',
      setupDatabase: 'Configurando banco...',
      limparCacheISI: 'Limpando cache...'
    };
    return map[action] || 'Consultando banco de dados...';
  }

  function apiPost(action, payload, timeoutMs) {
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const iframeName = 'isi_iframe_' + requestId;

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

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        iframe.remove();
        form.remove();
        clearTimeout(timer);
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Tempo limite excedido ao chamar a API.'));
      }, timeoutMs);

      function onMessage(event) {
        const data = event.data || {};
        if (!data || data.source !== 'ISI_APPS_SCRIPT_API' || data.requestId !== requestId) return;

        cleanup();
        resolve(data.result);
      }

      window.addEventListener('message', onMessage);
      document.body.appendChild(iframe);
      document.body.appendChild(form);
      form.submit();
    });
  }

  // ===============================================================
  // Bootstrap
  // ===============================================================
  document.addEventListener('DOMContentLoaded', () => {
    render();

    if (state.apiUrl) {
      inicializarApp(true);
    } else {
      toast({ kind: 'warn', title: 'API não configurada', body: 'Informe a URL /exec em Configuração.' });
    }
  });

  async function inicializarApp(silent = false) {
    try {
      const res = await api('inicializarApp', {}, { title: 'Inicializando sistema...' });
      const data = res.data || {};
      state.obras = data.obras || [];
      state.dashboard = data.dashboard || {};
      if (!state.obraSolicitacao && state.obras[0]) state.obraSolicitacao = state.obras[0].idObra;
      if (!state.obraFiltro && state.obras[0]) state.obraFiltro = state.obras[0].idObra;
      updateFooter();
      render();
      if (!silent) toast({ kind: 'success', title: 'Conexão funcionando', body: `${state.obras.length} obra(s) carregada(s).` });
    } catch (err) {
      updateFooter();
      if (!silent) toast({ kind: 'error', title: 'Falha na conexão', body: err.message });
    }
  }

  // ===============================================================
  // Shell
  // ===============================================================
  function renderRail() {
    const rail = $('#rail');
    rail.innerHTML = `
      <div class="rail-brand">
        <div class="rail-logo">iSi</div>
        <div class="rail-brand-text">
          <strong>iSi</strong>
          <span>Saldos de Insumos</span>
        </div>
      </div>

      <div class="rail-section">Operação</div>
      <nav class="rail-nav">
        ${NAV.slice(0, 5).map(n => `
          <button class="rail-nav-item ${state.screen === n.id ? 'active' : ''}" data-go="${n.id}">
            ${icon(n.ic, 16)}
            <span>${n.label}</span>
            ${n.id === 'analise' && countPendentes() ? `<span class="badge">${countPendentes()}</span>` : ''}
          </button>
        `).join('')}
      </nav>

      <div class="rail-section">Sistema</div>
      <nav class="rail-nav">
        <button class="rail-nav-item ${state.screen === 'config' ? 'active' : ''}" data-go="config">
          ${icon('settings', 16)}
          <span>Configuração</span>
        </button>
      </nav>

      <div class="rail-foot">
        <div class="rail-avatar">IS</div>
        <div class="rail-foot-info">
          <strong>Controle de Custos</strong>
          <span>${state.apiUrl ? 'API conectada' : 'API pendente'}</span>
        </div>
      </div>
    `;
    rail.addEventListener('click', e => {
      const btn = e.target.closest('[data-go]');
      if (btn) goTo(btn.dataset.go);
    });
  }

  function countPendentes() {
    return state.dashboard?.pendentes || state.itensAnalise.filter(i => !['Incluído no Informakon', 'Recusado', 'Compra solicitada'].includes(i.statusItem)).length || 0;
  }

  function renderBottomTabs() {
    const tabs = $('#bottomTabs');
    const items = NAV.filter(n => ['dashboard', 'nova', 'analise', 'solicitacoes', 'config'].includes(n.id));
    tabs.innerHTML = items.map(n => `
      <button class="bottom-tab ${state.screen === n.id ? 'active' : ''}" data-go="${n.id}">
        ${icon(n.ic, 20)}
        <span>${n.label.split(' ')[0]}</span>
        ${n.id === 'analise' && countPendentes() ? `<span class="badge-mini">${countPendentes()}</span>` : ''}
      </button>
    `).join('');
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-go]');
      if (btn) goTo(btn.dataset.go);
    });
  }

  function renderTopbar() {
    const cur = NAV.find(n => n.id === state.screen) || { label: 'iSi' };
    $('#crumbs').innerHTML = `
      <strong>${cur.label}</strong>
      <span class="sep">/</span>
      <span>iSi · Saldos de Insumos</span>
    `;
  }

  function goTo(id) {
    state.screen = id;
    render();
    window.scrollTo(0, 0);
    const main = $('.main');
    if (main) main.scrollTo(0, 0);
  }

  function render() {
    renderRail();
    renderBottomTabs();
    renderTopbar();
    updateFooter();
    const main = $('#main');
    main.innerHTML = '';
    main.appendChild(buildScreen(state.screen));
  }

  function renderInScreen() {
    const main = $('#main');
    main.innerHTML = '';
    main.appendChild(buildScreen(state.screen));
    updateFooter();
  }

  function buildScreen(id) {
    switch (id) {
      case 'dashboard':    return renderDashboard();
      case 'bases':        return renderBases();
      case 'nova':         return renderNova();
      case 'analise':      return renderAnalise();
      case 'solicitacoes': return renderSolicitacoes();
      case 'config':       return renderConfig();
      default:             return renderAnalise();
    }
  }

  // ===============================================================
  // Dashboard
  // ===============================================================
  function renderDashboard() {
    const d = state.dashboard || {};
    const el = document.createElement('section');
    el.className = 'screen';
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Resumo geral do sistema · dados do Google Sheets</p>
        </div>
        <div class="page-head-actions">
          <button class="btn btn-secondary">${icon('refresh', 14)} Atualizar</button>
          <button class="btn btn-primary" id="dashNova">${icon('plus', 14)} Nova solicitação</button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="accent"></div>
          <span class="lbl">Obras cadastradas</span>
          <span class="val">${fmtNum(d.obras || state.obras.length)}</span>
          <span class="delta">bases vinculadas ao sistema</span>
        </div>
        <div class="stat-card">
          <div class="accent"></div>
          <span class="lbl">Orçamento ativo</span>
          <span class="val">${fmtNum(d.orcamentoAtivo || 0)}</span>
          <span class="delta">linhas ativas importadas</span>
        </div>
        <div class="stat-card warn">
          <div class="accent"></div>
          <span class="lbl">Banco geral</span>
          <span class="val">${fmtNum(d.bancoGeral || 0)}</span>
          <span class="delta">insumos cadastrados</span>
        </div>
        <div class="stat-card bad">
          <div class="accent"></div>
          <span class="lbl">Solicitações</span>
          <span class="val">${fmtNum(d.solicitacoes || 0)}</span>
          <span class="delta">${fmtNum(d.itens || 0)} itens registrados</span>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h3>Obras ativas</h3>
            <div class="sub">Lista carregada da aba OBRAS</div>
          </div>
          <button class="btn btn-secondary btn-sm" id="reloadDashboard">${icon('refresh', 12)} Atualizar</button>
        </div>
        <div class="card-body flush">
          <table class="tbl">
            <thead><tr>
              <th>Obra</th>
              <th>Centro de custo</th>
              <th>Gestor</th>
              <th>Status</th>
            </tr></thead>
            <tbody>
              ${state.obras.length ? state.obras.map(o => `
                <tr>
                  <td><strong class="desc">${esc(o.nomeObra)}</strong><small class="desc-sub">${esc(o.idObra)}</small></td>
                  <td class="mono tight">${esc(o.centroCusto || '–')}</td>
                  <td class="tight">${esc(o.gestor || '–')}</td>
                  <td><span class="badge b-approved">${esc(o.status || 'Ativa')}</span></td>
                </tr>
              `).join('') : `
                <tr><td colspan="4"><div class="empty-state"><h4>Nenhuma obra carregada</h4><p>Configure a API e rode o setupDatabase.</p></div></td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    el.querySelector('#dashNova')?.addEventListener('click', () => goTo('nova'));
    el.querySelector('#reloadDashboard')?.addEventListener('click', async () => {
      const res = await api('getDashboardData', {});
      state.dashboard = res.data || {};
      renderInScreen();
    });

    return el;
  }

  // ===============================================================
  // Análise
  // ===============================================================
  function renderAnalise() {
    const el = document.createElement('section');
    el.className = 'screen';

    const itens = filtrarItensAnalise();
    const grupos = agruparItensPorComposicao(itens);
    const counts = contarDecisoes();

    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Análise em bloco</h1>
          <p>${itens.length} ${itens.length === 1 ? 'item' : 'itens'} ${state.statusFiltro === 'pendentes' ? 'pendentes de análise' : 'na visão atual'} · agrupados por composição</p>
        </div>
        <div class="page-head-actions">
          <button class="btn btn-ghost btn-sm" id="exportAnalise">${icon('download', 14)} Exportar visão</button>
          <button class="btn btn-secondary btn-sm" id="reloadAnalise">${icon('refresh', 14)} Carregar dados</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="field">
          <label>Obra</label>
          <select class="select" id="fObra">
            <option value="">Todas</option>
            ${state.obras.map(o => `<option value="${esc(o.idObra)}" ${state.obraFiltro === o.idObra ? 'selected' : ''}>${esc(o.nomeObra)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Status</label>
          <select class="select" id="fStatus">
            <option value="pendentes" ${state.statusFiltro === 'pendentes' ? 'selected' : ''}>Pendentes de análise</option>
            <option value="" ${state.statusFiltro === '' ? 'selected' : ''}>Todos</option>
            <option value="Novo" ${state.statusFiltro === 'Novo' ? 'selected' : ''}>Novos</option>
            <option value="Incluído no Informakon" ${state.statusFiltro === 'Incluído no Informakon' ? 'selected' : ''}>Aprovados</option>
            <option value="Recusado" ${state.statusFiltro === 'Recusado' ? 'selected' : ''}>Recusados</option>
          </select>
        </div>
        <div class="field">
          <label>Composição</label>
          <select class="select" id="fComp">
            <option value="">Todas</option>
            ${Object.keys(grupos).map(k => `<option value="${esc(k)}" ${state.composicaoFiltro === k ? 'selected' : ''}>${esc(grupos[k].label)}</option>`).join('')}
          </select>
        </div>
        <span class="grow"></span>
        <div class="muted" style="font-size: var(--t-xs)">Aprovar = incluído no Informakon · BD/IN exigem alocação</div>
      </div>

      <div class="card" style="padding:0">
        ${counts.total > 0 ? renderBulkBar(counts) : ''}
        <div class="table-scroll">
          <table class="tbl tbl-mobile-cards" id="tblAnalise">
            <thead>
              <tr>
                <th style="width:30px"></th>
                <th>Insumo / Solicitação</th>
                <th class="num" style="width:88px">Saldo</th>
                <th class="num" style="width:88px">Solicitado</th>
                <th class="num" style="width:88px">Aprovar</th>
                <th class="num" style="width:88px">Novo saldo</th>
                <th style="width:220px">Alocação</th>
                <th style="width:170px;text-align:center">Decisão</th>
                <th style="width:30px"></th>
              </tr>
            </thead>
            <tbody id="analiseTbody">
              ${renderAnaliseRows(grupos)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    el.querySelector('#fObra').addEventListener('change', e => {
      state.obraFiltro = e.target.value;
      state.composicaoFiltro = '';
      renderInScreen();
    });
    el.querySelector('#fStatus').addEventListener('change', e => {
      state.statusFiltro = e.target.value;
      state.composicaoFiltro = '';
      renderInScreen();
    });
    el.querySelector('#fComp').addEventListener('change', e => {
      state.composicaoFiltro = e.target.value;
      renderInScreen();
    });
    el.querySelector('#reloadAnalise').addEventListener('click', carregarAnalise);
    el.querySelector('#exportAnalise').addEventListener('click', exportarAnaliseCsv);

    bindAnaliseRowEvents(el);
    bindBulkBarEvents(el);

    return el;
  }

  async function carregarAnalise() {
    try {
      const payload = {};
      if (state.obraFiltro) payload.idObra = state.obraFiltro;
      if (state.statusFiltro === 'pendentes') payload.modo = 'pendentes';
      else if (state.statusFiltro) payload.statusItem = state.statusFiltro;

      const res = await api('getDadosAnalise', payload, { title: 'Carregando análise...' });
      const data = res.data || {};
      state.itensAnalise = data.itens || [];
      state.composicoes = data.composicoes || [];
      state.decisoes = {};
      toast({ kind: 'success', title: 'Análise carregada', body: `${state.itensAnalise.length} item(ns).` });
      renderInScreen();
    } catch (err) {
      // api já mostra toast
    }
  }

  function filtrarItensAnalise() {
    return (state.itensAnalise || []).filter(i => {
      if (state.obraFiltro && i.idObra !== state.obraFiltro) return false;
      if (state.statusFiltro === 'pendentes') {
        if (['Compra solicitada', 'Recusado', 'Incluído no Informakon'].includes(i.statusItem)) return false;
      } else if (state.statusFiltro && i.statusItem !== state.statusFiltro) return false;
      if (state.composicaoFiltro) {
        const key = `${i.idObra}|${i.eap || 'A_DEFINIR'}|${i.itemOrcamentario || 'Itens sem alocação · BD/IN'}`;
        if (key !== state.composicaoFiltro) return false;
      }
      return true;
    });
  }

  function agruparItensPorComposicao(itens) {
    const grupos = {};
    itens.forEach(it => {
      const tipo = origemCode(it.origemInsumo);
      const eap = it.eap || 'A_DEFINIR';
      const item = it.itemOrcamentario || 'Itens sem alocação · BD/IN';
      const key = `${it.idObra}|${eap}|${item}`;
      if (!grupos[key]) {
        grupos[key] = {
          key,
          idObra: it.idObra,
          obraNome: obraShort(it.idObra),
          eap,
          itemOrcamentario: item,
          label: (eap !== 'A_DEFINIR' ? eap + ' — ' : '') + item,
          itens: [],
          precisaAlocar: false
        };
      }
      grupos[key].itens.push(it);
      if (tipo !== 'oo') grupos[key].precisaAlocar = true;
    });
    return grupos;
  }

  function contarDecisoes() {
    let aprov = 0, recus = 0, alocPend = 0;
    Object.entries(state.decisoes).forEach(([id, dec]) => {
      const item = state.itensAnalise.find(i => i.idItem === id);
      if (!item || !dec) return;
      if (dec.tipo === 'aprovar') {
        aprov++;
        const tipo = origemCode(item.origemInsumo);
        if (tipo !== 'oo' && (!dec.eap || !dec.item)) alocPend++;
      } else if (dec.tipo === 'recusar') recus++;
    });
    return { aprovados: aprov, recusados: recus, total: aprov + recus, alocPendentes: alocPend };
  }

  function renderBulkBar(counts) {
    return `
      <div class="bulk-bar" id="bulkBar">
        <div class="summary">
          <span class="seg">${icon('check', 14)} <span class="num">${counts.aprovados}</span> aprovar</span>
          <span class="seg" style="color:rgba(255,255,255,0.6)">${icon('x', 14)} <span class="num">${counts.recusados}</span> recusar</span>
          ${counts.alocPendentes > 0 ? `<span class="seg" style="color:var(--st-pending-bg)">${icon('alert', 14)} ${counts.alocPendentes} sem alocação</span>` : ''}
        </div>
        <span class="grow"></span>
        <button class="btn btn-secondary btn-sm" id="bulkClear">Limpar marcações</button>
        <button class="btn btn-primary btn-sm" id="bulkConfirm" ${counts.alocPendentes > 0 ? 'disabled' : ''}>
          Confirmar ${counts.total} ${counts.total === 1 ? 'decisão' : 'decisões'}
        </button>
      </div>
    `;
  }

  function renderAnaliseRows(grupos) {
    const keys = Object.keys(grupos);
    if (!keys.length) {
      return `
        <tr><td colspan="9">
          <div class="empty-state">
            <div class="ic-big">${icon('search', 22)}</div>
            <h4>Nenhum item para análise</h4>
            <p>Clique em “Carregar dados” ou ajuste os filtros.</p>
          </div>
        </td></tr>
      `;
    }

    return keys.map(key => {
      const g = grupos[key];
      const collapsed = state.expandidos[key] === false;
      return `
        <tr class="group-head ${collapsed ? 'collapsed' : ''}" data-group="${esc(key)}">
          <td colspan="9">
            <span class="ctx">
              ${icon('chevronD', 14, 'chev')}
              <strong>${esc(g.obraNome)}</strong>
              <span class="muted">·</span>
              ${g.eap === 'A_DEFINIR'
                ? `<span class="badge b-pending">${icon('alert', 11)} Sem alocação</span>`
                : `<span class="mono">${esc(g.eap)}</span><span class="muted">— ${esc(g.itemOrcamentario)}</span>`
              }
              <span class="meta">${g.itens.length} ${g.itens.length === 1 ? 'item' : 'itens'}${countGroupDec(g.itens)}</span>
            </span>
          </td>
        </tr>
        ${collapsed ? '' : g.itens.map(renderItemRow).join('')}
      `;
    }).join('');
  }

  function countGroupDec(itens) {
    const arr = itens.map(i => state.decisoes[i.idItem]?.tipo).filter(Boolean);
    if (!arr.length) return '';
    const a = arr.filter(x => x === 'aprovar').length;
    const r = arr.filter(x => x === 'recusar').length;
    return ` · ${a} aprovar · ${r} recusar`;
  }

  function renderItemRow(it) {
    const tipo = origemCode(it.origemInsumo);
    const dec = state.decisoes[it.idItem] || {};
    const decClass = dec.tipo === 'aprovar' ? 'dec-approved' : dec.tipo === 'recusar' ? 'dec-rejected' : '';
    const qtdAprovar = dec.qtd ?? it.qtdSolicitadaInclusao;
    const novoSaldo = Number(it.saldoAtual || 0) + (dec.tipo === 'aprovar' ? Number(qtdAprovar || 0) : 0);
    const precisaAlocar = tipo !== 'oo' && (!dec.eap || !dec.item);
    const comps = composicoesDaObra(it.idObra);

    return `
      <tr data-id="${esc(it.idItem)}" class="${decClass}">
        <td data-lbl=""><span class="origem-tag ${tipo}">${tipo.toUpperCase()}</span></td>
        <td data-lbl="Insumo">
          <div class="desc">
            <span class="mono" style="color:var(--fg-muted);font-size:var(--t-xs);margin-right:6px">${esc(it.codigoInsumo)}</span>
            ${esc(it.descricaoInsumo)}
          </div>
          <small class="desc-sub">
            ${esc(it.idSolicitacao)} · ${esc(it.solicitanteNome || '–')} ·
            <span class="prio ${(it.prioridade || 'normal').toLowerCase()}">${esc(it.prioridade || 'Normal')}</span> ·
            ${esc(it.motivoItem || '')}
          </small>
        </td>
        <td class="num" data-lbl="Saldo">${fmtNum(it.saldoAtual)} <small class="muted" style="font-size:10px">${esc(it.unidade || '')}</small></td>
        <td class="num" data-lbl="Solicitado">${fmtNum(it.qtdSolicitadaInclusao)}</td>
        <td class="num" data-lbl="Aprovar">
          <input class="cell-input" type="number" min="0" step="0.0001"
                 value="${esc(qtdAprovar)}"
                 data-act="qtd" data-id="${esc(it.idItem)}"
                 ${dec.tipo === 'recusar' ? 'disabled' : ''}>
        </td>
        <td class="num" data-lbl="Novo">${fmtNum(novoSaldo)}</td>
        <td data-lbl="Alocação">
          ${tipo === 'oo'
            ? `<span class="mono" style="font-size:11px;color:var(--fg-muted)">${esc(it.eap || '–')}</span>`
            : `<select class="alloc-select ${precisaAlocar && dec.tipo === 'aprovar' ? 'alert' : ''}" data-act="aloc" data-id="${esc(it.idItem)}">
                 <option value="">${precisaAlocar ? '⚠ Escolher composição...' : 'Escolher composição...'}</option>
                 ${comps.map(c => `
                   <option value="${esc(c.eap)}::${esc(c.itemOrcamentario)}" ${dec.eap === c.eap && dec.item === c.itemOrcamentario ? 'selected' : ''}>
                     ${esc(c.eap)} — ${esc(c.itemOrcamentario)}
                   </option>`).join('')}
                 <option value="__nova__">+ Nova composição</option>
               </select>`
          }
        </td>
        <td data-lbl="Decisão" style="text-align:center">
          <div class="dec-picker">
            <button class="${dec.tipo === 'aprovar' ? 'on-approve' : ''}" data-act="aprovar" data-id="${esc(it.idItem)}">
              ${icon('check', 12)} Aprovar
            </button>
            <button class="${dec.tipo === 'recusar' ? 'on-reject' : ''}" data-act="recusar" data-id="${esc(it.idItem)}">
              ${icon('x', 12)} Recusar
            </button>
          </div>
        </td>
        <td data-lbl="">
          <button class="btn btn-ghost btn-icon btn-sm" data-act="obs" data-id="${esc(it.idItem)}" title="Observação">
            ${icon(it.observacaoSolicitante || it.observacaoAnalise ? 'fileText' : 'edit', 14)}
          </button>
        </td>
      </tr>
    `;
  }

  function composicoesDaObra(idObra) {
    const map = {};
    (state.composicoes || []).forEach(c => {
      if (idObra && c.idObra && c.idObra !== idObra) return;
      const key = `${c.idObra || idObra}|${c.eap}|${c.itemOrcamentario}`;
      if (c.eap || c.itemOrcamentario) map[key] = { ...c, idObra: c.idObra || idObra };
    });

    (state.itensAnalise || []).forEach(i => {
      if (i.idObra !== idObra) return;
      if (!i.eap && !i.itemOrcamentario) return;
      const key = `${i.idObra}|${i.eap}|${i.itemOrcamentario}`;
      if (!map[key]) map[key] = { idObra: i.idObra, eap: i.eap, itemOrcamentario: i.itemOrcamentario };
    });

    return Object.values(map).sort((a, b) => String(a.eap || '').localeCompare(String(b.eap || ''), 'pt-BR', { numeric: true }));
  }

  function bindAnaliseRowEvents(el) {
    const tbody = $('#analiseTbody', el);
    if (!tbody) return;

    tbody.addEventListener('click', e => {
      const head = e.target.closest('.group-head');
      if (head) {
        const k = head.dataset.group;
        state.expandidos[k] = state.expandidos[k] === false ? true : false;
        renderInScreen();
        return;
      }

      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const dec = state.decisoes[id] || {};
      const item = state.itensAnalise.find(i => i.idItem === id);
      if (!item) return;

      if (act === 'aprovar') {
        state.decisoes[id] = dec.tipo === 'aprovar'
          ? null
          : { tipo: 'aprovar', qtd: dec.qtd ?? item.qtdSolicitadaInclusao, eap: dec.eap || '', item: dec.item || '' };
        if (state.decisoes[id] === null) delete state.decisoes[id];
        renderInScreen();
      } else if (act === 'recusar') {
        state.decisoes[id] = dec.tipo === 'recusar' ? null : { tipo: 'recusar', obs: dec.obs || '' };
        if (state.decisoes[id] === null) delete state.decisoes[id];
        renderInScreen();
      } else if (act === 'obs') {
        const atual = dec.obs || item.observacaoAnalise || item.observacaoSolicitante || '';
        const txt = prompt('Observação da análise:', atual);
        if (txt !== null) {
          state.decisoes[id] = { ...dec, obs: txt, tipo: dec.tipo || '' };
          renderInScreen();
        }
      }
    });

    tbody.addEventListener('change', e => {
      const sel = e.target.closest('[data-act="aloc"]');
      if (sel) {
        const id = sel.dataset.id;
        const item = state.itensAnalise.find(i => i.idItem === id);
        if (!item) return;
        if (sel.value === '__nova__') {
          const eap = prompt('Nova composição — EAP (ex: 1.2.3):', '');
          if (!eap) { sel.value = ''; return; }
          const itemNome = prompt('Nome da composição:', '');
          if (!itemNome) { sel.value = ''; return; }

          const dec = state.decisoes[id] || { tipo: 'aprovar', qtd: item.qtdSolicitadaInclusao };
          dec.tipo = 'aprovar';
          dec.eap = eap;
          dec.item = itemNome;
          state.decisoes[id] = dec;
          state.composicoes.push({ idObra: item.idObra, eap, itemOrcamentario: itemNome });
          renderInScreen();
        } else if (sel.value) {
          const [eap, itemNome] = sel.value.split('::');
          const dec = state.decisoes[id] || { tipo: 'aprovar', qtd: item.qtdSolicitadaInclusao };
          dec.tipo = 'aprovar';
          dec.eap = eap;
          dec.item = itemNome;
          state.decisoes[id] = dec;
          renderInScreen();
        }
      }

      const qtdInput = e.target.closest('[data-act="qtd"]');
      if (qtdInput) {
        const id = qtdInput.dataset.id;
        const dec = state.decisoes[id];
        if (dec) dec.qtd = Number(qtdInput.value);
        renderInScreen();
      }
    });
  }

  function bindBulkBarEvents(el) {
    const clear = $('#bulkClear', el);
    if (clear) clear.addEventListener('click', () => {
      state.decisoes = {};
      renderInScreen();
      toast({ kind: 'info', title: 'Marcações limpas' });
    });

    const confirm = $('#bulkConfirm', el);
    if (confirm) confirm.addEventListener('click', async () => {
      const counts = contarDecisoes();
      if (!counts.total) return;

      const decisoes = Object.entries(state.decisoes)
        .filter(([, dec]) => dec && dec.tipo)
        .map(([idItem, dec]) => ({
          idItem,
          decisao: dec.tipo,
          qtdIncluida: Number(dec.qtd || 0),
          observacaoAnalise: dec.obs || '',
          eapAlocado: dec.eap || '',
          itemOrcamentarioAlocado: dec.item || ''
        }));

      const ok = confirmDialog(`Confirmar ${counts.total} decisão(ões)?\n\nAprovar/Incluir: ${counts.aprovados}\nRecusar: ${counts.recusados}\n\nA aprovação atualizará o saldo local.`);
      if (!ok) return;

      try {
        const res = await api('processarAnaliseBloco', { decisoes }, { title: 'Registrando decisões em lote...' });
        const data = res.data || {};
        const idsAprovados = new Set(decisoes.filter(d => d.decisao === 'aprovar').map(d => d.idItem));
        const idsRecusados = new Set(decisoes.filter(d => d.decisao === 'recusar').map(d => d.idItem));

        state.itensAnalise = state.itensAnalise.map(i => {
          if (idsAprovados.has(i.idItem)) {
            const d = decisoes.find(x => x.idItem === i.idItem);
            return { ...i, statusItem: 'Incluído no Informakon', eap: d.eapAlocado || i.eap, itemOrcamentario: d.itemOrcamentarioAlocado || i.itemOrcamentario };
          }
          if (idsRecusados.has(i.idItem)) return { ...i, statusItem: 'Recusado' };
          return i;
        });

        state.decisoes = {};
        toast({
          kind: 'success',
          title: `${data.aprovados ?? counts.aprovados} aprovado(s) · ${data.recusados ?? counts.recusados} recusado(s)`,
          body: 'Decisões registradas no banco.'
        });
        renderInScreen();
      } catch (err) {
        // api já mostra erro
      }
    });
  }

  function confirmDialog(message) {
    return window.confirm(message);
  }

  function exportarAnaliseCsv() {
    const rows = filtrarItensAnalise().map(i => ({
      idItem: i.idItem,
      idSolicitacao: i.idSolicitacao,
      obra: obraLabel(i.idObra),
      origem: origemCode(i.origemInsumo).toUpperCase(),
      codigo: i.codigoInsumo,
      descricao: i.descricaoInsumo,
      eap: i.eap || '',
      composicao: i.itemOrcamentario || '',
      saldo: i.saldoAtual,
      solicitado: i.qtdSolicitadaInclusao,
      status: i.statusItem
    }));
    downloadCsv('analise_isi.csv', rows);
  }

  // ===============================================================
  // Nova Solicitação
  // ===============================================================
  function renderNova() {
    const el = document.createElement('section');
    el.className = 'screen';

    const total = state.carrinho.reduce((s, i) => s + Number(i.qtd || 0), 0);

    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Nova solicitação</h1>
          <p>Um bloco pode conter vários insumos · ${state.carrinho.length} ${state.carrinho.length === 1 ? 'item' : 'itens'} no rascunho</p>
        </div>
        <div class="page-head-actions">
          <button class="btn btn-secondary btn-sm" id="clearCart">${icon('trash', 14)} Limpar rascunho</button>
          <button class="btn btn-primary btn-sm" ${state.carrinho.length === 0 ? 'disabled' : ''} id="btnEnviarSol">
            ${icon('check', 14)} Enviar solicitação
          </button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="field">
          <label>Obra</label>
          <select class="select" id="obraSolic">
            ${state.obras.map(o => `<option value="${esc(o.idObra)}" ${state.obraSolicitacao === o.idObra ? 'selected' : ''}>${esc(o.nomeObra)}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="min-width:260px">
          <label>Solicitante</label>
          <input class="input" id="solicitanteNome" value="${esc(state.solicitanteNome)}" placeholder="Nome do solicitante">
        </div>
        <div class="field" style="min-width:260px">
          <label>E-mail</label>
          <input class="input" id="solicitanteEmail" value="${esc(state.solicitanteEmail)}" placeholder="email@empresa.com">
        </div>
        <div class="field">
          <label>Prioridade</label>
          <select class="select" id="prioridadeSolic">
            ${['Normal','Alta','Urgente'].map(p => `<option ${state.prioridade === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="split-grid">
        <div class="card">
          <div class="card-head">
            <div><h3>Buscar insumo</h3><div class="sub">Consulta orçamento da obra e banco geral</div></div>
          </div>
          <div class="card-body">
            <div class="field full">
              <label>Termo</label>
              <div class="searchbox">
                ${icon('search', 16)}
                <input class="input" id="termoBusca" value="${esc(state.termoBusca)}" placeholder="Digite ao menos 3 caracteres">
              </div>
            </div>
            <div class="result-list" id="resultList">
              ${renderBuscaResultados()}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div><h3>Item selecionado</h3><div class="sub">Informe quantidade e motivo</div></div></div>
          <div class="card-body">
            ${renderSelectedBox()}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h3>Itens do bloco</h3>
            <div class="sub">${state.carrinho.length} item(ns) · quantidade total informada: ${fmtNum(total, 2)}</div>
          </div>
        </div>
        <div class="card-body flush">
          <table class="tbl tbl-mobile-cards">
            <thead><tr>
              <th>Origem</th><th>Insumo</th><th class="num">Saldo</th><th class="num">Qtd. incluir</th><th>Motivo</th><th></th>
            </tr></thead>
            <tbody>
              ${state.carrinho.length ? state.carrinho.map(renderCartRow).join('') : `
                <tr><td colspan="6"><div class="empty-state"><h4>Nenhum insumo adicionado</h4><p>Busque um insumo e adicione ao bloco.</p></div></td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Justificativa geral</h3></div>
        <div class="card-body">
          <div class="field">
            <label>Gestão ciente?</label>
            <select class="select" id="gestaoCiente">
              ${['Sim','Não','Aguardando validação'].map(v => `<option ${state.gestaoCiente === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Justificativa</label>
            <textarea class="textarea" id="justificativaGeral" placeholder="Explique o motivo geral da solicitação.">${esc(state.justificativaGeral)}</textarea>
          </div>
        </div>
      </div>
    `;

    el.querySelector('#obraSolic')?.addEventListener('change', e => {
      state.obraSolicitacao = e.target.value;
      state.selecionado = null;
      state.buscaResultados = [];
      state.termoBusca = '';
      renderInScreen();
    });
    el.querySelector('#solicitanteNome')?.addEventListener('input', e => state.solicitanteNome = e.target.value);
    el.querySelector('#solicitanteEmail')?.addEventListener('input', e => state.solicitanteEmail = e.target.value);
    el.querySelector('#prioridadeSolic')?.addEventListener('change', e => state.prioridade = e.target.value);
    el.querySelector('#gestaoCiente')?.addEventListener('change', e => state.gestaoCiente = e.target.value);
    el.querySelector('#justificativaGeral')?.addEventListener('input', e => state.justificativaGeral = e.target.value);
    el.querySelector('#clearCart')?.addEventListener('click', () => { state.carrinho = []; renderInScreen(); });
    el.querySelector('#btnEnviarSol')?.addEventListener('click', enviarSolicitacao);

    const termo = el.querySelector('#termoBusca');
    termo?.addEventListener('input', e => {
      state.termoBusca = e.target.value;
      clearTimeout(state.timerBusca);
      state.timerBusca = setTimeout(executarBuscaInsumos, 650);
    });

    $$('.result-item', el).forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        state.selecionado = state.buscaResultados[idx];
        renderInScreen();
      });
    });

    bindSelectedBox(el);
    bindCart(el);

    return el;
  }

  function renderBuscaResultados() {
    if (!state.termoBusca || state.termoBusca.length < 3) {
      return `<div class="empty-state small"><p>Digite ao menos 3 caracteres para buscar.</p></div>`;
    }
    if (!state.buscaResultados.length) {
      return `
        <button class="result-item" data-idx="0">
          <span class="origem-tag in">IN</span>
          <div><strong>Novo cadastro: ${esc(state.termoBusca.toUpperCase())}</strong><small>Nenhum resultado carregado ou encontrado.</small></div>
        </button>
      `;
    }
    return state.buscaResultados.map((r, i) => {
      const tipo = origemCode(r.origemInsumo);
      return `
        <button class="result-item" data-idx="${i}">
          <span class="origem-tag ${tipo}">${tipo.toUpperCase()}</span>
          <div>
            <strong><span class="mono">${esc(r.codigoInsumo)}</span> · ${esc(r.descricaoInsumo)}</strong>
            <small>${esc(origemLabel(r.origemInsumo))} · ${esc(r.eap || 'sem EAP')} · saldo ${fmtNum(r.saldoAtual)} ${esc(r.unidade || '')}</small>
          </div>
        </button>
      `;
    }).join('');
  }

  async function executarBuscaInsumos() {
    if (!state.termoBusca || state.termoBusca.length < 3) return;
    try {
      const res = await api('buscarInsumos', {
        idObra: state.obraSolicitacao,
        termo: state.termoBusca,
        limit: 20
      }, { title: 'Buscando insumos...' });
      state.buscaResultados = res.data || [];
      if (!state.buscaResultados.length) {
        state.buscaResultados = [{
          origemInsumo: 'Novo Cadastro',
          codigoInsumo: 'NOVO CADASTRO',
          descricaoInsumo: state.termoBusca.toUpperCase(),
          unidade: '',
          classificacao: 'A classificar',
          eap: '',
          itemOrcamentario: '',
          qtdOrcadaAtual: 0,
          qtdSolicitadaAtual: 0,
          saldoAtual: 0
        }];
      }
      renderInScreen();
    } catch (err) {}
  }

  function renderSelectedBox() {
    const it = state.selecionado;
    if (!it) return `<div class="empty-state small"><h4>Nenhum item selecionado</h4><p>Clique em um resultado da busca.</p></div>`;

    const tipo = origemCode(it.origemInsumo);
    return `
      <div class="selected-box">
        <div class="desc">
          <span class="origem-tag ${tipo}">${tipo.toUpperCase()}</span>
          <strong>${esc(it.codigoInsumo)} · ${esc(it.descricaoInsumo)}</strong>
          <small class="desc-sub">${esc(it.classificacao || '')} · ${esc(it.eap || 'sem EAP')} · ${esc(it.itemOrcamentario || '')}</small>
        </div>
        <div class="mini-grid">
          <div><span>Unidade</span><strong>${esc(it.unidade || '–')}</strong></div>
          <div><span>Qtd. orçada</span><strong>${fmtNum(it.qtdOrcadaAtual)}</strong></div>
          <div><span>Qtd. solicitada</span><strong>${fmtNum(it.qtdSolicitadaAtual)}</strong></div>
          <div><span>Saldo</span><strong>${fmtNum(it.saldoAtual)}</strong></div>
        </div>
        <div class="field"><label>Quantidade a incluir</label><input class="input" type="number" min="0" step="0.0001" id="qtdSel"></div>
        <div class="field"><label>Motivo</label><select class="select" id="motivoSel">
          <option>Saldo insuficiente</option><option>Item não previsto no orçamento</option><option>Alteração de projeto</option><option>Consumo superior ao orçamento</option><option>Substituição de insumo</option>
        </select></div>
        <div class="field"><label>Observação</label><textarea class="textarea" id="obsSel"></textarea></div>
        <button class="btn btn-primary" id="addSel">${icon('plus', 14)} Adicionar ao bloco</button>
      </div>
    `;
  }

  function bindSelectedBox(el) {
    el.querySelector('#addSel')?.addEventListener('click', () => {
      const it = state.selecionado;
      if (!it) return;
      const qtd = Number($('#qtdSel', el).value || 0);
      if (qtd <= 0) return toast({ kind: 'warn', title: 'Informe a quantidade' });
      state.carrinho.push({
        ...it,
        qtd,
        qtdSolicitadaInclusao: qtd,
        motivoItem: $('#motivoSel', el).value,
        observacaoSolicitante: $('#obsSel', el).value
      });
      state.selecionado = null;
      toast({ kind: 'success', title: 'Item adicionado ao bloco' });
      renderInScreen();
    });
  }

  function renderCartRow(it, idx) {
    const tipo = origemCode(it.origemInsumo);
    return `
      <tr>
        <td data-lbl="Origem"><span class="origem-tag ${tipo}">${tipo.toUpperCase()}</span></td>
        <td data-lbl="Insumo"><div class="desc"><span class="mono">${esc(it.codigoInsumo)}</span> · ${esc(it.descricaoInsumo)}</div><small class="desc-sub">${esc(it.eap || 'sem EAP')} · ${esc(it.itemOrcamentario || '')}</small></td>
        <td class="num" data-lbl="Saldo">${fmtNum(it.saldoAtual)}</td>
        <td class="num" data-lbl="Qtd.">${fmtNum(it.qtd)}</td>
        <td data-lbl="Motivo">${esc(it.motivoItem || '')}</td>
        <td style="text-align:right"><button class="btn btn-ghost btn-icon btn-sm" data-remove="${idx}">${icon('trash', 14)}</button></td>
      </tr>
    `;
  }

  function bindCart(el) {
    $$('[data-remove]', el).forEach(btn => {
      btn.addEventListener('click', () => {
        state.carrinho.splice(Number(btn.dataset.remove), 1);
        renderInScreen();
      });
    });
  }

  async function enviarSolicitacao() {
    if (!state.carrinho.length) return;
    try {
      const itens = state.carrinho.map(i => ({
        origemInsumo: i.origemInsumo,
        idOrcamento: i.idOrcamento || '',
        chaveOrcamento: i.chaveOrcamento || '',
        codigoInsumo: i.codigoInsumo,
        descricaoInsumo: i.descricaoInsumo,
        unidade: i.unidade,
        classificacao: i.classificacao,
        eap: i.eap || '',
        itemOrcamentario: i.itemOrcamentario || '',
        qtdOrcadaAtual: i.qtdOrcadaAtual || 0,
        qtdSolicitadaAtual: i.qtdSolicitadaAtual || 0,
        saldoAtual: i.saldoAtual || 0,
        qtdSolicitadaInclusao: i.qtd,
        motivoItem: i.motivoItem || '',
        observacaoSolicitante: i.observacaoSolicitante || ''
      }));

      const res = await api('criarSolicitacao', {
        idObra: state.obraSolicitacao,
        solicitanteNome: state.solicitanteNome,
        solicitanteEmail: state.solicitanteEmail,
        prioridade: state.prioridade,
        gestaoCiente: state.gestaoCiente,
        justificativaGeral: state.justificativaGeral,
        itens
      }, { title: 'Enviando solicitação...' });

      state.carrinho = [];
      state.justificativaGeral = '';
      state.selecionado = null;
      toast({ kind: 'success', title: 'Solicitação criada', body: res.data?.idSolicitacao || '' });
      goTo('solicitacoes');
      await carregarSolicitacoes();
    } catch (err) {}
  }

  // ===============================================================
  // Solicitações
  // ===============================================================
  function renderSolicitacoes() {
    const el = document.createElement('section');
    el.className = 'screen';

    const sols = state.solicitacoes || [];
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Solicitações</h1>
          <p>${sols.length} solicitações carregadas</p>
        </div>
        <div class="page-head-actions">
          <button class="btn btn-secondary btn-sm" id="loadSolic">${icon('refresh', 14)} Carregar</button>
          <button class="btn btn-primary btn-sm" id="goNova">${icon('plus', 14)} Nova solicitação</button>
        </div>
      </div>

      <div class="card">
        <div class="card-body flush">
          <table class="tbl tbl-mobile-cards">
            <thead><tr>
              <th>ID</th><th>Data</th><th>Obra</th><th>Solicitante</th><th class="num">Itens</th><th>Status</th><th>Resumo</th>
            </tr></thead>
            <tbody>
              ${sols.length ? sols.map(s => `
                <tr>
                  <td><strong class="mono">${esc(s.idSolicitacao)}</strong></td>
                  <td class="tight muted">${fmtDate(s.dataSolicitacao)}</td>
                  <td>${esc(obraLabel(s.idObra))}</td>
                  <td>${esc(s.solicitanteNome || '–')}</td>
                  <td class="num">${fmtNum(s.itens || 0)}</td>
                  <td>${statusBadge(s.statusGeral)}</td>
                  <td>${(s.resumoItens || []).map(esc).join('<br>')}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="7"><div class="empty-state"><h4>Nenhuma solicitação carregada</h4><p>Clique em Carregar.</p></div></td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
    el.querySelector('#goNova')?.addEventListener('click', () => goTo('nova'));
    el.querySelector('#loadSolic')?.addEventListener('click', carregarSolicitacoes);
    return el;
  }

  async function carregarSolicitacoes() {
    try {
      const res = await api('listarSolicitacoesResumo', {}, { title: 'Carregando solicitações...' });
      state.solicitacoes = res.data || [];
      renderInScreen();
    } catch (err) {}
  }

  function statusBadge(st) {
    const s = st || 'Nova';
    const cls = s.includes('Recus') ? 'b-rejected'
      : s.includes('Inclu') || s.includes('Compra') || s.includes('Conclu') ? 'b-approved'
      : s.includes('análise') || s.includes('parcial') ? 'b-pending'
      : 'b-info';
    return `<span class="badge ${cls}">${esc(s)}</span>`;
  }

  // ===============================================================
  // Bases
  // ===============================================================
  function renderBases() {
    const el = document.createElement('section');
    el.className = 'screen';
    el.innerHTML = `
      <div class="page-head">
        <div><h1>Bases CSV</h1><p>Importação de orçamento por obra e banco geral de insumos</p></div>
      </div>

      <div class="card">
        <div class="card-head"><div><h3>Importar orçamento Informakon</h3><div class="sub">Selecione a obra correspondente ao CSV</div></div></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field"><label>Obra</label><select class="select" id="baseObra">${state.obras.map(o => `<option value="${esc(o.idObra)}">${esc(o.nomeObra)}</option>`).join('')}</select></div>
            <div class="field"><label>Arquivo CSV</label><input class="input" id="orcCsv" type="file" accept=".csv"></div>
            <div class="field full"><label><input type="checkbox" id="manterAjustes" checked> Manter ajustes locais já aprovados</label></div>
          </div>
          <button class="btn btn-primary" id="importOrc">${icon('upload', 14)} Importar orçamento</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div><h3>Importar banco geral de insumos</h3><div class="sub">CSV nativo do Informakon</div></div></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field full"><label>Arquivo CSV</label><input class="input" id="bancoCsv" type="file" accept=".csv"></div>
          </div>
          <button class="btn btn-primary" id="importBanco">${icon('upload', 14)} Importar banco geral</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Último retorno</h3></div>
        <div class="card-body"><pre class="mono" id="importLog">Nenhuma importação nesta sessão.</pre></div>
      </div>
    `;

    el.querySelector('#importOrc')?.addEventListener('click', importarOrcamento);
    el.querySelector('#importBanco')?.addEventListener('click', importarBanco);
    return el;
  }

  async function importarOrcamento() {
    const file = $('#orcCsv')?.files?.[0];
    const idObra = $('#baseObra')?.value || '';
    if (!file) return toast({ kind: 'warn', title: 'Selecione o CSV do orçamento' });

    try {
      const csvContent = await readFileText(file);
      const res = await api('importarOrcamentoInformakon', {
        idObra,
        nomeArquivo: file.name,
        csvContent,
        manterAjustesLocais: $('#manterAjustes')?.checked !== false
      }, { timeout: 240000, title: 'Importando orçamento...' });

      $('#importLog').textContent = JSON.stringify(res, null, 2);
      toast({ kind: 'success', title: 'Orçamento importado', body: `${res.data?.linhasInsumosImportados || 0} insumo(s).` });
      await atualizarDashboardSilencioso();
    } catch (err) {
      $('#importLog').textContent = err.message;
    }
  }

  async function importarBanco() {
    const file = $('#bancoCsv')?.files?.[0];
    if (!file) return toast({ kind: 'warn', title: 'Selecione o CSV do banco geral' });

    try {
      const csvContent = await readFileText(file);
      const res = await api('importarBancoGeralInsumos', {
        nomeArquivo: file.name,
        csvContent
      }, { timeout: 240000, title: 'Importando banco geral...' });

      $('#importLog').textContent = JSON.stringify(res, null, 2);
      toast({ kind: 'success', title: 'Banco geral importado', body: `${res.data?.linhasImportadas || 0} insumo(s).` });
      await atualizarDashboardSilencioso();
    } catch (err) {
      $('#importLog').textContent = err.message;
    }
  }

  async function atualizarDashboardSilencioso() {
    try {
      const res = await api('getDashboardData', {}, { title: 'Atualizando indicadores...' });
      state.dashboard = res.data || {};
      updateFooter();
    } catch (err) {}
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      reader.readAsText(file, 'ISO-8859-1');
    });
  }

  // ===============================================================
  // Config
  // ===============================================================
  function renderConfig() {
    const el = document.createElement('section');
    el.className = 'screen';
    el.innerHTML = `
      <div class="page-head"><div><h1>Configuração</h1><p>API do Apps Script e preferências do navegador</p></div></div>
      <div class="card">
        <div class="card-head"><h3>API Apps Script</h3></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field full"><label>URL do Web App (/exec)</label><input class="input mono" id="apiUrl" value="${esc(state.apiUrl)}" placeholder="https://script.google.com/macros/s/.../exec"></div>
            <div class="field half"><label>API Key</label><input class="input mono" id="apiKey" value="${esc(state.apiKey)}" placeholder="ISI-..."></div>
            <div class="field half" style="align-self:end;text-align:right">
              <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
                <button class="btn btn-secondary" id="saveConfig">${icon('check', 14)} Salvar</button>
                <button class="btn btn-primary" id="testConfig">${icon('refresh', 14)} Testar conexão</button>
                <button class="btn btn-ghost" id="setupDb">${icon('database', 14)} setupDatabase</button>
                <button class="btn btn-ghost" id="clearCache">${icon('trash', 14)} Limpar cache</button>
              </div>
            </div>
          </div>
          <div class="hint" style="margin-top:12px;color:var(--fg-muted)">A URL e a chave ficam salvas no localStorage deste navegador.</div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Status</h3></div>
        <div class="card-body"><pre class="mono" id="configStatus">Aguardando ação.</pre></div>
      </div>
    `;

    el.querySelector('#saveConfig')?.addEventListener('click', () => {
      state.apiUrl = $('#apiUrl', el).value.trim();
      state.apiKey = $('#apiKey', el).value.trim();
      localStorage.setItem(STORE.apiUrl, state.apiUrl);
      localStorage.setItem(STORE.apiKey, state.apiKey);
      updateFooter();
      toast({ kind: 'success', title: 'Configuração salva' });
    });

    el.querySelector('#testConfig')?.addEventListener('click', async () => {
      state.apiUrl = $('#apiUrl', el).value.trim();
      state.apiKey = $('#apiKey', el).value.trim();
      localStorage.setItem(STORE.apiUrl, state.apiUrl);
      localStorage.setItem(STORE.apiKey, state.apiKey);
      try {
        const res = await api('inicializarApp', {}, { title: 'Testando conexão...' });
        const data = res.data || {};
        state.obras = data.obras || [];
        state.dashboard = data.dashboard || {};
        $('#configStatus', el).textContent = JSON.stringify(data, null, 2);
        toast({ kind: 'success', title: 'Conexão funcionando' });
      } catch (err) {
        $('#configStatus', el).textContent = err.message;
      }
    });

    el.querySelector('#setupDb')?.addEventListener('click', async () => {
      try {
        const res = await api('setupDatabase', {}, { title: 'Executando setupDatabase...' });
        $('#configStatus', el).textContent = JSON.stringify(res, null, 2);
      } catch (err) { $('#configStatus', el).textContent = err.message; }
    });

    el.querySelector('#clearCache')?.addEventListener('click', async () => {
      try {
        const res = await api('limparCacheISI', {}, { title: 'Limpando cache...' });
        $('#configStatus', el).textContent = JSON.stringify(res, null, 2);
      } catch (err) { $('#configStatus', el).textContent = err.message; }
    });

    return el;
  }

  // ===============================================================
  // Utils
  // ===============================================================
  function downloadCsv(filename, rows) {
    if (!rows.length) return toast({ kind: 'warn', title: 'Nada para exportar' });
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(';')]
      .concat(rows.map(r => headers.map(h => csvCell(r[h])).join(';')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function csvCell(v) {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function toast({ kind = 'success', title = '', body = '', ttl = 4200 }) {
    const stack = $('#toastStack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    const ic = kind === 'error' ? 'alert' : kind === 'warn' ? 'alert' : kind === 'info' ? 'info' : 'check';
    el.innerHTML = `${icon(ic, 16)}<div><strong>${esc(title)}</strong>${body ? `<small>${esc(body)}</small>` : ''}</div>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'all 200ms';
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 220);
    }, ttl);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (state.screen !== 'nova') goTo('nova');
      setTimeout(() => $('#termoBusca')?.focus(), 100);
    }
  });

})();
