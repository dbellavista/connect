import os
import json
import pytest
from invoke import Context
from connect.pdf import reflow_pdf, markdown_to_pdf

# Helper to check if a PDF is valid and has content
def is_valid_pdf(file_path):
    if not os.path.exists(file_path):
        return False
    # Check size is reasonable (not just the 608 byte blank header)
    if os.path.getsize(file_path) < 2000:
        return False
    return True

@pytest.fixture
def test_data_dir():
    path = "data/tests"
    os.makedirs(path, exist_ok=True)
    return path

def test_reflow_pdf_integration(test_data_dir):
    input_pdf = "data/deepfake_pdfs/2503.02857 Deepfake-Eval-2024 A Multi-Modal In-the-Wild Benchmark of Deepfakes Circulated in 2024.pdf"
    output_pdf = os.path.join(test_data_dir, "test_output_reflow.pdf")
    
    if os.path.exists(output_pdf):
        os.remove(output_pdf)
        
    # We provide a real Context as required by Invoke tasks
    ctx = Context()
    reflow_pdf(ctx, input_pdf, output_pdf, font_size=16)
    
    assert is_valid_pdf(output_pdf), f"Reflowed PDF {output_pdf} is invalid or blank"
    print(f"Verified reflowed PDF: {output_pdf} (Size: {os.path.getsize(output_pdf)})")

def test_markdown_to_pdf_integration(test_data_dir):
    input_md = os.path.join(test_data_dir, "test_input.md")
    output_pdf = os.path.join(test_data_dir, "test_output_md.pdf")
    
    with open(input_md, "w") as f:
        f.write("# Test Title\n\nThis is a test paragraph for the markdown to PDF integration test.")
        
    if os.path.exists(output_pdf):
        os.remove(output_pdf)
        
    ctx = Context()
    markdown_to_pdf(ctx, input_md, output_pdf, font_size=16)
    
    assert is_valid_pdf(output_pdf), f"Markdown-generated PDF {output_pdf} is invalid or blank"
    print(f"Verified markdown PDF: {output_pdf} (Size: {os.path.getsize(output_pdf)})")
