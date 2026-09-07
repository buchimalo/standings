// js/core.js — 全画面で共有する初期化とユーティリティ
(function (global) {
    'use strict';

    /* ---------- Firebase ---------- */

    const firebaseConfig = {
        apiKey: "AIzaSyCpbFz9odW0pjM67RBKi1g3K__-H5tAaqk",
        authDomain: "porker-chase-draft.firebaseapp.com",
        databaseURL: "https://porker-chase-draft-default-rtdb.asia-southeast1.firebasedatabase.app/",
        projectId: "porker-chase-draft",
        storageBucket: "porker-chase-draft.firebasestorage.app",
        messagingSenderId: "1017710444956",
        appId: "1:1017710444956:web:f9538ef485beb7b7074859",
        measurementId: "G-HKFTDR6SK0"
    };

    // ドラフト会議アプリと同じDBを使うので、集計表のデータは stats/ 配下にまとめる
    const ROOT = 'stats';

    const params = new URLSearchParams(global.location.search);
    const DEMO = params.get('demo') === '1';

    const ADMIN_KEY = 'pcs.admin';
    const DEMO_KEY = 'pcs.demo';
    // 入力・マスタ編集用の共有アカウント。パスワードは Firebase 側で照合する
    const ADMIN_EMAIL = 'standings@example.com';
    // 練習モード（?demo=1）だけで使う簡易パスワードの SHA-256。初期値は pokachi
    const ADMIN_HASH = '038e0f0d74794838f5d4cadf30962e4e8549941157e702dafd8e4f2f222d4c45';

    const SEATS = 6;
    const RANK_POINTS = { 1: 4, 2: 2, 3: 0, 4: -1, 5: -2, 6: -3 };

    let db = null;
    if (!DEMO) {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        db = firebase.database();
    }

    /* ---------- データ入出力 ---------- */

    const demoListeners = [];

    function demoRead() {
        try {
            const raw = localStorage.getItem(DEMO_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    function demoWrite(root) {
        try { localStorage.setItem(DEMO_KEY, JSON.stringify(root)); } catch (e) { /* 無視 */ }
        demoListeners.forEach(fn => fn(root));
    }

    function pathSet(root, path, value) {
        const keys = String(path).split('/').filter(Boolean);
        let node = root;
        for (let i = 0; i < keys.length - 1; i++) {
            if (typeof node[keys[i]] !== 'object' || node[keys[i]] === null) node[keys[i]] = {};
            node = node[keys[i]];
        }
        const last = keys[keys.length - 1];
        if (value === null) delete node[last]; else node[last] = value;
        return root;
    }

    // stats/ 配下をまるごと購読する。件数が少ないので分割購読はしない
    function subscribe(fn) {
        if (DEMO) {
            demoListeners.push(fn);
            fn(demoRead());
            return;
        }
        db.ref(ROOT).on('value', snap => fn(snap.val() || {}));
    }

    function set(path, value) {
        if (DEMO) { demoWrite(pathSet(demoRead(), path, value)); return Promise.resolve(); }
        return db.ref(ROOT + '/' + path).set(value);
    }

    function remove(path) {
        return set(path, null);
    }

    // { 'players/p1': {...}, 'matches/m1': null } の形でまとめて書く
    function update(map) {
        if (DEMO) {
            const root = demoRead();
            Object.keys(map).forEach(p => pathSet(root, p, map[p]));
            demoWrite(root);
            return Promise.resolve();
        }
        return db.ref(ROOT).update(map);
    }

    /* ---------- 管理者判定（簡易パスワード） ---------- */

    async function sha256(text) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // firebase-auth-compat.js を読み込んだページ（input / master）だけ認証を使う
    const hasAuth = !DEMO && typeof firebase !== 'undefined' && typeof firebase.auth === 'function';

    let adminNow = false;
    // ログイン済みかどうかが確定するまでは、パスワード欄も本体も出さない
    let adminSettled = DEMO || !hasAuth;
    const adminWatchers = [];

    if (DEMO) {
        try { adminNow = sessionStorage.getItem(ADMIN_KEY) === '1'; } catch (e) { /* 無視 */ }
    } else if (hasAuth) {
        firebase.auth().onAuthStateChanged(user => {
            adminNow = !!user;
            adminSettled = true;
            adminWatchers.forEach(fn => fn(adminNow));
        });
    }

    function onAdmin(fn) {
        adminWatchers.push(fn);
        if (adminSettled) fn(adminNow);
    }

    function isAdmin() {
        return adminNow;
    }

    async function login(password) {
        if (DEMO) {
            const ok = (await sha256(password)) === ADMIN_HASH;
            if (ok) {
                try { sessionStorage.setItem(ADMIN_KEY, '1'); } catch (e) { /* 無視 */ }
                adminNow = true;
                adminWatchers.forEach(fn => fn(true));
            }
            return ok;
        }
        if (!hasAuth) return false;
        try {
            await firebase.auth().signInWithEmailAndPassword(ADMIN_EMAIL, password);
            return true;
        } catch (e) {
            return false;
        }
    }

    function logout() {
        if (DEMO) {
            try { sessionStorage.removeItem(ADMIN_KEY); } catch (e) { /* 無視 */ }
            adminNow = false;
            adminWatchers.forEach(fn => fn(false));
            return Promise.resolve();
        }
        return hasAuth ? firebase.auth().signOut() : Promise.resolve();
    }

    /* ---------- 文字列・日付 ---------- */

    function esc(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 20260904 <-> '2026-09-04'
    function todayNum() {
        const d = new Date();
        return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    }

    function numToInput(n) {
        const s = String(n || todayNum());
        return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    }

    function inputToNum(s) {
        return parseInt(String(s || '').replace(/-/g, ''), 10) || 0;
    }

    function formatDate(n) {
        if (!n || n <= 0 || n >= 99991231) return '';
        const s = String(n);
        return s.slice(0, 4) + '/' + s.slice(4, 6) + '/' + s.slice(6, 8);
    }

    // 「2026/09/04〜」「〜2026/09/30」「全期間」を作る
    function formatRange(from, to) {
        const a = formatDate(from), b = formatDate(to);
        return (a || b) ? a + '〜' + b : '';
    }

    // 当月を [開始, 終了] の YYYYMMDD で返す（集計期間は1ヶ月ごと）
    function currentMonthRange() {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth();
        const last = new Date(y, m + 1, 0).getDate();
        const p = n => String(n).padStart(2, '0');
        return {
            name: y + '年' + (m + 1) + '月',
            from: parseInt('' + y + p(m + 1) + '01', 10),
            to: parseInt('' + y + p(m + 1) + p(last), 10)
        };
    }

    /* ---------- 共通UI ---------- */

    function showDemoBanner() {
        if (!DEMO) return;
        const el = document.createElement('div');
        el.className = 'demo-banner';
        el.innerHTML = '<span>練習モード（本番データには保存されません）</span>' +
            '<button type="button" id="demo-clear">練習データを消す</button>';
        document.body.prepend(el);
        el.querySelector('#demo-clear').addEventListener('click', () => {
            try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* 無視 */ }
            location.reload();
        });
    }

    function sortedList(obj) {
        return Object.keys(obj || {})
            .map(k => obj[k])
            .filter(Boolean)
            .sort((a, b) => (a.no || 0) - (b.no || 0));
    }

    global.PCS = {
        DEMO, ROOT, SEATS, RANK_POINTS,
        subscribe, set, remove, update,
        isAdmin, onAdmin, login, logout,
        esc, todayNum, numToInput, inputToNum, formatDate, formatRange, currentMonthRange,
        showDemoBanner, sortedList
    };
})(window);
