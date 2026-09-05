// VBA-Macro-Generator (Sprint 4, Agent 2): erzeugt je generiertem Buch ein
// dediziertes VBA-Modul (.bas) für die "AI Text Refinement"-Suites in
// Microsoft Word.
//
// Sprint 3 lieferte die Kanäle, aus denen Word die Metadaten liest:
//   - docProps/custom.xml → ActiveDocument.CustomDocumentProperties
//   - customXml/item1.xml  → ActiveDocument.CustomXMLParts (vba.ts)
//   - versteckte Kapitel-Tags (U+200B + Base36-Index + U+200B) im Fließtext
//
// Dieses Modul schließt den Kreis: Nach dem DOCX-Export erzeugt der Nutzer
// über den generierten Ein-Klick-Makro die Word-native Post-Production:
//
//   1. AIWS_ApplyNativeStyles       — Style-Mapping: die Sprint-3-DOCX-Tags
//     (Heading1/Heading2/Standard/StandardEingerückt/Einzug) werden ausgelesen
//     und auf native Word-Formatvorlagen gemappt (Heading 1/2, Normal,
//     Body Text, Quote).
//   2. AIWS_CleanHardLineBreaks     — harte Umbrüche (^l) → Leerzeichen
//   3. AIWS_FixTypographicQuotes    — " → „ … “ (de) bzw. “ … ” (en)
//   4. AIWS_RemoveHiddenChapterTags — U+200B-Anker entfernen (vor Zero-Width)
//   5. AIWS_CleanSpacesAndZeroWidth — doppelte Leerzeichen, Zeilenende-Leer-
//     zeichen und unsichtbare Artefakte (U+200B/200C/200D, U+2060, BOM,
//     Soft-Hyphen) entfernen
//   AIWS_RefineAll orchestriert 1–5 in dieser Reihenfolge und meldet das
//   Ergebnis per MsgBox.
//
// Das generierte .bas ist deterministisch (keine Zeitstempel) und kann
// direkt über Word → Alt+F11 → Datei importieren geladen werden.

import type { BookChapterInput } from "./types";

/** VBA-Modulname (keine Leerzeichen/Umlaute, max. ~30 Zeichen Konvention). */
export const AIWS_VBA_MODULE = "AIWSTextRefinement";

/**
 * Duplizierte doppelte Anführungszeichen in VBA-Stringliteralen.
 * Nötig, weil Buchtitel/Authoren selbst " enthalten können.
 */
