# RCA: frozen model digest used a different display format than Ollama

## Symptom

The preparation gate rejected the installed qwen3:4b source before alias creation, despite the model name, size, and hexadecimal digest matching the earlier local inventory.

## Evidence

- The frozen profile stored sha256:359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7.
- Ollama GET /api/tags returned 359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7 for qwen3:4b, without the algorithm prefix.
- scripts/prepare_qwen3_4b_general006.mjs compared the two strings exactly and stopped before registering the alias.
- ollama ps remained empty, and no alias was created.

## Root Cause

The preparation script compared a canonical algorithm-prefixed digest string to Ollama's bare hexadecimal API representation without normalizing either form.

## Why the issue escaped detection

The source digest had been checked manually, but the local API representation was not exercised by the preparation script until after the setup commit.

## Proposed prevention

Validate both values as 64-character SHA-256 hex, normalize an optional sha256: prefix for comparison, and retain the canonical prefixed value in the frozen profile and manifest.
