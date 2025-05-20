package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net"

	"github.com/Shopify/sarama"
)

type IPFIXHeader struct {
	Version        uint16
	Length         uint16
	ExportTime     uint32
	SequenceNumber uint32
	ObservationID  uint32
}

type FlowRecord struct {
	SourceAddr     net.IP
	DestAddr       net.IP
	Protocol       uint8
	SourcePort     uint16
	DestPort       uint16
	InputSnmp      uint32
	OutputSnmp     uint32
	BytesCount     uint32
	PacketsCount   uint32
	FirstTimestamp uint64
	LastTimestamp  uint64
}

type IPFIXPacket struct {
	Header  IPFIXHeader
	Records []FlowRecord
}

type KafkaNetflowRecord struct {
	Header         IPFIXHeader `json:"header"`
	SourceAddr     string      `json:"source_addr"`
	DestAddr       string      `json:"dest_addr"`
	Protocol       uint8       `json:"protocol"`
	SourcePort     uint16      `json:"source_port"`
	DestPort       uint16      `json:"dest_port"`
	InputSnmp      uint32      `json:"input_snmp"`
	OutputSnmp     uint32      `json:"output_snmp"`
	BytesCount     uint32      `json:"bytes_count"`
	PacketsCount   uint32      `json:"packets_count"`
	FirstTimestamp uint64      `json:"first_timestamp"`
	LastTimestamp  uint64      `json:"last_timestamp"`
}

const (
	kafkaBrokers = "localhost:9092" // Replace with your Kafka broker address(es)
	kafkaTopic   = "netflow-topic"
)

func main() {
	udpAddr, err := net.ResolveUDPAddr("udp", ":1162")
	if err != nil {
		panic(err)
	}

	conn, err := net.ListenUDP("udp", udpAddr)
	if err != nil {
		panic(err)
	}
	defer conn.Close()

	fmt.Println("IPFIX listener started on :1162, sending to Kafka topic:", kafkaTopic)

	// Sarama configuration
	config := sarama.NewConfig()
	config.Producer.RequiredAcks = sarama.WaitForLocal        // Wait for leader to acknowledge
	config.Producer.Return.Successes = true                   // Return successful sends to channel
	config.Producer.Return.Errors = true                      // Return errors to channel
	config.Producer.Partitioner = sarama.NewRandomPartitioner // Send to random partition

	// Create Sarama producer
	producer, err := sarama.NewAsyncProducer([]string{kafkaBrokers}, config)
	if err != nil {
		panic(fmt.Sprintf("Failed to create Sarama producer: %v", err))
	}
	defer func() {
		if err := producer.Close(); err != nil {
			log.Println("Failed to close Sarama producer:", err)
		}
	}()

	// Handle producer errors
	go func() {
		for err := range producer.Errors() {
			log.Println("Sarama producer error:", err)
		}
	}()

	buffer := make([]byte, 65535)

	for {
		n, _, err := conn.ReadFromUDP(buffer)
		if err != nil {
			fmt.Println("Error reading:", err)
			continue
		}

		packet, err := processIPFIX(buffer[:n])
		if err != nil {
			fmt.Println("Error processing IPFIX:", err)
			continue
		}

		printPacketDetails(packet)
		go sendToKafka(producer, packet)
	}
}

func printPacketDetails(packet *IPFIXPacket) {
	fmt.Println("\n=== Received NetFlow Packet ===")
	fmt.Printf("Header:\n")
	fmt.Printf("  Version: %d\n", packet.Header.Version)
	fmt.Printf("  Length: %d\n", packet.Header.Length)
	fmt.Printf("  ExportTime (raw): %d\n", packet.Header.ExportTime)
	fmt.Printf("  SequenceNumber: %d\n", packet.Header.SequenceNumber)
	fmt.Printf("  ObservationID: %d\n", packet.Header.ObservationID)

	fmt.Printf("\nRecords (%d):\n", len(packet.Records))
	for i, record := range packet.Records {
		fmt.Printf("  Record %d:\n", i+1)
		fmt.Printf("    Source: %s:%d\n", record.SourceAddr, record.SourcePort)
		fmt.Printf("    Destination: %s:%d\n", record.DestAddr, record.DestPort)
		fmt.Printf("    Protocol: %d\n", record.Protocol)
		fmt.Printf("    Input/Output SNMP: %d/%d\n", record.InputSnmp, record.OutputSnmp)
		fmt.Printf("    Bytes/Packets: %d/%d\n", record.BytesCount, record.PacketsCount)
		fmt.Printf("    FirstTimestamp (raw): %d\n", record.FirstTimestamp)
		fmt.Printf("    LastTimestamp (raw): %d\n", record.LastTimestamp)
		fmt.Println("    -------------------------")
	}
	fmt.Println("=== End of Packet ===")
}

