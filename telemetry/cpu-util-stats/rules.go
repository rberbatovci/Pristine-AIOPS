package main

import (
    "context"
    "log"

    "github.com/jackc/pgx/v5"
)

func isHighCPU(stats map[string]interface{}) bool {
    if stats == nil {
        return false
    }

    thresholdLock.RLock()
    high := highThreshold
    thresholdLock.RUnlock()

    keys := []string{"five-seconds", "one-minute", "five-minutes"}

    for _, k := range keys {
        val, ok := stats[k]
        if !ok {
            return false
        }

        floatVal, ok := convertToFloat(val)
        if !ok || floatVal <= high {
            return false
        }
    }

    return true
}

func isRecoveredCPU(stats map[string]interface{}) bool {
    thresholdLock.RLock()
    low := lowThreshold
    thresholdLock.RUnlock()

    keys := []string{"five-seconds", "one-minute", "five-minutes"}

    for _, k := range keys {
        val, ok := stats[k]
        if !ok {
            return false
        }

        floatVal, ok := convertToFloat(val)
        if !ok || floatVal >= low {
            return false
        }
    }

    return true
}

func connectDB() (*pgx.Conn, error) {
    connStr := "postgres://psqlAdmin:psqlPassword@postgresql:5432/psqlDatabase"
    return pgx.Connect(context.Background(), connStr)
}

func loadCPUThresholds(conn *pgx.Conn) error {
    var high float64
    var low float64

    query := `
        SELECT highthreshold, lowthreshold
        FROM telemetry_signals_rules
        WHERE name = $1
        LIMIT 1
    `

    err := conn.QueryRow(context.Background(), query, "cpu-utilization").Scan(&high, &low)
    if err != nil {
        return err
    }

    thresholdLock.Lock()
    highThreshold = high
    lowThreshold = low
    thresholdLock.Unlock()

    log.Printf("✅ Loaded thresholds: HIGH=%.2f LOW=%.2f", high, low)

    return nil
}
