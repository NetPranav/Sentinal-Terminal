import { describe, it, expect } from 'vitest';
import { SecretRedactor } from './SecretRedactor';

describe('SecretRedactor', () => {
  describe('AWS keys', () => {
    it('redacts AWS access key IDs', () => {
      const input = 'export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:AWS_KEY]');
      expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('redacts AWS secret access keys', () => {
      const input = 'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY1';
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:AWS_SECRET]');
      expect(result).not.toContain('wJalrXUtnFEMI');
    });
  });

  describe('Bearer tokens', () => {
    it('redacts Bearer authorization tokens', () => {
      const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test.signature';
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:');
      expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    });
  });

  describe('GitHub tokens', () => {
    it('redacts GitHub personal access tokens', () => {
      const input = 'GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:');
      expect(result).not.toContain('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    });
  });

  describe('GitLab tokens', () => {
    it('redacts GitLab personal access tokens', () => {
      const input = 'token: glpat-xxxxxxxxxxxxxxxxxxxx';
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:GITLAB_TOKEN]');
      expect(result).not.toContain('glpat-');
    });
  });

  describe('.env-style secrets', () => {
    it('redacts API key assignments', () => {
      const input = 'API_KEY=sk-1234567890abcdef';
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:SECRET_VALUE]');
      expect(result).not.toContain('sk-1234567890abcdef');
    });

    it('redacts password assignments', () => {
      const input = 'password = "my_super_secret_pass"';
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:SECRET_VALUE]');
    });

    it('redacts token assignments with colons', () => {
      const input = 'auth_token: abcdef123456789';
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:SECRET_VALUE]');
    });

    it('redacts client_secret values', () => {
      const input = 'client_secret="xyzpdq-secret-value-42"';
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:SECRET_VALUE]');
    });
  });

  describe('SSH private keys', () => {
    it('redacts RSA private key blocks', () => {
      const input = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8TESTING
-----END RSA PRIVATE KEY-----`;
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:SSH_PRIVATE_KEY]');
      expect(result).not.toContain('MIIEowIBAAKCAQEA');
    });

    it('redacts OpenSSH private key blocks', () => {
      const input = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAA
-----END OPENSSH PRIVATE KEY-----`;
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:SSH_PRIVATE_KEY]');
    });
  });

  describe('JWT tokens', () => {
    it('redacts JWT tokens', () => {
      const input = 'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:');
    });
  });

  describe('Slack webhooks', () => {
    it('redacts Slack webhook URLs', () => {
      const input = 'WEBHOOK=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX';
      const result = SecretRedactor.redact(input);
      expect(result).toContain('[REDACTED:SLACK_WEBHOOK]');
    });
  });

  describe('safe text passthrough', () => {
    it('does not redact normal text', () => {
      const input = 'ls -la /home/user && echo "hello world"';
      const result = SecretRedactor.redact(input);
      expect(result).toBe(input);
    });

    it('does not redact normal environment variables', () => {
      const input = 'PATH=/usr/bin:/usr/local/bin HOME=/home/user';
      const result = SecretRedactor.redact(input);
      expect(result).toBe(input);
    });

    it('handles empty and null input', () => {
      expect(SecretRedactor.redact('')).toBe('');
      expect(SecretRedactor.redact(null as any)).toBe(null);
      expect(SecretRedactor.redact(undefined as any)).toBe(undefined);
    });
  });

  describe('containsSecrets', () => {
    it('returns true for text with AWS keys', () => {
      expect(SecretRedactor.containsSecrets('key AKIAIOSFODNN7EXAMPLE here')).toBe(true);
    });

    it('returns false for normal text', () => {
      expect(SecretRedactor.containsSecrets('ls -la /home')).toBe(false);
    });

    it('returns false for empty input', () => {
      expect(SecretRedactor.containsSecrets('')).toBe(false);
    });
  });

  describe('redactObject', () => {
    it('redacts secrets in nested objects and arrays', () => {
      const input = {
        cmd: 'curl -H "Authorization: Bearer my-secret-token" https://api.com',
        env: {
          AWS_KEY: 'AKIAIOSFODNN7EXAMPLE',
          PORT: 3000
        },
        list: ['safe', 'password="my-password-123"']
      };

      const redacted = SecretRedactor.redactObject(input);
      expect(redacted.cmd).toContain('[REDACTED:');
      expect(redacted.cmd).not.toContain('my-secret-token');
      expect(redacted.env.AWS_KEY).toContain('[REDACTED:AWS_KEY]');
      expect(redacted.env.AWS_KEY).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(redacted.env.PORT).toBe(3000);
      expect(redacted.list[0]).toBe('safe');
      expect(redacted.list[1]).toContain('[REDACTED:SECRET_VALUE]');
    });

    it('handles primitives, null, and undefined gracefully', () => {
      expect(SecretRedactor.redactObject(null)).toBeNull();
      expect(SecretRedactor.redactObject(undefined)).toBeUndefined();
      expect(SecretRedactor.redactObject(123)).toBe(123);
      expect(SecretRedactor.redactObject(true)).toBe(true);
    });
  });
});
