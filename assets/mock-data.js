/* =================================================================
   ISI · Mock data — para o protótipo navegável.
   ================================================================= */

window.MOCK = (function () {

  const obras = [
    { idObra: 'OBR-001', nomeObra: 'DC1 — Data Center São Paulo',  centroCusto: '7421', gestor: 'Marina Couto',    status: 'Ativa' },
    { idObra: 'OBR-002', nomeObra: 'DC2 — Data Center Hortolândia', centroCusto: '7438', gestor: 'André Bittencourt', status: 'Ativa' },
    { idObra: 'OBR-003', nomeObra: 'Subestação Cajamar',           centroCusto: '7502', gestor: 'Felipe Drumond',  status: 'Ativa' },
    { idObra: 'OBR-004', nomeObra: 'Galpão Logístico Itupeva',     centroCusto: '7611', gestor: 'Patrícia Sayuri', status: 'Ativa' }
  ];

  const dashboard = {
    obras: obras.length,
    orcamentoAtivo: 14820,
    bancoGeral: 8742,
    solicitacoes: 47,
    itens: 218,
    importacoes: 19,
    pendentes: 23,
    aprovados: 162,
    recusados: 11,
    aguardandoCompra: 12
  };

  // EAPs / Composições por obra
  const composicoes = {
    'OBR-001': [
      { eap: '1.2.3',   itemOrcamentario: 'Fundação radier — sala de baterias' },
      { eap: '1.2.4',   itemOrcamentario: 'Fundação radier — sala de UPS' },
      { eap: '2.1.4',   itemOrcamentario: 'Estrutura metálica — racks' },
      { eap: '3.4.1',   itemOrcamentario: 'Hidráulica — água gelada' },
      { eap: '4.2.2',   itemOrcamentario: 'Elétrica — quadros gerais' },
      { eap: '5.1.1',   itemOrcamentario: 'Climatização — InRow' }
    ],
    'OBR-002': [
      { eap: '1.1.1',   itemOrcamentario: 'Movimentação de terra' },
      { eap: '2.3.2',   itemOrcamentario: 'Estrutura — pilares' },
      { eap: '4.1.5',   itemOrcamentario: 'Elétrica — alimentação principal' }
    ],
    'OBR-003': [
      { eap: '1.4.1',   itemOrcamentario: 'Fundação dos transformadores' },
      { eap: '4.3.1',   itemOrcamentario: 'Cabos AT' }
    ],
    'OBR-004': [
      { eap: '2.2.1',   itemOrcamentario: 'Estrutura pré-moldada' },
      { eap: '6.1.2',   itemOrcamentario: 'Acabamentos — pisos' }
    ]
  };

  // Solicitações com itens
  const solicitacoes = [
    {
      idSolicitacao: 'SOL-2026-0047',
      dataSolicitacao: '2026-05-17T14:22:00',
      idObra: 'OBR-001',
      solicitanteNome: 'Rafael Mendonça',
      solicitanteEmail: 'rafael.mendonca@empresa.com',
      prioridade: 'Urgente',
      gestaoCiente: 'Sim',
      justificativaGeral: 'Substituição de cimento por especificação superior solicitada pela engenharia.',
      statusGeral: 'Em análise',
      itens: 5
    },
    {
      idSolicitacao: 'SOL-2026-0046',
      dataSolicitacao: '2026-05-17T10:08:00',
      idObra: 'OBR-001',
      solicitanteNome: 'Tatiane Lobo',
      solicitanteEmail: 'tatiane.lobo@empresa.com',
      prioridade: 'Alta',
      gestaoCiente: 'Sim',
      justificativaGeral: 'Insumos adicionais para fechamento do mês.',
      statusGeral: 'Nova',
      itens: 3
    },
    {
      idSolicitacao: 'SOL-2026-0045',
      dataSolicitacao: '2026-05-16T16:55:00',
      idObra: 'OBR-002',
      solicitanteNome: 'Caio Penteado',
      solicitanteEmail: 'caio.penteado@empresa.com',
      prioridade: 'Normal',
      gestaoCiente: 'Sim',
      justificativaGeral: 'Reposição programada — semana 21.',
      statusGeral: 'Aprovada parcialmente',
      itens: 6
    },
    {
      idSolicitacao: 'SOL-2026-0044',
      dataSolicitacao: '2026-05-16T09:14:00',
      idObra: 'OBR-001',
      solicitanteNome: 'Marina Couto',
      solicitanteEmail: 'marina.couto@empresa.com',
      prioridade: 'Normal',
      gestaoCiente: 'Aguardando validação',
      justificativaGeral: 'Itens novos identificados em vistoria.',
      statusGeral: 'Incluída no Informakon',
      itens: 4
    },
    {
      idSolicitacao: 'SOL-2026-0043',
      dataSolicitacao: '2026-05-15T17:31:00',
      idObra: 'OBR-003',
      solicitanteNome: 'Felipe Drumond',
      solicitanteEmail: 'felipe.drumond@empresa.com',
      prioridade: 'Alta',
      gestaoCiente: 'Sim',
      justificativaGeral: 'Cabos AT — recálculo.',
      statusGeral: 'Em análise',
      itens: 2
    },
    {
      idSolicitacao: 'SOL-2026-0042',
      dataSolicitacao: '2026-05-15T11:02:00',
      idObra: 'OBR-002',
      solicitanteNome: 'André Bittencourt',
      solicitanteEmail: 'andre.bittencourt@empresa.com',
      prioridade: 'Normal',
      gestaoCiente: 'Sim',
      justificativaGeral: 'Movimentação adicional.',
      statusGeral: 'Concluída',
      itens: 1
    },
    {
      idSolicitacao: 'SOL-2026-0041',
      dataSolicitacao: '2026-05-14T15:48:00',
      idObra: 'OBR-001',
      solicitanteNome: 'Júlia Reinaldo',
      solicitanteEmail: 'julia.reinaldo@empresa.com',
      prioridade: 'Urgente',
      gestaoCiente: 'Não',
      justificativaGeral: 'Itens emergenciais — atende não pago.',
      statusGeral: 'Recusada',
      itens: 2
    }
  ];

  // Itens detalhados — para a tela de Análise
  const itens = [
    // SOL-0047 · OBR-001 · 1.2.3 (Fundação radier)
    { idItem: 'ITM-00001', idSolicitacao: 'SOL-2026-0047', idObra: 'OBR-001', solicitanteNome: 'Rafael Mendonça', prioridade: 'Urgente', dataSolicitacao: '2026-05-17T14:22:00',
      origemInsumo: 'Orçamento da Obra', eap: '1.2.3', itemOrcamentario: 'Fundação radier — sala de baterias',
      codigoInsumo: '002474-000', descricaoInsumo: 'Brita 1 — fornecimento posto na obra', unidade: 'm³',
      qtdOrcadaAtual: 280, qtdSolicitadaAtual: 240, saldoAtual: 40,
      qtdSolicitadaInclusao: 120, statusItem: 'Novo',
      motivoItem: 'Consumo superior ao orçamento', observacaoSolicitante: 'Concretagem deslocou para a próxima sexta.' },
    { idItem: 'ITM-00002', idSolicitacao: 'SOL-2026-0047', idObra: 'OBR-001', solicitanteNome: 'Rafael Mendonça', prioridade: 'Urgente', dataSolicitacao: '2026-05-17T14:22:00',
      origemInsumo: 'Orçamento da Obra', eap: '1.2.3', itemOrcamentario: 'Fundação radier — sala de baterias',
      codigoInsumo: '071998-000', descricaoInsumo: 'Cimento CP-IV-32 — saco 50kg', unidade: 'sc',
      qtdOrcadaAtual: 600, qtdSolicitadaAtual: 500, saldoAtual: 100,
      qtdSolicitadaInclusao: 80, statusItem: 'Novo',
      motivoItem: 'Saldo insuficiente', observacaoSolicitante: '' },
    { idItem: 'ITM-00003', idSolicitacao: 'SOL-2026-0047', idObra: 'OBR-001', solicitanteNome: 'Rafael Mendonça', prioridade: 'Urgente', dataSolicitacao: '2026-05-17T14:22:00',
      origemInsumo: 'Banco Geral Informakon', eap: '', itemOrcamentario: '',
      codigoInsumo: '184221-000', descricaoInsumo: 'Aditivo plastificante para concreto — bombona 200L', unidade: 'L',
      qtdOrcadaAtual: 0, qtdSolicitadaAtual: 0, saldoAtual: 0,
      qtdSolicitadaInclusao: 200, statusItem: 'Novo',
      motivoItem: 'Item não previsto no orçamento', observacaoSolicitante: 'Adicionar à composição da radier.' },

    // SOL-0047 · OBR-001 · 2.1.4 (Estrutura metálica — racks)
    { idItem: 'ITM-00004', idSolicitacao: 'SOL-2026-0047', idObra: 'OBR-001', solicitanteNome: 'Rafael Mendonça', prioridade: 'Urgente', dataSolicitacao: '2026-05-17T14:22:00',
      origemInsumo: 'Orçamento da Obra', eap: '2.1.4', itemOrcamentario: 'Estrutura metálica — racks',
      codigoInsumo: '034112-000', descricaoInsumo: 'Perfil U enrijecido 100x40x17 #14 — galvanizado', unidade: 'm',
      qtdOrcadaAtual: 320, qtdSolicitadaAtual: 295, saldoAtual: 25,
      qtdSolicitadaInclusao: 90, statusItem: 'Novo',
      motivoItem: 'Alteração de projeto', observacaoSolicitante: '' },
    { idItem: 'ITM-00005', idSolicitacao: 'SOL-2026-0047', idObra: 'OBR-001', solicitanteNome: 'Rafael Mendonça', prioridade: 'Urgente', dataSolicitacao: '2026-05-17T14:22:00',
      origemInsumo: 'Novo Cadastro', eap: '', itemOrcamentario: '',
      codigoInsumo: 'IN-NOVO-001', descricaoInsumo: 'Parafuso M12x40 inox A4 — cabeça flangeada (custo Comercial)', unidade: 'pç',
      qtdOrcadaAtual: 0, qtdSolicitadaAtual: 0, saldoAtual: 0,
      qtdSolicitadaInclusao: 800, statusItem: 'Novo',
      motivoItem: 'Substituição de insumo', observacaoSolicitante: 'Substituir parafuso galvanizado por inox A4 conforme projeto rev. 4.' },

    // SOL-0046 · OBR-001 · 4.2.2 (Elétrica)
    { idItem: 'ITM-00006', idSolicitacao: 'SOL-2026-0046', idObra: 'OBR-001', solicitanteNome: 'Tatiane Lobo', prioridade: 'Alta', dataSolicitacao: '2026-05-17T10:08:00',
      origemInsumo: 'Orçamento da Obra', eap: '4.2.2', itemOrcamentario: 'Elétrica — quadros gerais',
      codigoInsumo: '055230-000', descricaoInsumo: 'Cabo flexível 6 mm² PP 750V — preto', unidade: 'm',
      qtdOrcadaAtual: 1200, qtdSolicitadaAtual: 1180, saldoAtual: 20,
      qtdSolicitadaInclusao: 300, statusItem: 'Novo',
      motivoItem: 'Saldo insuficiente', observacaoSolicitante: '' },
    { idItem: 'ITM-00007', idSolicitacao: 'SOL-2026-0046', idObra: 'OBR-001', solicitanteNome: 'Tatiane Lobo', prioridade: 'Alta', dataSolicitacao: '2026-05-17T10:08:00',
      origemInsumo: 'Banco Geral Informakon', eap: '', itemOrcamentario: '',
      codigoInsumo: '098417-000', descricaoInsumo: 'Disjuntor tripolar 63A curva C — DIN 35', unidade: 'pç',
      qtdOrcadaAtual: 0, qtdSolicitadaAtual: 0, saldoAtual: 0,
      qtdSolicitadaInclusao: 8, statusItem: 'Novo',
      motivoItem: 'Item não previsto no orçamento', observacaoSolicitante: '' },
    { idItem: 'ITM-00008', idSolicitacao: 'SOL-2026-0046', idObra: 'OBR-001', solicitanteNome: 'Tatiane Lobo', prioridade: 'Alta', dataSolicitacao: '2026-05-17T10:08:00',
      origemInsumo: 'Orçamento da Obra', eap: '3.4.1', itemOrcamentario: 'Hidráulica — água gelada',
      codigoInsumo: '141082-000', descricaoInsumo: 'Tubo PPR PN20 ø50mm — barra 4m', unidade: 'br',
      qtdOrcadaAtual: 84, qtdSolicitadaAtual: 70, saldoAtual: 14,
      qtdSolicitadaInclusao: 24, statusItem: 'Novo',
      motivoItem: 'Consumo superior ao orçamento', observacaoSolicitante: '' },

    // SOL-0043 · OBR-003
    { idItem: 'ITM-00009', idSolicitacao: 'SOL-2026-0043', idObra: 'OBR-003', solicitanteNome: 'Felipe Drumond', prioridade: 'Alta', dataSolicitacao: '2026-05-15T17:31:00',
      origemInsumo: 'Orçamento da Obra', eap: '4.3.1', itemOrcamentario: 'Cabos AT',
      codigoInsumo: '202144-000', descricaoInsumo: 'Cabo blindado 15kV 1x95mm² — XLPE', unidade: 'm',
      qtdOrcadaAtual: 600, qtdSolicitadaAtual: 540, saldoAtual: 60,
      qtdSolicitadaInclusao: 120, statusItem: 'Novo',
      motivoItem: 'Alteração de projeto', observacaoSolicitante: '' },
    { idItem: 'ITM-00010', idSolicitacao: 'SOL-2026-0043', idObra: 'OBR-003', solicitanteNome: 'Felipe Drumond', prioridade: 'Alta', dataSolicitacao: '2026-05-15T17:31:00',
      origemInsumo: 'Novo Cadastro', eap: '', itemOrcamentario: '',
      codigoInsumo: 'IN-NOVO-002', descricaoInsumo: 'Terminal termocontrátil interno 15kV 1x95mm²', unidade: 'jg',
      qtdOrcadaAtual: 0, qtdSolicitadaAtual: 0, saldoAtual: 0,
      qtdSolicitadaInclusao: 6, statusItem: 'Novo',
      motivoItem: 'Item não previsto no orçamento', observacaoSolicitante: 'Jogo completo terminal interno (3 fases).' },

    // SOL-0045 · OBR-002 — alguns já aprovados, mistos
    { idItem: 'ITM-00011', idSolicitacao: 'SOL-2026-0045', idObra: 'OBR-002', solicitanteNome: 'Caio Penteado', prioridade: 'Normal', dataSolicitacao: '2026-05-16T16:55:00',
      origemInsumo: 'Orçamento da Obra', eap: '2.3.2', itemOrcamentario: 'Estrutura — pilares',
      codigoInsumo: '022019-000', descricaoInsumo: 'Aço CA-50 ø12,5mm — barra 12m', unidade: 'br',
      qtdOrcadaAtual: 220, qtdSolicitadaAtual: 200, saldoAtual: 20,
      qtdSolicitadaInclusao: 40, statusItem: 'Novo',
      motivoItem: 'Saldo insuficiente', observacaoSolicitante: '' },
    { idItem: 'ITM-00012', idSolicitacao: 'SOL-2026-0045', idObra: 'OBR-002', solicitanteNome: 'Caio Penteado', prioridade: 'Normal', dataSolicitacao: '2026-05-16T16:55:00',
      origemInsumo: 'Orçamento da Obra', eap: '2.3.2', itemOrcamentario: 'Estrutura — pilares',
      codigoInsumo: '022031-000', descricaoInsumo: 'Aço CA-50 ø16,0mm — barra 12m', unidade: 'br',
      qtdOrcadaAtual: 180, qtdSolicitadaAtual: 165, saldoAtual: 15,
      qtdSolicitadaInclusao: 32, statusItem: 'Novo',
      motivoItem: 'Consumo superior ao orçamento', observacaoSolicitante: '' }
  ];

  // Banco de insumos (para mock do buscar) — busca direta por termo
  const banco = [
    { codigoInsumo: '002474-000', descricaoInsumo: 'Brita 1 — fornecimento posto na obra', unidade: 'm³', classificacao: 'AGREGADOS · BRITA', origem: 'OO', idObra: 'OBR-001', eap: '1.2.3', itemOrcamentario: 'Fundação radier — sala de baterias', qtdOrcadaAtual: 280, qtdSolicitadaAtual: 240, saldoAtual: 40 },
    { codigoInsumo: '002474-000', descricaoInsumo: 'Brita 1 — fornecimento posto na obra', unidade: 'm³', classificacao: 'AGREGADOS · BRITA', origem: 'OO', idObra: 'OBR-001', eap: '1.2.4', itemOrcamentario: 'Fundação radier — sala de UPS',     qtdOrcadaAtual: 195, qtdSolicitadaAtual: 188, saldoAtual: 7 },
    { codigoInsumo: '002476-000', descricaoInsumo: 'Brita 2 — fornecimento posto na obra', unidade: 'm³', classificacao: 'AGREGADOS · BRITA', origem: 'BD' },
    { codigoInsumo: '071998-000', descricaoInsumo: 'Cimento CP-IV-32 — saco 50kg',         unidade: 'sc', classificacao: 'CIMENTO · CP-IV',   origem: 'OO', idObra: 'OBR-001', eap: '1.2.3', itemOrcamentario: 'Fundação radier — sala de baterias', qtdOrcadaAtual: 600, qtdSolicitadaAtual: 500, saldoAtual: 100 },
    { codigoInsumo: '071881-000', descricaoInsumo: 'Cimento CP-V ARI — saco 40kg',         unidade: 'sc', classificacao: 'CIMENTO · CP-V',    origem: 'BD' },
    { codigoInsumo: '072014-000', descricaoInsumo: 'Cimento CP-II-E-32 — saco 50kg',       unidade: 'sc', classificacao: 'CIMENTO · CP-II',   origem: 'BD' },
    { codigoInsumo: '184221-000', descricaoInsumo: 'Aditivo plastificante para concreto — bombona 200L', unidade: 'L', classificacao: 'ADITIVOS · CONCRETO', origem: 'BD' },
    { codigoInsumo: '055230-000', descricaoInsumo: 'Cabo flexível 6 mm² PP 750V — preto',  unidade: 'm', classificacao: 'ELÉTRICA · CABOS', origem: 'OO', idObra: 'OBR-001', eap: '4.2.2', itemOrcamentario: 'Elétrica — quadros gerais', qtdOrcadaAtual: 1200, qtdSolicitadaAtual: 1180, saldoAtual: 20 },
    { codigoInsumo: '055240-000', descricaoInsumo: 'Cabo flexível 10 mm² PP 750V — preto', unidade: 'm', classificacao: 'ELÉTRICA · CABOS', origem: 'BD' },
    { codigoInsumo: '098417-000', descricaoInsumo: 'Disjuntor tripolar 63A curva C — DIN 35', unidade: 'pç', classificacao: 'ELÉTRICA · PROTEÇÃO', origem: 'BD' },
    { codigoInsumo: '098424-000', descricaoInsumo: 'Disjuntor tripolar 100A curva C — DIN 35', unidade: 'pç', classificacao: 'ELÉTRICA · PROTEÇÃO', origem: 'BD' },
    { codigoInsumo: '141082-000', descricaoInsumo: 'Tubo PPR PN20 ø50mm — barra 4m', unidade: 'br', classificacao: 'HIDRÁULICA · TUBO PPR', origem: 'OO', idObra: 'OBR-001', eap: '3.4.1', itemOrcamentario: 'Hidráulica — água gelada', qtdOrcadaAtual: 84, qtdSolicitadaAtual: 70, saldoAtual: 14 },
    { codigoInsumo: '141090-000', descricaoInsumo: 'Tubo PPR PN20 ø75mm — barra 4m', unidade: 'br', classificacao: 'HIDRÁULICA · TUBO PPR', origem: 'BD' }
  ];

  function buscarMock(termo, idObra) {
    if (!termo || termo.length < 3) return [];
    const q = termo.toLowerCase();
    // Simula o ordenamento: primeiro OO da obra, depois BD
    const matched = banco.filter(r =>
      r.descricaoInsumo.toLowerCase().includes(q) ||
      r.codigoInsumo.toLowerCase().includes(q) ||
      (r.classificacao || '').toLowerCase().includes(q)
    );
    const ofObra = matched.filter(r => r.origem === 'OO' && (!idObra || r.idObra === idObra));
    const others = matched.filter(r => r.origem !== 'OO' || (idObra && r.idObra !== idObra))
      .map(r => ({ ...r, origem: r.origem === 'OO' ? 'BD' : r.origem })); // se de outra obra, vira BD na visão
    return ofObra.concat(others).slice(0, 24);
  }

  return {
    obras,
    dashboard,
    composicoes,
    solicitacoes,
    itens,
    banco,
    buscarMock
  };
})();
