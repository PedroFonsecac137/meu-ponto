/* eslint-disable react/react-compiler -- One-time hydration of browser-local records after server rendering. */
'use client';
import { useEffect, useState } from 'react';
import { calculate, duration, clock } from './time.mjs';
import { readRecords, writeRecords, exportCsv } from './storage';
type Entry = {
  date: string;
  start: string;
  lunch: string;
  back: string;
  end: string;
  target: number;
  pause: number;
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const blank = (date: string, target = 360, pause = 60): Entry => ({
  date,
  start: '',
  lunch: '',
  back: '',
  end: '',
  target,
  pause,
});
const KEY = 'meu-ponto-v1';
export default function Home() {
  const [entry, setEntry] = useState(blank(''));
  const [rows, setRows] = useState<Entry[]>([]);
  const [month, setMonth] = useState('');
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  // Hydrate browser storage after mounting.
  // oxlint-disable-next-line react(react-compiler)
  useEffect(() => {
    async function load() {
    const date = today();
    // Browser-local hydration requires a one-time state update after mount.
    // oxlint-disable-next-line react(react-compiler)
    setMonth(date.slice(0, 7));
    try {
      const saved = JSON.parse((await readRecords(KEY)) || '{"rows":[]}');
      if (!Array.isArray(saved.rows)) throw Error();
      setRows(saved.rows);
      setEntry(
        saved.rows.find((r: Entry) => r.date === date) ||
          blank(date, saved.target || 360, saved.pause ?? 60),
      );
    } catch {
      setEntry(blank(date));
      setMessage('Não foi possível ler os registros salvos.');
    }
    setReady(true);
    }
    void load();
  }, []);
  const result = calculate(entry);
  const selected = rows
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const completed = selected.filter((r) => calculate(r).worked !== null);
  const total = completed.reduce((s, r) => s + calculate(r).worked!, 0);
  const balance = completed.reduce(
    (s, r) => s + calculate(r).worked! - r.target,
    0,
  );
  function update(key: keyof Entry, value: string | number) {
    setEntry((e) => ({ ...e, [key]: value }));
    setMessage('');
  }
  function choose(date: string) {
    setEntry(
      rows.find((r) => r.date === date) ||
        blank(date, entry.target, entry.pause),
    );
    setMessage('');
  }
  async function persist(next: Entry[]) {
    try {
      await writeRecords(
        KEY,
        JSON.stringify({
          rows: next,
          target: entry.target,
          pause: entry.pause,
        }),
      );
      setRows(next);
      return true;
    } catch {
      setMessage(
        'Não foi possível salvar. Verifique o armazenamento do aplicativo.',
      );
      return false;
    }
  }
  async function save() {
    if (result.error || !entry.date || !entry.start) {
      setMessage(result.error || 'Informe a data e a entrada.');
      return;
    }
    if (await persist([...rows.filter((r) => r.date !== entry.date), entry]))
      setMessage('Registro salvo neste aplicativo.');
  }
  async function remove() {
    if (
      confirm('Excluir o registro desta data?') &&
      await persist(rows.filter((r) => r.date !== entry.date))
    ) {
      setEntry(blank(entry.date, entry.target, entry.pause));
      setMessage('Registro excluído.');
    }
  }
  async function download() {
    const lines = [
      [
        'Data',
        'Entrada',
        'Saída almoço',
        'Volta almoço',
        'Saída',
        'Meta (min)',
        'Trabalhado (min)',
        'Saldo (min)',
      ],
      ...selected.map((r) => {
        const c = calculate(r);
        return [
          r.date,
          r.start,
          r.lunch,
          r.back,
          r.end,
          r.target,
          c.worked ?? '',
          c.worked === null ? '' : c.worked - r.target,
        ];
      }),
    ];
    const csv =
      '\uFEFF' +
      lines
        .map((l) =>
          l.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(';'),
        )
        .join('\r\n');
    try { await exportCsv(csv,`ponto-${month}.csv`); }
    catch { setMessage('Exportação não concluída. Tente novamente e escolha onde salvar ou compartilhar.'); }
  }
  const fields = [
    ['start', 'Entrada'],
    ['lunch', 'Início do almoço'],
    ['back', 'Fim do almoço'],
    ['end', 'Saída'],
  ] as const;
  return (
    <>
      <header>
        <div className="brand">
          <img src="./logo.svg" width="40" height="40" alt=""/><b>meu ponto</b>
          <small>ESTÁGIO</small>
        </div>
        <span className="local">Offline</span>
      </header>
      <main>
        <div className="heading">
          <p className="eyebrow">SEU TEMPO, ORGANIZADO</p>
          <h1>Seu dia, no ponto.</h1>
          <p>Seus horários e seu saldo, em um só lugar.</p>
        </div>
        <div className="workspace">
          <section className="panel register">
            <div className="title">
              <h2>Registro do dia</h2>
              <input
                aria-label="Data do registro"
                type="date"
                value={entry.date}
                onChange={(e) => choose(e.target.value)}
              />
            </div>
            <div className="schedule"><span>Jornada <b>{duration(entry.target)}</b></span><span>Intervalo <b>{duration(entry.pause)}</b></span></div>
            <div className="time-grid">
              {fields.map(([key, label], i) => (
                <div className="time-field" key={key}>
                  <label htmlFor={key}>
                    <small>0{i + 1}</small>
                    {label}
                  </label>
                  <input
                    id={key}
                    type="time"
                    value={entry[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                  <button
                    className="text-button"
                    disabled={!ready || entry.date !== today()}
                    onClick={() => {
                      const d = new Date();
                      update(
                        key,
                        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                      );
                    }}
                  >
                    Agora
                  </button>
                </div>
              ))}
            </div>
            <details>
              <summary>Ajustar jornada e intervalo</summary>
              <div className="settings">
                <label>
                  Jornada em minutos
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={entry.target}
                    onChange={(e) => update('target', Number(e.target.value))}
                  />
                </label>
                <label>
                  Almoço em minutos
                  <input
                    type="number"
                    min="0"
                    max="720"
                    value={entry.pause}
                    onChange={(e) => update('pause', Number(e.target.value))}
                  />
                </label>
              </div>
              <p>
                O almoço não conta como trabalho. Os ajustes são salvos por dia.
              </p>
            </details>
            <div className="save-row">
              <button className="primary" disabled={!ready} onClick={save}>
                ✓ Salvar registro
              </button>
              {rows.some((r) => r.date === entry.date) && (
                <button className="text-button" onClick={remove}>
                  Excluir dia
                </button>
              )}
              <span>Você pode editar os horários depois.</span>
            </div>
            <output
              className={result.error ? 'feedback negative' : 'feedback'}
              aria-live="polite"
            >
              {result.error || message}
            </output>
          </section>
          <aside className="forecast">
            <p className="eyebrow">PLANEJE SEU DIA</p>
            <div className="return">
              <div className="coffee">☕</div>
              <h2>Volta do almoço</h2>
              <strong>
                {!result.error && result.returnAt !== null
                  ? clock(result.returnAt)
                  : '--:--'}
              </strong>
              <p>
                {entry.lunch
                  ? `Saindo às ${entry.lunch}, com ${duration(entry.pause)} de intervalo.`
                  : 'Informe a saída para o almoço e veja a hora de voltar.'}
              </p>
            </div>
            <div className="exit">
              <span>Saída prevista →</span>
              <b>
                {!result.error && result.exitAt !== null
                  ? clock(result.exitAt)
                  : '--:--'}
              </b>
              <p>
                Para completar {duration(entry.target)} de trabalho.{' '}
                {entry.back
                  ? 'Considera seu intervalo real.'
                  : 'Considera o intervalo planejado.'}
              </p>
            </div>
            <div className="day-balance">
              <span>Saldo do dia</span>
              <b>
                {!result.error && result.worked !== null
                  ? duration(result.worked - entry.target, true)
                  : 'Em aberto'}
              </b>
              <p>
                {result.worked !== null
                  ? `${duration(result.worked)} trabalhadas`
                  : 'Preencha a saída para calcular.'}
              </p>
            </div>
          </aside>
        </div>
        <section className="panel history">
          <div className="title">
            <div>
              <h2>Histórico de registros</h2>
              <p>Saldo calculado apenas nos dias concluídos.</p>
            </div>
            <div className="actions">
              <input
                type="month"
                aria-label="Mês do histórico"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
              <button
                className="secondary"
                disabled={!selected.length}
                onClick={download}
              >
                ↓ Exportar CSV
              </button>
            </div>
          </div>
          <div className="stats">
            <div>
              <span>Dias concluídos</span>
              <b>{String(completed.length).padStart(2, '0')}</b>
            </div>
            <div>
              <span>Horas trabalhadas</span>
              <b>{duration(total)}</b>
            </div>
            <div>
              <span>Saldo do mês</span>
              <b className={balance < 0 ? 'negative' : 'positive'}>
                {duration(balance, true)}
              </b>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Entrada</th>
                  <th>Almoço</th>
                  <th>Saída</th>
                  <th>Trabalhado</th>
                  <th>Saldo</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {selected.map((r) => {
                  const c = calculate(r);
                  return (
                    <tr key={r.date}>
                      <td data-label="Data">{r.date.split('-').reverse().join('/')}</td>
                      <td data-label="Entrada">{r.start || '—'}</td>
                      <td data-label="Almoço">
                        {r.lunch || '—'} → {r.back || '—'}
                      </td>
                      <td data-label="Saída">{r.end || '—'}</td>
                      <td data-label="Trabalhado">
                        {c.worked === null ? 'Em aberto' : duration(c.worked)}
                      </td>
                      <td data-label="Saldo"
                        className={
                          c.worked !== null && c.worked - r.target < 0
                            ? 'negative'
                            : 'positive'
                        }
                      >
                        {c.worked === null
                          ? '—'
                          : duration(c.worked - r.target, true)}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => {
                            choose(r.date);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!selected.length && (
              <div className="empty">
                <span>▦</span>
                <b>Seu histórico começa com o primeiro registro</b>
                <p>Preencha os horários acima e clique em Salvar registro.</p>
              </div>
            )}
          </div>
        </section>
        <footer>
          Os registros ficam neste aplicativo. Exporte o CSV para guardar uma
          cópia.<span>Saldo pessoal para acompanhamento do estágio.</span>
        </footer>
      </main>
    </>
  );
}



