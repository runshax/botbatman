# GreatDay Payroll Formula System - Technical Reference

This document provides technical details about the formula parsing system architecture, implementation details, and database references.

---

## Table of Contents
1. [Introduction](#introduction)
2. [Formula Architecture](#formula-architecture)
3. [Processing Flow](#processing-flow)
4. [Database Tables](#database-tables)
5. [Service Methods](#service-methods)
6. [Formula Syntax Rules](#formula-syntax-rules)
7. [Special Keywords Deep Dive](#special-keywords-deep-dive)
8. [Component Processing Order](#component-processing-order)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)
11. [Country-Specific Features](#country-specific-features)

---

## Introduction

### What is the Formula System?

The GreatDay Payroll Formula System is a sophisticated multi-phase parser that enables dynamic calculations for payroll components. It supports:

- **Spreadsheet-like formulas** with 50+ built-in functions
- **Cross-component references** for complex dependency chains
- **Dynamic variables** (component codes, pay variables, employee data)
- **Multi-phase processing** to handle component dependencies
- **Country-specific keywords** for localized payroll rules

### Use Cases

- Component calculations (salary, allowances, deductions)
- Proration formulas (mid-month join/termination)
- Tax calculations (progressive rates, thresholds)
- Attendance-based pay (overtime, bonuses, penalties)
- Service-based benefits (loyalty bonuses, severance)
- Conditional logic (eligibility, tiered rates)

---

## Formula Architecture

### Core Components

The formula system consists of four main layers:

```
┌─────────────────────────────────────────────────────┐
│  Formula Process Layer                              │
│  (formula.process.non.queue.ts)                     │
│  - Orchestrates multi-phase processing              │
│  - Manages component dependencies                   │
│  - Handles two-phase execution                      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Component Process Layer                            │
│  (component.process.non.queue.ts)                   │
│  - Processes individual components                  │
│  - Handles formula replacement                      │
│  - Manages @ and _RESULT references                 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Formula Parser Layer                               │
│  (formula.parser.helper.ts)                         │
│  - Executes formulas using hot-formula-parser       │
│  - Provides 50+ built-in functions                  │
│  - Returns calculated results                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Reserve Words Layer                                │
│  (settingcomponent.service.ts - getRevWord)         │
│  - Manages valid formula keywords                   │
│  - Filters by company and tax country               │
│  - Auto-syncs component codes                       │
└─────────────────────────────────────────────────────┘
```

### Key Files

| File | Location | Purpose |
|------|----------|---------|
| **formula.process.non.queue.ts** | `src/services/payroll.process.formula/payroll.process.non.queue/` | Main formula orchestrator |
| **component.process.non.queue.ts** | `src/services/payroll.process.formula/payroll.process.non.queue/` | Component processor |
| **formula.parser.helper.ts** | `src/helpers/` | Formula execution engine |
| **settingcomponent.service.ts** | `src/services/v2pay/all/setting/` | Reserve word management |
| **tsfmreserveword.ts** | `src/models/` | Reserve word model |

---

## Processing Flow

### Multi-Phase Formula Processing

The system uses a sophisticated multi-phase approach to handle complex formulas with dependencies:

```
Phase 1: Value Retrieval
│
├─ getWordValue()
│  ├─ getValueAttendance() → Retrieve attendance data
│  │  (ACD, AWD, TCD, TWD, TARDINESS, UNDERTIME, etc.)
│  │
│  └─ getBaseValueComponentEnhanced() → Retrieve component base values
│     (SALARY, BONUS, allowance values, etc.)
│
↓
Phase 2: Component Sorting
│
├─ Sort by processOrder (ascending)
├─ Separate into two groups:
│  ├─ Normal components (no @ in formula)
│  └─ @-dependent components (has @ in formula)
│
↓
Phase 3: Formula Processing (Per Component)
│
├─ String Literal Protection
│  └─ Replace "string" → PART0, PART1, etc.
│
├─ BASE Keyword Replacement
│  └─ BASE → COMPONENT_CODE → actual value
│
├─ Component Code Replacement
│  └─ COMPONENT_CODE → actual value
│
├─ @ Prefix Handling
│  └─ @COMPONENT_CODE → referenced component value
│
├─ _RESULT Suffix Handling
│  └─ COMPONENT_CODE_RESULT → calculated result
│
└─ String Literal Restoration
   └─ PART0, PART1 → "string"
│
↓
Phase 4: Formula Execution
│
└─ formulaParse()
   ├─ Uses hot-formula-parser library
   ├─ Executes mathematical/logical operations
   └─ Returns result (or 0 if null)
```

### Detailed Processing Steps

#### Step 1: String Literal Protection

**Purpose**: Prevent strings inside formulas from being replaced during variable substitution

**Code Location**: `formula.process.non.queue.ts` lines 393-409

**Example**:
```
Original: IF(STATUS="ACTIVE", BASE*100, 0)
After:    IF(STATUS=PART0, BASE*100, 0)

Where PART0 = "ACTIVE"
```

**Why**: Without this, the system might try to replace "ACTIVE" with a variable value, breaking the formula.

---

#### Step 2: BASE Keyword Replacement

**Purpose**: Replace BASE with the current component's code

**Code Location**: `formula.process.non.queue.ts` lines 413-427

**Example**:
```
Component: ALLOWANCE_001
Formula:   BASE * 0.05

After BASE replacement:   ALLOWANCE_001 * 0.05
After value replacement:  5000 * 0.05
Result:                   250
```

---

#### Step 3: @ Prefix Handling (Cross-Component References)

**Purpose**: Reference values from other components

**Code Location**: `component.process.non.queue.ts` lines 68-72, 780-790

**Processing**:
1. System identifies `@` prefix in formula
2. Referenced component is calculated first (via processOrder)
3. `@COMPONENT_CODE` is replaced with actual value

**Example**:
```
Component: TAX (processOrder: 10)
Formula:   @SALARY * 0.10

Dependencies: SALARY (processOrder: 1)

Processing:
1. SALARY calculated first = 10000
2. TAX formula: @SALARY * 0.10
3. After replacement: 10000 * 0.10
4. Result: 1000
```

**Important**: Components with `@` are processed in a second pass to ensure all dependencies are resolved.

---

#### Step 4: _RESULT Suffix Handling

**Purpose**: Reference the calculated result of another component

**Code Location**: `formula.process.non.queue.ts` lines 1115-1155

**Two Scenarios**:

**Scenario 1: Component has formulaStatus = 'Y'**
- Uses the formula expression itself
- Example: If SALARY formula is `BASE * 1.05`, SALARY_RESULT = `BASE * 1.05`

**Scenario 2: Component has formulaStatus = 'N'**
- Uses the encrypted result value
- System decrypts the stored result
- Example: SALARY_RESULT = 10500 (decrypted value)

**Example**:
```
Component: NET_PAY
Formula:   (SALARY_RESULT + BONUS_RESULT) - TAX_RESULT

Processing:
1. SALARY_RESULT → 10000 (calculated)
2. BONUS_RESULT → 2000 (calculated)
3. TAX_RESULT → 1200 (calculated)
4. Formula becomes: (10000 + 2000) - 1200
5. Result: 10800
```

---

#### Step 5: Formula Execution

**Purpose**: Execute the final mathematical/logical formula

**Code Location**: `formula.parser.helper.ts` lines 317-324

**Library**: `hot-formula-parser` (spreadsheet-like formula engine)

**Process**:
```javascript
export const formulaParse = (formula: string) => {
  const parsedResult = parser.parse(formula).result;
  return parsedResult === null ? 0 : parsedResult;
};
```

**Example**:
```
Formula: IF(10000 > 5000, 10000 * 0.10, 10000 * 0.05)
Parser executes conditional logic
Result: 1000
```

---

## Database Tables

### tsfmreserveword

**Purpose**: Stores all valid formula keywords/reserve words

**Table Structure**:

```sql
CREATE TABLE tsfmreserveword (
  word VARCHAR(100) PRIMARY KEY,          -- Keyword name
  company_id INT PRIMARY KEY,             -- 1=global, else company-specific
  description VARCHAR(500),               -- Human-readable description
  data_type VARCHAR(50),                  -- STRING, NUMBER, DATE, DYNAMIC
  module VARCHAR(50),                     -- PAYROLL, GENERAL
  category VARCHAR(100),                  -- PAYFORM, ATTSTATUS, EMPFORM, etc.
  subcategory VARCHAR(100),               -- Further categorization
  taxcountry VARCHAR(10),                 -- Country filter (null=global)
  remark VARCHAR(255),                    -- Additional notes (e.g., 'v2')
  created_date DATETIME,
  created_by VARCHAR(100),
  modified_date DATETIME,
  modified_by VARCHAR(100)
);
```

**Key Queries**:

**Get all reserve words for a company**:
```sql
SELECT word, description, category, subcategory
FROM tsfmreserveword
WHERE (company_id = 1 OR company_id = :companyId)
  AND (taxcountry IS NULL OR taxcountry = '' OR taxcountry = :taxCountry)
  AND module IN ('GENERAL', 'PAYROLL')
GROUP BY word
ORDER BY category, word;
```

**Categories**:
- `PAYCOMP` - Payroll components (user-defined)
- `PAYVAR` - Payroll variables
- `PAYFORM` - Payroll formulas (BASE, YTD_*, PRORATE*_*)
- `EMPFORM` - Employee data (JOINDATE, LENGTHOFSERVICE_*, etc.)
- `ATTSTATUS` - Attendance status (ACD, AWD, etc.)
- `ATTINTF` - Attendance interface (OT_*, LEAVE_*, etc.)
- `DEFFORM` - Built-in functions (IF, SUM, etc.)
- `CLAIMFORM` - Claim formulas
- `EMPDATA` - Employee personal data
- `COMPCODE` - Component codes (auto-synced)

---

### Related Tables

#### tpympayallowdeduct

**Purpose**: Pay Component Master - stores all allowance/deduction definitions

**Auto-Sync**: Component codes are automatically synced to `tsfmreserveword` with category `COMPCODE`

**Sync Query** (lines 3454-3473 in settingcomponent.service.ts):
```sql
INSERT INTO tsfmreserveword (
  word, description, company_id, data_type, module, category,
  subcategory, taxcountry, created_by, created_date
)
SELECT
  allowdeduct_code, allowdeductname_en, company_id, 'STRING', 'PAYROLL', 'COMPCODE',
  NULL, NULL, 'SYSTEM', NOW()
FROM tpympayallowdeduct
WHERE company_id = :companyId
  AND allowdeduct_code NOT IN (
    SELECT word FROM tsfmreserveword
    WHERE company_id = :companyId
  );
```

---

#### tpympayvariable

**Purpose**: Pay Variable Master - stores custom company variables

**Auto-Sync**: Variable codes are automatically synced to `tsfmreserveword` with category `PAYVAR`

**Sync Query** (lines 3476-3496 in settingcomponent.service.ts):
```sql
INSERT INTO tsfmreserveword (
  word, description, company_id, data_type, module, category,
  subcategory, taxcountry, created_by, created_date
)
SELECT
  payvar_code, payvar_name, company_id, 'STRING', 'PAYROLL', 'PAYVAR',
  NULL, NULL, 'SYSTEM', NOW()
FROM tpympayvariable
WHERE company_id = :companyId
  AND payvar_code NOT IN (
    SELECT word FROM tsfmreserveword
    WHERE company_id = :companyId
  );
```

---

#### trmmreimtype

**Purpose**: Reimbursement/Claim Type Master

**Auto-Sync**: Claim types are synced to `tsfmreserveword` with category `CLAIMFORMULA`

**Sync Query** (lines 3499-3519 in settingcomponent.service.ts):
```sql
INSERT INTO tsfmreserveword (
  word, description, company_id, data_type, module, category,
  subcategory, taxcountry, created_by, created_date
)
SELECT
  reim_code, reimname_en, company_id, 'STRING', 'PAYROLL', 'CLAIMFORMULA',
  IF(interface_payroll='Y', 'INTFPAYROLL', NULL), NULL, 'SYSTEM', NOW()
FROM trmmreimtype
WHERE company_id = :companyId
  AND reim_code NOT IN (
    SELECT word FROM tsfmreserveword
    WHERE company_id = :companyId
  );
```

---

#### tpydprocmtdd

**Purpose**: Payroll Process Detail - stores component calculation results

**Structure**:
- `procmtdh_id` - Links to payroll process header
- `allowdeduct_code` - Component code
- `allowdeduct_value` - Base value (encrypted)
- `comp_value_tax` - Taxable value (encrypted)
- `comp_value_nontax` - Non-taxable value (encrypted)
- `formulaResult` - Calculated result (encrypted)
- `formulaStatus` - Whether result uses formula

---

#### tpydprocytdh

**Purpose**: Year-to-Date Process Header

**Usage**: Source for `YTD_COMPONENT_CODE` keywords

**Example**:
```sql
SELECT YTD_SALARY FROM tpydprocytdh
WHERE procytdh_id = :procytdhId
  AND company_id = :companyId;
```

---

## Service Methods

### getRevWord()

**Location**: `src/services/v2pay/all/setting/settingcomponent.service.ts` lines 1375-1741

**Purpose**: Retrieves all valid formula keywords for a company

**Method Signature**:
```typescript
async getRevWord(
  auth: Auth,
  typeRev: string = null,
  processPayroll: string = null,
  listfor?: string
): Promise<any>
```

**Parameters**:
- `auth` - Authentication context (contains company ID, tax country)
- `typeRev` - Type filter (optional)
- `processPayroll` - If 'useProcess', returns arrays for processing
- `listfor` - Purpose (e.g., 'claim')

**Returns**:

**Mode 1: UI Display (processPayroll = null)**
```typescript
{
  result: [
    {
      word: 'BASE',
      description: 'References current component base value',
      category: 'PAYFORM',
      subcategory: 'Special Keywords',
      ...
    },
    ...
  ]
}
```

**Mode 2: Processing (processPayroll = 'useProcess')**
```typescript
{
  words2: string[],              // All formula words
  arrayAcr: string[],            // Employee abbreviations
  claimTypes2: string[],         // Claim-related words
  attStatuses: string[],         // Attendance statuses
  leaveTypes: object[],          // Leave types
  payvarMaster: object[],        // Payroll variables
  arrayDiscp: string[],          // Discipline codes
  attintfWord: object[]          // Attendance interface words
}
```

**Database Query**:
```sql
SELECT word, description, module, category, subcategory, remark
FROM tsfmreserveword
WHERE (taxcountry IS NULL OR taxcountry = '' OR taxcountry = :taxCountry)
  AND (company_id = 1 OR company_id = :companyId)
  AND module IN ('GENERAL', 'PAYROLL')
GROUP BY word
ORDER BY
  CASE category
    WHEN 'PAYCOMP' THEN 1
    WHEN 'PAYVAR' THEN 2
    WHEN 'PAYFORM' THEN 3
    WHEN 'EMPFORM' THEN 4
    WHEN 'CLAIMFORM' THEN 5
    WHEN 'ATTINTF' THEN 6
    WHEN 'ATTSTATUS' THEN 7
    WHEN 'LEAVE' THEN 8
    WHEN 'OVERTIME' THEN 9
    WHEN 'DEFFORM' THEN 10
    ELSE 11
  END,
  word;
```

---

### formulaParse()

**Location**: `src/helpers/formula.parser.helper.ts` lines 317-324

**Purpose**: Executes the final formula using hot-formula-parser

**Method Signature**:
```typescript
export const formulaParse = (formula: string): number
```

**Implementation**:
```typescript
export const formulaParse = (formula: string) => {
  const parsedResult = parser.parse(formula).result;
  return parsedResult === null ? 0 : parsedResult;
};
```

**Library**: Uses `hot-formula-parser` NPM package

**Features**:
- Supports 50+ spreadsheet-like functions
- Handles mathematical operations (+, -, *, /, %)
- Supports logical operations (IF, AND, OR)
- Date/time functions
- String functions
- Returns 0 for null results (safe default)

---

### startFormulaProcess()

**Location**: `src/services/payroll.process.formula/payroll.process.non.queue/formula.process.non.queue.ts`

**Purpose**: Main orchestrator for formula processing

**High-Level Flow**:
```typescript
async startFormulaProcess(auth, empAllowDeduct, payPeriod) {
  // 1. Get all variable values
  const wordValues = await this.getWordValue(auth, ...);

  // 2. Sort components by processOrder
  const sortedComponents = empAllowDeduct.sort(compare);

  // 3. Separate into normal and @-dependent components
  const normalComponents = sortedComponents.filter(c => !c.formula.includes('@'));
  const dependentComponents = sortedComponents.filter(c => c.formula.includes('@'));

  // 4. Process normal components first
  for (const component of normalComponents) {
    await componentProcessor.startComponentProcess(component);
  }

  // 5. Process @-dependent components second
  for (const component of dependentComponents) {
    await componentProcessor.startComponentProcess(component);
  }

  // 6. Return results
  return processedComponents;
}
```

**Key Features**:
- Two-phase processing (normal first, then @-dependent)
- String literal protection
- Keyword replacement (BASE, @, _RESULT)
- Result encryption for security

---

## Formula Syntax Rules

### Basic Syntax

**Arithmetic Operators**:
- `+` Addition
- `-` Subtraction
- `*` Multiplication
- `/` Division
- `%` Modulus
- `^` Exponentiation

**Comparison Operators**:
- `=` Equal
- `<>` or `!=` Not equal
- `>` Greater than
- `>=` Greater than or equal
- `<` Less than
- `<=` Less than or equal

**Logical Operators**:
- `AND(...)` Logical AND
- `OR(...)` Logical OR
- `NOT(...)` Logical NOT

**Parentheses**:
- `()` Grouping and function calls

---

### String Literals

**Syntax**: Use double quotes `"..."` or single quotes `'...'`

**Examples**:
```
IF(STATUS="ACTIVE", 1000, 0)
IF(GRADE='A', PREMIUM_RATE, STANDARD_RATE)
CONCATENATE("EMP-", EMPNO)
```

**Important**: String literals are protected during processing to prevent variable replacement

---

### Case Sensitivity

- **Keywords**: Case-insensitive (`BASE`, `base`, `Base` all work)
- **Component Codes**: Case-sensitive (use exact code as defined)
- **String Literals**: Case-sensitive inside quotes

**Example**:
```
✓ Correct:   IF(JOBSTATUS="Active", ...)
✗ Incorrect: IF(JOBSTATUS="ACTIVE", ...)  // If actual value is "Active"
```

---

### Comments

**Not Supported**: Formula system does not support comments

**Alternative**: Use component description field to document complex formulas

---

## Special Keywords Deep Dive

### BASE Keyword

**Purpose**: References the current component's base value

**Replacement Logic**:
```typescript
// Step 1: BASE → COMPONENT_CODE
formula = formula.replace(/BASE/g, componentCode);

// Step 2: COMPONENT_CODE → actual value
formula = formula.replace(/COMPONENT_CODE/g, actualValue);
```

**Example**:
```
Component: BONUS (value: 10000)
Formula:   BASE * 0.05

Step 1: BONUS * 0.05
Step 2: 10000 * 0.05
Result: 500
```

**Use Cases**:
- Simple percentage calculations
- Self-referential formulas
- Multipliers on current value

---

### @ Prefix (Cross-Component References)

**Purpose**: Reference values from other components

**Processing Requirements**:
1. Referenced component must have **lower processOrder**
2. Formula with `@` must be in **second processing phase**
3. All `@` dependencies must be **resolved before execution**

**Replacement Logic**:
```typescript
// Detect @ in formula
if (formula.includes('@')) {
  // Add to second-phase processing
  dependentComponents.push(component);
}

// During processing:
formula = formula.replace(/@COMPONENT_CODE/g, componentValue);
```

**Example**:
```
Component: TAX (processOrder: 10)
Formula:   (@SALARY + @BONUS) * 0.10

Dependencies:
- SALARY (processOrder: 1, value: 10000)
- BONUS  (processOrder: 2, value: 2000)

Processing:
1. SALARY calculated = 10000
2. BONUS calculated = 2000
3. TAX formula: (@SALARY + @BONUS) * 0.10
4. After replacement: (10000 + 2000) * 0.10
5. Result: 1200
```

**Common Mistakes**:
```
✗ Missing processOrder: TAX calculated before SALARY
✗ Circular reference: SALARY references TAX, TAX references SALARY
✗ Typo in code:       @SALERY instead of @SALARY
```

---

### _RESULT Suffix

**Purpose**: Reference the calculated result of another component (after formula execution)

**Difference from @**:
- `@COMPONENT` → Uses **base value** (before formula)
- `COMPONENT_RESULT` → Uses **calculated result** (after formula)

**Example**:
```
Component A: SALARY
  Formula: BASE * 1.05
  Base Value: 10000
  Calculated Result: 10500

Component B: BONUS
  Formula: BASE * 0.10
  Base Value: 2000
  Calculated Result: 2000

Component C: TOTAL_INCOME (using @)
  Formula: @SALARY + @BONUS
  Result: 10000 + 2000 = 12000  (uses base values)

Component D: TOTAL_INCOME (using _RESULT)
  Formula: SALARY_RESULT + BONUS_RESULT
  Result: 10500 + 2000 = 12500  (uses calculated results)
```

**Use Cases**:
- Net pay calculation (sum of all calculated components)
- Aggregating results after all formulas executed
- Multi-step calculations

---

### YTD_ Prefix (Year-to-Date)

**Purpose**: Reference cumulative values from start of tax year

**Data Source**: `tpydprocytdh` table (Year-to-Date Header)

**Example**:
```
Component: ANNUAL_BONUS
Formula:   IF(YTD_SALARY >= 120000, YTD_SALARY * 0.05, 0)

If YTD_SALARY = 144000 (12 months × 12000):
  Condition: 144000 >= 120000 = TRUE
  Result: 144000 * 0.05 = 7200
```

**Use Cases**:
- Annual bonus calculations
- Tax threshold checks
- Year-end computations
- Cumulative eligibility

---

### PRORATE*_ Prefixes

**Types**:
- `PRORATECD_CODE` - Prorate by **calendar days**
- `PRORATEWD_CODE` - Prorate by **working days**
- `PRORATEWS_CODE` - Prorate by **working days with shift**
- `PRORATEPRS_CODE` - Prorate by **PRS status**

**Calculation**:
```
PRORATECD_SALARY = SALARY * (ACD / TCD)
PRORATEWD_SALARY = SALARY * (AWD / TWD)
```

**Example**:
```
Mid-Month Join (Calendar Days):
  Join Date: January 15
  ACD (Actual Calendar Days) = 17 (Jan 15-31)
  TCD (Total Calendar Days) = 31
  SALARY = 6000

Formula: PRORATECD_SALARY
Calculation: 6000 * (17 / 31)
Result: 3290.32
```

**Use Cases**:
- Mid-month join/termination
- Unpaid leave calculations
- Partial period payments
- Pro-rata allowances

---

## Component Processing Order

### Why processOrder Matters

Components can depend on other components. The `processOrder` field controls calculation sequence to ensure dependencies are resolved correctly.

### Rules

1. **Lower processOrder calculated first** (1 before 2, 2 before 3, etc.)
2. **Components with @ must have higher processOrder** than referenced components
3. **Components without dependencies can share same processOrder**
4. **NET_PAY should have highest processOrder** (e.g., 999)

### Example Setup

```
Component           | processOrder | Formula
--------------------|--------------|---------------------------
SALARY              | 1            | BASE
ALLOWANCE           | 2            | BASE * 0.20
BONUS               | 3            | IF(@SALARY > 10000, 1000, 0)
TAX                 | 10           | (@SALARY + @ALLOWANCE + @BONUS) * 0.10
DEDUCTION           | 11           | @SALARY * 0.05
NET_PAY             | 999          | (SALARY_RESULT + ALLOWANCE_RESULT + BONUS_RESULT) - (TAX_RESULT + DEDUCTION_RESULT)
```

**Processing Sequence**:
1. SALARY (order 1) → 10000
2. ALLOWANCE (order 2) → 2000
3. BONUS (order 3) → 1000 (depends on SALARY)
4. TAX (order 10) → 1300 (depends on SALARY, ALLOWANCE, BONUS)
5. DEDUCTION (order 11) → 500 (depends on SALARY)
6. NET_PAY (order 999) → 11200 (depends on all results)

### Two-Phase Processing

**Phase 1: Normal Components** (no @ in formula)
- Sorted by processOrder
- Calculated sequentially
- Results stored

**Phase 2: @-Dependent Components** (has @ in formula)
- Sorted by processOrder
- Calculated after all Phase 1 components
- Can reference Phase 1 results

**Code Location**: `formula.process.non.queue.ts` lines 136-207

```typescript
// Separate into two groups
const normalComponents = components.filter(c => !c.formula.includes('@'));
const dependentComponents = components.filter(c => c.formula.includes('@'));

// Process Phase 1
for (const comp of normalComponents.sort(compare)) {
  await processComponent(comp);
}

// Process Phase 2
for (const comp of dependentComponents.sort(compare)) {
  await processComponent(comp);
}
```

---

## Best Practices

### 1. Component Design

**Keep Formulas Simple**:
```
✓ Good:   BASE * 0.05
✗ Bad:    IF(AND(OR(GRADE='A', GRADE='B'), LENGTHOFSERVICE_YEAR >= 3), IF(SALARY > 10000, BASE * 0.15, BASE * 0.10), IF(SALARY > 5000, BASE * 0.08, BASE * 0.05))
```

**Break Complex Logic into Multiple Components**:
```
Instead of one complex formula:
  TAX = IF((@SALARY + @BONUS + @ALLOWANCE) > 15000, ...)

Use multiple components:
  TOTAL_INCOME = @SALARY + @BONUS + @ALLOWANCE
  TAX = IF(@TOTAL_INCOME > 15000, @TOTAL_INCOME * 0.15, @TOTAL_INCOME * 0.10)
```

---

### 2. Process Order Management

**Assign Clear Ranges**:
```
Range 1-10:    Base components (SALARY, ALLOWANCE)
Range 11-20:   Calculated allowances
Range 21-30:   Deductions
Range 31-40:   Taxes
Range 91-99:   Aggregations (TOTAL_INCOME, TOTAL_DEDUCTION)
Range 999:     NET_PAY (always last)
```

**Leave Gaps** for future insertions:
```
✓ Good:   SALARY (1), BONUS (5), ALLOWANCE (10)
          Can insert new component at (3) or (7)

✗ Bad:    SALARY (1), BONUS (2), ALLOWANCE (3)
          No room to insert between
```

---

### 3. Formula Documentation

**Use Component Description Field**:
```
Component: SEVERANCE
Formula:   IF(LENGTHOFSERVICE(JOINDATE, ENDDATE, 'm') >= 12, 10000, 10000/12 * LENGTHOFSERVICE(JOINDATE, ENDDATE, 'm'))

Description:
  Severance pay calculation:
  - Full amount (10000) if service >= 12 months
  - Prorated by months if service < 12 months
  - Based on join date to end date
```

---

### 4. Testing Formulas

**Test with Multiple Scenarios**:
```
Formula: IF(SALARY > 10000, SALARY * 0.10, SALARY * 0.05)

Test Cases:
  ✓ SALARY = 5000  → Result: 250   (5% rate)
  ✓ SALARY = 10000 → Result: 500   (5% rate, edge case)
  ✓ SALARY = 10001 → Result: 1000.10 (10% rate, just over threshold)
  ✓ SALARY = 15000 → Result: 1500  (10% rate)
```

---

### 5. Performance Optimization

**Avoid Nested Dependencies**:
```
✗ Bad:
  A depends on B
  B depends on C
  C depends on D
  D depends on E
  (5 levels deep)

✓ Good:
  A depends on B
  B depends on C
  (2 levels deep)
```

**Use Direct References When Possible**:
```
✗ Slower:   IF(@SALARY > 10000, ...)
✓ Faster:   IF(SALARY > 10000, ...)  // If in same component
```

---

### 6. Error Prevention

**Avoid Division by Zero**:
```
✗ Bad:    SALARY / TWD
✓ Good:   IF(TWD > 0, SALARY / TWD, 0)
```

**Handle Null Values**:
```
✗ Bad:    @BONUS * 0.10
✓ Good:   IF(@BONUS > 0, @BONUS * 0.10, 0)
```

**Validate Date Fields**:
```
✗ Bad:    DATEDIFF('DAY', JOINDATE, TODAY())
✓ Good:   IF(ISDATE(JOINDATE), DATEDIFF('DAY', JOINDATE, TODAY()), 0)
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: "Component not found" Error

**Symptom**: Formula fails with error about missing component

**Causes**:
- Component code typo
- Component doesn't exist in `tpympayallowdeduct`
- Component not synced to `tsfmreserveword`

**Solutions**:
```sql
-- Check if component exists
SELECT * FROM tpympayallowdeduct
WHERE allowdeduct_code = 'SALARY'
  AND company_id = 12345;

-- Check if synced to reserve words
SELECT * FROM tsfmreserveword
WHERE word = 'SALARY'
  AND company_id = 12345;

-- Manual sync if needed
INSERT INTO tsfmreserveword (...)
SELECT ... FROM tpympayallowdeduct ...
```

---

#### Issue 2: Wrong Calculation with @ References

**Symptom**: Tax or deduction calculates incorrectly

**Cause**: processOrder is wrong

**Solution**:
```
Check processOrder in tpympayallowdeduct:

Component        | processOrder
-----------------|-------------
SALARY           | 1           ✓ Calculated first
TAX              | 1           ✗ WRONG! Should be > 1

Fix:
UPDATE tpympayallowdeduct
SET process_order = 10
WHERE allowdeduct_code = 'TAX'
  AND company_id = 12345;
```

---

#### Issue 3: Formula Returns 0 Unexpectedly

**Symptom**: Formula always returns 0

**Causes**:
- Variable is null
- Condition always false
- Division by zero protection

**Debugging**:
```
Original: IF(@SALARY > 10000, @SALARY * 0.10, 0)

Test step-by-step:
1. Check @SALARY value in tpydprocmtdd
2. Verify SALARY component was calculated
3. Check processOrder (TAX must be after SALARY)
4. Test condition manually: Is SALARY > 10000?
```

---

#### Issue 4: String Literal Not Working

**Symptom**: String comparison fails

**Cause**: Incorrect quote usage or case sensitivity

**Solutions**:
```
✗ Bad:    IF(STATUS=ACTIVE, ...)      // Missing quotes
✗ Bad:    IF(STATUS='ACTIVE', ...)    // Wrong case
✓ Good:   IF(STATUS='Active', ...)    // Correct case
✓ Good:   IF(STATUS="Active", ...)    // Double quotes also work
```

---

#### Issue 5: Date Function Errors

**Symptom**: Date calculation fails or returns wrong result

**Causes**:
- Wrong date format
- Null date value
- Incorrect unit parameter

**Solutions**:
```
✗ Bad:    DATEDIFF('DAYS', ...)       // Wrong unit (should be 'DAY')
✗ Bad:    DATEDIFF('DAY', '1/15/2026', TODAY())  // Wrong format
✓ Good:   DATEDIFF('DAY', '2026-01-15', TODAY()) // YYYY-MM-DD
✓ Good:   IF(ISDATE(JOINDATE), DATEDIFF(...), 0) // Null check
```

---

#### Issue 6: Circular Dependency

**Symptom**: Formula processing hangs or errors

**Cause**: Components reference each other

**Example of Circular Reference**:
```
SALARY   formula: @BONUS * 2
BONUS    formula: @SALARY * 0.10

This creates infinite loop!
```

**Solution**: Redesign component relationships to be one-directional

---

### Debugging Tools

#### Check Component Calculation Results

```sql
SELECT
  allowdeduct_code,
  SF2356896(allowdeduct_value, 'P', 'L', emp_id) AS base_value,
  SF2356896(comp_value_tax, 'P', 'L', emp_id) AS taxable_value,
  SF2356896(formulaResult, 'P', 'L', emp_id) AS result
FROM tpydprocmtdd
WHERE procmtdh_id = :procmtdhId
  AND company_id = :companyId
ORDER BY allowdeduct_code;
```

#### Trace Formula Processing

Enable logging in `formula.process.non.queue.ts`:
```typescript
console.log('Processing component:', componentCode);
console.log('Formula before replacement:', formula);
console.log('Formula after replacement:', replacedFormula);
console.log('Result:', calculatedResult);
```

---

## Country-Specific Features

### Supported Countries

The formula system supports country-specific keywords and logic for:

- **Indonesia (ID)** - PPh21 tax, BPJS, severance
- **Malaysia (MY)** - EPF, SOCSO, EIS, PCB2
- **Thailand (TH)** - Social security, PND1, PND91
- **Philippines (PH)** - SSS, PhilHealth, HDMF, Alphalist
- **Vietnam (VN)** - Template support

### Country Filtering

Reserve words can be filtered by `taxcountry` field:

```sql
SELECT word, description
FROM tsfmreserveword
WHERE (taxcountry IS NULL OR taxcountry = 'ID')
  AND company_id = :companyId;
```

**Values**:
- `NULL` - Global (applies to all countries)
- `'ID'` - Indonesia only
- `'MY'` - Malaysia only
- `'TH'` - Thailand only
- `'PH'` - Philippines only
- `'VN'` - Vietnam only

### Example Country-Specific Keywords

**Indonesia**:
- Tax exemption components (natura)
- PPh21 calculations
- BPJS formulas

**Malaysia**:
- EPF calculation keywords
- SOCSO rate keywords
- PCB2 tax formulas

**Thailand**:
- Social security keywords
- PND tax forms
- Provident fund

**Philippines**:
- SSS contribution keywords
- PhilHealth formulas
- Pag-IBIG (HDMF) keywords

---

## External References

### Global Reserve Word Table

For a complete reference of all reserve words with detailed descriptions, see:

**File**: "Global Reserve Word - Initial Sample Updated.xlsx"
**Location**: `C:\Users\Gdhr-User.LAPNBC000327\Downloads\Telegram Desktop\`

This Excel file contains:
- Complete list of all keywords
- Detailed descriptions
- Category classifications
- Usage guidelines
- Country-specific flags

### NPM Packages

**hot-formula-parser**:
- Spreadsheet-like formula engine
- Supports Excel-compatible functions
- Used in `formulaParse()` method
- [GitHub](https://github.com/handsontable/formula-parser)

**mathjs**:
- Advanced mathematical operations
- Used for complex calculations
- [Website](https://mathjs.org/)

---

**End of Technical Reference**

For keyword reference, see [keywords.md](./keywords.md)

For practical examples, see [examples.md](./examples.md)
