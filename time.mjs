export const minutes = (v) =>
  v ? Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5)) : null;
export const duration = (v, signed = false) =>
  `${signed ? (v < 0 ? '−' : '+') : ''}${Math.floor(Math.abs(v) / 60)}h ${String(Math.abs(v) % 60).padStart(2, '0')}min`;
export const clock = (v) =>
  `${String(Math.floor(v / 60) % 24).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}${v >= 1440 ? ' (+1 dia)' : ''}`;
export function calculate(e) {
  const s = minutes(e.start),
    l = minutes(e.lunch),
    b = minutes(e.back),
    end = minutes(e.end);
  let error = '';
  if (
    !Number.isInteger(e.target) ||
    e.target < 1 ||
    e.target > 1440 ||
    !Number.isInteger(e.pause) ||
    e.pause < 0 ||
    e.pause > 720
  )
    error = 'Ajuste a jornada (1 a 1440 min) e o almoço (0 a 720 min).';
  if (
    [e.start, e.lunch, e.back, e.end].some(
      (v) => v && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v),
    )
  )
    error = 'Informe horários válidos.';
  if (b !== null && l === null)
    error = 'Informe a saída para o almoço antes da volta.';
  if ((l !== null || b !== null || end !== null) && s === null)
    error = 'Informe a entrada primeiro.';
  const ordered = [s, l, b, end].filter((v) => v !== null);
  if (ordered.some((v, i) => i > 0 && v < ordered[i - 1]))
    error = 'Os horários devem estar em ordem, dentro do mesmo dia.';
  if (end !== null && l !== null && b === null)
    error = 'Informe a volta do almoço para concluir o dia.';
  const worked =
    !error && s !== null && end !== null
      ? end - s - (l !== null && b !== null ? b - l : 0)
      : null;
  return {
    error,
    worked,
    returnAt: l === null ? null : l + e.pause,
    exitAt:
      s === null
        ? null
        : Math.max(
            s + e.target + (l !== null && b !== null ? b - l : e.pause),
            b ?? 0,
          ),
  };
}
