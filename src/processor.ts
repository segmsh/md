import { visitParents } from "unist-util-visit-parents";
import { unified } from "unified";
import gfm from "remark-gfm";
import parse from "remark-parse";
import remark2rehype from "remark-rehype";
import stringify from "remark-stringify";
import raw, { Options } from "rehype-raw";
import remarkFrontmatter from "remark-frontmatter";
import { toMdast } from "./utils/hast-to-mdast/index.js";
import {
  Element,
  ElementContent,
  Root as HastRoot,
  Text as HastText,
  Properties as HastProperties,
} from "hast";
import {
  Document,
  Processor,
  Value,
  root,
} from "@segmsh/core";

import {
  Code,
  Heading,
  Link,
  List,
  Paragraph,
  Root as MdastRoot,
  Strong,
} from "mdast";
import type { Info, State } from "mdast-util-to-markdown";
import { removePosition } from "unist-util-remove-position";
import img from "./handlers/hast-to-mdast/img.js";
import {
  divHastToMdast,
  headerHastToMdast,
  linkHastToMdast,
  listToMdast,
  ListTypes,
  tableHastToMdast,
} from "./handlers/hast-to-mdast/handlers.js";
import {
  headingMdastToMd,
  breakHandler as mdastToMdBreakHandler,
} from "./handlers/mdast-to-md/handlers.js";
import { toHtml } from "hast-util-to-html";
import {
  breakHandler,
  segmentParentNodeToHast,
} from "./handlers/mdast-to-hast/handlers.js";
import { toHtmlSafe } from "./utils/to-html-safe.js";
import {
  avoidHtmlTags,
  avoidHtmlType,
  PlaceholderContent,
  replaceHtmlBeforeMdast,
} from "./utils/html.js";
import { Parent } from "mdast";
import YamlProcessor from "@segmsh/yaml";
import {
  serializeMdastNodeToTaggedText,
} from "./utils/tag-markers.js";
import {
  getChildrenContentLength,
  hastToSegments,
  segmentsToHast,
} from "./utils/hast-segments.js";

const keepMarkerPlugin = (option: { doc: string }) => {
  const { doc } = option;
  const transformer = (ast: HastRoot) => {
    visitParents(
      ast,
      (node) =>
        [
          "emphasis",
          "code",
          "inlineCode",
          "strong",
          "list",
          "image",
          "link",
          "table",
          "html",
          "thematicBreak",
          "heading",
          "break",
        ].includes(node.type),
      (node: any, parent) => {
        if (!node.position) return;
        let marker: string = doc.charAt(node.position?.start?.offset);
        switch (node.type) {
          case "strong": {
            marker += marker;
            break;
          }
          case "list": {
            marker += doc.charAt(node.position?.start?.offset + 1).trim();
            if (marker.length > 1) marker = marker[marker.length - 1];
            break;
          }
          case "html": {
            marker = "html";
            break;
          }
          case "heading": {
            if (marker !== "#") {
              marker = doc.charAt(node.position?.end?.offset - 1).trim();
            }
            break;
          }
          case "thematicBreak": {
            marker = doc.substring(
              node.position?.start?.offset,
              node.position?.end?.offset,
            );
            break;
          }
          case "break": {
            marker = (marker === " " ? "  " : marker) + "\n";
            break;
          }
        }

        node.marker = marker;
      },
    );
  };
  return transformer;
};

const restoreEscapes = (option: { doc: string }) => {
  const { doc } = option;
  const transformer = (ast: HastRoot) => {
    visitParents(
      ast,
      (node: any) => node.type === "text" && !!node.position,
      (node: any, _parent: any) => {
        const { start, end } = node.position;
        const original = doc.slice(start.offset, end.offset);
        if (original.includes("\\") && original.replace(/\\/g, "") === node.value) {
          node.value = original;
        }
      },
    );
  };
  return transformer;
};

