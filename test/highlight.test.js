import { describe, expect, it } from 'vitest';
import { LANGS, tokenize } from '../src/highlight.js';

const kinds = (lang, text) => tokenize(lang, text).map(t => [text.slice(t.a, t.b), t.k]);

describe('tokenize', () => {
  it('knows every language the app offers', () => {
    expect(Object.keys(LANGS).sort()).toEqual(['c', 'cs', 'css', 'html', 'java', 'js', 'json', 'py', 'sql', 'xaml']);
  });
  it('highlights JavaScript keywords, strings, numbers and comments', () => {
    const k = kinds('js', 'const x = "a"; // hi\nlet y = 42;');
    expect(k).toContainEqual(['const', 'kw']);
    expect(k).toContainEqual(['"a"', 'str']);
    expect(k).toContainEqual(['// hi', 'com']);
    expect(k).toContainEqual(['42', 'num']);
  });
  it('does not treat a keyword inside a word as a keyword', () => {
    expect(kinds('js', 'constant')).toEqual([]);
  });
  it('highlights Python comments, decorators and triple-quoted strings', () => {
    const k = kinds('py', '@app.route\ndef f():\n    """doc"""  # note');
    expect(k).toContainEqual(['@app.route', 'fn']);
    expect(k).toContainEqual(['def', 'kw']);
    expect(k).toContainEqual(['"""doc"""', 'str']);
    expect(k).toContainEqual(['# note', 'com']);
  });
  it('highlights C# keywords and verbatim strings', () => {
    const k = kinds('cs', 'public class A { string s = @"x""y"; }');
    expect(k).toContainEqual(['public', 'kw']);
    expect(k).toContainEqual(['class', 'kw']);
    expect(k).toContainEqual(['@"x""y"', 'str']);
  });
  it('highlights XAML tags, attributes and bindings', () => {
    const k = kinds('xaml', '<Button Content="{Binding Name}" />');
    expect(k).toContainEqual(['<Button', 'tag']);
    expect(k).toContainEqual(['Content', 'attr']);
    expect(k.some(([, c]) => c === 'str')).toBe(true);
  });
  it('highlights HTML comments and tags', () => {
    const k = kinds('html', '<!-- c --><div class="a"></div>');
    expect(k).toContainEqual(['<!-- c -->', 'com']);
    expect(k).toContainEqual(['<div', 'tag']);
  });
  it('highlights CSS properties and colors', () => {
    const k = kinds('css', 'a { color: #fff; margin: 4px }');
    expect(k).toContainEqual(['color', 'attr']);
    expect(k).toContainEqual(['#fff', 'num']);
    expect(k).toContainEqual(['4px', 'num']);
  });
  it('matches SQL keywords regardless of case', () => {
    const k = kinds('sql', "SELECT name FROM t WHERE id = 1 -- x");
    expect(k).toContainEqual(['SELECT', 'kw']);
    expect(k).toContainEqual(['FROM', 'kw']);
    expect(k).toContainEqual(['-- x', 'com']);
  });
  it('separates JSON keys from string values', () => {
    const k = kinds('json', '{"a": "b", "n": 3, "ok": true}');
    expect(k).toContainEqual(['"a"', 'attr']);
    expect(k).toContainEqual(['"b"', 'str']);
    expect(k).toContainEqual(['true', 'kw']);
  });
  it('covers C and Java/Kotlin', () => {
    expect(kinds('c', '#include <x.h>\nint main() { return 0; }')).toContainEqual(['int', 'kw']);
    expect(kinds('java', 'fun main() { val x = 1 }')).toContainEqual(['fun', 'kw']);
  });
  it('terminates on unterminated strings and comments', () => {
    expect(() => tokenize('js', '"abc')).not.toThrow();
    expect(() => tokenize('js', '/* never closed')).not.toThrow();
  });
  it('falls back to JavaScript for an unknown language', () => {
    expect(kinds('nope', 'let a')).toContainEqual(['let', 'kw']);
  });
});
