# Heading patterns

This fixture keeps heading levels, emphasis, links, custom-looking inline code,
and setext headings, but uses synthetic text instead of copied documentation.

Note: Use a single top-level heading for each page unless there is a strong
reason to split the document into multiple independent sections.

## Heading 2

**Should headings use sentence case?**

Use sentence case for section titles unless your style guide explicitly says
otherwise.

## Anchors and links

Caution: If you want to link to a specific heading
[<`a href="#sample-anchor"`>](#sample-anchor), define a stable anchor when your
tooling supports it.

### Heading 3

Subheadings can appear in a generated table of contents depending on the site
configuration. That makes them useful for structure, but not a replacement for
clear paragraph flow.

#### Heading 4

##### Heading 5

###### Heading 6

    ## Heading 2
    ### Heading 3
    #### Heading 4
    ##### Heading 5
    ###### Heading 6

Setext heading level 1
======================

Setext heading level 2 with _inline emphasis_ and a [Link](https://placehold.it/350x150)
------------------------------------------------------------------------------------------
