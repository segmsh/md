<!--
Synthetic stress fixture for mixed Markdown and HTML content.
It is intentionally verbose enough to exercise nested structures without
embedding copied third-party documentation.
-->

_This document exists to stress mixed parsing paths rather than to provide end-user guidance._

## Validation rules <a name="validation-rules"></a>

The sample below mixes Markdown headings, HTML anchors, tables, lists, inline
code, and block HTML.

<table>
  <thead>
    <tr>
      <th>Rule</th>
      <th>Reason</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Include a root wrapper element.</td>
      <td>It keeps the rendered structure predictable.</td>
    </tr>
    <tr>
      <td>Prefer explicit labels for interactive controls.</td>
      <td>It improves readability and accessibility.</td>
    </tr>
    <tr>
      <td>Avoid deeply nested presentational wrappers.</td>
      <td>They make source editing harder than it needs to be.</td>
    </tr>
  </tbody>
</table>

### Example block <a name="example-block"></a>

<div class="callout">
  <p><strong>Note:</strong> This HTML block contains inline formatting and a <a href="https://example.com/reference">reference link</a>.</p>
  <pre>
const widget = {
  id: "sample-widget",
  enabled: true,
};
  </pre>
</div>

#### Allowed components

- [sample-panel](https://example.com/components/sample-panel)
- [sample-toggle](https://example.com/components/sample-toggle)
- [sample-grid](https://example.com/components/sample-grid)

The following code fragment is included as inline content: `<sample-grid mode="compact">`.

### Mixed table content

<table class="responsive">
  <tbody>
    <tr>
      <th colspan="2">Fields</th>
    </tr>
    <tr>
      <td><code>title</code></td>
      <td><code>string</code><br>Visible heading text</td>
    </tr>
    <tr>
      <td><code>items</code></td>
      <td>
        <code>Item[]</code>
        <br>Collection rendered inside the panel
      </td>
    </tr>
  </tbody>
</table>

### Notes

1. Keep nested markup readable.
2. Preserve HTML comments when they appear in source.
3. Accept block HTML that contains Markdown-like text without rewriting it unnecessarily.

<!--
Second comment block for parser coverage.
-->

<section>
  <h4>Embedded section</h4>
  <p>This section exists only to increase structural variety.</p>
  <ul>
    <li>First item with <em>emphasis</em></li>
    <li>Second item with <strong>strong text</strong></li>
    <li>Third item with <code>inline-code</code></li>
  </ul>
</section>
