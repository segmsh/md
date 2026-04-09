import { visitParents } from "unist-util-visit-parents";
import type { Element, ElementContent, Root } from "hast";
import { Document, Segment, element, id, root, segment } from "@segmsh/core";
import YamlProcessor from "@segmsh/yaml";
import { SegmentsMap } from "../types.js";
import { ListTypes } from "../handlers/hast-to-mdast/handlers.js";
import { hastToString } from "./hast.js";
import { avoidHtmlType } from "./html.js";
import {
  mapMdastTagAttributesToHast,
  parseTaggedTextToElements,
} from "./tag-markers.js";

export const getChildrenContentLength = (node: Element): number => {
  return node.children.reduce((acc: number, child: ElementContent) => {
    if (
      child.type === "element" ||
      ("value" in child && typeof child.value === "string" && child.value.trim())
    ) {
      acc += 1;
    }
    return acc;
  }, 0);
};

const isListNode = (node: Element): boolean =>
  node.tagName === ListTypes.ul || node.tagName === ListTypes.ol;

const getElementFromConvertedNode = (
  node: Element,
  convertNode: (node: any) => any,
): Element | null => {
  if (node.type !== "element") return null;

  const isNodeList = isListNode(node);
  const children: Element[] = node.children.map((child: ElementContent) => {
    if (node.properties?.marker === "html" && isNodeList) {
      "properties" in child && (child.properties.marker = "html");
    }

    return convertNode(child);
  });

  return {
    ...node,
    children,
  };
};

export function hastToSegments(
  tree: Root,
  yamlProcessor: YamlProcessor,
): Document {
  let segments: Segment[] = [];
  const treeRoot: Root = root([]);

  const addSegment = (node: any): string => {
    const tags = node.tags;
    const idValue: string = id({
      text: node.value || "",
      ...(tags && { tags }),
    });
    const segmentValue: Segment = {
      id: idValue,
      text: node.value || "",
      ...(tags && { tags }),
    };

    segments.push(segmentValue);

    return segmentValue.id;
  };

  const convertNode = (node: any): any => {
    if (node.type === "text") {
      if (node.value?.trim() === "") return node;
      return segment(addSegment(node));
    }

    const isHtmlNode: boolean =
      node.type === "element" && node.properties?.marker === "html";

    if (isHtmlNode && "tagName" in node) {
      if (node.tagName === "li") {
        const listChild: Element | undefined = node.children.find(isListNode);

        if (listChild) {
          const childrenLength: number = node.children.length - 1;
          node.children = node.children.filter(
            (child: Element, index: number) =>
              !isListNode(child) && index !== childrenLength,
          );
        }

        const { text, tags } = hastToString(node);
        const resultNode: Element = {
          ...node,
          children: [
            element("p", {}, segment(addSegment({ ...node, value: text, tags }))),
          ],
        };

        if (listChild) {
          "properties" in listChild && (listChild.properties.marker = "html");
          resultNode.children.push(convertNode(listChild));
        }

        return resultNode;
      }

      if (node.tagName === "a" || node.tagName === "img") {
        const { text, tags } = hastToString(node, {
          rootContext: { index: 0 },
        });

        return element(
          "p",
          {},
          segment(addSegment({ ...node, value: text, tags })),
        );
      }
    }

    const nodeElement = getElementFromConvertedNode(node, convertNode);
    if (nodeElement) return nodeElement;

    if (
      node.type === "comment" ||
      node.type === "definition" ||
      node.type === avoidHtmlType
    ) {
      return node;
    }

    if (node.type === "yaml" && node.value) {
      const yamlDoc = yamlProcessor.parse(node.value);
      segments = segments.concat(yamlDoc.segments);
      return yamlDoc.tree.children[0];
    }

    throw new Error(`Unsupported node type: ${node.type}`);
  };

  tree.children.forEach((child) => {
    visitParents(child, { type: "element" }, (node: any) => {
      if (node.properties?.tags) {
        node.children[0].tags = mapMdastTagAttributesToHast(
          JSON.parse(node.properties.tags),
        );
        delete node.properties.tags;
      }

      const childrenContentLength: number = getChildrenContentLength(node);
      const hasNodeImgOrLink: boolean =
        node.children.findIndex(
          (child: Element): boolean =>
            "tagName" in child &&
            (child.tagName === "a" || child.tagName === "img"),
        ) >= 0;

      if (
        node.tagName === "td" ||
        node.tagName === "th" ||
        hasNodeImgOrLink
      ) {
        if (
          (childrenContentLength > 1 &&
            node.children.some((el: ElementContent) => el.type === "element")) ||
          hasNodeImgOrLink
        ) {
          const { text, tags } = hastToString(node);

          if (text) {
            node.children = [{ type: "text", value: text, tags }];
          }
        }
      }

      if (
        (node.tagName === "img" || node.tagName === "a") &&
        node.children.length === 0
      ) {
        const tagName: string = `${node.tagName}0`;
        node.children.push({
          type: "text",
          value: `{${tagName}}`,
          tags: { [tagName]: node.properties },
        });
      }
    });

    treeRoot.children.push(convertNode(child));
  });

  return { tree: treeRoot, segments };
}

export function segmentsToHast(data: Document): Root {
  const segmentsMap: SegmentsMap = {};

  data.segments.forEach((segmentValue: Segment): void => {
    segmentsMap[segmentValue.id] = segmentValue;
  });

  visitParents(data.tree, { type: "segment" }, (node: any, parent) => {
    const structure: Element[] = parseTaggedTextToElements(segmentsMap[node.id]);
    const parentNode = parent[parent.length - 1];
    const indexElement = parentNode.children.findIndex(
      (child: { id?: string }): boolean => child.id === node.id,
    );

    if (parentNode.children.length === 1) {
      if (parentNode.tagName === "img") {
        parentNode.children = structure[0].children;
        parentNode.properties = structure[0].properties || {};
      } else {
        parentNode.children = structure;
      }
    } else {
      parentNode.children[indexElement] =
        structure.length > 1 ? structure : structure[0];
    }
  });

  return data.tree;
}
