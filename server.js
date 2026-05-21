const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const initialData = {
  transacoes: [
    { id: 't1', nome: 'Freela site', cat: 'Freela', tipo: 'entrada', val: 169, data: '2026-05-11', icon: 'fa-laptop-code' },
    { id: 't2', nome: 'Salario', cat: 'Salario', tipo: 'entrada', val: 700, data: '2026-05-01', icon: 'fa-building' },
    { id: 't3', nome: 'Renda extra', cat: 'Renda extra', tipo: 'entrada', val: 200, data: '2026-05-01', icon: 'fa-coins' },
    { id: 't4', nome: 'Investimento mensal', cat: 'Investimentos', tipo: 'investimento', val: 1000, data: '2026-05-01', icon: 'fa-chart-line' },
    { id: 't5', nome: 'Uber', cat: 'Transporte', tipo: 'saida', val: -150, data: '2026-05-08', icon: 'fa-car' },
    { id: 't6', nome: 'iFood', cat: 'Alimentacao', tipo: 'saida', val: -53, data: '2026-05-07', icon: 'fa-utensils' },
    { id: 't7', nome: 'Farmacia', cat: 'Saude', tipo: 'saida', val: -245, data: '2026-05-05', icon: 'fa-kit-medical' },
    { id: 't8', nome: 'Gasolina', cat: 'Transporte', tipo: 'saida', val: -150, data: '2026-05-03', icon: 'fa-gas-pump' },
    { id: 't9', nome: 'Outros', cat: 'Diversos', tipo: 'saida', val: -50, data: '2026-05-02', icon: 'fa-box' }
  ],
  metas: [
    { id: 'm1', nome: 'Praia', target: 3000, atual: 150, cor: '#f0a500', deadline: 'Dez 2026' },
    { id: 'm2', nome: 'Reserva de emergencia', target: 10000, atual: 3200, cor: '#4a9eff', deadline: 'Jun 2027' },
    { id: 'm3', nome: 'Notebook novo', target: 4500, atual: 3060, cor: '#2ecc8a', deadline: 'Ago 2026' }
  ],
  trabalhos: [
    { id: 'j1', nome: 'Empresa Principal', tipo: 'CLT', status: 'ativo', salario: 700, horas: 44, inicio: '2025-01-01' },
    { id: 'j2', nome: 'Freela Dev', tipo: 'Freelancer', status: 'andamento', salario: 169, horas: 8, inicio: '2026-05-10' }
  ],
  contasCartoes: [
    { id: 'c1', nome: 'Inter principal', tipo: 'conta', bandeira: 'Conta corrente', saldo: 1421, limite: 0, usado: 0, vencimento: 1 },
    { id: 'c2', nome: 'Nubank', tipo: 'cartao', bandeira: 'Mastercard', saldo: 0, limite: 1800, usado: 390, vencimento: 15 }
  ],
  investimentosCarteira: [
    { id: 'i1', nome: 'Reserva CDI', tipo: 'Renda fixa', valor: 1000, rendimento: 0.8, data: '2026-05-01' }
  ],
  banco: {
    saldo: 0,
    retiradas: []
  },
  auth: {
    username: 'admin@lasttro.local',
    passwordHash: '57b6e0d1e093daa2dcdd00866ea301bf78b73473b939a0284cc081ec7d35cad3'
  }
};

const sessions = new Map();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await writeDb(initialData);
  }
}

async function readDb() {
  await ensureDb();
  const db = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
  return withDefaults(db);
}

async function writeDb(data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  if (Buffer.isBuffer(data)) return res.end(data);
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Payload muito grande'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON invalido'));
      }
    });
  });
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function isAuthenticated(req) {
  return sessions.has(getBearerToken(req));
}

function getSessionUser(req) {
  return sessions.get(getBearerToken(req));
}

