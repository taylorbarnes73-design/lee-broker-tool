# Office templates (Quick convert)

## LANB letterhead

Primary bundled file: `lanb-letterhead.dotx` (Word template from OneDrive Blank Forms).

Fallback copies: `lanb-letterhead-copy.doc` / `lanb-letterhead-copy.docx`.

Source of truth for brokers: OneDrive  
`TB ONEDRIVE/Blank Forms/LANB Letterhead.dotx`

To refresh the bundled copy from OneDrive:

```bash
cp "/Users/<you>/Library/CloudStorage/OneDrive-Lee&Associates/TB ONEDRIVE/Blank Forms/LANB Letterhead.dotx" \
  server/assets/templates/lanb-letterhead.dotx
```

Optional legacy fallback:

```bash
cp "/Users/<you>/Library/CloudStorage/OneDrive-Lee&Associates/TB ONEDRIVE/Blank Forms/LANB Letterhead copy.doc" \
  server/assets/templates/lanb-letterhead-copy.doc
textutil -convert docx -output server/assets/templates/lanb-letterhead-copy.docx \
  server/assets/templates/lanb-letterhead-copy.doc
```

Admins can also upload a replacement under **Settings → Letterhead template** (`branding.letterhead_template_url`).

## Server requirements

| Feature | Requirement |
|--------|-------------|
| Word → PDF | LibreOffice (`soffice`) on PATH or `QUICK_CONVERT_SOFFICE_PATH` |
| `.doc` on macOS | Optional `textutil` (converts to `.docx` before LibreOffice) |
| Letterhead PDF cover | LibreOffice to rasterize the template on first use, or pre-generate `lanb-letterhead.pdf` |

Without LibreOffice, **Convert to PDF** and **letterhead** return a clear error for non-PDF Word uploads.
