/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Candidate Data Styled OpenXML (.XLSX) Spreadsheet & CSV Archive Utilities
 */

import type { CandidateAttempt } from '../types/index.ts';

export const CANDIDATE_EXPORT_HEADERS: readonly string[] = [
  'Attempt ID',
  'Candidate Name',
  'Email',
  'Roll Number',
  'College',
  'Branch',
  'Phone',
  'CGPA',
  'Assessment Code',
  'Assessment Title',
  'Score',
  'Total Marks',
  'Percentage',
  'Result Status',
  'Tab Switches',
  'Violation Count',
  'Coding Submissions',
  'Started At',
  'Submitted At',
];

/**
 * Extracts normalized display values for each candidate attempt row.
 */
export function extractCandidateExportRows(
  attempts: CandidateAttempt[]
): Array<Array<string | number>> {
  return attempts.map((a) => {
    const codingAnswers = Object.values(a.answers || {}).filter(
      (ans) => ans && ans.codeAnswer && ans.codeAnswer.trim().length > 0
    );
    const codingSummary =
      codingAnswers.length > 0
        ? codingAnswers
            .map(
              (ans) =>
                `${ans.codingLanguage || 'python'}: ${ans.passedTestCases ?? 0}/${ans.totalTestCases ?? 0} passed`
            )
            .join('; ')
        : 'None';

    return [
      a.id || '',
      a.candidate?.name || '',
      a.candidate?.email || '',
      a.candidate?.rollNumber || '',
      a.candidate?.college || '',
      a.candidate?.branch || '',
      a.candidate?.phone || '',
      a.candidate?.cgpa ?? '',
      a.assessmentCode || '',
      a.assessmentTitle || '',
      Number(a.score) || 0,
      Number(a.totalMarks) || 0,
      `${Number(a.percentage) || 0}%`,
      a.passed ? 'QUALIFIED' : 'DID NOT CLEAR',
      Number(a.tabSwitchCount) || 0,
      Array.isArray(a.violationLogs) ? a.violationLogs.length : 0,
      codingSummary,
      a.startedAt || '',
      a.submittedAt || '',
    ];
  });
}

/**
 * Generates a comprehensive RFC-4180 CSV string containing all candidate evaluation fields,
 * proctoring telemetry, and coding submission summaries.
 */
