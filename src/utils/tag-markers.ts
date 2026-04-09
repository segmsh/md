import { visitParents } from "unist-util-visit-parents";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import type { Element } from "hast";
import type { Segment, Tag } from "@segmsh/core";
import { deleteFields as deletePositionFields } from "./delete-fields.js";

const allowedTagsRegex: RegExp = /^\/?[a-zA-Z]+\d+$/;

const convertMdastTagToHast = (node: any) => {
  const tag = node.type;
  const tagsMap: Record<string, string> = {
    link: "a",
    inlineCode: "code",
    emphasis: "em",
    image: "img",
    linkReference: "a",
    mdxJsxTextElement: node.name,
    delete: "del",
    break: "br",
  };

  return tagsMap[tag] ? tagsMap[tag] : tag;
};

export const convertMdastTagsToHast = (tags: any) => {
  let newTags: Record<string, Tag> = {};
  const tagsMapLinks: Record<string, string> = { url: "href" };
  const tagsMapImg: Record<string, string> = { url: "src" };

  for (const key in tags) {
    if (tags.hasOwnProperty(key)) {
      const innerObject = tags[key];
      const transformedInnerObject: Tag = {};
      const tagsMap = key.includes("img") ? tagsMapImg : tagsMapLinks;

      for (const innerKey in innerObject) {
        if (innerObject.hasOwnProperty(innerKey)) {
          let tagAttributeValue = innerObject[innerKey];

          if (typeof tagAttributeValue === "object") {
            deletePositionFields(tagAttributeValue);
            tagAttributeValue = JSON.stringify(tagAttributeValue);
          }

          transformedInnerObject[tagsMap[innerKey] || innerKey] = tagAttributeValue;
        }
      }

      newTags[key] = transformedInnerObject;
    }
  }

  return newTags;
};

function parseHTMLTags(html: string) {
  if (!html || html.length < 2) return { tagName: "", htmlAttributes: {} };
  const isUpperCaseCapitalLetter = html[1] === html[1].toUpperCase();

  const tree = unified()
    .use(rehypeParse, { fragment: true })
    .parse(html);

  let tagName = "";
  let htmlAttributes = {};

  tree.children.forEach((node: any) => {
    if (node.type === "element") {
      tagName = node.tagName;
      if (isUpperCaseCapitalLetter) {
        tagName = tagName.charAt(0).toUpperCase() + tagName.slice(1);
      }

      const attributes: any = {};
      for (const [key, value] of Object.entries(node.properties || {})) {
        if (key === "className" && Array.isArray(value)) {
          attributes.class = value.join(" ");
        } else if (key === "htmlFor") {
          attributes.for = value;
        } else if (value === true) {
          attributes[key] = "";
        } else {
          attributes[key] = String(value);
        }
      }
      htmlAttributes = attributes;
    }
  });

  return { tagName, htmlAttributes };
}

