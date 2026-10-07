set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR arm)

# Specify the cross compiler (requires gcc-arm-linux-gnu installed)
set(CMAKE_C_COMPILER arm-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER arm-linux-gnu-g++)

# Define SYSROOT_DIR (can be passed via -DSYSROOT_DIR=...)
if(NOT SYSROOT_DIR)
    # Default to a local sysroot or the reference one if present
    set(SYSROOT_DIR "${CMAKE_CURRENT_LIST_DIR}/../sysroot")
endif()

# The stamp records which version of the setup script produced the sysroot,
# so editing its package list re-runs it over an existing sysroot.
set(SYSROOT_SETUP_SCRIPT "${CMAKE_CURRENT_LIST_DIR}/../scripts/setup-arm32-sysroot.sh")
set(SYSROOT_STAMP_FILE "${SYSROOT_DIR}/.setup-script.sha256")
file(SHA256 "${SYSROOT_SETUP_SCRIPT}" SYSROOT_SETUP_SCRIPT_HASH)
set(SYSROOT_RECORDED_HASH "")
if(EXISTS "${SYSROOT_STAMP_FILE}")
    file(READ "${SYSROOT_STAMP_FILE}" SYSROOT_RECORDED_HASH)
endif()

# Auto-download the sysroot if it doesn't exist or is out of date
if(NOT SYSROOT_RECORDED_HASH STREQUAL SYSROOT_SETUP_SCRIPT_HASH)
    message(STATUS "Sysroot at ${SYSROOT_DIR} is missing or outdated. Running setup-arm32-sysroot.sh...")
    execute_process(
        COMMAND bash "${SYSROOT_SETUP_SCRIPT}" "${SYSROOT_DIR}"
        WORKING_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}/.."
        RESULT_VARIABLE SYSROOT_SETUP_RESULT
    )
    if(NOT SYSROOT_SETUP_RESULT EQUAL 0)
        message(FATAL_ERROR "Failed to setup sysroot! Script exited with code ${SYSROOT_SETUP_RESULT}.")
    endif()
    file(WRITE "${SYSROOT_STAMP_FILE}" "${SYSROOT_SETUP_SCRIPT_HASH}")
endif()

# Only set CMAKE_SYSROOT if the directory actually exists to avoid CMake errors
if(EXISTS "${SYSROOT_DIR}")
    set(CMAKE_SYSROOT ${SYSROOT_DIR})

    # Help pkg-config find the sysroot files
    set(ENV{PKG_CONFIG_DIR} "")
    set(ENV{PKG_CONFIG_LIBDIR} "${SYSROOT_DIR}/usr/lib/arm-linux-gnueabihf/pkgconfig:${SYSROOT_DIR}/usr/share/pkgconfig")
    set(ENV{PKG_CONFIG_SYSROOT_DIR} ${SYSROOT_DIR})

    # Add sysroot specific flags
    set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -B ${SYSROOT_DIR}/usr/lib/arm-linux-gnueabihf -isystem ${SYSROOT_DIR}/usr/include/arm-linux-gnueabihf")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -B ${SYSROOT_DIR}/usr/lib/arm-linux-gnueabihf -isystem ${SYSROOT_DIR}/usr/include/arm-linux-gnueabihf -isystem ${SYSROOT_DIR}/usr/include/c++/10 -isystem ${SYSROOT_DIR}/usr/include/arm-linux-gnueabihf/c++/10")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -B ${SYSROOT_DIR}/usr/lib/arm-linux-gnueabihf -isystem ${SYSROOT_DIR}/usr/include/arm-linux-gnueabihf -L${SYSROOT_DIR}/usr/lib/arm-linux-gnueabihf -L${SYSROOT_DIR}/usr/lib/gcc/arm-linux-gnueabihf/10 -L${SYSROOT_DIR}/lib/arm-linux-gnueabihf -Wl,-rpath-link=${SYSROOT_DIR}/lib/arm-linux-gnueabihf -Wl,-rpath-link=${SYSROOT_DIR}/usr/lib/arm-linux-gnueabihf")
endif()

# Search for programs in the build host directories
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)

# For libraries and headers in the target directories
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
