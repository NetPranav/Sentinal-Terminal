# Sentinel Terminal - Agent Guidelines & Operational Rules

These rules are active across all coding tasks, refactorings, and pair programming sessions for Sentinel Terminal.
For the complete development rules documentation, see [docs/rules.md](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/docs/rules.md).

---

## 1. Meaningful Git Commits on Completion (MANDATORY)
- **Immediately upon completing and verifying any implementation, bug fix, refactor, or UI polish task, perform a clean, meaningful git commit.**
- Use Conventional Commit format: `feat(...)`, `fix(...)`, `style(...)`, `docs(...)`, `refactor(...)`.
- Include a concise summary and descriptive bullet points detailing the changes, touched components, and validation results.
- Stage only relevant files. Never leave completed, passing implementations uncommitted.

---

## 2. Strict No-Emoji Policy
- **ZERO EMOJIS** across all user-facing interfaces, dialogs, warnings, and notifications.
- Use monochrome vector icons (e.g. `lucide-react` icons like `Terminal`, `Folder`, `Code2`, `ShieldAlert`, `Check`, `ExternalLink`) or standard typographical glyphs (`❯`, `•`, `✓`).

---

## 3. Grayscale Aesthetic Standards
- Adhere strictly to the matte dark / grayscale design palette (`#090b10`, `#0c0d12`, muted whites, 5%-15% white borders).
- No generic saturated primary colors.

---

## 4. Full Screens Over Modals for Key Workflows
- Onboarding, Settings, and primary tool views must render as dedicated, full-frame screens (`position: fixed, inset: 0`) with solid backgrounds (`#090b10`), completely covering any background terminals or chrome.

---

## 5. Verification Before Delivery
- Always run `npm test` and `npm run build` to guarantee 100% test pass rate and zero compilation errors before declaring work complete or committing.