export function convertMdastNodeToText(node: any, mdast?: any) {
  let resultNodeText = "";
  let tagCount = 0;
  let tags: Record<string, Tag> = {};
  const htmlTags: number[] = [];

  const nodeToString = (childNode: any): string => {
    if (childNode.type === "linkReference" && mdast) {
      visitParents(
        mdast,
        (mdastChild) =>
          mdastChild.type === "definition" &&
          "identifier" in mdastChild &&
          mdastChild.identifier === childNode.identifier,
        (definition: any) => {
          childNode.url = definition.url;
        },
      );
    }

    const tag = convertMdastTagToHast(childNode);
    let tagNameWithIndex = "";

    if (childNode.type === "html") {
      let value = "";
      const { tagName, htmlAttributes } = parseHTMLTags(childNode.value);
      const closingTag = /^<\/\w+>$/;
      let tagCountTemp = tagCount;

      if (closingTag.test(childNode.value)) {
        tagCountTemp = htmlTags.pop()!;
        const tagName = childNode.value.replace(/[<>]/g, "");
        value = `{${tagName}${tagCountTemp}}`;
      }

      if (tagName) {
        value = `{${tagName}${tagCountTemp}}`;
        tags[tagName + tagCountTemp] = { ...htmlAttributes };
        if (childNode.marker) tags[tagName + tagCountTemp].marker = childNode.marker;
        htmlTags.push(tagCount);
        tagCount++;
      }

      return value;
    }

    if (childNode.type === "footnoteReference") {
      return `[^${childNode.label}]`;
    }

    if ("children" in childNode) {
      const tagCountTemp = tagCount;
      tagNameWithIndex = tag + tagCountTemp;
      setTags(childNode, tagNameWithIndex);
      tagCount++;
      const content = childNode.children.map(nodeToString).join("");
      return `{${tag}${tagCountTemp}}${content}{/${tag}${tagCountTemp}}`;
    }

    if ("value" in childNode || childNode.type === "image") {
      if (tag !== "text") {
        let value: string;
        tagNameWithIndex = tag + tagCount;
        setTags(childNode, tagNameWithIndex);

        if (childNode.type === "image") {
          value = `{${tag}${tagCount}}`;
        } else {
          value = `{${tag}${tagCount}}${childNode.value || ""}{/${tag}${tagCount}}`;
        }

        tagCount++;
        return value;
      }

      return childNode.value;
    }

    if (childNode.type === "break") {
      setTags(childNode, `br${tagCount}`);
      return `{br${tagCount}}`;
    }

    return "";
  };

  const setTags = (childNode: any, tag: string): void => {
    const tagTypeList = ["url", "title", "alt", "marker", "identifier", "data"];
    const attr: any = {};

    tagTypeList.forEach((tagType) => {
      if (childNode[tagType]) {
        attr[tagType] = childNode[tagType];
      }
    });

    if (Object.keys(attr).length > 0) {
      tags[tag] = { ...tags[tag], ...attr };
    }
  };

  resultNodeText = node.children.map(nodeToString).join("");

  if (!resultNodeText) return null;

  return {
    type: "text",
    value: resultNodeText,
    tags:
      Object.keys(tags).length > 0
        ? {
            tags: JSON.stringify(tags, (_key, value) =>
              typeof value === "bigint" ? value.toString() : value,
            ),
          }
        : {},
  };
}

export function parseStringToStructure(segment: Segment): Element[] {
  const text: string = segment.text;
  const stack = [];
  let currentText = "";

  const isSerializedObject = (value: unknown): value is string =>
    typeof value === "string" &&
    ((value.charAt(0) === "{" && value.charAt(value.length - 1) === "}") ||
      (value.charAt(0) === "[" && value.charAt(value.length - 1) === "]"));

  const normalizeTagName = (tagWithIndex: string): string => {
    const headingTagRegExp: RegExp = /^(\/)?h(\d)*$/;
    return headingTagRegExp.test(tagWithIndex)
      ? tagWithIndex.replace(/\d(?!.*\d)/, "")
      : tagWithIndex.replace(/\d/g, "");
  };

  const getTagProperties = (tagWithIndex: string): Record<string, unknown> => {
    const rawProperties = segment.tags?.[tagWithIndex];
    if (!rawProperties) return {};

    return Object.entries(rawProperties).reduce<Record<string, unknown>>(
      (acc, [key, value]) => {
        acc[key] = isSerializedObject(value) ? JSON.parse(value) : value;
        return acc;
      },
      {},
    );
  };

  for (let i = 0; i < text.length; i++) {
    if (
      text[i] === "{" &&
      allowedTagsRegex.test(text.substring(i + 1, text.indexOf("}", i + 1)))
    ) {
      if (currentText !== "") {
        stack.push({ type: "text", value: currentText });
        currentText = "";
      }

      const closingIndex: number = text.indexOf("}", i + 1);
      const tagWithIndex: string = text.substring(i + 1, closingIndex);
      const tag: string = normalizeTagName(tagWithIndex);

      if (tag.startsWith("/")) {
        const closingTag: string = tag.substring(1);
        const elements = [];

        while (stack.length > 0) {
          const element: any = stack.pop();
          if (element.type === "element" && element.tagName === closingTag) {
            element.children = elements;
            stack.push(element);
            break;
          }
          elements.unshift(element);
        }
      } else {
        stack.push({
          type: "element",
          tagName: tag,
          properties: getTagProperties(tagWithIndex),
          children: [],
        });
      }

      i = closingIndex;
    } else {
      currentText += text[i];
    }
  }

  if (currentText !== "") {
    stack.push({ type: "text", value: currentText });
  }

  return stack;
}
