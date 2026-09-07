// js/input.js — 試合結果の入力
(function () {
    'use strict';

    const { esc, sortedList, formatDate, SEATS } = PCS;

    const state = { data: {}, editId: '' };

    /* ---------- パスワード ---------- */

    function openApp() {
        document.getElementById('gate').hidden = true;
        document.getElementById('app').hidden = false;
        start();
    }

    function initGate() {
        if (PCS.isAdmin()) { openApp(); return; }
        document.getElementById('gate').hidden = false;
        document.getElementById('login-form').addEventListener('submit', async e => {
            e.preventDefault();
            const ok = await PCS.login(document.getElementById('password').value);
            document.getElementById('login-error').hidden = ok;
            if (ok) openApp();
        });
    }

    /* ---------- 選手名の解決 ---------- */

    function playersByName() {
        const map = {};
        sortedList(state.data.players).forEach(p => { map[p.name] = p.id; });
        return map;
    }

    function nameOf(id) {
        const p = (state.data.players || {})[id];
        return p ? p.name : '';
    }

    /* ---------- 描画 ---------- */

    function renderSeats() {
        const seats = document.getElementById('seats');
        if (seats.children.length) return;
        let html = '';
        for (let i = 1; i <= SEATS; i++) {
            html += '<label class="seat">' +
                '<span class="seat-rank">' + i + '位</span>' +
                '<input type="text" class="seat-input" data-rank="' + i + '" list="player-list" ' +
                'placeholder="登録名" autocomplete="off" required>' +
                '</label>';
        }
        seats.innerHTML = html;
    }

    function renderLists() {
        document.getElementById('player-list').innerHTML = sortedList(state.data.players)
            .map(p => '<option value="' + esc(p.name) + '">').join('');
        const codes = {};
        Object.keys(state.data.matches || {}).forEach(k => {
            const c = state.data.matches[k].code;
            if (c) codes[c] = true;
        });
        document.getElementById('codes').innerHTML = Object.keys(codes).sort()
            .map(c => '<option value="' + esc(c) + '">').join('');
    }

    function renderRecent() {
        const matches = Object.keys(state.data.matches || {})
            .map(k => state.data.matches[k])
            .filter(Boolean)
            .sort((a, b) => (b.date - a.date) || (b.no - a.no))
            .slice(0, 20);

        const rows = matches.map(m => {
            const names = (m.players || []).map((id, i) =>
                '<td class="c-name">' + (i === 0 ? '<b>' : '') + esc(nameOf(id)) + (i === 0 ? '</b>' : '') + '</td>').join('');
            return '<tr' + (m.id === state.editId ? ' class="is-editing"' : '') + '>' +
                '<td class="num">' + m.no + '</td>' +
                '<td class="num">' + formatDate(m.date) + '</td>' +
                '<td>' + esc(m.code || '') + '</td>' + names +
                '<td class="c-ops">' +
                '<button type="button" class="btn-mini" data-edit="' + esc(m.id) + '">編集</button>' +
                '<button type="button" class="btn-mini danger" data-del="' + esc(m.id) + '">削除</button>' +
                '</td></tr>';
        }).join('');

        const head = '<tr><th>No.</th><th>日付</th><th>コード</th>' +
            '<th>1位</th><th>2位</th><th>3位</th><th>4位</th><th>5位</th><th>6位</th><th></th></tr>';
        document.getElementById('recent').innerHTML =
            '<table class="stat-table"><thead>' + head + '</thead><tbody>' +
            (rows || '<tr><td class="empty" colspan="10">まだ入力がありません</td></tr>') + '</tbody></table>';

        document.querySelectorAll('[data-edit]').forEach(b =>
            b.addEventListener('click', () => loadForEdit(b.dataset.edit)));
        document.querySelectorAll('[data-del]').forEach(b =>
            b.addEventListener('click', () => removeMatch(b.dataset.del)));
    }

    /* ---------- 編集・削除 ---------- */

    function loadForEdit(id) {
        const m = (state.data.matches || {})[id];
        if (!m) return;
        state.editId = id;
        document.getElementById('date').value = PCS.numToInput(m.date);
        document.getElementById('code').value = m.code || '';
        document.querySelectorAll('.seat-input').forEach((el, i) => { el.value = nameOf((m.players || [])[i]); });
        document.getElementById('submit-btn').textContent = 'No.' + m.no + ' を更新する';
        renderRecent();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function removeMatch(id) {
        const m = (state.data.matches || {})[id];
        if (!m) return;
        if (!confirm('No.' + m.no + '（' + formatDate(m.date) + '）を削除します。よろしいですか？')) return;
        if (state.editId === id) resetForm();
        PCS.remove('matches/' + id);
    }

    function resetForm() {
        state.editId = '';
        document.getElementById('code').value = '';
        document.querySelectorAll('.seat-input').forEach(el => { el.value = ''; });
        document.getElementById('date').value = PCS.numToInput(PCS.todayNum());
        document.getElementById('submit-btn').textContent = 'この結果を登録する';
        document.getElementById('form-error').hidden = true;
        renderRecent();
    }

    /* ---------- 保存 ---------- */

    function nextNo() {
        const nos = Object.keys(state.data.matches || {}).map(k => state.data.matches[k].no || 0);
        return (nos.length ? Math.max.apply(null, nos) : 0) + 1;
    }

    function save(e) {
        e.preventDefault();
        const err = document.getElementById('form-error');
        const byName = playersByName();

        const date = PCS.inputToNum(document.getElementById('date').value);
        if (!date) return fail(err, '日付を入れてください');

        const ids = [];
        const inputs = [...document.querySelectorAll('.seat-input')];
        for (let i = 0; i < inputs.length; i++) {
            const name = inputs[i].value.trim();
            if (!name) return fail(err, (i + 1) + '位が空です');
            if (!byName[name]) return fail(err, '「' + name + '」はマスタに登録されていません');
            if (ids.indexOf(byName[name]) >= 0) return fail(err, '「' + name + '」が重複しています');
            ids.push(byName[name]);
        }

        const editing = state.editId && (state.data.matches || {})[state.editId];
        const no = editing ? editing.no : nextNo();
        const id = editing ? state.editId : 'm' + String(no).padStart(5, '0');
        const match = { id, no, code: document.getElementById('code').value.trim(), date, players: ids };

        err.hidden = true;
        PCS.set('matches/' + id, match).then(() => {
            resetForm();
            const saved = document.getElementById('saved');
            saved.hidden = false;
            setTimeout(() => { saved.hidden = true; }, 2000);
        });
    }

    function fail(el, message) {
        el.textContent = message;
        el.hidden = false;
    }

    /* ---------- 起動 ---------- */

    function start() {
        renderSeats();
        // 「結果を入力する」で開いた直後は今日の日付を入れておく
        document.getElementById('date').value = PCS.numToInput(PCS.todayNum());
        document.getElementById('match-form').addEventListener('submit', save);
        document.getElementById('reset-btn').addEventListener('click', resetForm);

        PCS.subscribe(data => {
            state.data = data || {};
            renderLists();
            renderRecent();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        PCS.showDemoBanner();
        initGate();
    });
})();
