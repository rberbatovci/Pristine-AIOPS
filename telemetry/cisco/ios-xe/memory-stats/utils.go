package main

import ( 
    "log"    

    telemetryBis "telemetry/protobuf/telemetry"
)

func extractMemoryStats(fields []*telemetryBis.TelemetryField) map[string]interface{} {
	for _, field := range fields {
		for _, subField := range field.Fields {
			if subField.Name == "content" {
				result := make(map[string]interface{})
				var totalMemory, usedMemory uint64

				for _, memField := range subField.Fields {
					switch memField.Name {
					case "total-memory", "used-memory", "free-memory", "lowest-usage", "highest-usage":
						value := getValue(memField)
						result[memField.Name] = value

						// Save total and used memory for percentage calculation
						if memField.Name == "total-memory" {
							if v, ok := value.(uint64); ok {
								totalMemory = v
							}
						}
						if memField.Name == "used-memory" {
							if v, ok := value.(uint64); ok {
								usedMemory = v
							}
						}
					}
				}

				// Calculate usage percentage and add to result
				if totalMemory > 0 {
					usage := int((float64(usedMemory) / float64(totalMemory)) * 100)
					result["usage"] = usage
				}

				if len(result) > 0 {
					return result
				}
			}
		}
	}
	return nil
}

// getValue is a helper function to safely extract the actual value
// from a TelemetryField based on its type.
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
		// Log an unknown type for debugging purposes.
		log.Printf("⚠️ Unknown field type for %s: %T", field.Name, v)
		return nil
	}
}

func extractMemoryKey(fields []*telemetryBis.TelemetryField) string {
    for _, field := range fields {
        if field.Name == "keys" {
            for _, subField := range field.Fields {
                if subField.Name == "name" {
                    if val, ok := getValue(subField).(string); ok {
                        return val
                    }
                }
            }
        }

        // recurse deeper in case "keys" is nested further
        if len(field.Fields) > 0 {
            if key := extractMemoryKey(field.Fields); key != "" {
                return key
            }
        }
    }
    return ""
}

func extractDeviceID(t *telemetryBis.Telemetry) string {
	if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
		return nodeID.NodeIdStr
	}
	return ""
} 


func printTelemetryFields(fields []*telemetryBis.TelemetryField, indent string) {
	for _, field := range fields {
		log.Printf("%s- %s (nested: %d)", indent, field.Name, len(field.Fields))
		if len(field.Fields) > 0 {
			printTelemetryFields(field.Fields, indent+"  ")
		}
	}
}

func isHighMemory(stats map[string]interface{}) bool {
    // Temporary mock: always return false
    // Replace with real logic later
    return false
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