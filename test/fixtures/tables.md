## Tables

Markdown tables and HTML tables should both remain stable after parse and
stringify.

| One | Two | Three |
| --- | --- | ----- |
| 1.0 | 2.0 | 3.0   |
| 1.1 | 2.1 | 3.1   |
| Group label |  |  |
| 1.2 | 2.2 | 3.2   |

    <table>
      <tr><th>One</th><th>Two</th><th>Three</th></tr>
      <tr><td>1.0</td><td>2.0</td><td>3.0</td></tr>
      <tr><td>1.1</td><td>2.1</td><td>3.1</td></tr>
      <tr class="alt"><td colspan="3">Grouped values</td></tr>
      <tr><td>1.2</td><td>2.2</td><td>3.2</td></tr>
    </table>

### Responsive table

| Parameter | Description |
| --------- | ----------- |
| `value` | `String` shown to the user |
| `mode` | `DisplayMode` used by the renderer |

*   Responsive reference tables should keep two columns.
*   Multi-line cell content can use `<p>` or `<br>` depending on the source format.

<!---->

    <table class="responsive">
      <tbody>
        <tr>
          <th colspan=2>Parameters</th>
        </tr>
        <tr>
          <td>
            <code>value</code>
          </td>
          <td>
            <code>String</code><br>
            the label shown in the UI
          </td>
        </tr>
        <tr>
          <td>
            <code>mode</code>
          </td>
          <td>
            <code>
              <a href="#">DisplayMode</a>
            </code>
            <br>the renderer display mode
          </td>
        </tr>
      </tbody>
    </table>

### Column layout table

<table class="columns">
  <tr>
    <td>
      <code>alpha</code><br />
      <code>beta</code><br />
      <code>gamma</code>
    </td>
    <td>
      <code>delta</code><br />
      <code>epsilon</code><br />
      <code>zeta</code>
    </td>
  </tr>
</table>
