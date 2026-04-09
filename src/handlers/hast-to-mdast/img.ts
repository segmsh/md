import { toHtml } from "hast-util-to-html";

export default function img(node: any, parent: any): any {
  const isNodeSyntaxHtml: boolean = !node.properties?.marker;

  if (isNodeSyntaxHtml) {
    const res: string = toHtml(node);
    return { type: "html", value: res };
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
