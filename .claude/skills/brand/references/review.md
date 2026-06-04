# Brand Review Workflow

Use this workflow for `/brand review` to audit existing brand materials against the project guidelines.

## Inputs

- `docs/brand-guidelines.md` as the source of truth
- Target copy, designs, or assets supplied in the prompt
- Asset manifest and files under `.assets/` or `assets/`, when relevant

## Steps

1. Load `docs/brand-guidelines.md` and the relevant topical references.
2. Compare the supplied material against color, typography, logo, voice, and messaging rules.
3. Run `scripts/validate-asset.cjs <asset-path>` for any referenced files.
4. Report findings ordered by severity with concrete file or asset references.
5. Suggest the smallest corrections needed to restore brand consistency.

## Output

Return a concise review with issues first, followed by any assumptions or validation gaps.
