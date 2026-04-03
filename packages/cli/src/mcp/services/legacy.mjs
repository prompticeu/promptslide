export function withLegacyNotice(payload, { tool, preferred, note } = {}) {
  return {
    ...payload,
    deprecated: true,
    ...(tool ? { legacyTool: tool } : {}),
    ...(preferred ? { preferredWorkflow: preferred } : {}),
    ...(note ? { deprecationNote: note } : {}),
  }
}