const postProcessHtmlMarker = (option: { doc: string }) => {
  const { doc } = option;
  const allowHtmlTags = ["summary"];
  const transformer = (ast: HastRoot) => {
    visitParents(
      ast,
      (node: any) =>
        node.type === "element" && !node?.properties?.marker && node.position,
      (node: any, parent) => {
        const { start, end } = node.position;
        const text: string = doc.slice(start.offset, end.offset);
        const isHtml: boolean =
          text.indexOf(`<${node.tagName}>`) !== -1 ||
          text.indexOf(`<${node.tagName} `) !== -1 ||
          allowHtmlTags.includes(node.tagName);

        if (isHtml) {
          node.properties = {
            ...node.properties,
            marker: "html",
          };
        }

        if (node.tagName === "pre") {
          const childrenContentLength: number = getChildrenContentLength(node);
          if (childrenContentLength > 1) {
            const preBlock = toHtml(node.children);
            node.children = [{ type: "text", value: "\n" + preBlock }];
          }
        }
      },
    );
  };
  return transformer;
};

const prepareMdast = (option: {
  contentsAvoidMarkdown: PlaceholderContent[];
}) => {
  const { contentsAvoidMarkdown } = option;
  const contentsAvoidMarkdownCopy: PlaceholderContent[] = [
    ...contentsAvoidMarkdown,
  ];

  const transformer = (ast: HastRoot) => {
    visitParents(
      ast,
      (node) =>
        ["link", "yaml", "text", "html", "code", "inlineCode"].includes(
          node.type,
        ),
      (node: any, parent) => {
        if (node.type === "link") {
          const isLinkUrlLAndLinkTextHasSameValue: boolean =
            node.url === node?.children[0]?.value &&
            node.type === "link" &&
            node.marker === "h";

          const isEmail: boolean =
            node.title === null && node.url.includes("mailto:");

          if (isLinkUrlLAndLinkTextHasSameValue || isEmail) {
            node.type = "text";
            node.value = node?.children[0].value;
            delete node.children;
          }
        }

        if (node.type === "yaml") {
          if (contentsAvoidMarkdown.length) {
            contentsAvoidMarkdown.forEach((placeholder: PlaceholderContent) => {
              node.value = node.value.replace(
                placeholder.placeholder,
                placeholder.content,
              );
            });
          }
        }

        if (
          contentsAvoidMarkdownCopy.length &&
          node.type !== "yaml" &&
          "value" in node
        ) {
          const htmlPlaceholders: PlaceholderContent[] =
            contentsAvoidMarkdownCopy.reduceRight(
              (
                acc: PlaceholderContent[],
                curr: PlaceholderContent,
                i: number,
                arr: PlaceholderContent[],
              ) => {
                if (node.value.includes(curr.placeholderWithoutTags)) {
                  acc.push(curr);
                  arr.splice(i, 1);
                }
                return acc;
              },
              [],
            );

          if (htmlPlaceholders.length) {
            htmlPlaceholders.forEach((placeholder: PlaceholderContent) => {
              node.value = node.value.replace(
                placeholder.placeholderWithoutTags,
                placeholder.contentWithoutTags,
              );
              const isNotCodeNode = !["code", "inlineCode"].includes(node.type);
              if (
                avoidHtmlTags.includes(placeholder.tagName) &&
                isNotCodeNode
              ) {
                node.type = avoidHtmlType;
              }
            });
          }
        }
      },
    );
  };
  return transformer;
};

const convertToHtmlType = () => {
  const transformer = (ast: HastRoot) => {
    visitParents(
      ast,
      (node) => "properties" in node || node.type === avoidHtmlType,
      (node: any, parent) => {
        if (node?.properties?.marker === "html") {
          visitParents(
            node,
            (child) => "properties" in child && node !== child,
            (child: any, _) => {
              if (child.tagName === "li") {
                const newChildren: ElementContent[] = [];

                child.children.map((textChild: Element) => {
                  if ("tagName" in textChild && textChild.tagName === "p") {
                    newChildren.push(...textChild.children);
                  } else {
                    newChildren.push(textChild);
                  }
                });
                delete child?.properties?.marker;
                child.children = [...newChildren];
              }
            },
          );
          if (node.tagName !== "li") node.type = "html";
        }
        if (node.type === avoidHtmlType) node.type = "html";
      },
    );
  };
  return transformer;
};

const footNotePlugin = () => {
  const transformer = (ast: HastRoot) => {
    visitParents(
      ast,
      (node: any) =>
        "properties" in node && node.properties.marker === "footnoteDefinition",
      (node: any) => {
        node.type = "footnoteDefinition";
      },
    );
  };
  return transformer;
};

export default class MdProcessor implements Processor {
  private yamlProcessor: YamlProcessor;
  private mdastToHastHandlers: Record<string, Function> = {};
  private hastToMdastHandlers: Record<string, Function> = {};
  private passThroughTypes: string[] = ["yaml", "definition", avoidHtmlType];
  protected mdast: MdastRoot = { type: "root", children: [] };