export function buildCandidateBackupCSV(attempts: CandidateAttempt[]): string {
  const escapeCsvCell = (value: unknown): string => {
    const raw = value === null || value === undefined ? '' : String(value);
    const escaped = raw.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const rawRows = extractCandidateExportRows(attempts);
  const formattedRows = rawRows.map((row) =>
    row.map((cell, idx) => {
      // Score (10), Total Marks (11), Tab Switches (14), Violation Count (15) are numeric unquoted in legacy CSV tests
      if (idx === 10 || idx === 11 || idx === 14 || idx === 15) {
        return String(Number(cell) || 0);
      }
      return escapeCsvCell(cell);
    })
  );

  return [
    CANDIDATE_EXPORT_HEADERS.join(','),
    ...formattedRows.map((r) => r.join(',')),
  ].join('\n');
}

/**
 * Generates a rich HTML Spreadsheet preview string
 * featuring Default Bold Headings (#F08A43 Pastel Orange header with bold white text)
 * and alternating Pastel Orange (#FFF0E5) and White (#FFFFFF) data rows.
 */
export function buildStyledCandidateSpreadsheetHtml(
  attempts: CandidateAttempt[],
  reportTitle = 'ATTLIC Candidate Evaluation Report'
): string {
  const escapeHtml = (val: unknown): string =>
    String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const rows = extractCandidateExportRows(attempts);

  const headerCellsHtml = CANDIDATE_EXPORT_HEADERS.map(
    (h) =>
      `<th bgcolor="#F08A43" style="background-color:#F08A43;color:#FFFFFF;font-family:'Ubuntu',Arial,sans-serif;font-size:10.5pt;font-weight:700;padding:10px 14px;border:1px solid #D9722B;text-align:left;white-space:nowrap;"><b>${escapeHtml(
        h
      )}</b></th>`
  ).join('');

  const bodyRowsHtml = rows
    .map((row, rowIndex) => {
      const isOrangeRow = rowIndex % 2 === 1;
      const rowBg = isOrangeRow ? '#FFF0E5' : '#FFFFFF';
      const cellsHtml = row
        .map((cell, colIndex) => {
          const isBoldCol = colIndex === 1 || colIndex === 8 || colIndex === 13;
          const isNumericCol =
            colIndex === 10 || colIndex === 11 || colIndex === 12 || colIndex === 14 || colIndex === 15;
          const cellText = escapeHtml(cell);
          const content = isBoldCol ? `<b>${cellText}</b>` : cellText;
          const statusColor =
            colIndex === 13
              ? cell === 'QUALIFIED'
                ? '#15803D'
                : '#B91C1C'
              : '#141417';

          return `<td bgcolor="${rowBg}" style="background-color:${rowBg};color:${statusColor};font-family:'Ubuntu',Arial,sans-serif;font-size:10pt;font-weight:${
            isBoldCol ? '700' : '400'
          };padding:8px 12px;border:1px solid #F2D3B8;text-align:${
            isNumericCol ? 'right' : 'left'
          };white-space:nowrap;">${content}</td>`;
        })
        .join('');

      return `<tr bgcolor="${rowBg}" style="background-color:${rowBg};">${cellsHtml}</tr>`;
    })
    .join('\n');

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <style>
    table { border-collapse: collapse; width: 100%; font-family: 'Ubuntu', Arial, sans-serif; }
    th { background-color: #F08A43; color: #FFFFFF; font-weight: 700; border: 1px solid #D9722B; padding: 10px 14px; }
    td { border: 1px solid #F2D3B8; padding: 8px 12px; color: #141417; }
    tr.row-white td { background-color: #FFFFFF; }
    tr.row-orange td { background-color: #FFF0E5; }
  </style>
</head>
<body>
  <table>
    <thead>
      <tr>
        <th colspan="${CANDIDATE_EXPORT_HEADERS.length}" bgcolor="#141417" style="background-color:#141417;color:#FFB37B;font-family:'Ubuntu',Arial,sans-serif;font-size:12pt;font-weight:700;padding:12px 14px;border:1px solid #222226;text-align:left;">
          <b>${escapeHtml(reportTitle)} — Generated ${escapeHtml(new Date().toLocaleString())} (${attempts.length} Candidates)</b>
        </th>
      </tr>
      <tr>${headerCellsHtml}</tr>
    </thead>
    <tbody>
      ${bodyRowsHtml}
    </tbody>
  </table>
</body>
</html>`;
}

// ============================================================================
// Pure-TypeScript ECMA-376 OpenXML (.XLSX) Workbook Binary Builder
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colIndexToLetter(colIdx0: number): string {
  let n = colIdx0 + 1;
  let col = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function createZipArchive(files: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = encoder.encode(f.content);
    const crc = crc32(dataBytes);
    return { nameBytes, dataBytes, crc };
  });

  let localTotalSize = 0;
  let centralTotalSize = 0;
  for (const e of entries) {
    localTotalSize += 30 + e.nameBytes.length + e.dataBytes.length;
    centralTotalSize += 46 + e.nameBytes.length;
  }

  const totalSize = localTotalSize + centralTotalSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  let offset = 0;
  const localOffsets: number[] = [];

  for (const e of entries) {
    localOffsets.push(offset);
    // Local file header signature PK\x03\x04
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true); // version needed to extract (2.0)
    view.setUint16(offset + 6, 0, true); // general purpose bit flag
    view.setUint16(offset + 8, 0, true); // compression method: 0 (STORE)
    view.setUint16(offset + 10, 0x0000, true); // last mod file time
    view.setUint16(offset + 12, 0x5421, true); // last mod file date
    view.setUint32(offset + 14, e.crc, true); // crc-32
    view.setUint32(offset + 18, e.dataBytes.length, true); // compressed size
    view.setUint32(offset + 22, e.dataBytes.length, true); // uncompressed size
    view.setUint16(offset + 26, e.nameBytes.length, true); // file name length
    view.setUint16(offset + 28, 0, true); // extra field length
    out.set(e.nameBytes, offset + 30);
    out.set(e.dataBytes, offset + 30 + e.nameBytes.length);
    offset += 30 + e.nameBytes.length + e.dataBytes.length;
  }

  const centralDirOffset = offset;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    // Central directory file header signature PK\x01\x02
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true); // version made by
    view.setUint16(offset + 6, 20, true); // version needed to extract
    view.setUint16(offset + 8, 0, true); // general purpose bit flag
    view.setUint16(offset + 10, 0, true); // compression method: 0 (STORE)
    view.setUint16(offset + 12, 0x0000, true); // last mod file time
    view.setUint16(offset + 14, 0x5421, true); // last mod file date
    view.setUint32(offset + 16, e.crc, true); // crc-32
    view.setUint32(offset + 20, e.dataBytes.length, true); // compressed size
    view.setUint32(offset + 24, e.dataBytes.length, true); // uncompressed size
    view.setUint16(offset + 28, e.nameBytes.length, true); // file name length
    view.setUint16(offset + 30, 0, true); // extra field length
    view.setUint16(offset + 32, 0, true); // file comment length
    view.setUint16(offset + 34, 0, true); // disk number start
    view.setUint16(offset + 36, 0, true); // internal file attributes
    view.setUint32(offset + 38, 0, true); // external file attributes
    view.setUint32(offset + 42, localOffsets[i], true); // relative offset of local header
    out.set(e.nameBytes, offset + 46);
    offset += 46 + e.nameBytes.length;
  }

  const centralDirSize = offset - centralDirOffset;

  // End of central directory record PK\x05\x06
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true); // number of this disk
  view.setUint16(offset + 6, 0, true); // disk where central directory starts
  view.setUint16(offset + 8, entries.length, true); // total entries on this disk
  view.setUint16(offset + 10, entries.length, true); // total entries in central directory
  view.setUint32(offset + 12, centralDirSize, true); // size of central directory
  view.setUint32(offset + 16, centralDirOffset, true); // offset of start of central directory
  view.setUint16(offset + 20, 0, true); // comment length

  return out;
}

/**
 * Generates a standards-compliant ECMA-376 OpenXML (.xlsx) binary workbook
 * with bold Pastel Orange headings (#F08A43), alternating Pastel Orange (#FFF0E5)
 * and White (#FFFFFF) rows, green/red qualification status styling, and auto-sized columns.
 */
export function buildCandidateSpreadsheetXlsx(
  attempts: CandidateAttempt[],
  reportTitle = 'ATTLIC Candidate Evaluation Report'
): Uint8Array {
  const rows = extractCandidateExportRows(attempts);
  const lastColLetter = colIndexToLetter(CANDIDATE_EXPORT_HEADERS.length - 1);

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Candidates Report" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // Font indices:
  // 0: Normal 10pt #141417
  // 1: Title Bold 12pt #FFB37B
  // 2: Header Bold 10.5pt #FFFFFF
  // 3: Bold Data 10pt #141417
  // 4: Qualified Bold 10pt #15803D
  // 5: Not Qualified Bold 10pt #B91C1C
  // Fill indices (0=none, 1=gray125 are mandatory in Excel):
  // 2: Title Dark #141417
  // 3: Header Orange #F08A43
  // 4: White Row #FFFFFF
  // 5: Pastel Orange Row #FFF0E5
  // Border indices:
  // 0: None
  // 1: Header border #D9722B
  // 2: Data cell border #F2D3B8
  // CellXfs style indices (s="..."):
  // 0: Default
  // 1: Title Banner (Font 1, Fill 2, Border 1, Left)
  // 2: Table Header (Font 2, Fill 3, Border 1, Left)
  // 3: White Row Normal Left (Font 0, Fill 4, Border 2, Left)
  // 4: White Row Bold Left (Font 3, Fill 4, Border 2, Left)
  // 5: White Row Numeric Right (Font 0, Fill 4, Border 2, Right)
  // 6: White Row Qualified Bold (Font 4, Fill 4, Border 2, Left)
  // 7: White Row Failed Bold (Font 5, Fill 4, Border 2, Left)
  // 8: Orange Row Normal Left (Font 0, Fill 5, Border 2, Left)
  // 9: Orange Row Bold Left (Font 3, Fill 5, Border 2, Left)
  // 10: Orange Row Numeric Right (Font 0, Fill 5, Border 2, Right)
  // 11: Orange Row Qualified Bold (Font 4, Fill 5, Border 2, Left)
  // 12: Orange Row Failed Bold (Font 5, Fill 5, Border 2, Left)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
    <font><sz val="10"/><color rgb="FF141417"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FFFFB37B"/><name val="Calibri"/></font>
    <font><b/><sz val="10.5"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF141417"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF15803D"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFB91C1C"/><name val="Calibri"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF141417"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF08A43"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF0E5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD9722B"/></left>
      <right style="thin"><color rgb="FFD9722B"/></right>
      <top style="thin"><color rgb="FFD9722B"/></top>
      <bottom style="thin"><color rgb="FFD9722B"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFF2D3B8"/></left>
      <right style="thin"><color rgb="FFF2D3B8"/></right>
      <top style="thin"><color rgb="FFF2D3B8"/></top>
      <bottom style="thin"><color rgb="FFF2D3B8"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="13">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

  // Compute sensible auto-widths per column
  const colWidths = CANDIDATE_EXPORT_HEADERS.map((header, colIdx) => {
    let maxLen = header.length + 4;
    for (let r = 0; r < Math.min(rows.length, 250); r++) {
      const len = String(rows[r][colIdx] ?? '').length + 3;
      if (len > maxLen) maxLen = len;
    }
    return Math.min(Math.max(maxLen, 12), 42);
  });

  const colsXml = colWidths
    .map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  // Row 1: Title Banner merged across A1..S1
  const bannerText = `${reportTitle} — Generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')} (${attempts.length} Candidates)`;
  const row1Cells = CANDIDATE_EXPORT_HEADERS.map((_, colIdx) => {
    const ref = `${colIndexToLetter(colIdx)}1`;
    if (colIdx === 0) {
      return `<c r="${ref}" s="1" t="inlineStr"><is><t xml:space="preserve">${escapeXml(bannerText)}</t></is></c>`;
    }
    return `<c r="${ref}" s="1"/>`;
  }).join('');

  // Row 2: Column Headers
  const row2Cells = CANDIDATE_EXPORT_HEADERS.map((h, colIdx) => {
    const ref = `${colIndexToLetter(colIdx)}2`;
    return `<c r="${ref}" s="2" t="inlineStr"><is><t xml:space="preserve">${escapeXml(h)}</t></is></c>`;
  }).join('');

  // Rows 3+: Candidate Data Rows
  const dataRowsXml = rows
    .map((row, rIdx) => {
      const excelRowNum = rIdx + 3;
      const isOrangeRow = rIdx % 2 === 1;
      const baseOffset = isOrangeRow ? 5 : 0; // White styles: 3..7, Orange styles: 8..12

      const cellsXml = row
        .map((cell, cIdx) => {
          const ref = `${colIndexToLetter(cIdx)}${excelRowNum}`;
          const isTrueNumericCol = cIdx === 10 || cIdx === 11 || cIdx === 14 || cIdx === 15;
          const isRightAlignedCol = isTrueNumericCol || cIdx === 12;
          const isBoldCol = cIdx === 1 || cIdx === 8;

          let styleIdx = 3 + baseOffset; // Normal Left
          if (cIdx === 13) {
            styleIdx = (cell === 'QUALIFIED' ? 6 : 7) + baseOffset;
          } else if (isBoldCol) {
            styleIdx = 4 + baseOffset;
          } else if (isRightAlignedCol) {
            styleIdx = 5 + baseOffset;
          }

          if (isTrueNumericCol) {
            const numVal = Number(cell);
            const safeNum = Number.isFinite(numVal) ? numVal : 0;
            return `<c r="${ref}" s="${styleIdx}"><v>${safeNum}</v></c>`;
          }

          return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
        })
        .join('');

      return `<row r="${excelRowNum}" ht="20" customHeight="1">${cellsXml}</row>`;
    })
    .join('\n');

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${colsXml}</cols>
  <sheetData>
    <row r="1" ht="26" customHeight="1">${row1Cells}</row>
    <row r="2" ht="24" customHeight="1">${row2Cells}</row>
    ${dataRowsXml}
  </sheetData>
  <mergeCells count="1">
    <mergeCell ref="A1:${lastColLetter}1"/>
  </mergeCells>
</worksheet>`;

  return createZipArchive([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', content: sheet1Xml },
  ]);
}

/**
 * Triggers a browser file download for candidate records.
 * Defaults to a genuine ECMA-376 OpenXML (.xlsx) workbook (bold headings + alternating pastel-orange and white rows)
 * so Microsoft Excel, Google Sheets, LibreOffice, and Apple Numbers open it without any corruption or extension warning.
 * Also supports raw RFC-4180 CSV download when format === 'raw_csv'.
 */
export function triggerCandidateCSVDownload(
  attempts: CandidateAttempt[],
  filenamePrefix = 'attlic_candidates_backup',
  format: 'styled' | 'raw_csv' = 'styled'
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const isRawCsv = format === 'raw_csv';
  const filename = isRawCsv
    ? `${filenamePrefix}_${timestamp}.csv`
    : `${filenamePrefix}_${timestamp}.xlsx`;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = isRawCsv
      ? new Blob(['\uFEFF' + buildCandidateBackupCSV(attempts)], {
          type: 'text/csv;charset=utf-8;',
        })
      : new Blob(
          [
            buildCandidateSpreadsheetXlsx(
              attempts,
              'ATTLIC Candidate Evaluation Report'
            ) as unknown as BlobPart,
          ],
          {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }
        );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return filename;
}

/**
 * Partitions candidate attempts into those targeted for cleanup and those to retain.
 */
export function partitionAttemptsForCleanup(
  attempts: CandidateAttempt[],
  assessmentId?: string
): {
  toClear: CandidateAttempt[];
  toKeep: CandidateAttempt[];
} {
  if (!assessmentId || assessmentId === 'all') {
    return {
      toClear: [...attempts],
      toKeep: [],
    };
  }

  const toClear: CandidateAttempt[] = [];
  const toKeep: CandidateAttempt[] = [];

  for (const att of attempts) {
    if (att.assessmentId === assessmentId) {
      toClear.push(att);
    } else {
      toKeep.push(att);
    }
  }

  return { toClear, toKeep };
}
