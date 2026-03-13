import os
import sys

import markdown  # type: ignore
import pymupdf
import pymupdf4llm  # type: ignore


def reflow_pdf_with_images(input_path: str, output_path: str, font_size: float = 16) -> None:
    img_dir = os.path.dirname(output_path) + "/images"
    os.makedirs(img_dir, exist_ok=True)
    
    print(f"Extracting markdown from {input_path}...")
    md_text = pymupdf4llm.to_markdown(input_path, write_images=True, image_path=img_dir)
    
    print("Converting markdown to HTML...")
    # Add extensions for tables
    html_body = markdown.markdown(md_text, extensions=['tables'])
    
    # We need to make image paths absolute or relative to cwd for Story to find them
    # PyMuPDF Story usually resolves relative to cwd. 
    
    html_content = f"""
    <html>
    <body style="font-size: {font_size}pt; font-family: sans-serif;">
        {html_body}
    </body>
    </html>
    """
    
    with open("test_debug_story.html", "w") as f:
        f.write(html_content)
        
    print("Writing to PDF via Story...")
    # Use archive for base path if needed, but relative paths in HTML usually work if cwd is correct.
    story = pymupdf.Story(html=html_content)
    writer = pymupdf.DocumentWriter(output_path)
    
    page_rect = pymupdf.paper_rect("a4")
    margin = 50
    content_rect = page_rect + (margin, margin, -margin, -margin)
    
    more = 1
    while more:
        device = writer.begin_page(page_rect)
        more, _ = story.place(content_rect)
        story.draw(device)
        writer.end_page()
        
    writer.close()
    print("Done")

if __name__ == "__main__":
    reflow_pdf_with_images(sys.argv[1], sys.argv[2])
