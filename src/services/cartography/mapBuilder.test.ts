// Kartenstudio (WP 21.1) — Tests für mapBuilder.
// Rein lokal, deterministisch, ohne LLM. Deckt Ebenen-Erstellung,
// Stil-Presets, SVG-Export und hochauflösenden Export ab — inklusive
// defensiver Fallbacks bei fehlenden/ungültigen Daten.
import { describe, it, expect } from "vitest";
import {
  createMapLayer,
  applyMapStyle,
  exportToSvg,
  exportToHighRes,
  getMapStylePreset,
  STYLE_PRESETS,
  DEFAULT_DPI,
  MAP_INCHES,
  MAP_WIDTH,
  MAP_HEIGHT,
} from "./mapBuilder";
import type { MapLayer, MapStyle } from "./mapBuilder";

const landLayer: MapLayer = {
  id: "L1",
  name: "Landmassen",
  type: "land",
  visible: true,
  elements: [
    { id: "e1", type: "rect", x: 0, y: 0, width: 500, height: 400 },
    { id: "e2", type: "path", x: 10, y: 10, content: "M 0 0 L 100 100 Z" },
  ],
};

const riverLayer: MapLayer = {
  id: "R1",
  name: "Flüsse",
  type: "river",
  visible: true,
  elements: [{ id: "r1", type: "path", x: 0, y: 0, content: "M 0 0 C 50 50 100 0 150 80" }],
};

describe("createMapLayer", () => {
  it("erstellt eine Ebene mit allen Typen und behält Elemente bei", () => {
    const layer = createMapLayer(landLayer);
    expect(layer.type).toBe("land");
    expect(layer.name).toBe("Landmassen");
    expect(layer.visible).toBe(true);
    expect(layer.elements).toHaveLength(2);
    expect(layer.elements[1].content).toBe("M 0 0 L 100 100 Z");
  });

  it("akzeptiert alle sechs Ebenen-Typen", () => {
    const types = ["land", "river", "mountain", "road", "settlement", "label"] as const;
    for (const t of types) {
      expect(createMapLayer({ ...landLayer, type: t }).type).toBe(t);
    }
  });

  it("füllt fehlende Daten defensiv auf (kein Throw bei leerem Objekt)", () => {
    const layer = createMapLayer({} as unknown as MapLayer);
    expect(layer.type).toBe("land");
    expect(layer.visible).toBe(true);
    expect(Array.isArray(layer.elements)).toBe(true);
    expect(layer.elements).toHaveLength(0);
    expect(layer.id).toMatch(/^layer-/);
    expect(layer.name.length).toBeGreaterThan(0);
  });

  it("bildet unbekannte Typen und Nicht-Array-Elemente auf sichere Defaults ab", () => {
    const layer = createMapLayer({
      id: "x",
      name: "Kaputt",
      type: "vulkan" as unknown as MapLayer["type"],
      elements: "kein-array" as unknown as MapLayer["elements"],
      visible: true,
    });
    expect(layer.type).toBe("land");
    expect(layer.elements).toEqual([]);
  });

  it("normalisiert Elemente (fehlende id/type/coords) und ist deterministisch", () => {
    const a = createMapLayer({
      id: "L",
      name: "N",
      type: "label",
      visible: true,
      elements: [
        { type: "text", content: "Hauptstadt" } as never,
        { type: "unbekannt", x: "NaN" } as never,
      ],
    });
    const b = createMapLayer({
      id: "L",
      name: "N",
      type: "label",
      visible: true,
      elements: [
        { type: "text", content: "Hauptstadt" } as never,
        { type: "unbekannt", x: "NaN" } as never,
      ],
    });
    expect(a.elements[0].type).toBe("text");
    expect(a.elements[0].x).toBe(0);
    expect(a.elements[0].id).toBeTruthy();
    // Fallback-Typ für unbekannte Elemente ist "circle".
    expect(a.elements[1].type).toBe("circle");
    expect(a.elements[1].x).toBe(0);
    // Deterministische IDs: identische Eingabe ⇒ identische Ausgabe.
    expect(a.elements.map((e) => e.id)).toEqual(b.elements.map((e) => e.id));
  });

  it("respektiert visible:false und verändert die Eingabe nicht", () => {
    const input: MapLayer = { ...riverLayer, visible: false };
    const copy = JSON.parse(JSON.stringify(input));
    const layer = createMapLayer(input);
    expect(layer.visible).toBe(false);
    expect(input).toEqual(copy);
  });
});

