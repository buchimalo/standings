// js/master.js — プレイヤー / チーム / 集計期間 のマスタ管理
(function () {
    'use strict';

    const { esc, sortedList, formatDate } = PCS;

    const state = { data: {} };

    /* ---------- パスワード ---------- */

    let started = false;

    function initGate() {
        document.getElementById('login-form').addEventListener('submit', async e => {
            e.preventDefault();
            const ok = await PCS.login(document.getElementById('password').value);
            document.getElementById('login-error').hidden = ok;
        });

        PCS.onAdmin(ok => {
            document.getElementById('gate').hidden = ok;
            document.getElementById('app').hidden = !ok;
            if (ok && !started) { started = true; start(); }
        });
    }

    /* ---------- 共通 ---------- */

    function nextNo(kind) {
        const list = sortedList(state.data[kind]);
        return (list.length ? Math.max.apply(null, list.map(x => x.no || 0)) : 0) + 1;
    }

    function nextId(kind, prefix) {
        let n = nextNo(kind);
        while ((state.data[kind] || {})[prefix + n]) n++;
        return prefix + n;
    }

    // その選手・チーム・期間が試合データから参照されていないか
    function playerUsed(id) {
        const matches = state.data.matches || {};
        return Object.keys(matches).some(k => (matches[k].players || []).indexOf(id) >= 0);
    }

    function teamUsed(id) {
        const players = state.data.players || {};
        return Object.keys(players).some(k => players[k].teamId === id);
    }

    /* ---------- プレイヤー ---------- */

    function renderPlayers() {
        const teams = state.data.teams || {};
        document.getElementById('player-team').innerHTML =
            '<option value="">（チームなし）</option>' +
            sortedList(teams).map(t => '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>').join('');

        const rows = sortedList(state.data.players).map(p =>
            '<tr><td class="num">' + p.no + '</td>' +
            '<td class="c-name">' + esc(p.name) + '</td>' +
            '<td class="c-team">' + esc(teams[p.teamId] ? teams[p.teamId].name : '') + '</td>' +
            '<td>' + esc(p.youtube || '') + '</td>' +
            '<td class="c-ops">' +
            '<button type="button" class="btn-mini" data-edit-player="' + esc(p.id) + '">編集</button>' +
            '<button type="button" class="btn-mini danger" data-del-player="' + esc(p.id) + '">削除</button>' +
            '</td></tr>').join('');

        document.getElementById('players').innerHTML =
            '<table class="stat-table"><thead><tr><th>№</th><th>登録名</th><th>チーム名</th><th>YouTube名</th><th></th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td class="empty" colspan="5">まだ登録がありません</td></tr>') + '</tbody></table>';

        document.querySelectorAll('[data-edit-player]').forEach(b => b.addEventListener('click', () => {
            const p = state.data.players[b.dataset.editPlayer];
            document.getElementById('player-id').value = p.id;
            document.getElementById('player-name').value = p.name;
            document.getElementById('player-team').value = p.teamId || '';
            document.getElementById('player-youtube').value = p.youtube || '';
        }));
        document.querySelectorAll('[data-del-player]').forEach(b => b.addEventListener('click', () => {
            const p = state.data.players[b.dataset.delPlayer];
            if (playerUsed(p.id)) { alert('「' + p.name + '」は試合結果で使われているので削除できません'); return; }
            if (confirm('「' + p.name + '」を削除します。よろしいですか？')) PCS.remove('players/' + p.id);
        }));
    }

    function savePlayer(e) {
        e.preventDefault();
        const id = document.getElementById('player-id').value;
        const name = document.getElementById('player-name').value.trim();
        if (!name) return;
        const dup = sortedList(state.data.players).find(p => p.name === name && p.id !== id);
        if (dup) { alert('「' + name + '」は既に登録されています'); return; }
        const cur = id ? state.data.players[id] : null;
        const rec = {
            id: id || nextId('players', 'p'),
            no: cur ? cur.no : nextNo('players'),
            name,
            teamId: document.getElementById('player-team').value,
            youtube: document.getElementById('player-youtube').value.trim()
        };
        PCS.set('players/' + rec.id, rec).then(() => clearForm('player'));
    }

    /* ---------- チーム ---------- */

    function renderTeams() {
        const rows = sortedList(state.data.teams).map(t =>
            '<tr><td class="num">' + t.no + '</td><td class="c-team">' + esc(t.name) + '</td>' +
            '<td class="c-ops">' +
            '<button type="button" class="btn-mini" data-edit-team="' + esc(t.id) + '">編集</button>' +
            '<button type="button" class="btn-mini danger" data-del-team="' + esc(t.id) + '">削除</button>' +
            '</td></tr>').join('');

        document.getElementById('teams').innerHTML =
            '<table class="stat-table"><thead><tr><th>№</th><th>チーム名</th><th></th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td class="empty" colspan="3">まだ登録がありません</td></tr>') + '</tbody></table>';

        document.querySelectorAll('[data-edit-team]').forEach(b => b.addEventListener('click', () => {
            const t = state.data.teams[b.dataset.editTeam];
            document.getElementById('team-id').value = t.id;
            document.getElementById('team-name').value = t.name;
        }));
        document.querySelectorAll('[data-del-team]').forEach(b => b.addEventListener('click', () => {
            const t = state.data.teams[b.dataset.delTeam];
            if (teamUsed(t.id)) { alert('「' + t.name + '」に所属している選手がいるので削除できません'); return; }
            if (confirm('「' + t.name + '」を削除します。よろしいですか？')) PCS.remove('teams/' + t.id);
        }));
    }

    function saveTeam(e) {
        e.preventDefault();
        const id = document.getElementById('team-id').value;
        const name = document.getElementById('team-name').value.trim();
        if (!name) return;
        const cur = id ? state.data.teams[id] : null;
        const rec = { id: id || nextId('teams', 't'), no: cur ? cur.no : nextNo('teams'), name };
        PCS.set('teams/' + rec.id, rec).then(() => clearForm('team'));
    }

    /* ---------- 集計期間 ---------- */

    function renderPeriods() {
        const rows = sortedList(state.data.periods).map(p =>
            '<tr><td class="num">' + p.no + '</td><td>' + esc(p.name) + '</td>' +
            '<td class="num">' + (formatDate(p.from) || '—') + '</td>' +
            '<td class="num">' + (formatDate(p.to) || '—') + '</td>' +
            '<td class="c-ops">' +
            '<button type="button" class="btn-mini" data-edit-period="' + esc(p.id) + '">編集</button>' +
            '<button type="button" class="btn-mini danger" data-del-period="' + esc(p.id) + '">削除</button>' +
            '</td></tr>').join('');

        document.getElementById('periods').innerHTML =
            '<table class="stat-table"><thead><tr><th>№</th><th>期名</th><th>開始</th><th>終了</th><th></th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td class="empty" colspan="5">まだ登録がありません</td></tr>') + '</tbody></table>';

        document.querySelectorAll('[data-edit-period]').forEach(b => b.addEventListener('click', () => {
            const p = state.data.periods[b.dataset.editPeriod];
            document.getElementById('period-id').value = p.id;
            document.getElementById('period-name').value = p.name;
            document.getElementById('period-from').value = PCS.numToInput(p.from || 20000101);
            document.getElementById('period-to').value = PCS.numToInput(p.to >= 99991231 ? 20991231 : p.to);
        }));
        document.querySelectorAll('[data-del-period]').forEach(b => b.addEventListener('click', () => {
            const p = state.data.periods[b.dataset.delPeriod];
            if (confirm('「' + p.name + '」を削除します。試合データは消えません。よろしいですか？')) PCS.remove('periods/' + p.id);
        }));
    }

    function savePeriod(e) {
        e.preventDefault();
        const id = document.getElementById('period-id').value;
        const name = document.getElementById('period-name').value.trim();
        const from = PCS.inputToNum(document.getElementById('period-from').value);
        const to = PCS.inputToNum(document.getElementById('period-to').value);
        if (!name || !from || !to) return;
        if (from > to) { alert('開始日が終了日より後になっています'); return; }
        const cur = id ? state.data.periods[id] : null;
        const rec = { id: id || nextId('periods', 'per'), no: cur ? cur.no : nextNo('periods'), name, from, to };
        PCS.set('periods/' + rec.id, rec).then(() => clearForm('period'));
    }

    /* ---------- フォーム ---------- */

    function clearForm(kind) {
        document.querySelectorAll('#' + kind + '-form input').forEach(el => { el.value = ''; });
        const sel = document.querySelector('#' + kind + '-form select');
        if (sel) sel.value = '';
    }

    /* ---------- 初期データ取り込み ---------- */

    async function importSeed() {
        const has = ['teams', 'players', 'periods', 'matches'].filter(k => state.data[k] && Object.keys(state.data[k]).length);
        if (has.length && !confirm('すでに ' + has.join('・') + ' にデータがあります。seed.json の内容で上書きします。よろしいですか？')) return;
        const res = await fetch('data/seed.json');
        const seed = await res.json();
        const map = {};
        ['teams', 'players', 'periods', 'matches', 'settings'].forEach(k => { if (seed[k]) map[k] = seed[k]; });
        await PCS.update(map);
        const done = document.getElementById('seed-done');
        done.textContent = '取り込みました';
        done.hidden = false;
    }

    /* ---------- 起動 ---------- */

    function start() {
        document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-current', t === tab));
            ['players', 'teams', 'periods'].forEach(k => {
                document.getElementById('pane-' + k).hidden = (k !== tab.dataset.tab);
            });
        }));

        document.getElementById('player-form').addEventListener('submit', savePlayer);
        document.getElementById('team-form').addEventListener('submit', saveTeam);
        document.getElementById('period-form').addEventListener('submit', savePeriod);
        document.querySelectorAll('[data-cancel]').forEach(b =>
            b.addEventListener('click', () => clearForm(b.dataset.cancel)));
        document.getElementById('seed-btn').addEventListener('click', importSeed);

        document.getElementById('period-month').addEventListener('click', () => {
            const m = PCS.currentMonthRange();
            document.getElementById('period-name').value = m.name;
            document.getElementById('period-from').value = PCS.numToInput(m.from);
            document.getElementById('period-to').value = PCS.numToInput(m.to);
        });

        PCS.subscribe(data => {
            state.data = data || {};
            renderPlayers();
            renderTeams();
            renderPeriods();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        PCS.showDemoBanner();
        initGate();
    });
})();
