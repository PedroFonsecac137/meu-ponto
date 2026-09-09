/* eslint-disable react/react-compiler -- One-time hydration of browser-local records after server rendering. */
'use client';

import { useEffect, useState, useMemo } from 'react';
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

type Toast = {
  message: string;
  type: 'success' | 'info' | 'error';
} | null;

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

const punchFields = [
  { key: 'start' as const, label: 'Entrada', icon: '🌅', subtitle: 'Início do expediente' },
  { key: 'lunch' as const, label: 'Saída Almoço', icon: '☕', subtitle: 'Pausa para refeição' },
  { key: 'back' as const, label: 'Retorno Almoço', icon: '🥪', subtitle: 'Fim do intervalo' },
  { key: 'end' as const, label: 'Saída Final', icon: '🏁', subtitle: 'Fim do expediente' },
];

export default function Home() {
  const [entry, setEntry] = useState<Entry>(blank(''));
  const [rows, setRows] = useState<Entry[]>([]);
  const [month, setMonth] = useState('');
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Relógio em tempo real
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-dismiss do Toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearInterval(timer);
  }, [toast]);

  // Carregar dados locais após montagem
  // oxlint-disable-next-line react(react-compiler)
  useEffect(() => {
    async function load() {
      const date = today();
      // oxlint-disable-next-line react(react-compiler)
      setMonth(date.slice(0, 7));
      try {
        const saved = JSON.parse((await readRecords(KEY)) || '{"rows":[]}');
        if (!Array.isArray(saved.rows)) throw new Error();
        setRows(saved.rows);
        setEntry(
          saved.rows.find((r: Entry) => r.date === date) ||
            blank(date, saved.target || 360, saved.pause ?? 60),
        );
      } catch {
        setEntry(blank(date));
        showNotification('Não foi possível carregar registros antigos.', 'error');
      }
      setReady(true);
    }
    void load();
  }, []);

  const result = calculate(entry);

  const selected = useMemo(() => {
    return rows
      .filter((r) => r.date.startsWith(month))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [rows, month]);

  const completed = useMemo(() => {
    return selected.filter((r) => calculate(r).worked !== null);
  }, [selected]);

  const totalWorkedMinutes = useMemo(() => {
    return completed.reduce((s, r) => s + (calculate(r).worked || 0), 0);
  }, [completed]);

  const monthBalanceMinutes = useMemo(() => {
    return completed.reduce((s, r) => s + ((calculate(r).worked || 0) - r.target), 0);
  }, [completed]);

  function showNotification(message: string, type: 'success' | 'info' | 'error' = 'success') {
    setToast({ message, type });
  }

  function update(key: keyof Entry, value: string | number) {
    setEntry((prev) => ({ ...prev, [key]: value }));
  }

  function choose(date: string) {
    const existing = rows.find((r) => r.date === date);
    setEntry(existing || blank(date, entry.target, entry.pause));
    showNotification(`Visualizando registro de ${formatDateFriendly(date)}`, 'info');
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
      showNotification('Erro ao salvar. Verifique as permissões de armazenamento.', 'error');
      return false;
    }
  }

  async function saveCurrent() {
    if (result.error || !entry.date || !entry.start) {
      showNotification(result.error || 'Informe ao menos a data e o horário de entrada.', 'error');
      return;
    }
    const updated = [...rows.filter((r) => r.date !== entry.date), entry];
    if (await persist(updated)) {
      showNotification('Registro salvo com sucesso!', 'success');
    }
  }

  async function removeCurrent() {
    if (!confirm(`Excluir o registro de ${formatDateFriendly(entry.date)}?`)) return;
    const filtered = rows.filter((r) => r.date !== entry.date);
    if (await persist(filtered)) {
      setEntry(blank(entry.date, entry.target, entry.pause));
      showNotification('Registro excluído com sucesso.', 'info');
    }
  }

  // Identificar próximo campo a bater
  const nextPunch = useMemo(() => {
    if (!entry.start) return punchFields[0];
    if (!entry.lunch) return punchFields[1];
    if (!entry.back) return punchFields[2];
    if (!entry.end) return punchFields[3];
    return null;
  }, [entry]);

  function handleQuickPunch() {
    const d = new Date();
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    if (nextPunch) {
      const updatedEntry = { ...entry, [nextPunch.key]: timeStr };
      setEntry(updatedEntry);

      // Auto-salvar se for válido
      const nextResult = calculate(updatedEntry);
      if (!nextResult.error && updatedEntry.start) {
        const nextRows = [...rows.filter((r) => r.date !== updatedEntry.date), updatedEntry];
        void persist(nextRows);
        showNotification(`${nextPunch.label} registrada às ${timeStr}!`, 'success');
      } else {
        showNotification(`${nextPunch.label} marcada: ${timeStr}. Lembre-se de salvar.`, 'info');
      }
    } else {
      showNotification('Todos os 4 horários do dia já estão registrados!', 'info');
    }
  }

  function handleSetNow(key: 'start' | 'lunch' | 'back' | 'end') {
    const d = new Date();
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    update(key, timeStr);
  }

  async function handleExportCsv() {
    const lines = [
      ['Data', 'Entrada', 'Saída Almoço', 'Volta Almoço', 'Saída', 'Meta (min)', 'Trabalhado (min)', 'Saldo (min)'],
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
    try {
      await exportCsv(`meu-ponto-${month}.csv`, lines);
      showNotification('Relatório CSV pronto para compartilhar!', 'success');
    } catch {
      showNotification('Erro ao exportar arquivo CSV.', 'error');
    }
  }

  function changeMonth(delta: number) {
    if (!month) return;
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Formatação de data amigável
  function formatDateFriendly(dateStr: string) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  function formatDateHeading(dateStr: string) {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch {
      return dateStr;
    }
  }

  // Progresso do dia
  const progressPercent = useMemo(() => {
    if (!result.worked || entry.target <= 0) return 0;
    return Math.min(100, Math.round((result.worked / entry.target) * 100));
  }, [result.worked, entry.target]);

  return (
    <>
      {/* Toast Notification Flutuante */}
      {toast && (
        <aside className={`toast-container toast-${toast.type}`} role="status" aria-live="polite">
          <div className="toast-body">
            <span className="toast-icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'info' && 'ℹ'}
              {toast.type === 'error' && '⚠'}
            </span>
            <span className="toast-msg">{toast.message}</span>
          </div>
        </aside>
      )}

      {/* Header Superior Mobile */}
      <header className="mobile-header">
        <div className="header-brand">
          <div className="brand-logo-wrap">
            <img src="./logo.svg" width="38" height="38" alt="Logo Meu Ponto" />
          </div>
          <div>
            <h1 className="brand-title">Meu Ponto</h1>
            <p className="brand-subtitle">Controle Pessoal de Jornada</p>
          </div>
        </div>

        <div className="header-meta">
          <span className="badge-offline">
            <span className="pulse-dot"></span> 100% Offline
          </span>
        </div>
      </header>

      <main className="container">
        {/* Widget Hero com Relógio em Tempo Real e Batida Rápida */}
        <section className="hero-punch-card">
          <div className="hero-top-row">
            <div className="hero-clock-box">
              <span className="clock-label">HORÁRIO ATUAL</span>
              <span className="clock-time">{currentTime || '--:--:--'}</span>
            </div>
            <div className="hero-date-box">
              <span className="date-day">{formatDateHeading(entry.date || today())}</span>
              <div className="hero-target-pill">
                Meta: <b>{duration(entry.target)}</b> • Almoço: <b>{duration(entry.pause)}</b>
              </div>
            </div>
          </div>

          {/* Botão Hero de Batida Inteligente */}
          <div className="hero-action-area">
            {nextPunch ? (
              <button
                className="btn-quick-punch"
                onClick={handleQuickPunch}
                disabled={!ready || (entry.date && entry.date !== today())}
              >
                <div className="quick-punch-icon-glow">
                  <span className="quick-punch-icon">{nextPunch.icon}</span>
                </div>
                <div className="quick-punch-text">
                  <span className="quick-punch-title">Bater {nextPunch.label}</span>
                  <span className="quick-punch-hint">Toque para registrar o horário de agora</span>
                </div>
                <span className="quick-punch-arrow">➔</span>
              </button>
            ) : (
              <div className="hero-completed-banner">
                <span className="banner-check">✓</span>
                <div>
                  <strong>Jornada Completa!</strong>
                  <p>Todos os 4 horários do dia foram preenchidos.</p>
                </div>
              </div>
            )}
          </div>

          {/* Barra de Progresso do Dia */}
          {result.worked !== null && (
            <div className="day-progress-wrapper">
              <div className="progress-labels">
                <span>Progresso da Meta ({duration(result.worked)} de {duration(entry.target)})</span>
                <b>{progressPercent}%</b>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          )}
        </section>

        {/* Formulário Interativo de Batidas */}
        <section className="card form-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Horários do Dia</h2>
              <p className="panel-desc">Selecione ou confirme cada marcação</p>
            </div>
            <div className="date-picker-wrap">
              <input
                type="date"
                className="input-date"
                aria-label="Data do registro"
                value={entry.date}
                onChange={(e) => choose(e.target.value)}
              />
            </div>
          </div>

          {/* Grid dos 4 Cards de Ponto (2x2 no mobile) */}
          <div className="punch-grid">
            {punchFields.map(({ key, label, icon, subtitle }) => {
              const isFilled = Boolean(entry[key]);
              return (
                <div key={key} className={`punch-card ${isFilled ? 'is-filled' : 'is-pending'}`}>
                  <div className="punch-card-header">
                    <div className="punch-label-group">
                      <span className="punch-icon">{icon}</span>
                      <div>
                        <span className="punch-title">{label}</span>
                        <span className="punch-sub">{subtitle}</span>
                      </div>
                    </div>
                    {isFilled ? (
                      <span className="punch-status-badge filled">Feito</span>
                    ) : (
                      <span className="punch-status-badge pending">Aberto</span>
                    )}
                  </div>

                  <div className="punch-input-row">
                    <input
                      type="time"
                      className="punch-time-input"
                      aria-label={label}
                      value={entry[key]}
                      onChange={(e) => update(key, e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-now-chip"
                      disabled={!ready || entry.date !== today()}
                      onClick={() => handleSetNow(key)}
                      title="Preencher com horário atual"
                    >
                      Agora
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ajuste de Jornada e Intervalo (Gaveta Retrátil) */}
          <div className="settings-accordion">
            <button
              type="button"
              className="accordion-toggle"
              onClick={() => setShowSettings(!showSettings)}
            >
              <span>⚙ Ajustar Meta da Jornada e Intervalo</span>
              <span className={`chevron ${showSettings ? 'open' : ''}`}>▼</span>
            </button>

            {showSettings && (
              <div className="settings-drawer">
                <div className="settings-grid">
                  <div className="setting-box">
                    <label>Jornada Diária (Meta)</label>
                    <div className="preset-buttons">
                      <button
                        type="button"
                        className={entry.target === 360 ? 'active' : ''}
                        onClick={() => update('target', 360)}
                      >
                        6h (Estágio)
                      </button>
                      <button
                        type="button"
                        className={entry.target === 480 ? 'active' : ''}
                        onClick={() => update('target', 480)}
                      >
                        8h (CLT)
                      </button>
                    </div>
                    <div className="setting-input-wrap">
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={entry.target}
                        onChange={(e) => update('target', Number(e.target.value))}
                      />
                      <span>minutos ({duration(entry.target)})</span>
                    </div>
                  </div>

                  <div className="setting-box">
                    <label>Intervalo de Almoço Padrão</label>
                    <div className="preset-buttons">
                      <button
                        type="button"
                        className={entry.pause === 60 ? 'active' : ''}
                        onClick={() => update('pause', 60)}
                      >
                        1h
                      </button>
                      <button
                        type="button"
                        className={entry.pause === 30 ? 'active' : ''}
                        onClick={() => update('pause', 30)}
                      >
                        30m
                      </button>
                      <button
                        type="button"
                        className={entry.pause === 15 ? 'active' : ''}
                        onClick={() => update('pause', 15)}
                      >
                        15m
                      </button>
                    </div>
                    <div className="setting-input-wrap">
                      <input
                        type="number"
                        min="0"
                        max="720"
                        value={entry.pause}
                        onChange={(e) => update('pause', Number(e.target.value))}
                      />
                      <span>minutos ({duration(entry.pause)})</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé de Ações do Formulário */}
          <div className="form-actions-bar">
            <button
              type="button"
              className="btn-primary"
              disabled={!ready}
              onClick={saveCurrent}
            >
              💾 Salvar Registro do Dia
            </button>

            {rows.some((r) => r.date === entry.date) && (
              <button
                type="button"
                className="btn-danger-outline"
                onClick={removeCurrent}
              >
                🗑 Excluir Dia
              </button>
            )}
          </div>

          {result.error && (
            <div className="form-error-alert" role="alert">
              <span>⚠</span> {result.error}
            </div>
          )}
        </section>

        {/* Cards de Previsão Inteligente */}
        <section className="forecast-container">
          <div className="forecast-card return-card">
            <div className="card-pill">PAUSA ALMOÇO</div>
            <div className="card-metric-row">
              <span className="card-big-time">
                {!result.error && result.returnAt !== null ? clock(result.returnAt) : '--:--'}
              </span>
              <span className="card-icon-big">☕</span>
            </div>
            <strong className="card-title">Retorno Previsto</strong>
            <p className="card-explanation">
              {entry.lunch
                ? `Saindo às ${entry.lunch} com ${duration(entry.pause)} de almoço.`
                : 'Informe a saída para o almoço para calcular o retorno exato.'}
            </p>
          </div>

          <div className="forecast-card exit-card">
            <div className="card-pill">EXPEDIENTE</div>
            <div className="card-metric-row">
              <span className="card-big-time">
                {!result.error && result.exitAt !== null ? clock(result.exitAt) : '--:--'}
              </span>
              <span className="card-icon-big">🏁</span>
            </div>
            <strong className="card-title">Saída Prevista</strong>
            <p className="card-explanation">
              Para completar {duration(entry.target)} de trabalho.{' '}
              {entry.back ? 'Calculado com seu almoço real.' : 'Calculado com o intervalo planejado.'}
            </p>
          </div>

          <div className="forecast-card balance-card">
            <div className="card-pill">BANCO DO DIA</div>
            <div className="card-metric-row">
              <span className={`card-big-time ${result.worked !== null && result.worked >= entry.target ? 'positive' : 'neutral'}`}>
                {!result.error && result.worked !== null
                  ? duration(result.worked - entry.target, true)
                  : 'Em aberto'}
              </span>
              <span className="card-icon-big">⚖</span>
            </div>
            <strong className="card-title">Saldo Hoje</strong>
            <p className="card-explanation">
              {result.worked !== null
                ? `${duration(result.worked)} trabalhadas no expediente.`
                : 'Preencha a saída final para fechar o saldo.'}
            </p>
          </div>
        </section>

        {/* Histórico e Estatísticas Mensais */}
        <section className="card history-panel">
          <div className="history-header">
            <div>
              <h2 className="panel-title">Histórico de Registros</h2>
              <p className="panel-desc">Acompanhamento mensal com cálculo de banco de horas</p>
            </div>

            <div className="history-controls">
              <div className="month-stepper">
                <button type="button" className="btn-step" onClick={() => changeMonth(-1)} aria-label="Mês anterior">◀</button>
                <input
                  type="month"
                  className="input-month"
                  aria-label="Mês do histórico"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
                <button type="button" className="btn-step" onClick={() => changeMonth(1)} aria-label="Próximo mês">▶</button>
              </div>

              <button
                type="button"
                className="btn-export"
                disabled={!selected.length}
                onClick={handleExportCsv}
              >
                📥 Exportar CSV
              </button>
            </div>
          </div>

          {/* Cards de Métricas Mensais (KPIs) */}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">DIAS CONCLUÍDOS</span>
              <b className="stat-value">{String(completed.length).padStart(2, '0')}</b>
              <span className="stat-sub">no mês de {month}</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">TOTAL TRABALHADO</span>
              <b className="stat-value">{duration(totalWorkedMinutes)}</b>
              <span className="stat-sub">horas efetivas</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">SALDO ACUMULADO</span>
              <b className={`stat-value ${monthBalanceMinutes < 0 ? 'negative' : 'positive'}`}>
                {duration(monthBalanceMinutes, true)}
              </b>
              <span className="stat-sub">
                {monthBalanceMinutes >= 0 ? 'Banco de horas positivo' : 'Horas a compensar'}
              </span>
            </div>
          </div>

          {/* Lista Mobile de Cards do Histórico (Exibida em telas < 640px) */}
          <div className="mobile-record-list">
            {selected.map((r) => {
              const c = calculate(r);
              const isDone = c.worked !== null;
              const dayBalance = isDone ? c.worked! - r.target : null;

              return (
                <article key={r.date} className="record-card">
                  <div className="record-card-top">
                    <div>
                      <strong className="record-date">{formatDateFriendly(r.date)}</strong>
                      <span className="record-weekday">{formatDateHeading(r.date).split(',')[0]}</span>
                    </div>

                    <div className="record-balance-badge">
                      {isDone ? (
                        <span className={`badge-balance ${dayBalance! >= 0 ? 'pos' : 'neg'}`}>
                          {duration(dayBalance!, true)}
                        </span>
                      ) : (
                        <span className="badge-balance open">Em aberto</span>
                      )}
                    </div>
                  </div>

                  <div className="record-punches-row">
                    <div className="punch-item">
                      <span className="punch-mini-label">Entrada</span>
                      <b>{r.start || '--:--'}</b>
                    </div>
                    <div className="punch-item">
                      <span className="punch-mini-label">Almoço</span>
                      <b>{r.lunch && r.back ? `${r.lunch} - ${r.back}` : r.lunch || '--:--'}</b>
                    </div>
                    <div className="punch-item">
                      <span className="punch-mini-label">Saída</span>
                      <b>{r.end || '--:--'}</b>
                    </div>
                    <div className="punch-item">
                      <span className="punch-mini-label">Total</span>
                      <b>{isDone ? duration(c.worked!) : '--:--'}</b>
                    </div>
                  </div>

                  <div className="record-card-footer">
                    <button
                      type="button"
                      className="btn-edit-record"
                      onClick={() => {
                        choose(r.date);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      ✏ Editar Registro
                    </button>
                  </div>
                </article>
              );
            })}

            {!selected.length && (
              <div className="empty-state">
                <span className="empty-icon">📅</span>
                <strong className="empty-title">Nenhum registro para este mês</strong>
                <p className="empty-desc">
                  Utilize o botão &ldquo;Bater Ponto Agora&rdquo; acima para iniciar o acompanhamento de {month}.
                </p>
              </div>
            )}
          </div>

          {/* Tabela Tradicional (Visível em Telas Maiores / Tablets) */}
          <div className="desktop-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Entrada</th>
                  <th>Almoço</th>
                  <th>Saída</th>
                  <th>Trabalhado</th>
                  <th>Saldo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((r) => {
                  const c = calculate(r);
                  const isDone = c.worked !== null;
                  const dayBalance = isDone ? c.worked! - r.target : null;

                  return (
                    <tr key={r.date}>
                      <td><b>{formatDateFriendly(r.date)}</b></td>
                      <td>{r.start || '—'}</td>
                      <td>{r.lunch && r.back ? `${r.lunch} às ${r.back}` : r.lunch || '—'}</td>
                      <td>{r.end || '—'}</td>
                      <td>{isDone ? duration(c.worked!) : 'Em aberto'}</td>
                      <td className={isDone && dayBalance! < 0 ? 'text-negative' : 'text-positive'}>
                        {isDone ? duration(dayBalance!, true) : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-edit-link"
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
          </div>
        </section>

        {/* Rodapé do App */}
        <footer className="app-footer">
          <p>
            Meu Ponto • Dados armazenados com segurança local no dispositivo.
          </p>
          <span>Exporte periodicamente o arquivo CSV para guardar cópias no Google Drive ou WhatsApp.</span>
        </footer>
      </main>
    </>
  );
}
