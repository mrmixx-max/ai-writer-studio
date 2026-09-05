// Minimale Handlebars-kompatible Template-Engine für die Prompt-Library
// (Sprint 6, Agent 2).
//
// Bewusst OHNE handlebars-Dependency — dieselbe Konvention wie die
// Mini-YAML-Parsers in styleProfiles.ts (Sprint 2): Das Desktop-Produkt
// hält die Abhängigkeitsfläche klein. Unterstützt wird die für Prompts
// nötige Teilmenge:
//
//   {{name}} / {{pfad.zum.wert}}   Variablen-Substitution
//   {{this}}                        aktuelle Iteration in {{#each}}
//   {{@index}} {{@first}} {{@last}} Iterations-Metadaten (0-basiert)
//   {{#if cond}}...{{else}}...{{/if}}
//   {{#unless cond}}...{{/unless}}
//   {{#each liste}}...{{/each}}
//
// Bewusste Abweichung von Handlebars: {{name}} rendert ROH (kein
// HTML-Escaping). Prompts sind Klartext — HTML-Entities würden deutsche
// Anführungszeichen und Titel verfälschen und die Byte-Identität mit den
// bisherigen Hardcoded-Prompts brechen.
//
// Fehlende Variablen rendern als leerer String (Handlebars-Verhalten).
// Truthiness in {{#if}} folgt Handlebars: false, null, undefined, "" und
// leere Arrays sind falsy; 0 und "0" sind truthy.
//
// Reine Logik, vollständig testbar, keine IO.

/** Variablen-Kontext für renderTemplate. */
export type TemplateVars = Record<string, unknown>;

interface TextNode {
  type: "text";
  value: string;
}
interface VarNode {
  type: "var";
  path: string;
}
interface IfNode {
  type: "if";
  cond: string;
  body: TemplateNode[];
  inverse: TemplateNode[];
}
interface UnlessNode {
  type: "unless";
  cond: string;
  body: TemplateNode[];
}
interface EachNode {
  type: "each";
  list: string;
  body: TemplateNode[];
}

type TemplateNode = TextNode | VarNode | IfNode | UnlessNode | EachNode;

/** Handlebars-Truthiness: false/null/undefined/""/[] sind falsy, 0 ist truthy. */
export function isTruthy(value: unknown): boolean {
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === "string" && value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/** Token: Text oder Mustachio-Ausdruck (raw = {{{...}}}). */
interface Token {
  text: string;
  content: string | null;
  raw: boolean;
}

function tokenize(src: string): Token[] {
  const re = /\{\{\{([\s\S]+?)\}\}\}|\{\{([\s\S]+?)\}\}/g;
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) tokens.push({ text: src.slice(last, m.index), content: null, raw: false });
    const raw = m[1] !== undefined;
    tokens.push({ text: "", content: (raw ? m[1] : m[2]).trim(), raw });
    last = m.index + m[0].length;
  }
  if (last < src.length) tokens.push({ text: src.slice(last), content: null, raw: false });
  return tokens;
}

