# Architecture

- Keep commitment classification and IST-month progress calculations in a browser-safe pure helper with rule tests; render the section separately to avoid changing other Live Plan sections.
- Keep variable-spending refresh and handled-surprise exclusions in a shared browser-safe helper with rule tests so every mutation path uses the same behavior.