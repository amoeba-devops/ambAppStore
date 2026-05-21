import { getTranslations } from 'next-intl/server';
import { Calendar, IdCard, Phone } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardHeaderText, CardTitle } from '@car-v2/ui';
import type { CarDriverLicenseClass, CarDriverStatus } from '@car-v2/db/schema';

interface MeLicenseCardProps {
  licenseNumber: string;
  licenseClass: CarDriverLicenseClass;
  /* Drizzle `date` type comes back as string `YYYY-MM-DD`. We parse here. */
  licenseExpiry: string;
  phone: string | null;
  status: CarDriverStatus;
}

/* Driver-only license card. Renders nothing for admin/manager (suppressed at
 * the page level since `getDriverByUserId` returns null for non-drivers).
 *
 * Expiry badge color tracks "days until expired":
 *   ≤ 0 days  → danger ("expired")
 *   ≤ 30 days → warning ("expiring soon")
 *   else      → success */
export async function MeLicenseCard({
  licenseNumber,
  licenseClass,
  licenseExpiry,
  phone,
  status,
}: MeLicenseCardProps) {
  const tMe       = await getTranslations('settings.me');
  const tStatus   = await getTranslations('drivers.status');
  const tDList    = await getTranslations('drivers.list');

  const daysUntilExpiry = daysBetween(new Date(), new Date(licenseExpiry));
  const expiryTone: 'danger' | 'warning' | 'success' =
    daysUntilExpiry < 0 ? 'danger' : daysUntilExpiry <= 30 ? 'warning' : 'success';

  return (
    <Card>
      <CardHeader>
        <CardHeaderText>
          <CardTitle>{tMe('licenseTitle')}</CardTitle>
        </CardHeaderText>
        <Badge tone={STATUS_TONE[status]} size="sm">{tStatus(status)}</Badge>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          <Row icon={<IdCard />} label={tMe('licenseNumber')} value={licenseNumber} mono />
          <Row label={tMe('licenseClass')} value={tDList('classLabel', { class: licenseClass })} />
          <div className="col-span-2">
            <dt className="text-xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              {tMe('licenseExpiry')}
            </dt>
            <dd className="flex items-center gap-2">
              <span className="font-medium text-text tabular">{formatDate(licenseExpiry)}</span>
              <Badge tone={expiryTone} size="sm">
                {daysUntilExpiry < 0
                  ? tMe('licenseExpired')
                  : tMe('licenseDaysLeft', { n: daysUntilExpiry })}
              </Badge>
            </dd>
          </div>
          {phone && (
            <Row icon={<Phone />} label={tMe('licensePhone')} value={phone} mono />
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({ icon, label, value, mono }: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted mb-1 flex items-center gap-1.5">
        {icon && <span className="[&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden>{icon}</span>}
        {label}
      </dt>
      <dd className={mono ? 'font-mono tabular text-text font-medium' : 'text-text font-medium'}>
        {value}
      </dd>
    </div>
  );
}

function daysBetween(a: Date, b: Date): number {
  const aMid = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bMid = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((bMid - aMid) / 86_400_000);
}

function formatDate(iso: string): string {
  /* `YYYY-MM-DD` is locale-agnostic on the wire; we display in dd/MM/yyyy for
   * VN-default audience. en-GB happens to match that exact format. */
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

const STATUS_TONE: Record<CarDriverStatus, 'success' | 'info' | 'warning' | 'danger'> = {
  AVAILABLE: 'success',
  ON_TRIP: 'info',
  OFF_DUTY: 'warning',
  UNAVAILABLE: 'danger',
};
