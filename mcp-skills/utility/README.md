# Utility Skills

This directory contains utility skills for managing documents, such as reflowing PDFs and converting Markdown to PDF.

**⚠️ IMPORTANT DOCKER PATH WARNING:**
Because the MCP server runs inside a Docker container, any tools that require local file paths (e.g., input files or output destinations) MUST reference the mounted volume `/app/data/`. Do not use arbitrary absolute paths from the host machine (e.g., `/Users/name/...`).
All input files should be placed inside the `data/` directory of the project, and the tool should be given paths like `/app/data/my_file.pdf` or `data/my_file.pdf` depending on the working directory resolution, but using absolute paths like `/app/data/...` is safest.

## Available Skills

### Reflow PDF

- **Description**: Reflow a two-column scientific PDF into a single column with a larger font size. Highly recommended before uploading a research paper to the reMarkable tablet for improved readability on a smaller device.
- **MCP Tool**: `util_reflow_pdf`
- **Parameters**: 
  - `input_pdf`: Path to original PDF (must be inside `/app/data/`).
  - `output_pdf`: Destination PDF (must be inside `/app/data/`).
  - `font_size`: Optional, default 16.

### Convert Markdown to PDF

- **Description**: Convert a Markdown file into a PDF with a larger font size. Helpful for reading Markdown notes on the reMarkable tablet.
- **MCP Tool**: `util_markdown_to_pdf`
- **Parameters**: 
  - `input_md`: Path to original Markdown file (must be inside `/app/data/`).
  - `output_pdf`: Destination PDF (must be inside `/app/data/`).
  - `font_size`: Optional, default 16.

### Bulk Reflow PDF

- **Description**: Reflow multiple PDF files in a single call.
- **MCP Tool**: `util_bulk_reflow_pdf`
- **Parameters**:
  - `inputs`: Array of objects, each containing `input_pdf` and `output_pdf` (all paths must be inside `/app/data/`).
  - `font_size`: Optional, default 16.

### Bulk Convert Markdown to PDF

- **Description**: Convert multiple Markdown files to PDF in a single call.
- **MCP Tool**: `util_bulk_markdown_to_pdf`
- **Parameters**:
  - `inputs`: Array of objects, each containing `input_md` and `output_pdf` (all paths must be inside `/app/data/`).
  - `font_size`: Optional, default 16.
