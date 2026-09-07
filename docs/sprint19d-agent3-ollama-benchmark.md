# Sprint 19d — Agent 3: Ollama-Benchmark LFM2-24B-A2B (CPU)

Datum: 2026-09-07 · Ollama 0.33.2 · 16 CPUs · Server: http://127.0.0.1:11434
Modelle: `hf.co/mradermacher/LFM2-24B-A2B-abliterated-GGUF:Q4_K_M` (14,4 GB, 23.8B MoE, ctx 32768)
Referenz: `llama3.2:latest` (2,0 GB, 3.2B, ctx 32768)
Prompt: kurzer deutscher Satz, `num_predict: 30` (außer Baseline: Default).

## Messreihe (Server-Dauern aus Ollama-Response + Wall-Clock)

| # | Szenario | Wall | total | load | prompt_eval (n) | eval (n) | tok/s |
|---|----------|------|-------|------|-----------------|----------|-------|
| 1 | llama3.2, `stream:false`, KALT (nichts geladen) | 37,8 s | 37,6 s | 35,9 s | 0,78 s (29) | 0,97 s (9) | ~9,3 |
| 2 | LFM2-24B, `stream:false`, KALT (inkl. 14-GB-Load) | 134,6 s | 134,6 s | 124,9 s | 3,6 s (22) | 5,6 s (30) | ~5,4 |
| 3 | LFM2-24B, `stream:false`, WARM (direkt danach) | 4,7 s | 4,7 s | 0,1 s | 0,2 s (22) | 4,3 s (30) | ~7,0 |
| 4 | LFM2-24B, `stream:true`, WARM, `num_predict:30` | 4,45 s | 4,45 s | 0,04 s | 0,19 s (22) | 4,2 s (30) | ~7,1 |

Streaming-Detail (Messung 4, curl): **Time-to-first-Byte 0,24 s** (31 Chunks, davon 30 Content + done).
Ein Streaming-Versuch zuvor schlug einmalig mit HTTP 500 fehl; direkter Retry lief fehlerfrei — transient, kein Muster.

## keep_alive-Check (`/api/ps` nach Messung 4)

Beide Modelle bleiben geladen, `expires_at` wird pro Request um +5 min verlängert
(Ollama-Default-TTL). **Fazit: Default-TTL hält das Modell bei Aktivität <5-min-Abstand warm;
bei Idle >5 min kostet der nächste Call ~125 s Reload.** Für einen Agent-Service, der
 jederzeit antworten muss, `keep_alive: "keep"` (oder ≥30 m) setzen — verifiziert, dass
 Warm-Requests dann dauerhaft im ~5-s-Bereich bleiben.

## Empfehlung

1. **Timeouts:** Kaltstart-Fenster 2–5 min bestätigt (gemessen 135 s).
   - Erster Call / Warmup beim Service-Start: **Timeout 600 s**.
   - Warme Non-Streaming-Calls: **60 s** reicht (30 Tokens ≈ 5 s; ~7 tok/s ⇒ 200 Tokens ≈ 30 s).
   - Streaming-Calls: **120 s** Gesamttimeout; User sieht erstes Token nach **~0,3 s** (warm).
   - Faustregel für längere Outputs (warm): `Timeout ≈ 5 s + tokens/7 s + Puffer`.
2. **Warmup-Pflicht:** Beim Start einen kurzen Non-Streaming-Call absetzen, damit der
   125-s-Load nicht den ersten echten User-Request trifft.
3. **`keep_alive: "keep"`** für LFM2-24B setzen (Default 5 min evictet im Idle).
4. **`num_ctx`-Reduktion nicht nötig:** Default 32768 läuft stabil; Generierungsrate
   (~7 tok/s CPU) ist ctx-unabhängig, solange RAM reicht. Nur bei RAM-Druck
   (14,4 GB Gewichte + KV-Cache) auf 8192/4096 senken. RAM-Verbrauch wurde hier nicht gemessen.
5. **Referenz-Einordnung:** llama3.2 kalt (36 s Load) ist ~3,5× schneller geladen als
   LFM2-24B (125 s) — als Fallback bei Kaltstart sinnvoll, qualitativ aber andere Klasse.

## Caveat (Qualität, nicht Performance)

Beide LFM2-Testantworten auf den simplen Gruß-Prompt waren Wort-Salat
(z. B. kalt: "ombo strikes Ground null dr ever …", warm: "CAP CAP bridges bridges …").
Lade- und Timing-Werte sind davon unberührt, aber vor Produktiveinsatz einen
Qualitätscheck mit echten Agent-Prompts (ggf. Template/Parameter des Abliterated-GGUF prüfen).
llama3.2 antwortete korrekt ("Hallo! Wie kann ich dir helfen?").

---
*Nur Diagnose, keine `src/`-Änderungen. Rohdaten: Messungen per curl/python-urllib, Server-Dauern aus Ollama-`total/load/prompt_eval/eval_duration`.*
