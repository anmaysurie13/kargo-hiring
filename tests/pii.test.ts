import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertNoPII, extractPII, findPhones, nameFromFilename, PIILeakError, redact, separatePII } from "@/lib/pii";

const fixture = (f: string) => readFileSync(join(__dirname, "fixtures", f), "utf8");

describe("separatePII on fixture CVs", () => {
  it("strips name in a heading, possessives, email, phone and profile URLs", () => {
    const raw = fixture("cv_01_priya_sharma.txt");
    const { pii, content, report } = separatePII(raw, "cv_01_priya_sharma.txt");
    expect(pii).toEqual({ fullName: "Priya Sharma", email: "priya.sharma88@gmail.com", phone: "+91 98204 37810" });
    expect(report.nameSource).toBe("heading");
    expect(content).not.toMatch(/priya/i);
    expect(content).not.toMatch(/sharma/i);
    expect(content).not.toContain("@");
    expect(content).not.toMatch(/98204/);
    expect(content).not.toMatch(/linkedin|priyasharma\.dev/i);
    expect(content).toContain("Mumbai"); // city is kept
    expect(content).toContain("[REDACTED]'s template");
    expect(report.email).toBeGreaterThan(0);
    expect(report.phone).toBe(1);
    expect(report.url).toBe(2);
  });

  it("finds a name at the bottom of the CV, next to the email", () => {
    const raw = fixture("spm_name_at_bottom.txt");
    const { pii, content, report } = separatePII(raw, "spm_name_at_bottom.txt");
    expect(pii.fullName).toBe("Ananya Deshpande");
    expect(report.nameSource).toBe("near_email");
    expect(pii.phone).toBe("098204-37811");
    expect(content).not.toMatch(/ananya|deshpande/i);
    expect(content).not.toMatch(/37811|outlook|github/i);
    expect(content).toContain("Pune");
  });

  it("falls back to the filename and removes first name used alone", () => {
    const raw = fixture("cv_07_rohan_iyer.txt");
    const { pii, content, report } = separatePII(raw, "cv_07_rohan_iyer.pdf");
    expect(pii.fullName).toBe("Rohan Iyer");
    expect(report.nameSource).toBe("filename");
    expect(pii.phone).toBe("(+91) 99876-54321");
    expect(content).not.toMatch(/rohan|iyer/i);
    expect(content).not.toMatch(/99876|yahoo/i);
    expect(content).toContain("Bengaluru");
  });

  it("prefers CSV-provided details", () => {
    const { pii, content } = separatePII("Worked with Meera on routing.\nmeera@x.in", "row.csv", {
      fullName: "Meera Kulkarni",
      email: "meera@x.in",
    });
    expect(pii.fullName).toBe("Meera Kulkarni");
    expect(content).not.toMatch(/meera/i);
  });
});

describe("Indian phone formats", () => {
  const formats = ["+91 98204 37810", "+91-9820437810", "098204-37810", "9820437810", "91 98204 37810", "(+91) 98204-37810", "+91 22 2345 6789", "022-23456789"];
  for (const f of formats) {
    it(`detects and redacts ${f}`, () => {
      const text = `Call me on ${f} anytime.`;
      expect(findPhones(text).length).toBeGreaterThan(0);
      const { content } = redact(text, { fullName: null, email: null, phone: f }, "none");
      expect(content.replace("[REDACTED]", "")).not.toMatch(/\d{4}/);
    });
  }

  it("does not treat years or metrics as phones", () => {
    expect(findPhones("2019 – 2021, cut costs by 35%, ₹2,10,00,000 ARR, 120000 sq ft")).toEqual([]);
  });
});

describe("assertNoPII", () => {
  it("throws when the name survives", () => {
    expect(() => assertNoPII("Built by Priya at FreightLine", { fullName: "Priya Sharma", email: null, phone: null })).toThrow(PIILeakError);
  });
  it("throws when a phone survives with different separators", () => {
    expect(() => assertNoPII("ph 98204.37810", { fullName: null, email: null, phone: "+91 98204 37810" })).toThrow(PIILeakError);
  });
  it("passes clean text", () => {
    expect(() => assertNoPII("[REDACTED] built a tool in Mumbai", { fullName: "Priya Sharma", email: "p@x.com", phone: "9820437810" })).not.toThrow();
  });
});

describe("helpers", () => {
  it("parses names from filenames", () => {
    expect(nameFromFilename("cv_12_firstname_lastname.pdf")).toBe("Firstname Lastname");
    expect(nameFromFilename("spm_16_siddharth_rao.docx")).toBe("Siddharth Rao");
    expect(nameFromFilename("12.pdf")).toBeNull();
  });
  it("does not take a section header as a name", () => {
    expect(extractPII("Curriculum Vitae\nProduct Manager\n", "x.txt").pii.fullName).toBeNull();
  });
});
