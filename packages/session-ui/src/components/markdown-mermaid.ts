export function isMermaidLanguage(language: string | undefined) {
  return language?.toLowerCase() === "mermaid"
}

const mermaidStarts = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "journey",
  "gantt",
  "pie",
  "quadrantChart",
  "requirementDiagram",
  "gitGraph",
  "mindmap",
  "timeline",
  "zenuml",
  "sankey-beta",
  "xychart-beta",
  "block-beta",
  "packet-beta",
]

export function isMermaidBlock(language: string | undefined, source: string) {
  if (isMermaidLanguage(language)) return true
  if (language) return false
  const first = source.trimStart().split(/\r?\n/, 1)[0]?.trim()
  return !!first && mermaidStarts.some((start) => first === start || first.startsWith(`${start} `))
}
