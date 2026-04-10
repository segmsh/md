## Sample code

This fixture covers inline code, indented code blocks, fenced code blocks, and
HTML mixed into code-oriented content.

### Inline code

Use the `renderWidget()` function when you need a one-line example inside a
paragraph.

### Indented blocks

Here is an indented example:

    const config = {
      mode: "safe",
      retries: 3,
    };

    startJob(config);

### HTML inside code examples

Use `<strong>` to highlight a range inside a `<pre>` block when the source
format already relies on HTML.

<!---->

    <pre class="prettyprint">
    for (let i = 0; i < 3; i++) {
      <strong>log(i)</strong>
    }
    </pre>

### Fenced blocks

```header meta some text
for (let i = 0; i < 10; i++) {
  printf("Counting %d\n", i);
}
```

```header
for (const value of values) {
  <em>highlight(value)</em>
  <strong>emit(value)</strong>
}
```
