import type { Element } from "hast";
import { toHtml } from "hast-util-to-html";

type ParentNode = { type?: string } | null | undefined;

type MdastImageNode = {
  type: "image";
  url: string;
  title: string | null;
  alt: string;
};

type MdastHtmlNode = {
  type: "html";
  value: string;
};

type ImgElement = Element & {
  properties?: Record<string, unknown> & {
    alt?: string;
    marker?: string;
    src?: string;
    title?: string | null;
  };
};

export default function img(
  node: ImgElement,
  parent: ParentNode,
): MdastImageNode | MdastHtmlNode {
  const isNodeSyntaxHtml: boolean = !node.properties?.marker;

  if (isNodeSyntaxHtml) {
    const htmlValue: string = toHtml(node);
    return { type: "html", value: htmlValue };
  }

  if (parent?.type === "element" || parent?.type === "html") {
    const { src = "", title = null, alt = "" } = node.properties || {};

    return {
      type: "image",
      url: src,
      title,
      alt,
    };
  } else {
    let html = `<${node.tagName}`;

    if (node.properties) {
      Object.entries(node.properties as Record<string, unknown>).forEach(([key, value]) => {
        html += ` ${key}="${value}"`;
      });
    }

    html += ">";

    return {
      type: "html",
      value: html,
    };
  }
}
