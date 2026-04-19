package main

import (
    "context"
    "log"
    "reflect"
    "strconv"
    "time"

    "github.com/jackc/pgx/v5"
    "github.com/opensearch-project/opensearch-go"

    telemetryBis "telemetry/protobuf/telemetry"
)

func getValue(field *telemetryBis.TelemetryField) interface{} {
	switch v := field.ValueByType.(type) {
	case *telemetryBis.TelemetryField_BytesValue:
		return v.BytesValue
	case *telemetryBis.TelemetryField_StringValue:
		return v.StringValue
	case *telemetryBis.TelemetryField_BoolValue:
		return v.BoolValue
	case *telemetryBis.TelemetryField_Uint32Value:
		return v.Uint32Value
	case *telemetryBis.TelemetryField_Uint64Value:
		return v.Uint64Value
	case *telemetryBis.TelemetryField_Sint32Value:
		return v.Sint32Value
	case *telemetryBis.TelemetryField_Sint64Value:
		return v.Sint64Value
	case *telemetryBis.TelemetryField_DoubleValue:
		return v.DoubleValue
	case *telemetryBis.TelemetryField_FloatValue:
		return v.FloatValue
	default:
		log.Printf("⚠️ Unknown field type for %s: %T", field.Name, v)
		return nil
	}
}

func convertToFloat(v interface{}) (float64, bool) {
    switch val := v.(type) {
    case float64:
        return val, true
    case float32:
        return float64(val), true
    case int, int32, int64:
        return float64(reflect.ValueOf(val).Int()), true
    case uint, uint32, uint64:
        return float64(reflect.ValueOf(val).Uint()), true
    case string:
        parsed, err := strconv.ParseFloat(val, 64)
        return parsed, err == nil
    default:
        return 0, false
    }
}

func extractCPUUtilization(fields []*telemetryBis.TelemetryField) map[string]interface{} {
	for _, field := range fields {
		for _, subField := range field.Fields {
			if subField.Name == "content" {
				result := make(map[string]interface{})
				for _, cpuField := range subField.Fields {
					switch cpuField.Name {
					case "five-seconds", "five-seconds-intr", "one-minute", "five-minutes":
						value := getValue(cpuField)
						result[cpuField.Name] = value
					}
				}
				if len(result) > 0 {
					return result
				}
			}
		}
	}
	return nil
}

func startThresholdRefresher(conn *pgx.Conn, interval time.Duration) {
    go func() {
        for {
            err := loadCPUThresholds(conn)
            if err != nil {
                log.Printf("❌ Failed to refresh thresholds: %v", err)
            }
            time.Sleep(interval)
        }
    }()
} 

func startPeriodicFlush(ctx context.Context, osClient *opensearch.Client, interval time.Duration) {
    ticker := time.NewTicker(interval)
    go func() {
        for {
            select {
            case <-ticker.C:
                if err := flushBulkToOpenSearch(ctx, osClient, opensearchIndex); err != nil {
                    log.Printf("Periodic bulk flush failed: %v", err)
                }
            case <-ctx.Done():
                ticker.Stop()
                return
            }
        }
    }()
} 