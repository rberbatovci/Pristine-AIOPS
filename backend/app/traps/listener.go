package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/Shopify/sarama"
	"github.com/gosnmp/gosnmp"
)

// SNMPConfig struct to match the FastAPI model
type SNMPConfig struct {
	UDPPort   int    `json:"udp_port"`
	MsgFlags  string `json:"msg_flags"`
	Username  string `json:"username"`
	AuthPass  string `json:"auth_pass"`
	AuthProto string `json:"auth_proto"`
	PrivPass  string `json:"priv_pass"`
	PrivProto string `json:"priv_proto"` // Added missing field
	EngineID  string `json:"engineid"`
}

func main() {
	// Fetch configuration from FastAPI
	config, err := fetchSNMPConfig("http://localhost:8000/traps/receiver/configure/")
	if err != nil {
		log.Fatalf("Error fetching SNMP configuration: %v", err)
		return
	}

	// Configure Kafka producer
	kafkaBroker := "localhost:9092"
	topic := "traps-topic" // Kafka topic to send data to
	producer, err := sarama.NewSyncProducer([]string{kafkaBroker}, nil)
	if err != nil {
		log.Fatalf("Failed to start Kafka producer: %v", err)
	}
	defer producer.Close()

	// Configure SNMPv3 parameters
	trapListener := gosnmp.NewTrapListener()
	trapListener.Params = &gosnmp.GoSNMP{
		Version:       gosnmp.Version3,
		SecurityModel: gosnmp.UserSecurityModel,
		MsgFlags:      getMsgFlags(config.MsgFlags),
		SecurityParameters: &gosnmp.UsmSecurityParameters{
			UserName:                 config.Username,
			AuthenticationProtocol:   getAuthProto(config.AuthProto),
			AuthenticationPassphrase: config.AuthPass,
			PrivacyProtocol:          getPrivProto(config.PrivProto),
			PrivacyPassphrase:        config.PrivPass,
			AuthoritativeEngineID:    config.EngineID,
		},
	}

	trapListener.OnNewTrap = func(packet *gosnmp.SnmpPacket, addr *net.UDPAddr) {
		fmt.Printf("Received trap from %s\n", addr.IP)

		// Get the IP address of the sender
		deviceIP := addr.IP.String()

		// Prepare OID map from trap data
		oidMap := make(map[string]interface{})
		for _, v := range packet.Variables {
			oidMap[v.Name] = v.Value
		}

		// Construct trap payload, including device IP
		payload := map[string]interface{}{
			"content": oidMap,
			"device":  deviceIP,
		}

		// Marshal the payload into JSON
		jsonPayload, err := json.Marshal(payload)
		if err != nil {
			log.Printf("Error marshalling JSON: %v", err)
			return
		}

		// Send the trap data to Kafka
		kafkaMessage := &sarama.ProducerMessage{
			Topic: topic,
			Value: sarama.StringEncoder(jsonPayload),
		}

		_, _, err = producer.SendMessage(kafkaMessage)
		if err != nil {
			log.Printf("Failed to send message to Kafka: %v", err)
			return
		}

		log.Printf("Sent trap from %s to Kafka topic '%s'", deviceIP, topic)
	}

	// Start listening on the configured port
	listenAddress := fmt.Sprintf("0.0.0.0:%d", config.UDPPort)
	go func() {
		err := trapListener.Listen(listenAddress)
		if err != nil {
			log.Fatalf("Error starting SNMP trap listener: %s", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	fmt.Printf("Listening for SNMPv3 traps on %s...\n", listenAddress)
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	fmt.Println("Shutting down...")
	trapListener.Close()
}

func fetchSNMPConfig(url string) (*SNMPConfig, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch config, status code: %d", resp.StatusCode)
	}

	var config SNMPConfig
	if err := json.NewDecoder(resp.Body).Decode(&config); err != nil {
		return nil, err
	}

	return &config, nil
}

func getMsgFlags(flagStr string) gosnmp.SnmpV3MsgFlags {
	switch flagStr {
	case "AuthPriv":
		return gosnmp.AuthPriv
	case "AuthNoPriv":
		return gosnmp.AuthNoPriv
	case "NoAuthNoPriv":
		return gosnmp.NoAuthNoPriv
	default:
		log.Printf("Warning: Unknown message flags '%s', defaulting to AuthPriv", flagStr)
		return gosnmp.AuthPriv
	}
}

func getAuthProto(proto string) gosnmp.SnmpV3AuthProtocol {
	switch proto {
	case "SHA":
		return gosnmp.SHA
	case "MD5":
		return gosnmp.MD5
	default:
		log.Printf("Warning: Unknown authentication protocol '%s', defaulting to SHA", proto)
		return gosnmp.SHA
	}
}

func getPrivProto(proto string) gosnmp.SnmpV3PrivProtocol {
	switch proto {
	case "AES":
		return gosnmp.AES
	case "DES":
		return gosnmp.DES
	case "AES192":
		return gosnmp.AES192
	case "AES256":
		return gosnmp.AES256
	case "AES192C":
		return gosnmp.AES192C
	case "AES256C":
		return gosnmp.AES256C
	default:
		log.Printf("Warning: Unknown privacy protocol '%s', defaulting to AES", proto)
		return gosnmp.AES
	}
}
