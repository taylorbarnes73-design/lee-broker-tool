# Brand Create Workflow

Use this workflow for `/brand create` to create a brand guidelines file for a new project.

## Steps

1. Copy `templates/brand-guidelines-starter.md` to `docs/brand-guidelines.md` if no guidelines file exists.
2. Replace placeholder dates, voice traits, colors, typography, logo rules, and example prompts.
3. Keep Quick Reference values aligned with the detailed color palette sections.
4. Run `scripts/sync-brand-to-tokens.cjs --dry-run` to verify primary, secondary, and accent extraction.
5. Run `scripts/sync-brand-to-tokens.cjs` after the guidelines are complete.

## Output

Create or update `docs/brand-guidelines.md`, then summarize the selected brand foundations and any missing decisions.
