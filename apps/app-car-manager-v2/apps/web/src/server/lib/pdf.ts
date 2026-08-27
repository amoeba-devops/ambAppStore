import 'server-only';
import type {
  TDocumentDefinitions,
  Content,
  TableCell,
  StyleDictionary,
} from 'pdfmake/interfaces';
import { attachment } from './content-disposition';

/* PDF export utilities using pdfmake.
 *
 * Supports Vietnamese/Korean via built-in Roboto font (includes Unicode).
 * For full Vietnamese diacritics, we use the standard fonts that come with pdfmake.
 */

export interface PdfColumn {
  header: string;
  key: string;
  width?: number | string | '*'; // pdfmake width spec
  alignment?: 'left' | 'center' | 'right';
}

export interface PdfTableOptions {
  title?: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: Record<string, unknown>[];
  footerNote?: string;
}

const defaultStyles: StyleDictionary = {
  header: {
    fontSize: 18,
    bold: true,
    margin: [0, 0, 0, 10],
  },
  subheader: {
    fontSize: 12,
    color: '#666666',
    margin: [0, 0, 0, 20],
  },
  tableHeader: {
    bold: true,
    fontSize: 10,
    fillColor: '#f3f4f6',
    color: '#374151',
  },
  tableCell: {
    fontSize: 9,
  },
  footer: {
    fontSize: 8,
    color: '#9ca3af',
    margin: [40, 10, 40, 0],
  },
  summaryRow: {
    bold: true,
    fillColor: '#e5e7eb',
  },
};

/**
 * Build a simple table PDF document.
 */
export function buildTablePdf(options: PdfTableOptions): Promise<Buffer> {
  const { title, subtitle, columns, rows, footerNote } = options;

  // Build table body
  const tableBody: TableCell[][] = [];

  // Header row
  tableBody.push(
    columns.map((col) => ({
      text: col.header,
      style: 'tableHeader',
      alignment: col.alignment ?? 'left',
    })),
  );

  // Data rows with alternating colors
  rows.forEach((row, idx) => {
    const rowCells: TableCell[] = columns.map((col) => {
      const val = row[col.key];
      let text = '';
      if (val instanceof Date) {
        text = val.toLocaleDateString('vi-VN');
      } else if (val !== null && val !== undefined) {
        text = String(val);
      }
      return {
        text,
        style: 'tableCell',
        alignment: col.alignment ?? 'left',
        fillColor: idx % 2 === 1 ? '#f9fafb' : undefined,
      };
    });
    tableBody.push(rowCells);
  });

  // Build content
  const content: Content[] = [];

  if (title) {
    content.push({ text: title, style: 'header' });
  }
  if (subtitle) {
    content.push({ text: subtitle, style: 'subheader' });
  }

  content.push({
    table: {
      headerRows: 1,
      widths: columns.map((c) => c.width ?? '*'),
      body: tableBody,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#e5e7eb',
      vLineColor: () => '#e5e7eb',
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  });

  const docDefinition: TDocumentDefinitions = {
    content,
    styles: defaultStyles,
    defaultStyle: {
      font: 'Pretendard',
      fontSize: 10,
    },
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [40, 40, 40, 60],
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: footerNote ?? `Generated: ${new Date().toLocaleString('vi-VN')}`,
          style: 'footer',
          alignment: 'left',
        },
        {
          text: `${currentPage}/${pageCount}`,
          style: 'footer',
          alignment: 'right',
        },
      ],
      margin: [40, 0, 40, 0],
    }),
  };

  return generatePdfBuffer(docDefinition);
}

export interface PdfSection {
  title: string;
  content: Content;
}

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  sections: PdfSection[];
  /** Wide tables (one column per truck — REQ-20260814) need the long edge.
   * Defaults to portrait, which every existing caller relies on. */
  orientation?: 'portrait' | 'landscape';
}

/**
 * Build a multi-section report PDF.
 */
