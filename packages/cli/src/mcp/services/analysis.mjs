import { createDiagnostic } from "./diagnostics.mjs"

const STEP_REGEX = /step=\{(\d+)\}/g
const GROUP_STEP_REGEX = /startStep=\{(\d+)\}/g
const META_STEPS_REGEX = /export\s+const\s+meta\s*=\s*\{[\s\S]*?\bsteps\s*:\s*(\d+)/m
const IMPORT_REGEX = /import\s+.*?\s+from\s+["']([^"']+)["']/g

function getMaxMatch(content, regex) {
  let max = 0
  for (const match of content.matchAll(regex)) {
    const value = parseInt(match[1], 10)
    if (!Number.isNaN(value) && value > max) max = value
  }
  return max
}

export function extractDeclaredMetaSteps(content) {
  const match = content.match(META_STEPS_REGEX)
  if (!match) return null

  const value = parseInt(match[1], 10)
  return Number.isNaN(value) ? null : value
}

export function inspectSourceImports(content) {
  return [...content.matchAll(IMPORT_REGEX)].map(match => match[1])
}

export function analyzeStepMetadata(content, { path, target } = {}) {
  const animatedSteps = getMaxMatch(content, STEP_REGEX)
  const groupSteps = getMaxMatch(content, GROUP_STEP_REGEX)
  const inferredSteps = Math.max(animatedSteps, groupSteps)
  const declaredSteps = extractDeclaredMetaSteps(content)
  const diagnostics = []

  if (inferredSteps > 0 && declaredSteps == null) {
    diagnostics.push(createDiagnostic({
      phase: "static",
      severity: "warning",
      target,
      path,
      code: "meta.steps.missing",
      message: `Slide uses animation steps up to ${inferredSteps} but does not declare meta.steps.`,
      hint: "Add `export const meta = { steps: N }` so navigation and exports match the slide behavior.",
    }))
  }

  if (declaredSteps != null && inferredSteps > 0 && declaredSteps !== inferredSteps) {
    diagnostics.push(createDiagnostic({
      phase: "static",
      severity: "warning",
      target,
      path,
      code: "meta.steps.mismatch",
      message: `meta.steps declares ${declaredSteps}, but analyzed animation usage reaches ${inferredSteps}.`,
      hint: "Update meta.steps or adjust Animated / AnimatedGroup usage so both match.",
    }))
  }

  return {
    declaredSteps,
    inferredSteps,
    diagnostics,
    imports: inspectSourceImports(content),
  }
}

export function getEffectiveStepCount(content) {
  const { declaredSteps, inferredSteps } = analyzeStepMetadata(content)
  return declaredSteps ?? inferredSteps ?? 0
}
