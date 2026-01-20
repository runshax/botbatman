# `/ask` Command - Formula Documentation Search

## Overview
The `/ask` command allows users to search and retrieve information about payroll formula keywords directly from the Telegram bot.

## Features

### 1. Keyword Search
- **Exact match**: Searches for exact keyword names (e.g., `BASE`, `JOINDATE`)
- **Alias matching**: Supports keyword aliases (e.g., "Join Date" for `JOINDATE`)
- **Partial match**: Falls back to partial matching if exact match not found

### 2. Response Format
Each keyword response includes:
- **Name**: The official keyword name
- **Category**: The category (PAYFORM, EMPFORM, ATTINTF, etc.)
- **Syntax**: How to use the keyword in formulas
- **Description**: Brief explanation of what the keyword does
- **Example Usage**: Up to 2 practical examples with formulas and descriptions
- **Aliases**: Alternative names for the keyword

### 3. Documentation Source
The bot reads from three markdown files in `docs/formula/`:
- `keywords.md` - Comprehensive keyword reference (91 keywords)
- `examples.md` - Practical formula examples
- `reference.md` - Technical documentation

## Usage Examples

### Basic Usage
```
/ask BASE
```

**Response:**
```
📘 *BASE*

*Category:* PAYFORM
*Syntax:* `BASE`

*Description:*
References the current component's base value for calculations

*Example Usage:*

1. *Simple Percentage*
   Formula: `BASE * 0.05`
   Calculate 5% bonus

2. *Conditional Calculation*
   Formula: `IF(BASE > 10000, BASE * 0.10, BASE * 0.05)`
   10% if base exceeds 10000, otherwise 5%
```

### Search by Alias
```
/ask Join Date
```

Returns information for `JOINDATE` keyword.

### Employee Data Keywords
```
/ask JOINDATE
/ask GRADE
/ask POSITIONNAME
```

### Overtime Keywords
```
/ask OTRD_FULL
/ask OTPH_HALF
/ask OVT_TOTAL
```

### Special Keywords
```
/ask @COMPONENT_CODE
/ask YTD_COMPONENT_CODE
/ask PRORATECD_CODE
```

## Implementation Details

### File Structure
```
botbatman/
├── docs/
│   ├── formula/
│   │   ├── keywords.md    (4,671 lines - keyword reference)
│   │   ├── examples.md    (1,582 lines - practical examples)
│   │   └── reference.md   (1,270 lines - technical docs)
│   └── ASK_COMMAND.md     (this file)
├── index.js               (main bot file with /ask command)
└── .gitignore
```

### Code Location
- **Parser function**: `parseKeywordsFromMarkdown()` - Lines 88-169 in [index.js](../index.js)
- **Search function**: `searchKeyword()` - Lines 171-191 in [index.js](../index.js)
- **Command handler**: `/ask` command - Lines 581-638 in [index.js](../index.js)

### Search Algorithm
1. **Exact match**: `keyword.name === searchTerm`
2. **Alias match**: Check all aliases for exact match
3. **Partial match**: `keyword.name.includes(searchTerm)`

### YAML Parsing
The parser extracts data from YAML frontmatter in keywords.md:
```yaml
---
keyword: BASE
aliases: []
category: PAYFORM
syntax: BASE
description: References the current component's base value for calculations
---
```

## Benefits

1. **Quick Reference**: Instantly look up keywords without leaving Telegram
2. **Always Available**: Documentation is embedded in the bot
3. **No External API**: Works offline, no paid API required
4. **Up-to-date**: Uses the same markdown files as the main documentation
5. **User Friendly**: Simple command syntax with helpful examples

## Deployment Notes

### For Koyeb Deployment
The markdown files in `docs/formula/` must be included in the git repository:
```bash
git add docs/
git commit -m "Add formula documentation for /ask command"
git push
```

### File Sizes
- keywords.md: ~92 KB (4,671 lines)
- examples.md: ~32 KB (1,582 lines)
- reference.md: ~33 KB (1,270 lines)
- Total: ~157 KB

### Memory Impact
- Files are read on each `/ask` command
- Parsing takes ~50-100ms per search
- No caching implemented (files are re-parsed each time)

## Future Enhancements

Possible improvements:
1. **Cache parsed keywords**: Load once on startup instead of per request
2. **Search examples.md**: Allow searching practical examples by scenario
3. **Fuzzy search**: Better matching for misspelled keywords
4. **Related keywords**: Show related keywords in response
5. **Multi-language**: Support Indonesian keyword aliases

## Testing

Test commands to verify functionality:
```
/ask              # Show usage
/ask BASE         # Test basic keyword
/ask JOINDATE     # Test with aliases
/ask @COMPONENT   # Test special characters
/ask overtime     # Test partial match
/ask NOTFOUND     # Test error handling
```

## Related Commands

- `/keywords` - List all available formula keywords by category
- `/parse` - Calculate formulas with variables
- `/help` - Show all available commands
- `/clear` - Clear bot messages

---

# `/keywords` Command - List All Keywords

## Overview
The `/keywords` command provides a categorized list of all available formula keywords in the documentation.

## Usage

### Show All Categories
```
/keywords
```

**Response:**
```
📚 *Formula Keywords by Category*

Total: 90 keywords

*ATTINTF* (11)
*ATTSTATUS* (16)
*COMPCODE* (1)
*DEFFORM* (28)
*EMPDATA* (9)
*EMPFORM* (16)
*PAYFORM* (8)
*PAYVAR* (1)

*Usage:*
• `/keywords` - Show all categories
• `/keywords CATEGORY` - List keywords in category
• `/ask KEYWORD` - Get keyword details

*Examples:*
`/keywords PAYFORM`
`/keywords EMPFORM`
`/keywords ATTINTF`
```

### List Keywords in Specific Category
```
/keywords PAYFORM
```

**Response:**
```
📚 *PAYFORM* (8 keywords)

• `@COMPONENT_CODE`
• `BASE`
• `COMPONENT_CODE_RESULT`
• `PRORATECD_CODE`
• `PRORATEPRS_CODE`
• `PRORATEWD_CODE`
• `PRORATEWS_CODE`
• `YTD_COMPONENT_CODE`

💡 _Use_ `/ask KEYWORD` _to learn more_
```

## Categories

### PAYFORM (8 keywords)
Payroll formula keywords for component calculations and cross-references.

### EMPFORM (16 keywords)
Employee data keywords like join date, termination date, service length.

### DEFFORM (28 keywords)
Built-in functions like IF, SUM, MAX, DATEDIFF, ROUND, etc.

### ATTINTF (11 keywords)
Attendance integration keywords for overtime and work hours.

### ATTSTATUS (16 keywords)
Attendance status keywords for presence tracking.

### EMPDATA (9 keywords)
Employee master data like name, position, grade, department.

### COMPCODE (1 keyword)
Component code references.

### PAYVAR (1 keyword)
Pay variables.

## Features

- **Category Browsing**: View keywords organized by functionality
- **Quick Reference**: See all available keywords at a glance
- **Smart Chunking**: Large categories are split into multiple messages
- **Integration**: Works seamlessly with `/ask` command for details

## Examples

```
/keywords              # Show all categories
/keywords PAYFORM      # Payroll formulas
/keywords EMPFORM      # Employee data
/keywords DEFFORM      # Built-in functions
/keywords ATTINTF      # Attendance/overtime
/keywords overtime     # Partial match works too
```

---

**Last Updated**: 2026-01-20
**Version**: 1.0.0
