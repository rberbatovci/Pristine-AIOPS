package main

import ( 
	"context"
	"log"   
	"github.com/segmentio/kafka-go"
) 

/*
========================================================
KAFKA INITIALIZATION
========================================================
*/
func initKafkaWriter() *kafka.Writer {
	return &kafka.Writer{
		Addr:  kafka.TCP(kafkaBroker),
		Topic: kafkaSignalTopic,
	}
}


/*
========================================================
KAFKA SIGNAL WRITER
========================================================
*/

func kafkaSignalWriter(ctx context.Context, writer *kafka.Writer, in <-chan KafkaSignal) {
	for msg := range in {
		err := writer.WriteMessages(ctx, kafka.Message{
    		Value: msg.Payload,
		})
		if err != nil {
			log.Printf("Kafka signal error: %v", err)
		}
	}
}

/*
========================================================
KAFKA READER
========================================================
*/

func startKafkaReader(ctx context.Context, out chan<- TelemetryMessage) {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{kafkaBroker},
		Topic:   telemetryTopic,
		GroupID: kafkaGroupID,
	})
	defer reader.Close()

	for {
		msg, err := reader.ReadMessage(ctx)
		if err != nil {
			log.Printf("Kafka read error: %v", err)
			continue
		}

		// ✅ Only log size (safe)
		//log.Printf("📨 Kafka message size: %d bytes", len(msg.Value))

		// ✅ DO NOT parse here
		out <- TelemetryMessage{
			Value:       msg.Value,
			Timestamp: msg.Time.Unix(),
		}
	}
}