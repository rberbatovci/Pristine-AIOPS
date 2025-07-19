cmake_minimum_required(VERSION 3.10)
project(syslog_consumer C)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wall -Wextra -g")

# Find PostgreSQL package
find_package(PostgreSQL REQUIRED)

# List your source files
set(SOURCES
    main.c
    rules.c
    activeSignals.c
    process.c
)

# Create executable
add_executable(syslog_signals ${SOURCES})

# Include PostgreSQL headers
target_include_directories(syslog_signals PRIVATE ${PostgreSQL_INCLUDE_DIRS})

# OPTIONAL: Include jansson headers explicitly if needed
# target_include_directories(syslog_signals PRIVATE /usr/include)

# Link against required libraries
target_link_libraries(syslog_signals
    rdkafka
    jansson
    ${PostgreSQL_LIBRARIES}
    pthread
    curl
    hiredis
)