function parseNodes(tokens: Token[], start: number, stopAt: string[] | null): {
  nodes: TemplateNode[];
  next: number;
  closedWith: string | null;
} {
  const nodes: TemplateNode[] = [];
  let i = start;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.content === null) {
      nodes.push({ type: "text", value: t.text });
      i++;
      continue;
    }
    const content = t.content;
    if (stopAt !== null && stopAt.includes(content)) {
      return { nodes, next: i + 1, closedWith: content };
    }
    if (content.startsWith("#if ")) {
      const inner = parseNodes(tokens, i + 1, ["else", "/if"]);
      if (inner.closedWith === null) {
        throw new Error("Template-Fehler: {{#if}} ohne {{/if}}.");
      }
      let inverse: TemplateNode[] = [];
      let afterIf = inner.next;
      if (inner.closedWith === "else") {
        const inv = parseNodes(tokens, afterIf, ["/if"]);
        if (inv.closedWith === null) {
          throw new Error("Template-Fehler: {{else}} ohne {{/if}}.");
        }
        inverse = inv.nodes;
        afterIf = inv.next;
      }
      nodes.push({ type: "if", cond: content.slice(4).trim(), body: inner.nodes, inverse });
      i = afterIf;
      continue;
    }
    if (content.startsWith("#unless ")) {
      const inner = parseNodes(tokens, i + 1, ["/unless"]);
      if (inner.closedWith === null) {
        throw new Error("Template-Fehler: {{#unless}} ohne {{/unless}}.");
      }
      nodes.push({ type: "unless", cond: content.slice(8).trim(), body: inner.nodes });
      i = inner.next;
      continue;
    }
    if (content.startsWith("#each ")) {
      const inner = parseNodes(tokens, i + 1, ["/each"]);
      if (inner.closedWith === null) {
        throw new Error("Template-Fehler: {{#each}} ohne {{/each}}.");
      }
      nodes.push({ type: "each", list: content.slice(6).trim(), body: inner.nodes });
      i = inner.next;
      continue;
    }
    if (content.startsWith("/") || content === "else") {
      throw new Error(`Template-Fehler: unerwarteter Blockausdruck {{${content}}}.`);
    }
    nodes.push({ type: "var", path: content });
    i++;
  }
  if (stopAt !== null) {
    throw new Error("Template-Fehler: Block nicht geschlossen.");
  }
  return { nodes, next: i, closedWith: null };
}

/** Scope-Kette: innerster Scope zuerst. */
interface Scope {
  vars: TemplateVars;
  value?: unknown;
  index?: number;
  /** 1-basierte Iterationsnummer (Handlebars-Erweiterung @index1). */
  index1?: number;
  first?: boolean;
  last?: boolean;
}

function resolvePath(path: string, scopes: Scope[]): unknown {
  if (path === "this") {
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].value !== undefined) return scopes[i].value;
    }
    return undefined;
  }
  if (path === "@index" || path === "@index1" || path === "@first" || path === "@last") {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const s = scopes[i];
      if (s.index !== undefined) {
        if (path === "@index") return s.index;
        if (path === "@index1") return s.index1;
        if (path === "@first") return s.first;
        return s.last;
      }
    }
    return undefined;
  }
  const segments = path.split(".");
  const head = segments[0];
  let current: unknown;
  let found = false;
  for (let i = scopes.length - 1; i >= 0; i--) {
    if (head in scopes[i].vars) {
      current = scopes[i].vars[head];
      found = true;
      break;
    }
  }
  if (!found) return undefined;
  for (let k = 1; k < segments.length; k++) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[segments[k]];
  }
  return current;
}

function renderNodes(nodes: TemplateNode[], scopes: Scope[]): string {
  let out = "";
  for (const node of nodes) {
    if (node.type === "text") {
      out += node.value;
    } else if (node.type === "var") {
      const v = resolvePath(node.path, scopes);
      out += v === null || v === undefined ? "" : String(v);
    } else if (node.type === "if") {
      out += isTruthy(resolvePath(node.cond, scopes))
        ? renderNodes(node.body, scopes)
        : renderNodes(node.inverse, scopes);
    } else if (node.type === "unless") {
      if (!isTruthy(resolvePath(node.cond, scopes))) {
        out += renderNodes(node.body, scopes);
      }
    } else {
      const list = resolvePath(node.list, scopes);
      if (Array.isArray(list)) {
        list.forEach((item, idx) => {
          scopes.push({
            vars: {},
            value: item,
            index: idx,
            index1: idx + 1,
            first: idx === 0,
            last: idx === list.length - 1,
          });
          out += renderNodes(node.body, scopes);
          scopes.pop();
        });
      }
    }
  }
  return out;
}

/**
 * Rendert ein Handlebars-Template mit dem gegebenen Variablen-Kontext.
 * Siehe Dateikopf für die unterstützte Syntax und die bewussten
 * Abweichungen (rohe Substitution statt HTML-Escaping).
 */
export function renderTemplate(tpl: string, vars: TemplateVars = {}): string {
  const tokens = tokenize(tpl);
  const { nodes } = parseNodes(tokens, 0, null);
  return renderNodes(nodes, [{ vars }]);
}
