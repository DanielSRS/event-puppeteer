cmake_minimum_required(VERSION 3.19)

# Define the project name and set the languages to C and CXX
project(puppet VERSION 0.0.5 LANGUAGES C CXX)

# The Puppet is configured only at build time (ADR-0001): Puppeteer's URL is
# baked into the binary, and configuring fails without a valid one.
set(PUPPET_SERVER_URL "" CACHE STRING "Puppeteer base URL, http:// or https:// (required)")
if(PUPPET_SERVER_URL STREQUAL "")
    message(FATAL_ERROR "PUPPET_SERVER_URL is required: configure with -DPUPPET_SERVER_URL=https://puppeteer.example")
endif()
if(NOT PUPPET_SERVER_URL MATCHES "^https?://[^ \t\"\\;]+$")
    message(FATAL_ERROR "PUPPET_SERVER_URL must be an http:// or https:// URL, got '${PUPPET_SERVER_URL}'")
endif()

# The Wake-up broker (docs/adr/0001-wake-up-over-public-mqtt-broker.md in the
# monorepo) is fixed at build time as well; the Puppet reads no environment
# variables for it. TLS verifies the broker against the system certificate store.
set(PUPPET_WAKEUP_BROKER_HOST "broker.hivemq.com" CACHE STRING "Wake-up MQTT broker host")
set(PUPPET_WAKEUP_BROKER_PORT "8883" CACHE STRING "Wake-up MQTT broker port")
option(PUPPET_WAKEUP_BROKER_TLS "Encrypt the Wake-up broker connection" ON)
if(NOT PUPPET_WAKEUP_BROKER_HOST MATCHES "^[A-Za-z0-9.-]+$")
    message(FATAL_ERROR "PUPPET_WAKEUP_BROKER_HOST must be a host name or address, got '${PUPPET_WAKEUP_BROKER_HOST}'")
endif()
if(NOT PUPPET_WAKEUP_BROKER_PORT MATCHES "^[0-9]+$")
    message(FATAL_ERROR "PUPPET_WAKEUP_BROKER_PORT must be a port number, got '${PUPPET_WAKEUP_BROKER_PORT}'")
endif()
if(PUPPET_WAKEUP_BROKER_TLS)
    set(PUPPET_WAKEUP_BROKER_TLS_VALUE 1)
else()
    set(PUPPET_WAKEUP_BROKER_TLS_VALUE 0)
endif()

# Enforce C++17 for MMKV compilation compatibility
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Export compile commands for language servers (clangd/Zed)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

include(FetchContent)

# Fetch MMKV from GitHub
FetchContent_Declare(
  mmkv
  GIT_REPOSITORY https://github.com/Tencent/MMKV.git
  GIT_TAG        v2.4.2
  SOURCE_SUBDIR  Core
  PATCH_COMMAND  sh -c "sed -i 's/CXX_STANDARD 20/CXX_STANDARD 17/g' Core/CMakeLists.txt && sed -i 's/find(key)/find(std::string(key))/g' Core/*.cpp && sed -i 's/realRoot.ends_with(MMKV_PATH_SLASH)/(realRoot.length() > 0 ? (realRoot.back() == MMKV_PATH_SLASH[0]) : false)/g' Core/MMKV.cpp"
)
FetchContent_MakeAvailable(mmkv)

# Add threads for cross-platform support
find_package(Threads REQUIRED)

# Require libcurl (provides HTTPS transport to Puppeteer)
find_package(CURL REQUIRED)

