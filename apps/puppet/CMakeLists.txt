cmake_minimum_required(VERSION 3.19)

# Define the project name and set the languages to C and CXX
project(puppet VERSION 0.0.1 LANGUAGES C CXX)

include(FetchContent)

# Fetch MMKV from GitHub
FetchContent_Declare(
  mmkv
  GIT_REPOSITORY https://github.com/Tencent/MMKV.git
  GIT_TAG        master
  SOURCE_SUBDIR  Core
)
FetchContent_MakeAvailable(mmkv)

# Add threads for cross-platform support
find_package(Threads REQUIRED)

# Add an executable with the source file
add_executable(puppet src/main.c)

# Link MMKV Core and Threads to the puppet executable
target_link_libraries(puppet PRIVATE core Threads::Threads)

# Android requires linking the log library for MMKV
if(ANDROID)
    find_library(log-lib log)
    target_link_libraries(puppet PRIVATE ${log-lib})
endif()
