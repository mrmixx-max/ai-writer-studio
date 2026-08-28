// Traductions françaises.
import type { TranslationDict } from "./de";

export const fr: TranslationDict = {
  "app.name": "AI Writer Studio",
  "common.save": "Enregistrer",
  "common.close": "Fermer",
  "common.cancel": "Annuler",
  "common.test": "Tester",

  "header.export": "Exporter",
  "header.layout": "Mise en page",
  "header.analytics": "Statistiques",
  "header.plugins": "Extensions",
  "header.settings": "Paramètres",
  "header.focus.on": "Quitter le mode focus",
  "header.focus.off": "Mode focus",
  "header.about": "À propos de cette application",
  "header.skipToEditor": "Aller directement à l'éditeur",

  "warning.dbError":
    "La base de données n'a pas pu être ouverte : {{error}} — les modifications ne seront pas enregistrées.",
  "warning.memoryOnly":
    "Les modifications sont actuellement conservées en mémoire uniquement et seront perdues à la fermeture.",

  "fatal.title": "L'interface n'a pas pu être chargée",
  "fatal.text":
    "Une erreur s'est produite. Vos projets ne sont pas concernés — ils sont stockés dans un fichier séparé.",

  "settings.title": "Paramètres",
  "settings.provider": "Fournisseur",
  "settings.model": "Modèle",
  "settings.temperature": "Température",
  "settings.maxTokens": "Jetons max.",
  "settings.systemPrompt": "Invite système",
  "settings.theme": "Thème",
  "settings.theme.dark": "Sombre",
  "settings.theme.light": "Clair",
  "settings.language": "Langue",
  "settings.highContrast": "Mode contraste élevé",
  "settings.highContrast.hint":
    "Augmente les contrastes et la taille des polices pour une meilleure lisibilité.",
  "settings.testConnection": "Tester la connexion",
  "settings.testing": "Test en cours…",

  "shortcuts.title": "Raccourcis clavier",
  "shortcuts.save": "Enregistrer le manuscrit",
  "shortcuts.focusEditor": "Placer le focus sur l'éditeur",
  "shortcuts.focusSidebar": "Placer le focus sur la liste des projets",
  "shortcuts.focusAI": "Placer le focus sur l'assistant IA",
  "shortcuts.settings": "Ouvrir les paramètres",
  "shortcuts.focusMode": "Basculer le mode focus",
  "shortcuts.about": "Ouvrir la boîte « À propos »",
  "shortcuts.help": "Afficher la liste des raccourcis",
  "shortcuts.escape": "Fermer la boîte de dialogue",
};