describe("applyMapStyle", () => {
  it("wendet jedes Preset an und setzt style", () => {
    const styles: MapStyle[] = ["parchment", "blueprint", "modern"];
    for (const s of styles) {
      const styled = applyMapStyle(landLayer, s);
      expect(styled.style).toBe(s);
      expect(styled.elements[0].style?.fill).toBe(STYLE_PRESETS[s].layerColors.land);
    }
  });

  it("nutzt das Default-Preset bei unbekanntem Stil", () => {
    const styled = applyMapStyle(riverLayer, "neon" as unknown as MapStyle);
    expect(styled.style).toBe("modern");
    expect(styled.elements[0].style?.stroke).toBe(STYLE_PRESETS.modern.ink);
  });

  it("lässt element-eigene Style-Overrides gewinnen und mutiert die Eingabe nicht", () => {
    const input: MapLayer = {
      ...riverLayer,
      elements: [{ ...riverLayer.elements[0], style: { stroke: "#ff0000", strokeWidth: 9 } }],
    };
    const styled = applyMapStyle(input, "parchment");
    expect(styled.elements[0].style?.stroke).toBe("#ff0000");
    expect(styled.elements[0].style?.strokeWidth).toBe(9);
    // Eingabe unverändert (kein In-Place-Edit).
    expect(input.elements[0].style?.strokeWidth).toBe(9);
    expect(input.style).toBeUndefined();
  });
});

describe("exportToSvg", () => {
  it("exportiert ein valides SVG mit Ebenen und viewBox", () => {
    const svg = exportToSvg([landLayer, riverLayer]);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain(`viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}"`);
    expect(svg).toContain('data-layer-id="L1"');
    expect(svg).toContain('data-layer-id="R1"');
    expect(svg).toContain('data-element-id="e1"');
    expect(svg).toContain("<path");
    expect(svg).toContain("<rect");
  });

  it("überspringt unsichtbare Ebenen", () => {
    const svg = exportToSvg([landLayer, { ...riverLayer, visible: false }]);
    expect(svg).toContain('data-layer-id="L1"');
    expect(svg).not.toContain('data-layer-id="R1"');
  });

  it("escaped XML und liefert bei leerer/ungültiger Eingabe gültiges SVG", () => {
    const textLayer: MapLayer = {
      id: "T",
      name: "Labels",
      type: "label",
      visible: true,
      elements: [{ id: "t1", type: "text", x: 5, y: 5, content: "A & B <See>" }],
    };
    const svg = exportToSvg([textLayer]);
    expect(svg).toContain("A &amp; B &lt;See&gt;");
    expect(svg).not.toContain("A & B <See>");

    expect(exportToSvg([])).toContain("</svg>");
    expect(exportToSvg(null as unknown as MapLayer[])).toContain("</svg>");
  });
});

describe("exportToHighRes", () => {
  it("nutzt 300 DPI als Default und skaliert die Pixelmaße", () => {
    const svg = exportToHighRes([landLayer]);
    expect(svg).toContain(`data-dpi="${DEFAULT_DPI}"`);
    expect(svg).toContain(`width="${MAP_INCHES * DEFAULT_DPI}"`);
    expect(svg).toContain(`height="${MAP_INCHES * DEFAULT_DPI}"`);
    // viewBox bleibt im Welt-Raster.
    expect(svg).toContain(`viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}"`);
  });

  it("akzeptiert eine eigene DPI und fällt bei ungültiger DPI auf 300 zurück", () => {
    expect(exportToHighRes([landLayer], 600)).toContain('data-dpi="600"');
    expect(exportToHighRes([landLayer], 600)).toContain(`width="${MAP_INCHES * 600}"`);
    expect(exportToHighRes([landLayer], NaN)).toContain(`data-dpi="${DEFAULT_DPI}"`);
    expect(exportToHighRes([landLayer], 0)).toContain(`data-dpi="${DEFAULT_DPI}"`);
  });

  it("ist deterministisch: gleiche Eingabe ⇒ byte-identisches Ergebnis", () => {
    const a = exportToHighRes([applyMapStyle(landLayer, "blueprint")], 300);
    const b = exportToHighRes([applyMapStyle(landLayer, "blueprint")], 300);
    expect(a).toBe(b);
  });
});

describe("getMapStylePreset", () => {
  it("liefert Presets für alle Stile und ein Default bei undefined", () => {
    expect(getMapStylePreset("parchment").name).toBe("Pergament");
    expect(getMapStylePreset("blueprint").background).toBe(STYLE_PRESETS.blueprint.background);
    expect(getMapStylePreset().id).toBe("modern");
    expect(getMapStylePreset("modern").fontFamily).toBeTruthy();
  });
});
