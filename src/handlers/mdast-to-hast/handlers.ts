import { Heading, Paragraph } from "mdast";
import { Element, ElementContent, Properties } from "hast";

type MdastToHastState = {
  all(node: Heading | Paragraph): ElementContent[];
};

type SerializedTextPayload = {
  tags?: Properties;
};

type MarkerNode = {
  marker?: string;
  properties?: Properties;
  type: string;
};

export const segmentParentNodeToHast = (
  state: MdastToHastState,
  node: (Heading | Paragraph) & { marker?: string },
  serializedText: SerializedTextPayload | null,
  tagName: string
): Element => {
  node.children = serializedText ? [serializedText as never] : [];

  const resultHast: Element = {
    type: "element",
    tagName: tagName,
    properties: serializedText?.tags || {},
    children: state.all(node),
  };
  if("marker" in node) {
    resultHast.properties.marker = node.marker
  }
  return resultHast;
};

export const breakHandler = (node: MarkerNode): Element => {
  const result: Element = {
    properties: { ...node.properties, marker: node.marker || "" },
    type: "element",
    tagName: node.type === "thematicBreak" ? "hr" : "br",
    children: [],
  };
  return result;
};