function blankUserData() {
  return {
    transacoes: [],
    metas: [],
    trabalhos: [],
    contasCartoes: [],
    investimentosCarteira: [],
    banco: { saldo: 0, retiradas: [] }
  };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeUser(user = {}) {
  const fallback = String(user.email || user.username || '').trim();
  const email = normalizeEmail(fallback.includes('@') ? fallback : `${fallback || 'admin'}@lasttro.local`);
  return {
    email,
    username: email,
    passwordHash: user.passwordHash || ''
  };
}

function normalizeAuth(auth = {}) {
  const users = Array.isArray(auth.users) && auth.users.length
    ? auth.users
    : [{ email: auth.email || auth.username || initialData.auth.username, passwordHash: auth.passwordHash || initialData.auth.passwordHash }];
  const normalizedUsers = users.map(normalizeUser).filter(user => user.email && user.passwordHash);
  return {
    email: normalizedUsers[0]?.email || initialData.auth.username,
    username: normalizedUsers[0]?.email || initialData.auth.username,
    passwordHash: normalizedUsers[0]?.passwordHash || initialData.auth.passwordHash,
    users: normalizedUsers
  };
}

function publicUser(user) {
  return { email: user.email, username: user.email };
}

function normalizeTransaction(item) {
  const tipo = ['entrada', 'saida', 'investimento'].includes(item.tipo) ? item.tipo : 'saida';
  const rawVal = Number(item.val || 0);
  const val = tipo === 'saida' ? -Math.abs(rawVal) : Math.abs(rawVal);
  return {
    id: item.id || crypto.randomUUID(),
    nome: String(item.nome || 'Sem nome').trim(),
    cat: String(item.cat || 'Diversos').trim(),
    tipo,
    val,
    data: item.data || new Date().toISOString().slice(0, 10),
    icon: item.icon || (tipo === 'entrada' ? 'fa-coins' : tipo === 'investimento' ? 'fa-chart-line' : 'fa-receipt')
  };
}

function withDefaults(db) {
  const baseData = normalizeUserData({
    transacoes: db.transacoes || [],
    metas: db.metas || [],
    trabalhos: db.trabalhos || [],
    contasCartoes: db.contasCartoes || initialData.contasCartoes,
    investimentosCarteira: db.investimentosCarteira || initialData.investimentosCarteira,
    banco: db.banco
  });
  const auth = normalizeAuth(db.auth || initialData.auth);
  const accountsData = db.accountsData || {};
  const firstEmail = auth.users[0]?.email || initialData.auth.username;

  if (!accountsData[firstEmail]) accountsData[firstEmail] = baseData;

  return {
    ...db,
    auth,
    accountsData
  };
}

function normalizeUserData(data = {}) {
  return {
    transacoes: data.transacoes || [],
    metas: data.metas || [],
    trabalhos: data.trabalhos || [],
    contasCartoes: (data.contasCartoes || []).map(normalizeAccountCard),
    investimentosCarteira: data.investimentosCarteira || [],
    banco: {
      saldo: Number(data.banco?.saldo || 0),
      retiradas: data.banco?.retiradas || []
    }
  };
}

function getUserData(db, email) {
  const key = normalizeEmail(email);
  if (!db.accountsData[key]) db.accountsData[key] = blankUserData();
  db.accountsData[key] = normalizeUserData(db.accountsData[key]);
  return db.accountsData[key];
}

function normalizeAccountCard(item) {
  return {
    id: item.id || crypto.randomUUID(),
    nome: String(item.nome || 'Nova conta').trim(),
    tipo: ['conta', 'cartao'].includes(item.tipo) ? item.tipo : 'cartao',
    bandeira: String(item.bandeira || 'Nao informado').trim(),
    saldo: Number(item.saldo || 0),
    limite: Number(item.limite || 0),
    usado: Number(item.usado || 0),
    vencimento: Number(item.vencimento || 1)
  };
}

function normalizeGoal(item) {
  return {
    id: item.id || crypto.randomUUID(),
    nome: String(item.nome || 'Nova meta').trim(),
    target: Number(item.target || 0),
    atual: Number(item.atual || 0),
    cor: item.cor || '#4a9eff',
    deadline: item.deadline || 'Sem prazo'
  };
}

function normalizeWork(item) {
  return {
    id: item.id || crypto.randomUUID(),
    nome: String(item.nome || 'Novo trabalho').trim(),
    tipo: String(item.tipo || 'Freelancer').trim(),
    status: ['ativo', 'andamento', 'concluido'].includes(item.status) ? item.status : 'andamento',
    salario: Number(item.salario || 0),
    horas: Number(item.horas || 1),
    inicio: item.inicio || new Date().toISOString().slice(0, 10)
  };
}

function buildResumo(db) {
  const entradas = db.transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.val, 0);
  const investimentos = db.transacoes.filter(t => t.tipo === 'investimento').reduce((s, t) => s + t.val, 0);
  const gastos = Math.abs(db.transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.val, 0));
  const saldo = entradas + investimentos - gastos;
  const carteiraInvestimentos = db.investimentosCarteira.reduce((s, i) => s + Number(i.valor || 0), 0);
  const bancoSaldo = Number(db.banco?.saldo || 0);
  const bancoAberto = (db.banco?.retiradas || [])
    .filter(r => r.status === 'aberto')
    .reduce((s, r) => s + Number(r.totalDevolver || 0), 0);
  const cartoesTotal = db.contasCartoes
    .filter(c => c.tipo === 'cartao')
    .reduce((s, c) => s + Number(c.usado || 0), 0);
  const contasSaldo = db.contasCartoes
    .filter(c => c.tipo === 'conta')
    .reduce((s, c) => s + Number(c.saldo || 0), 0);
  const trabalhosRenda = db.trabalhos
    .filter(j => j.status !== 'concluido')
    .reduce((s, j) => s + Number(j.salario || 0), 0);
  const trabalhosHoras = db.trabalhos
    .filter(j => j.status !== 'concluido')
    .reduce((s, j) => s + Number(j.horas || 0), 0);
  const patrimonio = db.metas.reduce((s, m) => s + Number(m.atual || 0), 0) + Math.max(saldo, 0) + carteiraInvestimentos + bancoSaldo + contasSaldo;
  const disponivelTotal = contasSaldo + bancoSaldo;
  const porCategoria = db.transacoes
    .filter(t => t.tipo === 'saida')
    .reduce((acc, t) => {
      acc[t.cat] = (acc[t.cat] || 0) + Math.abs(t.val);
      return acc;
    }, {});

  return {
    entradas,
    investimentos,
    gastos,
    saldo,
    patrimonio,
    metasAtivas: db.metas.length,
    metasConcluidas: db.metas.filter(m => Number(m.atual) >= Number(m.target)).length,
    trabalhosAtivos: db.trabalhos.filter(j => j.status !== 'concluido').length,
    trabalhosAndamento: db.trabalhos.filter(j => j.status === 'andamento').length,
    trabalhosRenda,
    trabalhosHoras,
    carteiraInvestimentos,
    bancoSaldo,
    bancoAberto,
    cartoesTotal,
    contasSaldo,
    disponivelTotal,
    porCategoria: Object.entries(porCategoria).map(([nome, valor]) => ({ nome, valor }))
  };
}

