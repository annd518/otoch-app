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
    { subset: true },
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
  for (const paragraph of lines) {
    let line = "";
    // Character wrapping supports long medication names and Cyrillic without truncation.
    for (const ch of paragraph.replace(/[\r\n]/g, " ")) {
      if (font.widthOfTextAtSize(line + ch, 12) > page.getWidth() - 96) {
        draw(line);
        line = "";
      }
      line += ch;
    }
    draw(line);
  }
  return doc.save();
}
