import {phrasing as hastPhrasing} from 'hast-util-phrasing'
import {whitespace} from 'hast-util-whitespace'
import {phrasing as mdastPhrasing} from 'mdast-util-phrasing'
import {dropSurroundingBreaks} from './drop-surrounding-breaks.js'
import { BlockContent, Delete, Link, Nodes, Paragraph, PhrasingContent, RootContent } from 'mdast';

type ParentWithChildren = { children: any[] }

export function needsWrapping(nodes: Nodes[]): boolean {
  let index = -1

  while (++index < nodes.length) {
    const node = nodes[index]

    if (!phrasing(node) || ('children' in node && needsWrapping(node.children as Nodes[]))) {
      return true
    }
  }

  return false
}

export function wrap(nodes: RootContent[]): BlockContent[] {
  return runs(nodes, onphrasing, function (blockNode: any) {
    return blockNode
  })

  function onphrasing(nodes: PhrasingContent[]): Paragraph[] {
    return nodes.every(function (contentNode) {
      return contentNode.type === 'text' ? whitespace(contentNode.value) : false
    })
      ? []
      : [{type: 'paragraph', children: dropSurroundingBreaks(nodes)} as Paragraph]
  }
}

function split(node: Delete | Link): BlockContent[] {
  return runs(node.children, onphrasing, onnonphrasing)

  function onphrasing(nodes: PhrasingContent[]): BlockContent[] {
    const clonedParent = cloneWithoutChildren(node) as Delete | Link
    const parentWithChildren = clonedParent as ParentWithChildren
    parentWithChildren.children = nodes
    return [clonedParent as unknown as BlockContent]
  }

  function onnonphrasing(blockNode: BlockContent): BlockContent {
    if ('children' in blockNode && 'children' in node) {
      const clonedParent = cloneWithoutChildren(node) as Delete | Link
      const clonedBlock = cloneWithoutChildren(blockNode) as BlockContent & ParentWithChildren
      const parentWithChildren = clonedParent as ParentWithChildren
      parentWithChildren.children = (blockNode as ParentWithChildren).children
      clonedBlock.children.push(clonedParent as unknown as BlockContent)
      return clonedBlock as BlockContent
    }

    return {...blockNode}
  }
}

function runs(
  nodes: RootContent[],
  onphrasing: (nodes: PhrasingContent[]) => BlockContent[],
  onnonphrasing: (node: BlockContent) => BlockContent
): BlockContent[] {
  const flattened = flatten(nodes)
  const result: BlockContent[] = []
  let queue: PhrasingContent[] = []
  let index = -1

  while (++index < flattened.length) {
    const node = flattened[index]

    if (phrasing(node)) {
      queue.push(node as PhrasingContent)
    } else {
      if (queue.length > 0) {
        result.push(...onphrasing(queue))
        queue = []
      }

      result.push(onnonphrasing(node as BlockContent))
    }
  }

  if (queue.length > 0) {
    result.push(...onphrasing(queue))
    queue = []
  }

  return result
}

function flatten(nodes: RootContent[]): RootContent[] {
  const flattened: RootContent[] = []
  let index = -1

  while (++index < nodes.length) {
    const node = nodes[index]

    if (
      (node.type === 'delete' || node.type === 'link') &&
      needsWrapping(node.children)
    ) {
      flattened.push(...split(node))
    } else {
      flattened.push(node)
    }
  }

  return flattened
}

function phrasing(node: any): boolean {
  const tagName = node.data && node.data.hName
  return tagName
    ? hastPhrasing({type: 'element', tagName, properties: {}, children: []})
    : mdastPhrasing(node)
}

function cloneWithoutChildren(node: any): any {
  return structuredClone({...node, children: []})
}
