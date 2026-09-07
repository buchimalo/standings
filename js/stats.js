// js/stats.js — 成績表の集計と描画
(function () {
    'use strict';

    const { esc, sortedList, formatDate, RANK_POINTS, SEATS } = PCS;

    const state = {
        data: {},
        periodId: '',
        minGames: 1,
        sortKey: 'avg',
        sortDir: 1,
        keyword: ''
    };

    // dir は「その列を最初に押したときの並び順」
    const COLUMNS = [
        { key: 'avg', label: '平均順位', dir: 1, fmt: v => v.toFixed(2), group: '総合成績' },
        { key: 'point', label: 'ポイント', dir: -1, fmt: v => (v > 0 ? '+' : '') + v, group: '総合成績' },
        { key: 'games', label: 'ゲーム数', dir: -1, fmt: v => v, group: '総合成績' },
        { key: 'rate1', label: '1位率', dir: -1, fmt: pct, group: '順位率' },
        { key: 'rate2', label: '2位率', dir: -1, fmt: pct, group: '順位率' },
        { key: 'rate3', label: '3位率', dir: -1, fmt: pct, group: '順位率' },
        { key: 'rate4', label: '4位率', dir: -1, fmt: pct, group: '順位率' },
        { key: 'rate5', label: '5位率', dir: -1, fmt: pct, group: '順位率' },
        { key: 'rate6', label: '6位率', dir: -1, fmt: pct, group: '順位率' },
        { key: 'top2', label: '2連対率', dir: -1, fmt: pct, group: '連対率' },
        { key: 'top3', label: '3連対率', dir: -1, fmt: pct, group: '連対率' },
        { key: 'top4', label: '4連対率', dir: -1, fmt: pct, group: '連対率' },
        { key: 'top5', label: '5連対率', dir: -1, fmt: pct, group: '連対率' },
        { key: 'count1', label: '1位', dir: -1, fmt: v => v, group: '順位回数' },
        { key: 'count2', label: '2位', dir: -1, fmt: v => v, group: '順位回数' },
        { key: 'count3', label: '3位', dir: -1, fmt: v => v, group: '順位回数' },
        { key: 'count4', label: '4位', dir: -1, fmt: v => v, group: '順位回数' },
        { key: 'count5', label: '5位', dir: -1, fmt: v => v, group: '順位回数' },
        { key: 'count6', label: '6位', dir: -1, fmt: v => v, group: '順位回数' }
    ];

    function pct(v) { return v.toFixed(1); }

    /* ---------- 集計 ---------- */

    function aggregate(data, period, minGames) {
        const players = data.players || {};
        const matches = data.matches || {};
        const from = period ? period.from : 0;
        const to = period ? period.to : 99991231;

        const rows = {};
        function row(id) {
            if (!rows[id]) {
                const p = players[id];
                rows[id] = {
                    id,
                    no: p ? p.no : 9999,
                    name: p ? p.name : '(削除された選手)',
                    games: 0, point: 0, sum: 0,
                    counts: [0, 0, 0, 0, 0, 0]
                };
            }
            return rows[id];
        }

        Object.keys(matches).forEach(mid => {
            const m = matches[mid];
            if (!m || !m.players) return;
            if (m.date < from || m.date > to) return;
            m.players.forEach((pid, i) => {
                if (!pid) return;
                const r = row(pid);
                r.games += 1;
                r.sum += i + 1;
                r.point += (RANK_POINTS[i + 1] || 0);
                r.counts[i] += 1;
            });
        });

        return Object.keys(rows).map(id => {
            const r = rows[id];
            r.avg = r.games ? r.sum / r.games : 0;
            let acc = 0;
            for (let i = 1; i <= SEATS; i++) {
                r['count' + i] = r.counts[i - 1];
                r['rate' + i] = r.games ? r.counts[i - 1] / r.games * 100 : 0;
                acc += r.counts[i - 1];
                if (i >= 2 && i <= 5) r['top' + i] = r.games ? acc / r.games * 100 : 0;
            }
            return r;
        }).filter(r => r.games >= minGames);
    }

    /* ---------- 描画 ---------- */

    function currentPeriod() {
        const periods = sortedList(state.data.periods);
        return periods.find(p => p.id === state.periodId) || periods[0] || null;
    }

    function countMatches(period) {
        const from = period ? period.from : 0;
        const to = period ? period.to : 99991231;
        const matches = state.data.matches || {};
        return Object.keys(matches)
            .filter(k => matches[k] && matches[k].date >= from && matches[k].date <= to).length;
    }

    function buildHead() {
        const top = ['<tr>',
            '<th class="c-rank" rowspan="2">順位</th>',
            '<th class="c-name" rowspan="2">登録名</th>'];
        let i = 0;
        while (i < COLUMNS.length) {
            const g = COLUMNS[i].group;
            let span = 0;
            while (i + span < COLUMNS.length && COLUMNS[i + span].group === g) span++;
            top.push('<th colspan="' + span + '" class="g-head">' + esc(g) + '</th>');
            i += span;
        }
        top.push('</tr>');

        const sub = ['<tr>'];
        COLUMNS.forEach(c => {
            const active = c.key === state.sortKey;
            const arrow = active ? (state.sortDir === 1 ? '▲' : '▼') : '';
            sub.push('<th class="sortable' + (active ? ' is-sorted' : '') + '" data-key="' + c.key + '">' +
                esc(c.label) + '<span class="arrow">' + arrow + '</span></th>');
        });
        sub.push('</tr>');
        return top.join('') + sub.join('');
    }

    function render() {
        const period = currentPeriod();
        let rows = aggregate(state.data, period, state.minGames);

        const kw = state.keyword.trim().toLowerCase();
        if (kw) rows = rows.filter(r => r.name.toLowerCase().indexOf(kw) >= 0);

        const col = COLUMNS.find(c => c.key === state.sortKey) || COLUMNS[0];
        rows.sort((a, b) => {
            const d = (a[col.key] - b[col.key]) * state.sortDir;
            if (d) return d;
            return (a.avg - b.avg) || (b.games - a.games) || (a.no - b.no);
        });

        document.getElementById('summary').textContent =
            (period ? period.name : '全期間') + ' ／ ' + rows.length + '人 ／ ' + countMatches(period) + '試合';

        const body = rows.map((r, idx) => {
            const cells = COLUMNS.map(c => {
                let cls = 'num';
                if (c.key === state.sortKey) cls += ' is-sorted';
                if (c.key === 'point') cls += r.point > 0 ? ' plus' : r.point < 0 ? ' minus' : '';
                return '<td class="' + cls + '">' + c.fmt(r[c.key]) + '</td>';
            }).join('');
            return '<tr><td class="c-rank">' + (idx === 0 ? '<span class="crown">👑</span>' : idx + 1) + '</td>' +
                '<td class="c-name">' + esc(r.name) + '</td>' + cells + '</tr>';
        }).join('');

        const empty = '<tr><td class="empty" colspan="' + (2 + COLUMNS.length) + '">該当する成績がありません</td></tr>';
        document.getElementById('table').innerHTML =
            '<table class="stat-table"><thead>' + buildHead() + '</thead><tbody>' + (body || empty) + '</tbody></table>';

        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.key;
                if (state.sortKey === key) state.sortDir *= -1;
                else { state.sortKey = key; state.sortDir = COLUMNS.find(x => x.key === key).dir; }
                render();
            });
        });
    }

    function renderPeriods() {
        const periods = sortedList(state.data.periods);
        if (!periods.some(p => p.id === state.periodId)) state.periodId = periods.length ? periods[0].id : '';
        if (!periods.length) {
            document.getElementById('period').innerHTML = '<option value="">全期間</option>';
            return;
        }
        document.getElementById('period').innerHTML = periods.map(p => {
            const range = PCS.formatRange(p.from, p.to);
            return '<option value="' + esc(p.id) + '"' + (p.id === state.periodId ? ' selected' : '') + '>' +
                esc(p.name) + (range ? '（' + range + '）' : '') + '</option>';
        }).join('');
    }

    /* ---------- 起動 ---------- */

    document.addEventListener('DOMContentLoaded', () => {
        PCS.showDemoBanner();

        document.getElementById('period').addEventListener('change', e => {
            state.periodId = e.target.value;
            render();
        });
        document.getElementById('min-games').addEventListener('input', e => {
            state.minGames = Math.max(0, parseInt(e.target.value, 10) || 0);
            render();
        });
        document.getElementById('keyword').addEventListener('input', e => {
            state.keyword = e.target.value;
            render();
        });

        PCS.subscribe(data => {
            state.data = data || {};
            renderPeriods();
            render();
        });
    });
})();
