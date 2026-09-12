cmake_minimum_required(VERSION 3.19)

# Define the project name and set the language to C only
project(puppet VERSION 0.0.1 LANGUAGES C)

# Add an executable with the source file
add_executable(puppet src/main.c)
