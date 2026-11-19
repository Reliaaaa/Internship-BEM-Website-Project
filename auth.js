/* Akun lokal membantu memisahkan tampilan, tetapi bukan pengamanan perangkat bersama. */
window.TaskFlowAuth = (() => {
  const usersKey = 'tf_users';
  const sessionKey = 'tf_session';
  const iterations = 210000;
  const encoder = new TextEncoder();
  let onSession = () => {};
  let view;
  let form;
  let message;
  let loginTab;
  let registerTab;
  let account;
  let current = null;
  let registerMode = false;
  let busy = false;

  function readUsers() {
    const raw = localStorage.getItem(usersKey);
    if (!raw) return [];
    const users = JSON.parse(raw);
    if (!Array.isArray(users)) throw new Error('Data akun tidak dapat dibaca.');
    return users;
  }
  const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  async function hashPassword(password, salt) {
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
    return hex(new Uint8Array(bits));
  }
  const userInfo = (user) => ({ id: user.id, name: user.name, email: user.email });
  function readSession() {
    const saved = JSON.parse(localStorage.getItem(sessionKey) || 'null');
    if (!saved || typeof saved.userId !== 'string') return null;
    const user = readUsers().find((item) => item.id === saved.userId);
    return user ? userInfo(user) : null;
  }
  function setMode(register) {
    registerMode = register;
    loginTab.setAttribute('aria-selected', String(!register));
    registerTab.setAttribute('aria-selected', String(register));
    form.elements.name.closest('label').hidden = !register;
    form.elements.name.required = register;
    form.elements.password.autocomplete = register ? 'new-password' : 'current-password';
    form.elements.password.type = 'password';
    form.querySelector('.password-toggle').textContent = 'Tampilkan';
    form.querySelector('.password-toggle').setAttribute('aria-label', 'Tampilkan kata sandi');
    form.querySelector('button[type="submit"]').textContent = register ? 'Buat akun' : 'Masuk';
    message.textContent = '';
  }
  function showSession(user) {
    current = user;
    document.body.classList.toggle('auth-locked', !user);
    view.hidden = Boolean(user);
    account.hidden = !user;
    account.querySelector('.auth-user').textContent = user ? user.name : '';
    if (!user) { form.reset(); setMode(false); }
    onSession(user);
  }
  function logout() {
    try { localStorage.removeItem(sessionKey); showSession(null); return true; }
    catch { return false; }
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim().toLowerCase();
    const password = form.elements.password.value;
    message.textContent = '';
    if (registerMode && !name) { message.textContent = 'Nama lengkap wajib diisi.'; return; }
    if (password.length < 6) { message.textContent = 'Kata sandi minimal 6 karakter.'; return; }
    busy = true;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      if (!crypto.subtle) throw new Error('Autentikasi membutuhkan koneksi HTTPS atau localhost.');
      const users = readUsers();
      let user = users.find((item) => item.email === email);
      if (registerMode) {
        if (user) throw new Error('Email sudah terdaftar. Silakan masuk.');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        user = { id: crypto.randomUUID(), name, email, salt: hex(salt), hash: await hashPassword(password, salt) };
        users.push(user);
        localStorage.setItem(usersKey, JSON.stringify(users));
      } else {
        if (!user || !/^[a-f0-9]{32}$/.test(user.salt || '') || !/^[a-f0-9]{64}$/.test(user.hash || '')) throw new Error('Email atau kata sandi salah.');
        const salt = new Uint8Array(user.salt.match(/../g).map((part) => parseInt(part, 16)));
        if (await hashPassword(password, salt) !== user.hash) throw new Error('Email atau kata sandi salah.');
      }
      localStorage.setItem(sessionKey, JSON.stringify({ userId: user.id }));
      form.reset();
      showSession(userInfo(user));
    } catch (error) {
      message.textContent = error instanceof Error && (error.message.startsWith('Email') || error.message.startsWith('Autentikasi') || error.message.startsWith('Data akun')) ? error.message : 'Tidak dapat menyimpan atau membuka akun. Periksa penyimpanan browser.';
    } finally {
      busy = false;
      submitButton.disabled = false;
    }
  }
  function start(callback) {
    onSession = callback;
    view = document.createElement('main');
    view.className = 'auth-view';
    view.innerHTML = `<section class="auth-card" aria-labelledby="auth-title">
      <div class="auth-brand"><span class="brand-mark" aria-hidden="true">T</span><strong>TaskFlow</strong></div>
      <h1 id="auth-title">Ruang untuk hal yang berarti.</h1>
      <p class="auth-intro">Kelola proyek dan tugasmu dengan lebih terarah.</p>
      <div class="auth-tabs" role="tablist" aria-label="Pilihan akun"><button type="button" role="tab" id="auth-login-tab">Masuk</button><button type="button" role="tab" id="auth-register-tab">Daftar</button></div>
      <form id="auth-form"><label>Nama lengkap<input name="name" autocomplete="name" maxlength="100" placeholder="Nama lengkap"></label><label>Email<input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="nama@email.com"></label><div class="password-field"><label for="auth-password">Kata sandi</label><div class="password-control"><input id="auth-password" name="password" type="password" autocomplete="current-password" required minlength="6" maxlength="1024" placeholder="Minimal 6 karakter"><button class="password-toggle" type="button" aria-label="Tampilkan kata sandi" aria-controls="auth-password">Tampilkan</button></div></div><p class="auth-error" role="alert"></p><button class="button primary auth-submit" type="submit">Masuk</button></form>
      <p class="auth-disclaimer">Akun dan data disimpan hanya di browser ini. Akun lokal tidak melindungi data dari pengguna lain pada perangkat yang sama.</p>
    </section>`;
    document.body.append(view);
    form = view.querySelector('form');
    message = view.querySelector('.auth-error');
    loginTab = view.querySelector('#auth-login-tab');
    registerTab = view.querySelector('#auth-register-tab');
    account = document.createElement('div');
    account.className = 'auth-account';
    account.innerHTML = '<span class="auth-user"></span><button class="button logout-button" data-action="logout" type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg><span>Keluar</span></button>';
    document.querySelector('.header-actions').append(account);
    loginTab.addEventListener('click', () => setMode(false));
    registerTab.addEventListener('click', () => setMode(true));
    form.querySelector('.password-toggle').addEventListener('click', (event) => {
      const visible = form.elements.password.type === 'password';
      form.elements.password.type = visible ? 'text' : 'password';
      event.currentTarget.textContent = visible ? 'Sembunyikan' : 'Tampilkan';
      event.currentTarget.setAttribute('aria-label', `${visible ? 'Sembunyikan' : 'Tampilkan'} kata sandi`);
    });
    form.addEventListener('submit', submit);
    try { showSession(readSession()); } catch { showSession(null); message.textContent = 'Data akun tidak dapat dibaca. Periksa penyimpanan browser.'; }
    window.addEventListener('storage', (event) => {
      if (event.key !== sessionKey) return;
      try { const user = readSession(); if (user?.id !== current?.id) showSession(user); } catch { showSession(null); }
    });
  }
  return { start, logout };
})();
