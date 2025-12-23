# Developer/AI Agent Instructions for Tab Positioner

This document provides a comprehensive guide for developers and AI agents working on the `tab-positioner` Chrome extension project. It outlines the project structure, technology stack, and development workflows.

## 1. Project Overview

`tab-positioner` is a Google Chrome extension designed to transform tab management behavior. It is a Manifest V3 extension.

## 2. Technology Stack

- **Runtime**: Node.js
- **Package Manager**: `pnpm` (implied by `pnpm-lock.yaml`)
- **Languages**:
	- **TypeScript**: Primary language for logic (`.ts`, `.tsx`).
	- **SCSS**: For styling (`.scss`).
- **Build System**:
	- **Eleventy**: Orchestrates the build process and handles HTML generation.
	- **Vite**: Used as a plugin within Eleventy to bundle JavaScript and CSS.
- **Testing**:
	- **Playwright**: For End-to-End (E2E) testing.
- **UI Framework**:
	- Uses `jsx-async-runtime`, a lightweight JSX implementation for the Options/Popup UI. The codebase manually handles form state and restoration without a heavy framework like React.

## 3. Project Structure

The project is organized as follows:

- **`root`**:
	- `manifest.json`: The Manifest V3 configuration. **Source of Truth** for extension metadata, permissions, and entry points.
	- `eleventy.config.mjs`: Main build configuration file. Defines how `src` files are processed into `dist`.
	- `tsconfig.json`: TypeScript configuration.
	- `TESTING.md`: Manual testing checklist.

- **`src/`**: Source code directory.
	- **`background/`**: Contains the code for the extension's Service Worker (Background Script).
		- `main.ts`: Entry point. Initializes `Listeners`, `SyncSettings`, and `TabsInfo`.
		- `tabcreation.ts`: Core logic for where to place new tabs (`createdTabMover`).
		- `tabactivation.ts`: Core logic for which tab to activate after closing one (`tabRemovedActivater`).
		- `tabsinfo.ts`: Maintains state about tabs to support decision making (e.g. creation delay, recent tabs).
	- **`options/`**: Contains code for the Extension Options Page and Popup.
		- `index.tsx`: Main UI entry point (JSX).
		- `options.ts`: Logic for loading/saving settings and form interactions.
		- `settings.tsx`: Dynamically generates UI components based on the shared setting schemas.
		- `options.scss`: Stylesheets.
	- **`shared/`**: Shared utilities and constants used by both background and options contexts.
		- `constants.ts`: Global constants (e.g., delays, magic URLs).
		- `i18n.ts`: Type-safe i18n helpers. Imports English messages for compile-time key validation.
		- `listeners.ts`: Wrapper for Chrome events. It forces async listener callbacks to execute synchronously (sequentially).
		- `session.ts`: Base class for synchronizing singleton state with `chrome.storage.session`.
		- `settings.ts`: **Critical File**. Defines `ExtensionSettings`, `SETTING_SCHEMAS`, and default values.
		- `storage.ts`: Handles reading/writing to `chrome.storage`.
	- **`types/`**: TypeScript type definitions.

- **`scripts/`**: Build and maintenance scripts.
	- `clean.ts`
	- `locales.ts`
	- `package.ts`
	- `package.sh`
- **`tests/`**: Automated Playwright tests.
	- `extension.spec.ts`: Main test specification.
	- `fixtures.ts`: Test fixtures.
- **`utils/`**: Utilities used by the **build process** (Eleventy plugins, git info, etc.).
	- `comments.ts`
	- `gitinfo.ts`
	- `manifest.ts`
	- `vite.ts`
	- `tsx.ts`
- **`_locales/`**: i18n message configurations (e.g., `en/messages.json`).

## 4. Codebase Deep Dive

### Shared Logic & Data Models
- **Settings Schema**: Defined in `src/shared/settings.ts`.
	- `ExtensionSettings`: The interface for all setting keys and values.
	- `SETTING_SCHEMAS`: Metadata for each setting (type, potential choices, i18n keys). This drives the UI generation in `src/options/settings.tsx`.
	- **Advanced Settings**: Keys starting with an underscore (e.g., `_debug_mode`) are functionally treated as **Advanced Settings**. The UI generation logic (`src/options/settings.tsx`) uses this prefix to automatically filter and place them in the "Advanced" details section.

