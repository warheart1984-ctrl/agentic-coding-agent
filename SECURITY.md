# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in Nova, please report it responsibly.

**Do NOT** open a public issue for security vulnerabilities.

Instead, please send an email to: security@example.com

Include:
- A description of the vulnerability
- Steps to reproduce the issue
- Any potential impact or exploit scenarios

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.0-mission-002 | ✅ |
| < 0.2.0 | ❌ |

## Security Principles

Nova is designed with constitutional governance at its core:

1. **Lawful Execution**: All actions pass through CRK-2 legality checks
2. **Immutable Ledger**: All actions are recorded in an append-only ledger
3. **Invariant Enforcement**: System invariants are checked before and after operations
4. **Continuity Preservation**: System state and identity are preserved across operations

## Known Security Considerations

- **Observer Bundle**: The Mission #002 observer bundle has a verified SHA-256 hash. Always verify bundle integrity before use.
- **API Keys**: Never commit API keys or secrets. Use environment variables.
- **Runtime Access**: The governed runtime should be deployed with appropriate access controls.

## Dependency Security

We regularly update dependencies to address known vulnerabilities. CI includes automated dependency scanning where available.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
