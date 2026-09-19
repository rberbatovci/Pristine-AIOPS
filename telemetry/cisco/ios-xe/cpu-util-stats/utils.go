package main

import (
	"log"
	"reflect" 
	"strconv" 
	"sync"
	telemetryBis "telemetry/protobuf/telemetry"
)

var (
	thresholdLock sync.RWMutex
	highThreshold float64 = 80.0 
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

func extractDeviceID(t *telemetryBis.Telemetry) string {
	if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
		return nodeID.NodeIdStr
	}
	return ""
} 

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
 
func extractCPUFromParsed(data map[string]interface{}) map[string]interface{} {
	stats := make(map[string]interface{})

	// Example path (you must adjust based on your actual data)
	if cpuUsage, ok := data["cpu-usage"].(map[string]interface{}); ok {

		if v, ok := cpuUsage["one-minute"]; ok {
			stats["cpu_1m"] = v
		}
		if v, ok := cpuUsage["five-minutes"]; ok {
			stats["cpu_5m"] = v
		}
		if v, ok := cpuUsage["five-seconds"]; ok {
			stats["cpu_5s"] = v
		}
	}

	return stats
} 

func debugTopLevel(fields []*telemetryBis.TelemetryField) {
	for i, f := range fields {
		if f == nil {
			continue
		}

		log.Printf("TOP[%d]: %s (children=%d)", i, f.Name, len(f.Fields))
	}
}

func walkCPUFields(fields []*telemetryBis.TelemetryField, path string, result map[string]interface{}) {
	for _, f := range fields {
		currentPath := path + "/" + f.Name

		// 🔥 Detect CPU block by node name ONLY
		if f.Name == "cpu-utilization" {
			for _, sub := range f.Fields {
				switch sub.Name {
				case "five-seconds", "one-minute", "five-minutes":
					result[sub.Name] = getValue(sub)
				}
			}
		}

		// recurse
		if len(f.Fields) > 0 {
			walkCPUFields(f.Fields, currentPath, result)
		}
	}
}

func debugFields(fields []*telemetryBis.TelemetryField, indent string) {
	for _, f := range fields {
		if f == nil {
			continue
		}

		// print current node
		log.Printf("%s- name=%q children=%d value=%v",
			indent, f.Name, len(f.Fields), getValue(f))

		// recursively print children
		if len(f.Fields) > 0 {
			debugFields(f.Fields, indent+"  ")
		}
	}
}