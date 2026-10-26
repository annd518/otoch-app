import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
export async function recordPdf(lines: string[]) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    await readFile(
      path.join(process.cwd(), "assets/fonts/NotoSans_400Regular.ttf"),
    ),
    // the whole font: pdf-lib's subsetting dropped most Cyrillic glyphs
    // (letters went missing in the rendered PDF)
    { subset: false },
  );
  let page = doc.addPage(),
    y = page.getHeight() - 48;
  const draw = (line: string) => {
    if (y < 48) {
      page = doc.addPage();
      y = page.getHeight() - 48;
    }
    page.drawText(line, {
      x: 48,
      y,
      font,
      size: 12,
      color: rgb(0.12, 0.18, 0.27),
    });
    y -= 20;
  };
  const fits = (text: string) => font.widthOfTextAtSize(text, 12) <= page.getWidth() - 96;
  for (const paragraph of lines) {
    let line = "";
    // Wrap at spaces; a word longer than the line (a long medication name)
    // is broken by character, so nothing is cut off.
    for (const word of paragraph.replace(/[\r\n]/g, " ").split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (fits(next)) {
        line = next;
        continue;
      }
      if (line) draw(line);
      line = "";
      for (const ch of word) {
        if (!fits(line + ch)) {
          draw(line);
          line = "";
        }
        line += ch;
      }
    }
    draw(line);
  }
  return doc.save();
}
