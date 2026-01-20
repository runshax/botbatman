# GreatDay Payroll Formula Examples

This document provides practical, real-world examples of payroll formulas organized by category and difficulty level. Each example includes YAML frontmatter for bot parsing and detailed explanations for human readers.

---

## Table of Contents
1. [Basic Calculations](#basic-calculations)
2. [Conditional Logic](#conditional-logic)
3. [Cross-Component References](#cross-component-references)
4. [Proration](#proration)
5. [Attendance-Based](#attendance-based)
6. [Date/Time Calculations](#date-time-calculations)
7. [Complex Multi-Component](#complex-multi-component)

---

# Basic Calculations

---
example_id: EX001
title: Simple Percentage Calculation
category: Basic Calculation
difficulty: Beginner
keywords_used:
  - BASE
components:
  - BONUS
use_cases:
  - Percentage-based allowances
  - Commission calculations
  - Standard bonuses
---

## Example 1: Simple Percentage Calculation

### Scenario
Calculate a bonus that is 5% of the component's base value.

### Formula
```
BASE * 0.05
```

### Component Configuration
- **Component**: BONUS
- **Type**: Allowance
- **Formula**: `BASE * 0.05`

### Calculation Steps
1. Component "BONUS" has BASE value = 10000
2. Formula: `BASE * 0.05`
3. After BASE replacement: `BONUS * 0.05`
4. After value replacement: `10000 * 0.05`
5. **Result**: 500

### When to Use
- Simple percentage-based allowances
- Commission calculations
- Standard deductions as percentage of base
- Proportional bonuses

### Variations
- **10% Bonus**: `BASE * 0.10`
- **Rounded**: `ROUND(BASE * 0.05, 2)`
- **With Minimum**: `MAX(BASE * 0.05, 100)`

---

---
example_id: EX002
title: Fixed Amount Allowance
category: Basic Calculation
difficulty: Beginner
keywords_used: []
components:
  - TRANSPORT_ALLOWANCE
use_cases:
  - Fixed allowances
  - Standard benefits
  - Flat-rate payments
---

## Example 2: Fixed Amount Allowance

### Scenario
Provide a fixed transport allowance of 500 to all employees.

### Formula
```
500
```

### Component Configuration
- **Component**: TRANSPORT_ALLOWANCE
- **Type**: Allowance
- **Formula**: `500`

### Calculation Steps
1. Formula evaluates to fixed value
2. **Result**: 500 (for all employees)

### When to Use
- Fixed monthly allowances
- Standard benefits
- Uniform payments
- Flat-rate deductions

### Variations
- **Different Amount**: `1000`
- **Multiple Fixed Values**: `500 + 300` (= 800)

---

---
example_id: EX003
title: Addition of Multiple Components
category: Basic Calculation
difficulty: Beginner
keywords_used:
  - SUM
components:
  - TOTAL_INCOME
  - SALARY
  - ALLOWANCE
use_cases:
  - Total income calculation
  - Combining components
  - Gross income
---

## Example 3: Addition of Multiple Components

### Scenario
Calculate total income by adding salary and allowances.

### Formula
```
SALARY + ALLOWANCE + BONUS
```

### Alternative using SUM
```
SUM(SALARY, ALLOWANCE, BONUS)
```

### Component Configuration
- **Component**: TOTAL_INCOME
- **Type**: Neutral
- **Formula**: `SUM(SALARY, ALLOWANCE, BONUS)`

### Calculation Steps
1. SALARY value = 10000
2. ALLOWANCE value = 2000
3. BONUS value = 1000
4. Formula: `SUM(10000, 2000, 1000)`
5. **Result**: 13000

### When to Use
- Calculate gross income
- Sum multiple allowances
- Total deductions
- Aggregate values

### Variations
- **Subtraction**: `SALARY - DEDUCTION`
- **Mixed Operations**: `SALARY + ALLOWANCE - TAX`

---

---
example_id: EX004
title: Rounded Calculation
category: Basic Calculation
difficulty: Beginner
keywords_used:
  - BASE
  - ROUND
components:
  - TAX_ALLOWANCE
use_cases:
  - Tax calculations
  - Rounded results
  - Currency precision
---

## Example 4: Rounded Calculation

### Scenario
Calculate 12% of salary and round to 2 decimal places.

### Formula
```
ROUND(BASE * 0.12, 2)
```

### Component Configuration
- **Component**: TAX_ALLOWANCE
- **Type**: Allowance
- **Formula**: `ROUND(BASE * 0.12, 2)`

### Calculation Steps
1. BASE value = 8333.33
2. Calculation: `8333.33 * 0.12 = 999.9996`
3. Rounding: `ROUND(999.9996, 2)`
4. **Result**: 1000.00

### When to Use
- Tax calculations requiring precision
- Currency amounts (2 decimals)
- Avoiding floating-point errors
- Clean financial reporting

### Variations
- **Round to Whole Number**: `ROUND(BASE * 0.12, 0)`
- **Round Multiple Calculations**: `ROUND(SALARY * 0.05, 2) + ROUND(BONUS * 0.10, 2)`

---

# Conditional Logic

---
example_id: EX005
title: Simple Conditional Bonus
category: Conditional Logic
difficulty: Intermediate
keywords_used:
  - IF
  - BASE
components:
  - PERFORMANCE_BONUS
use_cases:
  - Performance-based bonuses
  - Tiered calculations
  - Conditional payments
---

## Example 5: Simple Conditional Bonus

### Scenario
Give 10% bonus if salary exceeds 10000, otherwise 5%.

### Formula
```
IF(BASE > 10000, BASE * 0.10, BASE * 0.05)
```

### Component Configuration
- **Component**: PERFORMANCE_BONUS
- **Type**: Allowance
- **Formula**: `IF(BASE > 10000, BASE * 0.10, BASE * 0.05)`

### Calculation Steps

**Case 1: High Salary**
1. BASE value = 12000
2. Condition: `12000 > 10000` = TRUE
3. Returns: `12000 * 0.10`
4. **Result**: 1200

**Case 2: Standard Salary**
1. BASE value = 8000
2. Condition: `8000 > 10000` = FALSE
3. Returns: `8000 * 0.05`
4. **Result**: 400

### When to Use
- Performance-based pay
- Tiered bonus structures
- Conditional allowances
- Progressive calculations

### Variations
- **Three Tiers (Nested IF)**:
  ```
  IF(BASE > 15000, BASE * 0.15, IF(BASE > 10000, BASE * 0.10, BASE * 0.05))
  ```
- **Different Conditions**: `IF(GRADE='A', BASE * 0.20, BASE * 0.10)`

---

---
example_id: EX006
title: Conditional Severance Pay
category: Conditional Logic
difficulty: Intermediate
keywords_used:
  - IF
  - LENGTHOFSERVICE
  - JOINDATE
  - ENDDATE
components:
  - SEVERANCE
use_cases:
  - Severance calculations
  - Employment duration based pay
  - Termination benefits
---

## Example 6: Conditional Severance Pay

### Scenario
Pay full severance (10000) if service >= 12 months, otherwise prorated by months worked.

### Formula
```
IF(LENGTHOFSERVICE(JOINDATE, ENDDATE, 'm') >= 12, 10000, 10000/12 * LENGTHOFSERVICE(JOINDATE, ENDDATE, 'm'))
```

### Component Configuration
- **Component**: SEVERANCE
- **Type**: Allowance
- **Formula**: See above

### Calculation Steps

**Case 1: Service >= 12 months**
1. JOINDATE = 2024-01-01
2. ENDDATE = 2026-01-15
3. Service months = 24
4. Condition: `24 >= 12` = TRUE
5. **Result**: 10000

**Case 2: Service < 12 months**
1. JOINDATE = 2025-05-01
2. ENDDATE = 2026-01-15
3. Service months = 8
4. Condition: `8 >= 12` = FALSE
5. Calculation: `10000/12 * 8 = 6666.67`
6. **Result**: 6666.67

### When to Use
- Severance pay calculations
- Service-based benefits
- Prorated termination pay
- Employment duration bonuses

### Variations
- **Different Threshold**: `IF(LENGTHOFSERVICE(..., 'm') >= 6, ...)`
- **Multiple Tiers**: Nested IFs for different service brackets

---

---
example_id: EX007
title: Perfect Attendance Bonus
category: Conditional Logic
difficulty: Intermediate
keywords_used:
  - IF
  - AND
  - AWD
  - TWD
  - TARDINESS
components:
  - PERFECT_ATTENDANCE_BONUS
use_cases:
  - Attendance incentives
  - Punctuality bonuses
  - Multi-criteria rewards
---

## Example 7: Perfect Attendance Bonus

### Scenario
Award 1000 bonus if employee attended all working days AND had zero tardiness.

### Formula
```
IF(AND(AWD >= TWD, TARDINESS = 0), 1000, 0)
```

### Component Configuration
- **Component**: PERFECT_ATTENDANCE_BONUS
- **Type**: Allowance
- **Formula**: `IF(AND(AWD >= TWD, TARDINESS = 0), 1000, 0)`

### Calculation Steps

**Case 1: Perfect Attendance**
1. AWD = 22 (days worked)
2. TWD = 22 (total working days)
3. TARDINESS = 0
4. Condition 1: `22 >= 22` = TRUE
5. Condition 2: `0 = 0` = TRUE
6. AND result: TRUE
7. **Result**: 1000

**Case 2: Tardy Once**
1. AWD = 22
2. TWD = 22
3. TARDINESS = 15 (minutes)
4. Condition 1: TRUE
5. Condition 2: FALSE
6. AND result: FALSE
7. **Result**: 0

### When to Use
- Perfect attendance rewards
- Multi-criteria bonuses
- Compliance incentives
- Behavioral rewards

### Variations
- **Allow Minimal Tardiness**: `IF(AND(AWD >= TWD, TARDINESS <= 5), 1000, 500)`
- **Include Undertime**: `IF(AND(AWD >= TWD, TARDINESS = 0, UNDERTIME = 0), ...)`

---

---
example_id: EX008
title: Probation Period Allowance
category: Conditional Logic
difficulty: Intermediate
keywords_used:
  - IF
  - DATEDIFF
  - JOINDATE
  - TODAY
components:
  - PROBATION_ALLOWANCE
use_cases:
  - Probation period logic
  - Time-based eligibility
  - New employee benefits
---

## Example 8: Probation Period Allowance

### Scenario
Provide allowance only after 90-day probation period is complete.

### Formula
```
IF(DATEDIFF('DAY', JOINDATE, TODAY()) >= 90, 500, 0)
```

### Component Configuration
- **Component**: PROBATION_ALLOWANCE
- **Type**: Allowance
- **Formula**: `IF(DATEDIFF('DAY', JOINDATE, TODAY()) >= 90, 500, 0)`

### Calculation Steps

**Case 1: After Probation**
1. JOINDATE = 2025-10-01
2. TODAY() = 2026-01-20
3. Days: `DATEDIFF('DAY', '2025-10-01', '2026-01-20') = 111`
4. Condition: `111 >= 90` = TRUE
5. **Result**: 500

**Case 2: During Probation**
1. JOINDATE = 2025-12-01
2. TODAY() = 2026-01-20
3. Days: `DATEDIFF('DAY', '2025-12-01', '2026-01-20') = 50`
4. Condition: `50 >= 90` = FALSE
5. **Result**: 0

### When to Use
- Probation-based benefits
- Time-based eligibility
- Trial period allowances
- New hire restrictions

### Variations
- **After Permanent Status**: `IF(TODAY() >= PERMANENTDATE, 500, 0)`
- **Months Instead of Days**: `IF(DATEDIFF('MONTH', JOINDATE, TODAY()) >= 3, ...)`

---

---
example_id: EX009
title: Progressive Tax Rate
category: Conditional Logic
difficulty: Advanced
keywords_used:
  - IF
  - BASE
components:
  - INCOME_TAX
use_cases:
  - Progressive tax systems
  - Tiered calculations
  - Bracket-based rates
---

## Example 9: Progressive Tax Rate

### Scenario
Apply progressive tax: 5% for income up to 5000, 10% for 5001-10000, 15% for above 10000.

### Formula (Nested IF)
```
IF(BASE <= 5000, BASE * 0.05, IF(BASE <= 10000, BASE * 0.10, BASE * 0.15))
```

### Alternative (Bracket Calculation)
```
IF(BASE <= 5000,
   BASE * 0.05,
   IF(BASE <= 10000,
      5000 * 0.05 + (BASE - 5000) * 0.10,
      5000 * 0.05 + 5000 * 0.10 + (BASE - 10000) * 0.15
   )
)
```

### Component Configuration
- **Component**: INCOME_TAX
- **Type**: Deduction
- **Formula**: See above (use appropriate version)

### Calculation Steps

**Case 1: Low Income (4000)**
1. BASE = 4000
2. Condition: `4000 <= 5000` = TRUE
3. Calculation: `4000 * 0.05`
4. **Result**: 200

**Case 2: Mid Income (8000)**
1. BASE = 8000
2. First condition: `8000 <= 5000` = FALSE
3. Second condition: `8000 <= 10000` = TRUE
4. Calculation: `8000 * 0.10`
5. **Result**: 800

**Case 3: High Income (15000)**
1. BASE = 15000
2. First condition: FALSE
3. Second condition: FALSE
4. Calculation: `15000 * 0.15`
5. **Result**: 2250

### When to Use
- Progressive tax calculations
- Tiered commission structures
- Bracket-based fees
- Graduated benefit systems

---

---
example_id: EX010
title: Status-Based Allowance
category: Conditional Logic
difficulty: Intermediate
keywords_used:
  - IF
  - OR
  - JOBSTATUS
components:
  - STATUS_ALLOWANCE
use_cases:
  - Employment status benefits
  - Conditional allowances by status
  - Multiple status groups
---

## Example 10: Status-Based Allowance

### Scenario
Provide reduced allowance (300) for probation or contract employees, full allowance (500) for permanent.

### Formula
```
IF(OR(JOBSTATUS='Probation', JOBSTATUS='Contract'), 300, 500)
```

### Component Configuration
- **Component**: STATUS_ALLOWANCE
- **Type**: Allowance
- **Formula**: `IF(OR(JOBSTATUS='Probation', JOBSTATUS='Contract'), 300, 500)`

### Calculation Steps

**Case 1: Probation Employee**
1. JOBSTATUS = 'Probation'
2. Condition 1: `'Probation' = 'Probation'` = TRUE
3. OR result: TRUE
4. **Result**: 300

**Case 2: Permanent Employee**
1. JOBSTATUS = 'Active'
2. Condition 1: `'Active' = 'Probation'` = FALSE
3. Condition 2: `'Active' = 'Contract'` = FALSE
4. OR result: FALSE
5. **Result**: 500

### When to Use
- Status-based benefits
- Multiple status group differentiation
- Non-permanent employee handling
- Tiered allowances by employment type

### Variations
- **Three Tiers**:
  ```
  IF(JOBSTATUS='Probation', 200, IF(JOBSTATUS='Contract', 300, 500))
  ```
- **Department & Status**:
  ```
  IF(AND(DEPTNAME='Sales', JOBSTATUS='Active'), 1000, 500)
  ```

---

# Cross-Component References

---
example_id: EX011
title: Tax on Multiple Income Sources
category: Cross-Component Reference
difficulty: Intermediate
keywords_used:
  - "@COMPONENT_CODE"
  - "@SALARY"
  - "@BONUS"
  - "@ALLOWANCE"
components:
  - INCOME_TAX
  - SALARY
  - BONUS
  - ALLOWANCE
use_cases:
  - Tax calculations
  - Multiple income aggregation
  - Cross-component summation
---

## Example 11: Tax on Multiple Income Sources

### Scenario
Calculate 10% tax on total taxable income (salary + bonus + allowance).

### Formula
```
(@SALARY + @BONUS + @ALLOWANCE) * 0.10
```

### Component Configuration
- **Component**: INCOME_TAX
- **Type**: Deduction
- **Process Order**: 10 (must be after SALARY, BONUS, ALLOWANCE)
- **Formula**: `(@SALARY + @BONUS + @ALLOWANCE) * 0.10`

**Dependencies:**
- **SALARY** (Process Order: 1)
- **BONUS** (Process Order: 2)
- **ALLOWANCE** (Process Order: 3)

### Calculation Steps
1. SALARY component calculated first = 10000
2. BONUS component calculated = 2000
3. ALLOWANCE component calculated = 1500
4. INCOME_TAX formula: `(@SALARY + @BONUS + @ALLOWANCE) * 0.10`
5. After @ replacement: `(10000 + 2000 + 1500) * 0.10`
6. Calculation: `13500 * 0.10`
7. **Result**: 1350

### When to Use
- Tax calculations based on total income
- Deductions based on multiple income sources
- Aggregating values from other components
- Complex payroll dependencies

### Important Notes
- **Processing Order**: Components with `@` references must have higher `processOrder`
- **Dependencies**: All referenced components must be calculated first
- **Two-Phase Processing**: System calculates normal components first, then `@`-dependent components

### Variations
- **With Conditional**:
  ```
  IF(@SALARY + @BONUS > 10000, (@SALARY + @BONUS) * 0.12, (@SALARY + @BONUS) * 0.08)
  ```
- **Selective Components**:
  ```
  IF(@ALLOWANCE > 0, (@SALARY + @ALLOWANCE) * 0.10, @SALARY * 0.08)
  ```

---

---
example_id: EX012
title: Net Pay Calculation
category: Cross-Component Reference
difficulty: Intermediate
keywords_used:
  - "COMPONENT_CODE_RESULT"
  - SALARY_RESULT
  - ALLOWANCE_RESULT
  - TAX_RESULT
  - DEDUCTION_RESULT
components:
  - NET_PAY
  - SALARY
  - ALLOWANCE
  - TAX
  - DEDUCTION
use_cases:
  - Net pay calculation
  - Final take-home pay
  - Result aggregation
---

## Example 12: Net Pay Calculation

### Scenario
Calculate net pay from calculated results of all income and deduction components.

### Formula
```
(SALARY_RESULT + ALLOWANCE_RESULT) - (TAX_RESULT + DEDUCTION_RESULT)
```

### Component Configuration
- **Component**: NET_PAY
- **Type**: Neutral
- **Process Order**: 99 (must be last)
- **Formula**: `(SALARY_RESULT + ALLOWANCE_RESULT) - (TAX_RESULT + DEDUCTION_RESULT)`

**Dependencies:**
- **SALARY** (Formula: `BASE`, Result: 10000)
- **ALLOWANCE** (Formula: `BASE * 0.20`, Result: 2000)
- **TAX** (Formula: `(@SALARY + @ALLOWANCE) * 0.10`, Result: 1200)
- **DEDUCTION** (Formula: `@SALARY * 0.05`, Result: 500)

### Calculation Steps
1. SALARY calculated = 10000
2. ALLOWANCE calculated = 2000
3. TAX calculated = 1200
4. DEDUCTION calculated = 500
5. NET_PAY formula: `(SALARY_RESULT + ALLOWANCE_RESULT) - (TAX_RESULT + DEDUCTION_RESULT)`
6. After _RESULT replacement: `(10000 + 2000) - (1200 + 500)`
7. Calculation: `12000 - 1700`
8. **Result**: 10300

### When to Use
- Final net pay calculation
- Take-home pay computation
- Aggregating all calculated results
- End-of-process summations

### Variations
- **Include Bank Charges**:
  ```
  (SALARY_RESULT + ALLOWANCE_RESULT) - (TAX_RESULT + DEDUCTION_RESULT + BANK_CHARGE_RESULT)
  ```
- **With Rounding**:
  ```
  ROUND((SALARY_RESULT + ALLOWANCE_RESULT) - (TAX_RESULT + DEDUCTION_RESULT), 2)
  ```

---

---
example_id: EX013
title: Conditional Tax Based on Total Income
category: Cross-Component Reference
difficulty: Advanced
keywords_used:
  - IF
  - "@COMPONENT_CODE"
  - "@SALARY"
  - "@BONUS"
components:
  - TAX
  - SALARY
  - BONUS
use_cases:
  - Progressive tax on combined income
  - Threshold-based taxation
  - Multi-component conditionals
---

## Example 13: Conditional Tax Based on Total Income

### Scenario
Apply 15% tax if combined salary and bonus exceeds 15000, otherwise 10%.

### Formula
```
IF(@SALARY + @BONUS > 15000, (@SALARY + @BONUS) * 0.15, (@SALARY + @BONUS) * 0.10)
```

### Component Configuration
- **Component**: TAX
- **Type**: Deduction
- **Process Order**: 10
- **Formula**: See above

**Dependencies:**
- **SALARY** (Process Order: 1)
- **BONUS** (Process Order: 2)

### Calculation Steps

**Case 1: High Income**
1. SALARY = 12000
2. BONUS = 5000
3. Total: `12000 + 5000 = 17000`
4. Condition: `17000 > 15000` = TRUE
5. Calculation: `17000 * 0.15`
6. **Result**: 2550

**Case 2: Standard Income**
1. SALARY = 10000
2. BONUS = 3000
3. Total: `10000 + 3000 = 13000`
4. Condition: `13000 > 15000` = FALSE
5. Calculation: `13000 * 0.10`
6. **Result**: 1300

### When to Use
- Progressive tax on combined income
- Threshold-based calculations across components
- Multi-source income taxation
- Complex eligibility based on aggregates

---

# Proration

---
example_id: EX014
title: Mid-Month Join Proration (Calendar Days)
category: Proration
difficulty: Intermediate
keywords_used:
  - PRORATECD_CODE
  - PRORATECD_SALARY
  - ACD
  - TCD
components:
  - PRORATED_SALARY
  - SALARY
use_cases:
  - Mid-month join
  - Partial month payment
  - Calendar days proration
---

## Example 14: Mid-Month Join Proration (Calendar Days)

### Scenario
Employee joins on the 15th of a 30-day month. Prorate salary based on calendar days worked.

### Formula
```
PRORATECD_SALARY
```

### Expanded Formula (What happens internally)
```
SALARY * (ACD / TCD)
```

### Component Configuration
- **Component**: PRORATED_SALARY
- **Type**: Allowance
- **Formula**: `PRORATECD_SALARY`

### Calculation Steps
1. Employee joins: January 15, 2026
2. Month: January (31 days)
3. **ACD** (Actual Calendar Days) = 17 (Jan 15-31)
4. **TCD** (Total Calendar Days) = 31
5. SALARY = 6000
6. Calculation: `6000 * (17 / 31)`
7. **Result**: 3290.32

### When to Use
- Mid-month join date
- Mid-month termination
- Leave without pay (calendar days basis)
- Partial period calculations

### Variations
- **Multiple Components**:
  ```
  PRORATECD_SALARY + PRORATECD_ALLOWANCE
  ```
- **With Minimum**:
  ```
  MAX(PRORATECD_SALARY, 1000)
  ```

---

---
example_id: EX015
title: Mid-Month Join Proration (Working Days)
category: Proration
difficulty: Intermediate
keywords_used:
  - PRORATEWD_CODE
  - PRORATEWD_SALARY
  - AWD
  - TWD
components:
  - PRORATED_SALARY
  - SALARY
use_cases:
  - Working days proration
  - Business days calculation
  - Excluding weekends/holidays
---

## Example 15: Mid-Month Join Proration (Working Days)

### Scenario
Employee joins mid-month. Prorate salary based on working days (excluding weekends and holidays).

### Formula
```
PRORATEWD_SALARY
```

### Expanded Formula (What happens internally)
```
SALARY * (AWD / TWD)
```

### Component Configuration
- **Component**: PRORATED_SALARY
- **Type**: Allowance
- **Formula**: `PRORATEWD_SALARY`

### Calculation Steps
1. Employee joins mid-month
2. **AWD** (Actual Working Days) = 10 (days worked)
3. **TWD** (Total Working Days) = 22 (in full month)
4. SALARY = 6600
5. Calculation: `6600 * (10 / 22)`
6. **Result**: 3000

### When to Use
- Working days-based proration
- Excluding weekends from calculation
- Business days payroll
- Part-time schedules

### Variations
- **With Shift**:
  ```
  PRORATEWS_SALARY
  ```
- **Manual Calculation**:
  ```
  SALARY * AWD / TWD
  ```

---

---
example_id: EX016
title: Leave Without Pay Deduction
category: Proration
difficulty: Intermediate
keywords_used:
  - ACD
  - TCD
components:
  - LWP_DEDUCTION
  - SALARY
use_cases:
  - Unpaid leave deduction
  - Absence penalty
  - Lost days calculation
---

## Example 16: Leave Without Pay Deduction

### Scenario
Deduct salary for days of unpaid leave.

### Formula
```
SALARY * ((TCD - ACD) / TCD)
```

### Component Configuration
- **Component**: LWP_DEDUCTION
- **Type**: Deduction
- **Formula**: `SALARY * ((TCD - ACD) / TCD)`

### Calculation Steps
1. Month has 30 days (**TCD** = 30)
2. Employee took 5 days unpaid leave
3. **ACD** (Actual Calendar Days worked) = 25
4. SALARY = 6000
5. Lost days: `30 - 25 = 5`
6. Calculation: `6000 * (5 / 30)`
7. **Result**: 1000 (deduction)

### When to Use
- Leave without pay
- Absence penalties
- Unpaid leave deductions
- Lost time calculations

### Variations
- **Working Days Basis**:
  ```
  SALARY * ((TWD - AWD) / TWD)
  ```
- **Rounded**:
  ```
  ROUND(SALARY * ((TCD - ACD) / TCD), 2)
  ```

---

# Attendance-Based

---
example_id: EX017
title: Tardiness Penalty
category: Attendance-Based
difficulty: Beginner
keywords_used:
  - TARDINESS
components:
  - TARDINESS_PENALTY
use_cases:
  - Punctuality penalties
  - Late arrival deductions
  - Time tracking
---

## Example 17: Tardiness Penalty

### Scenario
Deduct 50 per 15 minutes of tardiness.

### Formula
```
(TARDINESS / 15) * 50
```

### Alternative (Hourly Rate)
```
TARDINESS * (HOURLY_RATE / 60)
```

### Component Configuration
- **Component**: TARDINESS_PENALTY
- **Type**: Deduction
- **Formula**: `(TARDINESS / 15) * 50`

### Calculation Steps
1. Employee has 45 minutes total tardiness
2. **TARDINESS** = 45
3. Calculation: `(45 / 15) * 50`
4. Result: `3 * 50`
5. **Result**: 150 (deduction)

### When to Use
- Tardiness penalties
- Late arrival deductions
- Punctuality enforcement
- Time-based penalties

### Variations
- **Rounded Intervals**:
  ```
  ROUND(TARDINESS / 15, 0) * 50
  ```
- **With Cap**:
  ```
  MIN((TARDINESS / 15) * 50, 500)
  ```

---

---
example_id: EX018
title: Overtime Pay Calculation
category: Attendance-Based
difficulty: Intermediate
keywords_used:
  - OTHWD
  - AWH
components:
  - OVERTIME_PAY
  - SALARY
use_cases:
  - Overtime compensation
  - Holiday work pay
  - Premium hour rates
---

## Example 18: Overtime Pay Calculation

### Scenario
Pay 1.5x hourly rate for overtime hours on holidays.

### Formula
```
OTHWD * (SALARY / (TWD * 8)) * 1.5
```

### Simplified (if hourly rate is known)
```
OTHWD * HOURLY_RATE * 1.5
```

### Component Configuration
- **Component**: OVERTIME_PAY
- **Type**: Allowance
- **Formula**: See above

### Calculation Steps
1. **OTHWD** (Overtime Holiday Working Day) = 8 hours
2. Monthly salary = 6600
3. Working days in month (**TWD**) = 22
4. Daily hours = 8
5. Hourly rate: `6600 / (22 * 8) = 37.50`
6. Overtime rate: `37.50 * 1.5 = 56.25`
7. OT pay: `8 * 56.25`
8. **Result**: 450

### When to Use
- Overtime calculations
- Holiday work premiums
- Rest day work pay
- Premium rate hours

### Variations
- **Different OT Types**:
  ```
  (OTRD_HALF * HOURLY_RATE * 1.5) + (OTRD_FULL * HOURLY_RATE * 2.0)
  ```
- **With Meal Allowance**:
  ```
  (OTHWD * HOURLY_RATE * 1.5) + IF(OTHWD > 2, OTMEAL, 0)
  ```

---

---
example_id: EX019
title: Attendance Rate Bonus
category: Attendance-Based
difficulty: Intermediate
keywords_used:
  - IF
  - AWD
  - TWD
components:
  - ATTENDANCE_BONUS
use_cases:
  - Attendance incentives
  - Partial attendance rewards
  - Tiered attendance bonuses
---

## Example 19: Attendance Rate Bonus

### Scenario
Provide tiered bonus based on attendance rate: 1000 if 100%, 500 if >=90%, 0 otherwise.

### Formula
```
IF(AWD >= TWD, 1000, IF(AWD >= TWD * 0.90, 500, 0))
```

### Component Configuration
- **Component**: ATTENDANCE_BONUS
- **Type**: Allowance
- **Formula**: See above

### Calculation Steps

**Case 1: 100% Attendance**
1. AWD = 22
2. TWD = 22
3. Condition: `22 >= 22` = TRUE
4. **Result**: 1000

**Case 2: 95% Attendance**
1. AWD = 21
2. TWD = 22
3. First condition: `21 >= 22` = FALSE
4. Second condition: `21 >= 22 * 0.90` (= 19.8) = TRUE
5. **Result**: 500

**Case 3: 85% Attendance**
1. AWD = 19
2. TWD = 22
3. First condition: FALSE
4. Second condition: `19 >= 19.8` = FALSE
5. **Result**: 0

### When to Use
- Tiered attendance incentives
- Partial credit for good attendance
- Progressive reward systems
- Retention bonuses

---

# Date/Time Calculations

---
example_id: EX020
title: Length of Service Bonus
category: Date/Time Calculation
difficulty: Intermediate
keywords_used:
  - LENGTHOFSERVICE
  - JOINDATE
  - TODAY
components:
  - SERVICE_BONUS
use_cases:
  - Service anniversary bonuses
  - Loyalty rewards
  - Tenure-based benefits
---

## Example 20: Length of Service Bonus

### Scenario
Award 1000 bonus for each complete year of service.

### Formula
```
LENGTHOFSERVICE(JOINDATE, TODAY(), 'y') * 1000
```

### Component Configuration
- **Component**: SERVICE_BONUS
- **Type**: Allowance
- **Formula**: `LENGTHOFSERVICE(JOINDATE, TODAY(), 'y') * 1000`

### Calculation Steps
1. JOINDATE = 2021-01-15
2. TODAY() = 2026-01-20
3. Service years: `LENGTHOFSERVICE('2021-01-15', '2026-01-20', 'y') = 5`
4. Calculation: `5 * 1000`
5. **Result**: 5000

### When to Use
- Service anniversary bonuses
- Loyalty incentives
- Tenure-based allowances
- Seniority rewards

### Variations
- **Capped at Maximum**:
  ```
  MIN(LENGTHOFSERVICE(JOINDATE, TODAY(), 'y') * 1000, 10000)
  ```
- **After Threshold**:
  ```
  IF(LENGTHOFSERVICE(JOINDATE, TODAY(), 'y') >= 5, LENGTHOFSERVICE(JOINDATE, TODAY(), 'y') * 1000, 0)
  ```

---

---
example_id: EX021
title: Anniversary Bonus
category: Date/Time Calculation
difficulty: Advanced
keywords_used:
  - IF
  - MONTH
  - DAY
  - JOINDATE
  - TODAY
components:
  - ANNIVERSARY_BONUS
use_cases:
  - Work anniversary bonuses
  - Annual celebrations
  - Date-specific rewards
---

## Example 21: Anniversary Bonus

### Scenario
Award 5000 bonus on employee's work anniversary month and day.

### Formula
```
IF(AND(MONTH(TODAY()) = MONTH(JOINDATE), DAY(TODAY()) = DAY(JOINDATE)), 5000, 0)
```

### Component Configuration
- **Component**: ANNIVERSARY_BONUS
- **Type**: Allowance
- **Formula**: See above

### Calculation Steps

**Case 1: Anniversary Month & Day**
1. JOINDATE = 2022-01-20
2. TODAY() = 2026-01-20
3. MONTH check: `1 = 1` = TRUE
4. DAY check: `20 = 20` = TRUE
5. AND result: TRUE
6. **Result**: 5000

**Case 2: Not Anniversary**
1. JOINDATE = 2022-01-20
2. TODAY() = 2026-01-15
3. MONTH check: `1 = 1` = TRUE
4. DAY check: `15 = 20` = FALSE
5. AND result: FALSE
6. **Result**: 0

### When to Use
- Work anniversary bonuses
- Birthday bonuses
- Date-specific rewards
- Annual commemorations

### Variations
- **Anniversary Month Only**:
  ```
  IF(MONTH(TODAY()) = MONTH(JOINDATE), 5000, 0)
  ```
- **With Years of Service**:
  ```
  IF(AND(MONTH(TODAY()) = MONTH(JOINDATE), DAY(TODAY()) = DAY(JOINDATE)),
     LENGTHOFSERVICE(JOINDATE, TODAY(), 'y') * 1000,
     0)
  ```

---

---
example_id: EX022
title: Age-Based Allowance
category: Date/Time Calculation
difficulty: Advanced
keywords_used:
  - IF
  - DATEDIFF
  - YEAR
components:
  - AGE_ALLOWANCE
use_cases:
  - Age-based benefits
  - Senior employee allowances
  - Demographic-based pay
---

## Example 22: Age-Based Allowance

### Scenario
Provide 500 allowance for employees aged 50 and above.

### Formula (Assuming BIRTHDATE field exists)
```
IF(DATEDIFF('YEAR', BIRTHDATE, TODAY()) >= 50, 500, 0)
```

### Alternative Calculation
```
IF(YEAR(TODAY()) - YEAR(BIRTHDATE) >= 50, 500, 0)
```

### Component Configuration
- **Component**: AGE_ALLOWANCE
- **Type**: Allowance
- **Formula**: See above

### Calculation Steps
1. BIRTHDATE = 1974-05-15
2. TODAY() = 2026-01-20
3. Age: `DATEDIFF('YEAR', '1974-05-15', '2026-01-20') = 51`
4. Condition: `51 >= 50` = TRUE
5. **Result**: 500

### When to Use
- Age-based benefits
- Senior employee allowances
- Retirement preparation benefits
- Demographic allowances

---

# Complex Multi-Component

---
example_id: EX023
title: Annual Performance Bonus
category: Complex Multi-Component
difficulty: Advanced
keywords_used:
  - IF
  - YTD_SALARY
components:
  - ANNUAL_BONUS
  - SALARY
use_cases:
  - Year-end bonuses
  - Annual performance rewards
  - Cumulative earnings bonuses
---

## Example 23: Annual Performance Bonus

### Scenario
Award 5% of total annual salary if YTD salary exceeds 120000.

### Formula
```
IF(YTD_SALARY >= 120000, YTD_SALARY * 0.05, 0)
```

### Component Configuration
- **Component**: ANNUAL_BONUS
- **Type**: Allowance
- **Formula**: `IF(YTD_SALARY >= 120000, YTD_SALARY * 0.05, 0)`

### Calculation Steps
1. Employee has worked full year
2. **YTD_SALARY** = 144000 (12 months × 12000)
3. Condition: `144000 >= 120000` = TRUE
4. Calculation: `144000 * 0.05`
5. **Result**: 7200

### When to Use
- Year-end bonuses
- Annual performance rewards
- Threshold-based annual incentives
- Cumulative earnings bonuses

### Variations
- **Tiered Annual Bonus**:
  ```
  IF(YTD_SALARY >= 200000, YTD_SALARY * 0.08,
     IF(YTD_SALARY >= 120000, YTD_SALARY * 0.05, 0))
  ```
- **With Current Month**:
  ```
  IF(YTD_SALARY + @SALARY >= 120000, (YTD_SALARY + @SALARY) * 0.05, 0)
  ```

---

---
example_id: EX024
title: 13th Month Pay
category: Complex Multi-Component
difficulty: Advanced
keywords_used:
  - IF
  - MONTH
  - TODAY
  - YTD_SALARY
components:
  - THIRTEENTH_MONTH
use_cases:
  - 13th month salary
  - Year-end mandatory pay
  - Annual bonus (Philippines, etc.)
---

## Example 24: 13th Month Pay

### Scenario
Pay one month's worth of average salary in December (13th month pay).

### Formula
```
IF(MONTH(TODAY()) = 12, YTD_SALARY / 12, 0)
```

### Component Configuration
- **Component**: THIRTEENTH_MONTH
- **Type**: Allowance
- **Formula**: `IF(MONTH(TODAY()) = 12, YTD_SALARY / 12, 0)`

### Calculation Steps

**December Calculation**
1. Current month: December (12)
2. **YTD_SALARY** = 120000
3. Condition: `12 = 12` = TRUE
4. Calculation: `120000 / 12`
5. **Result**: 10000

**Other Months**
1. Current month: January (1)
2. Condition: `1 = 12` = FALSE
3. **Result**: 0

### When to Use
- 13th month pay (mandatory in some countries)
- Year-end bonuses
- Annual salary distribution
- Christmas bonuses

### Variations
- **Prorated for Partial Year**:
  ```
  IF(MONTH(TODAY()) = 12,
     (YTD_SALARY / LENGTHOFSERVICE_MONTH) * IF(LENGTHOFSERVICE_MONTH > 12, 12, LENGTHOFSERVICE_MONTH),
     0)
  ```
- **With Minimum Service**:
  ```
  IF(AND(MONTH(TODAY()) = 12, LENGTHOFSERVICE_MONTH >= 6), YTD_SALARY / 12, 0)
  ```

---

---
example_id: EX025
title: Comprehensive Net Pay
category: Complex Multi-Component
difficulty: Advanced
keywords_used:
  - "COMPONENT_CODE_RESULT"
  - SUM
  - ROUND
components:
  - NET_PAY
  - Multiple income and deduction components
use_cases:
  - Final net pay calculation
  - Complete payroll summary
  - Take-home pay
---

## Example 25: Comprehensive Net Pay

### Scenario
Calculate final net pay from all income sources minus all deductions.

### Formula
```
ROUND(
  (SALARY_RESULT + ALLOWANCE_RESULT + BONUS_RESULT + OVERTIME_RESULT) -
  (TAX_RESULT + SSS_RESULT + INSURANCE_RESULT + LOAN_RESULT),
  2
)
```

### Component Configuration
- **Component**: NET_PAY
- **Type**: Neutral
- **Process Order**: 999 (last)
- **Formula**: See above

### Calculation Steps
1. Income components calculated:
   - SALARY_RESULT = 10000
   - ALLOWANCE_RESULT = 2000
   - BONUS_RESULT = 1500
   - OVERTIME_RESULT = 500
2. Deduction components calculated:
   - TAX_RESULT = 1400
   - SSS_RESULT = 500
   - INSURANCE_RESULT = 300
   - LOAN_RESULT = 800
3. Total income: `10000 + 2000 + 1500 + 500 = 14000`
4. Total deductions: `1400 + 500 + 300 + 800 = 3000`
5. Net: `14000 - 3000 = 11000`
6. Rounded: `ROUND(11000, 2)`
7. **Result**: 11000.00

### When to Use
- Final net pay calculation
- Comprehensive payroll summary
- Bank transfer amounts
- Payslip totals

---

**End of Examples**

For keyword reference, see [keywords.md](./keywords.md)

For technical documentation, see [reference.md](./reference.md)
