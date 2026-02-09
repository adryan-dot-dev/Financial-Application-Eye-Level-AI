# 📐 Code Conventions

> קובץ זה מגדיר קונבנציות קוד. כל הסוכנים חייבים לעקוב.
> מעודכן ע"י **Orchestrator** בתחילת הפרויקט.

---

## כללי

### שמות קבצים
- `snake_case` לקבצי Python
- `kebab-case` לקבצי JS/TS
- `PascalCase` לקומפוננטות React

### שמות משתנים
- `snake_case` ב-Python
- `camelCase` ב-JS/TS
- `UPPER_CASE` לקבועים

### פונקציות
- שמות שמתארים את הפעולה: `get_user`, `create_task`
- פונקציה עושה דבר אחד
- מקסימום 20-30 שורות

### הערות
- רק כשבאמת צריך
- מסבירות "למה", לא "מה"
- TODO/FIXME עם שם ותאריך

---

## Python

```python
# Imports order
import standard_library
import third_party
import local_modules

# Type hints
def get_user(user_id: int) -> User | None:
    pass

# Docstrings for public functions
def create_user(email: str, name: str) -> User:
    """Create a new user.
    
    Args:
        email: User's email address
        name: User's display name
        
    Returns:
        The created User object
        
    Raises:
        ValueError: If email is invalid
    """
    pass
```

---

## JavaScript/TypeScript

```typescript
// Imports order
import React from 'react';          // React first
import { useState } from 'react';   // React hooks
import axios from 'axios';          // Third party
import { User } from '@/types';     // Local

// TypeScript types
interface User {
  id: string;
  email: string;
  name: string;
}

// Async/await over .then()
async function getUser(id: string): Promise<User> {
  const response = await api.get(`/users/${id}`);
  return response.data;
}
```

---

## Git

- Commit messages: `type: short description`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`
- Branch naming: `feature/xxx`, `fix/xxx`

---

_הקונבנציות יעודכנו ע"י Orchestrator לפי הפרויקט הספציפי._
