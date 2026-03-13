import os
import subprocess
import sys
import tempfile

import markdown  # type: ignore
import pymupdf4llm  # type: ignore


def reflow_pdf(input_path: str, output_path: str, font_size: float = 16) -> None:
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)

    with tempfile.TemporaryDirectory() as temp_dir:
        img_dir = os.path.join(temp_dir, "images")
        os.makedirs(img_dir, exist_ok=True)

        print(f"Extracting markdown and images from {input_path}...")
        md_text = pymupdf4llm.to_markdown(
            input_path, write_images=True, image_path=img_dir
        )
        assert isinstance(md_text, str), "Expected markdown text as a string"

        # Replace relative image paths with absolute paths so Puppeteer finds them
        # pymupdf4llm writes images with names like `...-0002-00.png`
        # and outputs markdown like `![](images/...png)`
        # Since we gave it an absolute path `img_dir`, let's check what it actually outputs.
        # It typically outputs `![](/path/to/images/...png)` if we passed an absolute path,
        # or we can just replace 'images/' if it used relative.

        html_body = markdown.markdown(md_text, extensions=["tables"])

        html_path = os.path.join(temp_dir, "content.html")
        with open(html_path, "w") as f:
            f.write(html_body)

        print("Rendering PDF with Puppeteer...")
        script_path = os.path.join(os.path.dirname(__file__), "render_pdf.js")

        # Run node script
        subprocess.run(
            ["node", script_path, html_path, output_path, str(font_size)], check=True
        )

    print(f"Successfully generated {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pdf_reflow.py <input> <output> [font_size]")
        sys.exit(1)
    reflow_pdf(
        sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 16
    )
