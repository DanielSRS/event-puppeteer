# Puppet

A simple C application.

## Prerequisites

To build and run this project, ensure you have the following installed on your system:
- **CMake** (version 3.19 or higher)
- **C Compiler** (e.g., GCC, Clang, or MSVC)
- Standard build tools (e.g., `make`, `ninja`, or Visual Studio build tools)

## Build Instructions

1. Open your terminal and navigate to the root of the project directory.
2. Configure the project by generating the build files into a `build` directory:
   ```bash
   cmake -B build
   ```
3. Compile the application:
   ```bash
   cmake --build build
   ```

## Running the Application

After a successful build, you can execute the compiled binary.

**On Linux / macOS:**
```bash
./build/puppet
```

**On Windows:**
Depending on your generator (e.g., MSVC), the executable might be nested inside a build type directory:
```cmd
.\build\Debug\puppet.exe
```
