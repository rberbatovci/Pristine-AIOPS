package main

import ( 
    "log"   
	"strings"
    telemetryBis "telemetry/protobuf/telemetry"
)

func extractInterfaceName(fields []*telemetryBis.TelemetryField) string {
	for _, field := range fields {
		if field.Name == "keys" {
			for _, subfield := range field.Fields {
				if subfield.Name == "name" {
					if val, ok := getValue(subfield).(string); ok {
						return val
					}
				}
			}
		}
	}
	return ""
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

func printTelemetryFields(fields []*telemetryBis.TelemetryField, indent string) {
	for _, field := range fields {
		log.Printf("%s- %s (nested: %d)", indent, field.Name, len(field.Fields))
		if len(field.Fields) > 0 {
			printTelemetryFields(field.Fields, indent+"  ")
		}
	}
}

func telemetryFieldsToMap(fields []*telemetryBis.TelemetryField, parentPath string) map[string]interface{} {
	result := make(map[string]interface{})

	cleanParentPath := parentPath
	if cleanParentPath == "content" {
		cleanParentPath = ""
	} else if strings.HasPrefix(cleanParentPath, "content.") {
		cleanParentPath = strings.TrimPrefix(cleanParentPath, "content.")
	}

	for _, field := range fields {
		name := field.Name

		fullPath := name
		if cleanParentPath != "" {
			fullPath = cleanParentPath + "." + name
		}

		if len(field.Fields) > 0 {
			nested := telemetryFieldsToMap(field.Fields, fullPath)
			for k, v := range nested {
				result[k] = v
			}
		} else {
			result[fullPath] = getValue(field)
		}
	}

	return result
}