func processIPFIX(data []byte) (*IPFIXPacket, error) {
	reader := bytes.NewReader(data)

	var header IPFIXHeader
	if err := binary.Read(reader, binary.BigEndian, &header); err != nil {
		return nil, fmt.Errorf("error reading header: %v", err)
	}

	records, err := processDataRecords(reader)
	if err != nil {
		return nil, fmt.Errorf("error processing records: %v", err)
	}

	return &IPFIXPacket{
		Header:  header,
		Records: records,
	}, nil
}

func processDataRecords(reader *bytes.Reader) ([]FlowRecord, error) {
	var records []FlowRecord

	for reader.Len() >= 45 {
		var record FlowRecord

		sourceAddr := make([]byte, 4)
		if err := binary.Read(reader, binary.BigEndian, &sourceAddr); err != nil {
			return nil, fmt.Errorf("error reading source address: %v", err)
		}
		record.SourceAddr = net.IP(sourceAddr)

		destAddr := make([]byte, 4)
		if err := binary.Read(reader, binary.BigEndian, &destAddr); err != nil {
			return nil, fmt.Errorf("error reading destination address: %v", err)
		}
		record.DestAddr = net.IP(destAddr)

		if err := binary.Read(reader, binary.BigEndian, &record.Protocol); err != nil {
			return nil, fmt.Errorf("error reading protocol: %v", err)
		}
		if err := binary.Read(reader, binary.BigEndian, &record.SourcePort); err != nil {
			return nil, fmt.Errorf("error reading source port: %v", err)
		}
		if err := binary.Read(reader, binary.BigEndian, &record.DestPort); err != nil {
			return nil, fmt.Errorf("error reading destination port: %v", err)
		}
		if err := binary.Read(reader, binary.BigEndian, &record.InputSnmp); err != nil {
			return nil, fmt.Errorf("error reading input SNMP: %v", err)
		}
		if err := binary.Read(reader, binary.BigEndian, &record.OutputSnmp); err != nil {
			return nil, fmt.Errorf("error reading output SNMP: %v", err)
		}
		if err := binary.Read(reader, binary.BigEndian, &record.BytesCount); err != nil {
			return nil, fmt.Errorf("error reading bytes count: %v", err)
		}
		if err := binary.Read(reader, binary.BigEndian, &record.PacketsCount); err != nil {
			return nil, fmt.Errorf("error reading packets count: %v", err)
		}
		if err := binary.Read(reader, binary.BigEndian, &record.FirstTimestamp); err != nil {
			return nil, fmt.Errorf("error reading first timestamp: %v", err)
		}
		if err := binary.Read(reader, binary.BigEndian, &record.LastTimestamp); err != nil {
			return nil, fmt.Errorf("error reading last timestamp: %v", err)
		}

		records = append(records, record)
	}

	return records, nil
}

func sendToKafka(producer sarama.AsyncProducer, packet *IPFIXPacket) {
	for _, record := range packet.Records {
		kafkaRecord := KafkaNetflowRecord{
			Header:         packet.Header,
			SourceAddr:     record.SourceAddr.String(),
			DestAddr:       record.DestAddr.String(),
			Protocol:       record.Protocol,
			SourcePort:     record.SourcePort,
			DestPort:       record.DestPort,
			InputSnmp:      record.InputSnmp,
			OutputSnmp:     record.OutputSnmp,
			BytesCount:     record.BytesCount,
			PacketsCount:   record.PacketsCount,
			FirstTimestamp: record.FirstTimestamp,
			LastTimestamp:  record.LastTimestamp,
		}

		jsonData, err := json.Marshal(kafkaRecord)
		if err != nil {
			fmt.Printf("JSON marshal error: %v\n", err)
			continue // Skip this record if there's an error
		}

		// Create Sarama message
		msg := &sarama.ProducerMessage{
			Topic: kafkaTopic,
			Value: sarama.StringEncoder(jsonData),
		}

		// Send message to Kafka asynchronously
		producer.Input() <- msg

		fmt.Printf("Sent NetFlow record (Seq: %d) from %s:%d to Kafka topic '%s'\n",
			packet.Header.SequenceNumber, record.SourceAddr, record.SourcePort, kafkaTopic)
	}
}
