# Security Policy

## Project status

Fidus is an educational, open-source portfolio project. **It has not been
independently audited.** Do not use it to protect real credentials until it
has been reviewed by qualified security professionals and reaches a stable
release.

## Supported versions

Only the latest commit on the `main` branch is supported. There are no
released versions yet.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through GitHub's private vulnerability reporting:
<https://github.com/joaodanielski/fidus/security/advisories/new>

A useful report includes:

- a description of the issue and its security impact;
- the affected component or file, and the commit you tested;
- steps to reproduce, or a proof of concept;
- any suggested mitigation.

Please do not include real user data or real credentials in a report.

## What to expect

This is a one-person project, so response times are best effort. I will try to
acknowledge a report within a reasonable time, keep you informed about the
progress, and credit you in the advisory if you wish.

Please give me a reasonable opportunity to fix the issue before disclosing it
publicly.

## Scope

In scope: flaws in the cryptographic design or implementation, authentication
and key-handling logic, client-side data exposure, injection and XSS, and
vulnerable dependencies.

Out of scope: weak master passwords chosen by the user, a device already
compromised by malware or a keylogger, and social engineering. These are
documented in the threat model.