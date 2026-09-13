# Contributing to Puppet

Welcome! This repository enforces extremely rigorous, high-performance architectural standards for embedded C development.

## 1. Coding Standards

Before writing any code, you **must** read and understand [docs/coding-standards.md](docs/coding-standards.md).
This project strictly enforces:

- **Pure C** (no C++)
- **Data-Oriented & Functional Design** (Structs + Pure Functions)
- **The C-Module Struct Pattern** (zero-cost `ModuleI` interface structs)
- **Fixed-width integers** (`stdint.h` only)
- **Precise Initialization** (No blanket `memset` zeroing)
- **Strict Naming** (No abbreviations, no magic values)

## 2. Commit Conventions

This project strictly follows [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

### Rules

- **Tense**: Use the imperative, present tense (e.g., `feat: add kv store` instead of `added` or `adds`).
- **Length**:
  - The **subject** line must not exceed **72 characters**.
  - The **body** lines must be wrapped at **72 characters**.
- **Structure**:

  ```text
  <type>[optional scope]: <description>

  [optional body]

  [optional footer(s)]
  ```

- **Allowed Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- **Language**: All commit messages (subject and body) must be written in English.
- **Atomic Commits**: Commits must be atomic and small. If a commit body is various lines long explaining the changes, it probably means the commit is too large. Prefer small scoped commits with tightly related changes. Even if all changes are related to the same feature, you should group them into smaller, logically independent commits.

## 3. Building & Developing

Puppet uses `CMake` as its primary build system, targeting Linux ARM32 embedded devices, as well as native desktop and Android environments.

For complete, up-to-date instructions on how to set up your environment, cross-compile for ARM32 (including the automatic sysroot fetching), and build natively, please refer to the **[README.md](README.md)**.
