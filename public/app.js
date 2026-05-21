const state = {
  data: null,
  page: 'overview',
  financeTab: 'cards',
  transactionFilter: 'todos',
  transactionCategory: 'todas',
  transactionSearch: '',
  transactionSort: 'recent',
  chart: null,
  investmentChart: null,
  modalType: null,
  editing: null,
  authMode: 'login',
  authToken: localStorage.getItem('lasttroToken') || '',
  user: JSON.parse(localStorage.getItem('lasttroUser') || 'null')
};

const pages = {
  overview: { title: 'Visao geral', subtitle: 'maio de 2026' },
  finance: { title: 'Financeiro', subtitle: 'entradas, saidas e investimentos' },
  goals: { title: 'Metas', subtitle: 'objetivos e progresso' },
  work: { title: 'Trabalhos', subtitle: 'renda, horas e status' }
};

const categoryColors = ['#ff7a45', '#00c4b4', '#8b6fff', '#f0b43c', '#4a9eff', '#2ecc8a'];
const movementCategories = ['Alimentacao', 'Transporte', 'Saude', 'Moradia', 'Lazer', 'Educacao', 'Salario', 'Freela', 'Renda extra', 'Investimentos', 'Diversos'];
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function transactionStyle(tipo) {
  if (tipo === 'entrada') return { color: 'var(--green)', bg: 'rgba(46,204,138,.12)' };
  if (tipo === 'investimento') return { color: 'var(--blue)', bg: 'rgba(74,158,255,.12)' };
  return { color: 'var(--red)', bg: 'rgba(232,77,77,.12)' };
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.authToken) headers.Authorization = `Bearer ${state.authToken}`;

  const response = await fetch(path, {
    headers,
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 && !['/api/login', '/api/register', '/api/google-login'].includes(path)) {
      clearSession();
      showLogin('Sessao encerrada. Entre novamente.');
    }
    throw new Error(text || `Erro HTTP ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function loadDashboard() {
  state.data = await api('/api/dashboard');
  renderAll();
}

function setSession(payload) {
  state.authToken = payload.token;
  state.user = payload.user;
  localStorage.setItem('lasttroToken', payload.token);
  localStorage.setItem('lasttroUser', JSON.stringify(payload.user));
  renderAccountUser();
}

function clearSession() {
  state.authToken = '';
  state.user = null;
  localStorage.removeItem('lasttroToken');
  localStorage.removeItem('lasttroUser');
  renderAccountUser();
}

function showLogin(message = '') {
  qs('#loginScreen').classList.remove('hidden');
  qs('#appShell').classList.add('locked');
  const form = qs('#loginForm');
  if (form && state.authMode === 'login') {
    form.elements.email.value = '';
    form.elements.password.value = '';
  }
  setAuthMessage(message);
}

function showApp() {
  qs('#loginScreen').classList.add('hidden');
  qs('#appShell').classList.remove('locked');
  setAuthMessage('');
}

function setAuthMessage(message, type = 'error') {
  const element = qs('#loginError');
  element.textContent = message;
  element.classList.toggle('success', type === 'success');
}

function setAuthMode(mode) {
  state.authMode = mode;
  const form = qs('#loginForm');
  form.reset();
  form.elements.mode.value = mode;
  form.elements.email.value = '';
  qsa('.auth-tab').forEach(button => button.classList.toggle('active', button.dataset.authMode === mode));
  qsa('[data-auth-extra]').forEach(field => {
    const name = field.dataset.authExtra;
    field.classList.toggle('hidden', (mode !== 'password' || name !== 'newPassword') && (mode !== 'register' || name !== 'confirmPassword'));
  });

  const password = form.elements.password;
  const newPassword = form.elements.newPassword;
  const confirmPassword = form.elements.confirmPassword;
  password.placeholder = mode === 'password' ? 'Senha atual' : 'Digite sua senha';
  password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  newPassword.required = mode === 'password';
  confirmPassword.required = mode === 'register';
  if (mode !== 'password') newPassword.value = '';
  if (mode !== 'register') confirmPassword.value = '';
  const labels = { login: 'Entrar', register: 'Criar conta', password: 'Trocar senha' };
  const icons = { login: 'fa-right-to-bracket', register: 'fa-user-plus', password: 'fa-key' };
  const button = form.querySelector('button[type="submit"]');
  button.innerHTML = `<i class="fa-solid ${icons[mode]}"></i><span>${labels[mode]}</span>`;
  setAuthMessage('');
}

async function submitLogin(event) {
  event.preventDefault();
  const button = event.submitter;
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  setAuthMessage('');
  const mode = data.mode || state.authMode;
  const labels = { login: 'Entrar', register: 'Criar conta', password: 'Trocar senha' };
  const icons = { login: 'fa-right-to-bracket', register: 'fa-user-plus', password: 'fa-key' };

  if (mode === 'register' && data.password !== data.confirmPassword) {
    setAuthMessage('As senhas nao conferem.');
    return;
  }
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Aguarde</span>';

  try {
    if (mode === 'password') {
      const loginPayload = await api('/api/login', { method: 'POST', body: JSON.stringify({ email: data.email, password: data.password }) });
      setSession(loginPayload);
      await api('/api/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: data.password, newPassword: data.newPassword })
      });
      clearSession();
      setAuthMode('login');
      form.elements.email.value = data.email;
      setAuthMessage('Senha trocada. Entre com a nova senha.', 'success');
      return;
    }

    const path = mode === 'register' ? '/api/register' : '/api/login';
    const payload = await api(path, { method: 'POST', body: JSON.stringify(data) });
    setSession(payload);
    form.reset();
    showApp();
    await loadDashboard();
  } catch (error) {
    const message = safeApiError(error.message);
    setAuthMessage(message || (mode === 'register' ? 'Nao foi possivel criar a conta.' : mode === 'password' ? 'Nao foi possivel trocar a senha.' : 'Email ou senha invalidos.'));
  } finally {
    button.disabled = false;
    button.innerHTML = `<i class="fa-solid ${icons[mode]}"></i><span>${labels[mode]}</span>`;
  }
}

function safeApiError(message) {
  try {
    return JSON.parse(message).error || '';
  } catch {
    return '';
  }
}

async function loginWithGoogle() {
  setAuthMessage('');
  window.location.href = '/api/auth/google';
}

async function logout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (error) {
    console.warn(error);
  }
  clearSession();
  state.data = null;
  showLogin('');
}

function renderAccountUser() {
  const label = qs('#accountEmail');
  if (!label) return;
  label.textContent = state.user?.email || state.user?.username || 'sem login';
}

async function initAuth() {
  if (!state.authToken) {
    showLogin('');
    return;
  }

  showApp();
  try {
    await loadDashboard();
  } catch (error) {
    console.error(error);
  }
}

function renderAll() {
  renderAccountUser();
  renderSummary();
  renderOverview();
  renderFinance();
  renderGoals();
  renderWork();
}

function renderSummary() {
  const { resumo } = state.data;
  qsa('[data-summary]').forEach(el => {
    const key = el.dataset.summary;
    const value = resumo[key];
    el.textContent = typeof value === 'number' && ['entradas', 'gastos', 'saldo', 'patrimonio', 'investimentos', 'cartoesTotal', 'bancoSaldo', 'bancoAberto', 'carteiraInvestimentos', 'contasSaldo', 'disponivelTotal'].includes(key)
      ? formatMoney(value)
      : value;
  });

  const total = Math.max(resumo.entradas + resumo.investimentos, resumo.gastos, 1);
  qs('#balanceTrack').style.width = `${Math.min(100, Math.max(6, (resumo.saldo / total) * 100))}%`;
}

function renderOverview() {
  const { transacoes, metas, trabalhos, resumo } = state.data;
  renderCategoryChart(resumo.porCategoria);

  qs('#goalPreview').innerHTML = metas.slice(0, 3).map(goalMiniTemplate).join('') || emptyTemplate('Nenhuma meta cadastrada.');
  qs('#latestTransactions').innerHTML = transacoes.slice(0, 4).map(transactionMiniTemplate).join('') || emptyTemplate('Nenhuma movimentacao registrada.');
  qs('#workPreview').innerHTML = trabalhos
    .filter(work => work.status !== 'concluido')
    .slice(0, 3)
    .map(workMiniTemplate)
    .join('') || emptyTemplate('Nenhum trabalho ativo.');
}

function renderCategoryChart(items) {
  const ctx = qs('#categoryChart');
  const values = items.map(item => item.valor);
  const labels = items.map(item => item.nome);
  const colors = labels.map((_, index) => categoryColors[index % categoryColors.length]);

  qs('#categoryLegend').innerHTML = items.map((item, index) => `
    <div class="legend-row">
      <span><span class="legend-dot" style="background:${colors[index]}"></span>${escapeHtml(item.nome)}</span>
      <strong>${formatMoney(item.valor)}</strong>
    </div>
  `).join('') || emptyTemplate('Sem gastos registrados.');

  if (!window.Chart || !ctx) return;
  if (state.chart) state.chart.destroy();

  state.chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values.length ? values : [1], backgroundColor: values.length ? colors : ['#2a2a28'], borderWidth: 0 }]
    },
    options: {
      cutout: '70%',
      plugins: { legend: { display: false } },
      animation: { duration: 500 }
    }
  });
}

function renderFinance() {
  renderFinancePrimaryAction();
  renderAccountsCards();
  renderInvestments();
  renderBank();

  const list = qs('#transactionsList');
  const base = state.transactionFilter === 'todos'
    ? state.data.transacoes
    : state.data.transacoes.filter(item => item.tipo === state.transactionFilter);
  const search = state.transactionSearch.trim().toLowerCase();
  const filtered = base
    .filter(item => state.transactionCategory === 'todas' || item.cat === state.transactionCategory)
    .filter(item => !search || `${item.nome} ${item.cat}`.toLowerCase().includes(search))
    .sort(sortTransactions);
  const total = filtered.reduce((sum, item) => sum + Number(item.val || 0), 0);

  renderFinanceInsights();
  renderMovementCategories(base);
  qs('#transactionsCount').textContent = `${filtered.length} ${filtered.length === 1 ? 'transacao' : 'transacoes'}`;
  qs('#transactionsTotal').textContent = formatMoney(total);
  list.innerHTML = filtered.map(transactionCardTemplate).join('') || emptyTemplate('Nenhuma transacao nesta categoria.');
}

function renderMovementCategories(transactions) {
  const byCategory = transactions.reduce((acc, item) => {
    const key = item.cat || 'Diversos';
    if (!acc[key]) acc[key] = { nome: key, total: 0, count: 0 };
    acc[key].total += Number(item.val || 0);
    acc[key].count += 1;
    return acc;
  }, {});
  const categories = Object.values(byCategory).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  const allTotal = transactions.reduce((sum, item) => sum + Number(item.val || 0), 0);

  qs('#categoryFilterLabel').textContent = state.transactionCategory === 'todas' ? 'Todas' : state.transactionCategory;
  qs('#movementCategories').innerHTML = [
    categoryChipTemplate({ nome: 'todas', label: 'Todas', total: allTotal, count: transactions.length }, 0),
    ...categories.map((item, index) => categoryChipTemplate(item, index + 1))
  ].join('');
}

function categoryChipTemplate(item, index) {
  const name = item.nome;
  const active = state.transactionCategory === name;
  const color = categoryColors[index % categoryColors.length];
  const label = item.label || name;
  return `
    <button class="category-chip ${active ? 'active' : ''}" data-category="${escapeHtml(name)}">
      <span class="legend-dot" style="background:${color}"></span>
      <strong>${escapeHtml(label)}</strong>
      <small>${item.count} ${item.count === 1 ? 'item' : 'itens'} · ${formatMoney(item.total)}</small>
    </button>
  `;
}

function renderFinancePrimaryAction() {
  const actions = {
    cards: { modal: 'account', label: 'Conta/cartao', icon: 'fa-credit-card' },
    movements: { modal: 'transaction', label: 'Transacao', icon: 'fa-plus' },
    investments: { modal: 'investment', label: 'Investimento', icon: 'fa-chart-line' },
    bank: { modal: 'bankDeposit', label: 'Guardar', icon: 'fa-arrow-down' }
  };
  const action = actions[state.financeTab] || actions.cards;
  const button = qs('#financePrimaryAction');
  button.dataset.modal = action.modal;
  button.innerHTML = `<i class="fa-solid ${action.icon}"></i><span>${action.label}</span>`;
}

function sortTransactions(a, b) {
  if (state.transactionSort === 'value-desc') return Math.abs(b.val) - Math.abs(a.val);
  if (state.transactionSort === 'value-asc') return Math.abs(a.val) - Math.abs(b.val);
  if (state.transactionSort === 'name') return a.nome.localeCompare(b.nome, 'pt-BR');
  return new Date(b.data) - new Date(a.data);
}

function renderFinanceInsights() {
  const transactions = state.data.transacoes;
  const expenses = transactions.filter(item => item.tipo === 'saida');
  const incomes = transactions.filter(item => item.tipo === 'entrada');
  const biggestExpense = [...expenses].sort((a, b) => Math.abs(b.val) - Math.abs(a.val))[0];
  const biggestIncome = [...incomes].sort((a, b) => Math.abs(b.val) - Math.abs(a.val))[0];
  const topCategory = [...state.data.resumo.porCategoria].sort((a, b) => b.valor - a.valor)[0];

  qs('#financeInsights').innerHTML = [
    insightTemplate('Maior gasto', biggestExpense?.nome || 'Sem gastos', biggestExpense ? `${biggestExpense.cat} · ${formatMoney(Math.abs(biggestExpense.val))}` : 'Nada registrado'),
    insightTemplate('Maior entrada', biggestIncome?.nome || 'Sem entradas', biggestIncome ? `${biggestIncome.cat} · ${formatMoney(biggestIncome.val)}` : 'Nada registrado'),
    insightTemplate('Categoria lider', topCategory?.nome || 'Sem categoria', topCategory ? formatMoney(topCategory.valor) : 'Nada registrado')
  ].join('');
}

function renderAccountsCards() {
  const items = state.data.contasCartoes;
  const accounts = items.filter(item => item.tipo === 'conta');
  const cards = items.filter(item => item.tipo === 'cartao');
  const accountBalance = accounts.reduce((sum, item) => sum + Number(item.saldo || 0), 0);
  const cardUsed = cards.reduce((sum, item) => sum + Number(item.usado || 0), 0);
  const cardLimit = cards.reduce((sum, item) => sum + Number(item.limite || 0), 0);
  const availableLimit = Math.max(0, cardLimit - cardUsed);

  qs('#accountsOverview').innerHTML = [
    insightTemplate('Saldo em contas', formatMoney(accountBalance), `${accounts.length} contas cadastradas`),
    insightTemplate('Faturas abertas', formatMoney(cardUsed), `${cards.length} cartoes cadastrados`),
    insightTemplate('Limite livre', formatMoney(availableLimit), `${cardLimit ? Math.round((availableLimit / cardLimit) * 100) : 0}% disponivel`)
  ].join('');
  qs('#accountsList').innerHTML = accounts.map(accountCardTemplate).join('') || emptyTemplate('Nenhuma conta cadastrada.');
  qs('#cardsList').innerHTML = cards.map(accountCardTemplate).join('') || emptyTemplate('Nenhum cartao cadastrado.');
}

function renderInvestments() {
  const investments = state.data.investimentosCarteira;
  const total = investments.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const rendimento = investments.reduce((sum, item) => sum + (Number(item.valor || 0) * Number(item.rendimento || 0) / 100), 0);
  const top = investments.length ? [...investments].sort((a, b) => b.valor - a.valor)[0] : null;
  const avgYield = total > 0 ? (investments.reduce((sum, item) => sum + (Number(item.valor || 0) * Number(item.rendimento || 0)), 0) / total) : 0;

  qs('#investmentHero').innerHTML = `
    <article class="investment-hero-card primary">
      <span>Total investido</span>
      <strong class="blue">${formatMoney(total)}</strong>
      <small>${investments.length} ativos cadastrados na carteira</small>
    </article>
    <article class="investment-hero-card">
      <span>Rendimento mensal</span>
      <strong class="green">${formatMoney(rendimento)}</strong>
      <small>media ponderada de ${avgYield.toFixed(2)}%</small>
    </article>
    <article class="investment-hero-card">
      <span>Maior posicao</span>
      <strong>${escapeHtml(top?.nome || 'Sem ativo')}</strong>
      <small>${top ? formatMoney(top.valor) : 'Nada registrado'}</small>
    </article>
  `;

  renderInvestmentCharts(investments, total);
  qs('#investmentsList').innerHTML = investments.map(investmentCardTemplate).join('') || emptyTemplate('Cadastre seu primeiro investimento.');
}

function renderInvestmentCharts(investments, total) {
  const byType = investments.reduce((acc, item) => {
    const key = item.tipo || 'Outros';
    acc[key] = (acc[key] || 0) + Number(item.valor || 0);
    return acc;
  }, {});
  const typeItems = Object.entries(byType).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  const labels = typeItems.map(item => item.nome);
  const values = typeItems.map(item => item.valor);
  const colors = labels.map((_, index) => categoryColors[index % categoryColors.length]);

  qs('#investmentTypeLegend').innerHTML = typeItems.map((item, index) => `
    <div class="legend-row">
      <span><span class="legend-dot" style="background:${colors[index]}"></span>${escapeHtml(item.nome)}</span>
      <strong>${formatMoney(item.valor)}</strong>
    </div>
  `).join('') || emptyTemplate('Sem ativos para distribuir.');

  const ctx = qs('#investmentTypeChart');
  if (window.Chart && ctx) {
    if (state.investmentChart) state.investmentChart.destroy();
    state.investmentChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values.length ? values : [1], backgroundColor: values.length ? colors : ['#2a2a28'], borderWidth: 0 }]
      },
      options: {
        cutout: '72%',
        plugins: { legend: { display: false } },
        animation: { duration: 500 }
      }
    });
  }

  qs('#investmentBars').innerHTML = [...investments]
    .sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0))
    .slice(0, 5)
    .map(item => {
      const pct = total > 0 ? Math.round((Number(item.valor || 0) / total) * 100) : 0;
      return `
        <div class="investment-bar-row">
          <div>
            <strong>${escapeHtml(item.nome)}</strong>
            <span>${pct}% da carteira</span>
          </div>
          <b>${formatMoney(item.valor)}</b>
          <div class="progress-line"><span style="width:${pct}%"></span></div>
        </div>
      `;
    }).join('') || emptyTemplate('Sem ativos cadastrados.');
}

function renderBank() {
  const banco = state.data.banco || { saldo: 0, retiradas: [] };
  const openTotal = banco.retiradas
    .filter(item => item.status === 'aberto')
    .reduce((sum, item) => sum + Number(item.totalDevolver || 0), 0);

  qs('#bankBalance').textContent = formatMoney(banco.saldo);
  qs('#bankOpenTotal').textContent = `${formatMoney(openTotal)} em aberto`;
  qs('#bankWithdrawalsList').innerHTML = banco.retiradas.map(bankWithdrawalTemplate).join('') || emptyTemplate('Nenhuma retirada feita ainda.');
}

function insightTemplate(label, title, detail) {
  return `
    <article class="insight-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(detail)}</small>
    </article>
  `;
}

function renderGoals() {
  const goals = state.data.metas;
  const target = goals.reduce((sum, item) => sum + Number(item.target || 0), 0);
  const current = goals.reduce((sum, item) => sum + Number(item.atual || 0), 0);
  const remaining = Math.max(0, target - current);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  qs('#goalsOverview').innerHTML = `
    <article class="goal-summary-card primary">
      <span>Progresso geral</span>
      <strong>${pct}%</strong>
      <small>${formatMoney(current)} acumulados de ${formatMoney(target)}</small>
      <div class="progress-line"><span style="width:${pct}%;background:linear-gradient(90deg,var(--green),var(--blue))"></span></div>
    </article>
    <article class="goal-summary-card">
      <span>Falta guardar</span>
      <strong>${formatMoney(remaining)}</strong>
      <small>${goals.length} metas ativas</small>
    </article>
    <article class="goal-summary-card">
      <span>Concluidas</span>
      <strong>${goals.filter(item => Number(item.atual) >= Number(item.target)).length}</strong>
      <small>objetivos batidos</small>
    </article>
  `;
  qs('#goalsList').innerHTML = state.data.metas.map(goalCardTemplate).join('') || emptyTemplate('Cadastre sua primeira meta.');
}

function renderWork() {
  const works = state.data.trabalhos;
  const active = works.filter(work => work.status === 'ativo');
  const pending = works.filter(work => work.status === 'andamento');
  const done = works.filter(work => work.status === 'concluido');
  const activeWorks = works.filter(work => work.status !== 'concluido');
  const revenue = activeWorks.reduce((sum, work) => sum + Number(work.salario || 0), 0);
  const hours = activeWorks.reduce((sum, work) => sum + Number(work.horas || 0), 0);
  const hourly = revenue / Math.max(hours, 1);

  qs('#workOverview').innerHTML = `
    <article class="work-summary-card primary">
      <span>Renda ativa</span>
      <strong class="green">${formatMoney(revenue)}</strong>
      <small>${activeWorks.length} trabalhos gerando receita</small>
    </article>
    <article class="work-summary-card">
      <span>Horas por mes</span>
      <strong>${hours}h</strong>
      <small>carga ativa estimada</small>
    </article>
    <article class="work-summary-card">
      <span>Media por hora</span>
      <strong class="blue">${formatMoney(hourly)}</strong>
      <small>renda dividida pelas horas</small>
    </article>
    <article class="work-summary-card">
      <span>Concluidos</span>
      <strong>${done.length}</strong>
      <small>historico encerrado</small>
    </article>
  `;

  qs('#activeWorkList').innerHTML = active.map(workCardTemplate).join('') || emptyTemplate('Nenhum trabalho ativo.');
  qs('#pendingWorkList').innerHTML = pending.map(workCardTemplate).join('') || emptyTemplate('Nada em andamento.');
  qs('#doneWorkList').innerHTML = done.map(workCardTemplate).join('') || emptyTemplate('Nenhum concluido.');
}

function transactionMiniTemplate(item) {
  const style = transactionStyle(item.tipo);
  return `
    <div class="mini-item">
      <div class="mini-top">
        <strong>${escapeHtml(item.nome)}</strong>
        <span style="color:${style.color}">${item.val > 0 ? '+' : '-'}${formatMoney(Math.abs(item.val))}</span>
      </div>
      <div class="mini-sub">${escapeHtml(item.cat)} · ${escapeHtml(item.data)}</div>
    </div>
  `;
}

function goalMiniTemplate(goal) {
  const pct = Math.min(100, Math.round((Number(goal.atual) / Math.max(Number(goal.target), 1)) * 100));
  return `
    <div class="mini-item">
      <div class="mini-top"><strong>${escapeHtml(goal.nome)}</strong><span>${pct}%</span></div>
      <div class="bar"><span style="width:${pct}%;background:${goal.cor}"></span></div>
      <div class="mini-sub">${formatMoney(goal.atual)} de ${formatMoney(goal.target)}</div>
    </div>
  `;
}

function workMiniTemplate(work) {
  return `
    <div class="mini-item">
      <div class="mini-top"><strong>${escapeHtml(work.nome)}</strong><span>${formatMoney(work.salario)}</span></div>
      <div class="mini-sub">${escapeHtml(work.tipo)} · ${work.horas}h/mes · ${escapeHtml(work.status)}</div>
    </div>
  `;
}

function transactionCardTemplate(item) {
  const style = transactionStyle(item.tipo);
  return `
    <article class="list-card">
      <div class="card-icon" style="background:${style.bg};color:${style.color}"><i class="fa-solid ${escapeHtml(item.icon)}"></i></div>
      <div class="card-main">
        <strong>${escapeHtml(item.nome)}</strong>
        <span>${escapeHtml(item.cat)} · ${escapeHtml(item.data)} · ${escapeHtml(item.tipo)}</span>
        <span class="card-note">${item.tipo === 'saida' ? 'Despesa lancada no fluxo mensal' : item.tipo === 'investimento' ? 'Valor separado para patrimonio' : 'Receita adicionada ao saldo'}</span>
      </div>
      <div class="card-value" style="color:${style.color}">${item.val > 0 ? '+' : '-'}${formatMoney(Math.abs(item.val))}</div>
      <button class="delete-button" data-delete="transacoes" data-id="${item.id}" aria-label="Excluir transacao"><i class="fa-regular fa-trash-can"></i></button>
    </article>
  `;
}

function accountCardTemplate(item) {
  const isCard = item.tipo === 'cartao';
  const balance = Number(item.saldo || 0);
  const used = Number(item.usado || 0);
  const limit = Number(item.limite || 0);
  const pct = isCard && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return `
    <article class="account-card">
      <div class="account-card-head">
        <div class="account-card-title">
          <strong>${escapeHtml(item.nome)}</strong>
          <span>${escapeHtml(item.bandeira)} · ${isCard ? `vence dia ${item.vencimento}` : 'conta corrente'}</span>
        </div>
        <div class="account-actions">
          <button class="delete-button" data-edit-account="${item.id}" aria-label="Editar conta ou cartao"><i class="fa-regular fa-pen-to-square"></i></button>
          <button class="delete-button" data-delete="contas-cartoes" data-id="${item.id}" aria-label="Excluir conta ou cartao"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>
      <div>
        <div class="account-amount ${isCard ? 'red' : 'green'}">${isCard ? formatMoney(used) : formatMoney(balance)}</div>
        <div class="account-card-detail">${isCard ? `de ${formatMoney(limit)} de limite` : 'saldo disponivel'}</div>
        ${isCard ? `<div class="progress-line"><span style="width:${pct}%"></span></div>` : ''}
      </div>
    </article>
  `;
}

function investmentCardTemplate(item) {
  const estimated = Number(item.valor || 0) * Number(item.rendimento || 0) / 100;
  return `
    <article class="investment-card">
      <div class="investment-card-head">
        <div class="investment-card-title">
          <strong>${escapeHtml(item.nome)}</strong>
          <span>${escapeHtml(item.tipo)} · ${escapeHtml(item.data)}</span>
        </div>
        <button class="delete-button" data-delete="investimentos" data-id="${item.id}" aria-label="Excluir investimento"><i class="fa-regular fa-trash-can"></i></button>
      </div>
      <div class="investment-amount blue">${formatMoney(item.valor)}</div>
      <div class="investment-meta">
        <span>Taxa ${Number(item.rendimento || 0)}%</span>
        <strong class="green">${formatMoney(estimated)}</strong>
      </div>
    </article>
  `;
}

function bankWithdrawalTemplate(item) {
  const isOpen = item.status === 'aberto';
  return `
    <article class="list-card">
      <div class="card-icon" style="background:${isOpen ? 'rgba(240,180,60,.12)' : 'rgba(46,204,138,.12)'};color:${isOpen ? 'var(--yellow)' : 'var(--green)'}"><i class="fa-solid ${isOpen ? 'fa-arrow-up' : 'fa-check'}"></i></div>
      <div class="card-main">
        <strong>Retirada de ${formatMoney(item.valor)}</strong>
        <span>${escapeHtml(item.data)} · juros de ${formatMoney(item.juros)} · devolver ${formatMoney(item.totalDevolver)}</span>
        <span class="card-note">${isOpen ? 'Em aberto no Meu Banco' : `Devolvido em ${escapeHtml(item.dataDevolucao || '')}`}</span>
      </div>
      <span class="badge">${isOpen ? 'Aberto' : 'Devolvido'}</span>
      ${isOpen ? `<button class="pill-button" data-bank-return="${item.id}"><i class="fa-solid fa-rotate-left"></i><span>Devolver</span></button>` : '<span></span>'}
    </article>
  `;
}

function goalCardTemplate(goal) {
  const pct = Math.min(100, Math.round((Number(goal.atual) / Math.max(Number(goal.target), 1)) * 100));
  const remaining = Math.max(0, Number(goal.target || 0) - Number(goal.atual || 0));
  return `
    <article class="list-card">
      <div class="card-icon" style="background:${goal.cor}22;color:${goal.cor}"><i class="fa-regular fa-circle-dot"></i></div>
      <div class="card-main">
        <strong>${escapeHtml(goal.nome)}</strong>
        <span>${formatMoney(goal.atual)} de ${formatMoney(goal.target)} · ${escapeHtml(goal.deadline)}</span>
        <span class="card-note">Falta ${formatMoney(remaining)}</span>
        <div class="bar" style="margin-top:8px"><span style="width:${pct}%;background:${goal.cor}"></span></div>
      </div>
      <span class="badge">${pct}%</span>
      <button class="delete-button" data-edit-goal="${goal.id}" aria-label="Editar meta"><i class="fa-regular fa-pen-to-square"></i></button>
      <button class="delete-button" data-delete="metas" data-id="${goal.id}" aria-label="Excluir meta"><i class="fa-regular fa-trash-can"></i></button>
    </article>
  `;
}

function workCardTemplate(work) {
  const statusLabels = { ativo: 'Ativo', andamento: 'Em andamento', concluido: 'Concluido' };
  const hourly = Number(work.salario || 0) / Math.max(Number(work.horas || 1), 1);
  return `
    <article class="work-card">
      <div class="work-card-head">
        <div class="work-card-title">
          <strong>${escapeHtml(work.nome)}</strong>
          <span>${escapeHtml(work.tipo)} · desde ${escapeHtml(work.inicio)}</span>
        </div>
        <div class="account-actions">
          <button class="delete-button" data-edit-work="${work.id}" aria-label="Editar trabalho"><i class="fa-regular fa-pen-to-square"></i></button>
          <button class="delete-button" data-delete="trabalhos" data-id="${work.id}" aria-label="Excluir trabalho"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>
      <div class="work-money">${formatMoney(work.salario)}</div>
      <div class="work-metrics">
        <span>${work.horas}h/mes</span>
        <span>${formatMoney(hourly)}/hora</span>
      </div>
      <span class="badge">${statusLabels[work.status] || work.status}</span>
    </article>
  `;
}

function emptyTemplate(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

function setPage(page) {
  state.page = page;
  qsa('.view').forEach(view => view.classList.toggle('active', view.id === `view-${page}`));
  qsa('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
  qs('#pageTitle').textContent = pages[page].title;
  qs('#pageSubtitle').textContent = pages[page].subtitle;
  qs('#sidebar').classList.remove('mobile-open');
  qs('#overlay').classList.remove('show');
}

function setFinanceTab(tabName) {
  state.financeTab = tabName;
  qsa('.finance-tab').forEach(button => button.classList.toggle('active', button.dataset.financeTab === tabName));
  qsa('.finance-panel').forEach(panel => panel.classList.toggle('active', panel.id === `finance-tab-${tabName}`));
  renderFinancePrimaryAction();
}

function openModal(type, editItem = null) {
  state.modalType = type;
  state.editing = editItem ? { type, id: editItem.id } : null;
  const dialog = qs('#entityDialog');
  const title = qs('#dialogTitle');
  const fields = qs('#formFields');
  const today = new Date().toISOString().slice(0, 10);

  if (type === 'transaction') {
    title.textContent = 'Nova transacao';
    fields.innerHTML = `
      ${field('nome', 'Nome', 'text', 'Ex: Mercado', true)}
      <label>Categoria
        <select name="cat">
          ${movementCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
        </select>
      </label>
      <label>Tipo<select name="tipo"><option value="entrada">Entrada</option><option value="saida">Saida</option><option value="investimento">Investimento</option></select></label>
      ${field('val', 'Valor', 'number', '0', true)}
      ${field('data', 'Data', 'date', today, true)}
    `;
  }

  if (type === 'goal') {
    const item = editItem || {};
    title.textContent = editItem ? 'Editar meta' : 'Nova meta';
    fields.innerHTML = `
      <div class="form-section-title">Objetivo</div>
      ${field('nome', 'Nome', 'text', item.nome || 'Ex: Reserva', true)}
      ${field('deadline', 'Prazo', 'text', item.deadline || 'Dez 2026', false)}
      <div class="form-section-title">Valores</div>
      ${field('target', 'Valor alvo', 'number', item.target ?? '0', true)}
      ${field('atual', 'Valor atual', 'number', item.atual ?? '0', false)}
      ${field('cor', 'Cor', 'color', item.cor || '#4a9eff', false)}
    `;
  }

  if (type === 'work') {
    const item = editItem || {};
    title.textContent = editItem ? 'Editar trabalho' : 'Novo trabalho';
    fields.innerHTML = `
      <div class="form-section-title">Dados do trabalho</div>
      ${field('nome', 'Nome', 'text', item.nome || 'Ex: Cliente X', true)}
      ${field('tipo', 'Tipo', 'text', item.tipo || 'Freelancer', true)}
      <label>Status<select name="status"><option value="ativo" ${item.status === 'ativo' ? 'selected' : ''}>Ativo</option><option value="andamento" ${item.status === 'andamento' ? 'selected' : ''}>Em andamento</option><option value="concluido" ${item.status === 'concluido' ? 'selected' : ''}>Concluido</option></select></label>
      <div class="form-section-title">Renda e carga</div>
      ${field('salario', 'Receita mensal', 'number', item.salario ?? '0', true)}
      ${field('horas', 'Horas por mes', 'number', item.horas ?? '1', true)}
      ${field('inicio', 'Inicio', 'date', item.inicio || today, true)}
    `;
  }

  if (type === 'account') {
    const item = editItem || {};
    title.textContent = editItem ? 'Editar conta ou cartao' : 'Nova conta ou cartao';
    fields.innerHTML = `
      ${field('nome', 'Nome', 'text', item.nome || 'Ex: Nubank', true)}
      <label>Tipo<select name="tipo"><option value="cartao" ${item.tipo === 'cartao' ? 'selected' : ''}>Cartao</option><option value="conta" ${item.tipo === 'conta' ? 'selected' : ''}>Conta</option></select></label>
      ${field('bandeira', 'Banco ou bandeira', 'text', item.bandeira || 'Mastercard', false)}
      ${field('saldo', 'Saldo da conta', 'number', item.saldo ?? '0', false)}
      ${field('limite', 'Limite do cartao', 'number', item.limite ?? '0', false)}
      ${field('usado', 'Valor usado no cartao', 'number', item.usado ?? '0', false)}
      ${field('vencimento', 'Vencimento', 'number', item.vencimento ?? '1', false)}
    `;
  }

  if (type === 'investment') {
    title.textContent = 'Novo investimento';
    fields.innerHTML = `
      <div class="form-section-title">Dados do ativo</div>
      ${field('nome', 'Nome do investimento', 'text', 'Tesouro Selic 2029', true)}
      <label>Tipo
        <select name="tipo">
          <option value="Renda fixa">Renda fixa</option>
          <option value="Acoes">Acoes</option>
          <option value="Fundos">Fundos</option>
          <option value="Cripto">Cripto</option>
          <option value="Reserva">Reserva</option>
          <option value="Outros">Outros</option>
        </select>
      </label>
      <div class="form-section-title">Valores</div>
      ${field('valor', 'Valor aplicado', 'number', '0', true)}
      ${field('rendimento', 'Rendimento estimado ao mes (%)', 'number', '0', false)}
      ${field('data', 'Data da aplicacao', 'date', today, true)}
    `;
  }

  if (type === 'bankDeposit') {
    title.textContent = 'Guardar no Meu Banco';
    fields.innerHTML = `${field('valor', 'Valor para guardar', 'number', '0', true)}`;
  }

  if (type === 'bankWithdraw') {
    title.textContent = 'Retirar do Meu Banco';
    fields.innerHTML = `${field('valor', 'Valor da retirada', 'number', '0', true)}`;
  }

  dialog.showModal();
}

function field(name, label, type, value, required) {
  return `<label>${label}<input name="${name}" type="${type}" value="${value}" ${required ? 'required' : ''}></label>`;
}

async function submitModal(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitter = event.submitter;
  if (submitter?.value === 'cancel') return qs('#entityDialog').close();

  const data = Object.fromEntries(new FormData(form).entries());
  const paths = {
    transaction: '/api/transacoes',
    goal: '/api/metas',
    work: '/api/trabalhos',
    account: '/api/contas-cartoes',
    investment: '/api/investimentos',
    bankDeposit: '/api/banco/depositar',
    bankWithdraw: '/api/banco/retirar'
  };
  const editing = state.editing;
  const method = editing ? 'PUT' : 'POST';
  const path = editing && editing.type === 'account'
    ? `/api/contas-cartoes/${editing.id}`
    : editing && editing.type === 'goal'
      ? `/api/metas/${editing.id}`
      : editing && editing.type === 'work'
        ? `/api/trabalhos/${editing.id}`
      : paths[state.modalType];
  await api(path, { method, body: JSON.stringify(data) });
  state.editing = null;
  qs('#entityDialog').close();
  await loadDashboard();
}

async function deleteEntity(collection, id) {
  await api(`/api/${collection}/${id}`, { method: 'DELETE' });
  await loadDashboard();
}

async function returnBankWithdrawal(id) {
  await api(`/api/banco/devolver/${id}`, { method: 'POST' });
  await loadDashboard();
}

function editAccount(id) {
  const item = state.data.contasCartoes.find(account => account.id === id);
  if (item) openModal('account', item);
}

function editGoal(id) {
  const item = state.data.metas.find(goal => goal.id === id);
  if (item) openModal('goal', item);
}

function editWork(id) {
  const item = state.data.trabalhos.find(work => work.id === id);
  if (item) openModal('work', item);
}

function bindEvents() {
  qs('#loginForm').addEventListener('submit', submitLogin);
  qs('#googleLoginButton').addEventListener('click', loginWithGoogle);
  qsa('.auth-tab').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
  qs('#logoutButton').addEventListener('click', logout);
  qsa('.nav-item').forEach(item => item.addEventListener('click', () => setPage(item.dataset.page)));
  qsa('[data-go]').forEach(item => item.addEventListener('click', () => setPage(item.dataset.go)));
  qsa('[data-modal]').forEach(button => button.addEventListener('click', () => openModal(button.dataset.modal)));
  qsa('.finance-tab').forEach(button => {
    button.addEventListener('click', () => setFinanceTab(button.dataset.financeTab));
  });
  qsa('.filter').forEach(button => {
    button.addEventListener('click', () => {
      state.transactionFilter = button.dataset.filter;
      state.transactionCategory = 'todas';
      qsa('.filter').forEach(item => item.classList.toggle('active', item === button));
      renderFinance();
    });
  });

  qs('#transactionSearch').addEventListener('input', event => {
    state.transactionSearch = event.target.value;
    renderFinance();
  });

  qs('#transactionSort').addEventListener('change', event => {
    state.transactionSort = event.target.value;
    renderFinance();
  });

  qs('#refreshButton').addEventListener('click', loadDashboard);
  qs('#sidebarToggle').addEventListener('click', () => qs('#sidebar').classList.toggle('collapsed'));
  qs('#menuButton').addEventListener('click', () => {
    qs('#sidebar').classList.add('mobile-open');
    qs('#overlay').classList.add('show');
  });
  qs('#overlay').addEventListener('click', () => {
    qs('#sidebar').classList.remove('mobile-open');
    qs('#overlay').classList.remove('show');
  });
  qs('#entityForm').addEventListener('submit', submitModal);

  document.body.addEventListener('click', event => {
    const categoryButton = event.target.closest('[data-category]');
    if (categoryButton) {
      state.transactionCategory = categoryButton.dataset.category;
      renderFinance();
      return;
    }

    const editAccountButton = event.target.closest('[data-edit-account]');
    if (editAccountButton) {
      editAccount(editAccountButton.dataset.editAccount);
      return;
    }

    const editGoalButton = event.target.closest('[data-edit-goal]');
    if (editGoalButton) {
      editGoal(editGoalButton.dataset.editGoal);
      return;
    }

    const editWorkButton = event.target.closest('[data-edit-work]');
    if (editWorkButton) {
      editWork(editWorkButton.dataset.editWork);
      return;
    }

    const returnButton = event.target.closest('[data-bank-return]');
    if (returnButton) {
      returnBankWithdrawal(returnButton.dataset.bankReturn);
      return;
    }

    const button = event.target.closest('[data-delete]');
    if (!button) return;
    deleteEntity(button.dataset.delete, button.dataset.id);
  });
}

bindEvents();
initAuth();
