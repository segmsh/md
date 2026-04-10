# @segmsh/md

Markdown processor for [segm.sh](https://segm.sh). This package parses Markdown files into a document (AST + segments) and stringifies them back, preserving structure while allowing content extraction.

## Installation

```bash
npm install @segmsh/md
```

## Usage

```typescript
import MdProcessor from "@segmsh/md";

const processor = new MdProcessor();

const mdContent = "# Hello world";
const document = processor.parse(mdContent);

// ... modify document segments ...

// Stringify back to Markdown
const newMdContent = processor.stringify(document);
```

## Features

- **Structure Preservation**: Maintains the original structure of the Markdown document.
- **Round-trip**: Ensures that parsing and then stringifying results in the original Markdown structure, preserving as much formatting as possible.

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## License

[Apache-2.0](LICENSE)