async function handleApi(req, res, pathname) {
  const db = await readDb();
  const collection = pathname.split('/')[2];

  if (req.method === 'POST' && pathname === '/api/login') {
    const body = await readBody(req);
    const email = normalizeEmail(body.email || body.username);
    const user = db.auth.users.find(item => item.email === email);
    if (user && hashPassword(body.password) === user.passwordHash) {
      const token = crypto.randomUUID();
      sessions.set(token, user.email);
      return send(res, 200, { token, user: publicUser(user) });
    }
    return send(res, 401, { error: 'Email ou senha invalidos' });
  }

  if (req.method === 'POST' && pathname === '/api/register') {
    const body = await readBody(req);
    const email = normalizeEmail(body.email || body.username);
    const password = String(body.password || '');
    if (!isValidEmail(email)) return send(res, 400, { error: 'Informe um email valido' });
    if (password.length < 6) return send(res, 400, { error: 'Senha precisa ter pelo menos 6 caracteres' });
    if (db.auth.users.some(user => user.email === email)) {
      return send(res, 409, { error: 'Email ja cadastrado' });
    }
    const user = { email, username: email, passwordHash: hashPassword(password) };
    db.auth.users.push(user);
    db.accountsData[email] = blankUserData();
    await writeDb(db);
    const token = crypto.randomUUID();
    sessions.set(token, user.email);
    return send(res, 201, { token, user: publicUser(user) });
  }

  if (req.method === 'POST' && pathname === '/api/google-login') {
    return send(res, 501, { error: 'Login com Google precisa de configuracao OAuth' });
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    sessions.delete(getBearerToken(req));
    return send(res, 204, '');
  }

  if (!isAuthenticated(req)) {
    return send(res, 401, { error: 'Login necessario' });
  }

  if (req.method === 'POST' && pathname === '/api/change-password') {
    const body = await readBody(req);
    const email = getSessionUser(req);
    const user = db.auth.users.find(item => item.email === email);
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!user) return send(res, 404, { error: 'Usuario nao encontrado' });
    if (hashPassword(currentPassword) !== user.passwordHash) return send(res, 401, { error: 'Senha atual incorreta' });
    if (newPassword.length < 6) return send(res, 400, { error: 'Nova senha precisa ter pelo menos 6 caracteres' });
    user.passwordHash = hashPassword(newPassword);
    if (db.auth.email === user.email || db.auth.username === user.email) db.auth.passwordHash = user.passwordHash;
    await writeDb(db);
    return send(res, 200, { ok: true });
  }

  const userEmail = getSessionUser(req);
  const data = getUserData(db, userEmail);

  if (req.method === 'GET' && pathname === '/api/dashboard') {
    return send(res, 200, { ...data, user: publicUser({ email: userEmail }), resumo: buildResumo(data) });
  }

  if (req.method === 'GET' && ['transacoes', 'metas', 'trabalhos'].includes(collection)) {
    return send(res, 200, data[collection]);
  }

  if (req.method === 'GET' && collection === 'contas-cartoes') {
    return send(res, 200, data.contasCartoes);
  }

  if (req.method === 'GET' && collection === 'investimentos') {
    return send(res, 200, data.investimentosCarteira);
  }

  if (req.method === 'POST' && collection === 'transacoes') {
    const created = normalizeTransaction(await readBody(req));
    data.transacoes.unshift(created);
    await writeDb(db);
    return send(res, 201, created);
  }

  if (req.method === 'POST' && collection === 'metas') {
    const created = normalizeGoal(await readBody(req));
    data.metas.unshift(created);
    await writeDb(db);
    return send(res, 201, created);
  }

  if (req.method === 'POST' && collection === 'trabalhos') {
    const created = normalizeWork(await readBody(req));
    data.trabalhos.unshift(created);
    await writeDb(db);
    return send(res, 201, created);
  }

  if (req.method === 'POST' && collection === 'contas-cartoes') {
    const created = normalizeAccountCard(await readBody(req));
    data.contasCartoes.unshift(created);
    await writeDb(db);
    return send(res, 201, created);
  }

  if (req.method === 'POST' && collection === 'investimentos') {
    const body = await readBody(req);
    const created = {
      id: crypto.randomUUID(),
      nome: String(body.nome || 'Novo investimento').trim(),
      tipo: String(body.tipo || 'Renda fixa').trim(),
      valor: Number(body.valor || 0),
      rendimento: Number(body.rendimento || 0),
      data: body.data || new Date().toISOString().slice(0, 10)
    };
    data.investimentosCarteira.unshift(created);
    await writeDb(db);
    return send(res, 201, created);
  }

  if (req.method === 'POST' && pathname === '/api/banco/depositar') {
    const body = await readBody(req);
    const valor = Math.max(0, Number(body.valor || 0));
    data.banco.saldo += valor;
    await writeDb(db);
    return send(res, 201, data.banco);
  }

  if (req.method === 'POST' && pathname === '/api/banco/retirar') {
    const body = await readBody(req);
    const valor = Math.max(0, Number(body.valor || 0));
    if (valor <= 0) return send(res, 400, { error: 'Valor invalido' });
    if (valor > data.banco.saldo) return send(res, 400, { error: 'Saldo insuficiente no Meu Banco' });
    const retirada = {
      id: crypto.randomUUID(),
      valor,
      juros: Number((valor * 0.04).toFixed(2)),
      totalDevolver: Number((valor * 1.04).toFixed(2)),
      data: new Date().toISOString().slice(0, 10),
      status: 'aberto'
    };
    data.banco.saldo -= valor;
    data.banco.retiradas.unshift(retirada);
    await writeDb(db);
    return send(res, 201, retirada);
  }

  const bankReturn = pathname.match(/^\/api\/banco\/devolver\/([^/]+)$/);
  if (bankReturn && req.method === 'POST') {
    const retirada = data.banco.retiradas.find(r => r.id === bankReturn[1]);
    if (!retirada) return send(res, 404, { error: 'Retirada nao encontrada' });
    if (retirada.status !== 'aberto') return send(res, 400, { error: 'Retirada ja devolvida' });
    retirada.status = 'devolvido';
    retirada.dataDevolucao = new Date().toISOString().slice(0, 10);
    data.banco.saldo += Number(retirada.totalDevolver || 0);
    await writeDb(db);
    return send(res, 200, retirada);
  }

  const match = pathname.match(/^\/api\/(transacoes|metas|trabalhos|contas-cartoes|investimentos)\/([^/]+)$/);
  if (match && req.method === 'PUT') {
    const [, name, id] = match;
    const body = await readBody(req);
    if (name === 'contas-cartoes') {
      const index = data.contasCartoes.findIndex(item => item.id === id);
      if (index === -1) return send(res, 404, { error: 'Conta ou cartao nao encontrado' });
      data.contasCartoes[index] = normalizeAccountCard({ ...data.contasCartoes[index], ...body, id });
      await writeDb(db);
      return send(res, 200, data.contasCartoes[index]);
    }
    if (name === 'metas') {
      const index = data.metas.findIndex(item => item.id === id);
      if (index === -1) return send(res, 404, { error: 'Meta nao encontrada' });
      data.metas[index] = normalizeGoal({ ...data.metas[index], ...body, id });
      await writeDb(db);
      return send(res, 200, data.metas[index]);
    }
    if (name === 'trabalhos') {
      const index = data.trabalhos.findIndex(item => item.id === id);
      if (index === -1) return send(res, 404, { error: 'Trabalho nao encontrado' });
      data.trabalhos[index] = normalizeWork({ ...data.trabalhos[index], ...body, id });
      await writeDb(db);
      return send(res, 200, data.trabalhos[index]);
    }
  }

  if (match && req.method === 'DELETE') {
    const [, name, id] = match;
    if (name === 'contas-cartoes') data.contasCartoes = data.contasCartoes.filter(item => item.id !== id);
    else if (name === 'investimentos') data.investimentosCarteira = data.investimentosCarteira.filter(item => item.id !== id);
    else data[name] = data[name].filter(item => item.id !== id);
    await writeDb(db);
    return send(res, 204, '');
  }

  send(res, 404, { error: 'Rota nao encontrada' });
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Acesso negado', 'text/plain; charset=utf-8');

  try {
    const content = await fs.readFile(filePath);
    const type = mimeTypes[path.extname(filePath)] || 'application/octet-stream';
    send(res, 200, content, type);
  } catch {
    send(res, 404, 'Arquivo nao encontrado', 'text/plain; charset=utf-8');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url.pathname);
    }
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    send(res, 500, { error: error.message || 'Erro interno' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`LASTTRO rodando em http://localhost:${PORT}`);
});