  constructor() {
    this.yamlProcessor = new YamlProcessor();
  }

  protected getMdastToStringHandlers(): Record<string, Function> {
    let listBulletLastUsed: string[] = [];

    return {
      text: (node: { value: string }) => node.value,
      code: (node: Code & { marker?: string }, _: Parent | undefined, state: State, info: Info) => {
        const marker = node.marker?.trim() ? node.marker.repeat(3) : "";

        const codeIndented: any = {
          ...node,
          lang: marker,
          type: "code",
          children: [{ type: "text", value: node.value }],
        };

        if (!marker) {
          const strCode = unified()
            .use(stringify, { fences: false })
            .stringify(codeIndented);
          return strCode.trimEnd();
        }
        const exit = state.enter("codeIndented");
        const lineBreak = marker ? "\n" : "";
        const tracker = state.createTracker(info);

        let value = tracker.move(
          marker +
            (node.lang === "no_lang" ? "" : node.lang) +
            (node.meta ? " " : "") +
            (node.meta ? node.meta : "") +
            lineBreak,
        );
        value += state.containerPhrasing(codeIndented, {
          before: value,
          after: marker,
          ...tracker.current(),
        });
        value += tracker.move(lineBreak + marker);

        exit();
        return value;
      },
      emphasis: (
        node: any,
        _: Parent | undefined,
        state: State,
        info: Info,
      ) => {
        const marker =
          node.properties?.marker || state.options.emphasis || "<em>";

        const exit = state.enter("emphasis");
        const tracker = state.createTracker(info);
        let value = tracker.move(marker);
        value += tracker.move(
          state.containerPhrasing(node, {
            before: value,
            after: marker,
            ...tracker.current(),
          }),
        );
        value += tracker.move(marker === "<em>" ? "</em>" : marker);
        exit();
        return value;
      },
      link: (node: Link, _: Parent | undefined, state: State, info: Info) => {
        const exit = state.enter("link");
        const tracker = state.createTracker(info);
        let value = tracker.move("[");
        value += tracker.move(
          state.containerPhrasing(node, {
            before: value,
            after: "]",
            ...tracker.current(),
          }),
        );
        value += tracker.move("](" + node.url + ")");
        exit();
        return value;
      },
      inlineCode: (
        node: any,
        _: Parent | undefined,
        state: State,
        info: Info,
      ) => {
        const marker = node.properties?.marker || "<code>";

        const exit = state.enter("blockquote");
        const tracker = state.createTracker(info);
        let value = tracker.move(marker);
        value += tracker.move(
          state.containerPhrasing(node, {
            before: value,
            after: marker,
            ...tracker.current(),
          }),
        );
        value += tracker.move(marker === "<code>" ? "</code>" : marker);
        exit();
        return value;
      },
      strong: (
        node: Strong & { properties?: { marker?: string } },
        _: Parent | undefined,
        state: State,
        info: Info,
      ) => {
        let marker = node.properties?.marker || "<strong>";

        const exit = state.enter("strong");
        const tracker = state.createTracker(info);
        let value = tracker.move(marker);
        value += tracker.move(
          state
            .containerPhrasing(node, {
              before: value,
              after: marker,
              ...tracker.current(),
            })
            ?.trimEnd(),
        );
        value += tracker.move(marker === "<strong>" ? "</strong>" : marker);
        exit();
        return value;
      },
      list: (
        node: List & { marker?: string; properties?: { marker?: string } },
        _: Parent | undefined,
        state: State,
        info: Info,
      ) => {
        const marker = node.properties?.marker || node.marker || "-";
        const exit = state.enter("list");
        const tracker = state.createTracker(info);

        state.bulletCurrent = marker;
        listBulletLastUsed.push(marker);
        state.options.listItemIndent = "one";

        let value = tracker.move(
          state.containerFlow(node, {
            ...info,
          }),
        );

        listBulletLastUsed.pop();
        state.bulletCurrent = listBulletLastUsed[listBulletLastUsed.length - 1];
        exit();
        return value;
      },
      thematicBreak: (node: { marker?: string }) => mdastToMdBreakHandler(node),
      break: (node: { marker?: string }) => mdastToMdBreakHandler(node),
      blockquote: (
        node: any,
        _: Parent | undefined,
        state: State,
        info: Info,
      ) => {
        function map(line: string, _: number, blank: boolean): string {
          const row: string = (blank ? "" : " ") + line;

          return line || _ > 0 ? ">" + row : row;
        }

        const exit = state.enter("blockquote");
        const tracker = state.createTracker(info);
        tracker.move("> ");
        tracker.shift(2);
        const value = state.indentLines(
          state.containerFlow(node, tracker.current()),
          map,
        );
        exit();
        return value;
      },
      heading: (node: Heading, _: Parent | undefined, state: State, info: Info) =>
        headingMdastToMd(node, state, info),
    };
  }

