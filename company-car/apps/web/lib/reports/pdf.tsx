import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { CostType, Language } from '@repo/api-types';
import { labelsFor } from './labels';
import type { CostExportRow, TripExportRow } from '@/lib/services/report.service';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: '#666', marginBottom: 12 },
  table: { display: 'flex', flexDirection: 'column', borderTop: '1px solid #ddd' },
  row: { flexDirection: 'row', borderBottom: '1px solid #eee', paddingVertical: 4 },
  headerRow: { backgroundColor: '#2563eb' },
  headerCell: { color: '#fff', fontWeight: 700, padding: 4 },
  cell: { padding: 4 },
  total: { marginTop: 12, fontSize: 11, fontWeight: 700, alignSelf: 'flex-end' },
});

function fmtMoney(amount: string | number, currency: string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  return `${n.toLocaleString()} ${currency}`;
}

const fx = (w: number) => ({ flex: w });

export async function buildCostsPdf(args: {
  rows: CostExportRow[];
  from: string;
  to: string;
  lang: Language;
}): Promise<Buffer> {
  const t = labelsFor(args.lang);

  let total = 0;
  for (const r of args.rows) {
    if (r.status === 'APPROVED' || r.status === 'SUBMITTED') total += Number(r.amount);
  }

  const doc = (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <Text style={styles.title}>{t.title.costs}</Text>
        <Text style={styles.meta}>
          {t.period}: {args.from} → {args.to} · {t.generatedAt}: {new Date().toISOString().slice(0, 16).replace('T', ' ')}
        </Text>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.headerCell, fx(1.2)]}>{t.columns.date}</Text>
            <Text style={[styles.headerCell, fx(1.5)]}>{t.columns.type}</Text>
            <Text style={[styles.headerCell, fx(1.2)]}>{t.columns.vehicle}</Text>
            <Text style={[styles.headerCell, fx(1.5)]}>{t.columns.amount}</Text>
            <Text style={[styles.headerCell, fx(1)]}>{t.columns.status}</Text>
            <Text style={[styles.headerCell, fx(1.8)]}>{t.columns.submitter}</Text>
            <Text style={[styles.headerCell, fx(2.5)]}>{t.columns.description}</Text>
          </View>
          {args.rows.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.cell, fx(1.2)]}>{r.costDate}</Text>
              <Text style={[styles.cell, fx(1.5)]}>{t.costType[r.type as CostType]}</Text>
              <Text style={[styles.cell, fx(1.2)]}>{r.licensePlate}</Text>
              <Text style={[styles.cell, fx(1.5)]}>{fmtMoney(r.amount, r.currency)}</Text>
              <Text style={[styles.cell, fx(1)]}>{r.status}</Text>
              <Text style={[styles.cell, fx(1.8)]}>{r.submitterName}</Text>
              <Text style={[styles.cell, fx(2.5)]}>{r.description ?? ''}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.total}>
          {t.columns.total}: {total.toLocaleString()} VND
        </Text>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}

export async function buildTripsPdf(args: {
  rows: TripExportRow[];
  from: string;
  to: string;
  lang: Language;
}): Promise<Buffer> {
  const t = labelsFor(args.lang);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <Text style={styles.title}>{t.title.trips}</Text>
        <Text style={styles.meta}>{t.period}: {args.from} → {args.to}</Text>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.headerCell, fx(1)]}>{t.columns.date}</Text>
            <Text style={[styles.headerCell, fx(0.8)]}>{t.columns.time}</Text>
            <Text style={[styles.headerCell, fx(1.5)]}>{t.columns.passenger}</Text>
            <Text style={[styles.headerCell, fx(1.5)]}>{t.columns.driver}</Text>
            <Text style={[styles.headerCell, fx(1)]}>{t.columns.vehicle}</Text>
            <Text style={[styles.headerCell, fx(2)]}>{t.columns.pickup}</Text>
            <Text style={[styles.headerCell, fx(2)]}>{t.columns.destination}</Text>
            <Text style={[styles.headerCell, fx(1.2)]}>{t.columns.status}</Text>
          </View>
          {args.rows.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.cell, fx(1)]}>{r.tripDate}</Text>
              <Text style={[styles.cell, fx(0.8)]}>{r.tripTime}</Text>
              <Text style={[styles.cell, fx(1.5)]}>{r.passengerName}</Text>
              <Text style={[styles.cell, fx(1.5)]}>{r.driverName}</Text>
              <Text style={[styles.cell, fx(1)]}>{r.licensePlate}</Text>
              <Text style={[styles.cell, fx(2)]}>{r.pickupAddress}</Text>
              <Text style={[styles.cell, fx(2)]}>{r.destinationAddress}</Text>
              <Text style={[styles.cell, fx(1.2)]}>{r.status}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}

export async function buildSingleTypePdf(args: {
  rows: Array<CostExportRow & { attachments: number }>;
  from: string;
  to: string;
  lang: Language;
  type: CostType;
}): Promise<Buffer> {
  const t = labelsFor(args.lang);

  let total = 0;
  for (const r of args.rows) {
    if (r.status === 'APPROVED' || r.status === 'SUBMITTED') total += Number(r.amount);
  }

  const titleKey: Record<CostType, keyof typeof t.title> = {
    FUEL: 'costs',
    OIL_CHANGE: 'costs',
    MEAL: 'costs',
    ACCIDENT: 'accidents',
    REPAIR_MAINTENANCE: 'repairs',
  };

  const doc = (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        <Text style={styles.title}>{t.title[titleKey[args.type]]}</Text>
        <Text style={styles.meta}>{t.period}: {args.from} → {args.to}</Text>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.headerCell, fx(1.2)]}>{t.columns.date}</Text>
            <Text style={[styles.headerCell, fx(1.5)]}>{t.columns.vehicle}</Text>
            <Text style={[styles.headerCell, fx(1.5)]}>{t.columns.amount}</Text>
            <Text style={[styles.headerCell, fx(1)]}>{t.columns.status}</Text>
            <Text style={[styles.headerCell, fx(1.5)]}>{t.columns.submitter}</Text>
            <Text style={[styles.headerCell, fx(3)]}>{t.columns.description}</Text>
            <Text style={[styles.headerCell, fx(0.8)]}>{t.columns.attachments}</Text>
          </View>
          {args.rows.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.cell, fx(1.2)]}>{r.costDate}</Text>
              <Text style={[styles.cell, fx(1.5)]}>{r.licensePlate}</Text>
              <Text style={[styles.cell, fx(1.5)]}>{fmtMoney(r.amount, r.currency)}</Text>
              <Text style={[styles.cell, fx(1)]}>{r.status}</Text>
              <Text style={[styles.cell, fx(1.5)]}>{r.submitterName}</Text>
              <Text style={[styles.cell, fx(3)]}>
                {r.description ?? JSON.stringify(r.metadata)}
              </Text>
              <Text style={[styles.cell, fx(0.8)]}>{r.attachments}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.total}>
          {t.columns.total}: {total.toLocaleString()} VND
        </Text>
      </Page>
    </Document>
  );

  return await renderToBuffer(doc);
}
