# GreatDay Payroll Formula Keywords Reference

This document provides a comprehensive reference of all formula keywords and reserve words available in the GreatDay Payroll system. Each keyword includes YAML frontmatter for bot parsing and detailed explanations for human readers.

---

## Table of Contents
1. [Special Keywords](#special-keywords)
2. [Attendance Keywords](#attendance-keywords)
3. [Overtime Keywords](#overtime-keywords)
4. [Employee Data Keywords](#employee-data-keywords)
5. [Built-in Functions](#built-in-functions)
6. [Component Codes (Dynamic)](#component-codes-dynamic)
7. [Pay Variables](#pay-variables)

---

# Special Keywords

---
keyword: BASE
aliases: []
category: PAYFORM
subcategory: Special Keywords
data_type: DYNAMIC
syntax: BASE
description: Returns the current component's base value (number). The basic value of the component being calculated
module: PAYROLL
taxcountry: null
examples:
  - "BASE * 0.05"
  - "IF(BASE > 10000, BASE * 0.10, BASE * 0.05)"
  - "ROUND(BASE * 0.12, 2)"
related_keywords:
  - "@COMPONENT_CODE"
---

## BASE

### Description
The `BASE` keyword is a special reserve word that references the current component's base value. During formula processing, `BASE` is replaced with the actual component code, which is then replaced with its numerical value.

### Syntax
```
BASE
```

### Processing Flow
1. Original formula: `BASE * 0.05` (for component "ALLOWANCE_001")
2. After BASE replacement: `ALLOWANCE_001 * 0.05`
3. After value replacement: `5000 * 0.05`
4. Result: `250`

### Use Cases
- Calculate percentage of current component
- Apply multipliers to base values
- Conditional logic based on component value
- Commission calculations
- Standard deductions

### Examples

**Example 1: Simple Percentage**
```
Formula: BASE * 0.05
Component: BONUS
If BASE = 10000
Result = 500
Description: Calculate 5% bonus
```

**Example 2: Conditional Calculation**
```
Formula: IF(BASE > 10000, BASE * 0.10, BASE * 0.05)
Description: 10% if base exceeds 10000, otherwise 5%
```

**Example 3: Rounded Result**
```
Formula: ROUND(BASE * 0.12, 2)
Description: Calculate 12% and round to 2 decimal places
```

### Related Keywords
- `@COMPONENT_CODE` - Reference other components

---

---
keyword: "COMPONENT_CODE"
aliases:
  - "Component Codes"
  - "AL_001, SALARY, BONUS, etc."
category: PAYFORM
subcategory: Component References
data_type: DYNAMIC
syntax: "COMPONENT_CODE or @COMPONENT_CODE"
description: Your custom codes (AL_001, SALARY). Direct use gets formula, @CODE gets calculated result. Example: SALARY=BASE*2, BASE=10, then SALARY formula is BASE*2 but @SALARY=20
module: PAYROLL
taxcountry: null
examples:
  - "SALARY (uses formula BASE*2)"
  - "@SALARY (gets result 20)"
  - "AL_001 = @SALARY + @BONUS"
  - "TAX = @SALARY * 0.10"
related_keywords:
  - "BASE"
---

## @COMPONENT_CODE

### Description
The `@` prefix allows formulas to reference values from other components. This enables cross-component calculations like tax based on multiple income sources. Components using `@` references are processed LAST to ensure all dependencies are calculated first.

### Syntax
```
@COMPONENT_CODE
```

### Important Notes
- **Processing Order**: Components with `@` in their formula must have a higher `processOrder` value
- **Dependencies**: Referenced components must be calculated before dependent components
- **Two-Phase Processing**: Normal components are processed first, then `@`-dependent components

### Processing Flow
1. Original formula: `@SALARY * 0.10` (for component "TAX")
2. System identifies @ reference
3. SALARY component is calculated first (processOrder = 1)
4. TAX component is calculated after (processOrder = 2)
5. @SALARY is replaced with SALARY's value (e.g., 5000)
6. Formula becomes: `5000 * 0.10`
7. Result: `500`

### Use Cases
- Tax calculations based on multiple income components
- Net pay calculation
- Deductions based on total income
- Complex multi-component formulas

### Examples

**Example 1: Simple Tax Reference**
```
Formula: @SALARY * 0.10
Component: INCOME_TAX
Description: 10% tax on salary
Dependencies: SALARY must be calculated first
```

**Example 2: Tax on Multiple Income Sources**
```
Formula: (@SALARY + @BONUS + @ALLOWANCE) * 0.10
Component: TOTAL_TAX
Description: 10% tax on total taxable income
Dependencies: SALARY, BONUS, ALLOWANCE
```

**Example 3: Conditional Based on Another Component**
```
Formula: IF(@SALARY > 10000, @SALARY * 0.15, @SALARY * 0.10)
Component: TAX
Description: Progressive tax rate based on salary
```

### Related Keywords
- `BASE` - Current component reference
- `processOrder` - Controls calculation sequence

---

---
keyword: "YTD_COMPONENT_CODE"
aliases:
  - "YTD_*"
  - "Year to Date"
category: PAYFORM
subcategory: Special Keywords
data_type: NUMBER
syntax: "YTD_COMPONENT_CODE"
description: References the year-to-date cumulative value of a component
module: PAYROLL
taxcountry: null
examples:
  - "YTD_SALARY"
  - "IF(YTD_SALARY > 120000, YTD_SALARY * 0.05, 0)"
  - "YTD_TAX + CURRENT_TAX"
related_keywords:
  - "BASE"
  - "@COMPONENT_CODE"
  - "procytdh_id"
---

## YTD_COMPONENT_CODE

### Description
The `YTD_` prefix references the year-to-date cumulative total for a specific component. This is useful for annual calculations, tax thresholds, or bonuses based on cumulative earnings.

### Syntax
```
YTD_COMPONENT_CODE
```

### Data Source
- Retrieved from `tpydprocytdh` (Year-to-Date Header) table
- Accumulates all values from start of tax year to current period

### Use Cases
- Annual bonus calculations
- Tax threshold checks
- Year-end computations
- Cumulative earnings tracking

### Examples

**Example 1: YTD Salary Reference**
```
Formula: YTD_SALARY
Component: ANNUAL_SALARY
Description: Total salary paid year-to-date
```

**Example 2: Annual Bonus Based on YTD**
```
Formula: IF(YTD_SALARY > 120000, YTD_SALARY * 0.05, 0)
Component: YEAR_END_BONUS
Description: 5% bonus if annual salary exceeds 120,000
```

**Example 3: YTD Tax Calculation**
```
Formula: YTD_TAX + CURRENT_TAX
Component: TOTAL_TAX_PAID
Description: Total tax including current period
```

### Related Keywords
- `BASE` - Current period value
- `@COMPONENT_CODE` - Reference other components
- `procytdh_id` - Year-to-date process ID

---

---
keyword: "PRORATECD_CODE"
aliases:
  - "PRORATECD_*"
  - "Prorate Calendar Days"
category: PAYFORM
subcategory: Proration Keywords
data_type: NUMBER
syntax: "PRORATECD_COMPONENT_CODE"
description: Prorates a component value based on calendar days worked in the period
module: PAYROLL
taxcountry: null
examples:
  - "PRORATECD_SALARY"
  - "PRORATECD_ALLOWANCE"
related_keywords:
  - "PRORATEWD_CODE"
  - "PRORATEWS_CODE"
  - "ACD"
  - "TCD"
---

## PRORATECD_CODE

### Description
Prorates a component's value based on the ratio of actual calendar days (ACD) to total calendar days (TCD) in the period. Used primarily for mid-month joins or terminations.

### Syntax
```
PRORATECD_COMPONENT_CODE
```

### Calculation Formula
```
Prorated Value = Component Value × (ACD / TCD)
```

### Use Cases
- Mid-month employee join date
- Mid-month termination
- Leave without pay (calendar days basis)
- Partial month calculations

### Examples

**Example 1: Prorated Salary for Mid-Month Join**
```
Formula: PRORATECD_SALARY
Component: PRORATED_SALARY
Scenario: Employee joins on 15th of 30-day month
ACD = 16 (days worked)
TCD = 30 (total calendar days)
If SALARY = 6000
Result = 6000 × (16/30) = 3200
```

**Example 2: Prorated Allowance**
```
Formula: PRORATECD_ALLOWANCE
Component: PRORATED_HOUSING
Description: Prorate housing allowance based on days worked
```

### Related Keywords
- `PRORATEWD_CODE` - Prorate by working days
- `PRORATEWS_CODE` - Prorate by working days with shift
- `ACD` - Actual Calendar Days
- `TCD` - Total Calendar Days

---

---
keyword: "PRORATEWD_CODE"
aliases:
  - "PRORATEWD_*"
  - "Prorate Working Days"
category: PAYFORM
subcategory: Proration Keywords
data_type: NUMBER
syntax: "PRORATEWD_COMPONENT_CODE"
description: Prorates a component value based on working days in the period
module: PAYROLL
taxcountry: null
examples:
  - "PRORATEWD_SALARY"
  - "PRORATEWD_BONUS"
related_keywords:
  - "PRORATECD_CODE"
  - "PRORATEWS_CODE"
  - "AWD"
  - "TWD"
---

## PRORATEWD_CODE

### Description
Prorates a component's value based on the ratio of actual working days (AWD) to total working days (TWD) in the period. Excludes weekends and holidays from calculation.

### Syntax
```
PRORATEWD_COMPONENT_CODE
```

### Calculation Formula
```
Prorated Value = Component Value × (AWD / TWD)
```

### Use Cases
- Mid-month join (working days basis)
- Mid-month termination (working days basis)
- Unpaid leave calculations
- Performance-based proration

### Examples

**Example 1: Prorated Salary by Working Days**
```
Formula: PRORATEWD_SALARY
Component: PRORATED_SALARY
Scenario: Employee joins mid-month
AWD = 10 (working days attended)
TWD = 22 (total working days in month)
If SALARY = 6000
Result = 6000 × (10/22) = 2727.27
```

**Example 2: Prorated Bonus**
```
Formula: PRORATEWD_BONUS
Component: PRORATED_BONUS
Description: Prorate bonus based on working days
```

### Related Keywords
- `PRORATECD_CODE` - Prorate by calendar days
- `PRORATEWS_CODE` - Prorate by working days with shift
- `AWD` - Actual Working Days
- `TWD` - Total Working Days

---

---
keyword: "PRORATEWS_CODE"
aliases:
  - "PRORATEWS_*"
  - "Prorate Working Days with Shift"
category: PAYFORM
subcategory: Proration Keywords
data_type: NUMBER
syntax: "PRORATEWS_COMPONENT_CODE"
description: Prorates based on working days considering shift schedules
module: PAYROLL
taxcountry: null
examples:
  - "PRORATEWS_SALARY"
related_keywords:
  - "PRORATECD_CODE"
  - "PRORATEWD_CODE"
  - "AWDSH"
---

## PRORATEWS_CODE

### Description
Prorates a component's value based on actual working days adjusted for shift schedules (AWDSH). This is more accurate for shift workers with varying schedules.

### Syntax
```
PRORATEWS_COMPONENT_CODE
```

### Use Cases
- Shift workers with variable schedules
- Part-time employees
- Flexible work arrangements

### Examples

**Example 1: Prorated Salary with Shift**
```
Formula: PRORATEWS_SALARY
Component: PRORATED_SALARY
Description: Prorate salary considering shift schedule
```

### Related Keywords
- `PRORATECD_CODE` - Prorate by calendar days
- `PRORATEWD_CODE` - Prorate by working days
- `AWDSH` - Actual Working Days Shift

---

---
keyword: "PRORATEPRS_CODE"
aliases:
  - "PRORATEPRS_*"
  - "Prorate PRS Status"
category: PAYFORM
subcategory: Proration Keywords
data_type: NUMBER
syntax: "PRORATEPRS_COMPONENT_CODE"
description: Prorates based on PRS (Payroll Status) indicators
module: PAYROLL
taxcountry: null
examples:
  - "PRORATEPRS_SALARY"
related_keywords:
  - "PRSMS"
  - "PRSMA"
---

## PRORATEPRS_CODE

### Description
Prorates a component's value based on PRS (Payroll Status) indicators which track special employment statuses or conditions.

### Syntax
```
PRORATEPRS_COMPONENT_CODE
```

### Use Cases
- Special employment status calculations
- Conditional proration based on payroll status

### Examples

**Example 1: PRS-Based Proration**
```
Formula: PRORATEPRS_SALARY
Component: STATUS_ADJUSTED_SALARY
Description: Prorate salary based on PRS status
```

### Related Keywords
- `PRSMS` - PRS status indicator
- `PRSMA` - PRS status alternative

---

# Attendance Keywords

---
keyword: ACD
aliases:
  - "Actual Calendar Days"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: ACD
description: Actual calendar days the employee worked or was on payroll in the period
module: PAYROLL
taxcountry: null
examples:
  - "IF(ACD >= 30, SALARY, SALARY * ACD / 30)"
  - "PRORATECD formula uses ACD"
related_keywords:
  - "TCD"
  - "ACDB"
  - "PRORATECD_CODE"
---

## ACD

### Description
ACD (Actual Calendar Days) represents the number of calendar days the employee worked or was on payroll during the pay period. This includes weekends and holidays.

### Syntax
```
ACD
```

### Use Cases
- Proration calculations
- Partial month payments
- Leave calculations
- Mid-month join/termination

### Examples

**Example 1: Conditional Payment**
```
Formula: IF(ACD >= 30, SALARY, SALARY * ACD / 30)
Description: Full salary if worked full month, otherwise prorated
```

**Example 2: Used in Proration**
```
Formula: SALARY * (ACD / TCD)
Description: Prorate salary by calendar days
```

### Related Keywords
- `TCD` - Total Calendar Days
- `ACDB` - Actual Calendar Days Base
- `PRORATECD_CODE` - Calendar days proration

---

---
keyword: ACDB
aliases:
  - "Actual Calendar Days Base"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: ACDB
description: Base value for actual calendar days calculation
module: PAYROLL
taxcountry: null
examples:
  - "SALARY * ACDB / TCDB"
related_keywords:
  - "ACD"
  - "TCDB"
---

## ACDB

### Description
ACDB (Actual Calendar Days Base) is the base value used for calendar days calculations in certain proration formulas.

### Syntax
```
ACDB
```

### Related Keywords
- `ACD` - Actual Calendar Days
- `TCDB` - Total Calendar Days Base

---

---
keyword: AWD
aliases:
  - "Actual Working Days"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: AWD
description: Actual working days the employee attended (excludes weekends and holidays)
module: PAYROLL
taxcountry: null
examples:
  - "IF(AWD >= TWD, 1000, 0)"
  - "SALARY * AWD / TWD"
  - "IF(AND(AWD >= TWD, TARDINESS = 0), 1000, 0)"
related_keywords:
  - "TWD"
  - "AWDB"
  - "AWDSH"
  - "PRORATEWD_CODE"
---

## AWD

### Description
AWD (Actual Working Days) counts the number of working days the employee actually attended work. This excludes weekends, public holidays, and days of absence.

### Syntax
```
AWD
```

### Use Cases
- Perfect attendance bonuses
- Working days proration
- Performance calculations
- Attendance-based incentives

### Examples

**Example 1: Perfect Attendance Bonus**
```
Formula: IF(AWD >= TWD, 1000, 0)
Description: 1000 bonus if all working days attended
```

**Example 2: Proration by Working Days**
```
Formula: SALARY * AWD / TWD
Description: Prorate salary based on days worked
```

**Example 3: Perfect Attendance with No Tardiness**
```
Formula: IF(AND(AWD >= TWD, TARDINESS = 0), 1000, 0)
Description: Bonus only if perfect attendance and punctuality
```

### Related Keywords
- `TWD` - Total Working Days
- `AWDB` - Actual Working Days Base
- `AWDSH` - Actual Working Days Shift
- `PRORATEWD_CODE` - Working days proration

---

---
keyword: AWDSH
aliases:
  - "Actual Working Days Shift"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: AWDSH
description: Actual working days adjusted for shift schedules
module: PAYROLL
taxcountry: null
examples:
  - "PRORATEWS formula uses AWDSH"
related_keywords:
  - "AWD"
  - "PRORATEWS_CODE"
---

## AWDSH

### Description
AWDSH (Actual Working Days Shift) is the count of working days adjusted for shift schedules. More accurate for shift workers.

### Syntax
```
AWDSH
```

### Related Keywords
- `AWD` - Actual Working Days
- `PRORATEWS_CODE` - Prorate by working days with shift

---

---
keyword: AWDB
aliases:
  - "Actual Working Days Base"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: AWDB
description: Base value for actual working days calculation
module: PAYROLL
taxcountry: null
examples:
  - "SALARY * AWDB / TWDB"
related_keywords:
  - "AWD"
  - "TWDB"
---

## AWDB

### Description
AWDB (Actual Working Days Base) is the base value for working days calculations.

### Syntax
```
AWDB
```

### Related Keywords
- `AWD` - Actual Working Days
- `TWDB` - Total Working Days Base

---

---
keyword: TCD
aliases:
  - "Total Calendar Days"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: TCD
description: Total calendar days in the pay period
module: PAYROLL
taxcountry: null
examples:
  - "SALARY * ACD / TCD"
  - "IF(TCD = 30, MONTHLY_RATE, DAILY_RATE * TCD)"
related_keywords:
  - "ACD"
  - "TCDB"
  - "PRORATECD_CODE"
---

## TCD

### Description
TCD (Total Calendar Days) is the total number of calendar days in the pay period, typically 28-31 days for monthly payroll.

### Syntax
```
TCD
```

### Use Cases
- Proration denominator
- Period length calculations
- Daily rate conversions

### Examples

**Example 1: Standard Proration**
```
Formula: SALARY * ACD / TCD
Description: Prorate salary by calendar days
```

**Example 2: Period-Based Rate**
```
Formula: IF(TCD = 30, MONTHLY_RATE, DAILY_RATE * TCD)
Description: Use monthly rate for 30-day periods
```

### Related Keywords
- `ACD` - Actual Calendar Days
- `TCDB` - Total Calendar Days Base
- `PRORATECD_CODE` - Calendar days proration

---

---
keyword: TCDB
aliases:
  - "Total Calendar Days Base"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: TCDB
description: Base value for total calendar days
module: PAYROLL
taxcountry: null
examples:
  - "SALARY * ACDB / TCDB"
related_keywords:
  - "TCD"
  - "ACDB"
---

## TCDB

### Description
TCDB (Total Calendar Days Base) is the base value used as denominator in calendar days calculations.

### Syntax
```
TCDB
```

### Related Keywords
- `TCD` - Total Calendar Days
- `ACDB` - Actual Calendar Days Base

---

---
keyword: TWD
aliases:
  - "Total Working Days"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: TWD
description: Total working days in the pay period (excludes weekends and holidays)
module: PAYROLL
taxcountry: null
examples:
  - "SALARY * AWD / TWD"
  - "IF(AWD >= TWD, FULL_BONUS, PARTIAL_BONUS)"
related_keywords:
  - "AWD"
  - "TWA"
  - "TWDB"
  - "PRORATEWD_CODE"
---

## TWD

### Description
TWD (Total Working Days) is the total number of scheduled working days in the pay period, excluding weekends and public holidays.

### Syntax
```
TWD
```

### Use Cases
- Working days proration denominator
- Attendance rate calculations
- Perfect attendance checks

### Examples

**Example 1: Working Days Proration**
```
Formula: SALARY * AWD / TWD
Description: Prorate salary based on working days
```

**Example 2: Attendance-Based Bonus**
```
Formula: IF(AWD >= TWD, FULL_BONUS, PARTIAL_BONUS)
Description: Full bonus if all days attended
```

### Related Keywords
- `AWD` - Actual Working Days
- `TWA` - Total Working Days Adjusted
- `TWDB` - Total Working Days Base
- `PRORATEWD_CODE` - Working days proration

---

---
keyword: TWA
aliases:
  - "Total Working Days Adjusted"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: TWA
description: Total working days adjusted for special conditions
module: PAYROLL
taxcountry: null
examples:
  - "SALARY * AWD / TWA"
related_keywords:
  - "TWD"
  - "AWD"
---

## TWA

### Description
TWA (Total Working Days Adjusted) is the total working days count adjusted for special conditions or circumstances.

### Syntax
```
TWA
```

### Related Keywords
- `TWD` - Total Working Days
- `AWD` - Actual Working Days

---

---
keyword: TWDB
aliases:
  - "Total Working Days Base"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: TWDB
description: Base value for total working days
module: PAYROLL
taxcountry: null
examples:
  - "SALARY * AWDB / TWDB"
related_keywords:
  - "TWD"
  - "AWDB"
---

## TWDB

### Description
TWDB (Total Working Days Base) is the base value used in working days calculations.

### Syntax
```
TWDB
```

### Related Keywords
- `TWD` - Total Working Days
- `AWDB` - Actual Working Days Base

---

---
keyword: TARDINESS
aliases:
  - "ACTTARDINESS"
  - "Late Minutes"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: TARDINESS
description: Total tardiness minutes or count in the period
module: PAYROLL
taxcountry: null
examples:
  - "IF(TARDINESS = 0, 1000, 0)"
  - "IF(AND(AWD >= TWD, TARDINESS = 0), BONUS, 0)"
  - "SALARY - (TARDINESS * PENALTY_RATE)"
related_keywords:
  - "UNDERTIME"
  - "AWD"
---

## TARDINESS

### Description
TARDINESS represents the total amount of tardiness (late arrivals) in the pay period, typically measured in minutes or occurrence count.

### Syntax
```
TARDINESS
```

### Use Cases
- Punctuality bonuses
- Tardiness penalties
- Perfect attendance criteria
- Performance evaluations

### Examples

**Example 1: Punctuality Bonus**
```
Formula: IF(TARDINESS = 0, 1000, 0)
Description: 1000 bonus if no tardiness
```

**Example 2: Perfect Attendance Criteria**
```
Formula: IF(AND(AWD >= TWD, TARDINESS = 0), BONUS, 0)
Description: Bonus requires perfect attendance AND punctuality
```

**Example 3: Tardiness Penalty**
```
Formula: SALARY - (TARDINESS * PENALTY_RATE)
Description: Deduct penalty based on tardiness minutes
```

### Related Keywords
- `UNDERTIME` - Early departure
- `AWD` - Actual Working Days

---

---
keyword: UNDERTIME
aliases:
  - "Early Departure"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: UNDERTIME
description: Total undertime minutes (early departures) in the period
module: PAYROLL
taxcountry: null
examples:
  - "IF(UNDERTIME = 0, BONUS, 0)"
  - "SALARY - (UNDERTIME * HOURLY_RATE / 60)"
related_keywords:
  - "TARDINESS"
  - "AWD"
---

## UNDERTIME

### Description
UNDERTIME represents the total amount of undertime (early departures) in the pay period, measured in minutes.

### Syntax
```
UNDERTIME
```

### Use Cases
- Full-time attendance bonuses
- Undertime deductions
- Time tracking calculations

### Examples

**Example 1: No Undertime Bonus**
```
Formula: IF(UNDERTIME = 0, BONUS, 0)
Description: Bonus if no early departures
```

**Example 2: Undertime Deduction**
```
Formula: SALARY - (UNDERTIME * HOURLY_RATE / 60)
Description: Deduct pay for undertime minutes
```

### Related Keywords
- `TARDINESS` - Late arrivals
- `AWD` - Actual Working Days

---

---
keyword: PRSMS
aliases:
  - "PRS Status MS"
category: ATTSTATUS
subcategory: PRS Status
data_type: STRING
syntax: PRSMS
description: Payroll status indicator MS
module: PAYROLL
taxcountry: null
examples:
  - "IF(PRSMS='ACTIVE', SALARY, 0)"
related_keywords:
  - "PRSMA"
  - "PRORATEPRS_CODE"
---

## PRSMS

### Description
PRSMS is a payroll status indicator used in certain proration and status-based calculations.

### Syntax
```
PRSMS
```

### Related Keywords
- `PRSMA` - Alternative PRS status
- `PRORATEPRS_CODE` - PRS-based proration

---

---
keyword: PRSMA
aliases:
  - "PRS Status MA"
category: ATTSTATUS
subcategory: PRS Status
data_type: STRING
syntax: PRSMA
description: Payroll status indicator MA
module: PAYROLL
taxcountry: null
examples:
  - "IF(PRSMA='CONFIRMED', ALLOWANCE, 0)"
related_keywords:
  - "PRSMS"
  - "PRORATEPRS_CODE"
---

## PRSMA

### Description
PRSMA is an alternative payroll status indicator used in status-based calculations.

### Syntax
```
PRSMA
```

### Related Keywords
- `PRSMS` - Primary PRS status
- `PRORATEPRS_CODE` - PRS-based proration

---

---
keyword: AWH
aliases:
  - "Actual Working Hours"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: AWH
description: Actual working hours in the period
module: PAYROLL
taxcountry: null
examples:
  - "AWH * HOURLY_RATE"
  - "IF(AWH >= 160, FULL_SALARY, AWH * HOURLY_RATE)"
related_keywords:
  - "AWD"
---

## AWH

### Description
AWH (Actual Working Hours) is the total number of hours the employee worked during the pay period.

### Syntax
```
AWH
```

### Use Cases
- Hourly wage calculations
- Part-time payroll
- Overtime base calculations

### Examples

**Example 1: Hourly Pay**
```
Formula: AWH * HOURLY_RATE
Description: Calculate pay based on hours worked
```

**Example 2: Minimum Hours Check**
```
Formula: IF(AWH >= 160, FULL_SALARY, AWH * HOURLY_RATE)
Description: Full salary if minimum hours met
```

### Related Keywords
- `AWD` - Actual Working Days

---

---
keyword: ABO
aliases:
  - "Actual Break Out"
category: ATTSTATUS
subcategory: Attendance
data_type: NUMBER
syntax: ABO
description: Actual break time or time off
module: PAYROLL
taxcountry: null
examples:
  - "ABO usage in attendance calculations"
related_keywords:
  - "AWH"
---

## ABO

### Description
ABO (Actual Break Out) represents break time or time off during working hours.

### Syntax
```
ABO
```

### Related Keywords
- `AWH` - Actual Working Hours

---

# Overtime Keywords

---
keyword: OTINDEX
aliases:
  - "Overtime Index"
category: ATTINTF
subcategory: Overtime
data_type: NUMBER
syntax: OTINDEX
description: Overtime index value or multiplier
module: PAYROLL
taxcountry: null
examples:
  - "OTINDEX * BASE_RATE"
related_keywords:
  - "OTHWD"
  - "OTMEAL"
  - "OTTRANSPORT"
---

## OTINDEX

### Description
OTINDEX is an overtime index value or multiplier used in overtime calculations.

### Syntax
```
OTINDEX
```

### Related Keywords
- `OTHWD` - Overtime Holiday Working Day
- `OTMEAL` - Overtime meal allowance
- `OTTRANSPORT` - Overtime transport allowance

---

---
keyword: OTMEAL
aliases:
  - "Overtime Meal"
category: ATTINTF
subcategory: Overtime
data_type: NUMBER
syntax: OTMEAL
description: Overtime meal allowance amount
module: PAYROLL
taxcountry: null
examples:
  - "IF(OTHWD > 2, OTMEAL, 0)"
related_keywords:
  - "OTINDEX"
  - "OTTRANSPORT"
---

## OTMEAL

### Description
OTMEAL is the overtime meal allowance amount, typically provided when overtime exceeds a certain duration.

### Syntax
```
OTMEAL
```

### Examples

**Example: Conditional Meal Allowance**
```
Formula: IF(OTHWD > 2, OTMEAL, 0)
Description: Meal allowance if OT exceeds 2 hours
```

### Related Keywords
- `OTINDEX` - Overtime index
- `OTTRANSPORT` - Overtime transport

---

---
keyword: OTTRANSPORT
aliases:
  - "Overtime Transport"
category: ATTINTF
subcategory: Overtime
data_type: NUMBER
syntax: OTTRANSPORT
description: Overtime transport allowance amount
module: PAYROLL
taxcountry: null
examples:
  - "IF(OTHWD > 4, OTTRANSPORT, 0)"
related_keywords:
  - "OTINDEX"
  - "OTMEAL"
---

## OTTRANSPORT

### Description
OTTRANSPORT is the overtime transport allowance, typically provided for late-night overtime work.

### Syntax
```
OTTRANSPORT
```

### Examples

**Example: Conditional Transport Allowance**
```
Formula: IF(OTHWD > 4, OTTRANSPORT, 0)
Description: Transport allowance if OT exceeds 4 hours
```

### Related Keywords
- `OTINDEX` - Overtime index
- `OTMEAL` - Overtime meal

---

---
keyword: OVT_TOTAL
aliases:
  - "Total Overtime"
category: ATTINTF
subcategory: Overtime
data_type: NUMBER
syntax: OVT_TOTAL
description: Total overtime hours across all types
module: PAYROLL
taxcountry: null
examples:
  - "OVT_TOTAL * HOURLY_RATE * 1.5"
related_keywords:
  - "OTHWD"
  - "OTRD_HALF"
---

## OVT_TOTAL

### Description
OVT_TOTAL is the sum of all overtime hours across all overtime types.

### Syntax
```
OVT_TOTAL
```

### Examples

**Example: Total OT Pay**
```
Formula: OVT_TOTAL * HOURLY_RATE * 1.5
Description: Calculate total overtime pay at 1.5x rate
```

### Related Keywords
- `OTHWD` - Overtime Holiday Working Day
- `OTRD_HALF` - Rest Day OT Half

---

---
keyword: OTHWD
aliases:
  - "Overtime Holiday Working Day"
category: ATTINTF
subcategory: Overtime
data_type: NUMBER
syntax: OTHWD
description: Overtime hours worked on holidays/working days
module: PAYROLL
taxcountry: null
examples:
  - "OTHWD * HOURLY_RATE * 2.0"
  - "IF(OTHWD > 0, OTHWD * PREMIUM_RATE, 0)"
related_keywords:
  - "OTINDEX"
  - "OVT_TOTAL"
  - "OTRD_HALF"
---

## OTHWD

### Description
OTHWD (Overtime Holiday Working Day) represents overtime hours worked on holidays or designated working days.

### Syntax
```
OTHWD
```

### Examples

**Example 1: Holiday OT Pay**
```
Formula: OTHWD * HOURLY_RATE * 2.0
Description: Double pay for holiday overtime
```

**Example 2: Conditional Premium**
```
Formula: IF(OTHWD > 0, OTHWD * PREMIUM_RATE, 0)
Description: Premium rate for holiday OT
```

### Related Keywords
- `OTINDEX` - Overtime index
- `OVT_TOTAL` - Total overtime
- `OTRD_HALF` - Rest Day OT

---

---
keyword: OTRD_HALF
aliases:
  - "Overtime Rest Day Half"
category: ATTINTF
subcategory: Overtime
data_type: NUMBER
syntax: OTRD_HALF
description: Overtime hours on rest day (first half period)
module: PAYROLL
taxcountry: null
examples:
  - "OTRD_HALF * HOURLY_RATE * 1.5"
related_keywords:
  - "OTRD_FULL"
  - "OTRD_EXC"
  - "OTHWD"
---

## OTRD_HALF

### Description
OTRD_HALF is overtime hours worked on rest days during the first half period (typically first 8 hours).

### Syntax
```
OTRD_HALF
```

### Examples

**Example: Rest Day OT Pay (Half)**
```
Formula: OTRD_HALF * HOURLY_RATE * 1.5
Description: 1.5x pay for first half of rest day OT
```

### Related Keywords
- `OTRD_FULL` - Rest Day OT Full
- `OTRD_EXC` - Rest Day OT Excess
- `OTHWD` - Overtime Holiday Working Day

---

---
keyword: OTRD_FULL
aliases:
  - "Overtime Rest Day Full"
category: ATTINTF
subcategory: Overtime
data_type: NUMBER
syntax: OTRD_FULL
description: Overtime hours on rest day (full day period)
module: PAYROLL
taxcountry: null
examples:
  - "OTRD_FULL * HOURLY_RATE * 2.0"
related_keywords:
  - "OTRD_HALF"
  - "OTRD_EXC"
---

## OTRD_FULL

### Description
OTRD_FULL is overtime hours worked on rest days during the full day period (typically hours 9-16).

### Syntax
```
OTRD_FULL
```

### Examples

**Example: Rest Day OT Pay (Full)**
```
Formula: OTRD_FULL * HOURLY_RATE * 2.0
Description: 2.0x pay for full day rest day OT
```

### Related Keywords
- `OTRD_HALF` - Rest Day OT Half
- `OTRD_EXC` - Rest Day OT Excess

---

---
keyword: OTRD_EXC
aliases:
  - "Overtime Rest Day Excess"
category: ATTINTF
subcategory: Overtime
data_type: NUMBER
syntax: OTRD_EXC
description: Overtime hours on rest day (excess beyond full day)
module: PAYROLL
taxcountry: null
examples:
  - "OTRD_EXC * HOURLY_RATE * 3.0"
related_keywords:
  - "OTRD_HALF"
  - "OTRD_FULL"
---

## OTRD_EXC

### Description
OTRD_EXC is overtime hours worked on rest days beyond the full day period (typically hours 17+).

### Syntax
```
OTRD_EXC
```

### Examples

**Example: Rest Day OT Pay (Excess)**
```
Formula: OTRD_EXC * HOURLY_RATE * 3.0
Description: 3.0x pay for excess rest day OT
```

### Related Keywords
- `OTRD_HALF` - Rest Day OT Half
- `OTRD_FULL` - Rest Day OT Full

---

---
keyword: OTPH_HALF
aliases:
  - "Overtime Public Holiday Half"
category: ATTINTF
subcategory: Overtime
data_type: NUMBER
syntax: OTPH_HALF
description: Overtime hours on public holiday (first half period)
module: PAYROLL
taxcountry: null
examples:
  - "OTPH_HALF * HOURLY_RATE * 2.0"
related_keywords:
  - "OTPH_FULL"
  - "OTPH_EXC"
  - "OTHWD"
---

## OTPH_HALF

### Description
OTPH_HALF is overtime hours worked on public holidays during the first half period.

### Syntax
```
OTPH_HALF
```

### Examples

**Example: Public Holiday OT Pay (Half)**
```
Formula: OTPH_HALF * HOURLY_RATE * 2.0
Description: 2.0x pay for first half of public holiday OT
```

### Related Keywords
- `OTPH_FULL` - Public Holiday OT Full
- `OTPH_EXC` - Public Holiday OT Excess
- `OTHWD` - Overtime Holiday Working Day

---

---
keyword: OTPH_FULL
aliases:
  - "Overtime Public Holiday Full"
category: ATTINTF
subcategory: Overtime
data_type: NUMBER
syntax: OTPH_FULL
description: Overtime hours on public holiday (full day period)
module: PAYROLL
taxcountry: null
examples:
  - "OTPH_FULL * HOURLY_RATE * 2.5"
related_keywords:
  - "OTPH_HALF"
  - "OTPH_EXC"
---

## OTPH_FULL

### Description
OTPH_FULL is overtime hours worked on public holidays during the full day period.

### Syntax
```
OTPH_FULL
```

### Examples

**Example: Public Holiday OT Pay (Full)**
```
Formula: OTPH_FULL * HOURLY_RATE * 2.5
Description: 2.5x pay for full day public holiday OT
```

### Related Keywords
- `OTPH_HALF` - Public Holiday OT Half
- `OTPH_EXC` - Public Holiday OT Excess

---

---
keyword: OTPH_EXC
aliases:
  - "Overtime Public Holiday Excess"
category: ATTINTF
subcategory: Overtime
data_type: NUMBER
syntax: OTPH_EXC
description: Overtime hours on public holiday (excess beyond full day)
module: PAYROLL
taxcountry: null
examples:
  - "OTPH_EXC * HOURLY_RATE * 3.5"
related_keywords:
  - "OTPH_HALF"
  - "OTPH_FULL"
---

## OTPH_EXC

### Description
OTPH_EXC is overtime hours worked on public holidays beyond the full day period.

### Syntax
```
OTPH_EXC
```

### Examples

**Example: Public Holiday OT Pay (Excess)**
```
Formula: OTPH_EXC * HOURLY_RATE * 3.5
Description: 3.5x pay for excess public holiday OT
```

### Related Keywords
- `OTPH_HALF` - Public Holiday OT Half
- `OTPH_FULL` - Public Holiday OT Full

---

# Employee Data Keywords

---
keyword: JOINDATE
aliases:
  - "Join Date"
  - "Hire Date"
category: EMPFORM
subcategory: Employee Dates
data_type: DATE
syntax: JOINDATE
description: Employee's join/hire date
module: PAYROLL
taxcountry: null
examples:
  - "DATEDIFF('DAY', JOINDATE, TODAY())"
  - "LENGTHOFSERVICE(JOINDATE, TODAY(), 'y')"
  - "IF(DATEDIFF('DAY', JOINDATE, TODAY()) < 90, 0, ALLOWANCE)"
related_keywords:
  - "ENDDATE"
  - "TERMINATEDATE"
  - "LENGTHOFSERVICE"
  - "DATEDIFF"
---

## JOINDATE

### Description
JOINDATE is the employee's official join date or hire date with the company.

### Syntax
```
JOINDATE
```

### Use Cases
- Length of service calculations
- Probation period checks
- Anniversary bonuses
- Seniority-based benefits

### Examples

**Example 1: Days Since Join**
```
Formula: DATEDIFF('DAY', JOINDATE, TODAY())
Description: Calculate days since employee joined
```

**Example 2: Years of Service**
```
Formula: LENGTHOFSERVICE(JOINDATE, TODAY(), 'y')
Description: Calculate years of service
```

**Example 3: Probation Period Check**
```
Formula: IF(DATEDIFF('DAY', JOINDATE, TODAY()) < 90, 0, ALLOWANCE)
Description: Allowance only after 90-day probation
```

### Related Keywords
- `ENDDATE` - Employment end date
- `TERMINATEDATE` - Termination date
- `LENGTHOFSERVICE` - Service duration function
- `DATEDIFF` - Date difference function

---

---
keyword: ENDDATE
aliases:
  - "End Date"
category: EMPFORM
subcategory: Employee Dates
data_type: DATE
syntax: ENDDATE
description: Employee's employment end date
module: PAYROLL
taxcountry: null
examples:
  - "LENGTHOFSERVICE(JOINDATE, ENDDATE, 'm')"
  - "IF(ENDDATE IS NULL, SALARY, SEVERANCE)"
related_keywords:
  - "JOINDATE"
  - "TERMINATEDATE"
  - "LENGTHOFSERVICE"
---

## ENDDATE

### Description
ENDDATE is the employee's employment end date, typically null for active employees.

### Syntax
```
ENDDATE
```

### Use Cases
- Severance calculations
- Final pay computations
- Employment duration
- Termination processing

### Examples

**Example 1: Service Duration**
```
Formula: LENGTHOFSERVICE(JOINDATE, ENDDATE, 'm')
Description: Calculate months of service
```

**Example 2: Active Status Check**
```
Formula: IF(ENDDATE IS NULL, SALARY, SEVERANCE)
Description: Regular salary if active, severance if terminated
```

### Related Keywords
- `JOINDATE` - Join date
- `TERMINATEDATE` - Termination date
- `LENGTHOFSERVICE` - Service duration function

---

---
keyword: TERMINATEDATE
aliases:
  - "Termination Date"
category: EMPFORM
subcategory: Employee Dates
data_type: DATE
syntax: TERMINATEDATE
description: Employee's termination date
module: PAYROLL
taxcountry: null
examples:
  - "IF(TERMINATEDATE IS NOT NULL, SEVERANCE_CALC, 0)"
related_keywords:
  - "JOINDATE"
  - "ENDDATE"
---

## TERMINATEDATE

### Description
TERMINATEDATE is the specific date the employee's employment was terminated.

### Syntax
```
TERMINATEDATE
```

### Examples

**Example: Severance Trigger**
```
Formula: IF(TERMINATEDATE IS NOT NULL, SEVERANCE_CALC, 0)
Description: Calculate severance if terminated
```

### Related Keywords
- `JOINDATE` - Join date
- `ENDDATE` - Employment end date

---

---
keyword: FULLJOINDATE
aliases:
  - "Full Join Date"
category: EMPFORM
subcategory: Employee Dates
data_type: DATE
syntax: FULLJOINDATE
description: Employee's full join date (may differ from JOINDATE in certain contexts)
module: PAYROLL
taxcountry: null
examples:
  - "LENGTHOFSERVICE(FULLJOINDATE, TODAY(), 'y')"
related_keywords:
  - "JOINDATE"
---

## FULLJOINDATE

### Description
FULLJOINDATE is an alternative join date field that may represent the original hire date across multiple employment periods.

### Syntax
```
FULLJOINDATE
```

### Related Keywords
- `JOINDATE` - Standard join date

---

---
keyword: PERMANENTDATE
aliases:
  - "Permanent Date"
category: EMPFORM
subcategory: Employee Dates
data_type: DATE
syntax: PERMANENTDATE
description: Date employee became permanent (end of probation)
module: PAYROLL
taxcountry: null
examples:
  - "IF(TODAY() >= PERMANENTDATE, PERMANENT_BENEFITS, 0)"
  - "LENGTHOFSERVICE(PERMANENTDATE, TODAY(), 'm')"
related_keywords:
  - "JOINDATE"
  - "LOS_PERMANENT"
---

## PERMANENTDATE

### Description
PERMANENTDATE is the date the employee's status changed from probationary to permanent.

### Syntax
```
PERMANENTDATE
```

### Examples

**Example 1: Permanent Benefits Check**
```
Formula: IF(TODAY() >= PERMANENTDATE, PERMANENT_BENEFITS, 0)
Description: Benefits available after permanent status
```

**Example 2: Months Since Permanent**
```
Formula: LENGTHOFSERVICE(PERMANENTDATE, TODAY(), 'm')
Description: Calculate months since becoming permanent
```

### Related Keywords
- `JOINDATE` - Join date
- `LOS_PERMANENT` - Length of service as permanent

---

---
keyword: PENSIONDATE
aliases:
  - "Pension Date"
category: EMPFORM
subcategory: Employee Dates
data_type: DATE
syntax: PENSIONDATE
description: Employee's pension eligibility or retirement date
module: PAYROLL
taxcountry: null
examples:
  - "IF(TODAY() >= PENSIONDATE, PENSION_AMOUNT, 0)"
related_keywords:
  - "JOINDATE"
  - "ENDDATE"
---

## PENSIONDATE

### Description
PENSIONDATE is the date the employee becomes eligible for pension or retirement benefits.

### Syntax
```
PENSIONDATE
```

### Examples

**Example: Pension Eligibility**
```
Formula: IF(TODAY() >= PENSIONDATE, PENSION_AMOUNT, 0)
Description: Pension payment if date reached
```

### Related Keywords
- `JOINDATE` - Join date
- `ENDDATE` - Employment end date

---

---
keyword: EFFECTIVEDATE
aliases:
  - "Effective Date"
category: EMPFORM
subcategory: Employee Dates
data_type: DATE
syntax: EFFECTIVEDATE
description: Effective date for current employment record or status
module: PAYROLL
taxcountry: null
examples:
  - "IF(PAYDATE >= EFFECTIVEDATE, NEW_SALARY, OLD_SALARY)"
related_keywords:
  - "JOINDATE"
---

## EFFECTIVEDATE

### Description
EFFECTIVEDATE is the effective date for the current employment record, salary change, or status update.

### Syntax
```
EFFECTIVEDATE
```

### Examples

**Example: Salary Change Date**
```
Formula: IF(PAYDATE >= EFFECTIVEDATE, NEW_SALARY, OLD_SALARY)
Description: Use new salary after effective date
```

### Related Keywords
- `JOINDATE` - Join date

---

---
keyword: EMPNO
aliases:
  - "Employee Number"
  - "Employee ID"
category: EMPDATA
subcategory: Employee Personal
data_type: STRING
syntax: EMPNO
description: Employee number or employee ID
module: PAYROLL
taxcountry: null
examples:
  - "CONCATENATE('EMP-', EMPNO)"
related_keywords:
  - "EMPGENDER"
  - "POSITIONNAME"
---

## EMPNO

### Description
EMPNO is the unique employee number or employee ID assigned to the employee.

### Syntax
```
EMPNO
```

### Examples

**Example: Generate Reference**
```
Formula: CONCATENATE('EMP-', EMPNO)
Description: Create formatted employee reference
```

### Related Keywords
- `EMPGENDER` - Employee gender
- `POSITIONNAME` - Position name

---

---
keyword: EMPGENDER
aliases:
  - "Employee Gender"
  - "Gender"
category: EMPDATA
subcategory: Employee Personal
data_type: STRING
syntax: EMPGENDER
description: Employee's gender
module: PAYROLL
taxcountry: null
examples:
  - "IF(EMPGENDER='F', FEMALE_ALLOWANCE, MALE_ALLOWANCE)"
related_keywords:
  - "EMPNO"
---

## EMPGENDER

### Description
EMPGENDER is the employee's gender identifier.

### Syntax
```
EMPGENDER
```

### Examples

**Example: Gender-Specific Allowance**
```
Formula: IF(EMPGENDER='F', FEMALE_ALLOWANCE, MALE_ALLOWANCE)
Description: Different allowances by gender (if applicable)
```

### Related Keywords
- `EMPNO` - Employee number

---

---
keyword: POSITIONNAME
aliases:
  - "Position Name"
  - "Job Title"
category: EMPDATA
subcategory: Employee Personal
data_type: STRING
syntax: POSITIONNAME
description: Employee's position or job title
module: PAYROLL
taxcountry: null
examples:
  - "IF(POSITIONNAME='Manager', MANAGER_ALLOWANCE, 0)"
related_keywords:
  - "GRADE"
  - "DEPTNAME"
---

## POSITIONNAME

### Description
POSITIONNAME is the employee's job title or position name.

### Syntax
```
POSITIONNAME
```

### Examples

**Example: Position-Based Allowance**
```
Formula: IF(POSITIONNAME='Manager', MANAGER_ALLOWANCE, 0)
Description: Special allowance for managers
```

### Related Keywords
- `GRADE` - Employee grade
- `DEPTNAME` - Department name

---

---
keyword: GRADE
aliases:
  - "Employee Grade"
  - "Job Grade"
category: EMPDATA
subcategory: Employee Personal
data_type: STRING
syntax: GRADE
description: Employee's grade or level
module: PAYROLL
taxcountry: null
examples:
  - "IF(GRADE='A', PREMIUM_RATE, STANDARD_RATE)"
related_keywords:
  - "POSITIONNAME"
---

## GRADE

### Description
GRADE is the employee's grade, level, or classification within the organization.

### Syntax
```
GRADE
```

### Examples

**Example: Grade-Based Rate**
```
Formula: IF(GRADE='A', PREMIUM_RATE, STANDARD_RATE)
Description: Different rates by grade
```

### Related Keywords
- `POSITIONNAME` - Position name

---

---
keyword: DEPTNAME
aliases:
  - "Department Name"
category: EMPDATA
subcategory: Employee Personal
data_type: STRING
syntax: DEPTNAME
description: Employee's department name
module: PAYROLL
taxcountry: null
examples:
  - "IF(DEPTNAME='Sales', COMMISSION_RATE, 0)"
related_keywords:
  - "COSTCENTER"
  - "WORKLOCATION"
---

## DEPTNAME

### Description
DEPTNAME is the name of the department the employee belongs to.

### Syntax
```
DEPTNAME
```

### Examples

**Example: Department-Specific Allowance**
```
Formula: IF(DEPTNAME='Sales', COMMISSION_RATE, 0)
Description: Commission for sales department
```

### Related Keywords
- `COSTCENTER` - Cost center
- `WORKLOCATION` - Work location

---

---
keyword: COSTCENTER
aliases:
  - "Cost Center"
category: EMPDATA
subcategory: Employee Personal
data_type: STRING
syntax: COSTCENTER
description: Employee's cost center code
module: PAYROLL
taxcountry: null
examples:
  - "IF(COSTCENTER='CC001', SPECIAL_ALLOWANCE, 0)"
related_keywords:
  - "DEPTNAME"
---

## COSTCENTER

### Description
COSTCENTER is the cost center code assigned to the employee for accounting purposes.

### Syntax
```
COSTCENTER
```

### Examples

**Example: Cost Center Allowance**
```
Formula: IF(COSTCENTER='CC001', SPECIAL_ALLOWANCE, 0)
Description: Allowance for specific cost center
```

### Related Keywords
- `DEPTNAME` - Department name

---

---
keyword: WORKLOCATION
aliases:
  - "Work Location"
category: EMPDATA
subcategory: Employee Personal
data_type: STRING
syntax: WORKLOCATION
description: Employee's work location or site
module: PAYROLL
taxcountry: null
examples:
  - "IF(WORKLOCATION='HQ', HQ_ALLOWANCE, BRANCH_ALLOWANCE)"
related_keywords:
  - "DEPTNAME"
  - "COSTCENTER"
---

## WORKLOCATION

### Description
WORKLOCATION is the employee's primary work location or site.

### Syntax
```
WORKLOCATION
```

### Examples

**Example: Location-Based Allowance**
```
Formula: IF(WORKLOCATION='HQ', HQ_ALLOWANCE, BRANCH_ALLOWANCE)
Description: Different allowances by location
```

### Related Keywords
- `DEPTNAME` - Department name
- `COSTCENTER` - Cost center

---

---
keyword: EMPLOYMENTSTATUS
aliases:
  - "Employment Status"
category: EMPDATA
subcategory: Employee Personal
data_type: STRING
syntax: EMPLOYMENTSTATUS
description: Employee's employment status (e.g., Full-Time, Part-Time, Contract)
module: PAYROLL
taxcountry: null
examples:
  - "IF(EMPLOYMENTSTATUS='Full-Time', FULL_BENEFITS, PART_BENEFITS)"
related_keywords:
  - "JOBSTATUS"
---

## EMPLOYMENTSTATUS

### Description
EMPLOYMENTSTATUS is the employee's employment classification (Full-Time, Part-Time, Contract, etc.).

### Syntax
```
EMPLOYMENTSTATUS
```

### Examples

**Example: Status-Based Benefits**
```
Formula: IF(EMPLOYMENTSTATUS='Full-Time', FULL_BENEFITS, PART_BENEFITS)
Description: Different benefits by employment status
```

### Related Keywords
- `JOBSTATUS` - Job status

---

---
keyword: JOBSTATUS
aliases:
  - "Job Status"
category: EMPDATA
subcategory: Employee Personal
data_type: STRING
syntax: JOBSTATUS
description: Employee's job status (e.g., Active, Probation, Notice Period)
module: PAYROLL
taxcountry: null
examples:
  - "IF(JOBSTATUS='Active', FULL_SALARY, PRORATED_SALARY)"
related_keywords:
  - "EMPLOYMENTSTATUS"
---

## JOBSTATUS

### Description
JOBSTATUS is the employee's current job status (Active, Probation, Notice Period, etc.).

### Syntax
```
JOBSTATUS
```

### Examples

**Example: Status-Based Pay**
```
Formula: IF(JOBSTATUS='Active', FULL_SALARY, PRORATED_SALARY)
Description: Different pay based on job status
```

### Related Keywords
- `EMPLOYMENTSTATUS` - Employment status

---

---
keyword: LENGTHOFSERVICE_DAY
aliases:
  - "LOS Days"
category: EMPFORM
subcategory: Length of Service
data_type: NUMBER
syntax: LENGTHOFSERVICE_DAY
description: Length of service in days
module: PAYROLL
taxcountry: null
examples:
  - "IF(LENGTHOFSERVICE_DAY >= 365, LOYALTY_BONUS, 0)"
related_keywords:
  - "LENGTHOFSERVICE_MONTH"
  - "LENGTHOFSERVICE_YEAR"
  - "JOINDATE"
---

## LENGTHOFSERVICE_DAY

### Description
LENGTHOFSERVICE_DAY is the employee's total length of service measured in days.

### Syntax
```
LENGTHOFSERVICE_DAY
```

### Examples

**Example: One-Year Service Bonus**
```
Formula: IF(LENGTHOFSERVICE_DAY >= 365, LOYALTY_BONUS, 0)
Description: Bonus after one year of service
```

### Related Keywords
- `LENGTHOFSERVICE_MONTH` - Service in months
- `LENGTHOFSERVICE_YEAR` - Service in years
- `JOINDATE` - Join date

---

---
keyword: LENGTHOFSERVICE_MONTH
aliases:
  - "LOS Months"
category: EMPFORM
subcategory: Length of Service
data_type: NUMBER
syntax: LENGTHOFSERVICE_MONTH
description: Length of service in months
module: PAYROLL
taxcountry: null
examples:
  - "IF(LENGTHOFSERVICE_MONTH >= 12, ANNUAL_BONUS, PRORATED_BONUS)"
  - "LENGTHOFSERVICE_MONTH * MONTHLY_RATE"
related_keywords:
  - "LENGTHOFSERVICE_DAY"
  - "LENGTHOFSERVICE_YEAR"
  - "JOINDATE"
---

## LENGTHOFSERVICE_MONTH

### Description
LENGTHOFSERVICE_MONTH is the employee's total length of service measured in months.

### Syntax
```
LENGTHOFSERVICE_MONTH
```

### Examples

**Example 1: Annual Bonus Check**
```
Formula: IF(LENGTHOFSERVICE_MONTH >= 12, ANNUAL_BONUS, PRORATED_BONUS)
Description: Full bonus after 12 months
```

**Example 2: Service-Based Calculation**
```
Formula: LENGTHOFSERVICE_MONTH * MONTHLY_RATE
Description: Calculate based on months of service
```

### Related Keywords
- `LENGTHOFSERVICE_DAY` - Service in days
- `LENGTHOFSERVICE_YEAR` - Service in years
- `JOINDATE` - Join date

---

---
keyword: LENGTHOFSERVICE_YEAR
aliases:
  - "LOS Years"
category: EMPFORM
subcategory: Length of Service
data_type: NUMBER
syntax: LENGTHOFSERVICE_YEAR
description: Length of service in years
module: PAYROLL
taxcountry: null
examples:
  - "LENGTHOFSERVICE_YEAR * 1000"
  - "IF(LENGTHOFSERVICE_YEAR >= 5, SENIOR_ALLOWANCE, 0)"
related_keywords:
  - "LENGTHOFSERVICE_DAY"
  - "LENGTHOFSERVICE_MONTH"
  - "JOINDATE"
---

## LENGTHOFSERVICE_YEAR

### Description
LENGTHOFSERVICE_YEAR is the employee's total length of service measured in complete years.

### Syntax
```
LENGTHOFSERVICE_YEAR
```

### Examples

**Example 1: Service Bonus**
```
Formula: LENGTHOFSERVICE_YEAR * 1000
Description: 1000 bonus per year of service
```

**Example 2: Seniority Allowance**
```
Formula: IF(LENGTHOFSERVICE_YEAR >= 5, SENIOR_ALLOWANCE, 0)
Description: Allowance for 5+ years service
```

### Related Keywords
- `LENGTHOFSERVICE_DAY` - Service in days
- `LENGTHOFSERVICE_MONTH` - Service in months
- `JOINDATE` - Join date

---

---
keyword: LOS_ENDOFCONTRACT_DAY
aliases:
  - "LOS End of Contract Days"
category: EMPFORM
subcategory: Length of Service
data_type: NUMBER
syntax: LOS_ENDOFCONTRACT_DAY
description: Days until end of contract
module: PAYROLL
taxcountry: null
examples:
  - "IF(LOS_ENDOFCONTRACT_DAY < 30, RENEWAL_NOTICE, 0)"
related_keywords:
  - "LOS_ENDOFCONTRACT_MONTH"
  - "ENDDATE"
---

## LOS_ENDOFCONTRACT_DAY

### Description
LOS_ENDOFCONTRACT_DAY is the number of days remaining until the employee's contract end date.

### Syntax
```
LOS_ENDOFCONTRACT_DAY
```

### Examples

**Example: Contract Renewal Alert**
```
Formula: IF(LOS_ENDOFCONTRACT_DAY < 30, RENEWAL_NOTICE, 0)
Description: Trigger renewal process if contract ending within 30 days
```

### Related Keywords
- `LOS_ENDOFCONTRACT_MONTH` - Months until contract end
- `ENDDATE` - Contract end date

---

---
keyword: LOS_ENDOFCONTRACT_MONTH
aliases:
  - "LOS End of Contract Months"
category: EMPFORM
subcategory: Length of Service
data_type: NUMBER
syntax: LOS_ENDOFCONTRACT_MONTH
description: Months until end of contract
module: PAYROLL
taxcountry: null
examples:
  - "IF(LOS_ENDOFCONTRACT_MONTH < 1, CONTRACT_BONUS, 0)"
related_keywords:
  - "LOS_ENDOFCONTRACT_DAY"
  - "ENDDATE"
---

## LOS_ENDOFCONTRACT_MONTH

### Description
LOS_ENDOFCONTRACT_MONTH is the number of months remaining until the employee's contract end date.

### Syntax
```
LOS_ENDOFCONTRACT_MONTH
```

### Examples

**Example: End of Contract Bonus**
```
Formula: IF(LOS_ENDOFCONTRACT_MONTH < 1, CONTRACT_BONUS, 0)
Description: Bonus in final month of contract
```

### Related Keywords
- `LOS_ENDOFCONTRACT_DAY` - Days until contract end
- `ENDDATE` - Contract end date

---

---
keyword: LOS_PERMANENT
aliases:
  - "LOS as Permanent"
category: EMPFORM
subcategory: Length of Service
data_type: NUMBER
syntax: LOS_PERMANENT
description: Length of service as permanent employee
module: PAYROLL
taxcountry: null
examples:
  - "IF(LOS_PERMANENT >= 365, PERMANENT_BENEFIT, 0)"
related_keywords:
  - "PERMANENTDATE"
  - "LOS_PROBATION"
---

## LOS_PERMANENT

### Description
LOS_PERMANENT is the length of service calculated from the permanent employment date.

### Syntax
```
LOS_PERMANENT
```

### Examples

**Example: Permanent Status Benefit**
```
Formula: IF(LOS_PERMANENT >= 365, PERMANENT_BENEFIT, 0)
Description: Benefit after 1 year as permanent employee
```

### Related Keywords
- `PERMANENTDATE` - Date became permanent
- `LOS_PROBATION` - Length of probation service

---

---
keyword: LOS_PROBATION
aliases:
  - "LOS During Probation"
category: EMPFORM
subcategory: Length of Service
data_type: NUMBER
syntax: LOS_PROBATION
description: Length of service during probation period
module: PAYROLL
taxcountry: null
examples:
  - "IF(LOS_PROBATION >= 90, PROBATION_END_BONUS, 0)"
related_keywords:
  - "LOS_PERMANENT"
  - "PERMANENTDATE"
---

## LOS_PROBATION

### Description
LOS_PROBATION is the length of service during the probation period.

### Syntax
```
LOS_PROBATION
```

### Examples

**Example: Probation Completion Bonus**
```
Formula: IF(LOS_PROBATION >= 90, PROBATION_END_BONUS, 0)
Description: Bonus after completing 90-day probation
```

### Related Keywords
- `LOS_PERMANENT` - Service as permanent
- `PERMANENTDATE` - Permanent status date

---

---
keyword: LOS_CONTRACT1
aliases:
  - "LOS Contract 1"
category: EMPFORM
subcategory: Length of Service
data_type: NUMBER
syntax: LOS_CONTRACT1
description: Length of service during first contract period
module: PAYROLL
taxcountry: null
examples:
  - "LOS_CONTRACT1 * CONTRACT_RATE"
related_keywords:
  - "LOS_CONTRACT2"
---

## LOS_CONTRACT1

### Description
LOS_CONTRACT1 is the length of service during the first contract period.

### Syntax
```
LOS_CONTRACT1
```

### Examples

**Example: Contract 1 Calculation**
```
Formula: LOS_CONTRACT1 * CONTRACT_RATE
Description: Calculate based on first contract duration
```

### Related Keywords
- `LOS_CONTRACT2` - Second contract period service

---

---
keyword: LOS_CONTRACT2
aliases:
  - "LOS Contract 2"
category: EMPFORM
subcategory: Length of Service
data_type: NUMBER
syntax: LOS_CONTRACT2
description: Length of service during second contract period
module: PAYROLL
taxcountry: null
examples:
  - "LOS_CONTRACT2 * RENEWAL_RATE"
related_keywords:
  - "LOS_CONTRACT1"
---

## LOS_CONTRACT2

### Description
LOS_CONTRACT2 is the length of service during the second contract period.

### Syntax
```
LOS_CONTRACT2
```

### Examples

**Example: Contract 2 Calculation**
```
Formula: LOS_CONTRACT2 * RENEWAL_RATE
Description: Calculate based on second contract duration
```

### Related Keywords
- `LOS_CONTRACT1` - First contract period service

---

# Built-in Functions

## Date/Time Functions

---
keyword: TODAY
aliases:
  - "TODAY()"
  - "Current Date"
category: DEFFORM
subcategory: Date/Time Functions
data_type: DATE
syntax: "TODAY()"
description: Returns the current system date
module: PAYROLL
taxcountry: null
examples:
  - "DATEDIFF('DAY', JOINDATE, TODAY())"
  - "IF(TODAY() >= EFFECTIVEDATE, NEW_RATE, OLD_RATE)"
related_keywords:
  - "DATETIME_NOW"
  - "DATEDIFF"
---

## TODAY

### Description
The `TODAY()` function returns the current system date without time component.

### Syntax
```
TODAY()
```

### Return Value
DATE - Current date (YYYY-MM-DD format)

### Use Cases
- Calculate current age or tenure
- Date comparisons
- Check effective dates
- Current period calculations

### Examples

**Example 1: Days Since Join**
```
Formula: DATEDIFF('DAY', JOINDATE, TODAY())
Description: Calculate days employed
```

**Example 2: Effective Date Check**
```
Formula: IF(TODAY() >= EFFECTIVEDATE, NEW_RATE, OLD_RATE)
Description: Use new rate if effective date has passed
```

### Related Keywords
- `DATETIME_NOW()` - Current date and time
- `DATEDIFF()` - Calculate date difference

---

---
keyword: DATETIME_NOW
aliases:
  - "DATETIME_NOW()"
  - "Current DateTime"
category: DEFFORM
subcategory: Date/Time Functions
data_type: DATETIME
syntax: "DATETIME_NOW()"
description: Returns the current system date and time
module: PAYROLL
taxcountry: null
examples:
  - "DATETIME_NOW()"
related_keywords:
  - "TODAY"
  - "HOUR"
  - "MINUTE"
---

## DATETIME_NOW

### Description
The `DATETIME_NOW()` function returns the current system date and time.

### Syntax
```
DATETIME_NOW()
```

### Return Value
DATETIME - Current date and time

### Examples

**Example: Timestamp**
```
Formula: DATETIME_NOW()
Description: Get current timestamp
```

### Related Keywords
- `TODAY()` - Current date only
- `HOUR()` - Extract hour
- `MINUTE()` - Extract minute

---

---
keyword: ISDATE
aliases:
  - "ISDATE()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: BOOLEAN
syntax: "ISDATE(value)"
description: Checks if a value is a valid date
module: PAYROLL
taxcountry: null
examples:
  - "IF(ISDATE(JOINDATE), CALCULATE_LOS, 0)"
related_keywords:
  - "TODAY"
  - "ISNUMERIC"
---

## ISDATE

### Description
The `ISDATE()` function checks if a value is a valid date.

### Syntax
```
ISDATE(value)
```

### Parameters
- `value` - Value to check

### Return Value
BOOLEAN - True if valid date, False otherwise

### Examples

**Example: Validate Date Field**
```
Formula: IF(ISDATE(JOINDATE), CALCULATE_LOS, 0)
Description: Only calculate if join date is valid
```

### Related Keywords
- `TODAY()` - Current date
- `ISNUMERIC()` - Check if numeric

---

---
keyword: DAY
aliases:
  - "DAY()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: NUMBER
syntax: "DAY(date)"
description: Extracts the day component from a date
module: PAYROLL
taxcountry: null
examples:
  - "DAY(JOINDATE)"
  - "IF(DAY(TODAY()) >= 15, FIRST_HALF, SECOND_HALF)"
related_keywords:
  - "MONTH"
  - "YEAR"
  - "TODAY"
---

## DAY

### Description
The `DAY()` function extracts the day of the month (1-31) from a date value.

### Syntax
```
DAY(date)
```

### Parameters
- `date` - Date value to extract day from

### Return Value
NUMBER - Day of month (1-31)

### Examples

**Example 1: Extract Day**
```
Formula: DAY(JOINDATE)
Description: Get day of month from join date
```

**Example 2: Period Half Check**
```
Formula: IF(DAY(TODAY()) >= 15, FIRST_HALF, SECOND_HALF)
Description: Different value based on period half
```

### Related Keywords
- `MONTH()` - Extract month
- `YEAR()` - Extract year
- `TODAY()` - Current date

---

---
keyword: MONTH
aliases:
  - "MONTH()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: NUMBER
syntax: "MONTH(date)"
description: Extracts the month component from a date
module: PAYROLL
taxcountry: null
examples:
  - "MONTH(JOINDATE)"
  - "IF(MONTH(TODAY()) = 12, YEAR_END_BONUS, 0)"
related_keywords:
  - "DAY"
  - "YEAR"
  - "TODAY"
---

## MONTH

### Description
The `MONTH()` function extracts the month (1-12) from a date value.

### Syntax
```
MONTH(date)
```

### Parameters
- `date` - Date value to extract month from

### Return Value
NUMBER - Month (1-12)

### Examples

**Example 1: Extract Month**
```
Formula: MONTH(JOINDATE)
Description: Get month from join date
```

**Example 2: December Bonus**
```
Formula: IF(MONTH(TODAY()) = 12, YEAR_END_BONUS, 0)
Description: Bonus in December
```

### Related Keywords
- `DAY()` - Extract day
- `YEAR()` - Extract year
- `TODAY()` - Current date

---

---
keyword: YEAR
aliases:
  - "YEAR()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: NUMBER
syntax: "YEAR(date)"
description: Extracts the year component from a date
module: PAYROLL
taxcountry: null
examples:
  - "YEAR(JOINDATE)"
  - "YEAR(TODAY()) - YEAR(JOINDATE)"
related_keywords:
  - "DAY"
  - "MONTH"
  - "TODAY"
---

## YEAR

### Description
The `YEAR()` function extracts the year from a date value.

### Syntax
```
YEAR(date)
```

### Parameters
- `date` - Date value to extract year from

### Return Value
NUMBER - Year (e.g., 2026)

### Examples

**Example 1: Extract Year**
```
Formula: YEAR(JOINDATE)
Description: Get year from join date
```

**Example 2: Years of Service**
```
Formula: YEAR(TODAY()) - YEAR(JOINDATE)
Description: Approximate years employed
```

### Related Keywords
- `DAY()` - Extract day
- `MONTH()` - Extract month
- `TODAY()` - Current date

---

---
keyword: DAYSINMONTH
aliases:
  - "DAYSINMONTH()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: NUMBER
syntax: "DAYSINMONTH(date)"
description: Returns the number of days in the month of the given date
module: PAYROLL
taxcountry: null
examples:
  - "SALARY / DAYSINMONTH(PAYDATE)"
  - "DAILY_RATE * DAYSINMONTH(TODAY())"
related_keywords:
  - "TODAY"
  - "TCD"
---

## DAYSINMONTH

### Description
The `DAYSINMONTH()` function returns the total number of days in the month of the specified date (28-31).

### Syntax
```
DAYSINMONTH(date)
```

### Parameters
- `date` - Date to get days in month for

### Return Value
NUMBER - Days in month (28-31)

### Examples

**Example 1: Daily Rate**
```
Formula: SALARY / DAYSINMONTH(PAYDATE)
Description: Calculate daily rate based on month length
```

**Example 2: Monthly Calculation**
```
Formula: DAILY_RATE * DAYSINMONTH(TODAY())
Description: Monthly amount from daily rate
```

### Related Keywords
- `TODAY()` - Current date
- `TCD` - Total calendar days

---

---
keyword: DAYOFWEEK
aliases:
  - "DAYOFWEEK()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: NUMBER
syntax: "DAYOFWEEK(date)"
description: Returns the day of week (1=Monday, 7=Sunday) ISO format
module: PAYROLL
taxcountry: null
examples:
  - "IF(DAYOFWEEK(TODAY()) >= 6, WEEKEND_RATE, WEEKDAY_RATE)"
related_keywords:
  - "TODAY"
---

## DAYOFWEEK

### Description
The `DAYOFWEEK()` function returns the day of the week as a number (1=Monday through 7=Sunday, ISO format).

### Syntax
```
DAYOFWEEK(date)
```

### Parameters
- `date` - Date to get day of week for

### Return Value
NUMBER - Day of week (1-7)

### Examples

**Example: Weekend Rate**
```
Formula: IF(DAYOFWEEK(TODAY()) >= 6, WEEKEND_RATE, WEEKDAY_RATE)
Description: Different rates for weekends (Sat/Sun = 6/7)
```

### Related Keywords
- `TODAY()` - Current date

---

---
keyword: HOUR
aliases:
  - "HOUR()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: NUMBER
syntax: "HOUR(datetime)"
description: Extracts the hour component from a datetime value
module: PAYROLL
taxcountry: null
examples:
  - "HOUR(DATETIME_NOW())"
related_keywords:
  - "MINUTE"
  - "SECOND"
  - "DATETIME_NOW"
---

## HOUR

### Description
The `HOUR()` function extracts the hour (0-23) from a datetime value.

### Syntax
```
HOUR(datetime)
```

### Parameters
- `datetime` - Datetime value to extract hour from

### Return Value
NUMBER - Hour (0-23)

### Examples

**Example: Extract Current Hour**
```
Formula: HOUR(DATETIME_NOW())
Description: Get current hour
```

### Related Keywords
- `MINUTE()` - Extract minute
- `SECOND()` - Extract second
- `DATETIME_NOW()` - Current datetime

---

---
keyword: MINUTE
aliases:
  - "MINUTE()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: NUMBER
syntax: "MINUTE(datetime)"
description: Extracts the minute component from a datetime value
module: PAYROLL
taxcountry: null
examples:
  - "MINUTE(DATETIME_NOW())"
related_keywords:
  - "HOUR"
  - "SECOND"
  - "DATETIME_NOW"
---

## MINUTE

### Description
The `MINUTE()` function extracts the minute (0-59) from a datetime value.

### Syntax
```
MINUTE(datetime)
```

### Parameters
- `datetime` - Datetime value to extract minute from

### Return Value
NUMBER - Minute (0-59)

### Examples

**Example: Extract Current Minute**
```
Formula: MINUTE(DATETIME_NOW())
Description: Get current minute
```

### Related Keywords
- `HOUR()` - Extract hour
- `SECOND()` - Extract second
- `DATETIME_NOW()` - Current datetime

---

---
keyword: SECOND
aliases:
  - "SECOND()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: NUMBER
syntax: "SECOND(datetime)"
description: Extracts the second component from a datetime value
module: PAYROLL
taxcountry: null
examples:
  - "SECOND(DATETIME_NOW())"
related_keywords:
  - "HOUR"
  - "MINUTE"
  - "DATETIME_NOW"
---

## SECOND

### Description
The `SECOND()` function extracts the second (0-59) from a datetime value.

### Syntax
```
SECOND(datetime)
```

### Parameters
- `datetime` - Datetime value to extract second from

### Return Value
NUMBER - Second (0-59)

### Examples

**Example: Extract Current Second**
```
Formula: SECOND(DATETIME_NOW())
Description: Get current second
```

### Related Keywords
- `HOUR()` - Extract hour
- `MINUTE()` - Extract minute
- `DATETIME_NOW()` - Current datetime

---

---
keyword: DATEDIFF
aliases:
  - "DATEDIFF()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: NUMBER
syntax: "DATEDIFF(unit, date1, date2)"
description: Calculates the difference between two dates in specified units
module: PAYROLL
taxcountry: null
examples:
  - "DATEDIFF('DAY', JOINDATE, TODAY())"
  - "DATEDIFF('YEAR', JOINDATE, ENDDATE)"
  - "DATEDIFF('MONTH', PERMANENTDATE, TODAY())"
  - "IF(DATEDIFF('DAY', JOINDATE, TODAY()) < 90, 0, ALLOWANCE)"
related_keywords:
  - "DATEADD"
  - "LENGTHOFSERVICE"
  - "TODAY"
---

## DATEDIFF

### Description
The `DATEDIFF()` function calculates the difference between two dates in the specified unit (YEAR, MONTH, DAY, HOUR, MINUTE, SECOND).

### Syntax
```
DATEDIFF(unit, date1, date2)
```

### Parameters
- `unit` - Unit of measurement: 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND'
- `date1` - Start date (earlier date)
- `date2` - End date (later date)

### Return Value
NUMBER - Difference between dates in specified unit

### Use Cases
- Calculate tenure/length of service
- Check probation period
- Calculate age
- Time-based eligibility

### Examples

**Example 1: Days Since Join**
```
Formula: DATEDIFF('DAY', JOINDATE, TODAY())
Description: Total days employed
```

**Example 2: Years of Service**
```
Formula: DATEDIFF('YEAR', JOINDATE, ENDDATE)
Description: Total years employed
```

**Example 3: Probation Check**
```
Formula: IF(DATEDIFF('DAY', JOINDATE, TODAY()) < 90, 0, ALLOWANCE)
Description: Allowance only after 90-day probation
```

**Example 4: Months Since Permanent**
```
Formula: DATEDIFF('MONTH', PERMANENTDATE, TODAY())
Description: Months since becoming permanent employee
```

### Related Keywords
- `DATEADD()` - Add to date
- `LENGTHOFSERVICE()` - Calculate service duration
- `TODAY()` - Current date

---

---
keyword: DATEADD
aliases:
  - "DATEADD()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: DATE
syntax: "DATEADD(unit, number, date)"
description: Adds a specified number of units to a date
module: PAYROLL
taxcountry: null
examples:
  - "DATEADD('MONTH', 1, TODAY())"
  - "DATEADD('DAY', 90, JOINDATE)"
  - "IF(TODAY() >= DATEADD('YEAR', 1, JOINDATE), ANNIVERSARY_BONUS, 0)"
related_keywords:
  - "DATEDIFF"
  - "TODAY"
---

## DATEADD

### Description
The `DATEADD()` function adds a specified number of time units to a date, returning the new date.

### Syntax
```
DATEADD(unit, number, date)
```

### Parameters
- `unit` - Unit to add: 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND'
- `number` - Number of units to add (can be negative to subtract)
- `date` - Starting date

### Return Value
DATE/DATETIME - New date after addition

### Use Cases
- Calculate future dates
- Add to join date
- Expiration calculations
- Deadline computations

### Examples

**Example 1: Next Month**
```
Formula: DATEADD('MONTH', 1, TODAY())
Description: Get date one month from now
```

**Example 2: Probation End Date**
```
Formula: DATEADD('DAY', 90, JOINDATE)
Description: Calculate probation end date (90 days after join)
```

**Example 3: Anniversary Check**
```
Formula: IF(TODAY() >= DATEADD('YEAR', 1, JOINDATE), ANNIVERSARY_BONUS, 0)
Description: Bonus on first anniversary
```

### Related Keywords
- `DATEDIFF()` - Calculate date difference
- `TODAY()` - Current date

---

---
keyword: LENGTHOFSERVICE
aliases:
  - "LENGTHOFSERVICE()"
  - "LOS Function"
category: DEFFORM
subcategory: Date/Time Functions
data_type: NUMBER
syntax: "LENGTHOFSERVICE(startDate, endDate, unit)"
description: Calculates length of service between two dates in years or months
module: PAYROLL
taxcountry: null
examples:
  - "LENGTHOFSERVICE(JOINDATE, TODAY(), 'y')"
  - "LENGTHOFSERVICE(JOINDATE, ENDDATE, 'm')"
  - "IF(LENGTHOFSERVICE(JOINDATE, TODAY(), 'm') >= 12, 10000, 10000/12 * LENGTHOFSERVICE(JOINDATE, TODAY(), 'm'))"
related_keywords:
  - "DATEDIFF"
  - "JOINDATE"
  - "ENDDATE"
  - "LENGTHOFSERVICE_YEAR"
  - "LENGTHOFSERVICE_MONTH"
---

## LENGTHOFSERVICE

### Description
The `LENGTHOFSERVICE()` function calculates the duration of service between two dates. The unit parameter determines whether to return years ('y') or months ('m').

### Syntax
```
LENGTHOFSERVICE(startDate, endDate, unit)
```

### Parameters
- `startDate` - Start date (typically JOINDATE)
- `endDate` - End date (typically TODAY() or ENDDATE)
- `unit` - Unit of measurement: 'y' for years, 'm' for months

### Return Value
NUMBER - Length of service in specified unit

### Use Cases
- Calculate years of service for bonuses
- Determine severance eligibility
- Service-based benefits
- Anniversary calculations

### Examples

**Example 1: Years of Service**
```
Formula: LENGTHOFSERVICE(JOINDATE, TODAY(), 'y')
Description: Calculate complete years employed
```

**Example 2: Months of Service**
```
Formula: LENGTHOFSERVICE(JOINDATE, ENDDATE, 'm')
Description: Total months employed (for terminated employees)
```

**Example 3: Prorated Severance**
```
Formula: IF(LENGTHOFSERVICE(JOINDATE, ENDDATE, 'm') >= 12, 10000, 10000/12 * LENGTHOFSERVICE(JOINDATE, ENDDATE, 'm'))
Description: Full severance if >= 12 months, otherwise prorated
```

**Example 4: Service Milestone Bonus**
```
Formula: LENGTHOFSERVICE(JOINDATE, TODAY(), 'y') * 1000
Description: 1000 bonus per year of service
```

### Related Keywords
- `DATEDIFF()` - Alternative date difference calculation
- `JOINDATE` - Join date field
- `ENDDATE` - End date field
- `LENGTHOFSERVICE_YEAR` - Pre-calculated years
- `LENGTHOFSERVICE_MONTH` - Pre-calculated months

---

---
keyword: CREATEDATE
aliases:
  - "CREATEDATE()"
category: DEFFORM
subcategory: Date/Time Functions
data_type: DATE
syntax: "CREATEDATE(month, day, year)"
description: Creates a date from month, day, and year components
module: PAYROLL
taxcountry: null
examples:
  - "CREATEDATE(1, 1, 2026)"
  - "DATEDIFF('DAY', JOINDATE, CREATEDATE(12, 31, YEAR(TODAY())))"
related_keywords:
  - "DAY"
  - "MONTH"
  - "YEAR"
  - "TODAY"
---

## CREATEDATE

### Description
The `CREATEDATE()` function constructs a date from separate month, day, and year components.

### Syntax
```
CREATEDATE(month, day, year)
```

### Parameters
- `month` - Month number (1-12)
- `day` - Day of month (1-31)
- `year` - Year (e.g., 2026)

### Return Value
DATE - Constructed date

### Examples

**Example 1: New Year's Day**
```
Formula: CREATEDATE(1, 1, 2026)
Description: Create January 1, 2026
```

**Example 2: Days Until Year End**
```
Formula: DATEDIFF('DAY', JOINDATE, CREATEDATE(12, 31, YEAR(TODAY())))
Description: Days from join date to end of current year
```

### Related Keywords
- `DAY()` - Extract day
- `MONTH()` - Extract month
- `YEAR()` - Extract year
- `TODAY()` - Current date

---

## Logic Functions

---
keyword: IF
aliases:
  - "IF()"
category: DEFFORM
subcategory: Logic Functions
data_type: DYNAMIC
syntax: "IF(condition, true_value, false_value)"
description: Returns true_value if condition is true, otherwise returns false_value
module: PAYROLL
taxcountry: null
examples:
  - "IF(SALARY > 10000, SALARY * 0.10, SALARY * 0.05)"
  - "IF(AWD >= TWD, 1000, 0)"
  - "IF(LENGTHOFSERVICE(JOINDATE, TODAY(), 'm') >= 12, FULL_BONUS, PRORATED_BONUS)"
related_keywords:
  - "AND"
  - "OR"
---

## IF

### Description
The `IF()` function evaluates a condition and returns one value if the condition is true, another value if false. This is the most commonly used function for conditional logic in formulas.

### Syntax
```
IF(condition, true_value, false_value)
```

### Parameters
- `condition` - Expression to evaluate (must result in true/false)
- `true_value` - Value to return if condition is true
- `false_value` - Value to return if condition is false

### Return Value
DYNAMIC - Returns true_value or false_value based on condition

### Use Cases
- Conditional bonuses
- Tiered calculations
- Status-based pay
- Progressive tax rates
- Eligibility checks

### Examples

**Example 1: Tiered Commission**
```
Formula: IF(SALARY > 10000, SALARY * 0.10, SALARY * 0.05)
Description: 10% commission if salary > 10000, otherwise 5%
```

**Example 2: Perfect Attendance Bonus**
```
Formula: IF(AWD >= TWD, 1000, 0)
Description: 1000 bonus if all days attended
```

**Example 3: Service-Based Bonus**
```
Formula: IF(LENGTHOFSERVICE(JOINDATE, TODAY(), 'm') >= 12, FULL_BONUS, PRORATED_BONUS)
Description: Full bonus after 12 months service
```

**Example 4: Nested IF (Multiple Conditions)**
```
Formula: IF(SALARY > 15000, SALARY * 0.15, IF(SALARY > 10000, SALARY * 0.10, SALARY * 0.05))
Description: Progressive rates: 15% if >15000, 10% if >10000, otherwise 5%
```

### Related Keywords
- `AND()` - Combine multiple conditions with AND logic
- `OR()` - Combine multiple conditions with OR logic

---

---
keyword: AND
aliases:
  - "AND()"
category: DEFFORM
subcategory: Logic Functions
data_type: BOOLEAN
syntax: "AND(condition1, condition2, ...)"
description: Returns true only if ALL conditions are true
module: PAYROLL
taxcountry: null
examples:
  - "AND(AWD >= TWD, TARDINESS = 0)"
  - "IF(AND(SALARY > 5000, LENGTHOFSERVICE_YEAR >= 1), BONUS, 0)"
  - "AND(JOBSTATUS='Active', EMPLOYMENTSTATUS='Full-Time')"
related_keywords:
  - "IF"
  - "OR"
---

## AND

### Description
The `AND()` function returns true only if ALL conditions evaluate to true. Useful for checking multiple requirements simultaneously.

### Syntax
```
AND(condition1, condition2, ...)
```

### Parameters
- `condition1, condition2, ...` - Two or more conditions to evaluate

### Return Value
BOOLEAN - True if all conditions are true, false otherwise

### Use Cases
- Perfect attendance (all days + no tardiness)
- Multi-criteria eligibility
- Combined status checks
- Complex conditional logic

### Examples

**Example 1: Perfect Attendance with Punctuality**
```
Formula: IF(AND(AWD >= TWD, TARDINESS = 0), 1000, 0)
Description: Bonus requires both full attendance AND no tardiness
```

**Example 2: Multi-Criteria Bonus**
```
Formula: IF(AND(SALARY > 5000, LENGTHOFSERVICE_YEAR >= 1), BONUS, 0)
Description: Bonus only if salary > 5000 AND service >= 1 year
```

**Example 3: Employment Status Check**
```
Formula: IF(AND(JOBSTATUS='Active', EMPLOYMENTSTATUS='Full-Time'), FULL_BENEFITS, PART_BENEFITS)
Description: Full benefits only for active full-time employees
```

### Related Keywords
- `IF()` - Conditional logic
- `OR()` - Alternative logic (any condition true)

---

---
keyword: OR
aliases:
  - "OR()"
category: DEFFORM
subcategory: Logic Functions
data_type: BOOLEAN
syntax: "OR(condition1, condition2, ...)"
description: Returns true if ANY condition is true
module: PAYROLL
taxcountry: null
examples:
  - "OR(GRADE='A', GRADE='B')"
  - "IF(OR(JOBSTATUS='Probation', JOBSTATUS='Contract'), REDUCED_BENEFITS, FULL_BENEFITS)"
related_keywords:
  - "IF"
  - "AND"
---

## OR

### Description
The `OR()` function returns true if ANY of the conditions evaluate to true. Useful for checking alternative criteria.

### Syntax
```
OR(condition1, condition2, ...)
```

### Parameters
- `condition1, condition2, ...` - Two or more conditions to evaluate

### Return Value
BOOLEAN - True if any condition is true, false if all are false

### Use Cases
- Alternative eligibility criteria
- Multiple status checks
- Category grouping
- Exception handling

### Examples

**Example 1: Grade-Based Allowance**
```
Formula: IF(OR(GRADE='A', GRADE='B'), PREMIUM_ALLOWANCE, STANDARD_ALLOWANCE)
Description: Premium allowance for grades A or B
```

**Example 2: Non-Permanent Status**
```
Formula: IF(OR(JOBSTATUS='Probation', JOBSTATUS='Contract'), REDUCED_BENEFITS, FULL_BENEFITS)
Description: Reduced benefits for probation or contract employees
```

**Example 3: Department Qualification**
```
Formula: IF(OR(DEPTNAME='Sales', DEPTNAME='Marketing'), COMMISSION_ELIGIBLE, 0)
Description: Commission for sales or marketing departments
```

### Related Keywords
- `IF()` - Conditional logic
- `AND()` - Combined logic (all conditions true)

---

## Math Functions

---
keyword: SUM
aliases:
  - "SUM()"
category: DEFFORM
subcategory: Math Functions
data_type: NUMBER
syntax: "SUM(value1, value2, ...)"
description: Returns the sum of all values
module: PAYROLL
taxcountry: null
examples:
  - "SUM(SALARY, ALLOWANCE, BONUS)"
  - "SUM(@SALARY, @BONUS, @COMMISSION)"
related_keywords:
  - "COUNT"
  - "ROUND"
---

## SUM

### Description
The `SUM()` function adds all provided values and returns the total.

### Syntax
```
SUM(value1, value2, ...)
```

### Parameters
- `value1, value2, ...` - Values to sum (numbers or component codes)

### Return Value
NUMBER - Sum of all values

### Examples

**Example 1: Total Income**
```
Formula: SUM(SALARY, ALLOWANCE, BONUS)
Description: Calculate total income from multiple components
```

**Example 2: Cross-Component Sum**
```
Formula: SUM(@SALARY, @BONUS, @COMMISSION)
Description: Sum values from other components
```

### Related Keywords
- `COUNT()` - Count values
- `ROUND()` - Round result

---

---
keyword: COUNT
aliases:
  - "COUNT()"
category: DEFFORM
subcategory: Math Functions
data_type: NUMBER
syntax: "COUNT(value1, value2, ...)"
description: Returns the count of values
module: PAYROLL
taxcountry: null
examples:
  - "COUNT(SALARY, BONUS, ALLOWANCE)"
related_keywords:
  - "SUM"
---

## COUNT

### Description
The `COUNT()` function returns the number of values provided.

### Syntax
```
COUNT(value1, value2, ...)
```

### Parameters
- `value1, value2, ...` - Values to count

### Return Value
NUMBER - Count of values

### Examples

**Example: Count Components**
```
Formula: COUNT(SALARY, BONUS, ALLOWANCE)
Description: Count number of components
```

### Related Keywords
- `SUM()` - Sum values

---

---
keyword: MIN
aliases:
  - "MIN()"
category: DEFFORM
subcategory: Math Functions
data_type: NUMBER
syntax: "MIN(value1, value2, ...)"
description: Returns the minimum value
module: PAYROLL
taxcountry: null
examples:
  - "MIN(SALARY, 10000)"
  - "MIN(CALCULATED_TAX, TAX_CAP)"
related_keywords:
  - "MAX"
---

## MIN

### Description
The `MIN()` function returns the smallest value among the provided values.

### Syntax
```
MIN(value1, value2, ...)
```

### Parameters
- `value1, value2, ...` - Values to compare

### Return Value
NUMBER - Minimum value

### Examples

**Example 1: Salary Cap**
```
Formula: MIN(SALARY, 10000)
Description: Cap salary at 10000 maximum
```

**Example 2: Tax Cap**
```
Formula: MIN(CALCULATED_TAX, TAX_CAP)
Description: Limit tax to cap amount
```

### Related Keywords
- `MAX()` - Maximum value

---

---
keyword: MAX
aliases:
  - "MAX()"
category: DEFFORM
subcategory: Math Functions
data_type: NUMBER
syntax: "MAX(value1, value2, ...)"
description: Returns the maximum value
module: PAYROLL
taxcountry: null
examples:
  - "MAX(SALARY, 5000)"
  - "MAX(CALCULATED_AMOUNT, MINIMUM_AMOUNT)"
related_keywords:
  - "MIN"
---

## MAX

### Description
The `MAX()` function returns the largest value among the provided values.

### Syntax
```
MAX(value1, value2, ...)
```

### Parameters
- `value1, value2, ...` - Values to compare

### Return Value
NUMBER - Maximum value

### Examples

**Example 1: Minimum Salary**
```
Formula: MAX(SALARY, 5000)
Description: Ensure salary is at least 5000
```

**Example 2: Minimum Payment**
```
Formula: MAX(CALCULATED_AMOUNT, MINIMUM_AMOUNT)
Description: Ensure minimum payment amount
```

### Related Keywords
- `MIN()` - Minimum value

---

---
keyword: ROUND
aliases:
  - "ROUND()"
category: DEFFORM
subcategory: Math Functions
data_type: NUMBER
syntax: "ROUND(number, decimals)"
description: Rounds a number to specified decimal places
module: PAYROLL
taxcountry: null
examples:
  - "ROUND(SALARY * 0.12, 2)"
  - "ROUND(TAX_AMOUNT, 0)"
related_keywords:
  - "SUM"
  - "ABS"
---

## ROUND

### Description
The `ROUND()` function rounds a number to the specified number of decimal places.

### Syntax
```
ROUND(number, decimals)
```

### Parameters
- `number` - Number to round
- `decimals` - Number of decimal places (0 for whole number)

### Return Value
NUMBER - Rounded number

### Examples

**Example 1: Round to 2 Decimals**
```
Formula: ROUND(SALARY * 0.12, 2)
Description: Calculate 12% and round to 2 decimal places
```

**Example 2: Round to Whole Number**
```
Formula: ROUND(TAX_AMOUNT, 0)
Description: Round tax to nearest whole number
```

### Related Keywords
- `SUM()` - Sum values
- `ABS()` - Absolute value

---

---
keyword: ABS
aliases:
  - "ABS()"
  - "Absolute Value"
category: DEFFORM
subcategory: Math Functions
data_type: NUMBER
syntax: "ABS(number)"
description: Returns the absolute (positive) value of a number
module: PAYROLL
taxcountry: null
examples:
  - "ABS(DEDUCTION)"
  - "ABS(SALARY - TARGET_SALARY)"
related_keywords:
  - "ROUND"
---

## ABS

### Description
The `ABS()` function returns the absolute value of a number (removes negative sign).

### Syntax
```
ABS(number)
```

### Parameters
- `number` - Number to get absolute value of

### Return Value
NUMBER - Absolute (positive) value

### Examples

**Example 1: Positive Deduction**
```
Formula: ABS(DEDUCTION)
Description: Ensure deduction is positive
```

**Example 2: Salary Variance**
```
Formula: ABS(SALARY - TARGET_SALARY)
Description: Calculate absolute difference from target
```

### Related Keywords
- `ROUND()` - Round numbers

---

---
keyword: ISNUMERIC
aliases:
  - "ISNUMERIC()"
category: DEFFORM
subcategory: Math Functions
data_type: BOOLEAN
syntax: "ISNUMERIC(value)"
description: Checks if a value is numeric
module: PAYROLL
taxcountry: null
examples:
  - "IF(ISNUMERIC(SALARY), SALARY * 0.10, 0)"
related_keywords:
  - "ISDATE"
---

## ISNUMERIC

### Description
The `ISNUMERIC()` function checks if a value is a valid number.

### Syntax
```
ISNUMERIC(value)
```

### Parameters
- `value` - Value to check

### Return Value
BOOLEAN - True if numeric, false otherwise

### Examples

**Example: Validate Before Calculation**
```
Formula: IF(ISNUMERIC(SALARY), SALARY * 0.10, 0)
Description: Only calculate if salary is numeric
```

### Related Keywords
- `ISDATE()` - Check if date

---

## String Functions

---
keyword: CONCATENATE
aliases:
  - "CONCATENATE()"
category: DEFFORM
subcategory: String Functions
data_type: STRING
syntax: "CONCATENATE(string1, string2, ...)"
description: Joins multiple strings into one
module: PAYROLL
taxcountry: null
examples:
  - "CONCATENATE('EMP-', EMPNO)"
  - "CONCATENATE(POSITIONNAME, ' - ', DEPTNAME)"
related_keywords:
  - "CONCATENATESKIPNULL"
---

## CONCATENATE

### Description
The `CONCATENATE()` function joins multiple string values into a single string.

### Syntax
```
CONCATENATE(string1, string2, ...)
```

### Parameters
- `string1, string2, ...` - Strings to join

### Return Value
STRING - Combined string

### Examples

**Example 1: Employee Reference**
```
Formula: CONCATENATE('EMP-', EMPNO)
Description: Create formatted employee reference (e.g., "EMP-12345")
```

**Example 2: Position and Department**
```
Formula: CONCATENATE(POSITIONNAME, ' - ', DEPTNAME)
Description: Combine position and department (e.g., "Manager - Sales")
```

### Related Keywords
- `CONCATENATESKIPNULL()` - Join non-empty strings

---

---
keyword: CONCATENATESKIPNULL
aliases:
  - "CONCATENATESKIPNULL()"
category: DEFFORM
subcategory: String Functions
data_type: STRING
syntax: "CONCATENATESKIPNULL(string1, string2, ...)"
description: Joins multiple strings, skipping null or empty values
module: PAYROLL
taxcountry: null
examples:
  - "CONCATENATESKIPNULL(EMPNO, POSITIONNAME, DEPTNAME)"
related_keywords:
  - "CONCATENATE"
---

## CONCATENATESKIPNULL

### Description
The `CONCATENATESKIPNULL()` function joins strings but skips null or empty values.

### Syntax
```
CONCATENATESKIPNULL(string1, string2, ...)
```

### Parameters
- `string1, string2, ...` - Strings to join (nulls/empties skipped)

### Return Value
STRING - Combined string (without nulls)

### Examples

**Example: Join Non-Empty Fields**
```
Formula: CONCATENATESKIPNULL(EMPNO, POSITIONNAME, DEPTNAME)
Description: Join fields, skipping any that are empty
```

### Related Keywords
- `CONCATENATE()` - Join all strings

---

---
keyword: FINDLIST
aliases:
  - "FINDLIST()"
category: DEFFORM
subcategory: String Functions
data_type: BOOLEAN
syntax: "FINDLIST(list, value)"
description: Checks if a value exists in a comma-separated list
module: PAYROLL
taxcountry: null
examples:
  - "IF(FINDLIST('A,B,C', GRADE), PREMIUM_RATE, STANDARD_RATE)"
  - "FINDLIST('Sales,Marketing,Support', DEPTNAME)"
related_keywords:
  - "IF"
---

## FINDLIST

### Description
The `FINDLIST()` function checks if a value exists in a comma-separated list string.

### Syntax
```
FINDLIST(list, value)
```

### Parameters
- `list` - Comma-separated list as string (e.g., "A,B,C")
- `value` - Value to search for

### Return Value
BOOLEAN - True if value found in list, false otherwise

### Examples

**Example 1: Grade List Check**
```
Formula: IF(FINDLIST('A,B,C', GRADE), PREMIUM_RATE, STANDARD_RATE)
Description: Premium rate for grades A, B, or C
```

**Example 2: Department List**
```
Formula: IF(FINDLIST('Sales,Marketing,Support', DEPTNAME), CUSTOMER_FACING_BONUS, 0)
Description: Bonus for customer-facing departments
```

### Related Keywords
- `IF()` - Conditional logic

---

# Component Codes (Dynamic)


# Pay Variables

---
keyword: "PAY_VARIABLES"
aliases:
  - "PAYVAR Codes"
  - "Custom Variables"
category: PAYVAR
subcategory: Pay Variables
data_type: DYNAMIC
syntax: "PAYVAR_CODE"
description: User-defined pay variables from tpympayvariable table, custom per company
module: PAYROLL
taxcountry: null
examples:
  - "PAYVAR_CUSTOM_RATE"
  - "PAYVAR_DAILY_RATE"
  - "PAYVAR_COMPANY_MULTIPLIER"
related_keywords:
  - "COMPONENT_CODES"
---

## PAY_VARIABLES (PAYVAR Codes)

### Description
Pay Variables are user-defined variables stored in the `tpympayvariable` table. These are custom variables that can hold values specific to the company's payroll configuration.

### How It Works
1. **Creation**: User creates a pay variable in the system (e.g., "PAYVAR_DAILY_RATE")
2. **Auto-Sync**: System automatically adds the variable to `tsfmreserveword` table with category `PAYVAR`
3. **Formula Usage**: Variable can be used in formulas with its defined value

### Syntax
```
PAYVAR_CODE
```

### Common Use Cases
- Custom rate multipliers
- Company-specific constants
- Configurable thresholds
- Dynamic calculation factors

### Examples

**Example 1: Custom Rate**
```
Formula: SALARY * PAYVAR_COMPANY_MULTIPLIER
Description: Apply company-specific multiplier to salary
```

**Example 2: Daily Rate Variable**
```
Formula: AWD * PAYVAR_DAILY_RATE
Description: Calculate pay using configured daily rate
```

### Important Notes
- Pay variables are **company-specific** (each company defines their own)
- Values can be **updated without changing formulas**
- Variables are **centrally managed** in pay variable master
- Useful for **configurable calculations**

### Related Keywords
- `COMPONENT_CODES` - User-defined component codes

---

# Reference Information

## Database Table: tsfmreserveword

All formula keywords are stored in the `tsfmreserveword` table with the following structure:

| Column | Type | Description |
|--------|------|-------------|
| word | STRING | Keyword name (Primary Key) |
| company_id | NUMBER | 1 = global, otherwise company-specific (Primary Key) |
| description | STRING | Human-readable description |
| data_type | STRING | Data type (STRING, NUMBER, DATE, etc.) |
| module | STRING | PAYROLL or GENERAL |
| category | STRING | PAYFORM, ATTSTATUS, EMPFORM, DEFFORM, etc. |
| subcategory | STRING | Further categorization |
| taxcountry | STRING | Country filter (null = global) |
| remark | STRING | Additional notes (e.g., "v2") |

## Reserve Word Categories

- **PAYCOMP** - Payroll components (user-defined)
- **PAYVAR** - Payroll variables (user-defined)
- **PAYFORM** - Payroll formulas (BASE, YTD_*, PRORATE*_*)
- **EMPFORM** - Employee data (JOINDATE, LENGTHOFSERVICE_*, etc.)
- **ATTSTATUS** - Attendance status (ACD, AWD, TCD, TWD, etc.)
- **ATTINTF** - Attendance interface (OT_*, LEAVE_*, etc.)
- **DEFFORM** - Built-in functions (IF, SUM, DATEDIFF, etc.)
- **CLAIMFORM** - Claim formulas (from trmmreimtype)
- **EMPDATA** - Employee personal data (EMPNO, EMPGENDER, etc.)
- **COMPCODE** - Component codes (auto-synced from tpympayallowdeduct)

## Global Reserve Word Reference

For a complete list of all reserve words with descriptions, refer to:
**"Global Reserve Word - Initial Sample Updated.xlsx"**
Located in: `C:\Users\Gdhr-User.LAPNBC000327\Downloads\Telegram Desktop\`

This Excel file contains the comprehensive reserve word table showing all available keywords, their categories, descriptions, and usage guidelines.

## Service Methods

- **getRevWord()** in [settingcomponent.service.ts](d:\Projects\payroll-serverDi\src\services\v2pay\all\setting\settingcomponent.service.ts)
  - Retrieves all valid formula keywords
  - Filters by company and tax country
  - Returns categorized keyword lists

- **formulaParse()** in [formula.parser.helper.ts](d:\Projects\payroll-serverDi\src\helpers\formula.parser.helper.ts)
  - Executes parsed formulas using hot-formula-parser
  - Returns calculated result or 0 for null

- **startFormulaProcess()** in [formula.process.non.queue.ts](d:\Projects\payroll-serverDi\src\services\payroll.process.formula\payroll.process.non.queue\formula.process.non.queue.ts)
  - Main formula processing orchestrator
  - Handles multi-phase processing
  - Manages component dependencies

## Country-Specific Support

The formula system supports country-specific variations for:
- Indonesia (ID)
- Malaysia (MY)
- Thailand (TH)
- Philippines (PH)
- Vietnam (VN)

Reserve words can be filtered by `taxcountry` field for localized formulas.

---

**End of Keywords Reference**

For practical examples, see [examples.md](./examples.md)

For technical documentation, see [reference.md](./reference.md)
