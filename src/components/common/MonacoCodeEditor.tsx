/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Real Monaco Code Editor (VS Code Engine) with Colorful Syntax Highlighting,
 * Live Syntax Error Diagnostics, Auto-Complete IntelliSense, and 1-Click Code Snippets
 */

import React, { useEffect, useRef, useMemo } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { CodingLanguage } from '../../types';
import {
  analyzeCodeDiagnostics,
  CodeDiagnostic,
  LANGUAGE_INTELLISENSE_ITEMS,
  QUICK_CODE_SNIPPETS,
  getCleanBoilerplateCode,
} from '../../utils/codeExecutionEngine';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  FileCode2,
} from 'lucide-react';

// Configure @monaco-editor/react to use the locally bundled monaco-editor package
// so it never fails due to external CDN blocks or offline environments.
loader.config({ monaco });

let completionProvidersRegistered = false;

function ensureMonacoConfigured(monacoInstance: typeof monaco) {
  if (completionProvidersRegistered) return;
  completionProvidersRegistered = true;

  // Define vibrant VS Code Dark+ theme
  monacoInstance.editor.defineTheme('attlic-vscode-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
      { token: 'keyword.control', foreground: 'C586C0', fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: 'C586C0', fontStyle: 'bold' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'type.identifier', foreground: '4EC9B0' },
      { token: 'identifier', foreground: '9CDCFE' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'string.include', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'FFD700' },
      { token: 'operator', foreground: 'D4D4D4' },
    ],
    colors: {
      'editor.background': '#090D16',
      'editor.foreground': '#E2E8F0',
      'editorLineNumber.foreground': '#475569',
      'editorLineNumber.activeForeground': '#818CF8',
      'editorCursor.foreground': '#6366F1',
      'editor.selectionBackground': '#312E8180',
      'editor.lineHighlightBackground': '#1E293B50',
      'editorSuggestWidget.background': '#0F172A',
      'editorSuggestWidget.border': '#334155',
      'editorSuggestWidget.selectedBackground': '#312E81',
      'editorSuggestWidget.highlightForeground': '#818CF8',
    },
  });

  const langMapping: Array<{ lang: CodingLanguage; monacoLang: string }> = [
    { lang: 'c', monacoLang: 'c' },
    { lang: 'cpp', monacoLang: 'cpp' },
    { lang: 'java', monacoLang: 'java' },
    { lang: 'python', monacoLang: 'python' },
    { lang: 'javascript', monacoLang: 'javascript' },
  ];

  for (const { lang, monacoLang } of langMapping) {
    monacoInstance.languages.registerCompletionItemProvider(monacoLang, {
      triggerCharacters: ['#', '<', '.', '(', ' '],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const items = LANGUAGE_INTELLISENSE_ITEMS[lang] || [];
        const suggestions: monaco.languages.CompletionItem[] = items.map((item) => {
          let kind = monacoInstance.languages.CompletionItemKind.Function;
          if (item.kind === 'keyword') {
            kind = monacoInstance.languages.CompletionItemKind.Keyword;
          } else if (item.kind === 'snippet') {
            kind = monacoInstance.languages.CompletionItemKind.Snippet;
          } else if (item.kind === 'module') {
            kind = monacoInstance.languages.CompletionItemKind.Module;
          }

          return {
            label: item.label,
            kind,
            detail: item.detail,
            documentation: item.documentation || item.detail,
            insertText: item.insertText,
            insertTextRules:
              monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          };
        });

        return { suggestions };
      },
    });
  }
}

interface MonacoCodeEditorProps {
  language: CodingLanguage;
  value: string;
  onChange: (nextValue: string) => void;
  height?: string;
  compilerStderr?: string;
  showQuickSnippets?: boolean;
  readOnly?: boolean;
  compact?: boolean;
}

