import { describe, it, expect } from 'vitest';
import { EntityMatcher } from '../helpers/EntityMatcher';
import { StringNormalizer } from '../helpers/StringNormalizer';

describe('AI Foundation Tests', () => {
  it('should normalize strings properly', () => {
    expect(StringNormalizer.normalize('  HELLO World! 123  ')).toBe('hello world 123');
  });

  it('should extract IPs via EntityMatcher', () => {
    const res = EntityMatcher.match('Connect to 192.168.1.5 via ssh');
    expect(res.length).toBe(1);
    expect(res[0].type).toBe('ip');
    expect(res[0].value).toBe('192.168.1.5');
  });
});
