import 'server-only';

/**
 * `attachment` Content-Disposition for a download, RFC 5987 encoded so
 * Vietnamese and Korean filenames survive.
 *
 * The plain `filename=` parameter must stay ASCII (a raw đ or 운 makes the header
 * invalid), so it carries a sanitised fallback for ancient clients while
 * `filename*=UTF-8''…` carries the real name for everything current.
 */
export function attachment(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
