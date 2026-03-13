import json
from connect.utils.logger import logger

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
        logger.info(f"Opening PDF: {input_pdf}")
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
        logger.info("Layouting text with pymupdf.Story")
        story = pymupdf.Story(html=html_content)
        writer = pymupdf.DocumentWriter(output_pdf)

        # Use a standard A4 page size
        page_rect = pymupdf.paper_rect("a4")
        # Define inner content rect with margins
        inner_rect = page_rect + (50, 50, -50, -50)

        more = 1
        while more:
            device = writer.begin_page(page_rect)
            more, _ = story.place(inner_rect)
            story.draw(device)
            writer.end_page()

        writer.close()
        logger.info(f"Successfully generated {output_pdf}")
        print(json.dumps({"success": True, "output": output_pdf}))
    except Exception as e:
        logger.error(f"Failed to reflow PDF: {e}")
        print(json.dumps({"success": False, "error": str(e)}))


@task(
    help={
        "inputs_json": "JSON string representing an array of {input_pdf, output_pdf} objects",
        "font_size": "Font size to use for reflowing (default 16)",
    }
)
def mcp_bulk_reflow(c: Context, inputs_json: str, font_size: int = 16) -> None:
    """Bulk reflow PDFs from a JSON array of inputs/outputs."""
    inputs = json.loads(inputs_json)
    results = []
    import html

    import pymupdf

    logger.info(f"Bulk reflowing {len(inputs)} PDFs")
    for item in inputs:
        input_pdf = item["input_pdf"]
        output_pdf = item["output_pdf"]

        try:
            logger.info(f"Processing {input_pdf}")
            doc = pymupdf.open(input_pdf)
            html_content = (
                "<html><body style='font-family: helvetica, sans-serif; line-height: 1.5;'>"
            )
            for page in doc:  # type: ignore
                blocks = page.get_text("blocks", sort=True)
                for b in blocks:
                    text = b[4].strip()
                    if text:
                        text = text.replace("\n", " ")
                        escaped_text = html.escape(text)
                        html_content += f"<p style='font-size: {font_size}pt; margin-bottom: 1em;'>{escaped_text}</p>"
            html_content += "</body></html>"
            doc.close()

            story = pymupdf.Story(html=html_content)
            writer = pymupdf.DocumentWriter(output_pdf)
            
            # Use a standard A4 page size
            page_rect = pymupdf.paper_rect("a4")
            # Define inner content rect with margins
            inner_rect = page_rect + (50, 50, -50, -50)

            more = 1
            while more:
                device = writer.begin_page(page_rect)
                more, _ = story.place(inner_rect)
                story.draw(device)
                writer.end_page()
            writer.close()
            results.append({"input": input_pdf, "success": True, "output": output_pdf})
        except Exception as e:
            logger.error(f"Failed to process {input_pdf}: {e}")
            results.append({"input": input_pdf, "success": False, "error": str(e)})

    print(json.dumps(results))


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
        logger.info(f"Converting markdown {input_md} to PDF")
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

        # Use a standard A4 page size
        page_rect = pymupdf.paper_rect("a4")
        # Define inner content rect with margins
        inner_rect = page_rect + (50, 50, -50, -50)

        more = 1
        while more:
            device = writer.begin_page(page_rect)
            more, _ = story.place(inner_rect)
            story.draw(device)
            writer.end_page()

        writer.close()
        logger.info(f"Successfully generated {output_pdf}")
        print(json.dumps({"success": True, "output": output_pdf}))
    except Exception as e:
        logger.error(f"Failed to convert markdown to PDF: {e}")
        print(json.dumps({"success": False, "error": str(e)}))


@task(
    help={
        "inputs_json": "JSON string representing an array of {input_md, output_pdf} objects",
        "font_size": "Font size to use (default 16)",
    }
)
def mcp_bulk_markdown_to_pdf(c: Context, inputs_json: str, font_size: int = 16) -> None:
    """Bulk convert Markdown to PDF from a JSON array of inputs/outputs."""
    inputs = json.loads(inputs_json)
    results = []
    import markdown  # type: ignore
    import pymupdf

    logger.info(f"Bulk converting {len(inputs)} Markdown files")
    for item in inputs:
        input_md = item["input_md"]
        output_pdf = item["output_pdf"]
        try:
            logger.info(f"Processing {input_md}")
            with open(input_md, "r", encoding="utf-8") as f:
                md_text = f.read()

            html_body = markdown.markdown(md_text, encoding="utf-8", extensions=["tables", "fenced_code"])
            html_content = (
                f"<html><body style='font-family: helvetica, sans-serif; "
                f"line-height: 1.5; font-size: {font_size}pt;'>{html_body}</body></html>"
            )

            story = pymupdf.Story(html=html_content)
            writer = pymupdf.DocumentWriter(output_pdf)
            
            # Use a standard A4 page size
            page_rect = pymupdf.paper_rect("a4")
            # Define inner content rect with margins
            inner_rect = page_rect + (50, 50, -50, -50)

            more = 1
            while more:
                device = writer.begin_page(page_rect)
                more, _ = story.place(inner_rect)
                story.draw(device)
                writer.end_page()
            writer.close()
            results.append({"input": input_md, "success": True, "output": output_pdf})
        except Exception as e:
            logger.error(f"Failed to process {input_md}: {e}")
            results.append({"input": input_md, "success": False, "error": str(e)})

    print(json.dumps(results))
