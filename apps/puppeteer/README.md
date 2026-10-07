# Puppeteer

## Architecture Pattern

This project follows the **Functional Core / Imperative Shell** pattern to make testing and reasoning easier.

### Guidelines for Future Slices

1. **Define Types & IO Interfaces**: Any side-effectful operations (e.g., database queries, external API calls) should be defined as interfaces in the `src/io/` folder.
2. **Write Pure Handlers**: Handlers should be pure functions with the signature `(request, io) -> response`. They must *not* have any hidden side effects. They must receive an `io` object to perform any necessary operations.
   - Example: `export async function myHandler(request: Request, io: AppIO) { ... }`
3. **In-Memory Implementations**: Every IO interface should have an in-memory implementation for tests, defined in `src/io/in-memory.ts`.
4. **Wire the Shell**: The HTTP layer (in `src/server.ts`) is the imperative shell. It is responsible for assembling the real IO dependencies and injecting them into the pure handlers.
5. **Testing**: Tests must call the handlers directly, passing in the `in-memory` IO implementation, and assert the handler's response and any state changes in the `in-memory` stores. No HTTP server should be spun up for these unit tests.

### Scripts

- `nub run start`: Starts the application server.
- `nub run test`: Runs the test suite using the Node.js native test runner.
