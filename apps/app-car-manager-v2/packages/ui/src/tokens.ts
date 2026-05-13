/* JS-accessible design tokens.
 * Source of truth for non-CSS contexts (Recharts series colors, etc.).
 * Keep in sync with tokens.css. */

export const chartColors = [
  '#2563EB', // c1 Fuel
  '#8B5CF6', // c2 Repair
  '#F59E0B', // c3 Meal
  '#0D9488', // c4 Oil
  '#EF4444', // c5 Accident
  '#0EA5E9', // c6 Parking
  '#15A36E', // c7 Toll
  '#A626E0', // c8 Inspection
] as const;

export const expenseTypeColor = {
  FUEL:       chartColors[0],
  REPAIR:     chartColors[1],
  MEAL:       chartColors[2],
  OIL:        chartColors[3],
  ACCIDENT:   chartColors[4],
  PARKING:    chartColors[5],
  TOLL:       chartColors[6],
  INSPECTION: chartColors[7],
} as const;

export const statusColor = {
  success: '#15A36E',
  warning: '#F59E0B',
  danger:  '#EF4444',
  info:    '#0EA5E9',
  purple:  '#8B5CF6',
} as const;

export const tripStatusTone = {
  PENDING_ASSIGNMENT:           'accent',
  PENDING_DRIVER_CONFIRMATION:  'warning',
  CONFIRMED:                    'success',
  IN_PROGRESS:                  'info',
  COMPLETED:                    'neutral',
  REJECTED_BY_DRIVER:           'danger',
  CANCELLED:                    'danger',
} as const;

export const expenseStatusTone = {
  DRAFT:     'neutral',
  PENDING:   'warning',
  APPROVED:  'success',
  REJECTED:  'danger',
  AUTO_APPROVED: 'success',
} as const;
