# `/ask` Command - Formula Documentation Browser

## Overview
The `/ask` command provides a 2-level browsing system for payroll formula keywords. Browse by category, then see all keywords with descriptions.

## How It Works

### Level 1: Browse Categories
Type `/ask` (no parameters) to see all 8 categories.

**Command:**
```
/ask
```

**Response:**
```
📚 Formula Keywords

Total: 90 keywords

ATTINTF (11)
Attendance integration (overtime, work hours)

ATTSTATUS (16)
Attendance status tracking

COMPCODE (1)
Component code references

DEFFORM (28)
Built-in functions (IF, SUM, DATEDIFF, etc.)

EMPDATA (9)
Employee master data

EMPFORM (16)
Employee data (join date, service length)

PAYFORM (8)
Payroll formula keywords

PAYVAR (1)
Pay variables

How to use:
Type: `/ask ATTINTF` to see all keywords

Try these:
`/ask PAYFORM`
`/ask DEFFORM`
`/ask ATTINTF`
```

### Level 2: Browse Keywords in Category
Type `/ask CATEGORY` to see all keywords with brief descriptions.

**Command:**
```
/ask ATTINTF
```

**Response:**
```
📚 ATTINTF (11 keywords)
Keywords used in attendance integration (overtime, work hours)

OTHWD
Overtime hours on working day

OTINDEX
Overtime index for calculations

OTMEAL
Overtime meal allowance

OTPH_EXC
Overtime on public holiday (exception period)

OTPH_FULL
Overtime on public holiday (full day period)

OTPH_HALF
Overtime on public holiday (half day period)

OTRD_EXC
Overtime on rest day (exception period)

OTRD_FULL
Overtime on rest day (full day period)

OTRD_HALF
Overtime on rest day (half day period)

OTTRANSPORT
Overtime transport allowance

OVT_TOTAL
Total overtime hours
```

## Available Categories

### 1. ATTINTF (11 keywords)
**Description:** Attendance integration - overtime and work hours tracking

**Keywords:** OTHWD, OTINDEX, OTMEAL, OTPH_EXC, OTPH_FULL, OTPH_HALF, OTRD_EXC, OTRD_FULL, OTRD_HALF, OTTRANSPORT, OVT_TOTAL

**Use for:** Overtime calculations, meal allowances, transport allowances

---

### 2. ATTSTATUS (16 keywords)
**Description:** Attendance status tracking

**Keywords:** ABO, ACD, ACDB, AWD, AWH, AWDB, AWDSH, PRSMA, PRSMS, TARDINESS, TCD, TCDB, TWA, TWD, TWDB, UNDERTIME

**Use for:** Tracking employee presence, absences, working days

---

### 3. COMPCODE (1 keyword)
**Description:** Component code references

**Keywords:** (Dynamic component codes)

**Use for:** Referencing other payroll components

---

### 4. DEFFORM (28 keywords)
**Description:** Built-in functions for formula calculations

**Keywords:** ABS, AND, CONCATENATE, CONCATENATESKIPNULL, COUNT, CREATEDATE, DATEADD, DATEDIFF, DATETIME_NOW, DAY, DAYOFWEEK, DAYSINMONTH, FINDLIST, HOUR, IF, ISDATE, ISNUMERIC, LENGTHOFSERVICE, MAX, MIN, MINUTE, MONTH, OR, ROUND, SECOND, SUM, TODAY, YEAR

**Use for:** Conditional logic, date calculations, math operations, string manipulation

---

### 5. EMPDATA (9 keywords)
**Description:** Employee master data fields

**Keywords:** COSTCENTER, DEPTNAME, EMPGENDER, EMPNO, EMPLOYMENTSTATUS, GRADE, POSITIONNAME, WORKLOCATION, (and more)

**Use for:** Accessing employee information in formulas

---

### 6. EMPFORM (16 keywords)
**Description:** Employee data related to dates and service

**Keywords:** EFFECTIVEDATE, ENDDATE, FULLJOINDATE, JOINDATE, LENGTHOFSERVICE_DAY, LENGTHOFSERVICE_MONTH, LENGTHOFSERVICE_YEAR, LOS_CONTRACT1, LOS_CONTRACT2, LOS_ENDOFCONTRACT_DAY, LOS_ENDOFCONTRACT_MONTH, LOS_PERMANENT, LOS_PROBATION, PENSIONDATE, PERMANENTDATE, TERMINATEDATE

**Use for:** Calculating service length, probation periods, seniority-based benefits

---

### 7. PAYFORM (8 keywords)
**Description:** Payroll formula keywords for calculations

**Keywords:** @COMPONENT_CODE, BASE, COMPONENT_CODE_RESULT, PRORATECD_CODE, PRORATEPRS_CODE, PRORATEWD_CODE, PRORATEWS_CODE, YTD_COMPONENT_CODE

**Use for:** Component references, proration, year-to-date calculations

---

### 8. PAYVAR (1 keyword)
**Description:** Pay variables

**Keywords:** (Pay period variables)

**Use for:** Dynamic pay period data

---

## Quick Examples

### Browse Categories
```
/ask
```

### View Payroll Keywords
```
/ask PAYFORM
```
Shows: BASE, @COMPONENT_CODE, YTD_COMPONENT_CODE, proration keywords, etc.

### View Built-in Functions
```
/ask DEFFORM
```
Shows: IF, SUM, DATEDIFF, ROUND, CONCATENATE, etc.

### View Overtime Keywords
```
/ask ATTINTF
```
Shows: OTRD_FULL, OTPH_HALF, OVT_TOTAL, etc.

### View Employee Data
```
/ask EMPFORM
```
Shows: JOINDATE, TERMINATEDATE, LENGTHOFSERVICE_YEAR, etc.

---

## Implementation Details

### File Structure
```
botbatman/
├── docs/
│   ├── formula/
│   │   ├── keywords.md    (4,671 lines - 90 keywords)
│   │   ├── examples.md    (1,582 lines - practical examples)
│   │   └── reference.md   (1,270 lines - technical docs)
│   └── ASK_COMMAND.md     (this file)
├── index.js               (main bot file)
└── .gitignore
```

### Code Location
- **Parser function**: `parseKeywordsFromMarkdown()` in [index.js](../index.js)
- **Search function**: `searchKeyword()` in [index.js](../index.js)
- **Command handler**: `/ask` command in [index.js](../index.js)

### Features
- **2-Level Navigation**: Categories → Keywords with descriptions
- **Category Descriptions**: Each category shows its purpose
- **Brief Descriptions**: Each keyword shows a short explanation
- **Auto-Split**: Long category lists split across multiple messages
- **Smart Matching**: Case-insensitive category search

---

## Related Commands

- `/parse` - Calculate formulas with variables
- `/help` - Show all available commands
- `/clear` - Clear bot messages

---

**Last Updated**: 2026-01-20
**Version**: 2.0.0 (Simplified 2-level navigation)
