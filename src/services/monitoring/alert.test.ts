// Tests: Alerting, Monitoring, Graceful Shutdown.
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AlertManager, alertManager } from "./alert";
import type { HealthCheckResult } from "./health";

describe("AlertManager", () => {
  let manager: AlertManager;

  beforeEach(() => {
    manager = new AlertManager();
  });

  it("erstellt einen Alert mit eindeutiger ID", () => {
    const alert = manager.createAlert("test", "warning", "Test-Nachricht");
    expect(alert.id).toMatch(/^alert-/);
    expect(alert.severity).toBe("warning");
    expect(alert.message).toBe("Test-Nachricht");
    expect(alert.acknowledged).toBe(false);
  });

  it("Handler werden bei Alert-Ausgelöst", () => {
    const handler = vi.fn();
    manager.addHandler(handler);
    manager.createAlert("test", "critical", "Fehler!");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("acknowested markiert Alert als gelesen", () => {
    const alert = manager.createAlert("test", "info", "Info");
    manager.acknowledge(alert.id);
    expect(manager.getAlerts()).toHaveLength(0);
    expect(manager.getAlerts(true)).toHaveLength(1);
  });

  it("getCriticalAlerts liefert nur unbestätigte Kritische", () => {
    manager.createAlert("a", "critical", "Kritisch 1");
    manager.createAlert("b", "critical", "Kritisch 2");
    manager.createAlert("c", "warning", "Warnung");
    expect(manager.getCriticalAlerts()).toHaveLength(2);
    manager.acknowledge(manager.getCriticalAlerts()[0].id);
    expect(manager.getCriticalAlerts()).toHaveLength(1);
  });

  it("checkBudgetAlert löst bei 80% Warnung aus", () => {
    const alert = manager.checkBudgetAlert(80, 100);
    expect(alert).not.toBeNull();
    expect(alert?.severity).toBe("warning");
  });

  it("checkBudgetAlert löst bei 95% Kritisch aus", () => {
    const alert = manager.checkBudgetAlert(95, 100);
    expect(alert).not.toBeNull();
    expect(alert?.severity).toBe("critical");
  });

  it("checkBudgetAlert löst unter 80% nicht aus", () => {
    const alert = manager.checkBudgetAlert(50, 100);
    expect(alert).toBeNull();
  });

  it("checkProviderAlert löst bei down aus", () => {
    const health: HealthCheckResult = {
      name: "ollama",
      status: "down",
      responseTimeMs: 0,
      message: "Connection refused",
    };
    const alert = manager.checkProviderAlert(health);
    expect(alert).not.toBeNull();
    expect(alert?.severity).toBe("critical");
  });

  it("checkProviderAlert löst bei ok nicht aus", () => {
    const health: HealthCheckResult = {
      name: "ollama",
      status: "ok",
      responseTimeMs: 12,
    };
    const alert = manager.checkProviderAlert(health);
    expect(alert).toBeNull();
  });

  it("checkDiskAlert löst bei 90% aus", () => {
    const alert = manager.checkDiskAlert(900, 1000);
    expect(alert).not.toBeNull();
    expect(alert?.severity).toBe("warning");
  });

  it("clear() entfernt alle Alerts", () => {
    manager.createAlert("a", "critical", "Test");
    manager.createAlert("b", "warning", "Test");
    expect(manager.getAlerts(true)).toHaveLength(2);
    manager.clear();
    expect(manager.getAlerts(true)).toHaveLength(0);
  });
});

describe("alertManager (Singleton)", () => {
  afterEach(() => {
    alertManager.clear();
  });

  it("exportiert Singleton-Instanz", () => {
    expect(alertManager).toBeInstanceOf(AlertManager);
  });
});

describe("AlertManager (Sprint 8 — Edge-Cases)", () => {
  let manager: AlertManager;

  beforeEach(() => {
    manager = new AlertManager();
  });

  it("unsubscribe stoppt Handler-Benachrichtigungen", () => {
    const handler = vi.fn();
    const unsubscribe = manager.addHandler(handler);
    manager.createAlert("a", "info", "eins");
    unsubscribe();
    manager.createAlert("b", "info", "zwei");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("acknowledge unbekannter ID wirft nicht", () => {
    expect(() => manager.acknowledge("gibt-es-nicht")).not.toThrow();
  });

  it("checkProviderAlert löst bei degraded nicht aus", () => {
    const health: HealthCheckResult = {
      name: "ollama",
      status: "degraded",
      responseTimeMs: 500,
      message: "HTTP 500",
    };
    expect(manager.checkProviderAlert(health)).toBeNull();
  });

  it("Alert-IDs sind eindeutig", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () =>
        manager.createAlert("x", "info", "msg"),
      ).map((a) => a.id),
    );
    expect(ids.size).toBe(50);
  });

  it("werfender Handler blockiert weder Alert noch andere Handler", () => {
    const good = vi.fn();
    manager.addHandler(() => {
      throw new Error("handler boom");
    });
    manager.addHandler(good);
    const alert = manager.createAlert("x", "warning", "trotz Fehler");
    expect(alert.type).toBe("x");
    expect(good).toHaveBeenCalledTimes(1);
  });
});
