// js/matches.js — 試合一覧
(function () {
    'use strict';

    const { esc, sortedList, formatDate } = PCS;

    const state = { data: {}, periodId: '', keyword: '' };

    function nameOf(id) {
        const p = (state.data.players || {})[id];
        return p ? p.name : '';
    }

    function currentPeriod() {
        const periods = sortedList(state.data.periods);
        return periods.find(p => p.id === state.periodId) || periods[0] || null;
    }

    function render() {
        const period = currentPeriod();
        const from = period ? period.from : 0;
        const to = period ? period.to : 99991231;
        const kw = state.keyword.trim().toLowerCase();

        let list = Object.keys(state.data.matches || {})
            .map(k => state.data.matches[k])
            .filter(m => m && m.date >= from && m.date <= to)
            .sort((a, b) => (b.date - a.date) || (b.no - a.no));

        if (kw) {
            list = list.filter(m => {
                const text = (m.code || '') + ' ' + (m.players || []).map(nameOf).join(' ');
                return text.toLowerCase().indexOf(kw) >= 0;
            });
        }

        document.getElementById('summary').textContent =
            (period ? period.name : '—') + ' ／ ' + list.length + '試合';

        const rows = list.map(m => {
            const names = (m.players || []).map((id, i) =>
                '<td class="c-name">' + (i === 0 ? '<b>' : '') + esc(nameOf(id)) + (i === 0 ? '</b>' : '') + '</td>').join('');
            return '<tr><td class="num">' + m.no + '</td><td class="num">' + formatDate(m.date) + '</td>' +
                '<td>' + esc(m.code || '') + '</td>' + names + '</tr>';
        }).join('');

        const head = '<tr><th>No.</th><th>日付</th><th>コード</th>' +
            '<th>1位</th><th>2位</th><th>3位</th><th>4位</th><th>5位</th><th>6位</th></tr>';
        document.getElementById('table').innerHTML =
            '<table class="stat-table"><thead>' + head + '</thead><tbody>' +
            (rows || '<tr><td class="empty" colspan="9">該当する試合がありません</td></tr>') + '</tbody></table>';
    }

    function renderPeriods() {
        const periods = sortedList(state.data.periods);
        if (!periods.some(p => p.id === state.periodId)) state.periodId = periods.length ? periods[0].id : '';
        document.getElementById('period').innerHTML = periods.map(p => {
            const range = PCS.formatRange(p.from, p.to);
            return '<option value="' + esc(p.id) + '"' + (p.id === state.periodId ? ' selected' : '') + '>' +
                esc(p.name) + (range ? '（' + range + '）' : '') + '</option>';
        }).join('');
    }

    document.addEventListener('DOMContentLoaded', () => {
        PCS.showDemoBanner();

        document.getElementById('period').addEventListener('change', e => {
            state.periodId = e.target.value;
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
