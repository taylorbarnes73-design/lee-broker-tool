# Office templates (Quick convert)

## LANB letterhead

Bundled file: `lanb-letterhead-copy.doc` (and `lanb-letterhead-copy.docx` generated via macOS `textutil` when maintaining assets).

Source of truth for brokers: OneDrive  
`TB ONEDRIVE/Blank Forms/LANB Letterhead copy.doc`

To refresh the bundled copy from OneDrive:

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
| Letterhead PDF cover | LibreOffice to rasterize the template, or a generated fallback cover |

Without LibreOffice, **Convert to PDF** and **letterhead** return a clear error for non-PDF Word uploads.
