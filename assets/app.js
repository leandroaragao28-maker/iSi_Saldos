/* =================================================================
   iSi · Production Frontend (v10)
   - JSONP-based GET (paralelo, sem form+iframe lento)
   - form+iframe + postMessage somente para escritas pesadas
   - Cache em memória com TTL e invalidação explícita
   - Debounce de busca (350ms)
   - Paginação de solicitações
   - Importação CSV em lotes (chunked)
   - Falla "demo": se não houver URL configurada, usa dados mock
   ================================================================= */

(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // =========================================================
  // CONFIG (localStorage)
  // =========================================================
  const cfg = {
    get apiUrl() { return localStorage.getItem('isi.apiUrl') || ''; },
    set apiUrl(v) { localStorage.setItem('isi.apiUrl', v || ''); },
    get apiKey() { return localStorage.getItem('isi.apiKey') || ''; },
    set apiKey(v) { localStorage.setItem('isi.apiKey', v || ''); },
    get currentObra() { return localStorage.getItem('isi.obra') || ''; },
    set currentObra(v) { localStorage.setItem('isi.obra', v || ''); }
  };

  // =========================================================
  // STATE
  // =========================================================
  const state = {
    screen: 'analise',
    online: false,
    loading: 0,            // counter for global progress strip
    obras: [],
    dashboard: null,
    itensAnalise: [],
    composicoes: [],
    solicitacoes: [],
    pageSize: 50,
    page: 1,
    obraFiltro: '',
    statusFiltro: 'pendentes',
    composicaoFiltro: '',
    expandidos: {},
    decisoes: {},
    selecionado: null,
    carrinho: [],
    termoBusca: '',
    resultadosBusca: [],
    buscandoAt: 0
  };

  // =========================================================
  // API CLIENT
  // =========================================================
  // Reads via JSONP — paraleliza muito mais rápido que form+iframe.
  // Writes via form+iframe+postMessage (mantém compatibilidade com Apps Script).
  // =========================================================
  const cache = {
    store: new Map(),
    get(key) {
      const hit = this.store.get(key);
      if (!hit) return null;
      if (Date.now() > hit.exp) { this.store.delete(key); return null; }
      return hit.val;
    },
    set(key, val, ttlMs = 60_000) {
      this.store.set(key, { val, exp: Date.now() + ttlMs });
    },
    invalidate(prefix) {
      for (const k of this.store.keys()) {
        if (!prefix || k.startsWith(prefix)) this.store.delete(k);
      }
    }
  };

  let jsonpId = 0;
  function apiGet(action, payload = {}, opts = {}) {
    const key = action + ':' + JSON.stringify(payload);
    if (opts.cacheMs && !opts.bypassCache) {
      const cached = cache.get(key);
      if (cached) return Promise.resolve(cached);
    }
    if (!cfg.apiUrl) return mockApi(action, payload);

    return new Promise((resolve, reject) => {
      const cb = '__isi_jsonp_' + (++jsonpId);
      const tag = document.createElement('script');
      const params = new URLSearchParams({
        action,
        apiKey: cfg.apiKey || '',
        payload: JSON.stringify(payload),
        callback: cb
      });
      const timer = setTimeout(() => {
        delete window[cb];
        tag.remove();
        reject(new Error('Timeout aguardando API (' + action + ')'));
      }, 30000);

      window[cb] = function (resp) {
        clearTimeout(timer);
        delete window[cb];
        tag.remove();
        if (!resp || !resp.ok) {
          return reject(new Error((resp && resp.error) || 'Erro desconhecido'));
        }
        if (opts.cacheMs) cache.set(key, resp.data, opts.cacheMs);
        resolve(resp.data);
      };

      tag.src = cfg.apiUrl + (cfg.apiUrl.includes('?') ? '&' : '?') + params.toString();
      tag.onerror = () => {
        clearTimeout(timer);
        delete window[cb];
        tag.remove();
        reject(new Error('Falha de rede ao chamar ' + action));
      };
      document.head.appendChild(tag);
    });
  }

  function apiPost(action, payload = {}) {
    if (!cfg.apiUrl) return mockApi(action, payload);

    return new Promise((resolve, reject) => {
      const reqId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const iframe = document.createElement('iframe');
      iframe.name = reqId;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = cfg.apiUrl;
      form.target = reqId;
      form.style.display = 'none';
      [
        ['action', action],
        ['apiKey', cfg.apiKey || ''],
        ['payload', JSON.stringify(payload)],
        ['requestId', reqId]
      ].forEach(([n, v]) => {
        const inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = n;
        inp.value = v;
        form.appendChild(inp);
      });
      document.body.appendChild(form);

      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        iframe.remove(); form.remove();
        reject(new Error('Timeout em ' + action));
      }, 120000);

      function handler(e) {
        if (!e.data || e.data.source !== 'ISI_APPS_SCRIPT_API') return;
        if (e.data.requestId !== reqId) return;
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        iframe.remove(); form.remove();
        const r = e.data.result;
        if (!r || !r.ok) return reject(new Error((r && r.error) || 'Erro'));
        resolve(r.data);
      }
      window.addEventListener('message', handler);
      form.submit();
    });
  }

  // Mock fallback — quando apiUrl está vazio, usa MOCK em window
  function mockApi(action, payload = {}) {
    const delay = 250 + Math.random() * 250;
    const M = window.MOCK;
    if (!M) return Promise.reject(new Error('Sem API configurada (mock indisponível).'));
    return new Promise(resolve => setTimeout(() => {
      switch (action) {
        case 'health': return resolve({ status: 'ok', timestamp: new Date().toISOString() });
        case 'inicializarApp':
          return resolve({ health: { status: 'ok' }, obras: M.obras, dashboard: M.dashboard });
        case 'getObras': return resolve(M.obras);
        case 'getDashboardData': return resolve(M.dashboard);
        case 'buscarInsumos': return resolve(M.buscarMock(payload.termo, payload.idObra));
        case 'listarSolicitacoesResumo': return resolve(M.solicitacoes);
        case 'getDadosAnalise': {
          const itens = M.itens.filter(i => {
            if (payload.idObra && i.idObra !== payload.idObra) return false;
            if (payload.modo === 'pendentes' &&
                ['Compra solicitada', 'Recusado', 'Incluído no Informakon'].includes(i.statusItem)) return false;
            if (payload.statusItem && i.statusItem !== payload.statusItem) return false;
            return true;
          });
          const composicoes = [];
          (M.composicoes[payload.idObra] || []).forEach(c => composicoes.push({ ...c, idObra: payload.idObra }));
          return resolve({ itens, composicoes });
        }
        case 'listarComposicoesObra': return resolve(M.composicoes[payload.idObra] || []);
        case 'processarAnaliseBloco': {
          let ap = 0, rc = 0;
          (payload.decisoes || []).forEach(d => {
            const it = M.itens.find(x => x.idItem === d.idItem);
            if (!it) return;
            if (d.decisao === 'aprovar') { it.statusItem = 'Incluído no Informakon'; ap++; }
            else if (d.decisao === 'recusar') { it.statusItem = 'Recusado'; rc++; }
          });
          return resolve({ aprovados: ap, recusados: rc, total: ap + rc, message: 'OK (mock)' });
        }
        case 'criarSolicitacao': return resolve({ idSolicitacao: 'SOL-NEW', itens: (payload.itens || []).length, message: 'OK (mock)' });
        default: return resolve(null);
      }
    }, delay));
  }

  // =========================================================
  // HELPERS
  // =========================================================
  const fmtNum = (n, casas = 0) => {
    if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '–';
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: Math.max(casas, 2) });
  };
  const fmtDate = iso => { if (!iso) return '–'; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''); };
  const origemCode = origem => {
    const o = String(origem || '').toLowerCase();
    if (o.includes('orcamento') || o.includes('orçamento')) return 'oo';
    if (o.includes('banco')) return 'bd';
    return 'in';
  };
  const obraShort = idObra => (state.obras.find(o => o.idObra === idObra) || {}).nomeObra?.split('—')[0]?.trim() || idObra;

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  function pushLoading() {
    state.loading++;
    if (state.loading === 1) {
      const strip = document.createElement('div');
      strip.className = 'progress-strip';
      strip.id = 'progressStrip';
      document.body.appendChild(strip);
    }
  }
  function popLoading() {
    state.loading = Math.max(0, state.loading - 1);
    if (state.loading === 0) {
      const el = $('#progressStrip');
      if (el) el.remove();
    }
  }
  async function withLoading(promise) {
    pushLoading();
    try { return await promise; }
    finally { popLoading(); }
  }

  // =========================================================
  // TOAST
  // =========================================================
  function toast({ kind = 'success', title = '', body = '', ttl = 4500 }) {
    const stack = $('#toastStack');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    const ic = kind === 'error' || kind === 'warn' ? 'alert' : 'check';
    el.innerHTML = `${icon(ic, 16)}<div><strong>${title}</strong>${body ? `<small>${body}</small>` : ''}</div>`;
    stack.appendChild(el);
    setTimeout(() => { el.style.transition = 'all 200ms'; el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; setTimeout(() => el.remove(), 220); }, ttl);
  }

  // =========================================================
  // NAVIGATION
  // =========================================================
  const NAV = [
    { id: 'dashboard',     ic: 'dashboard', label: 'Dashboard' },
    { id: 'bases',         ic: 'database',  label: 'Bases CSV' },
    { id: 'nova',          ic: 'plus',      label: 'Nova Solicitação' },
    { id: 'analise',       ic: 'search',    label: 'Análise' },
    { id: 'solicitacoes',  ic: 'list',      label: 'Solicitações' },
    { id: 'config',        ic: 'settings',  label: 'Configuração' }
  ];

  function goTo(id) {
    state.screen = id;
    render();
    const main = $('.main');
    if (main) main.scrollTo(0, 0);
  }

  // =========================================================
  // RAIL
  // =========================================================
  function renderRail() {
    const pendentes = state.dashboard?.pendentes || '';
    const obraAtiva = state.obras.find(o => o.idObra === cfg.currentObra) || state.obras[0];
    $('#rail').innerHTML = `
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
            ${icon(n.ic, 16)}<span>${n.label}</span>
            ${n.id === 'analise' && pendentes ? `<span class="badge">${pendentes}</span>` : ''}
          </button>`).join('')}
      </nav>
      <div class="rail-section">Sistema</div>
      <nav class="rail-nav">
        <button class="rail-nav-item ${state.screen === 'config' ? 'active' : ''}" data-go="config">${icon('settings', 16)}<span>Configuração</span></button>
      </nav>
      <div class="rail-foot">
        <div class="rail-avatar">${(obraAtiva?.gestor || 'US').split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
        <div class="rail-foot-info"><strong>${obraAtiva?.gestor || 'Usuário'}</strong><span>${obraAtiva?.nomeObra?.split('—')[0]?.trim() || '—'}</span></div>
      </div>
    `;
    $('#rail').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goTo(b.dataset.go); });
  }

  function renderBottomTabs() {
    const items = NAV.filter(n => ['dashboard', 'nova', 'analise', 'solicitacoes', 'config'].includes(n.id));
    $('#bottomTabs').innerHTML = items.map(n => `
      <button class="bottom-tab ${state.screen === n.id ? 'active' : ''}" data-go="${n.id}">
        ${icon(n.ic, 20)}<span>${n.label.split(' ')[0]}</span>
        ${n.id === 'analise' && state.dashboard?.pendentes ? `<span class="badge-mini">${state.dashboard.pendentes}</span>` : ''}
      </button>`).join('');
    $('#bottomTabs').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goTo(b.dataset.go); });
  }

  function renderTopbar() {
    const cur = NAV.find(n => n.id === state.screen) || { label: 'iSi' };
    $('#crumbs').innerHTML = `<strong>${cur.label}</strong><span class="sep">/</span><span>iSi · Saldos de Insumos</span>`;
    const sb = $('#statusbar');
    sb.querySelector('.conn').className = 'conn' + (state.online ? '' : ' offline');
    sb.querySelector('.conn').textContent = state.online ? 'Online' : (cfg.apiUrl ? 'Offline' : 'Modo demo');
    const obra = state.obras.find(o => o.idObra === cfg.currentObra);
    sb.querySelector('.pill').textContent = obra ? `${obra.idObra} · ${obra.nomeObra.split('—')[0].trim()}` : 'Sem obra ativa';
  }

  // =========================================================
  // RENDER (dispatcher)
  // =========================================================
  function render() {
    renderRail();
    renderBottomTabs();
    renderTopbar();
    const main = $('#main');
    main.innerHTML = '';
    main.appendChild(buildScreen(state.screen));
  }

  function buildScreen(id) {
    switch (id) {
      case 'dashboard':    return screenDashboard();
      case 'bases':        return screenBases();
      case 'nova':         return screenNova();
      case 'analise':      return screenAnalise();
      case 'solicitacoes': return screenSolicitacoes();
      case 'config':       return screenConfig();
      default:             return screenAnalise();
    }
  }

  function renderInScreen() {
    const main = $('#main');
    main.innerHTML = '';
    main.appendChild(buildScreen(state.screen));
  }

  // =========================================================
  // ANÁLISE
  // =========================================================
  function screenAnalise() {
    const el = document.createElement('section');
    el.className = 'screen';
    el.innerHTML = analiseShell();

    el.querySelector('#fObra').addEventListener('change', e => { state.obraFiltro = e.target.value; loadAnalise(el); });
    el.querySelector('#fStatus').addEventListener('change', e => { state.statusFiltro = e.target.value; loadAnalise(el); });
    el.querySelector('#fComp').addEventListener('change', e => { state.composicaoFiltro = e.target.value; paintAnalise(el); });
    el.querySelector('#reloadAnalise').addEventListener('click', () => { state.decisoes = {}; loadAnalise(el, true); });

    loadAnalise(el);
    return el;
  }

  function analiseShell() {
    return `
      <div class="page-head">
        <div><h1>Análise em bloco</h1><p id="analiseSub">Carregando itens...</p></div>
        <div class="page-head-actions">
          <button class="btn btn-secondary btn-sm" id="reloadAnalise">${icon('refresh', 14)} Recarregar</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="field"><label>Obra</label>
          <select class="select" id="fObra">
            <option value="">Todas</option>
            ${state.obras.map(o => `<option value="${o.idObra}" ${state.obraFiltro === o.idObra ? 'selected' : ''}>${o.nomeObra}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select class="select" id="fStatus">
            <option value="pendentes" ${state.statusFiltro === 'pendentes' ? 'selected' : ''}>Pendentes de análise</option>
            <option value="" ${state.statusFiltro === '' ? 'selected' : ''}>Todos</option>
            <option value="Novo" ${state.statusFiltro === 'Novo' ? 'selected' : ''}>Novos</option>
            <option value="Incluído no Informakon" ${state.statusFiltro === 'Incluído no Informakon' ? 'selected' : ''}>Aprovados</option>
            <option value="Recusado" ${state.statusFiltro === 'Recusado' ? 'selected' : ''}>Recusados</option>
          </select>
        </div>
        <div class="field"><label>Composição</label>
          <select class="select" id="fComp"><option value="">Todas</option></select>
        </div>
        <div class="grow"></div>
      </div>

      <div class="card" style="padding:0">
        <div id="bulkBarSlot"></div>
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
                <th style="width:200px">Alocação</th>
                <th style="width:170px;text-align:center">Decisão</th>
                <th style="width:30px"></th>
              </tr>
            </thead>
            <tbody id="analiseTbody">
              ${skeletonRows(8, 9)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function skeletonRows(rows, cols) {
    return Array.from({ length: rows }, () =>
      `<tr class="skel-row"><td colspan="${cols}"><div class="skeleton" style="width:${40 + Math.random() * 50}%;height:12px"></div></td></tr>`
    ).join('');
  }

  async function loadAnalise(el, force = false) {
    if (force) cache.invalidate('getDadosAnalise');
    try {
      const data = await withLoading(apiGet('getDadosAnalise', {
        idObra: state.obraFiltro || '',
        statusItem: state.statusFiltro && state.statusFiltro !== 'pendentes' ? state.statusFiltro : '',
        modo: state.statusFiltro === 'pendentes' ? 'pendentes' : ''
      }, { cacheMs: 30_000 }));
      state.itensAnalise = data.itens || [];
      state.composicoes = data.composicoes || [];
      paintAnalise(el);
    } catch (err) {
      toast({ kind: 'error', title: 'Falha ao carregar análise', body: err.message });
    }
  }

  function paintAnalise(el) {
    const itens = state.itensAnalise.filter(i => {
      if (!state.composicaoFiltro) return true;
      return `${i.idObra}|${i.eap}|${i.itemOrcamentario}` === state.composicaoFiltro;
    });
    el.querySelector('#analiseSub').textContent = `${itens.length} ${itens.length === 1 ? 'item' : 'itens'} ${state.statusFiltro === 'pendentes' ? 'pendentes de análise' : 'na visão atual'} · agrupados por composição`;

    // composições do filtro
    const grupos = agrupar(itens);
    const fComp = el.querySelector('#fComp');
    const cur = fComp.value;
    fComp.innerHTML = `<option value="">Todas</option>` +
      Object.values(grupos).map(g => `<option value="${g.key}">${g.label}</option>`).join('');
    if (cur) fComp.value = cur;

    el.querySelector('#analiseTbody').innerHTML = renderRowsAnalise(grupos);
    repaintBulkBar(el);
    bindAnaliseEvents(el);
  }

  function agrupar(itens) {
    const grupos = {};
    itens.forEach(it => {
      const tipo = origemCode(it.origemInsumo);
      const eap = it.eap || 'A_DEFINIR';
      const item = it.itemOrcamentario || 'Itens sem alocação · BD/IN';
      const key = `${it.idObra}|${eap}|${item}`;
      if (!grupos[key]) {
        grupos[key] = {
          key, idObra: it.idObra, obraNome: obraShort(it.idObra),
          eap, itemOrcamentario: item,
          label: (eap !== 'A_DEFINIR' ? eap + ' — ' : '') + item,
          itens: [], precisaAlocar: false
        };
      }
      grupos[key].itens.push(it);
      if (tipo !== 'oo') grupos[key].precisaAlocar = true;
    });
    return grupos;
  }

  function renderRowsAnalise(grupos) {
    const keys = Object.keys(grupos);
    if (!keys.length) {
      return `<tr><td colspan="9"><div class="empty-state">
        <div class="ic-big">${icon('search', 22)}</div>
        <h4>Nenhum item para análise</h4><p>Ajuste os filtros ou aguarde novas solicitações.</p>
      </div></td></tr>`;
    }
    return keys.map(key => {
      const g = grupos[key];
      const collapsed = state.expandidos[key] === false;
      return `
        <tr class="group-head ${collapsed ? 'collapsed' : ''}" data-group="${key}">
          <td colspan="9">
            <span class="ctx">
              ${icon('chevronD', 14, 'chev')}
              <strong>${g.obraNome}</strong><span class="muted">·</span>
              ${g.eap === 'A_DEFINIR'
                ? `<span class="badge b-pending">${icon('alert', 11)} Sem alocação</span>`
                : `<span class="mono">${g.eap}</span><span class="muted">— ${g.itemOrcamentario}</span>`}
              <span class="meta">${g.itens.length} ${g.itens.length === 1 ? 'item' : 'itens'}${countGroupDec(g.itens)}</span>
            </span>
          </td>
        </tr>
        ${collapsed ? '' : g.itens.map(it => rowItem(it)).join('')}
      `;
    }).join('');
  }

  function countGroupDec(itens) {
    let a = 0, r = 0;
    itens.forEach(it => { const d = state.decisoes[it.idItem]; if (!d) return; if (d.tipo === 'aprovar') a++; if (d.tipo === 'recusar') r++; });
    if (a + r === 0) return '';
    return ` · <span style="color:var(--st-approved)">${a} aprovar</span>, <span style="color:var(--st-rejected)">${r} recusar</span>`;
  }

  function rowItem(it) {
    const tipo = origemCode(it.origemInsumo);
    const dec = state.decisoes[it.idItem] || {};
    const decClass = dec.tipo === 'aprovar' ? 'dec-approved' : dec.tipo === 'recusar' ? 'dec-rejected' : '';
    const qtdAprovar = dec.qtd ?? it.qtdSolicitadaInclusao;
    const novoSaldo = Number(it.saldoAtual || 0) + (dec.tipo === 'aprovar' ? Number(qtdAprovar || 0) : 0);
    const precisaAlocar = tipo !== 'oo' && (!dec.eap || !dec.item);
    const composicoesObra = state.composicoes.filter(c => c.idObra === it.idObra);

    return `
      <tr data-id="${it.idItem}" class="${decClass}">
        <td><span class="origem-tag ${tipo}">${tipo.toUpperCase()}</span></td>
        <td data-lbl="Insumo">
          <div class="desc"><span class="mono" style="color:var(--fg-muted);font-size:var(--t-xs);margin-right:6px">${it.codigoInsumo || ''}</span>${it.descricaoInsumo || ''}</div>
          <small class="desc-sub">${it.idSolicitacao || ''} · ${it.solicitanteNome || ''} · <span class="prio ${(it.prioridade || 'Normal').toLowerCase()}">${it.prioridade || 'Normal'}</span> · ${it.motivoItem || ''}</small>
        </td>
        <td class="num" data-lbl="Saldo">${fmtNum(it.saldoAtual)} <small class="muted" style="font-size:10px">${it.unidade || ''}</small></td>
        <td class="num" data-lbl="Solicitado">${fmtNum(it.qtdSolicitadaInclusao)}</td>
        <td class="num" data-lbl="Aprovar"><input class="cell-input" type="number" min="0" step="0.0001" value="${qtdAprovar}" data-act="qtd" data-id="${it.idItem}" ${dec.tipo === 'recusar' ? 'disabled' : ''}></td>
        <td class="num" data-lbl="Novo">${fmtNum(novoSaldo)}</td>
        <td data-lbl="Alocação">
          ${tipo === 'oo'
            ? `<span class="mono" style="font-size:11px;color:var(--fg-muted)">${it.eap}</span>`
            : `<select class="alloc-select ${precisaAlocar && dec.tipo === 'aprovar' ? 'alert' : ''}" data-act="aloc" data-id="${it.idItem}">
                 <option value="">${precisaAlocar ? '⚠ Escolher composição...' : 'Escolher composição...'}</option>
                 ${composicoesObra.map(c => `<option value="${c.eap}::${c.itemOrcamentario}" ${dec.eap === c.eap && dec.item === c.itemOrcamentario ? 'selected' : ''}>${c.eap} — ${c.itemOrcamentario}</option>`).join('')}
                 <option value="__nova__">+ Nova composição</option>
               </select>`}
        </td>
        <td data-lbl="Decisão" style="text-align:center">
          <div class="dec-picker">
            <button class="${dec.tipo === 'aprovar' ? 'on-approve' : ''}" data-act="aprovar" data-id="${it.idItem}">${icon('check', 12)} Aprovar</button>
            <button class="${dec.tipo === 'recusar' ? 'on-reject' : ''}" data-act="recusar" data-id="${it.idItem}">${icon('x', 12)} Recusar</button>
          </div>
        </td>
        <td><button class="btn btn-ghost btn-icon btn-sm" data-act="obs" data-id="${it.idItem}" title="Observação">${icon(it.observacaoSolicitante ? 'fileText' : 'edit', 14)}</button></td>
      </tr>
    `;
  }

  function repaintBulkBar(el) {
    const counts = contarDecisoes();
    const slot = el.querySelector('#bulkBarSlot');
    if (counts.total === 0) { slot.innerHTML = ''; return; }
    slot.innerHTML = `
      <div class="bulk-bar">
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
    el.querySelector('#bulkClear').onclick = () => { state.decisoes = {}; paintAnalise(el); };
    el.querySelector('#bulkConfirm').onclick = () => confirmarAnalise(el);
  }

  function contarDecisoes() {
    let a = 0, r = 0, alocP = 0;
    Object.entries(state.decisoes).forEach(([id, d]) => {
      const it = state.itensAnalise.find(x => x.idItem === id);
      if (!it) return;
      if (d.tipo === 'aprovar') { a++; if (origemCode(it.origemInsumo) !== 'oo' && (!d.eap || !d.item)) alocP++; }
      else if (d.tipo === 'recusar') r++;
    });
    return { aprovados: a, recusados: r, total: a + r, alocPendentes: alocP };
  }

  function bindAnaliseEvents(el) {
    const tbody = el.querySelector('#analiseTbody');
    tbody.onclick = e => {
      const head = e.target.closest('.group-head');
      if (head) { const k = head.dataset.group; state.expandidos[k] = state.expandidos[k] === false ? true : false; paintAnalise(el); return; }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const dec = state.decisoes[id] || {};
      const it = state.itensAnalise.find(x => x.idItem === id);
      if (!it) return;
      if (act === 'aprovar') {
        if (dec.tipo === 'aprovar') delete state.decisoes[id];
        else state.decisoes[id] = { tipo: 'aprovar', qtd: dec.qtd ?? it.qtdSolicitadaInclusao, eap: dec.eap || '', item: dec.item || '' };
        paintAnalise(el);
      } else if (act === 'recusar') {
        if (dec.tipo === 'recusar') delete state.decisoes[id];
        else state.decisoes[id] = { tipo: 'recusar' };
        paintAnalise(el);
      } else if (act === 'obs') {
        const t = prompt('Observação para o item:', it.observacaoSolicitante || '');
        if (t !== null) { it.observacaoSolicitante = t; paintAnalise(el); }
      }
    };
    tbody.onchange = e => {
      const sel = e.target.closest('[data-act="aloc"]');
      if (sel) {
        const id = sel.dataset.id;
        if (sel.value === '__nova__') {
          const eap = prompt('Nova composição — EAP (ex: 1.2.3):', '');
          if (!eap) { sel.value = ''; return; }
          const item = prompt('Nome da composição:', '');
          if (!item) { sel.value = ''; return; }
          const dec = state.decisoes[id] || {};
          dec.tipo = 'aprovar'; dec.eap = eap; dec.item = item;
          state.decisoes[id] = dec;
          const it = state.itensAnalise.find(x => x.idItem === id);
          if (it) state.composicoes.push({ idObra: it.idObra, eap, itemOrcamentario: item, label: eap + ' — ' + item });
          paintAnalise(el);
        } else if (sel.value) {
          const [eap, itemNome] = sel.value.split('::');
          const dec = state.decisoes[id] || {};
          dec.tipo = 'aprovar'; dec.eap = eap; dec.item = itemNome;
          state.decisoes[id] = dec;
          paintAnalise(el);
        }
      }
      const q = e.target.closest('[data-act="qtd"]');
      if (q) { const id = q.dataset.id; const dec = state.decisoes[id]; if (dec) dec.qtd = Number(q.value); paintAnalise(el); }
    };
  }

  async function confirmarAnalise(el) {
    const counts = contarDecisoes();
    if (!counts.total) return;
    const decisoes = Object.entries(state.decisoes).map(([idItem, d]) => ({
      idItem, decisao: d.tipo, qtdIncluida: d.qtd,
      eapAlocado: d.eap || '', itemOrcamentarioAlocado: d.item || ''
    }));
    try {
      const r = await withLoading(apiPost('processarAnaliseBloco', { decisoes }));
      // atualização local otimista — sem recarregar tudo
      decisoes.forEach(d => {
        const it = state.itensAnalise.find(x => x.idItem === d.idItem);
        if (!it) return;
        it.statusItem = d.decisao === 'aprovar' ? 'Incluído no Informakon' : 'Recusado';
        if (d.eapAlocado) it.eap = d.eapAlocado;
        if (d.itemOrcamentarioAlocado) it.itemOrcamentario = d.itemOrcamentarioAlocado;
      });
      state.decisoes = {};
      cache.invalidate('getDashboardData');
      cache.invalidate('listarSolicitacoesResumo');
      toast({ kind: 'success', title: `${r.total || counts.total} ${counts.total === 1 ? 'decisão' : 'decisões'} processada(s)`, body: `${r.aprovados ?? counts.aprovados} aprovada(s) · ${r.recusados ?? counts.recusados} recusada(s)` });
      paintAnalise(el);
    } catch (err) {
      toast({ kind: 'error', title: 'Falha ao processar análise', body: err.message });
    }
  }

  // =========================================================
  // NOVA SOLICITAÇÃO
  // =========================================================
  function screenNova() {
    const el = document.createElement('section');
    el.className = 'screen';
    const obra = cfg.currentObra || (state.obras[0] && state.obras[0].idObra) || '';
    if (!cfg.currentObra && obra) cfg.currentObra = obra;

    const total = state.carrinho.reduce((s, i) => s + Number(i.qtd || 0), 0);

    el.innerHTML = `
      <div class="page-head">
        <div><h1>Nova solicitação</h1><p>${state.carrinho.length} ${state.carrinho.length === 1 ? 'item' : 'itens'} no rascunho · um bloco pode conter vários insumos</p></div>
        <div class="page-head-actions">
          <button class="btn btn-secondary btn-sm" id="limparCart">${icon('trash', 14)} Limpar rascunho</button>
          <button class="btn btn-primary btn-sm" id="enviarSol" ${state.carrinho.length === 0 ? 'disabled' : ''}>${icon('check', 14)} Enviar solicitação</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div><h3>Dados gerais</h3><div class="sub">Cabeçalho da solicitação</div></div></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field"><label>Obra</label>
              <select class="select" id="obraSol">${state.obras.map(o => `<option value="${o.idObra}" ${obra === o.idObra ? 'selected' : ''}>${o.nomeObra}</option>`).join('')}</select>
            </div>
            <div class="field"><label>Solicitante</label><input class="input" id="solNome" placeholder="Nome"></div>
            <div class="field"><label>E-mail</label><input class="input" id="solEmail" placeholder="email@empresa.com"></div>
            <div class="field"><label>Prioridade</label>
              <select class="select" id="solPrio"><option>Normal</option><option>Alta</option><option>Urgente</option></select>
            </div>
            <div class="field"><label>Gestão ciente?</label>
              <select class="select" id="solGestao"><option>Sim</option><option>Não</option><option>Aguardando validação</option></select>
            </div>
            <div class="field half"><label>Justificativa geral</label><input class="input" id="solJustif" placeholder="Contexto desta solicitação..."></div>
          </div>
        </div>
      </div>

      <div class="search-shell">
        <div class="card">
          <div class="card-head"><div><h3>Buscar insumo</h3><div class="sub">Orçamento da obra + banco geral</div></div><span class="muted" style="font-size:var(--t-xs)" id="searchCount">—</span></div>
          <div class="card-body">
            <div class="search-input-wrap" style="margin-bottom:var(--s-3)">
              ${icon('search', 14, 'ic-search')}
              <input class="input" id="termoBusca" placeholder="Mín. 3 caracteres — descrição, código ou classe..." value="${state.termoBusca}">
            </div>
            <div class="search-results-list" id="resultsList"><div class="empty-state" style="padding:var(--s-6)"><p>Digite ao menos 3 caracteres para buscar.</p></div></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Item selecionado</h3><div class="sub">Adicionar ao bloco</div></div></div>
          <div class="card-body" id="selectedBox">${renderSelectedBox()}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div><h3>Itens do bloco</h3><div class="sub">${state.carrinho.length} ${state.carrinho.length === 1 ? 'item' : 'itens'} no rascunho</div></div></div>
        <div class="card-body flush">
          ${state.carrinho.length === 0
            ? `<div class="cart-empty">${icon('cart', 22)}<br>Nenhum item adicionado ainda.<br><small>Busque um insumo ao lado e adicione ao bloco.</small></div>`
            : `<div class="cart-list">${state.carrinho.map((it, i) => `
                 <div class="cart-row" data-idx="${i}">
                   <span class="origem-tag ${it.origem.toLowerCase()}">${it.origem}</span>
                   <div class="cr-desc"><span class="cr-title">${it.descricaoInsumo}</span><span class="cr-meta">${it.codigoInsumo} · ${it.motivo}</span></div>
                   <input class="cell-input cr-qty mono" type="number" min="0" step="0.0001" value="${it.qtd}" data-cart-qty="${i}">
                   <button class="btn btn-ghost btn-icon btn-sm" data-cart-del="${i}">${icon('trash', 14)}</button>
                 </div>`).join('')}</div>
               <div class="cart-footer"><div class="summary">${state.carrinho.length} ${state.carrinho.length === 1 ? 'item' : 'itens'} · <strong class="mono numeric">${fmtNum(total)}</strong> unidades total</div></div>`
          }
        </div>
      </div>
    `;

    el.querySelector('#obraSol').addEventListener('change', e => { cfg.currentObra = e.target.value; renderInScreen(); });
    el.querySelector('#limparCart').addEventListener('click', () => { state.carrinho = []; renderInScreen(); });
    el.querySelector('#enviarSol').addEventListener('click', () => enviarSolicitacao(el));

    const inp = el.querySelector('#termoBusca');
    const debouncedSearch = debounce(async termo => {
      if (termo.length < 3) {
        el.querySelector('#resultsList').innerHTML = `<div class="empty-state" style="padding:var(--s-6)"><p>Digite ao menos 3 caracteres para buscar.</p></div>`;
        el.querySelector('#searchCount').textContent = '—';
        return;
      }
      const myStamp = ++state.buscandoAt;
      el.querySelector('#resultsList').innerHTML = skeletonRows(4, 1).replace(/colspan="1"/g, '');
      try {
        const r = await apiGet('buscarInsumos', { termo, idObra: cfg.currentObra, limit: 24 }, { cacheMs: 60_000 });
        if (myStamp !== state.buscandoAt) return; // resposta obsoleta
        state.resultadosBusca = r || [];
        paintResults(el);
      } catch (err) {
        if (myStamp !== state.buscandoAt) return;
        toast({ kind: 'error', title: 'Busca falhou', body: err.message });
      }
    }, 350);

    inp.addEventListener('input', e => { state.termoBusca = e.target.value; debouncedSearch(e.target.value); });
    bindCart(el);

    if (state.termoBusca.length >= 3) debouncedSearch(state.termoBusca);
    return el;
  }

  function paintResults(el) {
    const r = state.resultadosBusca || [];
    el.querySelector('#searchCount').textContent = `${r.length} ${r.length === 1 ? 'resultado' : 'resultados'}`;
    if (!r.length) {
      el.querySelector('#resultsList').innerHTML = `<div class="empty-state" style="padding:var(--s-6)"><div class="ic-big">${icon('search', 22)}</div><h4>Sem resultados</h4><p>Tente outra descrição ou pelo código do insumo.</p></div>`;
      return;
    }
    el.querySelector('#resultsList').innerHTML = r.map((res, i) => {
      const og = (res.origemInsumo || '').toLowerCase().includes('orçamento') || (res.origemInsumo || '').toLowerCase().includes('orcamento') ? 'OO' :
                 (res.origemInsumo || '').toLowerCase().includes('banco') ? 'BD' : (res.origem || 'BD').toUpperCase();
      const code = og.toLowerCase();
      return `<button class="search-result" data-idx="${i}">
        <span class="origem-tag ${code}">${og}</span>
        <div class="sr-desc">
          <span class="sr-title">${res.descricaoInsumo}</span>
          <span class="sr-meta">
            <span class="code">${res.codigoInsumo}</span>
            <span>${res.unidade || '—'}</span>
            ${res.eap ? `<span>${res.eap}</span>` : `<span class="muted">${res.classificacao || ''}</span>`}
          </span>
        </div>
        <span class="sr-saldo">${og === 'OO' ? fmtNum(res.saldoAtual) : '—'}<small>${og === 'OO' ? 'saldo' : (og === 'BD' ? 'banco geral' : 'novo')}</small></span>
      </button>`;
    }).join('');
    el.querySelector('#resultsList').onclick = e => {
      const b = e.target.closest('.search-result'); if (!b) return;
      const idx = Number(b.dataset.idx);
      const res = r[idx];
      const og = (res.origemInsumo || '').toLowerCase().includes('orçamento') || (res.origemInsumo || '').toLowerCase().includes('orcamento') ? 'OO' :
                 (res.origemInsumo || '').toLowerCase().includes('banco') ? 'BD' : 'IN';
      state.selecionado = { ...res, origem: og };
      el.querySelector('#selectedBox').innerHTML = renderSelectedBox();
      const add = el.querySelector('#addToCart'); if (add) add.onclick = () => addToCart(el);
    };
  }

  function renderSelectedBox() {
    const s = state.selecionado;
    if (!s) return `<div class="empty-state" style="padding:var(--s-6)"><div class="ic-big">${icon('zap', 22)}</div><h4>Nenhum item selecionado</h4><p>Clique em um resultado da busca para começar.</p></div>`;
    return `
      <div style="display:flex;align-items:flex-start;gap:var(--s-3);margin-bottom:var(--s-3)">
        <span class="origem-tag ${(s.origem || 'BD').toLowerCase()}" style="margin-top:2px">${s.origem || 'BD'}</span>
        <div style="flex:1;min-width:0">
          <div class="desc" style="font-weight:var(--fw-semi);color:var(--fg-strong);line-height:1.35">${s.descricaoInsumo}</div>
          <div class="muted" style="font-size:var(--t-xs);margin-top:2px"><span class="mono">${s.codigoInsumo}</span> · ${s.unidade || '—'} · ${s.eap ? s.eap + ' — ' + (s.itemOrcamentario || '') : (s.classificacao || 'Banco geral')}</div>
        </div>
      </div>
      ${s.origem === 'OO' ? `<div style="background:var(--bg-surface-2);border:1px solid var(--border-subtle);border-radius:var(--r-sm);padding:8px var(--s-3);margin-bottom:var(--s-3);display:flex;justify-content:space-between;font-size:var(--t-sm)"><span class="muted">Orçada / Solicitada / Saldo</span><span><strong class="mono numeric">${fmtNum(s.qtdOrcadaAtual)}</strong> · <strong class="mono numeric">${fmtNum(s.qtdSolicitadaAtual)}</strong> · <strong class="mono numeric" style="color:var(--st-pending)">${fmtNum(s.saldoAtual)}</strong></span></div>` : ''}
      <div class="form-grid" style="grid-template-columns:1fr 1fr">
        <div class="field"><label>Quantidade</label><input class="input mono" type="number" min="0" step="0.0001" id="qtdSel" placeholder="0"></div>
        <div class="field"><label>Motivo</label>
          <select class="select" id="motivoSel"><option>Saldo insuficiente</option><option>Item não previsto no orçamento</option><option>Alteração de projeto</option><option>Consumo superior ao orçamento</option><option>Substituição de insumo</option></select>
        </div>
        <div class="field full"><label>Observação</label><textarea class="textarea" id="obsSel" placeholder="Contexto opcional..."></textarea></div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:var(--s-3)"><button class="btn btn-primary" id="addToCart">${icon('plus', 14)} Adicionar ao bloco</button></div>
    `;
  }

  function addToCart(el) {
    const qtd = Number(el.querySelector('#qtdSel')?.value || 0);
    if (!qtd || qtd <= 0) { toast({ kind: 'warn', title: 'Informe uma quantidade' }); return; }
    const motivo = el.querySelector('#motivoSel')?.value || '';
    const obs = el.querySelector('#obsSel')?.value || '';
    state.carrinho.push({ ...state.selecionado, qtd, motivo, observacaoSolicitante: obs });
    state.selecionado = null;
    toast({ kind: 'success', title: 'Item adicionado ao bloco' });
    renderInScreen();
  }

  function bindCart(el) {
    el.querySelectorAll('[data-cart-del]').forEach(b => b.onclick = e => {
      state.carrinho.splice(Number(e.currentTarget.dataset.cartDel), 1); renderInScreen();
    });
    el.querySelectorAll('[data-cart-qty]').forEach(inp => inp.oninput = e => {
      state.carrinho[Number(e.currentTarget.dataset.cartQty)].qtd = Number(e.currentTarget.value);
    });
  }

  async function enviarSolicitacao(el) {
    const idObra = el.querySelector('#obraSol').value;
    const payload = {
      idObra,
      solicitanteNome: el.querySelector('#solNome').value,
      solicitanteEmail: el.querySelector('#solEmail').value,
      prioridade: el.querySelector('#solPrio').value,
      gestaoCiente: el.querySelector('#solGestao').value,
      justificativaGeral: el.querySelector('#solJustif').value,
      itens: state.carrinho.map(c => ({
        origemInsumo: c.origem === 'OO' ? 'Orçamento da Obra' : c.origem === 'BD' ? 'Banco Geral Informakon' : 'Novo Cadastro',
        idOrcamento: c.idOrcamento || '',
        chaveOrcamento: c.chaveOrcamento || '',
        codigoInsumo: c.codigoInsumo,
        descricaoInsumo: c.descricaoInsumo,
        unidade: c.unidade,
        classificacao: c.classificacao,
        eap: c.eap || '',
        itemOrcamentario: c.itemOrcamentario || '',
        qtdOrcadaAtual: c.qtdOrcadaAtual || 0,
        qtdSolicitadaAtual: c.qtdSolicitadaAtual || 0,
        saldoAtual: c.saldoAtual || 0,
        qtdSolicitadaInclusao: c.qtd,
        motivoItem: c.motivo,
        observacaoSolicitante: c.observacaoSolicitante || ''
      }))
    };
    try {
      const r = await withLoading(apiPost('criarSolicitacao', payload));
      cache.invalidate('listarSolicitacoesResumo');
      cache.invalidate('getDadosAnalise');
      toast({ kind: 'success', title: `Solicitação ${r.idSolicitacao} criada`, body: `${r.itens} ${r.itens === 1 ? 'item' : 'itens'}` });
      state.carrinho = []; state.selecionado = null;
      renderInScreen();
    } catch (err) { toast({ kind: 'error', title: 'Falha ao enviar', body: err.message }); }
  }

  // =========================================================
  // SOLICITAÇÕES
  // =========================================================
  function screenSolicitacoes() {
    const el = document.createElement('section');
    el.className = 'screen';
    el.innerHTML = `
      <div class="page-head"><div><h1>Solicitações</h1><p id="solSub">Carregando...</p></div>
        <div class="page-head-actions">
          <button class="btn btn-secondary btn-sm" id="solRefresh">${icon('refresh', 14)} Atualizar</button>
          <button class="btn btn-primary btn-sm" id="solNova">${icon('plus', 14)} Nova solicitação</button>
        </div>
      </div>
      <div class="filter-bar">
        <div class="field"><label>Obra</label><select class="select" id="solObra"><option value="">Todas</option>${state.obras.map(o => `<option value="${o.idObra}">${o.nomeObra}</option>`).join('')}</select></div>
        <div class="grow"></div>
      </div>
      <div class="card" style="padding:0"><div class="table-scroll"><table class="tbl tbl-mobile-cards">
        <thead><tr><th style="width:140px">ID</th><th style="width:80px">Data</th><th>Obra · Solicitante</th><th style="width:80px">Prio.</th><th class="num" style="width:70px">Itens</th><th style="width:200px">Status</th><th>Resumo</th></tr></thead>
        <tbody id="solTbody">${skeletonRows(6, 7)}</tbody>
      </table></div></div>
      <div id="solPager" style="display:flex;justify-content:center;gap:8px;padding:8px"></div>
    `;
    el.querySelector('#solRefresh').onclick = () => loadSolicitacoes(el, true);
    el.querySelector('#solNova').onclick = () => goTo('nova');
    el.querySelector('#solObra').onchange = e => { state.obraFiltro = e.target.value; state.page = 1; loadSolicitacoes(el); };
    loadSolicitacoes(el);
    return el;
  }

  async function loadSolicitacoes(el, force = false) {
    if (force) cache.invalidate('listarSolicitacoesResumo');
    try {
      const r = await withLoading(apiGet('listarSolicitacoesResumo', { idObra: state.obraFiltro || '' }, { cacheMs: 30_000 }));
      state.solicitacoes = r || [];
      paintSolicitacoes(el);
    } catch (err) { toast({ kind: 'error', title: 'Falha ao listar', body: err.message }); }
  }

  function paintSolicitacoes(el) {
    const total = state.solicitacoes.length;
    const start = (state.page - 1) * state.pageSize;
    const slice = state.solicitacoes.slice(start, start + state.pageSize);
    el.querySelector('#solSub').textContent = `${total} solicitações · página ${state.page} de ${Math.max(1, Math.ceil(total / state.pageSize))}`;

    el.querySelector('#solTbody').innerHTML = slice.length === 0
      ? `<tr><td colspan="7"><div class="empty-state"><div class="ic-big">${icon('list', 22)}</div><h4>Sem solicitações</h4><p>Ainda não há registros para a obra selecionada.</p></div></td></tr>`
      : slice.map(s => `
        <tr>
          <td data-lbl="ID" class="mono tight"><strong style="color:var(--fg-strong)">${s.idSolicitacao}</strong></td>
          <td data-lbl="Data" class="tight muted">${fmtDate(s.dataSolicitacao)}</td>
          <td data-lbl="Obra"><div class="desc">${obraShort(s.idObra)}</div><small class="desc-sub">${s.solicitanteNome || ''}</small></td>
          <td data-lbl="Prio"><span class="prio ${(s.prioridade || 'Normal').toLowerCase()}">${s.prioridade || 'Normal'}</span></td>
          <td data-lbl="Itens" class="num"><strong>${s.itens || 0}</strong></td>
          <td data-lbl="Status">${statusBadge(s.statusGeral)}</td>
          <td data-lbl="Resumo" class="muted truncate" style="max-width:360px">${(s.resumoItens || []).join('; ') || ''}</td>
        </tr>`).join('');

    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    const pager = el.querySelector('#solPager');
    if (totalPages <= 1) { pager.innerHTML = ''; return; }
    pager.innerHTML = `
      <button class="btn btn-secondary btn-sm" ${state.page === 1 ? 'disabled' : ''} data-pg="${state.page - 1}">${icon('chevronL', 12)} Anterior</button>
      <span style="font-size:var(--t-sm);color:var(--fg-muted);align-self:center">Página ${state.page} de ${totalPages}</span>
      <button class="btn btn-secondary btn-sm" ${state.page === totalPages ? 'disabled' : ''} data-pg="${state.page + 1}">Próxima ${icon('chevronR', 12)}</button>
    `;
    pager.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { state.page = Number(b.dataset.pg); paintSolicitacoes(el); });
  }

  function statusBadge(s) {
    const map = {
      'Nova': ['b-info', 'Nova'], 'Em análise': ['b-pending', 'Em análise'],
      'Aprovada parcialmente': ['b-info', 'Aprov. parcial'], 'Incluída no Informakon': ['b-approved', 'Incluída'],
      'Aguardando compra': ['b-pending', 'Aguard. compra'], 'Recusada': ['b-rejected', 'Recusada'],
      'Concluída': ['b-approved', 'Concluída']
    };
    const [cls, lbl] = map[s] || ['b-neutral', s || '—'];
    return `<span class="badge ${cls}"><span class="dot"></span>${lbl}</span>`;
  }

  // =========================================================
  // DASHBOARD
  // =========================================================
  function screenDashboard() {
    const el = document.createElement('section');
    el.className = 'screen';
    const d = state.dashboard || {};
    el.innerHTML = `
      <div class="page-head"><div><h1>Dashboard</h1><p>Resumo geral do sistema</p></div>
        <div class="page-head-actions">
          <button class="btn btn-secondary btn-sm" id="dashRef">${icon('refresh', 14)} Atualizar</button>
          <button class="btn btn-primary btn-sm" data-go="nova">${icon('plus', 14)} Nova solicitação</button>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-card"><div class="accent"></div><span class="lbl">Pendentes</span><span class="val">${fmtNum(d.pendentes ?? '–')}</span><span class="delta">análise aguardando</span></div>
        <div class="stat-card"><div class="accent"></div><span class="lbl">Aprovados</span><span class="val">${fmtNum(d.aprovados ?? '–')}</span><span class="delta">incluídos no Informakon</span></div>
        <div class="stat-card warn"><div class="accent"></div><span class="lbl">Solicitações</span><span class="val">${fmtNum(d.solicitacoes ?? '–')}</span><span class="delta">total no sistema</span></div>
        <div class="stat-card"><div class="accent"></div><span class="lbl">Itens</span><span class="val">${fmtNum(d.itens ?? '–')}</span><span class="delta">total cadastrados</span></div>
      </div>
      <div class="stats-row">
        <div class="stat-card"><div class="accent"></div><span class="lbl">Obras</span><span class="val">${fmtNum(d.obras ?? '–')}</span><span class="delta">ativas</span></div>
        <div class="stat-card"><div class="accent"></div><span class="lbl">Orçamento ativo</span><span class="val">${fmtNum(d.orcamentoAtivo ?? '–')}</span><span class="delta">linhas em ORCAMENTO_OBRA</span></div>
        <div class="stat-card"><div class="accent"></div><span class="lbl">Banco geral</span><span class="val">${fmtNum(d.bancoGeral ?? '–')}</span><span class="delta">insumos cadastrados</span></div>
        <div class="stat-card"><div class="accent"></div><span class="lbl">Importações</span><span class="val">${fmtNum(d.importacoes ?? '–')}</span><span class="delta">registradas</span></div>
      </div>
    `;
    el.querySelector('#dashRef').onclick = () => initApp(true);
    el.querySelector('[data-go="nova"]').onclick = () => goTo('nova');
    return el;
  }

  // =========================================================
  // BASES — com upload em lotes
  // =========================================================
  function screenBases() {
    const el = document.createElement('section');
    el.className = 'screen';
    el.innerHTML = `
      <div class="page-head"><div><h1>Bases CSV</h1><p>Importação de orçamento por obra e banco geral de insumos</p></div></div>

      <div class="card">
        <div class="card-head"><div><h3>Importar orçamento Informakon</h3><div class="sub">Selecione a obra correspondente</div></div></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field"><label>Obra</label><select class="select" id="orcObra">${state.obras.map(o => `<option value="${o.idObra}">${o.nomeObra}</option>`).join('')}</select></div>
            <div class="field"><label>Arquivo CSV</label><input class="input" type="file" id="orcFile" accept=".csv"></div>
            <div class="field half"><label>Opções</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:var(--t-sm)"><input type="checkbox" id="orcManter" checked> Manter ajustes locais aprovados</label>
            </div>
            <div class="field half" style="align-self:end;text-align:right"><button class="btn btn-primary" id="btnImpOrc">${icon('upload', 14)} Importar orçamento</button></div>
            <div class="field full"><div id="orcProgress" style="display:none;background:var(--bg-surface-2);padding:var(--s-3);border-radius:var(--r-sm);font-size:var(--t-sm);font-family:var(--font-mono)"></div></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div><h3>Importar banco geral</h3><div class="sub">Base completa de insumos do Informakon</div></div></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field half"><label>Arquivo CSV</label><input class="input" type="file" id="bgFile" accept=".csv"></div>
            <div class="field half" style="align-self:end;text-align:right"><button class="btn btn-primary" id="btnImpBg">${icon('upload', 14)} Importar banco geral</button></div>
            <div class="field full"><div id="bgProgress" style="display:none;background:var(--bg-surface-2);padding:var(--s-3);border-radius:var(--r-sm);font-size:var(--t-sm);font-family:var(--font-mono)"></div></div>
          </div>
        </div>
      </div>
    `;
    el.querySelector('#btnImpOrc').onclick = () => importarCSV(el, 'orcamento');
    el.querySelector('#btnImpBg').onclick  = () => importarCSV(el, 'banco');
    return el;
  }

  async function importarCSV(el, tipo) {
    const fileInput = el.querySelector(tipo === 'orcamento' ? '#orcFile' : '#bgFile');
    const progEl    = el.querySelector(tipo === 'orcamento' ? '#orcProgress' : '#bgProgress');
    const file = fileInput.files[0];
    if (!file) { toast({ kind: 'warn', title: 'Selecione um arquivo CSV' }); return; }

    progEl.style.display = 'block';
    progEl.textContent = 'Lendo arquivo...';
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    const header = lines[0];
    const dataLines = lines.slice(1).filter(Boolean);
    const total = dataLines.length;
    progEl.textContent = `Total: ${total.toLocaleString('pt-BR')} linhas. Enviando...`;

    // Single shot pra orçamento (geralmente menor). Para banco geral, faz chunked.
    if (tipo === 'orcamento' || total < 3000) {
      try {
        const action = tipo === 'orcamento' ? 'importarOrcamentoInformakon' : 'importarBancoGeralInsumos';
        const payload = tipo === 'orcamento'
          ? { idObra: el.querySelector('#orcObra').value, csvContent: text, nomeArquivo: file.name, manterAjustesLocais: el.querySelector('#orcManter').checked }
          : { csvContent: text, nomeArquivo: file.name };
        const r = await withLoading(apiPost(action, payload));
        progEl.textContent = `✓ ${r.message || 'Importação concluída'} — ${fmtNum(r.linhasImportadas || r.linhasInsumosImportados || total)} linhas.`;
        toast({ kind: 'success', title: 'Importação concluída' });
        cache.invalidate('');
      } catch (err) {
        progEl.textContent = '✗ Falha: ' + err.message;
        toast({ kind: 'error', title: 'Falha na importação', body: err.message });
      }
      return;
    }

    // Chunked banco geral
    const CHUNK = 1000;
    const total_chunks = Math.ceil(total / CHUNK);
    try {
      for (let i = 0; i < total_chunks; i++) {
        const start = i * CHUNK;
        const chunkLines = dataLines.slice(start, start + CHUNK);
        const csvChunk = [header, ...chunkLines].join('\n');
        progEl.textContent = `Lote ${i + 1} de ${total_chunks} — ${fmtNum(Math.min((i + 1) * CHUNK, total))} de ${fmtNum(total)} linhas...`;
        await apiPost('importarBancoGeralInsumosLote', {
          csvContent: csvChunk, nomeArquivo: file.name, loteAtual: i + 1, loteTotal: total_chunks, primeiroLote: i === 0
        });
      }
      progEl.textContent = `✓ Importação concluída — ${fmtNum(total)} linhas em ${total_chunks} lotes.`;
      toast({ kind: 'success', title: 'Banco geral importado em lotes' });
      cache.invalidate('');
    } catch (err) {
      progEl.textContent = '✗ Falha no lote: ' + err.message;
      toast({ kind: 'error', title: 'Falha na importação em lotes', body: err.message });
    }
  }

  // =========================================================
  // CONFIG
  // =========================================================
  function screenConfig() {
    const el = document.createElement('section');
    el.className = 'screen';
    el.innerHTML = `
      <div class="page-head"><div><h1>Configuração</h1><p>API do Apps Script e preferências do navegador</p></div></div>
      <div class="card">
        <div class="card-head"><h3>API Apps Script</h3></div>
        <div class="card-body"><div class="form-grid">
          <div class="field full"><label>URL do Web App (/exec)</label><input class="input mono" id="cfgUrl" value="${cfg.apiUrl}" placeholder="https://script.google.com/macros/s/.../exec"></div>
          <div class="field half"><label>API Key</label><input class="input mono" id="cfgKey" value="${cfg.apiKey}" placeholder="ISI-..."></div>
          <div class="field half" style="align-self:end;text-align:right">
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn btn-secondary" id="cfgTest">${icon('power', 14)} Testar</button>
              <button class="btn btn-primary" id="cfgSave">Salvar</button>
            </div>
          </div>
          <div class="field full"><div class="hint">URL e chave ficam salvas apenas no navegador local (localStorage).</div></div>
        </div></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Manutenção</h3></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">
          <button class="btn btn-secondary" id="cfgSetup">${icon('refresh', 14)} Rodar setupDatabase()</button>
          <button class="btn btn-secondary" id="cfgClear">${icon('trash', 14)} Limpar cache do servidor</button>
          <button class="btn btn-secondary" id="cfgLocal">${icon('trash', 14)} Limpar cache local</button>
        </div>
      </div>
    `;
    el.querySelector('#cfgSave').onclick = () => {
      cfg.apiUrl = el.querySelector('#cfgUrl').value.trim();
      cfg.apiKey = el.querySelector('#cfgKey').value.trim();
      cache.invalidate('');
      toast({ kind: 'success', title: 'Configuração salva' });
      initApp(true);
    };
    el.querySelector('#cfgTest').onclick = async () => {
      try {
        const r = await withLoading(apiGet('health', {}));
        state.online = true;
        toast({ kind: 'success', title: 'Conexão OK', body: r.timestamp });
      } catch (err) {
        state.online = false;
        toast({ kind: 'error', title: 'Falha na conexão', body: err.message });
      }
      renderTopbar();
    };
    el.querySelector('#cfgSetup').onclick = async () => {
      try { const r = await withLoading(apiPost('setupDatabase', {})); toast({ kind: 'success', title: 'Setup OK', body: r.message }); }
      catch (err) { toast({ kind: 'error', title: 'Falha no setup', body: err.message }); }
    };
    el.querySelector('#cfgClear').onclick = async () => {
      try { const r = await withLoading(apiGet('limparCacheISI', {}, { bypassCache: true })); toast({ kind: 'success', title: 'Cache limpo', body: r.message }); cache.invalidate(''); }
      catch (err) { toast({ kind: 'error', title: 'Falha', body: err.message }); }
    };
    el.querySelector('#cfgLocal').onclick = () => { cache.invalidate(''); toast({ kind: 'success', title: 'Cache local limpo' }); };
    return el;
  }

  // =========================================================
  // BOOT
  // =========================================================
  async function initApp(force = false) {
    try {
      if (force) cache.invalidate('inicializarApp');
      const r = await withLoading(apiGet('inicializarApp', {}, { cacheMs: 60_000, bypassCache: force }));
      state.online = true;
      state.obras = r.obras || [];
      state.dashboard = r.dashboard || null;
      if (!cfg.currentObra && state.obras[0]) cfg.currentObra = state.obras[0].idObra;
    } catch (err) {
      state.online = false;
      if (cfg.apiUrl) toast({ kind: 'error', title: 'Sem conexão com API', body: err.message });
    }
    render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();              // shell vazia
    initApp();             // carrega tudo
    if (!cfg.apiUrl) setTimeout(() => toast({ kind: 'info', title: 'Modo demo ativo', body: 'Configure a URL da API em Configuração para usar dados reais.' }), 800);
  });
})();
