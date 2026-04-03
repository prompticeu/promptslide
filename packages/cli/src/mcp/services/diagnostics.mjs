export function createDiagnostic({
  phase = "runtime",
  severity = "error",
  target = null,
  message,
  code,
  path,
  hint,
  detail,
  source,
  timestamp,
} = {}) {
  const diagnostic = {
    phase,
    severity,
    target,
    message: message || "Unknown diagnostic",
  }

  if (code) diagnostic.code = code
  if (path) diagnostic.path = path
  if (hint) diagnostic.hint = hint
  if (detail) diagnostic.detail = detail
  if (source) diagnostic.source = source
  if (timestamp) diagnostic.timestamp = timestamp

  return diagnostic
}

export function diagnosticFromError(error, options = {}) {
  const message = error?.message ? String(error.message) : String(error)
  const detail = options.detail ||
    (error?.stack ? String(error.stack).split("\n").slice(0, 4).join("\n") : undefined)

  return createDiagnostic({
    ...options,
    message,
    detail,
  })
}

export function mergeDiagnostics(...lists) {
  return lists.flat().filter(Boolean)
}

export function groupDiagnosticsByPhase(diagnostics = []) {
  return diagnostics.reduce((groups, diagnostic) => {
    const phase = diagnostic.phase || "runtime"
    if (!groups[phase]) groups[phase] = []
    groups[phase].push(diagnostic)
    return groups
  }, {})
}

export function summarizeDiagnostics(diagnostics = []) {
  const summary = {
    total: diagnostics.length,
    errors: 0,
    warnings: 0,
    info: 0,
  }

  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") summary.errors++
    else if (diagnostic.severity === "warning") summary.warnings++
    else summary.info++
  }

  return summary
}

export function createResult({
  target,
  diagnostics = [],
  runtime,
  data,
  artifact,
} = {}) {
  return {
    ok: diagnostics.every(diagnostic => diagnostic.severity !== "error"),
    target,
    diagnostics,
    phases: groupDiagnosticsByPhase(diagnostics),
    summary: summarizeDiagnostics(diagnostics),
    ...(runtime ? { runtime } : {}),
    ...(data !== undefined ? { data } : {}),
    ...(artifact !== undefined ? { artifact } : {}),
  }
}
