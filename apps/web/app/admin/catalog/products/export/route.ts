import { NextRequest, NextResponse } from 'next/server';
import { createRepositories } from '@repo/database';
import { requirePermission } from '@/lib/actions/auth';
import { formatPrice, formatDate } from '@/lib/format';
import PDFDocument from 'pdfkit';
import * as PDFKit from 'pdfkit';
import Helvetica from 'pdfkit/standard-fonts/Helvetica';
import HelveticaBold from 'pdfkit/standard-fonts/HelveticaBold';

// PDFKit 0.21 can be bundled without its package-relative font directory.
// Register the only standard fonts this route uses so PDF generation does not
// depend on whether the deployment bundler kept pdfkit external.
const { registerStdFonts } = PDFKit as unknown as {
  registerStdFonts: (...fonts: unknown[]) => void;
};
registerStdFonts(Helvetica, HelveticaBold);

// pdfkit needs Node's Buffer/fs, so this route can't run on the Edge runtime.
export const runtime = 'nodejs';
// The list changes whenever a product is added, renamed or hidden, so this
// must never be served from a cache.
export const dynamic = 'force-dynamic';

const PAGE_MARGIN = 40;
// Gap reserved at the end of each column, so a right-aligned value (Price,
// Stock) doesn't butt straight up against the next column's text with no
// visible space between them.
const COLUMN_GUTTER = 10;
// Column widths across the page, in points. They add up to the usable width
// of an A4 page at this margin (595.28 - 2 * 40 ≈ 515).
const COLUMNS = [
  { key: 'name', label: 'Product', width: 155, align: 'left' as const },
  { key: 'brand', label: 'Brand', width: 65, align: 'left' as const },
  { key: 'category', label: 'Category', width: 75, align: 'left' as const },
  { key: 'price', label: 'Price', width: 65, align: 'right' as const },
  { key: 'stock', label: 'Stock', width: 45, align: 'right' as const },
  { key: 'storefront', label: 'Storefront', width: 55, align: 'left' as const },
  { key: 'featured', label: 'Featured', width: 55, align: 'left' as const },
];

type ExportRow = {
  name: string;
  brand: string;
  category: string;
  price: string;
  stock: string;
  storefront: string;
  featured: string;
};

function drawTableHeader(doc: PDFKit.PDFDocument, x: number, y: number): number {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111');
  let cx = x;
  for (const col of COLUMNS) {
    doc.text(col.label, cx, y, { width: col.width - COLUMN_GUTTER, align: col.align, lineBreak: false });
    cx += col.width;
  }
  const lineY = y + 14;
  doc
    .moveTo(x, lineY)
    .lineTo(x + COLUMNS.reduce((sum, c) => sum + c.width, 0), lineY)
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .stroke();
  return lineY + 6;
}

function drawRow(doc: PDFKit.PDFDocument, x: number, y: number, row: ExportRow): number {
  doc.font('Helvetica').fontSize(8.5).fillColor('#1a1a1a');
  const textWidths = COLUMNS.map((col) => col.width - COLUMN_GUTTER);
  const heights = COLUMNS.map((col, i) =>
    doc.heightOfString(row[col.key as keyof ExportRow], { width: textWidths[i], align: col.align })
  );
  const rowHeight = Math.max(12, ...heights);
  let cx = x;
  for (const [i, col] of COLUMNS.entries()) {
    const text = row[col.key as keyof ExportRow];
    doc.text(text, cx, y, { width: textWidths[i], align: col.align });
    cx += col.width;
  }
  return y + rowHeight + 6;
}

async function renderProductsPdf(opts: {
  rows: ExportRow[];
  subtitle: string;
  generatedAt: Date;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const tableX = PAGE_MARGIN;
    const pageBottom = doc.page.height - PAGE_MARGIN;

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111111').text('Prime Accessories Kenya', tableX, PAGE_MARGIN);
    doc.font('Helvetica').fontSize(11).fillColor('#444444').text(opts.subtitle, tableX, doc.y + 2);
    doc
      .fontSize(9)
      .fillColor('#777777')
      .text(
        `Generated ${formatDate(opts.generatedAt)} · ${opts.rows.length} product${opts.rows.length === 1 ? '' : 's'}`,
        tableX,
        doc.y + 2
      );

    let y = drawTableHeader(doc, tableX, doc.y + 14);

    if (opts.rows.length === 0) {
      doc.font('Helvetica').fontSize(9.5).fillColor('#777777').text('No products match these filters.', tableX, y);
    }

    for (const row of opts.rows) {
      if (y > pageBottom - 20) {
        doc.addPage();
        y = drawTableHeader(doc, tableX, PAGE_MARGIN);
      }
      y = drawRow(doc, tableX, y, row);
    }

    doc.end();
  });
}

export async function GET(request: NextRequest) {
  await requirePermission('products.read');

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const brandId = searchParams.get('brand') || undefined;
  const categoryId = searchParams.get('category') || undefined;
  const statusFilter = searchParams.get('status') || undefined;
  const featuredFilter = searchParams.get('featured') || undefined;
  const visibilityParam = searchParams.get('visibility') || undefined;

  // Same mapping the products page itself uses, so the PDF always matches
  // whichever tab and filters the admin had open when they clicked Download.
  const visibility: 'visible' | 'hidden' | undefined =
    visibilityParam === 'visible' || statusFilter === 'active'
      ? 'visible'
      : visibilityParam === 'hidden' || statusFilter === 'inactive'
        ? 'hidden'
        : undefined;
  const isActive =
    statusFilter === 'archived' ? undefined : visibility === 'visible' ? true : visibility === 'hidden' ? false : undefined;
  const isFeatured = featuredFilter === 'true' ? true : featuredFilter === 'false' ? false : undefined;

  const repos = createRepositories();
  const [products, brand, category] = await Promise.all([
    repos.product.adminFindAllForExport({
      search,
      brandId,
      categoryId,
      isActive,
      isFeatured,
      status: statusFilter === 'draft' ? 'draft' : statusFilter === 'archived' ? 'archived' : undefined,
    }),
    brandId ? repos.brand.findById(brandId) : Promise.resolve(null),
    categoryId ? repos.category.findById(categoryId) : Promise.resolve(null),
  ]);

  const subtitleParts: string[] = [
    statusFilter === 'archived'
      ? 'Trash'
      : visibility === 'visible'
        ? 'Visible products'
        : visibility === 'hidden'
          ? 'Hidden products'
          : 'All products',
  ];
  if (brand) subtitleParts.push(`Brand: ${brand.name}`);
  if (category) subtitleParts.push(`Category: ${category.name}`);
  if (statusFilter === 'draft') subtitleParts.push('Draft only');
  if (isFeatured === true) subtitleParts.push('Featured only');
  if (isFeatured === false) subtitleParts.push('Not featured');
  if (search) subtitleParts.push(`Search: "${search}"`);

  const rows: ExportRow[] = products.map((product) => ({
    name: product.name,
    brand: product.brand?.name ?? '—',
    category: product.category?.name ?? '—',
    price: formatPrice(product.basePrice),
    stock: String(product.availableStock),
    storefront: product.deletedAt ? 'In trash' : product.isActive ? 'Visible' : 'Hidden',
    featured: product.isFeatured ? 'Yes' : '—',
  }));

  const pdfBuffer = await renderProductsPdf({
    rows,
    subtitle: subtitleParts.join(' · '),
    generatedAt: new Date(),
  });

  const filenameSuffix = statusFilter === 'archived' ? 'trash' : (visibility ?? 'all');
  const filename = `prime-accessories-kenya-products-${filenameSuffix}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    },
  });
}
