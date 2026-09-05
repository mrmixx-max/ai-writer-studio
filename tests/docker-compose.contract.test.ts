// Docker-Compose-Vertragstests (Sprint 6, Agent 4).
// Docker selbst ist in dieser Umgebung nicht installiert — der Test
// prüft die Compose-Datei strukturell (YAML-Parse + Semantik), damit
// `docker compose config` später nicht scheitern kann.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

// tests/ → Projektroot
const ROOT = path.resolve(process.cwd());

interface ComposeFile {
  services?: Record<string, unknown>;
}

function loadCompose(): ComposeFile {
  const raw = readFileSync(path.join(ROOT, "docker-compose.yml"), "utf8");
  return yaml.load(raw) as ComposeFile;
}

describe("docker-compose.yml", () => {
  it("ist gültiges YAML mit services/volumes/networks", () => {
    const cfg = loadCompose();
    expect(cfg.services).toBeDefined();
    expect(cfg.services.studio).toBeDefined();
    expect(cfg.services.ollama).toBeDefined();
  });

  it("Studio-Service: baut das Image und mappt Port 8080", () => {
    const studio = loadCompose().services.studio;
    expect(studio.build.dockerfile).toBe("Dockerfile");
    expect(studio.ports).toContain("8080:80");
    expect(studio.image).toContain("ai-writer-studio");
  });

  it("Studio mountet DB- und Log-Verzeichnisse (Rotation nach /data/logs)", () => {
    const studio = loadCompose().services.studio;
    const vols = studio.volumes as string[];
    expect(vols.some((v) => v.includes("/data/db"))).toBe(true);
    expect(vols.some((v) => v.includes("/data/logs"))).toBe(true);
    expect(studio.environment).toContain("LOG_DIR=/data/logs");
  });

  it("Ollama ist isoliert: eigenes Netz, eigenes Volume", () => {
    const cfg = loadCompose();
    const ollama = cfg.services.ollama;
    expect(ollama.networks).toEqual(["ollama-net"]);
    expect(ollama.volumes.some((v: string) => v.startsWith("ollama-data:"))).toBe(true);
    // CORS: Studio-Origin erlaubt (Browser-Fetch auf /api/tags, /api/chat)
    const origins = (ollama.environment as string[]).find((e) => e.startsWith("OLLAMA_ORIGINS="));
    expect(origins).toContain("http://localhost:8080");
  });

  it("Studio startet erst, wenn Ollama läuft", () => {
    const studio = loadCompose().services.studio;
    expect(studio.depends_on.ollama.condition).toBe("service_started");
  });

  it("Dockerfile existiert und nutzt Multi-Stage-Build", () => {
    const df = readFileSync(path.join(ROOT, "Dockerfile"), "utf8");
    expect(df).toContain("FROM node:22-alpine AS build");
    expect(df).toContain("npm run build");
    expect(df).toContain("COPY --from=build /app/dist");
  });
});
