cmake_minimum_required(VERSION 3.10)
project(trap_signals C)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wall -Wextra -g")

find_package(PostgreSQL REQUIRED)

set(SOURCES
    main.c
    rules.c
    activeSignals.c
    process.c
)

add_executable(trap_signals ${SOURCES})

target_include_directories(trap_signals PRIVATE ${PostgreSQL_INCLUDE_DIRS})


target_link_libraries(trap_signals
    rdkafka
    jansson
    ${PostgreSQL_LIBRARIES}
    pthread
    curl
    hiredis
)
