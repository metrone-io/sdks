import { sanitizePublicUrl } from '../core/Metrone'

describe('sanitizePublicUrl', () => {
  it('strips query strings and mailto local-parts', () => {
    expect(sanitizePublicUrl('https://example.com/a?email=x@y.com')).toBe('https://example.com/a')
    expect(sanitizePublicUrl('mailto:jane@staff.example?subject=Hi')).toBe('mailto:@staff.example')
    expect(sanitizePublicUrl('/spec.pdf?e=1&s=sig')).toBe('/spec.pdf')
    expect(sanitizePublicUrl('tel:+15551212')).toBe('tel:+15551212')
  })
})
