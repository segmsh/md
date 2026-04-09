import { assert, describe, it } from "vitest";
import eol from "eol";

import fs from "fs";
import path from "path";

import MdProcessor from "../src/processor.js";

const processor = new MdProcessor();

function processAndCompare(filename: string) {
  const inDoc = fs.readFileSync(path.join("test", "fixtures", filename), {
    encoding: "utf-8",
  });

  const doc = processor.parse(inDoc);
  const docStr = JSON.stringify(doc);

  const outDoc = processor.stringify(doc);
  const outDocStructure = processor.parse(outDoc);
  const outDocStructureStr = JSON.stringify(outDocStructure);

  assert.equal(outDocStructureStr, docStr);
  console.log(filename);
}

function processAndCompareRoundtrip(filename: string) {
  const input = eol.lf(
    fs.readFileSync(path.join("test", "fixtures", filename), {
      encoding: "utf-8",
    }),
  );

  const doc = processor.parse(input);
  const output = eol.lf(processor.stringify(doc));

  assert.equal(output, input);
}

function processWithoutThrowing(filename: string) {
  const input = fs.readFileSync(path.join("test", "fixtures", filename), {
    encoding: "utf-8",
  });

  const doc = processor.parse(input);
  const output = processor.stringify(doc);

  assert.equal(typeof output, "string");
  assert.ok(output.length > 0);
}

describe("MdProcessorTest", function () {
  const files = [
    "book-content.md",
    "markdown-html-mixed.md",
    "html-link-content.md",
    "mixed-content.md",
    "link.md",
    "headings.md",
    "comments.md",
    "code.md",
    "images.md",
    "html-images.md",
    "lists.md",
    "tables.md",
    "gfm-table.md",
    "misc.md",
    "frontmatter.md",
    "footnote.md",
    "task-list.md",
    "thematic-break.md",
    "break.md",
    "description-list.md",
  ];

  files.forEach((filename) => {
    it(`should process ${filename} correctly`, function () {
      processAndCompare(filename);
    });
  });

  const roundtripFiles = [
    "link.md",
    "images.md",
    "html-images.md",
    "break.md",
    "description-list.md",
    "inline-styles.md",
    "trailing-newline.md",
  ];

  roundtripFiles.forEach((filename) => {
    it(`should roundtrip ${filename} exactly`, function () {
      processAndCompareRoundtrip(filename);
    });
  });

  ["edge-cases.md", "large-html-stress.md"].forEach((filename) => {
    it(`should parse and stringify ${filename} without throwing`, function () {
      processWithoutThrowing(filename);
    });
  });
});
