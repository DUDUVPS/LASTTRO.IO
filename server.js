const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DATABASE_URL = process.env.DATABASE_URL || process.env.MYSQL_URL || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

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
  casa: [],
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
let mysqlPool = null;
let mysqlReady = false;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

async function ensureDb() {
  if (DATABASE_URL) return ensureMysqlDb();
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await writeDb(initialData);
  }
}

async function readDb() {
  await ensureDb();
  if (DATABASE_URL) {
    const [rows] = await mysqlPool.execute('SELECT data FROM lasttro_state WHERE id = ?', ['main']);
    if (!rows.length) {
      await writeDb(initialData);
      return withDefaults(initialData);
    }
    return withDefaults(JSON.parse(rows[0].data));
  }
  const db = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
  return withDefaults(db);
}

async function writeDb(data) {
  if (DATABASE_URL) {
    await ensureMysqlDb();
    await mysqlPool.execute(
      'INSERT INTO lasttro_state (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP',
      ['main', JSON.stringify(data)]
    );
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

async function ensureMysqlDb() {
  if (!mysqlPool) {
    const mysql = require('mysql2/promise');
    mysqlPool = mysql.createPool({
      uri: DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 5,
      namedPlaceholders: false
    });
  }
  if (mysqlReady) return;
  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS lasttro_state (
      id VARCHAR(64) PRIMARY KEY,
      data LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  mysqlReady = true;
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
  if (header.startsWith('Bearer ')) return header.slice(7);
  try {
    return new URL(req.url, 'http://localhost').searchParams.get('token') || '';
  } catch {
    return '';
  }
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
    casa: [],
    contasCartoes: [],
    investimentosCarteira: [],
    banco: { saldo: 0, retiradas: [] }
  };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parseDecimal(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const raw = String(value ?? '').trim();
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function moneyValue(value, fallback = 0) {
  return Number(parseDecimal(value, fallback).toFixed(2));
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
    passwordHash: user.passwordHash || '',
    avatar: typeof user.avatar === 'string' ? user.avatar : '',
    gmail: user.gmail && typeof user.gmail === 'object' ? user.gmail : null
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
  return { email: user.email, username: user.email, avatar: user.avatar || '', gmailConnected: Boolean(user.gmail?.refreshToken || user.gmail?.accessToken) };
}

function createSession(email) {
  const token = crypto.randomUUID();
  sessions.set(token, email);
  return token;
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http');
  return `${proto}://${req.headers.host}`;
}

function signValue(value) {
  const secret = GOOGLE_CLIENT_SECRET || 'lasttro-dev-secret';
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function createOauthState(extra = {}) {
  const payload = Buffer.from(JSON.stringify({
    nonce: crypto.randomUUID(),
    createdAt: Date.now(),
    ...extra
  })).toString('base64url');
  return `${payload}.${signValue(payload)}`;
}

function verifyOauthState(state) {
  const [payload, signature] = String(state || '').split('.');
  if (!payload || !signature || signature !== signValue(payload)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Date.now() - Number(data.createdAt || 0) < 10 * 60 * 1000 ? data : null;
  } catch {
    return null;
  }
}

function sendHtml(res, status, html) {
  return send(res, status, html, 'text/html; charset=utf-8');
}

async function postForm(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: querystring.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || payload.error || 'Falha no Google OAuth');
  return payload;
}

async function getGoogleProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || payload.error || 'Falha ao buscar perfil Google');
  return payload;
}

function googleCallbackHtml(payload) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>LASTTRO</title></head>
<body>
  <script>
    const payload = ${json};
    localStorage.setItem('lasttroToken', payload.token);
    localStorage.setItem('lasttroUser', JSON.stringify(payload.user));
    location.replace('/app');
  </script>
</body>
</html>`;
}

function normalizeTransaction(item) {
  const tipo = ['entrada', 'saida'].includes(item.tipo) ? item.tipo : 'saida';
  const rawVal = moneyValue(item.val);
  const val = tipo === 'saida' ? -Math.abs(rawVal) : Math.abs(rawVal);
  return {
    id: item.id || crypto.randomUUID(),
    nome: String(item.nome || 'Sem nome').trim(),
    cat: String(item.cat || 'Diversos').trim(),
    tipo,
    val,
    data: item.data || new Date().toISOString().slice(0, 10),
    recorrente: item.recorrente === true || item.recorrente === 'true',
    icon: item.icon || (tipo === 'entrada' ? 'fa-coins' : 'fa-receipt')
  };
}

async function refreshGmailAccessToken(user) {
  if (!user?.gmail) throw new Error('Gmail nao conectado');
  if (user.gmail.accessToken && Number(user.gmail.expiresAt || 0) > Date.now() + 60_000) {
    return user.gmail.accessToken;
  }
  if (!user.gmail.refreshToken) throw new Error('Reconecte o Gmail');
  const payload = await postForm('https://oauth2.googleapis.com/token', {
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: user.gmail.refreshToken,
    grant_type: 'refresh_token'
  });
  user.gmail.accessToken = payload.access_token;
  user.gmail.expiresAt = Date.now() + Number(payload.expires_in || 3600) * 1000;
  return user.gmail.accessToken;
}

async function gmailRequest(user, endpoint, options = {}) {
  const token = await refreshGmailAccessToken(user);
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Falha no Gmail');
  return payload;
}

function gmailHeader(message, name) {
  return message.payload?.headers?.find(header => header.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function encodeBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function withDefaults(db) {
  const baseData = normalizeUserData({
    transacoes: db.transacoes || [],
    metas: db.metas || [],
    trabalhos: db.trabalhos || [],
    casa: db.casa || [],
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
    casa: (data.casa || []).map(normalizeHomeItem),
    contasCartoes: (data.contasCartoes || []).map(normalizeAccountCard),
    investimentosCarteira: (data.investimentosCarteira || []).map(normalizeInvestment),
    banco: {
      saldo: moneyValue(data.banco?.saldo),
      retiradas: (data.banco?.retiradas || []).map(normalizeWithdrawal)
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
  const groupId = String(item.groupId || '').trim();
  return {
    id: item.id || crypto.randomUUID(),
    groupId: groupId || item.id || crypto.randomUUID(),
    nome: String(item.nome || 'Nova conta').trim(),
    tipo: ['conta', 'cartao'].includes(item.tipo) ? item.tipo : 'cartao',
    bandeira: String(item.bandeira || 'Nao informado').trim(),
    saldo: moneyValue(item.saldo),
    limite: moneyValue(item.limite),
    usado: moneyValue(item.usado),
    vencimento: parseDecimal(item.vencimento, 1)
  };
}

function normalizeGoal(item) {
  const tipo = ['dinheiro', 'habito', 'tarefa', 'estudo', 'outro'].includes(item.tipo) ? item.tipo : 'dinheiro';
  const unidade = String(item.unidade || (tipo === 'dinheiro' ? 'R$' : tipo === 'habito' ? 'dias' : tipo === 'estudo' ? 'horas' : 'itens')).trim();
  return {
    id: item.id || crypto.randomUUID(),
    nome: String(item.nome || 'Nova meta').trim(),
    tipo,
    unidade,
    target: moneyValue(item.target),
    atual: moneyValue(item.atual),
    cor: item.cor || '#4a9eff',
    deadline: item.deadline || 'Sem prazo',
    descricao: String(item.descricao || '').trim()
  };
}

function normalizeInvestment(item) {
  return {
    id: item.id || crypto.randomUUID(),
    nome: String(item.nome || 'Novo investimento').trim(),
    tipo: String(item.tipo || 'Renda fixa').trim(),
    valor: moneyValue(item.valor),
    rendimento: parseDecimal(item.rendimento),
    data: item.data || new Date().toISOString().slice(0, 10)
  };
}

function normalizeWithdrawal(item) {
  const valor = moneyValue(item.valor);
  return {
    ...item,
    id: item.id || crypto.randomUUID(),
    valor,
    juros: moneyValue(item.juros ?? valor * 0.04),
    totalDevolver: moneyValue(item.totalDevolver ?? valor * 1.04),
    data: item.data || new Date().toISOString().slice(0, 10),
    status: item.status === 'devolvido' ? 'devolvido' : 'aberto'
  };
}

function normalizeWork(item) {
  return {
    id: item.id || crypto.randomUUID(),
    nome: String(item.nome || 'Novo item').trim(),
    tipo: String(item.tipo || 'Trabalho').trim(),
    disciplina: String(item.disciplina || '').trim(),
    anotacao: String(item.anotacao || '').trim(),
    status: ['ativo', 'andamento', 'concluido'].includes(item.status) ? item.status : 'andamento',
    salario: moneyValue(item.salario),
    horas: parseDecimal(item.horas, 0),
    inicio: item.inicio || new Date().toISOString().slice(0, 10)
  };
}

function normalizeHomeItem(item) {
  const tipo = ['despensa', 'conta', 'compra'].includes(item.tipo) ? item.tipo : 'despensa';
  return {
    id: item.id || crypto.randomUUID(),
    tipo,
    nome: String(item.nome || 'Novo item').trim(),
    quantidade: parseDecimal(item.quantidade, tipo === 'despensa' ? 1 : 0),
    minimo: parseDecimal(item.minimo, 1),
    unidade: String(item.unidade || 'un').trim(),
    valor: moneyValue(item.valor),
    vencimento: item.vencimento || '',
    status: item.status === 'feito' ? 'feito' : 'pendente',
    observacao: String(item.observacao || '').trim()
  };
}

function buildResumo(db) {
  const entradas = db.transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.val, 0);
  const investimentos = db.transacoes.filter(t => t.tipo === 'investimento').reduce((s, t) => s + t.val, 0);
  const gastos = Math.abs(db.transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.val, 0));
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
  const saldo = contasSaldo + bancoSaldo;
  const trabalhosRenda = db.trabalhos
    .filter(j => j.status !== 'concluido')
    .reduce((s, j) => s + Number(j.salario || 0), 0);
  const trabalhosHoras = db.trabalhos
    .filter(j => j.status !== 'concluido')
    .reduce((s, j) => s + Number(j.horas || 0), 0);
  const patrimonio = bancoSaldo + contasSaldo + carteiraInvestimentos;
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
    trabalhosAndamento: db.trabalhos.filter(j => j.status !== 'concluido').length,
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

  if (req.method === 'GET' && pathname === '/api/health') {
    return send(res, 200, { ok: true, service: 'lasttro' });
  }

  if (req.method === 'GET' && pathname === '/api/auth/google') {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return send(res, 500, { error: 'Google OAuth nao configurado no servidor' });
    }
    const state = createOauthState();
    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    res.writeHead(302, { Location: url.toString() });
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/api/auth/google/callback') {
    const callbackUrl = new URL(req.url, getBaseUrl(req));
    const code = callbackUrl.searchParams.get('code');
    const state = callbackUrl.searchParams.get('state');
    const stateData = verifyOauthState(state);
    if (!code || !stateData) {
      return sendHtml(res, 400, 'Login Google invalido.');
    }

    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;
    const tokenPayload = await postForm('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });
    const profile = await getGoogleProfile(tokenPayload.access_token);
    const email = normalizeEmail(profile.email);
    if (!email || profile.email_verified === false) return sendHtml(res, 401, 'Email Google nao verificado.');

    if (stateData.mode === 'gmail') {
      const sessionEmail = normalizeEmail(stateData.email);
      const user = db.auth.users.find(item => item.email === sessionEmail);
      if (!user) return sendHtml(res, 404, 'Usuario nao encontrado.');
      user.gmail = {
        email,
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token || user.gmail?.refreshToken || '',
        expiresAt: Date.now() + Number(tokenPayload.expires_in || 3600) * 1000,
        scope: tokenPayload.scope || ''
      };
      await writeDb(db);
      return sendHtml(res, 200, '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Gmail conectado</title></head><body><script>location.replace("/app?gmail=connected")</script></body></html>');
    }

    let user = db.auth.users.find(item => item.email === email);
    if (!user) {
      user = { email, username: email, passwordHash: `google:${profile.sub || crypto.randomUUID()}`, avatar: profile.picture || '' };
      db.auth.users.push(user);
      db.accountsData[email] = blankUserData();
      await writeDb(db);
    } else if (!user.avatar && profile.picture) {
      user.avatar = profile.picture;
      await writeDb(db);
    }

    const token = createSession(user.email);
    return sendHtml(res, 200, googleCallbackHtml({ token, user: publicUser(user) }));
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    const body = await readBody(req);
    const email = normalizeEmail(body.email || body.username);
    const user = db.auth.users.find(item => item.email === email);
    if (user && hashPassword(body.password) === user.passwordHash) {
      const token = createSession(user.email);
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
    const user = { email, username: email, passwordHash: hashPassword(password), avatar: '' };
    db.auth.users.push(user);
    db.accountsData[email] = blankUserData();
    await writeDb(db);
    const token = createSession(user.email);
    return send(res, 201, { token, user: publicUser(user) });
  }

  if (req.method === 'POST' && pathname === '/api/google-login') {
    return send(res, 200, { url: '/api/auth/google' });
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    sessions.delete(getBearerToken(req));
    return send(res, 204, '');
  }

  if (req.method === 'GET' && (pathname === '/api/auth/gmail' || pathname === '/api/auth/gmail-url')) {
    if (!isAuthenticated(req)) return send(res, 401, { error: 'Login necessario' });
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return send(res, 500, { error: 'Google OAuth nao configurado no servidor' });
    }
    const state = createOauthState({ mode: 'gmail', email: getSessionUser(req) });
    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    if (pathname === '/api/auth/gmail-url') return send(res, 200, { url: url.toString() });
    res.writeHead(302, { Location: url.toString() });
    return res.end();
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
  const currentUser = db.auth.users.find(item => item.email === userEmail);
  const data = getUserData(db, userEmail);

  if (req.method === 'GET' && pathname === '/api/gmail/status') {
    return send(res, 200, {
      connected: Boolean(currentUser?.gmail?.refreshToken || currentUser?.gmail?.accessToken),
      email: currentUser?.gmail?.email || '',
      accountEmail: currentUser?.email || userEmail
    });
  }

  if (req.method === 'GET' && pathname === '/api/gmail/messages') {
    if (!currentUser?.gmail) return send(res, 400, { error: 'Gmail nao conectado' });
    const list = await gmailRequest(currentUser, 'messages?maxResults=10&q=in%3Ainbox');
    const messages = await Promise.all((list.messages || []).slice(0, 10).map(async item => {
      const message = await gmailRequest(currentUser, `messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
      return {
        id: item.id,
        from: gmailHeader(message, 'From'),
        subject: gmailHeader(message, 'Subject') || '(sem assunto)',
        date: gmailHeader(message, 'Date'),
        snippet: message.snippet || ''
      };
    }));
    await writeDb(db);
    return send(res, 200, { messages });
  }

  if (req.method === 'POST' && pathname === '/api/gmail/send') {
    if (!currentUser?.gmail) return send(res, 400, { error: 'Gmail nao conectado' });
    const body = await readBody(req);
    const to = String(body.to || '').trim();
    const subject = String(body.subject || '').trim();
    const text = String(body.body || '').trim();
    if (!to || !subject || !text) return send(res, 400, { error: 'Preencha destinatario, assunto e mensagem' });
    const raw = encodeBase64Url([
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      text
    ].join('\r\n'));
    const sent = await gmailRequest(currentUser, 'messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw })
    });
    await writeDb(db);
    return send(res, 201, { ok: true, id: sent.id });
  }

  if (req.method === 'POST' && pathname === '/api/profile') {
    const body = await readBody(req);
    const avatar = String(body.avatar || '');
    if (!currentUser) return send(res, 404, { error: 'Usuario nao encontrado' });
    const isEmpty = avatar === '';
    const isValidImage = /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(avatar) || /^https:\/\/.+/i.test(avatar);
    if (!isEmpty && (!isValidImage || avatar.length > 700_000)) {
      return send(res, 400, { error: 'Imagem invalida ou muito grande' });
    }
    currentUser.avatar = avatar;
    await writeDb(db);
    return send(res, 200, { user: publicUser(currentUser) });
  }

  if (req.method === 'GET' && pathname === '/api/dashboard') {
    return send(res, 200, { ...data, user: publicUser(currentUser || { email: userEmail }), resumo: buildResumo(data) });
  }

  if (req.method === 'GET' && ['transacoes', 'metas', 'trabalhos', 'casa'].includes(collection)) {
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

  if (req.method === 'POST' && collection === 'casa') {
    const created = normalizeHomeItem(await readBody(req));
    data.casa.unshift(created);
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
    const created = normalizeInvestment(await readBody(req));
    data.investimentosCarteira.unshift(created);
    await writeDb(db);
    return send(res, 201, created);
  }

  if (req.method === 'POST' && pathname === '/api/banco/depositar') {
    const body = await readBody(req);
    const valor = Math.max(0, moneyValue(body.valor));
    data.banco.saldo = moneyValue(data.banco.saldo + valor);
    await writeDb(db);
    return send(res, 201, data.banco);
  }

  if (req.method === 'POST' && pathname === '/api/banco/retirar') {
    const body = await readBody(req);
    const valor = Math.max(0, moneyValue(body.valor));
    if (valor <= 0) return send(res, 400, { error: 'Valor invalido' });
    if (valor > data.banco.saldo) return send(res, 400, { error: 'Saldo insuficiente no Lastro Bank' });
    const retirada = {
      id: crypto.randomUUID(),
      valor,
      juros: Number((valor * 0.04).toFixed(2)),
      totalDevolver: Number((valor * 1.04).toFixed(2)),
      data: new Date().toISOString().slice(0, 10),
      status: 'aberto'
    };
    data.banco.saldo = moneyValue(data.banco.saldo - valor);
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
    data.banco.saldo = moneyValue(data.banco.saldo + moneyValue(retirada.totalDevolver));
    await writeDb(db);
    return send(res, 200, retirada);
  }

  const match = pathname.match(/^\/api\/(transacoes|metas|trabalhos|casa|contas-cartoes|investimentos)\/([^/]+)$/);
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
    if (name === 'casa') {
      const index = data.casa.findIndex(item => item.id === id);
      if (index === -1) return send(res, 404, { error: 'Item da casa nao encontrado' });
      data.casa[index] = normalizeHomeItem({ ...data.casa[index], ...body, id });
      await writeDb(db);
      return send(res, 200, data.casa[index]);
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
  const requested = pathname === '/' || pathname === '/apresentacao'
    ? '/apresentacao.html'
    : pathname === '/app'
      ? '/index.html'
      : pathname;
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