  protected mdParagraphHandler(
    state: { all(node: Paragraph | Heading): ElementContent[] },
    node: (Paragraph | Heading) & { depth?: number; marker?: string },
    mdast: MdastRoot,
  ) {
    const serializedText = serializeMdastNodeToTaggedText(node as any, mdast);
    const tagName: string = node.depth ? "h" + node.depth : "p";
    return segmentParentNodeToHast(state, node, serializedText, tagName);
  }

  protected addMdastToHastHandler(
    handlers: Record<string, Function>,
    nodeHandlers: Record<string, Function>,
  ) {
    this.mdastToHastHandlers = {
      ...this.mdastToHastHandlers,
      ...handlers,
      ...nodeHandlers,
    };
  }

  protected addHastToMdastHandler(
    handlers: Record<string, Function>,
    nodeHandlers: Record<string, Function>,
  ) {
    this.hastToMdastHandlers = {
      ...this.hastToMdastHandlers,
      ...handlers,
      ...nodeHandlers,
    };
  }

  protected addPassThroughTypes(passThroughTypes: string[]) {
    this.passThroughTypes = this.passThroughTypes.concat(passThroughTypes);
  }

  protected parseMarkdownToMdast(doc: string): {
    mdast: MdastRoot;
    newDoc: string;
  } {
    const mdast: MdastRoot = unified()
      .use(parse)
      .use(remarkFrontmatter, ["yaml"])
      .use(gfm)
      .parse(doc);
    return { mdast: mdast, newDoc: doc };
  }

  protected parseMdastToMarkdown(mdast: MdastRoot): string {
    return unified()
      .use(gfm)
      .use(stringify, {
        handlers: this.getMdastToStringHandlers(),
      })
      .stringify(mdast) as string;
  }

  private stringifyYamlNode(node: Element, data: Document): string {
    const segmentIds = new Set<string>();

    visitParents(node, { type: "segment" }, (segmentNode: any) => {
      segmentIds.add(segmentNode.id);
    });

    const yamlDoc: Document = {
      tree: root([structuredClone(node)]),
      segments: data.segments.filter((segment) => segmentIds.has(segment.id)),
    };

    return this.yamlProcessor.stringify(yamlDoc);
  }

