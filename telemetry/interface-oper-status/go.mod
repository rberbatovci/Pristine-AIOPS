module telemetry/consumer

go 1.23.9

toolchain go1.24.4

require (
	github.com/golang/protobuf v1.5.4
	github.com/opensearch-project/opensearch-go v1.1.0
	github.com/redis/go-redis/v9 v9.0.5
	github.com/segmentio/kafka-go v0.4.48
	telemetry/protobuf v0.0.0
)

require (
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/klauspost/compress v1.15.9 // indirect
	github.com/pierrec/lz4/v4 v4.1.15 // indirect
	google.golang.org/protobuf v1.36.6 // indirect
)

replace telemetry/protobuf => ../protobuf
