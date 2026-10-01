import "server-only";

export const SUPPORTED = /\.(pdf|docx|txt)$/i;

/** File bytes → plain text. Node runtime only. */
export async function extractText(filename: string, bytes: Uint8Array): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop();
  let text: string;
  if (ext === "pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const res = await pdfText(pdf, { mergePages: false });
    text = (res.text as string[]).join("\n");
  } else if (ext === "docx") {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
  } else if (ext === "txt") {
    text = new TextDecoder("utf-8").decode(bytes);
  } else {
    throw new Error(`Unsupported file type: ${filename} (PDF, DOCX or TXT only)`);
  }
  text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  if (text.length < 50) throw new Error("Could not extract readable text (scanned PDF or empty file?)");
  return text;
}