  public parse(doc: string): Document {
    const { docWithHtmlPlaceholders, contentsAvoidMarkdown } =
      replaceHtmlBeforeMdast(doc);

    const { mdast, newDoc } = this.parseMarkdownToMdast(
      docWithHtmlPlaceholders,
    );
    this.mdast = mdast;

    const hast = unified()
      .use(keepMarkerPlugin, { doc: newDoc })
      .use(restoreEscapes, { doc: newDoc })
      .use(prepareMdast, { contentsAvoidMarkdown })
      .use(remark2rehype, {
        passThrough: ["definition"],
        allowDangerousHtml: true,
        unknownHandler: (state, node) => node,
        handlers: {
          paragraph: (state, node) => {
            return this.mdParagraphHandler(state, node, mdast);
          },
          code: (state, node) => {
            const properties: HastProperties = {};
            if (node.lang) properties.lang = node.lang;
            if (node.meta) properties.meta = node.meta;

            const codeElement: Element = {
              properties,
              type: "element",
              tagName: "code",
              children: [{ type: "text", value: node.value }],
            };
            if (node.marker) properties.marker = node.marker;

            return {
              type: "element",
              tagName: "pre",
              properties: {},
              children: [codeElement],
            };
          },
          heading: (state, node) => {
            return this.mdParagraphHandler(state, node, mdast);
          },
          tableRow: (state, node, parent) => {
            const cells: any[] = [];
            const isTableHeadOnGfmTable: boolean = parent
              ? parent.children.reduce((acc, tableRow, index) => {
                  if (index === 0 && tableRow === node) acc = true;
                  return acc;
                }, false)
              : false;

            visitParents(node, { type: "tableCell" }, (child) => {
              const serializedText: any = serializeMdastNodeToTaggedText(child);
              let cell: any;

              if (serializedText !== null && serializedText.type !== "text") {
                cell = state.one(serializedText, parent);
                cell.children[0].properties.marker = serializedText.children[0].marker;
              } else {
                cell = state.one(child, parent);
                cell.properties = serializedText?.tags || {};
                cell.children = serializedText ? [serializedText] : [];
              }
              if (isTableHeadOnGfmTable) cell.tagName = "th";
              cells.push(cell);
            });

            return {
              type: "element",
              tagName: isTableHeadOnGfmTable ? "thead" : "tr",
              properties: {},
              children: cells,
            };
          },
          yaml: (state, node) => node,
          footnoteReference: (state, node) => {
            return { type: "text", value: `[^${node.label}]` };
          },
          footnoteDefinition: (state, node) => {
            let levelChildrenInHast: any[] = state.all(node);
            const footnoteLabel = `[^${node.label}]: `;
            if (
              levelChildrenInHast.length &&
              "value" in levelChildrenInHast[0]?.children[0]
            ) {
              levelChildrenInHast[0].children[0].value =
                footnoteLabel + " " + levelChildrenInHast[0].children[0].value;
            }

            return {
              type: "element",
              tagName: "div",
              children: levelChildrenInHast,
              properties: { marker: "footnoteDefinition" },
            };
          },
          listItem: (state, node) => {
            let listItemChildren = state.all(node);
            const isTaskItem = node.checked !== null;
            if (isTaskItem) {
              const checkBox = `[${node.checked ? `x` : ` `}] `;
              const paragraph = listItemChildren[0];
              if ("children" in paragraph) {
                const textNode = paragraph.children[0];
                if ("value" in textNode)
                  textNode.value = `${checkBox} ${textNode.value.trim()}`;
              }
            }
            return {
              ...node,
              tagName: "li",
              type: "element",
              children: listItemChildren,
              properties: { spread: node.spread.toString() },
            };
          },
          list: (state, node) => {
            const properties: HastProperties = {
              spread: node.spread.toString(),
              start: node.start,
            };
            if (node.marker) properties.marker = node.marker;
            return {
              type: "element",
              tagName:
                typeof node.start === "number" ? ListTypes.ol : ListTypes.ul,
              properties,
              children: state.all(node),
            };
          },
          table: (state, node) => {
            const properties: HastProperties = {
              align: JSON.stringify(node.align),
            };
            if (node.marker) properties.marker = node.marker;
            return {
              type: "element",
              tagName: "table",
              properties,
              children: state.all(node),
            };
          },
          thematicBreak: (h, node) => breakHandler(node),
          break: (h, node) => breakHandler(node),
          definition: (state, node) => node,
          ...this.mdastToHastHandlers,
        },
      })
      .use(raw, { passThrough: this.passThroughTypes } as unknown as Options)
      .use(postProcessHtmlMarker, { doc: docWithHtmlPlaceholders })
      .runSync(mdast) as HastRoot;

    const { tree, segments } = hastToSegments(hast, this.yamlProcessor);

    removePosition(tree);

    // Capture trailing whitespace beyond the single \n that remark-stringify always emits
    const trailingMatch = doc.match(/(\n\n+)$/);
    const metadata: Record<string, Value> = {};
    if (trailingMatch) {
      metadata.trailingNewlines = trailingMatch[1];
    }

    return { tree, segments, metadata };
  }

