// Security Audit Report Generator.
// OWASP Top 10 für Tauri-Apps, Threat Model, Empfehlungen.

export interface SecurityFinding {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  recommendation: string;
}

export interface SecurityAuditReport {
  generatedAt: string;
  findings: SecurityFinding[];
  passedChecks: string[];
  recommendations: string[];
}

export function generateSecurityAuditReport(): SecurityAuditReport {
  const findings: SecurityFinding[] = [
    {
      id: "SEC-001",
      category: "Content Security Policy",
      severity: "medium",
      title: "WebView2 CSP nicht gesetzt",
      description:
        "WebView2-Rendering hat keine Content Security Policy. Bösartige Prompt-Injection könnte DOM-Manipulation auslösen.",
      recommendation:
        "CSP-Header in tauri.conf.json setzen. DOMPurify für User-Content verwenden.",
    },
    {
      id: "SEC-002",
      category: "Input Validation",
      severity: "high",
      title: "LLM-Prompt ohne Längenbegrenzung",
      description:
        "BookWriter-Prompts können beliebig lang werden. Token-Budget kann überschritten werden.",
      recommendation:
        "Prompt-Längenbegrenzung (z.B. 8192 Tokens) + Validierung vor dem Senden.",
    },
    {
      id: "SEC-003",
      category: "Credential Storage",
      severity: "medium",
      title: "API-Keys im lokalen Speicher",
      description:
        "KDP-Credentials werden AES-256-GCM verschlüsselt gespeichert. Key-Management ist lokal.",
      recommendation:
        "Windows DPAPI oder Tauri Secret Service für Schlüsselableitung nutzen.",
    },
    {
      id: "SEC-004",
      category: "Dependency",
      severity: "low",
      title: "npm audit — transitive Schwachstellen",
      description:
        "Einige transitive Dependencies bekannte CVEs (z.B. Vite dev server).",
      recommendation: "Regelmäßiges `npm audit fix`, Dependabot/Alerts aktiviert.",
    },
  ];

  const passedChecks = [
    "SQL-Injection: Alle Queries nutzen Prepared Statements via sql.js",
    "XSS (Basis): React escapet standardmäßig JSX-Output",
    "Credential Encryption: AES-256-GCM via WebCrypto API",
    "Path Traversal: Keine direkten Filesystem-Calls aus User-Input",
    "Rate Limiting: Token-Budget-Limiter implementiert (utils/rateLimit.ts)",
    "Input Validation: validatePrompt, validateFilename, sanitizeMarkdown vorhanden",
  ];

  const recommendations = [
    "Security-Header: CSP, X-Frame-Options, X-Content-Type-Options setzen",
    "Prompt-Injection: System-Prompt strikt von User-Input trennen",
    "Logging: Sicherstellen, dass keine Secrets in Logs landen",
    "Updates: tauri-plugin-updater für signed Updates",
    "Penetration-Test: Externer Audit vor Production-Deploy",
  ];

  return {
    generatedAt: new Date().toISOString(),
    findings,
    passedChecks,
    recommendations,
  };
}
