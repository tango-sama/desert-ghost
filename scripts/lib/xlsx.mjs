// Minimal, dependency-free .xlsx (OOXML SpreadsheetML) writer.
//
// Exists so `scripts/yalidine-export.mjs` can produce a real Excel file with
// nothing but Node's standard library — this repo ships no build step and we
// don't want an npm dependency (SheetJS/exceljs) pulled in for one ops report.
//
// Scope is deliberately just what the export needs: several sheets, a styled
// header row, frozen header, autofilter, per-column widths, and three cell
// kinds (text / number / date). It is not a general-purpose Excel library.
import { deflateRawSync } from "node:zlib";

// ───────── zip container ─────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// DOS date/time, as stored in each zip entry. Excel never shows these, but a
// zero value makes some archivers complain, so stamp the real time.
function dosTime(d) {
  return (
    ((d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2))) & 0xffff
  );
}
function dosDate(d) {
  return (
    (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff
  );
}

// Build a ZIP archive from [{ name, data:Buffer }]. Every entry is deflated;
// an .xlsx is exactly this archive with the OOXML parts inside.
function zip(entries) {
  const now = new Date();
  const time = dosTime(now);
  const date = dosDate(now);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = entry.data;
    const deflated = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    name.copy(local, 30);
    locals.push(local, deflated);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);

    offset += local.length + deflated.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, centralBuf, end]);
}

// ───────── spreadsheet xml ─────────

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Excel rejects control characters in cell text; carrier data is free-text
// (addresses, product lists) so strip them rather than emit a corrupt file.
function clean(s) {
  return String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

// A1-style reference: (0,0) -> "A1".
export function cellRef(row, col) {
  let name = "";
  let n = col;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name + (row + 1);
}

// Excel's serial date: whole days since 1899-12-30. Carrier timestamps are
// naive Algiers wall-clock strings, so they're written as-is (no timezone
// shift) and Excel displays exactly what Yalidine reported.
export function dateSerial(y, mo, d, h = 0, mi = 0, s = 0) {
  const days = Math.floor(Date.UTC(y, mo - 1, d) / 86400000) + 25569;
  return days + (h * 3600 + mi * 60 + s) / 86400;
}

// Style ids baked into styles.xml below, referenced by cells as `s`.
export const STYLE = { DEFAULT: 0, HEADER: 1, DATE: 2, MONEY: 3, INT: 4, TEXT: 5 };

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd\\ hh:mm"/><numFmt numFmtId="165" formatCode="#,##0"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE11900"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// One cell. `v` may be a number, a {date} serial marker, or anything else
// (written as an inline string so no sharedStrings table is needed).
function cellXml(ref, value, style) {
  const s = style ? ` s="${style}"` : "";
  if (value === null || value === undefined || value === "") return `<c r="${ref}"${s}/>`;
  if (typeof value === "number" && Number.isFinite(value))
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  if (typeof value === "boolean")
    return `<c r="${ref}"${s} t="b"><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(clean(value))}</t></is></c>`;
}

function sheetXml(sheet) {
  const { columns, rows, freezeHeader = true, autoFilter = true } = sheet;

  const cols = columns.some((c) => c.width)
    ? `<cols>${columns
        .map((c, i) =>
          c.width ? `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>` : ""
        )
        .join("")}</cols>`
    : "";

  const body = [];
  body.push(
    `<row r="1" ht="30" customHeight="1">${columns
      .map((c, i) => cellXml(cellRef(0, i), c.header, STYLE.HEADER))
      .join("")}</row>`
  );
  rows.forEach((row, r) => {
    const cells = columns
      .map((c, i) => {
        const raw = row[c.key];
        const style = typeof c.style === "function" ? c.style(raw, row) : c.style;
        return cellXml(cellRef(r + 1, i), raw, style ?? STYLE.DEFAULT);
      })
      .join("");
    body.push(`<row r="${r + 2}">${cells}</row>`);
  });

  const lastRef = cellRef(rows.length, Math.max(columns.length - 1, 0));
  const pane = freezeHeader
    ? `<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>`
    : `<sheetView workbookViewId="0"/>`;
  const filter = autoFilter && rows.length ? `<autoFilter ref="A1:${lastRef}"/>` : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews>${pane}</sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${body.join(
    ""
  )}</sheetData>${filter}</worksheet>`;
}

// Excel forbids these in a sheet name and caps it at 31 characters.
function safeSheetName(name, index) {
  const cleaned = String(name || `Sheet${index + 1}`).replace(/[\\/*?:[\]]/g, "-");
  return cleaned.slice(0, 31) || `Sheet${index + 1}`;
}

/**
 * Build an .xlsx as a Buffer.
 *
 * @param {{name:string, columns:{key:string,header:string,width?:number,style?:number|Function}[], rows:object[], freezeHeader?:boolean, autoFilter?:boolean}[]} sheets
 */
export function buildXlsx(sheets) {
  if (!sheets.length) throw new Error("buildXlsx: at least one sheet is required");
  const names = sheets.map((s, i) => safeSheetName(s.name, i));

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join(
      ""
    )}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
    .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("")}</sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join("")}<Relationship Id="rId${
    sheets.length + 1
  }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const buf = (s) => Buffer.from(s, "utf8");
  return zip([
    { name: "[Content_Types].xml", data: buf(contentTypes) },
    { name: "_rels/.rels", data: buf(rootRels) },
    { name: "xl/workbook.xml", data: buf(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: buf(workbookRels) },
    { name: "xl/styles.xml", data: buf(STYLES_XML) },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: buf(sheetXml(s)),
    })),
  ]);
}
