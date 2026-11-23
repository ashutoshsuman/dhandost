# Architecture

- Keep commitment classification and IST-month progress calculations in a browser-safe pure helper with rule tests; render the section separately to avoid changing other Live Plan sections.
- Pending one-time action cards must reuse the original confirmation endpoints with only commitment_id; those existing services own all debt and savings updates.
- Keep variable-spending refresh and handled-surprise exclusions in a shared browser-safe helper with rule tests so every mutation path uses the same behavior.