import { useEffect, useRef, useState } from "react";
import { calculate, duration, clock } from "./time.mjs";
import { readRecords, writeRecords, exportCsv } from "./storage";
import { version } from "./package.json";

type Entry = {
  date: string;
  start: string;
  lunch: string;
  back: string;
  end: string;
  target: number;
  pause: number;
};
type Page = "day" | "history";
const KEY = "meu-ponto-v1";
const fields = [
  ["start", "Entrada", "Início da jornada"],
  ["lunch", "Saída para almoço", "Hora de fazer uma pausa"],
  ["back", "Volta do almoço", "De volta à jornada"],
  ["end", "Saída", "Fim do expediente"],
] as const;
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const blank = (date: string, target = 360, pause = 60): Entry => ({
  date,
  start: "",
  lunch: "",
  back: "",
  end: "",
  target,
  pause,
});
const friendly = (date: string) => date.split("-").reverse().join("/");
const nowTime = () =>
  new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
function Icon({
  kind,
}: {
  kind: "clock" | "calendar" | "arrow" | "check" | "download" | "settings";
}) {
  const paths = {
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M8 3v4m8-4v4M4 10h16m-11 4h2m3 0h2m-7 3h2" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="2.5" fill="currentColor" />
        <circle cx="15" cy="17" r="2.5" fill="currentColor" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  );
}
export default function App() {
  const [entry, setEntry] = useState(blank(localDate()));
  const [rows, setRows] = useState<Entry[]>([]);
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [page, setPage] = useState<Page>("day");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [current, setCurrent] = useState(nowTime());
  useEffect(() => {
    const timer = setInterval(() => setCurrent(nowTime()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    void (async () => {
      try {
        const saved = JSON.parse((await readRecords(KEY)) || '{"rows":[]}');
        if (
          !Array.isArray(saved.rows) ||
          saved.rows.some(
            (r: Entry) =>
              !r ||
              !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
              fields.some(([k]) => typeof r[k] !== "string") ||
              !Number.isInteger(r.target) ||
              !Number.isInteger(r.pause),
          )
        )
          throw Error();
        setRows(saved.rows);
        setEntry(
          saved.rows.find((r: Entry) => r.date === localDate()) ||
            blank(localDate(), saved.target || 360, saved.pause ?? 60),
        );
        setReady(true);
      } catch {
        setLoadError(true);
        setNotice(
          "Não foi possível carregar seus registros. Feche e abra o aplicativo para tentar novamente.",
        );
      }
    })();
  }, []);
  const result = calculate(entry);
  const saved = rows.some((r) => r.date === entry.date);
  const selected = rows
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const finished = selected.filter((r) => calculate(r).worked !== null);
  const total = finished.reduce((n, r) => n + calculate(r).worked!, 0);
  const balance = finished.reduce(
    (n, r) => n + calculate(r).worked! - r.target,
    0,
  );
  const next = fields.find(([key]) => !entry[key]);
  function update(key: keyof Entry, value: string | number) {
    setEntry((e) => ({ ...e, [key]: value }));
    setDirty(true);
    setNotice("");
  }
  function choose(date: string) {
    if (!date) return false;
    if (
      dirty &&
      !confirm("Trocar de dia e descartar os horários ainda não salvos?")
    )
      return false;
    setEntry(
      rows.find((r) => r.date === date) ||
        blank(date, entry.target, entry.pause),
    );
    setDirty(false);
    setNotice("");
    return true;
  }
  async function persist(nextRows: Entry[], day: Entry) {
    await writeRecords(
      KEY,
      JSON.stringify({ rows: nextRows, target: day.target, pause: day.pause }),
    );
    setRows(nextRows);
  }
  async function save(day = entry) {
    if (lock.current || !ready) return;
    const c = calculate(day);
    if (c.error || !day.start || !day.date) {
      setNotice(c.error || "Preencha a data e o horário de entrada.");
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await persist([...rows.filter((r) => r.date !== day.date), day], day);
      setEntry(day);
      setDirty(false);
      setNotice("Registro salvo no aparelho.");
    } catch {
      setNotice(
        "Não foi possível salvar. Seus horários continuam na tela; tente novamente.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (
      lock.current ||
      !confirm(`Excluir o registro de ${friendly(entry.date)}?`)
    )
      return;
    lock.current = true;
    setBusy(true);
    try {
      await persist(
        rows.filter((r) => r.date !== entry.date),
        entry,
      );
      setEntry(blank(entry.date, entry.target, entry.pause));
      setDirty(false);
      setNotice("Registro excluído.");
    } catch {
      setNotice("Não foi possível excluir. Tente novamente.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function download() {
    try {
      const lines = [
        [
          "Data",
          "Entrada",
          "Saída almoço",
          "Volta almoço",
          "Saída",
          "Meta (min)",
          "Trabalhado (min)",
          "Saldo (min)",
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
            c.worked ?? "",
            c.worked === null ? "" : c.worked - r.target,
          ];
        }),
      ];
      const csv =
        "\uFEFF" +
        lines
          .map((line) =>
            line
              .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
              .join(";"),
          )
          .join("\r\n");
      await exportCsv(csv, `meu-ponto-${month}.csv`);
      setNotice("Arquivo pronto para salvar ou compartilhar.");
    } catch {
      setNotice("Exportação não concluída. Tente novamente.");
    }
  }
  function navigate(to: Page) {
    setPage(to);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <img src="./logo.svg" alt="" width="40" height="40" />
          <div>
            <strong>meu ponto</strong>
            <small>seu tempo, organizado.</small>
          </div>
        </div>
        <span className="offline">
          <i />
          Offline
        </span>
      </header>
      <main>
        <div className="page-heading">
          <p className="eyebrow">
            {page === "day" ? "SUA ROTINA, NO SEU RITMO" : "CADA DIA CONTA"}
          </p>
          <h1>{page === "day" ? "Seu dia, no ponto." : "Seu tempo em dia."}</h1>
          <p>
            {page === "day"
              ? "Registre os horários. A gente faz as contas."
              : "Seus registros e o saldo de cada jornada."}
          </p>
        </div>
        <nav className="tabs" aria-label="Telas do aplicativo">
          <button
            aria-current={page === "day" ? "page" : undefined}
            onClick={() => navigate("day")}
          >
            <Icon kind="clock" />
            Registro
          </button>
          <button
            aria-current={page === "history" ? "page" : undefined}
            onClick={() => navigate("history")}
          >
            <Icon kind="calendar" />
            Histórico
          </button>
        </nav>
        {notice && (
          <div className={`notice ${loadError ? "error" : ""}`} role="status">
            {notice}
          </div>
        )}
        {page === "day" ? (
          <div className="day-layout">
            <section className="card register">
              <div className="section-title">
                <h2>Minha jornada</h2>
                <span className={`status ${saved && !dirty ? "saved" : ""}`}>
                  {saved && !dirty
                    ? "Salvo"
                    : dirty
                      ? "Não salvo"
                      : "Novo registro"}
                </span>
              </div>
              <label className="date-label" htmlFor="day">
                Data do registro
              </label>
              <input
                id="day"
                className="date-input"
                type="date"
                value={entry.date}
                disabled={!ready || busy}
                onChange={(e) => choose(e.target.value)}
              />
              <div className="routine">
                <span>
                  Jornada <b>{duration(entry.target)}</b>
                </span>
                <span>
                  Almoço <b>{duration(entry.pause)}</b>
                </span>
              </div>
              <div className="punches">
                {fields.map(([key, label, sub], i) => (
                  <div
                    className={`punch ${entry[key] ? "filled" : ""}`}
                    key={key}
                  >
                    <div className="punch-heading">
                      <span className="step">
                        {entry[key] ? <Icon kind="check" /> : `0${i + 1}`}
                      </span>
                      <label htmlFor={key}>
                        {label}
                        <small>{sub}</small>
                      </label>
                    </div>
                    <div className="punch-controls">
                      <input
                        id={key}
                        aria-label={label}
                        type="time"
                        value={entry[key]}
                        disabled={!ready || busy}
                        onChange={(e) => update(key, e.target.value)}
                      />
                      <button
                        className="now"
                        disabled={!ready || busy || entry.date !== localDate()}
                        onClick={() => update(key, nowTime())}
                      >
                        Agora
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <details className="settings">
                <summary>
                  <Icon kind="settings" />
                  Ajustar jornada e intervalo<span>+</span>
                </summary>
                <div className="settings-grid">
                  <label>
                    Jornada em minutos
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={entry.target}
                      disabled={!ready || busy}
                      onChange={(e) => update("target", Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Almoço em minutos
                    <input
                      type="number"
                      min="0"
                      max="720"
                      value={entry.pause}
                      disabled={!ready || busy}
                      onChange={(e) => update("pause", Number(e.target.value))}
                    />
                  </label>
                </div>
                <p>
                  O almoço não conta como trabalho. Os ajustes valem para este
                  registro.
                </p>
              </details>
              {result.error && (
                <p className="validation" role="alert">
                  {result.error}
                </p>
              )}
              <button
                className="primary save"
                disabled={!ready || busy || !!result.error}
                onClick={() => void save()}
              >
                <Icon kind="check" />
                {busy ? "Salvando…" : "Salvar registro"}
              </button>
              <p className="save-hint">Você pode editar os horários depois.</p>
              {saved && (
                <button
                  className="delete"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  Excluir registro deste dia
                </button>
              )}
            </section>
            <aside className="day-aside">
              <section className="forecast">
                <div className="forecast-title">
                  <span className="eyebrow">SEU DIA EM NÚMEROS</span>
                  <Icon kind="clock" />
                </div>
                <div className="forecast-values">
                  <div>
                    <span>Volta do almoço</span>
                    <strong>
                      {!result.error && result.returnAt !== null
                        ? clock(result.returnAt)
                        : "—:—"}
                    </strong>
                  </div>
                  <div>
                    <span>Saída prevista</span>
                    <strong>
                      {!result.error && result.exitAt !== null
                        ? clock(result.exitAt)
                        : "—:—"}
                    </strong>
                  </div>
                </div>
                <p>
                  {entry.back
                    ? "Previsão com o seu intervalo real."
                    : `Considerando ${duration(entry.pause)} de almoço.`}
                </p>
                <div className="daily-balance">
                  <span>Saldo do dia</span>
                  <b>
                    {result.worked === null
                      ? "Em aberto"
                      : duration(result.worked - entry.target, true)}
                  </b>
                </div>
                <p>
                  {result.worked === null
                    ? "Preencha a saída para fechar a jornada."
                    : `${duration(result.worked)} de trabalho registradas.`}
                </p>
              </section>
              <section className="quick card">
                <div className="quick-heading">
                  <span>Agora, no seu relógio</span>
                  <b>{current}</b>
                </div>
                <button
                  className="secondary"
                  disabled={
                    !ready || busy || entry.date !== localDate() || !next
                  }
                  onClick={() => {
                    if (next) void save({ ...entry, [next[0]]: nowTime() });
                  }}
                >
                  {next
                    ? `Registrar ${next[1].toLowerCase()}`
                    : "Jornada preenchida"}
                  <Icon kind="arrow" />
                </button>
                <p>Esse botão registra e salva o horário atual.</p>
              </section>
            </aside>
          </div>
        ) : (
          <section className="history">
            <div className="card month-card">
              <div className="section-title">
                <h2>Resumo do mês</h2>
                <Icon kind="calendar" />
              </div>
              <label className="date-label" htmlFor="month">
                Mês de referência
              </label>
              <input
                id="month"
                className="date-input"
                aria-label="Mês do histórico"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
              <div className="totals">
                <div>
                  <span>Dias concluídos</span>
                  <b>{String(finished.length).padStart(2, "0")}</b>
                </div>
                <div>
                  <span>Horas trabalhadas</span>
                  <b>{duration(total)}</b>
                </div>
                <div className="total-balance">
                  <span>Saldo do mês</span>
                  <b className={balance < 0 ? "negative" : ""}>
                    {duration(balance, true)}
                  </b>
                </div>
              </div>
              <p className="history-note">
                O saldo considera apenas os dias concluídos.
              </p>
              <button
                className="secondary export"
                disabled={!selected.length}
                onClick={() => void download()}
              >
                <Icon kind="download" />
                Exportar CSV
              </button>
            </div>
            <div className="record-list">
              <div className="list-title">
                <h2>Registros</h2>
                <span>
                  {selected.length} {selected.length === 1 ? "dia" : "dias"}
                </span>
              </div>
              {!selected.length ? (
                <div className="empty card">
                  <Icon kind="calendar" />
                  <h3>Um registro de cada vez.</h3>
                  <p>Os horários que você salvar aparecem aqui.</p>
                  <button className="secondary" onClick={() => navigate("day")}>
                    Registrar meu dia
                    <Icon kind="arrow" />
                  </button>
                </div>
              ) : (
                selected.map((r) => {
                  const c = calculate(r);
                  return (
                    <article className="record card" key={r.date}>
                      <div className="record-top">
                        <div>
                          <time>{friendly(r.date)}</time>
                          <small>
                            {new Date(r.date + "T12:00:00").toLocaleDateString(
                              "pt-BR",
                              { weekday: "long" },
                            )}
                          </small>
                        </div>
                        <span
                          className={`record-balance ${c.worked !== null && c.worked < r.target ? "negative" : ""}`}
                        >
                          {c.worked === null
                            ? "Em aberto"
                            : duration(c.worked - r.target, true)}
                        </span>
                      </div>
                      <dl>
                        {[
                          ["Entrada", r.start || "—"],
                          ["Saída", r.end || "—"],
                          ["Almoço", `${r.lunch || "—"} → ${r.back || "—"}`],
                          [
                            "Trabalhado",
                            c.worked === null
                              ? "Em aberto"
                              : duration(c.worked),
                          ],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <button
                        className="edit"
                        onClick={() => {
                          if (choose(r.date)) navigate("day");
                        }}
                      >
                        Editar registro
                        <Icon kind="arrow" />
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        )}
        <footer>
          <div>Meu Ponto · versão {version}</div>
          <span className="footer-dot" />
          Seus registros ficam neste aparelho.
          <br />
          Exporte uma cópia antes de desinstalar o aplicativo.
        </footer>
      </main>
    </div>
  );
}
