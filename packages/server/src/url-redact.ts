/**
 * Drop query strings / fragments from URLs, and omit the local-part of
 * mailto: hrefs. Keep in sync with the browser SDK and worker url-redact.
 */

export function sanitizePublicUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('mailto:')) {
    const rest = url.slice(7).split('?')[0].split('#')[0]
    const at = rest.lastIndexOf('@')
    return at >= 0 ? `mailto:@${rest.slice(at + 1)}` : 'mailto:'
  }
  const q = url.indexOf('?')
  const h = url.indexOf('#')
  let cut = url.length
  if (q >= 0) cut = q
  if (h >= 0 && h < cut) cut = h
  return url.slice(0, cut)
}

export function sanitizePagePath(path: string): string {
  if (!path) return path
  return path.split('?')[0].split('#')[0]
}