# libmosquitto (MQTT client for Wake-ups) is built from source and linked
# statically, so the Device needs no MQTT library installed: a binary that
# cannot load its libraries cannot run, and so cannot update itself either.
# Only the library is built (no broker, clients, plugins or documentation), at
# the version the Wake-up code was verified against. It still needs OpenSSL
# (headers to build, libssl at run time, which libcurl already requires).
set(WITH_TLS ON CACHE BOOL "" FORCE)
set(WITH_CLIENTS OFF CACHE BOOL "" FORCE)
set(WITH_BROKER OFF CACHE BOOL "" FORCE)
set(WITH_APPS OFF CACHE BOOL "" FORCE)
set(WITH_PLUGINS OFF CACHE BOOL "" FORCE)
set(WITH_LIB_CPP OFF CACHE BOOL "" FORCE)
set(WITH_CJSON OFF CACHE BOOL "" FORCE)
set(DOCUMENTATION OFF CACHE BOOL "" FORCE)
set(WITH_STATIC_LIBRARIES ON CACHE BOOL "" FORCE)
FetchContent_Declare(
  mosquitto
  GIT_REPOSITORY https://github.com/eclipse-mosquitto/mosquitto.git
  GIT_TAG        v2.0.11
  GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(mosquitto)
set_target_properties(libmosquitto PROPERTIES EXCLUDE_FROM_ALL TRUE)

# Enable ultra-strict compilation, warnings as errors, and extra validations for our code
set(PUPPET_STRICT_COMPILE_OPTIONS
    -Wall
    -Wextra
    -Wpedantic
    -Werror
    -Wshadow
    -Wformat=2
    -Wcast-align
    -Wconversion
    -Wunused
    -Wnull-dereference

    # Extra Correctness and Undefined Behavior Protections
    -Wvla                       # No Variable Length Arrays (memory safety)
    -Wundef                     # Undefined macros in #if evaluate to an error
    -Wpointer-arith             # Strict pointer arithmetic
    -Wstrict-overflow=5         # Catch bugs relying on signed integer overflow
    -Wwrite-strings             # Enforce const correctness on string literals
    -Wfloat-equal               # Prevent direct == comparisons with floats
    -Wunreachable-code          # Dead code elimination warnings
    -Wimplicit-fallthrough      # Prevent accidental switch-case fallthrough
    -Wlogical-op                # Catch typos like || instead of |
    -Wduplicated-cond           # Catch copy-paste bugs in if-else chains
    -Wduplicated-branches       # Catch if-else chains executing identical code
    -Wshift-overflow=2          # Strict bitwise shift boundary checks
    -Walloc-zero                # Warn on malloc(0)

    # C-specific strict validations
    $<$<COMPILE_LANGUAGE:C>:-Wmissing-prototypes>
    $<$<COMPILE_LANGUAGE:C>:-Wstrict-prototypes>
    $<$<COMPILE_LANGUAGE:C>:-Wold-style-definition>
)

# Add an executable with the source file
add_executable(puppet src/main.c)
target_compile_options(puppet PRIVATE ${PUPPET_STRICT_COMPILE_OPTIONS})
target_compile_definitions(puppet PRIVATE
    PUPPET_VERSION="${PROJECT_VERSION}"
    PUPPET_SERVER_URL="${PUPPET_SERVER_URL}"
    PUPPET_WAKEUP_BROKER_HOST="${PUPPET_WAKEUP_BROKER_HOST}"
    PUPPET_WAKEUP_BROKER_PORT=${PUPPET_WAKEUP_BROKER_PORT}
    PUPPET_WAKEUP_BROKER_TLS=${PUPPET_WAKEUP_BROKER_TLS_VALUE}
)

# Link MMKV Core, Threads, libcurl and libmosquitto to the puppet executable
target_link_libraries(puppet PRIVATE core Threads::Threads gcc_s stdc++ CURL::libcurl libmosquitto_static)
target_include_directories(puppet PRIVATE ${mosquitto_SOURCE_DIR}/include)

# Add include paths for our internal modules
target_include_directories(puppet PRIVATE
    src/storage
    src/stats
    src/http
    src
)

# Force the linker to use CXX (g++) so C++ standard libraries are automatically linked
set_target_properties(puppet PROPERTIES LINKER_LANGUAGE CXX)

# Android requires linking the log library for MMKV
if(ANDROID)
    find_library(log-lib log)
    target_link_libraries(puppet PRIVATE ${log-lib})
endif()

# Unit tests: pure modules only, so they need neither MMKV nor libcurl
option(PUPPET_BUILD_TESTS "Build the puppet unit test runner" ON)
if(PUPPET_BUILD_TESTS)
    enable_testing()
    add_executable(puppet-tests src/test-runner.c)
    target_compile_options(puppet-tests PRIVATE ${PUPPET_STRICT_COMPILE_OPTIONS})
    target_compile_definitions(puppet-tests PRIVATE PUPPET_SERVER_URL="${PUPPET_SERVER_URL}")
    target_include_directories(puppet-tests PRIVATE src)
    target_link_libraries(puppet-tests PRIVATE m)

    # Cross-compiled test binaries cannot execute on the build host
    if(NOT CMAKE_CROSSCOMPILING)
        add_test(NAME puppet-tests COMMAND puppet-tests)
    endif()
endif()
