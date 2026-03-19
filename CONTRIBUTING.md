# Contributing to X POS

Thank you for your interest in contributing to X POS! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:

   ```bash
   cd $PATH_TO_YOUR_BENCH
   bench get-app https://github.com/<your-username>/xpos --branch develop
   bench --site your-site.com install-app xpos
   ```

3. **Add the upstream remote:**

   ```bash
   cd apps/xpos
   git remote add upstream https://github.com/aliraxa29/xpos.git
   ```

4. **Create a new branch** from `develop`:

   ```bash
   git checkout -b feat/your-feature-name develop
   ```

## Development Setup

### Prerequisites

| Dependency       | Version  |
| ---------------- | -------- |
| Python           | >= 3.10  |
| Node.js          | >= 18    |
| Frappe Framework  | v15      |
| ERPNext          | v15      |

### Pre-commit Hooks

Install pre-commit hooks to ensure code quality before every commit:

```bash
cd apps/xpos
pip install pre-commit
pre-commit install
```

### Frontend Development

```bash
cd apps/xpos/frontend
yarn install
yarn dev          # Start Vite dev server
yarn test         # Run Vitest in watch mode
yarn test:run     # Run tests once
yarn typecheck    # TypeScript type checking
```

### Backend Development

```bash
cd $PATH_TO_YOUR_BENCH
bench start       # Start Frappe development server
```

## Making Changes

- Keep changes focused. A single PR should address a single concern.
- Write or update tests for any new functionality.
- Ensure all linters and tests pass before submitting:

  ```bash
  # Python linting
  ruff check xpos/

  # Frontend checks
  cd frontend
  yarn typecheck
  yarn test:run
  ```

## Commit Guidelines

All commits **must** follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This enables automated versioning and changelog generation.

### Format

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Allowed Types

| Type       | Description                              |
| ---------- | ---------------------------------------- |
| `feat`     | A new feature                            |
| `fix`      | A bug fix                                |
| `docs`     | Documentation only changes               |
| `style`    | Formatting, missing semicolons, etc.     |
| `refactor` | Code change that neither fixes nor adds  |
| `perf`     | Performance improvement                  |
| `test`     | Adding or updating tests                 |
| `build`    | Build system or dependency changes       |
| `ci`       | CI configuration changes                 |
| `chore`    | Other changes that don't modify src/test |
| `revert`   | Reverts a previous commit                |

### Examples

```
feat: add delivery charge calculation to cart
fix: correct tax rounding in multi-currency payments
docs: add offline mode troubleshooting guide
refactor(cart): simplify discount application logic
test: add unit tests for pricing engine
```

## Pull Request Process

1. **Sync your branch** with the latest `develop`:

   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

2. **Push** your branch and open a Pull Request against the `develop` branch.

3. Fill out the PR template completely — describe what changed and why.

4. Ensure all CI checks pass (linting, type checking, tests).

5. A maintainer will review your PR. Address any feedback and push updates to the same branch.

6. Once approved, a maintainer will merge your PR.

## Reporting Bugs

Use the [Bug Report](https://github.com/aliraxa29/xpos/issues/new?template=bug_report.md) issue template. Please include:

- Steps to reproduce
- Expected vs. actual behavior
- Screenshots or error logs if applicable
- Your environment (Frappe version, browser, OS)

## Requesting Features

Use the [Feature Request](https://github.com/aliraxa29/xpos/issues/new?template=feature_request.md) issue template. Describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

---

Thank you for contributing to X POS!
