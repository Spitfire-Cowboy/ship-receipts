# Changelog

All notable changes to this project will be documented in this file.

The format is based on *Keep a Changelog*, and this project aims to follow Semantic Versioning when releases are cut.

## [Unreleased]

### Added
- Add optional top-level metadata: `receipt_id`, `issued_at`, and `issuer`.
- Add optional artifact-level `claims` and `provenance` blocks for source-attributed claims and supply-chain pointers.
- Add optional `source` and `observed_at` fields to `verify` entries.
- Add optional `signals.as_of`, `signals.sources`, and `signals.methodology` fields.
- Add a public export leak scanner plus tests to catch private paths and stale repo URLs before release.
- Add release guardrail tests for `prepublishOnly`, export checks, and package dry-run coverage.

### Changed
- Add URI/date-time validation formats for common URL and timestamp fields.
- Update example receipt and README with anti-gaming/provenance guidance.
- Clarify public-facing verifier references to avoid linking to non-public or legacy repo URLs.
- Run export safety, example anonymization, and `npm pack --dry-run` in release automation and publish prep.
- Fill in npm package metadata for homepage, repository, issue tracker, and search keywords.

### Fixed

## [0.0.0] - YYYY-MM-DD

Initial placeholder.
