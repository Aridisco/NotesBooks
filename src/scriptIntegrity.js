// SHA-384 of the pinned CDN responses; update and verify these when upgrading a library.
export const SCRIPT_INTEGRITY = {
  'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js': 'sha384-KKWa9jJ1MZvssLeOoXG6FiOAZfAgmzsIIfw8BXwI9+kYm0lPCbC6yTQPBC00F1/L',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/nerdamer.core.js': 'sha384-xQSEWC9U3TkEcP2wa+TfVlioD35y0B9w5UDICbHR1VbBRt/Sta9vVtiI7OipX2YP',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Algebra.js': 'sha384-Fe6m/6uHCTl86ItmvzSPYPzE16B0zARqm1Bo5Z8oKGHcnQnvkBe0hYavSadUjSqV',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Calculus.js': 'sha384-zEv30J3CdpM8w5+WYPmcuv8lUhq3n8qzbDYU3sbZqHluSTmdsjJMBHJWHoqw6Cla',
  'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/Solve.js': 'sha384-Cd8aK9hE0bOs/4mmDSGOQ3XiHDSs4LMlFFpd8/SzTbVyr07tooiOnw2wkA4D2Off',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js': 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js': 'sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2'
};

export function integrityFor(url) {
  if (!Object.hasOwn(SCRIPT_INTEGRITY, url)) throw new Error('Unpinned external script: ' + url);
  return SCRIPT_INTEGRITY[url];
}
