# Global Engineering Rules (KISS / Minimal Code)

The following rules apply universally to all AI agents operating in this workspace.

## 1. Clean Code & Simplicity (KISS)

- **Always prioritize human-readable, simple code over overly clever solutions.** Ensure variable names and logic flows read like plain English.
- **Follow YAGNI (You Aren't Gonna Need It).** Build exactly what is asked for. Do not add speculative features, abstractions, layers, or helpers unless they are strictly required for the current task.
- **Prefer the smallest safe change** that solves the requested problem.
- **When multiple solutions exist, choose the simplest maintainable option.**

## 2. Scope & Refactoring

- **Avoid refactors outside the task scope.** Do not randomly reformat or rewrite existing code just to make it "cleaner" unless you were specifically instructed to refactor it.
- **Preserve existing architecture.** Do not introduce new design patterns unless a change is absolutely required for correctness or security.

## 3. Security & Correctness (CRITICAL)

- **Do not oversimplify at the cost of security.** All inputs must still be validated, and all authentication/authorization checks (JWT, Roles) must remain fully intact.
- **Add tests only for changed behavior and critical regressions.** Do not write massive test suites unless explicitly asked.

## 4. Communication

- **Output concise explanations and implementation steps.** Do not generate huge walls of text.
- **If uncertain, ask one clarifying question** before adding complexity or guessing the architecture.

## 5. Universal Development Standards

- **Architecture**: Always follow SOLID principles, Clean Architecture, and Dependency Injection for all backend code.
- **Debugging**: When debugging, always methodically isolate the problem and read server logs before guessing or modifying code.
- **Testing**: Always write Jest tests before implementing features. Tests must include mock utilities and cover edge cases.
- **Accessibility**: All frontend code must be fully accessible. Always include ARIA labels, semantic HTML tags, and ensure keyboard navigation.
- **Security**: All endpoints must validate inputs, sanitize data, and verify JWT roles. Never trust client data.
- **Planning**: Before starting a complex task, always write a concise, atomic checklist to plan your work.

## 6. Package Manager (BUN)

- **Always use `bun` and `bunx`**: For any package installations, script executions, or tool running, you MUST use `bun` (e.g., `bun install`, `bun add`, `bun run`) and `bunx` (e.g., `bunx prisma`). NEVER use `npm`, `npx`, `yarn`, or `pnpm` in this project.
