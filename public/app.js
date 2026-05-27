const state = {
  data: null,
  page: 'overview',
  financeTab: 'account',
  transactionFilter: 'todos',
  transactionCategory: 'todas',
  transactionSearch: '',
  transactionSort: 'recent',
  chart: null,
  overviewInvestmentChart: null,
  investmentChart: null,
  modalType: null,
  editing: null,
  gmailStatus: null,
  gmailMessages: [],
  authMode: 'login',
  authToken: localStorage.getItem('lasttroToken') || '',
  user: JSON.parse(localStorage.getItem('lasttroUser') || 'null')
};

const pages = {
  overview: { title: 'Visao geral', subtitle: 'maio de 2026' },
  finance: { title: 'Financeiro', subtitle: 'entradas, saidas e investimentos' },
  goals: { title: 'Metas', subtitle: 'objetivos e progresso' },
  work: { title: 'Faculdade', subtitle: 'provas, trabalhos e anotacoes' },
  email: { title: 'Email', subtitle: 'atalhos e mensagens pelo Gmail' }
};

const categoryColors = ['#ff7a45', '#00c4b4', '#8b6fff', '#f0b43c', '#4a9eff', '#2ecc8a'];
const transactionCategories = {
  entrada: ['Salario', 'Freela', 'Renda extra', 'Reembolso', 'Presente', 'Outros'],
  saida: ['Alimentacao', 'Transporte', 'Saude', 'Educacao', 'Lazer', 'Casa', 'Pessoal', 'Outros']
};
const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function formatMoney(value) {
  return money.format(Number(value || 0));
}

