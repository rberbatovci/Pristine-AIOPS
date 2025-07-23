module telemetry/producer

go 1.23.9

require (
	github.com/golang/protobuf v1.5.4
	github.com/joho/godotenv v1.5.1
	github.com/segmentio/kafka-go v0.4.48
	google.golang.org/grpc v1.72.2
	google.golang.org/protobuf v1.36.6
	telemetry/protobuf v0.0.0
)

require (
	github.com/klauspost/compress v1.15.9 // indirect
	github.com/pierrec/lz4/v4 v4.1.15 // indirect
	golang.org/x/net v0.35.0 // indirect
	golang.org/x/sys v0.30.0 // indirect
	golang.org/x/text v0.22.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250218202821-56aae31c358a // indirect
)

replace telemetry/protobuf => ../protobuf
