import sys
import pymupdf4llm  # type: ignore

def main() -> None:
    if len(sys.argv) < 2:
        return
    md = pymupdf4llm.to_markdown(sys.argv[1], write_images=True, image_path="data/reflowed_pdfs/images")

    with open("test_markdown.md", "w") as f:
        f.write(md)
    print("done")

if __name__ == "__main__":
    main()
