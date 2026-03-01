# Core Canary Files — Detector Verification

Create these files in `mault-canary/` (project root) to prove each core UC detector fires correctly.
After verification, delete the entire `mault-canary/` directory.

> **CRITICAL:** Do NOT place canary files inside `.mault/` — that directory has a `.gitignore` with `*`,
> which makes files invisible to VS Code's `workspace.findFiles()`. Detectors will never see them.

## TypeScript/JavaScript Canary Files

### UC01 — Directory Reinforcement

**File:** `mault-canary/uc01-misplaced-service.ts`
**Expected Detection:** "Service files should be in src/services/"

```typescript
// Canary: Service file in wrong directory (should be in src/services/)
export class UserService {
  getUser(id: string): string {
    return `user-${id}`;
  }
}
```

**Why it fires:** The filename matches `**/*Service.ts` or `**/*-service.ts` pattern but is NOT in the `expectedDir` configured in `directoryReinforcement.rules`.

---

### UC02 — Legacy Path Prevention

**File:** `mault-canary/uc02-deprecated-import.ts`
**Expected Detection:** "Deprecated library 'moment'. Use 'date-fns' or 'dayjs' instead."

```typescript
// Canary: Deprecated import (moment is deprecated)
import moment from 'moment';

export function formatDate(date: Date): string {
  return moment(date).format('YYYY-MM-DD');
}
```

**Why it fires:** The import matches a `deprecatedPatterns` entry with `import: moment`.

---

### UC03 — Naming Convention

**File:** `mault-canary/uc03-BadNaming.ts`
**Expected Detection:** File naming violation (PascalCase instead of kebab-case)

```typescript
// Canary: File uses PascalCase instead of kebab-case
export function badNamingExample(): string {
  return 'This file has wrong naming convention';
}
```

**Why it fires:** The filename `BadNaming.ts` violates `namingConvention.fileNaming: "kebab-case"`. Kebab-case requires all lowercase with hyphens.

---

### UC06 — Temporary Files

**File:** `mault-canary/temp_scratch.ts`
**Expected Detection:** Temporary file detected

```typescript
// Canary: Temp/scratch file that should not be committed
export const scratchData = { debug: true, temp: 'will be removed' };
```

**Why it fires:** The filename matches `**/temp_*` pattern in `tempFiles.patterns`.

---

### UC09 — File Proliferation

Create three versioned files to trigger the proliferation threshold:

**File 1:** `mault-canary/uc09-utils_v1.ts`
```typescript
// Canary: Versioned file v1
export const version = 1;
```

**File 2:** `mault-canary/uc09-utils_v2.ts`
```typescript
// Canary: Versioned file v2
export const version = 2;
```

**File 3:** `mault-canary/uc09-utils_v3.ts`
```typescript
// Canary: Versioned file v3
export const version = 3;
```

**Expected Detection:** File proliferation — 3+ variants of same file detected

**Why it fires:** Three files with `_v1`, `_v2`, `_v3` suffixes meet the `fileProliferation.threshold: 3`.

---

### UC12 — Scattered Utils

**File:** `mault-canary/uc12-scattered-helper.ts`
**Expected Detection:** Utility/helper file outside central location

```typescript
// Canary: Helper file not in the central utils directory
export function helperFunction(input: string): string {
  return input.toLowerCase().trim();
}
```

**Why it fires:** A file with "helper" in the name exists outside `misplacedUtilities.centralLocation` (typically `src/utils`).

---

## Python Canary Files

Use these instead when the project is Python-based.

### UC01 — Directory Reinforcement

**File:** `mault-canary/uc01_misplaced_service.py`
```python
# Canary: Service file in wrong directory (should be in src/services/)
class UserService:
    def get_user(self, user_id: str) -> str:
        return f"user-{user_id}"
```

### UC02 — Legacy Path Prevention

**File:** `mault-canary/uc02_deprecated_import.py`
```python
# Canary: Deprecated import (optparse is deprecated since Python 2.7)
import optparse

parser = optparse.OptionParser()
```

### UC03 — Naming Convention

**File:** `mault-canary/uc03-BadNaming.py`
```python
# Canary: File uses kebab-case instead of snake_case
def bad_naming_example() -> str:
    return "This file has wrong naming convention"
```

**Why it fires:** Python projects use `fileNaming: "snake_case"`. A file with hyphens (`Bad-Naming`) or PascalCase violates this.

### UC06 — Temporary Files

**File:** `mault-canary/temp_scratch.py`
```python
# Canary: Temp/scratch file that should not be committed
scratch_data = {"debug": True, "temp": "will be removed"}
```

### UC09 — File Proliferation

**File 1:** `mault-canary/uc09_utils_v1.py`
```python
# Canary: Versioned file v1
version = 1
```

**File 2:** `mault-canary/uc09_utils_v2.py`
```python
# Canary: Versioned file v2
version = 2
```

**File 3:** `mault-canary/uc09_utils_v3.py`
```python
# Canary: Versioned file v3
version = 3
```

### UC12 — Scattered Utils

**File:** `mault-canary/uc12_scattered_helper.py`
```python
# Canary: Helper file not in the central utils directory
def helper_function(text: str) -> str:
    return text.lower().strip()
```

---

## Verification Checklist

After creating all canary files and reloading VS Code:

| UC | Canary File | Expected Alert | Verified? |
|----|-------------|----------------|-----------|
| UC01 | `uc01-misplaced-service.ts` | Directory reinforcement warning | |
| UC02 | `uc02-deprecated-import.ts` | Deprecated import warning | |
| UC03 | `uc03-BadNaming.ts` | Naming convention violation | |
| UC06 | `temp_scratch.ts` | Temporary file warning | |
| UC09 | `uc09-utils_v1/v2/v3.ts` | File proliferation warning | |
| UC12 | `uc12-scattered-helper.ts` | Scattered utility warning | |

**Note:** UC04 (Environment), UC07 (Flat Architecture), UC08 (Config Chaos), UC11 (Overcrowded Folders) are structural/informational detectors that fire based on workspace-level analysis, not individual canary files. They don't need canary files — the verify script checks their configuration is present.

## After Verification

1. Write results to `.mault/canary-log.json` (format shown in orchestrator)
2. Delete the `mault-canary/` directory
3. Run `./mault-verify-initialize.sh` to confirm CHECKs 6-8 pass