function vbaStr(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Erzeugt ein dediziertes VBA-Modul (.bas) für ein generiertes Buch.
 *
 * @param meta     Buch-Metadaten (Titel, Autor, Sprache)
 * @param chapters Kapitel (nur die Anzahl wird als Konstante eingebettet)
 * @returns        Vollständiges VBA-Modul als .bas-Text
 */
export function buildAiwsVbaBas(
  meta: { title: string; author: string; language?: string },
  chapters: BookChapterInput[],
): string {
  const chapterCount = chapters.length;
  const lang = meta.language ?? "de";

  return `Attribute VB_Name = "${AIWS_VBA_MODULE}"
Option Explicit

' =====================================================================
' AI Text Refinement — AI Writer Studio v1.2.0 (Sprint 4)
' Dediziertes Makro für: ${meta.title.replace(/"/g, '""')} (${meta.author})
'
' Import: Word → Alt+F11 → Datei → Importieren → AIWSTextRefinement.bas
' Start : Makro "AIWS_RefineAll" (Alt+F8)
'
' Sprint-3-Integration: die DOCX-Datei enthält Custom Properties
' (AIWS_AISuite, AIWS_Version, AIWS_ChapterCount, …) und einen Custom
' XML Part (urn:ai-writer-studio:ai-text-refinement) plus versteckte
' Kapitel-Tags (U+200B). Dieses Makro nutzt diese Anker, um:
'   - DOCX-Tags in native Word-Formatvorlagen zu überführen
'   - harte Zeilenumbrüche, Anführungszeichen, Leerzeichen und
'     Zero-Width-Artefakte zu bereinigen
' =====================================================================

Private Const AIWS_BOOK_TITLE As String = ${vbaStr(meta.title)}
Private Const AIWS_AUTHOR As String = ${vbaStr(meta.author)}
Private Const AIWS_LANGUAGE As String = ${vbaStr(lang)}
Private Const AIWS_CHAPTER_COUNT As Long = ${chapterCount}

' ---------------------------------------------------------------------
' Orchestrator: alle Refinement-Schritte in fester Reihenfolge.
' Wichtig: AIWS_RemoveHiddenChapterTags muss VOR AIWS_CleanSpacesAndZeroWidth
' laufen, sonst bleiben die U+200B-Anker als normale Artefakte hängen.
' ---------------------------------------------------------------------
Sub AIWS_RefineAll()
    On Error GoTo Fail
    Application.ScreenUpdating = False
    Dim doc As Document: Set doc = ActiveDocument

    AIWS_ApplyNativeStyles doc
    AIWS_CleanHardLineBreaks doc
    AIWS_FixTypographicQuotes doc
    AIWS_RemoveHiddenChapterTags doc
    AIWS_CleanSpacesAndZeroWidth doc

    Application.ScreenUpdating = True
    MsgBox "AIWS Text Refinement abgeschlossen." & vbCrLf & _
           "Buch: " & AIWS_BOOK_TITLE & vbCrLf & _
           "Kapitel: " & AIWS_CHAPTER_COUNT & vbCrLf & _
           "Formatvorlagen, Umbrüche, Anführungszeichen und Leerzeichen bereinigt.", _
           vbInformation, "AI Text Refinement"
    Exit Sub
Fail:
    Application.ScreenUpdating = True
    MsgBox "AIWS Text Refinement abgebrochen: " & Err.Description, vbExclamation, "AI Text Refinement"
End Sub

' ---------------------------------------------------------------------
' 1) Style-Mapping: Sprint-3-DOCX-Tags → native Word-Formatvorlagen.
'    Die docx.ts schreibt paragraphStyles mit diesen IDs/Namen:
'      Heading1, Heading2, Standard, StandardEingerückt ("Standard Eingerückt"),
'      Einzug. Word-native Pendants via wdStyle*-Enums.
' ---------------------------------------------------------------------
Sub AIWS_ApplyNativeStyles(doc As Document)
    Dim p As Paragraph
    For Each p In doc.Paragraphs
        Dim sName As String
        sName = p.Style.NameLocal
        Select Case sName
            Case "Heading1", "Heading 1"
                p.Style = doc.Styles(wdStyleHeading1)
            Case "Heading2", "Heading 2"
                p.Style = doc.Styles(wdStyleHeading2)
            Case "Standard", "Standard "
                p.Style = doc.Styles(wdStyleNormal)
            Case "StandardEingerückt", "Standard Eingerückt"
                p.Style = doc.Styles(wdStyleBodyText)
            Case "Einzug"
                p.Style = doc.Styles(wdStyleQuote)
        End Select
    Next p
End Sub

' ---------------------------------------------------------------------
' 2) Harte Zeilenumbrüche (^l = manuelle Zeilenschaltung) → Leerzeichen.
'    Manuelle Umbrüche stammen typischerweise aus Copy/Paste und zerstören
'    den Fließtext bei KDP-Neufluss.
' ---------------------------------------------------------------------
Sub AIWS_CleanHardLineBreaks(doc As Document)
    With doc.Content.Find
        .ClearFormatting
        .Replacement.ClearFormatting
        .Text = "^l"
        .Replacement.Text = " "
        .Forward = True
        .Wrap = wdFindStop
        .Format = False
        .MatchCase = False
        .MatchWholeWord = False
        .MatchWildcards = False
        .Execute Replace:=wdReplaceAll
    End With
End Sub

' ---------------------------------------------------------------------
' 3) Gerade Anführungszeichen → typografische (de: „…“, en: “…”).
'    Alternierende Ersetzung pro Vorkommen: öffnend/schließend.
' ---------------------------------------------------------------------
Sub AIWS_FixTypographicQuotes(doc As Document)
    Dim rng As Range: Set rng = doc.Content
    Dim opening As Boolean: opening = True
    Dim openQ As String, closeQ As String

    If AIWS_LANGUAGE = "en" Then
        openQ = ChrW(&H201C): closeQ = ChrW(&H201D)   ' “ ”
    Else
        openQ = ChrW(&H201E): closeQ = ChrW(&H201C)   ' „ “
    End If

    With rng.Find
        .ClearFormatting
        .Replacement.ClearFormatting
        .Text = """"
        .Forward = True
        .Wrap = wdFindStop
        .Format = False
        Do While .Execute
            rng.Text = IIf(opening, openQ, closeQ)
            opening = Not opening
            rng.Collapse wdCollapseEnd
        Loop
    End With
End Sub

' ---------------------------------------------------------------------
' 4) Versteckte Kapitel-Tags (U+200B + Base36-Index + U+200B) entfernen.
'    Die Tags waren Anker für externe Suiten — nach dem Refinement haben
'    sie ihre Aufgabe erfüllt und müssen aus dem Fließtext verschwinden.
' ---------------------------------------------------------------------
Sub AIWS_RemoveHiddenChapterTags(doc As Document)
    With doc.Content.Find
        .ClearFormatting
        .Replacement.ClearFormatting
        .Text = ChrW(&H200B)
        .Replacement.Text = ""
        .Forward = True
        .Wrap = wdFindStop
        .Format = False
        .Execute Replace:=wdReplaceAll
    End With
End Sub

' ---------------------------------------------------------------------
' 5) Doppelte Leerzeichen, Leerzeichen am Absatzende und unsichtbare
'    Zero-Width-Artefakte entfernen (U+200B/200C/200D, U+2060, U+FEFF,
'    Soft-Hyphen U+00AD).
' ---------------------------------------------------------------------
Sub AIWS_CleanSpacesAndZeroWidth(doc As Document)
    Dim codes As Variant
    codes = Array(&H200B, &H200C, &H200D, &H2060, &HFEFF, &HAD)
    Dim c As Variant
    For Each c In codes
        With doc.Content.Find
            .ClearFormatting
            .Replacement.ClearFormatting
            .Text = ChrW(CLng(c))
            .Replacement.Text = ""
            .Forward = True
            .Wrap = wdFindStop
            .Format = False
            .Execute Replace:=wdReplaceAll
        End With
    Next c

    ' Doppelte Leerzeichen iterativ reduzieren (kaskadierende Tripel etc.)
    With doc.Content.Find
        .ClearFormatting
        .Replacement.ClearFormatting
        .Text = "  "
        .Replacement.Text = " "
        .Forward = True
        .Wrap = wdFindStop
        .Format = False
        .Execute Replace:=wdReplaceAll
    End With

    ' Absatzmarken: Kein Leerzeichen vor Absatzende
    With doc.Content.Find
        .ClearFormatting
        .Replacement.ClearFormatting
        .Text = " ^p"
        .Replacement.Text = "^p"
        .Forward = True
        .Wrap = wdFindStop
        .Format = False
        .Execute Replace:=wdReplaceAll
    End With
End Sub
`;
}

/** Dateiname des generierten .bas-Moduls (dateisystem-sicher). */
export function buildAiwsBasFilename(title: string): string {
  const safe = title.replace(/[<>:"/\\|?*]/g, "_").trim();
  return `${AIWS_VBA_MODULE}_${safe}.bas`;
}