### Background Service Worker
- **Initialization** (`src/background/main.ts`):
	- Synchronously initializes `Listeners` to ensure no events are missed.
	- Sets up `SyncSettings` (replicates storage in memory/session for sync access) and `TabsInfo` (tracks tab state).
	- Registers event listeners: `onCreated` -> `createdTabMover`, `onRemoved` -> `tabRemovedActivater`.
- **Tab Creation** (`src/background/tabcreation.ts`):
	- Determines if a new tab is a "foreground link", "background link", or "new tab page".
	- Checks `tabsInfo` for creation delay to prevent conflicts with batch operations.
	- Moves the tab to the configured position using `tabMover` (or `createdPopupMover` for popups).
- **Tab Activation** (`src/background/tabactivation.ts`):
	- Triggered when a tab is closed.
	- Calculates the next tab to activate based on the `after_close_activation` setting (e.g., `before_removed`, `window_last`).

### Options UI
- **Dynamic Generation**: `src/options/settings.tsx` iterates over `SETTING_SCHEMAS` to build the UI form. This means adding a new setting in `src/shared/settings.ts` automatically adds it to the UI.
- **Form Handling**: `src/options/options.ts` manages standard HTML forms. It listens for `change` events to save settings and `reset` events to restore defaults.
- **Styling**: `src/options/options.scss` handles the look and feel, supporting light/dark modes.

### Internationalization (i18n)
- **Source of Truth**: `_locales/en/messages.json` is the base for all keys.
- **Type Safety**: `src/shared/i18n.ts` imports the English messages to generate the `I18nKey` type, ensuring compile-time safety for message keys.
- **Component Helpers**: Helper functions `_` (getMessage) and `_a` (createI18nAttribute) are used in JSX components to easily bind text and attributes to i18n keys.
- **Validation**: `pnpm lint:locales` (running `scripts/locales.ts`) ensures all other locales (`_locales/*`) have the exact same keys as the English base, preventing missing or extra keys.

## 5. Build & Development Workflow

### Installation
```bash
pnpm install
```

### Development (Watch Mode)
Compiles files and watches for changes.
```bash
pnpm dev
```
- **Output**: The extension is built into the `dist/` directory.
- **Load**: Load the `dist/` folder as an "Unpacked Extension" in `chrome://extensions`.

### Production Build
Creates a production-ready build in `dist/`.
```bash
pnpm build
```

### Packaging
Creates a `.zip` file for the Chrome Web Store.
```bash
pnpm release
```

### Checking
Run all checks (linting, type checking, and tests).

### Manual Verification
Refer to `TESTING.md` for a checklist of manual verification steps. Ensure all items are checked before major releases.

### Testing
Runs automated Playwright tests.
```bash
pnpm test
```
- **Note**: Ensure the extension is built (or tests are configured to point to the right build logic) before running tests.

## 6. Access Rules for AI Agents

1.	**Read First**: Always read `manifest.json` and `package.json` if you are unsure about dependencies or entry points.
2.	**Schema Driven**: If adding a setting, start in `src/shared/settings.ts` AND update `_locales/en/messages.json` (and other supported locales) with the corresponding keys. The UI will largely adapt automatically.
3.	**Modify `src`**: Do not modify `dist` directly. Make changes in `src`.
4.	**Test**: After making changes, run `pnpm build` to verify compilation and `pnpm test` to verify functionality.
5.	**Check**: Run `pnpm check` before finishing tasks to ensure code compliance.
6.	**Update Instructions**: If you discover new patterns, add files, or change the architecture, YOU MUST update this `AGENTS.md` file to keep it current.

## 7. Coding Style & Preferences

The project enforces strict coding styles via `.editorconfig` and linting tools.

- **Indentation**:
	- **Tabs** (width 4) for TypeScript, JavaScript, CSS, SCSS, JSON, HTML.
	- **Spaces** (width 2) for YAML/YML.
- **Newlines**: LF (Line Feed).
- **Trailing Whitespace**: Trimmed.
- **Final Newline**: Inserted.
- **Linting**:
	- **Stylelint**: Standard SCSS config. Run `pnpm lint:css`.
	- **EditorConfig**: Enforced via `editorconfig-checker`. Run `pnpm lint:editorconfig`.

**IMPORTANT**: Always respect the **TAB** indentation in source files. Do not convert to spaces.
