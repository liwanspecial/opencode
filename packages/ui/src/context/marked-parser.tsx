import katex from "katex"
import { Marked, type MarkedExtension, type Tokens } from "marked"
import markedShiki from "marked-shiki"

type ProvenanceLink = Tokens.Link & { markdownLinkCapability?: string }

function escapeAttribute(value: string) {
  return value.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function createMarkdownParser(highlight: (code: string, language: string) => string | Promise<string>) {
  return new Marked(
    {
      renderer: {
        link(token) {
          const { href, title, text } = token
          const target = escapeAttribute(href)
          const titleAttr = title ? ` title="${escapeAttribute(title)}"` : ""
          const capability = (token as ProvenanceLink).markdownLinkCapability
          const capabilityAttr = capability ? ` data-markdown-capability="${escapeAttribute(capability)}"` : ""
          return `<a href="${target}" data-markdown-href="${target}"${capabilityAttr}${titleAttr} class="external-link" target="_blank" rel="noopener noreferrer">${text}</a>`
        },
      },
    },
    katexExtension,
    markedShiki({ highlight }),
  )
}

export async function parseMarkdownWithProvenance(parser: ReturnType<typeof createMarkdownParser>, markdown: string) {
  const linkCapability = crypto.randomUUID()
  const html = await parser.parse(markdown, {
    walkTokens(token) {
      if (token.type !== "link") return
      ;(token as ProvenanceLink).markdownLinkCapability = linkCapability
    },
  })
  return { html, linkCapability }
}

const inlineMathRegex = /^\\\(((?:\\.|[^\\\n])*?)\\\)/
const blockMathRegex = /^\$\$\n([\s\S]+?)\n\$\$(?:\n|$)/

const katexExtension: MarkedExtension = {
  extensions: [
    {
      name: "inlineKatex",
      level: "inline",
      start(src) {
        const index = src.indexOf("\\(")
        if (index === -1) return
        return index
      },
      tokenizer(src) {
        const match = src.match(inlineMathRegex)
        if (!match) return
        return {
          type: "inlineKatex",
          raw: match[0],
          text: match[1].trim(),
          displayMode: false,
        }
      },
      renderer: renderKatexToken,
    },
    {
      name: "blockKatex",
      level: "block",
      tokenizer(src) {
        const match = src.match(blockMathRegex)
        if (!match) return
        return {
          type: "blockKatex",
          raw: match[0],
          text: match[1].trim(),
          displayMode: true,
        }
      },
      renderer: renderKatexToken,
    },
  ],
}

function renderKatexToken(token: Tokens.Generic) {
  return katex.renderToString(typeof token.text === "string" ? token.text : "", {
    displayMode: token.displayMode === true,
    throwOnError: false,
  })
}
