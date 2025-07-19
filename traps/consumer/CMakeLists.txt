cmake_minimum_required(VERSION 3.10)
project(syslog_consumer C)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wall -Wextra -g")

# Find PostgreSQL package
find_package(PostgreSQL REQUIRED)

# List your source files
set(SOURCES
    main.c
    config.c
    process.c
    bulk.c
)

# Create executable
add_executable(trap_consumer ${SOURCES})

# Include PostgreSQL headers
target_include_directories(trap_consumer PRIVATE ${PostgreSQL_INCLUDE_DIRS})

# Link against required libraries
target_link_libraries(trap_consumer
    rdkafka
    jansson
    ${PostgreSQL_LIBRARIES}
    pthread
    curl
)