function parseDecimal(value) {
  if (typeof value === 'number') return value;
  const raw = String(value || '').trim();
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyValue(value) {
  return Number(parseDecimal(value).toFixed(2));
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
  if (state.data.user) {
    state.user = state.data.user;
    localStorage.setItem('lasttroUser', JSON.stringify(state.user));
  }
  await loadGmailStatus();
  renderAll();
}

async function loadGmailStatus() {
  try {
    state.gmailStatus = await api('/api/gmail/status');
    if (state.gmailStatus.connected) {
      const payload = await api('/api/gmail/messages');
      state.gmailMessages = payload.messages || [];
    } else {
      state.gmailMessages = [];
    }
  } catch (error) {
    console.warn(error);
    state.gmailStatus = { connected: false, error: safeApiError(error.message) || 'Nao foi possivel conectar ao Gmail' };
    state.gmailMessages = [];
  }
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

function openSettings() {
  qs('#settingsDialog')?.showModal();
}

function closeSettings() {
  qs('#settingsDialog')?.close();
}

async function openPasswordSettings() {
  closeSettings();
  await logout();
  setAuthMode('password');
}

async function logoutFromSettings() {
  closeSettings();
  await logout();
}

function renderAccountUser() {
  const label = qs('#accountEmail');
  if (label) label.textContent = state.user?.email || state.user?.username || 'sem login';
  renderAccountAvatar();
}

function renderAccountAvatar() {
  const avatar = state.user?.avatar || '';
  [qs('#accountAvatar'), qs('#settingsAvatar')].forEach(element => {
    if (!element) return;
    element.replaceChildren();
    if (avatar) {
      const image = document.createElement('img');
      image.src = avatar;
      image.alt = 'Foto da conta';
      element.appendChild(image);
      return;
    }
    const icon = document.createElement('i');
    icon.className = 'fa-regular fa-user';
    element.appendChild(icon);
  });
}

function resizeProfileImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      reject(new Error('Formato de imagem invalido.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 420;
        const scale = Math.min(size / image.width, size / image.height, 1);
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => reject(new Error('Nao foi possivel carregar a imagem.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

async function saveProfileAvatar(avatar) {
  const payload = await api('/api/profile', {
    method: 'POST',
    body: JSON.stringify({ avatar })
  });
  state.user = payload.user;
  localStorage.setItem('lasttroUser', JSON.stringify(state.user));
  renderAccountUser();
}

async function changeProfilePhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const avatar = await resizeProfileImage(file);
    await saveProfileAvatar(avatar);
  } catch (error) {
    alert(safeApiError(error.message) || error.message || 'Nao foi possivel salvar a foto.');
  } finally {
    event.target.value = '';
  }
}

async function removeProfilePhoto() {
  try {
    await saveProfileAvatar('');
  } catch (error) {
    alert(safeApiError(error.message) || 'Nao foi possivel remover a foto.');
  }
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
  renderEmail();
  renderSmartSuggestions();
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

  const total = Math.max(resumo.saldo, resumo.gastos, resumo.patrimonio, 1);
  qs('#balanceTrack').style.width = `${Math.min(100, Math.max(6, (resumo.saldo / total) * 100))}%`;
}

function renderOverview() {
  const { transacoes, metas, trabalhos, resumo, investimentosCarteira } = state.data;
  renderCategoryChart(resumo.porCategoria);
  renderOverviewInvestmentChart(investimentosCarteira);

  qs('#goalPreview').innerHTML = metas.slice(0, 3).map(goalMiniTemplate).join('') || emptyTemplate('Nenhuma meta cadastrada.');
  qs('#latestTransactions').innerHTML = transacoes.slice(0, 4).map(transactionMiniTemplate).join('') || emptyTemplate('Nenhuma movimentacao registrada.');
  qs('#workPreview').innerHTML = trabalhos
    .filter(work => work.status !== 'concluido')
    .slice(0, 3)
    .map(workMiniTemplate)
    .join('') || emptyTemplate('Nenhum item da faculdade.');
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

function investmentTypeItems(investments) {
  const byType = investments.reduce((acc, item) => {
    const key = item.tipo || 'Outros';
    acc[key] = (acc[key] || 0) + Number(item.valor || 0);
    return acc;
  }, {});
  return Object.entries(byType)
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);
}

function renderOverviewInvestmentChart(investments) {
  const items = investmentTypeItems(investments);
  const labels = items.map(item => item.nome);
  const values = items.map(item => item.valor);
  const colors = labels.map((_, index) => categoryColors[(index + 2) % categoryColors.length]);

  qs('#overviewInvestmentLegend').innerHTML = items.map((item, index) => `
    <div class="legend-row">
      <span><span class="legend-dot" style="background:${colors[index]}"></span>${escapeHtml(item.nome)}</span>
      <strong>${formatMoney(item.valor)}</strong>
    </div>
  `).join('') || emptyTemplate('Sem investimentos registrados.');

  const ctx = qs('#overviewInvestmentChart');
  if (!window.Chart || !ctx) return;
  if (state.overviewInvestmentChart) state.overviewInvestmentChart.destroy();

  state.overviewInvestmentChart = new Chart(ctx, {
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
  const movementTransactions = state.data.transacoes.filter(item => item.tipo !== 'investimento');
  const base = state.transactionFilter === 'todos'
    ? movementTransactions
    : movementTransactions.filter(item => item.tipo === state.transactionFilter);
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
  renderMonthlyStatements();
}

function buildSmartSuggestions() {
  if (!state.data) return [];
  const resumo = state.data.resumo || {};
  const suggestions = [];
  if (Number(resumo.saldo || 0) > 0) {
    suggestions.push({
      icon: 'fa-chart-line',
      title: 'Que tal investir hoje?',
      text: `Voce tem ${formatMoney(resumo.saldo)} de saldo. Separar uma parte pequena ja melhora seu patrimonio.`
    });
  }
  if (Number(resumo.gastos || 0) > Number(resumo.entradas || 0)) {
    suggestions.push({
      icon: 'fa-triangle-exclamation',
      title: 'Gastos acima das entradas',
      text: 'Vale revisar as saidas deste mes antes de criar novas compras.'
    });
  }
  const nextWork = [...(state.data.trabalhos || [])]
    .filter(item => item.status !== 'concluido' && item.inicio)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))[0];
  if (nextWork) {
    suggestions.push({
      icon: 'fa-graduation-cap',
      title: 'Prazo de faculdade chegando',
      text: `${nextWork.nome} esta marcado para ${new Date(`${nextWork.inicio}T00:00:00`).toLocaleDateString('pt-BR')}.`
    });
  }
  if (!suggestions.length) {
    suggestions.push({ icon: 'fa-sparkles', title: 'Tudo organizado', text: 'Seu painel esta tranquilo hoje. Continue alimentando os dados.' });
  }
  return suggestions.slice(0, 4);
}

function renderSmartSuggestions() {
  const suggestions = buildSmartSuggestions();
  const panel = qs('#smartPanel');
  if (panel) {
    panel.innerHTML = `
      <div>
        <span>LASTTRO recomenda</span>
        <strong>${escapeHtml(suggestions[0].title)}</strong>
        <small>${escapeHtml(suggestions[0].text)}</small>
      </div>
      <button class="pill-button" type="button" data-go="finance"><i class="fa-solid fa-arrow-right"></i><span>Ver financeiro</span></button>
    `;
  }
  qs('#notificationCount').textContent = String(suggestions.length);
  const popout = qs('#notificationPopout');
  if (popout) {
    popout.innerHTML = `
      <div class="notification-head"><strong>Notificacoes</strong><button class="icon-button" id="closeNotifications" type="button"><i class="fa-solid fa-xmark"></i></button></div>
      ${suggestions.map(item => `
        <article>
          <i class="fa-solid ${item.icon}"></i>
          <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.text)}</small></span>
        </article>
      `).join('')}
    `;
  }
}

function showToast(title, text) {
  const stack = qs('#toastStack');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><small>${escapeHtml(text)}</small>`;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

function renderMonthlyStatements() {
  const container = qs('#monthlyStatements');
  if (!container) return;
  const groups = state.data.transacoes.filter(item => item.tipo !== 'investimento').reduce((acc, item) => {
    const month = String(item.data || '').slice(0, 7) || 'sem-data';
    if (!acc[month]) acc[month] = { mes: month, entradas: 0, saidas: 0, total: 0, count: 0 };
    const value = Number(item.val || 0);
    if (item.tipo === 'entrada') acc[month].entradas += value;
    if (item.tipo === 'saida') acc[month].saidas += Math.abs(value);
    acc[month].total += value;
    acc[month].count += 1;
    return acc;
  }, {});
  const statements = Object.values(groups).sort((a, b) => b.mes.localeCompare(a.mes)).slice(0, 6);
  container.innerHTML = statements.map(statementTemplate).join('') || emptyTemplate('Nenhuma movimentacao para gerar extrato.');
}

function statementTemplate(item) {
  const label = item.mes === 'sem-data' ? 'Sem data' : new Date(`${item.mes}-02`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return `
    <article class="statement-card">
      <strong>${escapeHtml(label)}</strong>
      <span>${item.count} ${item.count === 1 ? 'movimentacao' : 'movimentacoes'}</span>
      <div><small>Entradas</small><b class="positive">${formatMoney(item.entradas)}</b></div>
      <div><small>Saidas</small><b class="negative">${formatMoney(item.saidas)}</b></div>
      <footer>Resultado ${formatMoney(item.total)}</footer>
    </article>
  `;
}

function updateTransactionCategoryOptions() {
  const select = qs('#transactionCategorySelect');
  if (!select) return;
  const form = qs('#entityForm');
  const type = new FormData(form).get('tipo') || 'saida';
  const selected = select.value;
  const categories = transactionCategories[type] || transactionCategories.saida;
  select.innerHTML = categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  if (categories.includes(selected)) select.value = selected;
  toggleCustomCategoryField();
}

function toggleCustomCategoryField() {
  const select = qs('#transactionCategorySelect');
  const customField = qs('#customCategoryField');
  if (!select || !customField) return;
  customField.classList.toggle('hidden', select.value !== 'Outros');
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
    account: { modal: 'account', label: 'Banco', icon: 'fa-credit-card' },
    movements: { modal: 'transaction', label: 'Transacao', icon: 'fa-plus' },
    investments: { modal: 'investment', label: 'Investimento', icon: 'fa-chart-line' },
    bank: { modal: 'bankDeposit', label: 'Guardar', icon: 'fa-arrow-down' },
  };
  const action = actions[state.financeTab] || actions.account;
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
  const groups = buildAccountGroups(accounts, cards);
  qs('#accountsCardsCount').textContent = `${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}`;
  qs('#accountsCardsList').innerHTML = groups.map(accountGroupTemplate).join('') || emptyTemplate('Nenhuma conta ou cartao cadastrado.');
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
  const typeItems = investmentTypeItems(investments);
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
  const works = state.data.trabalhos.map(normalizeAcademicItem);
  const exams = works.filter(work => academicKind(work) === 'prova');
  const assignments = works.filter(work => academicKind(work) === 'trabalho');
  const notes = works.filter(work => academicKind(work) === 'anotacao');
  const pendingItems = works.filter(work => work.status !== 'concluido');
  const done = works.filter(work => work.status === 'concluido');

  qs('#workOverview').innerHTML = `
    <article class="work-summary-card primary">
      <span>Provas</span>
      <strong class="blue">${exams.length}</strong>
      <small>${exams.filter(item => item.status !== 'concluido').length} pendentes</small>
    </article>
    <article class="work-summary-card">
      <span>Trabalhos</span>
      <strong>${assignments.length}</strong>
      <small>${assignments.filter(item => item.status !== 'concluido').length} para entregar</small>
    </article>
    <article class="work-summary-card">
      <span>Anotacoes</span>
      <strong>${notes.length}</strong>
      <small>materiais salvos</small>
    </article>
    <article class="work-summary-card">
      <span>Concluidos</span>
      <strong>${done.length}</strong>
      <small>${pendingItems.length} itens pendentes</small>
    </article>
  `;

  qs('#activeWorkList').innerHTML = exams.map(workCardTemplate).join('') || emptyTemplate('Nenhuma prova cadastrada.');
  qs('#pendingWorkList').innerHTML = assignments.map(workCardTemplate).join('') || emptyTemplate('Nenhum trabalho cadastrado.');
  qs('#doneWorkList').innerHTML = notes.map(workCardTemplate).join('') || emptyTemplate('Nenhuma anotacao cadastrada.');
  renderAcademicCalendar(works);
}

function renderAcademicCalendar(works) {
  const container = qs('#academicCalendar');
  if (!container) return;
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthItems = works.filter(item => {
    if (!item.inicio) return false;
    const date = new Date(`${item.inicio}T00:00:00`);
    return date.getFullYear() === year && date.getMonth() === month;
  });
  const byDay = monthItems.reduce((acc, item) => {
    const day = new Date(`${item.inicio}T00:00:00`).getDate();
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push('<span class="calendar-day empty-day"></span>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const items = byDay[day] || [];
    const isToday = day === today.getDate();
    cells.push(`
      <button class="calendar-day ${isToday ? 'today' : ''} ${items.length ? 'has-items' : ''}" type="button" title="${items.map(item => item.nome).join(', ')}">
        <strong>${day}</strong>
        <span>${items.slice(0, 2).map(item => escapeHtml(item.tipo)).join(' · ')}</span>
      </button>
    `);
  }
  container.innerHTML = `
    <div class="calendar-month-head">
      <strong>${today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
      <span>${monthItems.length} prazos no mes</span>
    </div>
    <div class="calendar-weekdays"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sab</span></div>
    <div class="calendar-month-grid">${cells.join('')}</div>
  `;
}

function academicKind(work) {
  const value = String(work.tipo || '').toLowerCase();
  if (value.includes('prova')) return 'prova';
  if (value.includes('anot')) return 'anotacao';
  return 'trabalho';
}

function normalizeAcademicItem(work) {
  return {
    ...work,
    tipo: work.tipo || 'Trabalho',
    disciplina: work.disciplina || work.area || '',
    anotacao: work.anotacao || work.descricao || ''
  };
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
  const item = normalizeAcademicItem(work);
  return `
    <div class="mini-item">
      <div class="mini-top"><strong>${escapeHtml(item.nome)}</strong><span>${escapeHtml(item.tipo)}</span></div>
      <div class="mini-sub">${escapeHtml(item.disciplina || 'Sem materia')} · ${escapeHtml(item.inicio)} · ${escapeHtml(item.status)}</div>
    </div>
  `;
}

function transactionCardTemplate(item) {
  const style = transactionStyle(item.tipo);
  const recurring = item.recorrente ? ' recorrente' : '';
  return `
    <article class="list-card">
      <div class="card-icon" style="background:${style.bg};color:${style.color}"><i class="fa-solid ${escapeHtml(item.icon)}"></i></div>
      <div class="card-main">
        <strong>${escapeHtml(item.nome)}</strong>
        <span>${escapeHtml(item.cat)} · ${escapeHtml(item.data)} · ${escapeHtml(item.tipo)}</span>
        <span class="card-note">${item.tipo === 'saida' ? 'Despesa lancada no fluxo mensal' : 'Receita adicionada ao saldo'}${recurring}</span>
      </div>
      <div class="card-value" style="color:${style.color}">${item.val > 0 ? '+' : '-'}${formatMoney(Math.abs(item.val))}</div>
      <button class="delete-button" data-duplicate-transaction="${item.id}" aria-label="Duplicar transacao"><i class="fa-regular fa-copy"></i></button>
      <button class="delete-button" data-delete="transacoes" data-id="${item.id}" aria-label="Excluir transacao"><i class="fa-regular fa-trash-can"></i></button>
    </article>
  `;
}

function accountKey(item) {
  return `${item.nome || ''} ${item.bandeira || ''}`
    .toLowerCase()
    .replace(/cartao|cartão|credito|crédito|conta|corrente|principal/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function newGroupId() {
  return window.crypto?.randomUUID ? window.crypto.randomUUID() : `bank-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildAccountGroups(accounts, cards) {
  const usedCards = new Set();
  const groups = accounts.map(account => {
    const key = accountKey(account);
    const relatedCards = cards.filter(card => {
      const sameGroup = account.groupId && card.groupId && account.groupId === card.groupId;
      const cardKey = accountKey(card);
      const sameBank = key && cardKey && key === cardKey;
      if (sameGroup || sameBank) usedCards.add(card.id);
      return sameGroup || sameBank;
    });
    return { account, cards: relatedCards };
  });

  cards
    .filter(card => !usedCards.has(card.id))
    .forEach(card => groups.push({ account: null, cards: [card] }));

  return groups;
}

function findRelatedAccountParts(item) {
  const items = state.data.contasCartoes || [];
  const accounts = items.filter(entry => entry.tipo === 'conta');
  const cards = items.filter(entry => entry.tipo === 'cartao');

  if (!item) return { account: null, card: null };
  if (item.tipo === 'conta') {
    const group = buildAccountGroups([item], cards)[0];
    return { account: item, card: group?.cards?.[0] || null };
  }

  const cardKey = accountKey(item);
  const account = accounts.find(entry => {
    if (entry.groupId && item.groupId && entry.groupId === item.groupId) return true;
    const key = accountKey(entry);
    return key && cardKey && key === cardKey;
  }) || null;
  return { account, card: item };
}

function accountGroupTemplate(group) {
  const account = group.account;
  const cards = group.cards || [];
  const mainCard = cards[0];
  const balance = Number(account?.saldo || 0);
  const used = cards.reduce((sum, card) => sum + Number(card.usado || 0), 0);
  const limit = cards.reduce((sum, card) => sum + Number(card.limite || 0), 0);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const available = Math.max(0, limit - used);
  const title = account?.nome || mainCard?.nome || 'Cartao avulso';
  const detail = account ? account.bandeira : mainCard?.bandeira || 'Cartao de credito';
  const ids = [account, ...cards].filter(Boolean);
  const today = new Date().toLocaleDateString('pt-BR');
  const editId = account?.id || mainCard?.id || '';
  return `
    <article class="bank-account-card ${cards.length ? 'has-credit' : 'debit-only'}">
      <div class="bank-account-top">
        <div>
          <span class="account-type-badge">${account ? 'Banco' : 'Cartao'}</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(detail)}</small>
        </div>
        <div class="bank-card-actions">
          <button class="delete-button" data-edit-account="${editId}" aria-label="Editar banco"><i class="fa-regular fa-pen-to-square"></i></button>
          <button class="delete-button" data-delete="contas-cartoes" data-id="${ids[0]?.id || ''}" aria-label="Excluir item"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>
      <div class="bank-card-section debit">
        <span>Debito</span>
        <div class="bank-card-value">
          <small>saldo</small>
          <strong>${account ? formatMoney(balance) : 'Nao cadastrado'}</strong>
        </div>
      </div>
      <div class="bank-card-section credit ${cards.length ? '' : 'is-empty'}">
        <span>Credito</span>
        ${cards.length ? `
          <div class="bank-card-value">
            <small>fatura</small>
            <strong>${formatMoney(used)}</strong>
          </div>
          <div class="credit-scale">
            <div><small>0</small><small>${formatMoney(limit).replace('R$', '').trim()}</small></div>
            <div class="progress-line"><span style="width:${pct}%"></span></div>
          </div>
        ` : `
          <div class="bank-card-value muted">
            <small>fatura</small>
            <strong>Sem credito</strong>
          </div>
        `}
      </div>
      <footer class="bank-card-footer">
        <span>${cards.length ? `${formatMoney(available)} livre` : 'somente debito'}</span>
        <span>atualizacao ${today}</span>
      </footer>
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
        <span class="card-note">${isOpen ? 'Em aberto no Lastro Bank' : `Devolvido em ${escapeHtml(item.dataDevolucao || '')}`}</span>
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
  const item = normalizeAcademicItem(work);
  const statusLabels = { ativo: 'Pendente', andamento: 'Em andamento', concluido: 'Concluido' };
  const kind = academicKind(item);
  const icon = kind === 'prova' ? 'fa-file-pen' : kind === 'anotacao' ? 'fa-note-sticky' : 'fa-list-check';
  return `
    <article class="work-card">
      <div class="work-card-head">
        <div class="work-card-title">
          <strong>${escapeHtml(item.nome)}</strong>
          <span>${escapeHtml(item.disciplina || 'Sem materia')} · ${escapeHtml(item.inicio)}</span>
        </div>
        <div class="account-actions">
          <button class="delete-button" data-edit-work="${item.id}" aria-label="Editar item"><i class="fa-regular fa-pen-to-square"></i></button>
          <button class="delete-button" data-delete="trabalhos" data-id="${item.id}" aria-label="Excluir item"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>
      <div class="work-money"><i class="fa-solid ${icon}"></i>${escapeHtml(item.tipo)}</div>
      <div class="work-metrics">
        <span>${statusLabels[item.status] || item.status}</span>
        ${item.horas ? `<span>${item.horas}h de estudo</span>` : ''}
        ${Number(item.salario || 0) ? `<span>Nota/peso ${Number(item.salario || 0)}</span>` : ''}
      </div>
      ${item.anotacao ? `<p class="work-note">${escapeHtml(item.anotacao)}</p>` : ''}
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
  state.editing = editItem?.id ? { type, id: editItem.id } : null;
  const dialog = qs('#entityDialog');
  const title = qs('#dialogTitle');
  const fields = qs('#formFields');
  const today = new Date().toISOString().slice(0, 10);
  dialog.classList.toggle('wide-dialog', type === 'account');
  fields.className = 'form-grid';

  if (type === 'transaction') {
    const item = editItem || {};
    const editingTransaction = Boolean(editItem);
    const transactionType = item.tipo === 'entrada' ? 'entrada' : 'saida';
    title.textContent = editingTransaction ? 'Copiar transacao' : 'Nova transacao';
    fields.className = 'form-grid transaction-editor-form';
    fields.innerHTML = `
      <div class="transaction-edit-hero">
        <div>
          <span>Movimentacao</span>
          <strong>${editingTransaction ? 'Copiar transacao' : 'Nova transacao'}</strong>
        </div>
        <i class="fa-solid fa-right-left"></i>
      </div>
      <section class="transaction-edit-section">
        <div class="transaction-type-toggle">
          <label><input type="radio" name="tipo" value="entrada" ${transactionType === 'entrada' ? 'checked' : ''}><span><i class="fa-solid fa-arrow-up"></i>Entrada</span></label>
          <label><input type="radio" name="tipo" value="saida" ${transactionType === 'saida' ? 'checked' : ''}><span><i class="fa-solid fa-arrow-down"></i>Saida</span></label>
        </div>
        <div class="transaction-edit-grid">
          ${field('nome', 'Nome', 'text', item.nome || 'Ex: Mercado', true)}
          ${field('val', 'Valor', 'number', Math.abs(Number(item.val || 0)), true)}
          ${field('data', 'Data', 'date', item.data || today, true)}
          <label>Categoria
            <select name="catPreset" id="transactionCategorySelect"></select>
          </label>
          <label class="hidden" id="customCategoryField">Categoria personalizada
            <input name="catCustom" type="text" placeholder="Escreva a categoria">
          </label>
          <label class="toggle-line">
            <input name="recorrente" type="checkbox" value="true">
            <span>Movimentacao recorrente</span>
          </label>
        </div>
      </section>
    `;
    updateTransactionCategoryOptions();
    const categories = transactionCategories[transactionType] || [];
    if (item.cat && categories.includes(item.cat)) {
      qs('#transactionCategorySelect').value = item.cat;
    } else if (item.cat) {
      qs('#transactionCategorySelect').value = 'Outros';
      qs('#customCategoryField').classList.remove('hidden');
      qs('[name="catCustom"]').value = item.cat;
    }
    qs('[name="recorrente"]').checked = Boolean(item.recorrente);
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
    title.textContent = editItem ? 'Editar item da faculdade' : 'Novo item da faculdade';
    fields.innerHTML = `
      <div class="form-section-title">Faculdade</div>
      ${field('nome', 'Titulo', 'text', item.nome || 'Ex: Prova de calculo', true)}
      <label>Tipo<select name="tipo"><option value="Prova" ${item.tipo === 'Prova' ? 'selected' : ''}>Prova</option><option value="Trabalho" ${item.tipo === 'Trabalho' ? 'selected' : ''}>Trabalho</option><option value="Anotacao" ${item.tipo === 'Anotacao' ? 'selected' : ''}>Anotacao</option></select></label>
      ${field('disciplina', 'Materia', 'text', item.disciplina || item.area || 'Ex: Matematica', false)}
      <label>Status<select name="status"><option value="ativo" ${item.status === 'ativo' ? 'selected' : ''}>Pendente</option><option value="andamento" ${item.status === 'andamento' ? 'selected' : ''}>Em andamento</option><option value="concluido" ${item.status === 'concluido' ? 'selected' : ''}>Concluido</option></select></label>
      <div class="form-section-title">Prazo e detalhes</div>
      ${field('inicio', 'Data ou prazo', 'date', item.inicio || today, true)}
      ${field('horas', 'Horas de estudo', 'number', item.horas ?? '0', false)}
      ${field('salario', 'Nota ou peso', 'number', item.salario ?? '0', false)}
      <label>Anotacoes<textarea name="anotacao" rows="4">${escapeHtml(item.anotacao || item.descricao || '')}</textarea></label>
    `;
  }

  if (type === 'account') {
    const { account, card } = findRelatedAccountParts(editItem);
    const bankName = account?.nome || card?.nome?.replace(/\s*credito$/i, '') || '';
    const bankLabel = account?.bandeira || card?.bandeira || bankName;
    const groupId = account?.groupId || card?.groupId || editItem?.groupId || newGroupId();
    state.editing = { type, accountId: account?.id || null, cardId: card?.id || null, groupId };
    title.textContent = editItem ? 'Editar banco' : 'Novo banco';
    fields.className = 'form-grid account-editor-form';
    fields.innerHTML = `
      <div class="account-edit-hero">
        <div>
          <span>Banco</span>
          <strong>${escapeHtml(bankName || 'Novo banco')}</strong>
        </div>
        <i class="fa-regular fa-credit-card"></i>
      </div>

      <section class="account-edit-section">
        <div class="account-edit-title"><i class="fa-solid fa-building-columns"></i><span>Dados do banco</span></div>
        <div class="account-edit-grid">
          ${field('nome', 'Nome do banco', 'text', bankName || 'Ex: Nubank', true)}
          ${field('bandeira', 'Identificacao', 'text', bankLabel || 'Ex: Conta principal', false)}
        </div>
      </section>

      <section class="account-edit-section debit">
        <div class="account-edit-title"><i class="fa-solid fa-arrow-down"></i><span>Debito</span></div>
        ${field('saldo', 'Saldo disponivel', 'number', account?.saldo ?? '0', false)}
      </section>

      <section class="account-edit-section credit">
        <div class="account-edit-title"><i class="fa-solid fa-credit-card"></i><span>Credito</span></div>
        <div class="account-edit-grid three">
          ${field('limite', 'Limite total', 'number', card?.limite ?? '0', false)}
          ${field('usado', 'Fatura atual', 'number', card?.usado ?? '0', false)}
          ${field('vencimento', 'Vencimento', 'number', card?.vencimento ?? '1', false)}
        </div>
      </section>
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
    title.textContent = 'Guardar no Lastro Bank';
    fields.innerHTML = `${field('valor', 'Valor para guardar', 'number', '0', true)}`;
  }

  if (type === 'bankWithdraw') {
    title.textContent = 'Retirar do Lastro Bank';
    fields.innerHTML = `
      ${field('valor', 'Valor da retirada', 'number', '0', true)}
      <div class="withdraw-simulation" id="withdrawSimulation">
        <span>Simulacao com 4% de incentivo</span>
        <div><small>Juros</small><strong id="withdrawInterest">R$ 0,00</strong></div>
        <div><small>Total para devolver</small><strong id="withdrawTotal">R$ 0,00</strong></div>
      </div>
    `;
    updateWithdrawSimulation();
  }

  dialog.showModal();
}

function field(name, label, type, value, required) {
  const decimalFields = ['val', 'target', 'atual', 'salario', 'saldo', 'limite', 'usado', 'valor', 'rendimento'];
  const inputType = type === 'number' && decimalFields.includes(name) ? 'text' : type;
  const decimalAttrs = inputType === 'text' && decimalFields.includes(name) ? ' inputmode="decimal"' : '';
  const step = type === 'number' && inputType === 'number' ? ' step="1"' : '';
  return `<label>${label}<input name="${name}" type="${inputType}" value="${escapeHtml(value)}"${decimalAttrs}${step} ${required ? 'required' : ''}></label>`;
}

async function submitModal(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitter = event.submitter;
  if (submitter?.value === 'cancel') return qs('#entityDialog').close();

  const data = Object.fromEntries(new FormData(form).entries());
  if (state.modalType === 'transaction') {
    data.cat = data.catPreset === 'Outros' ? (data.catCustom || 'Outros') : data.catPreset;
    data.recorrente = data.recorrente === 'true';
    delete data.catPreset;
    delete data.catCustom;
  }
  normalizeFormNumbers(data);
  if (state.modalType === 'account') {
    await submitBankAccount(data);
    state.editing = null;
    qs('#entityDialog').close();
    await loadDashboard();
    return;
  }
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

async function submitBankAccount(data) {
  const editing = state.editing || {};
  const nome = String(data.nome || 'Novo banco').trim();
  const bandeira = String(data.bandeira || nome).trim();
  const groupId = editing.groupId || newGroupId();
  const accountPayload = {
    groupId,
    nome,
    tipo: 'conta',
    bandeira,
    saldo: data.saldo || 0,
    limite: 0,
    usado: 0,
    vencimento: 1
  };
  const cardPayload = {
    groupId,
    nome: `${nome} credito`,
    tipo: 'cartao',
    bandeira,
    saldo: 0,
    limite: data.limite || 0,
    usado: data.usado || 0,
    vencimento: data.vencimento || 1
  };

  const accountPath = editing.accountId ? `/api/contas-cartoes/${editing.accountId}` : '/api/contas-cartoes';
  await api(accountPath, {
    method: editing.accountId ? 'PUT' : 'POST',
    body: JSON.stringify(accountPayload)
  });

  const hasCredit = Number(cardPayload.limite || 0) > 0 || Number(cardPayload.usado || 0) > 0 || editing.cardId;
  if (!hasCredit) return;

  const cardPath = editing.cardId ? `/api/contas-cartoes/${editing.cardId}` : '/api/contas-cartoes';
  await api(cardPath, {
    method: editing.cardId ? 'PUT' : 'POST',
    body: JSON.stringify(cardPayload)
  });
}

function normalizeFormNumbers(data) {
  ['val', 'target', 'atual', 'salario', 'saldo', 'limite', 'usado', 'valor'].forEach(key => {
    if (key in data) data[key] = moneyValue(data[key]);
  });
  ['rendimento'].forEach(key => {
    if (key in data) data[key] = parseDecimal(data[key]);
  });
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

function updateWithdrawSimulation() {
  const input = qs('#formFields [name="valor"]');
  const interest = qs('#withdrawInterest');
  const total = qs('#withdrawTotal');
  if (!input || !interest || !total) return;
  const value = moneyValue(input.value || 0);
  interest.textContent = formatMoney(value * 0.04);
  total.textContent = formatMoney(value * 1.04);
}

async function duplicateTransaction(id) {
  const item = state.data.transacoes.find(transaction => transaction.id === id);
  if (!item) return;
  const copy = {
    ...item,
    id: undefined,
    data: new Date().toISOString().slice(0, 10)
  };
  openModal('transaction', copy);
}

function renderEmail() {
  const email = state.user?.email || state.user?.username || 'sem login';
  const label = qs('#gmailAccount');
  if (label) label.textContent = email;
  const connected = Boolean(state.gmailStatus?.connected);
  const status = qs('#gmailStatusText');
  if (status) status.textContent = connected ? 'Gmail conectado e pronto para sincronizar.' : (state.gmailStatus?.error || 'Clique em conectar para liberar o Gmail.');
  const button = qs('#connectGmailButton');
  if (button) button.innerHTML = connected
    ? '<i class="fa-solid fa-check"></i><span>Gmail conectado</span>'
    : '<i class="fa-brands fa-google"></i><span>Conectar Gmail</span>';
  const list = qs('#gmailMessages');
  if (list) {
    list.innerHTML = state.gmailMessages.map(message => `
      <article class="gmail-message">
        <strong>${escapeHtml(message.subject)}</strong>
        <span>${escapeHtml(message.from)}</span>
        <small>${escapeHtml(message.snippet || '')}</small>
      </article>
    `).join('') || emptyTemplate(connected ? 'Nenhum email encontrado.' : 'Conecte o Gmail para ver sua caixa de entrada.');
  }
}

async function connectGmail() {
  const payload = await api('/api/auth/gmail-url');
  window.location.href = payload.url;
}

async function refreshGmail() {
  await loadGmailStatus();
  renderEmail();
  showToast('Gmail atualizado', 'A caixa de entrada foi sincronizada.');
}

async function sendGmail() {
  const payload = {
    to: qs('#gmailTo')?.value || '',
    subject: qs('#gmailSubject')?.value || '',
    body: qs('#gmailBody')?.value || ''
  };
  try {
    await api('/api/gmail/send', { method: 'POST', body: JSON.stringify(payload) });
    qs('#gmailTo').value = '';
    qs('#gmailSubject').value = '';
    qs('#gmailBody').value = '';
    showToast('Email enviado', 'Mensagem enviada pelo Gmail conectado.');
  } catch (error) {
    showToast('Erro no Gmail', safeApiError(error.message) || 'Conecte o Gmail antes de enviar.');
  }
}

function bindEvents() {
  qs('#loginForm').addEventListener('submit', submitLogin);
  qs('#googleLoginButton').addEventListener('click', loginWithGoogle);
  qsa('.auth-tab').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
  qs('#accountButton')?.addEventListener('click', openSettings);
  qs('#closeSettingsButton')?.addEventListener('click', closeSettings);
  qs('#settingsLogoutButton')?.addEventListener('click', logoutFromSettings);
  qs('#settingsChangePasswordButton')?.addEventListener('click', openPasswordSettings);
  qs('#profilePhotoInput')?.addEventListener('change', changeProfilePhoto);
  qs('#removeProfilePhotoButton')?.addEventListener('click', removeProfilePhoto);
  qs('#connectGmailButton')?.addEventListener('click', connectGmail);
  qs('#refreshGmailButton')?.addEventListener('click', refreshGmail);
  qs('#sendGmailButton')?.addEventListener('click', sendGmail);
  qs('#notificationButton')?.addEventListener('click', () => qs('#notificationPopout')?.classList.toggle('show'));
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
  qs('#entityForm').addEventListener('change', event => {
    if (event.target.name === 'tipo') updateTransactionCategoryOptions();
    if (event.target.id === 'transactionCategorySelect') toggleCustomCategoryField();
  });
  qs('#entityForm').addEventListener('input', event => {
    if (state.modalType === 'bankWithdraw' && event.target.name === 'valor') updateWithdrawSimulation();
  });

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

    const duplicateTransactionButton = event.target.closest('[data-duplicate-transaction]');
    if (duplicateTransactionButton) {
      duplicateTransaction(duplicateTransactionButton.dataset.duplicateTransaction);
      return;
    }

    if (event.target.closest('#closeNotifications')) {
      qs('#notificationPopout')?.classList.remove('show');
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
