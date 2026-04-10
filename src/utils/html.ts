export const avoidHtmlType: string = "html!";
export const avoidHtmlTags: string[] = ["iframe", "html"];

export interface PlaceholderContent {
  content: string;
  contentWithoutTags: string;
  placeholder: string;
  placeholderWithoutTags: string;
  tagName: string;
}

const extractTagSequence = (source: string, tagName: string): string[] => {
  const tagPattern: RegExp = new RegExp(`(?:<)(\/?${tagName}.*?)(?=>)`, "g");
  const tagMatches: string[] = [];

  const matches = source.match(tagPattern);

  if (matches) {
    for (const match of matches) {
      const matchedTag = match.slice(1);
      tagMatches.push(matchedTag);
    }
  }

  return tagMatches;
};

const extractNestedTagContent = (source: string, tagName: string): string | null => {
  const closeTagRegExp: RegExp = new RegExp(`</${tagName}>`);
  const openTagRegExp: RegExp = new RegExp(`<${tagName}.*?>`, "m");

  const tagSequence: string[] = extractTagSequence(source, tagName);

  let currentIndex: number = 0;
  let openTagCounter: number = 0;
  let closeTagCounter: number = 0;

  const indexIncrement: number = tagName.length + 2;

  const nestedContent: string = tagSequence.reduce((contentBetweenTags, tag) => {
    const isCloseTag = !tag.indexOf("/");

    if (isCloseTag) {
      closeTagCounter++;
      const closeTagIndex: number = source.indexOf(tag, currentIndex);
      currentIndex = closeTagIndex + indexIncrement;
    } else {
      openTagCounter++;
      const openTagIndex: number = source.indexOf(tag, currentIndex);
      currentIndex = openTagIndex + indexIncrement;
    }

    if (openTagCounter === closeTagCounter && !contentBetweenTags) {
      const closingTagMatch: any[] | null = source.match(closeTagRegExp);
      const openingTagMatch: any[] | null = source.match(openTagRegExp);

      if (openingTagMatch && closingTagMatch) {
        contentBetweenTags = source.substr(
          openingTagMatch[0].length,
          currentIndex - closingTagMatch[0].length - openingTagMatch[0].length
        );
        return contentBetweenTags;
      }
    }
    return contentBetweenTags;
  }, "");

  return openTagCounter === closeTagCounter || nestedContent
    ? nestedContent
    : null;
};

export const replaceHtmlBeforeMdast = (
  markdownString: string
): { docWithHtmlPlaceholders: string; contentsAvoidMarkdown: PlaceholderContent[] } => {
  const htmlSimpleTagPattern: RegExp =
    /((<(pre|code|var|html|aside|blockquote|body|dl|details|div|figure|footer|head|header|iframe|main|noscript|object|ol|q|ruby|samp|script|section|style|table|template|ul).*?>)((?:.|\n|\r\n)*?))(<\/\3>)/g;

  const mdHtmlPlaceholderPrefix: string = "MD_HTML_PLACEHOLDER_";

  const contentsAvoidMarkdown: PlaceholderContent[] = [];
  let rewrittenMarkdown: string = markdownString;

  let matchedTag;
  let index: number = 0;
  while ((matchedTag = htmlSimpleTagPattern.exec(markdownString)) !== null) {
    index++;

    const fullTag: string = matchedTag[0];
    const openTag: string = matchedTag[2];
    const closedTag: string = matchedTag[5];
    const tagName: string = matchedTag[3];
    const tagContent: string = matchedTag[4];

    const openTagRegExp: RegExp = new RegExp(`<${tagName}.*?>`, "m");
    const nestedOpenTagMatch: any[] | null = tagContent.match(openTagRegExp);

    if (nestedOpenTagMatch) {
      const startTagIndex: number = markdownString.indexOf(fullTag);
      const content: string | null = extractNestedTagContent(
        markdownString.slice(startTagIndex, markdownString.length - 1),
        tagName
      );
      if (content === null) {
        return {
          docWithHtmlPlaceholders: markdownString,
          contentsAvoidMarkdown: [],
        };
      }
      const placeholder: string = mdHtmlPlaceholderPrefix + index;

      contentsAvoidMarkdown.push({
        placeholder: openTag + placeholder + closedTag,
        placeholderWithoutTags: placeholder,
        content: openTag + content + closedTag,
        contentWithoutTags: content,
        tagName
      });

      rewrittenMarkdown = rewrittenMarkdown.replace(content, placeholder);
    } else {
      const placeholder: string = mdHtmlPlaceholderPrefix + index;

      contentsAvoidMarkdown.push({
        placeholder: openTag + placeholder + closedTag,
        placeholderWithoutTags: placeholder,
        content: openTag + tagContent + closedTag,
        contentWithoutTags: tagContent,
        tagName
      });

      const isCodeBlockInMarkdown = isIndentedCodeBlockContext(
        rewrittenMarkdown,
        fullTag
      );
      if (!isCodeBlockInMarkdown)
        rewrittenMarkdown = rewrittenMarkdown.replace(
          fullTag,
          openTag + placeholder + closedTag
        );
    }
  }

  function isIndentedCodeBlockContext(
    markdownSource: string,
    fullTag: string
  ): boolean {
    const endIndex: number = markdownSource.indexOf(fullTag);
    const startIndex: number = endIndex < 8 ? 0 : endIndex - 8;
    const surroundingSource: string = markdownSource.slice(
      startIndex,
      endIndex
    );

    const tab = " ".repeat(4);
    const lineBreak = "\n";
    const lineBreakLinux = "\r\n";

    return (
      surroundingSource.includes(`${lineBreakLinux}${lineBreakLinux}${tab}`) ||
      surroundingSource.includes(`${lineBreak}${lineBreak}${tab}`)
    );
  }

  return { docWithHtmlPlaceholders: rewrittenMarkdown, contentsAvoidMarkdown };
};
