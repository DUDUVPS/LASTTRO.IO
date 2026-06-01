const state = {
  data: null,
  page: 'overview',
  financeTab: 'account',
  workTab: 'tarefas',
  healthTab: 'alimentacao',
  homeTab: 'despensa',
  transactionFilter: 'todos',
  transactionCategory: 'todas',
  transactionSearch: '',
  transactionSort: 'recent',
  chart: null,
  overviewInvestmentChart: null,
  investmentChart: null,
  modalType: null,
  editing: null,
  workKind: 'Trabalho',
  homeKind: 'despensa',
  healthKind: 'alimentacao',
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
  health: { title: 'Saude', subtitle: 'alimentacao, treino e evolucao' },
  home: { title: 'Casa', subtitle: 'despensa, contas e compras' },
  email: { title: 'Email', subtitle: 'atalhos e mensagens pelo Gmail' }
};

const categoryColors = ['#ff7a45', '#00c4b4', '#8b6fff', '#f0b43c', '#4a9eff', '#2ecc8a'];
const transactionCategories = {
  entrada: ['Salario', 'Freela', 'Renda extra', 'Reembolso', 'Presente', 'Outros'],
  saida: ['Alimentacao', 'Transporte', 'Saude', 'Educacao', 'Lazer', 'Casa', 'Pessoal', 'Outros']
};
const pantryEssentialGroups = [
  {
    title: 'Base da cozinha',
    icon: 'fa-bowl-rice',
    items: ['01 arroz', '02 feijao', '01 acucar', '01 cafe', '02 oleo', '01 alho grande', 'macarrao diversos', 'sal', 'vinagre', 'temperos', 'condimentos', 'Nescau']
  },
  {
    title: 'Molhos e enlatados',
    icon: 'fa-jar',
    items: ['molho de tomate', 'extrato', 'milho verde', 'azeitona', 'catchup', 'mostarda', 'creme de leite', 'batata palha', 'maionese']
  },
  {
    title: 'Cafe e frios',
    icon: 'fa-bread-slice',
    items: ['01 cx de leite', 'bolacha diversas', 'margarina', 'mussarela', 'mortadela', 'pao de forma', 'pao de sal', 'massa pra bolo', 'massa pra cuscuz', 'requeijao cremoso', 'iogurte', 'sucos', 'refrigerante']
  },
  {
    title: 'Hortifruti e mistura',
    icon: 'fa-carrot',
    items: ['frutas', 'limao', '1kg de cebola', 'verduras', 'frango', 'linguica', 'salsicha', 'pao pra cachorro quente']
  },
  {
    title: 'Limpeza',
    icon: 'fa-soap',
    items: ['detergente', 'sabao em po', 'sabao liquido', 'amaciante', 'desinfetante', 'cheirinho', "q'boa", 'saco pra lixo', 'veja', 'Bombril', 'esponja']
  },
  {
    title: 'Higiene',
    icon: 'fa-pump-soap',
    items: ['creme dental', 'sabonete', 'shampoo', 'condicionador', 'Prestobarba', 'desodorante', 'papel higienico']
  }
];
const pantryEssentials = pantryEssentialGroups.flatMap(group => group.items);
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

