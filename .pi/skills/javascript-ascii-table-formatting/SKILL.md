---
name: javascript-ascii-table-formatting
description: Formats an array of objects into a clean, readable ASCII table. Use this skill when you need to present data in a tabular format in the terminal.
compatibility: Requires a JavaScript runtime (Node.js).
---

# ASCII Table Formatting

This document outlines best practices for creating clean, readable ASCII tables in your terminal output. It covers both the visual layout and the underlying code principles.

## I. Key Principles

Your main goal should always be to **maximize readability**. Everything else flows from this. Keep these three principles in mind:

- **Clarity**: The table's structure and data should be easy to understand at a glance. Avoid clutter and unnecessary decorations.
- **Alignment**: Consistently align text and numbers to create a clean, organized look. This helps the reader's eye scan the table smoothly.
- **Simplicity**: Don't over-complicate your formatting. A simple, clean table is more effective than a busy, over-designed one.

---

## II. Layout Best Practices

Based on our conversation, we've developed a clean, minimalist layout that works well for most situations. Here's a summary of the key formatting decisions we made:

| Element              | Style                                                                                                      | Rationale                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **Column Separator** | Use at least three spaces (`   `). Avoid vertical bars (`                                                  | `) as they can create a "jail cell" effect.                                    | Creates a clean, open feel without sacrificing structure. |
| **Row Separator**    | Use a single, blank line between each row to give the content room to breathe.                             | Improves readability by preventing rows from visually merging into each other. |
| **Header Separator** | Use a horizontal line of dashes (`-`) that spans the full width of each column.                            | Clearly distinguishes the headers from the table's body.                       |
| **Grouping**         | When grouping rows by a common key (like a session ID), only display the key once, in the first row.       | Reduces visual noise and makes it easier to see the structure of the data.     |
| **Totals Separator** | Use a full-width dashed line in columns that are being summed up (like "Cost"). Leave other columns blank. | Clearly marks the separation between the data and its summary.                 |

---

## III. Code Implementation

To make it easy to reuse this formatting, here is a JavaScript function that encapsulates all of the best practices we've discussed.

```javascript
/**
 * Calculates the maximum width needed for each column based on headers and data.
 * @param {string[]} headers - The column headers.
 * @param {Record<string, any>[]} data - The data rows.
 * @returns {number[]} An array of maximum widths for each column.
 */
const calculateColumnWidths = (headers, data) => {
  const widths = headers.map((h) => h.length);
  data.forEach((row) => {
    headers.forEach((header, i) => {
      const cellValue = String(row[header] || "");
      if (cellValue.length > widths[i]) {
        widths[i] = cellValue.length;
      }
    });
  });
  return widths;
};

/**
 * Formats an array of objects into a clean, readable text table.
 * @param {Record<string, any>[]} data - The array of objects to format.
 * @returns {string} The formatted table as a string.
 */
function formatTable(data) {
  if (!data || data.length === 0) {
    return "";
  }

  const headers = Object.keys(data[0]);
  const columnWidths = calculateColumnWidths(headers, data);
  const COLUMN_SEPARATOR = "   ";

  // 1. Build the header row
  const headerRow = headers
    .map((header, i) => header.padEnd(columnWidths[i]))
    .join(COLUMN_SEPARATOR);

  // 2. Build the separator row (e.g., "---   -------")
  const separatorRow = columnWidths
    .map((width) => "-".repeat(width))
    .join(COLUMN_SEPARATOR);

  // 3. Build the body rows
  const bodyRows = data.map((row) => {
    return headers
      .map((header, i) => {
        const cellValue = String(row[header] || "");
        // Handle the custom horizontal line drawn for totals
        if (cellValue === "-------") {
          return "-".repeat(columnWidths[i]);
        }
        return cellValue.padEnd(columnWidths[i]);
      })
      .join(COLUMN_SEPARATOR);
  });

  // 4. Assemble the final table
  return [headerRow, separatorRow, ...bodyRows].join("\n");
}
```