export const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({
  language,
  value,
  onChange,
  height = '380px',
  compilerStderr,
  showQuickSnippets = true,
  readOnly = false,
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);

  const monacoLanguage = useMemo(() => {
    switch (language) {
      case 'c':
        return 'c';
      case 'cpp':
        return 'cpp';
      case 'java':
        return 'java';
      case 'python':
        return 'python';
      case 'javascript':
        return 'javascript';
      default:
        return 'c';
    }
  }, [language]);

  // Compute live syntax diagnostics + any compiler line errors
  const diagnostics = useMemo<CodeDiagnostic[]>(() => {
    const live = analyzeCodeDiagnostics(language, value);
    if (compilerStderr && compilerStderr.trim()) {
      const lineMatch =
        compilerStderr.match(/line\s+(\d+)/i) ||
        compilerStderr.match(/:(\d+):\d+:\s*(?:error|warning)/i);
      const errLine = lineMatch ? Math.max(1, parseInt(lineMatch[1], 10)) : 1;
      const alreadyHasLine = live.some((d) => d.line === errLine && d.severity === 'error');
      if (!alreadyHasLine) {
        live.unshift({
          line: errLine,
          column: 1,
          endColumn: 80,
          severity: 'error',
          message: compilerStderr.split('\n')[0].slice(0, 140),
        });
      }
    }
    return live;
  }, [language, value, compilerStderr]);

  // Apply squiggly markers inside Monaco whenever diagnostics change
  useEffect(() => {
    const editor = editorRef.current;
    const m = monacoRef.current;
    if (!editor || !m) return;
    const model = editor.getModel();
    if (!model) return;

    const markers: monaco.editor.IMarkerData[] = diagnostics.map((d) => ({
      severity:
        d.severity === 'error'
          ? m.MarkerSeverity.Error
          : m.MarkerSeverity.Warning,
      message: d.message,
      startLineNumber: d.line,
      startColumn: d.column,
      endLineNumber: d.line,
      endColumn: Math.max(d.column + 1, d.endColumn),
    }));

    m.editor.setModelMarkers(model, 'attlic-syntax-checker', markers);
  }, [diagnostics, value, language]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    ensureMonacoConfigured(monacoInstance);
    monacoInstance.editor.setTheme('attlic-vscode-dark');
  };

  const handleInsertSnippet = (snippetCode: string) => {
    const editor = editorRef.current;
    if (editor) {
      const selection = editor.getSelection();
      if (selection) {
        editor.executeEdits('snippet-insert', [
          {
            range: selection,
            text: snippetCode,
            forceMoveMarkers: true,
          },
        ]);
        editor.focus();
        return;
      }
    }
    onChange(value ? `${value}\n${snippetCode}` : snippetCode);
  };

  const handleJumpToLine = (line: number, column: number) => {
    const editor = editorRef.current;
    if (editor) {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column });
      editor.focus();
    }
  };

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
  const quickSnippets = QUICK_CODE_SNIPPETS[language] || [];

  return (
    <div className="flex flex-col bg-[#090D16] select-text">
      {/* Quick Snippets & Boilerplate Helper Strip */}
      {showQuickSnippets && !readOnly && (
        <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-semibold flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Quick Insert:</span>
            </span>
            {quickSnippets.map((snip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleInsertSnippet(snip.code)}
                className="px-2 py-0.5 rounded bg-slate-950 hover:bg-indigo-950/60 text-indigo-300 border border-slate-800 hover:border-indigo-500/40 font-mono text-[10px] transition"
              >
                {snip.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onChange(getCleanBoilerplateCode(language))}
            className="px-2.5 py-0.5 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-semibold text-[10px] inline-flex items-center gap-1 transition"
            title="Load clean standard boilerplate with headers pre-included"
          >
            <FileCode2 className="w-3 h-3" />
            <span>Insert Clean {language.toUpperCase()} Boilerplate</span>
          </button>
        </div>
      )}

      {/* Main Monaco Editor Surface */}
      <div className="relative w-full" style={{ height }}>
        <Editor
          height={height}
          language={monacoLanguage}
          value={value}
          theme="attlic-vscode-dark"
          onMount={handleEditorMount}
          onChange={(val) => onChange(val ?? '')}
          options={{
            readOnly,
            fontSize: 13,
            fontFamily: "'Ubuntu Mono', 'Fira Code', 'JetBrains Mono', monospace",
            fontLigatures: true,
            lineHeight: 22,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
            parameterHints: { enabled: true },
            wordBasedSuggestions: 'currentDocument',
            bracketPairColorization: { enabled: true },
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'all',
            smoothScrolling: true,
          }}
        />
      </div>

      {/* Live Syntax & IntelliSense Status Bar */}
      <div className="px-3.5 py-2 bg-slate-900/95 border-t border-slate-800 text-[11px] space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {errorCount === 0 && warningCount === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Syntax Valid • 0 Errors</span>
              </span>
            ) : (
              <div className="flex items-center gap-2">
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>
                      {errorCount} Syntax Error{errorCount === 1 ? '' : 's'}
                    </span>
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {warningCount} Warning{warningCount === 1 ? '' : 's'}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
            <span className="text-indigo-300">
              Monaco IDE • Auto-Complete Active (Ctrl+Space)
            </span>
            <span>UTF-8</span>
            <span className="uppercase text-emerald-400 font-bold">{language}</span>
          </div>
        </div>

        {/* Clickable Live Diagnostic List when errors/warnings are detected */}
        {diagnostics.length > 0 && (
          <div className="pt-1 border-t border-slate-800/80 space-y-1 max-h-24 overflow-y-auto">
            {diagnostics.slice(0, 4).map((diag, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleJumpToLine(diag.line, diag.column)}
                className={`w-full text-left px-2 py-1 rounded flex items-center justify-between gap-2 font-mono text-[11px] transition ${
                  diag.severity === 'error'
                    ? 'bg-rose-950/40 text-rose-300 hover:bg-rose-950/70 border border-rose-500/30'
                    : 'bg-amber-950/40 text-amber-300 hover:bg-amber-950/70 border border-amber-500/30'
                }`}
              >
                <span className="truncate">
                  <strong>Line {diag.line}:</strong> {diag.message}
                </span>
                <span className="text-[10px] underline shrink-0 opacity-80">
                  Jump to Line {diag.line}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonacoCodeEditor;
