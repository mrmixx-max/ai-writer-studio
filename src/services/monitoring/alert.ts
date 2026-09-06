// Alerting: Budget, Provider, Disk-Space Alerts.
import type { HealthCheckResult } from "./health";

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface AlertRule {
  type: string;
  threshold: number;
  severity: AlertSeverity;
  message: string;
}

export type AlertHandler = (alert: Alert) => void;

const DEFAULT_RULES: AlertRule[] = [
  {
    type: "budget_exceed",
    threshold: 0.8,
    severity: "warning",
    message: "Token-Budget zu 80% aufgebraucht",
  },
  {
    type: "budget_exceed",
    threshold: 0.95,
    severity: "critical",
    message: "Token-Budget zu 95% aufgebraucht",
  },
  {
    type: "provider_down",
    threshold: 1,
    severity: "critical",
    message: "LLM-Provider nicht erreichbar",
  },
  {
    type: "disk_full",
    threshold: 0.9,
    severity: "warning",
    message: "Festplatte zu 90% voll",
  },
];

export class AlertManager {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [...DEFAULT_RULES];
  private handlers: Set<AlertHandler> = new Set();

  addHandler(handler: AlertHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(alert: Alert): void {
    for (const handler of this.handlers) {
      try {
        handler(alert);
      } catch {
        // Handler-Fehler nicht propagieren
      }
    }
  }

  createAlert(
    type: string,
    severity: AlertSeverity,
    message: string
  ): Alert {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      severity,
      type,
      message,
      timestamp: Date.now(),
      acknowledged: false,
    };
    this.alerts.push(alert);
    this.emit(alert);
    return alert;
  }

  acknowledge(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) alert.acknowledged = true;
  }

  getAlerts(includeAcknowledged = false): Alert[] {
    return this.alerts.filter((a) => includeAcknowledged || !a.acknowledged);
  }

  getCriticalAlerts(): Alert[] {
    return this.alerts.filter(
      (a) => a.severity === "critical" && !a.acknowledged
    );
  }

  clear(): void {
    this.alerts = [];
  }

  /** Prüft Budget-Alert basierend auf Verbrauch. */
  checkBudgetAlert(spent: number, limit: number): Alert | null {
    const ratio = spent / limit;
    const rule = this.rules
      .filter((r) => r.type === "budget_exceed")
      .sort((a, b) => b.threshold - a.threshold)
      .find((r) => ratio >= r.threshold);
    if (rule) {
      return this.createAlert(rule.type, rule.severity, rule.message);
    }
    return null;
  }

  /** Prüft Provider-Alert basierend auf Health-Check. */
  checkProviderAlert(health: HealthCheckResult): Alert | null {
    if (health.status === "down") {
      return this.createAlert(
        "provider_down",
        "critical",
        `Provider ${health.name} nicht erreichbar: ${health.message || "Keine Antwort"}`
      );
    }
    return null;
  }

  /** Prüft Disk-Space-Alert. */
  checkDiskAlert(usedBytes: number, totalBytes: number): Alert | null {
    const ratio = usedBytes / totalBytes;
    const rule = this.rules.find(
      (r) => r.type === "disk_full" && ratio >= r.threshold
    );
    if (rule) {
      return this.createAlert(rule.type, rule.severity, rule.message);
    }
    return null;
  }
}

export const alertManager = new AlertManager();
