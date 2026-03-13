import json

from invoke.context import Context
from invoke.tasks import task


@task(
    help={
        "input_pdf": "Path to the input PDF file",
        "output_pdf": "Path to the output reflowed PDF",
        "font_size": "Font size to use for reflowing (default 16)",
    }
)
def reflow_pdf(
    c: Context, input_pdf: str, output_pdf: str, font_size: int = 16
) -> None:
    """Reflow a two-column PDF into a single column with increased font size."""
    import html

    import pymupdf

    try:
        doc = pymupdf.open(input_pdf)
        html_content = (
            "<html><body style='font-family: helvetica, sans-serif; line-height: 1.5;'>"
        )

        for page in doc:  # type: ignore
            # sort=True ensures reading order which typically handles columns
            blocks = page.get_text("blocks", sort=True)
            for b in blocks:
                # b[4] is the text content
                text = b[4].strip()
                if text:
                    # Replace single newlines with spaces to reflow paragraph
                    text = text.replace("\n", " ")
                    escaped_text = html.escape(text)
                    html_content += f"<p style='font-size: {font_size}pt; margin-bottom: 1em;'>{escaped_text}</p>"

        html_content += "</body></html>"
        doc.close()

        # Use Story for automatic text layout
        story = pymupdf.Story(html=html_content)
        writer = pymupdf.DocumentWriter(output_pdf)

        # Use a standard A4 page size with standard margins
        rect = pymupdf.paper_rect("a4") + (50, 50, -50, -50)

        more = 1
        while more:
            device = writer.begin_page(rect)
            more, _ = story.place(device)
            story.draw(device)
            writer.end_page()

        writer.close()
        print(json.dumps({"success": True, "output": output_pdf}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


@task(
    help={
        "input_md": "Path to the input Markdown file",
        "output_pdf": "Path to the output PDF",
        "font_size": "Font size to use (default 16)",
    }
)
def markdown_to_pdf(
    c: Context, input_md: str, output_pdf: str, font_size: int = 16
) -> None:
    """Convert a Markdown file into a PDF with increased font size."""
    import markdown  # type: ignore
    import pymupdf

    try:
        with open(input_md, "r", encoding="utf-8") as f:
            md_text = f.read()

        html_body = markdown.markdown(md_text, extensions=["tables", "fenced_code"])
        html_content = (
            f"<html><body style='font-family: helvetica, sans-serif; "
            f"line-height: 1.5; font-size: {font_size}pt;'>{html_body}</body></html>"
        )

        # Use Story for automatic text layout
        story = pymupdf.Story(html=html_content)
        writer = pymupdf.DocumentWriter(output_pdf)

        # Use a standard A4 page size with standard margins
        rect = pymupdf.paper_rect("a4") + (50, 50, -50, -50)

        more = 1
        while more:
            device = writer.begin_page(rect)
            more, _ = story.place(device)
            story.draw(device)
            writer.end_page()

        writer.close()
        print(json.dumps({"success": True, "output": output_pdf}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
