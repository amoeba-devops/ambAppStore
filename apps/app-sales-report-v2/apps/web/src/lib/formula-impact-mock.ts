/**
 * Mock impact analysis — once we have a real lineage graph this becomes a
 * dependency walk. For now, infer impacted surfaces from metric name keywords.
 */

export interface ImpactAnalysis {
  reports: string[];
  sections: string[];
  charts: string[];
}

export function getImpactAnalysis(metric: string): ImpactAnalysis {
  const m = metric.toLowerCase();
  const reports = new Set<string>();
  const sections = new Set<string>();
  const charts = new Set<string>();

  // Almost any metric change touches all 3 standard reports
  reports.add('Weekly Report');
  reports.add('Monthly Report');
  reports.add('Trend Report');

  if (/(gmv|nmv|item sold|page view)/i.test(m)) {
    sections.add('Overview');
    sections.add('KPI Cards');
  }
  if (/(discount|voucher)/i.test(m)) {
    sections.add('Discount Breakdown');
  }
  if (/(ad spending|brand ads|affiliate|livestream|platform fee|off-platform)/i.test(m)) {
    sections.add('Ads Breakdown');
  }
  if (/(prime cost|free gift|contribution margin)/i.test(m)) {
    sections.add('Cost Breakdown');
    sections.add('CM Card');
  }
  if (sections.size === 0) sections.add('Overview');

  // Charts (rough mapping)
  if (/(gmv|nmv)/i.test(m)) charts.add('Net GMV bar chart');
  if (/(contribution margin)/i.test(m)) charts.add('CM line chart');
  if (/(page view|item sold|conversion)/i.test(m)) charts.add('Traffic line chart');
  if (/(ad spending|brand|affiliate)/i.test(m)) charts.add('Ad Spend bar chart');
  if (charts.size === 0) charts.add('Trend line chart');

  return {
    reports: Array.from(reports),
    sections: Array.from(sections),
    charts: Array.from(charts),
  };
}