function formatDecimal(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
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
  const version = state.data?.version;
  const versionLabel = qs('#settingsVersion');
  if (versionLabel && version) versionLabel.textContent = `v${version.version} - commit ${version.commit}`;
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
  renderHealth();
  renderHome();
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
  const lowPantry = (state.data.casa || [])
    .filter(item => item.tipo === 'despensa')
    .filter(item => Number(item.quantidade || 0) <= Number(item.minimo || 0));
  if (lowPantry.length) {
    suggestions.push({
      icon: 'fa-boxes-stacked',
      title: 'Despensa com estoque baixo',
      text: `${lowPantry.slice(0, 3).map(item => item.nome).join(', ')}${lowPantry.length > 3 ? ` e mais ${lowPantry.length - 3}` : ''}.`
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
  const groups = state.data.transacoes
    .filter(item => item.tipo !== 'investimento')
    .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(String(item.data || '')))
    .reduce((acc, item) => {
      const month = String(item.data || '').slice(0, 7);
      const period = statementPeriod(month);
      if (!isTransactionInsideStatement(item, period)) return acc;
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
  const label = new Date(`${item.mes}-02`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const period = statementPeriod(item.mes);
  return `
    <article class="statement-card">
      <strong>${escapeHtml(label)}</strong>
      <span>${period.label} · ${item.count} ${item.count === 1 ? 'movimentacao' : 'movimentacoes'}</span>
      <div><small>Entradas</small><b class="positive">${formatMoney(item.entradas)}</b></div>
      <div><small>Saidas</small><b class="negative">${formatMoney(item.saidas)}</b></div>
      <footer>
        <span>Resultado ${formatMoney(item.total)}</span>
        <button class="pill-button" type="button" data-download-statement="${escapeHtml(item.mes)}"><i class="fa-solid fa-download"></i><span>Baixar</span></button>
      </footer>
    </article>
  `;
}

function statementPeriod(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return { start: '', end: '', label: 'Periodo sem data' };
  const [year, monthIndex] = month.split('-').map(Number);
  const endDate = new Date(year, monthIndex, 0);
  const end = `${year}-${String(monthIndex).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { start: `${month}-01`, end, label: `01/${String(monthIndex).padStart(2, '0')} a ${String(endDate.getDate()).padStart(2, '0')}/${String(monthIndex).padStart(2, '0')}` };
}

function isTransactionInsideStatement(item, period) {
  const date = String(item.data || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= period.start && date <= period.end;
}

function downloadMonthlyStatement(month) {
  const period = statementPeriod(month);
  if (!period.start || !period.end) {
    showToast('Extrato indisponivel', 'Esse mes nao tem um periodo valido.');
    return;
  }
  const transactions = state.data.transacoes
    .filter(item => item.tipo !== 'investimento')
    .filter(item => isTransactionInsideStatement(item, period))
    .sort((a, b) => new Date(a.data) - new Date(b.data));
  if (!transactions.length) {
    showToast('Extrato vazio', 'Nao ha movimentacoes nesse mes.');
    return;
  }
  const entradas = transactions.filter(item => item.tipo === 'entrada').reduce((sum, item) => sum + Number(item.val || 0), 0);
  const saidas = transactions.filter(item => item.tipo === 'saida').reduce((sum, item) => sum + Math.abs(Number(item.val || 0)), 0);
  const blob = createStatementPdf({
    month,
    period,
    generatedAt: new Date().toLocaleDateString('pt-BR'),
    transactions,
    entradas,
    saidas,
    resultado: entradas - saidas
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lasttro-extrato-${month}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Extrato baixado', `Periodo ${period.start} ate ${period.end}.`);
}

function pdfText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[\\()]/g, '\\$&');
}

function createStatementPdf(statement) {
  const rowsPerPage = 24;
  const pageChunks = [];
  for (let i = 0; i < statement.transactions.length; i += rowsPerPage) {
    pageChunks.push(statement.transactions.slice(i, i + rowsPerPage));
  }
  const fontRegularObject = 3 + pageChunks.length * 2;
  const fontBoldObject = fontRegularObject + 1;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageChunks.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pageChunks.length} >>`
  ];

  pageChunks.forEach((pageLines, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const content = statementPdfPageContent(statement, pageLines, index, pageChunks.length);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

function statementPdfPageContent(statement, transactions, pageIndex, totalPages) {
  const commands = [];
  const text = (value, x, y, size = 10, font = 'F1', color = '0.93 0.95 0.97') => {
    commands.push(`${color} rg`);
    commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`);
  };
  const rect = (x, y, width, height, color) => commands.push(`${color} rg\n${x} ${y} ${width} ${height} re f`);
  const stroke = (x, y, width, height, color = '0.18 0.24 0.30') => commands.push(`${color} RG\n${x} ${y} ${width} ${height} re S`);
  const monthLabel = new Date(`${statement.month}-02`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  rect(0, 0, 595, 842, '0.04 0.05 0.06');
  rect(0, 760, 595, 82, '0.03 0.12 0.20');
  rect(42, 728, 511, 54, '0.07 0.09 0.10');
  stroke(42, 728, 511, 54, '0.10 0.31 0.50');
  text('LASTTRO', 58, 786, 22, 'F2', '0.93 0.95 0.97');
  text('Extrato financeiro mensal', 58, 766, 11, 'F1', '0.53 0.80 1.00');
  text(monthLabel, 380, 786, 16, 'F2', '0.93 0.95 0.97');
  text(`${statement.period.label}  |  gerado em ${statement.generatedAt}`, 380, 767, 9, 'F1', '0.66 0.71 0.75');

  if (pageIndex === 0) {
    statementSummaryCard(commands, 'Entradas', formatMoney(statement.entradas), 42, 666, '0.18 0.80 0.54');
    statementSummaryCard(commands, 'Saidas', formatMoney(statement.saidas), 214, 666, '0.91 0.30 0.30');
    statementSummaryCard(commands, 'Resultado', formatMoney(statement.resultado), 386, 666, statement.resultado >= 0 ? '0.18 0.80 0.54' : '0.91 0.30 0.30');
    text('Movimentacoes do periodo', 42, 622, 14, 'F2', '0.93 0.95 0.97');
    text('Somente lancamentos entre o dia 1 e o ultimo dia do mes.', 42, 606, 9, 'F1', '0.66 0.71 0.75');
  } else {
    text('Movimentacoes do periodo', 42, 704, 14, 'F2', '0.93 0.95 0.97');
  }

  const tableTop = pageIndex === 0 ? 580 : 680;
  rect(42, tableTop, 511, 24, '0.10 0.13 0.16');
  text('Data', 52, tableTop + 8, 9, 'F2', '0.53 0.80 1.00');
  text('Tipo', 116, tableTop + 8, 9, 'F2', '0.53 0.80 1.00');
  text('Categoria', 178, tableTop + 8, 9, 'F2', '0.53 0.80 1.00');
  text('Lancamento', 280, tableTop + 8, 9, 'F2', '0.53 0.80 1.00');
  text('Valor', 492, tableTop + 8, 9, 'F2', '0.53 0.80 1.00');

  transactions.forEach((item, rowIndex) => {
    const y = tableTop - 22 - rowIndex * 20;
    if (rowIndex % 2 === 0) rect(42, y - 5, 511, 20, '0.06 0.07 0.08');
    const value = Number(item.val || 0);
    const valueColor = value >= 0 ? '0.18 0.80 0.54' : '0.91 0.30 0.30';
    text(formatPdfDate(item.data), 52, y, 8, 'F1', '0.85 0.88 0.90');
    text(item.tipo || '-', 116, y, 8, 'F1', '0.85 0.88 0.90');
    text(truncateText(item.cat || 'Sem categoria', 18), 178, y, 8, 'F1', '0.85 0.88 0.90');
    text(truncateText(item.nome || 'Sem nome', 34), 280, y, 8, 'F1', '0.85 0.88 0.90');
    text(formatMoney(value), 492, y, 8, 'F2', valueColor);
  });

  text(`Pagina ${pageIndex + 1}/${totalPages}`, 492, 36, 8, 'F1', '0.66 0.71 0.75');
  text('LASTTRO - Todos os direitos reservados', 42, 36, 8, 'F1', '0.66 0.71 0.75');
  return commands.join('\n');
}

function statementSummaryCard(commands, label, value, x, y, color) {
  commands.push('0.07 0.09 0.10 rg');
  commands.push(`${x} ${y} 152 72 re f`);
  commands.push('0.18 0.24 0.30 RG');
  commands.push(`${x} ${y} 152 72 re S`);
  commands.push('0.66 0.71 0.75 rg');
  commands.push(`BT /F1 9 Tf ${x + 14} ${y + 48} Td (${pdfText(label)}) Tj ET`);
  commands.push(`${color} rg`);
  commands.push(`BT /F2 17 Tf ${x + 14} ${y + 22} Td (${pdfText(value)}) Tj ET`);
}

function formatPdfDate(date) {
  const [year, month, day] = String(date || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(date || '');
}

function truncateText(value, size) {
  const text = String(value || '');
  return text.length > size ? `${text.slice(0, size - 3)}...` : text;
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

function normalizeGoalItem(goal) {
  const tipo = goal.tipo || 'dinheiro';
  return {
    ...goal,
    tipo,
    unidade: goal.unidade || (tipo === 'dinheiro' ? 'R$' : tipo === 'habito' ? 'dias' : tipo === 'estudo' ? 'horas' : 'itens'),
    descricao: goal.descricao || ''
  };
}

function goalProgress(goal) {
  return Math.min(100, Math.round((Number(goal.atual || 0) / Math.max(Number(goal.target || 0), 1)) * 100));
}

function goalValue(goal, value) {
  const item = normalizeGoalItem(goal);
  return item.tipo === 'dinheiro' ? formatMoney(value) : `${Number(value || 0)} ${item.unidade}`;
}

function goalTypeLabel(tipo) {
  return {
    dinheiro: 'Dinheiro',
    habito: 'Habito',
    tarefa: 'Tarefa',
    estudo: 'Estudo',
    outro: 'Outro'
  }[tipo] || 'Meta';
}

function renderGoals() {
  const goals = state.data.metas.map(normalizeGoalItem);
  const moneyGoals = goals.filter(item => item.tipo === 'dinheiro');
  const target = moneyGoals.reduce((sum, item) => sum + Number(item.target || 0), 0);
  const current = moneyGoals.reduce((sum, item) => sum + Number(item.atual || 0), 0);
  const remaining = Math.max(0, target - current);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const completed = goals.filter(item => Number(item.atual) >= Number(item.target)).length;

  qs('#goalsOverview').innerHTML = `
    <article class="goal-summary-card primary">
      <span>Metas financeiras</span>
      <strong>${pct}%</strong>
      <small>${formatMoney(current)} acumulados de ${formatMoney(target)}</small>
      <div class="progress-line"><span style="width:${pct}%;background:linear-gradient(90deg,var(--green),var(--blue))"></span></div>
    </article>
    <article class="goal-summary-card">
      <span>Total de metas</span>
      <strong>${goals.length}</strong>
      <small>${moneyGoals.length} financeiras · ${goals.length - moneyGoals.length} outras</small>
    </article>
    <article class="goal-summary-card">
      <span>Concluidas</span>
      <strong>${completed}</strong>
      <small>${formatMoney(remaining)} faltando nas financeiras</small>
    </article>
  `;
  qs('#goalsList').innerHTML = goals.map(goalCardTemplate).join('') || emptyTemplate('Cadastre sua primeira meta.');
}

function renderWork() {
  const works = state.data.trabalhos.map(normalizeAcademicItem);
  const academicTasks = works.filter(work => academicKind(work) !== 'estudo');
  const exams = academicTasks.filter(work => academicKind(work) === 'prova');
  const assignments = academicTasks.filter(work => academicKind(work) === 'trabalho');
  const notes = academicTasks.filter(work => academicKind(work) === 'anotacao');
  const studies = works.filter(work => academicKind(work) === 'estudo');
  const pending = academicTasks.filter(work => work.status === 'ativo');
  const doing = academicTasks.filter(work => work.status === 'andamento');
  const pendingItems = academicTasks.filter(work => work.status !== 'concluido');
  const done = academicTasks.filter(work => work.status === 'concluido');
  const studyHours = studies.reduce((sum, item) => sum + Number(item.horas || 0), 0);
  const studySubjects = uniqueStudySubjects();

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
    <article class="work-summary-card">
      <span>Estudos</span>
      <strong>${studies.length}</strong>
      <small>${formatDecimal(studyHours)}h registradas</small>
    </article>
  `;

  qs('#activeWorkList').innerHTML = pending.map(workCardTemplate).join('') || emptyTemplate('Nada pendente.');
  qs('#pendingWorkList').innerHTML = doing.map(workCardTemplate).join('') || emptyTemplate('Nada em andamento.');
  qs('#doneWorkList').innerHTML = done.map(workCardTemplate).join('') || emptyTemplate('Nada concluido.');
  qs('#studyOverview').innerHTML = `
    <article class="study-summary-card primary">
      <span>Horas registradas</span>
      <strong>${formatDecimal(studyHours)}h</strong>
      <small>total de estudos</small>
    </article>
    <article class="study-summary-card">
      <span>Materias</span>
      <strong>${studySubjects.length}</strong>
      <small>disciplinas diferentes</small>
    </article>
    <article class="study-summary-card">
      <span>Registros</span>
      <strong>${studies.length}</strong>
      <small>tempos salvos</small>
    </article>
  `;
  qs('#studySubjects').innerHTML = studySubjectsTemplate(studySubjects, studies);
  qs('#studyList').innerHTML = studies.map(studyCardTemplate).join('') || emptyTemplate('Nenhum estudo registrado.');
  renderAcademicCalendar(academicTasks);
}

function renderHealth() {
  const items = state.data.saude || [];
  const today = new Date().toISOString().slice(0, 10);
  const foodToday = items
    .filter(item => ['alimentacao', 'dieta'].includes(item.tipo) && item.data === today)
    .reduce((sum, item) => sum + Number(item.calorias || 0), 0);
  const waterToday = items
    .filter(item => item.tipo === 'hidratacao' && item.data === today)
    .reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const workoutToday = items
    .filter(item => item.tipo === 'treino' && item.data === today)
    .reduce((sum, item) => sum + Number(item.duracao || 0), 0);
  const medicineOpen = items.filter(item => item.tipo === 'medicamentos' && item.status !== 'feito').length;
  const workoutCalories = items
    .filter(item => item.tipo === 'treino')
    .reduce((sum, item) => sum + Number(item.calorias || 0), 0);
  const foodCalories = items
    .filter(item => ['alimentacao', 'dieta'].includes(item.tipo))
    .reduce((sum, item) => sum + Number(item.calorias || 0), 0);

  qs('#healthOverview').innerHTML = `
    <article class="health-summary-card primary">
      <span>Kcal do dia</span>
      <strong>${Math.round(foodToday)}</strong>
      <small>alimentacao + dieta</small>
    </article>
    <article class="health-summary-card">
      <span>Hidratacao</span>
      <strong>${Math.round(waterToday)} ml</strong>
      <small>registrado hoje</small>
    </article>
    <article class="health-summary-card">
      <span>Treino</span>
      <strong>${Math.round(workoutToday)} min</strong>
      <small>tempo de treino hoje</small>
    </article>
    <article class="health-summary-card">
      <span>Medicamentos</span>
      <strong>${medicineOpen}</strong>
      <small>pendentes</small>
    </article>
    <article class="health-summary-card evolution">
      <span>Evolucao</span>
      <strong>${Math.max(0, Math.round(foodCalories - workoutCalories))} kcal</strong>
      <small>alimentacao menos treino registrado</small>
    </article>
  `;

  renderHealthPanel('alimentacao', 'Alimentacao', items.filter(item => item.tipo === 'alimentacao'));
  renderHealthPanel('medicamentos', 'Medicamentos', items.filter(item => item.tipo === 'medicamentos'));
  renderHealthPanel('hidratacao', 'Hidratacao', items.filter(item => item.tipo === 'hidratacao'));
  renderHealthPanel('treino', 'Treino', items.filter(item => item.tipo === 'treino'));
  renderHealthPanel('dieta', 'Dieta', items.filter(item => item.tipo === 'dieta'), `${Math.round(foodToday)} kcal hoje`);
}

function renderHealthPanel(type, title, items, detail = '') {
  const panel = qs(`#health-tab-${type}`);
  if (!panel) return;
  panel.innerHTML = `
    <div class="list-header">
      <span>${escapeHtml(title)}</span>
      <button class="pill-button" data-modal="health" data-health-kind="${type}"><i class="fa-solid fa-plus"></i><span>Adicionar</span></button>
    </div>
    ${detail ? `<div class="health-diet-total">${escapeHtml(detail)}</div>` : ''}
    <div class="health-list">${items.map(healthItemTemplate).join('') || emptyTemplate(`Nenhum registro em ${title.toLowerCase()}.`)}</div>
  `;
}

function healthItemTemplate(item) {
  const icon = {
    alimentacao: 'fa-utensils',
    medicamentos: 'fa-capsules',
    hidratacao: 'fa-droplet',
    treino: 'fa-dumbbell',
    dieta: 'fa-bowl-food'
  }[item.tipo] || 'fa-heart-pulse';
  const details = [
    item.data,
    item.horario,
    item.quantidade ? `${Number(item.quantidade)} ${escapeHtml(item.unidade || '')}` : '',
    item.duracao ? `${Number(item.duracao)} min` : '',
    item.calorias ? `${Number(item.calorias)} kcal` : ''
  ].filter(Boolean).join(' - ');
  return `
    <article class="health-item-card ${item.status === 'feito' ? 'done' : ''}">
      <div class="card-icon"><i class="fa-solid ${icon}"></i></div>
      <div class="card-main">
        <strong>${escapeHtml(item.nome)}</strong>
        <span>${escapeHtml(details || 'Sem detalhes')}</span>
        ${item.observacao ? `<span class="card-note">${escapeHtml(item.observacao)}</span>` : ''}
      </div>
      <span class="badge">${item.status === 'feito' ? 'Feito' : 'Aberto'}</span>
      <button class="delete-button" data-edit-health="${item.id}" aria-label="Editar registro"><i class="fa-regular fa-pen-to-square"></i></button>
      <button class="delete-button" data-delete="saude" data-id="${item.id}" aria-label="Excluir registro"><i class="fa-regular fa-trash-can"></i></button>
    </article>
  `;
}

function renderHome() {
  const items = state.data.casa || [];
  const pantry = items.filter(item => item.tipo === 'despensa');
  const bills = items.filter(item => item.tipo === 'conta');
  const shopping = items.filter(item => item.tipo === 'compra');
  const openBills = bills.filter(item => item.status !== 'feito');
  const shoppingOpen = shopping.filter(item => item.status !== 'feito');
  const lowPantry = pantry.filter(item => Number(item.quantidade || 0) <= Number(item.minimo || 0));

  qs('#homeOverview').innerHTML = `
    <article class="home-summary-card primary">
      <span>Despensa</span>
      <strong>${pantry.length}</strong>
      <small>${lowPantry.length} itens no minimo</small>
    </article>
    <article class="home-summary-card">
      <span>Contas abertas</span>
      <strong>${openBills.length}</strong>
      <small>${formatMoney(openBills.reduce((sum, item) => sum + Number(item.valor || 0), 0))} previsto</small>
    </article>
    <article class="home-summary-card">
      <span>Compras</span>
      <strong>${shoppingOpen.length}</strong>
      <small>${formatMoney(shoppingOpen.reduce((sum, item) => sum + Number(item.valor || 0), 0))} estimado</small>
    </article>
  `;
  renderHomePanel('despensa', 'Despensa', pantry, 'Nenhum item na despensa.');
  renderHomePanel('conta', 'Contas', bills, 'Nenhuma conta cadastrada.');
  renderHomePanel('compra', 'Compras', shoppingOpen, 'Nenhuma compra na lista.');
}

function renderHomePanel(type, title, items, emptyText) {
  const panel = qs(`#home-tab-${type}`);
  if (!panel) return;
  const shopping = state.data.casa?.filter(item => item.tipo === 'compra' && item.status !== 'feito') || [];
  const pantry = state.data.casa?.filter(item => item.tipo === 'despensa') || [];
  const essentials = type === 'despensa' ? pantryEssentialsTemplate(shopping, pantry) : '';
  if (type === 'conta') {
    panel.innerHTML = billPanelTemplate(items);
    return;
  }
  if (type === 'compra') {
    panel.innerHTML = shoppingPanelTemplate(items);
    return;
  }
  panel.innerHTML = `
    <article class="home-column home-panel-column">
      <div class="list-header">
        <span>${escapeHtml(title)}</span>
        <button class="pill-button" data-modal="home" data-home-kind="${type}"><i class="fa-solid fa-plus"></i><span>Adicionar</span></button>
      </div>
      <div class="home-list">${items.map(homeItemTemplate).join('') || emptyTemplate(emptyText)}</div>
      ${essentials}
    </article>
  `;
}

function shoppingPanelTemplate(items) {
  return `
    <article class="home-column home-panel-column shopping-panel">
      <div class="list-header">
        <span>Compras abertas</span>
        <button class="pill-button" data-modal="home" data-home-kind="compra"><i class="fa-solid fa-plus"></i><span>Adicionar</span></button>
      </div>
      <div class="shopping-list">${items.map(shoppingCardTemplate).join('') || emptyTemplate('Nenhuma compra na lista.')}</div>
    </article>
  `;
}

function shoppingCardTemplate(item) {
  const checklistTotal = Array.isArray(item.itensCompra) ? item.itensCompra.length : 0;
  const checklistDone = Array.isArray(item.itensCompra) ? item.itensCompra.filter(entry => entry.feito).length : 0;
  return `
    <article class="shopping-card">
      <div class="shopping-card-main">
        <span>Pendente</span>
        <strong>${escapeHtml(item.nome)}</strong>
        <small>${formatMoney(item.valor)}${item.vencimento ? ` - ${escapeHtml(item.vencimento)}` : ''}</small>
        ${checklistTotal ? `<small>${checklistDone}/${checklistTotal} itens marcados</small>` : ''}
      </div>
      <button class="primary-button" type="button" data-complete-shopping="${item.id}"><i class="fa-solid fa-cart-shopping"></i><span>Comprado</span></button>
    </article>
  `;
}

function billPanelTemplate(items) {
  const sorted = [...items].sort((a, b) => String(a.vencimento || '9999-12-31').localeCompare(String(b.vencimento || '9999-12-31')));
  const open = sorted.filter(item => item.status !== 'feito');
  const paid = sorted.filter(item => item.status === 'feito');
  const overdue = open.filter(item => billStatusInfo(item).state === 'overdue');
  const dueSoon = open.filter(item => ['today', 'soon'].includes(billStatusInfo(item).state));
  const openTotal = open.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  return `
    <article class="home-column home-panel-column bills-panel">
      <div class="list-header">
        <span>Boletos e contas</span>
        <button class="pill-button" data-modal="home" data-home-kind="conta"><i class="fa-solid fa-plus"></i><span>Boleto</span></button>
      </div>
      <section class="bill-summary-grid">
        <article><span>Em aberto</span><strong>${formatMoney(openTotal)}</strong><small>${open.length} boletos</small></article>
        <article><span>Vencidos</span><strong>${overdue.length}</strong><small>${formatMoney(overdue.reduce((sum, item) => sum + Number(item.valor || 0), 0))}</small></article>
        <article><span>A vencer</span><strong>${dueSoon.length}</strong><small>proximos 5 dias</small></article>
        <article><span>Pagos</span><strong>${paid.length}</strong><small>historico</small></article>
      </section>
      <div class="bill-list">${sorted.map(billCardTemplate).join('') || emptyTemplate('Nenhum boleto cadastrado.')}</div>
    </article>
  `;
}

function billStatusInfo(item) {
  if (item.status === 'feito') return { state: 'paid', label: 'Pago', icon: 'fa-check' };
  if (!item.vencimento) return { state: 'open', label: 'Sem vencimento', icon: 'fa-clock' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${item.vencimento}T00:00:00`);
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0) return { state: 'overdue', label: `Venceu ha ${Math.abs(diff)}d`, icon: 'fa-triangle-exclamation' };
  if (diff === 0) return { state: 'today', label: 'Vence hoje', icon: 'fa-bell' };
  if (diff <= 5) return { state: 'soon', label: `Vence em ${diff}d`, icon: 'fa-calendar-day' };
  return { state: 'open', label: `Vence em ${diff}d`, icon: 'fa-calendar' };
}

function billCardTemplate(item) {
  const status = billStatusInfo(item);
  const barcode = item.codigoBarras || item.linhaDigitavel || '';
  return `
    <article class="bill-card ${status.state}">
      <div class="bill-status-icon"><i class="fa-solid ${status.icon}"></i></div>
      <div class="bill-main">
        <div class="bill-topline">
          <span>${escapeHtml(status.label)}</span>
          <strong>${escapeHtml(item.nome)}</strong>
        </div>
        <div class="bill-meta">
          <span><i class="fa-regular fa-calendar"></i>${item.vencimento ? escapeHtml(item.vencimento) : 'Sem vencimento'}</span>
          ${item.recorrencia ? `<span><i class="fa-solid fa-rotate"></i>${escapeHtml(item.recorrencia)}</span>` : ''}
        </div>
        ${barcode ? `<code>${escapeHtml(barcode)}</code>` : ''}
        ${item.observacao ? `<p>${escapeHtml(item.observacao)}</p>` : ''}
      </div>
      <div class="bill-value">
        <strong>${formatMoney(item.valor)}</strong>
        <small>${item.status === 'feito' ? 'quitado' : 'a pagar'}</small>
      </div>
      <div class="bill-actions">
        ${barcode ? `<button class="icon-button" data-copy-bill="${escapeHtml(barcode)}" aria-label="Copiar linha digitavel"><i class="fa-regular fa-copy"></i></button>` : ''}
        <button class="icon-button" data-edit-home="${item.id}" aria-label="Editar boleto"><i class="fa-regular fa-pen-to-square"></i></button>
        ${item.status !== 'feito' ? `<button class="pill-button" data-pay-bill="${item.id}"><i class="fa-solid fa-check"></i><span>Pagar</span></button>` : ''}
        <button class="delete-button" data-delete="casa" data-id="${item.id}" aria-label="Excluir boleto"><i class="fa-regular fa-trash-can"></i></button>
      </div>
    </article>
  `;
}

function pantryEssentialsTemplate(shopping, pantry) {
  const added = pantryEssentials.filter(item => shopping.some(entry => entry.nome.toLowerCase() === item.toLowerCase())).length;
  return `
    <section class="pantry-essentials">
      <div class="pantry-essentials-head">
        <div>
          <span>Lista fixa da despensa</span>
          <strong>${added}/${pantryEssentials.length}</strong>
          <small>marcados em Compras</small>
        </div>
        <p>Marque qualquer item para mandar direto para Casa > Compras.</p>
      </div>
      <div class="pantry-essential-groups">
        ${pantryEssentialGroups.map(group => `
          <article class="pantry-essential-group">
            <div class="pantry-group-title">
              <i class="fa-solid ${group.icon}"></i>
              <span>${escapeHtml(group.title)}</span>
            </div>
            <div class="pantry-essential-grid">
              ${group.items.map(item => {
                const inShopping = shopping.some(entry => entry.nome.toLowerCase() === item.toLowerCase());
                const pantryItem = pantry.find(entry => entry.nome.toLowerCase() === item.toLowerCase());
                const qty = Number(pantryItem?.quantidade || 0);
                const min = Math.max(Number(pantryItem?.minimo || 1), 1);
                const pct = Math.min(100, Math.round((qty / min) * 100));
                const low = qty <= min;
                return `
                  <article class="pantry-essential-item ${low ? 'low' : ''}">
                    <label>
                      <input type="checkbox" data-add-pantry-shopping="${escapeHtml(item)}" ${inShopping ? 'checked' : ''}>
                      <span>${escapeHtml(item)}</span>
                    </label>
                    <div class="pantry-stock-row">
                      <small>${qty} de ${min} ${escapeHtml(pantryItem?.unidade || 'un')}</small>
                      <strong>${pct}%</strong>
                    </div>
                    <div class="pantry-stock-bar"><span style="width:${pct}%"></span></div>
                    <div class="pantry-actions">
                      <button class="icon-button" type="button" data-pantry-adjust="${escapeHtml(item)}" data-delta="-1" aria-label="Diminuir quantidade"><i class="fa-solid fa-minus"></i></button>
                      <button class="icon-button" type="button" data-pantry-adjust="${escapeHtml(item)}" data-delta="1" aria-label="Aumentar quantidade"><i class="fa-solid fa-plus"></i></button>
                      <button class="pill-button" type="button" data-edit-pantry-essential="${escapeHtml(item)}"><i class="fa-regular fa-pen-to-square"></i><span>Ajustar</span></button>
                    </div>
                  </article>
                `;
              }).join('')}
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function homeItemTemplate(item) {
  const isMoney = ['conta', 'compra'].includes(item.tipo);
  const status = item.status === 'feito' ? 'Concluido' : item.tipo === 'conta' ? 'Aberta' : 'Pendente';
  const meta = item.tipo === 'despensa'
    ? `${Number(item.quantidade || 0)} ${escapeHtml(item.unidade || 'un')} disponivel`
    : `${formatMoney(item.valor)}${item.vencimento ? ` - ${escapeHtml(item.vencimento)}` : ''}`;
  const checklist = item.tipo === 'compra' && Array.isArray(item.itensCompra) && item.itensCompra.length
    ? `<div class="home-checklist">${item.itensCompra.map((entry, index) => `
        <label>
          <input type="checkbox" data-toggle-home-item="${item.id}" data-item-index="${index}" ${entry.feito ? 'checked' : ''}>
          <span>${escapeHtml(entry.nome)}</span>
        </label>
      `).join('')}</div>`
    : '';
  return `
    <article class="home-item-card ${item.status === 'feito' ? 'done' : ''}">
      <div>
        <span>${escapeHtml(status)}</span>
        <strong>${escapeHtml(item.nome)}</strong>
        <small>${meta}</small>
      </div>
      <div class="item-actions">
        <button class="icon-button" data-edit-home="${item.id}" aria-label="Editar item da casa"><i class="fa-regular fa-pen-to-square"></i></button>
        <button class="delete-button" data-delete="casa" data-id="${item.id}" aria-label="Excluir item da casa"><i class="fa-regular fa-trash-can"></i></button>
      </div>
      ${item.observacao ? `<p>${escapeHtml(item.observacao)}</p>` : ''}
      ${checklist}
      ${isMoney ? '' : `<div class="bar"><span style="width:${Math.min(100, (Number(item.quantidade || 0) / Math.max(Number(item.minimo || 1), 1)) * 100)}%;background:var(--green)"></span></div>`}
    </article>
  `;
}

function shoppingChecklistRows(items = []) {
  const rows = items.length ? items : [{ nome: '', feito: false }];
  return rows.map(item => `
    <label class="shopping-edit-row">
      <input type="checkbox" name="shoppingDone" ${item.feito ? 'checked' : ''}>
      <input name="shoppingItem" type="text" value="${escapeHtml(item.nome || '')}" placeholder="Ex: arroz, leite, produto de limpeza">
    </label>
  `).join('');
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
  if (value.includes('estudo')) return 'estudo';
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

function uniqueStudySubjects() {
  const subjects = (state.data?.trabalhos || [])
    .map(normalizeAcademicItem)
    .filter(item => academicKind(item) === 'estudo')
    .map(item => item.disciplina)
    .filter(Boolean);
  return [...new Set(subjects)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function studySubjectOptions(current = '') {
  const subjects = uniqueStudySubjects();
  const currentValue = String(current || '').trim();
  if (currentValue && !subjects.includes(currentValue)) subjects.unshift(currentValue);
  return subjects.map(subject => `<option value="${escapeHtml(subject)}" ${subject === currentValue ? 'selected' : ''}>${escapeHtml(subject)}</option>`).join('');
}

function studySubjectsTemplate(subjects, studies) {
  if (!subjects.length) return '';
  return `
    <article class="study-subject-panel">
      <div class="list-header">
        <span>Materias salvas</span>
        <small>${subjects.length} ${subjects.length === 1 ? 'materia' : 'materias'}</small>
      </div>
      <div class="study-subject-list">
        ${subjects.map(subject => {
          const total = studies
            .filter(item => item.disciplina === subject)
            .reduce((sum, item) => sum + Number(item.horas || 0), 0);
          return `<span><strong>${escapeHtml(subject)}</strong><small>${formatDecimal(total)}h</small></span>`;
        }).join('')}
      </div>
    </article>
  `;
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
  const item = normalizeGoalItem(goal);
  const pct = goalProgress(item);
  return `
    <div class="mini-item">
      <div class="mini-top"><strong>${escapeHtml(item.nome)}</strong><span>${pct}%</span></div>
      <div class="bar"><span style="width:${pct}%;background:${item.cor}"></span></div>
      <div class="mini-sub">${goalValue(item, item.atual)} de ${goalValue(item, item.target)}</div>
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
  const note = item.icon === 'fa-file-invoice-dollar' || item.cat === 'Boleto'
    ? 'Boleto pago registrado no financeiro'
    : item.tipo === 'saida'
      ? 'Despesa lancada no fluxo mensal'
      : 'Receita adicionada ao saldo';
  return `
    <article class="list-card">
      <div class="card-icon" style="background:${style.bg};color:${style.color}"><i class="fa-solid ${escapeHtml(item.icon)}"></i></div>
      <div class="card-main">
        <strong>${escapeHtml(item.nome)}</strong>
        <span>${escapeHtml(item.cat)} · ${escapeHtml(item.data)} · ${escapeHtml(item.tipo)}</span>
        <span class="card-note">${note}${recurring}</span>
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
  const item = normalizeGoalItem(goal);
  const pct = goalProgress(item);
  const remaining = Math.max(0, Number(item.target || 0) - Number(item.atual || 0));
  return `
    <article class="list-card">
      <div class="card-icon" style="background:${item.cor}22;color:${item.cor}"><i class="fa-regular fa-circle-dot"></i></div>
      <div class="card-main">
        <strong>${escapeHtml(item.nome)}</strong>
        <span>${goalValue(item, item.atual)} de ${goalValue(item, item.target)} - ${escapeHtml(item.deadline)}</span>
        <span class="card-note">${escapeHtml(goalTypeLabel(item.tipo))} - falta ${goalValue(item, remaining)}${item.descricao ? ` - ${escapeHtml(item.descricao)}` : ''}</span>
        <div class="bar" style="margin-top:8px"><span style="width:${pct}%;background:${item.cor}"></span></div>
      </div>
      <span class="badge">${pct}%</span>
      <button class="delete-button" data-edit-goal="${item.id}" aria-label="Editar meta"><i class="fa-regular fa-pen-to-square"></i></button>
      <button class="delete-button" data-delete="metas" data-id="${item.id}" aria-label="Excluir meta"><i class="fa-regular fa-trash-can"></i></button>
    </article>
  `;
}
function workCardTemplate(work) {
  const item = normalizeAcademicItem(work);
  const kind = academicKind(item);
  const icon = kind === 'prova' ? 'fa-file-pen' : kind === 'anotacao' ? 'fa-note-sticky' : 'fa-list-check';
  return `
    <article class="work-card" draggable="true" data-work-id="${item.id}">
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
        ${item.horas ? `<span>${item.horas}h de estudo</span>` : ''}
        ${Number(item.salario || 0) ? `<span>Nota/peso ${Number(item.salario || 0)}</span>` : ''}
      </div>
      ${item.anotacao ? `<p class="work-note">${escapeHtml(item.anotacao)}</p>` : ''}
    </article>
  `;
}

function studyCardTemplate(work) {
  const item = normalizeAcademicItem(work);
  return `
    <article class="study-card">
      <div class="work-card-head">
        <div class="work-card-title">
          <strong>${escapeHtml(item.disciplina || 'Sem materia')}</strong>
          <span>${escapeHtml(item.inicio || 'Sem data')}</span>
        </div>
        <div class="account-actions">
          <button class="delete-button" data-edit-work="${item.id}" aria-label="Editar estudo"><i class="fa-regular fa-pen-to-square"></i></button>
          <button class="delete-button" data-delete="trabalhos" data-id="${item.id}" aria-label="Excluir estudo"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>
      <div class="study-card-meta">
        <span><i class="fa-solid fa-clock"></i>${formatDecimal(item.horas || 0)}h</span>
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
  qs('#workSubnav')?.classList.toggle('show', page === 'work');
  qs('#healthSubnav')?.classList.toggle('show', page === 'health');
  qs('#homeSubnav')?.classList.toggle('show', page === 'home');
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

function setWorkTab(tabName) {
  state.workTab = tabName;
  qsa('.nav-sub-item[data-work-nav]').forEach(button => button.classList.toggle('active', button.dataset.workNav === tabName));
  qsa('.work-panel').forEach(panel => panel.classList.toggle('active', panel.id === `work-tab-${tabName}`));
}

function setHealthTab(tabName) {
  state.healthTab = tabName;
  state.healthKind = tabName;
  qsa('.nav-sub-item[data-health-nav]').forEach(button => button.classList.toggle('active', button.dataset.healthNav === tabName));
  qsa('.health-panel').forEach(panel => panel.classList.toggle('active', panel.id === `health-tab-${tabName}`));
}

function setHomeTab(tabName) {
  state.homeTab = tabName;
  state.homeKind = tabName;
  qsa('.nav-sub-item[data-home-nav]').forEach(button => button.classList.toggle('active', button.dataset.homeNav === tabName));
  qsa('.home-panel').forEach(panel => panel.classList.toggle('active', panel.id === `home-tab-${tabName}`));
}

function openModal(type, editItem = null) {
  state.modalType = type;
  state.editing = editItem?.id ? { type, id: editItem.id } : null;
  const dialog = qs('#entityDialog');
  const title = qs('#dialogTitle');
  const fields = qs('#formFields');
  const today = new Date().toISOString().slice(0, 10);
  dialog.classList.toggle('wide-dialog', ['account', 'home', 'health'].includes(type));
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
    const item = normalizeGoalItem(editItem || {});
    title.textContent = editItem ? 'Editar meta' : 'Nova meta';
    fields.className = 'form-grid goal-editor-form';
    fields.innerHTML = `
      <div class="goal-edit-hero">
        <div>
          <span>Meta</span>
          <strong>${escapeHtml(item.nome || 'Nova meta')}</strong>
        </div>
        <i class="fa-regular fa-circle-dot"></i>
      </div>
      <section class="goal-edit-section">
        <div class="goal-edit-title"><i class="fa-solid fa-bullseye"></i><span>Objetivo</span></div>
        <div class="goal-edit-grid">
          ${field('nome', 'Nome', 'text', item.nome || 'Ex: Ler 12 livros', true)}
          <label>Tipo
            <select name="tipo" id="goalTypeSelect">
              <option value="dinheiro" ${item.tipo === 'dinheiro' ? 'selected' : ''}>Dinheiro</option>
              <option value="habito" ${item.tipo === 'habito' ? 'selected' : ''}>Habito</option>
              <option value="tarefa" ${item.tipo === 'tarefa' ? 'selected' : ''}>Tarefa</option>
              <option value="estudo" ${item.tipo === 'estudo' ? 'selected' : ''}>Estudo</option>
              <option value="outro" ${item.tipo === 'outro' ? 'selected' : ''}>Outro</option>
            </select>
          </label>
          ${field('deadline', 'Prazo', 'text', item.deadline || 'Dez 2026', false)}
          ${field('unidade', 'Unidade', 'text', item.unidade || 'itens', false)}
        </div>
      </section>
      <section class="goal-edit-section">
        <div class="goal-edit-title"><i class="fa-solid fa-chart-simple"></i><span>Progresso</span></div>
        <div class="goal-edit-grid">
          ${field('target', 'Alvo', 'number', item.target ?? '0', true)}
          ${field('atual', 'Atual', 'number', item.atual ?? '0', false)}
          ${field('cor', 'Cor', 'color', item.cor || '#4a9eff', false)}
        </div>
        <label>Descricao<textarea name="descricao" rows="3" placeholder="Ex: motivo, regra ou detalhe da meta">${escapeHtml(item.descricao || '')}</textarea></label>
      </section>
    `;
    updateGoalUnit();
  }

  if (type === 'work') {
    const item = editItem || { tipo: state.workKind || 'Trabalho' };
    const isStudy = academicKind(item) === 'estudo';
    title.textContent = editItem ? 'Editar item da faculdade' : 'Novo item da faculdade';
    fields.className = isStudy ? 'form-grid study-editor-form' : 'form-grid';
    if (isStudy) {
      title.textContent = editItem ? 'Editar estudo' : 'Registrar estudo';
      const currentSubject = item.disciplina || item.area || '';
      fields.innerHTML = `
        <div class="study-edit-hero">
          <div>
            <span>Registro de tempo</span>
            <strong>${escapeHtml(currentSubject || 'Nova materia')}</strong>
            <small>Use esta aba somente para registrar quanto tempo estudou.</small>
          </div>
          <i class="fa-solid fa-book-open-reader"></i>
        </div>
        <input type="hidden" name="tipo" value="Estudo">
        <input type="hidden" name="status" value="concluido">
        <section class="study-edit-section">
          <div class="study-edit-title"><i class="fa-solid fa-layer-group"></i><span>Materia</span></div>
          <div class="study-edit-grid">
            <label>Materia
              <select name="disciplinaPreset" id="studySubjectSelect">
                ${studySubjectOptions(currentSubject)}
                <option value="__nova__" ${currentSubject ? '' : 'selected'}>Nova materia</option>
              </select>
            </label>
            ${field('disciplinaNova', 'Adicionar materia', 'text', currentSubject ? '' : 'Ex: Calculo', !currentSubject)}
          </div>
        </section>
        <section class="study-edit-section">
          <div class="study-edit-title"><i class="fa-solid fa-clock"></i><span>Tempo estudado</span></div>
          <div class="study-edit-grid">
            ${field('inicio', 'Data', 'date', item.inicio || today, true)}
            ${field('horas', 'Tempo em horas', 'number', item.horas ?? '1', true)}
          </div>
          <label>Anotacoes<textarea name="anotacao" rows="4" placeholder="Ex: capitulos estudados, exercicios feitos, duvidas">${escapeHtml(item.anotacao || item.descricao || '')}</textarea></label>
        </section>
      `;
      updateStudySubjectMode();
    } else {
      fields.innerHTML = `
        <div class="form-section-title">Faculdade</div>
        ${field('nome', 'Titulo', 'text', item.nome || 'Ex: Prova de calculo', true)}
        <label>Tipo<select name="tipo"><option value="Prova" ${item.tipo === 'Prova' ? 'selected' : ''}>Prova</option><option value="Trabalho" ${item.tipo === 'Trabalho' ? 'selected' : ''}>Trabalho</option><option value="Anotacao" ${item.tipo === 'Anotacao' ? 'selected' : ''}>Anotacao</option></select></label>
        ${field('disciplina', 'Materia', 'text', item.disciplina || item.area || 'Ex: Matematica', false)}
        <div class="form-section-title">Prazo e detalhes</div>
        ${field('inicio', 'Data ou prazo', 'date', item.inicio || today, true)}
        ${field('horas', 'Horas de estudo', 'number', item.horas ?? '0', false)}
        ${field('salario', 'Nota ou peso', 'number', item.salario ?? '0', false)}
        <label>Anotacoes<textarea name="anotacao" rows="4">${escapeHtml(item.anotacao || item.descricao || '')}</textarea></label>
      `;
    }
  }

  if (type === 'home') {
    const item = editItem || { tipo: state.homeKind || 'despensa' };
    const kindLabel = { despensa: 'Despensa', conta: 'Contas', compra: 'Compras' }[item.tipo] || 'Casa';
    title.textContent = editItem ? 'Editar item da casa' : 'Novo item da casa';
    fields.className = 'form-grid home-editor-form';
    fields.innerHTML = `
      <div class="home-edit-hero">
        <div>
          <span>${escapeHtml(kindLabel)}</span>
          <strong>${escapeHtml(item.nome || 'Novo item')}</strong>
          <small>Organize a casa sem misturar com financeiro ou faculdade.</small>
        </div>
        <i class="fa-solid fa-house-chimney"></i>
      </div>
      <section class="home-edit-section">
        <div class="home-edit-title"><i class="fa-solid fa-layer-group"></i><span>Identificacao</span></div>
        <div class="home-edit-grid">
          ${field('nome', 'Nome', 'text', item.nome || 'Ex: Arroz, energia ou mercado', true)}
          <label>Area
            <select name="tipo" id="homeTypeSelect">
              <option value="despensa" ${item.tipo === 'despensa' ? 'selected' : ''}>Despensa</option>
              <option value="conta" ${item.tipo === 'conta' ? 'selected' : ''}>Contas</option>
              <option value="compra" ${item.tipo === 'compra' ? 'selected' : ''}>Compras</option>
            </select>
          </label>
          <label>Status
            <select name="status">
              <option value="pendente" ${item.status !== 'feito' ? 'selected' : ''}>Pendente</option>
              <option value="feito" ${item.status === 'feito' ? 'selected' : ''}>Concluido</option>
            </select>
          </label>
        </div>
      </section>
      <section class="home-edit-section home-stock-fields">
        <div class="home-edit-title"><i class="fa-solid fa-boxes-stacked"></i><span>Controle</span></div>
        <div class="home-edit-grid three">
          ${field('quantidade', 'Quantidade', 'number', item.quantidade ?? '1', false)}
          ${field('minimo', 'Minimo ideal', 'number', item.minimo ?? '1', false)}
          ${field('unidade', 'Unidade', 'text', item.unidade || 'un', false)}
        </div>
      </section>
      <section class="home-edit-section home-bill-fields">
        <div class="home-edit-title"><i class="fa-solid fa-barcode"></i><span>Boleto</span></div>
        <div class="home-edit-grid">
          ${field('valor', 'Valor do boleto', 'number', item.valor ?? '0', true)}
          ${field('vencimento', 'Vencimento', 'date', item.vencimento || '', true)}
          ${field('codigoBarras', 'Linha digitavel ou codigo de barras', 'text', item.codigoBarras || item.linhaDigitavel || '', false)}
          <label>Recorrencia
            <select name="recorrencia">
              <option value="" ${!item.recorrencia ? 'selected' : ''}>Sem recorrencia</option>
              <option value="Mensal" ${item.recorrencia === 'Mensal' ? 'selected' : ''}>Mensal</option>
              <option value="Semanal" ${item.recorrencia === 'Semanal' ? 'selected' : ''}>Semanal</option>
              <option value="Anual" ${item.recorrencia === 'Anual' ? 'selected' : ''}>Anual</option>
            </select>
          </label>
        </div>
      </section>
      <section class="home-edit-section home-shopping-fields">
        <div class="home-edit-title">
          <i class="fa-solid fa-list-check"></i>
          <span>Lista de compras</span>
          <button class="pill-button" id="addShoppingItemButton" type="button"><i class="fa-solid fa-plus"></i><span>Item</span></button>
        </div>
        <div class="home-edit-grid">
          ${field('valor', 'Valor estimado', 'number', item.valor ?? '0', false)}
          ${field('vencimento', 'Data da compra', 'date', item.vencimento || '', false)}
        </div>
        <div id="shoppingItemsEditor" class="shopping-edit-list">${shoppingChecklistRows(item.itensCompra)}</div>
      </section>
      <section class="home-edit-section">
        <div class="home-edit-title"><i class="fa-regular fa-note-sticky"></i><span>Detalhes</span></div>
        <label>Observacao<textarea name="observacao" rows="3" placeholder="Detalhes, mercado, prioridade ou lembrete">${escapeHtml(item.observacao || '')}</textarea></label>
      </section>
    `;
    updateHomeEditorMode();
  }

  if (type === 'health') {
    const item = editItem || { tipo: state.healthKind || state.healthTab || 'alimentacao', data: today };
    const labels = {
      alimentacao: 'Alimentacao',
      medicamentos: 'Medicamentos',
      hidratacao: 'Hidratacao',
      treino: 'Treino',
      dieta: 'Dieta'
    };
    title.textContent = editItem ? 'Editar registro de saude' : 'Novo registro de saude';
    fields.className = 'form-grid health-editor-form';
    fields.innerHTML = `
      <div class="health-edit-hero">
        <div>
          <span>${escapeHtml(labels[item.tipo] || 'Saude')}</span>
          <strong>${escapeHtml(item.nome || 'Novo registro')}</strong>
          <small>Registre dados simples para acompanhar sua rotina.</small>
        </div>
        <i class="fa-solid fa-heart-pulse"></i>
      </div>
      <section class="health-edit-section">
        <div class="health-edit-title"><i class="fa-solid fa-layer-group"></i><span>Registro</span></div>
        <div class="health-edit-grid">
          ${field('nome', 'Nome', 'text', item.nome || 'Ex: Almoco, remedio, treino de peito', true)}
          <label>Area
            <select name="tipo" id="healthTypeSelect">
              <option value="alimentacao" ${item.tipo === 'alimentacao' ? 'selected' : ''}>Alimentacao</option>
              <option value="medicamentos" ${item.tipo === 'medicamentos' ? 'selected' : ''}>Medicamentos</option>
              <option value="hidratacao" ${item.tipo === 'hidratacao' ? 'selected' : ''}>Hidratacao</option>
              <option value="treino" ${item.tipo === 'treino' ? 'selected' : ''}>Treino</option>
              <option value="dieta" ${item.tipo === 'dieta' ? 'selected' : ''}>Dieta</option>
            </select>
          </label>
          ${field('data', 'Data', 'date', item.data || today, true)}
          ${field('horario', 'Horario', 'time', item.horario || '', false)}
          <label>Status
            <select name="status">
              <option value="pendente" ${item.status !== 'feito' ? 'selected' : ''}>Pendente</option>
              <option value="feito" ${item.status === 'feito' ? 'selected' : ''}>Feito</option>
            </select>
          </label>
        </div>
      </section>
      <section class="health-edit-section">
        <div class="health-edit-title"><i class="fa-solid fa-chart-simple"></i><span>Dados</span></div>
        <div class="health-edit-grid three">
          ${field('calorias', 'Kcal', 'number', item.calorias ?? '0', false)}
          ${field('quantidade', 'Quantidade', 'number', item.quantidade ?? '0', false)}
          ${field('unidade', 'Unidade', 'text', item.unidade || 'ml', false)}
          ${field('duracao', 'Duracao do treino (min)', 'number', item.duracao ?? '0', false)}
          ${field('dose', 'Dose', 'text', item.dose || '', false)}
        </div>
        <label>Observacao<textarea name="observacao" rows="3" placeholder="Ex: como foi, sintomas, serie do treino ou alimentos">${escapeHtml(item.observacao || '')}</textarea></label>
      </section>
    `;
  }

  if (type === 'account') {
    const { account, card } = findRelatedAccountParts(editItem);
    const bankName = account?.nome || card?.nome?.replace(/\s*credito$/i, '') || '';
    const bankLabel = account?.bandeira || card?.bandeira || bankName;
    const groupId = account?.groupId || card?.groupId || editItem?.groupId || newGroupId();
    const creditEnabled = Boolean(card);
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
        <label class="toggle-line account-credit-toggle">
          <input id="accountCreditToggle" name="creditoAtivo" type="checkbox" value="true" ${creditEnabled ? 'checked' : ''}>
          <span>Ativar cartao de credito nesse banco</span>
        </label>
        <div class="account-edit-grid three">
          ${field('limite', 'Limite total', 'number', card?.limite ?? '0', false)}
          ${field('usado', 'Fatura atual', 'number', card?.usado ?? '0', false)}
          ${field('vencimento', 'Vencimento', 'number', card?.vencimento ?? '1', false)}
        </div>
      </section>
    `;
    updateAccountCreditMode();
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
  const decimalFields = ['val', 'target', 'atual', 'salario', 'saldo', 'limite', 'usado', 'valor', 'rendimento', 'quantidade', 'minimo', 'calorias', 'duracao'];
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
  if (state.modalType === 'work' && academicKind(data) === 'estudo') {
    const subject = data.disciplinaPreset === '__nova__'
      ? String(data.disciplinaNova || '').trim()
      : String(data.disciplinaPreset || '').trim();
    data.disciplina = subject || 'Sem materia';
    data.nome = `Estudo - ${data.disciplina}`;
    data.status = 'concluido';
    data.salario = 0;
    delete data.disciplinaPreset;
    delete data.disciplinaNova;
  }
  if (state.modalType === 'home') {
    data.itensCompra = qsa('.shopping-edit-row').map(row => ({
      nome: qs('[name="shoppingItem"]', row)?.value || '',
      feito: Boolean(qs('[name="shoppingDone"]', row)?.checked)
    })).filter(item => item.nome.trim());
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
    home: '/api/casa',
    health: '/api/saude',
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
        : editing && editing.type === 'home'
          ? `/api/casa/${editing.id}`
          : editing && editing.type === 'health'
            ? `/api/saude/${editing.id}`
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
  const creditEnabled = data.creditoAtivo === 'true';
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

  if (!creditEnabled) {
    if (editing.cardId) await api(`/api/contas-cartoes/${editing.cardId}`, { method: 'DELETE' });
    return;
  }

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
  ['rendimento', 'quantidade', 'minimo', 'calorias', 'duracao'].forEach(key => {
    if (key in data) data[key] = parseDecimal(data[key]);
  });
}

function updateAccountCreditMode() {
  const toggle = qs('#accountCreditToggle');
  const section = toggle?.closest('.account-edit-section');
  if (!toggle || !section) return;
  const enabled = toggle.checked;
  qsa('input[name="limite"], input[name="usado"], input[name="vencimento"]', section).forEach(input => {
    input.disabled = !enabled;
  });
  section.classList.toggle('credit-disabled', !enabled);
}

function updateStudySubjectMode() {
  const select = qs('#studySubjectSelect');
  const customInput = qs('[name="disciplinaNova"]');
  if (!select || !customInput) return;
  const isNew = select.value === '__nova__';
  customInput.closest('label')?.classList.toggle('hidden', !isNew);
  customInput.required = isNew;
  if (!isNew) customInput.value = '';
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

function editHome(id) {
  const item = (state.data.casa || []).find(home => home.id === id);
  if (item) openModal('home', item);
}

function editHealth(id) {
  const item = (state.data.saude || []).find(health => health.id === id);
  if (item) openModal('health', item);
}

function addShoppingChecklistRow() {
  const container = qs('#shoppingItemsEditor');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', shoppingChecklistRows([{ nome: '', feito: false }]));
  qs('.shopping-edit-row:last-child [name="shoppingItem"]', container)?.focus();
}

function updateHomeEditorMode() {
  const type = qs('#homeTypeSelect')?.value;
  const stock = qs('.home-stock-fields');
  const bill = qs('.home-bill-fields');
  const shopping = qs('.home-shopping-fields');
  if (!type || !stock || !bill || !shopping) return;
  const isShopping = type === 'compra';
  const isBill = type === 'conta';
  stock.classList.toggle('hidden', isShopping || isBill);
  bill.classList.toggle('hidden', !isBill);
  shopping.classList.toggle('hidden', !isShopping);
  setSectionDisabled(stock, isShopping || isBill);
  setSectionDisabled(bill, !isBill);
  setSectionDisabled(shopping, !isShopping);
}

function setSectionDisabled(section, disabled) {
  qsa('input, select, textarea, button', section).forEach(control => {
    if (control.id === 'addShoppingItemButton') {
      control.disabled = disabled;
      return;
    }
    control.disabled = disabled;
  });
}

async function toggleHomeChecklistItem(id, index, checked) {
  const item = (state.data.casa || []).find(home => home.id === id);
  if (!item || !Array.isArray(item.itensCompra) || !item.itensCompra[index]) return;
  const updated = {
    ...item,
    itensCompra: item.itensCompra.map((entry, entryIndex) => entryIndex === index ? { ...entry, feito: checked } : entry)
  };
  await api(`/api/casa/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updated)
  });
  await loadDashboard();
}

async function addPantryItemToShopping(name) {
  const itemName = String(name || '').trim();
  if (!itemName) return;
  const exists = (state.data.casa || []).some(item => item.tipo === 'compra' && item.status !== 'feito' && item.nome.toLowerCase() === itemName.toLowerCase());
  if (exists) {
    showToast('Ja esta em compras', itemName);
    return;
  }
  await api('/api/casa', {
    method: 'POST',
    body: JSON.stringify({
      tipo: 'compra',
      nome: itemName,
      status: 'pendente',
      valor: 0,
      observacao: 'Adicionado pela despensa'
    })
  });
  showToast('Adicionado em compras', itemName);
  await loadDashboard();
}

async function togglePantryShopping(name, checked) {
  const itemName = String(name || '').trim();
  if (!itemName) return;
  if (checked) {
    await addPantryItemToShopping(itemName);
    return;
  }
  const item = (state.data.casa || []).find(entry => entry.tipo === 'compra' && entry.status !== 'feito' && entry.nome.toLowerCase() === itemName.toLowerCase());
  if (!item) return;
  await api(`/api/casa/${item.id}`, { method: 'DELETE' });
  showToast('Removido das compras', itemName);
  await loadDashboard();
}

function pantryItemPayload(name, overrides = {}) {
  return {
    tipo: 'despensa',
    nome: name,
    status: 'pendente',
    quantidade: 0,
    minimo: 1,
    unidade: 'un',
    ...overrides
  };
}

function editPantryEssential(name) {
  const itemName = String(name || '').trim();
  if (!itemName) return;
  const existing = (state.data.casa || []).find(item => item.tipo === 'despensa' && item.nome.toLowerCase() === itemName.toLowerCase());
  openModal('home', existing || pantryItemPayload(itemName));
}

async function adjustPantryEssential(name, delta) {
  const itemName = String(name || '').trim();
  if (!itemName) return;
  const existing = (state.data.casa || []).find(item => item.tipo === 'despensa' && item.nome.toLowerCase() === itemName.toLowerCase());
  const nextQuantity = Math.max(0, Number(existing?.quantidade || 0) + Number(delta || 0));
  const payload = pantryItemPayload(itemName, {
    ...(existing || {}),
    quantidade: nextQuantity
  });
  const path = existing ? `/api/casa/${existing.id}` : '/api/casa';
  await api(path, {
    method: existing ? 'PUT' : 'POST',
    body: JSON.stringify(payload)
  });
  await loadDashboard();
}

async function payBill(id) {
  const item = (state.data.casa || []).find(home => home.id === id);
  if (!item) return;
  if (item.status === 'feito') {
    showToast('Boleto ja pago', item.nome);
    return;
  }
  await api('/api/transacoes', {
    method: 'POST',
    body: JSON.stringify({
      nome: 'Boleto pago',
      cat: 'Boleto',
      tipo: 'saida',
      val: item.valor || 0,
      data: new Date().toISOString().slice(0, 10),
      recorrente: false,
      icon: 'fa-file-invoice-dollar'
    })
  });
  await api(`/api/casa/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...item, status: 'feito' })
  });
  showToast('Boleto pago', 'Saida registrada em movimentacoes.');
  await loadDashboard();
}

async function completeShoppingItem(id) {
  const item = (state.data.casa || []).find(home => home.id === id);
  if (!item) return;
  await api(`/api/casa/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...item, status: 'feito' })
  });
  showToast('Compra concluida', item.nome);
  await loadDashboard();
}

async function copyBillCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    showToast('Codigo copiado', 'Linha digitavel pronta para colar.');
  } catch {
    showToast('Nao copiou', 'Selecione a linha digitavel manualmente.');
  }
}

async function updateWorkStatus(id, status) {
  const item = state.data.trabalhos.find(work => work.id === id);
  if (!item || item.status === status) return;
  const optimistic = { ...item, status };
  state.data.trabalhos = state.data.trabalhos.map(work => work.id === id ? optimistic : work);
  renderWork();
  await api(`/api/trabalhos/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...item, status })
  });
  await loadDashboard();
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

function updateGoalUnit() {
  const type = qs('#goalTypeSelect')?.value;
  const unit = qs('[name="unidade"]');
  if (!type || !unit || unit.value) return;
  unit.value = type === 'dinheiro' ? 'R$' : type === 'habito' ? 'dias' : type === 'estudo' ? 'horas' : 'itens';
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
  const loginEmail = state.user?.email || state.user?.username || 'sem login';
  const email = state.gmailStatus?.connected ? (state.gmailStatus.email || 'Gmail conectado') : loginEmail;
  const label = qs('#gmailAccount');
  if (label) label.textContent = email;
  const connected = Boolean(state.gmailStatus?.connected);
  const status = qs('#gmailStatusText');
  if (status) status.textContent = connected
    ? `Gmail conectado nesta conta LASTTRO: ${loginEmail}.`
    : (state.gmailStatus?.error || 'Clique em conectar para liberar qualquer Gmail.');
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
  qsa('[data-modal]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    if (button.dataset.modal === 'work') state.workKind = button.dataset.workKind || (state.workTab === 'estudos' ? 'Estudo' : 'Trabalho');
    if (button.dataset.homeKind) state.homeKind = button.dataset.homeKind;
    if (button.dataset.healthKind) state.healthKind = button.dataset.healthKind;
    openModal(button.dataset.modal);
  }));
  qsa('.finance-tab').forEach(button => {
    button.addEventListener('click', () => setFinanceTab(button.dataset.financeTab));
  });
  qsa('[data-work-nav]').forEach(button => {
    button.addEventListener('click', () => {
      setPage('work');
      setWorkTab(button.dataset.workNav);
    });
  });
  qsa('[data-health-nav]').forEach(button => {
    button.addEventListener('click', () => {
      setPage('health');
      setHealthTab(button.dataset.healthNav);
    });
  });
  qsa('[data-home-nav]').forEach(button => {
    button.addEventListener('click', () => {
      setPage('home');
      setHomeTab(button.dataset.homeNav);
    });
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
    if (event.target.id === 'accountCreditToggle') updateAccountCreditMode();
    if (event.target.id === 'studySubjectSelect') updateStudySubjectMode();
    if (event.target.id === 'goalTypeSelect') {
      qs('[name="unidade"]').value = '';
      updateGoalUnit();
    }
    if (event.target.id === 'homeTypeSelect') updateHomeEditorMode();
  });
  qs('#entityForm').addEventListener('input', event => {
    if (state.modalType === 'bankWithdraw' && event.target.name === 'valor') updateWithdrawSimulation();
  });

  document.body.addEventListener('dragstart', event => {
    const card = event.target.closest('[data-work-id]');
    if (!card) return;
    event.dataTransfer.setData('text/plain', card.dataset.workId);
    event.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });

  document.body.addEventListener('dragend', event => {
    event.target.closest('[data-work-id]')?.classList.remove('dragging');
    qsa('.kanban-column').forEach(column => column.classList.remove('drop-target'));
  });

  document.body.addEventListener('dragover', event => {
    const column = event.target.closest('[data-work-status]');
    if (!column) return;
    event.preventDefault();
    column.closest('.kanban-column')?.classList.add('drop-target');
  });

  document.body.addEventListener('dragleave', event => {
    const column = event.target.closest('.kanban-column');
    if (column && !column.contains(event.relatedTarget)) column.classList.remove('drop-target');
  });

  document.body.addEventListener('drop', event => {
    const column = event.target.closest('[data-work-status]');
    if (!column) return;
    event.preventDefault();
    qsa('.kanban-column').forEach(item => item.classList.remove('drop-target'));
    const id = event.dataTransfer.getData('text/plain');
    const status = column.dataset.workStatus;
    if (id && status) updateWorkStatus(id, status);
  });

  document.body.addEventListener('click', event => {
    const modalButton = event.target.closest('[data-modal]');
    if (modalButton) {
      if (modalButton.dataset.modal === 'work') state.workKind = modalButton.dataset.workKind || (state.workTab === 'estudos' ? 'Estudo' : 'Trabalho');
      if (modalButton.dataset.homeKind) state.homeKind = modalButton.dataset.homeKind;
      if (modalButton.dataset.healthKind) state.healthKind = modalButton.dataset.healthKind;
      openModal(modalButton.dataset.modal);
      return;
    }

    const categoryButton = event.target.closest('[data-category]');
    if (categoryButton) {
      state.transactionCategory = categoryButton.dataset.category;
      renderFinance();
      return;
    }

    if (event.target.closest('#addShoppingItemButton')) {
      addShoppingChecklistRow();
      return;
    }

    const pantryAdjustButton = event.target.closest('[data-pantry-adjust]');
    if (pantryAdjustButton) {
      adjustPantryEssential(pantryAdjustButton.dataset.pantryAdjust, pantryAdjustButton.dataset.delta);
      return;
    }

    const pantryEditButton = event.target.closest('[data-edit-pantry-essential]');
    if (pantryEditButton) {
      editPantryEssential(pantryEditButton.dataset.editPantryEssential);
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

    const editHomeButton = event.target.closest('[data-edit-home]');
    if (editHomeButton) {
      editHome(editHomeButton.dataset.editHome);
      return;
    }

    const payBillButton = event.target.closest('[data-pay-bill]');
    if (payBillButton) {
      payBill(payBillButton.dataset.payBill);
      return;
    }

    const completeShoppingButton = event.target.closest('[data-complete-shopping]');
    if (completeShoppingButton) {
      completeShoppingItem(completeShoppingButton.dataset.completeShopping);
      return;
    }

    const copyBillButton = event.target.closest('[data-copy-bill]');
    if (copyBillButton) {
      copyBillCode(copyBillButton.dataset.copyBill);
      return;
    }

    const editHealthButton = event.target.closest('[data-edit-health]');
    if (editHealthButton) {
      editHealth(editHealthButton.dataset.editHealth);
      return;
    }

    const duplicateTransactionButton = event.target.closest('[data-duplicate-transaction]');
    if (duplicateTransactionButton) {
      duplicateTransaction(duplicateTransactionButton.dataset.duplicateTransaction);
      return;
    }

    const downloadStatementButton = event.target.closest('[data-download-statement]');
    if (downloadStatementButton) {
      downloadMonthlyStatement(downloadStatementButton.dataset.downloadStatement);
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

  document.body.addEventListener('change', event => {
    const pantryItem = event.target.closest('[data-add-pantry-shopping]');
    if (pantryItem) {
      togglePantryShopping(pantryItem.dataset.addPantryShopping, pantryItem.checked);
      return;
    }

    const checklistItem = event.target.closest('[data-toggle-home-item]');
    if (!checklistItem) return;
    toggleHomeChecklistItem(checklistItem.dataset.toggleHomeItem, Number(checklistItem.dataset.itemIndex), checklistItem.checked);
  });
}

bindEvents();
initAuth();
