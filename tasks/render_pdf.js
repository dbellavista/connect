import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const htmlPath = process.argv[2];
const outputPath = process.argv[3];
const fontSize = process.argv[4] || 16;

(async () => {
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Add some basic styling for reading on reMarkable
  const styledHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: ${fontSize}pt;
                line-height: 1.6;
                color: #000;
                margin: 0 auto;
                max-width: 100%;
            }
            img {
                max-width: 100%;
                height: auto;
                display: block;
                margin: 20px auto;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 0.9em;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            th {
                background-color: #f2f2f2;
                font-weight: bold;
            }
            h1, h2, h3, h4, h5, h6 {
                margin-top: 1.5em;
                margin-bottom: 0.5em;
                line-height: 1.2;
            }
            p {
                margin-bottom: 1em;
            }
        </style>
    </head>
    <body>
        ${htmlContent}
    </body>
    </html>
    `;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newPage();

  // Convert to file URI to ensure local images load correctly
  fs.writeFileSync(htmlPath, styledHtml);
  const baseUrl = 'file://' + path.resolve(htmlPath);
  await page.goto(baseUrl, { waitUntil: 'networkidle0' });

  // Wait for images to load if any
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll('img'));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return;
        return new Promise((resolve) => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', resolve);
        });
      })
    );
  });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    margin: { top: '50px', right: '50px', bottom: '50px', left: '50px' },
    printBackground: true,
  });

  await browser.close();
})();
