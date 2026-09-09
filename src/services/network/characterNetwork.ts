// Character Network Graph (Sprint 27, Agent 3): Beziehungen zwischen
// Charakteren visualisieren. Lokal, kein LLM nötig, deterministisch.

export interface NetworkNode {
  id: string;
  label: string;
  x: number;
  y: number;
  connections: number;
  importance: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  label: string;
  strength: number;
}

export interface CharacterNetwork {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  density: number;
  mostConnected: string;
  isolated: string[];
}

/**
 * Baut ein Charakter-Beziehungsnetzwerk aus einem Text.
 */
export function buildCharacterNetwork(
  text: string,
  characters: { id: string; name: string; relationships?: { characterId: string; type: string }[] }[]
): CharacterNetwork {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const connectionCount = new Map<string, number>();
  const charMap = new Map(characters.map((c) => [c.id, c]));

  // Finde Charakter-Extraktionen
  const extractedChars = extractCharactersFromText(text);
  const allChars = new Map<string, string>();
  
  for (const char of characters) {
    allChars.set(char.name.toLowerCase(), char.id);
  }
  for (const name of extractedChars) {
    if (!allChars.has(name.toLowerCase())) {
      const id = `ext-${name.toLowerCase()}`;
      allChars.set(name.toLowerCase(), id);
      characters.push({ id, name, relationships: [] });
    }
  }

  // Zähle Verbindungen
  for (const char of characters) {
    connectionCount.set(char.id, 0);
  }

  // Beziehungen aus Extraktion
  for (const char of characters) {
    if (char.relationships) {
      for (const rel of char.relationships) {
        connectionCount.set(char.id, (connectionCount.get(char.id) ?? 0) + 1);
        connectionCount.set(rel.characterId, (connectionCount.get(rel.characterId) ?? 0) + 1);
        edges.push({
          source: char.id,
          target: rel.characterId,
          label: rel.type || "bezieht sich auf",
          strength: 1,
        });
      }
    }
  }

  // Beziehungen aus Text-Kookkurrenz
  const textByChapter = text.split(/\n\s*\n/);
  for (const chapter of textByChapter) {
    const present: string[] = [];
    for (const char of characters) {
      if (chapter.toLowerCase().includes(char.name.toLowerCase())) {
        present.push(char.id);
      }
    }
    if (present.length >= 2) {
      for (let i = 0; i < present.length; i++) {
        for (let j = i + 1; j < present.length; j++) {
          connectionCount.set(present[i], (connectionCount.get(present[i]) ?? 0) + 1);
          connectionCount.set(present[j], (connectionCount.get(present[j]) ?? 0) + 1);
          // Prüfe ob Kante schon existiert
          const exists = edges.some(
            (e) => (e.source === present[i] && e.target === present[j]) || 
                   (e.source === present[j] && e.target === present[i])
          );
          if (!exists) {
            edges.push({
              source: present[i],
              target: present[j],
              label: "taucht auf in",
              strength: 1,
            });
          } else {
            const existing = edges.find(
              (e) => (e.source === present[i] && e.target === present[j]) || 
                     (e.source === present[j] && e.target === present[i])
            );
            if (existing) existing.strength++;
          }
        }
      }
    }
  }

  // Positionierung im Kreis
  const totalChars = characters.length;
  for (let i = 0; i < totalChars; i++) {
    const char = characters[i];
    const connections = connectionCount.get(char.id) ?? 0;
    const importance = connections / Math.max(1, totalChars - 1);
    const angle = (2 * Math.PI * i) / totalChars;
    const radius = 100 + importance * 50;
    
    nodes.push({
      id: char.id,
      label: char.name,
      x: 200 + radius * Math.cos(angle),
      y: 150 + radius * Math.sin(angle),
      connections,
      importance,
    });
  }

  const totalPossibleEdges = (totalChars * (totalChars - 1)) / 2;
  const density = totalPossibleEdges > 0 ? edges.length / totalPossibleEdges : 0;

  let mostConnected = "";
  let maxConnections = 0;
  for (const [id, count] of connectionCount) {
    if (count > maxConnections) {
      maxConnections = count;
      mostConnected = charMap.get(id)?.name ?? id;
    }
  }

  const isolated = characters
    .filter((c) => (connectionCount.get(c.id) ?? 0) === 0)
    .map((c) => c.name);

  return {
    nodes,
    edges,
    density: Math.round(density * 100) / 100,
    mostConnected,
    isolated,
  };
}

function extractCharactersFromText(text: string): string[] {
  const names = new Set<string>();
  const capitalized = text.match(/\b[A-ZÄÖÜ][a-zäöüß]{2,}\b/g) ?? [];
  const commonNames = ["Max", "Anna", "Peter", "Maria", "Hans", "Lisa", "Tom", "Emma", "Paul", "Sophie", "Leo", "Mia", "Felix", "Lena", "Jonas", "Marie", "Erik", "Sarah", "Jan", "Laura", "Erik", "Ingrid", "Karl", "Ursula", "Werner", "Gisela", "Fritz", "Helga", "Otto", "Elsa", "Heinrich", "Greta", "Wilhelm", "Hilde", "Albert", "Gertrud", "Friedrich", "Elisabeth", "Ernst", "Margarete"];
  
  for (const word of capitalized) {
    if (commonNames.includes(word) || word.length > 3) {
      names.add(word);
    }
  }
  return [...names];
}

/**
 * Generiert eine ASCII-Darstellung des Netzwerks.
 */
export function generateNetworkAscii(network: CharacterNetwork, width = 50, height = 20): string {
  if (network.nodes.length === 0) return "Keine Knoten";

  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(" "));

  // Skaliere Koordinaten
  const minX = Math.min(...network.nodes.map((n) => n.x));
  const maxX = Math.max(...network.nodes.map((n) => n.x));
  const minY = Math.min(...network.nodes.map((n) => n.y));
  const maxY = Math.max(...network.nodes.map((n) => n.y));
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const scaledNodes = network.nodes.map((n) => ({
    ...n,
    x: Math.floor(((n.x - minX) / rangeX) * (width - 1)),
    y: Math.floor(((n.y - minY) / rangeY) * (height - 1)),
  }));

  // Zeichne Kanten
  for (const edge of network.edges) {
    const source = scaledNodes.find((n) => n.id === edge.source);
    const target = scaledNodes.find((n) => n.id === edge.target);
    if (source && target) {
      const midX = Math.floor((source.x + target.x) / 2);
      const midY = Math.floor((source.y + target.y) / 2);
      if (midY >= 0 && midY < height && midX >= 0 && midX < width) {
        grid[midY][midX] = "·";
      }
    }
  }

  // Zeichne Knoten
  for (const node of scaledNodes) {
    if (node.y >= 0 && node.y < height && node.x >= 0 && node.x < width) {
      grid[node.y][node.x] = "●";
    }
  }

  const lines = grid.map((row) => row.join(""));
  lines.push(`Dichte: ${network.density} | Meist verbunden: ${network.mostConnected}`);
  return lines.join("\n");
}