  public stringify(data: Document): string {
    const hast = segmentsToHast(data);

    const mdast: MdastRoot = unified()
      .use(footNotePlugin)
      .use(convertToHtmlType)
      .use(
        (options: any) => {
          return (tree: any) => {
            return toMdast(tree, options);
          };
        },
        {
          newlines: true,
          nodeHandlers: {
            definition: (h: any, node: any) => node,
            footnoteDefinition: (h: any, node: any) => {
              const children = h.all(node);

              const textWithLabel = children[0].children[0].value;
              const label = textWithLabel.slice(
                textWithLabel.indexOf("[^") + 2,
                textWithLabel.indexOf("]:"),
              );

              children[0].children[0].value = textWithLabel.replace(
                `[^${label}]: `,
                "",
              );

              return {
                type: "footnoteDefinition",
                identifier: label,
                label,
                children: children,
              };
            },
              html: (h: any, node: any) => {
              node?.properties?.marker === "html" &&
                delete node?.properties?.marker;

              const isAvoidHtmlType: string | undefined = node.value;
              if (isAvoidHtmlType) {
                return {
                  type: "paragraph",
                  children: [{ type: "text", value: node.value } as HastText],
                };
              }
              const isTagWithHtmlSyntaxInside: boolean = [
                "table",
                "ul",
                "ol",
                "div",
                "dl",
              ].includes(node.tagName);

              if (isTagWithHtmlSyntaxInside) {
                visitParents(
                  node,
                  (node) => node.type === "html",
                  (child, _) => {
                    child.type = "element";
                    delete child?.properties?.marker;
                  },
                );
              }
              const outerHtml: string = toHtmlSafe(
                {
                  ...node,
                  type: "element",
                  children: isTagWithHtmlSyntaxInside ? node.children : [],
                },
                { allowDangerousCharacters: true, allowDangerousHtml: true },
              );

              if (isTagWithHtmlSyntaxInside) {
                return {
                  type: "paragraph",
                  children: [{ type: "text", value: outerHtml }],
                };
              }

              const index: number = outerHtml.indexOf("></");
              const innerNodes = h.all(node);
              const htmlLevel: any = {
                properties: node.properties,
                type: "paragraph",
                children: [
                  { type: "text", value: outerHtml.slice(0, index + 1) },
                  ...innerNodes,
                  { type: "text", value: outerHtml.slice(index + 1) },
                ],
              };
              return htmlLevel;
            },
              yaml: (h: any, node: any) => {
              const yamlStr = this.stringifyYamlNode(node, data);

              return {
                type: "paragraph",
                position: undefined,
                children: [
                  {
                    type: "text",
                    value: `---\n${yamlStr}---`,
                  },
                ],
              };
            },
          },
          handlers: {
          pre: (h: any, node: any) => {
            const isPreCodeWrapper =
              node.children.length === 1 && node.children[0].tagName === "code";
            if (isPreCodeWrapper) {
              const codeNode = node.children[0];
              return {
                type: "code",
                value: codeNode.children[0].value,
                meta: codeNode.properties.meta,
                lang: codeNode.properties.lang || "no_lang",
                marker: codeNode.properties?.marker,
              };
            } else {
              const htmlValue = toHtmlSafe(node, {
                allowDangerousCharacters: true,
                allowDangerousHtml: true,
              });
              return {
                properties: node.properties,
                type: "html",
                value: htmlValue,
              };
            }
          },
          code: (h: any, node: any) => {
            const inlineCode: any = {
              properties: node.properties,
              type: "inlineCode",
              children: h.all(node),
            };
            return inlineCode;
          },
          img: (h: any, node: any, parent: any) => img(node, parent),
          em: (h: any, node: any) => {
            let emphasis: any = {
              properties: node.properties,
              type: "emphasis",
              children: h.all(node),
            };
            return emphasis;
          },
          strong: (h: any, node: any) => {
            let strong: any = {
              properties: node.properties,
              type: "strong",
              children: h.all(node),
            };
            return strong;
          },
          ol: (h: any, node: any) => listToMdast(h, node, ListTypes.ol),
          ul: (h: any, node: any) => listToMdast(h, node, ListTypes.ul),
          a: (h: any, node: any) => linkHastToMdast(h, node, hast),
          table: (h: any, node: any) => tableHastToMdast(h, node),
          div: (h: any, node: any) => divHastToMdast(h, node),
          hr: (h: any, node: any) => {
            return { type: "thematicBreak", properties: node.properties };
          },
          br: (h: any, node: any) => {
            return { type: "break", properties: node.properties };
          },
          h2: (h: any, node: any) => headerHastToMdast(h, node),
          h1: (h: any, node: any) => headerHastToMdast(h, node),
          ...this.hastToMdastHandlers,
        },
      })
      .runSync(hast) as MdastRoot;

    let result = this.parseMdastToMarkdown(mdast);

    // Restore trailing whitespace captured during parse
    if (data.metadata?.trailingNewlines) {
      result = result.replace(/\n+$/, data.metadata.trailingNewlines as string);
    }

    return result;
  }

}