export function buildReportPdf(options: PdfReportOptions): Promise<Buffer> {
  const { title, subtitle, generatedAt, sections, orientation = 'portrait' } = options;

  const content: Content[] = [];

  // Title
  content.push({ text: title, style: 'header' });
  if (subtitle) {
    content.push({ text: subtitle, style: 'subheader' });
  }

  // Sections
  sections.forEach((section, idx) => {
    if (idx > 0) {
      content.push({ text: '', margin: [0, 20, 0, 0] }); // spacer
    }
    content.push({
      text: section.title,
      fontSize: 14,
      bold: true,
      margin: [0, 0, 0, 10],
      color: '#1f2937',
    });
    content.push(section.content);
  });

  const docDefinition: TDocumentDefinitions = {
    content,
    styles: defaultStyles,
    defaultStyle: {
      font: 'Pretendard',
      fontSize: 10,
    },
    pageSize: 'A4',
    pageOrientation: orientation,
    pageMargins: [40, 40, 40, 60],
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: generatedAt ?? `Generated: ${new Date().toLocaleString('vi-VN')}`,
          style: 'footer',
          alignment: 'left',
        },
        {
          text: `${currentPage}/${pageCount}`,
          style: 'footer',
          alignment: 'right',
        },
      ],
      margin: [40, 0, 40, 0],
    }),
  };

  return generatePdfBuffer(docDefinition);
}

// Cache pdfMake instance to avoid re-initialization
let pdfMakeInstance: ReturnType<typeof initPdfMake> | null = null;

function initPdfMake() {
  /* Dynamic require needed for pdfmake's VFS font system - ES import breaks it */
  const pdfMake = require('pdfmake/build/pdfmake'); // eslint-disable-line
  const { pretendardVfs } = require('./fonts/pretendard-vfs.js'); // eslint-disable-line

  // Add Pretendard fonts for CJK (Korean/Vietnamese/Chinese) support
  pdfMake.addVirtualFileSystem(pretendardVfs);

  // Set up fonts - Pretendard supports Latin + CJK
  pdfMake.fonts = {
    Pretendard: {
      normal: 'Pretendard-Regular.otf',
      bold: 'Pretendard-Bold.otf',
      italics: 'Pretendard-Regular.otf', // No italic variant, use regular
      bolditalics: 'Pretendard-Bold.otf',
    },
  };

  return pdfMake;
}

/**
 * Helper to generate PDF buffer from document definition.
 * Uses pdfmake browser-style API with virtual fonts.
 */
async function generatePdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  console.log('[pdf] Starting PDF generation...');
  const startTime = Date.now();

  // Initialize pdfMake once and cache
  if (!pdfMakeInstance) {
    pdfMakeInstance = initPdfMake();
    console.log('[pdf] pdfMake initialized in', Date.now() - startTime, 'ms');
  }

  console.log('[pdf] Creating PDF document...');
  const pdfDoc = pdfMakeInstance.createPdf(docDefinition);

  console.log('[pdf] Getting buffer...');

  // Use promise-based API with timeout
  const buffer = await Promise.race([
    pdfDoc.getBuffer(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF generation timeout (30s)')), 30000)
    ),
  ]);

  console.log('[pdf] PDF generated in', Date.now() - startTime, 'ms, size:', buffer.length);
  return Buffer.from(buffer);
}

/**
 * Create a PDF response for NextResponse.
 */
export function pdfResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      /* Localized filenames reach here (Korean truck P&L), so the ASCII
       * `filename=` fallback must be sanitised — see content-disposition.ts. */
      'Content-Disposition': attachment(filename),
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Helper to build a table content for use in report sections.
 */
export function buildTableContent(
  columns: PdfColumn[],
  rows: Record<string, unknown>[],
  options?: { summaryRow?: Record<string, unknown> },
): Content {
  const tableBody: TableCell[][] = [];

  // Header row
  tableBody.push(
    columns.map((col) => ({
      text: col.header,
      style: 'tableHeader',
      alignment: col.alignment ?? 'left',
    })),
  );

  // Data rows
  rows.forEach((row, idx) => {
    const rowCells: TableCell[] = columns.map((col) => {
      const val = row[col.key];
      let text = '';
      if (val instanceof Date) {
        text = val.toLocaleDateString('vi-VN');
      } else if (val !== null && val !== undefined) {
        text = String(val);
      }
      return {
        text,
        style: 'tableCell',
        alignment: col.alignment ?? 'left',
        fillColor: idx % 2 === 1 ? '#f9fafb' : undefined,
      };
    });
    tableBody.push(rowCells);
  });

  // Optional summary row
  if (options?.summaryRow) {
    const summaryCells: TableCell[] = columns.map((col) => {
      const val = options.summaryRow![col.key];
      return {
        text: val !== null && val !== undefined ? String(val) : '',
        style: ['tableCell', 'summaryRow'],
        alignment: col.alignment ?? 'left',
      };
    });
    tableBody.push(summaryCells);
  }

  return {
    table: {
      headerRows: 1,
      widths: columns.map((c) => c.width ?? '*'),
      body: tableBody,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#e5e7eb',
      vLineColor: () => '#e5e7eb',
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  };
}
