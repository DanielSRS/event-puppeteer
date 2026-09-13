cmake_minimum_required(VERSION 3.19)

# Define the project name and set the languages to C and CXX
project(puppet VERSION 0.0.1 LANGUAGES C CXX)

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

# Add an executable with the source file
add_executable(puppet src/main.c)

# Enable ultra-strict compilation, warnings as errors, and extra validations for our code
target_compile_options(puppet PRIVATE
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
    # C-specific strict validations
    $<$<COMPILE_LANGUAGE:C>:-Wmissing-prototypes>
    $<$<COMPILE_LANGUAGE:C>:-Wstrict-prototypes>
    $<$<COMPILE_LANGUAGE:C>:-Wold-style-definition>
)

# Link MMKV Core and Threads to the puppet executable
target_link_libraries(puppet PRIVATE core Threads::Threads gcc_s stdc++)

# Force the linker to use CXX (g++) so C++ standard libraries are automatically linked
set_target_properties(puppet PROPERTIES LINKER_LANGUAGE CXX)

# Android requires linking the log library for MMKV
if(ANDROID)
    find_library(log-lib log)
    target_link_libraries(puppet PRIVATE ${log-lib})
endif()
