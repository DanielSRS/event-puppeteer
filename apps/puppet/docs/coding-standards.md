# Coding Standards

**Goal**: The ultimate goal of this standard is to produce code that is extremely performant, pretty, clear, and readable.

This document defines the strict architectural and structural rules for this codebase. Both human contributors and AI agents must follow these guidelines flawlessly.

## 1. Language & Paradigm

- **Pure C**: This is a pure C codebase. C++ features are strictly forbidden.
- **Data-Oriented & Functional**: State lives in pure data `structs` (similar to TypeScript interfaces). Logic lives in standalone functions grouped by namespaces. The codebase should aggressively pursue functional programming paradigms: rely on pure functions (no side effects) and function composition wherever possible.
- **Fixed-Width Types**: Always use exact fixed-width integers from `<stdint.h>` (e.g., `int32_t`, `uint64_t`, `size_t`) to guarantee sizes and security across architectures. Standard `int` or `long` are forbidden.
- **No Global State**: Mutable global variables are strictly forbidden. All state must be encapsulated within structs and explicitly passed into functions.
- **Const Correctness**: Since we rely on pure functions, `const` correctness is mandatory. Any pointer passed into a function that is not mutated must be marked `const`. Any variable that does not change after initialization must be marked `const`.
- **Macro Usage**: Function-like macros must never be used as a simple replacement for standard functions (use `static inline` for that to guarantee type safety). Macros are only permitted when expressing things that standard C functions cannot (e.g., capturing `__FILE__` and `__LINE__` for a logging module). Every macro must have a strictly well-defined reason and distinct role.

## 2. Naming Conventions

- **Variables & Functions**: `camelCase`
- **Types & Enums**: `PascalCase`
- **Constants, Macros & Enum Values**: `UPPER_SNAKE_CASE`
- **File Names**: `kebab-case.c`
- **No Abbreviations**: Naming must be clear and explicit. Do not use common C-style abbreviations (e.g., use `index` instead of `idx`, `string` instead of `str`, `length` instead of `len`). Write out the proper full names.
- **No Magic Values**: Hardcoded magic numbers or strings are strictly forbidden. Always create properly named constants or enums. If the constant's name alone does not perfectly convey its purpose and origin, it must be paired with documentation explaining exactly what it represents and why it exists.

## 3. Formatting

Formatting is enforced via `.clang-format`, which is configured to closely mirror Prettier for TypeScript:

- **Block Indent**: Function arguments are aligned to the block indent, not the open parenthesis.
- **No Bin Packing**: If arguments wrap to a new line, each argument must be on its own line (`BinPackParameters: false`, `BinPackArguments: false`).

## 4. Control Flow & Error Handling

- **Return Codes**: Exceptions are forbidden. Functions that can fail must return a C-style status code or return type.
- **Unique Error IDs**: Error codes must be globally unique per failure path to make debugging instantaneous. Never repeat an error code across different branches.

## 5. Memory Management

Minimum memory footprint and maximum performance are required. Standard `malloc/free` within business logic is banned to prevent fragmentation.

- **Stack First**: For short-lived data within a function's scope, use stack allocation.
- **Lifecycle Arenas**: For data that outlives a single function, allocate exactly what is needed (or use tightly-packed chained blocks) in an Arena tied to that specific lifecycle. Free the entire arena at the end of the lifecycle.
- **Precise Initialization**: Do not blindly zero out memory (e.g., via `memset`). Blanket zeroing adds unnecessary code execution and harms maximum performance. Instead, initialize data directly with its proper values. Always avoid partially initializing data; invalid states and values must never be represented.

## 6. Functional Type Interfaces

To achieve strict namespacing, modularity, and high readability, we group operations around data types using Interface Structs. This pattern takes inspiration from functional programming types and function types.

### The Header File (`module-name.h`)

- **Data & Interface**: For a given data struct (e.g., `MyData`), define a corresponding operations struct named `[Type]Type` (e.g., `MyDataType`) containing *only* `const` function pointers. This acts as the clear public interface for all operations that can be performed on that type. (Note: A single header/module is allowed to define multiple types and their corresponding interfaces).
- **The Export**: Declare a single `extern const struct [Type]Type [Type]I;` (appending `I` for Interface). This is the *only* symbol exposed globally for those operations.
- **STB-Style Implementation**: At the bottom of the header, use an `#ifdef [PROJECT]_[MODULE]_IMPLEMENTATION` block to `#include` the corresponding `.c` implementation file(s).

### The Implementation File (`module-name.c`)

- **Private by Default**: Every function written in the `.c` file *must* be declared `static` (and `inline` when appropriate). They must not leak into the global C namespace.
- **The Binding**: At the bottom of the `.c` file, instantiate the exported struct and bind the `static` functions to the public pointers.
- **No Conditional Compilation for Platforms**: Conditional compilation (`#ifdef`, `#if`) is **completely forbidden** inside implementation files for platform-specific code. Platform branching must happen purely by having separate files (e.g., `module-name.android.c`, `module-name.linux.c`). Implementation files with no platform extension (`module-name.c`) are the portable/default implementations.

### Usage

Callers `#include "module-name.h"` and use the struct to invoke operations on the type: `MyDataI.doSomething()`.

*Note on Performance: This abstraction is entirely zero-cost. Because the exported struct is `const` and the implementation functions are `static`, modern compilers with optimization flags completely strip out the struct of function pointers. This removes all indirection at runtime, yielding zero performance penalty.*

## 7. Documentation

Documentation is critical for maintaining a pretty and readable codebase. We use a hybrid approach, separating consumer documentation from internal logic explanations:

### Public API (Header Files `.h`)

Header files are the public interface and must be treated as a manual for consumers.

- Use rich, structured doc-blocks (like Doxygen or JSDoc style) for the public definitions.
- Documentation must thoroughly detail **how to use** the API, what parameters it expects, what it returns, potential error codes, memory/lifecycle requirements, and provide usage examples where helpful.

### Implementation (Source Files `.c`)

Implementation files contain the actual logic, which must naturally self-document through our strict naming conventions.

- Comments inside `.c` files must explain **Why** a decision was made (e.g., performance optimizations, business rules, or specific patterns), and occasionally **What** a complex block of code represents.
- Comments must **Never** explain **How** the code works. The code itself dictates the "how". If the "how" is too complex to understand by reading the code, the code must be refactored to be clearer.
- **Doc-Blocks vs. Line Comments**: For documentation comments (comments placed directly above definitions, structs, or logic blocks), you must exclusively use the `/** ... */` syntax. Do not use `/* ... */` or `//` for documentation, as IDEs and external tools often fail to recognize them as proper doc-blocks. `//` is perfectly fine and encouraged for brief, end-of-line comments within the implementation.

## 8. Automated Testing

Testing in this repository follows the same minimalist, dependency-light philosophy as the rest of the codebase. We use pure C testing structures.

- **Unit Test Location**: Unit tests must be co-located next to the source files they test. They must use the `.test.c` suffix (e.g., `src/module/module.test.c`). This keeps tests highly visible when modifying a module.
- **Build Integration**: Tests are compiled into a standalone executable. We explicitly bypass heavy C++ test suites to keep things lean and fast.
- **Implementation Inclusion**: The central test runner is responsible for defining the `[PROJECT]_[MODULE]_IMPLEMENTATION` macros required to instantiate the modules under test. Individual `.test.c` files must only include the `.h` headers.
